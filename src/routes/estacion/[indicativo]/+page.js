// Ruta dinámica: no se prerenderiza (el resto sí, ver +layout.js); se sirve por
// función serverless, donde hooks.server.js le inyecta sus meta SEO.
export const prerender = false;
