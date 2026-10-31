<script lang="ts">
	let { html, class: className = '' }: { html: string; class?: string } = $props();
</script>

<div class="article-body {className}">
	{@html html}
</div>

<style>
	.article-body {
		color: var(--color-mist-300);
		font-size: 0.95rem;
		line-height: 1.85;
	}

	.article-body :global(p) {
		margin: 1.1rem 0;
	}

	.article-body :global(h2) {
		margin: 2rem 0 0.7rem;
		font-family: var(--font-serif);
		font-size: 1.45rem;
		font-weight: 600;
		line-height: 1.25;
		color: var(--color-mist-100);
	}

	.article-body :global(h3) {
		margin: 1.5rem 0 0.5rem;
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--color-mist-100);
	}

	.article-body :global(strong) {
		color: var(--color-mist-100);
		font-weight: 600;
	}

	.article-body :global(em) {
		font-style: italic;
	}

	.article-body :global(u) {
		text-underline-offset: 3px;
	}

	.article-body :global(ul),
	.article-body :global(ol) {
		margin: 1rem 0;
		padding-left: 1.25rem;
	}

	.article-body :global(ul) {
		list-style: disc;
	}

	.article-body :global(ol) {
		list-style: decimal;
	}

	.article-body :global(li) {
		margin: 0.35rem 0;
		padding-left: 0.15rem;
	}

	.article-body :global(li)::marker {
		color: var(--color-bid);
	}

	.article-body :global(blockquote) {
		margin: 1.5rem 0;
		border-left: 2px solid var(--color-bid);
		padding-left: 1rem;
		color: var(--color-mist-200);
		font-family: var(--font-serif);
		font-size: 1.1rem;
		font-style: italic;
	}

	.article-body :global(a) {
		color: var(--color-bid);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.article-body :global(img) {
		display: block;
		width: 100%;
		height: auto;
		margin: 1.5rem 0;
		border-radius: 0.35rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.article-body :global(hr) {
		margin: 2rem 0;
		border: 0;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.article-body :global(pre) {
		overflow-x: auto;
		margin: 1.25rem 0;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.25);
		padding: 0.9rem;
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}

	.article-body :global(code) {
		font-family: var(--font-mono);
		font-size: 0.85em;
	}

	.article-body :global(p code) {
		border-radius: 0.25rem;
		background: rgba(255, 255, 255, 0.06);
		padding: 0.1rem 0.3rem;
	}
</style>
