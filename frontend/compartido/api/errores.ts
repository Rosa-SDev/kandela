export interface ErrorKandela {
  status: number | null; // null = sin respuesta
  titulo: string; // lo que va en negrita en el Aviso
  texto: string; // la segunda línea
  campos: Record<string, string>; // errores por campo (400)
}

interface CuerpoKandela {
  error: string;
  campos?: Record<string, string>;
}

function esCuerpoKandela(cuerpo: unknown): cuerpo is CuerpoKandela {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    return false;
  }
  const objeto = cuerpo as Record<string, unknown>;
  return typeof objeto.error === 'string' && !('timestamp' in objeto) && !('path' in objeto);
}

export function traducirError(status: number | null, cuerpo: unknown): ErrorKandela {
  if (status === null) {
    return { status, titulo: 'No hay conexión con el servidor.', texto: '', campos: {} };
  }

  if (status === 401) {
    return { status, titulo: 'Correo o contraseña incorrectos.', texto: '', campos: {} };
  }

  if (esCuerpoKandela(cuerpo)) {
    if (status === 400 && cuerpo.campos && Object.keys(cuerpo.campos).length > 0) {
      const n = Object.keys(cuerpo.campos).length;
      return {
        status,
        titulo: `Revise ${n} campo${n === 1 ? '' : 's'}`,
        texto: '',
        campos: cuerpo.campos,
      };
    }
    return { status, titulo: cuerpo.error, texto: '', campos: {} };
  }

  if (status >= 500) {
    return { status, titulo: 'El servicio no está disponible en este momento.', texto: '', campos: {} };
  }

  return { status, titulo: 'No se pudo completar la solicitud.', texto: '', campos: {} };
}
