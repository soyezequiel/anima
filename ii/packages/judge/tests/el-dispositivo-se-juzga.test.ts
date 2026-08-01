/**
 * EL JUEZ JUZGA UN DISPOSITIVO — tramo H, y los cuatro mundos que faltaban.
 *
 * Es el sujeto del caso de aceptación: **un aparejo desplegado que trabaja
 * solo**. Y es el que hace medible el cargo `utilidad`, que con una habilidad
 * salía `inconcluso` por no haber contra qué.
 *
 * La semilla es `20260727n`, la misma que
 * `world/tests/el-dispositivo-retiene-solo.test.ts`. No se eligió acá: si los
 * dos archivos midieran mundos distintos, un desacuerdo entre ellos no diría
 * nada.
 */

import { buildSeedPhysics, qualityOf } from '@anima/physics'
import type { Body } from '@anima/physics'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { crearDios } from '@anima/world'
import { describe, expect, it } from 'vitest'
import {
  buscarOrilla,
  correrElBancoDeDispositivo,
  FLEXIBILIDAD_DE_LO_QUEMADO,
  juzgarDispositivo,
  quemado,
} from '../src/dispositivo.js'
import type { Dictamen } from '../src/tipos.js'

const phys = buildSeedPhysics()
const SEMILLA = 20260727n

/**
 * UNA OBRA CON PUNTAS SUELTAS: vara con una hebra atada de un solo lado.
 *
 * No se llama de ninguna manera y es el punto 12 del gate: lo único que la hace
 * retener es que su `catch` da mayor que cero, y eso sale de la geometría.
 */
function obraConPuntas(id: string): Body {
  return {
    id,
    form: 'vara',
    parts: [
      { substance: 'madera', mass: 0.5, q: {} },
      { substance: 'liana', mass: 0.2, q: {} },
    ],
    joints: [{ a: 0, b: 1, via: 'liana', strength: 0.4 }],
    state: {},
  } as unknown as Body
}

/** Un palo pelado: `catch` da cero y no retiene nada. */
function palo(id: string): Body {
  return { id, form: 'vara', parts: [{ substance: 'madera', mass: 0.5, q: {} }], joints: [], state: {} } as unknown as Body
}

function mostrar(d: Dictamen): void {
  console.log(`\n  ── ${d.habilidad} → ${d.grado.toUpperCase()} ──`)
  for (const c of d.cargos) {
    const n = c.corrida.mundos === 0 ? '' : ` [${String(c.corrida.aprobados)}/${String(c.corrida.mundos)}]`
    console.log(`    ${c.cargo.padEnd(13)} ${c.grado.padEnd(12)}${n}  ${c.porque}`)
  }
  for (const r of d.regresiones) console.log(`    regresión: ${r.semilla} (${r.queSeEspera})`)
}

describe('LA PREMISA: la orilla existe y la geometría manda', () => {
  it('la semilla tiene una orilla, y el juez la encuentra sin azar', () => {
    const o = buscarOrilla(crearDios(SEMILLA), phys)
    expect(o, 'la semilla no tiene orilla en 13×13 chunks').toBeDefined()
    console.log(`\n    pozo en (${String(o?.pozo.x)}, ${String(o?.pozo.y)}) · parada seca en (${String(o?.parada.x)}, ${String(o?.parada.y)})`)
  })

  it('la obra tiene `catch` y el palo pelado no', () => {
    const c1 = qualityOf(obraConPuntas('o'), 'catch', phys)
    const c2 = qualityOf(palo('p'), 'catch', phys)
    console.log(`    obra con puntas: catch = ${c1.toFixed(3)} · palo pelado: catch = ${c2.toFixed(3)}`)
    expect(c1).toBeGreaterThan(0)
    expect(c2).toBe(0)
  })
})

describe('EL DICTAMEN DE UN APAREJO QUE PESCA', () => {
  const d = juzgarDispositivo(obraConPuntas('aparejo'), phys, SEMILLA)

  it('los cuatro cargos, y `utilidad` YA NO ES `inconcluso`', () => {
    mostrar(d)
    const u = d.cargos.find((c) => c.cargo === 'utilidad')
    expect(u?.grado).not.toBe('inconcluso')
    // Es el número que con una habilidad no existía: cuántas piezas sacó sola.
    expect(u?.porque).toMatch(/sacó \d+ pieza/)
  })

  it('se queda QUIETO donde no hay nada que sacar', () => {
    const uso = d.cargos.find((c) => c.cargo === 'uso')
    expect(uso?.corrida.adversos).toBeGreaterThan(0)
    expect(uso?.grado).toBe('promueve')
  })

  it('PROMUEVE — y es lo primero del proyecto que aprueba', () => {
    // Vale su renglón: con una habilidad como sujeto NADA podía promover, porque
    // `utilidad` salía `inconcluso` y el dictamen toma la peor nota. El juez
    // estaba completo para rechazar y no para aprobar. Acá deja de estarlo.
    expect(d.grado).toBe('promueve')
    expect(d.cargos.every((c) => c.grado === 'promueve')).toBe(true)
    expect(d.regresiones).toEqual([])
  })

  it('y `construccion` NO castiga al aparejo por el mundo mal puesto', () => {
    // Medido: en `ubicacion-incorrecta` el mundo no registra el `Desplegado` —
    // no se puede dejar un aparejo en tierra seca. La primera versión de este
    // cargo miraba los cinco mundos y sacaba «se cayó del despliegue» con los
    // cinco comportándose como debían.
    const c = d.cargos.find((x) => x.cargo === 'construccion')
    expect(c?.grado).toBe('promueve')
    expect(c?.porque).toContain('sobre el pozo')
  })
})

