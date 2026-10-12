import { describe, expect, it } from 'vitest';
import {
  cuerpoDeReserva,
  erroresDelServidor,
  formularioVacio,
  validar,
  type FormularioReserva
} from './nuevaReserva';

const AHORA = new Date('2026-10-12T17:30:00');

/** Un formulario completo y correcto, al que cada prueba le quita lo que necesita. */
function completo(cambios: Partial<FormularioReserva> = {}): FormularioReserva {
  return {
    cliente: '1',
    fecha: '2026-10-14',
    hora: '19:00',
    personas: '4',
    mesa: '2',
    mesero: '2',
    ...cambios
  };
}

describe('el formulario recién abierto', () => {
  it('deja elegido el mesero que se le indica', () => {
    expect(formularioVacio(2).mesero).toBe('2');
  });

  it('queda sin mesero si no hay ninguno en sesión', () => {
    expect(formularioVacio().mesero).toBe('');
  });

  it('no trae nada más puesto', () => {
    const vacio = formularioVacio(2);
    expect(vacio.cliente).toBe('');
    expect(vacio.fecha).toBe('');
    expect(vacio.hora).toBe('');
    expect(vacio.personas).toBe('');
    expect(vacio.mesa).toBe('');
  });
});

describe('las reglas de forma de la reserva', () => {
  it('acepta un formulario completo', () => {
    expect(validar(completo(), AHORA)).toEqual({});
  });

  it('exige cliente, fecha, hora y personas', () => {
    const errores = validar(
      { cliente: '', fecha: '', hora: '', personas: '', mesa: '', mesero: '' },
      AHORA
    );

    expect(errores.cliente).toBe('El cliente es obligatorio.');
    expect(errores.fecha).toBe('La fecha es obligatoria.');
    expect(errores.hora).toBe('La hora es obligatoria.');
    expect(errores.personas).toBe('El número de personas es obligatorio.');
  });

  it('no exige mesa ni mesero', () => {
    const errores = validar(completo({ mesa: '', mesero: '' }), AHORA);

    expect(errores.mesa).toBeUndefined();
    expect(errores.mesero).toBeUndefined();
  });

  it('rechaza una fecha y hora que ya pasaron', () => {
    const errores = validar(completo({ fecha: '2026-10-12', hora: '17:00' }), AHORA);

    expect(errores.fecha).toBe('No se puede reservar para una fecha que ya pasó.');
  });

  it('acepta el mismo minuto en que se está registrando', () => {
    expect(validar(completo({ fecha: '2026-10-12', hora: '17:30' }), AHORA).fecha).toBeUndefined();
  });

  it('acepta un minuto mas tarde del mismo dia', () => {
    expect(validar(completo({ fecha: '2026-10-12', hora: '17:31' }), AHORA).fecha).toBeUndefined();
  });

  it('no se queja de la fecha pasada si falta la hora', () => {
    const errores = validar(completo({ fecha: '2026-10-01', hora: '' }), AHORA);

    expect(errores.hora).toBe('La hora es obligatoria.');
    expect(errores.fecha).toBeUndefined();
  });

  it('exige al menos una persona', () => {
    expect(validar(completo({ personas: '0' }), AHORA).personas).toBe('Debe ser al menos 1 persona.');
    expect(validar(completo({ personas: '-2' }), AHORA).personas).toBe('Debe ser al menos 1 persona.');
  });

  it('no acepta personas que no sean un numero entero', () => {
    expect(validar(completo({ personas: 'cuatro' }), AHORA).personas).toBe(
      'Debe ser al menos 1 persona.'
    );
    expect(validar(completo({ personas: '2,5' }), AHORA).personas).toBe(
      'Debe ser al menos 1 persona.'
    );
  });

  it('no comprueba si la mesa alcanza: eso lo decide el servidor', () => {
    // La mesa 2 tiene cuatro puestos en los datos del salón; aquí pasan seis
    // personas y la pantalla no se queja, para que el conflicto lo responda
    // el servicio de reservas tras consultar al del salón.
    expect(validar(completo({ mesa: '2', personas: '6' }), AHORA)).toEqual({});
  });
});

describe('el cuerpo que se envía', () => {
  it('junta la fecha y la hora sin convertir la zona', () => {
    expect(cuerpoDeReserva(completo()).fechaHora).toBe('2026-10-14T19:00:00');
  });

  it('manda los numeros como numeros', () => {
    const cuerpo = cuerpoDeReserva(completo());

    expect(cuerpo.numPersonas).toBe(4);
    expect(cuerpo.clienteId).toBe(1);
    expect(cuerpo.mesaId).toBe(2);
    expect(cuerpo.meseroId).toBe(2);
  });

  it('omite la mesa y el mesero cuando no se eligieron', () => {
    const cuerpo = cuerpoDeReserva(completo({ mesa: '', mesero: '' }));

    expect('mesaId' in cuerpo).toBe(false);
    expect('meseroId' in cuerpo).toBe(false);
  });
});

describe('los errores por campo del servidor', () => {
  it('marca la fecha y la hora a la vez, porque para el servidor son un solo dato', () => {
    const errores = erroresDelServidor({ fechaHora: 'La fecha y hora son obligatorias' });

    expect(errores.fecha).toBe('La fecha y hora son obligatorias');
    expect(errores.hora).toBe('La fecha y hora son obligatorias');
  });

  it('traduce los demas nombres a los campos de la pantalla', () => {
    const errores = erroresDelServidor({
      numPersonas: 'El número de personas es obligatorio',
      clienteId: 'El cliente es obligatorio'
    });

    expect(errores.personas).toBe('El número de personas es obligatorio');
    expect(errores.cliente).toBe('El cliente es obligatorio');
  });

  it('ignora un campo que no sepa colocar', () => {
    expect(erroresDelServidor({ loQueSea: 'mensaje' })).toEqual({});
  });
});
