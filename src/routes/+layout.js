// La app es client-side (SPA): todos los datos se leen por fetch desde
// HuggingFace en el navegador, así que no hay nada que renderizar en servidor.
// `ssr = false` evita SSR (maplibre y otras APIs solo existen en cliente) y
// `prerender = true` genera el shell estático de cada ruta en build. La ruta
// dinámica /estacion/[indicativo] desactiva el prerender en su propio +page.js
// y se sirve por función serverless.
export const ssr = false;
export const prerender = true;
