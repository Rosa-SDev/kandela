import type { ReactNode } from 'react';
import type { MesaDTO, PedidoDTO, ReservaDTO } from '@compartido/api/tipos';
import { dinero } from '../componentes/Cifra';
import { Estado } from '../componentes/Estado';
import { ETIQUETA_ESTADO, hora, platillos } from './estadoPedido';

/** En qué situación está la mesa en el plano, con el dato que lo explica. */
export type EstadoDeMesa =
  | { clave: 'libre' }
  | { clave: 'ocupada'; pedido: PedidoDTO }
  | { clave: 'reservada'; reserva: ReservaDTO };

/** Mesas de hasta 2, 4, 6 u 8 puestos: la forma del dibujo se redondea a esas cuatro. */
function formaDeMesa(capacidad: number): 2 | 4 | 6 | 8 {
  if (capacidad <= 2) return 2;
  if (capacidad <= 4) return 4;
  if (capacidad <= 6) return 6;
  return 8;
}

const SILLAS_POR_LADO: Record<number, { t: number; b: number; l: number; r: number }> = {
  2: { t: 1, b: 1, l: 0, r: 0 },
  4: { t: 1, b: 1, l: 1, r: 1 },
  6: { t: 2, b: 2, l: 1, r: 1 },
  8: { t: 3, b: 3, l: 1, r: 1 },
};

/** Las sillas repartidas alrededor del tablero, a distancias iguales. */
function sillas(forma: number): ReactNode[] {
  const porLado = SILLAS_POR_LADO[forma];
  const piezas: ReactNode[] = [];

  for (const lado of ['t', 'b', 'l', 'r'] as const) {
    for (let i = 0; i < porLado[lado]; i++) {
      const posicion = `${(((i + 1) / (porLado[lado] + 1)) * 100).toFixed(1)}%`;
      const horizontal = lado === 't' || lado === 'b';
      piezas.push(
        <i
          key={`${lado}${i}`}
          className={`f-silla f-silla--${horizontal ? 'h' : 'v'} f-silla--${lado}`}
          style={horizontal ? { left: posicion } : { top: posicion }}
        />,
      );
    }
  }

  return piezas;
}

export interface MesaProps {
  mesa: MesaDTO;
  estado: EstadoDeMesa;
  seleccionada?: boolean;
  /** Verdadero cuando un filtro la deja fuera: se ve apagada, no desaparece. */
  filtrada?: boolean;
  onSeleccionar?: (mesa: MesaDTO) => void;
}

/**
 * Una mesa en el plano del salón.
 *
 * Lo que se lee debajo del número no es el estado de la mesa sino el del
 * pedido que tiene encima: al mesero le sirve más saber que la mesa 5 está
 * «en cocina» que saber que está «ocupada».
 */
export function Mesa({ mesa, estado, seleccionada = false, filtrada = false, onSeleccionar }: MesaProps) {
  let meta: ReactNode;
  let comoSeLee: string;

  if (estado.clave === 'ocupada') {
    const etiqueta = ETIQUETA_ESTADO[estado.pedido.estado];
    meta = (
      <>
        <Estado glifo={etiqueta.glifo} texto={etiqueta.texto} tono={etiqueta.tono} />
        <span className="num">
          {dinero(estado.pedido.total)} · {platillos(estado.pedido.platillos.length)}
        </span>
      </>
    );
    comoSeLee = `ocupada, ${etiqueta.texto.toLowerCase()}`;
  } else if (estado.clave === 'reservada') {
    const cuando = hora(estado.reserva.fechaHora);
    meta = (
      <>
        <Estado glifo="▲" texto={`Reservada · ${cuando}`} />
        <span>
          {estado.reserva.clienteNombre} · {estado.reserva.numPersonas}
        </span>
      </>
    );
    comoSeLee = `reservada a las ${cuando}`;
  } else {
    meta = (
      <>
        <Estado glifo="○" texto="Libre" />
        <span>{mesa.capacidad} personas</span>
      </>
    );
    comoSeLee = 'libre';
  }

  const forma = formaDeMesa(mesa.capacidad);

  return (
    <button
      type="button"
      className="f-mesa"
      aria-pressed={seleccionada}
      data-filtrada={filtrada}
      aria-label={`Mesa ${mesa.numero}: ${comoSeLee}`}
      onClick={() => onSeleccionar?.(mesa)}
    >
      <span className={`f-plano f-plano--c${forma} f-plano--${estado.clave}`}>
        <b>{mesa.numero}</b>
        {sillas(forma)}
      </span>
      <span className="f-mesa__meta">{meta}</span>
    </button>
  );
}
