// ─── @anima/physics/admit.ts ─────────────────────────────────────────────────
//
// LA PUERTA. Es lo único que separa a Ánima de un chatbot que se inventa la
// realidad: un proceso propuesto —por el modelo, por el oráculo o por quien sea—
// no entra a la física porque suene bien, entra porque la aritmética cierra.
//
// Las cinco reglas del documento, y por qué cada una:
//
//   1. CONSERVACIÓN, y solo sobre las entradas CONSUMIDAS. Que una entrada se
//      consuma NO lo escribe quien propone: se DERIVA de si la salida hereda
//      masa de la entrada. Ésa era la bomba de materia de una línea — con un
//      campo `consume: false`, una entrada intacta contaba como aporte y la masa
//      se duplicaba en bucle.
//   2. NADA SUBE GRATIS. Bajar es libre. Subir declara de qué cuenta conservada
//      drena y con qué eficiencia ≤ 1. Sin esto, frotar dos piedras produce
//      calor infinito y el hambre deja de doler en el tick 300.
//   3. ENVOLVENTES POR TAG. Algo `organico` no puede tener el poder calorífico
//      del plutonio. Y las envolventes NO se escriben a mano: se derivan del
//      catálogo de sustancias, que es el único lugar donde ese número ya vive.
//   4. CIERRE DIMENSIONAL, COTAS DE RANGO, NO-DOMINANCIA, REALIZABILIDAD.
//   5. CICLOS RENTABLES. Ver la sección de la regla 5: acá hay un hallazgo, y
//      cambia lo que esta regla puede honestamente prometer.
//
// ─── Dos decisiones de forma que valen la pena decir ─────────────────────────
//
// NO CORTA EN EL PRIMER NO. El documento escribe `return no(...)` en cada regla.
// Acá se juntan TODAS las razones antes de contestar, porque el consumidor del
// veredicto es la fragua, que tiene que corregir: un rechazo por vez la obliga a
// N viajes al modelo para arreglar N errores que ya se conocían en el primero.
//
// EL VEREDICTO DICE EL NÚMERO. Cada `Razon` lleva la cualidad, lo que se
// encontró y la cota que se pedía. «Fuera de envolvente» no le sirve a nadie;
// «fuelEnergy 5000 contra 45 para `organico`» se puede corregir.
//
// Determinismo: acá no hay `Math.exp`, `Math.pow`, `Math.log`, `**`,
// `Math.random`, `Date`, `Intl`, `performance` ni `localeCompare`. Solo +, −, ×,
// ÷, comparaciones y `Math.min` / `Math.max` / `Math.round`, que ECMAScript sí
// especifica bit a bit. Todo recorrido es sobre arrays o sobre `Map` en orden de
// inserción, nunca sobre `Object.keys` de un vector de cualidades.

import type { Physics } from './physics.js'
import { conservedIn, specIn } from './physics.js'
import type { QualityId, QualitySpec } from './quality.js'
import type { Effect, Process, ProcessId, QualityTest, Role } from './process.js'
import { baseRoleName, unknownRoleRefs } from './process.js'
import type { Substance, SubstanceId, Tag } from './substance.js'

// ─── Constantes de la puerta ─────────────────────────────────────────────────

/**
 * Eficiencia máxima de un `poweredBy`. Es 1 y no puede ser otra cosa: sale menos
 * trabajo del que entra, o el proceso es una máquina de movimiento perpetuo.
 * Está acá como constante con nombre y no como un `> 1` suelto porque es la
 * desigualdad entera del principio 4 del paquete.
 */
export const MAX_EFFICIENCY = 1

/**
 * Cuánto se le permite a una sustancia nueva salirse de lo que la semilla midió
 * para su tag. Medio: el oráculo puede inventar algo la mitad más calórico que
 * lo más calórico que existe, no diez veces más.
 *
 * Es multiplicativo sobre el extremo y no sobre la dispersión a propósito. Con
 * dispersión, un tag donde todas las sustancias declaran el mismo número tendría
 * envolvente de ancho cero y ninguna sustancia nueva entraría jamás.
 */
export const ENVELOPE_SLACK = 0.5

/**
 * Cuántas sustancias hacen falta para que un par (tag, cualidad) tenga
 * envolvente. Con una sola muestra no hay envolvente: hay una anécdota, y
 * rechazar contra una anécdota es escribir la tabla a mano con otro nombre.
 */
export const MIN_ENVELOPE_SAMPLES = 2

/** Tope de ciclos enumerados por llamada. El grafo es chico; esto es un cinturón. */
const MAX_CYCLES = 64

/**
 * Tope de aristas recorridas al enumerar ciclos. Enumerar caminos simples es
 * exponencial en el peor caso y el grafo crece con cada proceso que la criatura
 * aprende: sin presupuesto, la puerta se cuelga en vez de contestar. Cuando se
 * agota, el veredicto lo DICE (`ciclo-busqueda-truncada`) en vez de fingir que
 * miró todo.
 *
 * Medido, y son los dos números que la auditoría le reclamaba a los «~5 ms» de
 * la regla 5: sobre la semilla, `admit` entero cuesta 0.014 ms; sobre un grafo
 * denso de 80 procesos, 4.5 ms; y en el peor caso —30 procesos completamente
 * conectados a los que se entra y de los que no se vuelve, o sea 30! caminos
 * simples y ni un solo ciclo— 7.4 ms y sale avisando que se cortó.
 */
const MAX_STEPS = 200000

// ─── El veredicto ────────────────────────────────────────────────────────────

export type Regla = 1 | 2 | 3 | 4 | 5

export type Codigo =
  // regla 1 — conservación
  | 'conservacion-drive'
  | 'conservacion-couple'
  | 'conservacion-transfer'
  | 'materia-sin-origen'
  | 'tasa-negativa'
  // regla 2 — nada sube gratis
  | 'sube-gratis'
  | 'fuente-no-conservada'
  | 'eficiencia'
  | 'fuente-sin-respaldo'
  // regla 3 — envolventes por tag
  | 'fuera-de-envolvente'
  | 'envolvente-por-abajo'
  // regla 4 — cierre dimensional, cotas, no-dominancia, realizabilidad
  | 'cualidad-fuera-del-catalogo'
  | 'cualidad-derivada'
  | 'cualidad-de-estado'
  | 'numero-no-finito'
  | 'fuera-de-rango'
  | 'acople-inconmensurable'
  | 'rol-desconocido'
  | 'rol-repetido'
  | 'sin-roles'
  | 'rol-contradictorio'
  | 'rol-irrealizable'
  | 'completion-invalida'
  | 'completion-sin-rendimientos'
  | 'version-de-fisica'
  | 'id-repetido'
  | 'dominancia'
  | 'sin-tags'
  | 'sin-nombre'
  | 'calor-especifico'
  // regla 5 — ciclos
  | 'ciclo-rentable'
  | 'ciclo-con-aporte'
  | 'ciclo-busqueda-truncada'
  // advertencias que no cierran la puerta
  | 'costo-mayor-que-la-garantia'
  | 'tasa-mayor-que-el-rango'
  | 'drenaje-sin-respaldo'

/** Lo que hay que poder citar para que el rechazo sea corregible. */
export interface Cita {
  q?: QualityId
  rol?: string
  proceso?: ProcessId
  sustancia?: SubstanceId
  tag?: Tag
  /** El número que se midió. */
  encontrado?: number
  /** El número que se permitía. */
  cota?: number
}

export interface Razon extends Cita {
  regla: Regla
  codigo: Codigo
  /** En castellano, con la cualidad y los dos números. La fragua lee esto. */
  mensaje: string
}

export interface Verdict {
  ok: boolean
  /** Vacío si `ok`. Cada una cierra la puerta por su cuenta. */
  razones: readonly Razon[]
  /** Cosas raras que no cierran la puerta. Ver la regla 5. */
  advertencias: readonly Razon[]
}

function razon(regla: Regla, codigo: Codigo, mensaje: string, cita: Cita = {}): Razon {
  return { regla, codigo, mensaje, ...cita }
}

