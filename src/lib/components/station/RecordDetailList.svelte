<!--
@component
RecordDetailList.svelte — listado plegable con el detalle de cada récord de una
serie (mismo contenido que el tooltip del gráfico, pero recorrible).

Cerrado deja asomar el primer récord difuminado; al abrir crece hasta la altura
real de la lista. Con un único récord se muestra entero, sin recorte ni botón.
Recibe los eventos en crudo y los decora (barra de posición + color por edad).
-->
<script>
	import { fmtDate, fmtNum, fmtTemp } from "$lib/utils/format.js";
	import { ageDurationLabel, daysSince } from "$lib/utils/age.js";
	import { colorForDays } from "$lib/utils/colors.js";
	import { extent } from "d3-array";
	import ProvisionalTag from "$lib/components/ui/ProvisionalTag.svelte";

	/** @type {{ events: any[], fam: "max" | "min", id: string }} */
	let { events, fam, id } = $props();

	let open = $state(false);
	let fullH = $state(0);

	/** Récords en orden DESC (más reciente primero), decorados con la barra de
	 *  posición dentro del rango y el color por antigüedad. */
	const list = $derived.by(() => {
		if (events.length === 0) return [];
		const [lo, hi] = extent(events, (e) => e.valor);
		const range = hi - lo || 1;
		// El más antiguo es el "primer registro"; el resto de marcas iniciales
		// (warm-up tras un hueco de datos) se etiquetan aparte.
		const firstFecha = events.reduce((m, e) => (e.fecha < m ? e.fecha : m), events[0].fecha);
		return [...events]
			.sort((a, b) => b.fecha.localeCompare(a.fecha))
			.map((e) => ({
				...e,
				esPrimero: e.fecha === firstFecha,
				pct: 6 + ((e.valor - lo) / range) * 94,
				barColor: colorForDays(fam === "max", daysSince(e.fecha)),
			}));
	});
</script>

<div class="lista" class:open class:single={list.length <= 1}>
	<div class="lista-window" style:--full-h="{fullH}px">
		<ul id="lista-{id}" bind:clientHeight={fullH}>
			{#each list as p (p.fecha + p.tipo)}
				<li>
					<div class="li-top">
						<span class="li-date">
							{fmtDate(p.fecha)}{#if p.provisional}<ProvisionalTag />{/if}
						</span>
						<span class="li-val">{fmtTemp(p.valor)}</span>
					</div>
					<div class="li-bar">
						<div class="li-bar-fill" style:width="{p.pct}%" style:background={p.barColor}></div>
					</div>
					<div class="li-meta muted small">
						{#if p.valorAnterior != null}
							{p.valor > p.valorAnterior ? "+" : "−"}{fmtNum(Math.abs(p.valor - p.valorAnterior))}°C
							sobre {fmtTemp(p.valorAnterior)} ·
							{ageDurationLabel(p.diasDesdeAnterior)} después
						{:else if p.esPrimero}
							Primer registro
						{:else}
							Marca inicial tras una interrupción de datos
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	</div>
	{#if list.length > 1}
		<button
			type="button"
			class="lista-toggle"
			aria-expanded={open}
			aria-controls="lista-{id}"
			onclick={() => (open = !open)}
		>
			<span class="lista-toggle-text">
				{open ? "Ocultar el detalle" : `Ver los ${list.length} récords en detalle`}
			</span>
			<svg class="lista-arrow" viewBox="0 0 24 24" aria-hidden="true">
				<path d="M5 8.5 12 15.5 19 8.5" />
			</svg>
		</button>
	{/if}
</div>

<style>
	.lista {
		position: relative;
		margin-top: 1rem;
		border-top: 1px solid var(--line);
		padding-top: 0.6rem;
	}

	/* Ventana que recorta el listado: cerrada deja asomar el primer récord y lo
	   difumina; abierta crece hasta la altura real (--full-h). Reserva hueco
	   abajo para el botón, que flota encima del difuminado. */
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

	/* Un único récord: sin recorte, sin difuminado ni hueco para el botón. */
	.lista.single .lista-window {
		max-height: none;
		padding-bottom: 0;
	}
	.lista.single .lista-window::after {
		content: none;
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
	.li-date :global(.prov) {
		margin-left: 5px;
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
	.small {
		font-size: 0.78rem;
	}
	.muted {
		color: var(--faint);
	}
</style>
