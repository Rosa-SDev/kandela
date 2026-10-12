import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import type { ErrorKandela } from '@compartido/api/errores';
import type { Rol, UsuarioDTO } from '@compartido/api/tipos';
import { Aviso } from './componentes/Aviso';
import { Boton } from './componentes/Boton';
import { Campo } from './componentes/Campo';
import { Titulo } from './componentes/Titulo';
import { esErrorKandela, post } from './nucleo/api';
import { useSesion } from './nucleo/sesion';

const RUTA_POR_ROL: Record<Exclude<Rol, 'ADMINISTRADOR'>, string> = {
  MESERO: '/salon',
  CAJERO: '/caja',
  COCINERO: '/cocina',
};

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ErrorDeServidor {
  titulo: string;
  texto: string;
}

const REVISE_LOS_DATOS = 'Revise los datos e intente de nuevo.';
const INTENTE_MAS_TARDE = 'Intente de nuevo en un momento.';

/**
 * Qué decir debajo del título del aviso.
 *
 * Si el error es de lo que se escribió, se le pide revisarlo; si el servidor
 * no respondió o falló por dentro, revisar los datos no arregla nada y solo
 * confunde, así que se le pide esperar.
 */
function segundoRenglon(error: ErrorKandela): string {
  if (error.texto) {
    return error.texto;
  }
  if (error.status === null || error.status >= 500) {
    return INTENTE_MAS_TARDE;
  }
  return REVISE_LOS_DATOS;
}

interface ErroresDeCampo {
  correo?: string;
  password?: string;
}

/**
 * Pantalla de acceso de Kandela POS y KDS.
 *
 * El rol se comprueba antes de guardar la sesión: a un administrador no se
 * le abre ninguna pantalla aquí, porque esta aplicación es la del salón, la
 * caja y la cocina.
 */
export function Login() {
  const { iniciar } = useSesion();
  const navegar = useNavigate();

  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<ErroresDeCampo>({});
  const [errorDeServidor, setErrorDeServidor] = useState<ErrorDeServidor | null>(null);
  const [enviando, setEnviando] = useState(false);

  function revisarCampos(): ErroresDeCampo {
    const encontrados: ErroresDeCampo = {};
    if (!correo.trim()) {
      encontrados.correo = 'El correo es obligatorio.';
    } else if (!CORREO_VALIDO.test(correo.trim())) {
      encontrados.correo = 'Correo no válido.';
    }
    if (!password) {
      encontrados.password = 'La contraseña es obligatoria.';
    }
    return encontrados;
  }

  async function entrar(evento: FormEvent) {
    evento.preventDefault();

    const encontrados = revisarCampos();
    setErrores(encontrados);
    setErrorDeServidor(null);
    if (Object.keys(encontrados).length > 0) {
      return;
    }

    setEnviando(true);
    try {
      const usuario = await post<UsuarioDTO>('/auth/login', { correo: correo.trim(), password });

      if (usuario.rol === 'ADMINISTRADOR') {
        setErrorDeServidor({
          titulo: 'Rol no autorizado.',
          texto: 'Esta aplicación es solo para el salón, la caja y la cocina. Use Kandela Admin.',
        });
        return;
      }

      iniciar(usuario);
      navegar(RUTA_POR_ROL[usuario.rol], { replace: true });
    } catch (error) {
      if (esErrorKandela(error)) {
        setErrores({ correo: error.campos.correo, password: error.campos.password });
        setErrorDeServidor({ titulo: error.titulo, texto: segundoRenglon(error) });
      } else {
        setErrorDeServidor({
          titulo: 'No se pudo completar la solicitud.',
          texto: INTENTE_MAS_TARDE,
        });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="sh sh-login" data-densidad="tactil" data-superficie="arcilla">
      <header className="f-nav">
        <span className="f-nav__logo">KANDELA</span>
      </header>

      <div className="login">
        <div className="login__col">
          <Titulo texto="Iniciar sesión" par="Raíz y Sazón" />

          {errorDeServidor ? (
            <Aviso tono="err" titulo={errorDeServidor.titulo} texto={errorDeServidor.texto} />
          ) : null}

          {/* noValidate: la validación la hace la pantalla, con los mensajes de Kandela
              en español y debajo de cada campo, no las burbujas del navegador. */}
          <form onSubmit={entrar} noValidate style={{ display: 'grid', gap: 'var(--s4)' }}>
            <Campo
              id="correo"
              label="Correo"
              tipo="email"
              valor={correo}
              onCambiar={setCorreo}
              req
              error={errores.correo}
              autoComplete="username"
            />
            <Campo
              id="password"
              label="Contraseña"
              tipo="password"
              valor={password}
              onCambiar={setPassword}
              req
              error={errores.password}
              autoComplete="current-password"
            />
            <Boton texto="Entrar" tipo="submit" variante="calor" ancho disabled={enviando} />
          </form>

          <p className="login__nota">
            Cada rol entra a su propia pantalla: administración, salón, caja o cocina.
          </p>
        </div>
      </div>
    </div>
  );
}
