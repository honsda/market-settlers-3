import { EmbedBuilder } from 'discord.js';
import { SITE, getItem, searchItems } from '../src/lib/market';
import { getItemMarket, getMarketResponse } from '../src/lib/server/dashboard';
import {
	cancelOffer,
	createOffer,
	getPlayerSummary,
	listOffers
} from '../src/lib/server/offers';
import { parseOfferInput } from '../src/lib/server/validation';
import { getMeta, setMeta } from '../src/lib/server/db';
import { formatQty, formatPrice } from '../src/lib/format';
import {
	COLORS,
	dashboardUrl,
	offerEmbed
} from './format';
import {
	marketEmbed,
	offersEmbed,
	playerEmbed,
	priceEmbed,
	resolveItemId
} from './commands';
import { rulesEmbedFor } from './rules';
import {
	editChannelMessage,
	editOriginalInteraction,
	getChannel,
	getGuild,
	pinChannelMessage,
	sendChannelMessage,
	type DiscordChannel
} from './discord-rest';

const EPHEMERAL = 64;

export interface InteractionContext {
	waitUntil(promise: Promise<unknown>): void;
}

interface InteractionOption {
	name: string;
	value?: string | number | boolean;
	focused?: boolean;
}

interface InteractionData {
	id?: string;
	name?: string;
	options?: InteractionOption[];
	custom_id?: string;
	component_type?: number;
	resolved?: {
		channels?: Record<string, DiscordChannel>;
	};
}

export interface InteractionPayload {
	id: string;
	application_id: string;
	type: number;
	data?: InteractionData;
	guild_id?: string;
	guild?: { id: string; name?: string };
	channel_id?: string;
	channel?: { id: string; name?: string; type: number };
	member?: {
		user?: { id: string; username: string };
		permissions?: string;
	};
	user?: { id: string; username: string };
	token: string;
}

interface MessageData {
	content?: string;
	embeds?: EmbedBuilder[];
	components?: unknown[];
	ephemeral?: boolean;
}

function messageData(data: MessageData): Record<string, unknown> {
	return {
		content: data.content,
		embeds: data.embeds?.map((embed) => embed.toJSON()),
		components: data.components,
		flags: data.ephemeral ? EPHEMERAL : undefined
	};
}

function message(data: MessageData): Record<string, unknown> {
	return { type: 4, data: messageData(data) };
}

function ephemeral(content: string): Record<string, unknown> {
	return message({ content, ephemeral: true });
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Something went wrong.';
}

function option(payload: InteractionPayload, name: string): InteractionOption | undefined {
	return payload.data?.options?.find((entry) => entry.name === name);
}

function stringOption(payload: InteractionPayload, name: string): string | undefined {
	const value = option(payload, name)?.value;
	return typeof value === 'string' ? value : undefined;
}

function numberOption(payload: InteractionPayload, name: string): number | undefined {
	const value = option(payload, name)?.value;
	return typeof value === 'number' ? value : undefined;
}

function hasPermission(payload: InteractionPayload, bit: bigint): boolean {
	const raw = payload.member?.permissions;
	if (!raw) return false;
	try {
		return (BigInt(raw) & bit) === bit;
	} catch {
		return false;
	}
}

function isStaff(payload: InteractionPayload): boolean {
	return hasPermission(payload, 0x20n) || hasPermission(payload, 0x8n);
}

function channelFromOption(
	payload: InteractionPayload,
	name: string
): DiscordChannel | undefined {
	const id = stringOption(payload, name);
	if (!id) return undefined;
	return payload.data?.resolved?.channels?.[id] ?? { id, type: 0 };
}

function rulesKey(guildId: string, channelId: string): string {
	return `rules:message:${guildId}:${channelId}`;
}

async function handlePrice(payload: InteractionPayload): Promise<Record<string, unknown>> {
	const raw = stringOption(payload, 'item');
	if (!raw) return ephemeral('Pick an item.');
	const itemId = resolveItemId(raw);
	const entry = await getItemMarket(itemId);
	if (!entry) {
		return message({
			embeds: [
				new EmbedBuilder()
					.setColor(COLORS.neutral)
					.setAuthor({ name: `Market price · ${getItem(itemId)?.name ?? itemId}` })
					.setDescription('No offers or price history for this item yet.')
					.setURL(dashboardUrl(`/market?item=${itemId}`))
			],
			ephemeral: true
		});
	}
	return message({ embeds: [priceEmbed(entry)] });
}

async function handleMarket(payload: InteractionPayload): Promise<Record<string, unknown>> {
	const sort = stringOption(payload, 'sort') ?? 'activity';
	const response = await getMarketResponse();
	return message({ embeds: [marketEmbed(response, sort)] });
}

