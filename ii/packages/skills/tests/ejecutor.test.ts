import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { instrument, mount } from '../src/combustible.js'
import { shadowScope } from '../src/aislamiento.js'
import { SkillRun, createSkillState, hashTrace, installSkillState, type WorldCtx } from '../src/ejecutor.js'
import { done, fail, type Ctx, type Intent, type Outcome, type Skill, type StepResult } from '../src/ctx.js'

/**
 * EL EJECUTOR — Hito 4.
 *
 * Se prueba SIN mundo, con un mundo de mentira de veinte renglones, y eso no es
 * una limitación del test: es la forma del diseño. El ejecutor no tiene el bucle
 * —lo tiene el mundo— así que su conducta entera se puede provocar desde afuera
 * pasándole `StepResult` a mano, que es exactamente lo que el juez va a hacer
 * cuando corra cuarenta mundos.
 *
 * Lo que verifica, en orden de importancia:
 *
 *   - una habilidad corrida dos veces da el mismo hash (criterio del Hito 4);
 *   - una habilidad interrumpida por un guardado CONVIERGE, sin comparar
 *     hashes, que es la «continuidad débil» que el documento declara débil a
 *     propósito;
 *   - `ctx.memory` es la única sede de estado que sobrevive, y lo que no
 *     sobrevive revienta al escribirse y no al cargar la partida;
 *   - `ctx.phase()` viaja con el informe de fallo, que es lo que convierte
 *     «falló» en «muere en buscar-agua 9 de 10 veces».
 */

// ─── El mundo de mentira ────────────────────────────────────────────────────

/**
 * `Ctx` tiene veintipico de miembros que pone el mundo y que este archivo no
 * ejercita. El casteo es la forma honesta de decirlo: lo que se está probando es
 * el ejecutor, no la superficie. Cuando exista `@anima/perceive` esto se
 * reemplaza por su contexto de verdad y el test no se toca.
 */
function mundoFalso(campos: Record<string, unknown> = {}): WorldCtx {
  return { tick: 0, ...campos } as unknown as WorldCtx
}

const intento = (k: 'goTo' | 'apply' | 'wait', seq: number): Intent =>
  ({ k, by: 'criatura', seq, commitment: 'reversible', to: { x: 1, y: 1 }, within: 1 }) as unknown as Intent

const resultado = (status: StepResult['status'], got = 0): StepResult => ({
  status,
  got: Array.from({ length: got }, (_, i) => ({ id: `pez-${i}` })) as unknown as StepResult['got'],
})

/**
 * La forma del ejemplo canónico del documento, sin mundo: buscar, ir, y tirar
 * hasta cuarenta veces. Lleva la cuenta de los intentos EN `ctx.memory`, que es
 * lo que le permite retomar tras un guardado sin volver a tirar cuarenta veces.
 */
function* pescar(ctx: Ctx, args: { readonly tiradas: number }): Generator<Intent, Outcome, StepResult> {
  ctx.phase('ir')
  const ir = yield intento('goTo', 0)
  if (ir.status !== 'arrived') return fail('no llegué')

  ctx.phase('pescar')
  const yaIntente = ctx.memory.get<number>('intentos') ?? 0
  for (let i = yaIntente; i < args.tiradas; i++) {
    ctx.memory.set('intentos', i)
    const o = yield intento('apply', i + 1)
    if (o.got.length > 0) {
      ctx.memory.del('intentos')
      return done()
    }
  }
  return fail('no picó')
}

/** Corre una habilidad contra un mundo que contesta según el paso. */
function correrHasta(
  run: SkillRun<{ readonly tiradas: number }>,
  contestar: (n: number) => StepResult,
  tope = 500,
): { pasos: number; outcome: Outcome | undefined } {
  let pasos = 0
  let paso = run.step()
  while (paso.k === 'intent' || paso.k === 'suspendida') {
    if (pasos++ > tope) throw new Error('no terminó')
    paso = paso.k === 'intent' ? run.step(contestar(pasos)) : run.step()
  }
  return { pasos, outcome: paso.k === 'terminada' ? paso.outcome : undefined }
}

// ─── Los tests ──────────────────────────────────────────────────────────────

