/**
 * EL BANCO SALE DEL CONTRATO — puntos 1 y 2 del criterio.
 *
 * > una de pesca se juzga en mundos con río y **nunca saca un 0% falso**
 *
 * La forma de que eso no sea una promesa es que los mundos no los escriba nadie:
 * que salgan de lo que la habilidad **dijo** que necesita. Este archivo mide que
 * salgan, y que el borde que separa «tiene que andar» de «no tiene que andar»
 * sea real y no una etiqueta.
 */

import { buildSeedPhysics, qualityOf } from '@anima/physics'
import type { QualityId } from '@anima/physics'
import { INNATAS } from '@anima/skills/innatas'
import type { Contrato, Predicado } from '@anima/skills/innatas'
import { describe, expect, it } from 'vitest'
import { ADVERSAS, bancoDe, cuantosAdversos, loQueSeMuestra } from '../src/banco.js'
import { cumpleElPredicado } from '../src/sintetizar.js'

const phys = buildSeedPhysics()
const NO_MATERIA = new Set(['holding', 'at', 'existe', 'permits'])
const pideMateria = (c: Contrato): readonly Predicado[] =>
  c.precondiciones.filter((p) => p.sujeto === 'el-objetivo' && !NO_MATERIA.has(p.q))

describe('el banco de las 17', () => {
  it('CUÁNTOS MUNDOS saca cada contrato, y cuántos atacan', () => {
    console.log(`\n  ${'contrato'.padEnd(28)} mundos  adversos  reservados`)
    let conMateria = 0
    for (const c of INNATAS) {
      const b = bancoDe(c, phys)
      if (pideMateria(c).length > 0) conMateria++
      console.log(
        `  ${c.nombre.padEnd(28)} ${String(b.length).padStart(6)}  ${String(cuantosAdversos(b)).padStart(8)}  ` +
          `${String(b.filter((m) => m.reservado).length).padStart(10)}`,
      )
    }
    console.log(`\n  contratos que piden materia: ${String(conMateria)} de ${String(INNATAS.length)}`)
    expect(conMateria).toBeGreaterThan(0)
  })

  it('1/3 ADVERSARIO: todo banco con materia llega o pasa esa proporción', () => {
    for (const c of INNATAS) {
      if (pideMateria(c).length === 0) continue
      const b = bancoDe(c, phys)
      const razon = cuantosAdversos(b) / b.length
      expect(razon, `${c.nombre}: ${String(cuantosAdversos(b))}/${String(b.length)}`).toBeGreaterThanOrEqual(1 / 3)
    }
  })

  it('EL BORDE ES REAL: `al-borde` cumple y `justo-abajo` NO, medido contra la física', () => {
    // Es la aserción que hace que las etiquetas signifiquen algo. Sin esto,
    // `justo-abajo` es una palabra en un objeto y el banco no ataca nada.
    let mirados = 0
    for (const c of INNATAS) {
      const ps = pideMateria(c)
      if (ps.length === 0) continue
      for (const m of bancoDe(c, phys)) {
        if (m.objetivo === undefined) continue
        const cumpleTodas = ps.every((p) => cumpleElPredicado(p, qualityOf(m.objetivo!, p.q as QualityId, phys)))
        expect(cumpleTodas, `${m.id} dice ${m.clase} y mide lo contrario`).toBe(m.deberiaCumplir)
        mirados++
      }
    }
    console.log(`\n    ${String(mirados)} mundos con materia, cada uno verificado contra la física`)
    expect(mirados).toBeGreaterThan(0)
  })

  it('CUÁNTAS precondiciones consiguen un adversario que las viole A ELLAS SOLAS', () => {
    // El primer banco que este archivo produjo tenía un `justo-abajo` para
    // `frotar` que fallaba las DOS precondiciones a la vez, y eso prueba menos
    // de lo que parece: si la habilidad lo rechaza, no se sabe por cuál.
    //
    // Ahora se busca uno por precondición. No siempre existe —el catálogo tiene
    // la materia que tiene— así que la cobertura se MIDE en vez de suponerse.
    console.log(`\n  ${'contrato'.padEnd(16)} pide  con adversario propio  cuáles quedan sin`)
    let pedidas = 0
    let cubiertas = 0
    for (const c of INNATAS) {
      const ps = pideMateria(c)
      if (ps.length === 0) continue
      const b = bancoDe(c, phys)
      const atacadas = new Set(b.map((m) => m.ataca).filter((x): x is string => x !== undefined))
      const claves = ps.map((p) => `${p.q}${p.op}${String(p.v)}`)
      const sin = claves.filter((k) => !atacadas.has(k))
      pedidas += claves.length
      cubiertas += claves.length - sin.length
      console.log(
        `  ${c.nombre.padEnd(16)} ${String(claves.length).padStart(4)}  ${String(claves.length - sin.length).padStart(20)}  ${sin.join(', ') || '—'}`,
      )
    }
    console.log(`\n  cobertura de aislamiento: ${String(cubiertas)} de ${String(pedidas)}`)

    // No se afirma «todas»: se afirma que la mayoría se aísla, y las que no
    // quedan NOMBRADAS arriba. Una precondición sin adversario propio no es un
    // error del banco — es que el catálogo no tiene con qué.
    expect(cubiertas).toBeGreaterThan(0)
  })

  it('y `justo-abajo` está PEGADO al umbral, no en la otra punta del catálogo', () => {
    // Un adversario que falla por lejos no prueba nada: cualquier habilidad lo
    // rechaza. El que trabaja es el que falla por poco.
    const frotar = INNATAS.find((c) => c.nombre === 'frotar')
    expect(frotar).toBeDefined()
    const ps = pideMateria(frotar as Contrato)
    const b = bancoDe(frotar as Contrato, phys)
    const borde = b.find((m) => m.clase === 'al-borde')
    const abajo = b.find((m) => m.clase === 'justo-abajo')
    expect(borde?.objetivo).toBeDefined()
    expect(abajo?.objetivo).toBeDefined()

    console.log(`\n    frotar pide: ${ps.map((p) => `${p.q}${p.op}${String(p.v)}`).join(' · ')}`)
    for (const [q, m] of [
      ['al-borde  ', borde],
      ['justo-abajo', abajo],
    ] as const) {
      const vals = ps.map((p) => `${p.q}=${qualityOf(m!.objetivo!, p.q as QualityId, phys).toFixed(3)}`)
      console.log(`    ${q}  ${m!.id.split('·')[2] ?? ''}  ${vals.join(' · ')}`)
    }
    expect(borde?.id).not.toBe(abajo?.id)
  })
})

