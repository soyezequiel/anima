// ─── @anima/skills/ejecutor.ts ───────────────────────────────────────────────
//
// EL EJECUTOR. Corre un generador de habilidad, le da combustible, recibe los
// `Intent` que hace `yield`, se los pasa al mundo y le devuelve el `StepResult`.
// Síncrono, adentro del worker del mundo, sin cruces de frontera.
//
// Es la pieza que el documento de arquitectura compró cuando descartó QuickJS:
//
//   «Se adopta ejecución SÍNCRONA dentro del worker que hospeda el mundo, en JS
//    nativo, con combustible instrumentado por un transformer sobre AST.»
//
// y la razón por la que el cruce de frontera de WASM —2 a 12 ms por habilidad
// contra un presupuesto de 0,5— no aparece en ningún lado de este archivo: acá
// un `Intent` es un objeto que ya está en el heap del mundo, y pasarlo cuesta
// una referencia.
//
// ─── Quién maneja a quién ───────────────────────────────────────────────────
//
// El ejecutor NO tiene el bucle. Lo tiene el mundo, que es quien sabe cuándo es
// un tick y cuándo una intención terminó de resolverse. Acá adentro hay una
// máquina de estados de cuatro estados que se avanza con `step()`:
//
//   fresca      todavía no arrancó
//   esperando   cedió un `Intent`; el mundo lo está resolviendo (`goTo` puede
//               llevarle cientos de ticks) y hasta que no conteste no se sigue
//   suspendida  se le acabó el combustible del paso computando; el tick que
//               viene se reanuda EN EL MISMO PUNTO, sin `StepResult`
//   terminada / rota
//
// Esa separación es lo que hace que el ejecutor se pueda testear sin mundo, que
// es lo que hacen los tests de al lado: un mundo de mentira de veinte renglones
// alcanza para verificar la continuidad y el hash.
//
// ─── Las dos sedes de estado, y por qué solo una sobrevive ──────────────────
//
// El documento es explícito y hay que tomárselo en serio:
//
//   «Al cargar una partida, las habilidades en vuelo se REINICIAN DESDE ARRIBA y
//    se saltan a su `phase` declarada leyendo `ctx.memory`. Pueden repetir
//    trabajo. El criterio de aceptación no es "reproduce el final exacto" sino
//    "termina el objetivo". Fingir lo contrario era la falla común: si el estado
//    vive en el stack de un generador, no hay snapshot posible.»
//
// Un generador suspendido NO SE SERIALIZA: no hay API en ningún motor de JS. Por
// eso `save()` devuelve dos cosas chiquitas —el volcado de `ctx.memory` y la
// última fase declarada— y nada más. Todo lo que la habilidad tenga en variables
// locales se pierde al guardar, y eso no es un defecto de esta implementación:
// es la única verdad disponible, y está acá dicha en voz alta para que quien
// escriba una habilidad sepa dónde poner lo que le importa.

import {
  FUEL_POR_PASO,
  OutOfFuel,
  isSuspension,
  type FuelCell,
  type SuspensionSignal,
} from './combustible.js'
// La superficie se importa de `./ctx.js` —que re-exporta `./tipos.js`— y NUNCA
// de `skill-api.d.ts`: ese archivo es la EMISIÓN, el prompt que ve el modelo.
// Importar del archivo emitido haría que el paquete dependa de su propio
// artefacto de build, y que un `tsc --declaration` a medio correr rompiera el
// ejecutor.
import {
  fail,
  type ActorId,
  type Ctx,
  type Intent,
  type Outcome,
  type Skill,
  type SkillMemory,
  type StepResult,
} from './ctx.js'

/**
 * ¿Es un desborde de pila?
 *
 * Se mira la CLASE y el texto, y las dos cosas hacen falta: `RangeError` también
 * lo tira `new Array(-1)`, y el texto solo no alcanza porque no está
 * especificado —V8 dice «Maximum call stack size exceeded», SpiderMonkey «too
 * much recursion», JavaScriptCore «Maximum call stack size exceeded»—. Se acepta
 * cualquiera de los tres, y si aparece un motor con un cuarto texto lo peor que
 * pasa es que el informe diga «se rompió» en vez de «se fue de pila»: se pierde
 * el diagnóstico, nunca el corte.
 */
