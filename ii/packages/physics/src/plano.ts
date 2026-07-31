// ─── EL PLANO: estructura canónica, versionada, y SIN el sitio ──────────────
//
// La primera de las cinco piezas del [ADR II-0015]. Un plano dice **qué piezas y
// cómo se atan**, en cualidades. No dice qué hace la obra —eso es el
// `ConstructionSchema`—, ni cómo se construye —`BuildSkill`—, ni para qué sirve
// —`UseSkill`—. Las cuatro son afirmaciones distintas con cuatro formas distintas
// de estar mal, y meterlas en una fila obligaría a aceptarlas o rechazarlas
// juntas.
//
// ─── POR QUÉ ESTO ESTÁ EN `@anima/physics` ──────────────────────────────────
//
// Porque **la puerta es `admit()`**, y la puerta está acá. Un candidato que
// escribió el modelo se valida exactamente como se valida una `Substance` que
// propone el oráculo: `admitX(x, phys)` devuelve un `Verdict` con razones
// citables. Acá están además las cotas del ensamble y el catálogo de cualidades
// contra el que hay que validar, y `@anima/physics` no depende de nadie, así que
// el tipo llega a todos los paquetes sin abrir una arista nueva.
//
// Y hay una razón de forma que se descubre mirando el grafo real de paquetes:
// `physics → oracle → world → skills → plan`. El `Blueprint` placeholder que esto
// reemplaza vive en `skills/src/tipos.ts`, o sea **arriba del mundo**, que es
// justamente quien lo tiene que construir.
//
// Que el tipo viva en la física no quiere decir que el modelo escriba física
// (ADR II-0001). Un candidato es DATO que la puerta juzga.
//
// ─── LO QUE UN PLANO NO PUEDE DECIR, Y ES POR CONSTRUCCIÓN ──────────────────
//
// **No puede nombrar una sustancia.** Una pieza se describe con `QualityTest`
// —cualidad, operador, número— y no hay dónde escribir «junco». Es el punto 12
// del criterio del gate resuelto por la forma del dato y no por un validador que
// alguien tenga que acordarse de correr.
//
// **No puede llevar el sitio.** El sitio es del proyecto de obra (ADR 0049 de
// Ánima I, portado). Sin sitio adentro, la misma revisión se levanta dos veces y
// dos partidas comparten el plano sin compartir mundo — que es lo que hace
// posible la herencia del Hito 10.

import { MAX_ASSEMBLY_DEPTH, MAX_JOINTS, MAX_PARTS } from './body.js'
import { specOf } from './quality.js'
import type { QualityId } from './quality.js'
import type { QualityTest } from './process.js'
import type { Physics } from './physics.js'
import type { Cita, Codigo, Razon, Verdict } from './admit.js'

// ─── La forma ───────────────────────────────────────────────────────────────

/** Una pieza del plano: un rol, y qué tiene que cumplir el cuerpo que lo llene. */
export interface BlueprintPart {
  /**
   * La etiqueta del autor. Ordena la forma canónica y es lo que las juntas
   * nombran.
   *
   * Es texto libre a propósito y ése es el borde honesto de este módulo: ver
   * «renombrar un rol da otro plano» en `normalizar`.
   */
  readonly rol: string
  /** En CUALIDADES. No hay dónde escribir una sustancia. */
  readonly pide: readonly QualityTest[]
}

