<!--
@component
RecordsEvolution.svelte — sección "Evolución de los récords" de la ficha de
estación. Orquesta dos bloques (máxima · día más caluroso, y mínima · noche más
cálida); en cada uno, un selector elige entre el récord absoluto o el de un mes.

No dibuja nada por su cuenta: delega el gráfico en <EvolutionChart> y el detalle
en <RecordDetailList>. Aquí solo viven el filtrado de eventos, los selectores y
el estado "sin datos".
-->
<script>
	import { MESES } from "$lib/utils/format.js";
	import EvolutionChart from "$lib/components/station/EvolutionChart.svelte";
	import RecordDetailList from "$lib/components/station/RecordDetailList.svelte";

	let { detail } = $props();

	const BLOQUES = [
		{
			fam: "max",
			titulo: "Evolución de la máxima",
			subtitulo: "día más caluroso",
			emptyAbs: "Sin récords absolutos de máxima batidos en esta estación.",
			emptyMes: (m) => `Sin récords de máxima de ${MESES[m]} todavía.`,
		},
		{
			fam: "min",
			titulo: "Evolución de la mínima",
			subtitulo: "noche más cálida",
			emptyAbs: 'Sin récords de "noche más cálida" batidos en esta estación.',
			emptyMes: (m) => `Sin récords de "noche más cálida" de ${MESES[m]} todavía.`,
		},
	];

	/** Selección de cada bloque: "absoluto" o el número de mes ("1".."12"). */
	let sel = $state({ max: "absoluto", min: "absoluto" });

	/** Eventos de la estación para una familia y selección. */
	function eventsFor(fam, s) {
		if (s === "absoluto") return detail.eventos.filter((e) => e.tipo === `absoluto-${fam}`);
		return detail.eventos.filter((e) => e.tipo === `mensual-${fam}` && e.mes === +s);
	}
</script>

<section class="evolution">
	<div class="section-head">
		<h2>Evolución de los récords</h2>
		<p class="caption">
			Cómo se ha ido superando cada récord a lo largo del tiempo. Cada escalón es una nueva marca;
			el color del punto indica su antigüedad. Cada vez que hay un periodo largo sin datos <span
				class="gap-swatch"
			></span>
			, el valor de referencia se reinicia.
		</p>
	</div>

	<div class="blocks">
		{#each BLOQUES as b (b.fam)}
			{@const events = eventsFor(b.fam, sel[b.fam])}
			<article class="block">
				<header>
					<h3>
						{b.titulo}
						<span class="small">· {b.subtitulo}</span>
					</h3>
					<label>
						<span class="sr-only">Mostrar</span>
						<select bind:value={sel[b.fam]}>
							<option value="absoluto">Récord absoluto</option>
							{#each MESES.slice(1) as nombre, i (i)}
								<option value={String(i + 1)}>
									{nombre[0].toUpperCase() + nombre.slice(1)}
								</option>
							{/each}
						</select>
					</label>
				</header>

				{#if events.length > 0}
					<EvolutionChart {events} fam={b.fam} sinDatos={detail.sinDatos} />
					<RecordDetailList {events} fam={b.fam} />
				{:else}
					<p class="small empty">
						{sel[b.fam] === "absoluto" ? b.emptyAbs : b.emptyMes(+sel[b.fam])}
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
	.small {
		font-size: 0.78rem;
		font-weight: 400;
		color: var(--faint);
	}
	/* Muestra del rayado de "sin datos" del gráfico, dentro del texto. */
	.gap-swatch {
		display: inline-block;
		height: 0.7lh;
		width: 2.1cap;
		background: repeating-linear-gradient(-45deg, #ccc, #ccc 0.1lh, #eee 0.1lh, #eee 0.2lh);
	}
	select {
		font-size: 0.82rem;
		padding-block: 0.4rem;
	}
	.empty {
		margin: 0.4rem 0 0;
		padding: 1.5rem 0.8rem;
		background: color-mix(in srgb, var(--bg) 55%, var(--surface));
		border: 1px dashed var(--line-strong);
		border-radius: var(--radius-sm);
		text-align: center;
	}
</style>
