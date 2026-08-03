/**
 * ═══ DE UN HUECO A UN CONTRATO QUE SE PUEDE JUZGAR ═════════════════════════
 *
 * La pieza que faltaba para que la fragua sirva en una partida, y faltaba entera:
 * los diez contratos que este repositorio tiene están **escritos a mano**, uno por
 * innata. `leerCandidatas` no produce ninguno y el encargo tampoco se lo pide al
 * modelo — el contrato lo pone el llamador, siempre.
 *
 * Eso alcanzaba mientras la fragua sólo corría en tests y demos, donde el que
 * escribe el test también escribe el contrato. En una partida no hay nadie: el
 * hueco lo descubre la mente a mitad de un tick y no viene con un contrato al
 * lado. Y sin contrato **el juez contesta `injuzgable`**, o sea que todo lo que el
 * modelo escriba se descarta con la misma cara que si no hubiera escrito nada.
 *
 * ─── LO QUE HACE QUE ESTO SEA POSIBLE ──────────────────────────────────────
 *
 * Que un gap ya tenga la forma de un contrato. Medido en una partida real:
 *
 *     fuelEnergy>0 & heatCapacity<=9 & ignitionPoint<=400 &
 *     moisture<0.45 & rigidity>=0.5 & tensile>=0.3
 *
 * Seis condiciones `cualidad · operador · valor`, que es exactamente lo que un
 * `Predicado` de contrato es. No hay que inventar nada: hay que REPARTIRLAS.
 *
 * ═══ EL REPARTO, QUE ES TODA LA DECISIÓN ═══════════════════════════════════
 *
 * Un contrato tiene dos listas y no son intercambiables:
 *
 *   `precondiciones`  lo que el mundo le TRAE a la habilidad. `bancoDe` las lee
 *                     para construir el cuerpo con el que va a correr — y las
 *                     ablaciona, o sea que corre mundos donde no se cumplen y
 *                     espera que la habilidad NO llegue;
 *   `establece`       lo que la habilidad tiene que dejar cierto. Es contra esto
 *                     que el juez la promueve o la baja.
 *
 * Poner el gap entero en las dos sería el peor de los errores posibles, y vale
 * la pena decir por qué: `moisture<0.45` como PRECONDICIÓN significa «esta
 * habilidad necesita que la leña ya esté seca», y el juez lo ablacionaría —
 * correría un mundo con la leña mojada y exigiría que la habilidad fracase. Que
 * es literalmente lo contrario de lo que se le está pidiendo.
 *
 * ─── ENTONCES, ¿QUIÉN SABE CUÁL ES CUÁL? EL MUNDO ──────────────────────────
 *
 * No se puede leer del gap: la firma dice qué hace falta, no qué ya hay. Pero el
 * que pide sí lo sabe, porque tiene la partida delante. Medido en la misma
 * partida: de las seis condiciones de arriba, la vara de madera que la criatura
 * llevaba en la mano cumplía **cinco**, y fallaba sólo `moisture`.
 *
 * O sea que el reparto sale solo:
 *
 *   lo que la materia YA trae  →  precondiciones  («tenés esto»)
 *   lo que le falta            →  establece       («dejame esto otro»)
 *
 * Y el contrato que sale dice, en el vocabulario del juez, exactamente el pedido
 * que la criatura no supo cumplir: *«agarrá algo que arda, que sea rígido y que
 * pese poco, y devolvémelo seco»*.
 *
 * ─── LOS DOS CASOS EN QUE NO SE PUEDE, Y SE DICEN ──────────────────────────
 *
 * `undefined` y no un contrato vacío, porque los dos son diagnósticos y no
 * fallas del arnés:
 *
 *   · **no falta nada** — todas las condiciones ya se cumplen. Entonces no había
 *     hueco que forjar y el pedido llegó por otra razón;
 *   · **no hay de dónde agarrar** — ninguna se cumple. `bancoDe` sin
 *     precondiciones de `el-objetivo` devuelve un solo mundo SIN objetivo, y ahí
 *     `establece` sobre `el-objetivo` no se puede leer: el juez contestaría sobre
 *     un cuerpo que no existe. Forjar contra eso sería pagar un viaje al modelo
 *     para tirar el resultado.
 */

import { interpretar } from '@anima/plan'
import type { QualityTest } from '@anima/physics'
import type { Contrato, Predicado } from '@anima/skills/innatas'

/**
 * CUÁNTO SE LE CONCEDE A UNA HABILIDAD FORJADA, EN SEGUNDOS DE MUNDO.
 *
 * Es un hueco declarado y no un número calibrado: **el gap no dice cuánto cuesta
 * lo que pide**. Una firma es un estado deseado y el precio depende de por dónde
 * se lo consiga, que es justamente lo que el modelo todavía no escribió.
 *
 * Los 30 salen de mirar los diez contratos innatos —el más caro es cocinar, con
 * 15— y duplicarlo. Es un techo para que el juez tenga con qué cortar una
 * habilidad que se cuelga, no una predicción. El día que la candidata traiga su
 * propio costo, este número se borra.
 */
const SEGUNDOS_QUE_SE_CONCEDEN = 30

