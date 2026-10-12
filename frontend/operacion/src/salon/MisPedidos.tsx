import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { PedidoDTO } from '@compartido/api/tipos';
import type { ErrorKandela } from '@compartido/api/errores';
import { Aviso } from '../componentes/Aviso';
import { Boton } from '../componentes/Boton';
import { Titulo } from '../componentes/Titulo';
import { Comanda } from '../objetos/Comanda';
import { comoErrorKandela, get } from '../nucleo/api';
import { useSesion } from '../nucleo/sesion';
import { esPedidoActivo } from './estadoDeMesa';

/**
 * Los pedidos que el mesero en sesión tiene entre manos ahora mismo.
 *
 * El listado del backend no se puede filtrar por mesero, así que la pantalla
 * se queda con los suyos. Un pedido cobrado o cancelado deja de ser asunto del
 * mesero y desaparece de aquí, aunque siga existiendo en administración.
 */
export function MisPedidos() {
  const [pedidos, setPedidos] = useState<PedidoDTO[]>([]);
  const [error, setError] = useState<ErrorKandela | null>(null);
  const [cargando, setCargando] = useState(true);
  const { usuario } = useSesion();
  const navegar = useNavigate();

  // Nada de setState antes del await: dentro de un efecto eso encadena renders.
  const cargar = useCallback(async () => {
    try {
      const todos = await get<PedidoDTO[]>('/pedidos');
      setPedidos(todos);
      setError(null);
    } catch (fallo) {
      setError(comoErrorKandela(fallo));
      setPedidos([]);
    }
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

  const mios = pedidos.filter((pedido) => pedido.meseroId === usuario?.id && esPedidoActivo(pedido));

  return (
    <section className="salon-sec" aria-label="Mis pedidos">
      <Titulo
        texto="Mis pedidos"
        par={cargando || error ? undefined : `${mios.length} ${mios.length === 1 ? 'activo' : 'activos'}`}
      />

      {error ? (
        <Aviso
          tono="err"
          titulo={error.titulo}
          texto={error.texto}
          accion={<Boton texto="Reintentar" variante="tinta" onClick={reintentar} />}
        />
      ) : null}

      {!cargando && !error && mios.length === 0 ? (
        <p className="salon-vacio">
          Sin pedidos <span>(por ahora)</span>
        </p>
      ) : null}

      {mios.length > 0 ? (
        <div className="salon-comandas">
          {mios.map((pedido) => (
            <Comanda
              key={pedido.id}
              pedido={pedido}
              variante="lectura"
              pie={
                pedido.estado === 'ABIERTO' ? (
                  <Boton
                    texto="Seguir tomando"
                    variante="tinta"
                    ancho
                    onClick={() => navegar(`/salon/pedido/${pedido.id}`)}
                  />
                ) : undefined
              }
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
