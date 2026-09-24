<!--
@component
Segmented.svelte — control segmentado con una píldora que se desliza bajo la
opción activa (familia máx/mín en el mapa, vistas y clasificaciones de /datos).

La píldora toma el color de `--seg-accent` si algún ancestro lo define (por
defecto, tinta). `small` reduce el texto; `full` lo estira a todo el ancho.
-->
<script>
	/** @type {{ options: {id: any, label: string}[], value: any, label: string, small?: boolean, full?: boolean }} */
	let { options, value = $bindable(), label, small = false, full = false } = $props();
</script>

<div
	class="seg"
	class:small
	class:full
	role="group"
	aria-label={label}
	style:--n={options.length}
	style:--i={options.findIndex((o) => o.id === value)}
>
	<span class="pill" aria-hidden="true"></span>
	{#each options as o (o.id)}
		<button
			type="button"
			class:active={o.id === value}
			aria-pressed={o.id === value}
			onclick={() => (value = o.id)}
		>
			{o.label}
		</button>
	{/each}
</div>

<style>
	.seg {
		position: relative;
		display: inline-grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: var(--surface);
	}
	.full {
		display: grid;
	}
	/* La píldora ocupa el ancho de un botón (descontando padding y gaps) y se
	   desplaza a la opción activa: translateX del 100% de su ancho + el gap. */
	.pill {
		position: absolute;
		top: 3px;
		bottom: 3px;
		left: 3px;
		width: calc((100% - 6px - (var(--n) - 1) * 2px) / var(--n));
		border-radius: 999px;
		background: var(--seg-accent, var(--ink));
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.18);
		transform: translateX(calc(var(--i) * (100% + 2px)));
		transition:
			transform 0.28s cubic-bezier(0.34, 1.2, 0.42, 1),
			background-color 0.25s ease;
		pointer-events: none;
	}
	button {
		position: relative;
		background: none;
		border: none;
		padding: 0.4rem 0.85rem;
		cursor: pointer;
		font: inherit;
		font-size: 0.84rem;
		font-weight: 500;
		color: var(--muted);
		border-radius: 999px;
		white-space: nowrap;
		transition: color 0.2s ease;
	}
	.small button {
		padding: 0.3rem 0.7rem;
		font-size: 0.78rem;
	}
	button:hover {
		color: var(--ink);
	}
	button.active {
		color: #fff;
	}
	@media (prefers-reduced-motion: reduce) {
		.pill {
			transition: none;
		}
	}
</style>