async function handleOffers(payload: InteractionPayload): Promise<Record<string, unknown>> {
	const rawItem = stringOption(payload, 'item');
	const sideRaw = stringOption(payload, 'side');
	const side = sideRaw === 'buy' || sideRaw === 'sell' ? sideRaw : undefined;
	const player = stringOption(payload, 'player')?.trim();
	const itemId = rawItem ? resolveItemId(rawItem) : undefined;

	const offers = await listOffers({
		status: 'open',
		itemId,
		side,
		ign: player || undefined,
		limit: 10
	});
	const label = [
		itemId ? getItem(itemId)?.name ?? itemId : null,
		side ? (side === 'buy' ? 'buy orders' : 'sell offers') : null,
		player ? `by ${player}` : null
	]
		.filter(Boolean)
		.join(' · ');

	return message({ embeds: [offersEmbed(offers, label)] });
}

async function handlePlayer(payload: InteractionPayload): Promise<Record<string, unknown>> {
	const ign = stringOption(payload, 'ign')?.trim();
	if (!ign) return ephemeral('Enter a trader IGN.');
	const summary = await getPlayerSummary(ign);
	if (!summary.lastSeen) {
		return message({
			embeds: [
				new EmbedBuilder()
					.setColor(COLORS.neutral)
					.setDescription(`No offers found for **${ign}**.`)
			],
			ephemeral: true
		});
	}
	return message({ embeds: [playerEmbed(summary)] });
}

async function handlePost(payload: InteractionPayload): Promise<Record<string, unknown>> {
	const sideRaw = stringOption(payload, 'side');
	const side = sideRaw === 'buy' || sideRaw === 'sell' ? sideRaw : undefined;
	const rawItem = stringOption(payload, 'item');
	const quantity = numberOption(payload, 'quantity');
	const price = numberOption(payload, 'price');
	const ign = stringOption(payload, 'ign');

	if (!side || !rawItem || !quantity || !price || !ign) {
		return ephemeral('Missing one of the required offer fields.');
	}

	const itemId = resolveItemId(rawItem);
	const input = parseOfferInput({
		side,
		itemId,
		quantity,
		price,
		ign,
		guild: stringOption(payload, 'guild') ?? '',
		contact: stringOption(payload, 'contact') ?? '',
		note: stringOption(payload, 'note') ?? '',
		world: SITE.world,
		x: numberOption(payload, 'x'),
		y: numberOption(payload, 'y'),
		z: numberOption(payload, 'z')
	});
	const { offer, editToken } = await createOffer(input, { source: 'discord' });
	const item = getItem(offer.itemId);

	const components = [
		{
			type: 1,
			components: [
				{
					type: 2,
					style: 4,
					label: 'Cancel this offer',
					custom_id: `offer:cancel:${offer.id}:${editToken}`
				},
				{
					type: 2,
					style: 5,
					label: 'View on dashboard',
					url: dashboardUrl(`/market?item=${offer.itemId}`)
				}
			]
		}
	];

	return message({
		embeds: [offerEmbed(offer, item)],
		components,
		ephemeral: true
	});
}

async function handleAlerts(payload: InteractionPayload): Promise<Record<string, unknown>> {
	if (!isStaff(payload)) {
		return ephemeral('You need the **Manage Server** permission to change the alert channel.');
	}

	const picked = channelFromOption(payload, 'channel');
	if (!picked) return ephemeral('Pick a normal server text or announcement channel.');

	let channel: DiscordChannel = picked;
	try {
		channel = await getChannel(picked.id);
	} catch {
		// Fall back to the resolved channel object from the interaction.
	}
	if (channel.type !== 0 && channel.type !== 5) {
		return ephemeral('Pick a normal server text or announcement channel.');
	}

	await setMeta('bot:alert_channel_id', channel.id);
	if (channel.name) await setMeta('bot:alert_channel_name', channel.name);

	const publishes = channel.type === 5;
	return message({
		embeds: [
			new EmbedBuilder()
				.setColor(COLORS.bid)
				.setDescription(
					`Market updates will now be posted in <#${channel.id}>${publishes ? ' and published to its followers' : ''}.\nMoves above the configured threshold and new 7-day extremes are queued automatically.`
				)
		],
		ephemeral: true
	});
}

