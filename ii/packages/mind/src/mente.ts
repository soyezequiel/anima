// ─── @anima/mind/mente.ts ────────────────────────────────────────────────────
//
// DONDE LA ESCALERA SE VUELVE CUERPO. `escalera.ts` decide y no toca nada: acá
// se traduce lo que decidió a una de las quince innatas y se le pide a la
// `Partida` que la ponga en vuelo. **La mente no llama a `stepWorld` ni una vez**
// — quien avanza el mundo es la `Partida`, y quien decide es la escalera; este
// archivo es la junta entre las dos, y nada más.
//
// Seis decisiones viven acá, y las tres primeras cambian dónde vive el trabajo.
//
// ─── 1. LA VISTA DE LA MENTE ES EL `Ctx` DE PRODUCCIÓN ──────────────────────
//
// `VistaDelPlan` —o sea `VistaDeLaMente`— es `see/recall/q/qAt/self/clock`, y eso
// es EXACTAMENTE un subconjunto estructural del `Ctx` que `@anima/perceive`
// construye para cada habilidad en vuelo. Así que la mente no se fabrica una
// proyección propia: construye UN `Contexto` (el de producción, exportado) por
// criatura y por partida, y lo refresca en su lugar cuando la `Partida` cambia
// de proyección.
//
// La alternativa —un adaptador de veinte líneas sobre `Proyeccion`— sería una
// SEGUNDA implementación de `see`, `q` y `qAt`. Y no serían dos escrituras
// equivalentes: `Contexto.#see` filtra con `qualityOf` sobre `state.bodies` y
// recorta por `RADIO_DE_PERCEPCION`, y una copia que se olvidara del radio le
// haría ver a la mente cosas que la habilidad que va a correr NO ve. Un
// planificador que planifica sobre cuerpos que el ejecutor no encuentra produce
// planes que se caen en el primer paso, y se caen adentro del mundo.
//
// El costo hay que decirlo: es un `Contexto` más por criatura —el de la mente—
// además del que `Partida.volar` arma por vuelo. No comparte `memory` con
// ninguno (nunca se le instala), y su `rng` es el dado de la partida, que la
// mente no tira nunca.
//
// ─── 2. LOS `Ref` SE RESUELVEN ANTES DE VOLAR, Y ESO ES LO QUE HACE ─────────
// ─── OBSERVABLE QUE EL PLAN ENVEJECIÓ ───────────────────────────────────────
//
// `@anima/plan` lo dice en su decisión 1: un plan no puede guardar un `BodyView`,
// nombra con `Ref`, y `resolver` contesta `undefined` cuando lo que el plan
// nombraba ya no está. Ese `undefined` **no es un error**: es la señal de que el
// mundo se movió abajo del plan.
//
// Si la resolución pasara adentro de la habilidad —construyendo los argumentos
// desde su propio `ctx`, que es lo que hace `perceive/tests/las-quince.test.ts`—
// esa señal se convertiría en un `fail('no veo la vara')` de la innata, y la
// escalera lo contaría como «un paso falló», que es lo mismo que cuenta cuando
// el mundo rechaza. Son dos cosas distintas y se arreglan distinto: un paso que
// falla se lleva el plan; un `Ref` que no resuelve se lleva el plan Y no gasta un
// tick de mundo pidiéndole al ejecutor algo imposible.
//
// Así que se resuelve acá, con la vista de HOY —la misma que la habilidad va a
// ver, porque el vuelo arranca en este mismo tick— y si algo no resuelve no
// despega nada: `aterrizar(e, false)` tira el plan y D4 replanifica el tick que
// viene. Lo que se paga es un tick, y es el precio correcto.
//
// ─── 3. UNA POR ACTOR: CORTAR ES PARTE DE VOLAR ─────────────────────────────
//
// `Partida.volar` LANZA si el actor ya tiene una habilidad viva, y no por
// prolijidad: `SkillRun` numera sus intenciones desde cero por corrida, así que
// dos corridas del mismo actor emiten las dos `seq: 0` y `stepWorld` rechaza a
// las dos con `orden-duplicado`. Por eso `volar` y `plan` quieren decir «cortá lo
// que esté volando y poné esto», que es la decisión 3 de `escalera.ts`.
//
// Y el corte va ANTES de traducir, aunque traducir pueda fallar. Es deliberado:
// cuando la escalera devuelve `volar` o `plan` ya sobrescribió `e.enVuelo`, o sea
// que YA se olvidó de lo que estaba haciendo. Dejar vivo un vuelo del que el
// estado de la mente no lleva cuenta es peor que perder un tick: el mundo
// seguiría ejecutando un paso que nadie va a aterrizar, y el `#recogerVuelo` del
// tick siguiente lo cobraría contra un plan que ya es otro.
//
// ─── 4. EL ORDEN EN QUE PIENSAN LAS MENTES SALE DEL ID, NO DEL `Map` ────────
//
// `vivir` ordena las mentes por `ActorId` antes de pensar. Un `ReadonlyMap` se
// recorre en orden de inserción, y el orden de inserción es de quien armó el
// mapa: dos llamadores que arman el mismo conjunto de mentes en distinto orden
// avanzarían los generadores en distinto orden, y eso **es observable desde el
// mundo** — `Partida.#tirar` escribe el dado en `state.dios`, así que la primera
// habilidad que tire el dado le corre la suerte a las demás y el hash de la
// partida se mueve. Es el mismo argumento con el que `Partida.tick` deja estable
// su fase 1.
//
// ─── 5. LA MUERTE NO ES UNA EXCEPCIÓN ───────────────────────────────────────
//
// ADR II-0009: la criatura que se queda sin `stamina` se va de `state.actors` y
// la `Partida` aborta su vuelo sola. `vivir` no le pide que piense —no hay nadie
// a quien pedírselo— y `pensar` sobre una criatura que ya no está contesta
// `abortar` sin tocar el reloj de la escalera ni pedirle nada a la vista. El
// bucle sigue con las demás, que es lo que el criterio del Hito 5 necesita para
// poder medir una corrida larga con varias criaturas.
//
// ─── 6. LO QUE NO HACE, Y ESTÁ MEDIDO ───────────────────────────────────────
//
// **La mente no le devuelve evidencia a las creencias.** `AffordanceMemory` tiene
// `observe(ctx, rinde, ok)` y acá no se lo llama nunca: para llamarlo haría falta
// saber de qué contexto y de qué tag salió la meta que se acaba de cumplir, y eso
// hoy no viaja — `Decision` lleva la firma del predicado y el `porque` en prosa,
// no la `ContextKey` ni el tag. Consecuencia, medida en `tests/la-mente.test.ts`:
// una criatura que pesca sesenta veces sigue informando `n = 0` sobre el pozo.
// Queda como hueco con su `it.fails`, y la reparación es de `escalera.ts`
// —cargarle a la meta de dónde salió— y no de acá.

