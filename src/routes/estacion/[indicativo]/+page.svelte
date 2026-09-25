<script>
	import { latestInFamily } from "$lib/data/records.js";
	import { stationMeta } from "$lib/seo.js";
	import { colorForDays } from "$lib/utils/colors.js";
	import { daysSince } from "$lib/utils/age.js";
	import TopBar from "$lib/components/ui/TopBar.svelte";
	import StationHero from "$lib/components/station/StationHero.svelte";
	import StationMinimap from "$lib/components/station/StationMinimap.svelte";
	import RecordsHeadline from "$lib/components/station/RecordsHeadline.svelte";
	import RecordsMensuales from "$lib/components/station/RecordsMensuales.svelte";
	import RecordsEvolution from "$lib/components/station/RecordsEvolution.svelte";

	let { data } = $props();

	// Promesa del detalle, lanzada en +page.js (y precargada al pasar el ratón
	// por el enlace).
	const detailPromise = $derived(data.detail);

	/** Color de recencia del récord más reciente de la estación (cualquier
	 *  familia): es el que pinta el anillo del minimapa, igual que el marcador
	 *  de esa estación en el mapa grande. */
	function ringColor(detail) {
		const max = latestInFamily(detail, "max");
		const min = latestInFamily(detail, "min");
		const best = !max ? min : !min ? max : max.fecha >= min.fecha ? max : min;
		return best ? colorForDays(best === max, daysSince(best.fecha)) : null;
	}
</script>

<svelte:head>
	{#await detailPromise then detail}
		<title>{stationMeta(detail).title}</title>
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
		<main>
			<!-- Cabecera + minimapa: en escritorio el medallón va a la izquierda
			     del titular; en móvil la banda se coloca debajo (column-reverse). -->
			<div class="hero-block">
				<StationMinimap {detail} color={ringColor(detail)} />
				<StationHero {detail} />
			</div>
			<RecordsHeadline {detail} />
			<RecordsMensuales {detail} />
			<RecordsEvolution {detail} />
			<!-- El minimapa apaga el control de atribución de MapLibre (no cabe
			     en un medallón de 172 px), así que el crédito va aquí, una vez. -->
			<p class="credit">Cartografía © OpenFreeMap · © OpenStreetMap contributors</p>
		</main>
	{:catch err}
		<div class="state error">
			<p>No se pudo cargar la estación.</p>
			<p class="detail">{err.message ?? err}</p>
		</div>
	{/await}
</div>

<style>
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

	.hero-block {
		display: flex;
		align-items: center;
		gap: 2rem;
	}
	@media (max-width: 699px) {
		.hero-block {
			flex-direction: column-reverse;
			align-items: stretch;
			gap: 1.6rem;
		}
	}

	.credit {
		margin: -1rem 0 0;
		font-size: 0.75rem;
		color: var(--faint);
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
</style>
