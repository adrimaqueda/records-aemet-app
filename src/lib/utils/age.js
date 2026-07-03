// Edad de un récord: utilidades para etiquetas y comparaciones temporales.

const MS_PER_DAY = 24 * 3600 * 1000;

/** Días enteros entre dos fechas (ISO yyyy-mm-dd). 0 si fecha == ref. */
export function daysSince(fecha, ref = new Date()) {
	if (!fecha) return null;
	const dt = new Date(fecha);
	const days = Math.floor((ref.getTime() - dt.getTime()) / MS_PER_DAY);
	return Math.max(0, days);
}

/** Solo el número de días (para meter dentro del punto en el mapa). */
export function dayNumber(days) {
	if (days == null || days > 99) return "";
	return String(days);
}

/**
 * Duración pura entre dos eventos: "1 día" / "5 días" / "2 meses" / "3 años".
 * Útil para construir frases tipo "X después" o "X antes" sin mezclar
 * referencias absolutas como "ayer" u "hoy".
 */
export function ageDurationLabel(days) {
	if (days == null) return "";
	if (days === 0) return "el mismo día";
	if (days < 60) return `${days} ${days === 1 ? "día" : "días"}`;
	if (days < 730) {
		const m = Math.round(days / 30);
		return `${m} ${m === 1 ? "mes" : "meses"}`;
	}
	const y = Math.round(days / 365);
	return `${y} ${y === 1 ? "año" : "años"}`;
}

/**
 * Etiqueta relativa para un instante ISO con hora (p. ej. la fecha de
 * actualización del dataset, "2026-06-18T09:38:39+02:00"). Cuenta en horas
 * si hace menos de un día, y en días a partir de ahí: "hace 3 horas" /
 * "hace 2 días".
 */
export function relativeFromNow(iso, ref = new Date()) {
	if (!iso) return "";
	const dt = new Date(iso);
	if (Number.isNaN(dt.getTime())) return "";
	const ms = Math.max(0, ref.getTime() - dt.getTime());
	const hours = Math.floor(ms / (3600 * 1000));
	if (hours < 24) {
		if (hours < 1) return "hace menos de una hora";
		return `hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
	}
	const days = Math.floor(ms / MS_PER_DAY);
	return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

/** Etiqueta larga "hace 3 días" / "hace 5 meses" / "hace 12 años". */
export function ageLongLabel(days) {
	if (days == null) return "";
	if (days < 2) return days === 0 ? "hoy" : "ayer";
	if (days < 60) return `hace ${days} días`;
	if (days < 730) {
		const m = Math.round(days / 30);
		return `hace ${m} ${m === 1 ? "mes" : "meses"}`;
	}
	const y = Math.round(days / 365);
	return `hace ${y} ${y === 1 ? "año" : "años"}`;
}