import type { QualityTest } from '@anima/physics'
import { Contexto } from '@anima/perceive'
import type { Partida, Proyeccion } from '@anima/perceive'
import type { GoalId, Ref, Rindes, VistaDelPlan } from '@anima/plan'
import { resolver, resolverCuerpo, resolverTodos } from '@anima/plan'
import type {
  ActorId,
  BodyView,
  Cell,
  CellQuality,
  Ctx,
  Intent,
  Outcome,
  RolesOf,
  SeedProcessId,
  StepResult,
  Where,
} from '@anima/skills'
import { SEED_PROCESS_IDS } from '@anima/skills'
import {
  aplicarProceso,
  comer,
  construir,
  deshilachar,
  esperar,
  explorar,
  frotar,
  guarecerse,
  huirDelDolor,
  ir,
  juntar,
  poner,
  sostener,
  unir,
} from '@anima/skills/innatas'

import { aterrizar, avanzarReloj, decidir, nuevoEstado } from './escalera.js'
import type { EstadoDeLaEscalera } from './escalera.js'
import type { Decision, Intencion, MenteOptions } from './tipos.js'

// ─── La traducción ───────────────────────────────────────────────────────────

/** El cuerpo de una habilidad ya armada, lista para que la `Partida` la vuele. */
export type Correr = (ctx: Ctx) => Generator<Intent, Outcome, StepResult>

/**
 * Una intención convertida en habilidad, con todo lo que hacía falta resolver ya
 * resuelto.
 *
 * `nombre` no es decoración: es lo único que queda escrito de qué se puso a
 * volar, y es lo que la corrida larga imprime para que el 100% de cobertura de
 * D5 no sea un número sin historia detrás.
 */
export interface Traduccion {
  readonly nombre: string
  readonly correr: Correr
  /** Bajo qué llave se anota lo que rinda, si el paso anuncia una. */
  readonly rinde?: GoalId
}

function traduccion(nombre: string, correr: Correr, rinde?: GoalId): Traduccion {
  // Campo por campo y no con un spread del opcional: con
  // `exactOptionalPropertyTypes` un `rinde: undefined` explícito no es lo mismo
  // que la clave ausente, y viajaría hasta el `Map` de rendimientos.
  return rinde === undefined ? { nombre, correr } : { nombre, correr, rinde }
}

/**
 * DE UNA INTENCIÓN A UNA INNATA. Es el corazón de este archivo.
 *
 * Cada variante de `Step` corresponde a exactamente una de las quince, y las dos
 * `Conducta` que la escalera emite —`huir` y `guarecerse`— a las dos que el
 * planificador no sabe nombrar. Doce ramas, `switch` exhaustivo, y ni una
 * segunda resolución de `Ref`: se llama a `resolver`/`resolverCuerpo`/
 * `resolverTodos` de `@anima/plan`, que son los que el planificador ya usó para
 * decidir que el paso era posible.
 *
 * `undefined` quiere decir **el plan envejeció**: algo que el paso nombraba ya no
 * está a la vista. No es un error (decisión 2 del encabezado).
 *
 * Las tres que faltan de las quince y por qué no están:
 *
 *   `tantear`   percepción activa. Ningún peldaño la pide todavía, y `Step` no la
 *               tiene: entra el día que haya un objetivo que la necesite.
 *   `esperar`   la escalera no la emite: D5 deambula en vez de esperar, porque
 *               deambular es lo único que no le pide NADA al mundo.
 *   `seguirOrdenDeMovimiento`  es del Hito 6, cuando el chat mande a caminar.
 */
