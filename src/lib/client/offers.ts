import type { Offer } from '../market';
import { sendJSON } from './api';
import { forgetOffer, myOfferTokens } from './profile.svelte';
import { confirmAction } from './confirm.svelte';
import { toast } from './toast.svelte';
import { bumpLive } from './live.svelte';

export async function cancelMyOffer(offer: Offer): Promise<boolean> {
	const token = myOfferTokens[offer.id];
	if (!token) {
		toast('That offer was posted from another browser, so there is no edit token here.', 'error');
		return false;
	}

	const confirmed = await confirmAction({
		title: 'Cancel this offer?',
		message: `Your ${offer.side === 'buy' ? 'buy order' : 'sell offer'} for ${offer.quantity} × ${offer.price} coins will be removed from the board.`,
		confirmLabel: 'Cancel offer',
		cancelLabel: 'Keep it',
		danger: true
	});
	if (!confirmed) return false;

	try {
		await sendJSON(`/api/offers/${offer.id}`, 'DELETE', undefined, token);
		forgetOffer(offer.id);
		bumpLive();
		toast('Offer removed from the board', 'info');
		return true;
	} catch (error) {
		toast(error instanceof Error ? error.message : 'Could not cancel the offer.', 'error');
		return false;
	}
}
