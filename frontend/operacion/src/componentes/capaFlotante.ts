import { useEffect, useRef, type RefObject } from 'react';

const SELECTOR_ENFOCABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Foco inicial al abrir, Tab atrapado dentro de la capa, Escape cierra y el foco vuelve a quien la abrió.
export function useCapaFlotante(
  contenedorRef: RefObject<HTMLElement | null>,
  onCerrar: () => void,
  obtenerFocoInicial?: () => HTMLElement | null,
) {
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;
  const obtenerFocoInicialRef = useRef(obtenerFocoInicial);
  obtenerFocoInicialRef.current = obtenerFocoInicial;

  useEffect(() => {
    const elementoPrevio = document.activeElement as HTMLElement | null;
    const contenedor = contenedorRef.current;
    const destino =
      obtenerFocoInicialRef.current?.() ?? contenedor?.querySelector<HTMLElement>(SELECTOR_ENFOCABLE) ?? null;
    destino?.focus();

    function alTeclear(evento: KeyboardEvent) {
      if (!contenedor || !contenedor.contains(document.activeElement)) return;
      if (evento.key === 'Escape') {
        evento.preventDefault();
        onCerrarRef.current();
        return;
      }
      if (evento.key !== 'Tab' || !contenedor) return;
      const enfocables = Array.from(contenedor.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLE));
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      elementoPrevio?.focus();
    };
    // Depende solo del contenedor: así no se reinicia el atrapado de foco en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contenedorRef]);
}
