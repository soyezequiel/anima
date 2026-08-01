/**
 * `@anima/llm` — la casa del proveedor, Hito 8.
 *
 * Arranca con el PRESUPUESTO y no con el cliente, y es a propósito: la decisión
 * D1 —cuotas separadas para la fragua y para el chat— era lo que bloqueaba el
 * hito, y es lo único que se puede probar entero sin red.
 *
 * El cliente que ya existe vive en `lang/demo/proveedor.ts`, fuera de `src/`
 * porque la regla 2 prohíbe `await` ahí. Migra acá en su tramo. Lo que NO migra
 * es la frontera: el patrón del Hito 6 —el paquete DESCRIBE la consulta y el
 * llamador, que sí puede esperar, la manda— se mantiene.
 *
 * El criterio entero está en `ii/docs/hito-8-la-fragua.md`.
 */

export * from './presupuesto.js'
