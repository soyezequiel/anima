/**
 * ¿LA DEVOLUCIÓN MUEVE AL MODELO? — Hito 8, lo último del punto 9.
 *
 * ─── Por qué la corrida anterior no alcanzaba ───────────────────────────────
 *
 * La única vuelta 2 que mejoró (1/4 → 3/4 en mundos reservados) lo hizo con la
 * devolución **pelada**: la pista no se había disparado. O sea que la mejora fue
 * varianza del modelo y no efecto del arreglo, y contarla como éxito habría sido
 * el verde por omisión de siempre disfrazado de número bueno.
 *
 * ─── El diseño: PAREADO, y es lo único que puede atribuir ───────────────────
 *
 * Un modelo que contesta distinto cada vez no se puede medir comparando dos
 * corridas sueltas. Acá cada par comparte **todo**:
 *
 *   · el mismo pedido
 *   · el mismo intento 1 (la misma candidata fallada, el mismo dictamen)
 *   · el mismo encargo de vuelta 2
 *
 * y difiere en **una sola línea**: si el encargo lleva la pista o no.
 *
 * Lo que se cuenta es cuántos pares ganó cada lado en los **mundos reservados**,
 * que son los que el modelo nunca vio.
 *
 * ─── Y sólo entran los pares donde HAY pista ────────────────────────────────
 *
 * Si el intento 1 falla de una forma que ninguna propiedad separa, los dos brazos
 * reciben el mismo texto y el par no mide nada. Esos se descartan **y se
 * cuentan**: cuántas veces la pista no se pudo generar es en sí un resultado.
 */

import { costoDeLaUltima, preguntarTexto, transporteElegido } from '@anima/llm/demo/transporte.js'
import { correrElBanco, loQueTenianEnComun } from '@anima/judge'
import { qualityOf } from '@anima/physics'
import type { QualityId } from '@anima/physics'
import type { CorridaJuzgada } from '@anima/judge'
import { buildSeedPhysics } from '@anima/physics'
import { done, fail, instrument, mount, shadowScope } from '@anima/skills'
import type { FuelCell, Skill } from '@anima/skills'
import { CONTRATO_SOSTENER } from '@anima/skills/innatas'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { leerCandidatas } from '../src/costura.js'
import { elSiguienteEncargo, primerEncargo, textoDe } from '../src/index.js'
import type { Encargo, Superficie } from '../src/encargo.js'
import { forjarUna } from '../src/forjar.js'
import { Puerta } from '../src/puerta.js'

const phys = buildSeedPhysics()

const GAP = [
  'dejar en la mano algo que se pueda levantar.',
  '',
  'Se te va a juzgar así:',
  '  · tenés que TERMINAR BIEN cuando hay algo levantable cerca',
  '  · y tenés que FALLAR cuando no lo hay, en vez de decir que sí',
  '  · y cuando decís que sí, tiene que ser cierto: algo en la mano',
].join('\n')

const VOCABULARIO = ['madera', 'liana', 'carne', 'agua', 'piedra', 'hueso']
const K = 2
const API = readFileSync(fileURLToPath(new URL('../../skills/src/skill-api.d.ts', import.meta.url)), 'utf8')
/**
 * EL CONTRATO, EN LOS TÉRMINOS DE LA API.
 *
 * Se deriva del `Contrato` que el juez ya usa para armar el banco, así que no hay
 * dos verdades: lo que se le pide al modelo es exactamente lo que se le mide.
 */
const QUE_VERIFICAR = [
  ...CONTRATO_SOSTENER.precondiciones.map(
    (p) => `ctx.q(eso, '${String(p.q)}') ${p.op} ${String(p.v)}   // antes de intentarlo`,
  ),
  ...CONTRATO_SOSTENER.establece.map((p) =>
    p.q === 'holding'
      ? `ctx.self.holding.length ${p.op} ${String(p.v)}   // tiene que ser cierto cuando devolvés done()`
      : `ctx.q(eso, '${String(p.q)}') ${p.op} ${String(p.v)}   // cuando devolvés done()`,
  ),
]

const SUPERFICIE: Superficie = {
  api: API,
  desde: '../../src/skill-api.js',
  cuantas: K,
  queVerificar: QUE_VERIFICAR,
}

