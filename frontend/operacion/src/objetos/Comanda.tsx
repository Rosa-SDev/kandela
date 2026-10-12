import { useState, type ReactNode } from 'react';
import type { PedidoDTO } from '@compartido/api/tipos';
import { Cifra } from '../componentes/Cifra';
import { Estado } from '../componentes/Estado';
import { agruparLineas } from './agrupar';
import { ETIQUETA_ESTADO, hora, platillos } from './estadoPedido';
import { LineaPedido, LineaPedidoEditable } from './LineaPedido';

export type VarianteComanda = 'editable' | 'lectura' | 'bloqueada' | 'pared';

const UN_MINUTO = 60_000;
const MINUTOS_ATENCION = 10;
const MINUTOS_ALARMA = 15;

export interface ComandaProps {
  /** El pedido tal como lo devuelve el backend, con sus líneas una por unidad. */
  pedido: PedidoDTO;
  variante: VarianteComanda;
  /** Botón o botones del pie. La comanda no decide qué acción va ahí. */
  pie?: ReactNode;
  /**
   * Marca de tiempo contra la que corre el reloj de la variante pared. Quien
   * la use lleva el tic con un solo temporizador; si no llega, el reloj se
   * queda en el momento en que se pinto la comanda.
   */
  ahora?: number;
  /** Nombre del mesero, solo para la variante pared. Si no llega, no se muestra. */
  meseroNombre?: string;
  /** Texto de la nota mientras se edita. Por defecto, el del pedido. */
  nota?: string;
  onCambiarNota?: (texto: string) => void;
  onGuardarNota?: () => void;
  errorNota?: string;
  onMenos?: (platilloId: number) => void;
  onMas?: (platilloId: number) => void;
  /** Bloquea el paso de cantidad mientras una petición está en camino. */
  bloqueado?: boolean;
}

/** Ámbar a los 10 minutos, rojo a los 15, como en el tablero de cocina. */
function tonoDelTiempo(transcurrido: number): 'ate' | 'err' | '' {
  const minutos = transcurrido / UN_MINUTO;
  if (minutos >= MINUTOS_ALARMA) return 'err';
  if (minutos >= MINUTOS_ATENCION) return 'ate';
  return '';
}

/** El tiempo transcurrido en mm:ss, nunca negativo. */
function reloj(transcurrido: number): string {
  const segundos = Math.max(0, Math.floor(transcurrido / 1000));
  const minutos = Math.floor(segundos / 60);
  return `${String(minutos).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
}

/**
 * La comanda del pedido, en sus cuatro variantes.
 *
 * | Variante | Dónde | Qué cambia |
 * |---|---|---|
 * | `editable` | Toma de pedido | cantidad con el paso y nota escribible |
 * | `lectura` | Detalle de la mesa, Mis pedidos | solo se lee |
 * | `bloqueada` | Pedido ya enviado o cobrado | lectura y una banda que explica por qué |
 * | `pared` | Tablero de cocina | sin precios ni suma, con el reloj desde que se creó |
 *
 * El pedido no guarda cuántas personas hay en la mesa ni un campo de alergia
 * aparte: lo que haya que advertir va en la nota, que la cocina ve completa.
 */
export function Comanda({
  pedido,
  variante,
  pie,
  ahora,
  meseroNombre,
  nota,
  onCambiarNota,
  onGuardarNota,
  errorNota,
  onMenos,
  onMas,
  bloqueado = false,
}: ComandaProps) {
  const editable = variante === 'editable';
  const pared = variante === 'pared';
  const lineas = agruparLineas(pedido.platillos);
  const etiqueta = ETIQUETA_ESTADO[pedido.estado];
  const unidades = pedido.platillos.length;

  // Si quien la usa no lleva su propio reloj, se congela en el momento de pintarla:
  // llamar a Date.now() en cada render haria que la comanda cambiara sola.
  const [pintadaEn] = useState(() => Date.now());
  const transcurrido = (ahora ?? pintadaEn) - new Date(pedido.fechaHora).getTime();
  const tono = tonoDelTiempo(transcurrido);

  const avisoDeBloqueo =
    pedido.estado === 'PAGADO'
      ? 'Pedido cobrado: ya no se pueden agregar platillos.'
      : 'Comanda enviada a cocina: ya no se pueden agregar platillos.';

  const idNota = `nota-${pedido.id}`;

  return (
    <article className={`f-comanda papel f-comanda--${pared ? 'pared' : editable ? 'editable' : 'lectura'}`}>
      <div className="f-comanda__banda">
        <span className="f-titulo">Mesa {pedido.mesaNumero}</span>
        {pared ? (
          <span
            className={`f-tiempo${tono ? ` f-tiempo--${tono}` : ''}`}
            aria-label="Tiempo desde que llegó"
          >
            {reloj(transcurrido)}
          </span>
        ) : (
          <span className="f-comanda__folio">#{pedido.id}</span>
        )}
      </div>

      <div className="f-comanda__meta">
        {pared ? (
          <>
            <span className="mono">#{pedido.id}</span>
            {meseroNombre ? <span>{meseroNombre}</span> : null}
          </>
        ) : (
          <>
            <Estado glifo={etiqueta.glifo} texto={etiqueta.texto} tono={etiqueta.tono} />
            {pedido.estado !== 'ABIERTO' ? (
              <span className="mono">{hora(pedido.fechaHora)}</span>
            ) : null}
          </>
        )}
      </div>

      {variante === 'bloqueada' ? <div className="f-comanda__aviso">{avisoDeBloqueo}</div> : null}

      <div className="f-comanda__lineas">
        {lineas.map((linea) =>
          editable ? (
            <LineaPedidoEditable
              key={linea.platilloId}
              nombre={linea.nombre}
              precioUnitario={linea.precioUnitario}
              cantidad={linea.cantidad}
              importe={linea.importe}
              onMenos={() => onMenos?.(linea.platilloId)}
              onMas={() => onMas?.(linea.platilloId)}
              bloqueado={bloqueado}
            />
          ) : (
            <LineaPedido
              key={linea.platilloId}
              nombre={linea.nombre}
              cantidad={linea.cantidad}
              importe={linea.importe}
              conPrecio={!pared}
            />
          ),
        )}
      </div>

      {editable ? (
        <div className={`f-comanda__nota${errorNota ? ' f-campo--error' : ''}`}>
          <label htmlFor={idNota}>Nota para cocina</label>
          <textarea
            id={idNota}
            value={nota ?? pedido.observaciones ?? ''}
            aria-describedby={errorNota ? `${idNota}-m` : undefined}
            aria-invalid={errorNota ? true : undefined}
            onChange={(evento) => onCambiarNota?.(evento.target.value)}
            onBlur={() => onGuardarNota?.()}
          />
          {errorNota ? (
            <span className="f-campo__error" id={`${idNota}-m`}>
              ! {errorNota}
            </span>
          ) : null}
        </div>
      ) : pedido.observaciones ? (
        <div className="f-comanda__nota">{pedido.observaciones}</div>
      ) : null}

      {!pared || pie ? (
        <div className="f-comanda__pie">
          {pared ? null : (
            <div className="f-comanda__suma">
              <span>{platillos(unidades)} · sin impuestos</span>
              <Cifra valor={pedido.total} />
            </div>
          )}
          {pie}
        </div>
      ) : null}
    </article>
  );
}
