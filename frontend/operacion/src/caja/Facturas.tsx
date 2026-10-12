import { useEffect, useState } from 'react';
import type { FacturaDTO, MetodoPago, PedidoDTO } from '@compartido/api/tipos';
import { get, esErrorKandela } from '../nucleo/api';
import { Titulo } from '../componentes/Titulo';
import { Aviso } from '../componentes/Aviso';
import { Estado } from '../componentes/Estado';
import { dinero } from '../componentes/Cifra';
import { hora } from '../objetos/estadoPedido';

const METODO: Record<MetodoPago, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
};

function esDeHoy(fecha: string): boolean {
  return new Date(fecha).toDateString() === new Date().toDateString();
}

/**
 * Las facturas del día, de la más reciente a la más antigua. Solo lectura:
 * anular es cosa del administrador.
 *
 * La factura no guarda la mesa ni el método de pago; se leen del pedido.
 */
export function Facturas() {
  const [facturas, setFacturas] = useState<FacturaDTO[]>([]);
  const [pedidos, setPedidos] = useState<Map<number, PedidoDTO>>(new Map());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([get<FacturaDTO[]>('/facturas'), get<PedidoDTO[]>('/pedidos')])
      .then(([listaFacturas, listaPedidos]) => {
        setFacturas(
          listaFacturas.filter((f) => esDeHoy(f.fecha)).sort((a, b) => b.numero.localeCompare(a.numero))
        );
        setPedidos(new Map(listaPedidos.map((p) => [p.id, p])));
      })
      .catch((e) => setError(esErrorKandela(e) ? e.titulo : 'No se pudieron leer las facturas.'))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="sh-cuerpo" style={{ padding: 'var(--s5)', overflow: 'auto', display: 'block' }}>
      <Titulo texto="Facturas" par={`${facturas.length} de hoy`} />
      {error ? <Aviso tono="err" glifo="!" titulo={error} /> : null}

      <table className="f-tabla" style={{ marginTop: 'var(--s4)' }}>
        <thead>
          <tr>
            <th>Número</th>
            <th className="n">Hora</th>
            <th>Mesa</th>
            <th>Pedido</th>
            <th>Método</th>
            <th className="n">Consumo</th>
            <th className="n">Impoconsumo</th>
            <th className="n">Total</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {facturas.map((f) => {
            const pedido = pedidos.get(f.pedidoId);
            return (
              <tr key={f.id} className={f.anulada ? 'apagada' : undefined}>
                <td className="mono">
                  <b>{f.numero}</b>
                </td>
                <td className="n mono">{hora(f.fecha)}</td>
                <td>
                  {pedido ? (pedido.mesaNumero != null ? `Mesa ${pedido.mesaNumero}` : 'Para llevar') : '—'}
                </td>
                <td className="mono">#{f.pedidoId}</td>
                <td>{pedido?.metodoPago ? METODO[pedido.metodoPago] : '—'}</td>
                <td className="n">{dinero(f.subtotal)}</td>
                <td className="n">{dinero(f.impuestos)}</td>
                <td className="n">
                  <b>{dinero(f.total)}</b>
                </td>
                <td>{f.anulada ? <Estado glifo="✕" texto="Anulada" tono="off" /> : null}</td>
              </tr>
            );
          })}
          {!cargando && facturas.length === 0 ? (
            <tr>
              <td colSpan={9} className="vacia">
                SIN FACTURAS HOY
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
