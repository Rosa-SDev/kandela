import { ResenaDTO } from '@compartido/api/tipos';
import { esPorRevisar, estadoDe } from './resenas.component';

const BASE: ResenaDTO = {
  id: 1,
  texto: 'La sopa llegó fría.',
  fecha: '2026-11-15T20:41:00',
  mesaId: 4,
  pedidoId: null,
  accion: 'QUEUE',
  etiqueta: 'negative',
  confianza: 0.84,
  umbral: 0.5933,
  modelo: 'beto-sentitriage',
  sinClasificar: false,
  revisada: false
};

describe('estadoDe', () => {
  it('muestra la queja con el glifo de atención urgente', () => {
    expect(estadoDe(BASE)).toEqual({ glifo: '!', texto: 'Queja', tono: 'err' });
  });

  it('muestra la duda del agente como algo que requiere una persona', () => {
    expect(estadoDe({ ...BASE, accion: 'ABSTAIN', etiqueta: 'neutral', confianza: 0.51 }).texto)
      .toBe('Requiere una persona');
  });

  it('distingue la reseña que quedó sin clasificar porque el agente no respondió', () => {
    const sinRespuesta = { ...BASE, accion: 'ABSTAIN' as const, etiqueta: null, confianza: null, sinClasificar: true };
    expect(estadoDe(sinRespuesta)).toEqual({ glifo: '◆', texto: 'Sin clasificar', tono: 'ate' });
  });

  it('marca la almacenada sin tono de alerta', () => {
    expect(estadoDe({ ...BASE, accion: 'PASS', etiqueta: 'positive' }).tono).toBe('');
  });
});

describe('esPorRevisar', () => {
  it('incluye las quejas y las dudas que nadie ha revisado', () => {
    expect(esPorRevisar(BASE)).toBeTrue();
    expect(esPorRevisar({ ...BASE, accion: 'ABSTAIN' })).toBeTrue();
  });

  it('deja fuera las almacenadas y las ya revisadas', () => {
    expect(esPorRevisar({ ...BASE, accion: 'PASS' })).toBeFalse();
    expect(esPorRevisar({ ...BASE, revisada: true })).toBeFalse();
  });
});
