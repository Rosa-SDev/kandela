import type { CrearReserva } from '@compartido/api/tipos';

export interface FormularioReserva {
  cliente: string;
  fecha: string;
  hora: string;
  personas: string;
  mesa: string;
  mesero: string;
}

export type CampoDeReserva = keyof FormularioReserva;

export type ErroresDeReserva = Partial<Record<CampoDeReserva, string>>;

/** El formulario recién abierto, con el mesero que se le indique ya elegido. */
export function formularioVacio(meseroId?: number): FormularioReserva {
  return {
    cliente: '',
    fecha: '',
    hora: '',
    personas: '',
    mesa: '',
    mesero: meseroId != null ? String(meseroId) : ''
  };
}

/** La marca de tiempo local truncada a minutos, para comparar fechas. */
function enMinutos(momento: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return (
    `${momento.getFullYear()}-${dos(momento.getMonth() + 1)}-${dos(momento.getDate())}` +
    `T${dos(momento.getHours())}:${dos(momento.getMinutes())}`
  );
}

/**
 * Lo que está mal en el formulario, por campo.
 *
 * Aquí solo se comprueban las reglas de forma: que no falte nada obligatorio,
 * que la fecha no haya pasado y que vaya al menos una persona.
 *
 * Que la mesa alcance para esa cantidad de gente NO se comprueba aquí, aunque
 * la pantalla tenga las capacidades a mano: esa regla la resuelve el servicio
 * de reservas preguntándole al del salón, y si la pantalla se adelantara,
 * jamás se vería la respuesta real del servidor.
 *
 * La comparación de la fecha se hace por minutos, igual que en el servidor:
 * comparar por segundos rechazaría aquí una reserva que allá sí se acepta.
 */
export function validar(formulario: FormularioReserva, ahora: Date = new Date()): ErroresDeReserva {
  const errores: ErroresDeReserva = {};

  if (!formulario.cliente) {
    errores.cliente = 'El cliente es obligatorio.';
  }
  if (!formulario.fecha) {
    errores.fecha = 'La fecha es obligatoria.';
  }
  if (!formulario.hora) {
    errores.hora = 'La hora es obligatoria.';
  }
  if (formulario.fecha && formulario.hora) {
    if (`${formulario.fecha}T${formulario.hora}` < enMinutos(ahora)) {
      errores.fecha = 'No se puede reservar para una fecha que ya pasó.';
    }
  }

  const personas = formulario.personas.trim();
  if (!personas) {
    errores.personas = 'El número de personas es obligatorio.';
  } else if (!/^\d+$/.test(personas) || Number(personas) < 1) {
    errores.personas = 'Debe ser al menos 1 persona.';
  }

  return errores;
}

/**
 * El cuerpo que espera el servicio de reservas.
 *
 * La fecha y la hora se juntan tal como las escribió el mesero, sin pasar por
 * UTC: el servidor las lee como hora local y, si se convirtieran, una reserva
 * de las siete de la tarde podría guardarse en el día siguiente.
 *
 * La mesa y el mesero sin elegir no se envían: el servicio los trata como no
 * asignados, y mandar un nulo explícito no aporta nada.
 */
export function cuerpoDeReserva(formulario: FormularioReserva): CrearReserva {
  const cuerpo: CrearReserva = {
    fechaHora: `${formulario.fecha}T${formulario.hora}:00`,
    numPersonas: Number(formulario.personas.trim()),
    clienteId: Number(formulario.cliente)
  };
  if (formulario.mesa) {
    cuerpo.mesaId = Number(formulario.mesa);
  }
  if (formulario.mesero) {
    cuerpo.meseroId = Number(formulario.mesero);
  }
  return cuerpo;
}

/**
 * A qué campos del formulario corresponde cada campo del servidor.
 *
 * La fecha y la hora son un solo dato para el servicio y dos campos en la
 * pantalla, así que un error suyo marca los dos: el mesero no sabría cuál de
 * los dos arreglar si solo se marcara uno.
 */
const CAMPOS_DEL_SERVIDOR: Record<string, CampoDeReserva[]> = {
  fechaHora: ['fecha', 'hora'],
  numPersonas: ['personas'],
  clienteId: ['cliente'],
  mesaId: ['mesa'],
  meseroId: ['mesero']
};

/** Traduce los errores por campo del servidor a los campos de la pantalla. */
export function erroresDelServidor(campos: Record<string, string>): ErroresDeReserva {
  const errores: ErroresDeReserva = {};
  for (const [campoRemoto, mensaje] of Object.entries(campos)) {
    for (const campo of CAMPOS_DEL_SERVIDOR[campoRemoto] ?? []) {
      errores[campo] = mensaje;
    }
  }
  return errores;
}
