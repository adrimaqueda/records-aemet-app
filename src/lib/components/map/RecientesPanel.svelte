<!--
@component
RecientesPanel.svelte — listado de estaciones con récord en el último mes.

Caja flotante (esquina inferior izquierda del mapa) con paginación de 10 en 10
y un botón en la cabecera para colapsar/expandir el listado.

Props:
  recientes: array de { s, ult, n } generado en la página.
  onSelect:  (station) => void  — al hacer click en una fila.
-->
<script>
	import { slide } from "svelte/transition";
	import { isMobile } from "$lib/utils/viewport.svelte.js";
	import ProvisionalTag from "$lib/components/ui/ProvisionalTag.svelte";

	let { recientes = [], onSelect = null, selected } = $props();

	let offset = $state(0);
	// En móvil arrancamos colapsado; en desktop, expandido.
	let visible = $state(!isMobile.current);
	const PAGE_SIZE = 10;

	// Al cambiar el listado (e.g., al cambiar de familia), vuelve al inicio.
	$effect(() => {
		recientes.length;
		offset = 0;
	});

	function focus(s) {
		if (onSelect) onSelect(s);
	}

	// En móvil, al abrir el panel de una estación se colapsa el listado.
	$effect(() => {
		if (isMobile.current && selected) visible = false;
	});
</script>

{#if recientes.length > 0}
	<aside class="recientes" class:collapsed={!visible}>
		<button
			onclick={() => (visible = !visible)}
			aria-label={visible ? "Ocultar listado" : "Mostrar listado"}
			aria-expanded={visible}
		>
			<h2>
				<span class="title">
					Récords recientes
					<span class="count">{recientes.length}</span>
				</span>
				<span class="toggle">
					{visible ? "▾" : "▴"}
				</span>
			</h2>
		</button>

		{#if visible}
			<div class="body" transition:slide={{ duration: 200 }}>
				<ol>
					{#each recientes.slice(offset, offset + PAGE_SIZE) as { s, ult, n } (s.indicativo)}
						<li>
							<button class="link" onclick={() => focus(s)}>
								<span class="rec-name">
									{s.nombre}
									{#if n > 1}<span class="badge">×{n}</span>{/if}
								</span>
								<span class="rec-meta">
									{ult.valor.toFixed(1)} °C ·
									{new Date(ult.fecha).toLocaleDateString("es-ES", {
										day: "numeric",
										month: "short",
									})} · Récord {ult.esAbsoluto
										? "absoluto"
										: "mensual"}{#if ult.provisional}<ProvisionalTag />{/if}
								</span>
							</button>
						</li>
					{/each}
				</ol>
				{#if recientes.length > PAGE_SIZE}
					<nav class="pager">
						<button
							aria-label="Anteriores"
							disabled={offset === 0}
							onclick={() => (offset = Math.max(0, offset - PAGE_SIZE))}
						>
							←
						</button>
						<span class="range">
							{offset + 1}–{Math.min(offset + PAGE_SIZE, recientes.length)} de {recientes.length}
						</span>
						<button
							aria-label="Siguientes"
							disabled={offset + PAGE_SIZE >= recientes.length}
							onclick={() =>
								(offset = Math.min(Math.max(0, recientes.length - PAGE_SIZE), offset + PAGE_SIZE))}
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

		button {
			border: none;
			width: 100%;
			padding: 0;
			cursor: pointer;
		}
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
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
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
		background: none;
		border: 1px solid transparent;
		border-radius: 4px;
		font-size: 0.95rem;
		line-height: 1;
		color: #f3f3ef;
		cursor: pointer;
		padding: 0;
	}
	.toggle:hover {
		border-color: #ddd;
		background: #f3f3ef;
		color: #333;
	}

	ol {
		list-style: none;
		padding: 0;
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

	* :global .prov {
		margin-left: 5px;
	}
</style>
