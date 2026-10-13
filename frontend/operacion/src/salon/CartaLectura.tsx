import { useCallback, useEffect, useState } from 'react';
import type { PlatilloDTO } from '@compartido/api/tipos';
import { Aviso } from '../componentes/Aviso';
import { Boton } from '../componentes/Boton';
import { Titulo } from '../componentes/Titulo';
import { Carta } from '../objetos/Carta';
import { get } from '../nucleo/api';

/**
 * La carta para consultarla, sin tocarla.
 *
 * Es la misma carta de la toma de pedido pero sin «+»: aquí el mesero viene a
 * leer precios y a ver qué hay agotado, no a agregar nada. Para agregar hace
 * falta un pedido abierto, y esta pantalla no sabe de ninguno.
 */
export function CartaLectura() {
  const [platillos, setPlatillos] = useState<PlatilloDTO[]>([]);
  const [caida, setCaida] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Nada de setState antes del await: dentro de un efecto eso encadena renders.
  const cargar = useCallback(async () => {
    try {
      setPlatillos(await get<PlatilloDTO[]>('/platillos'));
      setCaida(false);
    } catch {
      setPlatillos([]);
      setCaida(true);
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

  const disponibles = platillos.filter((platillo) => platillo.disponible).length;

  return (
    <section className="salon-sec" aria-label="Carta">
      <Titulo texto="Carta" par={cargando || caida ? undefined : `${disponibles} disponibles`} />

      {caida ? (
        <Aviso
          tono="err"
          titulo="La carta no está disponible en este momento"
          texto="Intente de nuevo en un momento."
          accion={<Boton texto="Reintentar" variante="tinta" onClick={() => void cargar()} />}
        />
      ) : (
        <Carta platillos={platillos} puedeAgregar={false} soloLectura />
      )}
    </section>
  );
}
