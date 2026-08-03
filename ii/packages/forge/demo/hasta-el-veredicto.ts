/**
 * LA CADENA ENTERA, HASTA EL VEREDICTO — el portón del C6, contra el modelo.
 *
 *     ANIMA_LLM=claude ANIMA_HILO=<esta ruta> node packages/forge/demo/arranque.mjs
 *
 * ─── QUÉ FALTABA, medido antes de escribir esto ────────────────────────────
 *
 * El C6 apoya todo en un número: `Dictamen.grado`. Si dice `promueve`, la
 * habilidad entra al catálogo y el planificador la puede elegir; si dice
 * cualquier otra cosa, no se usa y se avisa. Ese portón está probado con un
 * `grado` guionado, y eso es correcto para CI — pero deja sin correr la única
 * pregunta que importa: **¿un `grado` sale de verdad, del otro lado?**
 *
 * Lo que había:
 *
 *   · `con-el-modelo.ts` va del gap a las candidatas y para ahí. Compilan o no
 *     compilan; nadie las corre;
 *   · `el-punto-9.ts` sí las monta y las corre en el banco, pero llama a
 *     `correrElBanco` y lee las corridas a mano. **Nunca produce un `Dictamen`,**
 *     así que nunca sale un grado;
 *   · el fixture del C6 lee un grado que le pasa el test.
 *
 * O sea que entre la fragua y el portón faltaba un eslabón, y era justo el que
 * el hito nombra. Éste es ese eslabón.
 *
 * ─── LOS DOS PORTONES, y el segundo no depende del modelo ──────────────────
 *
 * El C6 tiene dos y son dos preguntas distintas:
 *
 *   1. **¿el juez la promueve?** Es la que este demo mide contra el modelo;
 *   2. **¿trae con qué publicarse?** `ConstructionSchema` tiene tres formas
 *      —proceso, ley, obra— y ninguna es «una habilidad que establece X». Una
 *      candidata SUELTA, como las que salen de acá, no se puede publicar aunque
 *      el juez la promueva: se instala, se vuela, cambia el mundo, y el
 *      planificador no la puede elegir. Está escrito en `Instalada.capacidad` y
 *      contado por `Registro.sinPublicar`.
 *
 * Este demo imprime los dos, para que el techo del catálogo se vea como un
 * resultado y no como un olvido.
 *
 * ─── Por qué el contrato es el de `sostener` ───────────────────────────────
 *
 * Porque el juez sabe armarle banco: sus precondiciones son de materia y de ahí
 * salen las cinco clases de mundo con su cuarto reservado. Un contrato que el
 * juez no pueda sintetizar daría `injuzgable`, y este demo estaría midiendo al
 * sintetizador en vez de a la candidata. Es la misma elección que `el-punto-9`.
 */

import { costoDeLaUltima, preguntarTexto, transporteElegido } from '@anima/llm/demo/transporte.js'
import { juzgar } from '@anima/judge'
import { buildSeedPhysics } from '@anima/physics'
import { done, fail, instrument, mount, shadowScope } from '@anima/skills'
import type { FuelCell, Skill } from '@anima/skills'
import { CONTRATO_SOSTENER } from '@anima/skills/innatas'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { fuentesDe, piezasDe } from '../src/candidata.js'
import { leerCandidatas, vocabularioDe } from '../src/costura.js'
import { primerEncargo, textoDe } from '../src/index.js'
import type { Superficie } from '../src/encargo.js'
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

const K = 2
const API = readFileSync(fileURLToPath(new URL('../../skills/src/skill-api.d.ts', import.meta.url)), 'utf8')
const SUPERFICIE: Superficie = { api: API, desde: '../../src/skill-api.js', cuantas: K }

const puerta = new Puerta(ts)
// Se tibia el montaje: el primer typecheck de un proceso paga el arranque entero
// del compilador, y sin esto ese costo se le cobraría a la primera candidata.
puerta.revisar('export const tibia = 1\n')

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

console.log(`\n  transporte: ${transporteElegido()} · un viaje de K=${String(K)}\n`)

const encargo = primerEncargo(GAP, vocabularioDe(phys))
const salida = await preguntarTexto(textoDe(encargo, SUPERFICIE), 180_000)
const costo = costoDeLaUltima()

if (salida === undefined) {
  console.log('  el modelo no contestó. Nada que juzgar.\n')
} else {
  const candidatas = leerCandidatas(salida, encargo, K)
  console.log(`  ${String(candidatas.length)} candidata(s)\n`)

  let juzgadas = 0
  let promovidas = 0
  let publicables = 0

  for (const c of candidatas) {
    console.log(`  · piezas que trajo: ${piezasDe(c).join(', ') || 'ninguna'}`)
    console.log(`    contrato propio:  ${c.contrato === undefined ? 'no vino' : 'sí'}`)

    for (const f of fuentesDe(c)) {
      const intento = forjarUna(f.fuente, puerta)
      if (intento.desenlace === 'rota') {
        console.log(`    ${f.nombre.padEnd(22)} no compila — no llega ni al juez`)
        continue
      }
      const montada = montar(intento.codigo, f.nombre)
      if (montada === undefined) {
        console.log(`    ${f.nombre.padEnd(22)} compila y no se monta`)
        continue
      }

      // ─── EL ESLABÓN QUE FALTABA: un `Dictamen` de verdad ──────────────────
      //
      // El contrato es el DEL PEDIDO y no el que la candidata haya publicado: se
      // la juzga contra lo que se le encargó, que es lo que el `GAP` dice con
      // todas las letras. Juzgarla contra su propio contrato la dejaría elegir
      // el examen.
      const dictamen = juzgar(
        {
          acusada: { nombre: f.nombre, contrato: CONTRATO_SOSTENER },
          skill: montada.skill,
          cell: montada.cell,
          argsDe: () => ({}),
        },
        phys,
      )
      juzgadas++

      const cargos = dictamen.cargos.map((v) => `${v.cargo}:${v.grado}`).join(' ')
      console.log(`    ${f.nombre.padEnd(22)} ${intento.desenlace.padEnd(10)} grado=${dictamen.grado}`)
      console.log(`    ${' '.repeat(22)} cargos: ${cargos}`)
      if (dictamen.regresiones.length > 0) {
        console.log(`    ${' '.repeat(22)} regresiones: ${String(dictamen.regresiones.length)}`)
      }

      // ─── EL PORTÓN 1: el veredicto ───────────────────────────────────────
      if (dictamen.grado !== 'promueve') continue
      promovidas++
      // ─── EL PORTÓN 2: el techo del catálogo, y es DATO ────────────────────
      //
      // `Candidata.plano` existe y contesta esto sin que nadie lo suponga: sin
      // plano no hay `ConstructionSchema` que la represente, así que se instala,
      // se vuela, y el planificador no la puede elegir.
      if (c.plano !== undefined) publicables++
    }
    console.log('')
  }

  console.log(`  llegaron al juez .................. ${String(juzgadas)}`)
  console.log(`  portón 1 · el juez promueve ....... ${String(promovidas)} de ${String(juzgadas)}`)
  console.log(`  portón 2 · se puede publicar ...... ${String(publicables)} de ${String(promovidas)}`)
  console.log(`  sin publicar (techo del catálogo) . ${String(promovidas - publicables)}`)
  console.log(`  costo ............................. US$ ${costo === undefined ? '?' : costo.usd.toFixed(4)}\n`)
}