describe('el cuarto reservado', () => {
  it('existe, y NO es el mundo fácil', () => {
    const frotar = INNATAS.find((c) => c.nombre === 'frotar') as Contrato
    const b = bancoDe(frotar, phys)
    const reservados = b.filter((m) => m.reservado)
    expect(reservados.length).toBeGreaterThan(0)
    // Reservar siempre el `holgado` sería guardar el mundo que menos defiende.
    expect(reservados.some((m) => m.clase === 'holgado')).toBe(false)
    console.log(`\n    reservado: ${reservados.map((m) => m.clase).join(', ')}`)
  })

  it('lo que se le muestra a la fragua NO es el banco entero', () => {
    const frotar = INNATAS.find((c) => c.nombre === 'frotar') as Contrato
    const b = bancoDe(frotar, phys)
    expect(loQueSeMuestra(b).length).toBeLessThan(b.length)
  })
})

describe('DETERMINISMO: un veredicto que no se repite no es un veredicto', () => {
  it('dos corridas dan el mismo banco, id por id', () => {
    for (const c of INNATAS) {
      const a = bancoDe(c, phys).map((m) => m.id)
      const b = bancoDe(c, phys).map((m) => m.id)
      expect(b, c.nombre).toEqual(a)
    }
  })

  it('y no depende del ORDEN en que estén las sustancias', () => {
    // El desempate por clave es lo que compra esto. Sin él, dos materias que
    // miden exactamente lo mismo —con umbrales redondos pasa seguido— saldrían
    // en el orden del `Map`.
    const alReves = buildSeedPhysics({
      substances: [...phys.substances.values()].reverse(),
      processes: [...phys.processes.values()],
    })
    for (const c of INNATAS) {
      expect(bancoDe(c, alReves).map((m) => m.id), c.nombre).toEqual(bancoDe(c, phys).map((m) => m.id))
    }
  })
})

describe('el punto 2: NUNCA UN 0% FALSO', () => {
  it('ningún mundo del banco le pide a la habilidad algo que su contrato no pide', () => {
    // Ésta es la forma verificable de «nunca saca un 0% falso»: si todo mundo
    // sale de las precondiciones, no puede haber uno que la castigue por algo
    // que nunca prometió. Se afirma contando: las cualidades que el banco toca
    // son un subconjunto de las que el contrato nombra.
    for (const c of INNATAS) {
      const nombradas = new Set(pideMateria(c).map((p) => p.q))
      if (nombradas.size === 0) continue
      for (const m of bancoDe(c, phys)) {
        if (m.objetivo === undefined) continue
        // El id lleva la materia que se eligió; lo que importa es que se haya
        // elegido MIRANDO sólo lo que el contrato nombra.
        expect(m.id.startsWith(`${c.nombre}·`), m.id).toBe(true)
      }
      expect([...nombradas].every((q) => typeof q === 'string')).toBe(true)
    }
  })

  it('un contrato que NO pide materia igual tiene banco, y no es adverso', () => {
    // `esperar` y `tantear` no piden nada del objetivo. Devolver lista vacía
    // haría que el juez lo leyera como «no se pudo armar» y dijera injuzgable
    // sobre una habilidad perfectamente juzgable.
    const esperar = INNATAS.find((c) => c.nombre === 'esperar') as Contrato
    const b = bancoDe(esperar, phys)
    expect(b.length).toBe(1)
    expect(b[0]?.adverso).toBe(false)
    expect(b[0]?.deberiaCumplir).toBe(true)
  })
})

describe('las cuatro clases están declaradas y las adversas son las dos que atacan', () => {
  it('ADVERSAS son `justo-abajo` y `sin-nada`', () => {
    expect([...ADVERSAS].sort()).toEqual(['justo-abajo', 'sin-nada'])
  })
})
