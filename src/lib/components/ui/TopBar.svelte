<!--
@component
TopBar.svelte — barra de navegación superior compartida (estación, datos…).
`current` marca la sección activa para omitir su propio enlace.
-->
<script>
	/** @type {{ current?: 'datos' | 'metodologia' | null }} */
	let { current = null } = $props();
</script>

<nav class="topbar">
	<a class="back" href="/">
		<span aria-hidden="true">←</span> Mapa
	</a>
	<div class="links">
		{#if current !== "datos"}<a href="/datos">Datos</a>{/if}
		{#if current !== "metodologia"}<a href="/metodologia">Metodología</a
			>{/if}
	</div>
</nav>

<style>
	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem clamp(1rem, 5vw, 2rem);
		background: color-mix(in srgb, var(--bg) 82%, transparent);
		backdrop-filter: saturate(1.4) blur(10px);
		border-bottom: 1px solid var(--line);
	}
	.back {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--ink);
		text-decoration: none;
		letter-spacing: -0.01em;
	}
	.back span {
		display: inline-block;
		transition: transform 0.18s ease;
	}
	.back:hover span {
		transform: translateX(-3px);
	}
	.links {
		display: flex;
		gap: 1.1rem;
	}
	.links a {
		font-size: 0.85rem;
		color: var(--muted);
		text-decoration: none;
		transition: color 0.15s ease;
	}
	.links a:hover {
		color: var(--ink);
	}
	@media (prefers-reduced-motion: reduce) {
		.back span {
			transition: none;
		}
	}
</style>
