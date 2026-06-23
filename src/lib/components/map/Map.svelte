<!--
@component
Map.svelte — Mapa interactivo con MapLibre GL JS.

Renderiza un mapa panable y zoomable con tiles vectoriales de OpenFreeMap.
Expone un contexto Svelte para que los <MapLayer> hijos registren sus
fuentes y capas sobre la misma instancia de mapa.

Tema inicial con la prop `theme` (ids en mapThemes.js: claro, atardecer,
noche, chicle). Por defecto "claro". A partir de ahí lo cambia el usuario
desde MapControls.

Uso:
<Map longitude={-3.7} latitude={40.2} zoom={5.2} theme="claro">
  <MapLayer
    id="stations"
    type="circle"
    data={geojson}
    paint={{ 'circle-radius': 5, 'circle-color': ['get', 'color'] }}
    onClick={(feature) => (selected = feature.properties.indicativo)}
  />
</Map>
-->
<script>
	import { setContext, untrack } from "svelte";
	import "maplibre-gl/dist/maplibre-gl.css";
	import { MAP_THEMES, DEFAULT_THEME } from "$lib/utils/mapThemes.js";

	let {
		longitude = -3.7,
		latitude = 40.2,
		zoom = 5.2,
		minZoom = 4,
		maxZoom = 15,
		maxBounds = [
			[-20, 25],
			[10, 48],
		],
		theme = DEFAULT_THEME,
		interactive = true,
		fill = false, // si true, ocupa todo el contenedor (sin aspect-ratio)
		width = null,
		height = null,
		aspectRatio = "4 / 3",
		caption = "",
		credit = "© OpenFreeMap · © OpenStreetMap contributors",
		onReady = null,
		children,
	} = $props();

	const THEME_URLS = Object.fromEntries(MAP_THEMES.map((t) => [t.id, t.url]));

	let map = $state(null);
	let mapReady = $state(false);
	let appliedStyleUrl = $state(null);

	// Tema activo. Se inicializa con la prop `theme` y a partir de ahí lo
	// controla el selector de MapControls vía `setTheme` (contexto).
	let currentTheme = $state(theme);
	const styleUrl = $derived(THEME_URLS[currentTheme] ?? THEME_URLS[DEFAULT_THEME]);

	const ariaLabel = $derived(
		caption
			? `Mapa interactivo: ${caption}`
			: `Mapa interactivo centrado en ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
	);

	// Contexto que consumen los <MapLayer> / <StationsLayer> hijos.
	setContext("maplibre-map", {
		getMap: () => map,
		isReady: () => mapReady,
		onStyleLoad: (fn) => map?.on("style.load", fn),
		offStyleLoad: (fn) => map?.off("style.load", fn),
		// Selector de tema (lo consume MapControls).
		themes: MAP_THEMES,
		getTheme: () => currentTheme,
		setTheme: (id) => {
			if (THEME_URLS[id]) currentTheme = id;
		},
	});

	/**
	 * Attachment del contenedor del mapa: crea la instancia MapLibre cuando el
	 * <div> se monta y la destruye cuando se desmonta. Usamos `untrack` para
	 * que el attachment NO se re-ejecute al cambiar props (zoom/longitude…);
	 * esas reactividades se manejan con los `$effect` de más abajo.
	 */
	function mapAttachment(node) {
		let mounted = true;
		let instance = null;

		untrack(() => {
			import("maplibre-gl")
				.then(({ Map: MaplibreMap }) => {
					if (!mounted) return;
					instance = new MaplibreMap({
						container: node,
						style: styleUrl,
						center: [longitude, latitude],
						zoom,
						minZoom,
						maxZoom,
						maxBounds,
						interactive,
					});
					instance.on("style.load", () => {
						if (mounted) mapReady = true;
					});
					map = instance;
					appliedStyleUrl = styleUrl;
					if (onReady) onReady(instance);
				})
				.catch((err) => {
					console.error("Map: failed to load maplibre-gl", err);
				});
		});

		return () => {
			mounted = false;
			if (instance) instance.remove();
			map = null;
			mapReady = false;
		};
	}

	// Cambios reactivos de centro/zoom.
	$effect(() => {
		if (!map) return;
		const c = map.getCenter();
		const moved = Math.abs(c.lng - longitude) > 0.0001 || Math.abs(c.lat - latitude) > 0.0001;
		const zoomed = Math.abs(map.getZoom() - zoom) > 0.01;
		if (moved || zoomed) {
			map.flyTo({ center: [longitude, latitude], zoom, essential: true });
		}
	});

	// Cambio reactivo de tema. NO tocamos `mapReady`: así los hijos (capas de
	// estaciones y la botonera) no se desmontan durante la transición. MapLibre
	// vacía el estilo y, al disparar `style.load`, cada capa se re-registra por
	// su cuenta a través de `ctx.onStyleLoad`.
	$effect(() => {
		const url = styleUrl;
		if (!map || url === appliedStyleUrl) return;
		appliedStyleUrl = url;
		map.setStyle(url);
	});
</script>

<figure
	class="map-figure"
	class:fill
	style:width={width ? `${width}px` : undefined}
	style:height={fill ? undefined : height ? `${height}px` : undefined}
>
	<div
		class="map-container"
		class:fill
		{@attach mapAttachment}
		role="application"
		aria-label={ariaLabel}
		style:aspect-ratio={!fill && !height ? aspectRatio : undefined}
	></div>
	{#if !fill && (caption || credit)}
		<figcaption>
			{#if caption}<span class="caption">{caption}</span>{/if}
			{#if credit}<span class="credit">{credit}</span>{/if}
		</figcaption>
	{/if}
</figure>

{#if mapReady && children}
	{@render children()}
{/if}

<style>
	.map-figure {
		margin: 0;
		padding: 0;
		width: 100%;
	}
	.map-figure.fill {
		width: 100%;
		height: 100%;
	}
	.map-container {
		width: 100%;
		display: block;
	}
	.map-container.fill {
		height: 100%;
	}
	figcaption {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding-top: 0.4rem;
		font-size: 0.85rem;
	}
	.credit {
		color: #888;
		font-size: 0.75rem;
	}
</style>
