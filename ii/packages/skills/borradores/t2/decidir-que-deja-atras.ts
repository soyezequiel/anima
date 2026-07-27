// Tanda 2 · capacidad «decidir-que-deja-atras»
// ESCRITOR — habilidad completa, escrita como si fuera a producción.
//
// QUÉ IMPLEMENTA
//   Transporte con manos contadas. Con un montón más grande que las manos que
//   tiene, ordena qué se lleva primero según lo que DESBLOQUEA el paso
//   siguiente (no según lo que pesa), deja el resto en un acopio al que puede
//   volver, anota dónde y cuándo lo dejó, planifica cuántos viajes le da el
//   cuerpo, y acepta perder lo que no va a poder recuperar. Sobrevive a un
//   guardado: el estado del plan vive en `ctx.memory`, no en locales.
//
// QUÉ DECIDIÓ EL CRÍTICO
//   FALTA_API. Argumentó: (a) no hay `SelfView.capacity` —el «dos» de dos manos
//   sale de la cabeza del modelo—; (b) no hay `drop`, y el HUECO 9 deja sin
//   decir si `put(b, celda propia)` es soltar o apoyar-sobre; (c) el bloqueo
//   duro es contrafáctico: «¿serviría esto para un rol?» no se puede preguntar,
//   porque `ctx.can` verifica roles Y arrangement juntos, y los cuatro procesos
//   exigen `held` o `within:1`, así que sobre algo tirado en el piso `can()`
//   siempre da que no; (d) falta `SelfView.stamina` para saber si le da otro
//   viaje.
//
// QUÉ ENCONTRÓ EL COMPILADOR — ver HALLAZGOS al pie.
//   El punto (c) del crítico es correcto en la semántica y FALSO en el
//   compilador, y la diferencia importa mucho más que la capacidad: `ctx.can`
//   acepta `Record<string, BodyView>`, o sea que los nombres de rol NO ESTÁN
//   TIPADOS. `ctx.can('union', { binder: b })` compila con roles incompletos, y
//   `ctx.apply('extraccion', { gera: caña, fuente: agua })` compila con los
//   nombres mal escritos. El único vocabulario cerrado que protege a `apply` es
//   el ProcessId; los roles son texto libre. Eso convierte cada typo de rol en
//   un fallo de RUNTIME dentro del sandbox, y se come una parte del presupuesto
//   de «reparaciones deterministas» del Hito 8.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

/** Lo que cuesta ir y volver, en ticks, más el manoseo de cargar y soltar. */
function costoDelViaje(desde: Cell, hasta: Cell, bultos: number): number {
  return chebyshev(desde, hasta) * 2 * 2 + bultos * 4
}

interface PlanDeAcarreo {
  readonly acopio: Cell
  readonly destino: Cell
  readonly pendientes: readonly string[]
  readonly viajesHechos: number
  readonly dejadoEnTick: number
}

