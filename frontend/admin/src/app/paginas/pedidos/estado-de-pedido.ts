import { EstadoPedido, LineaPedidoDTO } from '@compartido/api/tipos';

export interface EtiquetaDeEstado {
  glifo: string;
  texto: string;
  tono: 'ate' | 'err' | 'off' | '';
}

/**
 * Cómo se nombra en pantalla cada estado del pedido.
 *
 * El nombre del valor nunca se muestra: en la tabla se lee «Sin enviar a
 * cocina», no «ABIERTO». Un pedido cobrado o cancelado se atenúa, porque ya no
 * da trabajo a nadie.
 */
export const ETIQUETA_PEDIDO: Record<EstadoPedido, EtiquetaDeEstado> = {
  ABIERTO: { glifo: '◆', texto: 'Sin enviar a cocina', tono: 'ate' },
  EN_COCINA: { glifo: '●', texto: 'En cocina', tono: '' },
  EN_PREPARACION: { glifo: '●', texto: 'En preparación', tono: '' },
  SERVIDO: { glifo: '✓', texto: 'Listo para servir', tono: '' },
  PAGADO: { glifo: '✓', texto: 'Cobrado', tono: 'off' },
  CANCELADO: { glifo: '✕', texto: 'Cancelado', tono: 'off' }
};

/** Un pedido está en manos de la cocina mientras se prepara. */
export function estaEnCocina(estado: EstadoPedido): boolean {
  return estado === 'EN_COCINA' || estado === 'EN_PREPARACION';
}

export interface LineaAgrupada {
  platilloId: number;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  importe: number;
}

/**
 * Junta en una sola fila las líneas repetidas del mismo platillo.
 *
 * El salón guarda una línea por unidad, porque cada una es un platillo que se
 * sirve. La comanda no puede mostrar tres filas iguales de bandeja paisa, así
 * que las agrupa y muestra la cantidad. El orden es el de la primera
 * aparición, que es el orden en que el mesero las fue cantando.
 */
export function agruparLineas(lineas: LineaPedidoDTO[]): LineaAgrupada[] {
  const porPlatillo = new Map<number, LineaAgrupada>();

  for (const linea of lineas) {
    const agrupada = porPlatillo.get(linea.platilloId);
    if (agrupada) {
      agrupada.cantidad += 1;
      agrupada.importe += linea.precioUnitario;
    } else {
      porPlatillo.set(linea.platilloId, {
        platilloId: linea.platilloId,
        nombre: linea.nombre,
        precioUnitario: linea.precioUnitario,
        cantidad: 1,
        importe: linea.precioUnitario
      });
    }
  }

  return [...porPlatillo.values()];
}

/** «1 platillo» o «4 platillos». */
export function platillos(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'platillo' : 'platillos'}`;
}

/** El dinero como se escribe en Colombia: «$ 116.000». */
export function dinero(valor: number): string {
  return `$ ${Math.round(valor).toLocaleString('es-CO')}`;
}
