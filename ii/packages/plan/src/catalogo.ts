// ─── EL CATÁLOGO COMO VISTA: core inmutable + overlay de la sesión ──────────
//
// `ESQUEMAS` es una constante de módulo y eso alcanzó mientras el catálogo lo
// escribieron humanos. El Gate 5→6 lo rompe: cuando la criatura inventa un
// objeto, una parte del catálogo pasa a ser **de esta partida**, y una tabla
// global mutable convertiría dos partidas en la misma partida.
//
// La forma es el [ADR II-0018](../../docs/decisions/II-0018-el-catalogo-es-core-mas-overlay-por-sesion.md):
//
//     catálogo core inmutable          lo que viene con el juego
//         + biblioteca adoptada        lo promovido, que sobrevive a la partida
//           + overlay de la sesión     lo de esta partida, versionado y aislado
//
// Y la regla de la que sale todo lo de acá abajo: **no hay ningún `Map` global
// mutable**. Cada registro devuelve una VISTA NUEVA; nada de este módulo escribe
// sobre lo que le pasaron. Que la inmutabilidad sea la implementación y no una
// convención es lo que hace que el punto 7 del criterio —«dos partidas no se
// contaminan»— sea cierto por construcción y no por disciplina.
//
// ─── LO QUE ESTE MÓDULO NO DECIDE, Y HAY QUE DECIRLO ────────────────────────
//
// La pregunta 3 del gate —«¿el overlay se indexa por firma, como `SCHEMA_INDEX`,
// o por capacidad?»— **queda abierta a propósito**. Acá la vista publica LISTAS,
// que es lo que la regresión consume hoy (recorre `todos` de punta a punta y no
// toca el índice). Indexar es una optimización que pide medición, y la medición
// pide un overlay de tamaño real, que es del tramo siguiente. El día que se
// mida, cambia `esquemasDe` y nada más.
//
// Tampoco decide QUÉ es una capacidad de construcción: eso lo fija
// `BlueprintDefinition`, que todavía no existe. Lo que sí queda fijado acá es que
// **construir y usar viajan separadas** (`clase`), porque el punto 6 del criterio
// y el Hito 7 las juzgan y las promueven por separado, y una lista sola habría
// obligado a re-derivar esa distinción después.

import { ESQUEMAS } from './esquemas.js'
import type { ConstructionSchema } from './tipos.js'

// ─── Las capacidades ────────────────────────────────────────────────────────

/**
 * Una capacidad publicada al planificador por el overlay de la sesión.
 *
 * Es un `ConstructionSchema` **con procedencia**. El esquema es lo que la
 * regresión consume —si una capacidad no se pudiera reducir a una fila, el
 * planificador no podría planificar con ella— y `de` es lo que el juez y el
 * replay necesitan para saber QUÉ REVISIÓN EXACTA la respalda.
 */
export interface CatalogCapability {
  /**
   * Construir la obra, o usarla.
   *
   * Van separadas porque se juzgan por separado: **construir algo no demuestra
   * que funcione**, y un `BuildSkill` verde con `UseSkill` rojo es un resultado
   * legítimo (Gate 5→6, §2, y la suma del Hito 7).
   */
  readonly clase: 'construir' | 'usar'
  /**
   * QUÉ REVISIÓN EXACTA la respalda, en texto. Hoy es opaco a propósito: el
   * formato lo va a fijar `BlueprintDefinition` y adivinarlo acá sería escribir
   * dos veces la misma decisión.
   */
  readonly de: string
  /** La fila que la regresión consume. */
  readonly esquema: ConstructionSchema
}

/**
 * LO QUE EL PLANIFICADOR VE DEL CATÁLOGO, explícito y sin singletons.
 *
 * La forma la fija el documento de arquitectura y el gate; los nombres quedan en
 * inglés porque son los que esos documentos publican y ya viajaron.
 */
export interface PlannerCatalogView {
  /** El catálogo inmutable: lo que viene con el juego. */
  readonly coreSchemas: readonly ConstructionSchema[]
  /** Lo que se sabe CONSTRUIR. */
  readonly buildCapabilities: readonly CatalogCapability[]
  /** Lo que se sabe USAR. */
  readonly skillCapabilities: readonly CatalogCapability[]
  /**
   * La identidad del catálogo, en un entero barato de comparar por tick.
   *
   * ─── POR QUÉ NO ES UN CONTADOR ────────────────────────────────────────────
   *
   * La alternativa obvia —un entero que sube en cada registro— es más barata y
   * es insegura de una manera callada: dos sesiones que registraron una cosa
   * cada una están las dos en el epoch 1 con catálogos que no tienen nada que
   * ver, y el día que un estado guardado cruce de una a la otra la comparación
   * dice «es el mismo catálogo». Derivado del contenido ese caso no existe. Lo
   * único que se pierde es poder decir cuál de dos es más nuevo, y ninguno de
   * los doce puntos del gate lo pide.
   */
  readonly catalogEpoch: number
  /**
   * EL MANIFIESTO EXACTO DE LO REGISTRADO, canónico y estable entre reinicios.
   *
   * Es lo que comparan el punto 8 («guardar y restaurar conserva la revisión
   * exacta») y el 10 («el mismo journal produce el mismo mundo y el mismo
   * catálogo»), así que no puede depender de en qué orden se registró nada ni
   * de en qué orden quedaron las claves de un objeto.
   */
  readonly registryDigest: string
}

