// La app es SPA (ssr=false), así que las meta puestas en cliente no las ven los
// scrapers de redes. Para que al compartir una estación salga SU tarjeta, aquí
// reescribimos en el HTML servido las meta og:image/twitter:image/og:url para
// apuntar a su imagen dinámica (/estacion/[ind]/og). El nombre y los récords van
// dentro de la propia imagen. El resto de rutas no se tocan.
export async function handle({ event, resolve }) {
	const match = event.url.pathname.match(/^\/estacion\/([^/]+)\/?$/);
	if (!match) return resolve(event);

	const ind = match[1];
	const origin = event.url.origin;
	const ogImage = `${origin}/estacion/${ind}/og`;
	const pageUrl = `${origin}/estacion/${ind}`;

	// Reemplazo por propiedad del meta (no por la URL actual), para que siga
	// funcionando aunque se cambie el dominio estático en app.html.
	const setMeta = (html, attr, value) =>
		html.replace(new RegExp(`(<meta ${attr} content=")[^"]*(")`), `$1${value}$2`);

	return resolve(event, {
		transformPageChunk: ({ html }) => {
			html = setMeta(html, 'property="og:image"', ogImage);
			html = setMeta(html, 'name="twitter:image"', ogImage);
			html = setMeta(html, 'property="og:url"', pageUrl);
			return html;
		},
	});
}