/**
 * Dos piezas atadas, y con qué.
 *
 * `a` y `b` NO se distinguen: `union` los trata como el mismo rol material y lo
 * que los une es el `binder`. La forma canónica los ordena.
 *
 * Los tres son ROLES DECLARADOS del plano. Un plano cuyo binder no está
 * declarado se construye a medias y nadie se entera hasta que `union` pide un
 * cuerpo que nadie fue a buscar.
 *
 * ─── QUÉ ES UN ROL DE ATADOR, Y SE MIDIÓ ────────────────────────────────────
 *
 * `unir(a, b, binder)` **consume el binder**: la obra queda con las partes de
 * `a` y `b`, y del atador sobrevive sólo su sustancia, escrita en la junta. Está
 * medido en `tests/lo-que-cuesta-armar-un-plano.test.ts`, bloque (1).
 *
 * De ahí sale la regla que este módulo aplica y que NO hay que declarar:
 *
 *   · un rol que aparece como `a` o `b` en alguna junta es una **pieza**, queda
 *     adentro de la obra y cuenta contra `MAX_PARTS`;
 *   · un rol que aparece SÓLO como `binder` es un **atador**, se consume, y no
 *     cuenta contra `MAX_PARTS`.
 *
 * Y cuántos CUERPOS hace falta juntar de un rol de atador tampoco se declara:
 * es cuántas juntas lo nombran, porque `union` gasta uno por unión. Una obra de
 * seis piezas son once cuerpos —seis y cinco—, y eso está en la tabla que
 * imprime el bloque (2) de la misma medición.
 *
 * ─── Y EL CASO DE LA CAÑA, que es por qué esto no es un campo aparte ────────
 *
 * `unir(a, undefined, binder)` es el otro modo: ahí el atador SOBREVIVE como
 * parte, atado de un solo lado, con la punta suelta que hace la caña. En este
 * modelo eso se dice sin ningún campo nuevo: **el `binder` de la junta es uno de
 * sus propios extremos**. Si `binder === a` o `binder === b`, ese rol es pieza y
 * atador a la vez, que es exactamente lo que la caña es.
 */
export interface BlueprintJoint {
  readonly a: string
  readonly b: string
  readonly binder: string
}

/** Lo que sale de la fragua: una propuesta, sin identidad y sin confianza. */
export interface BlueprintCandidate {
  readonly parts: readonly BlueprintPart[]
  readonly joints: readonly BlueprintJoint[]
}

/** 16 dígitos hexadecimales. Es la identidad del plano Y su revisión exacta. */
export type BlueprintRevision = string & { readonly __revision: unique symbol }

/**
 * LA ESTRUCTURA CANÓNICA, inmutable y versionada.
 *
 * ─── POR QUÉ NO HAY UN `id` APARTE DE LA REVISIÓN ──────────────────────────
 *
 * Es el mismo razonamiento que el `catalogEpoch` del tramo A: la identidad sale
 * del CONTENIDO. Un `id` estable con revisiones numeradas encima pediría un
 * linaje —«la revisión 2 de X»— y el gate no tiene ninguna operación que lo use:
 * lo que necesita es comparar si dos cosas son el mismo plano, y para eso el
 * contenido alcanza y no se puede desincronizar. El día que el carril de mejora
 * del Hito 8 quiera decir «este plano deriva de aquél», eso es un campo nuevo con
 * su propio significado, no un contador retroactivo.
 *
 * ─── POR QUÉ NO HAY NOMBRE ─────────────────────────────────────────────────
 *
 * Un nombre no es parte de lo que el plano dice, y meterlo adentro obligaría a
 * elegir entre dos cosas malas: que renombrar produzca otra revisión, o que dos
 * planos iguales con nombres distintos compartan revisión y el nombre quede
 * ambiguo. Nombrar es de la vista, y la vista es derivada (ADR II-0017).
 */
export interface BlueprintDefinition {
  /** Hash canónico del contenido MÁS la versión de física. */
  readonly revision: BlueprintRevision
  /**
   * CONTRA QUÉ FÍSICA se selló, y es la mitad del punto 9 que le toca al plano.
   *
   * Un plano dice «algo con `rigidity >= 0,5`», y qué significa ese número lo
   * dice la física: si el rango de `rigidity` cambia, la misma frase promete otra
   * cosa. Va adentro del hash, así que un cambio de física **produce otra
   * revisión** — que es exactamente lo que «invalidar el sello» quiere decir.
   */
  readonly physicsVersion: number
  /** En forma canónica: ordenadas, y con sus cláusulas ordenadas. */
  readonly parts: readonly BlueprintPart[]
  /** En forma canónica: ordenadas, y con `a` y `b` ordenados adentro. */
  readonly joints: readonly BlueprintJoint[]
}

/** Lo que contesta la puerta. Un rechazo NO trae definición. */
export type Definido =
  | { readonly k: 'ok'; readonly def: BlueprintDefinition }
  | { readonly k: 'rechazado'; readonly verdict: Verdict }

// ─── La puerta ──────────────────────────────────────────────────────────────