/** El veredicto entero como texto. Para el log del juez y para el reporte. */
export function porQue(v: Verdict): string {
  const linea = (r: Razon): string => `  [regla ${r.regla} · ${r.codigo}] ${r.mensaje}`
  const partes: string[] = [v.ok ? 'ADMITIDO' : 'RECHAZADO']
  for (const r of v.razones) partes.push(linea(r))
  if (v.advertencias.length > 0) partes.push('  — con reparos:')
  for (const r of v.advertencias) partes.push(linea(r))
  return partes.join('\n')
}

/**
 * Redondeo para los mensajes. `Math.round` está especificado bit a bit; lo que
 * está prohibido son las trascendentes. Y nada de `toLocaleString`, que depende
 * del locale y haría que el mismo rechazo se escriba distinto en dos máquinas.
 */
function num(v: number): string {
  if (!Number.isFinite(v)) return String(v)
  return String(Math.round(v * 1000) / 1000)
}

// ─── Lecturas del catálogo ───────────────────────────────────────────────────

function spec(phys: Physics, q: QualityId): QualitySpec | undefined {
  return specIn(phys, q)
}

function esConservada(phys: Physics, q: QualityId): boolean {
  return spec(phys, q)?.conserved === true
}

function span(phys: Physics, q: QualityId): number {
  const s = spec(phys, q)
  if (s === undefined) return 0
  return s.range[1] - s.range[0]
}

function rolDe(p: Process, name: string): Role | undefined {
  for (const r of p.roles) if (r.name === name) return r
  return undefined
}

export interface Cotas {
  lo: number
  hi: number
}

/**
 * Lo que el proceso GARANTIZA sobre una cualidad de un rol, antes de mirar el
 * mundo. Es la única cota estática honesta: el rol dice `stamina >= 1`, así que
 * de ese rol se puede contar con 1 y ni un gramo más.
 *
 * Sin rol o sin cualidad en el catálogo, el rango entero: no se sabe nada.
 */
export function cotasDeRol(r: Role | undefined, q: QualityId, phys: Physics): Cotas {
  const s = spec(phys, q)
  let lo = s === undefined ? Number.NEGATIVE_INFINITY : s.range[0]
  let hi = s === undefined ? Number.POSITIVE_INFINITY : s.range[1]
  if (r === undefined) return { lo, hi }
  for (const t of r.where) {
    if (t.q !== q) continue
    if (t.op === '>=' || t.op === '>') {
      if (t.v > lo) lo = t.v
    } else if (t.v < hi) hi = t.v
  }
  return { lo, hi }
}

/** El rol promete que esta cualidad es estrictamente positiva en quien lo llene. */
function garantizaPositivo(r: Role | undefined, q: QualityId): boolean {
  if (r === undefined) return false
  for (const t of r.where) {
    if (t.q !== q) continue
    if (t.op === '>' && t.v >= 0) return true
    if (t.op === '>=' && t.v > 0) return true
  }
  return false
}

// ─── Qué sustancia puede llenar qué rol ──────────────────────────────────────

interface Indice {
  /** Cualidades que alguna sustancia del catálogo declara en `perUnitMass`. */
  deSustancia: ReadonlySet<QualityId>
  /** Sustancias en orden de inserción del `Map`, para recorridos reproducibles. */
  sustancias: readonly Substance[]
  envolventes: ReadonlyMap<Tag, ReadonlyMap<EnvelopeKey, Envelope>>
}

const INDICE = new WeakMap<Physics, Indice>()

function indiceDe(phys: Physics): Indice {
  const cache = INDICE.get(phys)
  if (cache !== undefined) return cache
  const sustancias: Substance[] = []
  for (const s of phys.substances.values()) sustancias.push(s)
  // Se recorre `phys.qualities` (array, orden del catálogo) y no las claves de
  // los vectores: el orden de `Object.keys` depende de cómo se escribió cada
  // objeto, y eso es exactamente la clase de cosa que hace divergir un replay.
  const deSustancia = new Set<QualityId>()
  for (const qs of phys.qualities) {
    for (const s of sustancias) {
      if (s.perUnitMass[qs.id] !== undefined) {
        deSustancia.add(qs.id)
        break
      }
    }
  }
  const armado: Indice = { deSustancia, sustancias, envolventes: construirEnvolventes(phys, sustancias) }
  INDICE.set(phys, armado)
  return armado
}

/**
 * Las sustancias del catálogo que podrían llenar este rol.
 *
 * Solo se miran los tests sobre cualidades que una SUSTANCIA puede aportar: los
 * de `mass`, `stamina`, `reach` o `catch` no dicen nada de la materia (son
 * geometría, o son la criatura, o son estado del cuerpo) y se saltean. Un rol
 * cuyos tests son todos de ésos acepta cualquier sustancia, que es la verdad.
 *
 * Aproximación declarada: se compara contra `perUnitMass`, o sea contra el valor
 * por unidad de masa. Para las intensivas es exacto; para `nutrition` y
 * `fuelEnergy` un cuerpo grande da más que el número de la tabla, así que la
 * candidatura es CONSERVADORA por abajo y nunca inventa candidatos.
 */
export function candidatasDeRol(r: Role, phys: Physics): readonly Substance[] {
  const idx = indiceDe(phys)
  const out: Substance[] = []
  for (const s of idx.sustancias) {
    let sirve = true
    for (const t of r.where) {
      const sp = spec(phys, t.q)
      if (sp === undefined || sp.derived !== undefined) continue
      if (!idx.deSustancia.has(t.q)) continue
      const v = s.perUnitMass[t.q] ?? 0
      if (!cumple(v, t)) {
        sirve = false
        break
      }
    }
    if (sirve) out.push(s)
  }
  return out
}

function cumple(v: number, t: QualityTest): boolean {
  switch (t.op) {
    case '>=':
      return v >= t.v
    case '<=':
      return v <= t.v
    case '>':
      return v > t.v
    case '<':
      return v < t.v
  }
}

/** ¿De este rol se puede SACAR esta cualidad conservada, o sería sacarla de la nada? */
function respalda(r: Role | undefined, q: QualityId, phys: Physics): boolean {
  // La masa la tiene todo cuerpo por definición: un cuerpo de masa cero no es un
  // cuerpo. No hace falta que ningún rol la prometa.
  if (q === 'mass') return true
  if (garantizaPositivo(r, q)) return true
  if (r === undefined) return false
  const idx = indiceDe(phys)
  if (!idx.deSustancia.has(q)) return false
  const cands = candidatasDeRol(r, phys)
  if (cands.length === 0) return false
  // TODAS y no ALGUNA: el respaldo tiene que ser una garantía. Si una sola
  // sustancia que puede llenar el rol trae la cualidad en cero, existe un mundo
  // donde el proceso saca de donde no hay — y ése es el mundo que hay que negar.
  for (const s of cands) if ((s.perUnitMass[q] ?? 0) <= 0) return false
  return true
}

// ─── Regla 3 · las envolventes, derivadas y no escritas ──────────────────────

export type EnvelopeKey = QualityId | 'specificHeat'

export interface Envelope {
  lo: number
  hi: number
  /** Cuántas sustancias del catálogo la sostienen. Menos de dos: no hay envolvente. */
  muestras: number
}

