// Sitemap dinámico: las tres páginas estáticas + una URL por estación activa.
// Se sirve por función serverless (no se prerenderiza) para que la lista de
// estaciones esté siempre al día con el catálogo publicado por el pipeline.
import { DATA_BASE } from "$lib/data/data.js";
import { SITE_URL } from "$lib/seo.js";

export const prerender = false;

export async function GET({ fetch }) {
	const res = await fetch(`${DATA_BASE}/stations.json`);
	if (!res.ok) return new Response("stations.json no disponible", { status: 503 });
	const stations = await res.json();

	const urls = [
		`${SITE_URL}/`,
		`${SITE_URL}/datos`,
		`${SITE_URL}/metodologia`,
		...stations.map((s) => `${SITE_URL}/estacion/${encodeURIComponent(s.indicativo)}`),
	];

	const xml =
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
		urls.map((u) => `\t<url><loc>${u}</loc></url>`).join("\n") +
		`\n</urlset>\n`;

	return new Response(xml, {
		headers: {
			"content-type": "application/xml; charset=utf-8",
			// Cacheable en el CDN de Vercel un día; el catálogo cambia poco.
			"cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
		},
	});
}
