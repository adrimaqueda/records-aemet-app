<script>
	import Map from "$lib/components/map/Map.svelte";
	import MapControls from "$lib/components/map/MapControls.svelte";
	import StationsLayer from "$lib/components/map/StationsLayer.svelte";
	import StationPanel from "$lib/components/map/StationPanel.svelte";
	import RecientesPanel from "$lib/components/map/RecientesPanel.svelte";
	import {
		fetchStations,
		fetchStats,
		FAMILIA_SHORT,
		FAMILIAS,
		FAMILIA_TIPOS,
	} from "$lib/data/data.js";
	import { dayNumber, daysSince, relativeFromNow } from "$lib/utils/age.js";
	import { colorForDays } from "$lib/utils/colors.js";
	import { isMobile } from "$lib/utils/viewport.svelte.js";
	import { slide } from "svelte/transition";

	let stations = $state([]);
	let stats = $state(null);
	let loading = $state(true);
	let error = $state(null);
	let familia = $state("max");
	/** HUD desplegada (todo) o compacta (solo título y filtro). */
	let hudExpanded = $state(true);
	/** @type {{indicativo: string, color: string} | null} */
	let selected = $state(null);
	let mapRef = $state(null);
	const now = new Date();

	const viewPeninsula = $derived({
		center: [-3.7, 40.5],
		zoom: isMobile.current ? 5.2 : 6,
		label: "Península",
		short: "Pen",
	});
	const viewCanarias = $derived({
		center: [-15.5, 28.3],
		zoom: isMobile.current ? 5.5 : 7,
		label: "Canarias",
		short: "Can",
	});

	$effect(() => {
		fetchStations()
			.then((s) => {
				stations = s;
				loading = false;
			})
			.catch((e) => {
				error = String(e);
				loading = false;
			});
	});

	$effect(() => {
		fetchStats()
			.then((s) => (stats = s))
			.catch((e) => console.warn("No se pudo cargar stats.json", e));
	});

	/** Para cada estación, devuelve el último récord de la familia seleccionada
	 *  comparando absoluto y mensual y eligiendo el más reciente. */
	function ultimoEnFamilia(s, fam) {
		const { absoluto, mensual } = FAMILIA_TIPOS[fam];
		const a = s.ultimoPorTipo[absoluto];
		const m = s.ultimoPorTipo[mensual];
		if (!a && !m) return null;
		if (!a) return { ...m, esAbsoluto: false };
		if (!m) return { ...a, esAbsoluto: true };
		return new Date(a.fecha) >= new Date(m.fecha)
			? { ...a, esAbsoluto: true }
			: { ...m, esAbsoluto: false };
	}

	/** Total de récords batidos en los últimos 30 días para la familia. */
	function countRecientes(s, fam) {
		const { absoluto, mensual } = FAMILIA_TIPOS[fam];
		const r = s.recientes15d ?? {};
		return (r[absoluto] ?? 0) + (r[mensual] ?? 0);
	}

	const geojson = $derived.by(() => {
		const features = stations
			.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
			.map((s) => {
				const ult = ultimoEnFamilia(s, familia);
				const fecha = ult?.fecha ?? null;
				const days = daysSince(fecha, now);
				return {
					type: "Feature",
					geometry: { type: "Point", coordinates: [s.lon, s.lat] },
					properties: {
						indicativo: s.indicativo,
						nombre: s.nombre,
						esMax: familia === "max",
						esAbsoluto: !!ult?.esAbsoluto,
						provisional: !!ult?.provisional,
						fecha,
						valor: ult?.valor ?? null,
						daysSinceRecord: days ?? 100000,
						dayNumber: dayNumber(days),
					},
				};
			})
			// Los más antiguos primero → los frescos quedan al final y se pintan
			// ENCIMA (mayor z). Los círculos respetan este orden de dibujado.
			.sort((a, b) => b.properties.daysSinceRecord - a.properties.daysSinceRecord);

		// Prioridad de etiqueta = orden de pintado invertido. El círculo que queda
		// arriba (último pintado, índice más alto) recibe el labelPriority MÁS bajo,
		// y como MapLibre coloca antes (y deja ganar) las claves más bajas, el
		// número visible es siempre el del círculo de arriba, nunca el de debajo.
		features.forEach((f, i) => (f.properties.labelPriority = -i));

		return { type: "FeatureCollection", features };
	});

	/** Fecha de la última actualización del dataset (la publica el pipeline en stats.json). */
	const ultimaActualizacion = $derived(stats?.generadoEn ?? null);

	/** Paleta de la familia activa: tiñe la pill y los puntos de la leyenda con
	 *  los mismos colores que usa el mapa (vía colorForDays), para que coincidan. */
	const esMax = $derived(familia === "max");
	const accent = $derived(esMax ? "var(--max)" : "var(--min)");
	const legendColors = $derived({
		fresh: colorForDays(esMax, 0),
		year: colorForDays(esMax, 90),
		old: colorForDays(esMax, 3000),
	});

	/** Lista de estaciones con al menos un récord en el último mes para la familia. */
	const recientes = $derived(
		stations
			.map((s) => {
				const ult = ultimoEnFamilia(s, familia);
				const n = countRecientes(s, familia);
				return { s, ult, n };
			})
			.filter((x) => x.n > 0 && x.ult)
			.sort(
				(a, b) =>
					new Date(b.ult.fecha).getTime() - new Date(a.ult.fecha).getTime() ||
					b.ult.valor - a.ult.valor ||
					a.s.nombre.localeCompare(b.s.nombre, "es"),
			),
	);

	function focusStation(s) {
		// Recupera la estación completa (de stations[]) si nos pasan solo {indicativo,…}
		const full = stations.find((x) => x.indicativo === s.indicativo) ?? s;
		const ult = ultimoEnFamilia(full, familia);
		const days = daysSince(ult?.fecha, now);
		const color = colorForDays(familia === "max", days);

		selected = { indicativo: s.indicativo, color };
		if (mapRef) {
			mapRef.flyTo({
				center: [s.lon, s.lat - 0.015],
				zoom: 12,
				duration: 900,
				essential: true,
			});
		}
	}
