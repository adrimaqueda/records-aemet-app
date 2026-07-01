<!--
@component
RankingTables.svelte — clasificaciones de récords para la página /datos.

Lee `rankings.json` (precalculado por el pipeline: `extremos-rankings`) y pinta
varias tablas:
  · Top 10 estaciones por récord más alto (absoluto o de un mes concreto), máx/mín.
  · Récords batidos más recientes en toda la red.
  · Récords vigentes más longevos (los que llevan más sin superarse).
  · Mayores saltos sobre el récord anterior.
  · Estaciones que más récords están batiendo (año en curso / últimos 12 meses).

Es autocontenido: si `rankings.json` aún no está publicado (404), se oculta
silenciosamente para no romper la página.
-->
<script>
	import { fetchRankings } from "$lib/data/data.js";
	import { MESES } from "$lib/utils/format.js";
	import { daysSince, ageLongLabel } from "$lib/utils/age.js";
	import { flip } from "svelte/animate";
	import { fly } from "svelte/transition";

	let rk = $state(null);
	let failed = $state(false);

	$effect(() => {
		fetchRankings()
			.then((r) => (rk = r))
			.catch(() => (failed = true));
	});

	// --- controles ------------------------------------------------------
	let topFam = $state("max"); // 'max' | 'min'
	let topMes = $state(0); // 0 = récord absoluto · 1..12 = mes
	let longFam = $state("max");
	let actPeriodo = $state("esteAnio"); // 'esteAnio' | 'ultimos12m'

	// --- formato --------------------------------------------------------
	function fmtT(v) {
		return v == null
			? "—"
			: `${v.toLocaleString("es-ES", {
					minimumFractionDigits: 1,
					maximumFractionDigits: 1,
				})} °C`;
	}
	function fmtDelta(v) {
		return v == null
			? ""
			: `+${v.toLocaleString("es-ES", {
					minimumFractionDigits: 1,
					maximumFractionDigits: 1,
				})}`;
	}
	function fmtFecha(s) {
		return new Date(s).toLocaleDateString("es-ES", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	}
	function anyo(s) {
		return s ? s.slice(0, 4) : "";
	}

	/** Familia (para color de la cifra): 'max' = máxima · 'min' = mínima. */
	function famOf(tipo) {
		return tipo.endsWith("min") ? "min" : "max";
	}
	/** ¿El récord batido es absoluto (vs. mensual)? Marca el fondo de la cifra. */
	function esAbs(tipo) {
		return tipo.startsWith("absoluto");
	}

	// --- derivaciones ---------------------------------------------------
	const topRows = $derived(
		!rk ? [] : topMes === 0 ? rk.topAbs[topFam] : (rk.topMes[topFam][String(topMes)] ?? []),
	);
	const longRows = $derived(rk ? rk.longevos[longFam] : []);
	const actRows = $derived(rk ? rk.masActivas[actPeriodo] : []);
</script>

{#if rk && !failed}
	<section class="rankings">
		<header class="sec-head">
			<h2>Clasificaciones</h2>
			<p class="muted">
				Récords destacados de la red. Las clasificaciones usan el dato definitivo; «máxima» es el
				día más caluroso y «mínima» la noche más cálida (la temperatura mínima más alta).
			</p>
		</header>

		{#snippet leyendaFondo()}
			<p class="card-leg">
				<span class="fig abs max">con fondo</span>
				= récord absoluto ·
				<span class="fig max">sin fondo</span>
				= mensual
			</p>
		{/snippet}

		<!-- 1 · TOP estaciones por récord más alto -->
		<article class="card">
			<div class="card-head">
				<h3>Estaciones con el récord más alto</h3>
				<div class="ctrls">
					<div class="seg" style:--i={topFam === "max" ? 0 : 1} role="group" aria-label="Familia">
						<span class="seg-pill" aria-hidden="true"></span>
						<button class:active={topFam === "max"} onclick={() => (topFam = "max")}>Máxima</button>
						<button class:active={topFam === "min"} onclick={() => (topFam = "min")}>Mínima</button>
					</div>
					<select bind:value={topMes} aria-label="Periodo">
						<option value={0}>Récord absoluto</option>
						{#each Array(12) as _, m (m)}
							<option value={m + 1}>{MESES[m + 1]}</option>
						{/each}
					</select>
				</div>
			</div>
			<p class="card-sub muted">
				{topMes === 0
					? topFam === "max"
						? "Días más calurosos jamás registrados."
						: "Noches más cálidas jamás registradas."
					: `Récord ${topFam === "max" ? "de máxima" : "de mínima"} de ${MESES[topMes]} (cualquier año).`}
			</p>
			{@render leyendaFondo()}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th class="num">#</th>
							<th>Estación</th>
							<th class="r">Valor</th>
							<th class="r hide-sm">Fecha</th>
						</tr>
					</thead>
					<tbody>
						{#each topRows as r, i (r.ind)}
							<tr animate:flip={{ duration: 300 }} in:fly={{ duration: 300, y: 300 }}>
								<td class="num">{i + 1}</td>
								<td>
									<a href="/estacion/{r.ind}">{r.nombre}</a>
									<span class="prov">{r.prov}</span>
								</td>
								<td class="r">
									<span class="fig {topFam}" class:abs={topMes === 0 || r.abs}>
										{fmtT(r.valor)}
									</span>
								</td>
								<td class="r hide-sm fecha">{fmtFecha(r.fecha)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</article>

		<div class="card-grid">
			<!-- 2 · Récords más recientes -->
			<article class="card">
				<div class="card-head">
					<h3>Récords más recientes</h3>
				</div>
				<p class="card-sub muted">
					Lo último batido en toda la red. Solo récords ya confirmados; los provisionales de los
					días más recientes se ven en el mapa.
				</p>
				{@render leyendaFondo()}
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>Estación</th>
								<th class="r">Récord</th>
								<th class="r hide-sm">Fecha</th>
							</tr>
						</thead>
						<tbody>
							{#each rk.recientes as r, i (r.ind + "-" + r.fecha + "-" + i)}
								<tr>
									<td>
										<a href="/estacion/{r.ind}">{r.nombre}</a>
										<span class="prov">{r.prov}</span>
									</td>
									<td class="r">
										<span class="fig {famOf(r.tipo)}" class:abs={esAbs(r.tipo)}>
											{fmtT(r.valor)}
										</span>
										{#if r.valorAnterior != null}<span class="prev">
												antes {fmtT(r.valorAnterior)}
											</span>{/if}
									</td>
									<td class="r hide-sm fecha">{fmtFecha(r.fecha)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</article>

			<!-- 3 · Récords más longevos -->
			<article class="card">
				<div class="card-head">
					<h3>Récords más longevos</h3>
					<div class="ctrls">
						<div
							class="seg"
							style:--i={longFam === "max" ? 0 : 1}
							role="group"
							aria-label="Familia"
						>
							<span class="seg-pill" aria-hidden="true"></span>
							<button class:active={longFam === "max"} onclick={() => (longFam = "max")}>
								Máxima
							</button>
							<button class:active={longFam === "min"} onclick={() => (longFam = "min")}>
								Mínima
							</button>
						</div>
					</div>
				</div>
				<p class="card-sub muted">
					Récords absolutos vigentes que llevan más tiempo sin superarse.
				</p>
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th class="num">#</th>
								<th>Estación</th>
								<th class="r">Valor</th>
								<th class="r">En pie desde</th>
							</tr>
						</thead>
						<tbody>
							{#each longRows as r, i (r.ind)}
								<tr animate:flip={{ duration: 300 }} in:fly={{ duration: 300, y: 300 }}>
									<td class="num">{i + 1}</td>
									<td>
										<a href="/estacion/{r.ind}">{r.nombre}</a>
										<span class="prov">{r.prov}</span>
									</td>
									<td class="r">
										<span class="fig {longFam} abs">{fmtT(r.valor)}</span>
									</td>
									<td class="r fecha">
										{anyo(r.fecha)}
										<span class="prev">{ageLongLabel(daysSince(r.fecha))}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</article>
		</div>

		<div class="card-grid">
			<!-- 4 · Mayor salto -->
			<article class="card">
				<div class="card-head">
					<h3>Mayores saltos</h3>
				</div>
				<p class="card-sub muted">Récords absolutos que pulverizaron el anterior por más grados.</p>
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th class="num">#</th>
								<th>Estación</th>
								<th class="r">Salto</th>
								<th class="r hide-sm">Récord</th>
							</tr>
						</thead>
						<tbody>
							{#each rk.mayorSalto as r, i (r.ind + "-" + r.fecha + "-" + i)}
								<tr>
									<td class="num">{i + 1}</td>
									<td>
										<a href="/estacion/{r.ind}">{r.nombre}</a>
										<span class="prov">{r.prov}</span>
									</td>
									<td class="r">
										<span class="fig {famOf(r.tipo)} abs">{fmtDelta(r.salto)} °C</span>
									</td>
									<td class="r hide-sm fecha">
										{fmtT(r.valorAnterior)} → {fmtT(r.valor)}
										<span class="prev">{anyo(r.fecha)}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</article>

			<!-- 5 · Estaciones que más récords baten -->
			<article class="card">
				<div class="card-head">
					<h3>Las que más récords baten</h3>
					<div class="ctrls">
						<div
							class="seg wide"
							style:--i={actPeriodo === "esteAnio" ? 0 : 1}
							role="group"
							aria-label="Periodo"
						>
							<span class="seg-pill" aria-hidden="true"></span>
							<button
								class:active={actPeriodo === "esteAnio"}
								onclick={() => (actPeriodo = "esteAnio")}
							>
								{rk.masActivas.anio}
							</button>
							<button
								class:active={actPeriodo === "ultimos12m"}
								onclick={() => (actPeriodo = "ultimos12m")}
							>
								12 meses
							</button>
						</div>
					</div>
				</div>
				<p class="card-sub muted">
					Estaciones con más récords batidos
					{actPeriodo === "esteAnio" ? `en ${rk.masActivas.anio}` : "en los últimos 12 meses"}.
				</p>
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th class="num">#</th>
								<th>Estación</th>
								<th class="r">Récords</th>
							</tr>
						</thead>
						<tbody>
							{#each actRows as r, i (r.ind)}
								<tr animate:flip={{ duration: 300 }} in:fly={{ duration: 300, y: 300 }}>
									<td class="num">{i + 1}</td>
									<td>
										<a href="/estacion/{r.ind}">{r.nombre}</a>
										<span class="prov">{r.prov}</span>
									</td>
									<td class="r val-n">{r.n}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</article>
		</div>
	</section>
{/if}

<style>
	.rankings {
		margin-top: 2.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.sec-head h2 {
		margin: 0 0 0.3rem;
		font-size: clamp(1.3rem, 3vw, 1.6rem);
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--ink);
	}
	.sec-head .muted {
		margin: 0;
		max-width: 62ch;
		font-size: 0.9rem;
	}

	.card-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}
	@media (min-width: 820px) {
		.card-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	.card {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 1.1rem 1.2rem 0.6rem;
		display: flex;
		flex-direction: column;
		height: fit-content;
		min-width: 0;
	}
	.card-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}
	.card h3 {
		margin: 0;
		font-size: 0.98rem;
		font-weight: 700;
		color: var(--ink);
	}
	.card-sub {
		margin: 0.25rem 0 0.7rem;
		font-size: 0.8rem;
	}

	.ctrls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* Segmentado máx/mín (mismo lenguaje que la HUD del mapa). */
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
	.seg-pill {
		position: absolute;
		top: 3px;
		bottom: 3px;
		left: 3px;
		width: calc(50% - 4px);
		border-radius: 999px;
		background: var(--ink);
		transform: translateX(calc(var(--i, 0) * (100% + 2px)));
		transition: transform 0.26s cubic-bezier(0.34, 1.2, 0.42, 1);
		pointer-events: none;
	}
	.seg button {
		position: relative;
		z-index: 1;
		background: none;
		border: none;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--muted);
		border-radius: 999px;
		transition: color 0.2s ease;
		white-space: nowrap;
	}
	.seg.wide button {
		padding: 0.3rem 0.6rem;
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

	select {
		font: inherit;
		font-size: 0.8rem;
		padding: 0.35rem 1.8rem 0.35rem 0.7rem;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background-color: var(--surface);
		color: var(--ink);
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236c6c70' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.6rem center;
	}
	select:hover {
		border-color: var(--muted);
	}

	/* Tabla */
	.table-wrap {
		overflow: hidden;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.86rem;
		font-variant-numeric: tabular-nums;
	}
	thead th {
		text-align: left;
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
		color: var(--faint);
		padding: 0 0.5rem 0.4rem;
		border-bottom: 1px solid var(--line);
		white-space: nowrap;
	}
	th.r,
	td.r {
		text-align: right;
	}
	th.num,
	td.num {
		text-align: right;
		width: 1.6rem;
		color: var(--faint);
	}
	tbody td {
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid var(--line);
		vertical-align: baseline;
	}
	tbody tr:last-child td {
		border-bottom: none;
	}
	tbody tr:hover td {
		background: color-mix(in srgb, var(--bg) 55%, var(--surface));
	}
	a {
		color: var(--ink);
		font-weight: 600;
		text-decoration: none;
	}
	a:hover {
		text-decoration: underline;
	}
	.prov {
		display: block;
		font-size: 0.7rem;
		color: var(--faint);
		font-weight: 400;
		text-transform: capitalize;
	}
	/* La cifra es el elemento focal: el color indica la familia (máxima/mínima)
	   y el fondo distingue récord absoluto (con fondo) de mensual (sin fondo). */
	.fig {
		font-weight: 700;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.fig.max {
		color: color-mix(in srgb, var(--max) 88%, black);
	}
	.fig.min {
		color: color-mix(in srgb, var(--min) 82%, black);
	}
	.fig.abs {
		padding: 0.06rem 0.4rem;
		border-radius: 6px;
	}
	.fig.abs.max {
		background: color-mix(in srgb, var(--max) 13%, transparent);
	}
	.fig.abs.min {
		background: color-mix(in srgb, var(--min) 16%, transparent);
	}
	.val-n {
		font-weight: 700;
		color: var(--ink);
	}
	.fecha {
		color: var(--muted);
		white-space: nowrap;
	}
	.prev {
		display: block;
		font-size: 0.7rem;
		font-weight: 400;
		color: var(--faint);
	}
	/* Mini-leyenda dentro de la tabla: muestra qué significa el resaltado. */
	.card-leg {
		margin: 0 0 0.7rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.2rem 0.45rem;
		font-size: 0.72rem;
		color: var(--faint);
	}
	.card-leg .fig {
		font-size: 0.72rem;
	}
	.muted {
		color: var(--faint);
	}
	.hide-sm {
		display: none;
	}
	@media (min-width: 560px) {
		.hide-sm {
			display: table-cell;
		}
	}
</style>
