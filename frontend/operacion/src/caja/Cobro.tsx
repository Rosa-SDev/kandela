import { useState } from 'react';
import type { FacturaDTO, MetodoPago, PedidoDTO } from '@compartido/api/tipos';
import { post, esErrorKandela } from '../nucleo/api';
import { dinero } from '../componentes/Cifra';
import { Segmentado } from '../componentes/Segmentado';
import { Campo } from '../componentes/Campo';
import { Boton } from '../componentes/Boton';
import { Aviso } from '../componentes/Aviso';

const METODOS: Array<[MetodoPago, string]> = [
  ['EFECTIVO', 'Efectivo'],
  ['TARJETA', 'Tarjeta'],
  ['TRANSFERENCIA', 'Transferencia'],
];

/** Lo que queda a la vista después de cobrar. */
export interface CobroHecho {
  pedidoId: number;
  factura: FacturaDTO;
  metodo: string;
  recibido: number | null;
  cambio: number | null;
}

export interface CobroProps {
  pedido: PedidoDTO;
  /** Total con impuestos. */
  total: number;
  cajeroId: number;
  onCobrado: (hecho: CobroHecho) => void;
}

/**
 * El pie de la liquidación mientras la cuenta está por cobrar: método de
 * pago y, en efectivo, cuánto entregó el cliente y cuánto se le devuelve.
 */
export function Cobro({ pedido, total, cajeroId, onCobrado }: CobroProps) {
  const [metodo, setMetodo] = useState<MetodoPago>('EFECTIVO');
  const [recibidoTexto, setRecibidoTexto] = useState('');
  const [intentado, setIntentado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ titulo: string; texto: string } | null>(null);

  const efectivo = metodo === 'EFECTIVO';
  const recibido = recibidoTexto.trim() === '' ? null : Number(recibidoTexto);
  const faltan = recibido !== null ? total - recibido : null;
  const cambio = recibido !== null && faltan !== null && faltan <= 0 ? recibido - total : null;

  let errorRecibido: string | undefined;
  if (efectivo) {
    if (recibido === null || Number.isNaN(recibido)) {
      errorRecibido = intentado ? 'Escriba cuánto entregó el cliente.' : undefined;
    } else if (faltan !== null && faltan > 0) {
      errorRecibido = `Monto insuficiente: faltan ${dinero(faltan)}.`;
    }
  }

  async function cobrar() {
    setIntentado(true);
    setError(null);
    if (efectivo && (recibido === null || Number.isNaN(recibido) || (faltan ?? 0) > 0)) {
      return;
    }

    setEnviando(true);
    try {
      const factura = await post<FacturaDTO>('/facturas', {
        pedidoId: pedido.id,
        cajeroId,
        metodoPago: metodo,
        monto: efectivo ? recibido : total,
      });
      onCobrado({
        pedidoId: pedido.id,
        factura,
        metodo: METODOS.find(([valor]) => valor === metodo)![1],
        recibido: efectivo ? recibido : null,
        cambio: efectivo ? cambio : null,
      });
    } catch (e) {
      setError(
        esErrorKandela(e)
          ? { titulo: e.titulo, texto: 'No se cobró nada todavía.' }
          : { titulo: 'No se pudo cobrar.', texto: 'Intente de nuevo.' }
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {error ? <Aviso tono="err" glifo="!" titulo={error.titulo} texto={error.texto} /> : null}

      <Segmentado
        label="Método de pago"
        opciones={METODOS.map(([, texto]) => texto)}
        activa={METODOS.find(([valor]) => valor === metodo)![1]}
        onCambiar={(texto) => setMetodo(METODOS.find(([, t]) => t === texto)![0])}
      />

      {efectivo ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 'var(--s4)', alignItems: 'end' }}>
          <Campo
            id={`recibido-${pedido.id}`}
            label="Recibido en efectivo"
            tipo="number"
            req
            valor={recibidoTexto}
            onCambiar={setRecibidoTexto}
            error={errorRecibido}
          />
          {cambio !== null ? (
            <div className="f-liq__fila" style={{ display: 'grid', justifyItems: 'end' }}>
              <span>Cambio</span>
              <b>{dinero(cambio)}</b>
            </div>
          ) : null}
        </div>
      ) : null}

      <Boton
        texto={`Cobrar ${dinero(total)}`}
        variante="calor"
        ancho
        disabled={enviando}
        onClick={cobrar}
      />
    </>
  );
}
