import type { PedidoDTO } from '@compartido/api/tipos';
import { dinero } from '../componentes/Cifra';
import { Estado } from '../componentes/Estado';
import { ETIQUETA_ESTADO, platillos } from './estadoPedido';

/** «Mesa 3», o «Para llevar» cuando el pedido no tiene mesa. */
export function nombreDeCuenta(pedido: PedidoDTO): string {
  return pedido.mesaNumero != null ? `Mesa ${pedido.mesaNumero}` : 'Para llevar';
}

export interface CuentaProps {
  pedido: PedidoDTO;
  /** Total con impuestos: es lo que la cajera va a cobrar. */
  total: number;
  mesero: string;
  seleccionada: boolean;
  onElegir: () => void;
}

/** Una fila de la cola de la caja: mesa, estado, mesero, platillos y total. */
export function Cuenta({ pedido, total, mesero, seleccionada, onElegir }: CuentaProps) {
  const etiqueta = ETIQUETA_ESTADO[pedido.estado];
  const hecha = pedido.estado === 'PAGADO';

  return (
    <button
      type="button"
      className={hecha ? 'f-cuenta f-cuenta--hecha' : 'f-cuenta'}
      aria-pressed={seleccionada}
      onClick={onElegir}
    >
      <span className="f-cuenta__t">
        {nombreDeCuenta(pedido)}
        <small>#{pedido.id}</small>
      </span>
      <span className="f-cuenta__m">{dinero(total)}</span>
      <span className="f-cuenta__s">
        <Estado glifo={etiqueta.glifo} texto={etiqueta.texto} tono={etiqueta.tono} />
        <span>
          {mesero} · {platillos(pedido.platillos.length)}
        </span>
      </span>
    </button>
  );
}
