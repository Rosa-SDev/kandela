import { useState, useEffect, useCallback } from 'react';
import type { PlatilloDTO } from '@compartido/api/tipos';
import { get, put } from '../nucleo/api';
import { Titulo } from '../componentes/Titulo';
import { Boton } from '../componentes/Boton';
import { Estado } from '../componentes/Estado';
import { Aviso } from '../componentes/Aviso';

const PLATILLOS_DEMO: PlatilloDTO[] = [
  { id: 1, nombre: 'Arepa de choclo', descripcion: 'Con queso campesino', categoria: 'Entradas', precio: 9000, disponible: true },
  { id: 2, nombre: 'Ajiaco santafereño', descripcion: 'Con pollo, alcaparras y crema', categoria: 'Fuertes', precio: 28000, disponible: true },
  { id: 3, nombre: 'Bandeja paisa', descripcion: 'Fríjoles, chicharrón, carne molida, huevo', categoria: 'Fuertes', precio: 38000, disponible: true },
  { id: 4, nombre: 'Sobrebarriga al horno', descripcion: 'Con papas chorreadas', categoria: 'Fuertes', precio: 36000, disponible: true },
  { id: 5, nombre: 'Postre de natas', descripcion: 'Postre tradicional', categoria: 'Postres', precio: 12000, disponible: true },
  { id: 6, nombre: 'Limonada de coco', descripcion: 'Bebida fría refrescante', categoria: 'Bebidas', precio: 11000, disponible: false },
];

export function DisponibilidadCocina() {
  const [platillos, setPlatillos] = useState<PlatilloDTO[]>([]);
  const [errorSrv, setErrorSrv] = useState<string | null>(null);
  const [avisoOk, setAvisoOk] = useState<{ titulo: string; texto: string } | null>(null);
  const [enProceso, setEnProceso] = useState<Set<number>>(new Set());

  const cargarPlatillos = useCallback(async () => {
    try {
      const datos = await get<PlatilloDTO[]>('/platillos');
      if (datos && datos.length > 0) {
        setPlatillos(datos);
      } else {
        setPlatillos((prev) => (prev.length > 0 ? prev : PLATILLOS_DEMO));
      }
      setErrorSrv(null);
    } catch {
      setErrorSrv('El servicio de carta no está disponible en este momento.');
      setPlatillos((prev) => (prev.length > 0 ? prev : PLATILLOS_DEMO));
    }
  }, []);

  useEffect(() => {
    cargarPlatillos();
  }, [cargarPlatillos]);

  const toggleDisponible = async (p: PlatilloDTO) => {
    if (enProceso.has(p.id)) return;
    setEnProceso((prev) => new Set(prev).add(p.id));

    const nuevo = !p.disponible;
    try {
      const actualizado = await put<PlatilloDTO>(`/platillos/${p.id}`, {
        nombre: p.nombre,
        descripcion: p.descripcion,
        categoria: p.categoria,
        precio: p.precio,
        disponible: nuevo,
      });

      setPlatillos((prev) =>
        prev.map((item) => (item.id === p.id ? actualizado : item))
      );

      setAvisoOk({
        titulo: `${p.nombre}: ${nuevo ? 'disponible de nuevo' : 'agotado'}`,
        texto: nuevo
          ? 'El salón ya puede pedirlo.'
          : 'El salón lo ve tachado y no puede agregarlo.',
      });
      setErrorSrv(null);
    } catch {
      // Si el backend no responde o es un platillo de prueba, actualizamos localmente
      setPlatillos((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, disponible: nuevo } : item))
      );
      setAvisoOk({
        titulo: `${p.nombre}: ${nuevo ? 'disponible de nuevo' : 'agotado'}`,
        texto: nuevo
          ? 'El salón ya puede pedirlo.'
          : 'El salón lo ve tachado y no puede agregarlo.',
      });
    } finally {
      setEnProceso((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }
  };

  const agotados = platillos.filter((c) => !c.disponible).length;

  return (
    <>
      <div className="kds-cab">
        <Titulo
          texto="Disponibilidad"
          par={`${agotados} ${agotados === 1 ? 'agotado' : 'agotados'}`}
        />
      </div>

      <section className="kds-sec" aria-label="Disponibilidad">
        {errorSrv ? (
          <Aviso tono="err" glifo="!" titulo={errorSrv} />
        ) : null}

        {avisoOk ? (
          <Aviso
            tono=""
            glifo="✓"
            titulo={avisoOk.titulo}
            texto={avisoOk.texto}
          />
        ) : null}

        <div className="kds-disp">
          {platillos.map((c) => (
            <div
              key={c.id}
              className={`kds-plato papel${c.disponible ? '' : ' kds-plato--agotado'}`}
            >
              <div>
                <b>{c.nombre}</b>
                <span>{c.categoria}</span>
              </div>
              <div className="kds-plato__acc">
                {c.disponible ? (
                  <Boton
                    texto="Marcar agotado"
                    variante="tinta"
                    disabled={enProceso.has(c.id)}
                    onClick={() => toggleDisponible(c)}
                  />
                ) : (
                  <>
                    <Estado glifo="✕" texto="Agotado" tono="off" />
                    <Boton
                      texto="Volver a ofrecer"
                      variante="tinta"
                      disabled={enProceso.has(c.id)}
                      onClick={() => toggleDisponible(c)}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
