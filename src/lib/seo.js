// Metadatos SEO compartidos entre el cliente (<svelte:head> de cada página) y
// hooks.server.js, que los inyecta en el HTML servido para que los crawlers
// sin JavaScript (Google antes de renderizar, bots de LLMs, scrapers de redes)
// vean título, descripción y canónica correctos en cada ruta.

export const SITE_URL = "https://records-temperatura.adrimaqueda.com";
export const SITE_NAME = "Récords de temperatura";

export const DEFAULT_DESCRIPTION =
	"Cada estación de AEMET y el último récord de calor que ha batido, en un mapa de España que se actualiza a diario.";

/** Título y descripción por ruta estática. La home y /estacion/* se sirven
 *  sin SSR, así que hooks.server.js inyecta también su <title>. */
export const PAGE_META = {
	"/": {
		title: "Récords de temperatura en España · Mapa AEMET",
		description: DEFAULT_DESCRIPTION,
	},
	"/datos": {
		title: "Récords de temperatura por año y mes · Récords de temperatura",
		description:
			"Cuántos récords de calor se baten cada año y cada mes en España: agregado histórico de la red de estaciones de AEMET —cada estación desde que tiene datos—, filtrable por provincia y estación.",
	},
	"/metodologia": {
		title: "Metodología · Récords de temperatura",
		description:
			"Cómo se calculan los récords de temperatura de cada estación de AEMET: fuente de datos, qué cuenta como récord, récords provisionales, actualización diaria y licencia.",
	},
};

/** "MADRID, RETIRO" → "Madrid, Retiro" (mismo criterio que la tarjeta OG). */
function capWords(s) {
	return String(s)
		.toLowerCase()
		.replace(/(^|[\s/(.-])\p{L}/gu, (c) => c.toUpperCase());
}

const fmtValor = (v) => `${String(v).replace(".", ",")} °C`;

/** Título y descripción de la ficha de una estación a partir de su JSON de
 *  detalle (stations/[indicativo].json). */
export function stationMeta(st) {
	const nombre = capWords((st.nombre || "Estación").replace(/\s+/g, " ").trim());
	const prov = st.provincia ? capWords(st.provincia) : "";
	const lugar =
		prov && !nombre.toLowerCase().includes(prov.toLowerCase()) ? `${nombre} (${prov})` : nombre;

	const partes = [];
	const max = st.vigentes?.absolutoMax;
	const min = st.vigentes?.absolutoMin;
	if (max?.valor != null) partes.push(`día más caluroso ${fmtValor(max.valor)}`);
	if (min?.valor != null) partes.push(`noche más cálida ${fmtValor(min.valor)}`);
	const desde = st.datosDesde ? ` Serie de AEMET desde ${st.datosDesde.slice(0, 4)}.` : "";

	return {
		title: `Récords de temperatura en ${lugar} · Estación de AEMET`,
		description:
			`Historial de récords de temperatura de la estación de AEMET de ${lugar}` +
			(partes.length ? `: ${partes.join(", ")}.` : ".") +
			` Récords absolutos y mensuales, actualizados a diario.${desde}`,
	};
}