/**
 * EL COMPROMISO QUE SE LE PERMITE, y es el más BAJO a propósito.
 *
 * `reversible` es el piso: una habilidad que emita algo más fuerte la rechaza el
 * mundo con `sin-permiso` antes de mirarla. Conceder `irreversible` de entrada
 * sería dejar que lo primero que un modelo escribe para una partida pueda gastar
 * materia sin vuelta atrás — y lo que se está juzgando es, precisamente, si sabe
 * lo que hace.
 */
const LO_QUE_SE_LE_PERMITE = 'reversible' as const

/** Una condición del gap, con lo que hace falta para repartirla. */
export interface CondicionDelGap {
  readonly test: QualityTest
  /** Cómo estaba escrita. Sirve para decir qué no se pudo leer. */
  readonly crudo: string
}

/**
 * LAS CONDICIONES DE UN GAP, SUELTAS.
 *
 * Se parte por `&` igual que `firmaDe`, y cada trozo pasa por `interpretar`, que
 * es el mismo parser que usa el planificador. Las que no son de cualidad se
 * dejan afuera y se pueden contar: un gap con una relación adentro
 * —`holding(tag:carnoso)`— no se puede repartir en materia, porque `bancoDe`
 * construye CUERPOS y una relación no describe un cuerpo.
 */
export function condicionesDelGap(gap: string): {
  readonly condiciones: readonly CondicionDelGap[]
  readonly noSeLeyeron: readonly string[]
} {
  const condiciones: CondicionDelGap[] = []
  const noSeLeyeron: string[] = []
  for (const trozo of gap.split('&')) {
    const crudo = trozo.trim()
    if (crudo === '') continue
    const p = interpretar(crudo)
    if (p === undefined || p.k !== 'cualidad') {
      noSeLeyeron.push(crudo)
      continue
    }
    condiciones.push({ test: p.test, crudo })
  }
  return { condiciones, noSeLeyeron }
}

/** Por qué un gap no dio contrato. Es un diagnóstico, no una falla. */
export type PorQueNoHayContrato =
  /** Ninguna condición se pudo leer como cualidad. */
  | 'no-es-de-materia'
  /** Todas se cumplen ya: no hay hueco. */
  | 'no-falta-nada'
  /** Ninguna se cumple: `bancoDe` no tendría con qué armar el objetivo. */
  | 'no-hay-de-donde-agarrar'

export type DelGap = { readonly k: 'contrato'; readonly contrato: Contrato } | { readonly k: 'no'; readonly porque: PorQueNoHayContrato }

/**
 * EL CONTRATO DE UN HUECO.
 *
 * `yaLoTrae` contesta, para cada condición, si la materia que la criatura tiene
 * a mano ya la cumple. Entra por parámetro y no se calcula acá por la frontera de
 * siempre: **este paquete no tiene mundo**. Lo tiene el que pide.
 *
 * Todos los predicados van sobre `el-objetivo` y ninguno sobre `yo`, y es una
 * decisión con consecuencia medible: el juez sólo sabe leer esos dos sujetos, y
 * un gap habla de una COSA que hace falta, nunca del cuerpo de la criatura. Si
 * algún día un gap pide `stamina>=X`, este reparto lo va a poner sobre el
 * objetivo y el juez va a medir la stamina de un tronco. Queda dicho acá porque
 * el día que pase, el síntoma va a ser un veredicto raro y no un error.
 */
export function contratoDelGap(gap: string, nombre: string, yaLoTrae: (t: QualityTest) => boolean): DelGap {
  const { condiciones } = condicionesDelGap(gap)
  if (condiciones.length === 0) return { k: 'no', porque: 'no-es-de-materia' }

  const precondiciones: Predicado[] = []
  const establece: Predicado[] = []
  for (const c of condiciones) {
    const p: Predicado = { sujeto: 'el-objetivo', q: c.test.q, op: c.test.op, v: c.test.v }
    if (yaLoTrae(c.test)) precondiciones.push(p)
    else establece.push(p)
  }

  if (establece.length === 0) return { k: 'no', porque: 'no-falta-nada' }
  if (precondiciones.length === 0) return { k: 'no', porque: 'no-hay-de-donde-agarrar' }

  return {
    k: 'contrato',
    contrato: {
      nombre,
      establece,
      precondiciones,
      cuesta: { segundos: SEGUNDOS_QUE_SE_CONCEDEN, commitment: LO_QUE_SE_LE_PERMITE },
      // ─── LOS HUECOS SE DECLARAN, y estos dos son del reparto ─────────────
      //
      // El campo existe para que lo que la API no alcanzó quede escrito al lado
      // de lo que sí, en vez de en la cabeza de quien lo escribió. Un contrato
      // derivado tiene dos que ninguno de los diez escritos a mano tiene.
      huecos: [
        `DERIVADO DE UN GAP, no escrito: «${gap}». El reparto entre precondición y promesa salió de qué cumplía la materia que la criatura tenía a mano EN ESE TICK, así que el mismo gap con otra materia da otro contrato. Es correcto —el pedido es distinto— y hay que saberlo antes de comparar dos veredictos del mismo hueco`,
        `EL COSTO NO SALE DEL GAP: los ${String(SEGUNDOS_QUE_SE_CONCEDEN)} s son un techo para cortar una habilidad colgada, no una predicción. Una firma dice qué estado se quiere y nunca cuánto vale conseguirlo`,
      ],
    },
  }
}
