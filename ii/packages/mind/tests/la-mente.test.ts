// ─── LA MENTE CONTRA EL MUNDO DE VERDAD — tramo G del Hito 5 ────────────────
//
// Los otros tres archivos de este paquete corren contra vistas de mentira, y está
// bien que lo hagan: una escalera se prueba con una escena escrita a mano porque
// lo que se quiere medir es la DECISIÓN, no la física. Éste no. Acá hay
// `stepWorld`, la física semilla, el dios con su río, y las quince innatas de
// verdad — porque lo que este tramo agrega es exactamente la junta entre las dos
// mitades, y una junta contra un mundo de mentira no es una junta.
//
// ─── LOS CRITERIOS, ESCRITOS ANTES ──────────────────────────────────────────
//
//   (a) **una criatura sola vive 400 ticks y no explota nada**: ni una excepción,
//       ni un tick perdido, ni un tick sin decisión.
//   (b) **una se muere y el bucle sigue** (ADR II-0009). La que queda sigue
//       decidiendo y el informe la cuenta.
//   (c) **dos criaturas piensan en orden canónico**, y el orden NO es el del
//       `Map`: dos mapas con la misma gente en distinto orden dan la misma
//       partida, hash por hash.
//   (d) **una variante de `Step` de cada una, traducida y CORRIDA contra el mundo
//       real**, con la tabla de qué logra cada una y por qué la que no.
//
// Y la corrida del documento —«con hambre y un río a la vista, la criatura
// deshilacha un matorral, ata una vara, va y pesca»— sale entera y está abajo con
// los ticks de cada eslabón. Es el criterio de corte del proyecto y no se reporta
// como un `expect` a secas: se imprime la corrida.

import { beforeEach, describe, expect, it } from 'vitest'

import { qualityOf } from '@anima/physics'
import type { CellState, WorldBody, WorldState } from '@anima/world'
import { chebyshev, hashWorldState, keyOfCell } from '@anima/world'
import type { Intent, Outcome, StepResult } from '@anima/skills'
import { Contexto, Partida } from '@anima/perceive'
import type { Step } from '@anima/plan'

import { Creencias, contextoDe } from '../src/creencias.js'
import { Mente, aHabilidad, vivir } from '../src/mente.js'
import { cuantasVeces } from '../src/tipos.js'
import type { Decision, Intencion, Peldano, VistaDeLaMente } from '../src/tipos.js'
import { actor, criatura, cuerpo, enElPiso, laOrilla, mundo } from './mundo.js'

// ─── EL RESPIRO QUE MANTIENE VIVO AL WORKER DE VITEST ────────────────────────
//
// birpc le pone 60 s de vencimiento al aviso de cada test, y un `for` sincrónico
// largo no deja correr ni el temporizador ni la lectura del socket; cuando suelta
// el hilo, Node corre la fase de temporizadores antes que la de poll y el
// vencimiento gana la carrera aunque la respuesta ya esté en la cola. El síntoma
// es la peor clase de rojo: TODOS los tests en verde y `exit 1` con
// `Timeout calling "onTaskUpdate"`.
//
// Desde que el mundo materializa el decreto (`world/src/step.ts`, `abrirChunk`)
// las corridas de este archivo cuestan diez veces más por tick, así que varias
// cruzan los 60 s. Se arregla con una MACROTAREA de verdad —`setTimeout(…, 0)`;
// un `await` sobre una promesa resuelta es una microtarea y no drena la fase de
// poll— en un `beforeEach` de raíz, que no toca el cuerpo de ningún test ni puede
// mover ninguna medición: corre antes de que el test empiece.
beforeEach(async () => {
  await new Promise((listo) => {
    setTimeout(listo, 0)
  })
})

// ─── El arnés ────────────────────────────────────────────────────────────────

/**
 * La orilla del documento: una criatura con hambre parada en la orilla, una vara
 * de madera a tres celdas y un matorral de liana a dos.
 *
 * Los dos números que hacen a la escena y no son decorativos:
 *
 *   · **la `stamina` es 310 de un tanque de 1000**, que es el `0,31` del documento
 *     leído como fracción. Con el tanque lleno la criatura no tiene hambre y D3 no
 *     elige comida;
 *   · **el matorral pesa 0,2 kg**, y de ahí sale la cadena entera. Un `hebra` de
 *     liana tiene `reach = 6 × masa` y `catch = 2 × 0,15` —las dos puntas libres—
 *     o sea que un matorral de 1 kg YA es un aparejo (`reach = 6 ≥ 2`, `catch =
 *     0,3 > 0`) y el plan que sale es «andá y pescá con el matorral», de tres
 *     pasos. Medido. Con 0,2 kg el alcance cae a 1,2 y la única forma de llegar a
 *     `reach >= 2` es atarlo a la vara, que es la cadena que el criterio pide.
 *     El número no está elegido para que dé: está elegido para que la escena SEA
 *     la del documento, donde el matorral solo no alcanza.
 */
function laEscenaDelDocumento(stamina = 310): WorldState {
  const o = laOrilla()
  const p = o.parada
  return mundo({
    dios: o.dios,
    bodies: [
      enElPiso(criatura('ana', stamina), p),
      enElPiso(cuerpo('vara', 'madera', 1, {}, 'vara'), { x: p.x + 3, y: p.y }),
      enElPiso(cuerpo('matorral', 'liana', 0.2, {}, 'hebra'), { x: p.x - 2, y: p.y + 1 }),
    ],
    actors: [actor('ana', { capacity: 3 })],
  })
}

interface Corrida {
  readonly peldanos: Readonly<Record<Peldano, number>>
  readonly clases: Readonly<Record<Decision['k'], number>>
  /** Qué despegó y en qué tick. Una línea por vuelo, no por tick. */
  readonly volados: readonly string[]
  readonly tropiezos: readonly string[]
  readonly vida: ReturnType<typeof vivir>
  readonly partida: Partida
  readonly mente: Mente
}

