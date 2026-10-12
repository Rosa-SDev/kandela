import { useEffect, useState } from 'react';
import type { PedidoDTO, UsuarioDTO } from '@compartido/api/tipos';
import { get, esErrorKandela } from '../nucleo/api';
import { Titulo } from '../componentes/Titulo';
import { Aviso } from '../componentes/Aviso';
import { Cuenta } from '../objetos/Cuenta';
import { Liquidacion } from '../objetos/Liquidacion';
import { liquidar, ordenarCola, porCobrar } from './liquidar';

/** Cada cuánto se vuelve a preguntar por los pedidos. */
const CADA_CUANTO_MS = 5000;

/**
 * La pantalla principal de la caja: la cola de cuentas por cobrar.
 *
 * La cola se refresca sola cada 5 segundos para que aparezcan los pedidos
 * nuevos y cambien de estado sin recargar.
 */
export function Caja() {
  const [pedidos, setPedidos] = useState<PedidoDTO[]>([]);
  const [meseros, setMeseros] = useState<Map<number, string>>(new Map());
  const [elegidoId, setElegidoId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<UsuarioDTO[]>('/usuarios')
      .then((usuarios) => setMeseros(new Map(usuarios.map((u) => [u.id, u.nombre]))))
      .catch(() => setMeseros(new Map()));
  }, []);

  useEffect(() => {
    let vigente = true;

    async function consultar() {
      try {
        const lista = await get<PedidoDTO[]>('/pedidos');
        if (vigente) {
          setPedidos(lista);
          setError(null);
        }
      } catch (e) {
        if (vigente) {
          setError(esErrorKandela(e) ? e.titulo : 'No se pudo leer la cola de cuentas.');
        }
      }
    }

    consultar();
    const intervalo = setInterval(consultar, CADA_CUANTO_MS);
    return () => {
      vigente = false;
      clearInterval(intervalo);
    };
  }, []);

  const cola = ordenarCola(porCobrar(pedidos));
  // Si la cajera no ha elegido ninguna, se muestra la primera de la cola.
  const elegido = pedidos.find((p) => p.id === elegidoId) ?? cola[0] ?? null;
  const meseroDe = (pedido: PedidoDTO) => meseros.get(pedido.meseroId) ?? 'Mesero';

  return (
    <div
      className="sh-cuerpo"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 460px)',
        gap: 'var(--s5)',
        padding: 'var(--s5)',
        alignItems: 'start',
        overflow: 'auto'
      }}
    >
      <section>
        <Titulo texto="Caja" par={`${cola.length} por cobrar`} />
        {error ? <Aviso tono="err" glifo="!" titulo={error} /> : null}
        <div style={{ borderTop: '2px solid var(--tinta)', marginTop: 'var(--s4)' }}>
          {cola.map((pedido) => (
            <Cuenta
              key={pedido.id}
              pedido={pedido}
              total={liquidar(pedido.total).total}
              mesero={meseroDe(pedido)}
              seleccionada={pedido.id === elegido?.id}
              onElegir={() => setElegidoId(pedido.id)}
            />
          ))}
        </div>
      </section>

      <aside style={{ height: 'calc(100vh - 8rem)', position: 'sticky', top: 0 }}>
        {elegido ? (
          <Liquidacion pedido={elegido} mesero={meseroDe(elegido)} />
        ) : (
          <Aviso glifo="✓" titulo="No hay cuentas por cobrar." texto="Las nuevas aparecen solas." />
        )}
      </aside>
    </div>
  );
}