// ─── Construir vistas ───────────────────────────────────────────────────────

/** Una vista con este core y sin nada registrado encima. */
export function catalogoDe(core: readonly ConstructionSchema[]): PlannerCatalogView {
  return sellar([...core], [], [])
}

/**
 * LA MISMA VISTA CON ESTAS CAPACIDADES ENCIMA. Devuelve una vista NUEVA.
 *
 * No muta `base` ni le guarda una referencia a `caps`: las dos listas se copian.
 * Es la línea que hace que el punto 7 no dependa de que nadie se equivoque.
 */
export function conOverlay(
  base: PlannerCatalogView,
  caps: readonly CatalogCapability[],
): PlannerCatalogView {
  return sellar(
    base.coreSchemas,
    [...base.buildCapabilities, ...caps.filter((c) => c.clase === 'construir')],
    [...base.skillCapabilities, ...caps.filter((c) => c.clase === 'usar')],
  )
}

/**
 * TODAS LAS FILAS QUE LA REGRESIÓN PUEDE USAR, en un solo array.
 *
 * El orden es core, construir, usar, y **es una convención y no un criterio**:
 * está medido que barajar la tabla no cambia el plan (`ataque-determinismo`,
 * bloque «y con la tabla de esquemas revuelta, también»), así que lo único que
 * este orden compra es que la salida sea fácil de leer.
 */
export function esquemasDe(v: PlannerCatalogView): readonly ConstructionSchema[] {
  if (v.buildCapabilities.length === 0 && v.skillCapabilities.length === 0) return v.coreSchemas
  return [
    ...v.coreSchemas,
    ...v.buildCapabilities.map((c) => c.esquema),
    ...v.skillCapabilities.map((c) => c.esquema),
  ]
}

// ─── La identidad ───────────────────────────────────────────────────────────

interface Sello {
  readonly epoch: number
  readonly digest: string
}

/**
 * ─── EL SELLO ES PEREZOSO, y eso es lo que deja UN SOLO CAMINO ──────────────
 *
 * Serializar la tabla entera y hashearla no es gratis, y `plan()` corre por
 * tick. Si sellar fuera ansioso, envolver la escotilla de laboratorio
 * (`opciones.esquemas`) en una vista le cobraría ese precio a cada corrida del
 * banco, y la salida barata sería no envolverla — o sea, un segundo camino
 * adentro de `plan()`, que es justo lo que este gate vino a sacar.
 *
 * Con el sello perezoso no hay que elegir: la lista pelada entra por la misma
 * puerta y no paga nada hasta que alguien pregunte por su identidad. El que
 * pregunta hoy es el descarte de la frontera vencida, y sólo cuando hay una
 * frontera de por medio.
 *
 * Se calcula UNA vez por vista: la vista es inmutable —las listas se copian al
 * construirla— así que el valor no puede quedar viejo.
 */
function sellar(
  core: readonly ConstructionSchema[],
  build: readonly CatalogCapability[],
  skill: readonly CatalogCapability[],
): PlannerCatalogView {
  let sello: Sello | undefined
  const sellado = (): Sello => {
    if (sello === undefined) {
      const [a, b] = dosCarriles(manifiestoDe(core, build, skill))
      sello = { epoch: a, digest: a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0') }
    }
    return sello
  }
  return {
    coreSchemas: core,
    buildCapabilities: build,
    skillCapabilities: skill,
    get catalogEpoch(): number {
      return sellado().epoch
    },
    get registryDigest(): string {
      return sellado().digest
    },
  }
}

/**
 * EL TEXTO CANÓNICO DEL CATÁLOGO: cada fila serializada, y las filas ORDENADAS.
 *
 * Se ordena por dos motivos que se leen juntos. El primero es que el orden de la
 * tabla no cambia el plan —medido—, así que dos catálogos que planifican igual
 * tienen que tener la misma identidad; si no, un `catalogEpoch` distinto tiraría
 * fronteras perfectamente válidas y la criatura re-planificaría de gusto. El
 * segundo es que el orden en que se registra una capacidad es un accidente de en
 * qué tick se promovió, y la identidad de un catálogo no puede depender de eso.
 *
 * Las capacidades llevan su `clase` y su `de` adentro del renglón: dos catálogos
 * con las mismas filas pero una registrada como `construir` y la otra como
 * `usar` NO son el mismo catálogo, porque el juez las juzga distinto.
 */
function manifiestoDe(
  core: readonly ConstructionSchema[],
  build: readonly CatalogCapability[],
  skill: readonly CatalogCapability[],
): string {
  const renglones = [
    ...core.map((e) => `core|${canonico(e)}`),
    ...build.map((c) => `construir|${canonico(c.de)}|${canonico(c.esquema)}`),
    ...skill.map((c) => `usar|${canonico(c.de)}|${canonico(c.esquema)}`),
  ]
  renglones.sort(comparaTexto)
  return renglones.join('\n')
}

/** Sin `localeCompare`: el orden no puede depender del idioma del sistema. */
function comparaTexto(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1
}

/**
 * JSON CON LAS CLAVES ORDENADAS, recursivo.
 *
 * `JSON.stringify` pelado no sirve: conserva el orden de inserción de las claves,
 * y `roleHints` es un `Record` que se arma en el orden en que el autor escribió
 * los roles. Dos filas idénticas construidas en distinto orden darían dos
 * digests, o sea que el mismo catálogo reconstruido cambiaría de identidad al
 * reiniciar — y eso rompe el punto 8 del criterio sin que nada se ponga rojo.
 *
 * Los ARRAYS conservan su orden, que es lo correcto: `pila` es una geometría de
 * abajo hacia arriba y darla vuelta es otra situación física.
 */
function canonico(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    const claves = Object.keys(o).sort(comparaTexto)
    return `{${claves.map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(',')}}`
  }
  if (typeof v === 'number') return numeroCanonico(v)
  if (v === undefined) return 'undefined'
  return JSON.stringify(v)
}

