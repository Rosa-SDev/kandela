import { Route, Routes, useNavigate } from 'react-router';
import { BarraRol } from '../componentes/BarraRol';
import { useSesion } from '../nucleo/sesion';
import { Plano } from './Plano';

/**
 * La interfaz del mesero.
 *
 * Declara su contexto en la raíz —táctil y sobre arcilla— y de ahí para
 * abajo los componentes solo leen variables, sin saber que están en el salón.
 *
 * Por ahora solo existe la pestaña del plano; las de pedidos, reservas y
 * carta llegan con sus pantallas.
 */
export function SalonShell() {
  const { usuario, cerrar } = useSesion();
  const navegar = useNavigate();

  function salir() {
    cerrar();
    navegar('/login', { replace: true });
  }

  return (
    <div className="sh sh-salon" data-densidad="tactil" data-superficie="arcilla">
      <BarraRol
        tabs={['Salón']}
        activa={0}
        quien={
          <>
            Mesero · <b>{usuario?.nombre}</b>
          </>
        }
        onSalir={salir}
      />
      <div className="sh-cuerpo">
        <Routes>
          <Route index element={<Plano />} />
        </Routes>
      </div>
    </div>
  );
}