describe('LOS CINCO MUNDOS QUE EL TRAMO G NO PODÍA ESCRIBIR', () => {
  const o = buscarOrilla(crearDios(SEMILLA), phys)
  const cs = correrElBancoDeDispositivo(obraConPuntas('aparejo'), o!, phys)

  it('el cuadro, mundo por mundo', () => {
    console.log(`\n  ${'mundo'.padEnd(24)} ${'atrapó'.padStart(7)}  ${'esperado'.padEnd(16)} ¿como debía?`)
    for (const c of cs) {
      console.log(
        `  ${c.mundo.clase.padEnd(24)} ${String(c.atrapo).padStart(7)}  ` +
          `${(c.mundo.deberiaAtrapar ? 'que saque' : 'que NO saque').padEnd(16)} ${c.comoDebia ? 'sí' : 'NO'}`,
      )
    }
    expect(cs.length).toBe(6)
  })

  it('«normal»: saca solo, sin actor', () => {
    const n = cs.find((c) => c.mundo.clase === 'normal')
    expect(n?.atrapo).toBeGreaterThan(0)
  })

  it('«stock vacío»: el pozo agotado no inventa peces', () => {
    expect(cs.find((c) => c.mundo.clase === 'stock-vacio')?.atrapo).toBe(0)
  })

  it('«ubicación incorrecta»: desplegado en la celda seca, no saca', () => {
    // El `Desplegado` resuelve contra qué pozo trabaja AL DESPLEGAR. Puesto en
    // la orilla no resuelve ninguno, así que no puede sacar nada.
    expect(cs.find((c) => c.mundo.clase === 'ubicacion-incorrecta')?.atrapo).toBe(0)
  })

  it('«dispositivo roto»: el aparejo quemado no pesca', () => {
    // Y NO es un mundo inventado: la ley 4 le pone `flexibility: 0.02` a lo que
    // arde, y `freeStrandEnds` --lo unico que da `catch`-- exige 0,80. Un
    // aparejo al que se le quema la hebra deja de retener sin que nadie
    // programe «roto». Sobre el MISMO pozo lleno, así que lo único que cambia
    // es él.
    expect(cs.find((c) => c.mundo.clase === 'dispositivo-roto')?.atrapo).toBe(0)
    expect(qualityOf(quemado(obraConPuntas('q')), 'catch', phys)).toBe(0)
  })

  it('y el número de lo quemado sale de la LEY, no de acá', () => {
    // El guardián: si la ley 4 cambiara ese número, este mundo estaría
    // rompiendo un aparejo de una forma que el mundo ya no produce.
    const ley = readFileSync(fileURLToPath(new URL('../../physics/src/leyes.ts', import.meta.url)), 'utf8')
    expect(ley, 'la ley 4 ya no le pone flexibility 0.02 al residuo').toContain(
      `flexibility: ${String(FLEXIBILIDAD_DE_LO_QUEMADO)}`,
    )
  })

  it('«dos compitiendo»: se REPARTEN, no se duplican', () => {
    // El control que importa: si dos aparejos sacaran cada uno lo mismo que uno
    // solo, el pozo sería una fuente infinita y la economía entera se cae.
    const uno = cs.find((c) => c.mundo.clase === 'normal')?.atrapo ?? 0
    const dos = cs.find((c) => c.mundo.clase === 'dos-compitiendo')?.atrapo ?? 0
    console.log(`\n    uno solo saca ${String(uno)} · dos juntos sacan ${String(dos)} entre los dos`)
    expect(dos).toBeGreaterThan(0)
    expect(dos, 'dos aparejos sacaron el doble: el pozo es una fuente infinita').toBeLessThan(uno * 2)
  })

  it('«restauración a mitad»: guardar y cargar no cambia el resultado', () => {
    const normal = cs.find((c) => c.mundo.clase === 'normal')?.atrapo ?? -1
    const roto = cs.find((c) => c.mundo.clase === 'restauracion-a-mitad')?.atrapo ?? -2
    console.log(`    de una sentada: ${String(normal)} · cortando al medio y siguiendo: ${String(roto)}`)
    expect(roto).toBe(normal)
  })
})

describe('EL CONTROL: un palo pelado no es un dispositivo', () => {
  it('`plano` lo para antes de correr un solo tick', () => {
    const d = juzgarDispositivo(palo('palo'), phys, SEMILLA)
    mostrar(d)
    expect(d.grado).toBe('no-promueve')
    expect(d.cargos.length).toBe(1)
    expect(d.cargos[0]?.porque).toContain('no retiene')
    // Y no siembra regresiones: no corrió nada.
    expect(d.regresiones).toEqual([])
  })
})

describe('DETERMINISMO', () => {
  it('juzgar el mismo aparejo dos veces da el mismo dictamen', () => {
    const a = juzgarDispositivo(obraConPuntas('aparejo'), phys, SEMILLA)
    const b = juzgarDispositivo(obraConPuntas('aparejo'), phys, SEMILLA)
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })
})