describe('la máquina de estados', () => {
  it('cede intenciones, recibe resultados y termina', () => {
    const run = new SkillRun(pescar as Skill<{ tiradas: number }>, mundoFalso(), { tiradas: 40 })
    const p1 = run.step()
    expect(p1.k).toBe('intent')
    expect(run.status).toBe('esperando')
    expect(run.phase).toBe('ir')

    const p2 = run.step(resultado('arrived'))
    expect(p2.k).toBe('intent')
    expect(run.phase).toBe('pescar')

    const p3 = run.step(resultado('done', 1))
    expect(p3).toEqual({ k: 'terminada', outcome: { ok: true } })
    expect(run.status).toBe('terminada')
  })

  it('no deja avanzar una habilidad que espera al mundo sin contestarle', () => {
    // Inventarle un resultado a una intención que el mundo todavía no resolvió
    // es cómo una habilidad termina creyendo que llegó a un lugar donde nunca
    // estuvo, y eso se descubre dos mil ticks después o no se descubre.
    const run = new SkillRun(pescar as Skill<{ tiradas: number }>, mundoFalso(), { tiradas: 40 })
    run.step()
    expect(() => run.step()).toThrow(/esperando al mundo/)
  })

  it('no deja contestarle a una habilidad que no pidió nada', () => {
    const run = new SkillRun(pescar as Skill<{ tiradas: number }>, mundoFalso(), { tiradas: 40 })
    expect(() => run.step(resultado('arrived'))).toThrow(/no cedió ninguna intención/)
  })

  it('una habilidad terminada no se avanza más', () => {
    const run = new SkillRun(pescar as Skill<{ tiradas: number }>, mundoFalso(), { tiradas: 1 })
    correrHasta(run, () => resultado('arrived', 1))
    expect(() => run.step()).toThrow(/terminada/)
  })

  it('el fallo viaja con la FASE en la que murió', () => {
    function* rompe(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
      ctx.phase('buscar-agua')
      throw new Error('el paisaje no tiene agua')
    }
    const run = new SkillRun(rompe as Skill<undefined>, mundoFalso(), undefined)
    const paso = run.step()
    expect(paso.k).toBe('rota')
    if (paso.k === 'rota') {
      expect(paso.phase).toBe('buscar-agua')
      expect(paso.why).toContain('no tiene agua')
    }
  })

  it('`abort` corre los `finally` de la habilidad', () => {
    let limpio = false
    function* conFinally(): Generator<Intent, Outcome, StepResult> {
      try {
        yield intento('wait', 0)
        return done()
      } finally {
        limpio = true
      }
    }
    const run = new SkillRun(conFinally as Skill<undefined>, mundoFalso(), undefined)
    run.step()
    const paso = run.abort('la revocaron')
    expect(limpio).toBe(true)
    expect(paso).toEqual({ k: 'terminada', outcome: { ok: false, why: 'la revocaron' } })
  })
})

describe('ctx.memory: la única sede de estado que sobrevive', () => {
  it('guarda, lee y borra, y el volcado es canónico', () => {
    const s = createSkillState()
    s.memory.set('pozo', { x: 3, y: 4 })
    s.memory.set('intentos', 7)
    s.memory.set('a-borrar', true)
    s.memory.del('a-borrar')
    expect(s.memory.get<{ x: number }>('pozo')).toEqual({ x: 3, y: 4 })
    // Las claves salen ORDENADAS: dos partidas que llegaron al mismo estado por
    // caminos distintos tienen que dar el mismo texto, o el hash del guardado
    // miente. Es la misma razón por la que `@anima/world/hash.ts` ordena.
    expect(Object.keys(s.save().memory)).toEqual(['intentos', 'pozo'])
  })

  it('rechaza lo que no sobrevive a un guardado, con la clave adelante', () => {
    // El modo de falla que esto ataja es silencioso: `set('pozo', agua)` —el
    // cuerpo entero en vez de su celda— «anda» toda la partida y falla recién al
    // cargar, con un `BodyView` fantasma cuyo `id` ya no existe.
    const s = createSkillState()
    const cuerpo = Object.create({ id: 'lago' }) as object
    expect(() => s.memory.set('pozo', cuerpo)).toThrow(/no sobrevive a un guardado/)
    expect(() => s.memory.set('cb', () => 1)).toThrow(/pozo|cb/)
    const ciclo: Record<string, unknown> = {}
    ciclo['yo'] = ciclo
    expect(() => s.memory.set('ciclo', ciclo)).toThrow()
    expect(() => s.memory.set('nan', Number.NaN)).toThrow()
  })

  it('las claves de la casa están reservadas', () => {
    expect(() => createSkillState().memory.set('@phase', 1)).toThrow(/reservada/)
  })

  it('dos habilidades no pueden compartir un ctx, porque compartirían la memoria', () => {
    const base = mundoFalso()
    installSkillState(base, createSkillState())
    expect(() => installSkillState(base, createSkillState())).toThrow(/cada habilidad en vuelo/)
  })
})

