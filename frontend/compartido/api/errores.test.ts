import { describe, expect, it } from 'vitest';
import { traducirError } from './errores';

describe('traducirError', () => {
  it('sin respuesta', () => {
    const resultado = traducirError(null, null);
    expect(resultado).toEqual({
      status: null,
      titulo: 'No hay conexión con el servidor.',
      texto: '',
      campos: {},
    });
  });

  it('400 con dos campos', () => {
    const cuerpo = {
      error: 'La petición tiene campos inválidos',
      campos: {
        precio: 'El precio debe ser mayor que cero',
        nombre: 'El nombre es obligatorio',
      },
    };
    const resultado = traducirError(400, cuerpo);
    expect(resultado.titulo).toBe('Revise 2 campos');
    expect(resultado.campos).toEqual(cuerpo.campos);
  });

  it('400 con un campo', () => {
    const cuerpo = {
      error: 'La petición tiene campos inválidos',
      campos: { precio: 'El precio debe ser mayor que cero' },
    };
    const resultado = traducirError(400, cuerpo);
    expect(resultado.titulo).toBe('Revise 1 campo');
    expect(resultado.campos).toEqual(cuerpo.campos);
  });

  it('400 sin campos', () => {
    const cuerpo = { error: 'No se puede reservar para una fecha que ya pasó.' };
    const resultado = traducirError(400, cuerpo);
    expect(resultado.titulo).toBe(cuerpo.error);
    expect(resultado.campos).toEqual({});
  });

  it('401 usa siempre el texto fijo', () => {
    const cuerpo = { error: 'Credenciales inválidas' };
    const resultado = traducirError(401, cuerpo);
    expect(resultado.titulo).toBe('Correo o contraseña incorrectos.');
  });

  it('404 con mensaje de Kandela', () => {
    const cuerpo = { error: 'El platillo 9 no existe.' };
    const resultado = traducirError(404, cuerpo);
    expect(resultado.titulo).toBe(cuerpo.error);
  });

  it('409 con mensaje de Kandela', () => {
    const cuerpo = { error: 'Ya existe un cliente con el documento 1001234567.' };
    const resultado = traducirError(409, cuerpo);
    expect(resultado.titulo).toBe(cuerpo.error);
  });

  it('503 con mensaje de Kandela', () => {
    const cuerpo = { error: 'La carta no está disponible en este momento.' };
    const resultado = traducirError(503, cuerpo);
    expect(resultado.titulo).toBe(cuerpo.error);
  });

  it('500 con el cuerpo por defecto de Spring', () => {
    const cuerpo = {
      timestamp: '2026-10-12T10:00:00.000+00:00',
      status: 500,
      error: 'Internal Server Error',
      path: '/api/pedidos',
    };
    const resultado = traducirError(500, cuerpo);
    expect(resultado.titulo).toBe('El servicio no está disponible en este momento.');
  });

  it('405 con el cuerpo por defecto de Spring', () => {
    const cuerpo = {
      timestamp: '2026-10-12T10:00:00.000+00:00',
      status: 405,
      error: 'Method Not Allowed',
      path: '/api/pedidos',
    };
    const resultado = traducirError(405, cuerpo);
    expect(resultado.titulo).toBe('No se pudo completar la solicitud.');
  });

  it('cuerpo null en un 5xx', () => {
    const resultado = traducirError(502, null);
    expect(resultado.titulo).toBe('El servicio no está disponible en este momento.');
  });

  it('cuerpo no JSON en un 4xx', () => {
    const resultado = traducirError(404, '<html>Error 404</html>');
    expect(resultado.titulo).toBe('No se pudo completar la solicitud.');
  });
});
