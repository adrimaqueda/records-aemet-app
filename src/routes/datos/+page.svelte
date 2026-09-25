<script>
	import { fetchStats, fetchStations, fetchStationDetail } from "$lib/data/data.js";
	import { MESES } from "$lib/utils/format.js";
	import { PAGE_META } from "$lib/seo.js";
	import TopBar from "$lib/components/ui/TopBar.svelte";
	import PageHero from "$lib/components/ui/PageHero.svelte";
	import Segmented from "$lib/components/ui/Segmented.svelte";
	import RankingTables from "$lib/components/datos/RankingTables.svelte";
	import RecordsChart from "$lib/components/datos/RecordsChart.svelte";
	import { vigentesPorAnio } from "$lib/data/records.js";
	import { group, min, sum } from "d3-array";

	/** Vistas de la gráfica. "vigentes" no cuenta récords batidos sino estaciones
	 *  cuyo récord sigue en pie, agrupadas por el año en que lo fijaron. */
	const VISTAS = [
		{ id: "anual", label: "Año a año" },
		{ id: "mensual", label: "Mes a mes" },
		{ id: "vigentes", label: "Vigentes" },
	];

	// --- estado ---------------------------------------------------------
	// Los JSON se guardan con $state.raw: se sustituyen enteros y nunca se
	// mutan, así que el proxy profundo de $state solo añadiría coste.
	let stats = $state.raw(null);
	let stations = $state.raw(null); // se carga bajo demanda
	let loadError = $state(null);
	let grupo = $state("total");
	/** 'anual' = un año por barra · 'mensual' = 12 meses de un año ·
	 *  'vigentes' = estaciones por año del récord que sigue en pie */
	let vista = $state("anual");
	let anio = $state(null);
	// Estación seleccionada dentro de una provincia: en vez de navegar a su
	// ficha, filtramos la gráfica a sus propios récords (acumulado por estación).
	let estacionSel = $state("");
	let stationDetail = $state.raw(null);

	$effect(() => {
		fetchStats()
			.then((s) => {
				stats = s;
				// Año por defecto de "mes a mes" = el más reciente disponible.
				anio = s.anioMax;
			})
			.catch((e) => (loadError = String(e)));
	});

	// Lazy-load del catálogo de estaciones: al elegir una provincia y en la vista
	// "vigentes", que se calcula entera en cliente a partir de stations.json.
	$effect(() => {
		if ((grupo !== "total" || vista === "vigentes") && stations == null) {
			fetchStations()
				.then((s) => (stations = s))
				.catch((e) => console.warn("No se pudo cargar stations.json", e));
		}
	});

	// Lazy-load del detalle de la estación elegida (fetchStationDetail ya lo
	// cachea en memoria). El detalle trae todos los eventos de récord, así que
	// el acumulado por estación se calcula en cliente sin tocar el pipeline.
	$effect(() => {
		const ind = estacionSel;
		if (!ind) return;
		fetchStationDetail(ind)
			.then((d) => {
				if (estacionSel === ind) stationDetail = d;
			})
			.catch((e) => console.warn("No se pudo cargar la estación", e));
	});

	// --- derivaciones ---------------------------------------------------

	/** Filas del agregado de grupo (stats.json): cada fila es una tupla con las
	 *  claves de `rowFields`. Por barra: récords de máxima/mínima (absoluto +
	 *  mensual) y el % de estaciones que batieron récord de cada familia. */
	function rowsForGroup(s) {
		const row = (tupla, label, labelLong) => {
			const r = Object.fromEntries(s.rowFields.map((k, i) => [k, tupla[i]]));
			const denom = r.estacionesConDatos;
			return {
				...r,
				label,
				labelLong,
				recordsMax: r.absolutoMax + r.mensualMax,
				recordsMin: r.absolutoMin + r.mensualMin,
				pctMax: denom > 0 ? (r.estacionesBatieronMax / denom) * 100 : 0,
				pctMin: denom > 0 ? (r.estacionesBatieronMin / denom) * 100 : 0,
			};
		};
		if (vista === "anual") {
			return (s.anual[grupo] ?? []).map((t, i) => row(t, String(s.anios[i]), `Año ${s.anios[i]}`));
		}
		return (s.mensual[grupo] ?? []).flatMap((t, i) => {
			const [a, m] = s.ejeMensual[i];
			return a === anio ? [row(t, MESES[m].slice(0, 3), `${MESES[m]} ${a}`)] : [];
		});
	}

	/** Igual que rowsForGroup pero para una sola estación: cuenta sus eventos de
	 *  récord (absoluto + mensual) por periodo. El % de estaciones no aplica con
	 *  n=1, así que se omite (estacionesConDatos = 0). */
	function rowsForStation(detail) {
		const row = (label, labelLong, eventos) => ({
			label,
			labelLong,
			recordsMax: eventos.filter((e) => e.tipo.endsWith("-max")).length,
			recordsMin: eventos.filter((e) => e.tipo.endsWith("-min")).length,
			estacionesConDatos: 0,
		});
		const anioDe = (e) => +e.fecha.slice(0, 4);

		if (vista === "anual") {
			if (detail.eventos.length === 0) return [];
			const porAnio = group(detail.eventos, anioDe);
			// Rellena TODOS los años del rango (incluidos los de cero récords).
			const out = [];
			for (let y = min(porAnio.keys()); y <= stats.anioMax; y++) {
				out.push(row(String(y), `Año ${y}`, porAnio.get(y) ?? []));
			}
			return out;
		}

		// Mes a mes del año seleccionado.
		const delAnio = detail.eventos.filter((e) => anioDe(e) === anio);
		return MESES.slice(1).map((mes, i) =>
			row(
				mes.slice(0, 3),
				`${mes} ${anio}`,
				delAnio.filter((e) => +e.fecha.slice(5, 7) === i + 1),
			),
		);
	}

	const esVigentes = $derived(vista === "vigentes");
	const grupoActual = $derived(stats?.grupos.find((g) => g.id === grupo));
	/** Estaciones de la provincia seleccionada, por nombre. */
	const groupStations = $derived.by(() => {
		if (!stations || !grupoActual?.provinciasAemet.length) return [];
		const provincias = new Set(grupoActual.provinciasAemet);
		return stations
			.filter((st) => provincias.has(st.provincia))
			.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
	});
	/** Estaciones del ámbito elegido (toda la red o una provincia). */
	const stationsAmbito = $derived(grupo === "total" ? (stations ?? []) : groupStations);
	// Estamos en "modo estación" cuando hay una elegida y su detalle ya cargó.
	// No aplica a la vista "vigentes": una sola estación daría una única barra.
	const modoEstacion = $derived(
		!esVigentes && !!estacionSel && stationDetail?.indicativo === estacionSel,
	);

	const data = $derived.by(() => {
		if (!stats) return [];
		// "vigentes" se calcula en cliente desde stations.json, porque stats.json
		// cuenta récords batidos (incluidos los ya superados) y aquí interesan
		// solo los que siguen en pie.
		if (esVigentes) return stations ? vigentesPorAnio(stationsAmbito, stats.anioMax) : [];
		// Mientras una estación está seleccionada pero su detalle aún no llegó, no
		// mostramos el agregado de provincia (evita un parpadeo de datos ajenos).
		if (estacionSel) return modoEstacion ? rowsForStation(stationDetail) : [];
		return rowsForGroup(stats);
	});

	/** Última barra de la serie de vigentes = el año más reciente del dataset. */
	const filaUltima = $derived(esVigentes ? data.at(-1) : null);
	// Nombre del ámbito mostrado (provincia/total o estación) y años disponibles
	// para el selector "mes a mes" (los de la estación cuando hay una elegida).
	const grupoNombre = $derived(grupoActual?.nombre ?? grupo);
	const ambitoNombre = $derived(modoEstacion ? stationDetail.nombre : grupoNombre);
	const stationYears = $derived(
		modoEstacion
			? [...new Set(stationDetail.eventos.map((e) => +e.fecha.slice(0, 4)))].sort((a, b) => a - b)
			: null,
	);
	const aniosOpts = $derived(stationYears ?? stats?.anios ?? []);
	// Si la estación no tiene récords en el año elegido, salta a su año más
	// reciente con datos para que la vista "mes a mes" no quede vacía.
	$effect(() => {
		if (stationYears?.length && !stationYears.includes(anio)) anio = stationYears.at(-1);
	});
	// Resúmenes
	const totalMax = $derived(sum(data, (d) => d.recordsMax));
	const totalMin = $derived(sum(data, (d) => d.recordsMin));
