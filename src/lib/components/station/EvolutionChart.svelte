<!--
@component
EvolutionChart.svelte — gráfico de área escalonada de UNA serie de récords.

Recibe los eventos ya filtrados de una familia ("max"/"min") y dibuja el SVG:
escalera de récords (cada peldaño es una nueva marca), bandas de "sin datos" y
los puntos coloreados por antigüedad. Encima, una línea de info que muestra el
último récord o el punto bajo el cursor.

Mide su propio ancho (`svgWidth`), así que cada instancia es independiente.
La geometría se calcula con d3 (escalas + generadores de path); el render lo
hace Svelte.
-->
<script>
	import { fmtDate, fmtTemp } from "$lib/utils/format.js";
	import { ageDurationLabel, ageLongLabel, daysSince } from "$lib/utils/age.js";
	import { colorForDays } from "$lib/utils/colors.js";
	import { isMobile } from "$lib/utils/viewport.svelte.js";
	import ProvisionalTag from "$lib/components/ui/ProvisionalTag.svelte";
	import { scaleLinear, scaleTime } from "d3-scale";
	import { extent } from "d3-array";
	import { area as d3area, curveStepAfter, line as d3line } from "d3-shape";

	/** @type {{ events: any[], fam: "max" | "min", sinDatos?: any[] }} */
	let { events, fam, sinDatos = [] } = $props();

	// SVG sin viewBox: medimos el ancho real en píxeles para que el tamaño del
	// texto lo controle el CSS. Cada gráfico tiene su propio ancho.
	let svgWidth = $state(0);
	let hovered = $state(-1);

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

	const FAMILY_COLOR = {
		max: { stroke: "hsl(10 80% 48%)", fill: "hsl(10 80% 48% / 0.18)", dot: "rgb(220, 57, 24)" },
		min: { stroke: "hsl(35 80% 50%)", fill: "hsl(35 80% 50% / 0.18)", dot: "rgb(230, 145, 26)" },
	};

	/** Geometría del gráfico: escalas, paths e hitos a partir de los eventos. */
	function buildChart(events, fam, width, height, sinDatos) {
		if (events.length === 0 || width <= 0) return null;
		const asc = [...events].sort((a, b) => a.fecha.localeCompare(b.fecha));
		const firstFecha = asc[0].fecha;

		const first = new Date(asc[0].fecha);
		// Dominio temporal con un mínimo de 1 día (evita una escala degenerada
		// si el único récord es de hoy).
		const last = TODAY - first >= 86400000 ? TODAY : new Date(+first + 86400000);

		const [yMin, yMax] = extent(asc, (e) => e.valor);
		const yPad = (yMax - yMin || 1) * 0.18;
		const yLo = yMin - yPad;
		const yHi = yMax + yPad;

		const innerW = width - PAD.left - PAD.right;
		const innerH = height - PAD.top - PAD.bottom;
		const baseline = PAD.top + innerH;
		const rightEdge = PAD.left + innerW;

		// Escala temporal en X, lineal en Y (invertida: mayor valor → más arriba).
		const x = scaleTime().domain([first, last]).range([PAD.left, rightEdge]);
		const y = scaleLinear().domain([yLo, yHi]).range([baseline, PAD.top]);

		const valRange = yMax - yMin || 1;
		const dot = FAMILY_COLOR[fam].dot;
		const pts = asc.map((e) => ({
			...e,
			x: x(new Date(e.fecha)),
			y: y(e.valor),
			esPrimero: e.fecha === firstFecha,
			color: dot,
			// Para las barras de la lista: posición del valor dentro del rango
			// de la serie, con un mínimo del 6% para que siempre se vea algo.
			pct: 6 + ((e.valor - yMin) / valRange) * 94,
			barColor: colorForDays(fam === "max", daysSince(e.fecha)),
		}));

		// Bandas de "sin datos": tramos de cobertura ausente (≥7 días) que el
		// pipeline publica en `sinDatos`. Se recortan al dominio visible.
		const gaps = (sinDatos ?? [])
			.map((g) => {
				const x1 = Math.max(PAD.left, x(new Date(g.desde)));
				const x2 = Math.min(rightEdge, x(new Date(g.hasta)));
				return { ...g, x1, x2 };
			})
			.filter((g) => g.x2 - g.x1 > 0.5);

		// Serie para los generadores: puntos reales + uno sintético en el borde
		// derecho (con el último valor) para prolongar el escalón hasta "hoy".
		const series = [
			...asc.map((e) => ({ t: new Date(e.fecha), v: e.valor })),
			{ t: last, v: asc[asc.length - 1].valor },
		];
		// curveStepAfter: mantiene la y previa hasta la nueva x y entonces sube,
		// igual que el escalón clásico.
		const line = d3line()
			.x((d) => x(d.t))
			.y((d) => y(d.v))
			.curve(curveStepAfter)(series);
		const area = d3area()
			.x((d) => x(d.t))
			.y0(baseline)
			.y1((d) => y(d.v))
			.curve(curveStepAfter)(series);

		// Ticks Y: arriba y abajo del rango real (yMax/yMin), no del padding.
		const yLabels = [
			{ value: yMax, y: y(yMax) },
			{ value: yMin, y: y(yMin) },
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

		return { line, area, points: pts, gaps, baseline, rightEdge, yLabels, yearTicks };
	}

	const chart = $derived(buildChart(events, fam, svgWidth, HEIGHT, sinDatos));
	const fc = $derived(FAMILY_COLOR[fam]);
	// Último récord de la serie (para el resumen por defecto de la línea de info).
	const latest = $derived(
		events.length ? events.reduce((a, b) => (b.fecha > a.fecha ? b : a)) : null,
	);
</script>

<!-- Línea de info ENCIMA del chart: cambia al hover/focus de un punto. -->
<div class="info">
	{#if chart && hovered >= 0}
		{@const p = chart.points[hovered]}
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
	{:else if latest}
		<p class="meta">
			<span class="meta-label">Último récord</span>
			<strong>{fmtTemp(latest.valor)}</strong>
			<span class="muted">· {fmtDate(latest.fecha)}</span>
			{#if latest.provisional}<ProvisionalTag />{/if}
			<span class="muted">· {ageLongLabel(daysSince(latest.fecha))}</span>
			{#if latest.valorAnterior != null}
				<span class="muted">
					— {latest.valor > latest.valorAnterior ? "+" : "−"}{Math.abs(
						latest.valor - latest.valorAnterior,
					).toFixed(1)}°C sobre {fmtTemp(latest.valorAnterior)}
				</span>
			{/if}
		</p>
	{/if}
</div>

<svg bind:clientWidth={svgWidth} width="100%" height={HEIGHT} role="img" aria-label="Evolución del récord">
	{#if chart}
		<!-- Tramos sin cobertura: rayado diagonal tenue, como capa inferior. -->
		<defs>
			<pattern
				id="nodata-{fam}"
				width="6"
				height="6"
				patternUnits="userSpaceOnUse"
				patternTransform="rotate(45)"
			>
				<rect width="6" height="6" fill="#000" opacity="0.03" />
				<line x1="0" y1="0" x2="0" y2="6" stroke="#9a9a9a" stroke-width="1" opacity="0.28" />
			</pattern>
		</defs>
		{#each chart.gaps as g (g.desde)}
			<rect x={g.x1} y={PAD.top} width={g.x2 - g.x1} height={chart.baseline - PAD.top} fill="url(#nodata-{fam})">
				<title>Sin datos · {g.dias} días ({fmtDate(g.desde)} – {fmtDate(g.hasta)})</title>
			</rect>
		{/each}

		<!-- Cuadrícula horizontal en los valores extremos -->
		{#each chart.yLabels as l (l.value)}
			<line x1={PAD.left} x2={chart.rightEdge} y1={l.y} y2={l.y} stroke="#ddd" stroke-dasharray="2 3" />
			<text x={PAD.left - 6} y={l.y} class="axis axis-y" text-anchor="end" dominant-baseline="middle">
				{l.value.toFixed(1)}°
			</text>
		{/each}

		<!-- Área + línea escalonadas -->
		<path d={chart.area} fill={fc.fill} />
		<path d={chart.line} stroke={fc.stroke} class="line" fill="none" />

		<!-- Puntos en cada esquina (cuando se batió el récord) -->
		{#each chart.points as p, i (p.fecha)}
			<circle
				cx={p.x}
				cy={p.y}
				r={hovered === i ? POINT_R_HOVER : POINT_R}
				fill={p.provisional ? "#fff" : p.color}
				stroke={p.provisional ? p.color : "#fff"}
				stroke-width={p.provisional ? 2 : 1}
				onmouseenter={() => (hovered = i)}
				onmouseleave={() => (hovered = -1)}
				onfocus={() => (hovered = i)}
				onblur={() => (hovered = -1)}
				tabindex="0"
				role="button"
				aria-label="{fmtDate(p.fecha)}: {fmtTemp(p.valor)}"
			></circle>
		{/each}

		<!-- Eje X: años -->
		{#each chart.yearTicks as t (t.label)}
			<text x={t.x} y={HEIGHT - 8} class="axis axis-x" text-anchor={t.x === PAD.left ? "start" : "end"}>
				{t.label}
			</text>
		{/each}
	{/if}
</svg>

<style>
	/* Línea de info con altura reservada para que no salte el layout al cambiar
	   entre el tooltip de un punto y el resumen general. */
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
	.tooltip strong,
	.meta strong {
		font-size: 1.1em;
		font-weight: 700;
	}
	.muted {
		color: var(--muted);
	}
	.meta-label {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--faint);
		margin-right: 0.15rem;
	}
	.info :global(.prov) {
		margin-left: 5px;
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
</style>
