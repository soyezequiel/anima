/**
 * EL DUELO — Hito 8, punto 7.
 *
 *   > una candidata **peor no reemplaza nada** y queda archivada como regresión
 *
 * ─── EL ESPEJO, y es el control que impide el verde más obvio ───────────────
 *
 * «Una candidata peor no reemplaza nada» lo cumple perfectamente una función que
 * **no reemplaza jamás**. Es el mismo verde por omisión que el `ticksPerdidos ===
 * 0` del tramo H, que necesitó su control con la fragua adentro del hilo para
 * significar algo.
 *
 * Así que por cada «no reemplaza» hay un espejo: la MISMA titular, el MISMO
 * arnés, una retadora estrictamente mejor en el mismo eje, y **tiene que
 * reemplazar**.
 *
 * ─── Y los pares que obligan a mirar más que el grado ───────────────────────
 *
 * Un adversario pidió exactamente esto: *«el par dominado con el mismo grado, que
 * es lo único que obliga al comparador a mirar más allá de `elPeor`»*. Sin él, un
 * duelo que ordena sólo por grado global pasa el archivo entero — y ese duelo no
 * puede tener ganador nunca, porque **ningún dictamen de habilidad puede salir
 * `promueve`** (medido, en el encabezado de `duelo.ts`).
 */

import { buildSeedPhysics } from '@anima/physics'
import { Contexto, Partida } from '@anima/perceive'
import type { BodyView } from '@anima/skills'
import { CONTRATO_SOSTENER, sostener } from '@anima/skills/innatas'
import { describe, expect, it } from 'vitest'
import type { Sujeto } from '../src/ablacion.js'
import { archivar, duelo, gradoDe, GRAVEDAD_DE } from '../src/duelo.js'
import { EL_ACTOR } from '../src/escena.js'
import { juzgar } from '../src/juzgar.js'
import { CARGOS, SIN_CORRER } from '../src/tipos.js'
import type { Cargo, Dictamen, Grado, Veredicto } from '../src/tipos.js'

const phys = buildSeedPhysics()

// ─── Dictámenes armados a mano ──────────────────────────────────────────────
//
// A mano y no juzgando habilidades de verdad, y es a propósito: el par que
// importa —mismo grado, distintos aprobados— no se puede pedir a demanda con
// material real, y un test que dependa de encontrarlo no se puede escribir.
// El caso REAL está abajo, en su propio bloque.

function v(cargo: Cargo, grado: Grado, aprobados = 0, mundos = 5): Veredicto {
  return {
    cargo,
    grado,
    porque: `${cargo} salió ${grado}`,
    corrida: { ...SIN_CORRER, mundos, aprobados, adversos: 2, adversosAprobados: 0 },
  }
}

function dictamen(nombre: string, gs: Readonly<Record<Cargo, Grado>>, aprobados: Readonly<Partial<Record<Cargo, number>>> = {}): Dictamen {
  const cargos = CARGOS.map((c) => v(c, gs[c], aprobados[c] ?? 0))
  return { habilidad: nombre, cargos, grado: gradoDe({ habilidad: nombre, cargos, grado: 'promueve', regresiones: [] }), regresiones: [] }
}

const TITULAR = dictamen('titular', {
  plano: 'promueve',
  construccion: 'promueve',
  uso: 'no-promueve',
  utilidad: 'inconcluso',
})

describe('el orden de gravedad, que es de donde sale todo lo demás', () => {
  it('es el mismo que usa `elPeor`, y ahora está exportado', () => {
    // Si esto se separara de `GRAVEDAD` de `tipos.ts`, un duelo elegiría mal sin
    // que nada más se ponga rojo. Por eso se exporta en vez de copiarse.
    expect(GRAVEDAD_DE.promueve).toBeLessThan(GRAVEDAD_DE.inconcluso)
    expect(GRAVEDAD_DE.inconcluso).toBeLessThan(GRAVEDAD_DE['no-promueve'])
    expect(GRAVEDAD_DE['no-promueve']).toBeLessThan(GRAVEDAD_DE.injuzgable)
  })
})

