import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import type { Rol } from '@compartido/api/tipos';
import { useSesion } from './sesion';

const RUTA_POR_ROL: Record<'MESERO' | 'CAJERO' | 'COCINERO', string> = {
  MESERO: '/salon',
  CAJERO: '/caja',
  COCINERO: '/cocina',
};

export function RutaConRol({ rol, children }: { rol: Rol; children: ReactNode }) {
  const { usuario, cerrar } = useSesion();
  const administrador = usuario !== null && usuario.rol === 'ADMINISTRADOR';

  useEffect(() => {
    if (administrador) {
      cerrar();
    }
  }, [administrador, cerrar]);

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (usuario.rol === 'ADMINISTRADOR') {
    return <Navigate to="/login" replace />;
  }

  if (usuario.rol !== rol) {
    return <Navigate to={RUTA_POR_ROL[usuario.rol]} replace />;
  }

  return <>{children}</>;
}
