import type { MesaDTO, PedidoDTO, ReservaDTO } from '@compartido/api/tipos';
import type { EstadoDeMesa } from '../objetos/Mesa';

export type ClaveDeMesa = EstadoDeMesa['clave'];

/**
 * Un pedido ocupa la mesa mientras no se haya cobrado ni cancelado.
 *
 * Sirve igual el que todavía no ha salido a cocina que el que ya está servido:
 * en los dos casos hay gente sentada.
 */
export function esPedidoActivo(pedido: PedidoDTO): boolean {
  return pedido.estado !== 'PAGADO' && pedido.estado !== 'CANCELADO';
}

/**
 * Mismo día del calendario, en la hora local de quien mira la pantalla.
 *
 * Comparar con la fecha en UTC rompería el plano cada noche: a las 7 de la
 * tarde en Bogotá ya es el día siguiente en UTC, y la reserva de las 19:00
 * desaparecería justo cuando el cliente está llegando.
 */
export function esElMismoDia(una: Date, otra: Date): boolean {
  return (
    una.getFullYear() === otra.getFullYear() &&
    una.getMonth() === otra.getMonth() &&
    una.getDate() === otra.getDate()
  );
}

/**
 * Una reserva marca la mesa si es de hoy, sigue en pie y tiene mesa asignada.
 *
 * La hora no cuenta: una reserva de las 19:00 marca la mesa desde que abre el
 * restaurante, que es justamente para lo que sirve reservar.
 */
export function esReservaVigenteDeHoy(reserva: ReservaDTO, hoy: Date): boolean {
  if (reserva.mesaId === null) {
    return false;
  }
  if (reserva.estado !== 'PENDIENTE' && reserva.estado !== 'CONFIRMADA') {
    return false;
  }
  return esElMismoDia(new Date(reserva.fechaHora), hoy);
}

/**
 * En qué situación está una mesa, según lo que pasa encima de ella.
 *
 * El estado que guarda la mesa en el backend no se consulta: las reservas
 * viven en otro servicio y nunca lo tocan, así que solo los pedidos y las
 * reservas saben la verdad. Un pedido manda sobre una reserva: si ya hay
 * gente sentada, da igual que alguien hubiera reservado.
 */
export function estadoDeMesa(
  mesa: MesaDTO,
  pedidos: PedidoDTO[],
  reservas: ReservaDTO[],
  hoy: Date = new Date(),
): EstadoDeMesa {
  const pedido = pedidos.find((candidato) => candidato.mesaId === mesa.id && esPedidoActivo(candidato));
  if (pedido) {
    return { clave: 'ocupada', pedido };
  }

  const reserva = reservas.find(
    (candidata) => candidata.mesaId === mesa.id && esReservaVigenteDeHoy(candidata, hoy),
  );
  if (reserva) {
    return { clave: 'reservada', reserva };
  }

  return { clave: 'libre' };
}