function esDesbordeDePila(e: unknown): boolean {
  if (!(e instanceof RangeError)) return false
  const m = e.message.toLowerCase()
  return m.includes('call stack') || m.includes('too much recursion') || m.includes('stack overflow')
}

/**
 * ¿Lo que cedió TIENE FORMA de intención?
 *
 * Se mira la FORMA y no el contenido, y la línea entre las dos cosas es la misma
 * que separa a este paquete del mundo: que `k` sea `'goTo'` o `'volar'`, que el
 * cuerpo exista, que el compromiso esté bien declarado —todo eso lo juzga
 * `stepWorld`, y tiene que seguir juzgándolo—. Acá se ataja lo que ni siquiera
 * llega a ser una intención: `yield 42`, `yield 'hola'`, `yield {}`.
 *
 * Sin esto un número viaja al mundo, que lo rechaza igual —`i.k` es `undefined`
 * y no hay rama para eso— pero el rechazo NOMBRA AL MUNDO y no a la habilidad, y
 * el informe del juez lo cuenta como «el mundo rechazó»: el diagnóstico
 * equivocado en el archivo equivocado. El modo de falla honesto que esto ataja
 * es `yield goTo(...)` escrito sin el `ctx.`, con un ayudante local que devuelve
 * cualquier otra cosa.
 *
 * `null` entra por acá y no por una comprobación aparte porque `typeof null` es
 * `'object'`, que es justo la trampa que hace que este chequeo se escriba mal.
 */
function tieneFormaDeIntencion(v: unknown): v is Intent {
  if (v === null || typeof v !== 'object') return false
  return typeof (v as { readonly k?: unknown }).k === 'string'
}

// ─── La memoria ─────────────────────────────────────────────────────────────

/** Lo que sobrevive a un guardado. Nada más que esto. */
export interface SavedSkillState {
  readonly phase: string
  readonly memory: Readonly<Record<string, unknown>>
}

/**
 * Las claves que empiezan con `@` son de la casa. Sin este apartado, una
 * habilidad que guardara algo en la clave `phase` le pisaría el punto de
 * re-entrada a sí misma y el bug aparecería recién al cargar la partida.
 */
const PREFIJO_RESERVADO = '@'

/**
 * ¿Esto sobrevive a un `JSON.stringify`?
 *
 * La comprobación existe por un modo de falla concreto y silencioso: el ejemplo
 * canónico del documento hace `ctx.memory.set('pozo', agua.at)` y guarda `{x,y}`,
 * que sobrevive. Escribir `set('pozo', agua)` —el cuerpo entero, que es lo que
 * uno teclea sin pensar— también «anda» toda la partida y recién falla al
 * guardar, o peor: al cargar, con un `BodyView` fantasma cuyo `id` ya no existe.
 * Que reviente en el `set`, con la clave adelante, convierte un bug de
 * persistencia en un error de tipeo.
 */
function esSerializable(v: unknown, vistos: Set<unknown> = new Set()): boolean {
  if (v === null) return true
  const t = typeof v
  if (t === 'string' || t === 'boolean') return true
  if (t === 'number') return Number.isFinite(v as number)
  if (t !== 'object') return false // function, symbol, bigint, undefined
  if (vistos.has(v)) return false // un ciclo no se guarda
  vistos.add(v)
  if (Array.isArray(v)) return v.every((x) => esSerializable(x, vistos))
  const proto: unknown = Object.getPrototypeOf(v)
  if (proto !== Object.prototype && proto !== null) return false // Map, Set, clases, BodyView…
  return Object.values(v as Record<string, unknown>).every((x) => esSerializable(x, vistos))
}

export interface SkillState {
  readonly memory: SkillMemory
  /** La última fase declarada. Es el punto de re-entrada tras cargar la partida. */
  readonly phase: string
  /** La llama `ctx.phase()` y nadie más. */
  setPhase(name: string): void
  save(): SavedSkillState
}