function construirEnvolventes(
  phys: Physics,
  sustancias: readonly Substance[],
): ReadonlyMap<Tag, ReadonlyMap<EnvelopeKey, Envelope>> {
  const claves: EnvelopeKey[] = []
  for (const qs of phys.qualities) if (qs.derived === undefined) claves.push(qs.id)
  claves.push('specificHeat')

  const porTag = new Map<Tag, Map<EnvelopeKey, Envelope>>()
  for (const s of sustancias) {
    for (const tag of s.tags) {
      let m = porTag.get(tag)
      if (m === undefined) {
        m = new Map<EnvelopeKey, Envelope>()
        porTag.set(tag, m)
      }
      for (const k of claves) {
        const v = k === 'specificHeat' ? s.specificHeat : s.perUnitMass[k]
        if (v === undefined || !Number.isFinite(v)) continue
        const e = m.get(k)
        if (e === undefined) m.set(k, { lo: v, hi: v, muestras: 1 })
        else m.set(k, { lo: Math.min(e.lo, v), hi: Math.max(e.hi, v), muestras: e.muestras + 1 })
      }
    }
  }

  const salida = new Map<Tag, ReadonlyMap<EnvelopeKey, Envelope>>()
  for (const [tag, m] of porTag) {
    const abierta = new Map<EnvelopeKey, Envelope>()
    for (const [k, e] of m) {
      if (e.muestras < MIN_ENVELOPE_SAMPLES) continue
      let hi = e.hi > 0 ? e.hi * (1 + ENVELOPE_SLACK) : e.hi
      let lo = e.lo > 0 ? e.lo * (1 - ENVELOPE_SLACK) : e.lo
      if (k !== 'specificHeat') {
        const sp = spec(phys, k)
        if (sp !== undefined) {
          if (hi > sp.range[1]) hi = sp.range[1]
          if (lo < sp.range[0]) lo = sp.range[0]
        }
      }
      abierta.set(k, { lo, hi, muestras: e.muestras })
    }
    salida.set(tag, abierta)
  }
  return salida
}

/**
 * Las envolventes por tag, derivadas del catálogo de sustancias. Memorizadas por
 * objeto `Physics`, así que una recalibración —que produce una `Physics` nueva—
 * las recalcula sola y no queda una envolvente vieja contestando.
 */
export function tagEnvelopes(phys: Physics): ReadonlyMap<Tag, ReadonlyMap<EnvelopeKey, Envelope>> {
  return indiceDe(phys).envolventes
}

/**
 * La envolvente que le toca a algo con estos tags: la UNIÓN de las de sus tags.
 * Unión y no intersección porque los tags no son excluyentes —el hueso es
 * `organico` y `mineral` a la vez— y la clase más permisiva es la que manda:
 * rechazar al hueso por no parecerse a la carne sería un error de la puerta.
 */
export function envolventeDe(
  phys: Physics,
  tags: readonly Tag[],
  k: EnvelopeKey,
): Envelope | undefined {
  const todas = tagEnvelopes(phys)
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  let muestras = 0
  for (const tag of tags) {
    const e = todas.get(tag)?.get(k)
    if (e === undefined) continue
    lo = Math.min(lo, e.lo)
    hi = Math.max(hi, e.hi)
    muestras += e.muestras
  }
  if (muestras === 0) return undefined
  return { lo, hi, muestras }
}

// ─── La puerta de las sustancias ─────────────────────────────────────────────

/**
 * La regla 3 en su hábitat: una sustancia que el oráculo o el modelo inventan.
 *
 * Está acá y no en `substance.ts` porque es un JUEZ, no un dato, y porque es la
 * misma envolvente que usa `admit()` para los `drive`. Que vivan juntas es lo
 * que impide que dos números digan lo mismo distinto.
 */
export function admitSubstance(s: Substance, phys: Physics): Verdict {
  const razones: Razon[] = []
  const advertencias: Razon[] = []

  if (s.id.length === 0) razones.push(razon(4, 'sin-nombre', 'la sustancia no tiene id'))
  if (s.lexeme.nombre.length === 0)
    razones.push(razon(4, 'sin-nombre', `la sustancia ${s.id} no tiene nombre`, { sustancia: s.id }))
  if (s.tags.length === 0) {
    // Sin tag no la agarra ninguna ley: no arde, no se pudre, no se cocina. Es
    // materia invisible para la física, y eso no es una sustancia.
    razones.push(
      razon(4, 'sin-tags', `la sustancia ${s.id} no declara ningún tag: ninguna ley la alcanza`, {
        sustancia: s.id,
      }),
    )
  }

  if (!Number.isFinite(s.specificHeat) || s.specificHeat <= 0) {
    razones.push(
      razon(
        4,
        'calor-especifico',
        `${s.id}: specificHeat ${num(s.specificHeat)}; la ley 1 divide por él y cero es una división por cero`,
        { sustancia: s.id, encontrado: s.specificHeat, cota: 0 },
      ),
    )
  }

  for (const qs of phys.qualities) {
    const v = s.perUnitMass[qs.id]
    if (v === undefined) continue
    revisarValorDeSustancia(s, qs.id, v, qs, phys, razones, advertencias)
  }

  // Cualquier cualidad del vector que el catálogo no conozca. Se recorre el
  // vector una sola vez y para esto: una cualidad inventada es un dato que
  // ninguna ley va a leer nunca, y el silencio es peor que el rechazo.
  for (const k of Object.keys(s.perUnitMass)) {
    const q = k as QualityId
    if (spec(phys, q) === undefined) {
      razones.push(
        razon(4, 'cualidad-fuera-del-catalogo', `${s.id} declara «${k}», que no está en el catálogo`, {
          sustancia: s.id,
        }),
      )
    }
  }

  const env = envolventeDe(phys, s.tags, 'specificHeat')
  if (env !== undefined && s.specificHeat > env.hi) {
    razones.push(
      razon(
        3,
        'fuera-de-envolvente',
        `${s.id}: specificHeat ${num(s.specificHeat)} contra ${num(env.hi)} para ${s.tags.join('+')}`,
        { sustancia: s.id, encontrado: s.specificHeat, cota: env.hi },
      ),
    )
  }

  return { ok: razones.length === 0, razones, advertencias }
}

function revisarValorDeSustancia(
  s: Substance,
  q: QualityId,
  v: number,
  sp: QualitySpec,
  phys: Physics,
  razones: Razon[],
  advertencias: Razon[],
): void {
  if (!Number.isFinite(v)) {
    razones.push(
      razon(4, 'numero-no-finito', `${s.id}: ${q} vale ${String(v)}`, { sustancia: s.id, q }),
    )
    return
  }
  if (sp.derived !== undefined) {
    razones.push(
      razon(4, 'cualidad-derivada', `${s.id} declara ${q}, que es derivada y no se guarda`, {
        sustancia: s.id,
        q,
      }),
    )
    return
  }
  if (q === 'mass' || q === 'temperature') {
    // `mass` sería circular (la masa vive en `Part.mass`) y `temperature` es
    // estado del cuerpo que relaja al ambiente, no una propiedad del material.
    razones.push(
      razon(4, 'cualidad-de-estado', `${s.id} declara ${q}, que es estado del cuerpo y no materia`, {
        sustancia: s.id,
        q,
      }),
    )
    return
  }
  if (v < sp.range[0] || v > sp.range[1]) {
    razones.push(
      razon(
        4,
        'fuera-de-rango',
        `${s.id}: ${q} ${num(v)} fuera de [${num(sp.range[0])}, ${num(sp.range[1])}]`,
        { sustancia: s.id, q, encontrado: v, cota: v > sp.range[1] ? sp.range[1] : sp.range[0] },
      ),
    )
    return
  }
  const env = envolventeDe(phys, s.tags, q)
  if (env === undefined) return
  if (v > env.hi) {
    razones.push(
      razon(
        3,
        'fuera-de-envolvente',
        `${s.id}: ${q} ${num(v)} contra ${num(env.hi)} para ${s.tags.join('+')} (${env.muestras} muestras)`,
        { sustancia: s.id, q, encontrado: v, cota: env.hi },
      ),
    )
    return
  }
  if (v < env.lo) {
    // Por abajo es reparo y no rechazo, y la asimetría es a propósito: de que
    // algo tenga POCO de una cualidad no sale ninguna máquina de movimiento
    // perpetuo. Lo que rompe el mundo es tener de más.
    advertencias.push(
      razon(
        3,
        'envolvente-por-abajo',
        `${s.id}: ${q} ${num(v)} por debajo de ${num(env.lo)} para ${s.tags.join('+')}`,
        { sustancia: s.id, q, encontrado: v, cota: env.lo },
      ),
    )
  }
}

