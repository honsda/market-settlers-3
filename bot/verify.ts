import { verifyKey } from 'discord-interactions';

/**
 * Verify Discord's Ed25519 signature for an interaction request.
 *
 * Discord signs `timestamp + rawBody`; the public key is the application's
 * public key from the Developer Portal. `discord-interactions` uses tweetnacl,
 * which works in Workers without Node crypto bindings.
 */
export async function verifyDiscordRequest(
	body: string,
	signature: string,
	timestamp: string,
	publicKey: string
): Promise<boolean> {
	try {
		return await verifyKey(body, signature, timestamp, publicKey);
	} catch {
		return false;
	}
}