/**
 * El KV tipado de `ctx.memory` más la fase.
 *
 * `get<T>` castea, y eso es deuda declarada y no un descuido: lo que vuelve de
 * un guardado es JSON, así que no hay forma de verificar en tiempo de ejecución
 * que sea el `T` que el llamador espera sin un esquema por clave. La misma
 * decisión —con el mismo cartel— está tomada en el ledger de `@anima/oracle`.
 */
export function createSkillState(saved?: SavedSkillState, onPhase?: (name: string) => void): SkillState {
  const kv = new Map<string, unknown>(Object.entries(saved?.memory ?? {}))
  let fase = saved?.phase ?? ''

  const memory: SkillMemory = {
    get<T>(key: string): T | undefined {
      return kv.get(key) as T | undefined
    },
    set<T>(key: string, value: T): void {
      if (key.startsWith(PREFIJO_RESERVADO)) {
        throw new Error(`la clave "${key}" es de la casa: las que empiezan con "${PREFIJO_RESERVADO}" están reservadas`)
      }
      if (!esSerializable(value)) {
        throw new Error(
          `ctx.memory.set("${key}", …) recibió algo que no sobrevive a un guardado. ` +
            'Solo entran números, textos, booleanos, null, arrays y objetos planos: ' +
            'guardá `cuerpo.at` o `cuerpo.id`, no el cuerpo.',
        )
      }
      kv.set(key, value)
    },
    del(key: string): void {
      kv.delete(key)
    },
  }

  return {
    memory,
    get phase() {
      return fase
    },
    setPhase(name: string): void {
      fase = name
      onPhase?.(name)
    },
    save(): SavedSkillState {
      // Las claves se ordenan para que el volcado sea CANÓNICO: dos partidas que
      // llegaron al mismo estado por caminos distintos tienen que dar el mismo
      // texto, o el hash del guardado miente. Es la misma razón por la que
      // `@anima/world/hash.ts` ordena antes de serializar.
      const memoria: Record<string, unknown> = {}
      for (const k of [...kv.keys()].sort()) memoria[k] = kv.get(k)
      return { phase: fase, memory: memoria }
    },
  }
}

// ─── El contexto ────────────────────────────────────────────────────────────

/**
 * Lo que pone el mundo. Todo `Ctx` menos las dos cosas que son del ejecutor.
 *
 * CONTRATO, y es el único acoplamiento fuerte de este archivo: el mundo entrega
 * UN objeto por habilidad en vuelo y lo REFRESCA en su lugar cada tick (`tick`,
 * `self`, la percepción congelada). No puede entregar uno nuevo por paso, porque
 * el generador se quedó con la referencia del primero y no hay forma de
 * cambiársela. Y no puede compartir uno entre dos habilidades, porque
 * `ctx.memory` es de cada una: por eso instalar dos veces sobre el mismo objeto
 * lanza en vez de pisar.
 */
export type WorldCtx = Omit<Ctx, 'memory' | 'phase'>

/** Instala `memory` y `phase` sobre el contexto del mundo. */
export function installSkillState(base: WorldCtx, state: SkillState): Ctx {
  if (Object.prototype.hasOwnProperty.call(base, 'memory')) {
    throw new Error('ese ctx ya tiene una memoria instalada: cada habilidad en vuelo necesita el suyo')
  }
  Object.defineProperties(base, {
    memory: { value: state.memory, enumerable: true },
    phase: {
      value: (name: string) => {
        state.setPhase(name)
      },
      enumerable: true,
    },
  })
  return base as Ctx
}

// ─── La máquina de estados ──────────────────────────────────────────────────

export type SkillStatus = 'fresca' | 'esperando' | 'suspendida' | 'terminada' | 'rota'

export type Step =
  /** Cedió una intención. El mundo la resuelve y contesta con un `StepResult`. */
  | { readonly k: 'intent'; readonly intent: Intent }
  /** Se le acabó el combustible del paso. Se la reanuda el tick que viene. */
  | { readonly k: 'suspendida'; readonly spent: number; readonly stalls: number }
  | { readonly k: 'terminada'; readonly outcome: Outcome }
  /** Se rompió, o se pasó de larga donde no se podía ceder. */
  | { readonly k: 'rota'; readonly why: string; readonly phase: string; readonly error?: unknown }