/**
 * `Infinity` y `-0` escritos a mano.
 *
 * `Infinity` está en la tabla de verdad —hay filas cuyo `segundos` no es finito,
 * y `oportunidades.ts` las saltea por eso— y `JSON.stringify` lo convierte en
 * `null`, o sea que una fila imposible y una fila con `segundos: null` darían el
 * mismo renglón. `-0` y `0` son el mismo número para `===` y distintos para
 * `Object.is`; se normalizan al positivo porque ninguna cualidad de este catálogo
 * distingue los dos ceros.
 */
function numeroCanonico(n: number): string {
  if (n === 0) return '0'
  if (Number.isNaN(n)) return 'NaN'
  return String(n)
}

// ─── El hash ────────────────────────────────────────────────────────────────

const FNV_OFFSET = 0x811c9dc5 | 0
const FNV_PRIME = 0x01000193
const CARRIL_B_PRIME = 0x85ebca77

/**
 * Dos carriles de FNV-1a de 32 bits sobre las unidades de código UTF-16.
 *
 * ─── POR QUÉ ESTÁ ESCRITO ACÁ Y NO IMPORTADO ────────────────────────────────
 *
 * Es la TERCERA copia de estas ocho líneas en el repo, y el porqué está escrito
 * en la primera (`oracle/src/pregunta.ts`): «la alternativa —un paquete «util»
 * compartido— es la clase de dependencia que en tres meses tiene adentro la
 * mitad del juego». Importarla de `@anima/oracle` sería peor todavía: haría que
 * el planificador dependa del dios, que es una flecha que el diagrama no tiene.
 *
 * ─── POR QUÉ DOS CARRILES Y NO UNO ──────────────────────────────────────────
 *
 * Un digest de 32 bits colisiona por el cumpleaños alrededor de las 77.000
 * entradas, y esto va a comparar catálogos guardados contra catálogos vivos: una
 * colisión ahí no da un error, da un replay que dice «es el mismo catálogo» y no
 * lo es. Dos carriles independientes cuestan un `imul` más por carácter.
 *
 * `Math.imul` y no `a * b`: multiplicar dos enteros de 32 bits pasa 2⁵³ en el
 * primer byte y un double redondearía distinto según el motor.
 */
function dosCarriles(s: string): readonly [number, number] {
  let a = FNV_OFFSET
  let b = FNV_OFFSET
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    a = Math.imul(a ^ ((c >>> 8) & 0xff), FNV_PRIME)
    a = Math.imul(a ^ (c & 0xff), FNV_PRIME)
    b = Math.imul(b ^ ((c >>> 8) & 0xff), CARRIL_B_PRIME)
    b = Math.imul(b ^ (c & 0xff), CARRIL_B_PRIME)
  }
  return [a >>> 0, b >>> 0]
}

// ─── El core, sellado al cargar ─────────────────────────────────────────────

/**
 * EL CATÁLOGO QUE VIENE CON EL JUEGO.
 *
 * Se deriva de `ESQUEMAS` al cargar el módulo, y eso está bien acá y no en la
 * mente: **el core es inmutable por definición**. Lo que el Gate 5→6 desata es
 * el overlay, que es lo que cambia dentro de una partida.
 *
 * ─── POR QUÉ ESTÁ AL FINAL DEL ARCHIVO Y NO ARRIBA CON SU FAMILIA ───────────
 *
 * Porque sellar el core CORRE al cargar el módulo, y las constantes del hash son
 * `const`: puestas más abajo, la zona muerta temporal las hace explotar con
 * «Cannot access 'FNV_OFFSET' before initialization». Las funciones se izan y las
 * constantes no. Está acá y no arriba para que la trampa no vuelva sola el día
 * que alguien agregue otro derivado del catálogo.
 *
 * `catalogoDe` copia el array: si la vista compartiera el de la constante, un
 * consumidor distraído la envenenaría para todo el proceso.
 */
export const CATALOGO_CORE: PlannerCatalogView = catalogoDe(ESQUEMAS)
