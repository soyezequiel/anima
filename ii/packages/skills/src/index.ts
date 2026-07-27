/**
 * `@anima/skills` — el sandbox del Hito 4.
 *
 * Lo que el paquete le ofrece al mundo, en cuatro piezas:
 *
 *   ctx / tipos     LA SUPERFICIE. Es lo que ve el código que escribe el modelo,
 *                   y `skill-api.d.ts` —el prompt— se EMITE de acá con
 *                   `tsc --declaration`. No se escribe a mano nunca más.
 *   combustible     el transformer que inyecta el presupuesto y `mount()`, que
 *                   evalúa en un alcance cerrado.
 *   aislamiento     las sombras de los globals y el escáner de determinismo.
 *   ejecutor        `SkillRun`: la máquina de estados que el mundo avanza, la
 *                   memoria que sobrevive a un guardado, y el hash de la traza.
 *
 * `src/innatas/` NO se re-exporta desde acá y es a propósito: las quince son un
 * CORPUS DE MEDICIÓN escrito a mano en el mismo TypeScript que va a escribir el
 * modelo, no una biblioteca del runtime. Quien las quiera, las pide por
 * `@anima/skills/innatas`… el día que las necesite alguien. Mezclarlas acá haría
 * que importar el ejecutor arrastre quince habilidades, y que la frontera entre
 * «la caja» y «lo que corre adentro de la caja» deje de verse en los imports.
 *
 * Regla 1 de `ii/`: nada de acá importa de `packages/` ni de `apps/`. Los tres
 * paquetes de los que sale la superficie —`@anima/physics`, `@anima/world`,
 * `@anima/oracle`— son todos de `ii/packages/`.
 */

// La superficie. `./ctx.js` ya hace `export * from './tipos.js'`.
export * from './ctx.js'

export {
  FRACCION_COMPUTO,
  FRACCION_INSTRUMENTAR,
  FUEL_LEFT,
  FUEL_OUT,
  FUEL_POR_PASO,
  FUEL_PREFIX,
  FUEL_SUSPEND,
  HZ_DE_REFERENCIA,
  OutOfFuel,
  SUSPENSION,
  countInjectionPoints,
  fuelTransformer,
  instrument,
  isSuspension,
  mount,
  tickMs,
  unirCeldas,
  type ApiTS,
  type FuelCell,
  type Instrumented,
  type MountOptions,
  type MountedSkill,
  type SuspensionSignal,
} from './combustible.js'

export {
  FORBIDDEN_GLOBALS,
  ForbiddenError,
  safeMath,
  scanDeterminism,
  shadowScope,
  type Finding,
} from './aislamiento.js'

export {
  SkillRun,
  createSkillState,
  hashTrace,
  installSkillState,
  type RunOptions,
  type SavedSkillState,
  type SkillState,
  type SkillStatus,
  type Step,
  type TraceEntry,
  type WorldCtx,
} from './ejecutor.js'