export function* decidirQueDejaAtras(
  ctx: Ctx,
  args: { monton: readonly BodyView[]; destino: Cell; para: 'union' | 'extraccion' },
): Generator<Intent, Outcome, StepResult> {
  // ─── FASE 1 · cuánto me entra en las manos ────────────────────────────────
  ctx.phase('medir-las-manos')

  // HUECO 5 / FALTA_API: `holding` es `readonly BodyView[]` sin tope declarado.
  // Sin esto, cada habilidad que acarrea escribe `const MANOS = 2` y la
  // constante del CUERPO termina viviendo en cuarenta archivos que escribió el
  // modelo y que nadie puede migrar.
  const manos = ctx.self.capacity
  const librres = manos - ctx.self.holding.length

  // ─── FASE 2 · ordenar por lo que desbloquea ───────────────────────────────
  // «Qué me llevo primero» no es «qué pesa menos»: es «qué me deja hacer la
  // cosa siguiente». Esa es la pregunta contrafáctica, y es la que la API no
  // responde bien.
  ctx.phase('ordenar-el-monton')

  const portables = args.monton.filter((b) => ctx.q(b, 'portable') > 0)
  if (portables.length === 0) return fail('nada de esto se puede levantar')

  const evaluados = portables.map((b) => {
    // Esto COMPILA, y no debería significar lo que parece: `can` juzga roles y
    // arrangement contra el mundo, y el arrangement de `union` es `held`. Con
    // el cuerpo tirado en el piso el veredicto es siempre `false`, así que la
    // pregunta contrafáctica devuelve la respuesta correcta a OTRA pregunta.
    const sirveComoLigadura = ctx.can('union', { binder: b }).ok
    const sirveComoAparejo = ctx.can('extraccion', { gear: b }).ok

    // El único predicado contrafáctico honesto que la superficie permite es
    // leer cualidades a mano — que es el SCHEMA_INDEX (riesgo 3 del documento,
    // mano humana admitida) copiado adentro de una habilidad.
    const pareceLigadura = ctx.q(b, 'flexibility') >= 0.8 && ctx.q(b, 'tensile') >= 0.3
    const pareceVara = ctx.q(b, 'rigidity') >= 0.5 && ctx.q(b, 'reach') >= 2

    const desbloquea =
      args.para === 'union'
        ? sirveComoLigadura || pareceLigadura
        : sirveComoAparejo || pareceVara

    // SONDA del HALLAZGO 1, dejada a propósito: los nombres de rol son texto
    // libre. Esta intención se construye con los roles MAL ESCRITOS («gera» por
    // «gear», «fuente» por «source») y el compilador no dice nada. No se
    // entrega con `yield`: está acá sólo como evidencia.
    const conRolesMalEscritos = ctx.apply('extraccion', { gera: b, fuente: b })
    void conRolesMalEscritos

    return { b, desbloquea, masa: ctx.q(b, 'mass'), pudre: ctx.q(b, 'decay') }
  })

  // Primero lo que desbloquea; después lo que se pudre antes; después lo liviano.
  const orden = [...evaluados].sort(
    (x, y) =>
      Number(y.desbloquea) - Number(x.desbloquea) || y.pudre - x.pudre || x.masa - y.masa,
  )

  const seLleva = orden.slice(0, Math.max(0, librres))
  const seQueda = orden.slice(Math.max(0, librres))

  // ─── FASE 3 · dejar el resto donde pueda volver ───────────────────────────
  ctx.phase('armar-acopio')
  const acopio: Cell = { x: ctx.self.at.x, y: ctx.self.at.y }

  for (const u of seQueda) {
    if (!ctx.self.holding.some((h) => h.id === u.b.id)) continue
    // HUECO 9: no hay `drop`. Lo escribo como debería existir para que el
    // error quede a la vista, en vez de taparlo con `put` y fingir que está
    // dicho que `put(b, mi celda)` sea soltar y no apoyar-sobre.
    const d = yield ctx.drop(u.b)
    if (d.status !== 'done') return fail('no pude soltarlo')
  }

  const plan: PlanDeAcarreo = {
    acopio,
    destino: args.destino,
    pendientes: seQueda.map((u) => u.b.id),
    viajesHechos: 0,
    dejadoEnTick: ctx.tick,
  }
  ctx.memory.set<PlanDeAcarreo>('plan', plan)

  // ─── FASE 4 · el primer viaje ─────────────────────────────────────────────
  ctx.phase('cargar')
  for (const u of seLleva) {
    const ir = yield ctx.goTo(u.b, { within: 1 })
    if (ir.status !== 'arrived') continue
    const t = yield ctx.take(u.b)
    if (t.status !== 'done') return fail('no pude levantarlo')
  }

  ctx.phase('viaje')
  const ida = yield ctx.goTo(args.destino)
  if (ida.status !== 'arrived') return fail('no llegué al destino')
  for (const u of seLleva) {
    const p = yield ctx.put(u.b, args.destino)
    if (p.status !== 'done') return fail('no pude dejarlo')
  }

  // ─── FASE 5 · ¿vuelvo, o lo doy por perdido? ──────────────────────────────
  // Acá es donde la capacidad deja de ser «acarrear» y empieza a ser una
  // decisión: aceptar una pérdida en vez de hacer un viaje que no puedo pagar.
  ctx.phase('decidir-si-vuelvo')

  const guardado = ctx.memory.get<PlanDeAcarreo>('plan')
  if (!guardado || guardado.pendientes.length === 0) return done()

  // HUECO 5: sin stamina propia no hay presupuesto, y sin presupuesto no hay
  // «lo doy por perdido»: hay «lo intento y me quedo seca a mitad de camino».
  const fuerza = ctx.self.stamina
  const precio = costoDelViaje(args.destino, guardado.acopio, guardado.pendientes.length)
  if (fuerza < precio) {
    ctx.say('lo que dejé se queda ahí')
    return done()
  }

  // ¿El acopio todavía existe, o la ley 6 se lo comió mientras yo caminaba?
  // HUECO 6: `PlaceMemory` es `{ at }` y nada más. Sin `atTick` un recuerdo de
  // hace 20.000 ticks es indistinguible de uno de hace tres, y con el legado
  // eso significa una segunda vida creyendo en un montón que ya se pudrió.
  const recuerdos = ctx.recall([{ q: 'mass', op: '>', v: 0 }])
  const elMío = recuerdos.find((r) => r.at.x === guardado.acopio.x && r.at.y === guardado.acopio.y)
  const antigüedad = elMío ? ctx.tick - elMío.atTick : Number.POSITIVE_INFINITY
  if (antigüedad > 3000) return fail('el acopio es un recuerdo viejo')

  ctx.phase('volver-por-el-resto')
  const vuelta = yield ctx.goTo(guardado.acopio)
  if (vuelta.status !== 'arrived') return fail('no pude volver al acopio')

  ctx.memory.set<PlanDeAcarreo>('plan', { ...guardado, viajesHechos: guardado.viajesHechos + 1 })
  return done()
}

