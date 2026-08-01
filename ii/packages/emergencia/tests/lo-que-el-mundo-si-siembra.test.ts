// ─── ¿ES CULPA DEL MUNDO O DEL ARNÉS? ────────────────────────────────────────
//
// `hito-5-la-emergencia.test.ts` reporta, en las VEINTE semillas, la misma línea:
//
//     encendible vara 1.0000 kg
//
// Veinte semillas distintas dando exactamente el mismo número al cuarto decimal
// no es un sorteo: es una constante. Y lo es — sale de la línea que ese mismo
// arnés escribe a mano:
//
//     { body: cuerpo('vara', 'madera', 1), at: { x: p.x + 3, y: p.y } }
//
// De ahí salió la conclusión «las nueve secuencias miden cero por culpa DEL
// MUNDO: no puede haber fuego, porque el encendible más liviano pesa 1,0000 kg
// contra el techo de 0,7132». La conclusión es correcta SOBRE ESA ESCENA y falsa
// sobre el mundo: la escena la puso el arnés.
//
// Este archivo mide lo otro: **qué siembra el dios de verdad**, en las mismas
// veinte semillas, alrededor del mismo punto de arranque. Si el mundo decreta
// varas por debajo del techo de la fricción, entonces el cero de la emergencia no
// es un límite de la física sino del banco donde se la midió — y eso cambia qué
// hay que arreglar.
//
// Es la tercera vez en este proyecto que una conclusión sale de medir el
// CATÁLOGO —o acá, el arnés— en vez del mundo. La anterior dio por muerta la
// propagación del fuego, que sí existe.

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, qualityOf } from '@anima/physics'
import type { Body, Physics } from '@anima/physics'
import { crearDios, decretoDe } from '@anima/world'

import { potenciaSiArdiera, ROL_A_DE_FRICCION, TECHO_DE_LA_FRICCION } from '../src/index.js'

/** Las mismas veinte de `§10`, y el mismo arranque que usa el arnés de la emergencia. */
const SEMILLA_BASE = 20260728n
const PARTIDAS = 20
/** El radio en CHUNKS alrededor del arranque. El dios decreta por chunk. */
const RADIO = 1

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

/** Un cuerpo de una pieza, como el que el mundo materializa de una `Suelta`. */
function cuerpoDe(substance: string, mass: number): Body {
  return { id: 'x', form: 'vara', parts: [{ substance, mass, q: {} }], joints: [], state: {} }
}

/**
 * El `where` del rol `a` de `friccion`, evaluado con `qualityOf` del motor.
 *
 * No se copia el 0,5: se lee el `Role` que el catálogo publica. Si mañana el rol
 * pide otra cosa, este archivo se entera solo — que es la diferencia entre medir
 * el mundo y medir una constante que uno se acuerda. La primera versión de este
 * archivo comparaba un número contra `ROL_A_DE_FRICCION`, que es una FUNCIÓN, y
 * daba `false` siempre: cero encendibles con 264 varas de madera a la vista.
 */
function cumpleElRol(b: Body, phys: Physics): boolean {
  return ROL_A_DE_FRICCION().where.every((t) => {
    const v = qualityOf(b, t.q, phys)
    return t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
  })
}