export function aHabilidad(i: Intencion, v: VistaDelPlan, rindes?: Rindes): Traduccion | undefined {
  switch (i.k) {
    case 'ir': {
      // `resolver` y no `resolverCuerpo`: `ir` acepta una celda, y una celda es
      // la única forma de `Ref` que no rinde un cuerpo.
      const a = resolver(i.a, v, rindes)
      if (a === undefined) return undefined
      const args: { a: BodyView | Cell; within?: number } = { a }
      if (i.within !== undefined) args.within = i.within
      return traduccion(`ir(${corto(i.a)})`, (ctx) => ir(ctx, args))
    }

    case 'juntar': {
      // `Where` y no `Ref`: junta lo que cumpla, no lo que se fichó. No hay nada
      // que se pueda quedar viejo, así que nunca devuelve `undefined`.
      const args = { que: i.que, cuantos: i.cuantos }
      return traduccion(`juntar×${String(i.cuantos)}`, (ctx) => juntar(ctx, args))
    }

    case 'deshilachar': {
      const fuente = resolverCuerpo(i.fuente, v, rindes)
      if (fuente === undefined) return undefined
      const args = { fuente, cuantas: i.cuantas }
      return traduccion(`deshilachar(${corto(i.fuente)})`, (ctx) => deshilachar(ctx, args), i.rinde)
    }

    case 'unir': {
      const binder = resolverCuerpo(i.binder, v, rindes)
      const a = resolverCuerpo(i.a, v, rindes)
      if (binder === undefined || a === undefined) return undefined
      // `b` es OPCIONAL y la diferencia es la pesca entera: sin `b`, el atador
      // sobrevive con una punta suelta, y esa punta es lo único que da `catch`.
      // Que esté ausente es legal; que esté nombrada y no resuelva, no.
      const b = i.b === undefined ? undefined : resolverCuerpo(i.b, v, rindes)
      if (i.b !== undefined && b === undefined) return undefined
      const args: { binder: BodyView; a: BodyView; b?: BodyView } =
        b === undefined ? { binder, a } : { binder, a, b }
      return traduccion(`unir(${corto(i.binder)}+${corto(i.a)})`, (ctx) => unir(ctx, args), i.rinde)
    }

    case 'aplicar': {
      const proceso = i.proceso
      // `Step.proceso` es `ProcessId`, o sea `string`: el planificador se indexa
      // sobre esquemas escritos a mano y nada le impide nombrar un proceso que la
      // superficie no tipa. `aplicarProceso` sólo sabe de los cuatro de la
      // semilla, así que se pregunta antes en vez de castear y descubrirlo adentro
      // del mundo con `proceso-desconocido`.
      if (!esDeLaSemilla(proceso)) return undefined
      const roles = resolverTodos(i.roles, v, rindes)
      if (roles === undefined) return undefined
      const args = {
        proceso,
        // El único cast del archivo. `resolverTodos` contesta un registro de
        // nombre a `BodyView` —no puede contestar otra cosa: lee las claves que
        // el paso trae— y `RolesOf` es ese mismo registro con los nombres del
        // catálogo. Quien verifica de verdad que los roles alcanzan es `ctx.can`,
        // adentro de la innata, contra el catálogo y no contra este tipo.
        roles: roles as RolesOf<SeedProcessId>,
      }
      return traduccion(`aplicar(${proceso})`, (ctx) => aplicarProceso(ctx, args), i.rinde)
    }

    case 'comer': {
      const bocado = i.bocado === undefined ? undefined : resolverCuerpo(i.bocado, v, rindes)
      if (i.bocado !== undefined && bocado === undefined) return undefined
      // Sin bocado, `comer` lo elige sola —lo de la mano primero, después lo que
      // ve—: es la rama que hace que un plan pueda decir «comé» sin saber qué.
      const args: { bocado?: BodyView } = bocado === undefined ? {} : { bocado }
      return traduccion(i.bocado === undefined ? 'comer' : `comer(${corto(i.bocado)})`, (ctx) => comer(ctx, args))
    }

    case 'frotar': {
      const a = resolverCuerpo(i.a, v, rindes)
      const b = resolverCuerpo(i.b, v, rindes)
      if (a === undefined || b === undefined) return undefined
      const args: { a: BodyView; b: BodyView; hasta?: number } = { a, b }
      if (i.hasta !== undefined) args.hasta = i.hasta
      return traduccion(`frotar(${corto(i.a)}×${corto(i.b)})`, (ctx) => frotar(ctx, args))
    }

    case 'poner': {
      const que = resolverCuerpo(i.que, v, rindes)
      if (que === undefined) return undefined
      // `en` es un lugar y `Ref` puede nombrarlo de dos maneras: la celda escrita,
      // o un cuerpo que está ahí. Las dos se aceptan y la segunda se lee como «al
      // lado de eso», que es lo que `poner` entiende.
      const donde = resolver(i.en, v, rindes)
      if (donde === undefined) return undefined
      const en: Cell = 'at' in donde ? donde.at : donde
      const sobre = i.sobre === undefined ? undefined : resolverCuerpo(i.sobre, v, rindes)
      if (i.sobre !== undefined && sobre === undefined) return undefined
      const tapando = i.tapando === undefined ? undefined : resolverCuerpo(i.tapando, v, rindes)
      if (i.tapando !== undefined && tapando === undefined) return undefined
      const args: { que: BodyView; en: Cell; sobre?: BodyView; tapando?: BodyView } = { que, en }
      if (sobre !== undefined) args.sobre = sobre
      if (tapando !== undefined) args.tapando = tapando
      return traduccion(`poner(${corto(i.que)})`, (ctx) => poner(ctx, args))
    }

    case 'sostener': {
      const que = resolverCuerpo(i.que, v, rindes)
      if (que === undefined) return undefined
      const args = { que }
      return traduccion(`sostener(${corto(i.que)})`, (ctx) => sostener(ctx, args))
    }

    // ─── ARMAR UNA OBRA ─────────────────────────────────────────────────────
    //
    // El paso del ADR II-0023, y el unico del catalogo cuyo destinatario no es el
    // mundo sino una HABILIDAD. El plan dice QUE obra y con QUE cuerpos; la
    // habilidad encuentra el ORDEN de las uniones, que es lo que decide la forma.
    //
    // Los roles se resuelven TODOS antes de traducir: si falta uno, el plan
    // envejecio y se contesta `undefined` como en cualquier otro paso. Armar a
    // medias seria peor que no armar — `unir` no tiene inversa, asi que las piezas
    // que ya se ataron no se recuperan.
    case 'armar': {
      const cuerpos: Record<string, BodyView> = {}
      for (const rol of Object.keys(i.roles).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))) {
        const ref = i.roles[rol]
        if (ref === undefined) return undefined
        const cuerpo = resolverCuerpo(ref, v, rindes)
        if (cuerpo === undefined) return undefined
        cuerpos[rol] = cuerpo
      }
      const args = { juntas: i.juntas, roles: cuerpos }
      return traduccion(`armar(${i.revision.slice(0, 8)})`, (ctx) => construir(ctx, args), i.rinde)
    }

    // ─── EL PASO QUE NO PIDE NADA, Y ES EL QUE HACE QUE SE COCINE ────────────
    //
    // Una ley no se aplica: se le arma la situación y se espera, y `emitirLey`
    // pone acá el `mientras` de la fila. No hay ningún `Ref` que resolver —lo
    // único que este paso nombra son segundos— así que es la única rama del
    // `switch` que no puede contestar `undefined`: un plan no envejece por el
    // lado del reloj.
    //
    // ─── Y CON `hasta`, QUE ES LO QUE LE DEVUELVE EL FUEGO ───────────────────
    //
    // Acá decía «SIN `hasta` NI `mirando`, a propósito», y el porqué era cierto:
    // la cualidad y el umbral viven en el `establishes` de la fila y este archivo
    // no los despejaba. Ahora los despeja `@anima/plan` (`esperarPor` en
    // `regresion.ts`) y viajan en `Step.esperar.mirando`, así que lo único que
    // falta acá es resolver el `Ref` y armar el cierre.
    //
    // LO QUE COSTABA SER CIEGA, y no es lo que se había contado. El precio en
    // DESPERTADAS ya estaba medido y era barato: `segundos / pasoMinimo` = 15 /
    // 0,25 = 60 en los 300 ticks. El precio que faltaba contar está en SEGUNDOS DE
    // FUEGO: el pescado sobre la brasa está cocido a los **5 s** y la fila hace
    // esperar **15**, y el fuego se apaga a los **20**. O sea que la espera se
    // llevaba tres cuartos del fuego para nada y la segunda pieza habría empezado a
    // cocinarse con la brasa apagada.
    //
    // `hasta` SÍ Y `mirando` NO, Y ESTO SE PROBÓ DE LAS DOS MANERAS. La innata
    // tiene los dos parámetros: `hasta` es la condición y `mirando` sirve para
    // elegir CUÁNDO volver a mirar —divide lo que falta por `rateOf` y duerme casi
    // todo de una vez—. Pasar `mirando` parece gratis y no lo es: la innata falla
    // con «lo que espero no está pasando» si `rateOf` de la cualidad mirada es cero,
    // y `rateOf` es la tasa del tick PASADO (`perceive/src/contexto.ts` lo dice).
    //
    // Medido en la corrida de la contraprueba, con `mirando: digestibility>=0,85`:
    //
    //     t151  poner(el pescado sobre la brasa)     el pescado está a 13,61 °C
    //     t153  esperar(15s)  →  ok:false, «la tasa es cero o va al revés»
    //     t155…157  el pescado cruza sus 55 °C de `denaturesAt` y la ley 5 arranca
    //
    // O sea: la tasa es CERO con razón durante los primeros cuatro ticks, porque la
    // comida todavía se está calentando y la ley 5 no empezó. `mirando` mataba el
    // plan justo ahí y la criatura no cocinaba NUNCA (`cocinoEn` volvía a −1). La
    // guarda de la innata es correcta para lo que ella hace —esperar al lado de un
    // fuego apagado es tirar tiempo— y es la pregunta equivocada en el primer tick.
    //
    // Sin `mirando`, el muestreo vuelve al `pasoMinimo` de 0,25 s, o sea 5 ticks: 60
    // despertadas en el peor caso, que es el precio que ya estaba medido y es
    // barato. Lo que se gana es lo que importaba: cortar cuando la comida está
    // lista y no cuando se acaba la cota.
    //
    // Si el `Ref` no resuelve, la espera sale CIEGA y no `undefined`: es la única
    // rama del `switch` que no puede envejecer un plan por el lado del reloj, y ese
    // contrato no se toca por agregarle una condición. Ver el comentario de
    // `refsDe` en `escalera.ts`, que es la otra mitad del mismo argumento: el
    // sujeto está apoyado sobre el fuego durante toda la cocción y no en la mano.
    case 'esperar': {
      const nombre = `esperar(${String(i.segundos)}s)`
      const mirado = i.mirando
      const cuerpo = mirado === undefined ? undefined : resolverCuerpo(mirado.que, v, rindes)
      if (mirado === undefined || cuerpo === undefined) {
        const ciega = { segundos: i.segundos }
        return traduccion(nombre, (ctx) => esperar(ctx, ciega))
      }
      const tests = mirado.tests
      return traduccion(nombre, (ctx) =>
        esperar(ctx, {
          segundos: i.segundos,
          hasta: () => tests.every((t) => cumpleTest(ctx.q(cuerpo, t.q), t)),
        }),
      )
    }

    case 'explorar': {
      const args: {
        busco?: Where
        buscoEnLaCelda?: { q: CellQuality; op: '>=' | '<='; v: number }
        maxTicks: number
      } = { maxTicks: i.maxTicks }
      if (i.busco !== undefined) args.busco = i.busco
      if (i.buscoEnLaCelda !== undefined) args.buscoEnLaCelda = i.buscoEnLaCelda
      return traduccion(`explorar(${String(i.maxTicks)}t)`, (ctx) => explorar(ctx, args))
    }

    // Las dos primeras conductas no llevan parámetros, y es la decisión de
    // `tipos.ts`: los radios y los umbrales los pone cada innata por omisión,
    // medidos y comentados en su propio archivo. Escribirlos acá los cablearía dos
    // veces.
    case 'huir':
      return traduccion('huir', (ctx) => huirDelDolor(ctx, {}))

    case 'guarecerse':
      return traduccion('guarecerse', (ctx) => guarecerse(ctx, {}))

    // ─── Y LA TERCERA LLEVA EL ÚNICO NÚMERO QUE LA MENTE CALCULA ────────────
    //
    // Es la MISMA innata que el `case 'comer'` de arriba, y por eso las dos ramas
    // están en el mismo `switch` y no en dos lados: lo único que cambia es de
    // dónde sale `toxicidadTolerada`. Por `Step.comer` sale del 0,2 por omisión
    // de la habilidad —el planificador no tiene dónde escribirlo—; por `tragar`
    // sale de la cuenta que hizo `oportunidades.ts` sobre ESTE cuerpo y sobre
    // ESTE tanque (ADR II-0013).
    //
    // El bocado se resuelve con `resolverCuerpo` como cualquier otro `Ref`: si
    // entre que la mente decidió y el vuelo despega el cuerpo dejó de estar, no
    // despega nada. Comer algo que ya no está no es un fracaso de la habilidad.
    case 'tragar': {
      const bocado = resolverCuerpo(i.bocado, v, rindes)
      if (bocado === undefined) return undefined
      const args = { bocado, toxicidadTolerada: i.toxicidadTolerada }
      return traduccion(`tragar(${corto(i.bocado)})`, (ctx) => comer(ctx, args))
    }
  }
}

