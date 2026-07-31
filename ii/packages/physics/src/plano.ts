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

import { MAX_ASSEMBLY_DEPTH, MAX_JOINTS, MAX_PARTS, qualityOf } from './body.js'
import type { Body, Part } from './body.js'
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
    // ─── EL ROL ES TEXTO LIBRE, Y ESTOS TRES NOMBRES NO ─────────────────────
    //
    // Un rol se usa de CLAVE en varios objetos —`roleHints`, `cuantos`, los roles
    // resueltos del marco— y `__proto__` no se comporta como una clave: asignarle
    // un objeto reemplaza el prototipo, asignarle un primitivo es un no-op
    // silencioso, y leerlo devuelve `Object.prototype`, que no es nullish y pasa
    // cualquier guarda de `?? undefined`.
    //
    // Medido con un plano igual al del test del atador compartido, cambiándole el
    // nombre del atador a `__proto__`: `cuantosCuerpos` devolvía 3 cuerpos en vez
    // de 5, `emitirObra` no disparaba su rechazo, y `plan()` daba VERDE con un paso
    // `armar` cuyo atador no estaba en `roles`. Río abajo, la habilidad recibía
    // `Object.prototype` de atador y se lo pasaba a `union`.
    //
    // Se rechaza acá y no se sanea río abajo porque acá es donde el texto libre
    // entra: cada consumidor que lo sanee por su cuenta es otro que se puede
    // olvidar. `constructor` y `prototype` van por lo mismo aunque hoy no rompan
    // nada: son las otras dos claves que un objeto trae puestas.
    if (p.rol === '__proto__' || p.rol === 'constructor' || p.rol === 'prototype') {
      puesta('sin-nombre', `«${p.rol}» no se puede usar de rol: es una clave que todo objeto ya tiene`, {
        rol: p.rol,
      })
    }
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

    // (0) SIN JUNTAS NO HAY OBRA. Un plano de UNA pieza y cero juntas cerraba
    //     todas las cuentas —piezas − 1 = 0, conexo trivialmente, hondura 0— y
    //     describía un cuerpo que ya existe.
    //
    //     El problema no es filosófico y está medido: `esquemaDeObra` le pone
    //     `segundos = juntas.length`, o sea COSTO CERO, así que esa fila le ganaba
    //     a cualquier vía que sí se pudiera ejecutar; `plan()` daba VERDE con un
    //     paso `armar` de `juntas: []`; y la habilidad lo rechaza en su primera
    //     línea, porque no hay nada que atar. Un plan que no se puede ejecutar es
    //     peor que un `gap`: el `gap` al menos dice qué falta.
    //
    //     Va acá y no arriba del portón `out.length === 0` a propósito: con las
    //     otras razones prendidas, una pila de tres piezas sueltas tiene que seguir
    //     diciendo `rol-desconocido` por cada una, que es lo que su test afirma.
    if (c.joints.length === 0) {
      puesta(
        'juntas-fuera-de-cota',
        'el plano no declara ninguna junta: describe un cuerpo que ya existe, no una obra que haya que armar',
        { encontrado: 0, cota: 1 },
      )
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

    // (4) UN ATADOR QUE ADEMÁS ES PIEZA SÓLO PUEDE SER UNA PUNTA, y esto salió de
    //     escribir el constructor y verlo fallar. Es la quinta del mismo tipo que
    //     las tres de arriba: un plano que se aceptaba y no se puede armar.
    //
    //     ─── LA DEMOSTRACIÓN, Y ES CORTA ─────────────────────────────────────
    //
    //     `unir(A, B, atador)` deja la parte 0 de A en el índice 0, o sea que la
    //     CABEZA del ensamble es la del cuerpo izquierdo. Y cuando el atador es
    //     uno de los propios extremos de la junta —el caso de la caña— la unión va
    //     sin `b`, el atador no puede ir de izquierda (`unir(x, undefined, x)` no
    //     es nada), así que **la cabeza queda en el otro extremo**.
    //
    //     Ahora supongamos que ese rol tiene una segunda junta. Para atarla tiene
    //     que ser cabeza de su ensamble, y después de su propia junta no lo es.
    //     Antes, sí lo es —está suelto— pero entonces al atar la segunda deja de
    //     ser un cuerpo aparte, y su propia junta lo necesita SUELTO para usarlo de
    //     atador. Las dos no pueden pasar, en ningún orden.
    //
    //     Medido: el plano de cuatro roles donde la aguja ata a zeta y además
    //     cuelga de tres se aceptaba acá, y el constructor fallaba con «el atador
    //     «aguja» no sirve: madera con liana no cumple lo que binder pide» — un
    //     mensaje de tres niveles más abajo que el problema.
    if (c.joints.length === esperadas && esConexo(c, piezas)) {
      const grado = new Map<string, number>()
      for (const j of c.joints) {
        grado.set(j.a, (grado.get(j.a) ?? 0) + 1)
        grado.set(j.b, (grado.get(j.b) ?? 0) + 1)
      }
      for (const j of c.joints) {
        if (j.binder !== j.a && j.binder !== j.b) continue
        const g = grado.get(j.binder) ?? 0
        if (g > 1) {
          puesta(
            'atador-que-no-es-punta',
            `«${j.binder}» ata su propia junta y ademas es pieza en ${String(g)} juntas: para atar la suya tiene que estar suelto y para las otras tiene que estar adentro de la obra, y las dos no pasan a la vez`,
            { rol: j.binder, encontrado: g, cota: 1 },
          )
        }
      }
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

/**
 * LA CLAVE DE UNA JUNTA, y el separador es un NUL A PROPÓSITO.
 *
 * Un rol es TEXTO LIBRE —está dicho en `BlueprintPart.rol`— así que puede llevar
 * espacios adentro. Con un espacio de separador, la junta «a b»+«c» y la junta
 * «a»+«b c» dan la misma clave; y como esta clave entra en `textoCanonico`, o sea
 * en la REVISIÓN, dos planos distintos compartirían sello. Es exactamente el
 * error que el encabezado de la forma canónica dice que no se puede cometer: un
 * duplicado registrado dos veces cuesta memoria, dos planos colapsando en la
 * misma revisión cuesta correctitud y no hay forma de notarlo después.
 *
 * Va escrito como escape y no como el byte crudo porque **estuvo escrito como el
 * byte crudo** —invisible en el archivo— y así se descubrió, con un barrido de
 * NULs sobre los nueve `src/`. Un separador que no se ve no se puede revisar.
 */
function claveDeJunta(j: BlueprintJoint): string {
  return `${j.a}\u0000${j.b}\u0000${j.binder}`
}

function comparaClausulas(x: QualityTest, y: QualityTest): number {
  const a = `${x.q}\u0000${x.op}\u0000${numeroCanonico(x.v)}`
  const b = `${y.q}\u0000${y.op}\u0000${numeroCanonico(y.v)}`
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

// ─── LA OBRA CONTRA EL PLANO: ¿esto que se armó ES ese plano? ───────────────
//
// Tramo F, punto F1 del criterio. Hasta acá el plano se podía definir y una obra
// se podía armar, y **nadie comparaba las dos cosas**. Sin esta función,
// «construyó» quiere decir «no explotó»: una obra con las piezas correctas mal
// atadas, o bien atada con la pieza equivocada adentro, pasaba igual.
//
// ─── POR QUÉ LA ASIGNACIÓN VIENE DE AFUERA ──────────────────────────────────
//
// Porque una obra armada **no sabe qué rol es cada parte**. `Part` guarda
// sustancia, masa y cualidades; el nombre `costilla-a` no viaja adentro del
// cuerpo y no puede viajar, porque entonces el punto 12 se caería por el otro
// lado —habría dónde escribir un nombre—. Quien armó la obra sí lo sabe, así que
// lo declara y esta puerta lo verifica. La afirmación que se juzga no es «esta
// obra es un plano» sino «esta obra es ESTE plano, con ESTA correspondencia».
//
// ─── POR QUÉ EL CUERPO «COMO ENTRÓ», Y NO LA PARTE ──────────────────────────
//
// Porque el `pide` de un rol habla de **un cuerpo**, y una parte de un ensamble
// ya no es un cuerpo. Reconstituirla como cuerpo de una sola parte da el número
// correcto para lo intensivo —`rigidity`, `flexibility`, `tensile` salen de la
// sustancia— y el número EQUIVOCADO para lo derivado de la geometría: `reach`
// pasa por `SLENDERNESS[form]` y el `form` se pierde al unir, y `freeStrandEnds`
// depende de las juntas, que la parte suelta no tiene.
//
// Así que se pide el cuerpo tal como entró. Quien construye lo tiene en la mano
// por definición, y con él la respuesta es exacta en vez de aproximada. El precio
// —hay que guardarlos— se paga una vez; el de una cualidad derivada mal medida se
// paga en un veredicto que dice que sí y no era.

/** Qué parte de la obra terminó siendo cada rol, y con qué cuerpo se llenó. */
export interface AsignacionDeRol {
  readonly rol: string
  /** El índice de parte que ocupa en la obra. */
  readonly parte: number
  /** El cuerpo tal como se eligió, ANTES de unirlo. Ahí el `pide` es exacto. */
  readonly comoEntro: Body
}

/**
 * ¿ESTA OBRA ES ESTE PLANO? Tres afirmaciones, y ninguna sobra.
 *
 * Las tres fallan distinto y por eso se miden las tres: la cuenta de piezas
 * atrapa la obra a medio armar, la topología atrapa la obra bien surtida y mal
 * atada, y el `pide` atrapa la obra bien atada con junco donde iba tendón.
 */
export function realizaElPlano(
  obra: Body,
  def: BlueprintDefinition,
  asignacion: readonly AsignacionDeRol[],
  phys: Physics,
): Verdict {
  const out: Razon[] = []
  const puesta = (codigo: Codigo, mensaje: string, cita: Cita = {}): void => {
    out.push({ regla: 4, codigo, mensaje, ...cita })
  }

  // El plano sellado contra otra física promete otra cosa: `rigidity >= 0,5` con
  // otro rango es otra frase. Es la mitad del punto 9 que le toca al plano, y acá
  // se vuelve a mirar porque una obra puede armarse mucho después de definirse.
  if (def.physicsVersion !== phys.version) {
    puesta(
      'version-de-fisica',
      `el plano esta sellado contra la fisica ${String(def.physicsVersion)} y esta es la ${String(phys.version)}`,
      { encontrado: def.physicsVersion, cota: phys.version },
    )
    return { ok: false, razones: out, advertencias: [] }
  }

  const piezas = piezasDe({ parts: def.parts, joints: def.joints })
  const parteDe = new Map<string, number>()
  const rolDe = new Map<number, string>()
  for (const a of asignacion) {
    if (!piezas.has(a.rol)) {
      puesta('obra-no-es-el-plano', `la asignacion nombra el rol «${a.rol}», que el plano no deja como pieza`, {
        rol: a.rol,
      })
      continue
    }
    if (parteDe.has(a.rol)) {
      puesta('obra-no-es-el-plano', `el rol «${a.rol}» esta asignado dos veces`, { rol: a.rol })
      continue
    }
    if (rolDe.has(a.parte)) {
      puesta('obra-no-es-el-plano', `la parte ${String(a.parte)} de la obra tiene dos roles`, { rol: a.rol })
      continue
    }
    if (a.parte < 0 || a.parte >= obra.parts.length) {
      puesta('obra-no-es-el-plano', `el rol «${a.rol}» apunta a la parte ${String(a.parte)}, que la obra no tiene`, {
        rol: a.rol,
        encontrado: a.parte,
        cota: obra.parts.length - 1,
      })
      continue
    }
    parteDe.set(a.rol, a.parte)
    rolDe.set(a.parte, a.rol)
  }

  for (const p of piezas) {
    if (!parteDe.has(p)) {
      puesta('obra-no-es-el-plano', `el plano pide la pieza «${p}» y la asignacion no dice donde quedo`, { rol: p })
    }
  }

  // (1) LA CUENTA. Una obra a medio armar tiene menos partes que piezas el plano,
  //     y una con materia de más las tiene de sobra.
  if (obra.parts.length !== piezas.size) {
    puesta(
      'obra-no-es-el-plano',
      `la obra tiene ${String(obra.parts.length)} partes y el plano declara ${String(piezas.size)} piezas`,
      { encontrado: obra.parts.length, cota: piezas.size },
    )
  }

  if (out.length > 0) return { ok: false, razones: out, advertencias: [] }

  // (2) LA TOPOLOGÍA, dicha en roles. Es lo que el tramo C·bis dejó como el
  //     hallazgo filoso: `unir` no obedece qué se ata con qué, así que el orden
  //     de las uniones puede dar una obra con las piezas justas y otra forma.
  const enLaObra = new Set(obra.joints.map((j) => claveDeArista(rolDe.get(j.a) ?? '?', rolDe.get(j.b) ?? '?')))
  const enElPlano = new Set(def.joints.map((j) => claveDeArista(j.a, j.b)))
  for (const clave of enElPlano) {
    if (!enLaObra.has(clave)) puesta('obra-no-es-el-plano', `el plano ata «${clave}» y la obra no`)
  }
  for (const clave of enLaObra) {
    if (!enElPlano.has(clave)) puesta('obra-no-es-el-plano', `la obra ata «${clave}» y el plano no lo pide`)
  }

  // (3) EL `pide` DE CADA ROL, contra el cuerpo tal como entró — y contra la
  //     parte que quedó, para que nadie declare un cuerpo que no es el que puso.
  const pideDe = new Map(def.parts.map((p) => [p.rol, p.pide]))
  for (const a of asignacion) {
    const parte = obra.parts[a.parte]
    if (parte === undefined) continue
    if (!mismaMateria(a.comoEntro, parte)) {
      puesta(
        'obra-no-es-el-plano',
        `el rol «${a.rol}» declara un cuerpo que no es el que quedo en la parte ${String(a.parte)}`,
        { rol: a.rol },
      )
      continue
    }
    for (const t of pideDe.get(a.rol) ?? []) {
      const medido = qualityOf(a.comoEntro, t.q, phys)
      if (cumple(medido, t)) continue
      puesta(
        'pieza-no-cumple',
        `el rol «${a.rol}» pide «${t.q} ${t.op} ${numeroCanonico(t.v)}» y el cuerpo que se puso mide ${numeroCanonico(medido)}`,
        { rol: a.rol, q: t.q, encontrado: medido, cota: t.v },
      )
    }
  }

  return { ok: out.length === 0, razones: out, advertencias: [] }
}

/**
 * El cuerpo que se declara y la parte que quedó son la misma materia.
 *
 * Un cuerpo de UNA parte, con la misma sustancia y la misma masa. Sin esto, la
 * asignación es una promesa: se podría declarar cualquier cuerpo que cumpla el
 * `pide` y la obra estar hecha de otra cosa, y el veredicto daría que sí.
 */
function mismaMateria(comoEntro: Body, parte: Part): boolean {
  if (comoEntro.parts.length !== 1) return false
  const p = comoEntro.parts[0]
  return p !== undefined && p.substance === parte.substance && p.mass === parte.mass
}

function cumple(medido: number, t: QualityTest): boolean {
  switch (t.op) {
    case '>=':
      return medido >= t.v
    case '<=':
      return medido <= t.v
    case '>':
      return medido > t.v
    case '<':
      return medido < t.v
  }
}

/** La arista sin lado: una junta no distingue `a` de `b`. Ver `BlueprintJoint`. */
function claveDeArista(a: string, b: string): string {
  return comparaTexto(a, b) <= 0 ? `${a} ${b}` : `${b} ${a}`
}

// ─── EL SELLO DE UNA HABILIDAD: construir y usar se juzgan por separado ─────
//
// Punto 6 del criterio del gate, y punto F3 del tramo F. La frase del §2 que esto
// convierte en dato:
//
//   > **La definición, la construcción y el uso se juzgan y se promueven por
//   > separado.** Un plano correcto con un `BuildSkill` roto no promueve la
//   > construcción; un `BuildSkill` que levanta la obra no acredita que la obra
//   > sirva. **Construir algo no demuestra que funcione.**
//
// De ahí sale que `clase` esté ADENTRO del sello y no al lado: dos sellos con la
// misma revisión y distinta clase son dos afirmaciones distintas, y la que vale
// para una no vale para la otra.
//
// ─── Y LA OTRA MITAD DEL PUNTO 9 ────────────────────────────────────────────
//
// Un sello lleva `physicsVersion` y `selloVigente` lo rechaza contra otra física
// con **el mismo código que `admit()` ya usa** (`version-de-fisica`). Un código
// nuevo sería una segunda verdad sobre lo mismo, y el día que alguien filtre por
// uno se le escaparía el otro.
//
// Hay una segunda muerte, y es la que hace que esto no dependa de acordarse: la
// REVISIÓN del plano lleva la versión de física adentro del hash, así que al subir
// la versión el mismo plano se define con otra revisión y el sello viejo apunta a
// un plano que ya no existe. Las dos mitades se miden por separado.

export type ClaseDeSello = 'construir' | 'usar'

/** Que se demostró, sobre qué plano exacto, y contra qué física. */
export interface SelloDeHabilidad {
  readonly clase: ClaseDeSello
  readonly revision: BlueprintRevision
  readonly physicsVersion: number
  /**
   * EL HASH DE LA CORRIDA QUE LO DEMOSTRÓ. Opaco acá a propósito: quién lo
   * calcula es el juez, y el juez vive arriba —necesita un mundo, y este paquete
   * es el piso—. Lo que la física fija es que el sello NO VALE SIN ÉL: un sello
   * sin corrida detrás es una promesa autodeclarada, que es exactamente lo que la
   * regla de `confianza-autodeclarada` de `admit()` no deja pasar en un proceso.
   */
  readonly traza: string
}

export type Sellado =
  | { readonly k: 'ok'; readonly sello: SelloDeHabilidad }
  | { readonly k: 'rechazado'; readonly verdict: Verdict }

/**
 * SELLA UNA HABILIDAD contra un plano y una física. La única forma de tener uno.
 *
 * Rechaza en vez de lanzar, por lo mismo que `definirPlano`: del otro lado hay un
 * modelo y a un modelo hay que decirle qué corregir.
 */
export function sellarHabilidad(
  clase: ClaseDeSello,
  def: BlueprintDefinition,
  traza: string,
  phys: Physics,
): Sellado {
  const razones: Razon[] = []
  if (def.physicsVersion !== phys.version) {
    razones.push({
      regla: 4,
      codigo: 'version-de-fisica',
      mensaje: `el plano esta sellado contra la fisica ${String(def.physicsVersion)} y esta es la ${String(phys.version)}`,
      encontrado: def.physicsVersion,
      cota: phys.version,
    })
  }
  if (traza.length === 0) {
    razones.push({
      regla: 4,
      codigo: 'confianza-autodeclarada',
      mensaje: 'no se puede sellar una habilidad sin la traza de la corrida que la demostro',
    })
  }
  if (razones.length > 0) return { k: 'rechazado', verdict: { ok: false, razones, advertencias: [] } }
  return { k: 'ok', sello: { clase, revision: def.revision, physicsVersion: phys.version, traza } }
}

/** ¿Este sello sigue valiendo contra esta física? */
export function selloVigente(s: SelloDeHabilidad, phys: Physics): Verdict {
  if (s.physicsVersion === phys.version) return { ok: true, razones: [], advertencias: [] }
  return {
    ok: false,
    razones: [
      {
        regla: 4,
        codigo: 'version-de-fisica',
        mensaje: `el sello de ${s.clase} esta contra la fisica ${String(s.physicsVersion)} y esta es la ${String(phys.version)}`,
        encontrado: s.physicsVersion,
        cota: phys.version,
      },
    ],
    advertencias: [],
  }
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
