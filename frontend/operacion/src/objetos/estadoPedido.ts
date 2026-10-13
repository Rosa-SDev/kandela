import type { EstadoPedido } from '@compartido/api/tipos';

export interface EtiquetaDeEstado {
  glifo: string;
  texto: string;
  tono: 'ate' | 'err' | 'off' | '';
}

/**
 * Cómo se nombra en pantalla cada estado del pedido.
 *
 * El nombre del valor nunca se muestra: el mesero lee «Sin enviar a cocina»,
 * no «ABIERTO».
 */
export const ETIQUETA_ESTADO: Record<EstadoPedido, EtiquetaDeEstado> = {
  ABIERTO: { glifo: '◆', texto: 'Sin enviar a cocina', tono: 'ate' },
  EN_COCINA: { glifo: '●', texto: 'En cocina', tono: '' },
  EN_PREPARACION: { glifo: '●', texto: 'En preparación', tono: '' },
  SERVIDO: { glifo: '✓', texto: 'Listo para servir', tono: '' },
  PAGADO: { glifo: '✓', texto: 'Cobrado', tono: 'off' },
  CANCELADO: { glifo: '✕', texto: 'Cancelado', tono: 'off' },
};

/** «1 platillo» o «4 platillos». */
export function platillos(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'platillo' : 'platillos'}`;
}

/** La hora de una marca de tiempo del backend, en formato de 24 horas. */
export function hora(fechaHora: string): string {
  return new Date(fechaHora).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
