<!--
@component
RecordsHeadline.svelte — fichas protagonistas de la página de detalle: el día
más caluroso y la noche más cálida (récords absolutos vigentes), con el último
récord de cada familia como pie. Depende de los tokens de diseño globales.
-->
<script>
	import { fmtDate, fmtTemp, tipoLabel } from "$lib/utils/format.js";
	import { ageLongLabel, daysSince } from "$lib/utils/age.js";
	import { colorForDays } from "$lib/utils/colors.js";
	import { latestInFamily } from "$lib/data/records.js";
	import ProvisionalTag from "$lib/components/ui/ProvisionalTag.svelte";

	let { detail } = $props();

	const cards = $derived(
		[
			{
				fam: "max",
				label: "Día más caluroso",
				sub: "temperatura máxima registrada",
				record: detail.vigentes.absolutoMax,
				ultimo: latestInFamily(detail, "max"),
				familiaLabel: "máxima",
			},
			{
				fam: "min",
				label: "Noche más cálida",
				sub: "temperatura mínima más alta",
				record: detail.vigentes.absolutoMin,
				ultimo: latestInFamily(detail, "min"),
				familiaLabel: "mínima",
			},
		].map((c) => ({
			...c,
			accent: c.fam === "max" ? "var(--max)" : "var(--min)",
			ultimoColor: c.ultimo
				? colorForDays(c.fam === "max", daysSince(c.ultimo.fecha))
				: null,
		})),
	);

	// Rayos del sol de la card de día: 8 segmentos repartidos en círculo
	// alrededor del disco solar (centro 104,32 en coordenadas del viewBox).
	const sunRays = Array.from({ length: 8 }, (_, k) => {
		const a = (k * Math.PI) / 4;
		const cx = 104,
			cy = 32,
			r1 = 23,
			r2 = 31;
		return {
			x1: cx + r1 * Math.cos(a),
			y1: cy + r1 * Math.sin(a),
			x2: cx + r2 * Math.cos(a),
			y2: cy + r2 * Math.sin(a),
		};
	});
</script>

