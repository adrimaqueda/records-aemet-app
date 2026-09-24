<script>
	import Map from "$lib/components/map/Map.svelte";
	import MapControls from "$lib/components/map/MapControls.svelte";
	import StationsLayer from "$lib/components/map/StationsLayer.svelte";
	import StationPanel from "$lib/components/map/StationPanel.svelte";
	import RecientesPanel from "$lib/components/map/RecientesPanel.svelte";
	import Segmented from "$lib/components/ui/Segmented.svelte";
	import {
		fetchStations,
		fetchStats,
		FAMILIA_OPCIONES,
		FAMILIA_SHORT,
		FAMILIA_TIPOS,
	} from "$lib/data/data.js";
	import {
		ultimoVigenteEnFamilia,
		anioDeVigente,
		aniosConVigentes,
		vigentesEnAnio,
	} from "$lib/data/records.js";
	import { daysSince, relativeFromNow } from "$lib/utils/age.js";
	import { PAGE_META } from "$lib/seo.js";
	import { colorForDays } from "$lib/utils/colors.js";
	import { isMobile } from "$lib/utils/viewport.svelte.js";
	import { extent } from "d3-array";
	import { slide } from "svelte/transition";

	let stations = $state([]);
	/** Fecha de la última actualización del dataset (la publica el pipeline en stats.json). */
	let ultimaActualizacion = $state(null);
	let loading = $state(true);
	let error = $state(null);
	let familia = $state("max");
	/** Año del filtro "récord vigente de" (null = todos los años). */
	let anio = $state(null);
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
	});
	const viewCanarias = $derived({
		center: [-15.5, 28.3],
		zoom: isMobile.current ? 5.5 : 7,
		label: "Canarias",
	});

	$effect(() => {
		fetchStations()
			.then((s) => (stations = s))
			.catch((e) => (error = String(e)))
			.finally(() => (loading = false));
		fetchStats()
			.then((s) => (ultimaActualizacion = s.generadoEn))
			.catch((e) => console.warn("No se pudo cargar stats.json", e));
	});

	/** Años en los que alguna estación tiene su récord vigente de la familia
	 *  activa, de más reciente a más antiguo. */
	const aniosOpts = $derived(aniosConVigentes(stations, familia));

	// Al cambiar de familia, el año elegido puede quedarse sin ninguna estación
	// (típico en años antiguos): en ese caso se vuelve a "cualquier año" en vez
	// de dejar el mapa vacío sin explicación.
	$effect(() => {
		if (anio != null && aniosOpts.length > 0 && !aniosOpts.includes(anio)) anio = null;
	});

	/** Estaciones que se pintan: todas, o solo aquellas cuyo récord vigente de la
	 *  familia activa se fijó en el año seleccionado. */
	const visibles = $derived(
		anio == null ? stations : stations.filter((s) => anioDeVigente(s, familia) === anio),
	);

	const geojson = $derived.by(() => {
		const features = visibles
			.map((s) => {
				const ult = ultimoVigenteEnFamilia(s, familia);
				return {
					type: "Feature",
					geometry: { type: "Point", coordinates: [s.lon, s.lat] },
					properties: {
						indicativo: s.indicativo,
						esMax: familia === "max",
						esAbsoluto: !!ult?.esAbsoluto,
						provisional: !!ult?.provisional,
						daysSinceRecord: daysSince(ult?.fecha, now) ?? 100000,
						// Con filtro de año, todas las estaciones mostradas son del mismo
						// año: la escala de antigüedad deja de informar y la capa pinta
						// todos los puntos igual.
						uniforme: anio != null,
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

	/** Paleta de la familia activa: tiñe los puntos de la leyenda con los mismos
	 *  colores que usa el mapa (vía colorForDays), para que coincidan. */
	const legendColors = $derived({
		fresh: colorForDays(familia === "max", 0),
		year: colorForDays(familia === "max", 90),
		old: colorForDays(familia === "max", 3000),
	});

	/** Total de récords batidos en los últimos 15 días para la familia. */
	function countRecientes(s) {
		const { absoluto, mensual } = FAMILIA_TIPOS[familia];
		return (s.recientes15d?.[absoluto] ?? 0) + (s.recientes15d?.[mensual] ?? 0);
	}

	/** Lo que lista el panel flotante: las estaciones con algún récord en los
	 *  últimos 15 días o, con el filtro de año, todas las de ese año. `n` es lo
	 *  que cuenta el badge ×N de cada fila. Más recientes primero. */
	const panelItems = $derived(
		visibles
			.map((s) => ({
				s,
				ult: ultimoVigenteEnFamilia(s, familia),
				n: anio == null ? countRecientes(s) : vigentesEnAnio(s, familia, anio),
			}))
			.filter((x) => x.ult && (anio != null || x.n > 0))
			.sort(
				(a, b) =>
					b.ult.fecha.localeCompare(a.ult.fecha) ||
					b.ult.valor - a.ult.valor ||
					a.s.nombre.localeCompare(b.s.nombre, "es"),
			),
	);
	const panelTitulo = $derived(anio == null ? "Récords recientes" : `Récords vigentes de ${anio}`);
	/** Explica el badge ×N del panel: su significado depende del modo (récords
	 *  recientes vs. filtro de año), así que el texto se decide aquí. */
	const panelBadgeLabel = $derived(
		anio == null
			? (n) => `${n} récords batidos en los últimos 15 días`
			: () => `La estación fijó su récord absoluto y su récord mensual en ${anio}`,
	);

	/** Margen "seguro" en px alrededor del mapa, dentro del cual un punto se
	 *  considera realmente visible (no tapado por HUD / panel de récords).
	 *  En escritorio la HUD (arriba-izq) y el panel de récords (abajo-izq)
	 *  ocupan una columna fija junto al borde izquierdo → el margen izquierdo
	 *  es mucho más ancho que el resto. En móvil ambos paneles ocupan el
	 *  ancho completo, así que lo que pesa es el margen superior/inferior. */
	function safeMargin() {
		return isMobile.current
			? { top: 260, right: 20, bottom: 110, left: 20 }
			: { top: 20, right: 90, bottom: 20, left: 370 };
	}

	// Si el año filtrado deja todas las estaciones fuera de lo que se ve de
	// verdad (tapadas por la HUD/panel o directamente fuera del viewport),
	// el mapa parece vacío aunque el filtro funcione. Encuadramos sobre los
	// resultados en vez de dejar al usuario con un mapa en blanco.
	//
	// Solo se dispara cuando NINGÚN resultado es visible: con un año que deja
	// unas pocas estaciones fuera de encuadre pero otras a la vista, no
	// tocamos la cámara (no queremos pelearnos con quien está paneando).
	$effect(() => {
		if (anio == null || !mapRef || visibles.length === 0) return;

		const { width, height } = mapRef.getContainer().getBoundingClientRect();
		if (width === 0 || height === 0) return;

		const m = safeMargin();
		const anyVisible = visibles.some((s) => {
			const p = mapRef.project([s.lon, s.lat]);
			return p.x >= m.left && p.x <= width - m.right && p.y >= m.top && p.y <= height - m.bottom;
		});
		if (anyVisible) return;

		const [minLon, maxLon] = extent(visibles, (s) => s.lon);
		const [minLat, maxLat] = extent(visibles, (s) => s.lat);
		// El padding nunca puede igualar/superar el contenedor: MapLibre lanza
		// en `fitBounds` si left+right >= width (o top+bottom >= height).
		const maxH = Math.max(0, width / 2 - 1);
		const maxV = Math.max(0, height / 2 - 1);
		mapRef.fitBounds(
			[
				[minLon, minLat],
				[maxLon, maxLat],
			],
			{
				padding: {
					top: Math.min(m.top, maxV),
					bottom: Math.min(m.bottom, maxV),
					left: Math.min(m.left, maxH),
					right: Math.min(m.right, maxH),
				},
				// Un año con una única estación (p.ej. Canarias) debe encuadrar la
				// isla/región, no lanzarse a zoom de calle sobre el punto.
				maxZoom: 8,
				duration: 600,
				essential: true,
			},
		);
	});

	function focusStation(indicativo) {
		const s = stations.find((x) => x.indicativo === indicativo);
		if (!s) return;
		const days = daysSince(ultimoVigenteEnFamilia(s, familia)?.fecha, now);
		// El borde del panel coincide con el color del marcador: con filtro de
		// año el mapa pinta todos los puntos con el color vivo de la familia.
		const color = colorForDays(familia === "max", anio == null ? days : 0);
		selected = { indicativo, color };
		mapRef?.flyTo({ center: [s.lon, s.lat - 0.015], zoom: 12, duration: 900, essential: true });
	}
</script>

<svelte:head>
	<title>{PAGE_META["/"].title}</title>
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
				onReady={(m) => (mapRef = m)}
			>
				<StationsLayer data={geojson} onClick={focusStation} />
				<MapControls initialView={viewPeninsula} altView={viewCanarias} />
			</Map>
		</div>
	{/if}

	<header
		class="hud"
		class:collapsed={!hudExpanded}
		style:--seg-accent="var(--{familia})"
		style:--c-fresh={legendColors.fresh}
		style:--c-year={legendColors.year}
		style:--c-old={legendColors.old}
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
		<Segmented
			options={FAMILIA_OPCIONES}
			bind:value={
				() => familia,
				(v) => {
					familia = v;
					selected = null;
				}
			}
			label="Familia de récord"
			full
		/>
		<!-- Filtro de año: deja en el mapa solo las estaciones cuyo récord vigente
		     (el que sigue en pie hoy) se fijó en ese año. -->
		<div class="year-filter">
			<label for="filtro-anio">Récord vigente de</label>
			<select
				id="filtro-anio"
				value={anio == null ? "" : String(anio)}
				onchange={(e) => {
					anio = e.currentTarget.value === "" ? null : +e.currentTarget.value;
					// La estación abierta puede haber quedado fuera del filtro.
					selected = null;
				}}
				disabled={aniosOpts.length === 0}
			>
				<option value="">Cualquier año</option>
				{#each aniosOpts as y (y)}
					<option value={String(y)}>{y}</option>
				{/each}
			</select>
		</div>
		{#if hudExpanded}
			<div class="extra" transition:slide={{ duration: 220 }}>
				<p class="muted">
					{#if anio == null}
						{stations.length.toLocaleString("es-ES")} estaciones
					{:else}
						<b>{visibles.length.toLocaleString("es-ES")}</b>
						de {stations.length.toLocaleString("es-ES")} estaciones tienen su récord de
						{FAMILIA_SHORT[familia].toLowerCase()} vigente fechado en {anio}
					{/if}
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
					{#if anio == null}
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
					{:else}
						<div class="row">
							<span class="dot-wrap"><span class="dot dot-fresh size-uniform"></span></span>
							<span>
								Con un año seleccionado todas las estaciones son de ese año: se pintan todas igual,
								sin escala de antigüedad.
							</span>
						</div>
					{/if}
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

	<RecientesPanel
		items={panelItems}
		titulo={panelTitulo}
		onSelect={(s) => focusStation(s.indicativo)}
		{selected}
		badgeLabel={panelBadgeLabel}
	/>

	<StationPanel
		indicativo={selected?.indicativo ?? null}
		color={selected?.color}
		onClose={() => (selected = null)}
		{familia}
	/>
</div>

<style>
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
	/* Desktop: la HUD se compacta a la esquina superior izquierda. */
	@media (min-width: 700px) {
		.hud {
			top: 1rem;
			left: 1rem;
			right: auto;
			max-width: 340px;
		}
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
	.year-filter {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	.year-filter label {
		font-size: 0.68rem;
		color: var(--faint);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
		white-space: nowrap;
	}
	.year-filter select {
		flex: 1 1 auto;
		min-width: 0;
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
		transition: background-color 0.25s ease;
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
	.size-uniform {
		width: 9px;
		height: 9px;
		border-width: 0.8px;
	}
	.ring {
		position: absolute;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 1.2px solid #1a1a1a;
		background: rgba(255, 255, 255, 0.6);
	}
	.dot-fresh {
		background: var(--c-fresh);
	}
	.dot-year {
		background: var(--c-year);
	}
	.dot-old {
		background: var(--c-old);
	}
	.prov-chip {
		display: grid;
		place-items: center;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--c-fresh);
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
	@media (prefers-reduced-motion: reduce) {
		.caret {
			transition: none;
		}
	}
</style>