describe('UNA CANDIDATA PEOR NO REEMPLAZA NADA', () => {
  it('peor en un cargo, igual en el resto: no reemplaza', () => {
    const peor = dictamen('peor', {
      plano: 'promueve',
      construccion: 'no-promueve', // ← retrocede
      uso: 'no-promueve',
      utilidad: 'inconcluso',
    })
    const d = duelo(TITULAR, peor)
    console.log(`\n  ${d.reemplaza ? 'REEMPLAZA' : 'no reemplaza'} · ${d.porque}\n`)
    expect(d.reemplaza).toBe(false)
    expect(d.porque).toContain('empeora')
  })

  it('EL ESPEJO: mejor en un cargo, igual en el resto: SÍ reemplaza', () => {
    // Sin este renglón, todo el archivo lo cumple un duelo que devuelve `false`
    // siempre. Es el control que le da sentido a los tres «no» de este bloque.
    const mejor = dictamen('mejor', {
      plano: 'promueve',
      construccion: 'promueve',
      uso: 'promueve', // ← mejora
      utilidad: 'inconcluso',
    })
    const d = duelo(TITULAR, mejor)
    console.log(`\n  ${d.reemplaza ? 'REEMPLAZA' : 'no reemplaza'} · ${d.porque}\n`)
    expect(d.reemplaza).toBe(true)
    expect(d.ganaRetadora).toBe(1)
    expect(d.ganaTitular).toBe(0)
  })

  it('GANA UNO Y PIERDE OTRO: no reemplaza, y dice cuál rompió', () => {
    // Es el caso que un orden total —sumar cargos, promediar— dejaría pasar.
    // Cambiar un rojo por otro rojo no es mejorar.
    const cambiada = dictamen('cambiada', {
      plano: 'promueve',
      construccion: 'no-promueve', // rompe
      uso: 'promueve', // arregla
      utilidad: 'inconcluso',
    })
    const d = duelo(TITULAR, cambiada)
    console.log(`\n  ${d.reemplaza ? 'REEMPLAZA' : 'no reemplaza'} · ${d.porque}\n`)
    expect(d.reemplaza).toBe(false)
    expect(d.ganaRetadora).toBe(1)
    expect(d.ganaTitular).toBe(1)
    expect(d.porque).toContain('construccion')
  })

  it('EL EMPATE deja a la titular, y dice por qué', () => {
    const clon = dictamen('clon', {
      plano: 'promueve',
      construccion: 'promueve',
      uso: 'no-promueve',
      utilidad: 'inconcluso',
    })
    const d = duelo(TITULAR, clon)
    console.log(`\n  ${d.reemplaza ? 'REEMPLAZA' : 'no reemplaza'} · ${d.porque}\n`)
    expect(d.reemplaza).toBe(false)
    expect(d.porque).toContain('empató')
  })
})

describe('EL PAR QUE OBLIGA A MIRAR MÁS QUE EL GRADO', () => {
  const gs: Readonly<Record<Cargo, Grado>> = {
    plano: 'promueve',
    construccion: 'no-promueve',
    uso: 'no-promueve',
    utilidad: 'inconcluso',
  }

  it('MISMO grado en los cuatro, y una aprueba más mundos: gana ésa', () => {
    // Los dos dictámenes salen `no-promueve` de grado global. Un duelo que
    // compare `d.grado` los da empatados y no reemplaza nunca — que es
    // exactamente el verde por omisión que este bloque existe para cerrar.
    const floja = dictamen('floja', gs, { construccion: 1, uso: 1 })
    const firme = dictamen('firme', gs, { construccion: 4, uso: 3 })

    expect(floja.grado).toBe(firme.grado)
    const d = duelo(floja, firme)
    console.log(
      `\n  mismo grado (${floja.grado}) · ${d.reemplaza ? 'REEMPLAZA' : 'no reemplaza'}\n  ${d.porque}` +
        `\n  ${d.porCargo.map((c) => `${c.cargo}:${String(c.aprobadosTitular)}vs${String(c.aprobadosRetadora)}→${c.gana}`).join(' · ')}\n`,
    )
    expect(d.reemplaza).toBe(true)
    expect(d.ganaRetadora).toBe(2)
  })

  it('y al revés no: la floja no le gana a la firme', () => {
    // El control del control. Sin esto, «gana la que aprueba más» lo cumpliría
    // un comparador que devuelve `true` cuando los grados empatan.
    const floja = dictamen('floja', gs, { construccion: 1, uso: 1 })
    const firme = dictamen('firme', gs, { construccion: 4, uso: 3 })
    expect(duelo(firme, floja).reemplaza).toBe(false)
  })
})

