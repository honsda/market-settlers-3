import type { Message } from 'discord.js';

let lastNotice = 0;

/**
 * Publish a message in an announcement channel so every channel following it
 * receives a copy. Normal text-channel messages are a no-op.
 */
export async function publishToFollowers(message: Message): Promise<void> {
	if (!message.crosspostable) return;

	try {
		await message.crosspost();
	} catch (error) {
		// The original message was already sent. Do not fail the caller or it
		// may retry and duplicate the post; just warn and keep the board going.
		const now = Date.now();
		if (now - lastNotice < 5 * 60_000) return;
		lastNotice = now;
		console.warn(
			`[bot] Could not publish message ${message.id} to followers:`,
			error instanceof Error ? error.message : error
		);
	}
}
