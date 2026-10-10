import { afterEach, describe, expect, it, vi } from 'vitest';
import { del, esErrorKandela, get } from './api';

function respuestaJSON(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status });
}

function respuestaVacia(status: number): Response {
  return new Response(null, { status });
}

function respuestaTexto(status: number, texto: string): Response {
  return new Response(texto, { status });
}

describe('api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GET exitoso devuelve el cuerpo tipado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaJSON(200, { id: 1, nombre: 'Mesa 1' })));
    const resultado = await get<{ id: number; nombre: string }>('/mesas/1');
    expect(resultado).toEqual({ id: 1, nombre: 'Mesa 1' });
  });

  it('DELETE con 204 resuelve sin lanzar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaVacia(204)));
    const resultado = await del('/pedidos/1/platillos/2');
    expect(resultado).toBeNull();
  });

  it('404 con cuerpo de Kandela lanza ErrorKandela', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaJSON(404, { error: 'El platillo 9 no existe.' })));
    await expect(get('/platillos/9')).rejects.toMatchObject({
      status: 404,
      titulo: 'El platillo 9 no existe.',
    });
  });

  it('cuerpo no JSON en un error no rompe el parseo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaTexto(404, '<html>Error 404</html>')));
    await expect(get('/platillos/9')).rejects.toMatchObject({
      titulo: 'No se pudo completar la solicitud.',
    });
  });

  it('sin conexion lanza el error de traducirError(null, null)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(get('/mesas')).rejects.toMatchObject({
      status: null,
      titulo: 'No hay conexión con el servidor.',
    });
  });

  it('esErrorKandela distingue un ErrorKandela de un error de programacion', () => {
    expect(esErrorKandela({ status: 404, titulo: 'x', texto: '', campos: {} })).toBe(true);
    expect(esErrorKandela(new TypeError('boom'))).toBe(false);
    expect(esErrorKandela(null)).toBe(false);
  });
});
