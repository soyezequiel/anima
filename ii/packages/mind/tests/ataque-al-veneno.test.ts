// ─── ATAQUE AL VENENO — el adversario del ADR II-0013 ───────────────────────
//
//   pnpm --filter @anima/mind test
//
// El ADR II-0013 hizo que tragar COBRE: `toxicity · masa · 25` de `stamina`, por
// separado de lo que las calorías acreditan. Este archivo lo ataca por los seis
// frentes que el tramo pidió, y lo que encontró se puede decir en una línea:
//
//   **EL ÚNICO BOCADO GRATIS DEL MUNDO ES LA CRIATURA MISMA.**
//
// El cobro cierra por todos lados —masa cero, toxicidad negativa, la mano ajena,
// dos comensales en un tick, el libro del guardián— salvo por uno: `intencionComer`
// acredita, saca el cuerpo del mundo y RECIÉN AHÍ busca al comensal para cobrarle.
// Si el cuerpo que sacó ERA el del comensal, `cuerpoDe` devuelve `undefined`, el
// `if (lleno !== undefined)` se traga el cobro sin una palabra, y el actor sigue
// vivo sin cuerpo para siempre. Los 15,00 de `stamina` que la carne cruda debía no
// los paga nadie.
//
// Y no es una intención que haya que fabricar a mano: `ctx.see` le muestra a la
// criatura su propio cuerpo con MÁS calorías que el pescado de al lado, `juntar`
// se lo pone en la mano en el primer despegue, y la innata `comer` lo mira antes
// que nada. Lo único que hay hoy entre la criatura y comerse sola es que la carne
// cruda tiene `toxicity` 0,30 y `comer` tolera 0,20 por omisión — un accidente de
// dos números, que la cocción, un `toxicidadTolerada` más alto (el ADR II-0013 lo
// convirtió en perilla legítima: «una criatura desesperada puede elegir
// envenenarse») o cualquier habilidad que escriba el modelo hacen desaparecer.
//
// Los seis bloques:
//
//   (1) EL BOCADO GRATIS. El mundo deja comerse el propio cuerpo, no cobra el
//       veneno, rompe `revisarInvariantes` y deja un fantasma inmortal.
//   (2) Y LA SUPERFICIE LO OFRECE. `see`, `juntar` y `comer`, medidos.
//   (3) EL SEGUNDO CERROJO NO EXISTE. `oportunidades.ts:146` afirma que la cuenta
//       del veneno excluiría al propio cuerpo aunque `lugares()` no lo hiciera.
//       Es verdad para la carne cruda y falsa para la cocida: +17,05.
//   (4) LO QUE SÍ AGUANTA. Cinco contrapruebas que el cobro pasa limpio, para que
//       el hallazgo no se lea como «esto está roto».
//   (5) EL TECHO DEL GUARDIÁN. `convierte` declara lo que quiso acreditar y no lo
//       que acreditó, y el techo de `conservada-aumento` se infla con la
//       diferencia.
//   (6) NADIE CORRE EL ARNÉS. `exigirInvariantes` no se llama en una sola línea de
//       `src/` de `ii/`, ni en la corrida de 20.000 ticks del criterio.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Body } from '@anima/physics'
import { qualityOf, SUSTANCIAS_SEMILLA } from '@anima/physics'
import type { Where } from '@anima/skills'
import { Contexto, Partida } from '@anima/perceive'
import { comer, juntar } from '@anima/skills/innatas'
import type { SimEvent, WorldState } from '@anima/world'
import {
  COSTO_POR_TOXICIDAD_Y_KILO,
  STAMINA_POR_CALORIA,
  eat,
  revisarInvariantes,
  stepWorld,
} from '@anima/world'

import type { VistaDeLaMente } from '../src/tipos.js'
import { actor, criatura, cuerpo, enElPiso, enLaMano, mundo, PHYS } from './mundo.js'

const c4 = (x: number): string => x.toFixed(4)

function vistaDe(p: Partida, quien: string): VistaDeLaMente {
  return new Contexto(p.proyeccion, { actor: quien, rng: p.dado.tirar, lugares: p.lugares }).ctx
}

/** Los eventos de un tick, sin el `gasto` del libro, que es ruido para leer. */
function clases(events: readonly SimEvent[]): readonly string[] {
  return events.filter((e) => e.k !== 'gasto').map((e) => e.k)
}

function stamina(w: WorldState, id: string): number {
  const c = w.bodies.get(id)
  return c === undefined ? Number.NaN : qualityOf(c.body, 'stamina', w.phys)
}

function log(lineas: readonly string[]): void {
  console.log('\n' + lineas.join('\n') + '\n')
}

// ═══ (1) EL BOCADO GRATIS ════════════════════════════════════════════════════

/** Una criatura sola, y el `eat` sobre su propio cuerpo. Es todo el ataque. */
function seComeSola(): { readonly antes: WorldState; readonly r: ReturnType<typeof stepWorld> } {
  const antes = mundo({
    bodies: [enElPiso(criatura('ana', 500), { x: 0, y: 0 })],
    actors: [actor('ana')],
  })
  return { antes, r: stepWorld(antes, [eat({ by: 'ana', seq: 0 }, 'ana-cuerpo')]) }
}

