// ═══ HITO 11 · puntos 1, 2 y 3 — LOS RELOJES DEL HITO 6, DEFENDIDOS ═════════
//
// La medición que define el Hito 11 es una división:
//
//     console.log en los tests de ii/ ........ 626
//     archivos de línea base ................. 1
//
// Seiscientos veintiséis números medidos y **uno** guardado. Este archivo defiende
// los que el criterio nombra por su nombre: los relojes del Hito 6.
//
// ─── LA MEDICIÓN QUE CORRIGIÓ EL PLAN ──────────────────────────────────────
//
// El plan dice que tres relojes «ya tienen línea base» y los lista con sus
// números. Medido: **esos números están en el documento, no en un archivo que un
// test lea.** `los-tres-relojes.test.ts` afirma cotas ESTRUCTURALES —«lo
// pertinente no es más rápido que un tick»— y `el-primer-gesto.test.ts` sólo
// afirma su número con `ANIMA_BANCO=1`. O sea que en la suite normal los tres se
// imprimen y ninguno se compara: hoy un cambio que lleve el p95 de 1,35 a 90 ms
// no pone nada rojo, porque sigue debajo del techo de 150 y nadie guarda el 1,35.
//
// Son citas, no guardas. La diferencia es todo el hito.
//
// ─── Y UNO DE LOS TRES NO PUEDE ENTRAR ACÁ ─────────────────────────────────
//
// `msHastaPrimerMovimiento` mide **milisegundos de cómputo**, así que su valor
// depende de cuánta CPU haya libre. Defenderlo desde la suite determinista haría
// que un rojo pueda venir de la carga de la máquina — que es exactamente el
// punto 4 de este hito, y que **ya está pasando** en
// `forge/tests/el-episodio.test.ts` (pasa 6 de 6 solo y falla con los 13
// archivos de su paquete en paralelo).
//
// Los otros dos SÍ son deterministas: uno es una fracción de decisiones y el otro
// se cuenta en ticks de mundo. Ésos son los que este archivo compara.

import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildSeedPhysics } from '@anima/physics'
import { ESQUEMAS } from '@anima/plan'
import { Partida } from '@anima/perceive'
import { Creencias, Mente, vivir } from '@anima/mind'

import { PUENTE } from '../src/alias.js'
import { leer } from '../src/leer.js'
import { lexicoDe } from '../src/lexico.js'
import { actor, criatura, enElPiso, laOrilla, mundo } from './mundo.js'

interface LineaBase {
  readonly comoSeSube: string
  readonly queNOentraAca: string
  readonly consistenciaDelPrimerGesto: { readonly valor: number; readonly medidoEl: string }
  readonly ticksHastaLoPertinente: {
    readonly porOrden: Readonly<Record<string, number>>
    readonly sinAccionPertinente: readonly string[]
  }
}

const BASE = JSON.parse(readFileSync(new URL('./linea-base.json', import.meta.url), 'utf8')) as LineaBase

const QUIEN = 'ana'
const CALENTAR = 40
const phys = buildSeedPhysics()
const lexico = lexicoDe(phys, PUENTE)
const FIRMAS = new Set(ESQUEMAS.map((e) => e.establishes))
const OPC = { phys, lexico, sabeElCatalogo: (f: string): boolean => FIRMAS.has(f) }
const orilla = laOrilla()

function escena(): ReturnType<typeof mundo> {
  return mundo({
    dios: orilla.dios,
    bodies: [enElPiso(criatura(QUIEN, 1000), orilla.parada)],
    actors: [actor(QUIEN, { capacity: 3 })],
  })
}

/**
 * Cuántos TICKS DEL MUNDO hasta el primer despegue que sale de la meta pedida.
 *
 * Es la misma función que `los-tres-relojes.test.ts`, copiada por lo de siempre:
 * los `tests/` no se exportan. Lo que se copia es el arnés, no el número.
 */
function ticksHastaLoPertinente(meta: string, tope: number): number | undefined {
  const p = new Partida(escena(), { vigilar: true })
  const memoria = new Creencias()
  let m = new Mente({ actor: QUIEN, memoria })
  const mentes = new Map([[QUIEN, m]])
  vivir(p, mentes, CALENTAR)
  m = new Mente({ actor: QUIEN, memoria, drive: { meta, peso: 1, desdeTick: CALENTAR } })
  mentes.set(QUIEN, m)
  for (let k = 0; k < tope; k++) {
    const antes = m.despegues
    vivir(p, mentes, 1)
    if (m.despegues > antes && m.estado.porQuien === 'D2' && m.estado.metaEnCurso === meta) return k + 1
  }
  return undefined
}