export interface RunOptions {
  /**
   * EL DUEÑO DE LA CORRIDA. Con quién se firma cada intención que salga de acá.
   *
   * No es opcional y no tiene valor por omisión, y eso es la reparación entera
   * del agujero 6 del ataque al sandbox: mientras el ejecutor devolvía lo cedido
   * verbatim, una habilidad podía emitir `{ k: 'eat', by: 'el-cuidador', … }` y
   * `stepWorld` la atendía —busca `d.actors.get(i.by)` y si ese actor existe,
   * actúa—. El mundo no lo puede notar: le llega un arreglo plano de intenciones
   * y no sabe de qué corrida salió cada una.
   *
   * Y no es solo suplantación: los permisos se comparan contra EL ACTOR QUE
   * FIRMA, así que firmando con otro `by` se saltean juntos el ADR II-0003 y el
   * portón de confirmación —una habilidad `provisional`, que entra con
   * `permits: 'reversible'`, firma como alguien con permiso irreversible y quema
   * la casa—. Un valor por omisión acá sería ese mismo agujero con otro nombre:
   * el ejecutor es el ÚNICO que sabe de quién es la corrida, y si no lo sabe no
   * puede firmar.
   */
  readonly by: ActorId
  /** El tanque que se recarga en cada reanudación. */
  readonly fuelPerStep?: number
  /**
   * Cuántas suspensiones SEGUIDAS —sin producir ni una intención— se toleran.
   *
   * Es el corte que el combustible solo no puede dar: un `while (true)` en el
   * cuerpo de la habilidad cede prolijamente cada vez que se le acaba el
   * tanque, así que nunca muere; simplemente no hace nada para siempre, que
   * desde afuera se ve igual que colgarse pero sin caer un cuadro. Veinte
   * suspensiones son un segundo de mundo a 20 Hz pensando sin actuar.
   */
  readonly maxStalls?: number
  /** La celda del código instrumentado. Sin ella no hay presupuesto ni suspensión. */
  readonly cell?: FuelCell
  readonly saved?: SavedSkillState
}

/**
 * Una entrada de la traza de conducta.
 *
 * La traza CRECE con la corrida y no tiene tope, a propósito: es lo que hashea
 * el criterio «corrida dos veces, el mismo hash» y lo que el juez compara entre
 * dos versiones, así que recortarla por la mitad sería comparar dos mitades. La
 * escala en la que se usa la banca: los mundos del juez corren 120 a 400 ticks y
 * una habilidad viva emite del orden de una entrada por paso. Si algún día una
 * habilidad de veinte mil ticks tiene que quedar viva en memoria, lo que
 * corresponde es hashear en línea y tirar las entradas —el hash es asociativo—,
 * no truncar la traza y seguir comparándola.
 */
export interface TraceEntry {
  readonly k: 'phase' | 'intent' | 'result' | 'stall' | 'end'
  readonly v: unknown
}

/**
 * Cuántas veces se le insiste a un `finally` que se comió el corte antes de
 * sacarlo con una excepción. Ver `#cortar`.
 */
const INTENTOS_DE_CIERRE = 4

/**
 * Una habilidad en vuelo.
 *
 * El nombre no es «Executor» a propósito: no ejecuta muchas, ejecuta UNA, y su
 * ciclo de vida es el de esa corrida. El mundo tiene tantas de éstas como
 * habilidades tenga en vuelo, y las avanza en un orden que él decide y que tiene
 * que ser estable —si el orden dependiera de la iteración de un `Set` de
 * objetos, dos réplicas del mismo mundo divergirían—.
 */
export class SkillRun<A> {
  readonly #gen: Generator<Intent, Outcome, StepResult>
  readonly #state: SkillState
  readonly #cell: FuelCell | undefined
  readonly #fuelPerStep: number
  readonly #maxStalls: number
  readonly #trace: TraceEntry[] = []
  readonly #by: ActorId

