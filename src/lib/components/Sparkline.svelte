<script lang="ts">
	let {
		values,
		height = 36,
		class: className = '',
		fill = true,
		strokeWidth = 1.8
	}: {
		values: (number | null)[];
		height?: number;
		class?: string;
		fill?: boolean;
		strokeWidth?: number;
	} = $props();

	const id = $props.id();

	const clean = $derived(values.filter((value): value is number => value !== null));

	const geometry = $derived.by(() => {
		if (clean.length < 2) return null;
		const min = Math.min(...clean);
		const max = Math.max(...clean);
		const span = max - min || Math.abs(max) * 0.02 || 1;
		const width = 100;
		const pad = 3;
		const usable = height - pad * 2;
		const step = width / (clean.length - 1);
		const coords = clean.map((value, index) => {
			const x = index * step;
			const y = pad + (1 - (value - min) / span) * usable;
			return [x, y] as const;
		});
		const line = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
		const area = `${line} L${width} ${height} L0 ${height} Z`;
		return { line, area, first: clean[0], last: clean[clean.length - 1] };
	});

	const rising = $derived(geometry ? geometry.last >= geometry.first : true);
	const tone = $derived(rising ? 'text-bid' : 'text-danger');
</script>

{#if geometry}
	<svg
		viewBox="0 0 100 {height}"
		preserveAspectRatio="none"
		class="block w-full {tone} {className}"
		style:height="{height}px"
		role="img"
		aria-label="Price trend"
	>
		<defs>
			<linearGradient id="fill-{id}" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="currentColor" stop-opacity="0.28" />
				<stop offset="100%" stop-color="currentColor" stop-opacity="0" />
			</linearGradient>
		</defs>
		{#if fill}
			<path d={geometry.area} fill="url(#fill-{id})" />
		{/if}
		<path
			d={geometry.line}
			fill="none"
			stroke="currentColor"
			stroke-width={strokeWidth}
			stroke-linecap="round"
			stroke-linejoin="round"
			vector-effect="non-scaling-stroke"
		/>
	</svg>
{:else}
	<div class="flex w-full items-center text-mist-600" style:height="{height}px">
		<div class="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent"></div>
	</div>
{/if}