/** Una corrida con UNA mente, anotando peldaño por peldaño y vuelo por vuelo. */
function correr(w: WorldState, quien: string, ticks: number, memoria = new Creencias()): Corrida {
  const p = new Partida(w)
  const m = new Mente({ actor: quien, memoria })
  const peldanos: Record<Peldano, number> = { D0: 0, D1: 0, D2: 0, D3: 0, D4: 0, D5: 0 }
  const clases: Record<Decision['k'], number> = { seguir: 0, volar: 0, plan: 0, abortar: 0 }
  const volados: string[] = []
  const tropiezos: string[] = []
  const ticksAntes = p.informe.ticks
  const perdidosAntes = p.ticksPerdidos

  for (let t = 0; t < ticks; t++) {
    if (!p.state.actors.has(quien)) break
    const antes = m.despegues
    const d = m.pensar(p)
    peldanos[d.por] += 1
    clases[d.k] += 1
    if (m.despegues > antes) volados.push(`${String(t)} ${m.ultimoDespegue ?? '?'}`)
    if (m.tropiezo !== undefined) tropiezos.push(`${String(t)} ${m.tropiezo}`)
    p.avanzar(1)
  }

  return {
    peldanos,
    clases,
    volados,
    tropiezos,
    vida: {
      ticks: p.informe.ticks - ticksAntes,
      ticksPerdidos: p.ticksPerdidos - perdidosAntes,
      vivos: p.state.actors.has(quien) ? 1 : 0,
    },
    partida: p,
    mente: m,
  }
}

/** La vista de la mente, armada como la arma la mente: con el `Ctx` de producción. */
function vistaDe(p: Partida, quien: string): VistaDeLaMente {
  return new Contexto(p.proyeccion, { actor: quien, rng: p.dado.tirar, lugares: p.lugares }).ctx
}

/** Lo que la criatura tiene en la mano, por sustancia. */
function enLaMano(p: Partida, quien: string): string[] {
  const a = p.state.actors.get(quien)
  const out: string[] = []
  for (const id of a?.holding ?? []) {
    const b = p.state.bodies.get(id)
    if (b !== undefined) out.push(b.body.parts.map((x) => x.substance).join('+'))
  }
  return out
}

function calorias(p: Partida, quien: string): number {
  const a = p.state.actors.get(quien)
  let total = 0
  for (const id of a?.holding ?? []) {
    const b = p.state.bodies.get(id)
    if (b !== undefined) total += qualityOf(b.body, 'calories', p.state.phys)
  }
  return total
}

// ─── (1) LA CORRIDA DEL DOCUMENTO, CONTRA EL MUNDO DE VERDAD ────────────────

describe('la corrida del documento: hambre, un río de la semilla, y la cadena de la caña', () => {
  it('el plan que sale de la orilla de verdad es la cadena entera, de siete pasos', () => {
    const p = new Partida(laEscenaDelDocumento())
    const m = new Mente({ actor: 'ana', memoria: new Creencias() })
    const d = m.pensar(p)

    expect(d.por).toBe('D3')
    expect(d.k).toBe('plan')
    if (d.k !== 'plan') throw new Error('imposible')
    expect(d.meta).toBe('holding(tag:carnoso)')
    expect(d.pasos.map(resumir)).toEqual([
      'ir(vara)',
      'sostener(vara)',
      'ir(matorral)',
      'sostener(matorral)',
      'unir(binder=matorral, a=vara)',
      'ir(pozo:-6:-6)',
      'aplicar(extraccion)',
    ])
    // Y el `gear` de la pesca es un RENDIMIENTO diferido: la caña no existe
    // cuando el plan se arma, porque `union` se come la vara y la liana y crea un
    // cuerpo con id nuevo. Quien lo liga es esta mente, con su mapa de rindes.
    const extraer = d.pasos.find((s) => s.k === 'aplicar')
    if (extraer === undefined || extraer.k !== 'aplicar') throw new Error('imposible')
    expect(extraer.roles['gear']).toEqual({ k: 'rinde', de: 'catch>0&reach>=2@./gear' })
    console.log(`\n  D3 dijo: ${d.porque}`)
  })

  it('CRITERIO DE CORTE: la corrida entera pesca, sin una sola llamada al modelo', () => {
    const r = correr(laEscenaDelDocumento(), 'ana', 400)

    // ─── EL PLAN TIENE SIETE ESLABONES Y SE VUELAN SEIS, y eso es el arreglo ──
    //
    // El test de arriba pide el plan EN EL TICK 0 y siguen saliendo los siete. Lo
    // que cambió es cuántos llegan al mundo: cuando el plan termina de armar la
    // caña, la criatura está parada sobre el matorral, y **desde ahí ya está
    // adentro del alcance del pozo**. El `ir(pozo:-6:-6)` era, en ese punto, un
    // no-op: la innata `ir` tiene su salida temprana («si ya estoy, no gasto una
    // intención»), o sea que aterrizaba `ok:true` sin emitir nada y se llevaba un
    // tick. Lo poda `sinLoQueYaEstaHecho` de `@anima/plan` cuando D4 replanifica
    // desde ahí, y la cadena que el mundo ve pasa a tener seis vuelos.
    //
    // Es la versión chica y en verde del bucle que se llevó el 98% de una vida en
    // `hito-5-el-criterio.test.ts` (6045 despegues de un `ir` ya dado en 6171
    // ticks): el mismo no-op, acá una sola vez y ahí seis mil.
    //
    // Y LA PODA SE VERIFICA CONTRA EL MUNDO, no contra la lista: se corre la
    // misma escena hasta el tick 20 —justo después de `unir`, que despega en el
    // 13— y se mide dónde quedó parada. Si algún día el pozo se mueve, esto se
    // pone rojo por el motivo correcto y no por el número de vuelos.
    const justoDespuesDeUnir = correr(laEscenaDelDocumento(), 'ana', 20)
    const ella = justoDespuesDeUnir.partida.state.bodies.get('ana-cuerpo')?.at
    const pozo = justoDespuesDeUnir.partida.state.bodies.get('pozo:-6:-6')?.at
    if (ella === undefined || pozo === undefined) throw new Error('escena sin ana o sin pozo')
    expect(chebyshev(ella, pozo)).toBeLessThanOrEqual(1)

    const chain = r.volados.map((l) => l.slice(l.indexOf(' ') + 1))
    expect(chain.slice(0, 6)).toEqual([
      'ir(vara)',
      'sostener(vara)',
      'ir(matorral)',
      'sostener(matorral)',
      'unir(matorral+vara)',
      'aplicar(extraccion)',
    ])

    // Y el pescado está EN LA MANO, sacado del agua por `extraccion` del mundo
    // real contra un banco que decretó el dios. Es el criterio del Hito 5 dicho
    // sobre esta escena: de «tengo hambre» a «tengo algo carnoso» sin una línea
    // cableada y sin proveedor.
    expect(enLaMano(r.partida, 'ana')).toContain('pescado')
    expect(calorias(r.partida, 'ana')).toBeGreaterThan(0)
    expect(r.tropiezos).toEqual([])
    expect(r.vida.ticksPerdidos).toBe(0)

    console.log(
      `\n─── LA CORRIDA DEL DOCUMENTO, CONTRA \`stepWorld\` ───\n` +
        `${r.volados.join('\n')}\n\n` +
        `  peldaños: ${JSON.stringify(r.peldanos)}\n` +
        `  clases:   ${JSON.stringify(r.clases)}\n` +
        `  en la mano al final: ${enLaMano(r.partida, 'ana').join(' · ')} ` +
        `(${calorias(r.partida, 'ana').toFixed(2)} calorías)\n`,
    )
  })

  it('la caña se arma de verdad: `unir` se come la vara y la liana y deja UN cuerpo con punta suelta', () => {
    const r = correr(laEscenaDelDocumento(), 'ana', 60)
    // Los dos ids del plan ya no nombran nada: `union` con `yield: join` consume
    // las piezas. Es exactamente por esto que el `gear` viaja como `{k:'rinde'}`.
    expect(r.partida.state.bodies.has('vara')).toBe(false)
    expect(r.partida.state.bodies.has('matorral')).toBe(false)
    const cana = [...r.partida.state.bodies.values()].find((c) => c.heldBy === 'ana')
    expect(cana).toBeDefined()
    if (cana === undefined) throw new Error('imposible')
    const phys = r.partida.state.phys
    expect(cana.body.parts.map((x) => x.substance).sort()).toEqual(['liana', 'madera'])
    // Lo que la hace aparejo, y nadie escribió «caña»: alcance y una punta libre.
    expect(qualityOf(cana.body, 'reach', phys)).toBeGreaterThanOrEqual(2)
    expect(qualityOf(cana.body, 'catch', phys)).toBeGreaterThan(0)
    console.log(
      `\n  la caña: reach=${qualityOf(cana.body, 'reach', phys).toFixed(2)} ` +
        `catch=${qualityOf(cana.body, 'catch', phys).toFixed(2)} ` +
        `(el matorral solo tenía reach 1,20)`,
    )
  })

  it('HUECO MEDIDO: la meta nunca se da por cumplida, así que vuelve a pescar', () => {
    // Es el mismo hueco que `la-escalera.test.ts` mide sobre la vista de mentira,
    // y acá se ve en la corrida: `cumpleCuerpo` contesta `false` a todo
    // `holding(tag:…)` —«para contestar esto hay que saber de qué sustancia está
    // hecho el cuerpo, y una `BodyView` no trae ninguna de las dos»— así que D1 no
    // corta por «ya lo tengo» y D4 arma otro plan de un solo paso.
    const r = correr(laEscenaDelDocumento(), 'ana', 400)
    const pescas = r.volados.filter((l) => l.endsWith('aplicar(extraccion)')).length
    expect(pescas).toBeGreaterThan(1)
    // Y no es un bucle roto: cada vuelta saca un pescado más y el mundo lo cobra.
    expect(r.peldanos.D4).toBeGreaterThan(0)
    console.log(
      `\n  pescó ${String(pescas)} veces en 400 ticks y nunca se dio por satisfecha: ` +
        `${String(r.peldanos.D4)} replanificaciones de D4`,
    )
  })
})

