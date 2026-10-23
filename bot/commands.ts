import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	EmbedBuilder,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	type AutocompleteInteraction,
	type ButtonInteraction,
	type ChatInputCommandInteraction
} from 'discord.js';
import {
	SITE,
	getItem,
	itemTexture,
	searchItems,
	type ItemMarket,
	type MarketResponse
} from '../src/lib/market';
import { formatPct, formatPrice, formatQty, timeAgo } from '../src/lib/format';
import { getItemMarket, getMarketResponse } from '../src/lib/server/dashboard';
import { listOffers, getPlayerSummary, createOffer, cancelOffer } from '../src/lib/server/offers';
import { parseOfferInput } from '../src/lib/server/validation';
import { setMeta } from '../src/lib/server/db';
import { COLORS, dashboardUrl, footer, offerEmbed } from './format';

export const commandData = [
	new SlashCommandBuilder()
		.setName('price')
		.setDescription('Best bid, best ask, spread and recent move for an item.')
		.setContexts(InteractionContextType.Guild)
		.addStringOption((option) =>
			option
				.setName('item')
				.setDescription('Item to look up')
				.setRequired(true)
				.setAutocomplete(true)
		),

	new SlashCommandBuilder()
		.setName('market')
		.setDescription('A compact board of the most active item markets.')
		.setContexts(InteractionContextType.Guild)
		.addStringOption((option) =>
			option
				.setName('sort')
				.setDescription('How to rank the markets')
				.addChoices(
					{ name: 'Activity', value: 'activity' },
					{ name: 'Movers', value: 'movers' },
					{ name: 'Tightest spread', value: 'spread' }
				)
		),

	new SlashCommandBuilder()
		.setName('offers')
		.setDescription('Browse live buy orders and sell offers.')
		.setContexts(InteractionContextType.Guild)
		.addStringOption((option) =>
			option.setName('item').setDescription('Only this item').setAutocomplete(true)
		)
		.addStringOption((option) =>
			option
				.setName('side')
				.setDescription('Only buy orders or only sell offers')
				.addChoices({ name: 'Buy orders', value: 'buy' }, { name: 'Sell offers', value: 'sell' })
		)
		.addStringOption((option) =>
			option.setName('player').setDescription('Filter by a trader IGN').setMaxLength(16)
		),

	new SlashCommandBuilder()
		.setName('player')
		.setDescription('Guild, open offers and activity for a trader.')
		.setContexts(InteractionContextType.Guild)
		.addStringOption((option) =>
			option.setName('ign').setDescription('Minecraft in-game name').setRequired(true).setMaxLength(16)
		),

	new SlashCommandBuilder()
		.setName('post')
		.setDescription('Publish a buy order or sell offer straight from Discord.')
		.setContexts(InteractionContextType.Guild)
		.addStringOption((option) =>
			option
				.setName('side')
				.setDescription('Are you buying or selling?')
				.setRequired(true)
				.addChoices({ name: 'Buy', value: 'buy' }, { name: 'Sell', value: 'sell' })
		)
		.addStringOption((option) =>
			option.setName('item').setDescription('Item to trade').setRequired(true).setAutocomplete(true)
		)
		.addIntegerOption((option) =>
			option
				.setName('quantity')
				.setDescription('How many units')
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(1_000_000)
		)
		.addNumberOption((option) =>
			option
				.setName('price')
				.setDescription('Coins per unit')
				.setRequired(true)
				.setMinValue(0.01)
				.setMaxValue(1_000_000)
		)
		.addStringOption((option) =>
			option
				.setName('ign')
				.setDescription('Your Minecraft in-game name')
				.setRequired(true)
				.setMinLength(3)
				.setMaxLength(16)
		)
		.addStringOption((option) =>
			option.setName('guild').setDescription('Your guild (optional)').setMaxLength(32)
		)
		.addStringOption((option) =>
			option.setName('contact').setDescription('Discord handle or other contact (optional)').setMaxLength(64)
		)
		.addStringOption((option) =>
			option.setName('note').setDescription('Short note for the offer (optional)').setMaxLength(160)
		)
		.addIntegerOption((option) =>
			option.setName('x').setDescription('Meeting point X (optional)').setMinValue(-30_000_000).setMaxValue(30_000_000)
		)
		.addIntegerOption((option) =>
			option.setName('y').setDescription('Meeting point Y (optional)').setMinValue(-64).setMaxValue(320)
		)
		.addIntegerOption((option) =>
			option.setName('z').setDescription('Meeting point Z (optional)').setMinValue(-30_000_000).setMaxValue(30_000_000)
		),

	new SlashCommandBuilder()
		.setName('alerts')
		.setDescription('Choose where significant market price alerts are posted.')
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addChannelOption((option) =>
			option
				.setName('channel')
				.setDescription('Channel for price alerts')
				.setRequired(true)
				.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
		)
];

