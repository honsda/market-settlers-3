export type NewsCategory = 'Announcement' | 'Market' | 'Guide' | 'Event';

export type NewsBlock =
	| { type: 'p'; text: string }
	| { type: 'h2'; text: string }
	| { type: 'h3'; text: string }
	| { type: 'quote'; text: string; by?: string }
	| { type: 'list'; items: string[] }
	| { type: 'callout'; title: string; text: string };

export interface NewsArticle {
	slug: string;
	title: string;
	excerpt: string;
	category: NewsCategory;
	author: string;
	publishedAt: string;
	readingMinutes: number;
	accent: 'bid' | 'ask' | 'violet' | 'sky';
	icon: string;
	tags: string[];
	body: NewsBlock[];
}

export const NEWS: NewsArticle[] = [
	{
		slug: 'welcome-to-settlers-market',
		title: 'Welcome to Settlers Market',
		excerpt:
			'A single board for every trade in Caeldun: live bids, real asks, meeting points on the map and a Discord bot that watches the book while you sleep.',
		category: 'Announcement',
		author: 'The Settlers Market team',
		publishedAt: '2026-10-21T18:00:00.000Z',
		readingMinutes: 4,
		accent: 'bid',
		icon: 'sparkles',
		tags: ['launch', 'trading', 'Caeldun'],
		body: [
			{
				type: 'p',
				text: 'Settlers Market is a community trading board for Settlers III on play.settlers-mc.org. It replaces scattered Discord messages and “anyone selling diamonds?” posts with one shared order book that anyone can read at a glance.'
			},
			{
				type: 'p',
				text: 'Post a buy order when you need materials. Post a sell offer when your chests are full. Every listing carries your IGN, guild and an optional meeting point, so the other trader knows exactly who they are dealing with and where to find you.'
			},
			{ type: 'h2', text: 'What you can do today' },
			{
				type: 'list',
				items: [
					'Create buy orders and sell offers with a live total and quantity controls.',
					'Compare the best bid, best ask, spread and 24-hour move for every tracked item.',
					'Open a trader’s meeting point directly on the Caeldun live map.',
					'Browse the same book from Discord with /price, /market and /offers.',
					'Get a nudge in your alert channel when the market makes a significant move.'
				]
			},
			{ type: 'h2', text: 'The book is the source of truth' },
			{
				type: 'p',
				text: 'A bid is the highest price a buyer is currently willing to pay. An ask is the lowest price a seller will accept. When the two overlap, a trade is possible. The spread is the gap between them — a tight spread usually means a liquid item, while a wide one means you may need to negotiate or wait.'
			},
			{
				type: 'callout',
				title: 'Prices are player-set',
				text: 'The board does not hold items or coins and does not verify trades. Agree on the deal in-game, meet somewhere public, and trade at your own risk.'
			},
			{ type: 'h2', text: 'Built for the whole server' },
			{
				type: 'p',
				text: 'The dashboard, the map and the Discord bot all share the same database. An offer posted from Discord appears on the website within a second, and an offer cancelled on the site disappears from Discord immediately. No double entry, no stale lists.'
			},
			{
				type: 'p',
				text: 'The board is free to use. If you run a guild or a shop, point people at your IGN and keep your listings current — a fresh book is a useful book.'
			}
		]
	},
	{
		slug: 'how-to-read-the-order-book',
		title: 'How to read the order book without guessing',
		excerpt:
			'Bid, ask, spread, depth and the 24-hour move — a practical guide to the five numbers that decide whether an offer is actually a good deal.',
		category: 'Guide',
		author: 'Mirelle',
		publishedAt: '2026-10-19T09:30:00.000Z',
		readingMinutes: 6,
		accent: 'ask',
		icon: 'trendUp',
		tags: ['guide', 'pricing', 'order book'],
		body: [
			{
				type: 'p',
				text: 'The market board can look like a wall of numbers at first. It is not. Every item row answers one question: if I wanted to trade right now, what would it cost me? Five numbers get you most of the way there.'
			},
			{ type: 'h2', text: '1. Best bid — what buyers are paying' },
			{
				type: 'p',
				text: 'The best bid is the highest open buy order for an item. If you are selling, this is the price you can beat by a coin or two to move to the front of the queue. If you are buying, it tells you what a competing buyer has already committed to.'
			},
			{ type: 'h2', text: '2. Best ask — what sellers want' },
			{
				type: 'p',
				text: 'The best ask is the lowest open sell offer. It is the number to look at when you are buying. A low ask with plenty of quantity is usually a better deal than a slightly lower ask with only a handful of units left.'
			},
			{ type: 'h2', text: '3. Spread — the cost of impatience' },
			{
				type: 'p',
				text: 'Spread is simply ask minus bid. A 5% spread on a high-volume item is normal. A 60% spread usually means the market is thin, the item is hard to price, or one side has not shown up yet. Use the percentage, not the raw coin value, when comparing items.'
			},
			{
				type: 'quote',
				text: 'A tight spread rewards patience. A wide spread rewards a good conversation.',
				by: 'Old trading proverb, probably'
			},
			{ type: 'h2', text: '4. Depth — how much is actually available' },
			{
				type: 'p',
				text: 'Price alone can lie. A seller offering 10 diamonds at 900 coins is not the same market as a seller offering 512 diamonds at 910. The quantity next to each offer, and the buy/sell depth in the item row, tells you whether the price will survive your order.'
			},
			{ type: 'h2', text: '5. 24-hour move — direction, not destiny' },
			{
				type: 'p',
				text: 'The 24h move compares the current mid price with the mid price a day ago. It is a signal, not a forecast. A sharp jump can mean real demand, a new buyer, or simply the last cheap seller leaving the book. Check the sparkline before you chase it.'
			},
			{ type: 'h2', text: 'A quick routine' },
			{
				type: 'list',
				items: [
					'Find the item and read the best bid and ask first.',
					'Check the spread percentage — is this market liquid?',
					'Look at quantity and offer count before assuming a price is real.',
					'Read the 24h move and the sparkline for context.',
					'Post your offer one tick inside the current best price, or negotiate if the spread is wide.'
				]
			},
			{
				type: 'callout',
				title: 'Use the meeting point',
				text: 'Offers can carry X/Y/Z coordinates. Open the map link before you travel and agree on a backup meeting spot in case the area is busy or contested.'
			}
		]
	},
	{
		slug: 'price-alerts-in-discord',
		title: 'Price alerts are now live in Discord',
		excerpt:
			'The bot now watches the best bid and ask around the clock and posts when something actually moves. Here is how to point it at your channel.',
		category: 'Announcement',
		author: 'The Settlers Market team',
		publishedAt: '2026-10-17T20:15:00.000Z',
		readingMinutes: 3,
		accent: 'violet',
		icon: 'bell',
		tags: ['Discord', 'alerts', 'bot'],
		body: [
			{
				type: 'p',
				text: 'A market is only useful if you hear about the interesting parts. The Discord bot now polls the shared alert queue and posts a compact embed whenever the best bid or ask for an item moves past the configured threshold, or when an item prints a new seven-day high or low.'
			},
			{ type: 'h2', text: 'Set the channel once' },
			{
				type: 'p',
				text: 'Run /alerts in your server and pick a text or announcement channel. The command needs the Manage Server permission, and the bot only needs Send Messages to post. The choice is stored in the shared database, so it survives restarts and does not need to be repeated.'
			},
			{
				type: 'callout',
				title: 'No spam by design',
				text: 'Alerts for the same item and direction are rate-limited by a cooldown (45 minutes by default). Small wiggles are ignored. The goal is a signal feed, not a ticker of every coin.'
			},
			{ type: 'h2', text: 'What the embed tells you' },
			{
				type: 'list',
				items: [
					'Which item moved and whether it was the buy or sell side.',
					'The new price, the previous price and the percentage change.',
					'A direct link to the item’s row on the market board.',
					'Whether the move was a regular jump or a new seven-day extreme.'
				]
			},
			{
				type: 'p',
				text: 'Thresholds live in .env: ALERT_THRESHOLD_PCT (default 8), ALERT_COOLDOWN_MINUTES (default 45) and ALERT_POLL_SECONDS (default 20). If the bot is offline when an alert is queued, it posts the backlog when it reconnects — nothing is silently dropped.'
			},
			{ type: 'h2', text: 'Post from Discord too' },
			{
				type: 'p',
				text: 'Use /post to publish a buy order or sell offer without opening the website. The reply is ephemeral and includes a cancel button, so your listing does not clutter the channel and you can withdraw it with one click.'
			}
		]
	},
	{
		slug: 'trading-etiquette-in-caeldun',
		title: 'Trading etiquette in Caeldun',
		excerpt:
			'Meeting points, fair counter-offers, and why “first to reply” is not the same as “first to arrive”. A short field guide to better trades.',
		category: 'Guide',
		author: 'Fenwick',
		publishedAt: '2026-10-14T16:45:00.000Z',
		readingMinutes: 5,
		accent: 'sky',
		icon: 'users',
		tags: ['community', 'etiquette', 'meeting points'],
		body: [
			{
				type: 'p',
				text: 'The market board makes it easy to find a price. It cannot make two players trust each other. A few habits make trades smoother for everyone, whether you are moving a stack of iron or a single elytra.'
			},
			{ type: 'h2', text: 'Put a meeting point on the offer' },
			{
				type: 'p',
				text: 'Coordinates turn a vague “meet at spawn” into a place you can both see on the live map. Pick somewhere public, easy to reach, and away from your base. If the offer has no coordinates, agree on one in chat before you travel.'
			},
			{ type: 'h2', text: 'Honour the listed quantity and price' },
			{
				type: 'p',
				text: 'If you post 64 diamonds at 900 coins, expect to trade 64 diamonds at 900 coins. If you only want half, say so before the other player travels. If the market has moved, cancel the offer and relist rather than changing the deal at the meeting point.'
			},
			{ type: 'h2', text: 'Counter-offers are fine — silent no-shows are not' },
			{
				type: 'p',
				text: 'A polite counter-offer is part of trading. A trader who agrees to meet and then disappears is not. If something comes up, say so. A short message is cheaper than a wasted trip across the map.'
			},
			{
				type: 'quote',
				text: 'The best traders are the ones you can find again next week.',
				by: 'Wren, Night Market'
			},
			{ type: 'h2', text: 'Keep your listings current' },
			{
				type: 'p',
				text: 'Filled and cancelled offers should be closed as soon as the trade is done. A stale listing distorts the book and wastes other players’ time. Your browser remembers the offers you created, so you can cancel them from the market board or the offer card without an account.'
			},
			{ type: 'h2', text: 'Report, don’t retaliate' },
			{
				type: 'p',
				text: 'If a trade goes wrong, keep screenshots and contact a server moderator. The market board is a noticeboard, not a court. Do not use listings to harass another player or to post misleading prices on purpose.'
			}
		]
	},
	{
		slug: 'mapping-the-trade-routes',
		title: 'Mapping the trade routes of Caeldun',
		excerpt:
			'The live map is now one click from every offer. A look at how coordinates, map layers and player positions fit together.',
		category: 'Event',
		author: 'Bastion_77',
		publishedAt: '2026-10-11T12:00:00.000Z',
		readingMinutes: 4,
		accent: 'bid',
		icon: 'mapPin',
		tags: ['map', 'Dynmap', 'Caeldun'],
		body: [
			{
				type: 'p',
				text: 'Caeldun is big enough that “near spawn” covers a lot of ground. The market now embeds the server’s live Dynmap and links every offer that has coordinates straight to the right spot, so you can see the terrain before you commit to a trip.'
			},
			{ type: 'h2', text: 'Flat or surface?' },
			{
				type: 'p',
				text: 'The flat layer is easiest for planning a route and spotting builds. The surface layer shows the landscape as it looks in-game. Use flat to get your bearings, then switch to surface when you are close and need to find the actual entrance.'
			},
			{ type: 'h2', text: 'Coordinates are optional — but useful' },
			{
				type: 'p',
				text: 'When you create an offer you can add X, Y and Z. All three are required together, because a partial coordinate is worse than none. The map opens centred on your meeting point with the zoom level preserved.'
			},
			{
				type: 'callout',
				title: 'A note on safety',
				text: 'Do not use your base coordinates for a public meeting point unless you are comfortable with visitors. Pick a landmark, a market square or a neutral spot instead.'
			},
			{ type: 'h2', text: 'Live player positions' },
			{
				type: 'p',
				text: 'The map page also shows who is online and where they are, proxied from the server’s Dynmap feed. It refreshes about once a minute. Treat it as a snapshot, not a tracking tool: players move, and the map is not a substitute for agreeing on a place in chat.'
			},
			{ type: 'h2', text: 'Plan around the book' },
			{
				type: 'p',
				text: 'A good trade route often combines several offers. Check the market board for the items you need, open the map links in a few tabs, and see which meeting points cluster together. One trip can fill several orders — and save you a lot of walking.'
			}
		]
	}
];

