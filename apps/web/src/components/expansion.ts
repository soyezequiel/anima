import { useCallback, useState } from 'react';

/**
 * Qué está desplegado, fuera de los componentes (ADR 0069).
 *
 * El panel se redibuja con cada tick del mundo, y sus piezas se montan y
 * desmontan al ritmo de lo que la mascota hace: una lista de materia que queda
 * vacía un instante desmonta su fila, y con ella se iba el `useState` que
 * recordaba que el árbol estaba abierto. Medido: el árbol se cerraba solo a los
 * 1,6 segundos de abrirlo.
 *
 * La expansión es del CUIDADOR, no del componente: mientras él no la cierre,
 * sigue abierta aunque la fila que la contiene se rehaga entera.
 */
export interface Expansion {
  isOpen(id: string): boolean;
  toggle(id: string): void;
}

export function useExpansion(): Expansion {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = useCallback((id: string) => {
    setOpen((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  return { isOpen: (id) => open.has(id), toggle };
}