// ─── (2) CRITERIO (a) · una criatura sola, 400 ticks, nada explota ──────────

describe('(a) una criatura sola vive y no explota nada', () => {
  it('400 ticks en la orilla: cero ticks perdidos, cero excepciones, una decisión por tick', () => {
    const r = correr(laEscenaDelDocumento(), 'ana', 400)
    expect(r.vida.ticks).toBe(400)
    expect(r.vida.ticksPerdidos).toBe(0)
    expect(r.partida.informe.fallas).toEqual([])
    // Una decisión por tick y ni una menos: es la decisión 2 de `tipos.ts` —«nunca
    // se baja del último peldaño sin una intención»— contada sobre una corrida.
    const total = Object.values(r.clases).reduce((a, b) => a + b, 0)
    expect(total).toBe(400)
    expect(r.vida.vivos).toBe(1)
  })

  it('DOS MIL TICKS seguidos, que es el largo con el que el Hito 5 se mide', () => {
    const r = correr(laEscenaDelDocumento(), 'ana', 2000)
    expect(r.vida.ticks).toBe(2000)
    expect(r.vida.ticksPerdidos).toBe(0)
    expect(r.vida.vivos).toBe(1)
    expect(r.tropiezos).toEqual([])
    const pescas = r.volados.filter((l) => l.endsWith('aplicar(extraccion)')).length
    const d1 = (r.peldanos.D1 * 100) / 2000
    console.log(
      `\n─── DOS MIL TICKS ───\n` +
        `  peldaños: ${JSON.stringify(r.peldanos)}  (D1 = ${d1.toFixed(1)}%)\n` +
        `  ${String(r.volados.length)} despegues · ${String(pescas)} pescas · ` +
        `${String(r.vida.ticksPerdidos)} ticks perdidos\n` +
        `  aliento al final: ${qualityOf(r.partida.state.bodies.get('ana-cuerpo')!.body, 'stamina', r.partida.state.phys).toFixed(1)}\n`,
    )
    // ─── EL PELDAÑO QUE CARGA EL TICK ES D1, Y VOLVIÓ A SERLO ───────────────
    //
    // La razón es aritmética y la da el propio encabezado de D1: el mundo avanza
    // una celda por tick y `extraccion` dura `1,5 s × hz` ticks. En una criatura
    // que SIEMPRE tiene plan, casi todo tick es «seguí con lo que estabas
    // haciendo». Medido hoy:
    //
    //     peldaños: D0 0 · D1 1388 · D2 0 · D3 2 · D4 1 · D5 609
    //     619 despegues · 2 pescas · 0 ticks perdidos · aliento 310 → 148,4
    //
    // ─── Y EL D4 DE 1899 QUE HUBO EN EL MEDIO ERA UN BUCLE ──────────────────
    //
    // Entre el tramo K y este bloque, esto mismo midió **D1 99 · D4 1899** con
    // 1908 despegues, y se escribió que era «el costo del mundo lleno: el mundo se
    // enriqueció 30× y el presupuesto del planificador no se movió». No era eso.
    // Era que `plan()` contestaba `gap`, la escalera ejecutaba el `nearest`
    // —`ir` a un cuerpo que estaba A UNA CELDA— y el paso aterrizaba bien sin
    // moverla, así que replanificaba el tick siguiente y otra vez. 1899 ticks de
    // D4 eran 1899 replanificaciones del mismo `gap`.
    //
    // Está arreglado en `escalera.ts` con `mientrasTantoYaHecho` y medido en
    // `hito-5-el-criterio.test.ts`, DIAGNÓSTICO 11. Lo que este bloque tiene que
    // recordar es la regla: **un peldaño que se lleva el 95% de los ticks no es
    // un dato de rendimiento, es una pregunta.**
    //
    // Y lo que cambió de verdad al arreglarlo: el aliento final pasó de 209,6 a
    // 148,4, porque ahora D5 la manda a caminar en vez de dejarla replanificando
    // gratis. Vive menos y hace más; el criterio (2) se mide en si comió.
    expect(r.peldanos.D1).toBeGreaterThan(
      r.peldanos.D0 + r.peldanos.D2 + r.peldanos.D3 + r.peldanos.D4 + r.peldanos.D5,
    )
    // Y los otros dos que deciden siguen decidiendo alguna vez.
    expect(r.peldanos.D3).toBeGreaterThan(0)
    expect(r.peldanos.D5).toBeGreaterThan(0)
  })

  it('y en el páramo tampoco: sin nada que hacer, D5 la sostiene 400 ticks', () => {
    // La otra punta. Un mundo sin dios, sin cuerpos y con el tanque casi lleno: no
    // hay oportunidad que elegir, no hay plan que hacer, y la criatura tiene que
    // seguir estando viva igual.
    const w = mundo({ bodies: [enElPiso(criatura('ella', 900), { x: 0, y: 0 })], actors: [actor('ella')] })
    const r = correr(w, 'ella', 400)
    expect(r.vida.ticksPerdidos).toBe(0)
    expect(r.peldanos.D5).toBeGreaterThan(0)
    expect(r.peldanos.D3).toBe(0)
    expect(r.peldanos.D4).toBe(0)
    expect(r.vida.vivos).toBe(1)
    const cuales = new Set(r.volados.map((l) => l.slice(l.indexOf(' ') + 1)))
    console.log(
      `\n─── EL PÁRAMO ───\n  peldaños: ${JSON.stringify(r.peldanos)}\n` +
        `  las conductas de fondo que salieron: ${[...cuales].sort().join(' · ')}\n`,
    )
  })

  it('nunca hay dos habilidades en vuelo: `Partida.volar` lanzaría, y no lanza', () => {
    // No es una promesa de este comentario: `volar` lanza si el actor ya tiene una
    // viva —dos corridas del mismo actor emiten el mismo `seq` y `stepWorld`
    // rechaza a las dos— así que 400 ticks sin excepción SON la verificación. Lo
    // que se agrega acá es el contrapositivo: si el corte no cortara, esto lanza.
    // ─── ESTE BLOQUE SE ROMPIÓ Y SE ARREGLÓ SOLO, Y VALE ANOTARLO ───────────
    //
    // Entre el tramo K y el arreglo del bucle del `nearest`, la criatura NO tenía
    // un vuelo vivo en ningún tick: replanificaba el mismo `gap` todos los ticks y
    // cada `ir` se cerraba adentro del mismo. Así que este bloque tuvo que armar
    // el vuelo vivo a mano con una habilidad que espera. Con el bucle cerrado
    // (`escalera.ts`, `mientrasTantoYaHecho`) la criatura vuelve a estar SIEMPRE
    // en medio de algo —D1 se lleva el 69% de los ticks— y la forma original
    // vuelve a valer, que es la que menos supone.
    const r = correr(laEscenaDelDocumento(), 'ana', 200)
    const v = r.partida.vuelo('ana')
    expect(v).toBeDefined()
    expect(v?.terminado).toBe(false)
    expect(() => {
      r.partida.volar('ana', function* (): Generator<Intent, Outcome, StepResult> {
        return { ok: true }
      }, undefined)
    }).toThrow(/ya tiene una habilidad en vuelo/)
  })
})

