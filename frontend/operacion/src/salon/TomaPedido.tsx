import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { MesaDTO, PedidoDTO, PlatilloDTO } from '@compartido/api/tipos';
import type { ErrorKandela } from '@compartido/api/errores';
import { Aviso } from '../componentes/Aviso';
import { Boton } from '../componentes/Boton';
import { Titulo } from '../componentes/Titulo';
import { lineaParaQuitar, unidadesPorPlatillo } from '../objetos/agrupar';
import { Carta } from '../objetos/Carta';
import { Comanda } from '../objetos/Comanda';
import { del, esErrorKandela, get, patch, post } from '../nucleo/api';

function comoError(error: unknown): ErrorKandela {
  if (esErrorKandela(error)) {
    return error;
  }
  return { status: null, titulo: 'No se pudo completar la solicitud.', texto: '', campos: {} };
}

/**
 * La toma del pedido: la carta a un lado y la comanda al otro.
 *
 * Todo lo que cambia el pedido pasa por el servidor y la pantalla se vuelve a
 * pintar con lo que él responde. No se adelanta el resultado: si el platillo
 * se agotó hace un segundo, el mesero tiene que verlo.
 */
export function TomaPedido() {
  const { id } = useParams();
  const pedidoId = Number(id);
  const navegar = useNavigate();

  const [pedido, setPedido] = useState<PedidoDTO | null>(null);
  const [mesa, setMesa] = useState<MesaDTO | null>(null);
  const [carta, setCarta] = useState<PlatilloDTO[]>([]);
  const [errorDelPedido, setErrorDelPedido] = useState<ErrorKandela | null>(null);
  // «La carta no está disponible» es un solo estado, venga de donde venga el
  // fallo: el 500 del gateway con carta apagado, un 503, el 404 de los
  // instantes en que está arrancando o quedarse sin conexión.
  const [cartaCaida, setCartaCaida] = useState(false);
  const [reintentando, setReintentando] = useState(false);
  const [errorDeAccion, setErrorDeAccion] = useState<ErrorKandela | null>(null);
  const [errorDeNota, setErrorDeNota] = useState<string | undefined>(undefined);
  const [borradorDeNota, setBorradorDeNota] = useState('');
  // Candado: con una petición en camino, «+» y «−» quedan quietos. Si no, dos
  // respuestas podrían llegar en desorden y la vieja pisaría a la nueva.
  const [ocupado, setOcupado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    const [delPedido, deLaCarta] = await Promise.allSettled([
      get<PedidoDTO>(`/pedidos/${pedidoId}`),
      get<PlatilloDTO[]>('/platillos'),
    ]);

    if (delPedido.status === 'rejected') {
      setErrorDelPedido(comoError(delPedido.reason));
    } else {
      setErrorDelPedido(null);
      setPedido(delPedido.value);
      setBorradorDeNota(delPedido.value.observaciones ?? '');
      // La capacidad va en el paréntesis del título y vive en la mesa, no en el
      // pedido. Si no llega, el título se queda sin paréntesis y ya.
      get<MesaDTO>(`/mesas/${delPedido.value.mesaId}`)
        .then(setMesa)
        .catch(() => setMesa(null));
    }

    if (deLaCarta.status === 'rejected') {
      setCartaCaida(true);
      setCarta([]);
    } else {
      setCartaCaida(false);
      setCarta(deLaCarta.value);
    }
  }, [pedidoId]);

  useEffect(() => {
    // Los setState de cargar ocurren después del await, no encadenan un render.
    // oxlint-disable-next-line react/set-state-in-effect
    void cargar();
  }, [cargar]);

  async function recargarLaCarta() {
    try {
      setCarta(await get<PlatilloDTO[]>('/platillos'));
      setCartaCaida(false);
    } catch {
      setCartaCaida(true);
      setCarta([]);
    }
  }

  /** Vuelve a pedir la carta. Si sigue sin responder, el aviso se queda. */
  async function reintentarLaCarta() {
    if (reintentando) {
      return;
    }
    setReintentando(true);
    setErrorDeAccion(null);
    await recargarLaCarta();
    setReintentando(false);
  }

  async function agregar(platillo: PlatilloDTO) {
    if (ocupado || !pedido) {
      return;
    }
    setOcupado(true);
    setErrorDeAccion(null);
    try {
      setPedido(await post<PedidoDTO>(`/pedidos/${pedido.id}/platillos`, { platilloId: platillo.id }));
    } catch (error) {
      const fallo = comoError(error);
      if (fallo.status === 503) {
        // Es el salón diciendo que no alcanzó a la carta: la columna entera
        // deja de ser de fiar, y el aviso lo explica mejor que un renglón.
        setCartaCaida(true);
        setErrorDeAccion(null);
      } else if (fallo.status === 409) {
        // Si el servidor dice que se agotó, la carta que está en pantalla ya
        // no es la de verdad: se vuelve a pedir para que aparezca tachado.
        setErrorDeAccion(fallo);
        await recargarLaCarta();
      } else {
        setErrorDeAccion(fallo);
      }
    } finally {
      setOcupado(false);
    }
  }

  async function quitar(platilloId: number) {
    if (ocupado || !pedido) {
      return;
    }
    const lineaId = lineaParaQuitar(pedido.platillos, platilloId);
    if (lineaId === null) {
      return;
    }

    setOcupado(true);
    setErrorDeAccion(null);
    try {
      // El borrado responde sin cuerpo, así que el pedido se vuelve a pedir.
      await del(`/pedidos/${pedido.id}/platillos/${lineaId}`);
      setPedido(await get<PedidoDTO>(`/pedidos/${pedido.id}`));
    } catch (error) {
      setErrorDeAccion(comoError(error));
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Guarda la nota si cambió. Devuelve si quedó guardada, para que quien
   * envíe la comanda a cocina pueda esperarla antes de enviar.
   */
  async function guardarLaNota(): Promise<boolean> {
    if (!pedido || borradorDeNota === (pedido.observaciones ?? '')) {
      return true;
    }
    setErrorDeNota(undefined);
    try {
      setPedido(await patch<PedidoDTO>(`/pedidos/${pedido.id}`, { observaciones: borradorDeNota }));
      return true;
    } catch (error) {
      const fallo = comoError(error);
      if (fallo.campos.observaciones) {
        setErrorDeNota(fallo.campos.observaciones);
      } else {
        setErrorDeAccion(fallo);
        // Un conflicto aquí quiere decir que el pedido ya no está abierto.
        await cargar();
      }
      return false;
    }
  }

  /**
   * Manda la comanda a la cocina.
   *
   * Primero se guarda la nota que el mesero pueda tener a medio escribir: si
   * se enviara antes, la cocina recibiría la comanda sin ella y el pedido ya
   * no admitiría cambios. Si la nota no se puede guardar, no se envía nada.
   */
  async function enviar() {
    if (enviando || !pedido) {
      return;
    }
    setEnviando(true);
    setErrorDeAccion(null);
    try {
      if (!(await guardarLaNota())) {
        return;
      }
      setPedido(await patch<PedidoDTO>(`/pedidos/${pedido.id}/estado`, { estado: 'EN_COCINA' }));
    } catch (error) {
      const fallo = comoError(error);
      setErrorDeAccion(fallo);
      // Un conflicto quiere decir que el pedido ya no está donde la pantalla
      // creía: se vuelve a pedir para mostrar lo que de verdad pasó.
      if (fallo.status === 409) {
        await cargar();
      }
    } finally {
      setEnviando(false);
    }
  }

  if (errorDelPedido) {
    return (
      <div className="salon-toma">
        <div className="toma-cab">
          <Boton texto="← Salón" variante="texto" onClick={() => navegar('/salon')} />
        </div>
        <div className="toma-cuerpo">
          <Aviso tono="err" titulo={errorDelPedido.titulo} texto={errorDelPedido.texto} />
        </div>
      </div>
    );
  }

  if (!pedido) {
    return <div className="salon-toma" />;
  }

  const unidades = pedido.platillos.length;
  const abierto = pedido.estado === 'ABIERTO';

  return (
    <div className="salon-toma">
      <div className="toma-cab">
        <Boton texto="← Salón" variante="texto" onClick={() => navegar('/salon')} />
        <Titulo texto={`Mesa ${pedido.mesaNumero}`} par={mesa ? `${mesa.capacidad} personas` : undefined} />
      </div>

      <div className="toma-cuerpo">
        <div className="toma-carta">
          {errorDeAccion ? (
            <Aviso tono="err" titulo={errorDeAccion.titulo} texto={errorDeAccion.texto} />
          ) : null}

          {cartaCaida ? (
            <Aviso
              tono="err"
              titulo="La carta no está disponible en este momento"
              texto={
                unidades > 0
                  ? 'Los platillos que ya están en la comanda se conservan y se pueden enviar a cocina.'
                  : 'Intente de nuevo en un momento.'
              }
              accion={
                <Boton
                  texto="Reintentar"
                  variante="tinta"
                  disabled={reintentando}
                  onClick={() => void reintentarLaCarta()}
                />
              }
            />
          ) : (
            <Carta
              platillos={carta}
              enPedido={unidadesPorPlatillo(pedido.platillos)}
              puedeAgregar={abierto && !ocupado}
              onAgregar={agregar}
            />
          )}
        </div>

        <aside className="toma-comanda" aria-label="Comanda">
          <Comanda
            pedido={pedido}
            variante={abierto ? 'editable' : 'bloqueada'}
            bloqueado={ocupado}
            nota={borradorDeNota}
            errorNota={errorDeNota}
            onCambiarNota={setBorradorDeNota}
            onGuardarNota={() => void guardarLaNota()}
            onMas={(platilloId) => {
              const platillo = carta.find((candidato) => candidato.id === platilloId);
              if (platillo) {
                void agregar(platillo);
              }
            }}
            onMenos={(platilloId) => void quitar(platilloId)}
            pie={
              abierto ? (
                <Boton
                  texto="Enviar a cocina"
                  variante="calor"
                  ancho
                  disabled={unidades === 0 || enviando}
                  onClick={() => void enviar()}
                />
              ) : (
                <Boton
                  texto="Volver al salón"
                  variante="tinta"
                  ancho
                  onClick={() => navegar('/salon')}
                />
              )
            }
          />
        </aside>
      </div>
    </div>
  );
}