/**
 * VALIDA Y NORMALIZA un candidato. Es la única forma de obtener una definición.
 *
 * Devuelve un rechazo con razones citables en vez de lanzar: del otro lado hay un
 * modelo, y a un modelo hay que decirle qué corregir.
 */
export function definirPlano(c: BlueprintCandidate, phys: Physics): Definido {
  const razones = revisar(c)
  if (razones.length > 0) return { k: 'rechazado', verdict: { ok: false, razones, advertencias: [] } }

  const parts = canonizarPartes(c.parts)
  const joints = canonizarJuntas(c.joints)
  return {
    k: 'ok',
    def: {
      revision: sellar(textoCanonico(parts, joints, phys.version)),
      physicsVersion: phys.version,
      parts,
      joints,
    },
  }
}

function revisar(c: BlueprintCandidate): Razones {
  const out: Mutable<Razones> = []
  const puesta = (codigo: Codigo, mensaje: string, cita: Cita = {}): void => {
    out.push({ regla: 4, codigo, mensaje, ...cita })
  }

  if (c.parts.length === 0) {
    puesta('sin-roles', 'el plano no declara ninguna pieza: no hay obra que levantar')
  }
  // La cota se le aplica a las PIEZAS y no a los roles declarados: un rol que
  // sólo ata se consume y no queda en la obra. Ver `BlueprintJoint`.
  const piezas = piezasDe(c)
  if (piezas.size > MAX_PARTS) {
    puesta(
      'partes-fuera-de-cota',
      `el plano deja ${String(piezas.size)} piezas en la obra y el ensamble admite ${String(MAX_PARTS)}`,
      { encontrado: piezas.size, cota: MAX_PARTS },
    )
  }
  if (c.joints.length > MAX_JOINTS) {
    puesta(
      'juntas-fuera-de-cota',
      `el plano declara ${String(c.joints.length)} juntas y el ensamble admite ${String(MAX_JOINTS)}`,
      { encontrado: c.joints.length, cota: MAX_JOINTS },
    )
  }

  const roles = new Set<string>()
  for (const p of c.parts) {
    if (p.rol.length === 0) puesta('sin-nombre', 'una pieza del plano no tiene rol')
    if (roles.has(p.rol)) {
      puesta('rol-repetido', `el plano declara dos piezas con el rol «${p.rol}»`, { rol: p.rol })
    }
    roles.add(p.rol)
    for (const t of p.pide) revisarClausula(t, p.rol, puesta)
  }

  // El `binder` se pide como rol igual que `a` y `b`: es una pieza más y hay que
  // ir a buscarla. Ver el porqué en `BlueprintJoint`.
  for (const j of c.joints) {
    for (const [campo, rol] of [
      ['a', j.a],
      ['b', j.b],
      ['binder', j.binder],
    ] as const) {
      if (!roles.has(rol)) {
        puesta('rol-desconocido', `la junta nombra «${rol}» en \`${campo}\` y el plano no declara esa pieza`, { rol })
      }
    }
    if (j.a === j.b) {
      puesta('junta-reflexiva', `la junta ata «${j.a}» consigo misma`, { rol: j.a })
    }
  }

  // ─── LAS TRES QUE SALIERON DE MEDIR `unir`, y ninguna estaba ──────────────
  //
  // `tests/lo-que-cuesta-armar-un-plano.test.ts` midió que cada `union` agrega
  // EXACTAMENTE una pieza y EXACTAMENTE una junta. De ahí salen las tres, y las
  // tres describen planos que se aceptaban y no se podían construir.
  if (out.length === 0 && c.parts.length > 0) {
    for (const r of rolesSinUsar(c, piezas)) {
      puesta('rol-desconocido', `el plano declara «${r}» y ninguna junta lo nombra: es una pieza suelta`, { rol: r })
    }

    // (1) Una obra de N piezas tiene N−1 juntas y ni una más ni una menos. De
    //     más sería un ciclo, que `union` no sabe armar; de menos, dos obras.
    const esperadas = piezas.size === 0 ? 0 : piezas.size - 1
    if (c.joints.length !== esperadas) {
      puesta(
        'juntas-fuera-de-cota',
        `el plano declara ${String(c.joints.length)} juntas para ${String(piezas.size)} piezas, y una obra las tiene PIEZAS − 1 = ${String(esperadas)}`,
        { encontrado: c.joints.length, cota: esperadas },
      )
    }

    // (2) Y tiene que ser UNA sola obra. Con la cuenta justa pero desconectado,
    //     lo que el plano describe son dos obras y un ciclo.
    if (c.joints.length === esperadas && !esConexo(c, piezas)) {
      puesta(
        'juntas-fuera-de-cota',
        'las juntas del plano no conectan todas las piezas: lo que describe son dos obras, no una',
        { encontrado: c.joints.length, cota: esperadas },
      )
    }

    // (3) La cota que manda no es cuántas piezas hay sino QUÉ TAN HONDA es la
    //     obra, y se toca antes de lo que uno cree: un árbol de cuatro piezas
    //     armado como dos pares ya mide 3, que es el techo exacto.
    if (c.joints.length === esperadas && esConexo(c, piezas)) {
      const d = hondura(c, piezas)
      if (d > MAX_ASSEMBLY_DEPTH) {
        puesta(
          'partes-fuera-de-cota',
          `la obra que describe el plano tiene hondura ${String(d)} y el ensamble admite ${String(MAX_ASSEMBLY_DEPTH)}`,
          { encontrado: d, cota: MAX_ASSEMBLY_DEPTH },
        )
      }
    }
  }

  return out
}