const pares = Number(process.argv.find((a) => a.startsWith('--pares='))?.split('=')[1] ?? '3')
const topeUsd = Number(process.argv.find((a) => a.startsWith('--tope-usd='))?.split('=')[1] ?? '1')

const puerta = new Puerta(ts)
puerta.revisar('export const tibia = 1\n')
let usd = 0

function montar(codigo: string, nombre: string): { skill: Skill<Record<string, never>>; cell: FuelCell } | undefined {
  try {
    const { js } = instrument(ts, codigo)
    const m = mount(js, { scope: shadowScope(), modules: { '../../src/skill-api.js': { done, fail } } })
    const f = m.exports[nombre]
    return typeof f === 'function' ? { skill: f as Skill<Record<string, never>>, cell: m.cell } : undefined
  } catch {
    return undefined
  }
}

function juzgarTexto(codigo: string, nombre: string): readonly CorridaJuzgada[] | undefined {
  const m = montar(codigo, nombre)
  if (m === undefined) return undefined
  return correrElBanco(
    { acusada: { nombre, contrato: CONTRATO_SOSTENER }, skill: m.skill, cell: m.cell, argsDe: () => ({}) },
    phys,
  )
}

function reservadosOk(cs: readonly CorridaJuzgada[]): number {
  return cs.filter((c) => c.mundo.reservado && c.comoDebia).length
}

function reservados(cs: readonly CorridaJuzgada[]): number {
  return cs.filter((c) => c.mundo.reservado).length
}

/** Un viaje: pide, forja, monta, juzga. Devuelve la mejor de las K. */
async function unViaje(prompt: string): Promise<{ nombre: string; codigo: string; corridas: readonly CorridaJuzgada[] } | undefined> {
  const salida = await preguntarTexto(prompt, 180_000)
  usd += costoDeLaUltima()?.usd ?? 0
  if (salida === undefined) return undefined

  let mejor: { nombre: string; codigo: string; corridas: readonly CorridaJuzgada[] } | undefined
  for (const c of leerCandidatas(salida, primerEncargo('x', []), K)) {
    const f = c.usar
    if (f === undefined) continue
    const i = forjarUna(f.fuente, puerta)
    if (i.desenlace === 'rota') continue
    const corridas = juzgarTexto(i.codigo, f.nombre)
    if (corridas === undefined) continue
    if (mejor === undefined || reservadosOk(corridas) > reservadosOk(mejor.corridas)) {
      mejor = { nombre: f.nombre, codigo: i.codigo, corridas }
    }
  }
  return mejor
}

function cargosDe(cs: readonly CorridaJuzgada[], conPista: boolean): readonly { cargo: string; grado: string; porque: string }[] {
  const mal = cs.filter((c) => !c.comoDebia)
  if (mal.length === 0) return []
  const cuenta = mal.some((c) => c.mundo.adverso)
    ? `dijo que sí en ${String(mal.filter((c) => c.mundo.adverso).length)} mundo(s) donde no había nada que levantar`
    : `no llegó en ${String(mal.length)} mundo(s) donde sí había`
  const pistas = conPista ? loQueTenianEnComun(cs, CONTRATO_SOSTENER, phys) : []
  return [{ cargo: 'construccion', grado: 'no-promueve', porque: [cuenta, ...pistas].join('. ') }]
}

console.log(
  `\ntransporte: ${transporteElegido()} · hasta ${String(pares)} pares · tope US$ ${topeUsd.toFixed(2)}\n` +
    `  cada par: el MISMO intento 1, dos intentos 2 que difieren en una línea\n`,
)

let ganoConPista = 0
let ganoSinPista = 0
let empates = 0
let sinPistaPosible = 0
let intentos = 0

const uno: Encargo = primerEncargo(GAP, VOCABULARIO)