describe('(1) el único bocado gratis del mundo era la criatura misma — CERRADO', () => {
  it('el mundo RECHAZA el `eat` sobre el propio cuerpo, con `es-uno-mismo`', () => {
    const { antes, r } = seComeSola()
    // La carne cruda de la criatura: 2 kg, `toxicity` 0,30. Lo que el ADR manda
    // cobrar es `toxicity · masa · K`, y se calcula del catálogo y no a mano. Es la
    // deuda que el agujero perdonaba, y va en la salida porque es el tamaño de lo
    // que estaba en juego: el único bocado del mundo con neto positivo garantizado.
    const carne = SUSTANCIAS_SEMILLA.find((s) => s.id === 'carne')
    const tox = carne?.perUnitMass.toxicity ?? 0
    const deuda = tox * 2 * COSTO_POR_TOXICIDAD_Y_KILO
    const violaciones = revisarInvariantes(antes, r.state, r.events)
    const rech = r.events.find((e) => e.k === 'rechazada')
    log([
      '══ (1) COMERSE A SÍ MISMA ═══════════════════════════════════════════',
      `  eventos ............ ${clases(r.events).join(' · ')}`,
      `  motivo ............. ${rech?.k === 'rechazada' ? rech.por : '—'}`,
      `  cuerpos después .... [${[...r.state.bodies.keys()].join(', ')}]`,
      `  actores después .... [${[...r.state.actors.keys()].join(', ')}]`,
      `  la deuda que se perdonaba: ${c4(deuda)} de stamina (toxicity ${c4(tox)} × 2 kg × K ${String(COSTO_POR_TOXICIDAD_Y_KILO)})`,
      `  violaciones ........ ${violaciones.map((v) => v.k).join(' · ') || '(ninguna)'}`,
      '',
      '  ANTES: `intencionComer` acreditaba, llamaba a `sacarCuerpo` y RECIÉN AHÍ',
      '  volvía a buscar al comensal con `cuerpoDe` para cobrarle. Cuando el cuerpo',
      '  que sacó era el del comensal, `cuerpoDe` devolvía `undefined` y el',
      '  `if (lleno !== undefined)` se comía el cobro sin rechazo y sin evento.',
      '  AHORA: la guarda va ANTES de acreditar, y el motivo es propio —`es-uno-mismo`—',
      '  y no `nada-que-comer`, porque las dos situaciones piden decisiones opuestas.',
    ])
    // El acto no sale. Y no sale ANTES de tocar nada: no hay `comio` ni `convierte`.
    expect(clases(r.events)).toEqual(['rechazada'])
    expect(rech?.k === 'rechazada' ? rech.por : '').toBe('es-uno-mismo')
    expect(r.events.some((e) => e.k === 'comio')).toBe(false)
    expect(r.events.some((e) => e.k === 'convierte')).toBe(false)
    expect(deuda).toBeGreaterThan(0)
    // El actor sigue en el mundo, y su cuerpo también.
    expect(r.state.actors.has('ana')).toBe(true)
    expect(r.state.bodies.has('ana-cuerpo')).toBe(true)
    // Y el arnés no tiene nada que decir, que es la otra mitad de la reparación.
    expect(violaciones).toEqual([])
  })

  it('y NO queda un fantasma: 500 ticks después sigue teniendo cuerpo, y sigue adelgazando', () => {
    const { r } = seComeSola()
    let w = r.state
    let violacionesEnLaCorrida = 0
    const alientoInicial = stamina(w, 'ana-cuerpo')
    for (let t = 0; t < 500; t++) {
      const paso = stepWorld(w, [])
      violacionesEnLaCorrida += revisarInvariantes(w, paso.state, paso.events).length
      w = paso.state
    }
    log([
      '══ (1b) EL FANTASMA QUE YA NO ESTÁ ══════════════════════════════════',
      `  tras 500 ticks: actores [${[...w.actors.keys()].join(', ')}] · cuerpos [${[...w.bodies.keys()].join(', ')}]`,
      `  aliento ${c4(alientoInicial)} → ${c4(stamina(w, 'ana-cuerpo'))} — el metabolismo le cobra, o sea que se puede morir`,
      `  violaciones acumuladas en la corrida: ${String(violacionesEnLaCorrida)}`,
      '',
      '  ANTES eran 500, una por tick: el metabolismo cobra sobre el CUERPO, así que',
      '  una criatura sin cuerpo no tenía de dónde perder aliento y no se moría nunca,',
      '  ni de hambre ni de nada. Y `inventario-inconsistente` no es un aviso que se',
      '  dispara una vez: sale en TODOS los ticks siguientes, porque es una pregunta',
      '  sobre el estado y no sobre el paso. Eso importa porque el criterio del Hito 5',
      '  detecta la muerte con `state.actors.has(quien)`: el fantasma contaba como VIVO.',
    ])
    expect(w.actors.has('ana')).toBe(true)
    expect(w.bodies.has('ana-cuerpo')).toBe(true)
    expect(stamina(w, 'ana-cuerpo')).toBeLessThan(alientoInicial)
    expect(violacionesEnLaCorrida).toBe(0)
  })

  it('y el cobro ya no depende de que el cuerpo del comensal siga existiendo', () => {
    // La otra mitad de la reparación, y es INDEPENDIENTE de la guarda: el crédito y
    // el cobro se calculan sobre el cuerpo YA ALIMENTADO, antes de `sacarCuerpo`, y
    // se escriben de una sola vez. Ya no hay un `if (… !== undefined)` que se pueda
    // comer el cobro en silencio. Se mide en el caso que MÁS se le parece al que
    // estaba roto: la criatura come el cuerpo sobre el que está APOYADA, o sea el
    // que `sacarCuerpo` va a hacer reescribir por `olvidar` mientras la cuenta corre.
    const at = { x: 0, y: 0 }
    const w = mundo({
      bodies: [
        { ...enElPiso(criatura('ana', 500), at), supportedBy: 'pez' },
        enElPiso(cuerpo('pez', 'pescado', 2, {}, 'bloque'), at),
      ],
      actors: [actor('ana')],
    })
    const r = stepWorld(w, [eat({ by: 'ana', seq: 0 }, 'pez')])
    const ven = r.events.find((e) => e.k === 'enveneno')
    const cobrado = ven?.k === 'enveneno' ? ven.cobrado : 0
    log([
      '══ (1c) EL COBRO NO SE ESCAPA ═══════════════════════════════════════',
      `  eventos: ${clases(r.events).join(' · ')}`,
      `  cobrado: ${c4(cobrado)} (0,25 × 2 kg × ${String(COSTO_POR_TOXICIDAD_Y_KILO)})`,
      `  el cuerpo de ana quedaba apoyado sobre el pez: \`olvidar\` le reescribe la entrada`,
      `  supportedBy después: ${String(r.state.bodies.get('ana-cuerpo')?.supportedBy)}`,
      `  violaciones: ${revisarInvariantes(w, r.state, r.events).map((v) => v.k).join(' · ') || '(ninguna)'}`,
    ])
    expect(cobrado).toBeCloseTo(12.5, 6)
    expect(r.state.bodies.get('ana-cuerpo')?.supportedBy).toBeUndefined()
    expect(revisarInvariantes(w, r.state, r.events)).toEqual([])
  })
})

