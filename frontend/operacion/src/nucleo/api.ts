import type { ErrorKandela } from '@compartido/api/errores';
import { traducirError } from '@compartido/api/errores';

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function leerCuerpo(respuesta: Response): Promise<unknown> {
  const texto = await respuesta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

async function solicitud<T>(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      headers: cuerpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw traducirError(null, null);
  }

  const cuerpoRespuesta = await leerCuerpo(respuesta);

  if (!respuesta.ok) {
    throw traducirError(respuesta.status, cuerpoRespuesta);
  }

  return cuerpoRespuesta as T;
}

export function get<T>(ruta: string): Promise<T> {
  return solicitud<T>('GET', ruta);
}

export function post<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  return solicitud<T>('POST', ruta, cuerpo);
}

export function put<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  return solicitud<T>('PUT', ruta, cuerpo);
}

export function patch<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  return solicitud<T>('PATCH', ruta, cuerpo);
}

export function del<T>(ruta: string): Promise<T> {
  return solicitud<T>('DELETE', ruta);
}

export function esErrorKandela(e: unknown): e is ErrorKandela {
  return (
    typeof e === 'object' &&
    e !== null &&
    'status' in e &&
    'titulo' in e &&
    'texto' in e &&
    'campos' in e
  );
}

/**
 * Deja cualquier fallo en forma de ErrorKandela, listo para el Aviso.
 *
 * Lo que sale de `solicitud` ya viene traducido, pero un `catch` recibe
 * `unknown`: si lo que llegó no es un error nuestro —un fallo del navegador,
 * por ejemplo— se muestra un mensaje genérico en vez de romper la pantalla.
 */
export function comoErrorKandela(error: unknown): ErrorKandela {
  if (esErrorKandela(error)) {
    return error;
  }
  return { status: null, titulo: 'No se pudo completar la solicitud.', texto: '', campos: {} };
}
