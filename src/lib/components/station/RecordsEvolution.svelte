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

	let maxSel = $state("absoluto");
	let minSel = $state("absoluto");

	/** Filtra los eventos de la estación para una familia y selección. */
	function filter(fam, sel) {
		const tipoAbs = fam === "max" ? "absoluto-max" : "absoluto-min";
		const tipoMes = fam === "max" ? "mensual-max" : "mensual-min";
		if (sel === "absoluto") {
			return detail.eventos.filter((e) => e.tipo === tipoAbs);
		}
		const mes = Number(sel);
		return detail.eventos.filter((e) => e.tipo === tipoMes && e.mes === mes);
	}

	const maxEvents = $derived(filter("max", maxSel));
	const minEvents = $derived(filter("min", minSel));

	const bloques = $derived([
		{
			id: "max",
			titulo: "Evolución de la máxima",
			subtitulo: "día más caluroso",
			getSel: () => maxSel,
			setSel: (v) => (maxSel = v),
			events: maxEvents,
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
			emptyAbs: 'Sin récords de "noche más cálida" batidos en esta estación.',
			emptyMes: (m) => `Sin récords de "noche más cálida" de ${MESES[m]} todavía.`,
		},
	]);
</script>

<section class="evolution">
	<div class="section-head">
		<h2>Evolución de los récords</h2>
		<p class="caption">
			Cómo se ha ido superando cada récord a lo largo del tiempo. Cada escalón es una nueva marca;
			el color del punto indica su antigüedad. Cada vez que hay un periodo largo sin datos <span
				style="display: inline-block;height: .7lh;width: 2.1cap;background: repeating-linear-gradient(-45deg,#ccc,#ccc 0.1lh,#eee 0.1lh,#eee 0.2lh);"
			></span>
			, el valor de referencia se reinicia.
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
						<select value={b.getSel()} onchange={(e) => b.setSel(e.currentTarget.value)}>
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
					<EvolutionChart events={b.events} fam={b.id} sinDatos={detail.sinDatos} />
					<RecordDetailList events={b.events} fam={b.id} id={b.id} />
				{:else}
					<p class="muted small empty">
						{b.getSel() === "absoluto" ? b.emptyAbs : b.emptyMes(Number(b.getSel()))}
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
