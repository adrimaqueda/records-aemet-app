# Récords de temperatura · AEMET

[![Web](https://img.shields.io/badge/Web-records--temperatura.adrimaqueda.com-2563EB)](https://records-temperatura.adrimaqueda.com)
[![Dataset en Hugging Face](https://img.shields.io/badge/Dataset-adrimaqueda%2Frecords--aemet-FFD21E?logo=huggingface&logoColor=000)](https://huggingface.co/datasets/adrimaqueda/records-aemet)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?logo=svelte&logoColor=fff)](https://svelte.dev/docs/kit)

Visualización interactiva de los récords de temperatura de las estaciones de
AEMET, con foco en los más recientes. Cada estación se representa en un mapa
según cuánto hace de su último récord, distinguiendo entre el **día más caluroso**
(máxima) y la **noche más cálida** (mínima, la TMIN más alta).

Esta web es solo el _frontend_. Los datos los produce un pipeline aparte que
recorre el histórico diario de AEMET, calcula los récords y publica los JSON
resultantes en un dataset abierto de Hugging Face, que la app lee por `fetch`
desde el navegador.

- **Datos:** [datos abiertos de AEMET](https://opendata.aemet.es) + el dataset
  histórico [`datania/aemet`](https://huggingface.co/datasets/datania/aemet) para
  el backfill.
- **Dataset procesado:** [`adrimaqueda/records-aemet`](https://huggingface.co/datasets/adrimaqueda/records-aemet)
- **Metodología:** explicada dentro de la propia web, en `/metodologia`.

## Funcionalidades

- **Mapa** (`/`): marcadores cuyo tamaño, color y etiqueta dependen de la
  antigüedad del último récord; selector Máxima/Mínima, panel de récords
  recientes y panel de detalle por estación.
- **Datos** (`/datos`): agregados históricos por año y por mes, y clasificaciones
  (récords más altos, más recientes, más longevos, mayores saltos y estaciones
  que más récords baten).
- **Estación** (`/estacion/[indicativo]`): ficha completa con récords absolutos,
  mensuales y evolución histórica.
- **Tarjetas OG dinámicas** por estación, generadas en _serverless_ con
  [`@vercel/og`](https://github.com/vercel/og).

## Stack

- [SvelteKit 2](https://svelte.dev/docs/kit) + [Svelte 5](https://svelte.dev/docs/svelte)
  (runes), desplegado en Vercel con `@sveltejs/adapter-vercel`.
- [MapLibre GL JS](https://maplibre.org/) con tiles vectoriales de
  [OpenFreeMap](https://openfreemap.org/).
- La app corre como SPA (`ssr = false`): los _shells_ estáticos (`/`, `/datos`,
  `/metodologia`) se prerenderizan y los datos se cargan en cliente.

## Desarrollo

Requiere la versión de Node fijada en [`.nvmrc`](.nvmrc) (Node 24).

```sh
nvm use          # o instala Node 24 manualmente
npm install
npm run dev      # servidor de desarrollo en http://localhost:5173
```

Scripts disponibles:

| Script                 | Descripción                                |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | Servidor de desarrollo con HMR.            |
| `npm run build`        | Build de producción.                       |
| `npm run preview`      | Sirve el build de producción localmente.   |
| `npm run format`       | Formatea el código con Prettier.           |
| `npm run format:check` | Comprueba el formato sin escribir cambios. |

## Estructura

```
src/
├─ routes/
│  ├─ +page.svelte               # mapa principal
│  ├─ datos/                     # agregados y clasificaciones
│  ├─ metodologia/               # explicación del proyecto
│  └─ estacion/[indicativo]/     # ficha de estación + endpoint de imagen OG
├─ lib/
│  ├─ components/                # map/ · station/ · datos/ · ui/
│  ├─ data/                      # acceso a los JSON y helpers de récords
│  ├─ utils/                     # formato, colores, edades, temas del mapa…
│  └─ og/                        # generación de la tarjeta OG
└─ hooks.server.js               # reescribe las meta og:image por estación
```

## Licencia y créditos

Los datos brutos son propiedad de **AEMET** y están sujetos a su
[nota legal](https://www.aemet.es/es/nota_legal). El código de procesamiento y
visualización es abierto.

Proyecto ideado y desarrollado por
[Adrián Maqueda](https://adrimaqueda.com) ([@adrimaqueda](https://github.com/adrimaqueda)).
Si encuentras un error o tienes una sugerencia, abre un
[issue](https://github.com/adrimaqueda/records-aemet-app/issues).
