/**
 * EL PUNTO 9, LA MITAD QUE FALTABA — Hito 8.
 *
 *   > Una candidata que falla **alimenta a la siguiente**, y la siguiente mejora
 *   > **en los mundos que no le contaron**.
 *
 * ─── Qué estaba probado y qué no ────────────────────────────────────────────
 *
 * Probado: que lo que falló **entra** al encargo de la vuelta siguiente, en
 * castellano llano y sin un solo id de mundo. Eso lo afirman los tests del muñeco.
 *
 * Sin probar: que la vuelta 2 **mejore de verdad**, y sobre todo *dónde*. Ésa es
 * la mitad que separa aprender de memorizar, y necesita un modelo de verdad: con
 * el muñeco, «mejora» es un `if` que escribí yo.
 *
 * ─── LA TRAMPA, y cómo se mide ──────────────────────────────────────────────
 *
 * Si a la vuelta 2 se le contaran los mundos donde falló, aprendería los mundos y
 * no la habilidad — como decirle a alguien las preguntas del recuperatorio.
 *
 * El juez ya reserva **un cuarto de los mundos y nunca los muestra**
 * (`MundoDelBanco.reservado`, Hito 7 tramo D). Así que la pregunta se puede
 * partir en dos:
 *
 *   · ¿mejoró en los mundos MOSTRADOS?     → puede ser memoria
 *   · ¿mejoró en los RESERVADOS?           → **eso es aprender**
 *
 * Y no hace falta confiar en que nadie le contó los mundos: `loQueFalloDe` recibe
 * los cargos y nunca el dictamen, así que el dato no entra al paquete. Ver su
 * encabezado.
 */

import { costoDeLaUltima, preguntarTexto, transporteElegido } from '@anima/llm/demo/transporte.js'
import { correrElBanco, loQueTenianEnComun } from '@anima/judge'
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
import type { Superficie } from '../src/encargo.js'
import { forjarUna } from '../src/forjar.js'
import type { LoForjado } from '../src/episodio.js'
import { Puerta } from '../src/puerta.js'

const phys = buildSeedPhysics()

/**
 * EL PEDIDO, y lleva la promesa adentro.
 *
 * El contrato es el de `sostener` porque el juez sabe armarle banco: sus
 * precondiciones son de materia (`portable >= 1`) y de ahí salen las cinco
 * clases de mundo, con su cuarto reservado. Un contrato que el juez no pueda
 * sintetizar daría `injuzgable` y mediría al sintetizador.
 *
 * La promesa va en el texto porque **el modelo tiene que saber contra qué lo van
 * a medir**. Una fragua de verdad sabe qué capacidad pidió.
 */
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
const SUPERFICIE: Superficie = { api: API, desde: '../../src/skill-api.js', cuantas: K }

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

interface Juzgada {
  readonly nombre: string
  readonly corridas: readonly CorridaJuzgada[]
  readonly cargos: readonly { readonly cargo: string; readonly grado: string; readonly porque: string }[]
}

/** Cuántos mundos aprobó, partido en mostrados y reservados. */
function contar(cs: readonly CorridaJuzgada[]): { mostrados: string; reservados: string } {
  const m = cs.filter((c) => !c.mundo.reservado)
  const r = cs.filter((c) => c.mundo.reservado)
  return {
    mostrados: `${String(m.filter((c) => c.comoDebia).length)}/${String(m.length)}`,
    reservados: `${String(r.filter((c) => c.comoDebia).length)}/${String(r.length)}`,
  }
}

function reservadosOk(cs: readonly CorridaJuzgada[]): number {
  return cs.filter((c) => c.mundo.reservado && c.comoDebia).length
}