/**
 * LAS PIEZAS: los roles que quedan adentro de la obra.
 *
 * Un rol que aparece como `a` o `b` de alguna junta es pieza. Uno que aparece
 * sólo como `binder` se consume. El caso degenerado —un plano de una sola pieza
 * y ninguna junta— no tiene juntas de donde leerlo, así que la única parte
 * declarada ES la pieza.
 */
function piezasDe(c: BlueprintCandidate): ReadonlySet<string> {
  if (c.joints.length === 0) return new Set(c.parts.length === 1 ? c.parts.map((p) => p.rol) : [])
  const out = new Set<string>()
  for (const j of c.joints) {
    out.add(j.a)
    out.add(j.b)
  }
  return out
}

/**
 * Roles declarados que ninguna junta nombra. Materia que nadie va a usar.
 *
 * Sin `if (joints.length === 0) return []`, que fue como estuvo escrito y dejaba
 * pasar el caso más tonto: un plano con siete piezas y CERO juntas se aceptaba
 * como válido —cero juntas para cero piezas cierra la cuenta— y describía una
 * pila de materia suelta. Lo encontró el test de la cota de piezas al ponerse
 * verde por el motivo equivocado.
 */
function rolesSinUsar(c: BlueprintCandidate, piezas: ReadonlySet<string>): readonly string[] {
  const usados = new Set<string>(piezas)
  for (const j of c.joints) usados.add(j.binder)
  return c.parts.map((p) => p.rol).filter((r) => !usados.has(r))
}

/** Vecinos de cada pieza según las juntas. La obra es el grafo de esto. */
function vecinosDe(c: BlueprintCandidate, piezas: ReadonlySet<string>): ReadonlyMap<string, readonly string[]> {
  const m = new Map<string, string[]>()
  for (const p of piezas) m.set(p, [])
  for (const j of c.joints) {
    m.get(j.a)?.push(j.b)
    m.get(j.b)?.push(j.a)
  }
  return m
}

/** Si todas las piezas cuelgan de la misma obra. */
function esConexo(c: BlueprintCandidate, piezas: ReadonlySet<string>): boolean {
  if (piezas.size <= 1) return true
  const vecinos = vecinosDe(c, piezas)
  const arranque = [...piezas][0]
  if (arranque === undefined) return true
  return alcanzadosDesde(arranque, vecinos).size === piezas.size
}

/**
 * LA HONDURA: el camino más largo de la obra, contado en juntas.
 *
 * Es el diámetro del árbol, y se calcula con dos barridos —el clásico— porque un
 * árbol de seis nodos no justifica nada más listo y porque tiene que dar el mismo
 * número que `assemblyDepthOf` del cuerpo ya armado.
 */
function hondura(c: BlueprintCandidate, piezas: ReadonlySet<string>): number {
  if (piezas.size <= 1) return 0
  const vecinos = vecinosDe(c, piezas)
  const arranque = [...piezas].sort(comparaTexto)[0]
  if (arranque === undefined) return 0
  const lejano = elMasLejano(arranque, vecinos)
  return elMasLejano(lejano.rol, vecinos).saltos
}

