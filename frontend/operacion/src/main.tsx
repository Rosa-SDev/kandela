import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

// Las tres hojas compartidas, en orden: primero las variables y las superficies,
// después los componentes que las usan y al final los objetos del restaurante.
// Cambiar el orden rompe las cascadas. Esta aplicación no define estilos propios:
// todo lo visual vive en estas hojas, que son las mismas de la otra aplicación.
import '@compartido/estilos/fundamentos.css';
import '@compartido/estilos/componentes.css';
import '@compartido/estilos/objetos.css';
// La capa 4 va al final: solo coloca en la pantalla las piezas de las capas anteriores.
import './estilos/operacion.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