function resolveItemId(raw: string): string {
	const item = getItem(raw.trim());
	if (item) return item.id;
	const match = searchItems(raw).length === 1 ? searchItems(raw)[0] : undefined;
	if (match) return match.id;
	throw new Error(`I could not find an item called “${raw}”.`);
}

function dash(value: number | null): string {
	return value === null ? '—' : `${formatPrice(value)} c`;
}

function itemTitle(entry: ItemMarket): string {
	return getItem(entry.itemId)?.name ?? entry.itemId;
}

function priceEmbed(entry: ItemMarket): EmbedBuilder {
	const item = getItem(entry.itemId);
	const name = item?.name ?? entry.itemId;
	const history = entry.history.filter((point) => point.mid !== null);
	const lows = history.map((point) => point.mid as number);
	const low = lows.length ? Math.min(...lows) : null;
	const high = lows.length ? Math.max(...lows) : null;
	const direction = entry.changePct === null ? 'flat' : entry.changePct >= 0 ? 'up' : 'down';

	const embed = new EmbedBuilder()
		.setColor(
			entry.changePct === null
				? COLORS.neutral
				: entry.changePct >= 0
					? COLORS.bid
					: COLORS.danger
		)
		.setAuthor({ name: `Market price · ${name}`, iconURL: item ? itemTexture(item) : undefined })
		.setTitle(`${dash(entry.bestBid)} bid  ·  ${dash(entry.bestAsk)} ask`)
		.setURL(dashboardUrl(`/market?item=${entry.itemId}`))
		.addFields(
			{
				name: 'Best bid',
				value: `${dash(entry.bestBid)}\n${formatQty(entry.bidQty)} units · ${entry.bidCount} orders`,
				inline: true
			},
			{
				name: 'Best ask',
				value: `${dash(entry.bestAsk)}\n${formatQty(entry.askQty)} units · ${entry.askCount} offers`,
				inline: true
			},
			{
				name: 'Spread',
				value:
					entry.spread === null
						? '—'
						: `${formatPrice(entry.spread)} c${entry.spreadPct === null ? '' : ` (${formatPct(entry.spreadPct, false)})`}`,
				inline: true
			},
			{
				name: '24h move',
				value: entry.changePct === null ? '—' : `${formatPct(entry.changePct)} ${direction}`,
				inline: true
			},
			{
				name: '7d range',
				value: low === null || high === null ? '—' : `${formatPrice(low)} – ${formatPrice(high)} c`,
				inline: true
			},
			{
				name: 'Book depth',
				value: `${formatQty(entry.bidQtyTotal)} buy / ${formatQty(entry.askQtyTotal)} sell units`,
				inline: true
			}
		)
		.setDescription(
			`Trade **${name}** on ${SITE.server}. Prices are player-set; use the link above for the full order book.`
		)
		.setTimestamp(new Date());

	return footer(embed);
}

