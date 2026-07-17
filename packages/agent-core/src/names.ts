/** Nombres reservados: los objetivos del cuerpo y las habilidades que los
 * sirven. Reservarlos impide que un contrato enseñado los secuestre (ADR 0016). */
export const GOAL_RESTORE_ENERGY = 'recuperar energía';
export const GOAL_RESTORE_WARMTH = 'recuperar calor';
/** El dolor como motivo: cuando el reflejo de un paso no alcanza. */
export const GOAL_BE_SAFE = 'ponerse a salvo';
export const SKILL_REACH_BLOCKED_FOOD = 'alcanzar-alimento-bloqueado';
/**
 * Como SKILL_REACH_BLOCKED_FOOD: nombre reservado para la necesidad del
 * cuerpo, para que un contrato enseñado no pueda secuestrar la habilidad de
 * no morirse de frío (ADR 0016).
 */
export const SKILL_GET_WARM = 'conseguir-calor';

/**
 * Nombre utilizable como identificador estable: kebab-case sin acentos, corto.
 * Lo comparten las habilidades ("baile-basico") y las interacciones
 * ("juntar-agua"): todo lo que un modelo bautiza pasa por aquí antes de ser
 * una clave que el resto del sistema busca.
 */
export function normalizeSkillName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
