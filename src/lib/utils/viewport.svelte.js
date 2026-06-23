// Wrappers reactivos sobre las APIs de viewport. Usa primitives nativas de
// Svelte 5: `MediaQuery` para breakpoints y `innerWidth`/`innerHeight` para
// dimensiones del navegador.

import { MediaQuery } from 'svelte/reactivity';

/** True cuando el viewport está en ancho de móvil (<700 px). Reactivo: `isMobile.current`. */
export const isMobile = new MediaQuery('(max-width: 699px)', false);
