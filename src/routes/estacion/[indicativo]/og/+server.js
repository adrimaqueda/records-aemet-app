// Imagen OG dinámica por estación: GET /estacion/[indicativo]/og → PNG 1200×630.
// La tarjeta (nombre, récords vigentes y punto resaltado) la pinta @vercel/og.
import { ImageResponse } from "@vercel/og";
import { ogElement, highlightPx } from "$lib/og/card.js";
import { DATA_BASE } from "$lib/data/data.js";

// Cache de fuentes a nivel de instancia (persisten entre invocaciones en caliente).
let fonts;
async function loadFonts(fetch, origin) {
	if (fonts) return fonts;
	const [reg, bold] = await Promise.all([
		fetch(`${origin}/og/inter-400.woff`).then((r) => r.arrayBuffer()),
		fetch(`${origin}/og/inter-700.woff`).then((r) => r.arrayBuffer()),
	]);
	fonts = [
		{ name: "Inter", data: reg, weight: 400, style: "normal" },
		{ name: "Inter", data: bold, weight: 700, style: "normal" },
	];
	return fonts;
}

export async function GET({ params, url, fetch }) {
	const origin = url.origin;

	const res = await fetch(`${DATA_BASE}/stations/${encodeURIComponent(params.indicativo)}.json`);
	if (!res.ok) return new Response("Estación no encontrada", { status: 404 });
	const st = await res.json();

	const hl =
		Number.isFinite(st.lat) && Number.isFinite(st.lon) ? highlightPx(st.lat, st.lon) : null;

	return new ImageResponse(ogElement(st, `${origin}/og/basemap.png`, hl), {
		width: 1200,
		height: 630,
		fonts: await loadFonts(fetch, origin),
		headers: {
			// Cacheable en el CDN de Vercel; se regenera como mucho a diario.
			"cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
		},
	});
}
