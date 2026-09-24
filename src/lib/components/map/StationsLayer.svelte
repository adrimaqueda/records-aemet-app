<!--
@component
StationsLayer.svelte — capa especializada de marcadores de estación.

Sobre una única fuente GeoJSON añade 4 capas al mapa padre:

  • stations-halo      — glow difuso bajo los récords del último mes (≤30 días).
  • stations-abs-ring  — anillo blanco para récords ABSOLUTOS recientes.
                         Se desvanece con los años para no saturar el mapa.
  • stations-circle    — círculo principal. Grande para los récords de los
                         últimos 15 días; a partir de ahí se reduce, aunque el
                         color rojo se mantiene vibrante durante todo el mes.
  • stations-label     — número de días impreso DENTRO del círculo. Visible de
                         primeras para los últimos 15 días; los de 16-30 días
                         sólo aparecen al hacer zoom. Los provisionales llevan
                         un prefijo "~".

Propiedades esperadas en cada feature:
  - indicativo (string)      → se devuelve en `onClick`
  - daysSinceRecord (number, grande si no hay)
  - esMax (boolean)          → hue rojo (max) vs naranja (min)
  - esAbsoluto (boolean)     → anillo destacado
  - provisional (boolean)    → récord reconstruido del horario, aún sin dato
                               definitivo: borde blanco y número con "~".
  - labelPriority (number)   → orden de colocación de los números (ver abajo)
  - uniforme (boolean)       → filtro por año activo: todas las estaciones
                               mostradas son del mismo año, así que la escala de
                               antigüedad se apaga y se pintan todas igual
                               (tamaño fijo, color vivo, sin halo ni número).