function marketEmbed(response: MarketResponse, sort: string): EmbedBuilder {
	const live = response.items.filter((entry) => entry.bidCount + entry.askCount > 0);
	const ranked = [...live];
	if (sort === 'movers') {
		ranked.sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0));
	} else if (sort === 'spread') {
		ranked.sort(
			(a, b) => (a.spreadPct ?? Number.MAX_SAFE_INTEGER) - (b.spreadPct ?? Number.MAX_SAFE_INTEGER)
		);
	} else {
		ranked.sort(
			(a, b) =>
				b.bidCount + b.askCount - (a.bidCount + a.askCount) ||
				(b.bestBid ?? 0) * b.bidQtyTotal + (b.bestAsk ?? 0) * b.askQtyTotal -
					((a.bestBid ?? 0) * a.bidQtyTotal + (a.bestAsk ?? 0) * a.askQtyTotal)
		);
	}

	const label = sort === 'movers' ? 'Biggest movers' : sort === 'spread' ? 'Tightest spreads' : 'Most active';
	const lines = ranked.slice(0, 14).map((entry) => {
		const spread = entry.spreadPct === null ? '—' : `${entry.spreadPct.toFixed(1)}%`;
		return `**${itemTitle(entry)}** · \`${dash(entry.bestBid)}\` / \`${dash(entry.bestAsk)}\` · ${formatPct(entry.changePct)} · ${spread} spread`;
	});

	const embed = new EmbedBuilder()
		.setColor(COLORS.neutral)
		.setAuthor({ name: `Settlers Market · ${label}` })
		.setDescription(lines.length ? lines.join('\n') : 'No live offers yet — be the first to post one.')
		.setURL(dashboardUrl('/market'))
		.addFields(
			{
				name: 'Open book',
				value: `${response.summary.openBuys} buy orders · ${response.summary.openSells} sell offers`,
				inline: true
			},
			{
				name: 'Listed value',
				value: `${formatPrice(response.summary.listedValue)} c`,
				inline: true
			},
			{
				name: 'Traders (7d)',
				value: formatQty(response.summary.traders),
				inline: true
			}
		)
		.setFooter({ text: `${SITE.world} · Settlers Market` })
		.setTimestamp(new Date(response.serverTime));

	return embed;
}

function offersEmbed(offers: ReturnType<typeof listOffers>, filterLabel: string): EmbedBuilder {
	const lines = offers.slice(0, 10).map((offer) => {
		const item = getItem(offer.itemId);
		const name = item?.name ?? offer.itemId;
		const side = offer.side === 'buy' ? 'BUY ' : 'SELL';
		const guild = offer.guild ? ` · ${offer.guild}` : '';
		return `\`${side}\` **${formatQty(offer.quantity)} × ${name}** @ ${formatPrice(offer.price)} c — \`${offer.ign}\`${guild} · ${timeAgo(offer.createdAt)}`;
	});

	const embed = new EmbedBuilder()
		.setColor(COLORS.neutral)
		.setAuthor({ name: `Live offers${filterLabel ? ` · ${filterLabel}` : ''}` })
		.setDescription(lines.length ? lines.join('\n') : 'Nothing matches those filters right now.')
		.setURL(dashboardUrl('/market'))
		.addFields({
			name: 'Matching offers',
			value: `${offers.length} shown${offers.length === 10 ? ' (first 10)' : ''}`,
			inline: true
		})
		.setFooter({ text: 'Post or cancel offers on the dashboard · Settlers Market' });

	return embed;
}

function playerEmbed(summary: ReturnType<typeof getPlayerSummary>): EmbedBuilder {
	const embed = new EmbedBuilder()
		.setColor(COLORS.neutral)
		.setAuthor({ name: `Trader · ${summary.ign}` })
		.setURL(dashboardUrl(`/market?player=${encodeURIComponent(summary.ign)}`))
		.addFields(
			{ name: 'Guild', value: summary.guild ?? 'none', inline: true },
			{ name: 'Open offers', value: `${summary.openBuys} buy · ${summary.openSells} sell`, inline: true },
			{ name: 'Last seen', value: summary.lastSeen ? timeAgo(summary.lastSeen) : '—', inline: true },
			{ name: 'Buy-side value', value: `${formatPrice(summary.bidValue)} c`, inline: true },
			{ name: 'Sell-side value', value: `${formatPrice(summary.askValue)} c`, inline: true }
		)
		.setDescription(
			summary.forOffer
				? `Latest post: **${summary.forOffer.side === 'buy' ? 'buying' : 'selling'} ${formatQty(
						summary.forOffer.quantity
					)} × ${getItem(summary.forOffer.itemId)?.name ?? summary.forOffer.itemId}** at ${formatPrice(
						summary.forOffer.price
					)} c.`
				: 'No offers posted yet.'
		)
		.setTimestamp(new Date());

	return footer(embed);
}

