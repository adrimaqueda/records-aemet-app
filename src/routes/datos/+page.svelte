<script>
	import { fetchStats, fetchStations, fetchStationDetail, decodeStatsRow } from "$lib/data/data.js";
	import { MESES } from "$lib/utils/format.js";
	import TopBar from "$lib/components/ui/TopBar.svelte";
	import RankingTables from "$lib/components/datos/RankingTables.svelte";
	import RecordsChart from "$lib/components/datos/RecordsChart.svelte";
	import { max, min, rollup, sum } from "d3-array";

	// --- estado ---------------------------------------------------------
	let stats = $state(null);
	let stations = $state(null); // se carga bajo demanda
	let loadError = $state(null);
	let grupo = $state("total");
	/** 'anual' = un año por barra · 'mensual' = 12 meses de un año */
	let vista = $state("anual");
	let anio = $state(null);
	// Estación seleccionada dentro de una provincia: en vez de navegar a su
	// ficha, filtramos la gráfica a sus propios récords (acumulado por estación).
	let estacionSel = $state("");
	let stationDetail = $state(null);
	const stationCache = new Map();

	$effect(() => {
		fetchStats()
			.then((s) => (stats = s))
			.catch((e) => (loadError = String(e)));
	});

	// Año por defecto = el más reciente disponible.
	$effect(() => {
		if (stats && anio == null) anio = stats.anioMax;
	});

	// Lazy-load del catálogo de estaciones solo cuando se elige una provincia.
	$effect(() => {
		if (grupo !== "total" && stations == null) {
			fetchStations()
				.then((s) => (stations = s))
				.catch((e) => console.warn("No se pudo cargar stations.json", e));
		}
	});

	// Al cambiar de provincia (o volver a "total"), deselecciona la estación.
	$effect(() => {
		grupo;
		estacionSel = "";
	});

	// Lazy-load del detalle de la estación elegida (cacheado en memoria). El
	// detalle ya trae todos los eventos de récord, así que el acumulado por
	// estación se calcula en cliente sin tocar el pipeline ni la base de datos.
	$effect(() => {
		const ind = estacionSel;
		if (!ind) {
			stationDetail = null;
			return;
		}
		if (stationCache.has(ind)) {
			stationDetail = stationCache.get(ind);
			return;
		}
		stationDetail = null;
		fetchStationDetail(ind)
			.then((d) => {
				stationCache.set(ind, d);
				if (estacionSel === ind) stationDetail = d;
			})
			.catch((e) => console.warn("No se pudo cargar la estación", e));
	});

	// --- derivaciones ---------------------------------------------------

	function rowsFor(s) {
		if (!s) return [];
		if (vista === "anual") {
			const rows = s.anual[grupo] ?? [];
			return rows.map((r, i) => {
				const o = decodeStatsRow(r, s.rowFields);
				return {
					label: String(s.anios[i]),
					labelLong: `Año ${s.anios[i]}`,
					...o,
				};
			});
		}
		const rows = s.mensual[grupo] ?? [];
		const out = [];
		for (let i = 0; i < rows.length; i++) {
			const [a, m] = s.ejeMensual[i];
			if (a !== anio) continue;
			const o = decodeStatsRow(rows[i], s.rowFields);
			out.push({
				label: MESES[m].slice(0, 3),
				labelLong: `${MESES[m]} ${a}`,
				...o,
			});
		}
		return out;
	}

	/** Igual que rowsFor pero para una sola estación: cuenta sus eventos de
	 *  récord (absoluto + mensual) por periodo. Misma definición que el agregado
	 *  de grupo (absolutoMax+mensualMax · absolutoMin+mensualMin). El % de
	 *  estaciones no aplica con n=1, así que se omite (estacionesConDatos = 0). */
	function rowsForStation(detail) {
		const esMax = (t) => t === "absoluto-max" || t === "mensual-max";
		const esMin = (t) => t === "absoluto-min" || t === "mensual-min";
		const eventos = detail.eventos ?? [];

		if (vista === "anual") {
			const yrs = eventos.map((e) => +e.fecha.slice(0, 4));
			if (yrs.length === 0) return [];
			const y0 = min(yrs);
			const y1 = stats?.anioMax ?? max(yrs);
			// Récords de máxima/mínima agrupados por año.
			const porAnio = rollup(
				eventos,
				(v) => ({
					max: v.filter((e) => esMax(e.tipo)).length,
					min: v.filter((e) => esMin(e.tipo)).length,
				}),
				(e) => +e.fecha.slice(0, 4),
			);
			// Rellena TODOS los años del rango (incluidos los de cero récords).
			const out = [];
			for (let y = y0; y <= y1; y++) {
				const c = porAnio.get(y) ?? { max: 0, min: 0 };
				out.push({
					label: String(y),
					labelLong: `Año ${y}`,
					recordsMax: c.max,
					recordsMin: c.min,
					totalRecords: c.max + c.min,
					estacionesConDatos: 0,
				});
			}
			return out;
		}

		// Mes a mes del año seleccionado.
		const meses = Array.from({ length: 12 }, () => ({ max: 0, min: 0 }));
		for (const e of eventos) {
			if (+e.fecha.slice(0, 4) !== anio) continue;
			const m = +e.fecha.slice(5, 7) - 1;
			if (esMax(e.tipo)) meses[m].max++;
			else if (esMin(e.tipo)) meses[m].min++;
		}
		return meses.map((c, i) => ({
			label: MESES[i + 1].slice(0, 3),
			labelLong: `${MESES[i + 1]} ${anio}`,
			recordsMax: c.max,
			recordsMin: c.min,
			totalRecords: c.max + c.min,
			estacionesConDatos: 0,
		}));
	}

	/** Por cada barra: récords de máxima/mínima descompuestos en absoluto+mensual,
	 *  y los dos porcentajes (estaciones que batieron récord de máxima/mínima). */
	function decorate(rows) {
		return rows.map((r) => {
			const recMax = r.absolutoMax + r.mensualMax;
			const recMin = r.absolutoMin + r.mensualMin;
			const denom = r.estacionesConDatos || 0;
			return {
				...r,
				recordsMax: recMax,
				recordsMin: recMin,
				totalRecords: recMax + recMin,
				pctMax: denom > 0 ? (r.estacionesBatieronMax / denom) * 100 : 0,
				pctMin: denom > 0 ? (r.estacionesBatieronMin / denom) * 100 : 0,
			};
		});
	}

	function nombreGrupo(s) {
		return s?.grupos.find((g) => g.id === grupo)?.nombre ?? grupo;
	}

	function grupoMeta(s) {
		return s?.grupos.find((g) => g.id === grupo) ?? null;
	}

	/** Estaciones del catálogo que pertenecen al grupo seleccionado. */
	function stationsOfGroup(allStations, gMeta) {
		if (!allStations || !gMeta || gMeta.provinciasAemet.length === 0) return [];
		const set = new Set(gMeta.provinciasAemet);
		return allStations
			.filter((st) => set.has(st.provincia))
			.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
	}

	// --- derivaciones reactivas -----------------------------------------
	// Estamos en "modo estación" cuando hay una elegida y su detalle ya cargó.
	const modoEstacion = $derived(
		!!(estacionSel && stationDetail && stationDetail.indicativo === estacionSel),
	);
	// Mientras una estación está seleccionada pero su detalle aún no llegó, no
	// mostramos el agregado de provincia (evita un parpadeo de datos ajenos).
	const data = $derived(
		estacionSel
			? modoEstacion
				? rowsForStation(stationDetail)
				: []
			: stats
				? decorate(rowsFor(stats))
				: [],
	);
	const grupoNombre = $derived(nombreGrupo(stats));
	const grupoActual = $derived(grupoMeta(stats));
	const groupStations = $derived(stationsOfGroup(stations, grupoActual));
	// Nombre del ámbito mostrado (provincia/total o estación) y años disponibles
	// para el selector "mes a mes" (los de la estación cuando hay una elegida).
	const ambitoNombre = $derived(modoEstacion ? stationDetail.nombre : grupoNombre);
	const stationYears = $derived(
		modoEstacion
			? [...new Set(stationDetail.eventos.map((e) => +e.fecha.slice(0, 4)))].sort((a, b) => a - b)
			: null,
	);
	const aniosOpts = $derived(stationYears ?? stats?.anios ?? []);
	// Si la estación no tiene récords en el año elegido, salta a su año más
	// reciente con datos para que la vista "mes a mes" no quede vacía.
	$effect(() => {
		if (modoEstacion && stationYears.length && !stationYears.includes(anio)) {
			anio = stationYears[stationYears.length - 1];
		}
	});
	// Resúmenes
	const totalMax = $derived(sum(data, (d) => d.recordsMax));
	const totalMin = $derived(sum(data, (d) => d.recordsMin));
