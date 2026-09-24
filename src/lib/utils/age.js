// Edad de un récord: utilidades para etiquetas y comparaciones temporales.

const MS_PER_DAY = 24 * 3600 * 1000;

/** Días enteros entre dos fechas (ISO yyyy-mm-dd). 0 si fecha == ref. */
export function daysSince(fecha, ref = new Date()) {
	if (!fecha) return null;
	const days = Math.floor((ref.getTime() - new Date(fecha).getTime()) / MS_PER_DAY);
	return Math.max(0, days);
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Duración pura entre dos eventos: "1 día" / "5 días" / "2 meses" / "3 años".
 * Útil para construir frases tipo "X después" o "X antes" sin mezclar
 * referencias absolutas como "ayer" u "hoy".
 */
export function ageDurationLabel(days) {
	if (days == null) return "";
	if (days === 0) return "el mismo día";
	if (days < 60) return plural(days, "día", "días");
	if (days < 730) return plural(Math.round(days / 30), "mes", "meses");
	return plural(Math.round(days / 365), "año", "años");
}

/** Etiqueta larga "hoy" / "ayer" / "hace 3 días" / "hace 5 meses" / "hace 12 años". */
export function ageLongLabel(days) {
	if (days == null) return "";
	if (days < 2) return days === 0 ? "hoy" : "ayer";
	return `hace ${ageDurationLabel(days)}`;
}

/**
 * Etiqueta relativa para un instante ISO con hora (p. ej. la fecha de
 * actualización del dataset, "2026-06-18T09:38:39+02:00"). Cuenta en horas
 * si hace menos de un día, y en días a partir de ahí: "hace 3 horas" /
 * "hace 2 días".
 */
export function relativeFromNow(iso, ref = new Date()) {
	if (!iso) return "";
	const ms = ref.getTime() - new Date(iso).getTime();
	if (Number.isNaN(ms)) return "";
	const hours = Math.floor(Math.max(0, ms) / (3600 * 1000));
	if (hours < 1) return "hace menos de una hora";
	if (hours < 24) return `hace ${plural(hours, "hora", "horas")}`;
	return `hace ${plural(Math.floor(hours / 24), "día", "días")}`;
}
