import { Navigate, Route, Routes } from 'react-router';
import { Login } from './Login';
import { RutaConRol } from './nucleo/RutaConRol';
import { SalonShell } from './salon/SalonShell';
import { SesionProveedor, useSesion } from './nucleo/sesion';

import { CocinaShell } from './cocina/CocinaShell';
import { CajaShell } from './caja/CajaShell';
import { ResenaCliente } from './resena/ResenaCliente';

function Inicio() {
  const { usuario } = useSesion();
  if (usuario?.rol === 'MESERO') return <Navigate to="/salon" replace />;
  if (usuario?.rol === 'CAJERO') return <Navigate to="/caja" replace />;
  if (usuario?.rol === 'COCINERO') return <Navigate to="/cocina" replace />;
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <SesionProveedor>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/login" element={<Login />} />
        {/* Pública, sin sesión: la abre el cliente desde el QR de su mesa o de su factura. */}
        <Route path="/resena" element={<ResenaCliente />} />
        <Route
          path="/salon/*"
          element={
            <RutaConRol rol="MESERO">
              <SalonShell />
            </RutaConRol>
          }
        />
        <Route
          path="/caja/*"
          element={
            <RutaConRol rol="CAJERO">
              <CajaShell />
            </RutaConRol>
          }
        />
        <Route
          path="/cocina/*"
          element={
            <RutaConRol rol="COCINERO">
              <CocinaShell />
            </RutaConRol>
          }
        />
      </Routes>
    </SesionProveedor>
  );
}

export default App;
