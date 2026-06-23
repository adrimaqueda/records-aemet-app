<!--
@component
MapControls.svelte — botonera de control del mapa.

Sustituye a la NavigationControl de MapLibre. Debe ir dentro de <Map>.
Botones: zoom +, zoom −, reset (vista inicial), alternar entre dos vistas
(p.ej. península / Canarias).

Props:
  initialView: { center: [lng, lat], zoom }   — vista por defecto.
  altView:     { center, zoom, label, short } — vista alternativa.
-->
<script>
	import { getContext } from "svelte";
	import { fly } from "svelte/transition";

	let { initialView, altView } = $props();
	const ctx = getContext("maplibre-map");
	if (!ctx) throw new Error("MapControls must be placed inside a <Map>.");

	let onAlt = $state(false);

	// ── Selector de tema del mapa ──────────────────────────────────────────
	const themes = ctx.themes ?? [];
	let selectedTheme = $state(ctx.getTheme?.() ?? themes[0]?.id);
	let themeOpen = $state(false);
	let themeRoot = $state(null);

	const currentTheme = $derived(themes.find((t) => t.id === selectedTheme) ?? themes[0]);
	const otherThemes = $derived(themes.filter((t) => t.id !== selectedTheme));

	function toggleThemes() {
		themeOpen = !themeOpen;
	}
	function pickTheme(id) {
		selectedTheme = id;
		ctx.setTheme?.(id);
		themeOpen = false;
	}

	// Cerrar el desplegable al pulsar fuera.
	$effect(() => {
		if (!themeOpen) return;
		const onDocClick = (e) => {
			if (themeRoot && !themeRoot.contains(e.target)) themeOpen = false;
		};
		document.addEventListener("click", onDocClick);
		return () => document.removeEventListener("click", onDocClick);
	});

	// Vista de reset = la seleccionada ahora mismo (península o Canarias).
	const resetView = $derived(onAlt ? altView : initialView);

	function mapFly(view) {
		const map = ctx.getMap();
		if (!map) return;
		map.flyTo({
			center: view.center,
			zoom: view.zoom,
			duration: 800,
			essential: true,
		});
	}

	function zoomIn() {
		ctx.getMap()?.zoomIn();
	}
	function zoomOut() {
		ctx.getMap()?.zoomOut();
	}
	function reset() {
		mapFly(resetView);
	}
	function toggle() {
		mapFly(onAlt ? initialView : altView);
		onAlt = !onAlt;
	}
</script>

