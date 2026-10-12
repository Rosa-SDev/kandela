import { describe, expect, it } from 'vitest';
import { liquidar } from './liquidar';

describe('liquidar', () => {
  it('suma el impoconsumo del 8 % al consumo', () => {
    expect(liquidar(116000)).toEqual({ consumo: 116000, impoconsumo: 9280, total: 125280 });
  });

  it('redondea el impuesto a centavos como el backend', () => {
    expect(liquidar(12345).impoconsumo).toBe(987.6);
    expect(liquidar(12345).total).toBe(13332.6);
  });
});
