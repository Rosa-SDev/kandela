import { useCallback, useEffect, useState } from 'react';
import type { ClienteDTO, EstadoReserva, MesaDTO, ReservaDTO, UsuarioDTO } from '@compartido/api/tipos';
import type { ErrorKandela } from '@compartido/api/errores';
import { Aviso } from '../componentes/Aviso';
import { Boton } from '../componentes/Boton';
import { Campo } from '../componentes/Campo';
import { Dialogo } from '../componentes/Dialogo';
import { Drawer } from '../componentes/Drawer';
import { Titulo } from '../componentes/Titulo';
import { FilaReserva } from '../objetos/FilaReserva';
import { esReservaVigente, fechaCorta } from '../objetos/estadoReserva';
import { comoErrorKandela, get, patch, post } from '../nucleo/api';
import { useSesion } from '../nucleo/sesion';
import {
  cuerpoDeReserva,
  erroresDelServidor,
  formularioVacio,
  validar,
  type CampoDeReserva,
  type ErroresDeReserva,
  type FormularioReserva,
} from './nuevaReserva';

/** Cómo se cuenta lo que acaba de pasar con la reserva. */
const HECHO: Partial<Record<EstadoReserva, string>> = {
  CONFIRMADA: 'confirmada',
  CUMPLIDA: 'marcada como cumplida',
  CANCELADA: 'cancelada',
};

/** De identificador de mesa a número de mesa, que es lo que se lee en la fila. */
function numerosDeMesa(mesas: MesaDTO[]): Map<number, number> {
  return new Map(mesas.map((mesa) => [mesa.id, mesa.numero]));
}

/**
 * Las reservas del restaurante, de la más próxima a la más lejana.
 *
 * No se filtran por fecha: el mesero necesita ver la de esta noche y también
 * la del jueves. Las cumplidas y las canceladas se quedan en la lista pero
 * atenuadas, y el paréntesis del título solo cuenta las que siguen en pie.
 *
 * Las mesas se consultan aparte porque la reserva guarda el identificador de
 * la mesa y no su número, que es el que está pintado en el salón. Si el salón
 * no responde, las reservas se siguen viendo: solo falta ese número.
 */
