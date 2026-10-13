import { createContext, useContext, useState, type ReactNode } from 'react';
import type { UsuarioDTO } from '@compartido/api/tipos';

const CLAVE = 'kandela.sesion';

interface SesionContextoValor {
  usuario: UsuarioDTO | null;
  iniciar: (usuario: UsuarioDTO) => void;
  cerrar: () => void;
}

const SesionContexto = createContext<SesionContextoValor | null>(null);

function leerSesionGuardada(): UsuarioDTO | null {
  const guardado = sessionStorage.getItem(CLAVE);
  if (!guardado) return null;
  try {
    return JSON.parse(guardado) as UsuarioDTO;
  } catch {
    return null;
  }
}

export function SesionProveedor({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioDTO | null>(leerSesionGuardada);

  function iniciar(nuevo: UsuarioDTO) {
    sessionStorage.setItem(CLAVE, JSON.stringify(nuevo));
    setUsuario(nuevo);
  }

  function cerrar() {
    sessionStorage.removeItem(CLAVE);
    setUsuario(null);
  }

  return (
    <SesionContexto.Provider value={{ usuario, iniciar, cerrar }}>{children}</SesionContexto.Provider>
  );
}

export function useSesion(): SesionContextoValor {
  const contexto = useContext(SesionContexto);
  if (!contexto) {
    throw new Error('useSesion debe usarse dentro de SesionProveedor');
  }
  return contexto;
}
