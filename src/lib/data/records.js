// Utilidades de récords por estación compartidas entre la página de detalle y
// el panel del mapa.

/**
 * Devuelve el último récord de una familia ("max" o "min"), recorriendo el
 * absoluto vigente + los 12 mensuales y quedándose con el más reciente.
 * Empata a favor del absoluto (cuando un mismo día bate ambos).
 *
 * @param {any} d  detalle de estación (stations/<indicativo>.json).
 * @param {"max"|"min"} fam  familia de récord.
 */
export function latestInFamily(d, fam) {
	const absKey = fam === 'max' ? 'absolutoMax' : 'absolutoMin';
	const monKey = fam === 'max' ? 'max' : 'min';
	const tipoAbs = fam === 'max' ? 'absoluto-max' : 'absoluto-min';
	const tipoMon = fam === 'max' ? 'mensual-max' : 'mensual-min';

	const items = [];
	if (d.vigentes[absKey]) {
		items.push({ ...d.vigentes[absKey], tipo: tipoAbs, mes: null });
	}
	for (const m of d.mensuales ?? []) {
		if (m[monKey]) items.push({ ...m[monKey], tipo: tipoMon, mes: m.mes });
	}
	if (items.length === 0) return null;
	items.sort((a, b) => {
		if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
		return a.tipo === tipoAbs ? -1 : 1;
	});
	return items[0];
}
