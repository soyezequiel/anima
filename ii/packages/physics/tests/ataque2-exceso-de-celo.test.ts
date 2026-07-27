// ─── ATAQUE 2 · EL LENTE OPUESTO: falsos rechazos ────────────────────────────
//
// Los otros tres adversarios buscaron lo que la puerta DEJA pasar y no debería.
// Éste busca lo contrario, y es la mitad que decide si Ánima puede vivir: una
// puerta que rechaza todo es trivialmente segura y completamente inútil.
//
// Acá hay veinte procesos HONESTOS —cocinar, secar, afilar, tejer, cavar,
// machacar, moler, ahumar, curtir, fermentar, apilar, templar, enfriar, escurrir,
// remojar, comer— escritos con la mejor fe posible: conservan, declaran de qué
// drenan, y ninguno inventa materia. Cada uno que la puerta rechaza es un
// hallazgo, y va con la razón EXACTA que dio la puerta.
//
// CÓMO SE LEE
//
//   · `it(...)` normal   → la puerta hizo lo correcto (aceptó lo bueno, o
//                          rechazó lo que de verdad necesita una ley que no hay).
//   · `it.fails(...)`    → FALSO RECHAZO QUE SIGUE ABIERTO. El cuerpo afirma que el
//     con «SIGUE ABIERTO»  proceso DEBERÍA entrar; la puerta lo rechaza. Vitest lo
//     en el nombre         cuenta como esperado-que-falle. Arriba de cada uno está
//                          escrito QUÉ FALTA para cerrarlo.
//
// ESTADO: de los seis falsos rechazos que encontró este lente, TRES están cerrados
// —`comer` (conversión entre cuentas conservadas), `apagar la brasa`
// (`pisoParaDireccion`) y `empuñar` (una derivada geométrica la establece el
// arreglo)— y TRES siguen abiertos, los tres por la misma clase de razón: la puerta
// no tiene con qué decidirlos sin una decisión de diseño escrita. Los tres van con
// el ADR que harían falta anotado arriba.
//
// Y arriba de todo, la regla de oro: los CUATRO PROCESOS SEMILLA tienen que
// seguir entrando. Si alguno cae, es el hallazgo más grave posible.

import { describe, expect, it } from 'vitest'
import { admit, porQue, tieneCodigo, type Verdict } from '../src/admit.js'
import { buildSeedPhysics } from '../src/physics.js'
import {
  DESHILACHAR,
  EXTRACCION,
  FRICCION,
  PHYSICS_VERSION,
  UNION,
  type Process,
} from '../src/process.js'
import { seg } from '../src/fixed.js'

const phys = buildSeedPhysics()

/** El veredicto entero en el mensaje: un `expected true, got false` no sirve. */
function entra(p: Process): void {
  const v = admit(p, phys)
  expect(v.ok, `«${p.id}» no entró:\n${porQue(v)}`).toBe(true)
}

const codigos = (v: Verdict): readonly string[] => v.razones.map((r) => r.codigo)

/** Molde honesto: todo lo que no se diga, se dice bien. */
const proc = (id: string, extra: Partial<Process>): Process => ({
  id,
  lexeme: { nombre: id },
  roles: [],
  arrangement: { k: 'held' },
  gate: [],
  effects: [],
  establishes: [],
  commitment: 'costly',
  trust: 'borrador',
  physicsVersion: PHYSICS_VERSION,
  provenance: { by: 'modelo' },
  ...extra,
})

// ═══ LA REGLA DE ORO ════════════════════════════════════════════════════════

describe('los cuatro procesos semilla siguen entrando', () => {
  it('friccion', () => {
    entra(FRICCION)
  })
  it('union', () => {
    entra(UNION)
  })
  it('deshilachar', () => {
    entra(DESHILACHAR)
  })
  it('extraccion', () => {
    entra(EXTRACCION)
  })
})

// ═══ LO QUE LA PUERTA ACEPTA, Y HACE BIEN EN ACEPTAR ════════════════════════

