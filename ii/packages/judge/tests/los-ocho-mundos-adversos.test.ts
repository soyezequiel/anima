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
 * **1. Dos ya estaban, y no en este paquete.** «Mundos reservados» lo cerró el
 * cuarto reservado del banco (tramo D) y «ausencia de nombres especiales» lo
 * guarda `world/tests/sin-nombres-especiales.test.ts` desde el gate 5→6. Contar
 * como pendiente algo que ya está es la otra cara del verde por omisión.
 *
 * **2. Uno no se puede escribir: el mundo no sabe qué es un dispositivo ROTO.**
 * No hay estado «roto», ni cualidad de integridad, ni nada que `stepWorld`
 * mire. Es una capacidad que falta, no un mundo que falta, y sigue abierto.
 *
 * **3. Y cuatro no eran mundos de este banco: eran de OTRO SUJETO.** Hablan de
 * un dispositivo desplegado sobre un pozo —stock, ubicación, dos compitiendo,
 * restauración—, y el sujeto del juez era una HABILIDAD con un objetivo delante.
 * Meterlos sin cambiar el sujeto habría dado cuatro mundos que no juzgan a nadie.
 *
 * > **El tramo H les dio el sujeto** (`src/dispositivo.ts`) y los cuatro
 * > entraron. Van **7 de 8**; el único que falta es el que pide una capacidad
 * > del mundo.
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
  { nombre: 'stock vacío', estado: 'ya-esta', porque: 'la clase `stock-vacio` del banco de dispositivo (tramo H) — con la repoblación CONGELADA, si no no está vacío' },
  { nombre: 'ubicación incorrecta', estado: 'ya-esta', porque: 'la clase `ubicacion-incorrecta`: el mundo no registra el `Desplegado` en tierra seca' },
  { nombre: 'dos dispositivos compitiendo', estado: 'ya-esta', porque: 'la clase `dos-compitiendo`: dos aparejos sobre el mismo pozo se REPARTEN, no se duplican' },
  { nombre: 'restauración a mitad del ciclo', estado: 'ya-esta', porque: 'la clase `restauracion-a-mitad`: se corta el ciclo, se copia el estado entero y se sigue' },
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

describe('LOS CUATRO QUE PEDÍAN OTRO SUJETO, y ya lo tienen', () => {
  it('LA BRECHA QUE HUBO: el banco de una HABILIDAD no habla de pozos', () => {
    // Se deja medida porque explica por qué hicieron falta dos sujetos y no uno.
    // `usar` es la habilidad que despliega —precondición `catch>0`— y el banco
    // que este paquete le arma sólo le pone materia delante: ni pozo, ni stock,
    // ni un segundo dispositivo.
    const b = bancoDe(CONTRATO_USAR, phys)
    console.log(`\n    el banco de la HABILIDAD \`usar\` son ${String(b.length)} mundos de materia suelta:`)
    for (const m of b) console.log(`      ${m.clase.padEnd(12)} ${m.objetivo === undefined ? '(sin materia)' : m.id.split('·')[2] ?? ''}`)
    expect(b.length).toBeGreaterThan(0)
  })

  it('y la escena de una habilidad tiene DOS cuerpos: por eso no entraban', () => {
    // La razón concreta, no una opinión: `escena.ts` arma la criatura y el
    // objetivo, sin dios y sin celdas. Un pozo no cabe ahí.
    const t = readFileSync(`${PAQUETES}judge/src/escena.ts`, 'utf8')
    expect(t).toContain('cells: new Map()')
    expect(t).not.toContain('dios')
  })

  it('EL SUJETO NUEVO sí trae dios y pozo, que es lo que los destrabó', () => {
    const t = readFileSync(`${PAQUETES}judge/src/dispositivo.ts`, 'utf8')
    expect(t).toContain('crearDios')
    expect(t).toContain('buscarOrilla')
    for (const clase of ['stock-vacio', 'ubicacion-incorrecta', 'dos-compitiendo', 'restauracion-a-mitad']) {
      expect(t, `falta la clase ${clase}`).toContain(clase)
    }
  })
})
