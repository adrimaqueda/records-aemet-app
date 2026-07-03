<!--
@component
RecordsChart.svelte — gráfica divergente de récords por periodo para /datos.

Recibe las filas ya decoradas (`data`) y las pinta como barras divergentes:
máxima hacia arriba, mínima hacia abajo, compartiendo escala. Cuando no caben
todas las barras al ancho mínimo (`minBand`, mayor en escritorio), el área de
barras se desplaza horizontalmente y aparece un minimapa navegable que resalta
el tramo visible. El eje Y vive en una canaleta fija (AX) que no se desplaza.

Props:
  · data          — filas `{ label, labelLong, recordsMax, recordsMin, ... }`.
  · vista         — 'anual' | 'mensual' (en mensual se etiquetan los 12 meses).
  · modoEstacion  — true cuando la gráfica muestra una sola estación (cambia la
                    nota y oculta el % de estaciones del tooltip).
-->
<script>
	import { scaleBand, scaleLinear } from "d3-scale";
	import { max, ticks } from "d3-array";
	import { isMobile } from "$lib/utils/viewport.svelte.js";

	let { data, vista, modoEstacion = false } = $props();

	let hoverIdx = $state(-1);
	// Scroll horizontal + minimapa (cuando no caben todas las barras).
	let scroller = $state(null); // contenedor con scroll (bind:this)
	let scrollVW = $state(0); // ancho visible del área de barras
	let scrollLeft = $state(0); // desplazamiento horizontal actual
	let dragging = false; // arrastrando la ventana del minimapa
	let lastSig = ""; // firma del dataset ya encuadrado
	let wasScrollable = false;

	// Colores (consistentes con el mapa y los tokens --max / --min).
	const COLOR_MAX = "hsl(8 82% 50%)";
	const COLOR_MIN = "hsl(34 88% 47%)";

	// --- geometría de la gráfica SVG ------------------------------------
	// El eje Y vive en una canaleta fija (AX) a la izquierda; el área de barras
	// va en un contenedor con scroll horizontal cuando no caben todas.
	const MARGIN = { top: 18, right: 12, bottom: 28 };
	const AX = 46; // ancho de la canaleta del eje Y (fija, no se desplaza)
	const HEIGHT = 320;
	const MINI_H = 46; // alto del minimapa
	// Ancho mínimo por barra (px) antes de activar el scroll + minimapa. En
	// escritorio es mayor: así la serie anual completa (100+ años) también
	// desborda y estrena el visor ahí, con barras más legibles; su ventana
	// visible cubre más años que la de móvil.
	const minBand = $derived(isMobile.current ? 8 : 16);

	// Coordenadas locales del área de barras: x arranca en 0 (la canaleta del
	// eje va aparte), así el mismo dibujo sirve con y sin scroll.
	function chartGeom(data, plotW) {
		if (!plotW || data.length === 0) return null;
		const w = Math.max(0, plotW - MARGIN.right);
		const h = HEIGHT - MARGIN.top - MARGIN.bottom;
		const halfH = h / 2;
		const cy = MARGIN.top + halfH; // línea cero (centro)
		// Escala compartida entre máxima y mínima → comparación justa.
		const maxRec = Math.max(
			1,
			max(data, (d) => Math.max(d.recordsMax, d.recordsMin)),
		);

		// X: escala de banda (una banda por periodo); d3 reparte ancho y separación.
		const x = scaleBand()
			.domain(data.map((d) => d.label))
			.range([0, w])
			.paddingInner(data.length > 30 ? 0.08 : 0.18);
		// Y (magnitud): 0 en el centro, maxRec en cada extremo. La misma escala
		// sirve para máxima (hacia arriba) y mínima (hacia abajo).
		const yMag = scaleLinear().domain([0, maxRec]).range([0, halfH]);

		return { w, h, maxRec, halfH, cy, x, yMag, barW: x.bandwidth() };
	}

	// Geometría compacta del minimapa: la silueta completa sin ejes ni relleno,
	// escalada a todo el ancho visible (nunca se desplaza).
	function miniGeom(data, width) {
		if (!width || data.length === 0) return null;
		const cy = MINI_H / 2;
		const maxRec = Math.max(
			1,
			max(data, (d) => Math.max(d.recordsMax, d.recordsMin)),
		);
		const x = scaleBand()
			.domain(data.map((d) => d.label))
			.range([0, width])
			.paddingInner(0.12);
		const yMag = scaleLinear()
			.domain([0, maxRec])
			.range([0, cy - 2]);
		return { cy, x, yMag, barW: x.bandwidth() };
	}

	/** Y para un valor de máxima (por encima del centro). */
	function yUp(g, v) {
		return g.cy - g.yMag(v);
	}
	/** Y para un valor de mínima (por debajo del centro). */
	function yDown(g, v) {
		return g.cy + g.yMag(v);
	}

	function fmtPct(p) {
		return `${p.toFixed(p < 10 ? 1 : 0)}%`;
	}

	// --- derivaciones reactivas -----------------------------------------
	// Ancho del área de barras: el visible, o el mínimo para que cada barra
	// tenga minBand px (en cuyo caso aparece scroll horizontal + minimapa).
	const contentPlotW = $derived(Math.max(scrollVW, data.length * minBand + MARGIN.right));
	const needsScroll = $derived(contentPlotW > scrollVW + 1);
	const geom = $derived(chartGeom(data, contentPlotW));
	const miniG = $derived(needsScroll ? miniGeom(data, scrollVW) : null);
	// Ventana resaltada del minimapa = porción del gráfico actualmente visible.
	const win = $derived.by(() => {
		if (!needsScroll || !scrollVW || !contentPlotW) return null;
		return {
			x: (scrollLeft / contentPlotW) * scrollVW,
			w: (scrollVW / contentPlotW) * scrollVW,
		};
	});
	// Densidad de etiquetas X según el ancho real por barra (~48px por etiqueta).
	const labelStep = $derived.by(() => {
		if (!geom || data.length === 0) return 1;
		return Math.max(1, Math.ceil(48 / (geom.w / data.length)));
	});
	// Marcas del eje en valores redondos dentro de [0, maxRec]. Filtramos a
	// enteros porque son recuentos de récords (sin decimales).
	const tickRec = $derived(geom ? ticks(0, geom.maxRec, 4).filter(Number.isInteger) : []);

	// Al cambiar la forma del dataset (vista, rango de años o nº de barras) o al
	// pasar a modo scroll, encuadra el tramo más reciente (extremo derecho).
	$effect(() => {
		const sig = `${vista}|${data.length}|${data[0]?.label ?? ""}|${data[data.length - 1]?.label ?? ""}`;
		const ns = needsScroll;
		const cw = contentPlotW;
		if (!scroller || !scrollVW) return;
		const changed = sig !== lastSig;
		const became = ns && !wasScrollable;
		lastSig = sig;
		wasScrollable = ns;
		// El dataset cambió: el índice hover apuntaría a otra barra.
		if (changed) hoverIdx = -1;
		if (ns && (changed || became)) {
			scroller.scrollLeft = cw; // el navegador lo recorta al máximo
			scrollLeft = scroller.scrollLeft;
		}
	});

	function onScroll() {
		if (scroller) scrollLeft = scroller.scrollLeft;
	}

	// Arrastrar/clicar el minimapa desplaza el gráfico principal (centra la
	// ventana en el punto señalado).
	function miniSeek(clientX, svgEl) {
		if (!scroller) return;
		const r = svgEl.getBoundingClientRect();
		const frac = (clientX - r.left) / r.width;
		const target = frac * contentPlotW - scrollVW / 2;
		scroller.scrollLeft = Math.max(0, Math.min(contentPlotW - scrollVW, target));
		scrollLeft = scroller.scrollLeft;
	}
	function onMiniDown(e) {
		dragging = true;
		e.currentTarget.setPointerCapture?.(e.pointerId);
		miniSeek(e.clientX, e.currentTarget);
	}
	function onMiniMove(e) {
		if (dragging) miniSeek(e.clientX, e.currentTarget);
	}
	function onMiniUp(e) {
		dragging = false;
		e.currentTarget.releasePointerCapture?.(e.pointerId);
	}
	function onMiniKey(e) {
		if (!scroller) return;
		const stepPx = scrollVW * 0.25;
		if (e.key === "ArrowLeft") {
			scroller.scrollLeft -= stepPx;
			scrollLeft = scroller.scrollLeft;
			e.preventDefault();
		} else if (e.key === "ArrowRight") {
			scroller.scrollLeft += stepPx;
			scrollLeft = scroller.scrollLeft;
			e.preventDefault();
		}
	}