describe('procesos honestos que la puerta deja pasar', () => {
  // ── cocinar ──────────────────────────────────────────────────────────────
  // La técnica central del mundo: sube la digestibilidad de la comida y la paga
  // con el `fuelEnergy` del fuego, que es una cuenta conservada de verdad.
  const COCINAR = proc('cocinar', {
    lexeme: { nombre: 'cocinar' },
    roles: [
      {
        name: 'comida',
        where: [
          { q: 'nutrition', op: '>=', v: 1 },
          { q: 'digestibility', op: '<=', v: 0.5 },
          { q: 'mass', op: '<=', v: 3 },
        ],
      },
      {
        name: 'fuego',
        where: [
          { q: 'fuelEnergy', op: '>=', v: 10 },
          { q: 'temperature', op: '>=', v: 300 },
        ],
      },
    ],
    arrangement: { k: 'within', radius: 1 },
    effects: [
      {
        k: 'drive',
        q: 'digestibility',
        on: 'comida',
        toward: 0.9,
        porSegundo: 0.4,
        poweredBy: { from: 'fuego', q: 'fuelEnergy', efficiency: 0.3 },
      },
    ],
    completion: { at: seg(2), yields: [{ k: 'transmute', role: 'comida' }] },
    establishes: ['digestibility>=0.9'],
    commitment: 'irreversible',
  })
  it('cocinar: sube la digestibilidad y la paga con el combustible del fuego', () => {
    entra(COCINAR)
  })

  // ── secar ────────────────────────────────────────────────────────────────
  // Bajar es libre, PERO solo si el rol declara el piso del que se baja. Ver el
  // hallazgo «secar-ingenuo» más abajo: sin ese `moisture >= 0.3` esto se cae.
  const SECAR = proc('secar-al-sol', {
    lexeme: { nombre: 'secar' },
    roles: [
      {
        name: 'mojado',
        where: [
          { q: 'moisture', op: '>=', v: 0.3 },
          { q: 'permeability', op: '>=', v: 0.1 },
        ],
      },
    ],
    arrangement: { k: 'supported' },
    effects: [{ k: 'drive', q: 'moisture', on: 'mojado', toward: 0.05, porSegundo: 0.1 }],
    completion: { at: seg(6), yields: [] },
    establishes: ['moisture<=0.05'],
    commitment: 'reversible',
  })
  it('secar al sol: bajar la humedad no cuesta nada, y está bien que no cueste', () => {
    entra(SECAR)
  })

  // ── afilar ───────────────────────────────────────────────────────────────
  const AFILAR = proc('afilar-el-pedernal', {
    lexeme: { nombre: 'afilar' },
    roles: [
      {
        name: 'filo',
        where: [
          { q: 'rigidity', op: '>=', v: 0.9 },
          { q: 'toughness', op: '<=', v: 0.4 },
          { q: 'mass', op: '<=', v: 1 },
        ],
      },
      { name: 'yunque', where: [{ q: 'rigidity', op: '>=', v: 0.8 }] },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 6 }] },
    ],
    effects: [
      {
        k: 'drive',
        q: 'sharpness',
        on: 'filo',
        toward: 0.85,
        porSegundo: 0.4,
        poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.2 },
      },
      { k: 'drain', q: 'stamina', on: 'actor', porSegundo: 1 },
    ],
    completion: { at: seg(1.5), yields: [] },
    establishes: ['sharpness>=0.85'],
  })
  it('afilar el pedernal: sube el filo y lo paga con aliento', () => {
    entra(AFILAR)
  })

  // ── tejer ────────────────────────────────────────────────────────────────
  // Un `join` como el de `union`, y la no-dominancia NO lo confunde con ella
  // porque pide roles que union no pide. Ésta es la prueba de que la
  // no-dominancia reescrita no cerró la puerta a las técnicas nuevas.
  const TEJER = proc('tejer', {
    lexeme: { nombre: 'tejer' },
    roles: [
      {
        name: 'urdimbre',
        where: [
          { q: 'flexibility', op: '>=', v: 0.7 },
          { q: 'tensile', op: '>=', v: 0.35 },
        ],
      },
      {
        name: 'trama',
        where: [
          { q: 'flexibility', op: '>=', v: 0.7 },
          { q: 'tensile', op: '>=', v: 0.35 },
        ],
      },
      {
        name: 'atadura',
        where: [
          { q: 'flexibility', op: '>=', v: 0.8 },
          { q: 'tensile', op: '>=', v: 0.5 },
        ],
      },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 8 }] },
    ],
    effects: [{ k: 'drain', q: 'stamina', on: 'actor', porSegundo: 2 }],
    completion: { at: seg(3), yields: [{ k: 'join', a: 'urdimbre', b: 'trama', via: 'atadura' }] },
    establishes: ['permeability<=0.4'],
  })
  it('tejer: un join que no es un clon de union', () => {
    entra(TEJER)
  })

  // ── cavar ────────────────────────────────────────────────────────────────
  const CAVAR = proc('cavar', {
    lexeme: { nombre: 'cavar' },
    roles: [
      {
        name: 'pala',
        where: [
          { q: 'rigidity', op: '>=', v: 0.5 },
          { q: 'toughness', op: '>=', v: 0.5 },
        ],
      },
      { name: 'veta', where: [{ q: 'mass', op: '>', v: 0 }] },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 10 }] },
    ],
    arrangement: { k: 'within', radius: 1 },
    effects: [{ k: 'drain', q: 'stamina', on: 'actor', porSegundo: 6 }],
    completion: { at: seg(1.25), yields: [{ k: 'drawFromStock', of: 'veta', into: 'ground-adjacent' }] },
    establishes: ['holding(tag:mineral)'],
  })
  it('cavar: saca del stock declarando de qué cuerpo sale, y no domina a extraccion', () => {
    entra(CAVAR)
  })

  // ── machacar ─────────────────────────────────────────────────────────────
  const MACHACAR = proc('machacar', {
    lexeme: { nombre: 'machacar' },
    roles: [
      {
        name: 'pieza',
        where: [
          { q: 'rigidity', op: '>=', v: 0.5 },
          { q: 'cohesion', op: '>=', v: 0.5 },
        ],
      },
      {
        name: 'martillo',
        where: [
          { q: 'rigidity', op: '>=', v: 0.9 },
          { q: 'toughness', op: '>=', v: 0.5 },
        ],
      },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 4 }] },
    ],
    effects: [{ k: 'drain', q: 'stamina', on: 'actor', porSegundo: 4 }],
    completion: { at: seg(0.6), yields: [{ k: 'split', role: 'pieza', at: 'joint' }] },
    commitment: 'irreversible',
  })
  it('machacar el hueso: parte por la juntura, y no es deshilachar barato', () => {
    entra(MACHACAR)
  })

  // ── moler ────────────────────────────────────────────────────────────────
  // Parte por el grano IGUAL que `deshilachar`, y lo salva de la dominancia que
  // le pide más aliento al actor. Ojo: si pidiera lo mismo o menos, sería un
  // clon y estaría bien rechazarlo.
  const MOLER = proc('moler', {
    lexeme: { nombre: 'moler' },
    roles: [
      {
        name: 'grano',
        where: [
          { q: 'nutrition', op: '>=', v: 5 },
          { q: 'digestibility', op: '<=', v: 0.3 },
          { q: 'mass', op: '<=', v: 2 },
        ],
      },
      { name: 'muela', where: [{ q: 'rigidity', op: '>=', v: 0.9 }] },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 8 }] },
    ],
    effects: [
      { k: 'drain', q: 'stamina', on: 'actor', porSegundo: 2.4 },
      {
        k: 'drive',
        q: 'digestibility',
        on: 'grano',
        toward: 0.5,
        porSegundo: 0.4,
        poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.25 },
      },
    ],
    completion: { at: seg(2.5), yields: [{ k: 'split', role: 'grano', at: 'grain' }] },
    establishes: ['digestibility>=0.5'],
    commitment: 'irreversible',
  })
  it('moler el grano: split at grain sin ser un clon de deshilachar', () => {
    entra(MOLER)
  })

  // ── ahumar ───────────────────────────────────────────────────────────────
  const AHUMAR = proc('ahumar', {
    lexeme: { nombre: 'ahumar' },
    roles: [
      {
        name: 'presa',
        where: [
          { q: 'nutrition', op: '>=', v: 1 },
          { q: 'moisture', op: '>=', v: 0.4 },
          { q: 'decay', op: '>=', v: 0.03 },
        ],
      },
      {
        name: 'fuego',
        where: [
          { q: 'fuelEnergy', op: '>=', v: 10 },
          { q: 'temperature', op: '>=', v: 200 },
        ],
      },
    ],
    arrangement: { k: 'within', radius: 1 },
    effects: [
      { k: 'drive', q: 'moisture', on: 'presa', toward: 0.15, porSegundo: 0.08 },
      { k: 'drive', q: 'decay', on: 'presa', toward: 0.01, porSegundo: 0.02 },
    ],
    completion: { at: seg(7.5), yields: [{ k: 'transmute', role: 'presa' }] },
    establishes: ['decay<=0.01', 'moisture<=0.15'],
    commitment: 'irreversible',
  })
  it('ahumar: baja humedad y podredumbre, y bajar es libre', () => {
    entra(AHUMAR)
  })

  // ── curtir ───────────────────────────────────────────────────────────────
  const CURTIR = proc('curtir', {
    lexeme: { nombre: 'curtir' },
    roles: [
      {
        name: 'piel',
        where: [
          { q: 'toughness', op: '>=', v: 0.7 },
          { q: 'tensile', op: '>=', v: 0.4 },
          { q: 'decay', op: '>=', v: 0.05 },
          { q: 'mass', op: '<=', v: 4 },
        ],
      },
      {
        name: 'curtiente',
        where: [
          { q: 'cohesion', op: '>=', v: 0.6 },
          { q: 'moisture', op: '>=', v: 0.5 },
        ],
      },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 6 }] },
    ],
    arrangement: { k: 'contact' },
    effects: [
      { k: 'drain', q: 'stamina', on: 'actor', porSegundo: 1 },
      {
        k: 'drive',
        q: 'toughness',
        on: 'piel',
        toward: 0.95,
        porSegundo: 0.1,
        poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.3 },
      },
      { k: 'drive', q: 'decay', on: 'piel', toward: 0.01, porSegundo: 0.02 },
    ],
    completion: { at: seg(4), yields: [{ k: 'transmute', role: 'piel' }] },
    establishes: ['decay<=0.01', 'toughness>=0.95'],
    commitment: 'irreversible',
  })
  it('curtir: sube la dureza pagando aliento y transmuta la piel', () => {
    entra(CURTIR)
  })

  // ── fermentar ────────────────────────────────────────────────────────────
  // Sin actor: lo paga la propia nutrición de lo que fermenta, que es lo que
  // físicamente pasa. `respalda` lo acepta porque el rol la garantiza.
  const FERMENTAR = proc('fermentar', {
    lexeme: { nombre: 'fermentar' },
    roles: [
      {
        name: 'masa',
        where: [
          { q: 'nutrition', op: '>=', v: 4 },
          { q: 'moisture', op: '>=', v: 0.5 },
          { q: 'digestibility', op: '<=', v: 0.4 },
          { q: 'mass', op: '<=', v: 5 },
        ],
      },
    ],
    arrangement: { k: 'inside' },
    effects: [
      {
        k: 'drive',
        q: 'digestibility',
        on: 'masa',
        toward: 0.7,
        porSegundo: 0.04,
        poweredBy: { from: 'masa', q: 'nutrition', efficiency: 0.5 },
      },
    ],
    completion: { at: seg(10), yields: [{ k: 'transmute', role: 'masa' }] },
    establishes: ['digestibility>=0.7'],
    commitment: 'irreversible',
  })
  it('fermentar: se paga con su propia nutrición y no hace falta un actor', () => {
    entra(FERMENTAR)
  })

  // ── apilar ───────────────────────────────────────────────────────────────
  // Promete `footing`, que es DERIVADA, y la regla de promesas lo deja pasar
  // porque hay un rendimiento que cambia el cuerpo. Comparar con «empuñar».
  const APILAR = proc('apilar', {
    lexeme: { nombre: 'apilar' },
    roles: [
      {
        name: 'base',
        where: [
          { q: 'rigidity', op: '>=', v: 0.5 },
          { q: 'cohesion', op: '>=', v: 0.5 },
        ],
      },
      {
        name: 'encima',
        where: [
          { q: 'rigidity', op: '>=', v: 0.5 },
          { q: 'cohesion', op: '>=', v: 0.5 },
        ],
      },
      {
        name: 'mortero',
        where: [
          { q: 'cohesion', op: '>=', v: 0.6 },
          { q: 'flexibility', op: '>=', v: 0.4 },
          { q: 'rigidity', op: '<=', v: 0.3 },
        ],
      },
    ],
    arrangement: { k: 'supported' },
    completion: { at: seg(0.75), yields: [{ k: 'join', a: 'base', b: 'encima', via: 'mortero' }] },
    establishes: ['footing>=0.5'],
    commitment: 'reversible',
  })
  it('apilar piedras con barro: promete una derivada y tiene el rendimiento que la respalda', () => {
    entra(APILAR)
  })

  // ── templar ──────────────────────────────────────────────────────────────
  // Un `transfer` de una INTENSIVA no conservada, hecho bien: el destino acota
  // su masa y el origen garantiza la suya, así que el producto q·masa cierra.
  const TEMPLAR = proc('templar', {
    lexeme: { nombre: 'templar' },
    roles: [
      {
        name: 'brasa',
        where: [
          { q: 'temperature', op: '>=', v: 300 },
          { q: 'mass', op: '>=', v: 2 },
        ],
      },
      {
        name: 'agua',
        where: [
          { q: 'moisture', op: '>=', v: 0.9 },
          { q: 'mass', op: '<=', v: 1 },
        ],
      },
    ],
    arrangement: { k: 'contact' },
    effects: [{ k: 'transfer', q: 'temperature', from: 'brasa', to: 'agua', porSegundo: 200 }],
    completion: { at: seg(1), yields: [] },
    establishes: ['temperature<=100'],
  })
  it('templar: mover calor de un cuerpo grande a uno chico, con las dos masas acotadas', () => {
    entra(TEMPLAR)
  })

  // ── enfriar por acople ───────────────────────────────────────────────────
  // El único acople admisible: lo seguido entra ENTERO por debajo del piso de
  // lo que sigue. Es la prueba de que `reglaAcoplesYTransferencias` no mató a
  // todos los couples.
  const ENFRIAR = proc('enfriar-en-el-arroyo', {
    lexeme: { nombre: 'enfriar' },
    roles: [
      { name: 'cosa', where: [{ q: 'temperature', op: '>=', v: 40 }] },
      {
        name: 'corriente',
        where: [
          { q: 'temperature', op: '<=', v: 15 },
          { q: 'moisture', op: '>=', v: 0.9 },
        ],
      },
    ],
    arrangement: { k: 'inside' },
    effects: [{ k: 'couple', q: 'temperature', on: 'cosa', follows: { q: 'temperature', of: 'corriente' } }],
    establishes: ['temperature<=15'],
    commitment: 'reversible',
  })
  it('enfriar en el arroyo: un couple que provablemente solo baja', () => {
    entra(ENFRIAR)
  })

  // ── escurrir ─────────────────────────────────────────────────────────────
  // `transfer` de una CONSERVADA e INTENSIVA (nutrition), hecho bien.
  const ESCURRIR = proc('escurrir-la-grasa', {
    lexeme: { nombre: 'escurrir' },
    roles: [
      {
        name: 'sebo',
        where: [
          { q: 'nutrition', op: '>=', v: 15 },
          { q: 'mass', op: '>=', v: 1 },
          { q: 'temperature', op: '>=', v: 60 },
        ],
      },
      {
        name: 'cuenco',
        where: [
          { q: 'permeability', op: '<=', v: 0.1 },
          { q: 'mass', op: '<=', v: 0.5 },
        ],
      },
    ],
    arrangement: { k: 'contact' },
    effects: [{ k: 'transfer', q: 'nutrition', from: 'sebo', to: 'cuenco', porSegundo: 20 }],
    completion: { at: seg(0.25), yields: [] },
    establishes: ['nutrition>=5'],
  })
  it('escurrir la grasa: mover una conservada intensiva cerrando el producto q·masa', () => {
    entra(ESCURRIR)
  })

  // ── remojar ──────────────────────────────────────────────────────────────
  const REMOJAR = proc('remojar', {
    lexeme: { nombre: 'remojar' },
    roles: [
      {
        name: 'cosa',
        where: [
          { q: 'moisture', op: '<=', v: 0.4 },
          { q: 'permeability', op: '>=', v: 0.2 },
        ],
      },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 3 }] },
    ],
    arrangement: { k: 'inside' },
    effects: [
      {
        k: 'drive',
        q: 'moisture',
        on: 'cosa',
        toward: 0.9,
        porSegundo: 1,
        poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.5 },
      },
    ],
    completion: { at: seg(1), yields: [] },
    establishes: ['moisture>=0.9'],
    commitment: 'reversible',
  })
  it('remojar: subir humedad declarando de dónde sale el trabajo', () => {
    entra(REMOJAR)
  })

  // ── trasvasar ────────────────────────────────────────────────────────────
  // `transfer` de la conservada EXTENSIVA. Mover masa conserva por definición y
  // la puerta lo sabe: solo pide que el origen garantice lo que se lleva.
  const TRASVASAR = proc('trasvasar', {
    lexeme: { nombre: 'trasvasar' },
    roles: [
      {
        name: 'odre',
        where: [
          { q: 'moisture', op: '>=', v: 0.9 },
          { q: 'mass', op: '>=', v: 3 },
        ],
      },
      {
        name: 'cuenco',
        where: [
          { q: 'permeability', op: '<=', v: 0.1 },
          { q: 'mass', op: '<=', v: 1 },
        ],
      },
    ],
    effects: [{ k: 'transfer', q: 'mass', from: 'odre', to: 'cuenco', porSegundo: 4 }],
    completion: { at: seg(0.5), yields: [] },
    establishes: ['mass>=2'],
    commitment: 'reversible',
  })
  it('trasvasar agua: mover masa de un recipiente a otro', () => {
    entra(TRASVASAR)
  })

  // ── soplar ───────────────────────────────────────────────────────────────
  // Sin `completion`: como `friccion`, gasta y no produce nada. Ejercita además
  // la compuerta, que es el único lugar del proceso que no es rol ni efecto.
  const SOPLAR = proc('soplar-las-brasas', {
    lexeme: { nombre: 'soplar' },
    roles: [
      {
        name: 'fuego',
        where: [
          { q: 'fuelEnergy', op: '>=', v: 5 },
          { q: 'temperature', op: '>=', v: 200 },
        ],
      },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 2 }] },
    ],
    arrangement: { k: 'within', radius: 1 },
    gate: [{ q: 'oxygen', op: '>=', v: 0.1 }],
    effects: [
      {
        k: 'drive',
        q: 'oxygen',
        on: 'fuego',
        toward: 0.9,
        porSegundo: 1,
        poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.4 },
      },
    ],
    establishes: ['oxygen>=0.9'],
    commitment: 'reversible',
  })
  it('soplar las brasas: gasta aliento, no rinde nada y no declara completion', () => {
    entra(SOPLAR)
  })

  // ── endurecer al fuego ───────────────────────────────────────────────────
  // Promete `solid`, que es DERIVADA, y la deja pasar porque hay un efecto sobre
  // su insumo (`rigidity`). Y cierra un ciclo con `friccion` —esto pide
  // `rigidity>=0.9`, friccion pide `rigidity>=0.5`— que la regla 5 mira y deja
  // pasar porque el saldo de la vuelta es negativo. Las dos cosas a la vez.
  const ENDURECER = proc('endurecer-al-fuego', {
    lexeme: { nombre: 'endurecer' },
    roles: [
      {
        name: 'punta',
        where: [
          { q: 'rigidity', op: '>=', v: 0.4 },
          { q: 'tensile', op: '>=', v: 0.4 },
          { q: 'moisture', op: '>=', v: 0.3 },
        ],
      },
      {
        name: 'fuego',
        where: [
          { q: 'fuelEnergy', op: '>=', v: 10 },
          { q: 'temperature', op: '>=', v: 250 },
        ],
      },
    ],
    arrangement: { k: 'within', radius: 1 },
    effects: [
      { k: 'drive', q: 'moisture', on: 'punta', toward: 0.05, porSegundo: 0.08 },
      {
        k: 'drive',
        q: 'rigidity',
        on: 'punta',
        toward: 0.9,
        porSegundo: 0.1,
        poweredBy: { from: 'fuego', q: 'fuelEnergy', efficiency: 0.4 },
      },
    ],
    completion: { at: seg(3), yields: [{ k: 'transmute', role: 'punta' }] },
    establishes: ['solid>=1', 'rigidity>=0.9'],
    commitment: 'irreversible',
  })
  it('endurecer la punta al fuego: promete una derivada y mueve su insumo', () => {
    entra(ENDURECER)
  })

  // ── asar ─────────────────────────────────────────────────────────────────
  // Cocinar escrito como lo escribiría la física: el calor se MUEVE del fuego a
  // la comida. Pasa porque las dos masas están acotadas y el producto q·masa
  // cierra: 80 grados en un cuerpo de hasta 3 contra 300 en uno de al menos 1.
  const ASAR = proc('asar', {
    lexeme: { nombre: 'asar' },
    roles: [
      {
        name: 'fuego',
        where: [
          { q: 'fuelEnergy', op: '>=', v: 10 },
          { q: 'temperature', op: '>=', v: 300 },
          { q: 'mass', op: '>=', v: 1 },
        ],
      },
      {
        name: 'comida',
        where: [
          { q: 'nutrition', op: '>=', v: 1 },
          { q: 'mass', op: '<=', v: 3 },
        ],
      },
    ],
    arrangement: { k: 'within', radius: 1 },
    effects: [{ k: 'transfer', q: 'temperature', from: 'fuego', to: 'comida', porSegundo: 40 }],
    completion: { at: seg(2), yields: [{ k: 'transmute', role: 'comida' }] },
    establishes: ['temperature>=200'],
    commitment: 'irreversible',
  })
  it('asar: mover el calor del fuego a la comida', () => {
    entra(ASAR)
  })
})

