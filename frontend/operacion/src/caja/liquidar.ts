import type { PedidoDTO } from '@compartido/api/tipos';

/** Impuesto al consumo de los restaurantes en Colombia. */
export const IMPOCONSUMO = 0.08;

export interface Liquidacion {
  consumo: number;
  impoconsumo: number;
  total: number;
}

/**
 * Las tres cifras de la cuenta a partir del consumo sin impuestos.
 *
 * Se redondea a centavos igual que el backend (Factura), para que el total que
 * se muestra y el que se envía al cobrar con tarjeta sean el mismo número.
 */
export function liquidar(consumo: number): Liquidacion {
  const impoconsumo = Math.round(consumo * IMPOCONSUMO * 100) / 100;
  return { consumo, impoconsumo, total: Math.round((consumo + impoconsumo) * 100) / 100 };
}

/** Las cuentas que la caja todavía tiene que cobrar. */
export function porCobrar(pedidos: PedidoDTO[]): PedidoDTO[] {
  return pedidos.filter((p) => p.estado !== 'PAGADO' && p.estado !== 'CANCELADO');
}

const PRIORIDAD: Record<string, number> = { SERVIDO: 0, EN_PREPARACION: 1, EN_COCINA: 2, ABIERTO: 3 };

/** Primero lo que ya está servido (es lo próximo que se cobra); dentro de cada estado, por orden de llegada. */
export function ordenarCola(pedidos: PedidoDTO[]): PedidoDTO[] {
  return [...pedidos].sort(
    (a, b) => (PRIORIDAD[a.estado] ?? 9) - (PRIORIDAD[b.estado] ?? 9) || a.id - b.id
  );
}
