import type { EstadoReserva } from '@compartido/api/tipos';
import type { EtiquetaDeEstado } from './estadoPedido';

/**
 * Cómo se nombra en pantalla cada estado de la reserva.
 *
 * Una reserva cumplida o cancelada ya no da trabajo: se atenúa con el tono
 * apagado para que las vigentes se lean primero.
 */
export const ETIQUETA_RESERVA: Record<EstadoReserva, EtiquetaDeEstado> = {
  PENDIENTE: { glifo: '○', texto: 'Pendiente', tono: '' },
  CONFIRMADA: { glifo: '●', texto: 'Confirmada', tono: '' },
  CUMPLIDA: { glifo: '✓', texto: 'Cumplida', tono: 'off' },
  CANCELADA: { glifo: '✕', texto: 'Cancelada', tono: 'off' },
};

/** Una reserva vigente es la que todavía puede ocupar la mesa. */
export function esReservaVigente(estado: EstadoReserva): boolean {
  return estado === 'PENDIENTE' || estado === 'CONFIRMADA';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * La fecha como la lee el mesero: «Hoy», o «14 oct» si es otro día.
 *
 * El año no se escribe: una reserva a más de un año no existe en la práctica,
 * y la fila tiene que caber en una tablet. La comparación es por día del
 * calendario local, no en UTC: a las 7 de la tarde en Bogotá ya es el día
 * siguiente en UTC, y la reserva de esta noche diría una fecha equivocada.
 */
export function fechaCorta(fechaHora: string, hoy: Date = new Date()): string {
  const fecha = new Date(fechaHora);
  if (fecha.toDateString() === hoy.toDateString()) {
    return 'Hoy';
  }
  return `${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
}
