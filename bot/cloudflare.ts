import { Container, getContainer } from '@cloudflare/containers';

/**
 * Runtime variables passed from the bot Worker into the container process.
 * Only values that are actually set are forwarded so the app's normal
 * defaults still apply to optional tuning variables.
 */
const CONTAINER_VARS = [
	'APP_URL',
	'DISCORD_TOKEN',
	'DISCORD_CLIENT_ID',
	'DISCORD_GUILD_ID',
	'DISCORD_ALERT_CHANNEL_ID',
	'DISCORD_NEWS_CHANNEL_ID',
	'SUPABASE_URL',
	'SUPABASE_SECRET_KEY',
	'ALERT_THRESHOLD_PCT',
	'ALERT_COOLDOWN_MINUTES',
	'ALERT_POLL_SECONDS',
	'NEWS_POLL_SECONDS',
	'WIKI_MARKET_URL',
	'WIKI_MARKET_POLL_SECONDS',
	'WIKI_MARKET_SUMMARY_MINUTES',
	'WIKI_MARKET_PROFIT_MINUTES',
	'WIKI_MARKET_ALERT_THRESHOLD_PCT',
	'WIKI_MARKET_ALERT_COOLDOWN_MINUTES'
] as const;

type ContainerVar = (typeof CONTAINER_VARS)[number];

type Env = {
	BOT_CONTAINER: DurableObjectNamespace<BotContainer>;
} & { [K in ContainerVar]?: string };

const INSTANCE = 'bot';

function containerEnv(env: Env): Record<string, string> {
	const values: Record<string, string> = {
		NODE_ENV: 'production',
		MARKET_BACKEND: 'supabase',
		BOT_HEALTH_PORT: '3000'
	};
	for (const key of CONTAINER_VARS) {
		const value = env[key];
		if (typeof value === 'string' && value.trim()) values[key] = value;
	}
	return values;
}

export class BotContainer extends Container<Env> {
	defaultPort = 3000;
	// The Cron Trigger renews this every five minutes. The long window is a
	// safety net so the gateway is not torn down between scheduled wake-ups.
	sleepAfter = '24h';
	pingEndpoint = 'localhost/health';

	private starting: Promise<void> | undefined;

	/** Start the container with the Worker's secrets, or renew its idle timer. */
	ensureRunning(): Promise<void> {
		this.starting ??= this.startContainer().finally(() => {
			this.starting = undefined;
		});
		return this.starting;
	}

	private async startContainer(): Promise<void> {
		await this.startAndWaitForPorts({
			ports: [3000],
			startOptions: { envVars: containerEnv(this.env) },
			cancellationOptions: {
				instanceGetTimeoutMS: 30_000,
				portReadyTimeoutMS: 90_000
			}
		});
		this.renewActivityTimeout();
	}

	override async fetch(request: Request): Promise<Response> {
		await this.ensureRunning();
		return this.containerFetch(request);
	}

	override onStop({ exitCode, reason }: { exitCode: number; reason: string }): void {
		console.log(`[bot] Container stopped (${reason}, exit ${exitCode}).`);
	}

	override onError(error: unknown): never {
		console.error('[bot] Container failed to start:', error);
		throw error;
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === '/health') {
			return getContainer(env.BOT_CONTAINER, INSTANCE).fetch(request);
		}
		return new Response(
			JSON.stringify({ ok: true, worker: 'settlers3-bot', health: '/health' }),
			{ headers: { 'content-type': 'application/json; charset=utf-8' } }
		);
	},

	async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
		await getContainer(env.BOT_CONTAINER, INSTANCE).ensureRunning();
	}
} satisfies ExportedHandler<Env>;