<section class="cards">
	{#each cards as c (c.fam)}
		<article class="card {c.fam}" style:--accent={c.accent}>
			{#if c.fam === "max"}
				<!-- Día: sol con rayos asomando por la esquina. -->
				<svg class="scene scene-day" viewBox="0 0 160 150" aria-hidden="true">
					<g class="rays">
						{#each sunRays as ray, i (i)}
							<line x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2} />
						{/each}
					</g>
					<circle class="sun-core" cx="104" cy="32" r="16" />
				</svg>
			{:else}
				<!-- Noche: luna creciente y estrellas titilando. -->
				<svg class="scene scene-night" viewBox="0 0 160 150" aria-hidden="true">
					<defs>
						<mask id="crescent">
							<circle cx="108" cy="34" r="19" fill="#fff" />
							<circle cx="98" cy="27" r="16" fill="#000" />
						</mask>
					</defs>
					<rect
						class="moon"
						x="80"
						y="10"
						width="50"
						height="50"
						mask="url(#crescent)"
					/>
					<g class="stars">
						<circle cx="58" cy="30" r="1.7" />
						<circle cx="40" cy="60" r="1.2" />
						<circle cx="74" cy="66" r="1.4" />
						<circle cx="128" cy="80" r="1.5" />
						<circle cx="96" cy="92" r="1" />
					</g>
				</svg>
			{/if}
			<header>
				<span class="tick" aria-hidden="true"></span>
				<div>
					<p class="label">{c.label}</p>
					<p class="sub">{c.sub}</p>
				</div>
			</header>

			{#if c.record}
				<p class="big">
					<span class="num">{c.record.valor.toFixed(1)}</span>
					<span class="unit">°C</span>
				</p>
				<p class="when">
					{fmtDate(c.record.fecha)}
					<span class="ago">· {ageLongLabel(daysSince(c.record.fecha))}</span>
					{#if c.record.provisional}<ProvisionalTag />{/if}
				</p>
			{:else}
				<p class="big empty">—</p>
				<p class="when">Sin récord registrado</p>
			{/if}

			{#if c.ultimo}
				<footer>
					<span class="dot" style:background={c.ultimoColor}></span>
					<span class="ultimo-text">
						<span class="ultimo-label">Último récord de {c.familiaLabel}</span>
						<span class="ultimo-detail">
							{tipoLabel(c.ultimo.tipo, c.ultimo.mes)} ·
							<b>{fmtTemp(c.ultimo.valor)}</b>
							· {fmtDate(
								c.ultimo.fecha,
							)}{#if c.ultimo.provisional}<ProvisionalTag />{/if}
						</span>
					</span>
				</footer>
			{/if}
		</article>
	{/each}
</section>

<style>
	.cards {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}
	@media (max-width: 640px) {
		.cards {
			grid-template-columns: 1fr;
		}
	}

	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 2px solid var(--accent);
		border-radius: var(--radius);
		padding: 1.4rem 1.5rem 1.3rem;
		box-shadow: var(--shadow);
		overflow: hidden;
		isolation: isolate;
	}
	/* Halo difuso del color de familia en la esquina superior. */
	.card::before {
		content: "";
		position: absolute;
		top: -55%;
		right: -25%;
		width: 75%;
		height: 130%;
		background: radial-gradient(
			circle,
			color-mix(in srgb, var(--accent) 14%, transparent),
			transparent 68%
		);
		pointer-events: none;
		z-index: 0;
	}

	/* Escena decorativa (sol / luna) anclada a la esquina superior, detrás
	   del contenido. El contenido se eleva con z-index para no solaparse. */
	.scene {
		position: absolute;
		top: 0;
		right: 0;
		width: clamp(118px, 38%, 178px);
		height: auto;
		z-index: 0;
		pointer-events: none;
	}
	.card > header,
	.card > .big,
	.card > .when,
	.card > footer {
		position: relative;
		z-index: 1;
	}

	/* — Día: disco solar + rayos que giran muy despacio — */
	.sun-core {
		fill: var(--accent);
	}
	.scene-day .rays line {
		stroke: var(--accent);
		stroke-width: 3;
		stroke-linecap: round;
		opacity: 0.7;
	}
	.scene-day .rays {
		transform-origin: 104px 32px;
		animation: sun-spin 80s linear infinite;
	}

	/* — Noche: luna creciente + estrellas titilando — */
	.moon {
		fill: var(--accent);
	}
	.stars circle {
		fill: var(--accent);
		opacity: 0.55;
		animation: twinkle 4s ease-in-out infinite;
	}
	.stars circle:nth-child(2) {
		animation-delay: 1.1s;
	}
	.stars circle:nth-child(3) {
		animation-delay: 0.4s;
	}
	.stars circle:nth-child(4) {
		animation-delay: 2.2s;
	}
	.stars circle:nth-child(5) {
		animation-delay: 1.6s;
	}

	@keyframes sun-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes twinkle {
		0%,
		100% {
			opacity: 0.25;
		}
		50% {
			opacity: 0.8;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.scene-day .rays,
		.stars circle {
			animation: none;
		}
	}

	header {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		position: relative;
	}
	.tick {
		width: 4px;
		align-self: stretch;
		min-height: 2.1em;
		border-radius: 999px;
		background: var(--accent);
		flex: 0 0 auto;
	}
	.label {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--ink);
	}
	.sub {
		margin: 0.1rem 0 0;
		font-size: 0.76rem;
		color: var(--faint);
	}

	.big {
		margin: 0.9rem 0 0;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		position: relative;
	}
	.num {
		font-size: clamp(3rem, 11vw, 4.4rem);
		font-weight: 800;
		letter-spacing: -0.045em;
		color: var(--accent);
	}
	.unit {
		font-size: 1.3rem;
		font-weight: 600;
		color: var(--faint);
		margin-left: 0.15rem;
		letter-spacing: -0.02em;
	}
	.big.empty .num,
	.big.empty {
		color: var(--faint);
		font-size: 2.4rem;
		font-weight: 600;
	}
	.when {
		margin: 0.5rem 0 0;
		font-size: 0.88rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.ago {
		color: var(--faint);
		display: inline-flex;
		column-gap: 5px;
	}

	footer {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		margin-top: 1.1rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--line);
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		margin-top: 0.28rem;
		flex: 0 0 auto;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
	}
	.ultimo-text {
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
		min-width: 0;
	}
	.ultimo-label {
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--faint);
	}
	.ultimo-detail {
		font-size: 0.82rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	* :global {
		.ultimo-detail .prov {
			margin-left: 5px;
		}
	}
</style>