// ─── Regla 1 · qué entradas se consumen ──────────────────────────────────────

/**
 * Los roles que el proceso CONSUME, derivados de los rendimientos y de nada más.
 *
 * Ésta es la línea que cierra la bomba de materia. Quien propone no escribe
 * «esta entrada se consume»: se lee de si la salida hereda masa de la entrada.
 *
 *   transmute      el cuerpo del rol se convierte en otra cosa → se consume
 *   join           `a`, `b?` y el atador se van adentro del cuerpo nuevo
 *   split          el cuerpo del rol se parte en los pedazos que salen
 *   drawFromStock  lo que sale sale del stock, que baja
 *
 * Un rol que ningún rendimiento menciona NO se consume: el `actor` de `friccion`
 * paga con `stamina` (que es un `drain`, o sea un costo) y sigue entero.
 */
export function consumedRoles(p: Process): readonly string[] {
  const out: string[] = []
  const push = (name: string | undefined): void => {
    if (name === undefined) return
    if (out.includes(name)) return
    out.push(name)
  }
  for (const y of p.completion?.yields ?? []) {
    switch (y.k) {
      case 'transmute':
        push(y.role)
        break
      case 'join':
        push(y.a)
        push(y.b)
        push(y.via)
        break
      case 'split':
        push(y.role)
        break
      case 'drawFromStock':
        push(y.of)
        break
    }
  }
  return out
}

/** Lo que el proceso puede garantizar que ENTRA de una cualidad conservada. */
function entraDe(p: Process, q: QualityId, phys: Physics): number {
  let total = 0
  for (const name of consumedRoles(p)) {
    const lo = cotasDeRol(rolDe(p, name), q, phys).lo
    if (Number.isFinite(lo) && lo > 0) total += lo
  }
  return total
}

/** Cuánto empuja realmente un `drive`, acotado por el objetivo y por la corrida. */
function trabajoDe(p: Process, e: Extract<Effect, { k: 'drive' }>, phys: Physics): number {
  const ticks = p.completion?.at ?? 1
  const lo = cotasDeRol(rolDe(p, e.on), e.q, phys).lo
  const recorrido = Number.isFinite(lo) ? e.toward - lo : e.toward
  const porTasa = e.perTick * ticks
  if (recorrido <= 0 || porTasa <= 0) return 0
  return Math.min(porTasa, recorrido)
}

/**
 * El saldo DECLARADO del proceso sobre una cuenta conservada, por corrida.
 * Negativo = cuesta. Es la cuenta que suma la regla 5 a lo largo de un ciclo.
 *
 * Un `transfer` cuenta el crédito en el destino SIEMPRE y el débito en el origen
 * SOLO si el origen respalda la cualidad. Ésa es la asimetría que hace visible
 * la piedra-batería: transferir `stamina` desde una piedra no le saca nada a
 * nadie y sin embargo se la pone a alguien.
 */
export function saldoDeclarado(p: Process, q: QualityId, phys: Physics): number {
  const ticks = p.completion?.at ?? 1
  let saldo = 0
  for (const e of p.effects) {
    switch (e.k) {
      case 'drain':
        if (e.q === q) saldo -= e.perTick * ticks
        break
      case 'transfer':
        if (e.q === q) {
          saldo += e.perTick * ticks
          if (respalda(rolDe(p, e.from), q, phys)) saldo -= e.perTick * ticks
        }
        break
      case 'drive': {
        if (e.q === q) saldo += trabajoDe(p, e, phys)
        const pb = e.poweredBy
        if (pb !== undefined && pb.q === q) {
          const eff = pb.efficiency > 0 ? pb.efficiency : 1
          saldo -= trabajoDe(p, e, phys) / eff
        }
        break
      }
      case 'couple':
        // Un `couple` escribe la cualidad sin cota propia: lo peor que puede
        // pasar es el rango entero, y ésa es la cota honesta.
        if (e.q === q) saldo += span(phys, q)
        break
    }
  }
  return saldo
}

function reglaConservacion(p: Process, phys: Physics, razones: Razon[]): void {
  const conservadas = conservedIn(phys)

  for (const e of p.effects) {
    const tasa = tasaDe(e)
    if (tasa !== undefined && tasa < 0) {
      // Una tasa negativa da vuelta el signo de TODO efecto: un `drain` de −5 es
      // un `drive` disfrazado, y pasaría por debajo de las reglas 1 y 2 sin
      // tocarlas. Es la bomba de materia de un solo carácter.
      const conservada = esConservada(phys, e.q)
      razones.push(
        razon(
          conservada ? 1 : 2,
          'tasa-negativa',
          `${p.id}: ${e.k} de ${e.q} con perTick ${num(tasa)}; una tasa negativa invierte el efecto`,
          { proceso: p.id, q: e.q, encontrado: tasa, cota: 0 },
        ),
      )
    }
  }

  for (const q of conservadas) {
    const entra = entraDe(p, q, phys)
    for (const e of p.effects) {
      // Con la tasa en negativo el efecto está dado vuelta y ya lo dijo
      // `tasa-negativa`; volver a contarlo acá daría un «sale −10» ilegible.
      if (e.k === 'drive' && e.q === q && e.perTick >= 0) {
        const lo = cotasDeRol(rolDe(p, e.on), q, phys).lo
        if (e.toward <= lo) continue
        const sale = trabajoDe(p, e, phys)
        razones.push(
          razon(
            1,
            'conservacion-drive',
            `${q} es conservada y «${p.id}» la sube en el rol «${e.on}» hacia ${num(e.toward)}: sale ${num(sale)}, entra ${num(entra)}`,
            { proceso: p.id, q, rol: e.on, encontrado: sale, cota: entra },
          ),
        )
      }
      if (e.k === 'couple' && e.q === q) {
        razones.push(
          razon(
            1,
            'conservacion-couple',
            `${q} es conservada y «${p.id}» la hace seguir a ${e.follows.q} de «${e.follows.of}»: sale hasta ${num(span(phys, q))}, entra ${num(entra)}`,
            { proceso: p.id, q, rol: e.on, encontrado: span(phys, q), cota: entra },
          ),
        )
      }
      if (e.k === 'transfer' && e.q === q && e.perTick >= 0) {
        const origen = rolDe(p, e.from)
        if (respalda(origen, q, phys)) continue
        const sale = e.perTick * (p.completion?.at ?? 1)
        razones.push(
          razon(
            1,
            'conservacion-transfer',
            `«${p.id}» mueve ${q} desde «${e.from}», que no la tiene garantizada: sale ${num(sale)}, entra ${num(entra)}`,
            { proceso: p.id, q, rol: e.from, encontrado: sale, cota: entra },
          ),
        )
      }
    }
  }

  for (const y of p.completion?.yields ?? []) {
    if (y.k !== 'drawFromStock') continue
    const fuente = rolDe(p, y.of)
    if (!garantizaPositivo(fuente, 'mass')) {
      // `drawFromStock` es EL agujero de la conservación: es por donde el dios
      // le mete materia al mundo. Que exista está bien; que no declare de qué
      // cuerpo sale, no. Sin cota de masa en el rol, esto es materia de la nada
      // y el río no se agota nunca.
      razones.push(
        razon(
          1,
          'materia-sin-origen',
          `«${p.id}» saca de «${y.of}» sin exigirle masa: el rol tiene que pedir mass > 0 o la materia sale de la nada`,
          { proceso: p.id, q: 'mass', rol: y.of, cota: 0 },
        ),
      )
    }
  }
}

function tasaDe(e: Effect): number | undefined {
  switch (e.k) {
    case 'drain':
    case 'drive':
    case 'transfer':
      return e.perTick
    case 'couple':
      return undefined
  }
}

// ─── Regla 2 · nada sube gratis ──────────────────────────────────────────────