/** Si el proceso que el plan nombró es uno de los cuatro que la superficie tipa. */
function esDeLaSemilla(p: string): p is SeedProcessId {
  for (const x of SEED_PROCESS_IDS) if (x === p) return true
  return false
}

/**
 * Un `QualityTest` contra un número leído del mundo.
 *
 * Se escribe acá y no se importa de `@anima/plan` a propósito: lo que ese paquete
 * exporta (`cumple`, `cumpleCuerpo`) trabaja sobre `BodyView` y sobre la vista
 * CONGELADA del principio del tick, y lo que este cierre necesita es lo contrario
 * —el valor de AHORA, leído con `ctx.q`, que va al estado vivo—. Usar el de allá
 * haría que la espera preguntara siempre por el tick en que despegó y no cortara
 * nunca. Son cuatro operadores y son los cuatro de `QualityTest`.
 */
function cumpleTest(x: number, t: QualityTest): boolean {
  switch (t.op) {
    case '>=':
      return x >= t.v
    case '<=':
      return x <= t.v
    case '>':
      return x > t.v
    case '<':
      return x < t.v
  }
}

/** Cómo se lee un `Ref` en el nombre de una traducción. Exhaustivo sobre las cinco. */
function corto(r: Ref): string {
  switch (r.k) {
    case 'id':
      return r.id
    case 'celda':
      return `${String(r.at.x)},${String(r.at.y)}`
    case 'rinde':
      return `lo-de-«${r.de}»`
    case 'donde':
      return 'lo-más-cerca'
    case 'yo':
      return 'yo'
  }
}