{#snippet chip(theme)}
	<span class="chip" aria-hidden="true">
		{#each theme.swatch as c, i (i)}
			<span style:background={c}></span>
		{/each}
	</span>
{/snippet}

<!-- Silueta de la península ibérica (España + Portugal, mismo relleno) + Baleares.
     Contornos reales (Natural Earth vía world-geojson), simplificados con
     Douglas–Peucker; el stroke sella la frontera interior entre los dos rellenos. -->
{#snippet penIcon()}
	<svg viewBox="0 0 100 75" width="24" height="18" aria-hidden="true">
		<g fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round">
			<path
				d="M15.5 3.0 L12.9 3.7 L11.1 5.0 L11.0 6.0 L11.8 6.8 L11.1 6.4 L8.6 7.3 L7.6 6.8 L6.7 7.9 L5.4 8.3 L4.6 10.7 L4.7 11.2 L5.6 10.9 L6.0 12.4 L6.7 12.2 L5.9 13.8 L6.2 14.4 L8.0 13.3 L7.0 14.1 L7.7 14.3 L6.9 14.7 L8.1 15.8 L7.4 16.7 L8.1 16.8 L7.2 17.8 L7.4 20.1 L9.1 18.4 L12.0 17.5 L12.8 18.5 L11.9 19.7 L12.3 20.5 L14.0 19.5 L14.3 20.2 L15.4 19.7 L17.3 20.6 L18.9 19.9 L19.2 19.0 L21.4 19.4 L21.5 18.9 L23.2 19.4 L23.5 21.8 L25.6 22.5 L24.8 24.3 L22.6 25.5 L21.5 27.4 L20.6 27.5 L21.5 29.1 L21.2 32.6 L21.6 33.3 L19.9 35.0 L21.1 36.5 L20.1 39.5 L16.5 39.5 L18.1 41.4 L18.6 43.6 L20.4 44.7 L19.9 46.5 L18.4 47.8 L17.9 50.4 L19.6 52.7 L20.6 52.4 L20.2 54.1 L18.4 54.4 L16.7 58.3 L17.5 61.7 L20.0 61.6 L23.7 63.9 L24.1 66.4 L25.2 67.1 L24.7 67.2 L26.5 70.4 L29.6 72.0 L30.7 71.6 L30.8 70.6 L31.4 70.6 L32.7 68.4 L36.1 67.6 L37.9 65.7 L44.5 65.9 L47.7 65.4 L49.0 66.0 L50.3 64.9 L51.7 64.6 L52.7 65.7 L53.3 65.6 L56.5 59.9 L58.6 58.3 L63.0 57.7 L62.6 55.5 L64.2 51.5 L69.3 47.7 L66.5 45.1 L65.5 41.0 L71.6 31.4 L72.6 31.0 L71.6 31.4 L72.2 31.7 L73.6 30.4 L72.5 29.5 L74.8 27.3 L82.2 25.2 L83.0 23.8 L88.3 20.9 L89.6 19.3 L88.8 17.0 L90.3 16.1 L89.2 15.7 L89.2 15.0 L87.6 14.6 L84.9 15.9 L82.9 15.0 L81.3 15.8 L80.8 14.9 L79.3 14.4 L77.5 15.0 L76.8 12.5 L75.6 12.6 L72.4 11.3 L72.2 12.8 L67.2 12.7 L65.5 11.4 L63.8 12.0 L62.5 10.3 L59.9 10.0 L58.8 9.4 L59.0 9.0 L58.4 9.8 L57.9 9.6 L58.3 7.8 L55.9 7.4 L55.5 6.5 L52.1 7.3 L48.9 5.9 L46.4 6.8 L43.4 5.4 L36.5 6.4 L29.3 5.1 L27.9 4.1 L26.2 5.0 L19.0 5.0 Z"
			/>
			<path
				d="M12.0 17.5 L9.1 18.4 L7.4 20.1 L8.9 27.7 L7.2 34.5 L7.4 35.5 L5.8 40.5 L3.7 42.3 L4.2 43.4 L3.0 47.2 L3.1 48.1 L5.0 48.9 L5.0 50.6 L7.1 50.1 L7.8 51.0 L8.0 53.0 L7.3 54.7 L7.9 55.2 L7.9 58.6 L6.5 62.9 L6.9 63.3 L9.5 62.1 L12.3 62.5 L14.2 63.6 L17.5 61.7 L16.7 58.2 L18.4 54.4 L20.2 54.1 L20.6 52.5 L19.6 52.7 L17.9 50.4 L18.4 47.8 L19.9 46.5 L20.4 44.7 L18.6 43.6 L18.1 41.4 L16.5 39.5 L20.1 39.5 L21.1 36.5 L19.9 35.0 L21.6 33.3 L21.2 32.6 L21.5 29.1 L20.6 27.5 L21.5 27.4 L22.6 25.5 L24.8 24.3 L25.7 22.6 L24.8 21.8 L23.5 21.8 L23.2 19.4 L21.5 18.9 L21.4 19.4 L19.2 19.0 L18.9 19.9 L17.3 20.6 L15.4 19.7 L14.3 20.2 L14.0 19.5 L12.3 20.5 L11.9 19.7 L12.8 18.5 Z"
			/>
			<path
				d="M95.3 35.7 L95.2 36.0 L93.5 36.1 L93.3 36.4 L93.5 36.7 L93.5 37.3 L94.9 37.4 L96.0 38.1 L96.8 38.4 L97.0 37.7 L96.6 36.6 L96.0 36.2 L95.9 35.9 L95.5 36.0 Z"
			/>
			<path
				d="M89.3 36.9 L87.6 37.2 L86.4 37.8 L85.0 39.1 L83.2 40.4 L83.5 40.3 L83.8 40.9 L84.2 40.9 L84.1 41.1 L84.4 41.4 L84.7 41.5 L85.0 40.8 L85.6 40.5 L85.9 40.7 L86.2 41.0 L86.1 41.8 L86.5 42.3 L87.6 42.3 L88.3 43.1 L88.5 43.1 L89.6 42.3 L91.3 39.0 L91.1 38.8 L90.3 38.4 L89.6 38.9 L88.9 38.5 L88.8 38.1 L89.3 38.0 L89.4 37.5 L88.6 37.7 L88.6 37.5 L89.5 37.0 Z"
			/>
			<path
				d="M78.0 44.3 L76.7 44.8 L76.4 45.1 L76.4 45.6 L75.9 45.4 L75.7 45.8 L76.0 46.0 L75.9 46.6 L75.7 46.7 L76.7 46.6 L77.1 47.0 L77.3 47.5 L77.0 47.9 L77.0 48.6 L77.5 48.3 L78.0 48.6 L78.4 48.5 L78.3 48.1 L78.0 48.3 L77.5 47.8 L77.2 46.7 L77.3 46.4 L78.9 45.1 L78.4 44.8 L78.6 44.6 Z"
			/>
		</g>
	</svg>
{/snippet}

<!-- Las cinco islas mayores de Canarias (Tenerife, Fuerteventura, Gran Canaria,
     Lanzarote, La Palma), de oeste a este, con su contorno real. -->
{#snippet canIcon()}
	<svg viewBox="0 0 100 42.8" width="28" height="12" aria-hidden="true">
		<g fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">
			<path
				d="M5.4 13.7 L3.3 14.8 L3.0 16.0 L5.4 21.0 L5.6 22.5 L6.7 23.2 L8.3 20.6 L8.3 17.6 L9.1 16.4 L8.0 14.1 Z"
			/>
			<path
				d="M40.8 19.7 L37.3 19.9 L33.0 23.8 L28.1 24.6 L27.1 24.3 L25.0 25.2 L26.5 27.6 L27.6 30.8 L28.7 31.7 L28.4 32.4 L29.2 32.8 L29.6 33.9 L33.1 33.2 L35.5 30.6 L37.1 24.8 L41.8 21.4 L41.6 19.9 Z"
			/>
			<path
				d="M55.7 29.3 L55.0 30.4 L50.3 29.5 L49.8 29.8 L49.7 31.5 L47.5 33.1 L47.3 35.9 L48.7 38.0 L50.5 39.6 L53.0 39.8 L53.4 39.2 L55.9 38.3 L56.7 37.2 L57.1 33.9 L56.1 32.2 L56.5 29.8 Z"
			/>
			<path
				d="M88.7 15.7 L87.8 16.3 L86.6 15.9 L84.2 17.0 L83.7 19.8 L82.6 22.4 L81.5 23.3 L81.0 25.3 L80.3 25.9 L80.2 28.2 L78.3 30.0 L76.2 30.9 L74.7 30.9 L74.2 32.2 L78.0 32.8 L80.7 29.9 L86.7 28.1 L88.1 24.1 L87.8 22.5 L88.6 19.6 L88.0 16.5 L88.7 16.6 Z"
			/>
			<path
				d="M94.2 3.0 L93.5 5.3 L94.2 6.3 L94.0 7.5 L92.9 7.0 L88.7 8.9 L87.8 10.4 L87.7 12.1 L86.8 12.8 L87.3 14.2 L89.5 14.5 L90.4 12.9 L93.5 12.1 L96.0 10.1 L97.0 5.5 L96.1 4.7 L96.2 4.2 Z"
			/>
		</g>
	</svg>
{/snippet}

<div class="controls">
	{#if themes.length > 1}
		<div class="group themes" bind:this={themeRoot}>
			<button
				class="swatch current"
				class:open={themeOpen}
				onclick={toggleThemes}
				aria-haspopup="true"
				aria-expanded={themeOpen}
				aria-label="Cambiar tema del mapa (actual: {currentTheme.id})"
				title="Tema del mapa"
			>
				{@render chip(currentTheme)}
			</button>

			{#if themeOpen}
				<div class="options" role="menu">
					{#each otherThemes as t, i (t.id)}
						<button
							class="swatch"
							role="menuitem"
							onclick={() => pickTheme(t.id)}
							aria-label="Tema {t.id}"
							title="Tema {t.id}"
							in:fly|global={{ y: i * 30 + 30, duration: 300 }}
						>
							{@render chip(t)}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<div class="group">
		<button onclick={zoomIn} aria-label="Acercar" title="Acercar">+</button>
		<button onclick={zoomOut} aria-label="Alejar" title="Alejar">−</button>
	</div>
	<div class="group">
		<button
			onclick={reset}
			aria-label="Restablecer vista ({resetView.label})"
			title="Restablecer vista"
		>
			<!-- Icono flecha circular (reset) -->
			<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
				<path
					d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
					fill="currentColor"
				/>
			</svg>
		</button>
	</div>
	<div class="group">
		<button
			onclick={toggle}
			aria-label="Ir a {onAlt ? initialView.label : altView.label}"
			title="Ir a {onAlt ? initialView.label : altView.label}"
		>
			{#if (onAlt ? initialView.short : altView.short) === "Can"}
				{@render canIcon()}
			{:else}
				{@render penIcon()}
			{/if}
		</button>
	</div>
</div>

<style>
	.controls {
		position: absolute;
		top: 1rem;
		right: 1rem;
		z-index: 5;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 1rem 0.3rem;
		background: rgba(0, 0, 0, 0.15);
		backdrop-filter: blur(4px);
		border: 1px solid #ddd;
		border-radius: 500px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
	}
	.group {
		display: flex;
		flex-direction: column;
		/*background: #fff;*/
		border: 1px solid #ddd;
		border-radius: 6px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
		overflow: hidden;
	}
	.group button {
		width: 34px;
		height: 34px;
		background: rgba(255, 255, 255, 0.75);
		border: none;
		border-top: 1px solid #eee;
		font:
			14px/1 system-ui,
			sans-serif;
		font-weight: 600;
		color: #333;
		cursor: pointer;
		padding: 0;
		display: grid;
		place-items: center;
	}
	.group button:first-child {
		border-top: none;
	}
	.group button:hover {
		background: #f3f3ef;
	}
	.group button:active {
		background: #e9e9e4;
	}

	/* ── Selector de tema ─────────────────────────────────────────────────── */
	.themes {
		position: relative;
		overflow: visible; /* el desplegable flota fuera del grupo */
	}
	.swatch {
		border-radius: 6px;
	}
	.chip {
		width: 22px;
		height: 22px;
		border-radius: 5px;
		overflow: hidden;
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr 1fr;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
	}
	.chip span {
		transition: background 0.3s;
		display: block;
	}
	.swatch.current.open .chip {
		box-shadow:
			inset 0 0 0 1px rgba(0, 0, 0, 0.12),
			0 0 0 2px #444;
	}
	/* Desplegable: pila vertical a la IZQUIERDA del panel (escritorio). */
	.options {
		position: absolute;
		right: calc(100% + 0.45rem);
		top: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.3rem;
		background: rgba(0, 0, 0, 0.15);
		backdrop-filter: blur(4px);
		border: 1px solid #ddd;
		border-radius: 10px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
	}
	.options .swatch {
		border: 1px solid #ddd;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
	}

	/* Móvil: los controles se agrupan en un único menú horizontal anclado
	   abajo, justo encima del panel de récords recientes (.recientes). */
	@media (max-width: 699px) {
		.controls {
			top: auto;
			transform: none;
			bottom: 4rem; /* despeja el panel .recientes colapsado, con margen */
			right: 50%;
			transform: translateX(50%);
			flex-direction: row;
			padding: 0.3rem 1rem;
			overflow: visible; /* permite que el desplegable de tema salga */
		}
		/* En móvil el desplegable se abre HACIA ARRIBA, centrado sobre el botón. */
		.options {
			right: auto;
			top: auto;
			bottom: calc(100% + 0.5rem);
			left: 50%;
			transform: translateX(-50%);
		}
		.group {
			flex-direction: row;
			background: none;
			border: none;
			border-radius: 5px;
			box-shadow: none;
		}
		/* separador entre los dos grupos */
		.group + .group {
			border-left: 1px solid #ddd;
		}
		/* divisores verticales entre botones (en vez de los horizontales) */
		.group button {
			border-top: none;
			border-left: 1px solid #eee;
		}
		.group button:first-child {
			border-left: none;
		}
	}
</style>