function reglaNadaSubeGratis(
  p: Process,
  phys: Physics,
  razones: Razon[],
  advertencias: Razon[],
): void {
  for (const e of p.effects) {
    if (e.k !== 'drive') continue
    // Una conservada que sube ya la rechazó la regla 1, con mejor mensaje.
    if (esConservada(phys, e.q)) continue

    const lo = cotasDeRol(rolDe(p, e.on), e.q, phys).lo
    if (e.toward <= lo) continue // baja: libre, y tiene que serlo

    const pb = e.poweredBy
    if (pb === undefined) {
      razones.push(
        razon(
          2,
          'sube-gratis',
          `«${p.id}» sube ${e.q} hacia ${num(e.toward)} en «${e.on}» sin declarar poweredBy: de qué cuenta conservada drena`,
          { proceso: p.id, q: e.q, rol: e.on, encontrado: e.toward, cota: lo },
        ),
      )
      continue
    }
    if (!esConservada(phys, pb.q)) {
      razones.push(
        razon(
          2,
          'fuente-no-conservada',
          `«${p.id}» sube ${e.q} con poweredBy sobre ${pb.q}, que no es una cuenta conservada: drenarla no le cuesta nada a nadie`,
          { proceso: p.id, q: pb.q, rol: pb.from },
        ),
      )
      continue
    }
    if (!(pb.efficiency > 0)) {
      razones.push(
        razon(
          2,
          'eficiencia',
          `«${p.id}»: eficiencia ${num(pb.efficiency)} sobre ${pb.q}; con cero o menos el proceso no termina nunca`,
          { proceso: p.id, q: pb.q, encontrado: pb.efficiency, cota: MAX_EFFICIENCY },
        ),
      )
    } else if (pb.efficiency > MAX_EFFICIENCY) {
      razones.push(
        razon(
          2,
          'eficiencia',
          `«${p.id}»: eficiencia ${num(pb.efficiency)} > ${num(MAX_EFFICIENCY)} sobre ${pb.q}; sale más trabajo del que entra`,
          { proceso: p.id, q: pb.q, encontrado: pb.efficiency, cota: MAX_EFFICIENCY },
        ),
      )
    }
    if (!respalda(rolDe(p, pb.from), pb.q, phys)) {
      // Drenar `stamina` de una piedra no le saca `stamina` a nadie: el calor
      // sale gratis igual, con la declaración puesta y todo. La declaración
      // tiene que apuntar a algo que efectivamente tenga de dónde.
      razones.push(
        razon(
          2,
          'fuente-sin-respaldo',
          `«${p.id}» dice drenar ${pb.q} de «${pb.from}», pero el rol no garantiza ${pb.q}: el trabajo saldría gratis`,
          { proceso: p.id, q: pb.q, rol: pb.from },
        ),
      )
    }

    const ticks = p.completion?.at
    if (ticks !== undefined && pb.efficiency > 0) {
      const costo = trabajoDe(p, e, phys) / pb.efficiency
      const disponible = cotasDeRol(rolDe(p, pb.from), pb.q, phys).lo
      if (Number.isFinite(disponible) && costo > disponible) {
        advertencias.push(
          razon(
            2,
            'costo-mayor-que-la-garantia',
            `«${p.id}» gasta ${num(costo)} de ${pb.q} y el rol «${pb.from}» solo garantiza ${num(disponible)}: quien empiece justo no llega a terminar`,
            { proceso: p.id, q: pb.q, rol: pb.from, encontrado: costo, cota: disponible },
          ),
        )
      }
    }
  }

  for (const e of p.effects) {
    if (e.k !== 'drain') continue
    if (!respalda(rolDe(p, e.on), e.q, phys)) {
      advertencias.push(
        razon(
          2,
          'drenaje-sin-respaldo',
          `«${p.id}» drena ${e.q} de «${e.on}», que no la tiene garantizada: el costo puede ser cero y el proceso, gratis`,
          { proceso: p.id, q: e.q, rol: e.on },
        ),
      )
      continue
    }
    const ticks = p.completion?.at
    if (ticks === undefined) continue
    const costo = e.perTick * ticks
    const disponible = cotasDeRol(rolDe(p, e.on), e.q, phys).lo
    if (Number.isFinite(disponible) && costo > disponible) {
      // Reparo y no rechazo: que quien empiece con lo justo se quede sin
      // aliento a mitad de camino no es una violación de la física, es la
      // distancia entre querer y poder. Pero tiene que estar dicho, porque un
      // proceso que NUNCA se puede terminar desde su propio umbral de entrada
      // es indistinguible de uno que anda, hasta que se lo mira.
      advertencias.push(
        razon(
          2,
          'costo-mayor-que-la-garantia',
          `«${p.id}» gasta ${num(costo)} de ${e.q} en ${num(ticks)} ticks y el rol «${e.on}» solo garantiza ${num(disponible)}: quien empiece justo no llega a terminar`,
          { proceso: p.id, q: e.q, rol: e.on, encontrado: costo, cota: disponible },
        ),
      )
    }
  }
}

// ─── Regla 3 sobre el proceso ────────────────────────────────────────────────

function reglaEnvolventes(p: Process, phys: Physics, razones: Razon[]): void {
  const idx = indiceDe(phys)
  for (const e of p.effects) {
    if (e.k !== 'drive') continue
    if (!idx.deSustancia.has(e.q)) continue // no es una cualidad de la materia
    const r = rolDe(p, e.on)
    if (r === undefined) continue // ya lo dice la regla 4
    const cands = candidatasDeRol(r, phys)
    if (cands.length === 0) continue // ya lo dice la realizabilidad

    // El techo es el de la sustancia MÁS PERMISIVA que puede llenar el rol: para
    // rechazar hace falta que ninguna de las que califican pueda llegar ahí.
    let techo = Number.NEGATIVE_INFINITY
    let quien: Substance | undefined
    for (const s of cands) {
      const env = envolventeDe(phys, s.tags, e.q)
      if (env === undefined) continue
      if (env.hi > techo) {
        techo = env.hi
        quien = s
      }
    }
    if (quien === undefined || !Number.isFinite(techo)) continue
    if (e.toward > techo) {
      razones.push(
        razon(
          3,
          'fuera-de-envolvente',
          `«${p.id}» empuja ${e.q} hasta ${num(e.toward)} en «${e.on}», y lo más alto que llega una sustancia que pueda llenar ese rol es ${num(techo)} (${quien.id}, ${quien.tags.join('+')})`,
          { proceso: p.id, q: e.q, rol: e.on, encontrado: e.toward, cota: techo },
        ),
      )
    }
  }
}

// ─── Regla 4 · cierre dimensional, cotas, no-dominancia, realizabilidad ──────

