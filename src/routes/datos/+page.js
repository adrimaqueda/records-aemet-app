// Los datos se cargan por fetch en cliente, pero el shell (hero, título y
// <svelte:head>) sí se renderiza en servidor (anulando el ssr=false global)
// para que el HTML prerenderizado tenga contenido indexable.
export const ssr = true;