describe('el criterio del Hito 4: corrida dos veces, el mismo hash', () => {
  const correrDosVeces = (tiradas: number, picaEn: number): string[] =>
    [0, 1].map((_) => {
      const run = new SkillRun(pescar as Skill<{ tiradas: number }>, mundoFalso(), { tiradas })
      correrHasta(run, (n) => (n === 1 ? resultado('arrived') : resultado('done', n === picaEn ? 1 : 0)))
      return run.hash()
    })

  it('dos corridas iguales dan el mismo hash', () => {
    const [a, b] = correrDosVeces(40, 5)
    expect(a).toBe(b)
    expect(a).toHaveLength(16)
  })

  it('una corrida distinta da otro hash', () => {
    // La otra mitad: un hash que siempre da igual es un hash que no mide nada.
    const [a] = correrDosVeces(40, 5)
    const [c] = correrDosVeces(40, 9)
    expect(a).not.toBe(c)
  })

  it('la traza distingue el orden y no solo el contenido', () => {
    const uno = hashTrace([
      { k: 'phase', v: 'ir' },
      { k: 'phase', v: 'pescar' },
    ])
    const otro = hashTrace([
      { k: 'phase', v: 'pescar' },
      { k: 'phase', v: 'ir' },
    ])
    expect(uno).not.toBe(otro)
  })
})

describe('continuidad: una habilidad interrumpida por un guardado converge', () => {
  it('retoma desde su fase y repite poco', () => {
    // Es el test que el documento escribe con nombre y apellido, y su criterio
    // NO es «reproduce el final exacto» sino «termina el objetivo»: un generador
    // suspendido no se serializa en ningún motor de JS, así que las locales se
    // pierden y la habilidad vuelve a arrancar de arriba. Lo que se mide es
    // cuánto trabajo repite.
    const PICA_EN = 30
    const mundo = (n: number): StepResult =>
      n === 1 ? resultado('arrived') : resultado('done', n === PICA_EN ? 1 : 0)

    const sinCortar = new SkillRun(pescar as Skill<{ tiradas: number }>, mundoFalso(), { tiradas: 40 })
    const entero = correrHasta(sinCortar, mundo)
    expect(entero.outcome?.ok).toBe(true)

    // Ahora, con un guardado a mitad de camino.
    const antes = new SkillRun(pescar as Skill<{ tiradas: number }>, mundoFalso(), { tiradas: 40 })
    antes.step()
    antes.step(resultado('arrived'))
    for (let i = 0; i < 10; i++) antes.step(resultado('done', 0))
    const guardado = antes.save()
    expect(guardado.phase).toBe('pescar')
    expect(guardado.memory['intentos']).toBe(10)

    // …y la partida se carga: habilidad NUEVA, generador NUEVO, memoria vieja.
    const despues = new SkillRun(pescar as Skill<{ tiradas: number }>, mundoFalso(), { tiradas: 40 }, {
      saved: guardado,
    })
    let tiradasTrasCargar = 0
    const cortado = correrHasta(despues, (n) => {
      if (n === 1) return resultado('arrived')
      tiradasTrasCargar++
      return resultado('done', tiradasTrasCargar + 10 === PICA_EN ? 1 : 0)
    })

    expect(cortado.outcome?.ok).toBe(true) // termina el objetivo
    expect(cortado.pasos).toBeLessThan(entero.pasos) // y repite POCO: retomó en la 10
    expect(despues.save().memory['intentos']).toBeUndefined() // limpió la cuenta al lograrlo
  })

  it('sin memoria, la misma habilidad repite TODO el trabajo', () => {
    // El contraste que hace que el test de arriba signifique algo: si la cuenta
    // viviera en una variable local, cargar la partida volvería a tirar las
    // cuarenta veces. Es el argumento de por qué `ctx.memory` existe.
    function* pescarSinMemoria(ctx: Ctx, args: { readonly tiradas: number }): Generator<Intent, Outcome, StepResult> {
      ctx.phase('pescar')
      for (let i = 0; i < args.tiradas; i++) {
        const o = yield intento('apply', i)
        if (o.got.length > 0) return done()
      }
      return fail('no picó')
    }
    const run = new SkillRun(pescarSinMemoria as Skill<{ tiradas: number }>, mundoFalso(), { tiradas: 40 })
    for (let i = 0; i < 10; i++) run.step(i === 0 ? undefined : resultado('done', 0))
    const guardado = run.save()
    expect(guardado.memory).toEqual({})
    expect(guardado.phase).toBe('pescar')
  })
})

