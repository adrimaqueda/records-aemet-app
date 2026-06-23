export const MESES = [
	'',
	'enero',
	'febrero',
	'marzo',
	'abril',
	'mayo',
	'junio',
	'julio',
	'agosto',
	'septiembre',
	'octubre',
	'noviembre',
	'diciembre'
];

export function fmtTemp(v) {
	return `${v.toFixed(1)} °C`;
}

export function fmtDate(s) {
	return new Date(s).toLocaleDateString('es-ES', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

export function fmtRecord(r) {
	return r ? `${fmtTemp(r.valor)} · ${fmtDate(r.fecha)}` : '—';
}

export function tipoLabel(tipo, mes) {
	if (tipo === 'absoluto-max') return 'Récord absoluto de máxima';
	if (tipo === 'absoluto-min') return 'Récord de noche más cálida';
	if (tipo === 'mensual-max') return `Récord de máxima de ${MESES[mes ?? 0]}`;
	if (tipo === 'mensual-min') return `Noche más cálida de ${MESES[mes ?? 0]}`;
	return tipo;
}