// ─── (3) CRITERIO (b) · se muere y el bucle sigue ──────────────────────────

describe('(b) una se muere a mitad de un vuelo y el bucle sigue', () => {
  it('bea se queda sin aliento a mitad de un vuelo, `vivir` no explota y ana sigue decidiendo', () => {
    // Un páramo y no la orilla, y es a propósito. En la orilla bea planifica la
    // pesca y su último vuelo es un `ir`, y `ir` a un destino que YA está a una
    // celda contesta `done()` en el primer paso sin gastar una intención: medido,
    // el vuelo no está vivo en el tick en que se muere, así que el aborto de la
    // `Partida` no se dispara y el test no probaría nada. Acá deambula —un vuelo
    // de ocho ticks— y se muere adentro, que es el caso que el ADR II-0009 cubre.
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 900), { x: 0, y: 0 }),
        // Tres de mil: el metabolismo se la lleva en el tick 33. Medido.
        enElPiso(criatura('bea', 3), { x: 6, y: 0 }),
      ],
      actors: [actor('ana'), actor('bea')],
    })
    const p = new Partida(w)
    const ana = new Mente({ actor: 'ana', memoria: new Creencias() })
    const bea = new Mente({ actor: 'bea', memoria: new Creencias() })
    const r = vivir(p, new Map([['ana', ana], ['bea', bea]]), 200)

    expect(r.ticks).toBe(200)
    expect(r.ticksPerdidos).toBe(0)
    expect(r.vivos).toBe(1)
    expect(p.state.actors.has('bea')).toBe(false)
    // La `Partida` le abortó el vuelo sola (ADR II-0009), con el motivo escrito.
    expect(p.vuelo('bea')?.terminado).toBe(true)
    expect(p.vuelo('bea')?.outcome?.ok).toBe(false)
    expect(p.vuelo('bea')?.outcome).toMatchObject({ why: 'se murió de hambre' })
    // Y ana siguió: su mente decidió los 200 ticks y siguió despegando.
    expect(ana.ultima).toBeDefined()
    expect(ana.despegues).toBeGreaterThan(0)
    console.log(
      `\n  bea despegó ${String(bea.despegues)} habilidades antes de morirse; ` +
        `ana ${String(ana.despegues)} en 200 ticks`,
    )
  })

  it('`pensar` sobre una criatura que ya no está contesta `abortar` y no toca la vista', () => {
    const w = mundo({ bodies: [enElPiso(criatura('ella', 500), { x: 0, y: 0 })], actors: [actor('ella')] })
    const p = new Partida(w)
    // Una mente para un actor que NUNCA existió es el mismo caso que la muerta:
    // `state.actors` no la tiene. Si `pensar` le pidiera la vista, `Contexto`
    // devolvería la criatura muerta —`at: (0,0)`, `stamina: 0`— y la escalera
    // decidiría sobre una criatura de mentira.
    const m = new Mente({ actor: 'fantasma', memoria: new Creencias() })
    const d = m.pensar(p)
    expect(d.k).toBe('abortar')
    expect(d.porque).toContain('ya no estoy en el mundo')
    expect(m.despegues).toBe(0)
    // El reloj de la escalera NO avanzó: no hubo tick de mente.
    expect(m.estado.tick).toBe(0)
  })
})