// ═══ (2) Y LA SUPERFICIE LO OFRECE ═══════════════════════════════════════════

describe('(2) no hay que fabricar la intención: la superficie la sirve', () => {
  it('`ctx.see(calories>0)` devuelve el propio cuerpo, y con MÁS calorías que el pescado', () => {
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 300), { x: 0, y: 0 }),
        enElPiso(cuerpo('pez', 'pescado', 1.5, {}, 'bloque'), { x: 1, y: 0 }),
      ],
      actors: [actor('ana')],
    })
    const p = new Partida(w)
    const v = vistaDe(p, 'ana')
    const visto = v.see([{ q: 'calories', op: '>', v: 0 }])
    log([
      '══ (2a) LO QUE VE ═══════════════════════════════════════════════════',
      ...visto.map(
        (b) =>
          `  ${b.id.padEnd(12)} cal=${c4(v.q(b, 'calories'))} tox=${c4(v.q(b, 'toxicity'))} heldBy=${String(b.heldBy)}`,
      ),
      `  self.id = ${v.self.id}`,
      '',
      '  `Proyeccion.aLaVista` no excluye al propio cuerpo, y la innata `comer`',
      '  ordena por calorías descendentes. La criatura es el bocado más gordo que ve.',
    ])
    expect(visto.map((b) => b.id)).toContain('ana-cuerpo')
    const yo = visto.find((b) => b.id === 'ana-cuerpo')
    const pez = visto.find((b) => b.id === 'pez')
    expect(yo).toBeDefined()
    expect(pez).toBeDefined()
    expect(v.q(yo as never, 'calories')).toBeGreaterThan(v.q(pez as never, 'calories'))
  })

  it('`juntar({fuelEnergy>0})` se pone el propio cuerpo en la mano, en el primer despegue', () => {
    // No es una hipótesis: el comentario de `oportunidades.ts:530` lo declara
    // medido —«primer agarre del propio cuerpo en el tick 2»— y acá se vuelve a
    // correr, porque un hueco citado no es un hueco medido.
    const w = mundo({
      bodies: [enElPiso(criatura('ana', 300), { x: 0, y: 0 })],
      actors: [actor('ana')],
    })
    const p = new Partida(w)
    const que: Where = [{ q: 'fuelEnergy', op: '>', v: 0 }]
    const vuelo = p.volar('ana', juntar, { que, cuantos: 1 })
    p.avanzar(8)
    log([
      '══ (2b) LA MANO ═════════════════════════════════════════════════════',
      `  juntar → ${JSON.stringify(vuelo.outcome)}`,
      `  en la mano: [${(p.state.actors.get('ana')?.holding ?? []).join(', ')}]`,
      '',
      '  Y `comer` mira `ctx.self.holding` ANTES que lo que ve, «porque no cuesta',
      '  caminar». O sea que el propio cuerpo no compite con la comida: le gana.',
    ])
    expect(p.state.actors.get('ana')?.holding).toEqual(['ana-cuerpo'])
  })

  it('CON LA PERILLA QUE EL ADR HABILITÓ: `toxicidadTolerada` 0,35, y ahora se come el PESCADO', () => {
    // El ADR II-0013 dice, con todas las letras: «el parámetro `toxicidadTolerada`
    // pasa a significar lo que su nombre dice: una criatura desesperada puede
    // elegir envenenarse, y ahora paga». Con 0,35 —por debajo de valores que la
    // propia `mordidaDe` de este paquete calcula todos los ticks— la criatura antes
    // no pagaba: DESAPARECÍA. Se comía a sí misma, `comer` devolvía `ok: true`, el
    // pescado quedaba intacto y el mundo se quedaba con un actor sin cuerpo.
    //
    // Con el filtro de `comer.ts` puesto, la misma perilla y la misma escena eligen
    // lo único que era comida: el pescado. Y el veneno se cobra, que es el punto
    // entero del ADR.
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 300), { x: 0, y: 0 }),
        enElPiso(cuerpo('pez', 'pescado', 1.5, {}, 'bloque'), { x: 1, y: 0 }),
      ],
      actors: [actor('ana')],
    })
    const p = new Partida(w, { vigilar: true })
    const vuelo = p.volar('ana', comer, { toxicidadTolerada: 0.35 })
    p.avanzar(6)
    log([
      '══ (2c) LA CADENA ENTERA, CON LA INNATA DE VERDAD ═══════════════════',
      `  outcome ....... ${JSON.stringify(vuelo.outcome)}`,
      `  actores ....... [${[...p.state.actors.keys()].join(', ')}]`,
      `  cuerpos ....... [${[...p.state.bodies.keys()].join(', ')}]`,
      `  violaciones ... ${p.violaciones.join(' · ') || '(ninguna, y AHORA se están mirando: `vigilar: true`)'}`,
      '',
      '  ANTES: el pescado seguía ahí, la criatura no, y `comer` devolvía `ok: true`.',
    ])
    expect(vuelo.outcome?.ok).toBe(true)
    expect(p.state.bodies.has('ana-cuerpo')).toBe(true)
    expect(p.state.bodies.has('pez')).toBe(false)
    expect(p.state.actors.has('ana')).toBe(true)
    expect(p.violaciones).toEqual([])
  })

  it('y si le PONEN el propio cuerpo como bocado, lo rechaza por nombre: «ése soy yo»', () => {
    // El filtro no está sólo en la elección: `args.bocado` es la puerta por la que
    // otra habilidad —o la escalera de `@anima/mind`— le pasa un cuerpo ya elegido,
    // y ahí no hay ninguna lista que filtrar. Tiene su propio rechazo, y con su
    // propia frase, porque «carne cruda no alimenta» sería mentira: alimenta.
    const w = mundo({
      bodies: [enElPiso(criatura('ana', 300), { x: 0, y: 0 })],
      actors: [actor('ana')],
    })
    const p = new Partida(w, { vigilar: true })
    const v = vistaDe(p, 'ana')
    const yo = v.see([{ q: 'calories', op: '>', v: 0 }]).find((b) => b.id === 'ana-cuerpo')
    expect(yo).toBeDefined()
    if (yo === undefined) throw new Error('`see` dejó de devolver el propio cuerpo')
    const vuelo = p.volar('ana', comer, { bocado: yo, toxicidadTolerada: 0.9 })
    p.avanzar(4)
    log([
      '══ (2d) EL BOCADO SERVIDO EN BANDEJA ════════════════════════════════',
      `  comer({ bocado: <mi propio cuerpo>, toxicidadTolerada: 0.9 }) → ${JSON.stringify(vuelo.outcome)}`,
      `  cuerpos: [${[...p.state.bodies.keys()].join(', ')}]`,
    ])
    expect(vuelo.outcome?.ok).toBe(false)
    expect(p.state.bodies.has('ana-cuerpo')).toBe(true)
    expect(p.violaciones).toEqual([])
  })
})