async function runInitRule(payload: InteractionPayload): Promise<void> {
	const guildId = payload.guild_id;
	const channelId = payload.channel_id;
	if (!guildId || !channelId) {
		await editOriginalInteraction(payload.application_id, payload.token, {
			content: 'This command only works inside a server.'
		});
		return;
	}

	if (!isStaff(payload)) {
		await editOriginalInteraction(payload.application_id, payload.token, {
			content: 'You need the **Manage Server** permission to post the community rules.'
		});
		return;
	}

	const selected = channelFromOption(payload, 'channel');
	const targetId = selected?.id ?? channelId;
	let target: DiscordChannel;
	try {
		target = await getChannel(targetId);
	} catch (error) {
		await editOriginalInteraction(payload.application_id, payload.token, {
			content: `Could not find that channel: ${errorMessage(error)}`
		});
		return;
	}
	if (target.type !== 0) {
		await editOriginalInteraction(payload.application_id, payload.token, {
			content: 'Pick a normal text channel for the rules.'
		});
		return;
	}

	const guild = await getGuild(guildId).catch(() => ({
		id: guildId,
		name: payload.guild?.name ?? 'This server'
	}));
	const key = rulesKey(guildId, target.id);
	const storedId = await getMeta(key);
	const embed = rulesEmbedFor(guild.name);

	let messageId = storedId ?? null;
	let action: 'posted' | 'updated' = 'posted';
	if (messageId) {
		try {
			await editChannelMessage(target.id, messageId, { embeds: [embed.toJSON()] });
			action = 'updated';
		} catch {
			messageId = null;
		}
	}

	if (!messageId) {
		const sent = await sendChannelMessage(target.id, { embeds: [embed.toJSON()] });
		messageId = sent.id;
		await setMeta(key, messageId);
	}

	await pinChannelMessage(target.id, messageId).catch(() => undefined);
	await editOriginalInteraction(payload.application_id, payload.token, {
		content: `Community rules ${action} in <#${target.id}>.`
	});
}

async function handleInitRule(
	payload: InteractionPayload,
	ctx: InteractionContext
): Promise<Record<string, unknown>> {
	ctx.waitUntil(
		runInitRule(payload).catch(async (error) => {
			await editOriginalInteraction(payload.application_id, payload.token, {
				content: `⚠️ ${errorMessage(error)}`
			}).catch(() => undefined);
		})
	);
	return { type: 5, data: { flags: EPHEMERAL } };
}

async function handleAutocomplete(payload: InteractionPayload): Promise<Record<string, unknown>> {
	const focused = payload.data?.options?.find((entry) => entry.focused);
	if (focused?.name !== 'item') {
		return { type: 8, data: { choices: [] } };
	}
	const query = String(focused.value ?? '').trim();
	const matches = searchItems(query).slice(0, 25);
	return {
		type: 8,
		data: {
			choices: matches.map((item) => ({
				name: `${item.name} · ${item.category}`.slice(0, 100),
				value: item.id
			}))
		}
	};
}

async function handleButton(payload: InteractionPayload): Promise<Record<string, unknown>> {
	const customId = payload.data?.custom_id ?? '';
	if (customId.startsWith('offer:cancel:')) {
		const [, , offerId, token] = customId.split(':');
		if (!offerId || !token) return ephemeral('That cancel button is invalid.');
		const offer = await cancelOffer(offerId, token, 'cancelled');
		const item = getItem(offer.itemId);
		return {
			type: 7,
			data: {
				embeds: [
					new EmbedBuilder()
						.setColor(COLORS.danger)
						.setAuthor({ name: `Offer cancelled · ${item?.name ?? offer.itemId}` })
						.setDescription(
							`The ${offer.side === 'buy' ? 'buy order' : 'sell offer'} for **${formatQty(
								offer.quantity
							)} units @ ${formatPrice(offer.price)} c** has been cancelled.`
						)
						.setFooter({ text: 'Settlers Market · Discord' })
						.toJSON()
				],
				components: []
			}
		};
	}

	return ephemeral('That button is no longer available in the free Worker version.');
}

export async function handleInteraction(
	payload: InteractionPayload,
	ctx: InteractionContext
): Promise<Record<string, unknown>> {
	if (payload.type === 1) return { type: 1 };

	if (payload.type === 4) {
		return handleAutocomplete(payload);
	}

	if (payload.type === 3) {
		try {
			return await handleButton(payload);
		} catch (error) {
			return ephemeral(`⚠️ ${errorMessage(error)}`);
		}
	}

	if (payload.type !== 2) {
		return ephemeral('This interaction is not supported in the free Worker version.');
	}

	try {
		switch (payload.data?.name) {
			case 'price':
				return await handlePrice(payload);
			case 'market':
				return await handleMarket(payload);
			case 'offers':
				return await handleOffers(payload);
			case 'player':
				return await handlePlayer(payload);
			case 'post':
				return await handlePost(payload);
			case 'alerts':
				return await handleAlerts(payload);
			case 'initrule':
				return await handleInitRule(payload, ctx);
			case 'apply':
				return ephemeral(
					'The DM application flow needs the gateway bot. Use the website or ask staff to apply.'
				);
			default:
				return ephemeral('That command is not available in the free Worker version.');
		}
	} catch (error) {
		console.error('[bot] Interaction failed:', error);
		return ephemeral(`⚠️ ${errorMessage(error)}`);
	}
}