function alcanzadosDesde(desde: string, vecinos: ReadonlyMap<string, readonly string[]>): ReadonlySet<string> {
  const vistos = new Set<string>([desde])
  const cola = [desde]
  while (cola.length > 0) {
    const x = cola.shift()
    if (x === undefined) break
    for (const y of vecinos.get(x) ?? []) {
      if (vistos.has(y)) continue
      vistos.add(y)
      cola.push(y)
    }
  }
  return vistos
}

/** El nodo más lejano y a cuántas juntas. El desempate es por texto: determinismo. */
function elMasLejano(
  desde: string,
  vecinos: ReadonlyMap<string, readonly string[]>,
): { readonly rol: string; readonly saltos: number } {
  const dist = new Map<string, number>([[desde, 0]])
  const cola = [desde]
  let mejor = { rol: desde, saltos: 0 }
  while (cola.length > 0) {
    const x = cola.shift()
    if (x === undefined) break
    const d = dist.get(x) ?? 0
    if (d > mejor.saltos || (d === mejor.saltos && comparaTexto(x, mejor.rol) < 0)) mejor = { rol: x, saltos: d }
    for (const y of [...(vecinos.get(x) ?? [])].sort(comparaTexto)) {
      if (dist.has(y)) continue
      dist.set(y, d + 1)
      cola.push(y)
    }
  }
  return mejor
}

function revisarClausula(t: QualityTest, rol: string, puesta: Puesta): void {
  const spec = specDe(t.q)
  if (spec === undefined) {
    puesta('cualidad-fuera-del-catalogo', `el rol «${rol}» pide «${String(t.q)}», que no es una cualidad`, {
      rol,
      q: t.q,
    })
    return
  }
  if (!Number.isFinite(t.v)) {
    puesta('numero-no-finito', `el rol «${rol}» pide «${t.q}» contra un número que no es finito`, { rol, q: t.q })
    return
  }
  const [piso, techo] = spec.range
  if (t.v < piso || t.v > techo) {
    puesta(
      'fuera-de-rango',
      `el rol «${rol}» pide «${t.q} ${t.op} ${String(t.v)}» y el rango de esa cualidad es [${String(piso)} ; ${String(techo)}]`,
      { rol, q: t.q, encontrado: t.v, cota: t.v < piso ? piso : techo },
    )
  }
}

/** `specOf` lanza para una cualidad que no existe, y acá eso es un rechazo. */
function specDe(q: QualityId): { readonly range: readonly [number, number] } | undefined {
  try {
    return specOf(q)
  } catch {
    return undefined
  }
}

// ─── La forma canónica ──────────────────────────────────────────────────────
//
// ─── LO QUE SE NORMALIZA Y LO QUE NO, Y LA LÍNEA ES DELIBERADA ──────────────
//
// Se normaliza todo lo que es ORDEN DE ESCRITURA: en qué orden se listaron las
// piezas, las juntas y las cláusulas de una pieza, y de qué lado de una junta
// quedó cada rol. Nada de eso es parte de lo que el plano dice, y sin
// normalizarlo la fragua produce gemelos que el registro guarda dos veces.
//
// **NO se normalizan los nombres de rol.** Decidir que `costilla-a` y `varilla-1`
// son el mismo plano pide isomorfismo de grafos con etiquetas, que es el problema
// caro de verdad — y es el mismo motivo por el que `MAX_PARTS` y `MAX_JOINTS`
// existen (ver el encabezado de `body.ts`: las cotas están para que el cálculo
// exacto sea trivialmente barato y no una heurística).
//
// Se elige el lado CONSERVADOR, y el precio se puede decir en una frase: un
// duplicado se puede registrar dos veces, y eso cuesta memoria. El error del otro
// lado —dos planos distintos colapsando en la misma revisión— cuesta
// correctitud, y no hay forma de notarlo después.

function canonizarPartes(ps: readonly BlueprintPart[]): readonly BlueprintPart[] {
  const out = ps.map((p) => ({ rol: p.rol, pide: [...p.pide].sort(comparaClausulas) }))
  out.sort((x, y) => comparaTexto(x.rol, y.rol))
  return out
}

