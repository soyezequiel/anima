// t1 / capacidad 4 — «Sabe mantener la comida en la ventana térmica y retirarla a tiempo»
//
// QUÉ IMPLEMENTA
// El ejemplo (b) del documento convertido en capacidad. Colocar la pieza sobre
// un soporte a la distancia donde la ley 1 da equilibrio dentro de la ventana
// de cocción, y después vigilar `digestibility`, `temperature` y `charred` tick
// a tick, retirándola con `ctx.take()` cuando la digestibilidad se estanca o
// antes de cruzar el punto de ignición.
//
// QUÉ DIJO EL CRÍTICO
// FALTA_MUNDO, dos errores estructurales: `denaturesAt` no es `QualityId`
// (vive como campo de `Substance`, doc:406) y `ctx.wait` no existe.
//
// QUÉ ENCONTRÓ EL COMPILADOR
// Exactamente los dos errores que anunció, ni uno más. Salida literal de
// `pnpm exec tsc -p ii/packages/skills/tsconfig.t1.json`:
//
//   ii/packages/skills/borradores/t1/sacarlo-antes-de-que-se-queme.ts(84,30): error TS2345: Argument of type '"denaturesAt"' is not assignable to parameter of type 'QualityId'.
//   ii/packages/skills/borradores/t1/sacarlo-antes-de-que-se-queme.ts(135,30): error TS2339: Property 'wait' does not exist on type 'Ctx'.
//
// CORRECCIÓN AL VEREDICTO: FALTA_MUNDO → FALTA_API
// El crítico puso FALTA_MUNDO. Los dos errores son reales, pero pesan distinto y
// el segundo manda. `denaturesAt` es FALTA_MUNDO legítimo (una cualidad que hay
// que promover de campo de `Substance` a `LawfulQuality`); `ctx.wait` es
// FALTA_API pura, y es el que hace imposible la capacidad. Sin `denaturesAt` la
// habilidad se escribe igual —fea, con el 63 adentro, funcionando sólo para la
// carne— y hace algo. Sin `wait` no hay habilidad de ningún tipo: no existe la
// palabra «después». La distinción no es cosmética, porque decide quién arregla
// qué: `denaturesAt` lo agrega quien escribe la tabla de sustancias, `wait` lo
// agrega quien diseña `Ctx`, y `wait` bloquea además la capacidad 5
// («secar fibra mojada», la secuencia estrella del Hito 5), que hoy compila
// SÓLO por el truco de `goTo(self.at)`. Un mismo hueco tumbando dos de cinco
// capacidades de la tanda no es del mundo: es de la superficie.
//
// LO QUE SÍ SALE, Y POR ESO DUELE
// La ubicación está entera servida: `see([{q:'emitsPower',op:'>',v:0}])`
// encuentra la fogata, `see([{q:'footing',op:'>',v:0}])` encuentra la parrilla,
// y `put(pieza, celda, {onTopOf: soporte})` compila. El borde SUPERIOR de la
// ventana se lee (`ignitionPoint` es `LawfulQuality`) y las tres cualidades a
// vigilar también. Falta exactamente el borde INFERIOR y el paso del tiempo.
// Esa asimetría es peor que la imposibilidad limpia: produce una habilidad que
// compilaría —si tuviera `wait`— con el `63` cableado adentro, o sea que
// funciona para el pescado y para nada más. El test estrella del Hito 1
// («una sustancia nueva del oráculo se comporta sin fila propia») seguiría
// pasando en la FÍSICA y estaría roto en la HABILIDAD, y nadie lo notaría
// porque el test mide el motor.
//
// EL HUECO QUE NADIE NUMERÓ: ¿SE REFRESCA `ctx`?
// `Ctx` declara `readonly tick: number`. El generador retiene ese objeto
// durante los ~300 ticks que dura la cocción. Si `ctx` es la vista congelada
// del tick en que arrancó la habilidad, entonces `ctx.q(pieza,'temperature')`
// adentro del bucle devuelve el mismo número para siempre y la capacidad entera
// es un no-op que pasa el compilador. Nada en la superficie lo dice. Es el
// único hueco de esta lista que no produce un error de tipos y que aun así
// decide si la habilidad hace algo o no.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