describe('(Hito 11 · 1) los relojes deterministas del Hito 6 tienen línea base y se comparan', () => {
  it('ticksHastaLoPertinente: cada orden llega en los ticks de la línea base', () => {
    const medido: Record<string, number | 'sin acción pertinente'> = {}
    for (const frase of Object.keys(BASE.ticksHastaLoPertinente.porOrden)) {
      const meta = leer(frase, OPC).clausulas[0]?.firma
      expect(meta, `«${frase}» dejó de producir una meta`).toBeDefined()
      const t = ticksHastaLoPertinente(meta as string, 600)
      medido[frase] = t ?? 'sin acción pertinente'
    }
    // Y las que la línea base dice que NO tienen acción pertinente: se comprueba
    // que sigan sin tenerla. Sin esto, una orden que dejara de cumplirse sola
    // pasaría de «no aplica» a «tarda 300 ticks» sin que nadie lo note.
    for (const frase of BASE.ticksHastaLoPertinente.sinAccionPertinente) {
      const meta = leer(frase, OPC).clausulas[0]?.firma
      expect(ticksHastaLoPertinente(meta as string, 300), `«${frase}» ahora SÍ tiene acción pertinente`).toBeUndefined()
    }

    console.log(
      `\n─── ticksHastaLoPertinente CONTRA LA LÍNEA BASE ───\n` +
        Object.entries(medido)
          .map(
            ([f, t]) =>
              `  ${f.padEnd(20)} base ${String(BASE.ticksHastaLoPertinente.porOrden[f])} · medido ${String(t)}`,
          )
          .join('\n') +
        `\n  sin acción pertinente: ${BASE.ticksHastaLoPertinente.sinAccionPertinente.join(', ')}\n`,
    )

    for (const [f, esperado] of Object.entries(BASE.ticksHastaLoPertinente.porOrden)) {
      expect(
        medido[f],
        `«${f}» cambió de ${String(esperado)} ticks. Si el cambio es a propósito, hay que editar ` +
          `tests/linea-base.json A MANO y escribir por qué`,
      ).toBe(esperado)
    }
  })

  it('EL CONTROL (punto 2): con la línea base corrompida, la comparación SÍ se pone roja', () => {
    // Sin esto, «todo coincide» no diría si la comparación compara o si compara
    // dos cosas que siempre son iguales. Se corrompe la copia EN MEMORIA: un
    // control que edita el archivo del que depende el test de arriba puede dejar
    // el árbol roto si falla en el medio.
    const real = { ...BASE.ticksHastaLoPertinente.porOrden }
    const corrompida = { ...real }
    const primera = Object.keys(corrompida)[0] as string
    corrompida[primera] = 999

    const movidas = Object.keys(corrompida).filter((f) => corrompida[f] !== real[f])
    console.log(`  con un valor cambiado a mano, la comparación reporta: ${movidas.join(', ')}`)
    expect(movidas).toEqual([primera])
  })

  it('el archivo lleva la regla adentro, y dice qué NO entra', () => {
    // La mitad del mecanismo que no es código, y la que `skills/tests/linea-base.json`
    // ya declaraba desde el Hito 4. Un archivo que se actualiza solo no defiende
    // nada: sólo registra lo último que pasó.
    expect(BASE.comoSeSube).toContain('A MANO')
    // Y la línea que impide el error más caro de este hito: meter un número de
    // reloj de pared en la suite determinista.
    expect(BASE.queNOentraAca).toContain('RELOJ DE PARED')
  })

  it('EL MECANISMO (punto 3): nada de este paquete escribe la línea base', () => {
    // ─── ESTE DETECTOR NECESITÓ TRES VUELTAS EN `@anima/emergencia` ─────────
    //
    // Las tres son la misma frase: **un detector de texto también lee el texto
    // que habla de él**. Buscó la palabra y se acusó a sí mismo; después el `\b`
    // quedó escrito como un byte de retroceso de verdad y no matcheaba NADA
    // —verde por omisión, con la suite entera en verde—; y después el comentario
    // que lo explicaba contenía lo que buscaba.
    //
    // Acá viene con las tres reparaciones puestas de entrada: mira la LLAMADA,
    // ignora los comentarios (como `ataque-determinismo` ya hacía), y **se prueba
    // a sí mismo con carnada** antes de que su cero signifique algo.
    const sinComentarios = (c: string): string =>
      c
        .split('\n')
        .filter((l) => {
          const t = l.trimStart()
          return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
        })
        .join('\n')
    const escribeLaBase = (c: string): boolean =>
      /\b(?:writeFileSync|appendFileSync|createWriteStream)\s*\(/.test(c) && /linea-base/.test(c)

    // La carnada, partida en dos para que este archivo no contenga la secuencia.
    const escritura = 'write' + 'FileSync'
    expect(escribeLaBase(`${escritura}("linea-base.json", x)`), 'el detector no muerde').toBe(true)
    expect(escribeLaBase(`// nunca uses ${escritura} sobre linea-base`), 'muerde una mención').toBe(false)
    expect(escribeLaBase(`${escritura}(otraCosa)`), 'muerde otro archivo').toBe(false)

    const dirs: readonly [URL, string][] = [
      [new URL('../src/', import.meta.url), '../src/'],
      [new URL('./', import.meta.url), './'],
    ]
    const escriben: string[] = []
    for (const [dir, prefijo] of dirs) {
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.ts')) continue
        const c = sinComentarios(readFileSync(new URL(prefijo + f, import.meta.url), 'utf8'))
        if (escribeLaBase(c)) escriben.push(prefijo + f)
      }
    }
    console.log(`  fuentes que escriben la línea base: ${escriben.length === 0 ? 'ninguno' : escriben.join(', ')}`)
    expect(escriben).toEqual([])
  })
})