</script>

<svelte:head>
	<title>Récords de temperatura AEMET</title>
</svelte:head>

<div class="root">
	{#if loading}
		<div class="overlay">
			<div class="spinner" aria-hidden="true"></div>
			<p>Cargando estaciones…</p>
		</div>
	{:else if error}
		<div class="overlay error">
			<p>No se pudieron cargar las estaciones.</p>
			<p class="detail">{error}</p>
		</div>
	{:else}
		<div class="map-wrap">
			<Map
				longitude={viewPeninsula.center[0]}
				latitude={viewPeninsula.center[1]}
				zoom={viewPeninsula.zoom}
				fill
				credit="© OpenFreeMap · © OSM · datos: AEMET vía datania"
				onReady={(m) => (mapRef = m)}
			>
				<StationsLayer
					data={geojson}
					onClick={(f) =>
						focusStation({
							indicativo: f.properties.indicativo,
							lon: f.geometry.coordinates[0],
							lat: f.geometry.coordinates[1],
						})}
				/>
				<MapControls initialView={viewPeninsula} altView={viewCanarias} />
			</Map>
		</div>
	{/if}

	<header
		class="hud"
		class:collapsed={!hudExpanded}
		style="--accent: {accent}; --c-fresh: {legendColors.fresh}; --c-year: {legendColors.year}; --c-old: {legendColors.old}"
	>
		<div class="title-row">
			<h1>¿Cuándo se ha batido el último récord de temperatura?</h1>
			<button
				class="toggle"
				onclick={() => (hudExpanded = !hudExpanded)}
				aria-expanded={hudExpanded}
				aria-label={hudExpanded ? "Mostrar menos" : "Mostrar más"}
				title={hudExpanded ? "Mostrar menos" : "Mostrar más"}
			>
				<svg class="caret" viewBox="0 0 10 10" width="12" height="12" aria-hidden="true">
					<path
						d="M1.5 3.3 L5 6.8 L8.5 3.3"
						fill="none"
						stroke="currentColor"
						stroke-width="1.6"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>
		<div
			class="filter"
			role="group"
			aria-label="Familia de récord"
			style="--n: {FAMILIAS.length}; --i: {FAMILIAS.indexOf(familia)}"
		>
			<span class="pill" aria-hidden="true"></span>
			{#each FAMILIAS as f (f)}
				<button class:active={familia === f} onclick={() => ((familia = f), (selected = null))}>
					{FAMILIA_SHORT[f]}
				</button>
			{/each}
		</div>
		{#if hudExpanded}
			<div class="extra" transition:slide={{ duration: 220 }}>
				<p class="muted">
					{stations.length.toLocaleString("es-ES")} estaciones
					{#if ultimaActualizacion}
						<br />
						Datos actualizados
						<b>{relativeFromNow(ultimaActualizacion)}</b>
					{/if}
				</p>
				<nav class="nav-links">
					<a href="/datos">
						<span class="link-arrow">↑</span>
						Resumen de datos
					</a>
					<span aria-hidden="true">·</span>
					<a href="/metodologia">
						<span class="link-arrow">↑</span>
						Metodología
					</a>
				</nav>
				<p class="author">
					Por <a href="https://adrimaqueda.com" target="_blank" rel="noreferrer">
						<span class="link-arrow">↑</span>
						Adrián Maqueda
					</a>
					<span aria-hidden="true">·</span>
					<a
						href="https://github.com/adrimaqueda/records-aemet-app"
						target="_blank"
						rel="noreferrer"
					>
						<span class="link-arrow">↑</span>
						Código
					</a>
				</p>
				<details class="legend">
					<summary>Leyenda</summary>
					<div class="row">
						<span class="dot-wrap"><span class="dot dot-fresh size-fresh"></span></span>
						<span>Último mes — grande, vibrante, con etiqueta y halo</span>
					</div>
					<div class="row">
						<span class="dot-wrap"><span class="dot dot-year size-year"></span></span>
						<span>Hace meses</span>
					</div>
					<div class="row">
						<span class="dot-wrap"><span class="dot dot-old size-old"></span></span>
						<span>Hace años — pequeño y desvaído</span>
					</div>
					<hr />
					<div class="row">
						<span class="dot-wrap">
							<span class="ring"></span>
							<span class="dot dot-fresh size-fresh"></span>
						</span>
						<span>
							Récord <strong>absoluto</strong>
							(anillo blanco)
						</span>
					</div>
					<div class="row">
						<span class="dot-wrap"><span class="dot dot-fresh size-fresh"></span></span>
						<span>
							Récord <strong>mensual</strong>
						</span>
					</div>
					<div class="row">
						<span class="dot-wrap"><span class="prov-chip">~</span></span>
						<span>
							Récord <strong>provisional</strong>
							— del horario reciente, aún sin dato definitivo
						</span>
					</div>
				</details>
			</div>
		{/if}
	</header>

	<RecientesPanel {recientes} onSelect={focusStation} {selected} />

	<StationPanel
		indicativo={selected?.indicativo ?? null}
		color={selected?.color}
		onClose={() => (selected = null)}
		{familia}
	/>
</div>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		height: 100%;
		background: var(--bg);
		color: var(--ink);
		font-family: var(--font);
		box-sizing: border-box;
		-webkit-font-smoothing: antialiased;
		text-rendering: optimizeLegibility;
	}
	.root {
		position: fixed;
		inset: 0;
	}
	.map-wrap {
		position: absolute;
		inset: 0;
	}
	/* Mobile-first: la HUD se sitúa arriba, compacta, pegada al borde. */
	.hud {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		right: 0.5rem;
		z-index: 5;
		background: color-mix(in srgb, var(--surface) 88%, transparent);
		backdrop-filter: saturate(1.4) blur(10px);
		border: 1px solid var(--line);
		padding: 0.85rem 1rem;
		border-radius: var(--radius);
		box-shadow: var(--shadow);
	}
	.title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.6rem;
		margin-bottom: 0.55rem;
	}
	.hud h1 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--ink);
	}
	.toggle {
		flex: 0 0 auto;
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		margin-top: -1px;
		padding: 0;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: var(--surface);
		color: var(--muted);
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease;
	}
	.toggle:hover {
		color: var(--ink);
		border-color: var(--muted);
	}
	.caret {
		display: block;
		transition: transform 0.2s ease;
	}
	/* Desplegada → la flecha apunta arriba (plegar); plegada → abajo (desplegar). */
	.hud:not(.collapsed) .caret {
		transform: rotate(180deg);
	}
	.filter {
		position: relative;
		display: flex;
		gap: 0;
		padding: 3px;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: var(--surface);
	}
	/* Pastilla que se desliza bajo la opción activa. */
	.pill {
		position: absolute;
		top: 3px;
		left: 3px;
		bottom: 3px;
		width: calc((100% - 6px) / var(--n));
		background: var(--accent, var(--ink));
		border-radius: 999px;
		transform: translateX(calc(var(--i) * 100%));
		transition:
			transform 0.32s cubic-bezier(0.34, 1.3, 0.5, 1),
			background-color 0.25s ease;
	}
	.filter button {
		position: relative;
		z-index: 1;
		flex: 1 1 0;
		border: none;
		background: none;
		border-radius: 999px;
		padding: 0.4rem 0.6rem;
		cursor: pointer;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--muted);
		transition: color 0.18s ease;
	}
	.filter button:hover {
		color: var(--ink);
	}
	.filter button.active {
		color: #fff;
	}
	.extra {
		margin-top: 0.6rem;
	}
	.muted {
		margin: 0;
		font-size: 0.78rem;
		color: var(--muted);
		line-height: 1.4;
	}
	.muted b {
		color: var(--ink);
		font-weight: 600;
	}
	.nav-links {
		margin-top: 0.5rem;
		font-size: 0.78rem;
		display: flex;
		gap: 0.5rem;
		align-items: center;
		color: var(--faint);
	}
	.nav-links a {
		color: var(--ink);
		text-decoration: none;
		font-weight: 500;
	}
	.link-arrow {
		display: inline-block;
		transform: rotate(45deg);
	}

	.nav-links a:hover {
		text-decoration: underline;
	}
	.author {
		margin: 0.35rem 0 0;
		font-size: 0.72rem;
		color: var(--faint);
		line-height: 1.4;
	}
	.author a {
		color: var(--faint);
		text-decoration: none;
		font-weight: 500;
	}
	.author a:hover {
		color: var(--muted);
		text-decoration: underline;
	}
	.legend {
		margin-top: 0.5rem;
		font-size: 0.78rem;
		color: var(--muted);
	}

	/* Desktop: la HUD se compacta a la esquina superior izquierda. */
	@media (min-width: 700px) {
		.hud {
			top: 1rem;
			left: 1rem;
			right: auto;
			max-width: 340px;
		}
	}
	.legend summary {
		cursor: pointer;
		color: var(--muted);
		font-weight: 500;
	}
	.legend summary:hover {
		color: var(--ink);
	}
	.legend hr {
		border: none;
		border-top: 1px solid var(--line);
		margin: 0.5rem 0;
	}
	.legend strong {
		color: var(--ink);
	}
	.legend .row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.15rem 0;
	}
	.dot-wrap {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: 20px;
		height: 20px;
		flex: 0 0 20px;
	}
	.dot {
		position: relative;
		border-radius: 50%;
		border: 1px solid #1a1a1a;
	}
	.size-fresh {
		width: 12px;
		height: 12px;
	}
	.size-year {
		width: 7px;
		height: 7px;
		border-width: 0.6px;
	}
	.size-old {
		width: 4px;
		height: 4px;
		border-width: 0;
	}
	.ring {
		position: absolute;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 1.2px solid #1a1a1a;
		background: rgba(255, 255, 255, 0.6);
	}
	.dot {
		transition: background-color 0.25s ease;
	}
	.dot-fresh {
		background: var(--c-fresh, hsl(10 95% 50%));
	}
	.dot-year {
		background: var(--c-year, hsl(10 40% 65%));
	}
	.dot-old {
		background: var(--c-old, hsl(0 0% 82%));
	}
	.prov-chip {
		display: grid;
		place-items: center;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--c-fresh, hsl(10 95% 50%));
		transition: background-color 0.25s ease;
		color: #fff;
		font-size: 0.72rem;
		font-weight: 700;
		line-height: 1;
		border: 1px solid #fff;
		box-shadow: 0 0 0 1px #1a1a1a;
	}

	.overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		background: var(--bg);
		color: var(--muted);
	}
	.overlay p {
		margin: 0;
	}
	.overlay.error .detail {
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
		.pill,
		.caret {
			transition: none;
		}
	}
</style>
