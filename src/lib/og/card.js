// Tarjeta OG dinámica de una estación (nombre, récords vigentes y su punto
// resaltado en el mapa). El árbol de elementos lo consume `@vercel/og` (satori)
// desde el endpoint /estacion/[indicativo]/og.
//
// La proyección lat/lon → espacio de la silueta vive en $lib/geo/siluetas.js
// (la comparte el minimapa). BASEMAP son las transformaciones con las que se
// colocaron esas siluetas en el mapa base (static/og/basemap.png): si se
// regenera con otros transforms, actualizarlas.

import { capWords, fmtTemp } from "$lib/utils/format.js";
import { proyectar } from "$lib/geo/siluetas.js";

const BASEMAP = { Tm: { tx: 20, ty: 15, s: 5.2 }, Tc: { tx: 35, ty: 410, s: 1.85 } };
const MAP_LEFT = 600;
const MAP_TOP = 65;

/** Píxel (en el lienzo 1200×630) donde resaltar la estación, a partir de lat/lon. */
export function highlightPx(lat, lon) {
	const { zona, x, y } = proyectar(lat, lon);
	const T = zona === "canarias" ? BASEMAP.Tc : BASEMAP.Tm;
	return { x: MAP_LEFT + T.tx + x * T.s, y: MAP_TOP + T.ty + y * T.s };
}

const h = (type, props = {}, ...children) => ({
	type,
	props: { ...props, children: children.length <= 1 ? children[0] : children },
});
function stat(label, valor, fecha, style = {}) {
	return h(
		"div",
		{ style: { display: "flex", flexDirection: "column", ...style } },
		h(
			"div",
			{ style: { fontSize: 17, letterSpacing: 1, color: "#9a9a9e", textTransform: "uppercase" } },
			label,
		),
		h(
			"div",
			{ style: { display: "flex", alignItems: "baseline", marginTop: 4 } },
			h("div", { style: { fontSize: 44, fontWeight: 700, color: "#18181A" } }, fmtTemp(valor)),
			fecha
				? h("div", { style: { fontSize: 19, color: "#b6b6ba", marginLeft: 10 } }, fecha.slice(0, 4))
				: "",
		),
	);
}

/** Árbol de elementos (estilo satori) para la ImageResponse. */
export function ogElement(st, basemapSrc, hl) {
	const nombre = (st.nombre || "Estación").replace(/\s+/g, " ").trim();
	const nameSize = nombre.length > 26 ? 44 : nombre.length > 18 ? 54 : 64;
	const prov = st.provincia ? capWords(st.provincia) : "";
	const max = st.vigentes?.absolutoMax;
	const min = st.vigentes?.absolutoMin;

	const children = [
		h("div", {
			style: {
				position: "absolute",
				top: 0,
				left: 0,
				width: 1200,
				height: 630,
				background:
					"radial-gradient(640px 480px at 90% 6%, rgba(244,54,26,0.10), rgba(251,150,6,0.05) 42%, transparent 70%)",
			},
		}),
		h("img", {
			src: basemapSrc,
			width: 560,
			height: 500,
			style: { position: "absolute", left: MAP_LEFT, top: MAP_TOP },
		}),
	];
	if (hl) {
		children.push(
			h("div", {
				style: {
					position: "absolute",
					left: hl.x - 26,
					top: hl.y - 26,
					width: 52,
					height: 52,
					borderRadius: 26,
					background: "rgba(244,54,26,0.22)",
				},
			}),
			h("div", {
				style: {
					position: "absolute",
					left: hl.x - 9,
					top: hl.y - 9,
					width: 18,
					height: 18,
					borderRadius: 9,
					background: "#F4361A",
					border: "2px solid #fff",
				},
			}),
		);
	}
	children.push(
		h(
			"div",
			{
				style: {
					position: "absolute",
					left: 84,
					top: 150,
					display: "flex",
					flexDirection: "column",
					width: 600,
				},
			},
			h(
				"div",
				{
					style: {
						fontSize: 21,
						fontWeight: 700,
						letterSpacing: 2,
						color: "#E0481F",
						textTransform: "uppercase",
					},
				},
				"Estación de AEMET",
			),
			h(
				"div",
				{
					style: {
						fontSize: nameSize,
						fontWeight: 700,
						letterSpacing: -1.5,
						color: "#18181A",
						marginTop: 12,
						lineHeight: 1.05,
					},
				},
				nombre,
			),
			prov ? h("div", { style: { fontSize: 24, color: "#6c6c70", marginTop: 8 } }, prov) : "",
			h(
				"div",
				{ style: { display: "flex", flexDirection: "row", marginTop: 34 } },
				stat("Día más caluroso", max?.valor, max?.fecha, { marginRight: 44 }),
				stat("Noche más cálida", min?.valor, min?.fecha),
			),
		),
		h(
			"div",
			{
				style: {
					position: "absolute",
					left: 84,
					bottom: 48,
					fontSize: 19,
					color: "#9a9a9e",
					display: "flex",
				},
			},
			h("div", { style: { color: "#6c6c70", fontWeight: 700 } }, "Datos: AEMET"),
			h("div", { style: { marginLeft: 7 } }, "· récords históricos vigentes"),
		),
	);
	return h(
		"div",
		{
			style: {
				width: 1200,
				height: 630,
				display: "flex",
				position: "relative",
				background: "#fdfdfc",
				fontFamily: "Inter",
			},
		},
		...children,
	);
}
