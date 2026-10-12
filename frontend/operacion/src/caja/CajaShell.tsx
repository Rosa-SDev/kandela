import { useNavigate } from 'react-router';
import { BarraRol } from '../componentes/BarraRol';
import { useSesion } from '../nucleo/sesion';
import { Caja } from './Caja';

/**
 * La interfaz de la cajera: táctil y sobre arcilla, igual que el salón.
 */
export function CajaShell() {
  const { usuario, cerrar } = useSesion();
  const navegar = useNavigate();

  function salir() {
    cerrar();
    navegar('/login', { replace: true });
  }

  return (
    <div className="sh" data-densidad="tactil" data-superficie="arcilla">
      <BarraRol
        tabs={['Caja']}
        activa={0}
        quien={
          <>
            Cajera · <b>{usuario?.nombre}</b>
          </>
        }
        onSalir={salir}
      />
      <Caja />
    </div>
  );
}
