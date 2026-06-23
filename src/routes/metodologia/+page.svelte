<script>
	// Página estática; sin datos remotos.
	import TopBar from "$lib/components/ui/TopBar.svelte";
</script>

<svelte:head>
	<title>Metodología · Récords de temperatura</title>
</svelte:head>

<TopBar current="metodologia" />

<div class="page">
	<main>
		<header class="hero">
			<p class="eyebrow">Cómo se calcula</p>
			<h1>Metodología</h1>
			<p class="lead">
				Este proyecto representa visualmente los récords de temperatura que cada estación de AEMET
				ha batido a lo largo del tiempo, con especial foco en los más recientes.
			</p>
		</header>

		<section>
			<h2>Fuente de datos</h2>
			<p>
				Los datos diarios provienen del histórico abierto de AEMET, accedido a través del dataset
				<a href="https://huggingface.co/datasets/datania/aemet" target="_blank" rel="noreferrer">
					<code>datania/aemet</code>
				</a>
				para el backfill, y de la
				<a href="https://opendata.aemet.es" target="_blank" rel="noreferrer">
					API OpenData de AEMET
				</a>
				para las actualizaciones incrementales. Solo se consideran observaciones a partir de
				<strong>1975</strong>
				, año a partir del cual la red tiene cobertura razonable (antes de esa fecha solo había unas pocas
				estaciones operativas).
			</p>
		</section>

		<section>
			<h2>¿Qué cuenta como récord?</h2>
			<p>
				Para cada estación, recorremos su serie diaria de temperatura máxima (TMAX) y mínima (TMIN)
				y registramos un "evento de récord" cada vez que el valor supera a todos los anteriores
				dentro de su categoría. Distinguimos cuatro categorías:
			</p>
			<dl class="grid">
				<dt>Absoluto · día más caluroso</dt>
				<dd>TMAX más alta jamás registrada en esa estación.</dd>

				<dt>Absoluto · noche más cálida</dt>
				<dd>
					TMIN más <em>alta</em>
					jamás registrada en esa estación.
				</dd>

				<dt>Mensual · día más caluroso de [mes]</dt>
				<dd>TMAX más alta jamás registrada en esa estación durante ese mes calendario.</dd>

				<dt>Mensual · noche más cálida de [mes]</dt>
				<dd>TMIN más alta jamás registrada en esa estación durante ese mes calendario.</dd>
			</dl>

			<p>
				Mientras una estación se está "estrenando" no contamos sus récords como batidos: durante el
				primer año casi todo parece récord, simplemente porque la serie está fijando sus marcas por
				primera vez a medida que avanzan las estaciones del año. Por eso un récord <strong>
					solo cuenta cuando la estación lleva al menos un año midiendo
				</strong>
				—desde que empezó, o desde que se reanudó tras un parón largo (medio año o más sin datos)—. El
				máximo histórico vigente de cada estación sí se conserva aunque se fijara durante ese primer año;
				lo que no contamos es ese arranque como "récord batido". Esto es lo que la página de
				<a href="/datos">datos</a>
				agrega y representa.
			</p>
		</section>

		<section>
			<h2>"Mínima más alta" en vez de "mínima absoluta"</h2>
			<p>
				Una decisión semántica importante: cuando hablamos de récords de temperatura <em>mínima</em>
				, nos referimos a la
				<strong>TMIN más alta</strong>
				(la "noche más cálida") y no a la TMIN más baja. Las noches que no se enfrían son uno de los indicadores
				climáticos más sensibles al calentamiento, mientras que los récords de frío extremo son cada vez
				menos relevantes a escala global.
			</p>
		</section>

		<section>
			<h2>Estaciones activas</h2>
			<p>
				El mapa solo muestra estaciones con al menos <strong>
					180 días de datos reportados en los últimos 12 meses
				</strong>
				. Estaciones cerradas o con cobertura intermitente quedan fuera del mapa, pero sus récords históricos
				sí cuentan en los agregados de la página de datos.
			</p>
		</section>

		<section>
			<h2>Visualización en el mapa</h2>
			<ul>
				<li>
					El <strong>tamaño y la intensidad de color</strong>
					de cada punto dependen de cuánto tiempo hace de su último récord. Los récords del último mes
					son grandes y vibrantes, con el nº de días dentro del círculo; los antiguos se reducen a un
					punto pálido.
				</li>
				<li>
					Un <strong>anillo blanco</strong>
					alrededor del punto indica que el último récord fue absoluto (y no solo mensual).
				</li>
				<li>
					El selector <strong>Máxima / Mínima</strong>
					cambia entre las dos familias de récord; los colores cálidos son para máxima, los naranjas para
					mínima.
				</li>
			</ul>
		</section>

		<section>
			<h2>Actualización</h2>
			<p>
				AEMET publica el dato diario definitivo con unos
				<strong>3~5 días de retraso</strong>
				, y el pipeline se ejecuta automáticamente dos veces al día. Para que el mapa no se quede congelado
				durante ese hueco, los días más recientes se rellenan con récords
				<strong>provisionales</strong>
				. Pero estas cifras no pueden tomarse como cifras en firme, ya que pueden ser corregidas después.
			</p>
		</section>

		<section>
			<h2>Récords provisionales</h2>
			<p>
				Mientras llega el diario definitivo, reconstruimos una estimación de los días más recientes
				a partir de la
				<strong>observación horaria en tiempo real</strong>
				de AEMET: agregamos las temperaturas de las últimas horas a una TMAX y una TMIN diarias (hora
				local peninsular). Si ese valor batiría un récord, lo mostramos marcado como provisional.
			</p>
			<p>Se distinguen a simple vista:</p>
			<ul>
				<li>
					en el mapa, con <strong>borde blanco</strong>
					(aspecto "hueco") y el número de días precedido de una
					<strong>virgulilla</strong>
					(p. ej.
					<code>~3</code>
					);
				</li>
				<li>
					en el panel de récords recientes <strong>del mapa</strong>
					, con la etiqueta
					<em>provisional</em>
					.
				</li>
			</ul>
			<p>
				Son <strong>tentativos</strong>
				: cuando AEMET publica el dato definitivo de ese día, sustituye al provisional. Si el récord se
				confirma, pierde la marca; si no, desaparece. Los provisionales que nunca se confirman (la estación
				no llegó a reportar) se purgan a las dos semanas. Por eso la página de
				<a href="/datos">datos</a>
				—tanto los agregados como las clasificaciones, incluida la de récords más recientes—
				<strong>no</strong>
				cuenta los récords provisionales: solo los confirmados.
			</p>
		</section>

		<section>
			<h2>Código y licencia</h2>
			<p>
				Los datos brutos son propiedad de AEMET y están sujetos a su
				<a href="https://www.aemet.es/es/nota_legal" target="_blank" rel="noreferrer">nota legal</a>
				. El código de procesamiento y visualización es abierto y está disponible en
				<a href="https://github.com/adrimaqueda/records-aemet-app" target="_blank" rel="noreferrer">
					GitHub
				</a>
				. Los datos ya procesados —los archivos JSON que consume esta web— se publican como un dataset
				abierto en
				<a
					href="https://huggingface.co/datasets/adrimaqueda/records-aemet"
					target="_blank"
					rel="noreferrer"
				>
					Hugging Face
				</a>
				.
			</p>
		</section>

		<section>
			<h2>Autoría</h2>
			<p>
				Proyecto ideado y desarrollado por
				<a href="https://adrimaqueda.com" target="_blank" rel="noreferrer">Adrián Maqueda</a>
				<span class="handle">(@adrimaqueda)</span>
				. Si encuentras un error o tienes una sugerencia, puedes abrir un
				<a
					href="https://github.com/adrimaqueda/records-aemet-app/issues"
					target="_blank"
					rel="noreferrer"
				>
					issue en GitHub
				</a>
				o escribirme por redes .
			</p>
		</section>
	</main>