export async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
	switch (interaction.commandName) {
		case 'price': {
			const raw = interaction.options.getString('item', true);
			const itemId = resolveItemId(raw);
			const entry = getItemMarket(itemId);
			if (!entry) {
				await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setColor(COLORS.neutral)
							.setAuthor({ name: `Market price · ${getItem(itemId)?.name ?? itemId}` })
							.setDescription('No offers or price history for this item yet.')
							.setURL(dashboardUrl(`/market?item=${itemId}`))
					],
					flags: MessageFlags.Ephemeral
				});
				return;
			}
			await interaction.reply({ embeds: [priceEmbed(entry)] });
			return;
		}

		case 'market': {
			const sort = interaction.options.getString('sort') ?? 'activity';
			const response = getMarketResponse();
			await interaction.reply({ embeds: [marketEmbed(response, sort)] });
			return;
		}

		case 'offers': {
			const rawItem = interaction.options.getString('item');
			const side = interaction.options.getString('side') as 'buy' | 'sell' | null;
			const player = interaction.options.getString('player')?.trim();
			const itemId = rawItem ? resolveItemId(rawItem) : undefined;

			const offers = listOffers({
				status: 'open',
				itemId,
				side: side ?? undefined,
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

			await interaction.reply({ embeds: [offersEmbed(offers, label)] });
			return;
		}

		case 'player': {
			const ign = interaction.options.getString('ign', true).trim();
			const summary = getPlayerSummary(ign);
			if (!summary.lastSeen) {
				await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setColor(COLORS.neutral)
							.setDescription(`No offers found for **${ign}**.`)
					],
					flags: MessageFlags.Ephemeral
				});
				return;
			}
			await interaction.reply({ embeds: [playerEmbed(summary)] });
			return;
		}

		case 'post': {
			const side = interaction.options.getString('side', true) as 'buy' | 'sell';
			const itemId = resolveItemId(interaction.options.getString('item', true));
			const quantity = interaction.options.getInteger('quantity', true);
			const price = interaction.options.getNumber('price', true);
			const ign = interaction.options.getString('ign', true);
			const guild = interaction.options.getString('guild') ?? '';
			const contact = interaction.options.getString('contact') ?? '';
			const note = interaction.options.getString('note') ?? '';
			const x = interaction.options.getInteger('x');
			const y = interaction.options.getInteger('y');
			const z = interaction.options.getInteger('z');

			const input = parseOfferInput({
				side,
				itemId,
				quantity,
				price,
				ign,
				guild,
				contact,
				note,
				world: SITE.world,
				x,
				y,
				z
			});
			const { offer, editToken } = createOffer(input, { source: 'discord' });
			const item = getItem(offer.itemId);

			const cancel = new ButtonBuilder()
				.setCustomId(`offer:cancel:${offer.id}:${editToken}`)
				.setLabel('Cancel this offer')
				.setStyle(ButtonStyle.Danger);
			const view = new ButtonBuilder()
				.setLabel('View on dashboard')
				.setStyle(ButtonStyle.Link)
				.setURL(dashboardUrl(`/market?item=${offer.itemId}`));
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(cancel, view);

			await interaction.reply({
				embeds: [offerEmbed(offer, item)],
				components: [row],
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		case 'alerts': {
			if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
				await interaction.reply({
					content: 'You need the **Manage Server** permission to change the alert channel.',
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			const channel = interaction.options.getChannel('channel', true);
			if (!('isTextBased' in channel) || !channel.isTextBased() || channel.isDMBased()) {
				await interaction.reply({
					content: 'Pick a normal server text or announcement channel.',
					flags: MessageFlags.Ephemeral
				});
				return;
			}

			setMeta('bot:alert_channel_id', channel.id);
			setMeta('bot:alert_channel_name', channel.name);
			await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(COLORS.bid)
						.setDescription(
							`Price alerts will now be posted in <#${channel.id}>.\nMoves above the configured threshold and new 7-day extremes are queued automatically.`
						)
				],
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		default:
			throw new Error(`Unknown command: ${interaction.commandName}`);
	}
}

export async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
	const focused = interaction.options.getFocused(true);
	if (focused.name !== 'item') {
		await interaction.respond([]);
		return;
	}

	const query = String(focused.value ?? '').trim();
	const matches = searchItems(query).slice(0, 25);
	await interaction.respond(
		matches.map((item) => ({
			name: `${item.name} · ${item.category}`.slice(0, 100),
			value: item.id
		}))
	);
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
	const [scope, action, offerId, token] = interaction.customId.split(':');
	if (scope !== 'offer' || action !== 'cancel' || !offerId || !token) return;

	try {
		const offer = cancelOffer(offerId, token, 'cancelled');
		const item = getItem(offer.itemId);
		await interaction.update({
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
			],
			components: []
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Could not cancel that offer.';
		await interaction.reply({ content: `⚠️ ${message}`, flags: MessageFlags.Ephemeral });
	}
}
