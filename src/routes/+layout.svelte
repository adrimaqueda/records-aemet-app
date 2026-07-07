<script lang="ts">
	import { dev } from "$app/environment";
	import { injectAnalytics } from "@vercel/analytics/sveltekit";

	let { children } = $props();

	injectAnalytics({ mode: dev ? "development" : "production" });
</script>

{@render children()}

<style>
	/* Tokens de diseño y reset de html/body compartidos por toda la app.
	   OJO: no poner height en body — limitaría el bloque contenedor del
	   TopBar sticky y dejaría de pegarse al hacer scroll. */
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		background: var(--bg);
		color: var(--ink);
		font-family: var(--font);
		-webkit-font-smoothing: antialiased;
		text-rendering: optimizeLegibility;
	}

	:global(:root) {
		--bg: #fefefe;
		--surface: #ffffff;
		--ink: #18181a;
		--muted: #6c6c70;
		--faint: #777;
		--line: #ededea;
		--line-strong: #e2e1dc;
		--max: hsl(8 82% 50%);
		--min: hsl(34 88% 47%);
		--radius: 18px;
		--radius-sm: 11px;
		--shadow: 0 1px 2px rgba(20, 20, 20, 0.04), 0 14px 36px -20px rgba(20, 20, 20, 0.22);
		--font:
			ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
	}
</style>
