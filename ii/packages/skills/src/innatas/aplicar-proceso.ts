// INNATA 7/15 · «aplicar-proceso» — la genérica: pedir un proceso hasta que salga.

import type { Ctx, Intent, Outcome, RolesOf, SeedProcessId, StepResult } from '../ctx.js'
import { done, fail, SEED_PROCESS_IDS } from '../ctx.js'
import type { Contrato } from './contrato.js'

export const CONTRATO_APLICAR_PROCESO: Contrato = {
  nombre: 'aplicar-proceso',
  establece: [{ sujeto: 'lo-que-devuelve', q: 'existe', op: '>=', v: 1 }],
  precondiciones: [{ sujeto: 'el-objetivo', q: 'existe', op: '>=', v: 1 }],
  cuesta: { segundos: 2, commitment: 'costly' },
  huecos: [
    'EL REPERTORIO SON CUATRO, y `ProcessId` de la física es `string` ABIERTO mientras `SeedProcessId` es la unión cerrada de los que se pueden aplicar. O sea que el día que el oráculo dé de alta un proceso nuevo, la habilidad no lo va a poder invocar: `apply` toma `SeedProcessId` y no `ProcessId`. Es correcto —sin roles tipados no hay juez— y es un techo declarado: lo que el oráculo invente no lo puede usar nadie hasta que alguien escriba su `RolesOf`',
    'CORTAR, AFILAR, CAVAR, MACHACAR, TEJER, PERFORAR Y MOLER NO EXISTEN. `sharpness` está en el catálogo con ley y NINGÚN proceso aplicable la sube: `friccion` mueve temperatura, `union` junta, `deshilachar` parte al hilo, `extraccion` saca de un stock. Sin afilar no hay lanza, y pescar con lanza es una de las conductas que el documento pone como ejemplo de lo que la criatura debería poder inventar',
    'no hay `establishes` ni `where` legibles por proceso: `SEED_ROLE_NAMES` da los nombres de rol y nada más. Se puede saber QUÉ roles pide y no QUÉ les pide, ni PARA QUÉ sirve',
  ],
}

/**
 * CONTRATO
 *   establece   lo que establezca el proceso — y eso NO se puede escribir acá,
 *               porque la superficie no publica el `establishes` del catálogo
 *   precondiciones  las del proceso, verificables sólo con `can()`
 *   cuesta      lo que cueste el proceso; `costly` como cota superior de los
 *               cuatro (`deshilachar` y `extraccion` lo son; los otros dos no)
 *
 * POR QUÉ ES INNATA: es la única de las quince que es un ESQUEMA. `unir`,
 * `deshilachar` y `frotar` son sus tres instancias con nombre; ésta existe para
 * el cuarto proceso (`extraccion`, que es pescar) y para el que venga. El día
 * que entre uno nuevo al catálogo, la criatura ya sabe invocarlo — lo que no
 * sabe es para qué sirve, y eso es el Hito 5.
 *
 * POR QUÉ EL GENÉRICO `P extends SeedProcessId` Y NO `SeedProcessId` A SECAS:
 * con `roles: Record<string, BodyView>`, que es lo que decía el documento de
 * arquitectura, un corpus de veinte llamadas malformadas era rechazado CERO
 * veces. Con `RolesOf<P>` el compilador vuelve a ser juez, y esta habilidad
 * —que es la que pasa los roles de mano en mano— es el sitio donde más se
 * nota: si el genérico se pierde en el camino, la garantía se pierde con él.
 */
export function* aplicarProceso<P extends SeedProcessId>(
  ctx: Ctx,
  args: { proceso: P; roles: RolesOf<P>; intentos?: number; hasta?: (r: StepResult) => boolean },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase(`aplicar:${args.proceso}`)
  const tope = args.intentos ?? 1

  const v = ctx.can(args.proceso, args.roles)
  if (!v.ok) return fail(`no puedo ${args.proceso}: ${v.por}`)

  // El contador vive en memoria: el ejemplo canónico del documento hace lo
  // mismo con `intentos`, y por la misma razón — un guardado a mitad de las
  // cuarenta tiradas de pesca no puede regalar las cuarenta de nuevo.
  const clave = `aplicar:${args.proceso}`
  let hechos = ctx.memory.get<number>(clave) ?? 0

  while (hechos < tope) {
    ctx.memory.set(clave, ++hechos)
    const r = yield ctx.apply(args.proceso, args.roles)
    if (args.hasta ? args.hasta(r) : r.status === 'done' && r.got.length > 0) {
      ctx.memory.del(clave)
      const primero = r.got[0]
      return primero ? done(primero) : done()
    }
    if (r.status === 'rejected') {
      // Los cuatro motivos que no mejoran reintentando: la forma está mal, no
      // el momento. `rol-no-cumple` y `arreglo-incorrecto` SÍ pueden mejorar
      // (algo se secó, algo se movió), así que ésos caen al reintento.
      if (
        r.por === 'proceso-desconocido' ||
        r.por === 'rol-sin-cuerpo' ||
        r.por === 'sin-permiso' ||
        r.por === 'compromiso-mal-declarado'
      ) {
        ctx.memory.del(clave)
        return fail(`${args.proceso} rechazado por ${r.por}`)
      }
    }
  }

  ctx.memory.del(clave)
  return fail(`${args.proceso} no dio resultado en ${tope} intentos`)
}

/**
 * Los cuatro que se pueden aplicar, como VALOR y no como tipo.
 *
 * `SEED_PROCESS_IDS` es la única parte del catálogo que cruzó a la superficie,
 * y alcanza para enumerar «todo lo que sé hacer» — que es el primer paso de
 * cualquier planificador. No alcanza para saber qué pide ni qué deja cada uno:
 * para eso hay que llamar `can()` con candidatos y mirar quién dice que sí.
 */
export function loQueSeHacer(): readonly SeedProcessId[] {
  return SEED_PROCESS_IDS
}
