import { browser } from "$app/environment";

// Los JSONs los publica el pipeline (`extremos-publish`) en un dataset de
// HuggingFace; la app los lee de ahí por defecto, en dev y en producción (y
// también el servidor: hooks, sitemap y tarjeta OG). Para desarrollar contra
// outputs locales, define VITE_DATA_BASE_URL (p. ej. sirviendo
// pipeline/outputs/ en un estático y apuntando ahí).
export const DATA_BASE =
	import.meta.env.VITE_DATA_BASE_URL ??
	"https://huggingface.co/datasets/adrimaqueda/records-aemet/resolve/main";

// Caché en memoria (solo en el navegador) de las promesas de cada JSON. Como la
// app es SPA, ir del mapa a una ficha y volver, o de /datos al mapa, volvía a
// descargar los mismos ficheros; así se reutilizan y dos componentes que piden
// lo mismo a la vez comparten la petición. Caduca a los 30 min porque el
// pipeline publica datos nuevos varias veces al día; los errores no se guardan.
const TTL_MS = 30 * 60 * 1000;
const cache = new Map();

function fetchJson(path) {
	const hit = cache.get(path);
	if (hit && Date.now() - hit.t < TTL_MS) return hit.p;
	const p = fetch(`${DATA_BASE}/${path}`).then((res) => {
		if (!res.ok) throw new Error(`${path}: ${res.status}`);
		return res.json();
	});
	if (browser) {
		cache.set(path, { t: Date.now(), p });
		p.catch(() => {
			if (cache.get(path)?.p === p) cache.delete(path);
		});
	}
	return p;
}

/** Catálogo ligero de estaciones activas (lo que pinta el mapa). */
export const fetchStations = () => fetchJson("stations.json");
/** Detalle completo de una estación: vigentes, mensuales, eventos y huecos. */
export const fetchStationDetail = (indicativo) =>
	fetchJson(`stations/${encodeURIComponent(indicativo)}.json`);
/** Precarga el detalle (p. ej. al pasar el ratón por una fila) para que el
 *  panel o la ficha abran al instante. Ignora errores: ya los mostrará quien
 *  lo pida de verdad. */
export const prefetchStationDetail = (indicativo) =>
	void fetchStationDetail(indicativo).catch(() => {});
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
