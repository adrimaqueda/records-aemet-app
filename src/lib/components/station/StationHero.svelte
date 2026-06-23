<!--
@component
StationHero.svelte — cabecera de estación. En modo normal (página de detalle)
es un titular grande; con `compact` se reduce para el panel del mapa. Depende de
los tokens de diseño globales (+layout.svelte).
-->
<script>
	import { fmtDate } from "$lib/utils/format.js";
	let { detail, compact = false } = $props();
</script>

<header class="hero" class:compact>
	<p class="eyebrow">Estación meteorológica</p>
	<h1>{detail.nombre}</h1>

	<div class="meta">
		<span class="chip provincia">{detail.provincia.toLowerCase()}</span>
		<span class="fact"><b>{detail.altitud}</b> m</span>
		<span class="fact code">{detail.indicativo}</span>
	</div>

	<p class="span">
		<b>{detail.diasConDatos.toLocaleString("es-ES")}</b> días registrados
		<span class="range"
			>· {fmtDate(detail.datosDesde)} – {fmtDate(detail.datosHasta)}</span
		>
	</p>
</header>

<style>
	.hero {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
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
		font-size: clamp(2.3rem, 8vw, 3.6rem);
		font-weight: 800;
		line-height: 1.02;
		letter-spacing: -0.035em;
		color: var(--ink);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}
	.chip {
		font-size: 0.82rem;
		font-weight: 600;
		padding: 0.18rem 0.6rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--max) 11%, white);
		color: color-mix(in srgb, var(--max) 80%, black);
	}
	.provincia {
		text-transform: capitalize;
	}
	.fact {
		font-size: 0.86rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.fact b {
		color: var(--ink);
		font-weight: 600;
	}
	.code {
		font-family: ui-monospace, "SF Mono", Menlo, monospace;
		font-size: 0.78rem;
		letter-spacing: 0.02em;
		color: var(--faint);
	}
	.span {
		margin: 0;
		font-size: 0.86rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.span b {
		color: var(--ink);
		font-weight: 600;
	}
	.range {
		color: var(--faint);
	}

	/* --- Variante compacta para el panel del mapa --------------------- */
	.hero.compact {
		gap: 0.4rem;
	}
	.compact .eyebrow {
		font-size: 0.64rem;
		letter-spacing: 0.12em;
	}
	.compact h1 {
		font-size: 1.5rem;
		letter-spacing: -0.02em;
	}
	.compact .chip,
	.compact .fact {
		font-size: 0.78rem;
	}
	.compact .span {
		font-size: 0.78rem;
	}
	.compact .range {
		display: block;
		margin-top: 0.1rem;
	}

	@media (max-width: 480px) {
		.hero:not(.compact) .range {
			display: block;
			margin-top: 0.15rem;
		}
	}
</style>