// ═══ (3) EL SEGUNDO CERROJO NO EXISTE ════════════════════════════════════════

describe('(3) el «segundo cerrojo» de la mente es verdad sólo mientras la carne esté cruda', () => {
  it('el propio cuerpo COCIDO deja +17,05 de neto, y la cuenta lo aceptaría', () => {
    // `oportunidades.ts:146` dice: «la criatura no se come a sí misma ni aunque se
    // levante con la mano: su propio cuerpo es carne de 2 kg con `toxicity` 0,30, o
    // sea −8,7000. Son dos cerrojos y los dos están medidos: `lugares()` ya la
    // excluye por id, y **la cuenta la excluiría igual si no lo hiciera**».
    //
    // La primera mitad es cierta. La segunda no: la ley 5 escribe `digestibility` y
    // `toxicity` en `Body.state`, y el cuerpo de la criatura es `carne`, o sea
    // `organico` y `carnoso` — exactamente el tag que la fila de cocción trabaja.
    const filas: string[] = []
    const netoDe = (dig: number, tox: number): number => {
      const b = cuerpo('x', 'carne', 2, { digestibility: dig, toxicity: tox }, 'bloque')
      const cal = qualityOf(b, 'calories', PHYS) * STAMINA_POR_CALORIA
      return cal - qualityOf(b, 'toxicity', PHYS) * qualityOf(b, 'mass', PHYS) * COSTO_POR_TOXICIDAD_Y_KILO
    }
    const crudo = netoDe(0.35, 0.3)
    const cocido = netoDe(0.95, 0.001)
    filas.push(
      '══ (3) EL SEGUNDO CERROJO ═══════════════════════════════════════════',
      `  carne cruda (lo que decía el comentario) .... neto ${c4(crudo)}`,
      `  la misma carne cocida por la ley 5 .......... neto ${c4(cocido)}`,
      '',
      '  El único cerrojo de `oportunidades.ts` es el `if (b.id === v.self.id)',
      '  continue` de `lugares()`. La cuenta no era un respaldo: era un accidente de',
      '  dos números. EL COMENTARIO YA ESTÁ CORREGIDO, y los otros dos cerrojos —los',
      '  que hacían falta— existen: el mundo rechaza con `es-uno-mismo` y la innata',
      '  `comer` se saltea `ctx.self.id` en las dos listas.',
    )
    log(filas)
    expect(crudo).toBeLessThan(0)
    expect(cocido).toBeGreaterThan(0)
  })
})