  #status: SkillStatus = 'fresca'
  #stalls = 0
  #outcome: Outcome | undefined
  #steps = 0
  /**
   * EL NÚMERO DE EMISIÓN, y de dónde sale es la decisión que hace que estampar
   * la autoría no sea un renglón.
   *
   * Sale de ESTA CORRIDA: arranca en cero y sube de a uno por intención emitida.
   * No de un contador global, no de un contador del actor, no del reloj.
   *
   * POR QUÉ: el criterio (d) del Hito 4 es «una habilidad corrida dos veces da
   * el mismo hash», y el hash se toma sobre el `Intent` ENTERO —`canonico()` no
   * saltea ninguna clave, así que `by` y `seq` entran—. Con un contador
   * compartido, dos corridas idénticas de la misma habilidad sobre el mismo
   * mundo darían hashes distintos según qué OTRA habilidad emitió antes, y el
   * juez del Hito 7 compara dos versiones por su hash: uno que depende de los
   * vecinos no compara nada. El `seq` tiene que ser función de la corrida, como
   * lo es todo lo demás que entra en la traza.
   *
   * LO QUE SE PAGA, dicho entero: dos corridas DEL MISMO ACTOR vivas en el mismo
   * tick emiten las dos `seq: 0`, y `stepWorld` rechaza a LAS DOS con
   * `orden-duplicado` en vez de despachar una y rechazar la otra con `ya-actuo`.
   * No es un empeoramiento escondido: el mundo le da UN turno por tick a cada
   * cuerpo (`yaActuo` en `world/src/step.ts`), así que la segunda se perdía
   * igual; lo que cambia es que ahora se pierden las dos, con un rechazo ruidoso
   * y reproducible en vez de uno que depende del orden de llegada. El día que un
   * actor tenga que poder tener DOS habilidades en vuelo, el `seq` pasa a salir
   * de él —y ahí el hash hay que tomarlo sobre la intención SIN firmar, o el
   * criterio (d) se cae—.
   */
  #seq = 0