/** Bajo qué llave se anota lo que rinda una intención. Sólo tres la anuncian. */
function llaveDe(i: Intencion): GoalId | undefined {
  switch (i.k) {
    case 'deshilachar':
    case 'unir':
    case 'aplicar':
      return i.rinde
    default:
      return undefined
  }
}

/** El nombre corto de una intención, para el informe de lo que no se pudo volar. */
function nombreDe(i: Intencion): string {
  return i.k === 'aplicar' ? `aplicar(${i.proceso})` : i.k
}

// ─── La mente ────────────────────────────────────────────────────────────────

/**
 * La mente de UNA criatura, montada sobre una `Partida`.
 *
 * No toca el mundo: le pide a la `Partida` que ponga una habilidad en vuelo. La
 * `Partida` sigue siendo la única que llama a `stepWorld`.
 */
export class Mente {
  readonly actor: ActorId
  readonly #o: MenteOptions
  readonly #e: EstadoDeLaEscalera = nuevoEstado()
  /**
   * Lo que rindió cada paso del plan EN CURSO, por `GoalId`.
   *
   * Es lo que hace resoluble `{k:'rinde', de}` —la ligadura diferida del ADR 0082
   * portado—: la caña que sale de `unir` no existía cuando el plan se armó, así
   * que el paso que la usa la nombra por el objetivo que la produjo.
   *
   * Se VACÍA con cada plan nuevo, y hace falta: los `GoalId` son firmas de
   * predicado, o sea que dos planes distintos para la misma meta usan las mismas
   * llaves. Una entrada vieja no se resolvería a `undefined` —que sería honesto—
   * sino a la caña de la vez pasada, que a esta altura `union` ya se comió.
   */
  readonly #rindes = new Map<GoalId, BodyView>()
  /** El `Ctx` de producción de esta mente. Ver la decisión 1 del encabezado. */
  #ctx: Contexto | undefined
  /** Contra qué proyección está apuntando `#ctx`, para refrescarlo una vez por tick. */
  #proy: Proyeccion | undefined
  #ultima: Decision | undefined
  #ultimoDespegue: string | undefined
  #tropiezo: string | undefined
  #despegues = 0

