import { LineaPedidoDTO } from '@compartido/api/tipos';
import { ETIQUETA_PEDIDO, agruparLineas, dinero, estaEnCocina, platillos } from './estado-de-pedido';

/** Las líneas del pedido de la mesa 3: dos bandejas, un ajiaco y un postre. */
const LINEAS: LineaPedidoDTO[] = [
  { id: 1, platilloId: 3, nombre: 'Bandeja paisa', precioUnitario: 38000 },
  { id: 2, platilloId: 2, nombre: 'Ajiaco santafereño', precioUnitario: 28000 },
  { id: 3, platilloId: 3, nombre: 'Bandeja paisa', precioUnitario: 38000 },
  { id: 4, platilloId: 5, nombre: 'Postre de natas', precioUnitario: 12000 }
];

describe('las etiquetas del estado del pedido', () => {
  it('nunca muestran el nombre del valor', () => {
    expect(ETIQUETA_PEDIDO.ABIERTO.texto).toBe('Sin enviar a cocina');
    expect(ETIQUETA_PEDIDO.PAGADO.texto).toBe('Cobrado');
  });

  it('atenuan lo que ya no da trabajo', () => {
    expect(ETIQUETA_PEDIDO.PAGADO.tono).toBe('off');
    expect(ETIQUETA_PEDIDO.CANCELADO.tono).toBe('off');
    expect(ETIQUETA_PEDIDO.EN_COCINA.tono).toBe('');
  });

  it('marcan con atencion el que todavia no salio a cocina', () => {
    expect(ETIQUETA_PEDIDO.ABIERTO.tono).toBe('ate');
    expect(ETIQUETA_PEDIDO.ABIERTO.glifo).toBe('◆');
  });
});

describe('estaEnCocina', () => {
  it('es cierto mientras la cocina lo tiene', () => {
    expect(estaEnCocina('EN_COCINA')).toBe(true);
    expect(estaEnCocina('EN_PREPARACION')).toBe(true);
  });

  it('es falso antes de enviarlo y despues de servirlo', () => {
    expect(estaEnCocina('ABIERTO')).toBe(false);
    expect(estaEnCocina('SERVIDO')).toBe(false);
    expect(estaEnCocina('PAGADO')).toBe(false);
    expect(estaEnCocina('CANCELADO')).toBe(false);
  });
});

describe('agruparLineas', () => {
  it('junta las unidades del mismo platillo y suma su importe', () => {
    const agrupadas = agruparLineas(LINEAS);

    expect(agrupadas).toHaveSize(3);
    const bandeja = agrupadas.find((l) => l.platilloId === 3)!;
    expect(bandeja.cantidad).toBe(2);
    expect(bandeja.importe).toBe(76000);
  });

  it('conserva el orden de la primera aparicion', () => {
    expect(agruparLineas(LINEAS).map((l) => l.nombre)).toEqual([
      'Bandeja paisa',
      'Ajiaco santafereño',
      'Postre de natas'
    ]);
  });

  it('deja en una unidad lo que no se repite', () => {
    const ajiaco = agruparLineas(LINEAS).find((l) => l.platilloId === 2)!;

    expect(ajiaco.cantidad).toBe(1);
    expect(ajiaco.importe).toBe(28000);
  });

  it('con un pedido sin platillos no devuelve nada', () => {
    expect(agruparLineas([])).toEqual([]);
  });
});

describe('los textos de la comanda', () => {
  it('dice platillo en singular y platillos en plural', () => {
    expect(platillos(1)).toBe('1 platillo');
    expect(platillos(4)).toBe('4 platillos');
    expect(platillos(0)).toBe('0 platillos');
  });

  it('escribe el dinero con punto de miles', () => {
    expect(dinero(116000)).toBe('$ 116.000');
    expect(dinero(9000)).toBe('$ 9.000');
  });

  it('redondea los centavos, que en pesos no se cobran', () => {
    expect(dinero(37999.6)).toBe('$ 38.000');
  });
});
