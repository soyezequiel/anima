/**
 * LA PUERTA — Hito 8, tramo B. Rechazar sin gastar una consulta.
 *
 * ─── El número que la justifica, y ya estaba medido ─────────────────────────
 *
 * El banco del Hito 0 (`skills/banco/typecheck.mjs`), re-corrido hoy:
 *
 * | | medido |
 * |---|---|
 * | typecheck con **ranura fija** | p50 **47 ms** · p95 **87 ms** |
 * | **un viaje al modelo** | **6 a 25 s** |
 *
 * **~140× más barato.** Así que toda candidata pasa por acá antes de que nadie
 * abra la boca, y la que no compila **no cuesta una consulta**: cuesta 47 ms.
 *
 * ─── LA RANURA FIJA, que es la única forma de que salga 47 ms ───────────────
 *
 * No es una optimización elegida: es la diferencia entre cumplir el presupuesto
 * y no. El mismo banco mide las tres formas de pedir lo mismo:
 *
 *   `createProgram` por candidata      +319 ms cada una (2,9×)
 *   `Program` tibio, todo el proyecto  10× más lento que la ranura
 *   **ranura fija**                    **47 ms**
 *
 * Y el porqué está escrito allá: **cambiar la lista de archivos raíz invalida la
 * reutilización de estructura de TypeScript**. La fragua no agrega archivos —
 * reemplaza el que está a prueba, siempre en el MISMO path. Lo único que cambia
 * es el contenido y el número de versión.
 *
 * Por eso esto es una clase con estado y no una función: el `LanguageService`
 * **tiene que sobrevivir entre candidatas** o no hay nada que reusar.
 *
 * ─── Qué se le pregunta, y qué no ───────────────────────────────────────────
 *
 * Sólo los diagnósticos **de la candidata**, no los del proyecto. Es lo único
 * que la fragua necesita saber —«¿esto compila?»— y pedir de más es la primera
 * fila de la tabla de arriba.
 *
 * ─── POR QUÉ LA API DE TYPESCRIPT SE RECIBE Y NO SE IMPORTA ─────────────────
 *
 * Porque el criterio del Hito 5 lo prohíbe, y el guardián lo agarró: **ningún
 * paquete de `ii/` depende en runtime de nada que no sea `ii/`**. Su comentario
 * ya había previsto este caso con estas palabras: *«`typescript` y `vitest` son
 * `devDependencies` y no entran acá»*.
 *
 * El patrón ya estaba resuelto en `@anima/skills`, que hace lo mismo para su
 * transformer de combustible: `ApiTS = typeof import('typescript')` es un import
 * de TIPO —TypeScript lo borra y no deja un byte— y el objeto real lo pone quien
 * llama. Es la misma frontera que el Hito 6 fijó para el modelo: **el paquete
 * describe, el llamador provee**.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ApiTS } from '@anima/skills'
import type TS from 'typescript'

/**
 * La superficie contra la que se compila: `skill-api.d.ts`, que **ES el prompt**.
 *
 * No es una copia ni un `.d.ts` escrito a mano: `@anima/skills` lo EMITE con
 * `tsc --declaration` desde sus fuentes. Compilar contra otra cosa mediría a la
 * candidata contra una API que el modelo nunca vio.
 */
const API = fileURLToPath(new URL('../../skills/src/skill-api.d.ts', import.meta.url))
  .split('\\')
  .join('/')

/**
 * LA RANURA. Un path que no existe en disco y nunca cambia.
 *
 * TypeScript normaliza los paths a barras, así que la ranura tiene que estar
 * escrita igual o `getValidSourceFile` no la encuentra. Está medido: escrita con
 * barras invertidas, el servicio no la ve y todo diagnóstico sale vacío — que es
 * la peor forma de fallar, porque **una puerta que no ve nada deja pasar todo**.
 */
const RANURA = fileURLToPath(new URL('../__candidata.ts', import.meta.url)).split('\\').join('/')

const OPCIONES: TS.CompilerOptions = {
  // Los enteros de los tres enums, escritos como número porque el enum vive en
  // el objeto que se recibe y esto es una constante de módulo. Van con su
  // nombre al lado para que se puedan leer, y hay un test que los compara
  // contra la API de verdad — si TypeScript los renumerara, se pone rojo.
  target: 9 satisfies TS.ScriptTarget.ES2022,
  module: 99 satisfies TS.ModuleKind.ESNext,
  moduleResolution: 100 satisfies TS.ModuleResolutionKind.Bundler,
  strict: true,
  noImplicitAny: true,
  strictNullChecks: true,
  noEmit: true,
  skipLibCheck: true,
}

/**
 * DE DÓNDE IMPORTA LA CANDIDATA, y por qué la puerta lo reescribe.
 *
 * El modelo escribe `import ... from '.../skill-api.js'` con la profundidad que
 * se le ocurra —los 28 borradores del repo usan `'../../src/skill-api.js'`
 * porque viven dos carpetas adentro— y la ranura está en otro lado.
 *
 * **La fragua controla la resolución de módulos, así que la normaliza.** No es
 * una comodidad de test: en producción la candidata sale de un modelo que no
 * sabe dónde va a caer el archivo, y hacerla adivinar la ruta sería regalarle
 * una forma de fallar que no tiene nada que ver con si la habilidad sirve.
 *
 * Lo que NO se toca es el resto del import: si pide un símbolo que la API no
 * exporta, eso es un error de verdad y tiene que salir.
 */
