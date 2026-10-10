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
