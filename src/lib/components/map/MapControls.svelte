<!--
@component
MapControls.svelte — botonera de control del mapa.

Sustituye a la NavigationControl de MapLibre. Debe ir dentro de <Map>.
Botones: zoom +, zoom −, reset (vista inicial), alternar entre dos vistas
(p.ej. península / Canarias).

Props:
  initialView: { center: [lng, lat], zoom, label } — vista por defecto.
  altView:     { center: [lng, lat], zoom, label } — vista alternativa.
-->
<script>
	import { getContext } from "svelte";
	import { fly } from "svelte/transition";
	import { PENINSULA, CANARIAS, VIEWBOX_PENINSULA, VIEWBOX_CANARIAS } from "$lib/geo/siluetas.js";

	let { initialView, altView } = $props();
	const ctx = getContext("maplibre-map");
	if (!ctx) throw new Error("MapControls must be placed inside a <Map>.");

	let onAlt = $state(false);

	// ── Selector de tema del mapa ──────────────────────────────────────────
	let themeOpen = $state(false);
	let themeRoot = $state(null);

	const currentTheme = $derived(ctx.themes.find((t) => t.id === ctx.theme));
	const otherThemes = $derived(ctx.themes.filter((t) => t.id !== ctx.theme));

	function pickTheme(id) {
		ctx.setTheme(id);
		themeOpen = false;
	}

	// Cerrar el desplegable al pulsar fuera.
	$effect(() => {
		if (!themeOpen) return;
		const onDocClick = (e) => {
			if (!themeRoot?.contains(e.target)) themeOpen = false;
		};
		document.addEventListener("click", onDocClick);
		return () => document.removeEventListener("click", onDocClick);
	});

	// Vista de reset = la seleccionada ahora mismo (península o Canarias);
	// el otro botón lleva a la contraria.
	const resetView = $derived(onAlt ? altView : initialView);
	const otherView = $derived(onAlt ? initialView : altView);

	function flyTo(view) {
		ctx.getMap()?.flyTo({ center: view.center, zoom: view.zoom, duration: 800, essential: true });
	}

	function toggleView() {
		flyTo(otherView);
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

<!-- Silueta de la península ibérica (España + Portugal, mismo relleno) + Baleares
     ($lib/geo/siluetas.js); el stroke sella la frontera interior entre los dos
     rellenos. -->
{#snippet penIcon()}
	<svg viewBox={VIEWBOX_PENINSULA} width="24" height="18" aria-hidden="true">
		<g fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round">
			{#each PENINSULA as d, i (i)}<path {d} />{/each}
		</g>
	</svg>
{/snippet}

<!-- Las cinco islas mayores de Canarias, con su contorno real. -->
{#snippet canIcon()}
	<svg viewBox={VIEWBOX_CANARIAS} width="28" height="12" aria-hidden="true">
		<g fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">
			{#each CANARIAS as d, i (i)}<path {d} />{/each}
		</g>
	</svg>
{/snippet}

<div class="controls">
	{#if ctx.themes.length > 1}
		<div class="group themes" bind:this={themeRoot}>
			<button
				class="swatch current"
				class:open={themeOpen}
				onclick={() => (themeOpen = !themeOpen)}
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
		<button onclick={() => ctx.getMap()?.zoomIn()} aria-label="Acercar" title="Acercar">+</button>
		<button onclick={() => ctx.getMap()?.zoomOut()} aria-label="Alejar" title="Alejar">−</button>
	</div>
	<div class="group">
		<button
			onclick={() => flyTo(resetView)}
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
		<button onclick={toggleView} aria-label="Ir a {otherView.label}" title="Ir a {otherView.label}">
			{#if onAlt}
				{@render penIcon()}
			{:else}
				{@render canIcon()}
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