function canonizarJuntas(js: readonly BlueprintJoint[]): readonly BlueprintJoint[] {
  const out = js.map((j) => (comparaTexto(j.a, j.b) <= 0 ? { ...j } : { a: j.b, b: j.a, binder: j.binder }))
  out.sort((x, y) => comparaTexto(claveDeJunta(x), claveDeJunta(y)))
  return out
}

function claveDeJunta(j: BlueprintJoint): string {
  return `${j.a} ${j.b} ${j.binder}`
}

function comparaClausulas(x: QualityTest, y: QualityTest): number {
  const a = `${x.q} ${x.op} ${numeroCanonico(x.v)}`
  const b = `${y.q} ${y.op} ${numeroCanonico(y.v)}`
  return comparaTexto(a, b)
}

/** Sin `localeCompare`: el orden no puede depender del idioma del sistema. */
function comparaTexto(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1
}

/** `-0` y `0` son el mismo número acá: ninguna cualidad distingue los dos ceros. */
function numeroCanonico(n: number): string {
  return n === 0 ? '0' : String(n)
}

function textoCanonico(
  parts: readonly BlueprintPart[],
  joints: readonly BlueprintJoint[],
  version: number,
): string {
  const p = parts
    .map((x) => `p|${x.rol}|${x.pide.map((t) => `${t.q}${t.op}${numeroCanonico(t.v)}`).join(',')}`)
    .join('\n')
  const j = joints.map((x) => `j|${claveDeJunta(x)}`).join('\n')
  return `v|${String(version)}\n${p}\n--\n${j}`
}

// ─── El sello ───────────────────────────────────────────────────────────────

const FNV_OFFSET = 0x811c9dc5 | 0
const FNV_PRIME = 0x01000193
const CARRIL_B_PRIME = 0x85ebca77

/**
 * Dos carriles de FNV-1a de 32 bits, o sea 16 hexadecimales.
 *
 * Es la cuarta copia de estas ocho líneas en el repo y el porqué está escrito en
 * la primera (`oracle/src/pregunta.ts`): un paquete «util» compartido es la clase
 * de dependencia que en tres meses tiene adentro la mitad del juego. Acá encima
 * no habría de dónde importarla: `@anima/physics` es el piso y no depende de
 * nadie.
 *
 * Dos carriles y no uno porque esto compara planos GUARDADOS contra planos vivos:
 * con 32 bits la colisión por cumpleaños aparece cerca de las 77.000 entradas, y
 * una colisión ahí no da un error, da un replay que dice «es el mismo plano» y no
 * lo es.
 */
function sellar(s: string): BlueprintRevision {
  let a = FNV_OFFSET
  let b = FNV_OFFSET
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    a = Math.imul(a ^ ((c >>> 8) & 0xff), FNV_PRIME)
    a = Math.imul(a ^ (c & 0xff), FNV_PRIME)
    b = Math.imul(b ^ ((c >>> 8) & 0xff), CARRIL_B_PRIME)
    b = Math.imul(b ^ (c & 0xff), CARRIL_B_PRIME)
  }
  const hex = (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0')
  return hex as BlueprintRevision
}

// ─── Tipos auxiliares ───────────────────────────────────────────────────────

type Mutable<T> = T extends readonly (infer U)[] ? U[] : never
type Razones = readonly Razon[]
type Puesta = (codigo: Codigo, mensaje: string, cita?: Cita) => void

// `Razon`, `Codigo` y `Cita` entran por el `import type` de arriba y NO por un
// `import()` inline, que era como estaban escritos y lo atajó un guardián.
//
// La primera versión decía `type Razon = import('./admit.js').Razon` para no
// arrastrar el módulo entero. El costo real de eso no es de tipos: el criterio
// del proveedor apagado del Hito 5 barre los `src/` de los nueve paquetes
// buscando `\bimport\s*\(` —un import DINÁMICO puede traer una URL— y tiene una
// sola excepción escrita con su forma exacta, para el único caso legítimo del
// repo. Escribir el segundo habría obligado a ensanchar esa excepción, o sea a
// aflojar el criterio de corte del proyecto por una comodidad de este archivo.
//
// `import type` se borra igual al compilar y no dispara nada. La regla que deja:
// **un tipo prestado se pide con `import type`, nunca con `import()` inline.**
