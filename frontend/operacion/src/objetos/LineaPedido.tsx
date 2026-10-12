import { dinero } from '../componentes/Cifra';
import { Paso } from '../componentes/Paso';

export interface LineaPedidoProps {
  nombre: string;
  cantidad: number;
  importe: number;
  conPrecio?: boolean;
}

/**
 * Una fila de la comanda en lectura: «2× Bandeja paisa … $ 76.000».
 *
 * En la pantalla de cocina no se muestra el precio: ahí solo importa qué hay
 * que preparar.
 */
export function LineaPedido({ nombre, cantidad, importe, conPrecio = true }: LineaPedidoProps) {
  return (
    <div className="f-linea">
      <span className="f-linea__q">{cantidad}×</span>
      <span className="f-linea__n">{nombre}</span>
      {conPrecio ? <span className="f-linea__m">{dinero(importe)}</span> : null}
    </div>
  );
}

export interface LineaPedidoEditableProps {
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  importe: number;
  onMenos: () => void;
  onMas: () => void;
  /** Mientras hay una petición en camino, la cantidad no se puede volver a tocar. */
  bloqueado?: boolean;
}

/** La misma fila mientras el pedido sigue abierto: con el paso para cambiar la cantidad. */
export function LineaPedidoEditable({
  nombre,
  precioUnitario,
  cantidad,
  importe,
  onMenos,
  onMas,
  bloqueado = false,
}: LineaPedidoEditableProps) {
  return (
    <div className="f-linea">
      <span className="f-linea__n">
        {nombre}
        <small className="num">{dinero(precioUnitario)} c/u</small>
      </span>
      <Paso
        valor={cantidad}
        nombre={nombre}
        onMenos={onMenos}
        onMas={onMas}
        disabledMenos={bloqueado}
        disabledMas={bloqueado}
      />
      <span className="f-linea__m">{dinero(importe)}</span>
    </div>
  );
}