export function Reservas() {
  const [reservas, setReservas] = useState<ReservaDTO[]>([]);
  const [mesas, setMesas] = useState<MesaDTO[]>([]);
  const [error, setError] = useState<ErrorKandela | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cambiando, setCambiando] = useState<number | null>(null);
  const [errorDeAccion, setErrorDeAccion] = useState<ErrorKandela | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [porCancelar, setPorCancelar] = useState<ReservaDTO | null>(null);
  const [errorDelDialogo, setErrorDelDialogo] = useState<ErrorKandela | null>(null);

  const [clientes, setClientes] = useState<ClienteDTO[]>([]);
  const [meseros, setMeseros] = useState<UsuarioDTO[]>([]);
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [formulario, setFormulario] = useState<FormularioReserva>(() => formularioVacio());
  const [errores, setErrores] = useState<ErroresDeReserva>({});
  const [resumen, setResumen] = useState<ErrorKandela | null>(null);
  const [registrando, setRegistrando] = useState(false);

  const { usuario } = useSesion();

  // Nada de setState antes del await: dentro de un efecto eso encadena renders.
  const cargar = useCallback(async () => {
    const [deReservas, deMesas, deClientes, deMeseros] = await Promise.allSettled([
      get<ReservaDTO[]>('/reservas'),
      get<MesaDTO[]>('/mesas'),
      get<ClienteDTO[]>('/clientes'),
      get<UsuarioDTO[]>('/usuarios?rol=MESERO'),
    ]);

    if (deReservas.status === 'rejected') {
      setError(comoErrorKandela(deReservas.reason));
      setReservas([]);
    } else {
      setError(null);
      setReservas(deReservas.value);
    }

    setMesas(deMesas.status === 'fulfilled' ? deMesas.value : []);
    setClientes(deClientes.status === 'fulfilled' ? deClientes.value : []);
    setMeseros(deMeseros.status === 'fulfilled' ? deMeseros.value : []);
    setCargando(false);
  }, []);

  useEffect(() => {
    // Pedir los datos al entrar es justo para lo que sirve un efecto. El aviso
    // del analizador es por los setState de cargar, que ocurren después del
    // await y no encadenan un render de más.
    // oxlint-disable-next-line react/set-state-in-effect
    void cargar();
  }, [cargar]);

  function reintentar() {
    setCargando(true);
    setError(null);
    void cargar();
  }

  /**
   * Mueve la reserva al estado que se le pida y devuelve el fallo, si hubo.
   *
   * No muestra el error: quien llama decide dónde va, porque el de Confirmar
   * se lee sobre la lista y el de Cancelar tiene que quedarse dentro del
   * diálogo, junto al botón que lo provocó.
   *
   * La lista se actualiza con la reserva que devuelve el servidor y no con una
   * copia cambiada aquí: si el estado ya había cambiado por otro lado, lo que
   * manda es lo que el servidor diga. Mientras la petición va, los botones de
   * esa fila quedan bloqueados para no mandar el cambio dos veces.
   */
  async function cambiarEstado(
    reserva: ReservaDTO,
    nuevoEstado: EstadoReserva,
  ): Promise<ErrorKandela | null> {
    setCambiando(reserva.id);
    setErrorDeAccion(null);
    setHecho(null);
    try {
      const actualizada = await patch<ReservaDTO>(`/reservas/${reserva.id}/estado`, { nuevoEstado });
      setReservas((anteriores) =>
        anteriores.map((una) => (una.id === actualizada.id ? actualizada : una)),
      );
      setHecho(`Reserva de ${reserva.clienteNombre} ${HECHO[nuevoEstado]}.`);
      return null;
    } catch (fallo) {
      return comoErrorKandela(fallo);
    } finally {
      setCambiando(null);
    }
  }

  /** Confirmar y Cumplida: el fallo, si lo hay, se lee sobre la lista. */
  async function avanzar(reserva: ReservaDTO, nuevoEstado: EstadoReserva) {
    if (cambiando !== null) {
      return;
    }
    setErrorDeAccion(await cambiarEstado(reserva, nuevoEstado));
  }

  /** El diálogo se queda abierto si el servidor rechaza la cancelación. */
  async function confirmarLaCancelacion() {
    if (!porCancelar || cambiando !== null) {
      return;
    }
    const fallo = await cambiarEstado(porCancelar, 'CANCELADA');
    if (fallo) {
      setErrorDelDialogo(fallo);
    } else {
      setPorCancelar(null);
    }
  }

  function pedirCancelar(reserva: ReservaDTO) {
    setErrorDelDialogo(null);
    setPorCancelar(reserva);
  }

  function abrirDrawer() {
    setFormulario(formularioVacio(usuario?.id));
    setErrores({});
    setResumen(null);
    setHecho(null);
    setErrorDeAccion(null);
    setDrawerAbierto(true);
  }

  /** Al escribir en un campo, su error deja de tener sentido. */
  function cambiarCampo(campo: CampoDeReserva, valor: string) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
    setErrores((anteriores) => {
      if (!(campo in anteriores)) {
        return anteriores;
      }
      const resto = { ...anteriores };
      delete resto[campo];
      return resto;
    });
  }

  /**
   * Envía la reserva al servidor.
   *
   * Las reglas de forma se comprueban antes para no gastar una ida y vuelta,
   * pero las de negocio —si la mesa alcanza, si el cliente existe— las
   * responde el servicio, y su mensaje es el que se muestra.
   */
  async function registrar() {
    if (registrando) {
      return;
    }

    const deForma = validar(formulario);
    if (Object.keys(deForma).length > 0) {
      setErrores(deForma);
      const cuantos = Object.keys(deForma).length;
      setResumen({
        status: null,
        titulo: `Revise ${cuantos} campo${cuantos === 1 ? '' : 's'}`,
        texto: 'No se registró nada todavía.',
        campos: {},
      });
      return;
    }

    setRegistrando(true);
    setErrores({});
    setResumen(null);
    try {
      const creada = await post<ReservaDTO>('/reservas', cuerpoDeReserva(formulario));
      setReservas((anteriores) => [...anteriores, creada]);
      setHecho(
        `Reserva de ${creada.clienteNombre} registrada para ` +
          `${fechaCorta(creada.fechaHora).toLowerCase()} a las ${formulario.hora}. ` +
          'Queda pendiente de confirmar.',
      );
      setDrawerAbierto(false);
    } catch (error) {
      const fallo = comoErrorKandela(error);
      // Si el servidor dice qué campos están mal, se marcan uno por uno: el
      // aviso de arriba dice cuántos son y cada campo dice lo suyo.
      if (Object.keys(fallo.campos).length > 0) {
        setErrores(erroresDelServidor(fallo.campos));
        setResumen({ ...fallo, texto: 'No se registró nada todavía.' });
      } else if (fallo.status === 409) {
        // El único conflicto al registrar es que la mesa elegida no alcance
        // para esa cantidad de gente. Lo decide el servicio de reservas tras
        // preguntarle al del salón por la capacidad, y su mensaje ya dice
        // cuántos puestos tiene; aquí solo se añade qué hacer y se marca el
        // campo que hay que cambiar.
        setErrores({ mesa: 'Revise este campo.' });
        setResumen({ ...fallo, texto: 'Elija otra mesa o déjela sin asignar.' });
      } else {
        setResumen(fallo);
      }
    } finally {
      setRegistrando(false);
    }
  }

  /** Lo que se puede hacer con una reserva depende de en qué estado está. */
  function accionesDe(reserva: ReservaDTO) {
    if (!esReservaVigente(reserva.estado)) {
      return null;
    }
    const bloqueada = cambiando !== null;
    return (
      <>
        {reserva.estado === 'PENDIENTE' ? (
          <Boton
            texto="Confirmar"
            variante="tinta"
            disabled={bloqueada}
            onClick={() => void avanzar(reserva, 'CONFIRMADA')}
          />
        ) : null}
        {reserva.estado === 'CONFIRMADA' ? (
          <Boton
            texto="Cumplida"
            variante="tinta"
            disabled={bloqueada}
            onClick={() => void avanzar(reserva, 'CUMPLIDA')}
          />
        ) : null}
        <Boton
          texto="Cancelar"
          variante="baja"
          disabled={bloqueada}
          onClick={() => pedirCancelar(reserva)}
        />
      </>
    );
  }

  const numeros = numerosDeMesa(mesas);
  const enOrden = [...reservas].sort((una, otra) => una.fechaHora.localeCompare(otra.fechaHora));
  const vigentes = enOrden.filter((reserva) => esReservaVigente(reserva.estado)).length;

  // Cancelar suelta la mesa en el plano; si la reserva no tenía mesa asignada,
  // lo único que cambia es que queda en el historial.
  const numeroPorCancelar =
    porCancelar?.mesaId != null ? numeros.get(porCancelar.mesaId) : undefined;
  const consecuencias = porCancelar
    ? [
        numeroPorCancelar != null
          ? `La mesa ${numeroPorCancelar} deja de aparecer reservada.`
          : 'La reserva queda en el historial como cancelada.',
        'No se puede volver a activar: habría que registrar una nueva.',
      ]
    : [];

  return (
    <section className="salon-sec" aria-label="Reservas">
      <div className="sh-cab">
        <Titulo
          texto="Reservas"
          par={
            cargando || error
              ? undefined
              : `${vigentes} ${vigentes === 1 ? 'vigente' : 'vigentes'}`
          }
        />
        <Boton texto="Nueva reserva" variante="calor" onClick={abrirDrawer} />
      </div>

      {error ? (
        <Aviso
          tono="err"
          titulo={error.titulo}
          texto={error.texto}
          accion={<Boton texto="Reintentar" variante="tinta" onClick={reintentar} />}
        />
      ) : null}

      {errorDeAccion ? (
        <Aviso tono="err" titulo={errorDeAccion.titulo} texto={errorDeAccion.texto} />
      ) : null}

      {hecho && !errorDeAccion ? <Aviso titulo={hecho} /> : null}

      {!cargando && !error && enOrden.length === 0 ? (
        <p className="salon-vacio">
          Sin reservas <span>(por ahora)</span>
        </p>
      ) : null}

      {enOrden.length > 0 ? (
        <div>
          {enOrden.map((reserva) => (
            <FilaReserva
              key={reserva.id}
              reserva={reserva}
              mesaNumero={reserva.mesaId != null ? numeros.get(reserva.mesaId) : null}
              acciones={accionesDe(reserva)}
            />
          ))}
        </div>
      ) : null}

      {drawerAbierto ? (
        <Drawer
          titulo="Nueva reserva"
          onCerrar={() => setDrawerAbierto(false)}
          cuerpo={
            <>
              {resumen ? (
                <Aviso
                  tono="err"
                  titulo={resumen.titulo}
                  texto={resumen.texto}
                  accion={
                    // Un servicio caído no es culpa de lo que se escribió: se
                    // ofrece reenviar lo mismo en vez de pedirlo otra vez.
                    resumen.status !== null && resumen.status >= 500 ? (
                      <Boton
                        texto="Reintentar"
                        variante="tinta"
                        disabled={registrando}
                        onClick={() => void registrar()}
                      />
                    ) : undefined
                  }
                />
              ) : null}

              <Campo
                id="reserva-cliente"
                label="Cliente"
                tipo="select"
                req
                valor={formulario.cliente}
                error={errores.cliente}
                opciones={[
                  ['', 'Elija un cliente'],
                  ...clientes.map(
                    (cliente) =>
                      [String(cliente.id), `${cliente.nombre} · ${cliente.documento}`] as [
                        string,
                        string,
                      ],
                  ),
                ]}
                onCambiar={(valor) => cambiarCampo('cliente', valor)}
              />

              <div className="f-dos">
                <Campo
                  id="reserva-fecha"
                  label="Fecha"
                  tipo="date"
                  req
                  valor={formulario.fecha}
                  error={errores.fecha}
                  onCambiar={(valor) => cambiarCampo('fecha', valor)}
                />
                <Campo
                  id="reserva-hora"
                  label="Hora"
                  tipo="time"
                  req
                  valor={formulario.hora}
                  error={errores.hora}
                  onCambiar={(valor) => cambiarCampo('hora', valor)}
                />
              </div>

              <div className="f-dos">
                <Campo
                  id="reserva-personas"
                  label="Personas"
                  req
                  valor={formulario.personas}
                  error={errores.personas}
                  onCambiar={(valor) => cambiarCampo('personas', valor)}
                />
                <Campo
                  id="reserva-mesa"
                  label="Mesa"
                  tipo="select"
                  valor={formulario.mesa}
                  error={errores.mesa}
                  opciones={[
                    ['', 'Sin asignar'],
                    ...[...mesas]
                      .sort((una, otra) => una.numero - otra.numero)
                      .map(
                        (mesa) =>
                          [String(mesa.id), `Mesa ${mesa.numero} · ${mesa.capacidad} personas`] as [
                            string,
                            string,
                          ],
                      ),
                  ]}
                  onCambiar={(valor) => cambiarCampo('mesa', valor)}
                />
              </div>

              <Campo
                id="reserva-mesero"
                label="Mesero"
                tipo="select"
                valor={formulario.mesero}
                error={errores.mesero}
                opciones={[
                  ['', 'Sin asignar'],
                  ...meseros.map(
                    (mesero) => [String(mesero.id), mesero.nombre] as [string, string],
                  ),
                ]}
                onCambiar={(valor) => cambiarCampo('mesero', valor)}
              />

              <p className="f-req">* Obligatorio</p>
            </>
          }
          pieDer={
            <>
              <Boton texto="Cancelar" variante="texto" onClick={() => setDrawerAbierto(false)} />
              <Boton
                texto="Registrar reserva"
                variante="calor"
                disabled={registrando}
                onClick={() => void registrar()}
              />
            </>
          }
        />
      ) : null}

      {porCancelar ? (
        <Dialogo
          tipo="Cambio de estado"
          titulo={`¿Cancelar la reserva de ${porCancelar.clienteNombre}?`}
          consecuencias={consecuencias}
          error={
            errorDelDialogo ? { t: errorDelDialogo.titulo, x: errorDelDialogo.texto } : undefined
          }
          confirmar={
            <Boton
              texto="Cancelar reserva"
              variante="calor"
              disabled={cambiando !== null}
              onClick={() => void confirmarLaCancelacion()}
            />
          }
          onCerrar={() => setPorCancelar(null)}
        />
      ) : null}
    </section>
  );
}
