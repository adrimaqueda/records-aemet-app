<!--
@component
ProvisionalTag.svelte — etiqueta "provisional" para récords reconstruidos del
horario en tiempo real, aún sin el dato diario definitivo de AEMET. Misma píldora
ámbar que usa el panel de récords recientes, para un marcado consistente.
-->
<span
	class="prov"
	title="Récord reconstruido del horario reciente, aún sin dato definitivo de AEMET"
>
	provisional
</span>

<style>
	.prov {
		display: inline-block;
		padding: 0.02rem 0.35rem;
		border: 1px solid #c9a227;
		color: #8a6d00;
		background: #fdf6e3;
		border-radius: 10px;
		font-size: 0.68rem;
		font-weight: 400;
		font-variant-numeric: normal;
		vertical-align: 0.08em;
		white-space: nowrap;
	}
</style>
