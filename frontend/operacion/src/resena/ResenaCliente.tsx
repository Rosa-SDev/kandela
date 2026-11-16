import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import type { CrearResena, ResenaDTO } from '@compartido/api/tipos';
import { Aviso } from '../componentes/Aviso';
import { Boton } from '../componentes/Boton';
import { Campo } from '../componentes/Campo';
import { Titulo } from '../componentes/Titulo';
import { esErrorKandela, post } from '../nucleo/api';

/** El mismo límite que acepta el agente que clasifica las reseñas. */
const MAXIMO_DE_CARACTERES = 2000;

/** Un id de la dirección del QR, solo si es un entero positivo; si no, se ignora. */
function idDeLaDireccion(valor: string | null): number | undefined {
  if (!valor || !/^\d+$/.test(valor)) return undefined;
  const id = Number(valor);
  return id > 0 ? id : undefined;
}

/**
 * Formulario público con el que un cliente deja su comentario, sin iniciar
 * sesión. Se abre desde un QR: el de la mesa trae `?mesa=<id>` y el de la
 * factura `?pedido=<id>`.
 *
 * Kandela le pasa el comentario al agente SentiTriage-ES, que decide si es una
 * queja, si se almacena o si debe leerlo una persona. Esa decisión es para la
 * administración: al cliente solo se le agradece.
 */
export function ResenaCliente() {
  const [parametros] = useSearchParams();
  const mesaId = idDeLaDireccion(parametros.get('mesa'));
  const pedidoId = idDeLaDireccion(parametros.get('pedido'));

  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [errorDeServidor, setErrorDeServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);

  function revisar(): string | undefined {
    if (!texto.trim()) return 'Escribe tu comentario.';
    if (texto.trim().length > MAXIMO_DE_CARACTERES) {
      return `Puede tener hasta ${MAXIMO_DE_CARACTERES.toLocaleString('es-CO')} caracteres.`;
    }
    return undefined;
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const encontrado = revisar();
    setError(encontrado);
    setErrorDeServidor(null);
    if (encontrado) return;

    const cuerpo: CrearResena = { texto: texto.trim(), mesaId, pedidoId };
    setEnviando(true);
    try {
      await post<ResenaDTO>('/resenas', cuerpo);
      setEnviada(true);
      setTexto('');
    } catch (e) {
      if (esErrorKandela(e) && e.campos.texto) {
        setError(e.campos.texto);
      }
      setErrorDeServidor(
        esErrorKandela(e) && e.status !== null && e.status < 500
          ? e.titulo
          : 'No se pudo enviar tu comentario. Intenta de nuevo en un momento.',
      );
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
        <div className="login__col resena">
          {enviada ? (
            <>
              <Titulo texto="¡Gracias!" par="Raíz y Sazón" />
              <p className="resena__texto">
                Tu comentario ya llegó al equipo. Lo leemos para mejorar cada día.
              </p>
              <Boton texto="Escribir otro comentario" variante="tinta" ancho onClick={() => setEnviada(false)} />
            </>
          ) : (
            <>
              <Titulo texto="¿Cómo te fue hoy?" par="Raíz y Sazón" />
              <p className="resena__texto">
                Cuéntanos qué te gustó y qué podemos mejorar: la comida, el servicio, el tiempo de espera.
              </p>

              {errorDeServidor ? <Aviso tono="err" titulo={errorDeServidor} /> : null}

              <form onSubmit={enviar} noValidate style={{ display: 'grid', gap: 'var(--s4)' }}>
                <Campo
                  id="comentario"
                  label="Tu comentario"
                  tipo="textarea"
                  valor={texto}
                  onCambiar={setTexto}
                  req
                  error={error}
                  ayuda="No te pedimos tu nombre ni tus datos."
                />
                <Boton texto="Enviar comentario" tipo="submit" variante="calor" ancho disabled={enviando} />
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
