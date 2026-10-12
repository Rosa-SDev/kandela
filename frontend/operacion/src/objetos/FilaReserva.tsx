import type { ReactNode } from 'react';
import type { ReservaDTO } from '@compartido/api/tipos';
import { Estado } from '../componentes/Estado';
import { hora } from './estadoPedido';
import { ETIQUETA_RESERVA, esReservaVigente, fechaCorta } from './estadoReserva';

export interface FilaReservaProps {
  reserva: ReservaDTO;
  /**
   * El número de la mesa reservada. La reserva solo guarda el identificador, y
   * el número es lo que está pintado en la mesa; si no llega, no se nombra.
   */
  mesaNumero?: number | null;
  /** Los botones de la fila. La fila no decide qué se puede hacer con la reserva. */
  acciones?: ReactNode;
}

/**
 * Una reserva en la lista: cuándo, de quién, en qué estado y para cuántos.
 *
 * Las cerradas se atenúan en vez de esconderse: el mesero necesita ver que la
 * mesa de las ocho se canceló, no que desapareció.
 */
export function FilaReserva({ reserva, mesaNumero, acciones }: FilaReservaProps) {
  const etiqueta = ETIQUETA_RESERVA[reserva.estado];
  const cerrada = !esReservaVigente(reserva.estado);

  return (
    <div className={`f-fila${cerrada ? ' f-fila--apagada' : ''}`}>
      <span className="f-fila__t">
        {fechaCorta(reserva.fechaHora)} · {hora(reserva.fechaHora)}
        <small>{reserva.clienteNombre}</small>
      </span>
      <span className="f-fila__acc">{acciones}</span>
      <span className="f-fila__s">
        <Estado glifo={etiqueta.glifo} texto={etiqueta.texto} tono={etiqueta.tono} />
        <span>{reserva.numPersonas} personas</span>
        <span>
          {mesaNumero != null
            ? `Mesa ${mesaNumero}`
            : reserva.mesaId != null
              ? `Mesa ${reserva.mesaId}`
              : 'Sin mesa asignada'}
        </span>
      </span>
    </div>
  );
}