// ─── Calibración copiada a mano ─────────────────────────────────────────────
// HUECO: `denaturesAt` no es leíble; 63 es el valor de UNA sustancia (carne).
// Está acá sólo como red para el `catch` de abajo, y es justamente el hardcodeo
// que la capacidad no debería necesitar.
const DENATURACION_DE_LA_CARNE = 63
// Margen bajo el punto de ignición al que se retira sin discutir.
const MARGEN_ANTES_DE_QUEMARSE = 25
// Cuánto tiene que subir `digestibility` por ventana de control para no
// considerarla estancada.
const AVANCE_MINIMO = 0.004
const TICKS_POR_CONTROL = 10
const PACIENCIA_MAXIMA = 600

export function* sacarloAntesDeQueSeQueme(
  ctx: Ctx,
  args: { pieza: BodyView },
): Generator<Intent, Outcome, StepResult> {
  const pieza = args.pieza

  // ── Fase 1: la ventana térmica. El borde de abajo no existe. ──────────────
  ctx.phase('leer-la-ventana')

  // HUECO: falta `denaturesAt` como `LawfulQuality` leíble con `ctx.q()`.
  // Sin esto, «la ventana de cocción» se escribe con el literal 63.
  const abajo = ctx.q(pieza, 'denaturesAt')
  const arriba = ctx.q(pieza, 'ignitionPoint')
  if (!(abajo < arriba)) return fail('esta pieza no tiene ventana de cocción')

  // ── Fase 2: el arreglo. Esta mitad compila entera. ────────────────────────
  ctx.phase('armar-la-parrilla')

  const fuego = ctx.see([{ q: 'emitsPower', op: '>', v: 0 }])[0]
  if (!fuego) return fail('no veo nada que caliente')

  const soporte = ctx.see([{ q: 'footing', op: '>', v: 0 }])[0]
  if (!soporte) return fail('no veo sobre qué apoyarla')

  // La ley 8 le pasa a la ley 1 un `formFactor` estable a distancia fija
  // (doc:422). d = 1 sobre soporte da T_eq ≈ 90 °C: cocina y no quema.
  // HUECO: no hay forma de PREGUNTAR el formFactor ni la T_eq resultante; la
  // única salida es copiar la tabla del documento, y exponerla en `Ctx` sería
  // meter la tabla de recetas disfrazada adentro de la API que lee el modelo.
  const destino: Cell = { x: fuego.at.x + 1, y: fuego.at.y }

  if (soporte.at.x !== destino.x || soporte.at.y !== destino.y) {
    const irAlSoporte = yield ctx.goTo(soporte, { within: 1 })
    if (irAlSoporte.status !== 'arrived') return fail('no llegué al soporte')
    const alzar = yield ctx.take(soporte)
    if (alzar.status !== 'done') return fail('no pude levantar el soporte')
    const poner = yield ctx.put(soporte, destino)
    if (poner.status !== 'done') return fail('no pude poner el soporte junto al fuego')
  }

  const irALaPieza = yield ctx.goTo(pieza, { within: 1 })
  if (irALaPieza.status !== 'arrived') return fail('no llegué a la pieza')
  const agarrar = yield ctx.take(pieza)
  if (agarrar.status !== 'done') return fail('no pude agarrar la pieza')

  const colocar = yield ctx.put(pieza, destino, { onTopOf: soporte })
  if (colocar.status !== 'done') return fail('no pude apoyarla sobre el soporte')

  // ── Fase 3: vigilar. No hay forma de dejar pasar un tick. ─────────────────
  ctx.phase('vigilar')

  let ultimaDigestibilidad = ctx.q(pieza, 'digestibility')
  const desde = ctx.memory.get<number>('control') ?? 0

  for (let control = desde; control < PACIENCIA_MAXIMA / TICKS_POR_CONTROL; control++) {
    ctx.memory.set('control', control)

    // HUECO: falta `ctx.wait(ticks: number): Intent`. El Hito 4 lista «esperar»
    // entre las quince habilidades innatas y `Ctx` no tiene ningún constructor
    // de intención ociosa. Sin esto el `for` cuenta ITERACIONES, no ticks: gira
    // a toda velocidad quemando el combustible del transformer sin que el mundo
    // avance, y la vigilancia «tick a tick» es una frase, no un programa.
    const espera = yield ctx.wait(TICKS_POR_CONTROL)
    if (espera.status === 'blocked') return fail('no pude esperar')

    const t = ctx.q(pieza, 'temperature')
    const carbonizada = ctx.q(pieza, 'charred')
    const digestibilidad = ctx.q(pieza, 'digestibility')

    // Borde superior: la ley 5 corta sola en `ignitionPoint`, pero para entonces
    // la ley 3 ya la está poniendo a arder. Se retira ANTES.
    if (t >= arriba - MARGEN_ANTES_DE_QUEMARSE || carbonizada > 0.05) {
      ctx.say('se está por quemar, la saco')
      return yield* retirar(ctx, pieza, 'retirada al filo de la ignición')
    }

    // Borde inferior: si está por debajo del punto de desnaturalización, la ley
    // 5 no corre y la 6 sí — se pudre a fuego lento. Hay que acercarla o
    // reponer leña, y ninguna de las dos cosas se puede decidir sin saber por
    // qué bajó (¿se apagó el fuego?, ¿está muy lejos?).
    if (t < abajo) {
      ctx.say(`está a ${t} y necesita ${abajo}: no cocina`)
      // HUECO: `emitsPower` del fuego se puede leer, pero no hay forma de
      // reponer leña ni de distinguir «se apagó» de «la puse lejos».
      if (ctx.q(fuego, 'emitsPower') <= 0) {
        return yield* retirar(ctx, pieza, 'el fuego se apagó a mitad de la cocción')
      }
      continue
    }

    // Estancamiento: `digestibility` está manejada por un `drive` hacia 0.95;
    // cuando deja de subir, ya está.
    if (digestibilidad - ultimaDigestibilidad < AVANCE_MINIMO) {
      ctx.say('dejó de mejorar: está lista')
      return yield* retirar(ctx, pieza, 'cocida')
    }
    ultimaDigestibilidad = digestibilidad
  }

  return yield* retirar(ctx, pieza, 'se me acabó la paciencia')
}

