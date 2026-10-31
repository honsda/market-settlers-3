<script lang="ts">
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ href: '/news/paper', label: 'Newspaper' },
		{ href: '/news', label: 'Recent articles', exact: true },
		{ href: '/news/mine', label: 'Your articles' },
		{ href: '/news/write', label: 'Make an article' }
	];

	const pathname = $derived(page.url.pathname);
	const active = (href: string, exact = false) =>
		exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
</script>

<svelte:head>
	<meta name="theme-color" content="#060a0f" />
</svelte:head>

<div class="min-h-screen bg-ink-950 text-mist-200">
	<header class="border-b border-white/[0.08]">
		<div class="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4 px-5 pb-4 pt-6 sm:px-8">
			<a href="/news" class="group min-w-0">
				<p class="text-[9px] font-semibold uppercase tracking-[0.28em] text-mist-500">
					Settlers III · Caeldun
				</p>
				<h1
					class="mt-1 font-serif text-[28px] font-semibold leading-none tracking-tight text-mist-100 transition group-hover:text-white sm:text-[34px]"
				>
					The Caeldun Ledger
				</h1>
			</a>
			<a
				href="/"
				class="text-[10px] font-semibold uppercase tracking-[0.18em] text-mist-500 transition hover:text-mist-200"
			>
				Market hall
			</a>
		</div>

		<nav class="mx-auto max-w-5xl overflow-x-auto px-5 sm:px-8">
			<div class="flex min-w-max items-center gap-5 border-t border-white/[0.06] py-3">
				{#each nav as item (item.href)}
					<a
						href={item.href}
						aria-current={active(item.href, item.exact) ? 'page' : undefined}
						class="border-b pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition
							{active(item.href, item.exact)
							? 'border-bid text-mist-100'
							: 'border-transparent text-mist-500 hover:border-white/20 hover:text-mist-200'}"
					>
						{item.label}
					</a>
				{/each}
				<a
					href="/news/moderation"
					class="ml-auto border-b border-transparent pb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-mist-600 transition hover:border-white/20 hover:text-mist-300"
				>
					Moderation
				</a>
			</div>
		</nav>
	</header>

	<main class="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
		{@render children()}
	</main>

	<footer class="border-t border-white/[0.06]">
		<div
			class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-[10px] text-mist-600 sm:px-8"
		>
			<p><span class="font-semibold text-mist-400">The Caeldun Ledger</span> · community dispatches</p>
			<p>Images are reviewed before publication.</p>
		</div>
	</footer>
</div>