  constructor(o: MenteOptions) {
    this.#o = o
    this.actor = o.actor
  }

  /** El estado de la escalera. Se expone para el informe y para el test, no para escribirlo. */
  get estado(): EstadoDeLaEscalera {
    return this.#e
  }

  /** Lo último que decidió. `undefined` antes del primer tick. */
  get ultima(): Decision | undefined {
    return this.#ultima
  }

  /**
   * Por qué la última decisión NO despegó, si no despegó. `undefined` cuando sí.
   *
   * Existe porque una decisión que no llega al mundo es invisible desde afuera:
   * `pensar` devuelve lo que la ESCALERA decidió, y si la traducción se cayó, la
   * `Decision` sigue diciendo «plan» aunque no haya nada volando. Sin este campo,
   * la única forma de enterarse sería que la corrida no avanzara.
   */
  get tropiezo(): string | undefined {
    return this.#tropiezo
  }

  /** Cuántas habilidades puso en vuelo. Es el denominador de todo informe de cobertura. */
  get despegues(): number {
    return this.#despegues
  }

  /**
   * El nombre de lo último que despegó, con sus argumentos ya resueltos.
   *
   * Es lo que el Hito 7 va a leer para decir qué innatas se ejecutaron de verdad
   * —«solo se acredita lo que efectivamente se ejecutó»—, y lo que hace que una
   * corrida de 2000 ticks se pueda contar en una línea por vuelo en vez de en una
   * por tick. Se escribe SOLO cuando `Partida.volar` no lanzó.
   */
  get ultimoDespegue(): string | undefined {
    return this.#ultimoDespegue
  }

