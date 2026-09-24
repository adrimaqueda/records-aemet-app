<!--
@component
RecordsHeadline.svelte — fichas protagonistas de la página de detalle: el día
más caluroso y la noche más cálida (récords absolutos vigentes), con el último
récord de cada familia como pie. Depende de los tokens de diseño globales.
-->
<script>
	import { fmtDate, fmtNum, fmtTemp, tipoLabel } from "$lib/utils/format.js";
	import { ageLongLabel, daysSince } from "$lib/utils/age.js";
	import { colorForDays } from "$lib/utils/colors.js";
	import { FAMILIA_SHORT, FAMILIA_TIPOS } from "$lib/data/data.js";
	import { latestInFamily } from "$lib/data/records.js";
	import ProvisionalTag from "$lib/components/ui/ProvisionalTag.svelte";

	let { detail } = $props();

	const CARDS = [
		{ fam: "max", label: "Día más caluroso", sub: "temperatura máxima registrada" },
		{ fam: "min", label: "Noche más cálida", sub: "temperatura mínima más alta" },
	];

	const cards = $derived(
		CARDS.map((c) => {
			const ultimo = latestInFamily(detail, c.fam);
			return {
				...c,
				record: detail.vigentes[FAMILIA_TIPOS[c.fam].absoluto],
				ultimo,
				ultimoColor: ultimo && colorForDays(c.fam === "max", daysSince(ultimo.fecha)),
			};
		}),
	);

	// Rayos del sol de la card de día: 8 segmentos repartidos en círculo
	// alrededor del disco solar (centro 104,32 en coordenadas del viewBox).
	const sunRays = Array.from({ length: 8 }, (_, k) => {
		const [cos, sin] = [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)];
		return { x1: 104 + 23 * cos, y1: 32 + 23 * sin, x2: 104 + 31 * cos, y2: 32 + 31 * sin };
	});
</script>

<section class="cards">
	{#each cards as c (c.fam)}
		<article class="card" style:--accent="var(--{c.fam})">
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
					<rect class="moon" x="80" y="10" width="50" height="50" mask="url(#crescent)" />
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
					<span class="num">{fmtNum(c.record.valor)}</span>
					<span class="unit">°C</span>
				</p>
				<p class="when">
					{fmtDate(c.record.fecha)}
					<span class="ago">
						· {ageLongLabel(daysSince(c.record.fecha))}{#if c.record.provisional}<ProvisionalTag
							/>{/if}
					</span>
				</p>
			{:else}
				<p class="big empty">—</p>
				<p class="when">Sin récord registrado</p>
			{/if}

			{#if c.ultimo}
				<footer>
					<span class="dot" style:background={c.ultimoColor}></span>
					<span class="ultimo-text">
						<span class="ultimo-label">
							Último récord de {FAMILIA_SHORT[c.fam].toLowerCase()}
						</span>
						<span class="ultimo-detail">
							{tipoLabel(c.ultimo.tipo, c.ultimo.mes)} ·
							<b>{fmtTemp(c.ultimo.valor)}</b>
							· {fmtDate(c.ultimo.fecha)}{#if c.ultimo.provisional}<ProvisionalTag />{/if}
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
</style>