-->
<script>
	import { getContext, onDestroy } from "svelte";
	import { buildMapboxColorExpr, colorForDays, STOPS_MAX, STOPS_MIN } from "$lib/utils/colors.js";

	/** @type {{ data: any, onClick: (indicativo: string) => void }} */
	let { data, onClick } = $props();

	const ctx = getContext("maplibre-map");
	if (!ctx) throw new Error("StationsLayer must be placed inside a <Map>.");

	const SRC = "stations-src";
	const HALO = "stations-halo";
	const RING = "stations-abs-ring";
	const CIRCLE = "stations-circle";
	const LABEL = "stations-label";
	const LAYERS = [LABEL, CIRCLE, RING, HALO];

	// Color: vibrante para frescos, casi gris para antiguos. Las tablas STOPS_*
	// están compartidas con colors.js para que el JS (border del panel) pueda
	// reproducir exactamente el mismo color.
	const colorPorEdad = [
		"case",
		["get", "esMax"],
		buildMapboxColorExpr(STOPS_MAX),
		buildMapboxColorExpr(STOPS_MIN),
	];

	// ── Modo uniforme (filtro por año) ────────────────────────────────────
	// Con un año seleccionado la antigüedad deja de ser la variable: todas las
	// estaciones mostradas fijaron su récord vigente en ese mismo año. Si
	// siguiéramos codificando los días, los años pasados saldrían como puntos
	// grises de 1,5 px y el mapa parecería vacío. Así que en ese modo se pintan
	// todas igual: tamaño medio constante y el color vivo de la familia. Se
	// decide por feature (`uniforme`), no por capa, para que baste con
	// actualizar la fuente GeoJSON.
	const esUniforme = ["==", ["get", "uniforme"], true];
	const COLOR_UNIFORME_MAX = colorForDays(true, 0);
	const COLOR_UNIFORME_MIN = colorForDays(false, 0);

	const circleColor = [
		"case",
		esUniforme,
		["case", ["get", "esMax"], COLOR_UNIFORME_MAX, COLOR_UNIFORME_MIN],
		colorPorEdad,
	];

	// ── Radios ────────────────────────────────────────────────────────────
	// TODOS los círculos parten de una única tabla base (la del círculo
	// principal). El halo y el anillo se DERIVAN de ella, así que para reescalar
	// el mapa entero basta con tocar BASE_RADIUS — los demás se mueven solos.
	//
	// Cada fila de la base es:
	//     [días, radioAlejado (zoom 4), radioConZoom (zoom 8)]
	const ZOOM_FAR = 4; // vista por defecto del país (zoom ≈ 5.2)
	const ZOOM_NEAR = 8; // nivel de región / ciudad

	const BASE_RADIUS = [
		// días,  alejado, con zoom
		[0, 13, 20],
		[7, 12, 18],
		[15, 10, 15], // hasta el día 15: círculos grandes (cabe el número)
		[16, 4, 9], // a partir de 15 días se encogen de golpe
		[30, 3.5, 7.5], // 16-30 días: pequeños, el número sólo aparece con zoom
		[31, 3.2, 5.2], // cruzado el mes, caen aún más
		[90, 3, 5],
		[365, 2, 3.5],
		[1825, 1.5, 2.5],
		[10950, 1.5, 2],
	];

	// Cómo se desvía cada elemento respecto al radio base del círculo:
	const RING_GAP = 1.6; // el anillo blanco va 3 px POR FUERA del círculo
	const HALO_SCALE = 1.7; // el halo (glow) es ~1,7× el círculo
	const HALO_MAX_DAYS = 30; // por encima de esto el halo se apaga del todo

	// Construye una expresión de radio MapLibre desde BASE_RADIUS, aplicando la
	// transformación `fn(radioBase, días)` a cada valor (offset, escala, recorte…).
	//
	// `uniform` (opcional) es el par [radioAlejado, radioConZoom] que se usa en
	// modo uniforme. El `case` va DENTRO de la interpolación de zoom, no fuera:
	// MapLibre solo admite una expresión basada en zoom por propiedad, y anidarla
	// dentro de un `case` la rechaza.
	function buildRadius(fn = (r) => r, uniform = null) {
		const perDays = (col) => {
			const expr = ["interpolate", ["linear"], ["get", "daysSinceRecord"]];
			for (const [days, far, near] of BASE_RADIUS) {
				expr.push(days, fn(col === 1 ? far : near, days));
			}
			return expr;
		};
		const porZoom = (col) =>
			uniform == null ? perDays(col) : ["case", esUniforme, uniform[col - 1], perDays(col)];
		return ["interpolate", ["linear"], ["zoom"], ZOOM_FAR, porZoom(1), ZOOM_NEAR, porZoom(2)];
	}

	// Círculo principal: la base tal cual. En modo uniforme, un tamaño intermedio
	// constante: se ve de sobra en la vista de país sin empastarse cuando el año
	// filtrado reúne varios cientos de estaciones.
	const circleRadius = buildRadius(undefined, [5, 10]);

	// Stroke desaparece para los viejos.
	const circleStrokeWidth = [
		"case",
		esUniforme,
		1,
		[
			"interpolate",
			["linear"],
			["get", "daysSinceRecord"],
			0,
			1.5,
			30,
			1.2,
			90,
			0.7,
			365,
			0.3,
			1825,
			0,
		],
	];

	// Opacidad: los viejos también bajan en presencia.
	const circleOpacity = [
		"case",
		esUniforme,
		0.92,
		[
			"interpolate",
			["linear"],
			["get", "daysSinceRecord"],
			0,
			0.95,
			30,
			0.9,
			365,
			0.65,
			1825,
			0.45,
			10950,
			0.35,
		],
	];

	// Halo: el glow difuso bajo los récords del último mes. Es HALO_SCALE× el
	// círculo (más amplio) y se apaga a 0 al llegar al día HALO_MAX_DAYS, así que
	// sigue automáticamente la forma del círculo (escalón incluido en el día 15).
	const haloRadius = buildRadius((r, days) => (days >= HALO_MAX_DAYS ? 0 : r * HALO_SCALE));

	const haloOpacity = [
		"interpolate",
		["linear"],
		["get", "daysSinceRecord"],
		0,
		0.45,
		14,
		0.25,
		30,
		0,
	];

	// Anillo de récord absoluto: el mismo círculo, RING_GAP px por fuera. Su
	// presencia se controla aparte con ringOpacity (se desvanece en años).
	const ringRadius = buildRadius((r) => Math.max(r * RING_GAP, r + 3), [8, 16]);

	const ringOpacity = [
		"case",
		esUniforme,
		0.8,
		["interpolate", ["linear"], ["get", "daysSinceRecord"], 0, 0.7, 30, 0.5, 365, 0.25, 1825, 0],
	];

	function removeLayers(map) {
		for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
		if (map.getSource(SRC)) map.removeSource(SRC);
	}

	// Se llama al montar y en cada `style.load` (cambio de tema): el estilo
	// nuevo llega sin nuestras capas.
	function add() {
		const map = ctx.getMap();
		if (!map) return;
		removeLayers(map);

		map.addSource(SRC, { type: "geojson", data });

		map.addLayer({
			id: HALO,
			type: "circle",
			source: SRC,
			filter: ["all", ["!", esUniforme], ["<", ["get", "daysSinceRecord"], HALO_MAX_DAYS]],
			paint: {
				"circle-radius": haloRadius,
				"circle-color": circleColor,
				"circle-opacity": haloOpacity,
				"circle-blur": 0.7,
				"circle-pitch-alignment": "map",
			},
		});

		map.addLayer({
			id: RING,
			type: "circle",
			source: SRC,
			filter: ["==", ["get", "esAbsoluto"], true],
			paint: {
				"circle-radius": ringRadius,
				"circle-color": "#ffffff",
				"circle-opacity": ringOpacity,
				"circle-stroke-color": "#1a1a1a",
				"circle-stroke-width": [
					"case",
					esUniforme,
					1.2,
					["interpolate", ["linear"], ["get", "daysSinceRecord"], 0, 1.4, 365, 0.8, 1825, 0],
				],
			},
		});

		map.addLayer({
			id: CIRCLE,
			type: "circle",
			source: SRC,
			paint: {
				"circle-radius": circleRadius,
				"circle-color": circleColor,
				// Récord provisional (reconstruido del horario, aún sin dato
				// definitivo): borde blanco en vez de oscuro → look "hueco".
				"circle-stroke-color": ["case", ["get", "provisional"], "#ffffff", "#1a1a1a"],
				"circle-stroke-width": circleStrokeWidth,
				"circle-opacity": circleOpacity,
			},
		});

		map.addLayer({
			id: LABEL,
			type: "symbol",
			source: SRC,
			filter: ["all", ["!", esUniforme], ["<=", ["get", "daysSinceRecord"], 30]],
			layout: {
				// Prefijo "~" para los récords provisionales (p. ej. "~3").
				"text-field": [
					"concat",
					["case", ["get", "provisional"], "~", ""],
					["to-string", ["get", "daysSinceRecord"]],
				],
				"text-font": ["Noto Sans Bold"],
				// Texto más pequeño para los récords de 16-30 días (sus círculos
				// son menores); los de los últimos 15 días mantienen su tamaño.
				"text-size": [
					"interpolate",
					["linear"],
					["zoom"],
					4,
					["case", ["<=", ["get", "daysSinceRecord"], 15], 11, 9],
					8,
					["case", ["<=", ["get", "daysSinceRecord"], 15], 15, 11],
				],
				"text-anchor": "center",
				// Colisión activada: cuando muchos récords se amontonan, MapLibre
				// oculta los números que se solaparían en lugar de pintarlos unos
				// sobre otros (evita el "batiburrillo"). Al hacer zoom, los huecos se
				// liberan y van apareciendo más.
				"text-allow-overlap": false,
				"text-ignore-placement": false,
				// Prioridad de colocación = orden de pintado de los círculos (la calcula
				// +page.svelte en `labelPriority`). Así el número que gana la colisión
				// es siempre el del círculo que queda ARRIBA, no el de debajo.
				"symbol-sort-key": ["get", "labelPriority"],
				// Un poco de aire alrededor de cada número para que no se rocen.
				"text-padding": 4,
			},
			paint: {
				"text-color": "#ffffff",
				"text-halo-color": "rgba(0,0,0,0.3)",
				"text-halo-width": 0.5,
				// Los números de los últimos 15 días se ven de primeras; los de
				// 16-30 días sólo aparecen (con un fundido suave) al hacer zoom.
				"text-opacity": [
					"interpolate",
					["linear"],
					["zoom"],
					6.5,
					["case", ["<=", ["get", "daysSinceRecord"], 15], 1, 0],
					7.5,
					1,
				],
			},
		});
	}

	// Los manejadores van por id de capa y MapLibre los conserva al cambiar de
	// estilo, así que basta con registrarlos una vez.
	const handleClick = (e) => {
		const f = e.features?.[0];
		if (f) onClick(f.properties.indicativo);
	};
	const onEnter = () => (ctx.getMap().getCanvas().style.cursor = "pointer");
	const onLeave = () => (ctx.getMap().getCanvas().style.cursor = "");
	const handlers = { click: handleClick, mouseenter: onEnter, mouseleave: onLeave };

	add();
	ctx.onStyleLoad(add);
	for (const [type, fn] of Object.entries(handlers)) ctx.getMap().on(type, CIRCLE, fn);

	$effect(() => {
		ctx.getMap()?.getSource(SRC)?.setData(data);
	});

	onDestroy(() => {
		ctx.offStyleLoad(add);
		const map = ctx.getMap();
		if (!map) return;
		for (const [type, fn] of Object.entries(handlers)) map.off(type, CIRCLE, fn);
		removeLayers(map);
	});
</script>
