// Registro de temas del mapa base. Cada tema apunta a un estilo MapLibre
// servido desde /static y lleva una paleta de muestra (`swatch`) con los 4
// colores más representativos, que MapControls pinta como un cuadrado 2×2.
//
// El orden de este array es el orden en que aparecen en el selector; el primero
// es el tema por defecto.

export const MAP_THEMES = [
	{
		id: "chicle",
		url: "/estilo-mapa-chicle.json",
		swatch: ["#bfe0f5", "#eaf6ec", "#e2d6f2", "#b39be0"],
	},
	{
		id: "claro",
		url: "/estilo-mapa.json",
		// tierra · agua · vías · etiquetas
		swatch: ["#f6f5f1", "#c6d2d8", "#e2e1dc", "#18181a"],
	},
	{
		id: "atardecer",
		url: "/estilo-mapa-atardecer.json",
		swatch: ["#fceee1", "#bcd9d4", "#eccdb4", "#cf9b78"],
	},
	{
		id: "noche",
		url: "/estilo-mapa-noche.json",
		swatch: ["#10172a", "#191e30", "#4a5170", "#eef0f7"],
	}
];

export const DEFAULT_THEME = MAP_THEMES[0].id;

/** Devuelve el tema por id, o el primero (claro) si no existe. */
export function getTheme(id) {
	return MAP_THEMES.find((t) => t.id === id) ?? MAP_THEMES[0];
}
