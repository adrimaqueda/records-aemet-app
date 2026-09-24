<!--
@component
PageHero.svelte — cabecera de las páginas de contenido (/datos, /metodologia):
antetítulo, título y entradilla (el contenido hijo).
-->
<script>
	let { eyebrow, title, children } = $props();
</script>

<header class="hero">
	<p class="eyebrow">{eyebrow}</p>
	<h1>{title}</h1>
	<p class="lead">{@render children()}</p>
</header>

<style>
	.hero {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.75rem;
	}
	.eyebrow {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--max);
	}
	h1 {
		margin: 0;
		font-size: clamp(1.9rem, 5vw, 2.7rem);
		font-weight: 800;
		line-height: 1.05;
		letter-spacing: -0.03em;
		color: var(--ink);
	}
	.lead {
		margin: 0.2rem 0 0;
		max-width: 62ch;
		color: var(--muted);
		font-size: 0.95rem;
	}
</style>