// ═══ (4) LO QUE SÍ AGUANTA ═══════════════════════════════════════════════════

describe('(4) las contrapruebas: por todos los otros lados el cobro cierra', () => {
  it('masa cero no es un bocado gratis: el mundo lo rechaza con `nada-que-comer`', () => {
    const w = mundo({
      bodies: [enElPiso(criatura('ana', 100), { x: 0, y: 0 }), enElPiso(cuerpo('pez', 'pescado', 0, {}, 'bloque'), { x: 0, y: 1 })],
      actors: [actor('ana')],
    })
    const r = stepWorld(w, [eat({ by: 'ana', seq: 0 }, 'pez')])
    expect(clases(r.events)).toEqual(['rechazada'])
  })

  it('la toxicidad negativa no existe: `qualityOf` la topa contra el rango, y el arnés la ve', () => {
    const pez = cuerpo('pez', 'pescado', 2, { toxicity: -4 }, 'bloque')
    const w = mundo({
      bodies: [enElPiso(criatura('ana', 100), { x: 0, y: 0 }), enElPiso(pez, { x: 0, y: 1 })],
      actors: [actor('ana')],
    })
    const leida = qualityOf(pez, 'toxicity', PHYS)
    const r = stepWorld(w, [eat({ by: 'ana', seq: 0 }, 'pez')])
    log([
      '══ (4b) LA TOXICIDAD NEGATIVA ═══════════════════════════════════════',
      `  escrita -4 · leída por \`qualityOf\` ${c4(leida)}`,
      `  eventos: ${clases(r.events).join(' · ')} (sin \`enveneno\`, y sin bonus)`,
      `  y el estado de entrada NO es legal: ${revisarInvariantes(w, w, []).map((v) => v.k).join(' · ')}`,
    ])
    expect(leida).toBe(0)
    expect(r.events.some((e) => e.k === 'enveneno')).toBe(false)
    expect(revisarInvariantes(w, w, []).map((v) => v.k)).toEqual(['cualidad-fuera-de-rango'])
  })

  it('comerle algo de la mano a otro cobra el veneno AL QUE COME, y el inventario cierra', () => {
    const pez = cuerpo('pez', 'pescado', 2, {}, 'bloque')
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 500), { x: 0, y: 0 }),
        enElPiso(criatura('beto', 500), { x: 1, y: 0 }),
        enLaMano(pez, { x: 1, y: 0 }, 'beto'),
      ],
      actors: [actor('ana'), actor('beto', { holding: ['pez'] })],
    })
    const r = stepWorld(w, [eat({ by: 'ana', seq: 0 }, 'pez')])
    const ven = r.events.find((e) => e.k === 'enveneno')
    log([
      '══ (4c) LA MANO AJENA ═══════════════════════════════════════════════',
      `  eventos: ${clases(r.events).join(' · ')}`,
      `  cobrado: ${ven?.k === 'enveneno' ? c4(ven.cobrado) : '—'} a ana (0,25 × 2 kg × 25)`,
      `  stamina ana ${c4(stamina(w, 'ana-cuerpo'))} → ${c4(stamina(r.state, 'ana-cuerpo'))}`,
      `  stamina beto ${c4(stamina(w, 'beto-cuerpo'))} → ${c4(stamina(r.state, 'beto-cuerpo'))}`,
      `  mano de beto: [${(r.state.actors.get('beto')?.holding ?? []).join(', ')}]`,
      `  violaciones: ${revisarInvariantes(w, r.state, r.events).map((v) => v.k).join(' · ') || '(ninguna)'}`,
    ])
    expect(ven?.k === 'enveneno' ? ven.cobrado : 0).toBeCloseTo(12.5, 6)
    expect(stamina(r.state, 'ana-cuerpo')).toBeLessThan(stamina(w, 'ana-cuerpo'))
    expect(r.state.actors.get('beto')?.holding).toEqual([])
    expect(revisarInvariantes(w, r.state, r.events)).toEqual([])
  })

  it('dos comensales sobre el mismo cuerpo en el mismo tick: el segundo no come dos veces', () => {
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 500), { x: 0, y: 0 }),
        enElPiso(criatura('beto', 500), { x: 1, y: 0 }),
        enElPiso(cuerpo('pez', 'pescado', 2, {}, 'bloque'), { x: 0, y: 1 }),
      ],
      actors: [actor('ana'), actor('beto')],
    })
    const r = stepWorld(w, [eat({ by: 'ana', seq: 0 }, 'pez'), eat({ by: 'beto', seq: 1 }, 'pez')])
    expect(r.events.filter((e) => e.k === 'comio')).toHaveLength(1)
    expect(r.events.filter((e) => e.k === 'enveneno')).toHaveLength(1)
    const rech = r.events.find((e) => e.k === 'rechazada')
    expect(rech?.k === 'rechazada' ? rech.por : '').toBe('cuerpo-desconocido')
  })

  it('quemar la comida no da un bocado barato: da `residuo-mineral` y `nada-que-comer`', () => {
    // El frente 4 del tramo: «¿puede quemar la comida en vez de cocinarla?». Sí —el
    // montaje de CONTACTO la cruza por su `ignitionPoint`— y lo que queda no es
    // comida con el veneno de menos: es otra sustancia, con `nutrition` 0.
    const at = { x: 0, y: 0 }
    const fuego: Body = {
      id: 'fuego',
      form: 'vara',
      parts: [{ substance: 'madera', mass: 0.85, q: {} }],
      joints: [],
      state: { temperature: 400 },
    }
    let w = mundo({
      bodies: [
        { body: criatura('ana', 1000), at },
        { body: fuego, at },
        { body: cuerpo('comida', 'pescado', 2, {}, 'bloque'), at, supportedBy: 'fuego' },
      ],
      actors: [actor('ana', { capacity: 6 })],
    })
    for (let t = 0; t < Math.ceil(60 * w.hz); t++) w = stepWorld(w, []).state
    const b = w.bodies.get('comida')
    expect(b).toBeDefined()
    const carbon = b as NonNullable<typeof b>
    const r = stepWorld(w, [eat({ by: 'ana', seq: 0 }, 'comida')])
    log([
      '══ (4e) LO QUEMADO ══════════════════════════════════════════════════',
      `  sustancias: ${carbon.body.parts.map((p) => `${p.substance}:${c4(p.mass)}`).join(' + ')}`,
      `  nutrition ${c4(qualityOf(carbon.body, 'nutrition', w.phys))} · calories ${c4(qualityOf(carbon.body, 'calories', w.phys))} · charred ${c4(qualityOf(carbon.body, 'charred', w.phys))}`,
      `  comerlo: ${clases(r.events).join(' · ')}`,
    ])
    expect(qualityOf(carbon.body, 'calories', w.phys)).toBe(0)
    expect(clases(r.events)).toEqual(['rechazada'])
  })

  it('la tabla de K del ADR, recalculada del catálogo: los tres grupos y los dos bordes', () => {
    const filas: string[] = ['══ (4f) EL CATÁLOGO, RECALCULADO ════════════════════════════════════']
    let pisoDeLaVentana = 0
    let techoDeLaVentana = Number.POSITIVE_INFINITY
    for (const s of SUSTANCIAS_SEMILLA) {
      const n = s.perUnitMass.nutrition ?? 0
      if (!(n > 0)) continue
      const d = s.perUnitMass.digestibility ?? 0
      const t = s.perUnitMass.toxicity ?? 0
      const cal = n * d
      const K = t > 0 ? cal / t : Number.POSITIVE_INFINITY
      const neto = cal * STAMINA_POR_CALORIA - t * COSTO_POR_TOXICIDAD_Y_KILO
      // Los dos bordes del ADR: el techo lo pone la peor de las que TIENEN que dar
      // positivo crudas (grasa, médula, huevo) y el piso la mejor de las que TIENEN
      // que dar negativo (pescado, carne).
      if (s.id === 'grasa' || s.id === 'medula' || s.id === 'huevo') {
        if (K < techoDeLaVentana) techoDeLaVentana = K
      }
      if (s.id === 'pescado' || s.id === 'carne') {
        if (K > pisoDeLaVentana) pisoDeLaVentana = K
      }
      filas.push(
        `  ${s.id.padEnd(11)} cal/kg ${c4(cal).padStart(8)} · Kcorte ${(K === Number.POSITIVE_INFINITY ? '∞' : c4(K)).padStart(9)} · neto/kg a K=25 ${c4(neto).padStart(9)}`,
      )
    }
    filas.push(
      '',
      `  la ventana medida: (${c4(pisoDeLaVentana)} ; ${c4(techoDeLaVentana)}) — ${c4(techoDeLaVentana / pisoDeLaVentana)}× de ancho`,
      `  K elegido: ${String(COSTO_POR_TOXICIDAD_Y_KILO)} — adentro`,
      '',
      '  Y tres comidas que la tabla del ADR NO lista, todas negativas y ninguna',
      '  absurda: cuero (Kcorte 2,40), tendón (2,00) y piel (1,33).',
    )
    log(filas)
    expect(pisoDeLaVentana).toBeCloseTo(12.16, 6)
    expect(techoDeLaVentana).toBeCloseTo(55, 6)
    expect(COSTO_POR_TOXICIDAD_Y_KILO).toBeGreaterThan(pisoDeLaVentana)
    expect(COSTO_POR_TOXICIDAD_Y_KILO).toBeLessThan(techoDeLaVentana)
  })
})

