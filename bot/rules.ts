import {
	ChannelType,
	EmbedBuilder,
	MessageFlags,
	PermissionFlagsBits,
	type ChatInputCommandInteraction,
	type Guild,
	type PermissionsBitField
} from 'discord.js';
import { getMeta, setMeta } from '../src/lib/server/db';
import { COLORS } from './format';

/**
 * `/initrule` — post or refresh the general community rules.
 *
 * The guide is stored per guild *and* per channel, so staff can keep a rules
 * embed in more than one place without the copies fighting over one message id.
 */

const rulesKey = (guildId: string, channelId: string) => `rules:message:${guildId}:${channelId}`;

const RULES: Array<{ name: string; value: string }> = [
	{
		name: '1 · Respect everyone',
		value:
			'No harassment, hate speech, discrimination, threats, or personal attacks. No doxxing or sharing someone else’s private information.'
	},
	{
		name: '2 · Keep it safe',
		value:
			'No NSFW content, gore, illegal material, pirated files, or malware links. Keep the server appropriate for an 18+ community.'
	},
	{
		name: '3 · No spam or advertising',
		value:
			'No flooding, mass mentions, unsolicited DMs, or advertising without staff approval. No self-promotion outside the places staff have set aside for it.'
	},
	{
		name: '4 · Stay on topic',
		value:
			'Use each channel for its intended purpose. Take long side conversations to DMs or a more suitable channel.'
	},
	{
		name: '5 · Follow Discord',
		value:
			'You must be at least 18 to join this community. You must also follow Discord’s Terms of Service and Community Guidelines. These rules apply alongside Discord’s own.'
	}
];

function ephemeral(content: string): { content: string; flags: MessageFlags.Ephemeral } {
	return { content, flags: MessageFlags.Ephemeral };
}

function hasStaffPermission(permissions: Readonly<PermissionsBitField> | null): boolean {
	return Boolean(
		permissions?.has(PermissionFlagsBits.ManageGuild) ||
			permissions?.has(PermissionFlagsBits.Administrator)
	);
}

function rulesEmbed(guild: Guild): EmbedBuilder {
	return new EmbedBuilder()
		.setColor(COLORS.ask)
		.setAuthor({ name: `${guild.name} · Community` })
		.setTitle('Community rules')
		.setDescription(
			`These rules apply everywhere in **${guild.name}** — text channels, voice rooms, and DMs with members. This is an **18+ community**; by staying here, you agree to follow these rules.\n\n**Use common sense.** Not every situation is listed, and staff have the final say.`
		)
		.addFields(...RULES)
		.setFooter({ text: 'Settlers III · Community rules' });
}

/** `/initrule` — post or refresh the rules embed in a text channel. */
export async function postRulesEmbed(interaction: ChatInputCommandInteraction): Promise<void> {
	const guild = interaction.guild;
	if (!guild) {
		await interaction.reply(ephemeral('This command only works inside a server.'));
		return;
	}

	if (!hasStaffPermission(interaction.memberPermissions)) {
		await interaction.reply(
			ephemeral('You need the **Manage Server** permission to post the community rules.')
		);
		return;
	}

	const selected = interaction.options.getChannel('channel');
	const target = selected
		? (guild.channels.cache.get(selected.id) ??
			(await guild.channels.fetch(selected.id).catch(() => null)))
		: interaction.channel;
	if (!target || target.type !== ChannelType.GuildText) {
		await interaction.reply(ephemeral('Pick a normal text channel for the rules.'));
		return;
	}

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const key = rulesKey(guild.id, target.id);
	const storedId = await getMeta(key);
	let message = storedId ? await target.messages.fetch(storedId).catch(() => null) : null;
	let action: 'posted' | 'updated' = 'posted';

	if (message) {
		try {
			await message.edit({ embeds: [rulesEmbed(guild)] });
			action = 'updated';
		} catch {
			message = null;
		}
	}

	if (!message) {
		message = await target.send({ embeds: [rulesEmbed(guild)] });
		await setMeta(key, message.id);
	}

	// Pinning is best-effort; the rules are still useful without it.
	await message.pin().catch(() => undefined);

	await interaction.editReply({
		content: `Community rules ${action} in <#${target.id}>.`
	});
}