</script>

<svelte:head>
	<title>Datos · Récords de temperatura</title>
</svelte:head>

<TopBar current="datos" />

<div class="page">
	<main>
		<header class="hero">
			<p class="eyebrow">Red AEMET · histórico desde 1975</p>
			<h1>Récords por año y mes</h1>
			<p class="lead">
				Agregado histórico de récords batidos en la red AEMET, con el porcentaje de estaciones que
				vivieron al menos un récord en cada periodo. Máxima y mínima se muestran por separado.
			</p>
		</header>

		{#if loadError}
			<p class="error">Error: {loadError}</p>
		{:else if !stats}
			<p class="muted">Cargando…</p>
		{:else}
			<!-- Selectores -->
			<div class="controls" role="group" aria-label="Filtros">
				<label class="control">
					<span class="ctl-label">Ámbito</span>
					<select bind:value={grupo}>
						{#each stats.grupos as og (og.id)}
							<option value={og.id}>{og.nombre} · {og.nEstaciones} est.</option>
						{/each}
					</select>
				</label>

				<div class="control toggle" role="group" aria-label="Vista">
					<span class="ctl-label">Vista</span>
					<div class="seg" style:--seg-index={vista === "anual" ? 0 : 1}>
						<span class="seg-pill" aria-hidden="true"></span>
						<button class:active={vista === "anual"} onclick={() => (vista = "anual")}>
							Año a año
						</button>
						<button class:active={vista === "mensual"} onclick={() => (vista = "mensual")}>
							Mes a mes
						</button>
					</div>
				</div>

				{#if vista === "mensual"}
					<label class="control">
						<span class="ctl-label">Año</span>
						<select bind:value={anio}>
							{#each aniosOpts.slice().reverse() as y (y)}
								<option value={y}>{y}</option>
							{/each}
						</select>
					</label>
				{/if}

				<!-- Selector de estación SOLO si hay provincia elegida. Al elegir
				     una, la gráfica pasa a mostrar el acumulado de ESA estación;
				     dejándolo en blanco se vuelve al agregado de la provincia. -->
				{#if grupo !== "total" && groupStations.length > 0}
					<label class="control">
						<span class="ctl-label">Estación</span>
						<select bind:value={estacionSel}>
							<option value="">Toda la provincia · {groupStations.length} est.</option>
							{#each groupStations as st (st.indicativo)}
								<option value={st.indicativo}>{st.nombre}</option>
							{/each}
						</select>
					</label>
				{/if}
			</div>

			<!-- Resumen -->
			{#if estacionSel && !modoEstacion}
				<p class="summary muted">Cargando récords de la estación…</p>
			{:else if data.length > 0}
				<p class="summary">
					<strong>{ambitoNombre}</strong>
					·
					{vista === "anual" ? `${data[0].label}–${data[data.length - 1].label}` : `año ${anio}`}
					→
					<strong>{totalMax.toLocaleString("es-ES")}</strong>
					récords de máxima ·
					<strong>{totalMin.toLocaleString("es-ES")}</strong>
					récords de mínima
					{#if modoEstacion}
						<span class="tip-sep">·</span>
						<a href="/estacion/{estacionSel}">Ver ficha completa →</a>
					{/if}
				</p>
			{/if}

			<RecordsChart {data} {vista} {modoEstacion} />

			<RankingTables />
		{/if}

		<p class="footer small muted">
			¿Cómo se calculan estos números? Lee la
			<a href="/metodologia">metodología</a>
			.
		</p>
	</main>
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
		max-width: 1040px;
		margin: 0 auto;
		padding: clamp(1.5rem, 5vw, 3rem) clamp(1rem, 5vw, 2rem) 5rem;
		line-height: 1.45;
	}
	main {
		display: flex;
		flex-direction: column;
	}

	/* --- Hero --------------------------------------------------------- */
	.hero {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.75rem;
	}
	.eyebrow {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--max);
	}
	h1 {
		margin: 0;
		font-size: clamp(1.9rem, 5vw, 2.7rem);
		font-weight: 800;
		line-height: 1.05;
		letter-spacing: -0.03em;
		color: var(--ink);
	}
	.lead {
		margin: 0.2rem 0 0;
		max-width: 62ch;
		color: var(--muted);
		font-size: 0.95rem;
	}

	/* --- Controles ---------------------------------------------------- */
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem 1rem;
		align-items: end;
		margin: 0 0 1.25rem;
	}
	.control {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.ctl-label {
		font-size: 0.68rem;
		color: var(--faint);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
	}
	select {
		font: inherit;
		font-size: 0.86rem;
		padding: 0.45rem 2rem 0.45rem 0.8rem;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background-color: var(--surface);
		color: var(--ink);
		cursor: pointer;
		min-width: 13rem;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236c6c70' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.8rem center;
		transition: border-color 0.15s ease;
	}
	select:hover {
		border-color: var(--muted);
	}
	.seg {
		position: relative;
		display: inline-grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: var(--surface);
	}
	/* Pill deslizante: ocupa el ancho de un botón y se desplaza a la opción
	   activa según --seg-index (translateX del 100% de su ancho + el gap). */
	.seg-pill {
		position: absolute;
		top: 3px;
		bottom: 3px;
		left: 3px;
		width: calc(50% - 4px);
		border-radius: 999px;
		background: var(--ink);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.18);
		transform: translateX(calc(var(--seg-index, 0) * (100% + 2px)));
		transition: transform 0.28s cubic-bezier(0.34, 1.2, 0.42, 1);
		pointer-events: none;
		z-index: 0;
	}
	.seg button {
		position: relative;
		z-index: 1;
		background: none;
		border: none;
		padding: 0.4rem 0.85rem;
		cursor: pointer;
		font: inherit;
		font-size: 0.84rem;
		font-weight: 500;
		color: var(--muted);
		border-radius: 999px;
		transition: color 0.2s ease;
	}
	.seg button:hover {
		color: var(--ink);
	}
	.seg button.active {
		color: #fff;
	}
	@media (prefers-reduced-motion: reduce) {
		.seg-pill {
			transition: none;
		}
	}

	/* --- Resumen ----------------------------------------------------- */
	.summary {
		margin: 0 0 0.75rem;
		font-size: 0.92rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.summary strong {
		color: var(--ink);
	}
	.tip-sep {
		color: var(--faint);
	}

	/* --- Notas -------------------------------------------------------- */
	.small {
		font-size: 0.82rem;
	}
	.muted {
		color: var(--faint);
	}
	.error {
		color: #b00;
	}
	.footer {
		margin: 2rem 0 0;
	}
	a {
		color: var(--max);
		font-weight: 500;
	}
	a:hover {
		text-decoration: underline;
	}
</style>
