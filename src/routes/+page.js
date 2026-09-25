import { fetchStations } from "$lib/data/data.js";

// El catálogo se pide en `load` (sin await) para que SvelteKit lo precargue al
// pasar el ratón por un enlace al mapa. Con ssr=false no corre en el prerender.
export const load = () => ({ stations: fetchStations() });
