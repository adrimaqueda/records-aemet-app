<!--
@component
Map.svelte — mapa MapLibre GL JS con tiles vectoriales de OpenFreeMap. Ocupa
todo su contenedor.

Expone un contexto ("maplibre-map") para que los hijos (<StationsLayer>,
<MapControls>) trabajen sobre la misma instancia; los hijos se montan cuando
el primer estilo ha cargado.

Tema inicial con la prop `theme` (ids en mapThemes.js). A partir de ahí lo
cambia el usuario desde MapControls.

Uso:
<Map longitude={-3.7} latitude={40.2} zoom={5.2} onReady={(m) => (mapRef = m)}>
  <StationsLayer data={geojson} onClick={…} />
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
		// Control de atribución de MapLibre (esquina inferior derecha). Se puede
		// apagar en minimapas decorativos, donde no cabe; en ese caso la
		// atribución debe aparecer en algún otro sitio de la página.
		attribution = true,
		onReady = null,
		children,
	} = $props();

	const THEME_URLS = Object.fromEntries(MAP_THEMES.map((t) => [t.id, t.url]));

	let map = $state(null);
	let mapReady = $state(false);
	// Estilo que tiene cargado la instancia (no reactivo: solo lo lee el effect).
	let appliedStyleUrl = null;

	// Tema activo. Se inicializa con la prop `theme` y a partir de ahí lo
	// controla el selector de MapControls vía `setTheme` (contexto).
	let currentTheme = $state(untrack(() => theme));
	const styleUrl = $derived(THEME_URLS[currentTheme] ?? THEME_URLS[DEFAULT_THEME]);

	setContext("maplibre-map", {
		getMap: () => map,
		onStyleLoad: (fn) => map?.on("style.load", fn),
		offStyleLoad: (fn) => map?.off("style.load", fn),
		themes: MAP_THEMES,
		get theme() {
			return currentTheme;
		},
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
						// MapLibre mezcla opciones con Object.assign, así que la clave
						// solo puede aparecer cuando queremos apagar el control: pasarla
						// como `undefined` pisaría el valor por defecto.
						...(attribution ? {} : { attributionControl: false }),
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
					onReady?.(instance);
				})
				.catch((err) => {
					console.error("Map: failed to load maplibre-gl", err);
				});
		});

		return () => {
			mounted = false;
			instance?.remove();
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

<div
	class="map"
	{@attach mapAttachment}
	role={interactive ? "application" : "img"}
	aria-label={interactive ? "Mapa interactivo de estaciones" : "Mapa de situación"}
></div>

{#if mapReady && children}
	{@render children()}
{/if}

<style>
	.map {
		width: 100%;
		height: 100%;
	}
</style>
