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

El mapa comarcal es un MapLibre NO interactivo (sin zoom ni pan) con el tema
"claro", que ya trae la paleta del sitio. El inset no es un mapa: es la silueta
en SVG de $lib/geo/siluetas.js (la misma del botón del mapa y de la tarjeta OG)
con la estación proyectada encima, así la ficha no arranca un segundo MapLibre
con su estilo y sus teselas solo para enseñar una silueta.

Uso:
  <StationMinimap {detail} color={colorForDays(true, daysSince(fecha))} />
-->
<script>
	import Map from "$lib/components/map/Map.svelte";
	import { isMobile } from "$lib/utils/viewport.svelte.js";
	import { proyectar, PENINSULA, CANARIAS, CANARIAS_OCCIDENTALES } from "$lib/geo/siluetas.js";

	/** @type {{ detail: any, color?: string | null }} */
	let { detail, color = null } = $props();

	// Zoom de ciudad/comarca, igual en las dos disposiciones.
	const CITY_ZOOM = 8.6;

	// Encuadre del inset: un CUADRADO en el espacio de la silueta. El inset se
	// recorta en círculo, así que cada cuadrado se ha elegido para que su círculo
	// inscrito contenga todas las estaciones de la zona (Fisterra, Menorca,
	// Melilla; El Hierro y Lanzarote) con un poco de aire. Recalcular si el
	// dataset añade estaciones más extremas.
	const INSET = {
		peninsula: { viewBox: "-11 -14 116 116", paths: PENINSULA },
		canarias: { viewBox: "-5.5 -31.5 108 108", paths: [...CANARIAS, ...CANARIAS_OCCIDENTALES] },
	};

	const hasCoords = $derived(Number.isFinite(detail.lat) && Number.isFinite(detail.lon));
	// Posición de la estación en el espacio de la silueta y encuadre de su zona.
	const punto = $derived(hasCoords ? proyectar(detail.lat, detail.lon) : null);
	const inset = $derived(punto ? INSET[punto.zona] : null);
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
	<svg class="inset-svg" viewBox={inset.viewBox} aria-hidden="true">
		<!-- Dos pasadas: primero el contorno y encima el relleno, que tapa la
		     parte interior de los trazos (la frontera con Portugal) y deja solo
		     la línea de costa, como el mapa al que sustituye. -->
		{#each inset.paths as d, i (i)}<path class="inset-coast" {d} />{/each}
		{#each inset.paths as d, i (i)}<path class="inset-land" {d} />{/each}
		<circle class="inset-dot" cx={punto.x} cy={punto.y} r="5.5" />
	</svg>
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
		/* Agua y tierra del tema "claro" del mapa, como el medallón. */
		background: #c6d2d8;
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

	.inset-svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.inset-coast {
		fill: none;
		stroke: #aab7be;
		stroke-width: 1.2;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}
	.inset-land {
		fill: #f6f5f1;
	}
	/* Punto de la estación: su color de recencia con un halo del fondo. */
	.inset-dot {
		fill: var(--ring);
		stroke: var(--surface);
		stroke-width: 2.5;
		paint-order: stroke;
	}
</style>