export function getArticle(slug: string): NewsArticle | undefined {
	return NEWS.find((article) => article.slug === slug);
}

export function featuredArticle(): NewsArticle {
	return NEWS[0];
}

export function otherArticles(): NewsArticle[] {
	return NEWS.slice(1);
}

export function relatedArticles(article: NewsArticle, limit = 2): NewsArticle[] {
	const sameCategory = NEWS.filter(
		(entry) => entry.slug !== article.slug && entry.category === article.category
	);
	const rest = NEWS.filter(
		(entry) => entry.slug !== article.slug && entry.category !== article.category
	);
	return [...sameCategory, ...rest].slice(0, limit);
}

export function formatNewsDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}

export function headingId(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function categoryClass(category: NewsCategory): string {
	switch (category) {
		case 'Announcement':
			return 'border-bid/25 bg-bid/10 text-bid';
		case 'Market':
			return 'border-ask/25 bg-ask/10 text-ask';
		case 'Guide':
			return 'border-sky-400/25 bg-sky-400/10 text-sky-300';
		default:
			return 'border-violet-400/25 bg-violet-400/10 text-violet-300';
	}
}

export function accentClass(accent: NewsArticle['accent']): string {
	switch (accent) {
		case 'ask':
			return 'from-ask/20 via-ask/[0.06] to-transparent text-ask border-ask/20';
		case 'violet':
			return 'from-violet-400/20 via-violet-400/[0.06] to-transparent text-violet-300 border-violet-400/20';
		case 'sky':
			return 'from-sky-400/20 via-sky-400/[0.06] to-transparent text-sky-300 border-sky-400/20';
		default:
			return 'from-bid/20 via-bid/[0.06] to-transparent text-bid border-bid/20';
	}
}