const IMPORT_DE_LA_API = '../skills/src/skill-api.js'
const CUALQUIER_RUTA_A_LA_API = /(['"])[^'"]*skill-api\.js\1/g

export function normalizarImports(codigo: string): string {
  return codigo.replace(CUALQUIER_RUTA_A_LA_API, `'${IMPORT_DE_LA_API}'`)
}

export interface Error {
  /** El código de TypeScript (`TS2345` sale como `2345`). Es la llave de la reparación. */
  readonly codigo: number
  readonly mensaje: string
  /** Línea 1-indexada, para citarla. `0` si el error no tiene posición. */
  readonly linea: number
  /**
   * El desplazamiento exacto, en caracteres.
   *
   * No es para el informe —para eso está `linea`— sino para la reparación:
   * es lo único con lo que se le puede preguntar al servicio **qué sería válido
   * en ese punto**. Ver `queSeriaValido`.
   */
  readonly inicio: number
}

export type Veredicto =
  | { readonly k: 'compila' }
  | { readonly k: 'no-compila'; readonly errores: readonly Error[] }

/**
 * LA PUERTA, con su `LanguageService` vivo.
 *
 * Se construye UNA vez por sesión de fragua y se le pasan todas las candidatas.
 * Construir una por candidata tira el reuso y con él los 47 ms — que es
 * exactamente lo que el banco midió como `createProgram` por candidata.
 */
export class Puerta {
  readonly #ts: ApiTS
  readonly #servicio: TS.LanguageService
  readonly #contenido = new Map<string, string>([[RANURA, '']])
  readonly #version = new Map<string, string>([
    [API, '1'],
    [RANURA, '0'],
  ])
  #n = 0

  constructor(ts: ApiTS) {
    this.#ts = ts
    const host: TS.LanguageServiceHost = {
      getScriptFileNames: () => [API, RANURA],
      getScriptVersion: (f) => this.#version.get(f) ?? '1',
      getScriptSnapshot: (f) => {
        const propio = this.#contenido.get(f)
        if (propio !== undefined) return ts.ScriptSnapshot.fromString(propio)
        return ts.sys.fileExists(f) ? ts.ScriptSnapshot.fromString(readFileSync(f, 'utf8')) : undefined
      },
      getCurrentDirectory: () => fileURLToPath(new URL('..', import.meta.url)),
      getCompilationSettings: () => OPCIONES,
      getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
      fileExists: (f) => this.#contenido.has(f) || ts.sys.fileExists(f),
      readFile: (f) => this.#contenido.get(f) ?? ts.sys.readFile(f),
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    }
    this.#servicio = ts.createLanguageService(host, ts.createDocumentRegistry())
  }

  /** Cuántas candidatas pasaron por acá. Es lo que dice si el reuso está sirviendo. */
  get revisadas(): number {
    return this.#n
  }

  /**
   * QUÉ SERÍA VÁLIDO EN ESTE PUNTO — la materia prima de la reparación.
   *
   * ─── Por qué se le pregunta al compilador y no a un catálogo propio ────────
   *
   * Porque el 86% de los errores del corpus son **«inventó un nombre que la API
   * no tiene»** (medido en `la-puerta.test.ts`), y arreglarlos pide saber cuáles
   * SÍ existen. Hay dos formas de saberlo y una está descartada por medición:
   *
   * **1. Que lo diga el mensaje de error.** No lo dice: de los 71 errores de esa
   * clase en el corpus, **cero** traen «Did you mean». Se contó.
   *
   * **2. Que lo diga el servicio.** `getCompletionsAtPosition` sabe exactamente
   * qué nombres son legales ahí, porque es lo mismo que le muestra a un editor.
   *
   * Y hay una tercera que NO se eligió: **copiar los catálogos acá**. Mantener
   * una lista de cualidades y procesos al lado de la que ya está en
   * `@anima/physics` es la clase de duplicación que queda vieja en silencio —
   * exactamente lo que el guardián del sello (Hito 7, tramo B) existe para
   * atajar. El compilador no puede quedar viejo respecto de sí mismo.
   */
  queSeriaValido(inicio: number): readonly string[] {
    const c = this.#servicio.getCompletionsAtPosition(RANURA, inicio, {})
    return (c?.entries ?? []).map((e) => e.name)
  }

  /**
   * ¿ESTO COMPILA?
   *
   * Se piden los sintácticos ANTES que los semánticos y se cortan ahí si hay:
   * con un paréntesis sin cerrar, los semánticos son ruido derivado y llenarían
   * el informe de errores que no existen. La reparación tiene que ver el de
   * verdad, no sus consecuencias.
   */
  revisar(codigo: string): Veredicto {
    this.#n += 1
    this.#contenido.set(RANURA, normalizarImports(codigo))
    this.#version.set(RANURA, String(this.#n))

    const sint = this.#servicio.getSyntacticDiagnostics(RANURA)
    if (sint.length > 0) return { k: 'no-compila', errores: sint.map((d) => aError(d, this.#ts)) }

    const sem = this.#servicio.getSemanticDiagnostics(RANURA)
    return sem.length === 0
      ? { k: 'compila' }
      : { k: 'no-compila', errores: sem.map((d) => aError(d, this.#ts)) }
  }
}

function aError(d: TS.Diagnostic, ts: ApiTS): Error {
  const linea =
    d.file !== undefined && d.start !== undefined
      ? d.file.getLineAndCharacterOfPosition(d.start).line + 1
      : 0
  return {
    codigo: d.code,
    mensaje: ts.flattenDiagnosticMessageText(d.messageText, ' '),
    linea,
    inicio: d.start ?? 0,
  }
}
