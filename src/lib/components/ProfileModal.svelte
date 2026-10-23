<script lang="ts">
	import { closeProfile, ui } from '../client/ui.svelte';
	import { loadProfile, profile, saveProfile } from '../client/profile.svelte';
	import { toast } from '../client/toast.svelte';
	import { getJSON } from '../client/api';
	import Modal from './Modal.svelte';
	import Icon from './Icon.svelte';

	let ign = $state('');
	let guild = $state('');
	let contact = $state('');
	let error = $state('');
	let guilds = $state<string[]>([]);
	let wasOpen = false;

	$effect(() => {
		if (ui.profileOpen && !wasOpen) {
			wasOpen = true;
			loadProfile();
			ign = profile.ign;
			guild = profile.guild;
			contact = profile.contact;
			error = '';
			void getJSON<{ guilds: string[] }>('/api/guilds')
				.then((data) => (guilds = data.guilds))
				.catch(() => undefined);
		}
		if (!ui.profileOpen) wasOpen = false;
	});

	function submit() {
		const name = ign.trim();
		if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
			error = 'IGN must be 3–16 letters, numbers or underscores.';
			return;
		}
		saveProfile({ ign: name, guild: guild.trim(), contact: contact.trim() });
		toast('Player profile saved');
		closeProfile();
	}
</script>

<Modal open={ui.profileOpen} onclose={closeProfile} title="Your player profile" subtitle="Set once — it is attached to every offer you post." widthClass="max-w-lg">
	<form
		id="profile-form"
		class="space-y-4"
		onsubmit={(event) => {
			event.preventDefault();
			submit();
		}}
	>
		<div>
			<label class="label" for="profile-ign">
				<span>Minecraft IGN <span class="text-danger">*</span></span>
				<span class="text-[10px] font-normal text-mist-600">Java edition</span>
			</label>
			<div class="relative">
				<Icon name="user" size={16} class="pointer-events-none absolute left-3 top-3 text-mist-500" />
				<input
					id="profile-ign"
					class="input pl-9"
					bind:value={ign}
					maxlength="16"
					placeholder="e.g. Jandal03"
					autocomplete="off"
					spellcheck="false"
				/>
			</div>
		</div>

		<div>
			<label class="label" for="profile-guild">
				<span>Guild</span>
				<span class="text-[10px] font-normal text-mist-600">Optional</span>
			</label>
			<div class="relative">
				<Icon name="shield" size={16} class="pointer-events-none absolute left-3 top-3 text-mist-500" />
				<input
					id="profile-guild"
					class="input pl-9"
					bind:value={guild}
					list="guild-suggestions"
					maxlength="32"
					placeholder="e.g. Ironwood Company"
					autocomplete="off"
				/>
			</div>
			<datalist id="guild-suggestions">
				{#each guilds as suggestion (suggestion)}
					<option value={suggestion}></option>
				{/each}
			</datalist>
		</div>

		<div>
			<label class="label" for="profile-contact">
				<span>Contact</span>
				<span class="text-[10px] font-normal text-mist-600">Optional</span>
			</label>
			<input
				id="profile-contact"
				class="input"
				bind:value={contact}
				maxlength="64"
				placeholder="Discord handle or in-game note"
				autocomplete="off"
			/>
			<p class="mt-1.5 text-[11px] text-mist-500">
				Shown on your offers so buyers can reach you. Do not post private information.
			</p>
		</div>

		{#if error}
			<p class="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
		{/if}

		<div class="rounded-xl border border-white/[0.07] bg-ink-950/50 p-3 text-[11px] leading-relaxed text-mist-400">
			<div class="flex gap-2">
				<Icon name="lock" size={14} class="mt-0.5 shrink-0 text-bid" />
				<p>
					This is a local profile, not an account. It is saved in this browser only and used to prefill
					offers. Your offer edit tokens also stay in this browser.
				</p>
			</div>
		</div>
	</form>

	{#snippet footer()}
		<div class="flex items-center justify-between gap-3">
			<p class="hidden text-[11px] text-mist-500 sm:block">No sign-up. No password. Just your IGN.</p>
			<div class="flex w-full gap-2 sm:w-auto">
				<button type="button" class="btn-ghost flex-1 sm:flex-none" onclick={closeProfile}>Cancel</button>
				<button type="submit" form="profile-form" class="btn-primary flex-1 sm:flex-none">
					<Icon name="check" size={15} /> Save profile
				</button>
			</div>
		</div>
	{/snippet}
</Modal>