// ═══ HALLAZGOS · FALSOS RECHAZOS ════════════════════════════════════════════

describe('FALSOS RECHAZOS · procesos honestos que la puerta rebota', () => {
  // ────────────────────────────────────────────────────────────────────────
  // HALLAZGO 1 — EL MÁS GRAVE, Y CERRADO. COMER NO SE PODÍA ESCRIBIR.
  //
  // Convertir comida en aliento es el bucle central del juego, y no hay ley que
  // lo haga: `leyes.ts` no toca `stamina`, así que tiene que ser un `Process`.
  // Pero `nutrition` y `stamina` son las DOS conservadas, y la regla 1 solo sabía
  // sumar la MISMA cuenta: `entraDe(p,'stamina')` recorre los roles consumidos
  // buscando `stamina`, y un pescado no garantiza aliento. Entonces
  //
  //   «stamina es conservada y «comer» la sube en el rol «actor» hacia 100:
  //    sale 20, entra 0»
  //
  // REPARADO con `esConversionAdmisible`: `poweredBy` YA ERA una conversión
  // —`friccion` convierte aliento en calor—, solo que ahí el destino no es
  // conservado, y cuando el destino TAMBIÉN lo es la regla 1 pisaba a la regla 2 y
  // no quedaba camino. Ahora la regla 1 le pasa el caso a la regla 2, que sabe
  // mirar un `poweredBy` entero, con cuatro condiciones: lo que sube no es materia
  // (`stamina` es la única conservada que ninguna sustancia declara), lo que paga
  // es otra conservada con eficiencia ≤ 1, el cuerpo que paga está respaldado, y el
  // proceso lo CONSUME. No se convierte lo que no se destruye.
  //
  // LO QUE SIGUE ABIERTO, y va dicho: la CANTIDAD. No hay ninguna constante en la
  // física que diga cuánto aliento vale una caloría, así que el desbalance se cobra
  // como reparo y no como rechazo — el mismo agujero que la regla 2 tiene desde el
  // primer día para todo `poweredBy`. Calibrar eso es un ADR.
  // ────────────────────────────────────────────────────────────────────────
  const COMER = proc('comer', {
    lexeme: { nombre: 'comer' },
    roles: [
      {
        name: 'bocado',
        where: [
          { q: 'nutrition', op: '>=', v: 5 },
          { q: 'digestibility', op: '>=', v: 0.5 },
          { q: 'mass', op: '>=', v: 0.2 },
          { q: 'mass', op: '<=', v: 2 },
        ],
      },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 0 }] },
    ],
    effects: [
      {
        k: 'drive',
        q: 'stamina',
        on: 'actor',
        toward: 100,
        porSegundo: 40,
        poweredBy: { from: 'bocado', q: 'nutrition', efficiency: 0.5 },
      },
    ],
    completion: { at: seg(0.5), yields: [{ k: 'transmute', role: 'bocado' }] },
    establishes: ['stamina>=50'],
    commitment: 'irreversible',
  })

  it('comer entra, y el desbalance de cantidad se cobra como reparo', () => {
    const v = admit(COMER, phys)
    expect(v.ok).toBe(true)
    // Ya no hay rechazo por conservación: la conversión está reconocida.
    expect(tieneCodigo(v, 'conservacion-drive')).toBe(false)
    // Y el canario de la regla 5 tampoco se dispara: el lazo de largo 1 salía de
    // que el propio rol `actor` pide `stamina >= 0`, que es un test que TODO cuerpo
    // cumple. Un test trivial no habilita a nadie, ya estaba habilitado.
    expect(tieneCodigo(v, 'ciclo-rentable')).toBe(false)
    // Lo que la puerta SÍ dice, y es lo único honesto que puede decir sin una
    // constante de conversión calibrada: cuánto declara gastar contra cuánto
    // garantiza el bocado.
    const r = v.advertencias.find((x) => x.codigo === 'costo-mayor-que-la-garantia')
    expect(r?.q).toBe('nutrition')
    expect(r?.encontrado).toBeCloseTo(40, 6)
    expect(r?.cota).toBe(5)
  })

  it('comer: convertir nutrición en aliento se puede escribir', () => {
    entra(COMER)
  })

  it('y la conversión no es una puerta abierta: no se puede fabricar materia', () => {
    // La misma escritura sobre `nutrition` en vez de `stamina` no pasa: lo que sube
    // tiene que ser algo que la materia NO lleve. Convertir aliento en comida sería
    // una bomba de materia con otro nombre.
    const ALQUIMIA: Process = {
      ...COMER,
      id: 'hacer-comida-con-aliento',
      roles: [
        { name: 'bocado', where: [{ q: 'mass', op: '<=', v: 2 }] },
        { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 50 }] },
      ],
      effects: [
        {
          k: 'drive',
          q: 'nutrition',
          on: 'bocado',
          toward: 50,
          porSegundo: 40,
          poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.5 },
        },
      ],
      completion: { at: seg(0.5), yields: [{ k: 'transmute', role: 'actor' }] },
      establishes: ['nutrition>=50'],
    }
    expect(tieneCodigo(admit(ALQUIMIA, phys), 'conservacion-drive')).toBe(true)
  })

  // La otra forma de escribirlo —mover la nutrición al cuerpo del que come— cae
  // por el otro lado: `nutrition` es intensiva, la criatura pesa cincuenta veces
  // más que el bocado, y el producto q·masa se multiplica. Es correcto en la
  // aritmética y sin embargo deja el bucle central sin ninguna escritura posible.
  const COMER_TRANSFER = proc('comer-transfiriendo', {
    lexeme: { nombre: 'comer' },
    roles: [
      {
        name: 'bocado',
        where: [
          { q: 'nutrition', op: '>=', v: 5 },
          { q: 'mass', op: '>=', v: 0.2 },
        ],
      },
      {
        name: 'actor',
        where: [
          { q: 'stamina', op: '>=', v: 0 },
          { q: 'mass', op: '<=', v: 80 },
        ],
      },
    ],
    effects: [{ k: 'transfer', q: 'nutrition', from: 'bocado', to: 'actor', porSegundo: 10 }],
    completion: { at: seg(0.5), yields: [{ k: 'transmute', role: 'bocado' }] },
    establishes: ['nutrition>=5'],
    commitment: 'irreversible',
  })

  it('la segunda escritura de comer cae por magnitud-intensiva (documentado)', () => {
    const v = admit(COMER_TRANSFER, phys)
    expect(v.ok).toBe(false)
    expect(tieneCodigo(v, 'magnitud-intensiva')).toBe(true)
  })

  // ────────────────────────────────────────────────────────────────────────
  // HALLAZGO 2 — SIGUE ABIERTO, Y ES DISCUTIBLE QUE SEA UN AGUJERO.
  //
  // `secar` sin un `moisture >= 0.3` en el rol es el mismo proceso de más arriba
  // menos una línea. La puerta lee el piso del CATÁLOGO (0), ve `toward: 0.05 > 0`
  // y contesta «sube moisture hacia 0.05 en «mojado» sin declarar poweredBy».
  //
  // QUÉ SE REPARÓ: el MENSAJE. Ahora dice cómo se corrige —«si el proceso BAJA
  // moisture, el rol tiene que declarar de dónde baja: poné un moisture >= x»—, en
  // vez de mandar a la fragua a buscar un `poweredBy` que no necesita.
  //
  // QUÉ FALTA PARA CERRARLO, y por qué no se cerró: el veredicto es DEFENDIBLE. Un
  // `drive` empuja hacia el objetivo DESDE DONDE ESTÉ, y un cuerpo seco a 0 sí se
  // moja hasta 0.05 con este proceso. La puerta no puede saber la dirección sin que
  // el rol declare de dónde parte, y ésa es exactamente la corrección. Cerrarlo
  // pediría una de dos cosas, y las dos son un ADR: o `Effect.drive` gana un campo
  // de dirección (`solo baja`), o la puerta aprende que las cualidades con
  // `relaxesTo: ambient` —la humedad y la temperatura— se mueven gratis en los dos
  // sentidos dentro del rango del ambiente, que es estado del MUNDO y no del
  // proceso. Tapar esto con un umbral («subir 0.05 es poquito») sería inventar una
  // constante de calibración adentro del juez.
  // ────────────────────────────────────────────────────────────────────────
  const SECAR_INGENUO = proc('secar-ingenuo', {
    lexeme: { nombre: 'secar' },
    roles: [{ name: 'mojado', where: [{ q: 'permeability', op: '>=', v: 0.1 }] }],
    arrangement: { k: 'supported' },
    effects: [{ k: 'drive', q: 'moisture', on: 'mojado', toward: 0.05, porSegundo: 0.1 }],
    completion: { at: seg(6), yields: [] },
    establishes: ['moisture<=0.05'],
    commitment: 'reversible',
  })

  it('la puerta lo llama sube-gratis, y ahora dice cómo se corrige (documentado)', () => {
    const v = admit(SECAR_INGENUO, phys)
    expect(v.ok).toBe(false)
    expect(tieneCodigo(v, 'sube-gratis')).toBe(true)
    const r = v.razones.find((x) => x.codigo === 'sube-gratis')
    expect(r?.mensaje).toContain('sube moisture hacia 0.05')
    expect(r?.mensaje).toContain('moisture >= x')
  })

  it.fails('SIGUE ABIERTO · secar sin declarar el piso: hace falta un ADR (ver el bloque de arriba)', () => {
    entra(SECAR_INGENUO)
  })

  // ────────────────────────────────────────────────────────────────────────
  // HALLAZGO 3 — CERRADO. UN TRANSFER QUE SACA LA CUALIDAD BORRABA EL PISO DEL
  // ROL, Y LO QUE BAJA PASABA A LEERSE COMO QUE SUBE.
  //
  // `pisoEfectivo` devolvía el piso del CATÁLOGO cuando el proceso se lleva la
  // cualidad del rol. La razón está escrita y es buena (el recargador de aliento
  // invisible). Pero apagar una brasa en el agua hace las dos cosas a la vez:
  // mueve el calor al agua Y deja la brasa a 20 °C. Con el piso del catálogo en
  // −100, `toward: 20` se leía como una SUBIDA de 120 grados y la puerta pedía un
  // poweredBy para enfriar una brasa.
  //
  // REPARADO con `pisoParaDireccion`: la cota honesta no es TIRAR el piso, es
  // BAJARLO por lo que el proceso se lleva. El rol garantiza 300 y el transfer saca
  // 200 en la corrida, así que abajo de 100 no puede estar, y llevarla a 20 baja. El
  // recargador de aliento —el ataque que escribió `pisoEfectivo`— sigue cayendo:
  // pide `stamina >= 50`, drena 10 y empuja hacia 50, o sea por encima de los 40 que
  // le quedan garantizados.
  // ────────────────────────────────────────────────────────────────────────
  const APAGAR = proc('apagar-la-brasa', {
    lexeme: { nombre: 'apagar' },
    roles: [
      {
        name: 'brasa',
        where: [
          { q: 'temperature', op: '>=', v: 300 },
          { q: 'mass', op: '>=', v: 2 },
        ],
      },
      {
        name: 'agua',
        where: [
          { q: 'moisture', op: '>=', v: 0.9 },
          { q: 'mass', op: '<=', v: 1 },
        ],
      },
    ],
    arrangement: { k: 'contact' },
    effects: [
      { k: 'transfer', q: 'temperature', from: 'brasa', to: 'agua', porSegundo: 200 },
      { k: 'drive', q: 'temperature', on: 'brasa', toward: 20, porSegundo: 300 },
    ],
    completion: { at: seg(1), yields: [] },
    establishes: ['temperature<=20'],
    commitment: 'irreversible',
  })

  it('apagar la brasa: llevarla de 300 a 20 no es subirla', () => {
    entra(APAGAR)
    expect(tieneCodigo(admit(APAGAR, phys), 'sube-gratis')).toBe(false)
  })

  it('y el control: si el proceso se lleva MÁS de lo que el rol garantiza, el piso vuelve al catálogo', () => {
    // Con un transfer que saca 600 de los 300 garantizados, abajo del piso del
    // catálogo no hay nada que asegurar y `toward: 20` vuelve a poder ser una
    // subida. Es el borde exacto de la reparación.
    const VACIA: Process = {
      ...APAGAR,
      id: 'apagar-vaciando',
      effects: [
        { k: 'transfer', q: 'temperature', from: 'brasa', to: 'agua', porSegundo: 600 },
        { k: 'drive', q: 'temperature', on: 'brasa', toward: 20, porSegundo: 300 },
      ],
    }
    expect(tieneCodigo(admit(VACIA, phys), 'sube-gratis')).toBe(true)
  })

  // ────────────────────────────────────────────────────────────────────────
  // HALLAZGO 4 — CERRADO. LA PUERTA DE ESCAPE DE `promesa-sin-respaldo` ESTABA
  // CERRADA JUSTO PARA LA CUALIDAD PARA LA QUE SE ESCRIBIÓ.
  //
  // El comentario de `reglaPromesas` (admit.ts:1808) dice, textual, que un
  // proceso puede establecer algo «por el mero hecho de sostener un arreglo
  // (tener algo en la mano ya es un estado del mundo), y rechazarlo cerraría esa
  // puerta sin haberla mirado», y por eso ese caso es REPARO y no rechazo.
  //
  // Pero cinco líneas más arriba, `promesa-derivada` rechaza toda promesa sobre
  // una cualidad derivada sin rendimientos. Y `reach` —la cualidad canónica de
  // «tener algo largo en la mano»— es derivada. O sea que el único caso que el
  // reparo existía para no cerrar es exactamente el que se cierra.
  //
  // `union` se salva porque tiene un `join`. Empuñar una vara ya hecha no tiene
  // nada que transmutar: el alcance lo pone la geometría de lo que ya se agarró.
  //
  // REPARADO: una derivada PURAMENTE GEOMÉTRICA no la escribe ningún efecto y no
  // puede —sale del eje más largo del ensamble, y la puerta no lee geometría—, así
  // que exigir un efecto sobre sus insumos es exigir lo imposible. Lo único que sí
  // se puede exigir es que haya un cuerpo concreto en el arreglo: un rol que diga de
  // qué está hecho. `empuñar` pincha una vara y pasa (con el reparo
  // `promesa-sin-respaldo`, que es lo que corresponde); el charlatán, que promete
  // alcance 16 con un rol que no pide nada, sigue afuera.
  // ────────────────────────────────────────────────────────────────────────
  const EMPUNAR = proc('empunar', {
    lexeme: { nombre: 'empuñar' },
    roles: [
      {
        name: 'vara',
        where: [
          { q: 'rigidity', op: '>=', v: 0.5 },
          { q: 'tensile', op: '>=', v: 0.3 },
        ],
      },
    ],
    establishes: ['reach>=2'],
    commitment: 'reversible',
  })

  it('empuñar una vara: el alcance lo pone la geometría de lo agarrado', () => {
    entra(EMPUNAR)
    const v = admit(EMPUNAR, phys)
    expect(codigos(v)).not.toContain('promesa-derivada')
    // Y el reparo sí se cobra: un no-op que promete mueve a la criatura igual.
    expect(v.advertencias.map((r) => r.codigo)).toContain('promesa-sin-respaldo')
  })

  it('el control: el charlatán, que promete lo mismo sin agarrar nada, sigue afuera', () => {
    const CHARLATAN = proc('charlatan-de-alcance', {
      roles: [{ name: 'a', where: [] }],
      establishes: ['reach>=16'],
    })
    expect(tieneCodigo(admit(CHARLATAN, phys), 'promesa-derivada')).toBe(true)
  })

  // ────────────────────────────────────────────────────────────────────────
  // HALLAZGO 5 — LA ENVOLVENTE POR TAG ES EL TECHO DE LO QUE UNA TÉCNICA PUEDE
  // LOGRAR, Y ESTÁ MEDIDA SOBRE MATERIA SIN TRABAJAR.
  //
  // Afilar una punta de madera a 0.6 se rechaza:
  //
  //   «empuja sharpness hasta 0.6 en «punta», y lo más alto que llega una
  //    sustancia que pueda llenar ese rol es 0.45 (madera, organico+vegetal+fibroso)»
  //
  // Ese 0.45 sale de DOS muestras del catálogo —`madera-dura` 0.15 y `hueso` 0.30,
  // las únicas `organico` que declaran filo— por el holgura de 0.5. Son valores
  // de material CRUDO. Afilar es precisamente la técnica cuyo sentido es pasar el
  // filo que la materia trae de fábrica, y la regla 3 la topa contra él.
  //
  // Ojo con la asimetría: el mismo proceso sobre un rol que también acepte hueso
  // pasa, porque el hueso es `mineral` y arrastra la envolvente mineral hasta 1.
  // O sea que se puede afilar una lasca, pero no se puede aguzar una estaca.
  //
  // SIGUE ABIERTO, y qué falta para cerrarlo: la puerta compara contra
  // `Substance.perUnitMass`, que es la materia CRUDA, y no tiene ninguna noción de
  // ESTADO ALCANZABLE de un cuerpo. Es la misma raíz que el hallazgo 6, visto desde
  // la regla 3 en vez de la regla 4, y las dos salidas que hay son grandes:
  //
  //   (a) la envolvente de una cualidad que alguna TÉCNICA mueve deja de ser el
  //       techo del material crudo. Pero «qué cualidades mueve una técnica» hoy no
  //       está declarado en ningún lado: habría que derivarlo de los procesos ya
  //       admitidos, y entonces el veredicto de un proceso dependería de en qué
  //       orden entraron los otros — que es justo lo que una puerta determinista no
  //       puede hacer.
  //   (b) `Substance` gana un techo TRABAJADO por cualidad, además del crudo. Es un
  //       campo nuevo en el contrato de datos y una recalibración del catálogo.
  //
  // Las dos son un ADR. Tapar esto aflojando `ENVELOPE_SLACK` movería el techo de
  // TODAS las envolventes, incluida la que impide que algo orgánico tenga el poder
  // calorífico del plutonio.
  // ────────────────────────────────────────────────────────────────────────
  const AGUZAR = proc('aguzar-la-estaca', {
    lexeme: { nombre: 'aguzar' },
    roles: [
      {
        name: 'punta',
        where: [
          { q: 'rigidity', op: '>=', v: 0.6 },
          { q: 'flexibility', op: '>=', v: 0.15 },
          { q: 'tensile', op: '>=', v: 0.4 },
        ],
      },
      { name: 'raspador', where: [{ q: 'sharpness', op: '>=', v: 0.5 }] },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 6 }] },
    ],
    effects: [
      {
        k: 'drive',
        q: 'sharpness',
        on: 'punta',
        toward: 0.6,
        porSegundo: 0.4,
        poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.2 },
      },
    ],
    completion: { at: seg(1.5), yields: [] },
    establishes: ['sharpness>=0.6'],
  })

  it('la puerta topa el filo de la madera en 0.45, que es su valor crudo (documentado)', () => {
    const v = admit(AGUZAR, phys)
    expect(v.ok).toBe(false)
    expect(tieneCodigo(v, 'fuera-de-envolvente')).toBe(true)
    const r = v.razones.find((x) => x.codigo === 'fuera-de-envolvente')
    expect(r?.cota).toBeCloseTo(0.45, 6)
  })

  it.fails('SIGUE ABIERTO · aguzar una estaca: hace falta un ADR (ver el bloque de arriba)', () => {
    entra(AGUZAR)
  })

  // ────────────────────────────────────────────────────────────────────────
  // HALLAZGO 6 — NINGUNA TÉCNICA PUEDE PEDIR EL PRODUCTO DE OTRA TÉCNICA.
  //
  // `cocinar` entra, y su razón de ser es dejar la comida en `digestibility 0.9`.
  // Un proceso que pida esa comida ya cocinada se rechaza:
  //
  //   «ninguna de las 30 sustancias del catálogo cumple nutrition >= 5 y
  //    digestibility >= 0.8 para el rol «asado»»
  //
  // Y es verdad, porque `candidatasDeRol` compara contra `Substance.perUnitMass`,
  // que es la materia CRUDA. Un cuerpo lleva su propio estado en `Part.q` —eso es
  // lo que `cocinar` escribe— y la realizabilidad no lo mira: pregunta si existe
  // una SUSTANCIA así, no si puede existir un CUERPO así.
  //
  // La consecuencia es que la escalera de técnicas tiene un solo escalón. Cocinar
  // entra, pero nada puede pedir lo cocinado; afilar entra, pero nada puede pedir
  // lo afilado más allá del filo crudo (ver el hallazgo 5, que es la misma raíz
  // vista desde la regla 3). `rol-irrealizable` existe para atajar el fallo
  // SILENCIOSO —un proceso que nunca encuentra entradas—, y acá ataja procesos
  // cuyas entradas las fabrica el proceso de al lado.
  //
  // SIGUE ABIERTO, y es la misma raíz que el hallazgo 5: la puerta no sabe qué
  // estados puede ALCANZAR un cuerpo, solo qué valores trae la materia. Las dos
  // salidas están escritas arriba y las dos son un ADR. Lo que NO se puede hacer es
  // apagar `rol-irrealizable` para las cualidades que las leyes mueven: se lleva
  // puesto el caso que la regla existe para cazar —«afilar lo nutritivo», el rol que
  // pide rigidez de piedra y nutrición de carne— y vuelve el fallo silencioso.
  // ────────────────────────────────────────────────────────────────────────
  const DESMENUZAR = proc('desmenuzar-el-asado', {
    lexeme: { nombre: 'desmenuzar' },
    roles: [
      {
        name: 'asado',
        where: [
          { q: 'nutrition', op: '>=', v: 5 },
          { q: 'digestibility', op: '>=', v: 0.8 },
          { q: 'mass', op: '<=', v: 2 },
        ],
      },
      { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 2 }] },
    ],
    effects: [{ k: 'drain', q: 'stamina', on: 'actor', porSegundo: 1 }],
    completion: { at: seg(0.5), yields: [{ k: 'split', role: 'asado', at: 'grain' }] },
    commitment: 'irreversible',
  })

  it('la puerta lo llama rol-irrealizable contra el catálogo crudo (documentado)', () => {
    const v = admit(DESMENUZAR, phys)
    expect(v.ok).toBe(false)
    expect(tieneCodigo(v, 'rol-irrealizable')).toBe(true)
    const r = v.razones.find((x) => x.codigo === 'rol-irrealizable')
    expect(r?.rol).toBe('asado')
  })

  it.fails('SIGUE ABIERTO · desmenuzar el asado: hace falta un ADR (ver el bloque de arriba)', () => {
    entra(DESMENUZAR)
  })
})
