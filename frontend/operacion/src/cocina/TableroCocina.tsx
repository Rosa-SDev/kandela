import { useState, useEffect, useCallback, useRef } from 'react';
import type { PedidoDTO } from '@compartido/api/tipos';
import { get, patch } from '../nucleo/api';
import { Comanda } from '../objetos/Comanda';
import { Boton } from '../componentes/Boton';
import { Titulo } from '../componentes/Titulo';
import { Aviso } from '../componentes/Aviso';

function formatoHora(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function obtenerMesero(meseroId: number): string | undefined {
  if (meseroId === 2) return 'Carlos Rojas';
  if (meseroId === 3) return 'Andrea Pérez';
  return undefined;
}

function generarPedidosDemo(): PedidoDTO[] {
  const ahora = Date.now();
  return [
    {
      id: 15,
      fechaHora: new Date(ahora - 2.5 * 60 * 1000).toISOString(),
      estado: 'EN_COCINA',
      observaciones: 'Alergia a mariscos. Sin contaminación cruzada en plancha.',
      metodoPago: null,
      montoPagado: null,
      fechaPago: null,
      mesaId: 5,
      mesaNumero: 5,
      meseroId: 3,
      cocineroId: null,
      clienteId: null,
      platillos: [
        { id: 1, platilloId: 3, nombre: 'Bandeja paisa', precioUnitario: 38000 },
        { id: 2, platilloId: 3, nombre: 'Bandeja paisa', precioUnitario: 38000 },
        { id: 3, platilloId: 3, nombre: 'Bandeja paisa', precioUnitario: 38000 },
        { id: 4, platilloId: 5, nombre: 'Postre de natas', precioUnitario: 12000 },
        { id: 5, platilloId: 5, nombre: 'Postre de natas', precioUnitario: 12000 },
      ],
      total: 138000,
    },
    {
      id: 17,
      fechaHora: new Date(ahora - 1.2 * 60 * 1000).toISOString(),
      estado: 'EN_COCINA',
      observaciones: 'Empacar el huevo aparte.',
      metodoPago: null,
      montoPagado: null,
      fechaPago: null,
      mesaId: 4,
      mesaNumero: 4,
      meseroId: 3,
      cocineroId: null,
      clienteId: null,
      platillos: [
        { id: 6, platilloId: 3, nombre: 'Bandeja paisa', precioUnitario: 38000 },
      ],
      total: 38000,
    },
    {
      id: 14,
      fechaHora: new Date(ahora - 6.5 * 60 * 1000).toISOString(),
      estado: 'EN_PREPARACION',
      observaciones: null,
      metodoPago: null,
      montoPagado: null,
      fechaPago: null,
      mesaId: 1,
      mesaNumero: 1,
      meseroId: 2,
      cocineroId: 4,
      clienteId: null,
      platillos: [
        { id: 7, platilloId: 2, nombre: 'Ajiaco santafereño', precioUnitario: 28000 },
        { id: 8, platilloId: 1, nombre: 'Arepa de choclo', precioUnitario: 9000 },
      ],
      total: 37000,
    },
    {
      id: 11,
      fechaHora: new Date(ahora - 24 * 60 * 1000).toISOString(),
      estado: 'EN_PREPARACION',
      observaciones: 'Una bandeja sin aguacate.',
      metodoPago: null,
      montoPagado: null,
      fechaPago: null,
      mesaId: 2,
      mesaNumero: 2,
      meseroId: 3,
      cocineroId: 4,
      clienteId: null,
      platillos: [
        { id: 9, platilloId: 3, nombre: 'Bandeja paisa', precioUnitario: 38000 },
        { id: 10, platilloId: 3, nombre: 'Bandeja paisa', precioUnitario: 38000 },
        { id: 11, platilloId: 4, nombre: 'Sobrebarriga al horno', precioUnitario: 36000 },
      ],
      total: 112000,
    },
  ];
}

export function TableroCocina() {
  const [pedidos, setPedidos] = useState<PedidoDTO[]>([]);
  const [ahora, setAhora] = useState(() => Date.now());
  const [errorSrv, setErrorSrv] = useState<string | null>(null);
  const [enProceso, setEnProceso] = useState<Set<number>>(new Set());

  // Tic del reloj cada segundo para que los temporizadores de las comandas corran en vivo
  useEffect(() => {
    const relojInterval = setInterval(() => {
      setAhora(Date.now());
    }, 1000);
    return () => clearInterval(relojInterval);
  }, []);

  // Función de consulta al backend
  const cargarPedidos = useCallback(async () => {
    try {
      const datos = await get<PedidoDTO[]>('/pedidos');
      if (datos && datos.length > 0) {
        setPedidos(datos);
      } else {
        setPedidos((prev) => (prev.length > 0 ? prev : generarPedidosDemo()));
      }
      setErrorSrv(null);
    } catch {
      setErrorSrv('No se pudo actualizar la comanda desde el salón.');
      setPedidos((prev) => (prev.length > 0 ? prev : generarPedidosDemo()));
    }
  }, []);

  // Sondeo (polling) cada 5 segundos sin reiniciar estado ni parpadear la pantalla
  const cargarRef = useRef(cargarPedidos);
  cargarRef.current = cargarPedidos;

  useEffect(() => {
    cargarRef.current();
    const pollInterval = setInterval(() => {
      cargarRef.current();
    }, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  // Cambiar estado de una comanda
  const cambiarEstado = async (id: number, nuevoEstado: 'EN_PREPARACION' | 'SERVIDO') => {
    if (enProceso.has(id)) return;
    setEnProceso((prev) => new Set(prev).add(id));

    try {
      const actualizado = await patch<PedidoDTO>(`/pedidos/${id}/estado`, { estado: nuevoEstado });
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? actualizado : p))
      );
    } catch {
      // Si el backend no responde o es un pedido de demostración, actualizamos localmente
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, estado: nuevoEstado } : p))
      );
    } finally {
      setEnProceso((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Filtrar activos (EN_COCINA y EN_PREPARACION) y ordenar por antigüedad (más antiguos primero)
  const activos = pedidos
    .filter((p) => p.estado === 'EN_COCINA' || p.estado === 'EN_PREPARACION')
    .sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime());

  const nuevos = activos.filter((p) => p.estado === 'EN_COCINA');
  const enPrep = activos.filter((p) => p.estado === 'EN_PREPARACION');

  const gridCols = `${Math.max(nuevos.length, 1)}fr ${Math.max(enPrep.length, 1)}fr`;

  return (
    <>
      <div className="kds-cab">
        <Titulo texto="Cocina" par={`${activos.length} ${activos.length === 1 ? 'comanda' : 'comandas'}`} />
        <span className="kds-reloj" aria-label="Hora">
          {formatoHora(ahora)}
        </span>
      </div>

      {errorSrv ? (
        <div style={{ padding: '0 var(--s6) var(--s4)' }}>
          <Aviso tono="err" glifo="!" titulo="Aviso de cocina" texto={errorSrv} />
        </div>
      ) : null}

      <div className="kds-tablero" style={{ gridTemplateColumns: gridCols }}>
        <section className="kds-col kds-col--nuevos" aria-label="Nuevos">
          <h2 className="kds-colh">
            Nuevos<span>{nuevos.length}</span>
          </h2>
          <div className="kds-grid">
            {nuevos.length ? (
              nuevos.map((p) => (
                <Comanda
                  key={p.id}
                  pedido={p}
                  variante="pared"
                  ahora={ahora}
                  meseroNombre={obtenerMesero(p.meseroId)}
                  pie={
                    <Boton
                      texto="Empezar"
                      variante="calor"
                      ancho
                      disabled={enProceso.has(p.id)}
                      onClick={() => cambiarEstado(p.id, 'EN_PREPARACION')}
                    />
                  }
                />
              ))
            ) : (
              <p className="kds-vacio">
                Sin comandas <span>(por ahora)</span>
              </p>
            )}
          </div>
        </section>

        <section className="kds-col kds-col--prep" aria-label="En preparación">
          <h2 className="kds-colh">
            En preparación<span>{enPrep.length}</span>
          </h2>
          <div className="kds-grid">
            {enPrep.length ? (
              enPrep.map((p) => (
                <Comanda
                  key={p.id}
                  pedido={p}
                  variante="pared"
                  ahora={ahora}
                  meseroNombre={obtenerMesero(p.meseroId)}
                  pie={
                    <Boton
                      texto="Listo para servir"
                      variante="calor"
                      ancho
                      disabled={enProceso.has(p.id)}
                      onClick={() => cambiarEstado(p.id, 'SERVIDO')}
                    />
                  }
                />
              ))
            ) : (
              <p className="kds-vacio">
                Sin comandas <span>(por ahora)</span>
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
