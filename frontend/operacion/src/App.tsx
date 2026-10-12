import { Navigate, Route, Routes } from 'react-router';
import { Login } from './Login';
import { RutaConRol } from './nucleo/RutaConRol';
import { SalonShell } from './salon/SalonShell';
import { SesionProveedor, useSesion } from './nucleo/sesion';

function Inicio() {
  const { usuario } = useSesion();
  if (usuario?.rol === 'MESERO') return <Navigate to="/salon" replace />;
  if (usuario?.rol === 'CAJERO') return <Navigate to="/caja" replace />;
  if (usuario?.rol === 'COCINERO') return <Navigate to="/cocina" replace />;
  return <Navigate to="/login" replace />;
}

function CajaShell() {
  return <div className="sh" data-densidad="tactil" data-superficie="arcilla" />;
}

function CocinaShell() {
  return <div className="sh" data-densidad="pared" data-superficie="tablero" />;
}

function App() {
  return (
    <SesionProveedor>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/login" element={<Login />} />
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
