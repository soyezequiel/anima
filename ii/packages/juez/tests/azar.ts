// ─── EL RUIDO DEL AZAR: la hipótesis nula de las nueve ───────────────────────
//
// No es un test: es el CONTROL que hace significativo a todo lo demás, y vive
// aparte porque lo consumen dos archivos —el adversario del detector, que lo
// encontró, y el banco del criterio, que tiene que publicarlo al lado del número
// de la mente—.
//
// ─── QUÉ ES LA CRIATURA AL AZAR, y por qué es LA hipótesis nula ─────────────
//
// Elige la FORMA del acto y los CUERPOS con el dado del mundo —`dadoDe(crearDios(
// semilla))`, la misma aritmética `mulberry32` con la que el motor tira el dado
// del dios, nunca `Math.random`— y **no consulta una sola cualidad**: no mira
// masa, ni rigidez, ni permeabilidad, ni `fuelEnergy`, ni calorías, ni montaje.
// Ésa es exactamente la hipótesis nula de las nueve entradas, porque las nueve
// dicen medir UNA ELECCIÓN DE CUERPO. Lo que este control contesta es: ¿cuántas
// de las nueve firma alguien que no elige nada?
//
// ─── POR QUÉ PERSEVERA, y no es hacerle un favor ────────────────────────────
//
// Medido en `ataque-al-detector.test.ts`: un proceso NO AVANZA si no se re-emite
// la intención —una fricción más cien ticks vacíos dejan la vara en 15,0 °C y el
// `doing` en `undefined`—, así que un azar sin memoria de un tick no completa
// NINGÚN proceso y el control mediría cero por construcción. Un control amañado
// para dar cero no es un control. Elige un acto y lo repite entre 1 y 80 ticks,
// que cubre los 48 de una ignición y los 20 de una unión.
//
// ─── LAS DOS CONCESIONES, y las dos van A FAVOR DEL CONTROL ─────────────────
//
// La corrida CON fuego le regala una fogata prendida y un tanque de 40.000,
// porque siete de las nueve cuelgan de que haya fuego y con 1000 el bicho se
// muere de puro vivir antes de que el fuego grande se apague. Las dos concesiones
// le facilitan las cosas al azar, así que lo que salga de acá es un PISO del
// ruido y no un techo.

import { crearDios, dadoDe, apply, drop, eat, goTo, put, stepWorld, take, wait } from '@anima/world'
import type { Actor, Intent, WorldBody, WorldState } from '@anima/world'
import { FRICCION, UNION } from '@anima/physics'
import type { Body } from '@anima/physics'

import { Detector, resumir } from '../src/index.js'
import type { FilaDelBanco, NombreDeSecuencia, Veredicto } from '../src/index.js'
import { EN, mundo, PHYS } from './banco.js'

const QUIEN = { by: 'ana', seq: 1 } as const

/** Un cuerpo con temperatura escrita. Sin eso nace a 0 °C y toda medición miente. */
function pieza(id: string, substance: string, mass: number, t = 15): Body {
  return { id, form: 'vara', parts: [{ substance, mass, q: {} }], joints: [], state: { temperature: t } }
}

function cuerpoDeAna(stamina: number): Body {
  return {
    id: 'ana-cuerpo',
    form: 'vara',
    parts: [{ substance: 'carne', mass: 2, q: {} }],
    joints: [],
    state: { temperature: 15, stamina },
  }
}

function unActor(): Actor {
  return { id: 'ana', body: 'ana-cuerpo', holding: [], capacity: 3, permits: 'irreversible' }
}

/** Las cinco sustancias que `agua-dulce` siembra, con sus rangos de masa. */
const SIEMBRA: readonly (readonly [string, number, number])[] = [
  ['junco', 0.05, 0.4],
  ['madera', 0.3, 2.5],
  ['piedra', 0.2, 3],
  ['arcilla', 0.5, 4],
  ['corteza', 0.05, 0.5],
]

interface Azar {
  readonly entero: (n: number) => number
  readonly entre: (lo: number, hi: number) => number
}

function azarDe(semilla: bigint): Azar {
  const dado = dadoDe(crearDios(semilla))
  return {
    entero: (n) => Math.floor(dado.tirar() * n),
    entre: (lo, hi) => lo + dado.tirar() * (hi - lo),
  }
}

/** La orilla del control: lo que el bioma siembra, cuatro peces y —o no— un fuego. */
function orillaDeControl(
  a: Azar,
  conFuego: boolean,
  tanque: number,
): { readonly w: WorldState; readonly ids: string[] } {
  const bodies: WorldBody[] = [{ body: cuerpoDeAna(tanque), at: EN(0, 0) }]
  for (let i = 0; i < 10; i++) {
    const s = SIEMBRA[a.entero(SIEMBRA.length)]
    if (s === undefined) continue
    bodies.push({ body: pieza(`suelta-${String(i)}`, s[0], a.entre(s[1], s[2])), at: EN(a.entero(4), a.entero(4)) })
  }
  for (let i = 0; i < 4; i++) {
    bodies.push({ body: pieza(`pez-${String(i)}`, 'pescado', 2), at: EN(a.entero(4), a.entero(4)) })
  }
  if (conFuego) bodies.push({ body: pieza('fogata', 'madera', 2.5, 700), at: EN(2, 2) })
  const ids = bodies.map((c) => c.body.id).filter((x) => x !== 'ana-cuerpo')
  return { w: mundo({ bodies, actors: [unActor()] }), ids }
}

