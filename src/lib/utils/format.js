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

// Las fechas del dataset son civiles (yyyy-mm-dd); new Date() las interpreta como
// medianoche UTC. Formateamos también en UTC para que un lector en otra zona
// horaria (p. ej. América) no vea el día anterior.

/** "2026-06-18" → "18 de junio de 2026". */
export function fmtDate(s) {
	return new Date(s).toLocaleDateString("es-ES", {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}

/** Variante corta: "2026-06-18" → "18 jun 2026". */
export function fmtDateShort(s) {
	return new Date(s).toLocaleDateString("es-ES", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});
}

export function tipoLabel(tipo, mes) {
	if (tipo === "absoluto-max") return "Récord absoluto de máxima";
	if (tipo === "absoluto-min") return "Récord de noche más cálida";
	if (tipo === "mensual-max") return `Récord de máxima de ${MESES[mes ?? 0]}`;
	if (tipo === "mensual-min") return `Noche más cálida de ${MESES[mes ?? 0]}`;
	return tipo;
}