describe('LA PERDEDORA QUEDA ARCHIVADA, y sin un solo id de mundo', () => {
  it('guarda el código y el porqué', () => {
    const peor = dictamen('peor', { plano: 'promueve', construccion: 'injuzgable', uso: 'no-promueve', utilidad: 'inconcluso' })
    const d = duelo(TITULAR, peor)
    const a = archivar('peor', 'export function* peor() {}', d, 3)
    console.log(`\n  archivada: ${a.nombre} (vuelta ${String(a.vuelta)}) — ${a.porque}\n`)
    expect(a.codigo).toContain('function*')
    expect(a.vuelta).toBe(3)
    expect(a.porque).toBe(d.porque)
  })

  it('EL GUARDIÁN: el porqué no nombra ningún mundo', () => {
    // Es la trampa del punto 9 dicha para el 7: si se le cuentan los mundos donde
    // perdió, la próxima aprende los mundos. El `porque` sale de los cargos, que
    // no traen semillas — el dato no entra, así que no se puede filtrar mal.
    const conRegresiones: Dictamen = {
      ...dictamen('peor', { plano: 'promueve', construccion: 'no-promueve', uso: 'no-promueve', utilidad: 'inconcluso' }),
      regresiones: [
        {
          habilidad: 'peor',
          cargo: 'construccion',
          semilla: 'sostener·al-borde·agua/bloque/0.05',
          queSeEspera: 'que llegue',
        },
      ],
    }
    const d = duelo(TITULAR, conRegresiones)
    const a = archivar('peor', 'x', d, 1)
    for (const r of conRegresiones.regresiones) {
      expect(a.porque.includes(r.semilla), `se filtró el mundo ${r.semilla}`).toBe(false)
      expect(d.porque.includes(r.semilla)).toBe(false)
    }
  })
})

describe('CONTRA MATERIAL DE VERDAD: `sostener` contra una degradada', () => {
  function argsDe(p: Partida): { que: BodyView } | undefined {
    const ctx = new Contexto(p.proyeccion, { actor: EL_ACTOR, rng: p.dado.tirar, lugares: p.lugares }).ctx
    const otros = ctx.see([]).filter((b) => b.id !== `${EL_ACTOR}-cuerpo`)
    return otros[0] === undefined ? undefined : { que: otros[0] }
  }

  /**
   * LA DEGRADADA, y la primera que probé NO SE DEGRADÓ.
   *
   * El intento obvio era sacarle el `goTo` —«que no se mueva hacia lo que va a
   * agarrar»— y el duelo dio **empate en los cuatro cargos**. Medido: el objetivo
   * de la escena del juez nace a UNA celda, y `take` funciona desde ahí, así que
   * sacar el `goTo` no cambia nada.
   *
   * (Eso es un dato sobre la escena del juez y no sobre el duelo: su encabezado
   * dice que el objetivo nace al lado y no encima para que «un `goTo` que no
   * funciona» no pase desapercibido, y a una celda igual pasa desapercibido.
   * Queda anotado acá, que es donde se midió.)
   *
   * La que sí se degrada es la que **dice que sí sin hacer nada**: llega en los
   * mundos adversos donde su propio contrato dice que no puede, y no cumple la
   * promesa en los amables.
   */
  function* sostenerDegradada(ctx: Parameters<typeof sostener>[0], args: { que: BodyView }): ReturnType<typeof sostener> {
    ctx.phase('sostener')
    return { ok: true as const, got: args.que }
  }

  const s = (nombre: string, skill: Sujeto<{ que: BodyView }>['skill']): Sujeto<{ que: BodyView }> => ({
    acusada: { nombre, contrato: CONTRATO_SOSTENER },
    skill,
    argsDe,
  })

  it('la degradada NO reemplaza a la titular, y el duelo dice en qué cargo cae', () => {
    const titular = juzgar(s('sostener', sostener), phys)
    const rota = juzgar(s('sostenerDegradada', sostenerDegradada as never), phys)
    const d = duelo(titular, rota)

    console.log(
      `\n  titular ${titular.grado} · degradada ${rota.grado}` +
        `\n  ${d.reemplaza ? 'REEMPLAZA' : 'no reemplaza'} — ${d.porque}\n` +
        d.porCargo.map((c) => `    ${c.cargo.padEnd(13)} ${c.titular} vs ${c.retadora} → ${c.gana}`).join('\n') +
        '\n',
    )
    expect(d.reemplaza).toBe(false)
    expect(d.ganaTitular).toBeGreaterThan(0)
  })

  it('EL ESPEJO CON MATERIAL DE VERDAD: la titular SÍ le gana a la degradada', () => {
    // O sea que el duelo distingue las dos direcciones sobre habilidades reales,
    // no sólo sobre dictámenes armados a mano.
    const titular = juzgar(s('sostener', sostener), phys)
    const rota = juzgar(s('sostenerDegradada', sostenerDegradada as never), phys)
    const d = duelo(rota, titular)
    console.log(`\n  al revés: ${d.reemplaza ? 'REEMPLAZA' : 'no reemplaza'} — ${d.porque}\n`)
    expect(d.reemplaza).toBe(true)
  })
})