/** Una partida del control. Devuelve el veredicto y cuántos ticks vivió. */
export function partidaAlAzar(
  semilla: bigint,
  conFuego: boolean,
  tanque: number,
  tope: number,
): { readonly v: Veredicto; readonly ticks: number } {
  const a = azarDe(semilla)
  const { w: inicial, ids } = orillaDeControl(a, conFuego, tanque)
  let w = inicial
  const d = new Detector()
  d.observar({ state: w, events: [] })
  const elegir = (): string => ids[a.entero(ids.length)] ?? 'pez-0'
  let plan: Intent | undefined
  let quedan = 0
  let t = 0
  for (; t < tope; t++) {
    const act = w.actors.get('ana')
    if (act === undefined) break
    if (quedan <= 0 || plan === undefined) {
      quedan = 1 + a.entero(80)
      const held = act.holding
      const enMano = (): string => held[a.entero(held.length)] ?? elegir()
      // Con menos de dos cosas en la mano casi todo rebota, así que las tres
      // primeras opciones apuntan a llenarla. Sigue sin mirar QUÉ levanta.
      const k = held.length < 2 ? a.entero(3) : a.entero(8)
      if (k === 0 || k === 2) plan = take(QUIEN, elegir())
      else if (k === 1) plan = goTo(QUIEN, EN(a.entero(5), a.entero(5)), 0)
      else if (k === 3) plan = drop(QUIEN, enMano())
      else if (k === 4) {
        plan = put(QUIEN, enMano(), EN(a.entero(5), a.entero(5)), a.entero(2) === 0 ? { onTopOf: elegir() } : { covering: elegir() })
      } else if (k === 5) plan = eat(QUIEN, elegir())
      else if (k === 6) {
        plan =
          apply(QUIEN, PHYS, FRICCION.id, [
            { name: 'a', body: enMano() },
            { name: 'b', body: enMano() },
            { name: 'actor', body: 'ana-cuerpo' },
          ]) ?? wait(QUIEN, 0.05)
      } else {
        plan =
          apply(QUIEN, PHYS, UNION.id, [
            { name: 'binder', body: enMano() },
            { name: 'a', body: enMano() },
            ...(a.entero(2) === 0 ? [{ name: 'b', body: enMano() }] : []),
          ]) ?? wait(QUIEN, 0.05)
      }
    }
    quedan -= 1
    const out = stepWorld(w, [plan])
    w = out.state
    d.observar({ state: w, events: out.events })
    for (const e of out.events) if (e.k === 'nacio') ids.push(e.id)
  }
  return { v: d.veredicto(), ticks: t }
}

export const PARTIDAS_DEL_CONTROL = 20
export const TICKS_DEL_CONTROL = 20_000
export const SEMILLA_DEL_CONTROL = 20260728n

export interface Control {
  readonly titulo: string
  readonly filas: readonly FilaDelBanco[]
  readonly vivas: number
  readonly ticksPromedio: number
  /** Las que el azar firma en ≥ 2 de las 20. Ninguna de éstas puede contar. */
  readonly cuentan: readonly NombreDeSecuencia[]
}

/** Corre el control entero. Caro —20 × 20.000 ticks— y por eso memorizado. */
export function correrElControl(titulo: string, conFuego: boolean, tanque: number): Control {
  const clave = `${titulo}|${String(conFuego)}|${String(tanque)}`
  const guardado = CACHE.get(clave)
  if (guardado !== undefined) return guardado
  const vs: Veredicto[] = []
  let vivas = 0
  let ticksVividos = 0
  for (let k = 0; k < PARTIDAS_DEL_CONTROL; k++) {
    const r = partidaAlAzar(SEMILLA_DEL_CONTROL + BigInt(k), conFuego, tanque, TICKS_DEL_CONTROL)
    vs.push(r.v)
    ticksVividos += r.ticks
    if (r.ticks >= TICKS_DEL_CONTROL) vivas += 1
  }
  const res = resumir(vs)
  const c: Control = {
    titulo,
    filas: res.filas,
    vivas,
    ticksPromedio: Math.round(ticksVividos / PARTIDAS_DEL_CONTROL),
    cuentan: res.filas.filter((f) => f.cuenta).map((f) => f.nombre),
  }
  CACHE.set(clave, c)
  return c
}

const CACHE = new Map<string, Control>()

/** La tabla de un control, en texto. Sin `toLocaleString`: la regla 2 vale acá también. */
export function tablaDelControl(c: Control): string {
  const lineas = [
    `  ── ${c.titulo} · ${String(PARTIDAS_DEL_CONTROL)} partidas de ${String(TICKS_DEL_CONTROL)} ticks ──`,
  ]
  for (const f of c.filas) {
    lineas.push(
      `     apareció ${String(f.aparecioEn).padStart(2)}/20 · situación ${String(f.situacionEn).padStart(2)}/20  ` +
        `${f.nombre.padEnd(38)}${f.cuenta ? ' ← CUENTA' : ''}`,
    )
  }
  lineas.push(
    `     CUENTAN ${String(c.cuentan.length)} DE 9 · llegaron vivas ${String(c.vivas)}/20` +
      ` · vivieron ${String(c.ticksPromedio)} ticks en promedio`,
  )
  return lineas.join('\n')
}

/**
 * LAS QUE EL AZAR FIRMA, con y sin fuego regalado.
 *
 * Es el número que el banco del criterio tiene que publicar al lado del de la
 * mente: **ninguna secuencia que el azar dispare en ≥ 2 de las 20 puede contar
 * para el piso de cuatro**, porque una firma que produce un bicho que elige
 * cuerpos con el dado no distingue una mente de un dado.
 */
export function ruidoDelAzar(): readonly NombreDeSecuencia[] {
  const sin = correrElControl('EL AZAR SIN FUEGO', false, 1000)
  const con = correrElControl('EL AZAR CON EL FUEGO REGALADO', true, 40_000)
  return [...new Set([...sin.cuentan, ...con.cuentan])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}
