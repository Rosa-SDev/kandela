import type { LineaPedidoDTO } from '@compartido/api/tipos';

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
 * El backend guarda una línea por unidad, porque cada una es un platillo que
 * se sirve. La pantalla no puede mostrar tres filas iguales de bandeja paisa,
 * así que las agrupa y muestra la cantidad. El orden es el de la primera
 * aparición, para que agregar una unidad no mueva la fila de sitio.
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
        importe: linea.precioUnitario,
      });
    }
  }

  return [...porPlatillo.values()];
}

/**
 * Cuál de las líneas de ese platillo se quita al pulsar «−».
 *
 * Las unidades de un mismo platillo son idénticas salvo el identificador, así
 * que se quita la última agregada: es la que el mesero acaba de poner y es una
 * elección predecible. Devuelve null si ese platillo no está en el pedido.
 */
export function lineaParaQuitar(lineas: LineaPedidoDTO[], platilloId: number): number | null {
  const suyas = lineas.filter((linea) => linea.platilloId === platilloId);
  if (suyas.length === 0) {
    return null;
  }
  return suyas.reduce((mayor, linea) => (linea.id > mayor.id ? linea : mayor)).id;
}

/** Cuántas unidades de cada platillo hay en el pedido, para marcarlo en la carta. */
export function unidadesPorPlatillo(lineas: LineaPedidoDTO[]): Map<number, number> {
  const cuenta = new Map<number, number>();
  for (const linea of lineas) {
    cuenta.set(linea.platilloId, (cuenta.get(linea.platilloId) ?? 0) + 1);
  }
  return cuenta;
}
