import { MesaDTO, PedidoDTO, ReservaDTO, UsuarioDTO } from '@compartido/api/tipos';

export type ClaveDeMesa = 'libre' | 'ocupada' | 'reservada';

export interface SituacionDeMesa {
  clave: ClaveDeMesa;
  /** Lo que está pasando en la mesa ahora mismo; vacío si está libre. */
  ahora: string;
  /** El pedido que la ocupa, para poder nombrarlo al intentar eliminarla. */
  pedidoId: number | null;
}

/** Un pedido ocupa la mesa mientras no se haya cobrado ni cancelado. */
export function esPedidoActivo(pedido: PedidoDTO): boolean {
  return pedido.estado !== 'PAGADO' && pedido.estado !== 'CANCELADO';
}

/** Mismo día del calendario, en la hora local de quien mira la pantalla. */
export function esElMismoDia(una: Date, otra: Date): boolean {
  return (
    una.getFullYear() === otra.getFullYear() &&
    una.getMonth() === otra.getMonth() &&
    una.getDate() === otra.getDate()
  );
}

/** Una reserva marca la mesa si es de hoy, sigue en pie y tiene mesa asignada. */
export function esReservaVigenteDeHoy(reserva: ReservaDTO, hoy: Date): boolean {
  if (reserva.mesaId === null) {
    return false;
  }
  if (reserva.estado !== 'PENDIENTE' && reserva.estado !== 'CONFIRMADA') {
    return false;
  }
  return esElMismoDia(new Date(reserva.fechaHora), hoy);
}

/** La hora de una marca de tiempo del backend, en formato de 24 horas. */
export function hora(fechaHora: string): string {
  return new Date(fechaHora).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * En qué situación está una mesa y qué hay que contar de ella.
 *
 * El estado que guarda la mesa en el salón no se consulta: las reservas viven
 * en otro servicio y nunca lo tocan, así que una mesa reservada figura como
 * libre. Solo los pedidos y las reservas saben la verdad, y un pedido manda
 * sobre una reserva: si ya hay gente sentada, da igual que alguien reservara.
 *
 * La columna «Ahora» nombra al mesero del pedido o al cliente de la reserva,
 * y esos nombres no vienen en el pedido ni en la reserva de la mesa: hay que
 * cruzarlos con los usuarios. Si no llegan, se queda el dato que sí se tiene.
 */
export function situacionDeMesa(
  mesa: MesaDTO,
  pedidos: PedidoDTO[],
  reservas: ReservaDTO[],
  usuarios: UsuarioDTO[],
  hoy: Date = new Date()
): SituacionDeMesa {
  const pedido = pedidos.find(
    (candidato) => candidato.mesaId === mesa.id && esPedidoActivo(candidato)
  );
  if (pedido) {
    const mesero = usuarios.find((usuario) => usuario.id === pedido.meseroId);
    const quien = mesero ? ` · ${mesero.nombre}` : '';
    return { clave: 'ocupada', ahora: `Pedido #${pedido.id}${quien}`, pedidoId: pedido.id };
  }

  const reserva = reservas.find(
    (candidata) => candidata.mesaId === mesa.id && esReservaVigenteDeHoy(candidata, hoy)
  );
  if (reserva) {
    return {
      clave: 'reservada',
      ahora: `${hora(reserva.fechaHora)} · ${reserva.clienteNombre}`,
      pedidoId: null
    };
  }

  return { clave: 'libre', ahora: '', pedidoId: null };
}

/** Cómo se nombra en pantalla cada situación: glifo y palabra, sin colores. */
export const ETIQUETA_MESA: Record<ClaveDeMesa, { glifo: string; texto: string }> = {
  libre: { glifo: '○', texto: 'Libre' },
  ocupada: { glifo: '●', texto: 'Ocupada' },
  reservada: { glifo: '▲', texto: 'Reservada' }
};
