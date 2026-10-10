import { Navigate, Route, Routes } from 'react-router';
import { RutaConRol } from './nucleo/RutaConRol';
import { SesionProveedor, useSesion } from './nucleo/sesion';

function Inicio() {
  const { usuario } = useSesion();
  if (usuario?.rol === 'MESERO') return <Navigate to="/salon" replace />;
  if (usuario?.rol === 'CAJERO') return <Navigate to="/caja" replace />;
  if (usuario?.rol === 'COCINERO') return <Navigate to="/cocina" replace />;
  return <Navigate to="/login" replace />;
}

function LoginShell() {
  return <div className="sh sh-login" data-densidad="tactil" data-superficie="arcilla" />;
}

function SalonShell() {
  return <div className="sh sh-salon" data-densidad="tactil" data-superficie="arcilla" />;
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
        <Route path="/login" element={<LoginShell />} />
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
