// Tabla de colores compartida entre la capa MapLibre y los componentes JS, para
// que el borde del StationPanel coincida exactamente con el del marcador del mapa.
//
// Cada stop es [días desde el récord, color HSL]. La interpolación es lineal
// componente a componente (H, S, L).

/** Récords de "calor diurno" (TMAX más alta): rojo intenso → gris pálido. */
export const STOPS_MAX = [
	[0, [10, 95, 50]],
	[7, [10, 92, 52]],
	[30, [10, 80, 55]],
	[90, [10, 40, 65]],
	[365, [10, 18, 75]],
	[1825, [0, 0, 82]],
	[10950, [0, 0, 85]]
];

/** Récords de "noche cálida" (TMIN más alta): naranja → gris pálido. */
export const STOPS_MIN = [
	[0, [35, 95, 52]],
	[7, [35, 92, 54]],
	[30, [35, 78, 58]],
	[90, [35, 38, 68]],
	[365, [30, 15, 76]],
	[1825, [0, 0, 82]],
	[10950, [0, 0, 85]]
];

function lerp(a, b, t) {
	return a + (b - a) * t;
}

function interpolate(stops, days) {
	if (days <= stops[0][0]) return stops[0][1];
	const last = stops[stops.length - 1];
	if (days >= last[0]) return last[1];
	for (let i = 0; i < stops.length - 1; i++) {
		const [d0, c0] = stops[i];
		const [d1, c1] = stops[i + 1];
		if (days >= d0 && days <= d1) {
			const t = (days - d0) / (d1 - d0);
			return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
		}
	}
	return last[1];
}

function hslToString([h, s, l]) {
	return `hsl(${h.toFixed(0)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
}

/**
 * Color HSL del marcador en función de los días desde el último récord.
 * Devuelve exactamente el mismo color que la expresión MapLibre de StationsLayer.
 *
 * @param {boolean} esMax  true si es récord de la familia "max" (calor), false si "min".
 * @param {number|null|undefined} days  días desde el récord, null si no hay.
 */
export function colorForDays(esMax, days) {
	if (days == null) return hslToString([0, 0, 85]);
	const stops = esMax ? STOPS_MAX : STOPS_MIN;
	return hslToString(interpolate(stops, days));
}

/**
 * Construye la expresión MapLibre `interpolate` desde una lista de stops.
 * Resultado: ['interpolate', ['linear'], ['get','daysSinceRecord'], 0, 'hsl(...)', 7, 'hsl(...)', …]
 */
export function buildMapboxColorExpr(stops) {
	const out = ['interpolate', ['linear'], ['get', 'daysSinceRecord']];
	for (const [days, hsl] of stops) {
		out.push(days, hslToString(hsl));
	}
	return out;
}
