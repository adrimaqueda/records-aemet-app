// Los JSONs los publica el pipeline (`extremos-publish`) en un dataset de
// HuggingFace; la app los lee de ahí por defecto, en dev y en producción.
// Para desarrollar contra outputs locales, define VITE_DATA_BASE_URL (p. ej.
// sirviendo pipeline/outputs/ en un estático y apuntando ahí).
const HF_BASE = "https://huggingface.co/datasets/adrimaqueda/records-aemet/resolve/main";
const BASE = import.meta.env.VITE_DATA_BASE_URL ?? HF_BASE;

/** URL base del dataset (la usa también el endpoint OG en server). */
export const DATA_BASE = BASE;

export async function fetchStations() {
	const res = await fetch(`${BASE}/stations.json`);
	if (!res.ok) throw new Error(`stations.json: ${res.status}`);
	return res.json();
}

export async function fetchStationDetail(indicativo) {
	const res = await fetch(`${BASE}/stations/${indicativo}.json`);
	if (!res.ok) throw new Error(`stations/${indicativo}: ${res.status}`);
	return res.json();
}

export async function fetchStats() {
	const res = await fetch(`${BASE}/stats.json`);
	if (!res.ok) throw new Error(`stats.json: ${res.status}`);
	return res.json();
}

/** Clasificaciones precalculadas por el pipeline (rankings.json) para /datos:
 *  tops absolutos y por mes, récords recientes, longevos, mayor salto y
 *  estaciones que más récords baten. */
export async function fetchRankings() {
	const res = await fetch(`${BASE}/rankings.json`);
	if (!res.ok) throw new Error(`rankings.json: ${res.status}`);
	return res.json();
}

/** Convierte una fila tupla (formato compacto de stats.json) en un objeto
 *  legible usando el array de claves `rowFields` que viene en el JSON. */
export function decodeStatsRow(row, rowFields) {
	const o = {};
	for (let i = 0; i < rowFields.length; i++) o[rowFields[i]] = row[i];
	return o;
}

// Selector simplificado: máxima (calor diurno) vs mínima (noche cálida).
// Cada "familia" agrupa el récord absoluto y el mensual; el indicador
// visual diferencia cuál fue el último realmente batido.

export const FAMILIA_SHORT = {
	max: "Máxima",
	min: "Mínima",
};

export const FAMILIAS = ["max", "min"];

/** Para una familia, devuelve los keys de tipo del ultimoPorTipo / recientes15d. */
export const FAMILIA_TIPOS = {
	max: { absoluto: "absolutoMax", mensual: "mensualMax" },
	min: { absoluto: "absolutoMin", mensual: "mensualMin" },
};