function reglaCierreYCotas(p: Process, phys: Physics, razones: Razon[], advertencias: Razon[]): void {
  // — cualidades que el catálogo no conoce, y números que no son números —
  for (const { q, donde } of cualidadesDe(p)) {
    if (spec(phys, q) === undefined) {
      razones.push(
        razon(4, 'cualidad-fuera-del-catalogo', `«${p.id}» nombra ${q} en ${donde}, que no está en el catálogo`, {
          proceso: p.id,
          q,
        }),
      )
    }
  }
  for (const n of numerosDe(p)) {
    if (Number.isFinite(n.v)) continue
    const cita: Cita = n.q === undefined ? { proceso: p.id } : { proceso: p.id, q: n.q }
    razones.push(razon(4, 'numero-no-finito', `«${p.id}»: ${n.donde} vale ${String(n.v)}`, cita))
  }

  // — cotas de rango sobre todo número que nombre un valor de cualidad —
  for (const t of p.gate) revisarTest(p, t, 'la compuerta', phys, razones)
  for (const r of p.roles) for (const t of r.where) revisarTest(p, t, `el rol «${r.name}»`, phys, razones)
  for (const e of p.effects) {
    if (e.k !== 'drive') continue
    const sp = spec(phys, e.q)
    if (sp === undefined) continue
    if (e.toward < sp.range[0] || e.toward > sp.range[1]) {
      razones.push(
        razon(
          4,
          'fuera-de-rango',
          `«${p.id}» empuja ${e.q} hacia ${num(e.toward)}, fuera de [${num(sp.range[0])}, ${num(sp.range[1])}]`,
          {
            proceso: p.id,
            q: e.q,
            encontrado: e.toward,
            cota: e.toward > sp.range[1] ? sp.range[1] : sp.range[0],
          },
        ),
      )
    }
  }
  for (const e of p.effects) {
    const tasa = tasaDe(e)
    if (tasa === undefined || !Number.isFinite(tasa) || tasa < 0) continue
    const s = span(phys, e.q)
    if (s > 0 && tasa > s) {
      advertencias.push(
        razon(
          4,
          'tasa-mayor-que-el-rango',
          `«${p.id}»: ${e.k} de ${e.q} a ${num(tasa)} por tick, y el rango entero de ${e.q} mide ${num(s)}: el efecto es instantáneo`,
          { proceso: p.id, q: e.q, encontrado: tasa, cota: s },
        ),
      )
    }
  }

  // — cierre dimensional del `couple` —
  for (const e of p.effects) {
    if (e.k !== 'couple') continue
    const a = spec(phys, e.q)
    const b = spec(phys, e.follows.q)
    if (a === undefined || b === undefined) continue
    if (a.extent !== b.extent) {
      razones.push(
        razon(
          4,
          'acople-inconmensurable',
          `«${p.id}» acopla ${e.q} (${a.extent}) a ${e.follows.q} (${b.extent}): no son la misma clase de magnitud`,
          { proceso: p.id, q: e.q },
        ),
      )
      continue
    }
    if (b.range[0] < a.range[0] || b.range[1] > a.range[1]) {
      razones.push(
        razon(
          4,
          'acople-inconmensurable',
          `«${p.id}» acopla ${e.q} ∈ [${num(a.range[0])}, ${num(a.range[1])}] a ${e.follows.q} ∈ [${num(b.range[0])}, ${num(b.range[1])}]: lo seguido no entra en lo que sigue`,
          { proceso: p.id, q: e.q, encontrado: b.range[1], cota: a.range[1] },
        ),
      )
    }
  }

  // — versión de la física: un sello contra otra física no vale acá —
  if (p.physicsVersion !== phys.version) {
    razones.push(
      razon(
        4,
        'version-de-fisica',
        `«${p.id}» está sellado contra la física ${num(p.physicsVersion)} y ésta es la ${num(phys.version)}`,
        { proceso: p.id, encontrado: p.physicsVersion, cota: phys.version },
      ),
    )
  }
}

function revisarTest(
  p: Process,
  t: QualityTest,
  donde: string,
  phys: Physics,
  razones: Razon[],
): void {
  const sp = spec(phys, t.q)
  if (sp === undefined) return
  if (t.v < sp.range[0] || t.v > sp.range[1]) {
    razones.push(
      razon(
        4,
        'fuera-de-rango',
        `«${p.id}»: ${donde} pide ${t.q} ${t.op} ${num(t.v)}, fuera de [${num(sp.range[0])}, ${num(sp.range[1])}]`,
        { proceso: p.id, q: t.q, encontrado: t.v, cota: t.v > sp.range[1] ? sp.range[1] : sp.range[0] },
      ),
    )
  }
}

function reglaRealizabilidad(p: Process, phys: Physics, razones: Razon[], advertencias: Razon[]): void {
  if (p.roles.length === 0) {
    razones.push(razon(4, 'sin-roles', `«${p.id}» no declara ningún rol: no se puede aplicar a nada`, { proceso: p.id }))
  }
  const vistos = new Set<string>()
  for (const r of p.roles) {
    const base = baseRoleName(r.name)
    if (vistos.has(base)) {
      razones.push(
        razon(4, 'rol-repetido', `«${p.id}» declara dos veces el rol «${base}»`, { proceso: p.id, rol: base }),
      )
    }
    vistos.add(base)
  }

  for (const name of unknownRoleRefs(p)) {
    // Un efecto que apunta a un rol inexistente no falla: simplemente no hace
    // nada. Es la clase de bug que se descubre porque la criatura frota una hora
    // y no se calienta.
    razones.push(
      razon(4, 'rol-desconocido', `«${p.id}» menciona el rol «${name}», que no declara`, {
        proceso: p.id,
        rol: name,
      }),
    )
  }

  for (const r of p.roles) {
    // Contradicción interna: `q >= 5` y `q <= 2` a la vez.
    const qs: QualityId[] = []
    for (const t of r.where) if (!qs.includes(t.q)) qs.push(t.q)
    for (const q of qs) {
      const c = cotasDeRol(r, q, phys)
      if (c.lo > c.hi) {
        razones.push(
          razon(
            4,
            'rol-contradictorio',
            `«${p.id}»: el rol «${r.name}» pide ${q} ≥ ${num(c.lo)} y ≤ ${num(c.hi)} a la vez`,
            { proceso: p.id, rol: r.name, q, encontrado: c.lo, cota: c.hi },
          ),
        )
      }
    }

    // Realizabilidad contra el catálogo de sustancias. Éste es el fallo
    // SILENCIOSO que el documento marca: `admit` pasa, el proceso nunca
    // encuentra entradas, y Ánima queda tanteando sin que nadie sepa por qué.
    const pideMateria = r.where.some((t) => {
      const sp = spec(phys, t.q)
      return sp !== undefined && sp.derived === undefined && indiceDe(phys).deSustancia.has(t.q)
    })
    if (!pideMateria) continue
    if (candidatasDeRol(r, phys).length === 0) {
      const pedido = r.where.map((t) => `${t.q} ${t.op} ${num(t.v)}`).join(' y ')
      razones.push(
        razon(
          4,
          'rol-irrealizable',
          `«${p.id}»: ninguna de las ${num(phys.substances.size)} sustancias del catálogo cumple ${pedido} para el rol «${r.name}»`,
          { proceso: p.id, rol: r.name, encontrado: 0, cota: 1 },
        ),
      )
    }
  }

  const c = p.completion
  if (c !== undefined) {
    if (!Number.isFinite(c.at) || c.at < 1 || Math.round(c.at) !== c.at) {
      razones.push(
        razon(4, 'completion-invalida', `«${p.id}» completa en ${num(c.at)} ticks: tiene que ser un entero ≥ 1`, {
          proceso: p.id,
          encontrado: c.at,
          cota: 1,
        }),
      )
    }
    if (c.yields.length === 0) {
      advertencias.push(
        razon(4, 'completion-sin-rendimientos', `«${p.id}» tiene completion sin rendimientos: al terminar no pasa nada`, {
          proceso: p.id,
        }),
      )
    }
  }
}

/** Toda cualidad que el proceso nombra, y dónde. Para el cierre dimensional. */
function cualidadesDe(p: Process): readonly { q: QualityId; donde: string }[] {
  const out: { q: QualityId; donde: string }[] = []
  for (const t of p.gate) out.push({ q: t.q, donde: 'la compuerta' })
  for (const r of p.roles) for (const t of r.where) out.push({ q: t.q, donde: `el rol «${r.name}»` })
  for (const e of p.effects) {
    out.push({ q: e.q, donde: `un ${e.k}` })
    if (e.k === 'drive' && e.poweredBy !== undefined) out.push({ q: e.poweredBy.q, donde: 'un poweredBy' })
    if (e.k === 'couple') out.push({ q: e.follows.q, donde: 'un couple' })
  }
  return out
}

/** Todo número que el proceso escribe, y dónde. Un `NaN` acá envenena todo río abajo. */
function numerosDe(p: Process): readonly { v: number; donde: string; q?: QualityId }[] {
  const out: { v: number; donde: string; q?: QualityId }[] = []
  for (const t of p.gate) out.push({ v: t.v, donde: `la compuerta sobre ${t.q}`, q: t.q })
  for (const r of p.roles)
    for (const t of r.where) out.push({ v: t.v, donde: `el rol «${r.name}» sobre ${t.q}`, q: t.q })
  for (const e of p.effects) {
    const tasa = tasaDe(e)
    if (tasa !== undefined) out.push({ v: tasa, donde: `el perTick de ${e.q}`, q: e.q })
    if (e.k === 'drive') {
      out.push({ v: e.toward, donde: `el toward de ${e.q}`, q: e.q })
      if (e.poweredBy !== undefined)
        out.push({ v: e.poweredBy.efficiency, donde: 'la eficiencia', q: e.poweredBy.q })
    }
  }
  if (p.completion !== undefined) out.push({ v: p.completion.at, donde: 'el completion.at' })
  return out
}