while (ganoConPista + ganoSinPista + empates < pares && usd < topeUsd && intentos < pares * 3) {
  intentos++
  const v1 = await unViaje(textoDe(uno, SUPERFICIE))
  if (v1 === undefined) {
    console.log(`  intento ${String(intentos)}: la vuelta 1 no dio nada juzgable`)
    continue
  }

  const conPista = cargosDe(v1.corridas, true)
  const sinPista = cargosDe(v1.corridas, false)
  const hayPista = (conPista[0]?.porque ?? '') !== (sinPista[0]?.porque ?? '')

  const base = `${v1.nombre} ${String(reservadosOk(v1.corridas))}/${String(reservados(v1.corridas))}`
  if (!hayPista) {
    sinPistaPosible++
    console.log(`  intento ${String(intentos)}: ${base} · NO HAY PISTA — el par no mide nada, se descarta`)
    // POR QUÉ no hay pista. Sin esto, «nunca se dispara» es un hecho sin causa,
    // y la causa es lo único que dice si el mecanismo sirve o hay que cambiarlo.
    const eje = (c: CorridaJuzgada, k: string): string => {
      const o = c.mundo.objetivo
      if (o === undefined) return '—'
      if (k === 'forma') return String((o as unknown as { form: string }).form)
      if (k === 'sustancia') return String((o as unknown as { parts: { substance: string }[] }).parts[0]?.substance)
      try {
        return qualityOf(o, k as QualityId, phys).toFixed(2)
      } catch {
        return '—'
      }
    }
    for (const [g, sub] of [
      ['debia llegar   ', v1.corridas.filter((c) => c.mundo.deberiaCumplir)],
      ['debia plantarse', v1.corridas.filter((c) => !c.mundo.deberiaCumplir)],
    ] as const) {
      const mal = sub.filter((c) => !c.comoDebia)
      const bien = sub.filter((c) => c.comoDebia)
      if (mal.length === 0 || bien.length === 0) {
        console.log(`      ${g}: mal ${String(mal.length)} · bien ${String(bien.length)} -> sin contraste`)
        if (mal.length > 0 && bien.length === 0 && process.argv.includes('--mostrar-codigo')) {
          const d = new Set(mal.map((c) => c.corrio.desenlace))
          console.log(`      desenlaces: ${[...d].join(', ')} · ticks: ${[...new Set(mal.map((c) => c.corrio.ticks))].join(',')}`)
          console.log(`      ── el código que no llega nunca ──
${v1.codigo}`)
        }
        continue
      }
      for (const k of ['forma', 'sustancia', 'portable', 'mass']) {
        const m = [...new Set(mal.map((c) => eje(c, k)))].sort()
        const b = [...new Set(bien.map((c) => eje(c, k)))].sort()
        const solapan = m.filter((v) => b.includes(v))
        console.log(
          `      ${g} ${k.padEnd(10)} mal={${m.join('|')}} bien={${b.join('|')}} ${solapan.length > 0 ? 'SOLAPAN' : 'no solapan'}`,
        )
      }
    }
    continue
  }

  console.log(`  intento ${String(intentos)}: ${base}`)
  console.log(`    pista: ${conPista[0]?.porque.split('. ').slice(1).join('. ') ?? ''}`)

  const a = await unViaje(textoDe(elSiguienteEncargo(uno, [], conPista), SUPERFICIE))
  const b = await unViaje(textoDe(elSiguienteEncargo(uno, [], sinPista), SUPERFICIE))
  const ra = a === undefined ? -1 : reservadosOk(a.corridas)
  const rb = b === undefined ? -1 : reservadosOk(b.corridas)
  console.log(`    CON pista: ${String(ra)}   ·   SIN pista: ${String(rb)}   (partiendo de ${String(reservadosOk(v1.corridas))})`)

  if (ra > rb) ganoConPista++
  else if (rb > ra) ganoSinPista++
  else empates++
}

const medidos = ganoConPista + ganoSinPista + empates
console.log(
  `\n  ── ${String(medidos)} pares medidos, ${String(sinPistaPosible)} descartados por no haber pista ──` +
    `\n  ganó CON pista   ${String(ganoConPista)}` +
    `\n  ganó SIN pista   ${String(ganoSinPista)}` +
    `\n  empataron        ${String(empates)}` +
    `\n  costo            US$ ${usd.toFixed(4)}\n`,
)
console.log(
  medidos === 0
    ? '  NO SE PUEDE ATRIBUIR: ningún par llegó a medirse.\n'
    : ganoConPista > ganoSinPista + empates
      ? '  La pista gana la mayoría de los pares.\n'
      : `  NO alcanza para atribuir: ${String(ganoConPista)} de ${String(medidos)} no distingue efecto de azar.\n`,
)
