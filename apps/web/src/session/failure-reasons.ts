/**
 * Los motivos de fallo vienen en código (`aborted:target-missing:foodTarget`).
 * El cuidador no lee códigos: los traducimos a una frase corta.
 *
 * Vive acá y no dentro de un panel porque los mismos códigos salen por dos
 * lados —los tropiezos conocidos de una habilidad y las observaciones de un
 * ensayo fallido— y tener la tabla en uno solo dejaba al otro mostrando
 * `criteria-failed:consumedKind:food` en pantalla.
 */
export function humanReason(raw: string): string {
  const [head, ...rest] = raw.split(':');
  const detail = rest.join(' · ');
  switch (head) {
    case 'aborted':
      return rest[0] === 'target-missing'
        ? `se cortó: no encontró ${rest.slice(1).join(' ') || 'el objetivo'}`
        : `se cortó: ${detail}`;
    case 'criteria-failed':
      return rest.length > 1
        ? `no cumplió: ${rest[0]} = ${rest.slice(1).join(':')}`
        : `no cumplió: ${detail}`;
    case 'objetivo-presente-no-alcanzado':
      return `tenía ${detail} a la vista y no llegó`;
    case 'no-damage-dealt':
      return `golpeó sin hacer daño (${detail})`;
    case 'path-blocked':
      return `el camino se le bloqueó ${detail} vez/veces`;
    case 'craft-missing':
      return `le faltaban ingredientes (${detail})`;
    case 'craft-failed':
      return `no pudo construir: ${detail}`;
    case 'timeout':
      return 'se le acabó el tiempo';
    case 'limit-exceeded':
      return `pasó el límite de pasos${detail ? `: ${detail}` : ''}`;
    default:
      return raw;
  }
}