</div>

<style>
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
	.page {
		max-width: 760px;
		margin: 0 auto;
		padding: clamp(1.5rem, 5vw, 3rem) clamp(1rem, 5vw, 2rem) 5rem;
		line-height: 1.55;
	}
	main {
		display: flex;
		flex-direction: column;
	}

	/* --- Hero --------------------------------------------------------- */
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

	/* --- Secciones: texto corrido, separadas por un filete sutil. ----- */
	section {
		font-size: 0.95rem;
		color: var(--muted);
		padding-top: 1.6rem;
		margin-top: 1.6rem;
		border-top: 1px solid var(--line);
		h2 {
			margin: 0 0 0.6rem;
			font-size: 0.78rem;
			font-weight: 600;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: var(--faint);
		}
		p {
			margin: 0 0 0.8rem;
			max-width: 68ch;
		}
		p:last-child {
			margin-bottom: 0;
		}
		strong {
			color: var(--ink);
			font-weight: 600;
		}
		ul {
			margin-bottom: 0.8rem;
		}
	}

	/* --- Lista de categorías ----------------------------------------- */
	dl.grid {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.45rem 1.1rem;
		margin: 0 0 0.9rem;
	}
	dl.grid dt {
		color: var(--ink);
		font-weight: 600;
	}
	dl.grid dd {
		margin: 0;
		color: var(--muted);
	}
	@media (max-width: 520px) {
		dl.grid {
			grid-template-columns: 1fr;
			gap: 0.15rem 0;
		}
		dl.grid dd {
			margin-bottom: 0.5rem;
		}
	}

	ul {
		margin: 0;
		padding-left: 1.2rem;
		color: var(--muted);
	}
	ul li {
		margin-bottom: 0.4rem;
	}
	ul li:last-child {
		margin-bottom: 0;
	}

	a {
		color: var(--max);
		font-weight: 500;
	}
	a:hover {
		text-decoration: underline;
	}
	.handle {
		color: var(--faint);
	}
	code {
		background: color-mix(in srgb, var(--bg) 55%, var(--surface));
		border: 1px solid var(--line);
		padding: 0.05rem 0.35rem;
		border-radius: var(--radius-sm);
		font-size: 0.85em;
	}
</style>