  /**
   * Decide y, si hace falta, pone algo en vuelo. Se llama una vez por tick.
   *
   * El orden de las cuatro cosas que hace no es negociable:
   *
   *   1. **aterrizar** lo que terminó, con lo que le contestó el mundo. Antes de
   *      decidir, porque D1 mira `e.enVuelo` para contestar `seguir`.
   *   2. **avanzar el reloj** de la mente, una vez por tick y antes de decidir
   *      (decisión 4 de `escalera.ts`: la vista no publica ningún número de tick).
   *   3. **decidir**.
   *   4. **ejecutar**: cortar lo que vuele y poner lo que salió.
   */
  pensar(p: Partida): Decision {
    if (!p.state.actors.has(this.actor)) {
      // ADR II-0009. No se avanza el reloj ni se le pregunta nada a la vista: una
      // criatura que no está en `state.actors` no tiene `self`, y `Contexto` le
      // devolvería la vista muerta —`stamina: 0`, `at: (0,0)`— que es exactamente
      // la clase de dato con el que una escalera decide caminar hacia el origen.
      //
      // Sale por `D0` porque es el peldaño que corre primero y el único que puede
      // cortar todo sin mirar nada más, y `abortar` porque eso es literalmente lo
      // que pasó: se cortó lo que había y no se puso nada. Ninguno de los seis
      // peldaños corrió, así que sus contadores no se mueven.
      const d: Decision = { k: 'abortar', por: 'D0', porque: 'ya no estoy en el mundo' }
      this.#ultima = d
      this.#tropiezo = undefined
      return d
    }

    this.#recoger(p)
    const v = this.#vista(p)
    avanzarReloj(this.#e)
    const d = decidir(v, this.#e, this.#o)
    this.#ejecutar(p, v, d)
    this.#ultima = d
    return d
  }

  // ─── Las cuatro piezas ────────────────────────────────────────────────────

  /**
   * El `Ctx` de esta mente, apuntando a la proyección de HOY.
   *
   * Se construye una vez por partida y se REFRESCA EN SU LUGAR, que es el mismo
   * contrato que `Partida.tick` cumple con los contextos de los vuelos: un
   * contexto nuevo por tick asignaría uno por criatura y por tick, y encima
   * perdería el `#antes` del que sale `rateOf`.
   */
  #vista(p: Partida): VistaDelPlan {
    let c = this.#ctx
    if (c === undefined) {
      c = new Contexto(p.proyeccion, {
        actor: this.actor,
        // El dado DEL MUNDO, no uno propio: es la ranura que el snapshot guarda
        // (ver `Partida.dado`). Esta mente no lo tira nunca —ninguna de las
        // quince innatas usa `ctx.rng`— pero entregarle otro sería preparar el
        // día en que sí, con la suerte partida en dos.
        rng: p.dado.tirar,
        lugares: p.lugares,
      })
      this.#ctx = c
    } else if (this.#proy !== p.proyeccion) {
      c.refrescar(p.proyeccion)
    }
    this.#proy = p.proyeccion
    return c.ctx
  }

  /**
   * El vuelo que terminó, cobrado contra el estado de la escalera.
   *
   * Lo que rindió se anota bajo la llave que el paso anunció, y se anota SOLO si
   * salió bien: un `unir` que falló no dejó ninguna caña, y anotar la de la vez
   * pasada haría que el paso siguiente nombrara un cuerpo que no se hizo.
   */
  #recoger(p: Partida): void {
    const era = this.#e.enVuelo
    if (era === undefined) return
    const vuelo = p.vuelo(this.actor)
    if (vuelo === undefined || !vuelo.terminado) return

    const o = vuelo.outcome
    const ok = o !== undefined && o.ok
    let rindio: string | undefined
    if (ok) {
      const llave = llaveDe(era)
      const got = o.got
      if (got !== undefined) {
        rindio = got.id
        if (llave !== undefined) this.#rindes.set(llave, got)
      }
    }
    // El id de lo que rindió viaja a la escalera SIEMPRE que haya rendido algo, y
    // no sólo cuando el paso anunció una llave. Son dos usos distintos del mismo
    // dato: `#rindes` resuelve `{k:'rinde'}` DENTRO del plan —y para eso hace
    // falta la llave—, y `aterrizar` lo usa para acordarse de que la meta se
    // consiguió, que es lo único que hoy sabe contestar por `holding(tag:…)` (ver
    // `EstadoDeLaEscalera.conseguido`). El último paso de un plan casi nunca
    // anuncia llave, porque nadie de más abajo lo iba a nombrar, y es justo ése
    // el que cierra la meta.
    aterrizar(this.#e, ok, rindio)
  }

  /** Las cuatro clases de `Decision`, con lo que cada una le pide al ejecutor. */
  #ejecutar(p: Partida, v: VistaDelPlan, d: Decision): void {
    switch (d.k) {
      case 'seguir':
        // No se toca nada. Es la respuesta más común y la más barata.
        this.#tropiezo = undefined
        return
      case 'abortar':
        this.#cortar(p, d.porque)
        this.#tropiezo = undefined
        return
      case 'volar':
        this.#poner(p, v, d.paso)
        return
      case 'plan': {
        // Plan nuevo, rendimientos viejos a la basura. Ver `#rindes`.
        this.#rindes.clear()
        const primero = d.pasos[0]
        // Un plan sin pasos no llega hasta acá —`arrancarPlan` no lo emite— pero
        // el tipo no lo dice y descubrirlo con un `undefined` adentro del switch
        // de la traducción sería peor que contestarlo acá.
        if (primero === undefined) {
          this.#tropiezo = 'la escalera anunció un plan sin pasos'
          return
        }
        this.#poner(p, v, primero)
        return
      }
    }
  }

