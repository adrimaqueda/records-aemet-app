// Utilidades de récords por estación compartidas entre el mapa, la ficha de
// estación y /datos.

import { FAMILIAS, FAMILIA_TIPOS } from "./data.js";

/**
 * Devuelve el último récord de una familia ("max" o "min"), recorriendo el
 * absoluto vigente + los 12 mensuales y quedándose con el más reciente.
 * Empata a favor del absoluto (cuando un mismo día bate ambos).
 *
 * @param {any} d  detalle de estación (stations/<indicativo>.json).
 * @param {"max"|"min"} fam  familia de récord.
 */
export function latestInFamily(d, fam) {
	const abs = d.vigentes[FAMILIA_TIPOS[fam].absoluto];
	let best = abs ? { ...abs, tipo: `absoluto-${fam}`, mes: null } : null;
	for (const m of d.mensuales ?? []) {
		const r = m[fam];
		// Las fechas son ISO (yyyy-mm-dd): el orden lexicográfico es el cronológico.
		if (r && (!best || r.fecha > best.fecha)) best = { ...r, tipo: `mensual-${fam}`, mes: m.mes };
	}
	return best;
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

const anioDe = (fecha) => +fecha.slice(0, 4);

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
	if (a && (!m || a.fecha >= m.fecha)) return { ...a, esAbsoluto: true };
	return m ? { ...m, esAbsoluto: false } : null;
}

/** Año del récord vigente más reciente de la familia, o null si no hay. */
export function anioDeVigente(s, fam) {
	const u = ultimoVigenteEnFamilia(s, fam);
	return u ? anioDe(u.fecha) : null;
}

/**
 * Cuántos de los récords vigentes conocidos de la familia (el absoluto y el
 * mensual más reciente) están fechados en `anio`. Sirve para el badge "×2" del
 * listado: 2 = ese año la estación fijó tanto su absoluto como su mensual.
 */
export function vigentesEnAnio(s, fam, anio) {
	const { absoluto, mensual } = FAMILIA_TIPOS[fam];
	return [absoluto, mensual].filter((k) => {
		const r = s.ultimoPorTipo?.[k];
		return r && anioDe(r.fecha) === anio;
	}).length;
}

/**
 * Filas para la gráfica de /datos: por año, cuántas estaciones tienen ahí su
 * récord vigente más reciente de máxima y de mínima. Rellena todos los años del
 * rango (incluidos los que quedan a cero) para que el eje no tenga saltos.
 *
 * @param {any[]} stations  estaciones del ámbito (red completa o provincia).
 * @param {number|null} anioMax  último año del dataset, para que la serie llegue
 *        hasta hoy aunque el año en curso aún no tenga récords.
 */
export function vigentesPorAnio(stations, anioMax = null) {
	const porAnio = new Map();
	for (const s of stations) {
		for (const fam of FAMILIAS) {
			const y = anioDeVigente(s, fam);
			if (y == null) continue;
			if (!porAnio.has(y)) porAnio.set(y, { max: 0, min: 0 });
			porAnio.get(y)[fam]++;
		}
	}
	if (porAnio.size === 0) return [];

	const years = [...porAnio.keys()];
	const y0 = Math.min(...years);
	const y1 = Math.max(anioMax ?? -Infinity, ...years);
	// Denominador del tooltip: estaciones del ámbito.
	const total = stations.length;
	const out = [];
	for (let y = y0; y <= y1; y++) {
		const c = porAnio.get(y) ?? { max: 0, min: 0 };
		out.push({
			label: String(y),
			labelLong: `Año ${y}`,
			recordsMax: c.max,
			recordsMin: c.min,
			estacionesConDatos: total,
			pctMax: (c.max / total) * 100,
			pctMin: (c.min / total) * 100,
		});
	}
	return out;
}
