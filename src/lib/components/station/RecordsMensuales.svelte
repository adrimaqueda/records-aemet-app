<script>
	import { fmtTemp, fmtDate, MESES } from "$lib/utils/format.js";
	import ProvisionalTag from "$lib/components/ui/ProvisionalTag.svelte";
	let { detail } = $props();

	const currentYear = new Date().getFullYear().toString();
	const esEsteAnio = (r) => r?.fecha?.slice(0, 4) === currentYear;

	/** ¿Es este registro mensual el récord absoluto vigente de su familia?
	 *  Se marca en color para que coincida con las cards de arriba. */
	const esAbsoluto = (r, fam) => {
		const abs = fam === "max" ? detail.vigentes.absolutoMax : detail.vigentes.absolutoMin;
		return !!(r && abs && r.fecha === abs.fecha);
	};
</script>

<section>
	<div class="section-head">
		<h2>Récords mensuales</h2>
		<p class="caption">El día más caluroso y la noche más cálida de cada mes.</p>
		<p class="caption keys">
			<span class="key">
				<span class="dot dot-max"></span>
				<span class="dot dot-min"></span>
				récord absoluto.
			</span>
			<span class="key">
				<b>En negrita</b>
				, récord de {currentYear}
			</span>
		</p>
	</div>

	<table>
		<thead>
			<tr>
				<th class="mes-col">Mes</th>
				<th>Día más caluroso</th>
				<th>Noche más cálida</th>
			</tr>
		</thead>
		<tbody>
			{#each detail.mensuales as m (m.mes)}
				{@const cells = [
					{ r: m.max, fam: "max" },
					{ r: m.min, fam: "min" },
				]}
				<tr>
					<th scope="row" class="mes">{MESES[m.mes]}</th>
					{#each cells as { r, fam } (fam)}
						{@const absoluto = esAbsoluto(r, fam)}
						{@const anio = esEsteAnio(r)}
						<td class:absoluto class:anio data-fam={fam}>
							{#if r}
								<span class="t">{fmtTemp(r.valor)}</span>
								<span class="d">
									{fmtDate(r.fecha)}{#if r.provisional}<ProvisionalTag />{/if}
								</span>
							{:else}
								<span class="t empty">—</span>
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<style>
	.section-head {
		margin-bottom: 1.1rem;
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
		color: var(--faint);
	}
	.keys {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 0.5cap;
		margin-top: 0.45rem;
	}
	.key {
		display: inline-flex;
		align-items: center;
		/*gap: 0.35rem;*/
	}
	.key b {
		color: var(--ink);
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin-inline: 5px;
	}
	.dot-max {
		background: var(--max);
	}
	.dot-min {
		background: var(--min);
		margin-left: 1px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	thead th {
		text-align: left;
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--faint);
		padding: 0 0.5rem 0.6rem;
		border-bottom: 1px solid var(--line-strong);
	}
	thead .mes-col {
		width: 22%;
	}
	tbody tr {
		transition: background 0.12s ease;
	}
	tbody tr:hover {
		background: color-mix(in srgb, var(--bg) 60%, transparent);
	}
	td,
	tbody th {
		padding: 0.7rem 0.5rem;
		border-bottom: 1px solid var(--line);
		vertical-align: baseline;
	}
	.mes {
		text-align: left;
		font-weight: 600;
		text-transform: capitalize;
		color: var(--muted);
		font-size: 0.9rem;
	}
	td {
		position: relative;
	}
	/* Base: el resto de récords, apagados. */
	.t {
		display: block;
		font-size: 0.98rem;
		font-weight: 500;
		color: var(--muted);
		letter-spacing: -0.01em;
	}
	.t.empty {
		color: var(--faint);
		font-weight: 400;
	}
	.d {
		display: flex;
		flex-wrap: wrap;
		margin-top: 0.1rem;
		font-size: 0.76rem;
		color: var(--faint);
		column-gap: 5px;
	}
	/* Récord de este año: en negrita y con el texto a tono normal. */
	.anio {
		.t {
			font-weight: 700;
			color: var(--ink);
		}
		.d {
			color: var(--ink);
		}
	}
	/* Récord absoluto: en color de familia (como las cards) + negrita y marca
	   lateral. Gana en especificidad al estilo de "este año". */
	.absoluto .t {
		font-weight: 700;
	}
	.absoluto[data-fam="max"] {
		.t {
			color: var(--max);
		}
	}
	.absoluto[data-fam="min"] .t {
		color: var(--min);
	}
	.absoluto::before {
		content: "";
		position: absolute;
		left: 0;
		top: 0.65rem;
		bottom: 0.65rem;
		width: 3px;
		border-radius: 999px;
	}
	.absoluto[data-fam="max"]::before {
		background: var(--max);
	}
	.absoluto[data-fam="min"]::before {
		background: var(--min);
	}

	.absoluto[data-fam="max"] .d,
	.absoluto[data-fam="min"] .d {
		color: var(--ink);
	}

	@media (max-width: 520px) {
		.t {
			font-size: 0.9rem;
		}
		td,
		tbody th {
			padding: 0.6rem 0.35rem;
		}
	}
</style>