</script>

<svelte:head>
	<title>{PAGE_META["/datos"].title}</title>
</svelte:head>

<TopBar current="datos" />

<div class="page">
	<main>
		<PageHero eyebrow="Red AEMET · histórico completo" title="Récords por año y mes">
			{#if esVigentes}
				De los récords que hoy <strong>siguen en pie</strong>
				en la red, en qué año se fijaron. Cada estación cuenta una vez por familia, en el año de su récord
				vigente más reciente. Es la misma cuenta que el filtro de año del mapa.
			{:else}
				Agregado histórico de récords batidos en la red AEMET, con el porcentaje de estaciones que
				vivieron al menos un récord en cada periodo. Máxima y mínima se muestran por separado.
			{/if}
		</PageHero>

		{#if loadError}
			<p class="error">Error: {loadError}</p>
		{:else if !stats}
			<p class="muted">Cargando…</p>
		{:else}
			<!-- Selectores -->
			<div class="controls" role="group" aria-label="Filtros">
				<label class="control">
					<span class="ctl-label">Ámbito</span>
					<select
						bind:value={
							() => grupo,
							(v) => {
								grupo = v;
								// La estación elegida es de la provincia anterior.
								estacionSel = "";
							}
						}
					>
						{#each stats.grupos as og (og.id)}
							<option value={og.id}>{og.nombre} · {og.nEstaciones} est.</option>
						{/each}
					</select>
				</label>

				<div class="control">
					<span class="ctl-label">Vista</span>
					<Segmented options={VISTAS} bind:value={vista} label="Vista" />
				</div>

				{#if vista === "mensual"}
					<label class="control">
						<span class="ctl-label">Año</span>
						<select bind:value={anio}>
							{#each aniosOpts.slice().reverse() as y (y)}
								<option value={y}>{y}</option>
							{/each}
						</select>
					</label>
				{/if}

				<!-- Selector de estación SOLO si hay provincia elegida. Al elegir
				     una, la gráfica pasa a mostrar el acumulado de ESA estación;
				     dejándolo en blanco se vuelve al agregado de la provincia. -->
				{#if !esVigentes && grupo !== "total" && groupStations.length > 0}
					<label class="control">
						<span class="ctl-label">Estación</span>
						<select bind:value={estacionSel}>
							<option value="">Toda la provincia · {groupStations.length} est.</option>
							{#each groupStations as st (st.indicativo)}
								<option value={st.indicativo}>{st.nombre}</option>
							{/each}
						</select>
					</label>
				{/if}
			</div>

			<!-- Resumen -->
			{#if esVigentes}
				{#if !stations}
					<p class="summary muted">Cargando estaciones…</p>
				{:else if filaUltima}
					<p class="summary">
						<strong>{grupoNombre}</strong>
						· De las {stationsAmbito.length.toLocaleString("es-ES")} estaciones del mapa →
						<strong>{filaUltima.recordsMax.toLocaleString("es-ES")}</strong>
						tienen su récord de máxima vigente fechado en {filaUltima.label} ·
						<strong>{filaUltima.recordsMin.toLocaleString("es-ES")}</strong>
						el de mínima
					</p>
				{/if}
			{:else if estacionSel && !modoEstacion}
				<p class="summary muted">Cargando récords de la estación…</p>
			{:else if data.length > 0}
				<p class="summary">
					<strong>{ambitoNombre}</strong>
					·
					{vista === "anual" ? `${data[0].label}–${data.at(-1).label}` : `año ${anio}`}
					→
					<strong>{totalMax.toLocaleString("es-ES")}</strong>
					récords de máxima ·
					<strong>{totalMin.toLocaleString("es-ES")}</strong>
					récords de mínima
					{#if modoEstacion}
						<span class="tip-sep">·</span>
						<a href="/estacion/{estacionSel}">Ver ficha completa →</a>
					{/if}
				</p>
			{/if}

			<RecordsChart {data} {vista} {modoEstacion} />

			<RankingTables />
		{/if}

		<p class="footer small muted">
			¿Cómo se calculan estos números? Lee la
			<a href="/metodologia">metodología</a>
			.
		</p>
	</main>
</div>

<style>
	.page {
		max-width: 1040px;
		margin: 0 auto;
		padding: clamp(1.5rem, 5vw, 3rem) clamp(1rem, 5vw, 2rem) 5rem;
		line-height: 1.45;
	}
	main {
		display: flex;
		flex-direction: column;
	}

	/* --- Controles ---------------------------------------------------- */
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem 1rem;
		align-items: end;
		margin: 0 0 1.25rem;
	}
	.control {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.ctl-label {
		font-size: 0.68rem;
		color: var(--faint);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
	}
	select {
		font-size: 0.86rem;
		padding: 0.45rem 2rem 0.45rem 0.8rem;
		min-width: 13rem;
	}

	/* --- Resumen ----------------------------------------------------- */
	.summary {
		margin: 0 0 0.75rem;
		font-size: 0.92rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.summary strong {
		color: var(--ink);
	}
	.tip-sep {
		color: var(--faint);
	}

	/* --- Notas -------------------------------------------------------- */
	.small {
		font-size: 0.82rem;
	}
	.muted {
		color: var(--faint);
	}
	.error {
		color: #b00;
	}
	.footer {
		margin: 2rem 0 0;
	}
	a {
		color: var(--max);
		font-weight: 500;
	}
	a:hover {
		text-decoration: underline;
	}
</style>