// ─── HALLAZGOS ──────────────────────────────────────────────────────────────
//
// 1. HALLAZGO PRINCIPAL, y no es de esta capacidad sino de la superficie
//    entera: LOS NOMBRES DE ROL NO ESTÁN TIPADOS. `can(p, roles)` y
//    `apply(p, roles)` toman `Record<string, BodyView>`, así que
//    `ctx.can('union', { binder: b })` compila con roles faltantes y
//    `ctx.apply('extraccion', { gera: x, fuente: y })` compila con los nombres
//    mal escritos. `ProcessId` es un vocabulario cerrado y sus roles no.
//    Consecuencia: el arnés de compilación —que es el filtro barato del Hito 8—
//    no atrapa la clase de error más obvia que va a cometer un modelo que
//    escribe procesos de memoria. Se arregla con un mapa de tipos
//    `RolesOf<P extends ProcessId>` y no cuesta física.
//
// 2. El crítico dijo que el bloqueo duro era el contrafáctico. Matizo: el
//    contrafáctico COMPILA (por el hallazgo 1) y devuelve una respuesta
//    equivocada en silencio, que es peor que no compilar. `can()` con el objeto
//    en el piso responde «no» por arrangement, no por rol, y la habilidad no
//    tiene forma de distinguir las dos negativas. Este caso no es FALTA_API
//    limpio: es FALTA_API + una trampa de «compila y miente».
//
// 3. Confirmo tres huecos como errores de tipo duros: `SelfView.capacity`,
//    `ctx.drop` y `SelfView.stamina`. Y agrego uno que el crítico no marcó como
//    mecánico: `PlaceMemory.atTick` (HUECO 6). Sin él, «volver a buscarlo antes
//    de que se pase» es inexpresable en CUALQUIER habilidad, no sólo en ésta.
//
// 4. Confirmo el matiz del crítico sobre el HUECO 9 y lo empeoro un poco:
//    `ctx.put(b, ctx.self.at)` tipa —lo verifica borradores/t2/26— pero
//    `put(b, at, { onTopOf })` es la MISMA firma que apoyar-sobre-la-parrilla
//    de la ley 5. Soltar y apoyar son el mismo verbo con un opcional distinto,
//    y ninguna habilidad puede saber cuál de los dos hizo. Un `drop` explícito
//    no es azúcar: es la única forma de que la intención sea legible.
//
// 5. Lo que sí sale ya, y conviene decirlo para que el veredicto no exagere:
//    el orden de prioridad multi-criterio, la aritmética de costo de viaje, el
//    plan serializado en `ctx.memory` (que es la única sede que sobrevive al
//    guardado), la re-entrada por `ctx.phase` y `put` en el destino compilan
//    sin agregar nada.