describe('lo que el mundo SÍ siembra, contra lo que el arnés pone a mano', () => {
  it('el dios decreta varas POR DEBAJO del techo de la fricción, en casi todas las semillas', () => {
    const filas: string[] = [
      '─── LO QUE EL DIOS SIEMBRA ALREDEDOR DEL ARRANQUE (9 chunks) ───',
      `  el techo de la fricción es ${TECHO_DE_LA_FRICCION.toFixed(4)} kg`,
      `  el arnés de la emergencia pone A MANO una vara de 1,0000 kg y nada más`,
      '',
      '  semilla   │ sueltas │ encendibles │ la más liviana │ ¿hay una que se pueda encender?',
      '  ──────────┼─────────┼─────────────┼────────────────┼───────────────────────────────',
    ]

    let semillasConEncendible = 0
    let laMasLivianaDeTodas = Number.POSITIVE_INFINITY
    const porSustancia = new Map<string, number>()

    for (let k = 0; k < PARTIDAS; k++) {
      const semilla = SEMILLA_BASE + BigInt(k)
      // `decretoDe` memoiza por `(Physics, "cx:cy")` y LA SEMILLA NO ENTRA en la
      // llave. Sin una `Physics` nueva por semilla, las veinte leerían el decreto
      // de la primera y este archivo mediría una sola semilla veinte veces — que es
      // justo la clase de error que vino a corregir.
      const phys = buildSeedPhysics()
      const dios = crearDios(semilla)
      let sueltas = 0
      let encendibles = 0
      let masLiviana = Number.POSITIVE_INFINITY

      for (let cx = -RADIO; cx <= RADIO; cx++) {
        for (let cy = -RADIO; cy <= RADIO; cy++) {
          const d = decretoDe(dios, phys, cx, cy)
          for (const s of d.chunk.sueltas) {
            sueltas += 1
            porSustancia.set(s.substance, (porSustancia.get(s.substance) ?? 0) + 1)
            const masa = s.masa / 1000
            const b = cuerpoDe(s.substance, masa)
            // Las dos condiciones del rol `a` de `friccion`, LEÍDAS DEL CATÁLOGO y
            // preguntadas al motor: que cumpla el `where` del rol, y que entregue
            // potencia si ardiera. La piedra pasa la primera y falla la segunda
            // (`fuelEnergy` 0), y por eso las dos hacen falta.
            if (!cumpleElRol(b, phys)) continue
            if (potenciaSiArdiera(b, phys) <= 0) continue
            encendibles += 1
            if (masa < masLiviana) masLiviana = masa
          }
        }
      }

      if (masLiviana <= TECHO_DE_LA_FRICCION) semillasConEncendible += 1
      if (masLiviana < laMasLivianaDeTodas) laMasLivianaDeTodas = masLiviana
      filas.push(
        `  ${String(semilla).padStart(9)} │ ${String(sueltas).padStart(7)} │ ${String(encendibles).padStart(11)} │ ` +
          `${(masLiviana === Number.POSITIVE_INFINITY ? '—' : masLiviana.toFixed(4)).padStart(14)} │ ` +
          `${masLiviana <= TECHO_DE_LA_FRICCION ? 'SÍ' : 'no'}`,
      )
    }

    filas.push('')
    filas.push(`  semillas con al menos una vara encendible: ${String(semillasConEncendible)} de ${String(PARTIDAS)}`)
    filas.push(`  la más liviana de las veinte: ${laMasLivianaDeTodas.toFixed(4)} kg`)
    filas.push('')
    filas.push('  y lo que hay suelto, por sustancia:')
    for (const [s, n] of [...porSustancia].sort((a, b) => b[1] - a[1])) {
      filas.push(`    ${s.padEnd(14)} ${String(n).padStart(4)}`)
    }
    log(filas)

    // ESTO ES LO QUE SE AFIRMA: el mundo decretado NO es el que el arnés arma.
    // Si esto se pusiera en rojo, la conclusión «no puede haber fuego» pasaría a
    // ser del mundo y habría que rediscutir la física; mientras esté verde, lo
    // que hay que arreglar es el banco.
    expect(semillasConEncendible).toBeGreaterThan(0)
    expect(laMasLivianaDeTodas).toBeLessThan(TECHO_DE_LA_FRICCION)

    // Y los dos números CLAVADOS, para que moverlos se note. No son un umbral
    // que alguien eligió: son lo que el dios decreta hoy con estas veinte
    // semillas, y si mañana dan otra cosa es porque cambió la tabla de biomas o
    // el sorteo de masas — que es exactamente lo que uno quiere enterarse.
    expect(semillasConEncendible).toBe(13)
    expect(Number(laMasLivianaDeTodas.toFixed(4))).toBe(0.061)
  })
})