describe('el combustible visto desde el ejecutor', () => {
  /** Monta una habilidad como lo hace el juez: instrumentada y con sombras. */
  function montarHabilidad(fuente: string): { skill: Skill<undefined>; cell: ReturnType<typeof mount>['cell'] } {
    const m = mount(instrument(ts, fuente).js, { scope: shadowScope() })
    return { skill: m.exports['habilidad'] as Skill<undefined>, cell: m.cell }
  }

  it('un `while (true)` plantado suspende en vez de colgar el cuadro', () => {
    const { skill, cell } = montarHabilidad('export function* habilidad(ctx) { while (true) { ctx.tick } }')
    const run = new SkillRun(skill, mundoFalso(), undefined, { cell, fuelPerStep: 500, maxStalls: 3 })
    const p = run.step()
    expect(p.k).toBe('suspendida')
    if (p.k === 'suspendida') expect(p.spent).toBeGreaterThan(0)
    expect(run.status).toBe('suspendida')
  })

  it('y a las N suspensiones seguidas se la declara trabada', () => {
    // El combustible solo no puede dar este corte: un bucle infinito en el
    // cuerpo de la habilidad cede prolijamente para siempre, o sea que nunca
    // muere y nunca hace nada. Desde afuera se ve igual que colgarse, pero sin
    // caer un cuadro; el que lo mata es este tope.
    const { skill, cell } = montarHabilidad('export function* habilidad(ctx) { while (true) { ctx.tick } }')
    const run = new SkillRun(skill, mundoFalso(), undefined, { cell, fuelPerStep: 500, maxStalls: 3 })
    let paso = run.step()
    let vueltas = 0
    while (paso.k === 'suspendida' && vueltas++ < 20) paso = run.step()
    expect(paso.k).toBe('rota')
    if (paso.k === 'rota') expect(paso.why).toMatch(/trabada/)
    expect(run.steps).toBe(4) // las tres suspensiones toleradas, más la que rompe
  })

  it('quedarse sin combustible en una función común mata la habilidad, con nombre', () => {
    const { skill, cell } = montarHabilidad(`
      export function* habilidad(ctx) {
        const machacar = () => { let n = 0; while (true) { n++ } }
        ctx.phase('machacar')
        machacar()
        yield 1
      }
    `)
    const run = new SkillRun(skill, mundoFalso(), undefined, { cell, fuelPerStep: 2_000 })
    const paso = run.step()
    expect(paso.k).toBe('rota')
    if (paso.k === 'rota') {
      expect(paso.why).toMatch(/combustible/)
      expect(paso.phase).toBe('machacar')
    }
  })

  it('una habilidad que computa mucho pero cede termina igual', () => {
    // Suspender no puede cambiar el RESULTADO, solo cuántos pasos lleva. Si lo
    // cambiara, el juez estaría midiendo el presupuesto y no la habilidad.
    const { skill, cell } = montarHabilidad(`
      export function* habilidad(ctx) {
        let s = 0
        for (let i = 0; i < 5000; i++) s += i
        yield 1
        return { ok: true, got: s }
      }
    `)
    const run = new SkillRun(skill, mundoFalso(), undefined, { cell, fuelPerStep: 600, maxStalls: 100 })
    let paso = run.step()
    let suspensiones = 0
    while (paso.k === 'suspendida') {
      suspensiones++
      paso = run.step()
    }
    expect(suspensiones).toBeGreaterThan(5)
    expect(paso.k).toBe('intent')
    const fin = run.step(resultado('done'))
    expect(fin.k).toBe('terminada')
    // Doble cast a propósito y con su porqué: la habilidad de este test es JS
    // crudo montado en el sandbox y devuelve `got: number`, no un `BodyView`.
    // `Outcome` es una unión y su rama falsa no tiene `got`, así que `tsc` no
    // deja pasar el cast directo — y hace bien: en código real ese acceso es el
    // bug de leer `got` sin haber mirado `ok`.
    if (fin.k === 'terminada') expect((fin.outcome as unknown as { got: number }).got).toBe(12_497_500)
  })
})