  /**
   * OJO con el orden: el estado se crea ANTES que el generador porque
   * `installSkillState` tiene que haber corrido antes de que el cuerpo de la
   * habilidad vea el `ctx`. Llamar a la habilidad no ejecuta nada —un generador
   * no corre hasta el primer `next()`— pero el `ctx` que se le pasa ya tiene que
   * estar completo.
   */
  constructor(skill: Skill<A>, base: WorldCtx, args: A, o: RunOptions) {
    this.#state = createSkillState(o.saved, (name) => {
      this.#trace.push({ k: 'phase', v: name })
    })
    this.#by = o.by
    this.#cell = o.cell
    this.#fuelPerStep = o.fuelPerStep ?? FUEL_POR_PASO
    this.#maxStalls = o.maxStalls ?? 20
    this.#gen = skill(installSkillState(base, this.#state), args)
  }

  get status(): SkillStatus {
    return this.#status
  }

  get phase(): string {
    return this.#state.phase
  }

  /** Cuántas veces se la avanzó. Es el numerador del informe de `atascada`. */
  get steps(): number {
    return this.#steps
  }

  get outcome(): Outcome | undefined {
    return this.#outcome
  }

  get trace(): readonly TraceEntry[] {
    return this.#trace
  }

  save(): SavedSkillState {
    return this.#state.save()
  }

  /**
   * Un paso. Se le pasa el `StepResult` si el estado es `esperando`, y nada si
   * está `fresca` o `suspendida`.
   *
   * Los dos errores de uso lanzan en vez de arreglarse solos: avanzar una
   * habilidad que está esperando al mundo con un resultado inventado es
   * exactamente el bug que hace que una habilidad crea que llegó a un lugar
   * donde nunca estuvo, y encontrarlo dos mil ticks después no lo encuentra
   * nadie.
   */
  step(result?: StepResult): Step {
    if (this.#status === 'terminada' || this.#status === 'rota') {
      throw new Error(`no se puede avanzar una habilidad ${this.#status}`)
    }
    if (this.#status === 'esperando' && result === undefined) {
      throw new Error('la habilidad está esperando al mundo: hay que pasarle el StepResult de su intención')
    }
    if (this.#status !== 'esperando' && result !== undefined) {
      throw new Error('la habilidad no cedió ninguna intención: no hay qué contestarle')
    }

    this.#steps++
    // La recarga es POR PASO y no acumulativa: lo que sobró del tick anterior no
    // se guarda. Un presupuesto que se acumula deja de ser un tope —una
    // habilidad que duerme cien ticks se compra cien tanques y después se los
    // gasta todos juntos adentro de un solo cuadro, que es justo el cuadro que
    // no queremos perder.
    this.#cell?.refill(this.#fuelPerStep)

    if (result !== undefined) this.#trace.push({ k: 'result', v: { status: result.status, got: result.got.length } })

    try {
      const r =
        result === undefined
          ? // Reanudar una suspensión: el valor que reciba el `yield` inyectado
            // se descarta —es una sentencia—, así que mandar `undefined` es
            // correcto y el cast solo le dice eso a `tsc`.
            this.#gen.next(undefined as unknown as StepResult)
          : this.#gen.next(result)

      if (r.done) {
        this.#status = 'terminada'
        this.#outcome = r.value
        this.#trace.push({ k: 'end', v: r.value.ok })
        return { k: 'terminada', outcome: r.value }
      }

      const cedido: Intent | SuspensionSignal = r.value
      if (isSuspension(cedido)) {
        this.#stalls++
        this.#trace.push({ k: 'stall', v: this.#stalls })
        if (this.#stalls > this.#maxStalls) {
          return this.#romper(
            `se quedó pensando ${this.#stalls} pasos seguidos sin hacer nada: está trabada`,
            undefined,
          )
        }
        this.#status = 'suspendida'
        return { k: 'suspendida', spent: this.#cell?.spent ?? 0, stalls: this.#stalls }
      }

      if (!tieneFormaDeIntencion(cedido)) {
        return this.#romper('cedió algo que no es una intención', undefined)
      }

      // ─── LA FIRMA DE LA CASA ────────────────────────────────────────────
      //
      // Se estampan `by` y `seq`, y NADA MÁS. En particular NO se toca
      // `commitment`: lo declara quien emite y `stepWorld` lo recalcula y
      // castiga la mentira (`revisarCompromiso`, `world/src/intent.ts`).
      // Estampar la autoría no puede convertirse en «el ejecutor arregla la
      // intención», porque el día que el ejecutor corrija algo que el mundo
      // juzga, el mundo deja de ser el árbitro: es exactamente el argumento del
      // test de al lado sobre declarar `reversible` un `eat`. El ejecutor
      // responde por lo que SABE —de quién es esta corrida y en qué orden emite—
      // y de nada más.
      //
      // El spread va PRIMERO y las dos claves de la casa después, para que ganen
      // siempre. Al revés —`{ by, seq, ...cedido }`— la habilidad se seguiría
      // firmando sola y esto sería un adorno.
      const intent: Intent = { ...cedido, by: this.#by, seq: this.#seq++ }

      this.#stalls = 0
      this.#status = 'esperando'
      this.#trace.push({ k: 'intent', v: intent })
      return { k: 'intent', intent }
    } catch (e) {
      if (e instanceof OutOfFuel) {
        return this.#romper(
          'se le acabó el combustible adentro de una función común, donde no se puede ceder',
          e,
        )
      }
      if (esDesbordeDePila(e)) {
        // LA RECURSIÓN INFINITA NO SIEMPRE MUERE POR COMBUSTIBLE, y el número
        // está medido: la pila de V8 aguanta ~10.350 marcos de una función
        // instrumentada, y el tanque de producción son 200.000 unidades. O sea
        // que con `FUEL_POR_PASO` el `RangeError` gana por 19×, y la promesa del
        // ADR II-0005 —«muere por combustible y no por RangeError»— solo se
        // cumple con tanques por debajo de la pila (verificado: 10.000 sí,
        // 20.000 ya no).
        //
        // Lo que el ADR quería comprar con esa promesa NO era el nombre del
        // error: era que el corte fuera ADMINISTRABLE, o sea que llegara con su
        // fase y no como «se rompió». Eso se cumple igual, y es lo que hace esta
        // rama: un desborde de pila es un diagnóstico, no un tropiezo, y decirlo
        // acá evita que el informe del juez lo cuente como error del mundo.
        return this.#romper('se fue de pila: hay una recursión sin fondo', e)
      }
      return this.#romper(e instanceof Error ? e.message : String(e), e)
    }
  }

  /**
   * Cortar la habilidad desde afuera: la revocaron, la partida se cierra, el
   * objetivo cambió. Usa `gen.return()` y no un `throw` para que corran los
   * `finally` que la habilidad haya escrito.
   *
   * Y MIRA EL `done`, que es lo que le faltaba: un `yield` adentro de un
   * `finally` SECUESTRA el `return` —la especificación dice que el generador se
   * reanuda ahí y `return()` devuelve `{ done: false }`—, y como la inyección de
   * combustible ES un `yield`, cualquier `finally` con un bucle suficientemente
   * largo lo consigue sin proponérselo. Sin mirar el `done`, esto reportaba
   * `terminada` sobre una corutina viva: no se perdía nada del mundo —el
   * ejecutor no la vuelve a avanzar— pero se perdía la garantía que `abort()`
   * estaba comprando, que era «los `finally` corrieron». Un informe que miente
   * es peor que uno que falla, y el juez del Hito 7 arma su grilla con esto.
   */
  abort(why: string): Step {
    if (this.#status === 'terminada' || this.#status === 'rota') return this.#ultimo()
    const outcome = fail(why)
    const resistio = this.#cortar(outcome)
    if (resistio !== undefined) return this.#romper(`se la cortó por "${why}" y ${resistio}`, undefined)
    this.#status = 'terminada'
    this.#outcome = outcome
    this.#trace.push({ k: 'end', v: false })
    return { k: 'terminada', outcome }
  }

  /**
   * Cierra el generador de verdad. Devuelve `undefined` si cerró solo —o sea si
   * sus `finally` corrieron enteros— y el porqué si hubo que sacarlo.
   *
   * Los reintentos son con `next()` y NO con otro `return()`, y la diferencia es
   * todo lo que este método vino a comprar: un segundo `return()` reanuda el
   * `finally` con una completación abrupta, o sea que lo ABORTA a mitad de
   * camino y el `finally` que soltaba lo que tenía en la mano nunca termina —que
   * es el mismo bug con otra cara—. `next()` lo deja seguir; lo único que hace
   * falta es darle tanque, porque quedó suspendido justo por no tener.
   *
   * El tope es CUATRO y es un tope, no una estimación: un `finally` honesto
   * suelta lo que tiene y cierra en el primero, y cuatro tanques son cuatro
   * veces el presupuesto de cómputo de un paso —0,56 ms cada uno, medido en
   * `presupuesto.test.ts`— o sea que el peor corte sigue entrando cómodo en un
   * cuadro de 50 ms. Un `finally` que necesita más que eso no está limpiando,
   * está trabajando, y para ése está el `throw`.
   *
   * Lo que se descarta a sabiendas: si el `finally` cede una intención de verdad
   * durante el corte, se pierde. Está bien que se pierda — al mundo se le dijo
   * que esta habilidad se terminó, y una intención que sale después de eso es de
   * nadie.
   */
  #cortar(outcome: Outcome): string | undefined {
    try {
      let r = this.#gen.return(outcome)
      for (let i = 0; !r.done && i < INTENTOS_DE_CIERRE; i++) {
        this.#cell?.refill(this.#fuelPerStep)
        r = this.#gen.next(undefined as unknown as StepResult)
      }
      if (r.done === true) return undefined
    } catch {
      // Un `finally` que LANZA no cambia lo que pasó: la habilidad se corta
      // igual, y de paso el generador queda completado por la propia excepción.
      return undefined
    }
    // No cerró por las buenas. Se lo saca con una excepción, que atraviesa el
    // `finally` en vez de esperarlo.
    try {
      const r = this.#gen.throw(new Error(`la habilidad no cerró en ${INTENTOS_DE_CIERRE} intentos`))
      if (r.done !== true) return 'el generador sobrevivió hasta a la excepción: algún `catch` se comió el corte'
      return 'hubo que sacarlo con una excepción: sus `finally` no corrieron enteros'
    } catch {
      // La excepción salió por acá, que es lo normal: el generador quedó
      // completado. Cerró, pero no por las buenas, y eso se dice.
      return 'hubo que sacarlo con una excepción: sus `finally` no corrieron enteros'
    }
  }

  #ultimo(): Step {
    if (this.#outcome !== undefined) return { k: 'terminada', outcome: this.#outcome }
    return { k: 'rota', why: 'ya estaba rota', phase: this.phase }
  }

  #romper(why: string, error: unknown): Step {
    this.#status = 'rota'
    this.#trace.push({ k: 'end', v: false })
    // La FASE viaja con el error. Es lo que convierte «falló» en «muere en
    // buscar-agua 9 de 10 veces», que es el disparador `atascada` del carril de
    // mejora y el único informe con el que una revisión se puede corregir.
    return error === undefined
      ? { k: 'rota', why, phase: this.phase }
      : { k: 'rota', why, phase: this.phase, error }
  }

  /**
   * La firma de conducta de esta corrida: fases, intenciones, resultados y
   * finales, en orden.
   *
   * Es lo que hace verificable «una habilidad corrida dos veces da el mismo
   * hash», que es el criterio del Hito 4 y la precondición del juez: si dos
   * corridas de la misma habilidad sobre el mismo mundo no dan lo mismo, medir
   * cuál de dos versiones es mejor no significa nada.
   */
  hash(): string {
    return hashTrace(this.#trace)
  }
}

