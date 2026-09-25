<!--
@component
RecientesPanel.svelte — listado de estaciones con récord destacado.

Caja flotante (esquina inferior izquierda del mapa) con paginación de 10 en 10
y un botón en la cabecera para colapsar/expandir el listado. Por defecto lista
los récords de los últimos 15 días; con el filtro de año activo la página le
pasa las estaciones de ese año y cambia el título.

Props:
  items:      array de { s, ult, n } generado en la página.
  titulo:     cabecera del panel.
  onSelect:   (station) => void  — al hacer click en una fila.
  selected:   estación abierta en el panel de detalle (en móvil pliega el listado).
  badgeLabel: (n) => string — texto que explica el badge ×N (el significado de
              n cambia según el modo del panel).
-->
<script>
	import { slide } from "svelte/transition";
	import { isMobile } from "$lib/utils/viewport.svelte.js";
	import { fmtDayMonth, fmtTemp } from "$lib/utils/format.js";
	import { prefetchStationDetail } from "$lib/data/data.js";
	import ProvisionalTag from "$lib/components/ui/ProvisionalTag.svelte";

	let { items, titulo, onSelect, selected, badgeLabel } = $props();

	const PAGE_SIZE = 10;
	// Al cambiar el listado (p. ej., al cambiar de familia) vuelve al inicio.
	// Es un $derived escribible (los botones lo cambian): se reinicia en el
	// mismo render que el listado nuevo, sin pasar un fotograma con una página
	// que ya no existe, como ocurría al resetearlo desde un $effect.
	let offset = $derived.by(() => {
		items; // dependencia: un listado nuevo reinicia la paginación
		return 0;
	});
	// En móvil arrancamos colapsado; en desktop, expandido.
	let visible = $state(!isMobile.current);

	// En móvil, al abrir el panel de una estación se colapsa el listado.
	$effect(() => {
		if (isMobile.current && selected) visible = false;
	});
</script>

{#if items.length > 0}
	<aside class="recientes">
		<h2>
			<button
				class="head"
				onclick={() => (visible = !visible)}
				aria-label={visible ? "Ocultar listado" : "Mostrar listado"}
				aria-expanded={visible}
			>
				<span class="title">
					{titulo}
					<span class="count">{items.length}</span>
				</span>
				<span class="toggle" aria-hidden="true">{visible ? "▾" : "▴"}</span>
			</button>
		</h2>

		{#if visible}
			<div transition:slide={{ duration: 200 }}>
				<ol>
					{#each items.slice(offset, offset + PAGE_SIZE) as { s, ult, n } (s.indicativo)}
						<li>
							<!-- Precarga el detalle al apuntar a la fila: el panel abre sin
							     esperar a la red. -->
							<button
								class="link"
								onclick={() => onSelect(s)}
								onpointerenter={() => prefetchStationDetail(s.indicativo)}
								onfocus={() => prefetchStationDetail(s.indicativo)}
							>
								<span class="rec-name">
									{s.nombre}
									{#if n > 1}
										<span class="badge" title={badgeLabel(n)}>
											<span aria-hidden="true">×{n}</span>
											<span class="sr-only">{badgeLabel(n)}</span>
										</span>
									{/if}
								</span>
								<span class="rec-meta">
									{fmtTemp(ult.valor)} · {fmtDayMonth(ult.fecha)} · Récord {ult.esAbsoluto
										? "absoluto"
										: "mensual"}{#if ult.provisional}<ProvisionalTag />{/if}
								</span>
							</button>
						</li>
					{/each}
				</ol>
				{#if items.length > PAGE_SIZE}
					<nav class="pager">
						<button
							aria-label="Anteriores"
							disabled={offset === 0}
							onclick={() => (offset -= PAGE_SIZE)}
						>
							←
						</button>
						<span class="range">
							{offset + 1}–{Math.min(offset + PAGE_SIZE, items.length)} de {items.length}
						</span>
						<button
							aria-label="Siguientes"
							disabled={offset + PAGE_SIZE >= items.length}
							onclick={() => (offset += PAGE_SIZE)}
						>
							→
						</button>
					</nav>
				{/if}
			</div>
		{/if}
	</aside>
{/if}

<style>
	/* Mobile-first: ocupa el ancho disponible pegado al borde inferior. */
	.recientes {
		position: absolute;
		bottom: 0.5rem;
		left: 0.5rem;
		right: 0.5rem;
		z-index: 5;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(4px);
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
		font-family: system-ui, sans-serif;
		overflow: hidden;
	}
	@media (min-width: 700px) {
		.recientes {
			bottom: 1rem;
			left: 1rem;
			right: auto;
			width: 340px;
		}
	}

	h2 {
		margin: 0;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
		border: none;
		cursor: pointer;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		text-align: left;
		background-color: #222;
		color: #fafafa;
		padding: 0.6rem 0.9rem;
	}
	.title {
		flex: 1 1 auto;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.count {
		background: #f0f0ed;
		color: #555;
		font-size: 0.75rem;
		font-weight: 500;
		padding: 0.05rem 0.45rem;
		border-radius: 10px;
		text-transform: none;
		letter-spacing: 0;
	}
	.toggle {
		width: 26px;
		height: 26px;
		display: grid;
		place-items: center;
		border: 1px solid transparent;
		border-radius: 4px;
		font-size: 0.95rem;
		line-height: 1;
		color: #f3f3ef;
	}
	.head:hover .toggle {
		border-color: #ddd;
		background: #f3f3ef;
		color: #333;
	}

	ol {
		list-style: none;
		margin: 0.4rem 0 0;
		padding: 0 0.9rem 0.6rem;
	}
	li {
		border-top: 1px solid #eee;
		padding: 0.3rem 0;
	}
	li:first-child {
		border-top: none;
	}

	.link {
		background: none;
		border: none;
		padding: 0;
		text-align: left;
		cursor: pointer;
		font: inherit;
		display: block;
		width: 100%;
		color: var(--ink);
	}
	.link:hover .rec-name {
		text-decoration: underline;
	}
	.rec-name {
		display: block;
		font-weight: 500;
		font-size: 0.85rem;
	}
	.badge {
		display: inline-block;
		margin-left: 0.4rem;
		padding: 0.05rem 0.4rem;
		background: #222;
		color: #fff;
		border-radius: 10px;
		font-size: 0.7rem;
		vertical-align: 0.05em;
	}
	.rec-meta {
		display: block;
		font-size: 0.75rem;
		color: #666;
		font-variant-numeric: tabular-nums;
	}

	.pager {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.8rem 0.6rem;
	}
	.pager button {
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		background: #f3f3ef;
		border: 1px solid #ddd;
		border-radius: 50px;
		cursor: pointer;
		font-size: 0.95rem;
		color: #333;
		padding: 0;
		padding-bottom: 3px;
	}
	.pager button:hover:not(:disabled) {
		background: #e9e9e4;
	}
	.pager button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.pager .range {
		text-align: center;
		font-size: 0.75rem;
		color: #666;
		font-variant-numeric: tabular-nums;
	}
</style>