// ─── (4) CRITERIO (c) · el orden de pensamiento es canónico ────────────────

describe('(c) dos criaturas, y el orden de pensamiento sale del id y no del `Map`', () => {
  function dosEnLaOrilla(): WorldState {
    const o = laOrilla()
    const q = o.parada
    return mundo({
      dios: o.dios,
      bodies: [
        enElPiso(criatura('ana', 400), q),
        enElPiso(criatura('zoe', 400), { x: q.x, y: q.y - 3 }),
        enElPiso(cuerpo('vara', 'madera', 1, {}, 'vara'), { x: q.x + 3, y: q.y }),
        enElPiso(cuerpo('matorral', 'liana', 0.2, {}, 'hebra'), { x: q.x - 2, y: q.y + 1 }),
      ],
      actors: [actor('ana'), actor('zoe')],
    })
  }

  /** Espía `pensar` sin tocar la clase: la propiedad propia tapa a la del prototipo. */
  function espiar(m: Mente, donde: string[]): Mente {
    const real = m.pensar.bind(m)
    m.pensar = (p: Partida): Decision => {
      donde.push(m.actor)
      return real(p)
    }
    return m
  }

  it('el mapa al revés piensa igual: `ana` antes que `zoe`, siempre', () => {
    const orden: string[] = []
    const p = new Partida(dosEnLaOrilla())
    const alReves = new Map([
      ['zoe', espiar(new Mente({ actor: 'zoe', memoria: new Creencias() }), orden)],
      ['ana', espiar(new Mente({ actor: 'ana', memoria: new Creencias() }), orden)],
    ])
    vivir(p, alReves, 5)
    // Diez entradas, y de a pares en orden de id. Con el orden del `Map` habría
    // salido `zoe` primero las cinco veces.
    expect(orden).toEqual(['ana', 'zoe', 'ana', 'zoe', 'ana', 'zoe', 'ana', 'zoe', 'ana', 'zoe'])
  })

  it('y las dos partidas gemelas dan el MISMO hash de mundo, tick a tick', () => {
    // El porqué de que esto importe está en `Partida.#tirar`: el dado del mundo
    // vive adentro de `state.dios` y una habilidad que lo tira se lo corre a
    // todas las demás. O sea que el orden en que se AVANZAN los generadores es
    // observable desde el hash — hoy no lo es, porque ninguna de las quince usa
    // `ctx.rng`, y por eso este test dice lo que dice y no más: **hoy las dos
    // corridas coinciden, y si mañana una innata tira el dado, tienen que seguir
    // coincidiendo**. Sin el orden por id, no coincidirían.
    const uno = new Partida(dosEnLaOrilla())
    const dos = new Partida(dosEnLaOrilla())
    const mentesDe = (): [string, Mente][] => [
      ['ana', new Mente({ actor: 'ana', memoria: new Creencias() })],
      ['zoe', new Mente({ actor: 'zoe', memoria: new Creencias() })],
    ]
    const derecho = new Map(mentesDe())
    const alReves = new Map([...mentesDe()].reverse())
    for (let t = 0; t < 120; t++) {
      vivir(uno, derecho, 1)
      vivir(dos, alReves, 1)
      expect(hashWorldState(dos.state), `se separaron en el tick ${String(t)}`).toBe(
        hashWorldState(uno.state),
      )
    }
    console.log(`\n  120 ticks con dos criaturas: el hash del mundo no depende del orden del \`Map\``)
  })
})

// ─── (5) CRITERIO (d) · una variante de `Step` de cada una, contra el mundo ─

interface Caso {
  readonly nombre: string
  readonly mundo: () => WorldState
  readonly paso: Intencion
  readonly ticks?: number
  /** Qué se mira en el mundo para decir que hizo lo que dijo. */
  readonly verificar?: (p: Partida) => void
}

function conCelda(w: WorldState, at: { x: number; y: number }, c: CellState): WorldState {
  const cells = new Map(w.cells)
  cells.set(keyOfCell(at), c)
  return { ...w, cells }
}

/** Un mundo con `ella` en el origen. Lo que va en `holding` viaja en su mano. */
function conElla(cuerpos: readonly WorldBody[] = [], o: { stamina?: number; holding?: readonly string[] } = {}): WorldState {
  const at = { x: 0, y: 0 }
  const mano = new Set(o.holding ?? [])
  return mundo({
    bodies: [
      enElPiso(criatura('ella', o.stamina ?? 500), at),
      ...cuerpos.map((c) => (mano.has(c.body.id) ? { ...c, at, heldBy: 'ella' } : c)),
    ],
    actors: [actor('ella', { holding: o.holding ?? [] })],
  })
}

