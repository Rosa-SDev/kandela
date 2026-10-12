import { Route, Routes, useLocation, useNavigate } from 'react-router';
import { BarraInferior } from '../componentes/BarraInferior';
import { BarraRol } from '../componentes/BarraRol';
import { useSesion } from '../nucleo/sesion';
import { CartaLectura } from './CartaLectura';
import { MisPedidos } from './MisPedidos';
import { Plano } from './Plano';
import { TomaPedido } from './TomaPedido';

/**
 * Las secciones del salón, en el orden en que el mesero las necesita.
 *
 * En móvil la barra de arriba se queda sin pestañas y manda la de abajo, que
 * tiene menos sitio: de ahí que «Mis pedidos» se acorte a «Pedidos».
 */
const SECCIONES = [
  { ruta: '/salon', escritorio: 'Salón', movil: 'Salón' },
  { ruta: '/salon/pedidos', escritorio: 'Mis pedidos', movil: 'Pedidos' },
  { ruta: '/salon/carta', escritorio: 'Carta', movil: 'Carta' },
] as const;

/**
 * La interfaz del mesero.
 *
 * Declara su contexto en la raíz —táctil y sobre arcilla— y de ahí para
 * abajo los componentes solo leen variables, sin saber que están en el salón.
 */
export function SalonShell() {
  const { usuario, cerrar } = useSesion();
  const navegar = useNavigate();
  const { pathname } = useLocation();

  // La toma de pedido se abre desde el plano y no es una sección aparte: la
  // pestaña del salón sigue marcada mientras el mesero toma la comanda.
  const activa = Math.max(
    0,
    SECCIONES.findIndex((seccion) => seccion.ruta === pathname),
  );

  function salir() {
    cerrar();
    navegar('/login', { replace: true });
  }

  function irA(indice: number) {
    navegar(SECCIONES[indice].ruta);
  }

  return (
    <div className="sh sh-salon" data-densidad="tactil" data-superficie="arcilla">
      <BarraRol
        tabs={SECCIONES.map((seccion) => seccion.escritorio)}
        activa={activa}
        quien={
          <>
            Mesero · <b>{usuario?.nombre}</b>
          </>
        }
        onCambiarTab={irA}
        onSalir={salir}
      />
      <div className="sh-cuerpo">
        <Routes>
          <Route index element={<Plano />} />
          <Route path="pedidos" element={<MisPedidos />} />
          <Route path="carta" element={<CartaLectura />} />
          <Route path="pedido/:id" element={<TomaPedido />} />
        </Routes>
      </div>
      <BarraInferior
        tabs={SECCIONES.map((seccion) => seccion.movil)}
        activa={activa}
        onCambiar={irA}
      />
    </div>
  );
}
