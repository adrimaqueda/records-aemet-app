<script>
	import { page } from "$app/state";
	import { fetchStationDetail } from "$lib/data/data.js";
	import TopBar from "$lib/components/ui/TopBar.svelte";
	import StationHero from "$lib/components/station/StationHero.svelte";
	import RecordsHeadline from "$lib/components/station/RecordsHeadline.svelte";
	import RecordsMensuales from "$lib/components/station/RecordsMensuales.svelte";
	import RecordsEvolution from "$lib/components/station/RecordsEvolution.svelte";

	const indicativo = $derived(page.params.indicativo);
	const detailPromise = $derived(
		indicativo ? fetchStationDetail(indicativo) : null,
	);
</script>

<svelte:head>
	{#await detailPromise then detail}
		<title
			>{detail
				? `${detail.nombre} · Récords de temperatura`
				: "Estación · Récords de temperatura"}</title
		>
	{/await}
</svelte:head>

<TopBar />

<div class="page">
	{#await detailPromise}
		<div class="state">
			<div class="spinner" aria-hidden="true"></div>
			<p>Cargando estación…</p>
		</div>
	{:then detail}
		{#if detail}
			<main>
				<StationHero {detail} />
				<RecordsHeadline {detail} />
				<RecordsMensuales {detail} />
				<RecordsEvolution {detail} />
			</main>
		{/if}
	{:catch err}
		<div class="state error">
			<p>No se pudo cargar la estación.</p>
			<p class="detail">{err.message ?? err}</p>
		</div>
	{/await}
</div>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		background: var(--bg);
		color: var(--ink);
		font-family: var(--font);
		-webkit-font-smoothing: antialiased;
		text-rendering: optimizeLegibility;
	}

	.page {
		max-width: 880px;
		margin: 0 auto;
		padding: clamp(1.5rem, 5vw, 3.5rem) clamp(1rem, 5vw, 2rem) 5rem;
	}
	main {
		display: flex;
		flex-direction: column;
		gap: clamp(2.5rem, 6vw, 4rem);
	}

	.state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 6rem 1rem;
		color: var(--muted);
	}
	.state.error .detail {
		color: var(--faint);
		font-size: 0.85rem;
	}
	.spinner {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2.5px solid var(--line-strong);
		border-top-color: var(--max);
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation-duration: 2s;
		}
	}
</style>
