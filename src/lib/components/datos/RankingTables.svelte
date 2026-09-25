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
	import { fetchRankings, FAMILIA_OPCIONES } from "$lib/data/data.js";
	import { capWords, fmtDateShort, fmtTemp, MESES } from "$lib/utils/format.js";
	import { daysSince, ageLongLabel } from "$lib/utils/age.js";
	import Segmented from "$lib/components/ui/Segmented.svelte";
	import { flip } from "svelte/animate";
	import { fly } from "svelte/transition";

	// $state.raw: el JSON se sustituye entero y nunca se muta.
	let rk = $state.raw(null);

	$effect(() => {
		fetchRankings()
			.then((r) => (rk = r))
			// Si rankings.json aún no está publicado (404), rk queda null y la
			// sección no se pinta.
			.catch(() => {});
	});

	// --- controles ------------------------------------------------------
	let topFam = $state("max"); // 'max' | 'min'
	let topMes = $state(0); // 0 = récord absoluto · 1..12 = mes
	let longFam = $state("max");
	let actPeriodo = $state("esteAnio"); // 'esteAnio' | 'ultimos12m'

	const anyo = (fecha) => fecha.slice(0, 4);
	/** Familia (para color de la cifra) a partir del tipo: "absoluto-max" → "max". */
	const famOf = (tipo) => tipo.split("-")[1];
	/** ¿El récord batido es absoluto (vs. mensual)? Marca el fondo de la cifra. */
	const esAbs = (tipo) => tipo.startsWith("absoluto");

	// --- derivaciones ---------------------------------------------------
	const topRows = $derived(
		!rk ? [] : topMes === 0 ? rk.topAbs[topFam] : (rk.topMes[topFam][String(topMes)] ?? []),
	);
	const longRows = $derived(rk ? rk.longevos[longFam] : []);
	const actRows = $derived(rk ? rk.masActivas[actPeriodo] : []);
</script>

{#if rk}
	<section class="rankings">
		<header class="sec-head">
			<h2>Clasificaciones</h2>
			<p class="muted">
				Récords destacados de la red. Las clasificaciones usan el dato definitivo; «máxima» es el
				día más caluroso y «mínima» la noche más cálida (la temperatura mínima más alta).
			</p>
		</header>

		{#snippet estacion(r)}
			<td>
				<a href="/estacion/{r.ind}">{r.nombre}</a>
				<span class="prov">{capWords(r.prov)}</span>
			</td>
		{/snippet}

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
					<Segmented options={FAMILIA_OPCIONES} bind:value={topFam} label="Familia" small />
					<select bind:value={topMes} aria-label="Periodo">
						<option value={0}>Récord absoluto</option>
						{#each MESES.slice(1) as nombre, i (i)}
							<option value={i + 1}>{nombre}</option>
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
								{@render estacion(r)}
								<td class="r">
									<span class="fig {topFam}" class:abs={topMes === 0 || r.abs}>
										{fmtTemp(r.valor)}
									</span>
								</td>
								<td class="r hide-sm fecha">{fmtDateShort(r.fecha)}</td>
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
									{@render estacion(r)}
									<td class="r">
										<span class="fig {famOf(r.tipo)}" class:abs={esAbs(r.tipo)}>
											{fmtTemp(r.valor)}
										</span>
										{#if r.valorAnterior != null}<span class="prev">
												antes {fmtTemp(r.valorAnterior)}
											</span>{/if}
									</td>
									<td class="r hide-sm fecha">{fmtDateShort(r.fecha)}</td>
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
						<Segmented options={FAMILIA_OPCIONES} bind:value={longFam} label="Familia" small />
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
									{@render estacion(r)}
									<td class="r">
										<span class="fig {longFam} abs">{fmtTemp(r.valor)}</span>
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
									{@render estacion(r)}
									<td class="r">
										<span class="fig {famOf(r.tipo)} abs">+{fmtTemp(r.salto)}</span>
									</td>
									<td class="r hide-sm fecha">
										{fmtTemp(r.valorAnterior)} → {fmtTemp(r.valor)}
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
						<Segmented
							options={[
								{ id: "esteAnio", label: String(rk.masActivas.anio) },
								{ id: "ultimos12m", label: "12 meses" },
							]}
							bind:value={actPeriodo}
							label="Periodo"
							small
						/>
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
									{@render estacion(r)}
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