// ═══ (5) EL TECHO DEL GUARDIÁN ═══════════════════════════════════════════════

describe('(5) el `convierte` declara lo que ENTRÓ, y no lo que quiso acreditar', () => {
  it('una criatura casi llena come 4 kg de grasa: podía meter 61,60 y declara 1,00', () => {
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 999), { x: 0, y: 0 }),
        enElPiso(cuerpo('grasa', 'grasa', 4, {}, 'bloque'), { x: 0, y: 1 }),
      ],
      actors: [actor('ana')],
    })
    const r = stepWorld(w, [eat({ by: 'ana', seq: 0 }, 'grasa')])
    const conv = r.events.find((e) => e.k === 'convierte')
    const declarado = conv?.k === 'convierte' ? conv.acreditado : 0
    // Lo que entró de verdad es la subida ANTES de que el veneno cobre, y el
    // veneno se cobra sobre lo que quedó: se reconstruye con el `enveneno`.
    const ven = r.events.find((e) => e.k === 'enveneno')
    const cobrado = ven?.k === 'enveneno' ? ven.cobrado : 0
    // Los 0,05 de vivir el tick se suman de vuelta: el metabolismo corre igual y no
    // es parte de lo que se está midiendo. Sin esto la cuenta diría 0,95 y parecería
    // que el tanque topa en 999,95.
    const VIVIR_EL_TICK = 0.05
    const entroDeVerdad = stamina(r.state, 'ana-cuerpo') + cobrado + VIVIR_EL_TICK - stamina(w, 'ana-cuerpo')
    // Lo que el bocado HABRÍA acreditado si hubiera entrado entero: es el número que
    // el evento declaraba antes, y se recalcula del catálogo para que la comparación
    // no dependa de que alguien lo copie bien.
    const grasa = w.bodies.get('grasa')
    const podia = grasa === undefined ? 0 : qualityOf(grasa.body, 'calories', w.phys) * STAMINA_POR_CALORIA
    log([
      '══ (5) EL TECHO QUE YA NO SE INFLA ══════════════════════════════════',
      `  lo que el bocado podía dar ....... ${c4(podia)} (4 kg de grasa)`,
      `  \`convierte.acreditado\` declara ... ${c4(declarado)}`,
      `  lo que \`conCualidad\` dejó entrar .. ${c4(entroDeVerdad)} (el tanque topa en 1000)`,
      `  el techo de \`conservada-aumento\` se corre ${c4(declarado - entroDeVerdad)} de más en este tick`,
      '',
      '  ANTES el evento declaraba 61,60 y entraba 1,00: el techo del guardián se',
      '  corría 60,60 de más. El PISO ya tenía el cuidado escrito y comentado («el',
      '  piso NO suma lo acreditado […] porque `conCualidad` la topa contra el',
      '  techo», invariants.ts:487) y el TECHO no. No era explotable solo —hacía',
      '  falta otro agujero que subiera la stamina en el mismo tick— pero era',
      '  holgura regalada en la mitad de los bocados de una partida.',
    ])
    // El bocado daba para mucho más, y por eso el caso mide algo.
    expect(podia).toBeGreaterThan(60)
    expect(entroDeVerdad).toBeCloseTo(1, 6)
    // Y lo declarado es AHORA lo que entró: el techo vale lo que dice.
    expect(declarado).toBeCloseTo(entroDeVerdad, 6)
    expect(revisarInvariantes(w, r.state, r.events)).toEqual([])
  })

  it('y con el tanque vacío no cambió nada: lo declarado sigue siendo todo lo que dio', () => {
    // La contraprueba que hace que el arreglo no sea «declarar menos y listo»:
    // cuando NO hay techo que topar, lo declarado es exactamente lo que el bocado
    // daba. Sin esto, poner `acreditado: 0` también pasaría el test de arriba.
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 100), { x: 0, y: 0 }),
        enElPiso(cuerpo('grasa', 'grasa', 4, {}, 'bloque'), { x: 0, y: 1 }),
      ],
      actors: [actor('ana')],
    })
    const grasa = w.bodies.get('grasa')
    const podia = grasa === undefined ? 0 : qualityOf(grasa.body, 'calories', w.phys) * STAMINA_POR_CALORIA
    const r = stepWorld(w, [eat({ by: 'ana', seq: 0 }, 'grasa')])
    const conv = r.events.find((e) => e.k === 'convierte')
    const declarado = conv?.k === 'convierte' ? conv.acreditado : 0
    log([
      '══ (5b) SIN TECHO QUE TOPAR ═════════════════════════════════════════',
      `  el bocado daba .................. ${c4(podia)}`,
      `  \`convierte.acreditado\` declara .. ${c4(declarado)}`,
    ])
    expect(declarado).toBeCloseTo(podia, 6)
    expect(revisarInvariantes(w, r.state, r.events)).toEqual([])
  })
})

