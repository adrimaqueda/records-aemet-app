// Los JSONs los publica el pipeline (`extremos-publish`) en un dataset de
// HuggingFace; la app los lee de ahí por defecto, en dev y en producción (y
// también el servidor: hooks, sitemap y tarjeta OG). Para desarrollar contra
// outputs locales, define VITE_DATA_BASE_URL (p. ej. sirviendo
// pipeline/outputs/ en un estático y apuntando ahí).
export const DATA_BASE =
	import.meta.env.VITE_DATA_BASE_URL ??
	"https://huggingface.co/datasets/adrimaqueda/records-aemet/resolve/main";

async function fetchJson(path) {
	const res = await fetch(`${DATA_BASE}/${path}`);
	if (!res.ok) throw new Error(`${path}: ${res.status}`);
	return res.json();
}

/** Catálogo ligero de estaciones activas (lo que pinta el mapa). */
export const fetchStations = () => fetchJson("stations.json");
/** Detalle completo de una estación: vigentes, mensuales, eventos y huecos. */
export const fetchStationDetail = (indicativo) =>
	fetchJson(`stations/${encodeURIComponent(indicativo)}.json`);
/** Agregados por año/mes y grupo (provincia) para /datos. */
export const fetchStats = () => fetchJson("stats.json");
/** Clasificaciones precalculadas para /datos: tops absolutos y por mes,
 *  récords recientes, longevos, mayor salto y estaciones más activas. */
export const fetchRankings = () => fetchJson("rankings.json");

// Selector simplificado: máxima (calor diurno) vs mínima (noche cálida).
// Cada "familia" agrupa el récord absoluto y el mensual; el indicador
// visual diferencia cuál fue el último realmente batido.

export const FAMILIAS = ["max", "min"];

export const FAMILIA_SHORT = {
	max: "Máxima",
	min: "Mínima",
};

/** Opciones del selector de familia (<Segmented>). */
export const FAMILIA_OPCIONES = FAMILIAS.map((id) => ({ id, label: FAMILIA_SHORT[id] }));

/** Para una familia, las claves de tipo en ultimoPorTipo / recientes15d / vigentes. */
export const FAMILIA_TIPOS = {
	max: { absoluto: "absolutoMax", mensual: "mensualMax" },
	min: { absoluto: "absolutoMin", mensual: "mensualMin" },
};
