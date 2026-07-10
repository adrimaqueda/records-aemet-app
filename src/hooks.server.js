// SEO en servidor. La app es SPA (ssr=false en casi todas las rutas), así que
// las meta puestas con <svelte:head> solo existen tras ejecutar JS y los
// crawlers sin JS (bots de LLMs, scrapers de redes, Google en su primer pase)
// no las ven. Aquí reescribimos en el HTML servido —también durante el
// prerender— el título, la descripción, la canónica y las etiquetas OG/Twitter
// de cada ruta. Para /estacion/[ind] se consulta su JSON de detalle y la
// tarjeta OG apunta a su imagen dinámica (/estacion/[ind]/og).
import { DATA_BASE } from "$lib/data/data.js";
import { SITE_URL, PAGE_META, DEFAULT_DESCRIPTION, SITE_NAME, stationMeta } from "$lib/seo.js";

const escAttr = (s) =>
	String(s).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

// Reemplazo por propiedad del meta (no por la URL actual), para que siga
// funcionando aunque cambie el contenido estático de app.html. El \s+ tolera
// el salto de línea que prettier mete entre atributos; la función como
// replacement evita que "$" en el valor se interprete.
const setMeta = (html, attr, value) =>
	html.replace(
		new RegExp(`(<meta\\s+${attr}\\s+content=")[^"]*(")`),
		(_, a, b) => a + escAttr(value) + b,
	);

const setCanonical = (html, url) =>
	html.replace(
		new RegExp(`(<link rel="canonical" href=")[^"]*(")`),
		(_, a, b) => a + escAttr(url) + b,
	);

export async function handle({ event, resolve }) {
	const path = event.url.pathname.replace(/\/+$/, "") || "/";
	const match = path.match(/^\/estacion\/([^/]+)$/);

	let meta = PAGE_META[path];
	let ogImage = `${SITE_URL}/og-image.png`;

	if (match) {
		const ind = match[1];
		ogImage = `${SITE_URL}/estacion/${ind}/og`;
		meta = { title: `Estación ${ind} · ${SITE_NAME}`, description: DEFAULT_DESCRIPTION };
		try {
			const res = await event.fetch(`${DATA_BASE}/stations/${encodeURIComponent(ind)}.json`);
			if (res.ok) meta = stationMeta(await res.json());
		} catch {
			// sin red o estación desconocida: se queda el título genérico
		}
	}

	if (!meta) return resolve(event); // 404s, endpoints, etc.: no tocar

	const pageUrl = path === "/" ? `${SITE_URL}/` : SITE_URL + path;
	// /datos y /metodologia tienen SSR y emiten su <title> vía <svelte:head>;
	// en el resto (shell sin SSR) hay que inyectarlo en el HTML.
	const injectTitle = !(path in PAGE_META) || path === "/";

	return resolve(event, {
		transformPageChunk: ({ html }) => {
			html = setMeta(html, 'name="description"', meta.description);
			html = setMeta(html, 'property="og:title"', meta.title);
			html = setMeta(html, 'property="og:description"', meta.description);
			html = setMeta(html, 'property="og:url"', pageUrl);
			html = setMeta(html, 'property="og:image"', ogImage);
			html = setMeta(html, 'name="twitter:title"', meta.title);
			html = setMeta(html, 'name="twitter:description"', meta.description);
			html = setMeta(html, 'name="twitter:image"', ogImage);
			html = setCanonical(html, pageUrl);
			if (injectTitle) {
				html = html.replace("<head>", `<head>\n\t<title>${escAttr(meta.title)}</title>`);
			}
			return html;
		},
	});
}
