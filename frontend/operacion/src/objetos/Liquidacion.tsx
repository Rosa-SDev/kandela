import type { ReactNode } from 'react';
import type { PedidoDTO } from '@compartido/api/tipos';
import { Cifra, dinero } from '../componentes/Cifra';
import { Estado } from '../componentes/Estado';
import { liquidar } from '../caja/liquidar';
import { agruparLineas } from './agrupar';
import { nombreDeCuenta } from './Cuenta';
import { ETIQUETA_ESTADO, platillos } from './estadoPedido';
import { LineaPedido } from './LineaPedido';

export interface LiquidacionProps {
  pedido: PedidoDTO;
  mesero: string;
  /** El cobro va abajo; la liquidación no decide cómo se paga. */
  pie?: ReactNode;
}

/**
 * La cuenta en papel: las líneas agrupadas por platillo, el consumo sin
 * impuestos, el impoconsumo del 8 % y el total a cobrar.
 */
export function Liquidacion({ pedido, mesero, pie }: LiquidacionProps) {
  const lineas = agruparLineas(pedido.platillos);
  const etiqueta = ETIQUETA_ESTADO[pedido.estado];
  const cifras = liquidar(pedido.total);

  return (
    <section className="f-liq papel" aria-label={`Cuenta de ${nombreDeCuenta(pedido)}`}>
      <div className="f-comanda__banda">
        <span className="f-titulo">{nombreDeCuenta(pedido)}</span>
        <span className="f-comanda__folio">#{pedido.id}</span>
      </div>

      <div className="f-comanda__meta">
        <span>
          {mesero} · {platillos(pedido.platillos.length)}
        </span>
        <Estado glifo={etiqueta.glifo} texto={etiqueta.texto} tono={etiqueta.tono} />
      </div>

      <div className="f-liq__lineas">
        {lineas.map((linea) => (
          <LineaPedido
            key={linea.platilloId}
            nombre={linea.nombre}
            cantidad={linea.cantidad}
            importe={linea.importe}
          />
        ))}
      </div>

      <div className="f-liq__totales">
        <div className="f-liq__fila">
          <span>Consumo (sin impuestos)</span>
          <b>{dinero(cifras.consumo)}</b>
        </div>
        <div className="f-liq__fila">
          <span>Impoconsumo (8 %)</span>
          <b>{dinero(cifras.impoconsumo)}</b>
        </div>
        <div className="f-liq__total">
          <span>Total a cobrar</span>
          <Cifra valor={cifras.total} />
        </div>
      </div>

      {pie ? <div className="f-liq__pie">{pie}</div> : null}
    </section>
  );
}
