import type { Side } from './market';

export function cn(...values: (string | false | null | undefined)[]): string {
	return values.filter(Boolean).join(' ');
}

const priceFmt = new Intl.NumberFormat('en-US', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

const compactFmt = new Intl.NumberFormat('en-US', {
	notation: 'compact',
	maximumFractionDigits: 1
});

export function formatPrice(value: number | null | undefined): string {
	if (value === null || value === undefined || Number.isNaN(value)) return '—';
	if (value > 0 && value < 0.01) return '<0.01';
	return priceFmt.format(value);
}

export function formatQty(value: number | null | undefined): string {
	if (value === null || value === undefined || Number.isNaN(value)) return '—';
	return new Intl.NumberFormat('en-US').format(value);
}

export function formatCompact(value: number | null | undefined): string {
	if (value === null || value === undefined || Number.isNaN(value)) return '—';
	return compactFmt.format(value);
}

export function formatPct(value: number | null | undefined, withSign = true): string {
	if (value === null || value === undefined || Number.isNaN(value)) return '—';
	const sign = withSign && value > 0 ? '+' : '';
	return `${sign}${value.toFixed(1)}%`;
}

export function shortTime(ts: number): string {
	return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(ts: number, now = Date.now()): string {
	const diff = Math.max(0, now - ts);
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function sideLabel(side: Side): string {
	return side === 'buy' ? 'Buy' : 'Sell';
}

export function sideAccent(side: Side): string {
	return side === 'buy' ? 'text-bid' : 'text-ask';
}

export function sideBg(side: Side): string {
	return side === 'buy'
		? 'bg-bid/10 text-bid border-bid/25'
		: 'bg-ask/10 text-ask border-ask/25';
}

/** Serialize coordinates for a map link, or null when the offer has none. */
export function coordsLabel(offer: { x: number | null; y: number | null; z: number | null }): string | null {
	if (offer.x === null || offer.y === null || offer.z === null) return null;
	return `${offer.x} / ${offer.y} / ${offer.z}`;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function middleValue(points: { mid: number | null }[]): number | null {
	const mids = points.map((p) => p.mid).filter((v): v is number => v !== null);
	if (!mids.length) return null;
	return mids.reduce((a, b) => a + b, 0) / mids.length;
}
