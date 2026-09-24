<script>
	import { dev } from "$app/environment";
	import { injectAnalytics } from "@vercel/analytics/sveltekit";

	let { children } = $props();

	injectAnalytics({ mode: dev ? "development" : "production" });
</script>

{@render children()}

<style>
	/* Tokens de diseño, reset de html/body y piezas compartidas por toda la app.
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

	/* Desplegables en forma de píldora con chevron propio. Cada página ajusta
	   tamaño y relleno si lo necesita. */
	:global(select) {
		font: inherit;
		font-size: 0.8rem;
		padding: 0.35rem 1.8rem 0.35rem 0.7rem;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: var(--surface)
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236c6c70' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")
			no-repeat right 0.6rem center;
		color: var(--ink);
		cursor: pointer;
		appearance: none;
		transition: border-color 0.15s ease;
	}
	:global(select:hover) {
		border-color: var(--muted);
	}
	:global(select:disabled) {
		opacity: 0.6;
		cursor: default;
	}

	:global(.spinner) {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2.5px solid var(--line-strong);
		border-top-color: var(--spinner-color, var(--max));
		animation: spin 0.7s linear infinite;
	}
	@keyframes -global-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.spinner) {
			animation-duration: 2s;
		}
	}

	:global(.sr-only) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
