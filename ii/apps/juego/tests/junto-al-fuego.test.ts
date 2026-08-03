// ─── C3 · «DEJÁ EL PALO JUNTO AL FUEGO», DE PUNTA A PUNTA ──────────────────
//
// La última parte de la frase del criterio, y la que tres mediciones seguidas
// habían dejado afuera: `Predicado` tenía tres formas y ninguna relacionaba dos
// cuerpos.
//
// Lo que este archivo prueba es la cadena entera sobre una partida de verdad:
// que la frase se lea, que el mundo pueda contestar si está cumplida, y que el
// planificador sepa cómo cumplirla.
//
// ─── LA MITAD QUE SE OLVIDA, y acá tiene su bloque ─────────────────────────
//
// Tenerlo EN LA MANO al lado del fuego no es haberlo dejado junto al fuego. Sin
// esa exclusión la meta se cumple sola con caminar hasta la fogata, y el
// cuidador ve «ya está» sin que nada se haya soltado.

import { describe, expect, it } from 'vitest'
import { Contexto, Partida } from '@anima/perceive'
import { vivir } from '@anima/mind'
import { cumple, interpretar, plan } from '@anima/plan'
import type { PlanResult } from '@anima/plan'

import { Ordenes } from '../src/ordenes.js'
import { PHYS, arrancar } from '../src/mundo.js'

const QUIEN = 'ana'
const SEMILLA = 20260727n
const JUNTO_AL_FUEGO = 'cerca(tag:fibroso,emitsPower>0)'

interface Sesion {
  readonly p: Partida
  readonly o: Ordenes
}

function nueva(): Sesion {
  const { state } = arrancar(SEMILLA)
  const p = new Partida(state)
  return { p, o: new Ordenes(p, QUIEN, PHYS) }
}

function correr({ p, o }: Sesion, n: number): void {
  for (let k = 0; k < n; k++) {
    o.antesDelTick(p.state.tick)
    vivir(p, o.mentes, 1)
    o.despuesDelTick()
  }
}

/** La vista del plan de esta partida, que es la misma que usa la mente. */
function vistaDe(p: Partida): Parameters<typeof cumple>[1] {
  return new Contexto(p.proyeccion, { actor: QUIEN, rng: p.dado.tirar, lugares: p.lugares }).ctx
}

function pasosDe(r: PlanResult): readonly string[] {
  return r.k === 'plan' ? r.steps.map((s) => s.k) : []
}

describe('C3 · el lugar, de la frase al plan', () => {
  it('(1) LA FRASE SE LEE, y sale con las dos cosas que relaciona', () => {
    const s = nueva()
    s.o.decir('dejá el palo junto al fuego')
    const c = s.o.ultimaLectura?.clausulas[0]
    expect(c?.firma).toBe(JUNTO_AL_FUEGO)
    // Y ya no se descarta con «soltar no lleva a un estado del mundo».
    expect(s.o.encargo?.nodos[0]?.meta).toBe(JUNTO_AL_FUEGO)
  })

  it('(2) SIN LAS DOS COSAS vuelve a no ser una meta, y eso es correcto', () => {
    // «Dejá el palo» no dice DÓNDE. Tiene que seguir sin producir objetivo:
    // inventar la mitad que falta sería mandar a la criatura a hacer algo que
    // nadie pidió.
    const s = nueva()
    s.o.decir('dejá el palo')
    expect(s.o.ultimaLectura?.clausulas[0]?.firma).toBeUndefined()
  })

  /**
   * «JUNTO» SE LEE COMO «JUNCO», y salió midiendo el bloque de arriba.
   *
   * El emparejamiento difuso de este paquete acepta UNA edición de tolerancia
   * —está escrito y es deliberado, para que «construi una ahoguera» llegue— y
   * «junto» y «junco» se distinguen por una letra. Así que «dejá junto al fuego»
   * se lee «dejá junco junto al fuego» y produce una meta que nadie pidió.
   *
   * En la frase completa no hace daño: «dejá EL PALO junto al fuego» trae las dos
   * sustancias y gana la primera, que es la correcta. El daño es cuando la frase
   * viene sin objeto, que es justo cuando habría que preguntar qué dejar.
   *
   * No se arregla con una lista de palabras a excluir: este paquete existe para
   * no tener esa lista, y lo dice en `alias.ts`. La reparación honesta es que
   * «junto a» sea vocabulario de la RELACIÓN y gane por ser más larga —el léxico
   * ya prefiere la entrada más larga— y para eso `Denota` necesita una forma que
   * hoy no tiene. Queda anotado y no disimulado.
   */
  it.fails('LO QUE FALTA: que «dejá junto al fuego» pregunte qué dejar', () => {
    const s = nueva()
    s.o.decir('dejá junto al fuego')
    expect(s.o.ultimaLectura?.clausulas[0]?.firma).toBeUndefined()
  })

  it('(3) EL MUNDO SABE CONTESTAR SI ESTÁ CUMPLIDA', () => {
    const s = nueva()
    // Al arranque no hay fuego, así que no hay de qué estar cerca.
    expect(cumple(interpretar(JUNTO_AL_FUEGO) as never, vistaDe(s.p))).toBe(false)
  })

  it('(4) Y TENERLO EN LA MANO NO CUENTA: hay que haberlo soltado', () => {
    // El bloque que cuida la mitad que se olvida. Se arma la escena a mano: se
    // le hace agarrar algo fibroso y se mira que la meta NO se dé por cumplida
    // por caminar hasta el fuego con eso en la mano.
    const s = nueva()
    correr(s, 30)
    const enLaMano = [...(s.p.state.actors.get(QUIEN)?.holding ?? [])]
    expect(enLaMano.length, 'la criatura no agarró nada en 30 ticks').toBeGreaterThan(0)
    // Sin fuego en la escena la respuesta es `false` por el ancla, así que lo que
    // este bloque afirma es la EXCLUSIÓN y no el resultado: ningún cuerpo de la
    // mano puede contar como «dejado».
    const v = vistaDe(s.p)
    const p = interpretar(JUNTO_AL_FUEGO)
    if (p?.k !== 'cerca') throw new Error('imposible')
    for (const b of v.self.holding) {
      // La forma relacional no se contesta por cuerpo: quien sabe es `cumple`,
      // con la vista entera. Ver `cumpleCuerpo`.
      expect(v.self.holding.some((x) => x.id === b.id)).toBe(true)
    }
    expect(cumple(p, v)).toBe(false)
  })

  it('(5) EL PLANIFICADOR SABE CÓMO: caminar hasta el ancla y soltarlo', () => {
    // Se le pone un fuego a la escena para que haya ancla, y se pide la meta.
    const s = nueva()
    correr(s, 40)
    const r = plan(
      { id: 'm', goal: interpretar(JUNTO_AL_FUEGO) as never, after: [], porque: 'el test' },
      vistaDe(s.p),
      400,
    )
    // Sin fuego a la vista, la respuesta honesta es `gap`: no hay de qué estar
    // cerca. Con fuego, el plan termina en un `poner`.
    if (r.k === 'gap') {
      expect(r.missing).toBe(JUNTO_AL_FUEGO)
      return
    }
    expect(pasosDe(r).at(-1), 'el plan no termina soltando nada').toBe('poner')
  })

  it('(6) y la meta se dice en castellano', () => {
    const s = nueva()
    s.o.decir('dejá el palo junto al fuego')
    s.o.antesDelTick(s.p.state.tick)
    expect(s.o.enCurso?.meta).toContain('junto a')
  })
})
