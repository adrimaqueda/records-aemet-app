// Página de contenido estático sin APIs de navegador: se renderiza en servidor
// (anulando el ssr=false global del layout) para que el HTML prerenderizado
// contenga el texto real —indexable por buscadores y bots de LLMs sin JS—.
export const ssr = true;
