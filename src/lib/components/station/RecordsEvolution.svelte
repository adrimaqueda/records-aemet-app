<!--
@component
RecordsEvolution.svelte — gráfico de área con escalones que muestra cómo se ha
ido superando el récord a lo largo del tiempo.

Dos bloques apilados: primero máxima (día más caluroso), luego mínima (noche
más cálida). En cada uno, un selector permite elegir entre el récord absoluto
o el récord de un mes concreto.

El eje X es tiempo (desde el primer récord conocido hasta hoy), el eje Y es la
temperatura. Cada nuevo récord es un escalón hacia arriba. El área bajo la curva
queda rellena con el color de la familia; cada esquina del escalón lleva un dot
coloreado por la recencia de ese récord (misma paleta que el mapa).
-->
<script>
	import { fmtDate, fmtTemp, MESES } from "$lib/utils/format.js";
	import { ageDurationLabel, ageLongLabel, daysSince } from "$lib/utils/age.js";
	import { colorForDays } from "$lib/utils/colors.js";
	import { isMobile } from "$lib/utils/viewport.svelte.js";
	import ProvisionalTag from "$lib/components/ui/ProvisionalTag.svelte";

	let { detail } = $props();

	let maxSel = $state("absoluto");
	let minSel = $state("absoluto");

	// SVG sin viewBox: usamos coordenadas en píxeles reales medidos del
	// contenedor. Así los tamaños de texto los controla el CSS y no hay que
	// compensar el factor de escala del SVG en móvil.
	let svgWidth = $state(0);
	const HEIGHT = $derived(isMobile.current ? 280 : 200);
	const PAD = $derived({
		top: 12,
		right: 10,
		bottom: isMobile.current ? 30 : 24,
		left: isMobile.current ? 46 : 40,
	});
	const POINT_R = 4;
	const POINT_R_HOVER = 7;
	const TODAY = new Date();

	/** Filtra los eventos para una familia y selección. */
	function filter(fam, sel) {
		const tipoAbs = fam === "max" ? "absoluto-max" : "absoluto-min";
		const tipoMes = fam === "max" ? "mensual-max" : "mensual-min";
		if (sel === "absoluto") {
			return detail.eventos.filter((e) => e.tipo === tipoAbs);
		}
		const mes = Number(sel);
		return detail.eventos.filter((e) => e.tipo === tipoMes && e.mes === mes);
	}

	/** Calcula geometría del gráfico para un conjunto de eventos. */
	function buildChart(events, fam, width, height) {
		if (events.length === 0 || width <= 0) return null;
		const asc = [...events].sort((a, b) => a.fecha.localeCompare(b.fecha));

		const first = new Date(asc[0].fecha);
		const last = TODAY;
		const xDomain = Math.max(last - first, 86400000); // ≥1 día

		const vals = asc.map((e) => e.valor);
		const yMin = Math.min(...vals);
		const yMax = Math.max(...vals);
		const yPad = (yMax - yMin || 1) * 0.18;
		const yLo = yMin - yPad;
		const yHi = yMax + yPad;
		const ySpan = yHi - yLo;

		const innerW = width - PAD.left - PAD.right;
		const innerH = height - PAD.top - PAD.bottom;
		const baseline = PAD.top + innerH;
		const rightEdge = PAD.left + innerW;

		const xOf = (date) =>
			PAD.left + ((new Date(date) - first) / xDomain) * innerW;
		const yOf = (v) => PAD.top + ((yHi - v) / ySpan) * innerH;

		const valRange = yMax - yMin || 1;
		const pts = asc.map((e) => ({
			...e,
			x: xOf(e.fecha),
			y: yOf(e.valor),
			color: fam === "max" ? "rgb(220, 57, 24)" : "rgb(230, 145, 26)",
			// Para las barras de la lista: posición del valor dentro del rango
			// de la serie, con un mínimo del 6% para que siempre se vea algo;
			// y color por recencia (mismo gradiente que el marcador del mapa).
			pct: 6 + ((e.valor - yMin) / valRange) * 94,
			barColor: colorForDays(fam === "max", daysSince(e.fecha)),
		}));

		// Camino escalonado para línea + área.
		let line = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
		for (let i = 1; i < pts.length; i++) {
			const prev = pts[i - 1];
			const p = pts[i];
			line += ` L ${p.x.toFixed(2)} ${prev.y.toFixed(2)} L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
		}
		const lastY = pts[pts.length - 1].y;
		line += ` L ${rightEdge.toFixed(2)} ${lastY.toFixed(2)}`;
		const area =
			`M ${pts[0].x.toFixed(2)} ${baseline.toFixed(2)} ` +
			`L ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} ` +
			line.slice(line.indexOf("L")) +
			` L ${rightEdge.toFixed(2)} ${baseline.toFixed(2)} Z`;

		// Ticks Y: arriba y abajo del rango real (yMax/yMin), no del padding.
		const yLabels = [
			{ value: yMax, y: yOf(yMax) },
			{ value: yMin, y: yOf(yMin) },
		];
		// Ticks X: primer año y año actual.
		const firstYear = first.getFullYear();
		const lastYear = last.getFullYear();
		const yearTicks =
			firstYear === lastYear
				? [{ label: firstYear, x: PAD.left }]
				: [
						{ label: firstYear, x: PAD.left },
						{ label: lastYear, x: rightEdge },
					];

		return {
			line,
			area,
			points: pts,
			baseline,
			rightEdge,
			yLabels,
			yearTicks,
			fam,
		};
	}

	const FAMILY_COLOR = {
		max: { stroke: "hsl(10 80% 48%)", fill: "hsl(10 80% 48% / 0.18)" },
		min: { stroke: "hsl(35 80% 50%)", fill: "hsl(35 80% 50% / 0.18)" },
	};

	/** Lista de récords (orden DESC, más reciente primero) decorada con pct +
	 *  color por recencia. Independiente del ancho del SVG. */
	function decorateList(events, fam) {
		if (events.length === 0) return [];
		const vals = events.map((e) => e.valor);
		const lo = Math.min(...vals);
		const hi = Math.max(...vals);
		const range = hi - lo || 1;
		return [...events]
			.sort((a, b) => b.fecha.localeCompare(a.fecha))
			.map((e) => ({
				...e,
				pct: 6 + ((e.valor - lo) / range) * 94,
				barColor: colorForDays(fam === "max", daysSince(e.fecha)),
			}));
	}

	const maxEvents = $derived(filter("max", maxSel));
	const minEvents = $derived(filter("min", minSel));
	const maxList = $derived(decorateList(maxEvents, "max"));
	const minList = $derived(decorateList(minEvents, "min"));
	const maxChart = $derived(buildChart(maxEvents, "max", svgWidth, HEIGHT));
	const minChart = $derived(buildChart(minEvents, "min", svgWidth, HEIGHT));

	const bloques = $derived([
		{
			id: "max",
			titulo: "Evolución de la máxima",
			subtitulo: "día más caluroso",
			getSel: () => maxSel,
			setSel: (v) => (maxSel = v),
			events: maxEvents,
			list: maxList,
			chart: maxChart,
			emptyAbs: "Sin récords absolutos de máxima batidos en esta estación.",
			emptyMes: (m) => `Sin récords de máxima de ${MESES[m]} todavía.`,
		},
		{
			id: "min",
			titulo: "Evolución de la mínima",
			subtitulo: "noche más cálida",
			getSel: () => minSel,
			setSel: (v) => (minSel = v),
			events: minEvents,
			list: minList,
			chart: minChart,
			emptyAbs: 'Sin récords de "noche más cálida" batidos en esta estación.',
			emptyMes: (m) =>
				`Sin récords de "noche más cálida" de ${MESES[m]} todavía.`,
		},
	]);

	let hovered = $state({ id: null, idx: -1 });

	// Plegable propio del listado: estado abierto/cerrado y altura natural de
	// cada lista (medida en vivo) para animar la apertura hasta su tamaño real.
	let listOpen = $state({ max: false, min: false });
	let fullH = $state({ max: 0, min: 0 });
</script>

<section class="evolution">
	<div class="section-head">
		<h2>Evolución de los récords</h2>
		<p class="caption">
			Cómo se ha ido superando cada récord a lo largo del tiempo. Cada escalón
			es una nueva marca; el color del punto indica su antigüedad.
		</p>
	</div>

	<div class="blocks">
		{#each bloques as b (b.id)}
			<article class="block">
				<header>
					<h3>
						{b.titulo}
						<span class="muted small">· {b.subtitulo}</span>
					</h3>
					<label class="picker">
						<span class="sr-only">Mostrar</span>
						<select
							value={b.getSel()}
							onchange={(e) => b.setSel(e.currentTarget.value)}
						>
							<option value="absoluto">Récord absoluto</option>
							{#each MESES.slice(1) as nombre, i (i)}
								<option value={String(i + 1)}>
									{nombre[0].toUpperCase() + nombre.slice(1)}
								</option>
							{/each}
						</select>
					</label>
				</header>

				{#if b.events.length > 0}
					{@const c = b.chart}
					{@const fc = FAMILY_COLOR[b.id]}

					<!-- Tooltip ENCIMA del chart: cambia al hover/focus de un punto. -->
					<div class="info">
						{#if c && hovered.id === b.id && hovered.idx >= 0}
							{@const p = c.points[hovered.idx]}
							<p class="tooltip">
								<strong>{fmtTemp(p.valor)}</strong>
								· {fmtDate(p.fecha)}{#if p.provisional}<ProvisionalTag />{/if}
								{#if p.valorAnterior != null}
									<span class="muted">
										— {p.valor > p.valorAnterior ? "+" : "−"}{Math.abs(
											p.valor - p.valorAnterior,
										).toFixed(1)}°C sobre {fmtTemp(p.valorAnterior)} ·
										{ageDurationLabel(p.diasDesdeAnterior)} después
									</span>
								{/if}
							</p>
						{:else if b.list.length > 0}
							{@const u = b.list[0]}
							<p class="meta">
								<span class="meta-label">Último récord</span>
								<strong>{fmtTemp(u.valor)}</strong>
								<span class="muted">· {fmtDate(u.fecha)}</span>
								{#if u.provisional}<ProvisionalTag />{/if}
								<span class="muted">· {ageLongLabel(daysSince(u.fecha))}</span>
								{#if u.valorAnterior != null}
									<span class="muted">
										— {u.valor > u.valorAnterior ? "+" : "−"}{Math.abs(
											u.valor - u.valorAnterior,
										).toFixed(1)}°C sobre {fmtTemp(u.valorAnterior)}
									</span>
								{/if}
							</p>
						{/if}
					</div>

					<svg
						bind:clientWidth={svgWidth}
						width="100%"
						height={HEIGHT}
						role="img"
						aria-label="Evolución del récord"
					>
						{#if c}
							<!-- Cuadrícula horizontal en los valores extremos -->
							{#each c.yLabels as l (l.value)}
								<line
									x1={PAD.left}
									x2={c.rightEdge}
									y1={l.y}
									y2={l.y}
									stroke="#ddd"
									stroke-dasharray="2 3"
								/>
								<text
									x={PAD.left - 6}
									y={l.y}
									class="axis axis-y"
									text-anchor="end"
									dominant-baseline="middle"
								>
									{l.value.toFixed(1)}°
								</text>
							{/each}

							<!-- Área + línea escalonadas -->
							<path d={c.area} fill={fc.fill} />
							<path d={c.line} stroke={fc.stroke} class="line" fill="none" />

							<!-- Puntos en cada esquina (cuando se batió el récord) -->
							{#each c.points as p, i (p.fecha)}
								<circle
									cx={p.x}
									cy={p.y}
									r={hovered.id === b.id && hovered.idx === i
										? POINT_R_HOVER
										: POINT_R}
									fill={p.provisional ? "#fff" : p.color}
									stroke={p.provisional ? p.color : "#fff"}
									stroke-width={p.provisional ? 2 : 1}
									onmouseenter={() => (hovered = { id: b.id, idx: i })}
									onmouseleave={() => (hovered = { id: null, idx: -1 })}
									onfocus={() => (hovered = { id: b.id, idx: i })}
									onblur={() => (hovered = { id: null, idx: -1 })}
									tabindex="0"
									role="button"
									aria-label="{fmtDate(p.fecha)}: {fmtTemp(p.valor)}"
								></circle>
							{/each}

							<!-- Eje X: años -->
							{#each c.yearTicks as t (t.label)}
								<text
									x={t.x}
									y={HEIGHT - 8}
									class="axis axis-x"
									text-anchor={t.x === PAD.left ? "start" : "end"}
								>
									{t.label}
								</text>
							{/each}
						{/if}
					</svg>

					<!-- Listado plegable con todos los récords de la serie.
				     Usa b.list (precalculado, no depende del ancho del SVG). -->
					<div class="lista" class:open={listOpen[b.id]}>
						<div class="lista-window" style:--full-h="{fullH[b.id]}px">
							<ul id="lista-{b.id}" bind:clientHeight={fullH[b.id]}>
								{#each b.list as p (p.fecha + p.tipo)}
									<li>
										<div class="li-top">
											<span class="li-date">
												{fmtDate(p.fecha)}{#if p.provisional}<ProvisionalTag
													/>{/if}
											</span>
											<span class="li-val">{fmtTemp(p.valor)}</span>
										</div>
										<div class="li-bar">
											<div
												class="li-bar-fill"
												style:width="{p.pct}%"
												style:background={p.barColor}
											></div>
										</div>
										<div class="li-meta muted small">
											{#if p.valorAnterior != null}
												{p.valor > p.valorAnterior ? "+" : "−"}{Math.abs(
													p.valor - p.valorAnterior,
												).toFixed(1)}°C sobre {fmtTemp(p.valorAnterior)} ·
												{ageDurationLabel(p.diasDesdeAnterior)} después
											{:else}
												Primer registro
											{/if}
										</div>
									</li>
								{/each}
							</ul>
						</div>
						<button
							type="button"
							class="lista-toggle"
							aria-expanded={listOpen[b.id]}
							aria-controls="lista-{b.id}"
							onclick={() => (listOpen[b.id] = !listOpen[b.id])}
						>
							<span class="lista-toggle-text">
								{listOpen[b.id]
									? "Ocultar el detalle"
									: `Ver los ${b.list.length} récords en detalle`}
							</span>
							<svg class="lista-arrow" viewBox="0 0 24 24" aria-hidden="true">
								<path d="M5 8.5 12 15.5 19 8.5" />
							</svg>
						</button>
					</div>
				{:else}
					<p class="muted small empty">
						{b.getSel() === "absoluto"
							? b.emptyAbs
							: b.emptyMes(Number(b.getSel()))}
					</p>
				{/if}
			</article>
		{/each}
	</div>
</section>

<style>
	.section-head {
		margin-bottom: 1.2rem;
	}
	.section-head h2 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--ink);
	}
	.caption {
		margin: 0.3rem 0 0;
		font-size: 0.82rem;
		line-height: 1.45;
		color: var(--faint);
		max-width: 60ch;
	}

	.blocks {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}
	.block {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 1.25rem 1.35rem 1.4rem;
		box-shadow: var(--shadow);
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.9rem;
	}
	h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.015em;
		color: var(--ink);
	}
	.muted {
		color: var(--muted);
	}
	.small {
		font-size: 0.78rem;
		font-weight: 400;
		color: var(--faint);
	}
	select {
		font: inherit;
		font-size: 0.82rem;
		padding: 0.4rem 1.8rem 0.4rem 0.7rem;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: var(--surface);
		color: var(--ink);
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236c6c70' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.65rem center;
		transition: border-color 0.15s ease;
	}
	select:hover {
		border-color: var(--muted);
	}
	svg {
		display: block;
		background: color-mix(in srgb, var(--bg) 55%, var(--surface));
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
	}
	.axis {
		fill: var(--faint);
		font-family: var(--font);
		font-size: 11px;
	}
	@media (max-width: 700px) {
		.axis {
			font-size: 13px;
		}
	}
	.line {
		stroke-width: 1.8;
		stroke-linejoin: round;
	}
	@media (max-width: 700px) {
		.line {
			stroke-width: 2.2;
		}
	}
	circle {
		cursor: pointer;
		transition: r 0.12s ease;
	}
	circle:focus {
		outline: 2px solid color-mix(in srgb, var(--max) 35%, white);
	}
	/* Bloque de info encima del chart con altura reservada para que no salte el
	   layout al cambiar entre tooltip de punto y resumen general. */
	.info {
		min-height: 2.6em;
		display: flex;
		align-items: flex-end;
		margin-bottom: 0.5rem;
	}
	.tooltip,
	.meta {
		margin: 0;
		font-size: 0.85rem;
		line-height: 1.35;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	:global {
		.block .prov {
			margin-left: 5px;
		}
	}

	.tooltip strong,
	.meta strong {
		font-size: 1.1em;
		font-weight: 700;
	}
	/* Etiqueta "Último récord" que encabeza el resumen por defecto. */
	.meta-label {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--faint);
		margin-right: 0.15rem;
	}

	/* Lista plegable con el detalle de cada récord (mismo contenido que el
	   tooltip pero recorrible). */
	.lista {
		position: relative;
		margin-top: 1rem;
		border-top: 1px solid var(--line);
		padding-top: 0.6rem;
	}

	/* Ventana que recorta el listado: cerrada deja asomar el primer récord y lo
	   difumina con un degradado; abierta crece hasta la altura real de la lista
	   (--full-h, medida en vivo) para una transición suave en ambos sentidos.
	   Reserva hueco abajo para el botón, que flota encima del difuminado. */
	.lista-window {
		position: relative;
		max-height: 6rem;
		overflow: hidden;
		padding-bottom: 2.6rem;
		transition: max-height 0.34s ease;
	}
	.lista.open .lista-window {
		max-height: calc(var(--full-h, 100rem) + 3rem);
	}
	.lista-window::after {
		content: "";
		position: absolute;
		inset: auto 0 0;
		height: 4rem;
		background: linear-gradient(to bottom, transparent, var(--surface) 75%);
		pointer-events: none;
		transition: opacity 0.3s ease;
	}
	.lista.open .lista-window::after {
		opacity: 0;
	}

	/* Botón anclado abajo, centrado, encima del degradado. */
	.lista-toggle {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.55rem 0 0.25rem;
		background: none;
		border: none;
		cursor: pointer;
		font: inherit;
		font-size: 0.84rem;
		font-weight: 600;
		color: var(--muted);
		transition: color 0.15s ease;
	}
	.lista-toggle:hover {
		color: var(--ink);
	}
	.lista-arrow {
		width: 20px;
		height: 20px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: transform 0.22s ease;
	}
	.lista.open .lista-arrow {
		transform: rotate(180deg);
	}

	.lista ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.lista li {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.4rem 0;
		border-top: 1px solid var(--line);
	}
	.lista li:first-child {
		border-top: none;
	}
	.li-top {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.86rem;
	}
	.li-date {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.li-val {
		font-weight: 700;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.li-bar {
		height: 6px;
		background: var(--line);
		border-radius: 999px;
		overflow: hidden;
	}
	.li-bar-fill {
		height: 100%;
		border-radius: 999px;
		transition: width 0.18s ease;
	}
	.li-meta {
		color: var(--faint);
		font-variant-numeric: tabular-nums;
	}
	.empty {
		margin: 0.4rem 0 0;
		padding: 1.5rem 0.8rem;
		background: color-mix(in srgb, var(--bg) 55%, var(--surface));
		border: 1px dashed var(--line-strong);
		border-radius: var(--radius-sm);
		text-align: center;
		color: var(--faint);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
