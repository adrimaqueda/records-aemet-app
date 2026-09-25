import { fetchStationDetail } from "$lib/data/data.js";

// Ruta dinámica: no se prerenderiza (el resto sí, ver +layout.js); se sirve por
// función serverless, donde hooks.server.js le inyecta sus meta SEO.
export const prerender = false;

// El detalle se pide aquí (sin await, la página resuelve la promesa con
// {#await}) para que SvelteKit lo precargue al pasar el ratón por cualquier
// enlace a la ficha (data-sveltekit-preload-data="hover" en app.html).
export const load = ({ params }) => ({ detail: fetchStationDetail(params.indicativo) });