// ─── El hash de la traza ────────────────────────────────────────────────────
//
// FNV-1a, por lo mismo que lo usa `@anima/world/hash.ts`: son cuatro líneas, no
// tiene tablas, y sus dos operaciones —XOR y multiplicación de 32 bits— están
// especificadas EXACTAMENTE en ECMAScript vía `^` y `Math.imul`. Un hash que use
// `a * b` en vez de `Math.imul(a, b)` da resultados distintos en cuanto el
// producto pasa 2⁵³, y eso pasa en el primer byte.
//
// DOS CARRILES y no uno: un FNV-1a de 32 bits colisiona a ciegas cada 4·10⁹
// comparaciones, y en una prueba de equivalencia una colisión es un FALSO
// NEGATIVO —dos corridas que YA divergieron se declaran iguales y el test pasa
// en verde—. Con dos bases distintas el número efectivo es 64 bits.

function fnv(texto: string, base: number, primo: number): number {
  let h = base
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, primo)
  }
  return h >>> 0
}

/**
 * Serialización canónica: claves ordenadas con `<` sobre unidades de código
 * —nunca `localeCompare`, que depende del locale del sistema— y sin funciones.
 *
 * Que las funciones se salteen tiene una consecuencia que hay que decir: dos
 * `ctx.explore({ until: … })` con predicados DISTINTOS hashean igual, porque lo
 * único que los diferencia es una función. No se puede arreglar sin serializar
 * código, y no hace falta: lo que el predicado hace se ve igual en la traza,
 * porque cambia cuándo llega el `StepResult` con `status: 'found'`.
 */
function canonico(v: unknown, vistos: Set<unknown> = new Set()): string {
  if (v === null) return 'null'
  const t = typeof v
  if (t === 'number') return Number.isFinite(v as number) ? String(v) : 'nan'
  if (t === 'string') return JSON.stringify(v)
  if (t === 'boolean') return String(v)
  if (t === 'function' || t === 'symbol' || t === 'undefined') return ''
  if (t !== 'object') return String(v)
  if (vistos.has(v)) return '<ciclo>'
  vistos.add(v)
  if (Array.isArray(v)) return `[${v.map((x) => canonico(x, vistos)).join(',')}]`
  const o = v as Record<string, unknown>
  const claves = Object.keys(o).sort()
  const partes: string[] = []
  for (const k of claves) {
    const s = canonico(o[k], vistos)
    if (s !== '') partes.push(`${JSON.stringify(k)}:${s}`)
  }
  return `{${partes.join(',')}}`
}

export function hashTrace(trace: readonly TraceEntry[]): string {
  const texto = trace.map((e) => `${e.k}=${canonico(e.v)}`).join(';')
  const a = fnv(texto, 0x811c9dc5, 0x01000193)
  const b = fnv(texto, 0x01000193, 0x01000193 + 2)
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')
}