// ═══ (6) NADIE CORRE EL ARNÉS ════════════════════════════════════════════════

describe('(6) el arnés que caza todo esto, AHORA lo corre alguien', () => {
  it('`revisarEstado` corre por tick desde `Partida`, y la corrida del criterio lo enciende', () => {
    const aqui = fileURLToPath(new URL('.', import.meta.url))
    const criterio = readFileSync(`${aqui}hito-5-el-criterio.test.ts`, 'utf8')
    const bucle = readFileSync(
      fileURLToPath(new URL('../../perceive/src/bucle.ts', import.meta.url)),
      'utf8',
    )
    log([
      '══ (6) QUIÉN VIGILA ═════════════════════════════════════════════════',
      `  \`perceive/src/bucle.ts\` llama a \`revisarEstado\`: ${String(/revisarEstado\(/.test(bucle))}`,
      `  \`hito-5-el-criterio.test.ts\` enciende \`vigilar\`: ${String(/vigilar: true/.test(criterio))}`,
      '',
      '  ANTES: `exigirInvariantes` se llamaba en UN solo archivo de todo `ii/`, y era',
      '  `world/tests/invariants.test.ts`, o sea su propio test. La corrida de 20.000',
      '  ticks del criterio del Hito 5 no lo llamaba, y el fantasma del bloque (1) la',
      '  atravesaba entera sin que nada se pusiera rojo.',
      '',
      '  LO QUE SIGUE APAGADO, y hay que decirlo: la SEXTA pregunta —la',
      '  conservación— no se puede encender en una partida CON DIOS, porque los tres',
      '  caminos por los que el dios crea materia no emiten ningún evento que',
      '  `acreditado()` sepa leer. Tiene su `it.fails` en',
      '  `perceive/tests/ataque-a-la-costura.test.ts` y pide un ADR (un `SimEvent` de',
      '  decreto). `revisarEstado` no depende de la conservación, así que ese',
      '  bloqueante no la alcanza — y habría cazado igual el `inventario-inconsistente`.',
    ])
    expect(/revisarEstado\(/.test(bucle)).toBe(true)
    expect(/vigilar: true/.test(criterio)).toBe(true)
  })

  it('y el arnés SE PUEDE MOVER: un estado ilegal metido a mano lo enciende', () => {
    // Un guardián que nadie pudo hacer saltar es un cero que no significa nada — la
    // misma regla que el bucle aplica a `ticksPerdidos`. Se le mete al mundo un
    // actor cuyo cuerpo no existe (que es exactamente lo que dejaba el bocado
    // gratis) y se exige que la `Partida` lo diga.
    const w = mundo({
      bodies: [enElPiso(criatura('ana', 500), { x: 0, y: 0 })],
      actors: [actor('ana')],
    })
    const roto: WorldState = { ...w, bodies: new Map() }
    const p = new Partida(roto, { vigilar: true })
    p.avanzar(3)
    log([
      '══ (6b) EL GUARDIÁN SE MUEVE ════════════════════════════════════════',
      `  violaciones: ${String(p.informe.violaciones.length)}`,
      `  la primera: ${p.violaciones[0] ?? '—'}`,
      `  vigilada: ${String(p.informe.vigilada)}`,
    ])
    expect(p.informe.vigilada).toBe(true)
    expect(p.violaciones.length).toBeGreaterThan(0)
    expect(p.informe.violaciones.some((x) => x.v.k === 'inventario-inconsistente')).toBe(true)
  })

  it('y APAGADO no miente: `violaciones` vacío con `vigilada: false` es «no se miró»', () => {
    // El cero ambiguo, cerrado. Sin `vigilada`, un `violaciones: []` de una partida
    // sin la bandera sería indistinguible de una partida limpia, que es justo la
    // confusión que dejó el arnés apagado durante todo el Hito 5.
    const w = mundo({
      bodies: [enElPiso(criatura('ana', 500), { x: 0, y: 0 })],
      actors: [actor('ana')],
    })
    const p = new Partida({ ...w, bodies: new Map() })
    p.avanzar(3)
    expect(p.informe.vigilada).toBe(false)
    expect(p.violaciones).toEqual([])
  })
})