async function unaVuelta(prompt: string): Promise<{ juzgadas: readonly Juzgada[]; forjados: readonly LoForjado[] }> {
  const salida = await preguntarTexto(prompt, 180_000)
  usd += costoDeLaUltima()?.usd ?? 0
  if (salida === undefined) return { juzgadas: [], forjados: [] }

  const juzgadas: Juzgada[] = []
  const forjados: LoForjado[] = []
  for (const c of leerCandidatas(salida, primerEncargo('x', []), K)) {
    const f = c.usar
    if (f === undefined) continue
    const i = forjarUna(f.fuente, puerta)
    forjados.push({
      nombre: f.nombre,
      desenlace: i.desenlace,
      codigo: i.codigo,
      cambios: i.cambios,
      conceptos: [],
      puertazos: i.puertazos,
    })
    if (i.desenlace === 'rota') {
      // Los errores VAN: un «no compila» sin el motivo no se puede diagnosticar,
      // y el modelo contesta distinto cada vez — la corrida que falla puede no
      // repetirse.
      const porque = i.erroresQueQuedaron
        .slice(0, 3)
        .map((e) => `      ${String(e.codigo)} ${e.mensaje.slice(0, 74)}`)
      console.log([`    ${f.nombre.padEnd(28)} NO COMPILA`, ...porque].join('\n'))
      continue
    }
    const skill = montar(i.codigo, f.nombre)
    if (skill === undefined) {
      console.log(`    ${f.nombre.padEnd(28)} no se pudo montar`)
      continue
    }
    // LA CELDA VIAJA AL JUEZ. Sin esto explota con `OutOfFuel` y `budget: 0`
    // en el primer paso — es el agujero gemelo del de `Partida.volar`.
    const corridas = correrElBanco(
      { acusada: { nombre: f.nombre, contrato: CONTRATO_SOSTENER }, skill: skill.skill, cell: skill.cell, argsDe: () => ({}) },
      phys,
    )
    // Los cargos, resumidos como los arma el juez: llega donde debe / no llega
    // donde no debe. Es lo que va al encargo de la vuelta siguiente.
    const n = contar(corridas)
    const mal = corridas.filter((c) => !c.comoDebia)
    // LA DEVOLUCIÓN ACCIONABLE: qué tenían en común los que fallaron, en
    // propiedades y no en mundos. Antes acá iba una cuenta —«no llegó en 12
    // mundos»— y el modelo no tenía con qué arreglar nada.
    const enComun = loQueTenianEnComun(corridas, CONTRATO_SOSTENER, phys)
    const cargos = mal.length === 0
      ? []
      : [
          {
            cargo: 'construccion',
            grado: 'no-promueve',
            porque: [
              mal.some((c) => c.mundo.adverso)
                ? `dijo que sí en ${String(mal.filter((c) => c.mundo.adverso).length)} mundo(s) donde no había nada que levantar`
                : `no llegó en ${String(mal.length)} mundo(s) donde sí había`,
              ...enComun,
            ].join('. '),
          },
        ]
    console.log(`    ${f.nombre.padEnd(28)} mostrados ${n.mostrados} · reservados ${n.reservados}`)
    juzgadas.push({ nombre: f.nombre, corridas, cargos })
  }
  return { juzgadas, forjados }
}

console.log(`\ntransporte: ${transporteElegido()} · el punto 9, dos vueltas de K=${String(K)}\n`)

const uno = primerEncargo(GAP, VOCABULARIO)
console.log('  ── VUELTA 1 ──')
const v1 = await unaVuelta(textoDe(uno, SUPERFICIE))

const peor = [...v1.juzgadas].sort((a, b) => reservadosOk(a.corridas) - reservadosOk(b.corridas))[0]
if (peor === undefined) {
  console.log('\n  ninguna candidata llegó a juzgarse; no hay de qué aprender\n')
  process.exit(1)
}

console.log(`\n  la que peor anduvo: ${peor.nombre}`)
for (const c of peor.cargos) console.log(`    ${c.cargo}: ${c.porque}`)

const dos = elSiguienteEncargo(uno, v1.forjados, peor.cargos)
const texto2 = textoDe(dos, SUPERFICIE)

// ─── EL GUARDIÁN, afirmado ANTES de mandar nada ──────────────────────────────
const ids = peor.corridas.map((c) => c.mundo.id)
const filtrados = ids.filter((id) => texto2.includes(id))
console.log(
  `\n  guardián: ${String(ids.length)} ids de mundo en el banco · ${String(filtrados.length)} aparecen en el encargo` +
    (filtrados.length === 0 ? ' ✔' : ` ✘ ${filtrados.join(', ')}`),
)

console.log('\n  ── VUELTA 2 ──')
const v2 = await unaVuelta(texto2)

const mejor = [...v2.juzgadas].sort((a, b) => reservadosOk(b.corridas) - reservadosOk(a.corridas))[0]
console.log(`\n  ── EL PUNTO 9 ──`)
if (mejor === undefined) {
  console.log('  la vuelta 2 no produjo nada juzgable\n')
} else {
  const a = contar(peor.corridas)
  const b = contar(mejor.corridas)
  console.log(`  vuelta 1 · ${peor.nombre.padEnd(28)} mostrados ${a.mostrados} · reservados ${a.reservados}`)
  console.log(`  vuelta 2 · ${mejor.nombre.padEnd(28)} mostrados ${b.mostrados} · reservados ${b.reservados}`)
  const subioReservados = reservadosOk(mejor.corridas) > reservadosOk(peor.corridas)
  console.log(
    `\n  ¿mejoró en los mundos que NO le contaron? ${subioReservados ? 'SÍ — eso es aprender' : 'no'}`,
  )
}
console.log(`\n  costo: US$ ${usd.toFixed(4)}\n`)
