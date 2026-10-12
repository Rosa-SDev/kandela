import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Login } from './Login';
import { SesionProveedor } from './nucleo/sesion';

const MESERO = {
  id: 2,
  nombre: 'Carlos Rojas',
  correo: 'carlos.rojas@raizysazon.co',
  rol: 'MESERO',
  activo: true,
};

const ADMINISTRADORA = {
  id: 1,
  nombre: 'Laura Méndez',
  correo: 'laura.mendez@raizysazon.co',
  rol: 'ADMINISTRADOR',
  activo: true,
};

function respuesta(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status });
}

/** Pinta el login con el enrutador y la sesión, y una pantalla señuelo por rol. */
function pintarLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <SesionProveedor>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/salon" element={<p>Pantalla del salón</p>} />
          <Route path="/caja" element={<p>Pantalla de la caja</p>} />
        </Routes>
      </SesionProveedor>
    </MemoryRouter>,
  );
}

function escribirCredenciales(correo: string, password: string) {
  fireEvent.change(screen.getByLabelText(/Correo/), { target: { value: correo } });
  fireEvent.change(screen.getByLabelText(/Contraseña/), { target: { value: password } });
}

function entrar() {
  fireEvent.click(screen.getByText('Entrar'));
}

describe('Login', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('con los campos vacios muestra los dos mensajes y no llama al servidor', async () => {
    const fetchSimulado = vi.fn();
    vi.stubGlobal('fetch', fetchSimulado);
    pintarLogin();

    entrar();

    expect(await screen.findByText('! El correo es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('! La contraseña es obligatoria.')).toBeInTheDocument();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('con un correo mal escrito avisa del formato', async () => {
    const fetchSimulado = vi.fn();
    vi.stubGlobal('fetch', fetchSimulado);
    pintarLogin();

    escribirCredenciales('carlos.rojas', 'kandela123');
    entrar();

    expect(await screen.findByText('! Correo no válido.')).toBeInTheDocument();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('un mesero entra al salon y queda en sesion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(200, MESERO)));
    pintarLogin();

    escribirCredenciales('carlos.rojas@raizysazon.co', 'kandela123');
    entrar();

    expect(await screen.findByText('Pantalla del salón')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('kandela.sesion') ?? 'null')).toMatchObject({
      id: 2,
      rol: 'MESERO',
    });
  });

  it('un cajero entra a la caja', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(200, { ...MESERO, rol: 'CAJERO' })));
    pintarLogin();

    escribirCredenciales('diana.rios@raizysazon.co', 'kandela123');
    entrar();

    expect(await screen.findByText('Pantalla de la caja')).toBeInTheDocument();
  });

  it('una administradora no entra y no queda en sesion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(200, ADMINISTRADORA)));
    pintarLogin();

    escribirCredenciales('laura.mendez@raizysazon.co', 'kandela123');
    entrar();

    expect(await screen.findByText('Rol no autorizado.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Esta aplicación es solo para el salón, la caja y la cocina. Use Kandela Admin.',
      ),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem('kandela.sesion')).toBeNull();
    expect(screen.queryByText('Pantalla del salón')).not.toBeInTheDocument();
  });

  it('unas credenciales incorrectas muestran el aviso del servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(401, { error: 'No autorizado' })));
    pintarLogin();

    escribirCredenciales('carlos.rojas@raizysazon.co', 'equivocada');
    entrar();

    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
    expect(screen.getByText('Revise los datos e intente de nuevo.')).toBeInTheDocument();
  });

  it('sin conexion con el servidor lo dice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    pintarLogin();

    escribirCredenciales('carlos.rojas@raizysazon.co', 'kandela123');
    entrar();

    expect(await screen.findByText('No hay conexión con el servidor.')).toBeInTheDocument();
  });

  it('el boton se bloquea mientras se envia', async () => {
    let resolver: (r: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise<Response>((r) => {
          resolver = r;
        }),
      ),
    );
    pintarLogin();

    escribirCredenciales('carlos.rojas@raizysazon.co', 'kandela123');
    entrar();

    await waitFor(() => expect(screen.getByText('Entrar')).toBeDisabled());
    resolver(respuesta(200, MESERO));
    expect(await screen.findByText('Pantalla del salón')).toBeInTheDocument();
  });
});