// ─── Regla 4 · no-dominancia ─────────────────────────────────────────────────

/**
 * Un proceso nuevo no puede ser el mismo que uno que ya existe pero más barato.
 *
 * No es una regla de higiene de biblioteca: es la última puerta del almuerzo
 * gratis. Las reglas 1 a 3 dejan pasar «frotar, pero con eficiencia 0.9» —está
 * declarado, drena de una cuenta conservada, la eficiencia es ≤ 1—, y sin
 * embargo es la misma técnica con el costo bajado a mano. La forma de mejorar la
 * eficiencia del mundo es RECALIBRAR la física (y subir `version`, que invalida
 * los sellos), no proponer un clon.
 */
function reglaNoDominancia(p: Process, phys: Physics, razones: Razon[]): void {
  const conservadas = conservedIn(phys)
  for (const viejo of phys.processes.values()) {
    if (viejo.id === p.id) continue
    if (viejo.arrangement.k !== p.arrangement.k) continue
    if (!contieneTodo(p.establishes, viejo.establishes)) continue
    if (!exigeMenosOIgual(p, viejo, phys)) continue

    let peorEnAlguna = false
    let mejorEn: { q: QualityId; nuevo: number; viejo: number } | undefined
    for (const q of conservadas) {
      const costoNuevo = -saldoDeclarado(p, q, phys)
      const costoViejo = -saldoDeclarado(viejo, q, phys)
      if (costoNuevo > costoViejo) {
        peorEnAlguna = true
        break
      }
      if (costoNuevo < costoViejo && mejorEn === undefined) {
        mejorEn = { q, nuevo: costoNuevo, viejo: costoViejo }
      }
    }
    if (peorEnAlguna || mejorEn === undefined) continue

    razones.push(
      razon(
        4,
        'dominancia',
        `«${p.id}» domina a «${viejo.id}»: promete lo mismo, no pide más, y cuesta ${num(mejorEn.nuevo)} de ${mejorEn.q} contra ${num(mejorEn.viejo)}. Abaratar una técnica es recalibrar la física, no proponer un clon`,
        { proceso: viejo.id, q: mejorEn.q, encontrado: mejorEn.nuevo, cota: mejorEn.viejo },
      ),
    )
  }
}

function contieneTodo(grande: readonly string[], chico: readonly string[]): boolean {
  if (chico.length === 0) return false // no prometer nada no es prometer lo mismo
  for (const s of chico) if (!grande.includes(s)) return false
  return true
}

/** El nuevo no le pide a sus entradas nada que el viejo no les pidiera ya. */
function exigeMenosOIgual(nuevo: Process, viejo: Process, phys: Physics): boolean {
  const nombresNuevo = nuevo.roles.map((r) => baseRoleName(r.name))
  const nombresViejo = viejo.roles.map((r) => baseRoleName(r.name))
  if (nombresNuevo.length !== nombresViejo.length) return false
  for (const n of nombresViejo) if (!nombresNuevo.includes(n)) return false

  for (const rv of viejo.roles) {
    const rn = nuevo.roles.find((r) => baseRoleName(r.name) === baseRoleName(rv.name))
    if (rn === undefined) return false
    const qs: QualityId[] = []
    for (const t of rv.where) if (!qs.includes(t.q)) qs.push(t.q)
    for (const t of rn.where) if (!qs.includes(t.q)) qs.push(t.q)
    for (const q of qs) {
      const cn = cotasDeRol(rn, q, phys)
      const cv = cotasDeRol(rv, q, phys)
      if (cn.lo > cv.lo || cn.hi < cv.hi) return false
    }
  }
  return true
}

// ─── Regla 5 · ciclos ────────────────────────────────────────────────────────
//
// EL HALLAZGO, y confirma el aviso del análisis previo: `hasProfitableCycle`
// como puerta NO es una propiedad del grafo.
//
// La demostración es corta. Después de las reglas 1 y 2, ningún proceso puede
// subir una cualidad conservada: los `drive` hacia arriba sobre conservadas
// están prohibidos, los `couple` sobre conservadas también, los `drain` solo
// bajan y los `transfer` mueven sin crear (y si el origen no respalda, la regla
// 1 los rechaza de entrada). O sea que el saldo declarado de todo proceso
// admitido es ≤ 0 en toda cuenta conservada, y la suma de cualquier ciclo
// también. Salvo por UNA cosa: `drawFromStock`, que es el agujero del dios.
//
// Entonces todo ciclo rentable, o pasa por un aporte del dios —y ahí el saldo
// depende del STOCK y de la tasa de reposición del bioma, que son estado del
// mundo y no del grafo— o no es rentable. Rechazar el primero mataría a
// `extraccion`, que es pescar, que es la única forma de comer.
//
// Lo que queda, y es lo que se implementa:
//
//   · un ciclo con aporte se ADVIERTE, con los ids, y se dice que su saldo no se
//     puede decidir acá. Es la advertencia que le corresponde a la simulación,
//     no a la puerta.
//   · un ciclo sin aporte con saldo positivo se RECHAZA. Bajo las reglas 1 y 2
//     no debería existir nunca: es un canario. Si alguna vez salta, significa
//     que la regla 1 tiene un agujero — y de hecho salta con procesos viejos que
//     entraron bajo una física anterior, que es el caso real que esto atrapa.
//
// El grafo se sobre-aproxima a propósito (ver `habilita`): más aristas, más
// ciclos, más advertencias. Para una puerta, equivocarse de más es el lado
// barato.
//
// Y la otra mitad del aviso también es cierta: los efectos son `perTick` sobre
// cantidades que dependen del estado, así que el saldo de A→B→A depende de la
// temperatura ambiente y no solo del proceso. `saldoDeclarado` lo resuelve
// tomando el trabajo MÁXIMO que cada efecto puede hacer (acotado por el objetivo
// y por la duración), lo que deja el saldo por DEBAJO de su cota superior real.
// La consecuencia hay que decirla en voz alta: la regla 5 es CORRECTA pero
// INCOMPLETA. Si rechaza, el ciclo rinde de verdad en algún estado del mundo; si
// no rechaza, puede haber estados en los que rinda igual. Detectar eso último
// pide simular, y simular no es lo que hace una puerta.

export interface Promesa {
  q: QualityId
  op: QualityTest['op']
  v: number
}

/** `'temperature>=400'` → una promesa. Lo que no parsea no promete nada. */
export function promesasDe(p: Process, phys: Physics): readonly Promesa[] {
  const out: Promesa[] = []
  for (const bruto of p.establishes) {
    for (const trozo of bruto.split('&')) {
      const s = trozo.trim()
      if (s.length === 0) continue
      const op = s.includes('>=') ? '>=' : s.includes('<=') ? '<=' : s.includes('>') ? '>' : s.includes('<') ? '<' : undefined
      if (op === undefined) continue
      const i = s.indexOf(op)
      const q = s.slice(0, i).trim() as QualityId
      const v = Number(s.slice(i + op.length).trim())
      if (!Number.isFinite(v)) continue
      if (spec(phys, q) === undefined) continue
      out.push({ q, op, v })
    }
  }
  return out
}

function promesaSatisface(pr: Promesa, t: QualityTest): boolean {
  if (pr.q !== t.q) return false
  const sube = pr.op === '>=' || pr.op === '>'
  switch (t.op) {
    case '>=':
      return sube && pr.v >= t.v
    case '>':
      return sube && (pr.op === '>' ? pr.v >= t.v : pr.v > t.v)
    case '<=':
      return !sube && pr.v <= t.v
    case '<':
      return !sube && (pr.op === '<' ? pr.v <= t.v : pr.v < t.v)
  }
}