const SIN_META = ''

const CASOS: readonly Caso[] = [
  {
    nombre: 'ir',
    mundo: () => conElla(),
    paso: { k: 'ir', a: { k: 'celda', at: { x: 5, y: -3 } }, porQue: SIN_META },
    verificar: (p) => {
      expect(p.state.bodies.get('ella-cuerpo')?.at).toEqual({ x: 5, y: -3 })
    },
  },
  {
    nombre: 'explorar',
    // La misma escena que `perceive/tests/las-quince.test.ts`: el agua no es un
    // cuerpo, es `wet` de la celda, y la celda mojada está a ocho — fuera del
    // disco de radio 6 que `explorar` barre al arrancar.
    mundo: () => conCelda(conElla([], { stamina: 900 }), { x: 8, y: 0 }, { wet: 1, oxygen: 1, temperature: 20 }),
    paso: { k: 'explorar', buscoEnLaCelda: { q: 'wet', op: '>=', v: 0.5 }, maxTicks: 60, porQue: SIN_META },
    ticks: 200,
  },
  {
    nombre: 'juntar',
    mundo: () =>
      conElla([
        enElPiso(cuerpo('r1', 'raiz-dura', 0.3), { x: 1, y: 0 }),
        enElPiso(cuerpo('r2', 'raiz-dura', 0.3), { x: 2, y: 1 }),
      ]),
    paso: { k: 'juntar', que: [{ q: 'rigidity', op: '>=', v: 0.4 }], cuantos: 2, porQue: SIN_META },
    verificar: (p) => {
      expect(p.state.actors.get('ella')?.holding.length).toBe(2)
    },
  },
  {
    nombre: 'comer',
    mundo: () => conElla([enElPiso(cuerpo('bocado', 'medula', 1), { x: 1, y: 0 })], { stamina: 200 }),
    paso: { k: 'comer', porQue: SIN_META },
    verificar: (p) => {
      // Se lo comió: el cuerpo se fue del mundo y el aliento subió.
      expect(p.state.bodies.has('bocado')).toBe(false)
      expect(qualityOf(p.state.bodies.get('ella-cuerpo')!.body, 'stamina', p.state.phys)).toBeGreaterThan(200)
    },
  },
  {
    nombre: 'unir',
    mundo: () =>
      conElla(
        [
          enElPiso(cuerpo('vara', 'madera', 0.4), { x: 0, y: 0 }),
          enElPiso(cuerpo('atadura', 'liana', 0.2), { x: 0, y: 0 }),
        ],
        { holding: ['vara', 'atadura'] },
      ),
    paso: {
      k: 'unir',
      binder: { k: 'id', id: 'atadura' },
      a: { k: 'id', id: 'vara' },
      porQue: SIN_META,
      rinde: 'la-caña',
    },
    verificar: (p) => {
      // `union` con `yield: join` consume las piezas y crea un cuerpo nuevo.
      expect(p.state.bodies.has('vara')).toBe(false)
      expect(p.state.bodies.has('atadura')).toBe(false)
    },
  },
  {
    nombre: 'deshilachar',
    mundo: () => conElla([enElPiso(cuerpo('cuerda', 'liana', 1), { x: 0, y: 0 })], { holding: ['cuerda'] }),
    paso: { k: 'deshilachar', fuente: { k: 'id', id: 'cuerda' }, cuantas: 1, porQue: SIN_META, rinde: 'la-hebra' },
    ticks: 400,
    verificar: (p) => {
      // `split` NO consume la fuente: la cuerda sigue, y hay una hebra más.
      expect(p.state.bodies.has('cuerda')).toBe(true)
      expect(p.state.bodies.size).toBeGreaterThan(2)
    },
  },
  {
    nombre: 'aplicar',
    mundo: () => conElla([enElPiso(cuerpo('cuerda', 'liana', 1), { x: 0, y: 0 })], { holding: ['cuerda'] }),
    paso: {
      k: 'aplicar',
      proceso: 'deshilachar',
      roles: { source: { k: 'id', id: 'cuerda' }, actor: { k: 'yo' } },
      porQue: SIN_META,
      rinde: 'la-hebra',
    },
    ticks: 400,
  },
  {
    nombre: 'poner',
    mundo: () => conElla([enElPiso(cuerpo('vara', 'madera', 0.4), { x: 0, y: 0 })], { holding: ['vara'] }),
    paso: { k: 'poner', que: { k: 'id', id: 'vara' }, en: { k: 'celda', at: { x: 1, y: 0 } }, porQue: SIN_META },
    verificar: (p) => {
      expect(p.state.bodies.get('vara')?.at).toEqual({ x: 1, y: 0 })
      expect(p.state.bodies.get('vara')?.heldBy).toBeUndefined()
    },
  },
  {
    nombre: 'sostener',
    mundo: () => conElla([enElPiso(cuerpo('vara', 'madera', 0.4), { x: 2, y: 0 })]),
    paso: { k: 'sostener', que: { k: 'id', id: 'vara' }, porQue: SIN_META },
    verificar: (p) => {
      expect(p.state.actors.get('ella')?.holding).toContain('vara')
    },
  },
  {
    nombre: 'frotar',
    mundo: () =>
      conElla(
        [
          enElPiso(cuerpo('palo', 'madera', 0.3), { x: 0, y: 0 }),
          enElPiso(cuerpo('otro', 'madera-dura', 0.3), { x: 0, y: 0 }),
        ],
        { holding: ['palo', 'otro'], stamina: 1000 },
      ),
    // `hasta: 300` es el `ignitionPoint` de la madera, y se escribe para que el
    // campo opcional del `Step` viaje de verdad. Con un objetivo POR DEBAJO de la
    // ignición —60, que es lo que usa `las-quince`— la habilidad logra su contrato
    // igual, pero verificarlo desde afuera al final del vuelo da 33 °C: el
    // `drive` deja de empujar y la ley 1 relaja. Lo que dura es lo que prendió
    // (ADR II-0011), y por eso se apunta a la ignición.
    paso: { k: 'frotar', a: { k: 'id', id: 'palo' }, b: { k: 'id', id: 'otro' }, hasta: 300, porQue: SIN_META },
    ticks: 900,
    verificar: (p) => {
      expect(qualityOf(p.state.bodies.get('palo')!.body, 'temperature', p.state.phys)).toBeGreaterThanOrEqual(300)
    },
  },
  {
    nombre: 'huir (conducta)',
    mundo: () => conCelda(conElla(), { x: 0, y: 0 }, { wet: 0, oxygen: 1, temperature: 200 }),
    paso: { k: 'huir', porQue: 'esto quema' },
    verificar: (p) => {
      expect(p.state.bodies.get('ella-cuerpo')?.at).not.toEqual({ x: 0, y: 0 })
    },
  },
  {
    nombre: 'guarecerse (conducta)',
    // Un techo de arcilla tapando algo en (2,0): la celda queda con `sheltered`
    // por encima del umbral y `guarecerse` la encuentra con su barrido.
    mundo: () =>
      conElla([
        enElPiso(cuerpo('piedra', 'piedra', 1), { x: 2, y: 0 }),
        { body: cuerpo('techo', 'arcilla', 2), at: { x: 2, y: 0 }, covering: 'piedra' },
      ]),
    paso: { k: 'guarecerse', porQue: 'la noche viene' },
    verificar: (p) => {
      expect(p.proyeccion.indice.celda({ x: 2, y: 0 }).sheltered).toBeGreaterThanOrEqual(0.5)
    },
  },
]

