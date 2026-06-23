// Tarjeta OG dinámica de una estación (nombre, récords vigentes y su punto
// resaltado en el mapa). El árbol de elementos lo consume `@vercel/og` (satori)
// desde el endpoint /estacion/[indicativo]/og.
//
// Constantes de proyección (lat/lon → espacio 0..100 de la silueta) y del mapa
// base (static/og/basemap.png), reconstruidas del mismo pipeline que generó las
// siluetas. Si se regenera el basemap con otros transforms, actualizar BASEMAP.

const GEO = {
	K_PEN: 0.766044443118978,
	K_CAN: 0.880477353509162,
	penX0: -7.302997545957567,
	penY0: -43.79439343440012,
	sPen: 8.850380985523355,
	canX0: -15.861651200866499,
	canY0: -29.322325503752857,
	sCan: 23.13704052744638,
	PAD: 3,
};
const BASEMAP = { Tm: { tx: 20, ty: 15, s: 5.2 }, Tc: { tx: 35, ty: 410, s: 1.85 } };
const MAP_LEFT = 600,
	MAP_TOP = 65;

/** Píxel (en el lienzo 1200×630) donde resaltar la estación, a partir de lat/lon. */
export function highlightPx(lat, lon) {
	const isCan = lon < -10 && lat < 31;
	let X, Y, T;
	if (isCan) {
		X = GEO.PAD + (lon * GEO.K_CAN - GEO.canX0) * GEO.sCan;
		Y = GEO.PAD + (-lat - GEO.canY0) * GEO.sCan;
		T = BASEMAP.Tc;
	} else {
		X = GEO.PAD + (lon * GEO.K_PEN - GEO.penX0) * GEO.sPen;
		Y = GEO.PAD + (-lat - GEO.penY0) * GEO.sPen;
		T = BASEMAP.Tm;
	}
	return { x: MAP_LEFT + T.tx + X * T.s, y: MAP_TOP + T.ty + Y * T.s };
}

const h = (type, props = {}, ...children) => ({
	type,
	props: { ...props, children: children.length <= 1 ? children[0] : children },
});
const nf = (v) =>
	typeof v === "number"
		? v.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
		: v;
const year = (f) => (f && /^\d{4}/.test(f) ? f.slice(0, 4) : "");
const capWords = (s) =>
	s
		.toLowerCase()
		.split(" ")
		.map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
		.join(" ");

function stat(label, valor, fecha) {
	return h(
		"div",
		{ style: { display: "flex", flexDirection: "column" } },
		h(
			"div",
			{ style: { fontSize: 17, letterSpacing: 1, color: "#9a9a9e", textTransform: "uppercase" } },
			label,
		),
		h(
			"div",
			{ style: { display: "flex", alignItems: "baseline", marginTop: 4 } },
			h(
				"div",
				{ style: { fontSize: 44, fontWeight: 700, color: "#18181A" } },
				valor == null ? "—" : `${nf(valor)} °C`,
			),
			fecha
				? h("div", { style: { fontSize: 19, color: "#b6b6ba", marginLeft: 10 } }, year(fecha))
				: "",
		),
	);
}

/** Árbol de elementos (estilo satori) para la ImageResponse. */
export function ogElement(st, basemapSrc, hl) {
	const nombre = (st.nombre || "Estación").replace(/\s+/g, " ").trim();
	const nameSize = nombre.length > 26 ? 44 : nombre.length > 18 ? 54 : 64;
	const prov = st.provincia ? capWords(st.provincia) : "";
	const max = st.vigentes?.absolutoMax,
		min = st.vigentes?.absolutoMin;

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
				h(
					"div",
					{ style: { display: "flex", marginRight: 44 } },
					stat("Día más caluroso", max?.valor, max?.fecha),
				),
				h("div", { style: { display: "flex" } }, stat("Noche más cálida", min?.valor, min?.fecha)),
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
