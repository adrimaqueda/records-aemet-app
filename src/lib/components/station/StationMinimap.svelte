<!--
@component
StationMinimap.svelte — minimapa estático que sitúa la estación.

Dos disposiciones sobre el MISMO componente (elegidas con `isMobile`, <700 px):

  · escritorio → medallón circular a escala comarcal junto al titular, con un
    inset circular de la península en la esquina. El anillo del medallón toma
    el color de recencia del último récord (mismo lenguaje que los marcadores
    del mapa grande).
  · móvil      → banda a todo el ancho con el inset de la península incrustado
    en la esquina superior derecha, coordenadas y escala en el pie.

Ambos mapas son NO interactivos (sin zoom ni pan) y usan el tema "claro", que
ya trae la paleta del sitio. El inset esconde etiquetas, vías y edificios para
que quede solo la silueta.

Uso:
  <StationMinimap {detail} color={colorForDays(true, daysSince(fecha))} />
-->
<script>
	import Map from "$lib/components/map/Map.svelte";
	import { isMobile } from "$lib/utils/viewport.svelte.js";

	/** @type {{ detail: any, color?: string | null }} */
	let { detail, color = null } = $props();

	// Zoom de ciudad/comarca, igual en las dos disposiciones.
	const CITY_ZOOM = 8.6;

	// Encuadres del inset: península + Baleares (más Ceuta y Melilla), o el
	// archipiélago canario. Ojo, el inset es un CÍRCULO pero `fitBounds` encaja
	// el bbox en el cuadrado, así que las esquinas caen fuera del recorte: con
	// un bbox ceñido a la costa, las estaciones de la Costa da Morte (Fisterra,
	// Cabo Vilán…) quedaban tapadas por el borde. Cada bbox es por eso un
	// CUADRADO en proyección Mercator cuyo círculo inscrito es el menor que
	// contiene todas las estaciones de la zona, con un 7 % de aire; así el
	// círculo visible las cubre todas y se aprovecha el máximo de escala.
	// Recalcular si el dataset añade estaciones más extremas.
	const FRAMES = {
		peninsula: {
			bounds: [
				[-10.4, 34.9],
				[5.0, 46.4],
			],
			center: [-2.7, 40.9],
			zoom: 3.4,
		},
		canarias: {
			bounds: [
				[-18.45, 26.15],
				[-13.2, 30.75],
			],
			center: [-15.8, 28.5],
			zoom: 4.8,
		},
	};
	// Margen de `fitBounds`: deja sitio al punto de la estación (7 px + halo)
	// para que ninguno se coma el borde del círculo.
	const INSET_PAD = 6;
	// Capas que sobran en el inset: a esa escala solo queremos la silueta.
	const CLUTTER = /^(transportation|transportation_name|building|boundary|aeroway)$/;

	const hasCoords = $derived(Number.isFinite(detail.lat) && Number.isFinite(detail.lon));
	// Canarias está en 27,7–29,2 N y la estación peninsular más al sur es Melilla
	// (35,28 N), así que la latitud basta para elegir encuadre.
	const frame = $derived(hasCoords && detail.lat < 32 ? FRAMES.canarias : FRAMES.peninsula);
	const ring = $derived(color ?? "var(--line-strong)");

	const fmtCoord = (v, pos, neg) =>
		`${Math.abs(v).toFixed(4).replace(".", ",")} ${v >= 0 ? pos : neg}`;
	const coords = $derived(`${fmtCoord(detail.lat, "N", "S")} · ${fmtCoord(detail.lon, "E", "O")}`);

	/**
	 * Barra de escala: elige la distancia "redonda" más grande que quepa.
	 * MapLibre usa teselas de 512 px, así que a zoom z el mundo mide
	 * 512·2^z píxeles → 40075017/(512·2^z) = 78271,5·cos(lat)/2^z metros por píxel.
	 */
	function scaleBar(zoom, lat, maxPx) {
		const mPerPx = (78271.516964 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
		const steps = [1, 2, 5, 10, 20, 50, 100, 200];
		let best = { km: steps[0], px: (steps[0] * 1000) / mPerPx };
		for (const km of steps) {
			const px = (km * 1000) / mPerPx;
			if (px <= maxPx) best = { km, px };
		}
		return best;
	}
	const scale = $derived(scaleBar(CITY_ZOOM, detail.lat, 120));

	/** Deja el inset en silueta: fuera etiquetas, vías, edificios y límites. */
	function silhouette(map) {
		const strip = () => {
			for (const l of map.getStyle()?.layers ?? []) {
				if (l.type !== "symbol" && !CLUTTER.test(l["source-layer"] ?? "")) continue;
				try {
					map.setLayoutProperty(l.id, "visibility", "none");
				} catch {
					/* capa sin layout */
				}
			}
			map.fitBounds(frame.bounds, { padding: INSET_PAD, animate: false });
		};
		map.on("style.load", strip);
		if (map.isStyleLoaded()) strip();
	}

	/** Punto de la estación en el inset (posición real, no al centro). */
	function insetMarker(map) {
		silhouette(map);
		import("maplibre-gl").then(({ Marker }) => {
			const el = document.createElement("div");
			el.className = "inset-dot";
			el.style.background = ring;
			new Marker({ element: el }).setLngLat([detail.lon, detail.lat]).addTo(map);
		});
	}
</script>

<!-- Mapa a escala comarcal centrado en la estación. -->
{#snippet cityMap()}
	<Map
		latitude={detail.lat}
		longitude={detail.lon}
		zoom={CITY_ZOOM}
		minZoom={0}
		theme="claro"
		interactive={false}
		attribution={false}
	/>
{/snippet}

<!-- Silueta de la península o de Canarias con el punto de la estación. -->
{#snippet insetMap()}
	<Map
		latitude={frame.center[1]}
		longitude={frame.center[0]}
		zoom={frame.zoom}
		minZoom={0}
		maxBounds={null}
		theme="claro"
		interactive={false}
		attribution={false}
		onReady={insetMarker}
	/>
{/snippet}

{#if hasCoords}
	{#if isMobile.current}
		<!-- ---------- Móvil: banda a todo el ancho ---------- -->
		<figure class="band" style:--ring={ring}>
			<div class="band-map">
				{@render cityMap()}
				<span class="pin" aria-hidden="true"></span>
				<div class="band-foot">
					<span class="coords">{coords}</span>
					<span class="scale">
						<span class="scale-label">{scale.km} km</span>
						<span class="scale-bar" style:width="{scale.px.toFixed(0)}px"></span>
					</span>
				</div>
			</div>
			<div class="inset inset-band">{@render insetMap()}</div>
		</figure>
	{:else}
		<!-- ---------- Escritorio: medallón + inset ---------- -->
		<div class="medallion" style:--ring={ring}>
			<div class="disc">
				{@render cityMap()}
				<span class="pin pin-dark" aria-hidden="true"></span>
			</div>
			<div class="inset inset-disc">{@render insetMap()}</div>
		</div>
	{/if}
{/if}

<style>
	/* --- Medallón (escritorio) ------------------------------------------ */
	.medallion {
		position: relative;
		flex: 0 0 auto;
		width: 172px;
		height: 172px;
	}
	.disc {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		overflow: hidden;
		border: 4px solid var(--ring);
		background: #f6f5f1;
		box-shadow: 0 14px 36px -20px rgba(20, 20, 20, 0.35);
	}
	.inset {
		position: absolute;
		border-radius: 50%;
		overflow: hidden;
		border: 3px solid var(--surface);
		background: #f6f5f1;
		box-shadow: 0 6px 18px -8px rgba(20, 20, 20, 0.4);
	}
	.inset-disc {
		right: -12px;
		bottom: -12px;
		width: 74px;
		height: 74px;
	}

	/* --- Banda (móvil) -------------------------------------------------- */
	.band {
		margin: 0;
		position: relative;
		height: 230px;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius);
		background: #f6f5f1;
	}
	.band-map {
		position: absolute;
		inset: 0;
		border-radius: calc(var(--radius) - 1px);
		overflow: hidden;
	}
	.inset-band {
		top: -10px;
		right: -10px;
		width: 78px;
		height: 78px;
	}
	.band-foot {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.4rem;
		padding: 0.8rem 0.85rem 0.65rem;
		background: linear-gradient(
			to top,
			color-mix(in srgb, var(--surface) 92%, transparent),
			transparent
		);
	}
	.coords {
		font-size: 0.74rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.scale {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.2rem;
	}
	.scale-label {
		font-size: 0.68rem;
		color: var(--faint);
		font-variant-numeric: tabular-nums;
	}
	.scale-bar {
		display: block;
		height: 5px;
		border: 1px solid var(--muted);
		border-top: 0;
	}

	/* --- Punto de la estación ------------------------------------------- */
	.pin {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 14px;
		height: 14px;
		margin: -7px 0 0 -7px;
		border-radius: 50%;
		background: var(--ring);
		box-shadow:
			0 0 0 3px var(--surface),
			0 0 0 4px rgba(20, 20, 20, 0.12);
		pointer-events: none;
		z-index: 1;
	}
	/* En el medallón el anillo ya lleva el color; el punto va en tinta. */
	.pin-dark {
		width: 12px;
		height: 12px;
		margin: -6px 0 0 -6px;
		background: var(--ink);
		box-shadow: 0 0 0 3px var(--surface);
	}

	.inset :global(.inset-dot) {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		box-shadow:
			0 0 0 2px var(--surface),
			0 0 0 3px rgba(20, 20, 20, 0.12);
	}
</style>