interface Fila {
  readonly nombre: string
  readonly traduce: boolean
  readonly corre: boolean
  readonly ok: boolean
  readonly ticks: number
  readonly why: string
}

function correrCaso(c: Caso): Fila {
  const p = new Partida(c.mundo())
  const t = aHabilidad(c.paso, vistaDe(p, 'ella'))
  if (t === undefined) {
    return { nombre: c.nombre, traduce: false, corre: false, ok: false, ticks: 0, why: 'NO TRADUCE' }
  }
  const v = p.volar('ella', t.correr, undefined)
  const tope = c.ticks ?? 200
  let n = 0
  while (!v.terminado && n < tope) {
    p.avanzar(1)
    n++
  }
  const u = v.ultimo
  const corre = v.outcome !== undefined && u?.k === 'terminada'
  const ok = v.outcome?.ok === true
  if (ok) c.verificar?.(p)
  const why =
    u?.k === 'rota'
      ? `ROTA: ${u.why}`
      : v.outcome === undefined
        ? `NO TERMINÓ en ${String(tope)} ticks`
        : v.outcome.ok
          ? ''
          : v.outcome.why
  return { nombre: c.nombre, traduce: true, corre, ok, ticks: n, why }
}

describe('(d) una variante de cada una, traducida y CORRIDA contra el mundo real', () => {
  it('las doce que la escalera puede emitir, con la tabla', () => {
    const salida = CASOS.map(correrCaso)
    const tabla = salida
      .map(
        (r) =>
          `${r.nombre.padEnd(22)} ${r.traduce ? 'traduce' : 'NO-TRAD'} ${r.corre ? 'corre' : 'ROTA '} ` +
          `${r.ok ? 'logra ' : 'NO    '} ${String(r.ticks).padStart(4)}t  ${r.why}`,
      )
      .join('\n')
    const logran = salida.filter((r) => r.ok).length
    console.log(
      `\n─── LAS DOCE INTENCIONES DE LA ESCALERA, TRADUCIDAS Y CORRIDAS ───\n${tabla}\n\n` +
        `traducen 12/12 · logran su contrato ${String(logran)}/12\n`,
    )

    // LAS DOCE, y no diez: las diez `k` de `Step` más las dos `Conducta` que el
    // planificador no sabe nombrar y la escalera sí emite.
    expect(salida.length).toBe(12)
    expect(salida.filter((r) => !r.traduce)).toEqual([])
    expect(salida.filter((r) => !r.corre).map((r) => `${r.nombre}: ${r.why}`)).toEqual([])

    // La que no logra su contrato es `explorar`, y NO es un hueco de esta
    // traducción: es el `explore` del mundo, que es un ciclo cerrado de ocho
    // celdas —la suma de los ocho rumbos es (0,0)— y está medido con su `it.fails`
    // en `perceive/tests/las-quince.test.ts`. El número se reporta acá igual, y no
    // se esconde bajando el `maxTicks` hasta que el fallo se vea como un timeout.
    expect(salida.filter((r) => !r.ok).map((r) => r.nombre)).toEqual(['explorar'])
    expect(logran).toBe(11)
  })

  it('las diez `k` de `Step` están todas cubiertas, y se verifica contra el tipo', () => {
    // Un catálogo escrito a mano que nadie compara con el tipo se queda viejo el
    // día que `Step` gane una variante. Acá se compara: la lista de abajo es la
    // del encabezado de `@anima/plan`, y el `satisfies` la ata al tipo.
    const DIEZ = [
      'ir', 'juntar', 'deshilachar', 'unir', 'aplicar', 'comer', 'frotar', 'poner', 'sostener', 'explorar',
    ] as const satisfies readonly Step['k'][]
    const cubiertas = new Set(CASOS.map((c) => c.paso.k))
    expect([...DIEZ].filter((k) => !cubiertas.has(k))).toEqual([])
    expect(cubiertas.has('huir')).toBe(true)
    expect(cubiertas.has('guarecerse')).toBe(true)
  })
})

// ─── (6) EL PLAN QUE ENVEJECE ───────────────────────────────────────────────

