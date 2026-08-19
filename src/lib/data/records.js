// Utilidades de récords por estación compartidas entre la página de detalle y
// el panel del mapa.

import { FAMILIA_TIPOS } from "./data.js";

/**
 * Devuelve el último récord de una familia ("max" o "min"), recorriendo el
 * absoluto vigente + los 12 mensuales y quedándose con el más reciente.
 * Empata a favor del absoluto (cuando un mismo día bate ambos).
 *
 * @param {any} d  detalle de estación (stations/<indicativo>.json).
 * @param {"max"|"min"} fam  familia de récord.
 */
export function latestInFamily(d, fam) {
	const absKey = fam === "max" ? "absolutoMax" : "absolutoMin";
	const monKey = fam === "max" ? "max" : "min";
	const tipoAbs = fam === "max" ? "absoluto-max" : "absoluto-min";
	const tipoMon = fam === "max" ? "mensual-max" : "mensual-min";

	const items = [];
	if (d.vigentes[absKey]) {
		items.push({ ...d.vigentes[absKey], tipo: tipoAbs, mes: null });
	}
	for (const m of d.mensuales ?? []) {
		if (m[monKey]) items.push({ ...m[monKey], tipo: tipoMon, mes: m.mes });
	}
	if (items.length === 0) return null;
	items.sort((a, b) => {
		if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
		return a.tipo === tipoAbs ? -1 : 1;
	});
	return items[0];
}

// ---------------------------------------------------------------------------
// Récords VIGENTES por año (usado por el filtro de año del mapa y por la vista
// "Vigentes" de /datos).
//
// `stations.json` trae, por estación, `ultimoPorTipo`: el último récord vigente
// de cada tipo (absolutoMax, mensualMax, absolutoMin, mensualMin). No trae los
// 12 mensuales vigentes —eso vive en stations/<indicativo>.json, un fetch por
// estación—, así que la unidad que podemos contar de forma exacta para toda la
// red es la ESTACIÓN: el año de su récord vigente más reciente por familia.
// Por eso mapa y gráfica hablan de "estaciones cuyo récord actual es de X".
// ---------------------------------------------------------------------------

/**
 * Último récord vigente de una familia para una fila de `stations.json`,
 * comparando el absoluto con el mensual y quedándose con el más reciente
 * (empate a favor del absoluto). Equivale a `latestInFamily` pero sobre el
 * catálogo ligero en vez del detalle completo.
 *
 * @param {any} s  fila de stations.json.
 * @param {"max"|"min"} fam
 * @returns {{fecha: string, valor: number, provisional?: boolean, esAbsoluto: boolean} | null}
 */
export function ultimoVigenteEnFamilia(s, fam) {
	const { absoluto, mensual } = FAMILIA_TIPOS[fam];
	const a = s.ultimoPorTipo?.[absoluto];
	const m = s.ultimoPorTipo?.[mensual];
	if (!a && !m) return null;
	if (!a) return { ...m, esAbsoluto: false };
	if (!m) return { ...a, esAbsoluto: true };
	// Las fechas son ISO (yyyy-mm-dd): el orden lexicográfico es el cronológico.
	return a.fecha >= m.fecha ? { ...a, esAbsoluto: true } : { ...m, esAbsoluto: false };
}

/** Año del récord vigente más reciente de la familia, o null si no hay. */
export function anioDeVigente(s, fam) {
	const u = ultimoVigenteEnFamilia(s, fam);
	return u?.fecha ? +u.fecha.slice(0, 4) : null;
}

/**
 * Cuántos de los récords vigentes conocidos de la familia (el absoluto y el
 * mensual más reciente) están fechados en `anio`. Sirve para el badge "×2" del
 * listado: 2 = ese año la estación fijó tanto su absoluto como su mensual.
 */
export function vigentesEnAnio(s, fam, anio) {
	const { absoluto, mensual } = FAMILIA_TIPOS[fam];
	const t = s.ultimoPorTipo ?? {};
	let n = 0;
	for (const k of [absoluto, mensual]) {
		const r = t[k];
		if (r?.fecha && +r.fecha.slice(0, 4) === anio) n++;
	}
	return n;
}

/** Años (descendente) en los que alguna estación tiene su récord vigente de la familia. */
export function aniosConVigentes(stations, fam) {
	const set = new Set();
	for (const s of stations ?? []) {
		const y = anioDeVigente(s, fam);
		if (y != null) set.add(y);
	}
	return [...set].sort((a, b) => b - a);
}

/**
 * Filas para la gráfica de /datos: por año, cuántas estaciones tienen ahí su
 * récord vigente más reciente de máxima y de mínima. Rellena todos los años del
 * rango (incluidos los que quedan a cero) para que el eje no tenga saltos.
 *
 * @param {any[]} stations  estaciones del ámbito (red completa o provincia).
 * @param {{anioMax?: number|null}} [opts]  último año del dataset, para que la
 *        serie llegue hasta hoy aunque el año en curso aún no tenga récords.
 */
export function vigentesPorAnio(stations, { anioMax = null } = {}) {
	const porAnio = new Map();
	let y0 = Infinity;
	let y1 = -Infinity;

	for (const s of stations ?? []) {
		for (const fam of ["max", "min"]) {
			const y = anioDeVigente(s, fam);
			if (y == null) continue;
			if (!porAnio.has(y)) porAnio.set(y, { max: 0, min: 0 });
			porAnio.get(y)[fam]++;
			if (y < y0) y0 = y;
			if (y > y1) y1 = y;
		}
	}
	if (!Number.isFinite(y0)) return [];
	if (anioMax != null && anioMax > y1) y1 = anioMax;

	const total = stations.length;
	const out = [];
	for (let y = y0; y <= y1; y++) {
		const c = porAnio.get(y) ?? { max: 0, min: 0 };
		out.push({
			label: String(y),
			labelLong: `Año ${y}`,
			recordsMax: c.max,
			recordsMin: c.min,
			totalRecords: c.max + c.min,
			// Denominador del tooltip: estaciones del ámbito. `estacionesBatieron*`
			// coincide con el recuento porque aquí la unidad ya es la estación.
			estacionesConDatos: total,
			estacionesBatieronMax: c.max,
			estacionesBatieronMin: c.min,
			pctMax: total > 0 ? (c.max / total) * 100 : 0,
			pctMin: total > 0 ? (c.min / total) * 100 : 0,
		});
	}
	return out;
}
