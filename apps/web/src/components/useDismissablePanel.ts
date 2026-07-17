import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Cierra un <details> al hacer clic fuera o con Escape. Por defecto se queda
 * abierto hasta que lo cierras a mano, que está bien para un acordeón pero no
 * para un menú: se solapa con lo que hay debajo y estorba.
 */
export function useDismissablePanel(ref: RefObject<HTMLDetailsElement | null>): void {
  useEffect(() => {
    const closeOutside = (event: PointerEvent): void => {
      const element = ref.current;
      if (element?.open && event.target instanceof Node && !element.contains(event.target)) {
        element.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && ref.current?.open) {
        ref.current.open = false;
        // El foco vuelve al disparador: con Escape nadie espera perderlo.
        ref.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [ref]);
}
