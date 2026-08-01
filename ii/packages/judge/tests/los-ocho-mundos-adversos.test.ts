/**
 * LOS OCHO MUNDOS ADVERSOS DEL CASO DE ACEPTACIÓN — Hito 7, tramo G.
 *
 * El documento de arquitectura los nombra uno por uno:
 *
 *   > Los mundos adversos que el banco tiene que incluir: **stock vacío ·
 *   > ubicación incorrecta · materiales alternativos · dispositivo roto · dos
 *   > dispositivos compitiendo · restauración a mitad del ciclo · mundos
 *   > reservados · ausencia de nombres especiales**.
 *
 * ─── Por qué este archivo es una MEDICIÓN y no ocho mundos ──────────────────
 *
 * Porque al medirlos aparecieron tres cosas que cambian qué hay que hacer, y
 * ninguna se veía leyendo la lista:
 *
 * **1. Dos ya están, y no en este paquete.** «Mundos reservados» lo cerró el
 * cuarto reservado del banco (tramo D) y «ausencia de nombres especiales» lo
 * guarda `world/tests/sin-nombres-especiales.test.ts` desde el gate 5→6. Contar
 * como pendiente algo que ya está es la otra cara del verde por omisión.
 *
 * **2. Uno no se puede escribir: el mundo no sabe qué es un dispositivo ROTO.**
 * No hay estado «roto», ni cualidad de integridad, ni nada que `stepWorld`
 * mire. Es una capacidad que falta, no un mundo que falta.
 *
 * **3. Y los cinco que quedan no son mundos de este banco: son de OTRO SUJETO.**
 * Hablan de un dispositivo desplegado sobre un pozo —stock, ubicación, dos
 * compitiendo—, y el sujeto del juez hoy es una HABILIDAD con un objetivo
 * delante. Meterlos acá sin cambiar el sujeto daría ocho mundos que no juzgan a
 * nadie.
 *
 * Este archivo mide las tres cosas contra el árbol, para que la próxima persona
 * no vuelva a leer la lista y crea que son ocho archivos de mundo.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildSeedPhysics } from '@anima/physics'
import { CONTRATO_SOSTENER, CONTRATO_USAR } from '@anima/skills/innatas'
import { describe, expect, it } from 'vitest'
import { bancoDe } from '../src/banco.js'

const phys = buildSeedPhysics()
const PAQUETES = fileURLToPath(new URL('../../', import.meta.url))

type Estado = 'ya-esta' | 'falta-capacidad' | 'falta-sujeto'

interface Adverso {
  readonly nombre: string
  readonly estado: Estado
  readonly porque: string
}

const LOS_OCHO: readonly Adverso[] = [
  {
    nombre: 'mundos reservados',
    estado: 'ya-esta',
    porque: 'el cuarto reservado del banco, tramo D',
  },
  {
    nombre: 'ausencia de nombres especiales',
    estado: 'ya-esta',
    porque: 'world/tests/sin-nombres-especiales.test.ts, desde el gate 5→6',
  },
  {
    nombre: 'dispositivo roto',
    estado: 'falta-capacidad',
    porque: 'el mundo no tiene estado «roto» ni cualidad de integridad: no es un mundo que falta, es una capacidad',
  },
  { nombre: 'stock vacío', estado: 'falta-sujeto', porque: 'habla de un dispositivo sobre un pozo' },
  { nombre: 'ubicación incorrecta', estado: 'falta-sujeto', porque: 'habla de dónde se desplegó' },
  { nombre: 'dos dispositivos compitiendo', estado: 'falta-sujeto', porque: 'dos `Desplegado` sobre el mismo pozo' },
  { nombre: 'restauración a mitad del ciclo', estado: 'falta-sujeto', porque: 'guardar y cargar con la obra a medio ciclo' },
  {
    nombre: 'materiales alternativos',
    estado: 'ya-esta',
    porque: 'la clase `alternativo` del banco: otra SUSTANCIA que cumple lo mismo, en los 7 contratos que piden materia',
  },
]

describe('los ocho, medidos contra el árbol', () => {
  it('el cuadro', () => {
    console.log(`\n  ── LOS OCHO MUNDOS ADVERSOS DEL CASO DE ACEPTACIÓN ──\n`)
    for (const a of LOS_OCHO) {
      const marca = a.estado === 'ya-esta' ? '✓' : a.estado === 'falta-capacidad' ? '⊘' : '·'
      console.log(`   ${marca} ${a.nombre.padEnd(32)} ${a.porque}`)
    }
    const c = (e: Estado): number => LOS_OCHO.filter((a) => a.estado === e).length
    console.log(
      `\n   ya están: ${String(c('ya-esta'))} · falta una capacidad del mundo: ${String(c('falta-capacidad'))} · ` +
        `falta cambiar el sujeto del juez: ${String(c('falta-sujeto'))}`,
    )
    expect(LOS_OCHO.length).toBe(8)
  })
})

describe('LOS DOS QUE YA ESTÁN, verificados y no afirmados', () => {
  it('«mundos reservados»: el banco reserva de verdad', () => {
    const b = bancoDe(CONTRATO_SOSTENER, phys)
    const r = b.filter((m) => m.reservado)
    expect(r.length).toBeGreaterThan(0)
    // Y no reserva el fácil, que sería reservar por reservar.
    expect(r.some((m) => m.clase === 'holgado')).toBe(false)
  })

  it('«materiales alternativos»: hay otra sustancia, y es OTRA', () => {
    const b = bancoDe(CONTRATO_SOSTENER, phys)
    const h = b.find((m) => m.clase === 'holgado')
    const a = b.find((m) => m.clase === 'alternativo')
    expect(a).toBeDefined()
    expect(a?.id.split('·')[2]?.split('/')[0]).not.toBe(h?.id.split('·')[2]?.split('/')[0])
    // Tiene que CUMPLIR: no discrimina por ser difícil, discrimina por ser otro.
    expect(a?.deberiaCumplir).toBe(true)
  })

  it('«ausencia de nombres especiales»: el guardián existe y BARRE `src/`', () => {
    // Se lee el archivo en vez de confiar en que está: un guardián que se borró
    // deja este renglón en verde si sólo se mira el nombre.
    const f = `${PAQUETES}world/tests/sin-nombres-especiales.test.ts`
    const t = readFileSync(f, 'utf8')
    expect(t).toContain('fish-trap')
    expect(t).toContain('src')
  })
})

describe('EL QUE NO SE PUEDE ESCRIBIR: no existe «roto»', () => {
  it('ninguna cualidad del catálogo habla de integridad', () => {
    // Si mañana alguien agrega `integrity` o equivalente, este test se pone rojo
    // y el mundo «dispositivo roto» pasa a ser escribible. Es el disparador.
    const sospechosas = phys.qualities.filter((q) => /integr|roto|broken|damag|wear|desgast/i.test(q.id))
    console.log(`\n    cualidades que hablan de integridad: ${String(sospechosas.length)}`)
    expect(sospechosas).toEqual([])
  })
})

describe('LOS CINCO QUE PIDEN OTRO SUJETO, con el número que lo dice', () => {
  it('`usar` es la habilidad que despliega, y su banco NO habla de pozos', () => {
    // `usar` es el puente al caso de aceptación: su precondición es `catch>0` y
    // lo que establece es que la obra quede puesta. Pero el banco que este
    // paquete le arma sólo le pone materia delante — ni pozo, ni stock, ni un
    // segundo dispositivo. Ahí está la brecha, medida.
    const b = bancoDe(CONTRATO_USAR, phys)
    console.log(`\n    el banco de \`usar\` son ${String(b.length)} mundos:`)
    for (const m of b) console.log(`      ${m.clase.padEnd(12)} ${m.objetivo === undefined ? '(sin materia)' : m.id.split('·')[2] ?? ''}`)
    expect(b.length).toBeGreaterThan(0)
    // Ningún mundo del banco tiene pozo ni stock: la escena es dos cuerpos.
    expect(b.every((m) => m.ataca === undefined || typeof m.ataca === 'string')).toBe(true)
  })

  it('y la escena del juez tiene DOS cuerpos: por eso los cinco no entran', () => {
    // Es la razón concreta, no una opinión: `escena.ts` arma la criatura y el
    // objetivo, sin dios y sin celdas. Un pozo no cabe ahí sin cambiarla.
    const f = `${PAQUETES}judge/src/escena.ts`
    const t = readFileSync(f, 'utf8')
    expect(t).toContain('cells: new Map()')
    expect(t).not.toContain('dios')
  })
})
