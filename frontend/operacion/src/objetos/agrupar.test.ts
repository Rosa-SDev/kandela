import { describe, expect, it } from 'vitest';
import type { LineaPedidoDTO } from '@compartido/api/tipos';
import { agruparLineas, lineaParaQuitar, unidadesPorPlatillo } from './agrupar';

function linea(id: number, platilloId: number, nombre: string, precio: number): LineaPedidoDTO {
  return { id, platilloId, nombre, precioUnitario: precio };
}

const LINEAS = [
  linea(1, 3, 'Bandeja paisa', 38000),
  linea(2, 2, 'Ajiaco santafereño', 28000),
  linea(3, 3, 'Bandeja paisa', 38000),
];

describe('agruparLineas', () => {
  it('junta las unidades del mismo platillo y suma su importe', () => {
    expect(agruparLineas(LINEAS)).toEqual([
      { platilloId: 3, nombre: 'Bandeja paisa', precioUnitario: 38000, cantidad: 2, importe: 76000 },
      { platilloId: 2, nombre: 'Ajiaco santafereño', precioUnitario: 28000, cantidad: 1, importe: 28000 },
    ]);
  });

  it('conserva el orden de la primera aparicion', () => {
    const agrupadas = agruparLineas([...LINEAS, linea(4, 2, 'Ajiaco santafereño', 28000)]);
    expect(agrupadas.map((l) => l.platilloId)).toEqual([3, 2]);
  });

  it('un pedido sin platillos no tiene filas', () => {
    expect(agruparLineas([])).toEqual([]);
  });
});

describe('lineaParaQuitar', () => {
  it('quita la ultima unidad agregada de ese platillo', () => {
    expect(lineaParaQuitar(LINEAS, 3)).toBe(3);
  });

  it('con una sola unidad quita esa', () => {
    expect(lineaParaQuitar(LINEAS, 2)).toBe(2);
  });

  it('devuelve null si ese platillo no esta en el pedido', () => {
    expect(lineaParaQuitar(LINEAS, 99)).toBeNull();
  });

  it('no depende del orden en que lleguen las lineas', () => {
    expect(lineaParaQuitar([...LINEAS].reverse(), 3)).toBe(3);
  });
});

describe('unidadesPorPlatillo', () => {
  it('cuenta cuantas unidades hay de cada platillo', () => {
    const cuenta = unidadesPorPlatillo(LINEAS);
    expect(cuenta.get(3)).toBe(2);
    expect(cuenta.get(2)).toBe(1);
    expect(cuenta.get(99)).toBeUndefined();
  });
});
