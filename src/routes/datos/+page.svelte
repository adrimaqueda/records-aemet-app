<script>
	import { goto } from "$app/navigation";
	import { fetchStats, fetchStations, decodeStatsRow } from "$lib/data/data.js";
	import { MESES } from "$lib/utils/format.js";
	import TopBar from "$lib/components/ui/TopBar.svelte";
	import RankingTables from "$lib/components/datos/RankingTables.svelte";

	// --- estado ---------------------------------------------------------
	let stats = $state(null);
	let stations = $state(null); // se carga bajo demanda
	let loadError = $state(null);
	let grupo = $state("total");
	/** 'anual' = un año por barra · 'mensual' = 12 meses de un año */
	let vista = $state("anual");
	let anio = $state(null);
	let hoverIdx = $state(-1);
	let svgWidth = $state(0);

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

	function fmtPct(p) {
		return `${p.toFixed(p < 10 ? 1 : 0)}%`;
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

	// --- geometría de la gráfica SVG ------------------------------------
	// Gráfica divergente: una línea cero en el centro; máxima crece hacia
	// arriba y mínima hacia abajo, compartiendo escala para comparar al vuelo.
	const MARGIN = { top: 18, right: 12, bottom: 28, left: 46 };
	const HEIGHT = 320;

	function chartGeom(data, width) {
		if (!width || data.length === 0) return null;
		const w = Math.max(0, width - MARGIN.left - MARGIN.right);
		const h = HEIGHT - MARGIN.top - MARGIN.bottom;
		const n = data.length;
		const gap = n > 30 ? 0 : 2;
		const barW = Math.max(1, w / n - gap);
		const halfH = h / 2;
		const cy = MARGIN.top + halfH; // línea cero (centro)
		// Escala compartida entre máxima y mínima → comparación justa.
		const maxRec = Math.max(1, ...data.map((d) => Math.max(d.recordsMax, d.recordsMin)));
		return { w, h, n, barW, gap, maxRec, halfH, cy };
	}

	function xFor(g, i) {
		return MARGIN.left + (i + 0.5) * (g.w / g.n);
	}
	/** Y para un valor de máxima (por encima del centro). */
	function yUp(g, v) {
		return g.cy - (v / g.maxRec) * g.halfH;
	}
	/** Y para un valor de mínima (por debajo del centro). */
	function yDown(g, v) {
		return g.cy + (v / g.maxRec) * g.halfH;
	}

	function niceTicks(max) {
		if (max <= 0) return [0];
		const exp = Math.floor(Math.log10(max));
		const base = Math.pow(10, exp);
		const m = max / base;
		const step = m > 5 ? base * 2 : m > 2 ? base : base / 2;
		const out = [];
		for (let v = 0; v <= max; v += step) out.push(Math.round(v));
		return out;
	}

	// --- derivaciones reactivas -----------------------------------------
	const data = $derived(stats ? decorate(rowsFor(stats)) : []);
	const geom = $derived(chartGeom(data, svgWidth));
	const tickRec = $derived(geom ? niceTicks(geom.maxRec) : []);
	const grupoNombre = $derived(nombreGrupo(stats));
	const grupoActual = $derived(grupoMeta(stats));
	const groupStations = $derived(stationsOfGroup(stations, grupoActual));
	// Resúmenes
	const totalMax = $derived(data.reduce((a, b) => a + b.recordsMax, 0));
	const totalMin = $derived(data.reduce((a, b) => a + b.recordsMin, 0));

	// Colores (consistentes con el mapa y los tokens --max / --min)
	const COLOR_MAX = "hsl(8 82% 50%)";
	const COLOR_MIN = "hsl(34 88% 47%)";

	// Densidad de etiquetas X
	function everyN(n) {
		return Math.max(1, Math.ceil(n / 12));
	}
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
							{#each stats.anios.slice().reverse() as y (y)}
								<option value={y}>{y}</option>
							{/each}
						</select>
					</label>
				{/if}

				<!-- Selector de estación SOLO si hay provincia elegida.
				     Al elegir una, navegamos al detalle. -->
				{#if grupo !== "total" && groupStations.length > 0}
					<label class="control">
						<span class="ctl-label">Ver estación</span>
						<select
							onchange={(e) => {
								const ind = e.currentTarget.value;
								if (ind) goto(`/estacion/${ind}`);
							}}
						>
							<option value="">— {groupStations.length} estaciones —</option>
							{#each groupStations as st (st.indicativo)}
								<option value={st.indicativo}>{st.nombre}</option>
							{/each}
						</select>
					</label>
				{/if}
			</div>

			<!-- Resumen -->
			{#if data.length > 0}
				<p class="summary">
					<strong>{grupoNombre}</strong>
					·
					{vista === "anual"
						? `${stats.anios[0]}–${stats.anios[stats.anios.length - 1]}`
						: `año ${anio}`}
					→
					<strong>{totalMax.toLocaleString("es-ES")}</strong>
					récords de máxima ·
					<strong>{totalMin.toLocaleString("es-ES")}</strong>
					récords de mínima
				</p>
			{/if}

			<!-- Tooltip flotante con la barra hover -->
			<div class="info">
				{#if hoverIdx >= 0 && data[hoverIdx]}
					{@const d = data[hoverIdx]}
					<p class="tooltip">
						<strong>{d.labelLong}</strong>
						<span class="tip-sep">·</span>
						<span class="tip-max">Máx: {d.recordsMax.toLocaleString("es-ES")} récords</span>
						{#if d.estacionesConDatos > 0}
							({d.estacionesBatieronMax}/{d.estacionesConDatos}
							estaciones · {fmtPct(d.pctMax)})
						{/if}
						<span class="tip-sep">·</span>
						<span class="tip-min">Mín: {d.recordsMin.toLocaleString("es-ES")} récords</span>
						{#if d.estacionesConDatos > 0}
							({d.estacionesBatieronMin}/{d.estacionesConDatos}
							estaciones · {fmtPct(d.pctMin)})
						{/if}
					</p>
				{:else if data.length > 0}
					<p class="muted small" style="margin: 0;">
						Pasa el ratón sobre una barra para ver el detalle.
					</p>
				{/if}
			</div>

			<!-- Una sola gráfica divergente: máxima hacia arriba, mínima hacia abajo,
			     compartiendo escala para comparar al vuelo. -->
			<section class="chart">
				<div class="chart-head">
					<h3>Récords batidos por periodo</h3>
					<div class="chart-legend">
						<span class="lg">
							<span class="sw" style:background={COLOR_MAX}></span>
							Máxima
						</span>
						<span class="lg">
							<span class="sw" style:background={COLOR_MIN}></span>
							Mínima
						</span>
					</div>
				</div>
				<svg
					bind:clientWidth={svgWidth}
					viewBox="0 0 {svgWidth} {HEIGHT}"
					height={HEIGHT}
					preserveAspectRatio="none"
					role="img"
					aria-label="Récords batidos por periodo: máxima hacia arriba, mínima hacia abajo"
				>
					{#if geom}
						<!-- Rejilla y ejes: ticks simétricos arriba/abajo; línea cero al centro. -->
						{#each tickRec as t (t)}
							{#if t === 0}
								<line
									x1={MARGIN.left}
									x2={MARGIN.left + geom.w}
									y1={geom.cy}
									y2={geom.cy}
									stroke="#d9d9d9"
								/>
								<text
									x={MARGIN.left - 6}
									y={geom.cy}
									text-anchor="end"
									dominant-baseline="middle"
									class="tick"
								>
									0
								</text>
							{:else}
								<line
									x1={MARGIN.left}
									x2={MARGIN.left + geom.w}
									y1={yUp(geom, t)}
									y2={yUp(geom, t)}
									stroke="#eee"
								/>
								<text
									x={MARGIN.left - 6}
									y={yUp(geom, t)}
									text-anchor="end"
									dominant-baseline="middle"
									class="tick"
								>
									{t.toLocaleString("es-ES")}
								</text>
								<line
									x1={MARGIN.left}
									x2={MARGIN.left + geom.w}
									y1={yDown(geom, t)}
									y2={yDown(geom, t)}
									stroke="#eee"
								/>
								<text
									x={MARGIN.left - 6}
									y={yDown(geom, t)}
									text-anchor="end"
									dominant-baseline="middle"
									class="tick"
								>
									{t.toLocaleString("es-ES")}
								</text>
							{/if}
						{/each}
						<!-- Barras divergentes + zona de hover por periodo. -->
						{#each data as d, i (d.label)}
							{@const x = xFor(geom, i) - geom.barW / 2}
							{@const yTopMax = yUp(geom, d.recordsMax)}
							{@const yBotMin = yDown(geom, d.recordsMin)}
							<g
								onmouseenter={() => (hoverIdx = i)}
								onmouseleave={() => (hoverIdx = -1)}
								role="presentation"
							>
								<rect {x} y={MARGIN.top} width={geom.barW} height={geom.h} fill="transparent" />
								<rect
									{x}
									y={yTopMax}
									width={geom.barW}
									height={Math.max(0, geom.cy - yTopMax)}
									fill={COLOR_MAX}
									opacity={hoverIdx === i ? 1 : 0.85}
								/>
								<rect
									{x}
									y={geom.cy}
									width={geom.barW}
									height={Math.max(0, yBotMin - geom.cy)}
									fill={COLOR_MIN}
									opacity={hoverIdx === i ? 1 : 0.85}
								/>
							</g>
						{/each}
						<!-- Etiquetas del eje X, en la base. -->
						{#each data as d, i (d.label)}
							{@const step = everyN(data.length)}
							{#if vista === "mensual" || i % step === 0 || i === data.length - 1}
								<text
									x={xFor(geom, i)}
									y={MARGIN.top + geom.h + 16}
									text-anchor="middle"
									class="tick"
								>
									{d.label}
								</text>
							{/if}
						{/each}
					{/if}
				</svg>
			</section>

			<p class="legend small muted">
				Máxima y mínima comparten escala (máxima hacia arriba, mínima hacia abajo) para comparar al
				vuelo. Pasa el ratón por un periodo para ver el desglose, incluido el porcentaje de
				estaciones que batieron récord.
			</p>

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

	/* --- Resumen + tooltip ------------------------------------------- */
	.summary {
		margin: 0 0 0.75rem;
		font-size: 0.92rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.summary strong {
		color: var(--ink);
	}
	.info {
		min-height: 1.7em;
		margin: 0.25rem 0 0.7rem;
	}
	.tooltip {
		margin: 0;
		font-size: 0.88rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.45rem;
		align-items: baseline;
		font-variant-numeric: tabular-nums;
	}
	.tooltip strong {
		color: var(--ink);
	}
	.tip-sep {
		color: var(--faint);
	}
	.tip-max {
		color: color-mix(in srgb, var(--max) 85%, black);
		font-weight: 600;
	}
	.tip-min {
		color: color-mix(in srgb, var(--min) 80%, black);
		font-weight: 600;
	}

	/* --- Gráfica divergente única ------------------------------------ */
	.chart {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 1.1rem 1.2rem 1.2rem;
	}
	.chart-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.4rem 1rem;
		margin: 0 0 0.7rem;
	}
	.chart h3 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--ink);
	}
	.chart-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.9rem;
	}
	.lg {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		color: var(--muted);
	}
	.sw {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	.chart svg {
		display: block;
		width: 100%;
		background: color-mix(in srgb, var(--bg) 55%, var(--surface));
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
	}
	.tick {
		font-size: 10px;
		fill: var(--faint);
		font-variant-numeric: tabular-nums;
	}

	/* --- Notas -------------------------------------------------------- */
	.legend {
		margin: 1.25rem 0 0;
		line-height: 1.55;
	}
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
