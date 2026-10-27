<script lang="ts">
	import { onMount } from 'svelte';
	import { getJSON } from '../../lib/client/api';
	import { live } from '../../lib/client/live.svelte';
	import { formatPct, formatPrice, timeAgo } from '../../lib/format';
	import type { Alert, BotStatus } from '../../lib/market';
	import AlertItem from '../../lib/components/AlertItem.svelte';
	import Icon from '../../lib/components/Icon.svelte';

	let status = $state<BotStatus | null>(null);
	let alerts = $state<Alert[]>([]);
	let loading = $state(true);
	let seq = 0;

	const commands = [
		{
			name: '/price',
			args: 'item',
			description: 'Best bid, best ask, spread and 24h move for an item.'
		},
		{
			name: '/market',
			args: 'sort: activity | movers | spread',
			description: 'A compact market board of the most active items.'
		},
		{
			name: '/offers',
			args: 'item, side, player',
			description: 'Browse live offers, filtered however you like.'
		},
		{
			name: '/player',
			args: 'ign',
			description: 'A trader’s guild, open offers and last activity.'
		},
		{
			name: '/post',
			args: 'side, item, quantity, price, ign, guild',
			description: 'Publish a buy or sell offer straight from Discord.'
		},
		{
			name: '/alerts',
			args: 'channel',
			description: 'Point price alerts at a channel. Needs Manage Server.'
		},
		{
			name: '/apply',
			args: '—',
			description: 'Apply to join in #apply. The bot asks five questions in DMs.'
		},
		{
			name: '/initapply',
			args: '—',
			description: 'Post or refresh the application guide in #apply. Needs Manage Server.'
		},
		{
			name: '/rolecitizen',
			args: 'role, member',
			description: 'Pick the role given after an application is approved. Needs Manage Server.'
		}
	];

	async function load() {
		const current = ++seq;
		try {
			const [statusData, alertData] = await Promise.all([
				getJSON<BotStatus>('/api/bot/status'),
				getJSON<{ alerts: Alert[] }>('/api/alerts?limit=20')
			]);
			if (current !== seq) return;
			status = statusData;
			alerts = alertData.alerts;
		} catch {
			// Keep previous data on transient failures.
		} finally {
			if (current === seq) loading = false;
		}
	}

	$effect(() => {
		live.revision;
		void load();
	});

	onMount(() => {
		const timer = setInterval(() => void load(), 30_000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>Discord alerts · Settlers Market</title>
	<meta name="description" content="Discord bot status, commands and the market's significant price alert feed." />
</svelte:head>

<div class="space-y-5">
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<p class="eyebrow flex items-center gap-2">
				<Icon name="discord" size={12} />
				Market bot
			</p>
			<h1 class="mt-1.5 text-2xl font-bold tracking-tight text-mist-100 sm:text-[30px]">Discord integration</h1>
			<p class="mt-1 max-w-xl text-sm text-mist-400">
				Prices, offers and player lookups inside Discord. Significant market moves are pushed automatically.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			{#if status}
				<span
					class="chip {status.online
						? 'border-bid/25 bg-bid/10 text-bid'
						: status.configured
							? 'border-ask/25 bg-ask/10 text-ask'
							: 'border-white/10 bg-white/[0.04] text-mist-400'}"
				>
					<span
						class="h-1.5 w-1.5 rounded-full {status.online
							? 'bg-bid pulse-dot'
							: status.configured
								? 'bg-ask'
								: 'bg-mist-500'}"
					></span>
					{status.online ? 'Bot online' : status.configured ? 'Bot offline' : 'Not configured'}
				</span>
			{:else}
				<span class="skeleton h-6 w-24"></span>
			{/if}
			{#if status?.inviteUrl}
				<a href={status.inviteUrl} target="_blank" rel="noreferrer" class="btn-primary">
					<Icon name="discord" size={15} /> Add to Discord
				</a>
			{:else}
				<a href="#setup" class="btn-primary"><Icon name="settings" size={15} /> Setup guide</a>
			{/if}
		</div>
	</header>

	<div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
		<div class="min-w-0 space-y-5">
			<section class="panel overflow-hidden">
				<div class="panel-header">
					<div class="flex items-center gap-3">
						<span class="flex h-9 w-9 items-center justify-center rounded-xl border border-ask/20 bg-ask/10 text-ask">
							<Icon name="bell" size={16} />
						</span>
						<div>
							<h2 class="text-sm font-semibold tracking-tight text-mist-100">Price signal feed</h2>
							<p class="text-[11px] text-mist-500">
								Alerts above {status ? formatPct(status.thresholdPct, false) : '—'} moves, new 7-day highs and lows
							</p>
						</div>
					</div>
					<span class="chip-neutral">{alerts.length} signals</span>
				</div>

				{#if alerts.length}
					<div class="max-h-[520px] divide-y divide-white/[0.05] overflow-y-auto">
						{#each alerts as alert (alert.id)}
							<AlertItem {alert} compact />
						{/each}
					</div>
				{:else if loading}
					<div class="space-y-3 p-4">
						{#each [0, 1, 2] as index (index)}
							<div class="skeleton h-16"></div>
						{/each}
					</div>
				{:else}
					<div class="flex flex-col items-center gap-2 px-5 py-12 text-center">
						<Icon name="activity" size={22} class="text-mist-600" />
						<p class="text-xs text-mist-300">No market signals yet</p>
						<p class="max-w-sm text-[11px] leading-relaxed text-mist-500">
							When a best bid or ask moves more than {status ? formatPct(status.thresholdPct, false) : '8%'}, or an
							item prints a new 7-day extreme, the bot posts it in your alert channel.
						</p>
					</div>
				{/if}
			</section>

			<section class="panel overflow-hidden">
				<div class="panel-header">
					<div class="flex items-center gap-3">
						<span class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-mist-300">
							<Icon name="hash" size={16} />
						</span>
						<div>
							<h2 class="text-sm font-semibold tracking-tight text-mist-100">Slash commands</h2>
							<p class="text-[11px] text-mist-500">Same database as the dashboard — post from either</p>
						</div>
					</div>
				</div>
				<div class="divide-y divide-white/[0.05]">
					{#each commands as command (command.name)}
						<div class="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
							<div class="sm:w-52 sm:shrink-0">
								<code class="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-bid">{command.name}</code>
								<p class="mt-1 font-mono text-[9px] text-mist-600">{command.args}</p>
							</div>
							<p class="text-[11px] leading-relaxed text-mist-400">{command.description}</p>
						</div>
					{/each}
				</div>
			</section>

			<section id="setup" class="panel overflow-hidden scroll-mt-6">
				<div class="panel-header">
					<div class="flex items-center gap-3">
						<span class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-mist-300">
							<Icon name="settings" size={16} />
						</span>
						<div>
							<h2 class="text-sm font-semibold tracking-tight text-mist-100">Connect your own bot</h2>
							<p class="text-[11px] text-mist-500">Five minutes, one privileged intent to switch on</p>
						</div>
					</div>
				</div>

				<div class="space-y-4 p-4 sm:p-5">
					<ol class="space-y-3">
						{#each [
							'Create an application at discord.com/developers/applications and add a Bot.',
							'Copy the bot token and Application ID into .env as DISCORD_TOKEN and DISCORD_CLIENT_ID.',
							'Enable the Server Members intent, then invite the bot with Manage Roles, Manage Channels and Manage Messages.',
							'Copy an alert channel ID into DISCORD_ALERT_CHANNEL_ID — or run /alerts in Discord.',
							'Start the web app and bot together with npm run dev:all.'
						] as step, index (index)}
							<li class="flex gap-3">
								<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-bid/25 bg-bid/10 font-mono text-[10px] font-semibold text-bid">
									{index + 1}
								</span>
								<p class="pt-0.5 text-[11px] leading-relaxed text-mist-300">{step}</p>
							</li>
						{/each}
					</ol>

					<pre class="overflow-x-auto rounded-xl border border-white/[0.07] bg-ink-950/70 p-3.5 font-mono text-[10px] leading-relaxed text-mist-300"><code>DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-id
DISCORD_GUILD_ID=optional-dev-server-id
DISCORD_ALERT_CHANNEL_ID=channel-for-price-alerts
ALERT_THRESHOLD_PCT=8
ALERT_COOLDOWN_MINUTES=45</code></pre>

					<div class="flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
						<Icon name="info" size={14} class="mt-0.5 shrink-0 text-bid" />
						<p class="text-[11px] leading-relaxed text-mist-400">
							Set <code class="font-mono text-mist-200">DISCORD_GUILD_ID</code> while developing so slash commands
							register instantly instead of taking up to an hour to appear globally.
						</p>
					</div>
				</div>
			</section>
		</div>

		<aside class="space-y-4 xl:sticky xl:top-6 xl:self-start">
			<section class="panel overflow-hidden">
				<div class="panel-header">
					<div class="flex items-center gap-2.5">
						<span class="flex h-8 w-8 items-center justify-center rounded-lg border border-bid/20 bg-bid/10 text-bid">
							<Icon name="discord" size={15} />
						</span>
						<h2 class="text-xs font-semibold text-mist-100">Connection</h2>
					</div>
					{#if status}
						<span class="num text-[10px] {status.online ? 'text-bid' : 'text-mist-500'}">
							{status.online ? 'connected' : status.configured ? 'waiting' : 'setup needed'}
						</span>
					{/if}
				</div>

				{#if status}
					<div class="divide-y divide-white/[0.05]">
						<div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
							<span class="text-[10px] text-mist-500">Bot tag</span>
							<span class="truncate text-[11px] font-medium text-mist-200">{status.tag ?? '—'}</span>
						</div>
						<div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
							<span class="text-[10px] text-mist-500">Servers</span>
							<span class="num text-[11px] text-mist-200">{status.guildCount ?? '—'}</span>
						</div>
						<div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
							<span class="text-[10px] text-mist-500">Alert channel</span>
							<span class="truncate text-[11px] font-medium text-mist-200">
								{status.alertChannelName ?? status.alertChannelId ?? 'not set'}
							</span>
						</div>
						<div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
							<span class="text-[10px] text-mist-500">Last heartbeat</span>
							<span class="num text-[11px] text-mist-200">
								{status.lastSeen ? timeAgo(status.lastSeen) : 'never'}
							</span>
						</div>
						<div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
							<span class="text-[10px] text-mist-500">Alert threshold</span>
							<span class="num text-[11px] text-ask">{formatPct(status.thresholdPct, false)}</span>
						</div>
						<div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
							<span class="text-[10px] text-mist-500">Alert cooldown</span>
							<span class="num text-[11px] text-mist-300">{status.cooldownMinutes} min</span>
						</div>
					</div>

					{#if !status.configured}
						<div class="border-t border-white/[0.06] bg-ask/[0.04] px-3.5 py-3">
							<p class="flex items-center gap-1.5 text-[10px] font-semibold text-ask">
								<Icon name="alert" size={12} /> Token missing
							</p>
							<p class="mt-1 text-[10px] leading-relaxed text-mist-500">
								Add <code class="font-mono text-mist-300">DISCORD_TOKEN</code> and
								<code class="font-mono text-mist-300">DISCORD_CLIENT_ID</code> to .env, then restart the bot.
							</p>
						</div>
					{/if}
				{:else}
					<div class="space-y-2 p-4">
						{#each [0, 1, 2] as index (index)}
							<div class="skeleton h-6"></div>
						{/each}
					</div>
				{/if}
			</section>

			<section class="panel p-4">
				<div class="flex items-center gap-2">
					<Icon name="refresh" size={14} class="text-bid" />
					<h2 class="text-xs font-semibold text-mist-100">How sync works</h2>
				</div>
				<p class="mt-2 text-[11px] leading-relaxed text-mist-400">
					The bot is a separate Node process that shares the same SQLite database as the website. Offers posted
					with <code class="font-mono text-mist-300">/post</code> appear instantly on the dashboard, and price
					alerts are queued in the database so nothing is lost if Discord is briefly down.
				</p>
				<div class="mt-3 flex flex-wrap gap-1.5">
					<span class="chip-neutral"><Icon name="check" size={10} /> shared offers</span>
					<span class="chip-neutral"><Icon name="check" size={10} /> queued alerts</span>
					<span class="chip-neutral"><Icon name="check" size={10} /> live revision</span>
				</div>
			</section>

			{#if status?.alertChannelId}
				<section class="panel p-4">
					<div class="flex items-center gap-2">
						<Icon name="hash" size={14} class="text-mist-400" />
						<h2 class="text-xs font-semibold text-mist-100">Posting to</h2>
					</div>
					<p class="num mt-2 truncate text-[11px] text-mist-300">
						#{status.alertChannelName ?? 'channel'} <span class="text-mist-600">({status.alertChannelId})</span>
					</p>
					<p class="mt-2 text-[10px] leading-relaxed text-mist-500">
						Change it with <code class="font-mono">/alerts channel:#market</code> or update
						<code class="font-mono">DISCORD_ALERT_CHANNEL_ID</code>.
					</p>
				</section>
			{/if}
		</aside>
	</div>
</div>