describe('un `Ref` que no resuelve es «el plan envejeció», no un error', () => {
  it('la traducción contesta `undefined` y no inventa un cuerpo', () => {
    const p = new Partida(conElla())
    const v = vistaDe(p, 'ella')
    // Las tres formas de `Ref` que pueden no estar. `{k:'yo'}` y `{k:'celda'}` no
    // pueden fallar nunca: una es la criatura y la otra es una coordenada.
    expect(aHabilidad({ k: 'sostener', que: { k: 'id', id: 'fantasma' }, porQue: '' }, v)).toBeUndefined()
    expect(
      aHabilidad({ k: 'sostener', que: { k: 'donde', where: [{ q: 'nutrition', op: '>', v: 999 }] }, porQue: '' }, v),
    ).toBeUndefined()
    expect(aHabilidad({ k: 'sostener', que: { k: 'rinde', de: 'lo-que-nunca-hice' }, porQue: '' }, v)).toBeUndefined()
    // Y un proceso que la superficie no tipa tampoco se cuela hasta el mundo.
    expect(
      aHabilidad({ k: 'aplicar', proceso: 'alquimia', roles: {}, porQue: '' }, v),
    ).toBeUndefined()
  })

  // ─── EL PASO QUE EL PLAN SABE PEDIR Y NADIE SABE CORRER ───────────────────
  //
  // `armar` entró con `EsquemaDeObra` (ADR II-0023) y cerró el punto 3 del Gate
  // 5-6: el planificador emite un paso con la revisión exacta y los roles del plano
  // ligados. **Del otro lado no hay nadie todavía**: falta la innata `construir`,
  // que es la fragua del Hito 8.
  //
  // Se afirma acá y no se deja implícito porque un `undefined` sin test se
  // convierte en un olvido: el día que la innata exista, este bloque se pone rojo y
  // hay que venir a cambiarlo, que es exactamente lo que tiene que pasar.
  it('`armar` se PLANIFICA y no DESPEGA: la innata que lo corre todavía no existe', () => {
    const p = new Partida(conElla())
    const v = vistaDe(p, 'ella')
    expect(
      aHabilidad(
        {
          k: 'armar',
          revision: 'aaaaaaaabbbbbbbb',
          roles: { brazo: { k: 'id', id: 'vara' } },
          cuantos: { brazo: 1 },
          porQue: 'reach>=5',
        },
        v,
      ),
      'ya existe quien corre `armar`: sacale el `undefined` a `aHabilidad` y borrá este test',
    ).toBeUndefined()
  })

  it('la mente no despega, tira el plan, y el tick siguiente vuelve a decidir', () => {
    const p = new Partida(conElla([], { stamina: 900 }))
    const m = new Mente({ actor: 'ella', memoria: new Creencias() })
    // Un plan pendiente con un paso cuyo `Ref` no se puede verificar de antemano:
    // D1 sólo mira los `{k:'id'}` (los otros se resuelven al ejecutar), así que
    // este paso LLEGA a la traducción y se cae ahí. Es el camino que este archivo
    // vino a cubrir.
    m.estado.pasosPendientes = [
      { k: 'sostener', que: { k: 'donde', where: [{ q: 'nutrition', op: '>', v: 999 }] }, porQue: 'comida' },
    ]
    m.estado.metaEnCurso = 'inventada'

    const d = m.pensar(p)
    expect(d.por).toBe('D1')
    expect(m.despegues).toBe(0)
    expect(m.tropiezo).toContain('ya no está')
    // El plan se tiró entero: `aterrizar(e, false)` sobre un paso que no es de
    // fondo hace exactamente lo mismo que hace con un paso que el mundo rechazó.
    expect(m.estado.pasosPendientes).toEqual([])
    expect(m.estado.enVuelo).toBeUndefined()

    // Y el tick siguiente la criatura decide de nuevo y SÍ despega algo: no se
    // quedó tildada, que es de lo que se trata la decisión 2 de `tipos.ts`.
    p.avanzar(1)
    m.pensar(p)
    expect(m.despegues).toBe(1)
    expect(m.tropiezo).toBeUndefined()
  })
})

// ─── (7) EL HUECO QUE ESTE TRAMO NO CIERRA ──────────────────────────────────

describe('lo que la mente NO hace todavía', () => {
  it.fails('LA CRIATURA NO APRENDE DE LO QUE LE PASA: pesca doce veces y sigue diciendo n=0', () => {
    // POR QUÉ SIGUE ABIERTO: `AffordanceMemory.observe(ctx, rinde, ok)` existe y
    // esta mente no lo llama nunca, porque **no sabe con qué llamarlo**. Para
    // anotar «el pozo rindió carnoso» hacen falta la `ContextKey` del pozo y el
    // tag, y lo que viaja de D3 hasta acá es la FIRMA DEL PREDICADO
    // (`holding(tag:carnoso)`) y un `porque` en prosa. De la firma sale el tag
    // —está adentro del texto— pero no sale de qué cuerpo salió la oportunidad, y
    // sin el cuerpo no hay contexto: `contextoDe` necesita un id.
    //
    // MEDIDO: la corrida de abajo saca doce pescados del mismo banco y
    // `cuantasVeces` sobre `agua|mc--e → carnoso` sigue dando 0, o sea que la
    // criatura informa la misma confianza que tenía antes de pescar por primera
    // vez — `p=0,75, n=0` en el primer tick y `p=0,75, n=0` en el último.
    //
    // QUÉ HARÍA FALTA: que `Opportunity` viaje hasta la `Decision` —o que la
    // escalera se guarde de qué oportunidad salió la meta en curso— para que
    // quien aterriza el último paso del plan pueda anotar el éxito contra su
    // contexto. Es una reparación de `escalera.ts` y de `tipos.ts`, no de
    // `mente.ts`: por eso el hueco se mide acá y se arregla allá.
    const memoria = new Creencias()
    const r = correr(laEscenaDelDocumento(), 'ana', 400, memoria)
    const pescas = r.volados.filter((l) => l.endsWith('aplicar(extraccion)')).length
    expect(pescas).toBeGreaterThanOrEqual(10)
    const ctx = contextoDe(vistaDe(r.partida, 'ana'), 'pozo:-6:-6')
    expect(ctx).toBe('agua|mc--e')
    expect(cuantasVeces(memoria.belief(ctx, 'carnoso')), 'las pescas que la criatura recuerda').toBe(pescas)
  })
})

// ─── Cómo se leen los pasos ─────────────────────────────────────────────────

function resumir(s: Step): string {
  switch (s.k) {
    case 'ir':
      return `ir(${corto(s.a)})`
    case 'sostener':
      return `sostener(${corto(s.que)})`
    case 'unir':
      return `unir(binder=${corto(s.binder)}, a=${corto(s.a)})`
    case 'deshilachar':
      return `deshilachar(${corto(s.fuente)})`
    case 'aplicar':
      return `aplicar(${s.proceso})`
    default:
      return s.k
  }
}

function corto(r: { readonly k: string; readonly id?: string; readonly de?: string }): string {
  if (r.k === 'id') return r.id ?? '?'
  if (r.k === 'rinde') return 'lo-que-hice'
  return r.k
}