</script>

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
		<p class="muted small" style="margin: 0;">Pasa el ratón sobre una barra para ver el detalle.</p>
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
	<div class="chart-body">
		<!-- Canaleta fija del eje Y: no se desplaza con el scroll. -->
		<svg class="y-axis" width={AX} height={HEIGHT} viewBox="0 0 {AX} {HEIGHT}" aria-hidden="true">
			{#if geom}
				{#each tickRec as t (t)}
					{#if t === 0}
						<text x={AX - 6} y={geom.cy} text-anchor="end" dominant-baseline="middle" class="tick">
							0
						</text>
					{:else}
						<text
							x={AX - 6}
							y={yUp(geom, t)}
							text-anchor="end"
							dominant-baseline="middle"
							class="tick"
						>
							{t.toLocaleString("es-ES")}
						</text>
						<text
							x={AX - 6}
							y={yDown(geom, t)}
							text-anchor="end"
							dominant-baseline="middle"
							class="tick"
						>
							{t.toLocaleString("es-ES")}
						</text>
					{/if}
				{/each}
			{/if}
		</svg>

		<!-- Área de barras: se desplaza horizontalmente si no caben todas. -->
		<div class="chart-scroll" bind:this={scroller} bind:clientWidth={scrollVW} onscroll={onScroll}>
			<svg
				width={contentPlotW}
				height={HEIGHT}
				viewBox="0 0 {contentPlotW} {HEIGHT}"
				preserveAspectRatio="none"
				role="img"
				aria-label="Récords batidos por periodo: máxima hacia arriba, mínima hacia abajo"
			>
				{#if geom}
					<!-- Rejilla: ticks simétricos arriba/abajo; línea cero al centro. -->
					{#each tickRec as t (t)}
						{#if t === 0}
							<line x1={0} x2={geom.w} y1={geom.cy} y2={geom.cy} stroke="#d9d9d9" />
						{:else}
							<line x1={0} x2={geom.w} y1={yUp(geom, t)} y2={yUp(geom, t)} stroke="#eee" />
							<line x1={0} x2={geom.w} y1={yDown(geom, t)} y2={yDown(geom, t)} stroke="#eee" />
						{/if}
					{/each}
					<!-- Barras divergentes + zona de hover por periodo. -->
					{#each data as d, i (d.label)}
						{@const x = geom.x(d.label)}
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
					<!-- Etiquetas del eje X, en la base. La última siempre se muestra;
					     las regulares se saltan si caen demasiado cerca de ella. -->
					{#each data as d, i (d.label)}
						{#if vista === "mensual" || i === data.length - 1 || (i % labelStep === 0 && data.length - 1 - i >= labelStep)}
							<text
								x={geom.x(d.label) + geom.barW / 2}
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
		</div>
	</div>

	<!-- Minimapa: silueta completa + ventana de lo que se está viendo.
	     Se puede arrastrar para recorrer el gráfico principal. -->
	{#if needsScroll && miniG}
		<div class="mini-row">
			<div class="mini-gutter" style:width="{AX}px"></div>
			<svg
				class="minimap"
				viewBox="0 0 {scrollVW} {MINI_H}"
				height={MINI_H}
				preserveAspectRatio="none"
				role="slider"
				tabindex="0"
				aria-label="Desplazar la gráfica por el tiempo"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={contentPlotW > scrollVW
					? Math.round((scrollLeft / (contentPlotW - scrollVW)) * 100)
					: 0}
				onpointerdown={onMiniDown}
				onpointermove={onMiniMove}
				onpointerup={onMiniUp}
				onpointercancel={onMiniUp}
				onkeydown={onMiniKey}
			>
				<line x1={0} x2={scrollVW} y1={miniG.cy} y2={miniG.cy} stroke="#e2e2e2" />
				{#each data as d (d.label)}
					{@const mx = miniG.x(d.label)}
					<rect
						x={mx}
						y={miniG.cy - miniG.yMag(d.recordsMax)}
						width={miniG.barW}
						height={miniG.yMag(d.recordsMax)}
						fill={COLOR_MAX}
						opacity="0.5"
					/>
					<rect
						x={mx}
						y={miniG.cy}
						width={miniG.barW}
						height={miniG.yMag(d.recordsMin)}
						fill={COLOR_MIN}
						opacity="0.5"
					/>
				{/each}
				{#if win}
					<rect class="mini-win" x={win.x} y={0.5} width={win.w} height={MINI_H - 1} rx="3" />
				{/if}
			</svg>
		</div>
		<p class="chart-hint small muted">
			Desliza la gráfica o arrastra el minimapa para recorrer los años.
		</p>
	{/if}
</section>

<p class="legend small muted">
	Máxima y mínima comparten escala (máxima hacia arriba, mínima hacia abajo) para comparar al vuelo.
	{#if modoEstacion}
		Cada barra es el número de récords (absolutos y mensuales) que batió esta estación en ese
		periodo.
	{:else}
		Pasa el ratón por un periodo para ver el desglose, incluido el porcentaje de estaciones que
		batieron récord.
	{/if}
</p>

<style>
	/* --- Tooltip ------------------------------------------------------ */
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

	/* --- Gráfica divergente ------------------------------------------- */
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
	/* Caja del gráfico: canaleta del eje Y fija + área de barras con scroll. */
	.chart-body {
		display: flex;
		align-items: stretch;
		background: color-mix(in srgb, var(--bg) 55%, var(--surface));
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.y-axis {
		flex: none;
		display: block;
	}
	.chart-scroll {
		flex: 1 1 auto;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		touch-action: pan-x;
		overscroll-behavior-x: contain;
	}
	.chart-scroll svg {
		display: block;
	}
	.chart-scroll::-webkit-scrollbar {
		height: 8px;
	}
	.chart-scroll::-webkit-scrollbar-thumb {
		background: color-mix(in srgb, var(--muted) 35%, transparent);
		border-radius: 999px;
	}
	.chart-scroll::-webkit-scrollbar-track {
		background: transparent;
	}
	/* Minimapa navegable (alineado con el área de barras). */
	.mini-row {
		display: flex;
		align-items: stretch;
		margin-top: 0.5rem;
	}
	.mini-gutter {
		flex: none;
	}
	.minimap {
		flex: 1 1 auto;
		min-width: 0;
		display: block;
		height: 46px;
		background: color-mix(in srgb, var(--bg) 55%, var(--surface));
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		cursor: grab;
		touch-action: none;
	}
	.minimap:active {
		cursor: grabbing;
	}
	.minimap:focus-visible {
		outline: 2px solid var(--max);
		outline-offset: 2px;
	}
	.mini-win {
		fill: color-mix(in srgb, var(--ink) 12%, transparent);
		stroke: color-mix(in srgb, var(--ink) 55%, transparent);
		stroke-width: 1.5;
	}
	.chart-hint {
		margin: 0.5rem 0 0;
	}
	.tick {
		font-size: 10px;
		fill: var(--faint);
		font-variant-numeric: tabular-nums;
	}

	/* --- Nota --------------------------------------------------------- */
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
</style>