/** Retirar es lo único que hay que hacer bien en toda la habilidad. */
function* retirar(
  ctx: Ctx,
  pieza: BodyView,
  porQue: string,
): Generator<Intent, Outcome, StepResult> {
  ctx.memory.del('control')
  const sacar = yield ctx.take(pieza)
  // HUECO: `StepResult` no trae `why`. Si otro se la llevó, si la vista de hace
  // 300 ticks caducó, o si simplemente no llego, acá se ve el mismo 'rejected'.
  if (sacar.status !== 'done') return fail(`no pude sacarla del fuego (${porQue})`)
  const digestibilidad = ctx.q(pieza, 'digestibility')
  if (digestibilidad < 0.5) return fail(`la saqué a medio hacer: ${porQue}`)
  return done(pieza)
}

/**
 * DEMOSTRACIÓN, no habilidad. La única espera que hoy pasa `tsc` es ir a donde
 * ya estoy. Compila —`SelfView.at` es `Placement` = `Cell` y `goTo` acepta
 * `Cell`— y no significa nada: si el mundo resuelve un `goTo` a distancia cero
 * como 'arrived' en el mismo tick, esto no deja pasar UN solo tick. Que la
 * capacidad funcione o no dependería de una propiedad no especificada del
 * resolvedor de intenciones, de la que nadie es dueño. Queda registrada acá
 * para que la deformidad esté a la vista y no se consagre por costumbre.
 */
export function* esperarEsUnTruco(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  for (let i = 0; i < 300; i++) {
    const nada = yield ctx.goTo(ctx.self.at)
    if (nada.status !== 'arrived') return fail('ni siquiera pude quedarme quieta')
  }
  return done()
}

/** Sólo para dejar el `DENATURACION_DE_LA_CARNE` a la vista como lo que es. */
export function ventanaCableada(): number {
  return DENATURACION_DE_LA_CARNE
}
