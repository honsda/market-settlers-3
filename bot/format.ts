import { EmbedBuilder } from 'discord.js';
import type { Alert, Item, Offer } from '../src/lib/market';
import { SITE, itemTexture, mapUrl } from '../src/lib/market';
import { formatPct, formatPrice, formatQty, timeAgo } from '../src/lib/format';
import { serverEnv } from '../src/lib/server/env';

export const COLORS = {
	bid: 0x34d399,
	ask: 0xfbbf24,
	danger: 0xfb7185,
	neutral: 0x8fa3b5,
	ink: 0x0a1017
} as const;

export function dashboardUrl(path = ''): string {
	return `${serverEnv.appUrl}${path}`;
}

export function footer(embed: EmbedBuilder): EmbedBuilder {
	return embed.setFooter({ text: `${SITE.server} · ${SITE.world} · Settlers Market` });
}

export function alertEmbed(alert: Alert, item: Item | undefined): EmbedBuilder {
	const positive = alert.kind === 'price-up' || alert.kind === 'new-high';
	const label =
		alert.kind === 'price-up'
			? 'Price jumped'
			: alert.kind === 'price-down'
				? 'Price dropped'
				: alert.kind === 'new-high'
					? 'New 7-day high'
					: 'New 7-day low';

	const embed = new EmbedBuilder()
		.setColor(positive ? COLORS.bid : COLORS.danger)
		.setAuthor({
			name: `${label} · ${item?.name ?? alert.itemId}`,
			iconURL: item ? itemTexture(item) : undefined
		})
		.setDescription(alert.message)
		.addFields(
			{
				name: alert.side === 'buy' ? 'Best bid' : 'Best ask',
				value: `**${formatPrice(alert.price)}** coins`,
				inline: true
			},
			{
				name: 'Change',
				value: alert.changePct === null ? '—' : formatPct(alert.changePct),
				inline: true
			},
			{
				name: 'Previous',
				value: alert.previous === null ? '—' : `${formatPrice(alert.previous)} coins`,
				inline: true
			}
		)
		.setURL(dashboardUrl(`/market?item=${alert.itemId}`))
		.setTimestamp(new Date(alert.createdAt));

	return footer(embed);
}

export function offerEmbed(offer: Offer, item: Item | undefined): EmbedBuilder {
	const coords =
		offer.x !== null && offer.y !== null && offer.z !== null
			? `${offer.x} / ${offer.y} / ${offer.z}`
			: null;

	const embed = new EmbedBuilder()
		.setColor(offer.side === 'buy' ? COLORS.bid : COLORS.ask)
		.setAuthor({
			name: `${offer.side === 'buy' ? 'Buy order' : 'Sell offer'} · ${item?.name ?? offer.itemId}`,
			iconURL: item ? itemTexture(item) : undefined
		})
		.setDescription(
			`**${formatQty(offer.quantity)} units @ ${formatPrice(offer.price)} coins**\n` +
				`Total **${formatPrice(offer.quantity * offer.price)} coins**`
		)
		.addFields(
			{ name: 'Trader', value: `\`${offer.ign}\`${offer.guild ? `\n${offer.guild}` : ''}`, inline: true },
			{ name: 'Placed', value: timeAgo(offer.createdAt), inline: true },
			{
				name: coords ? 'Meeting point' : 'Contact',
				value: coords ?? (offer.contact || offer.note || 'not set'),
				inline: true
			}
		)
		.setTimestamp(new Date(offer.createdAt));

	if (coords && offer.x !== null && offer.y !== null && offer.z !== null) {
		embed.addFields({
			name: 'Map',
			value: `[Open in the live map](${mapUrl({ x: offer.x, y: offer.y, z: offer.z })})`
		});
	}
	if (offer.note && coords) {
		embed.addFields({ name: 'Note', value: offer.note.slice(0, 200) });
	}

	return footer(embed);
}
