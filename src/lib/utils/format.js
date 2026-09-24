export const MESES = [
	"",
	"enero",
	"febrero",
	"marzo",
	"abril",
	"mayo",
	"junio",
	"julio",
	"agosto",
	"septiembre",
	"octubre",
	"noviembre",
	"diciembre",
];

/** Número con 1 decimal en formato español: 23.5 → "23,5". */
export function fmtNum(v) {
	return v.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function fmtTemp(v) {
	return v == null ? "—" : `${fmtNum(v)} °C`;
}

/** Subida de un récord sobre el anterior: "+0,3 °C sobre 40,4 °C". */
export function fmtSubida(valor, anterior) {
	const d = valor - anterior;
	return `${d >= 0 ? "+" : "−"}${fmtTemp(Math.abs(d))} sobre ${fmtTemp(anterior)}`;
}

// Las fechas del dataset son civiles (yyyy-mm-dd); new Date() las interpreta como
// medianoche UTC. Formateamos también en UTC para que un lector en otra zona
// horaria (p. ej. América) no vea el día anterior.
const dateFormat = (opts) => {
	const f = new Intl.DateTimeFormat("es-ES", { ...opts, timeZone: "UTC" });
	return (s) => f.format(new Date(s));
};

/** "2026-06-18" → "18 de junio de 2026". */
export const fmtDate = dateFormat({ day: "numeric", month: "long", year: "numeric" });
/** "2026-06-18" → "18 jun 2026". */
export const fmtDateShort = dateFormat({ day: "numeric", month: "short", year: "numeric" });
/** "2026-06-18" → "18 jun". */
export const fmtDayMonth = dateFormat({ day: "numeric", month: "short" });

/** "MADRID, RETIRO" → "Madrid, Retiro". */
export function capWords(s) {
	return String(s)
		.toLowerCase()
		.replace(/(^|[\s/(.-])\p{L}/gu, (c) => c.toUpperCase());
}

export function tipoLabel(tipo, mes) {
	if (tipo === "absoluto-max") return "Récord absoluto de máxima";
	if (tipo === "absoluto-min") return "Récord de noche más cálida";
	if (tipo === "mensual-max") return `Récord de máxima de ${MESES[mes ?? 0]}`;
	if (tipo === "mensual-min") return `Noche más cálida de ${MESES[mes ?? 0]}`;
	return tipo;
}