/**
 * ¿Lo que `a` deja hecho le sirve a `b` para empezar?
 *
 * SOBRE-APROXIMACIÓN DECLARADA: alcanza con que `a` satisfaga UN test de UN rol
 * de `b`. Exigir el rol completo dejaría fuera casi todas las aristas reales
 * —`union` promete `reach>=2` y `freeStrandEnds>=1`, y lo segundo ni siquiera es
 * un `QualityId`— y un grafo sin aristas no encuentra ningún ciclo, que es la
 * peor forma de pasar la regla 5.
 */
function habilita(a: Process, b: Process, phys: Physics): boolean {
  const promesas = promesasDe(a, phys)
  if (promesas.length === 0) return false
  for (const r of b.roles) for (const t of r.where) for (const pr of promesas) if (promesaSatisface(pr, t)) return true
  return false
}

export interface Ciclo {
  /** Los ids en orden, empezando y terminando en el proceso que se está juzgando. */
  procesos: readonly ProcessId[]
  /** Los que traen materia del dios. Si hay alguno, el saldo no se decide acá. */
  aportes: readonly ProcessId[]
  /** Saldo declarado por cuenta conservada, sumado a lo largo del ciclo. */
  saldos: ReadonlyMap<QualityId, number>
}

export interface BusquedaDeCiclos {
  ciclos: readonly Ciclo[]
  /**
   * La búsqueda se cortó por presupuesto y puede haber ciclos que no vio.
   *
   * Enumerar caminos simples es exponencial en el peor caso, y el grafo crece
   * con cada proceso que la criatura aprende. Un juez que se cuelga es peor que
   * uno que avisa: se corta, y se DICE que se cortó. Eso es exactamente lo que
   * la auditoría le reclamaba a los «~5 ms» de la regla 5, que estaban afirmados
   * y no medidos.
   */
  truncada: boolean
}

/**
 * Los ciclos que PASAN POR `p`. Los demás ya existían y ya fueron juzgados
 * cuando entraron: un proceso nuevo solo puede cerrar ciclos que lo incluyan.
 */
export function ciclosPor(p: Process, phys: Physics): BusquedaDeCiclos {
  const nodos: Process[] = []
  for (const v of phys.processes.values()) if (v.id !== p.id) nodos.push(v)
  nodos.push(p)

  // Los lazos sobre sí mismo NO se excluyen: «deshilachar lo deshilachado» es un
  // ciclo de largo 1 y merece la misma cuenta que cualquier otro. Que su saldo
  // sea negativo (cuesta stamina) es un resultado, no una excepción escrita.
  const salidas = new Map<ProcessId, ProcessId[]>()
  for (const a of nodos) {
    const dest: ProcessId[] = []
    for (const b of nodos) if (habilita(a, b, phys)) dest.push(b.id)
    salidas.set(a.id, dest)
  }
  const porId = new Map<ProcessId, Process>()
  for (const n of nodos) porId.set(n.id, n)

  const conservadas = conservedIn(phys)
  const ciclos: Ciclo[] = []
  const camino: ProcessId[] = [p.id]
  const enCamino = new Set<ProcessId>([p.id])
  let pasos = 0
  let truncada = false

  const caminar = (actual: ProcessId): void => {
    for (const sig of salidas.get(actual) ?? []) {
      pasos += 1
      if (pasos > MAX_STEPS) {
        truncada = true
        return
      }
      if (sig === p.id) {
        ciclos.push(resumirCiclo(camino, porId, conservadas, phys))
        if (ciclos.length >= MAX_CYCLES) {
          truncada = true
          return
        }
        continue
      }
      if (enCamino.has(sig)) continue
      if (camino.length >= nodos.length) continue
      camino.push(sig)
      enCamino.add(sig)
      caminar(sig)
      camino.pop()
      enCamino.delete(sig)
      if (truncada) return
    }
  }
  caminar(p.id)
  return { ciclos, truncada }
}

function resumirCiclo(
  camino: readonly ProcessId[],
  porId: ReadonlyMap<ProcessId, Process>,
  conservadas: readonly QualityId[],
  phys: Physics,
): Ciclo {
  const procesos = [...camino, camino[0]!]
  const aportes: ProcessId[] = []
  const saldos = new Map<QualityId, number>()
  for (const q of conservadas) saldos.set(q, 0)
  for (const id of camino) {
    const proc = porId.get(id)
    if (proc === undefined) continue
    for (const y of proc.completion?.yields ?? []) {
      if (y.k === 'drawFromStock' && !aportes.includes(id)) aportes.push(id)
    }
    for (const q of conservadas) saldos.set(q, (saldos.get(q) ?? 0) + saldoDeclarado(proc, q, phys))
  }
  return { procesos, aportes, saldos }
}

function reglaCiclos(p: Process, phys: Physics, razones: Razon[], advertencias: Razon[]): void {
  const busqueda = ciclosPor(p, phys)
  if (busqueda.truncada) {
    advertencias.push(
      razon(
        5,
        'ciclo-busqueda-truncada',
        `la búsqueda de ciclos por «${p.id}» se cortó por presupuesto: puede haber ciclos que la puerta no vio`,
        { proceso: p.id },
      ),
    )
  }
  for (const c of busqueda.ciclos) {
    const ruta = c.procesos.join(' → ')
    if (c.aportes.length > 0) {
      advertencias.push(
        razon(
          5,
          'ciclo-con-aporte',
          `ciclo con aporte del dios: ${ruta}. El saldo depende del stock de «${c.aportes.join(', ')}» y de su reposición, que son estado del mundo: no se decide acá`,
          { proceso: c.aportes[0]! },
        ),
      )
      continue
    }
    for (const [q, saldo] of c.saldos) {
      if (saldo <= 0) continue
      razones.push(
        razon(
          5,
          'ciclo-rentable',
          `ciclo rentable sin aporte del dios: ${ruta} deja ${num(saldo)} de ${q} por vuelta, y ${q} es conservada`,
          { proceso: p.id, q, encontrado: saldo, cota: 0 },
        ),
      )
    }
  }
}

// ─── La puerta ───────────────────────────────────────────────────────────────

/**
 * ¿Entra este proceso a la física?
 *
 * Se corren las cinco reglas ENTERAS y se devuelven todas las razones juntas.
 * Un rechazo por vez obligaría a la fragua a N viajes al modelo para arreglar N
 * cosas que ya se sabían en el primero.
 */
export function admit(p: Process, phys: Physics): Verdict {
  const razones: Razon[] = []
  const advertencias: Razon[] = []

  const previo = phys.processes.get(p.id)
  if (previo !== undefined && previo !== p) {
    // Readmitir el MISMO objeto es revalidar, y eso está bien. Otro objeto con
    // el mismo id le taparía el proceso al mundo sin que nadie se entere.
    razones.push(
      razon(4, 'id-repetido', `ya existe un proceso con id «${p.id}» y no es éste`, { proceso: p.id }),
    )
  }

  reglaConservacion(p, phys, razones)
  reglaNadaSubeGratis(p, phys, razones, advertencias)
  reglaEnvolventes(p, phys, razones)
  reglaCierreYCotas(p, phys, razones, advertencias)
  reglaRealizabilidad(p, phys, razones, advertencias)
  reglaNoDominancia(p, phys, razones)
  reglaCiclos(p, phys, razones, advertencias)

  return { ok: razones.length === 0, razones, advertencias }
}

/** Atajo para los tests y para el juez: ¿alguna razón con este código? */
export function tieneCodigo(v: Verdict, c: Codigo): boolean {
  for (const r of v.razones) if (r.codigo === c) return true
  return false
}

/** Lo mismo sobre los reparos, que no cierran la puerta pero hay que poder leer. */
export function tieneReparo(v: Verdict, c: Codigo): boolean {
  for (const r of v.advertencias) if (r.codigo === c) return true
  return false
}
