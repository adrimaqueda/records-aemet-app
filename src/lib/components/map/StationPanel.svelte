<script>
	import { fetchStationDetail } from "$lib/data/data.js";
	import { fmtDate, fmtNum, fmtTemp, tipoLabel } from "$lib/utils/format.js";
	import { ageLongLabel, daysSince } from "$lib/utils/age.js";
	import { latestInFamily } from "$lib/data/records.js";
	import StationHero from "$lib/components/station/StationHero.svelte";
	import ProvisionalTag from "$lib/components/ui/ProvisionalTag.svelte";
	import { fly } from "svelte/transition";

	let { indicativo = null, color = null, onClose, familia = "max" } = $props();

	// El #await consume el promise y se ocupa de los estados loading / data / error.
	const detailPromise = $derived(indicativo ? fetchStationDetail(indicativo) : null);

	const accent = $derived(familia === "max" ? "var(--max)" : "var(--min)");
	const familiaLabel = $derived(familia === "max" ? "máxima" : "mínima");

	/** El récord que marca el mapa: el más reciente de la familia (absoluto o
	 *  mensual). El absoluto vigente se muestra aparte como contexto. */
	function absolutoDe(detail) {
		return familia === "max" ? detail.vigentes.absolutoMax : detail.vigentes.absolutoMin;
	}
</script>

{#if indicativo}
	<aside
		class="panel"
		style:--edge={color}
		style:--accent={accent}
		transition:fly={{ y: 400, duration: 300 }}
	>
		<button class="close" onclick={onClose} aria-label="Cerrar">×</button>

		{#await detailPromise}
			<div class="loading">
				<div class="spinner" aria-hidden="true"></div>
			</div>
		{:then detail}
			{#if detail}
				{@const ultimo = latestInFamily(detail, familia)}
				{@const abs = absolutoDe(detail)}
				<StationHero {detail} compact />

				<div class="record">
					<p class="kicker">
						<span class="dot" style:background={color}></span>
						Último récord de {familiaLabel}
					</p>

					{#if ultimo}
						<p class="big">
							<span class="num">{fmtNum(ultimo.valor)}</span>
							<span class="unit">°C</span>
						</p>
						<p class="what">
							{tipoLabel(ultimo.tipo, ultimo.mes)}{#if ultimo.provisional}<ProvisionalTag />{/if}
						</p>
						<p class="when">
							{fmtDate(ultimo.fecha)} · {ageLongLabel(daysSince(ultimo.fecha))}
						</p>
					{:else}
						<p class="big empty">—</p>
						<p class="when">Sin récord registrado</p>
					{/if}

					{#if abs && (!ultimo || abs.fecha !== ultimo.fecha)}
						<p class="abs">
							<span class="abs-label">Récord absoluto</span>
							{fmtTemp(abs.valor)} · {fmtDate(abs.fecha)}{#if abs.provisional}<ProvisionalTag
								/>{/if}
						</p>
					{/if}
				</div>

				<a class="cta" href="/estacion/{detail.indicativo}">
					Ver toda la información
					<span aria-hidden="true">→</span>
				</a>
			{/if}
		{:catch err}
			<p class="error">Error: {err.message ?? err}</p>
		{/await}
	</aside>
{/if}

<style>
	/* Mobile-first: hoja inferior a ancho completo, altura acotada. */
	.panel {
		position: fixed;
		bottom: 0.5rem;
		right: 0.5rem;
		left: 0.5rem;
		max-height: 80vh;
		box-sizing: border-box;
		border-radius: var(--radius);
		/* Borde de acento con el color de recencia del marcador. */
		border: 3px solid var(--edge, var(--ink));
		background: color-mix(in srgb, var(--surface) 75%, transparent);
		backdrop-filter: saturate(0.4) blur(6px);
		box-shadow: var(--shadow);
		overflow-y: auto;
		padding: 1.25rem 1.25rem 1.5rem;
		z-index: 10;
		color: var(--ink);
		font-family: var(--font);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	/* Desktop: panel flotante a la derecha, dimensiones fijas. */
	@media (min-width: 700px) {
		.panel {
			bottom: 1rem;
			right: 1rem;
			left: auto;
			width: 380px;
			max-height: calc(100vh - 2rem);
			padding: 1.5rem 1.5rem 1.75rem;
		}
	}
	.close {
		position: absolute;
		top: 0.7rem;
		right: 0.7rem;
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--bg) 70%, transparent);
		border: 1px solid var(--line);
		border-radius: 50%;
		font-size: 1.3rem;
		line-height: 1;
		cursor: pointer;
		color: var(--muted);
		transition:
			color 0.15s ease,
			background 0.15s ease;
	}
	.close:hover {
		color: var(--ink);
		background: var(--bg);
	}

	/* Récord destacado: el que marca el mapa, integrado en el panel. */
	.record {
		display: flex;
		flex-direction: column;
	}
	.kicker {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--faint);
	}
	.kicker .dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex: 0 0 auto;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
	}
	.big {
		margin: 0.45rem 0 0;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.num {
		font-size: 3.6rem;
		font-weight: 800;
		letter-spacing: -0.045em;
		color: var(--accent);
	}
	.unit {
		font-size: 1.2rem;
		font-weight: 600;
		color: var(--faint);
		margin-left: 0.15rem;
		letter-spacing: -0.02em;
	}
	.big.empty,
	.big.empty .num {
		font-size: 2.4rem;
		font-weight: 600;
		color: var(--faint);
	}
	.what {
		margin: 0.55rem 0 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--ink);
		letter-spacing: -0.01em;
	}
	.when {
		margin: 0.15rem 0 0;
		font-size: 0.85rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.abs {
		margin: 0.8rem 0 0;
		padding-top: 0.7rem;
		border-top: 1px solid var(--line);
		font-size: 0.82rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.abs-label {
		font-weight: 600;
		color: var(--faint);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: 0.72rem;
		margin-right: 0.35rem;
	}

	.cta {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		align-self: flex-start;
		padding: 0.6rem 1rem;
		background: var(--ink);
		color: #fff;
		text-decoration: none;
		border-radius: 999px;
		font-size: 0.86rem;
		font-weight: 600;
		transition: transform 0.15s ease;
	}
	.cta span {
		transition: transform 0.18s ease;
	}
	.cta:hover span {
		transform: translateX(3px);
	}

	.loading {
		display: grid;
		place-items: center;
		padding: 2.5rem 0;
	}
	.spinner {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 2.5px solid var(--line-strong);
		border-top-color: var(--edge, var(--max));
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.error {
		color: #b00;
		margin: 0;
	}
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation-duration: 2s;
		}
		.cta span {
			transition: none;
		}
	}

	* :global .prov {
		margin-left: 5px;
	}
</style>