  /** Corta lo que esté volando. Es idempotente: un vuelo terminado no se corta dos veces. */
  #cortar(p: Partida, porque: string): void {
    const vuelo = p.vuelo(this.actor)
    if (vuelo !== undefined && !vuelo.terminado) vuelo.abortar(porque)
  }

  /**
   * Cortar, traducir y despegar. En ese orden, y el porqué está en la decisión 3.
   *
   * Si la traducción se cae, no despega nada y el plan se tira con
   * `aterrizar(e, false)`: es exactamente lo que hace un paso que el mundo
   * rechazó, porque el efecto sobre el plan es el mismo —los pasos están
   * encadenados por `{k:'rinde'}` y seguir con el siguiente sería ejecutar un
   * plan que nombra algo que no se hizo—.
   */
  #poner(p: Partida, v: VistaDelPlan, i: Intencion): void {
    this.#cortar(p, 'la mente cambió de idea')
    const t = aHabilidad(i, v, this.#rindes)
    if (t === undefined) {
      this.#tropiezo = `${nombreDe(i)}: el plan nombraba algo que ya no está`
      aterrizar(this.#e, false)
      return
    }
    this.#tropiezo = undefined
    p.volar(this.actor, t.correr, undefined)
    // Después de `volar` y no antes: si lanzara —el actor ya tiene algo vivo, o
    // sea que el corte de arriba no cortó— el contador diría que despegó algo que
    // no despegó, y ese número es el denominador de todo informe de cobertura.
    this.#despegues += 1
    this.#ultimoDespegue = t.nombre
  }
}

// ─── El bucle ────────────────────────────────────────────────────────────────

/** Lo que una corrida deja. Todo número del criterio del Hito 5 sale de acá. */
export interface Vida {
  /** Cuántos ticks avanzó EL MUNDO durante esta corrida. No es `n` si alguno falló. */
  readonly ticks: number
  /** Cuántos se perdieron durante esta corrida. Ver la definición en `perceive/bucle.ts`. */
  readonly ticksPerdidos: number
  /** Cuántas de estas mentes siguen teniendo criatura al final. */
  readonly vivos: number
}

/**
 * Corre `n` ticks con estas mentes puestas. Es el bucle del criterio del Hito 5.
 *
 * Las dos fases del tick, en este orden y no en otro: **primero piensan todas,
 * después avanza el mundo**. Es el mismo orden que el mundo ya escribió para las
 * habilidades —«la criatura actúa sobre el mundo que vio, no sobre el que quedó
 * después de que la física se moviera»—: si una mente pensara después de que el
 * mundo avanzó, decidiría sobre un tick y actuaría sobre el siguiente.
 *
 * Los tres números son DIFERENCIAS y no totales de la `Partida`: `vivir` se puede
 * llamar dos veces sobre la misma partida —así se escribe «viví cien ticks, mirá
 * el mundo, viví cien más»— y un contador acumulado haría que la segunda llamada
 * informara los ticks de la primera.
 */
export function vivir(
  p: Partida,
  mentes: ReadonlyMap<ActorId, Mente>,
  n: number,
): Vida {
  // Orden TOTAL y ESTABLE por id, y no el del `Map`. Ver la decisión 4. Se
  // compara con `<` y no con `localeCompare`: regla 2.
  const orden = [...mentes.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const ticksAntes = p.informe.ticks
  const perdidosAntes = p.ticksPerdidos

  for (let k = 0; k < n; k++) {
    for (const a of orden) {
      const m = mentes.get(a)
      if (m === undefined) continue
      // La que ya no está no piensa: su vuelo lo abortó la `Partida` sola y su
      // mente no tiene sobre qué decidir (decisión 5).
      if (!p.state.actors.has(a)) continue
      m.pensar(p)
    }
    // UN tick, y por `avanzar` y no por `tick`: el reloj de pared —que es lo
    // único que puede mover `porTiempo`— se lee ahí adentro y sólo ahí.
    p.avanzar(1)
  }

  let vivos = 0
  for (const a of orden) if (p.state.actors.has(a)) vivos += 1
  return {
    ticks: p.informe.ticks - ticksAntes,
    ticksPerdidos: p.ticksPerdidos - perdidosAntes,
    vivos,
  }
}
