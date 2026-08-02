// ═══ HITO 11 · punto 4 — CUÁNTOS RELOJES DE PARED QUEDAN EN LA SUITE ════════
//
// > CI determinista, benchmark real y E2E de navegador corren **aparte**.
// > Mezclarlos es cómo un banco de 500 s termina adentro de la suite compartida
// > y nadie la corre más — ya pasó dos veces en este proyecto.
//
// La tercera vez estaba en el árbol: `el-episodio.test.ts` afirmaba contra el
// reloj de pared, pasaba 6 de 6 solo y fallaba con los 13 archivos del paquete
// en paralelo.
//
// ─── LA PRIMERA VERSIÓN DE ESTE ARCHIVO CONTÓ MAL, Y HAY QUE DECIR CÓMO ─────
//
// Contaba ARCHIVOS con dos expresiones de texto: «toca el reloj» y «afirma algo
// que se llama como un tiempo». Dio 6, se congelaron esos 6, y los 6 estaban
// mal — en las DOS direcciones a la vez:
//
//   · ACUSABA DE MÁS. `perceive/tests/ataque-a-la-costura.test.ts` entró por
//     `expect(aSesenta, 'la deuda de 102 ticks 10 ms tarde…').toBe(20)`. Los
//     «ms» están en el MENSAJE, y el número sale de un reloj FALSO —`() => 60`—
//     así que es de las aserciones más deterministas del paquete. Y
//     `ataque-2-al-sellado`, que sí mide contra el reloj, ya estaba detrás de
//     `ANIMA_BANCO`: el detector sólo sabía de `CONTRA_EL_RELOJ`.
//
//   · SE PERDÍA DE MENOS. En ese mismo archivo, `expect(pared).toBeLessThan(
//     2000)` SÍ es el reloj de pared y NO lo contaba, porque la variable no se
//     llama `ms` ni `perdidos` ni `atraso`. Y no veía nada de
//     `plan/banco-las-referencias` (41 µs absolutos),
//     `world/banco-el-camino-de-intenciones` ni `world/hito-5-la-pesca`.
//
// Buscar un tiempo por el NOMBRE de la variable es adivinar. Lo que sigue no
// adivina: sigue el número desde la lectura del reloj hasta el `expect`.
//
// ─── CÓMO CUENTA AHORA ──────────────────────────────────────────────────────
//
// Tres pasos, y el orden importa:
//
//   1. **se blanquean comentarios y textos.** Un `Date.now()` adentro de una
//      cadena no es una lectura del reloj: es la carnada de `aislamiento.test.ts`
//      o la expresión que busca `la-regla-2.test.ts`. Este proyecto ya se comió
//      TRES detectores que se acusaban a sí mismos; éste es el cuarto lugar
//      donde el mismo error aparece, y por eso se blanquea en vez de filtrar por
//      nombre de archivo;
//   2. **se manchan los nombres** que llevan un número del reloj: primero los
//      asignados en una línea que lee el reloj, y de ahí SÓLO por aritmética
//      —nada de propagar a través de una llamada, que era lo que ensuciaba el
//      objeto entero: medido, 533 aserciones acusadas contra las 12 que hay—;
//   3. **se busca `expect(<manchado>)`** adentro de cada `it`, y se pregunta si
//      hay una puerta —`CONTRA_EL_RELOJ` o `MIDIENDO_EN_SERIO`— antes.
//
// ─── LO QUE ESTE DETECTOR NO VE, DICHO Y NO ESCONDIDO ───────────────────────
//
// Son dos huecos, los dos medidos y los dos con su caso real en el árbol:
//
//   · **un tiempo adentro de un objeto**: `r.msDeLaFrontera`. Los tres casos que
//     existen hoy están detrás de la puerta igual, y el día que aparezca uno
//     nuevo va a entrar porque alguien escriba el `expect`, no por acá;
//   · **un tiempo desestructurado**: `for (const [que, ns] of filas)`, que es lo
//     que hace `plan/tests/banco-las-referencias.test.ts`. Ese archivo está
//     tapado por su puerta y NO por este detector, y por eso queda afuera del
//     control de más abajo.
//
// Un detector que no dice qué no ve es un detector que da verde por omisión con
// más pasos.
//
// ─── Y LA DEUDA SE MIDE Y SE CONGELA ────────────────────────────────────────
//
// La línea base **sólo puede bajar**. No obliga a arreglar todo hoy y no deja
// que crezca mañana.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { CONTRA_EL_RELOJ } from './reloj-de-pared.js'

/**
 * LA RAÍZ DE LOS PAQUETES. Este test lee FUERA de su paquete, y es a propósito:
 * lo que mide es una propiedad del árbol entero, no de la fragua. Ponerlo en cada
 * paquete daría ocho cuentas parciales que nadie suma.
 */
const PAQUETES = new URL('../../', import.meta.url)

/** El reloj de pared, en las tres formas que el árbol usa. */
const LEE_EL_RELOJ = /process\.hrtime|\bDate\.now\s*\(|\bperformance\.now\s*\(/

/** Las dos puertas que el árbol tiene, NOMBRADAS. Ver `./reloj-de-pared.ts`. */
const NOMBRE_DE_PUERTA = /CONTRA_EL_RELOJ|MIDIENDO_EN_SERIO/

/**
 * UNA PUERTA DE VERDAD: un `if` cuya condición mira la perilla.
 *
 * No alcanza con que el nombre aparezca antes. El patrón que este árbol usa
 * imprime `NO_SE_AFIRMA` en un `console.log` con `CONTRA_EL_RELOJ ? … : …`
 * adentro, así que «el nombre aparece antes» daba por tapada a la aserción de
 * abajo aunque estuviera desnuda. Lo encontró el control sobre archivos reales:
 * a `world/tests/determinismo.test.ts` se le sacaba la puerta y el detector
 * seguía diciendo que no había nada.
 *
 * Y `process.env` está porque una de las puertas del árbol se escribe a mano
 * —`if (process.env['ANIMA_BANCO'] !== '1') return`, en `hito-5-la-pesca`— y el
 * nombre de la perilla vive adentro de una cadena, o sea que para cuando este
 * regex mira ya está blanqueada. La FORMA alcanza: un `if` sobre una variable de
 * entorno es una puerta.
 */
const PUERTA = /\bif\s*\([^\n]*(?:CONTRA_EL_RELOJ|MIDIENDO_EN_SERIO|process\.env)/

/** Blanquea conservando líneas y columnas, para que los números de línea valgan. */
function enBlanco(m: string): string {
  return m.replace(/[^\n]/g, ' ')
}

/**
 * Comentarios y textos, en blanco.
 *
 * El orden es: bloque, línea, cadenas. Un `//` adentro de una cadena se blanquea
 * antes de tiempo y no pasa nada, porque la cadena también termina en blanco.
 */
export function sinComentariosNiTextos(c: string): string {
  return (
    c
      // ─── EL `\r` PRIMERO, Y ES EL BICHO MÁS CARO DE ESTE ARCHIVO ───────────
      //
      // En JavaScript el `.` de una expresión regular NO matchea `\r`: es un
      // terminador de línea igual que `\n`. Así que sobre un archivo con fines de
      // línea de Windows, `= \s*(.*)$` no matchea NUNCA —el `$` queda del otro
      // lado del `\r`— y el detector devolvía CERO manchadas sin fallar en
      // ningún lado. Verde perfecto, mirando nada.
      //
      // Y el árbol tiene las dos clases de archivo mezcladas: los que vienen de
      // git traen CRLF y los que se escribieron después traen LF, así que el
      // detector encontraba cosas en unos y era ciego en otros. Ni siquiera daba
      // cero: daba un número plausible.
      .replace(/\r\n/g, '\n')
      .replace(/\/\*[\s\S]*?\*\//g, enBlanco)
      .replace(/\/\/[^\n]*/g, enBlanco)
      .replace(/`(?:[^`\\]|\\[\s\S])*`/g, enBlanco)
      .replace(/'(?:[^'\\\n]|\\.)*'/g, enBlanco)
      .replace(/"(?:[^"\\\n]|\\.)*"/g, enBlanco)
  )
}

/**
 * Los nombres de función que pueden aparecer en una cuenta sin cortarla.
 *
 * `now` y `bigint` están porque son la lectura del reloj misma: sin ellos,
 * `const ms = Number(process.hrtime.bigint() - t0) / 1e6` no sería una cuenta y
 * la semilla no manchaba nada.
 */
const NUMEROS = new Set(['Number', 'Math', 'parseFloat', 'parseInt', 'now', 'bigint'])

/**
 * ¿La expresión es sólo cuentas?
 *
 * `manchadas` son los CRONÓMETROS: funciones del propio archivo que devuelven un
 * número del reloj. Llamar a una de ellas no corta la cuenta —`minMs(…)` ES un
 * tiempo— y llamar a cualquier otra sí.
 */
function soloCuentas(rhs: string, manchadas: ReadonlySet<string> = new Set()): boolean {
  for (const m of sinArgumentos(rhs, manchadas).matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    const f = m[1] as string
    if (!NUMEROS.has(f) && !manchadas.has(f)) return false
  }
  return true
}

/**
 * `minMs(() => { … })` → `minMs()`.
 *
 * Lo que un cronómetro recibe no dice nada de lo que devuelve, y en este árbol
 * recibe siempre una función con el trabajo adentro. Sin vaciarle los
 * argumentos, `const porTick = minMs(() => paso()) / TICKS` dejaba de ser una
 * cuenta por culpa del `paso()` de adentro, y el tiempo no se propagaba.
 */
function sinArgumentos(rhs: string, manchadas: ReadonlySet<string>): string {
  if (manchadas.size === 0) return rhs
  let out = ''
  let i = 0
  while (i < rhs.length) {
    const m = /\b([A-Za-z_$][\w$]*)\s*\(/.exec(rhs.slice(i))
    if (m === null) {
      out += rhs.slice(i)
      break
    }
    const nom = m[1] as string
    const abre = i + (m.index ?? 0) + m[0].length
    out += rhs.slice(i, abre)
    if (!manchadas.has(nom)) {
      i = abre
      continue
    }
    let prof = 1
    let j = abre
    for (; j < rhs.length && prof > 0; j++) {
      if (rhs[j] === '(') prof++
      else if (rhs[j] === ')') prof--
    }
    i = prof === 0 ? j - 1 : rhs.length
  }
  return out
}

/**
 * LOS CRONÓMETROS DEL ARCHIVO: funciones cuyo `return` es un número del reloj.
 *
 * Sin esto el detector es casi ciego, y eso NO es una hipótesis: los bancos de
 * este árbol no leen el reloj en línea, lo envuelven —`minMs`, `mejorDe`,
 * `cronometro`, `nsPorResolucion`, `msPorTick`—. Contando sólo lecturas directas,
 * de las doce aserciones medidas el detector veía CUATRO, y las otras ocho daban
 * cero por ceguera. Un cero por ceguera es el verde por omisión con otro nombre.
 */
function cronometros(txt: string, ya: ReadonlySet<string>): ReadonlySet<string> {
  const s = new Set(ya)
  for (const m of txt.matchAll(/(?:function\s+(\w+)|(?:const|let)\s+(\w+)\s*(?::[^=\n]*)?=\s*(?:async\s+)?\([^)]*\)(?::[^=]*)?\s*=>)/g)) {
    const nom = (m[1] ?? m[2]) as string
    if (s.has(nom)) continue
    const abre = txt.indexOf('{', m.index)
    if (abre < 0) continue
    let prof = 0
    let fin = abre
    for (let i = abre; i < txt.length; i++) {
      if (txt[i] === '{') prof++
      else if (txt[i] === '}') {
        prof--
        if (prof === 0) {
          fin = i
          break
        }
      }
    }
    const cuerpo = txt.slice(abre, fin)
    // Sólo el `return`: que adentro haya un reloj no alcanza —un test entero
    // cronometra por dentro y devuelve un informe—, tiene que DEVOLVER el número.
    for (const r of cuerpo.matchAll(/return\s+([^\n;]*)/g)) {
      const dev = r[1] as string
      if (!soloCuentas(dev, s)) continue
      if (LEE_EL_RELOJ.test(dev) || [...s].some((n) => new RegExp(`\\b${n}\\b`).test(dev))) {
        s.add(nom)
        break
      }
    }
  }
  return s
}

/**
 * LOS NOMBRES QUE LLEVAN UN NÚMERO DEL RELOJ.
 *
 * Se propaga sólo por aritmética a propósito. Propagando por llamadas, un
 * `const r = correr(…)` donde `correr` cronometra por dentro manchaba a `r`
 * entero, y después `expect(r.forjados.length)` contaba como aserción de reloj.
 */
export function nombresConReloj(txt: string): ReadonlySet<string> {
  let s = new Set<string>()
  const lineas = txt.split('\n')
  // La semilla pide LAS DOS COSAS: que la línea lea el reloj y que lo leído sea
  // el VALOR. Sin la segunda, `const p = new Partida(w, { reloj: () => Date.now()
  // })` manchaba a `p` —que es una partida entera y no un número— y entonces
  // `expect(p.state.tick).toBe(…)`, que es de las cosas más deterministas que
  // hay, contaba como aserción de reloj. Un reloj INYECTADO no es un reloj leído.
  for (const l of lineas) {
    const m = /(?:const|let)\s+(\w+)\s*(?::[^=\n]*)?=\s*(.*)$/.exec(l)
    if (m === null) continue
    const rhs = m[2] as string
    if (LEE_EL_RELOJ.test(rhs) && soloCuentas(rhs)) s.add(m[1] as string)
  }
  for (let vuelta = 0; vuelta < 8; vuelta++) {
    const antes = s.size
    s = new Set(cronometros(txt, s))
    for (const l of lineas) {
      // Declaración o re-asignación: `let mejor = Infinity` seguido de
      // `mejor = ms` adentro del bucle es el cuerpo de `minMs`, y sin la segunda
      // forma ese cronómetro no se mancha nunca.
      const m = /(?:(?:const|let)\s+)?\b(\w+)\s*(?::[^=\n]*)?=(?!=|>)\s*(.*?);?$/.exec(l)
      if (m === null) continue
      const nom = m[1] as string
      const rhs = m[2] as string
      if (s.has(nom) || !soloCuentas(rhs, s)) continue
      if ([...s].some((n) => new RegExp(`\\b${n}\\b`).test(rhs))) s.add(nom)
    }
    if (s.size === antes) break
  }
  return s
}

/** El cuerpo de cada `it(…)`, con dónde arranca. */
function bloquesIt(txt: string): readonly { readonly desde: number; readonly cuerpo: string }[] {
  const out: { desde: number; cuerpo: string }[] = []
  for (const m of txt.matchAll(/\b(?:it|test)(?:\.\w+(?:\([^)]*\))?)*\s*\(/g)) {
    const abre = txt.indexOf('{', m.index)
    if (abre < 0) continue
    let prof = 0
    let fin = abre
    for (let i = abre; i < txt.length; i++) {
      if (txt[i] === '{') prof++
      else if (txt[i] === '}') {
        prof--
        if (prof === 0) {
          fin = i
          break
        }
      }
    }
    out.push({ desde: m.index, cuerpo: txt.slice(m.index, fin) })
  }
  return out
}

/** Las LÍNEAS con una aserción sobre un número del reloj que no pasa por una puerta. */
export function sinPuerta(fuente: string): readonly number[] {
  const txt = sinComentariosNiTextos(fuente)
  if (!LEE_EL_RELOJ.test(txt)) return []
  const sucias = nombresConReloj(txt)
  if (sucias.size === 0) return []
  // El `(?![.[])` es lo que separa AL NÚMERO de un objeto que se llama igual. En
  // `banco-la-vista.test.ts` el cronómetro guarda su lectura en `const a`, y ese
  // `a` de tres líneas de vida chocaba con el `const a` de un test de más abajo
  // que es un arreglo: `expect(a.length).toBe(b.length)` entraba como aserción de
  // reloj. Un tiempo se afirma entero o en una cuenta; nunca por una propiedad.
  // Y sin `(` adelante: `expect(Number.isFinite(grid)).toBe(true)` NO es una
  // aserción sobre un tiempo, es una sobre si la medición ocurrió. Lo que se
  // busca es el número solo o en una cuenta, no metido en otra función.
  const busca = new RegExp(`expect\\(\\s*[^,)(]*\\b(?:${[...sucias].join('|')})\\b(?![.[])[^,)(]*[,)]`, 'g')
  const lineas = txt.split('\n')
  const out = new Set<number>()
  for (const b of bloquesIt(txt)) {
    // Un `it.skipIf(!CONTRA_EL_RELOJ)` es una puerta que envuelve al `it` entero,
    // y ahí sí alcanza con que el nombre esté: la cabecera no imprime nada.
    const cabecera = b.cuerpo.slice(0, Math.max(b.cuerpo.indexOf('{'), 0))
    if (NOMBRE_DE_PUERTA.test(cabecera)) continue
    for (const h of b.cuerpo.matchAll(busca)) {
      const donde = h.index ?? 0
      const linea = txt.slice(0, b.desde + donde).split('\n').length
      const texto = lineas[linea - 1] ?? ''
      if (!/\.(?:toBe|toBeLess|toBeGreater|toBeClose)/.test(texto)) continue
      if (PUERTA.test(b.cuerpo.slice(0, donde)) || PUERTA.test(texto)) continue
      out.add(linea)
    }
  }
  return [...out].sort((a, b) => a - b)
}

/** Los archivos de test del árbol, con su paquete adelante. */
function todosLosTests(): readonly { readonly nombre: string; readonly texto: string }[] {
  const out: { nombre: string; texto: string }[] = []
  for (const paq of readdirSync(PAQUETES)) {
    if (paq === 'node_modules') continue
    const dir = new URL(`${paq}/tests/`, PAQUETES)
    let entradas: readonly string[]
    try {
      if (!statSync(dir).isDirectory()) continue
      entradas = readdirSync(dir)
    } catch {
      continue
    }
    for (const f of entradas) {
      if (!f.endsWith('.ts')) continue
      out.push({ nombre: `${paq}/tests/${f}`, texto: readFileSync(new URL(f, dir), 'utf8') })
    }
  }
  return out
}

/** `archivo:línea` de cada aserción de reloj sin puerta, ordenado. */
function losQueQuedan(): readonly string[] {
  return todosLosTests()
    .flatMap((a) => sinPuerta(a.texto).map((n) => `${a.nombre}:${String(n)}`))
    .sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))
}

interface LineaBase {
  readonly relojesSinPuerta: { readonly cuantos: number; readonly cuales: readonly string[] }
  readonly copiasDeLaPuerta: { readonly cuantas: number }
}

const BASE = JSON.parse(readFileSync(new URL('./linea-base.json', import.meta.url), 'utf8')) as LineaBase

describe('(Hito 11 · 4) los relojes de pared que quedan en la suite determinista', () => {
  it('EL DETECTOR MUERDE: los tres modos de falla medidos, con carnada', () => {
    // Antes de contar nada: que muerda. Este proyecto ya se comió tres
    // detectores rotos que daban verde por no encontrar nada.

    // (1) el modo que se PERDÍA: la variable no se llama como un tiempo.
    const noSeLlamaMs = [
      'it("x", () => {',
      '  const t0 = Date.now()',
      '  const pared = Date.now() - t0',
      '  expect(pared).toBeLessThan(2000)',
      '})',
    ].join('\n')
    expect(sinPuerta(noSeLlamaMs), 'un tiempo que no se llama `ms` sigue siendo un tiempo').toEqual([4])

    // (2) el modo que ACUSABA DE MÁS: un reloj FALSO, con «ms» en el mensaje.
    const relojFalso = [
      'it("x", () => {',
      '  const perdidos = conReloj(() => 60, 2000)',
      '  expect(perdidos, "la deuda de 102 ticks 10 ms tarde son 20 ventanas").toBe(20)',
      '})',
    ].join('\n')
    expect(sinPuerta(relojFalso), 'un reloj inyectado no es el reloj de pared').toEqual([])

    // (3) el modo del DETECTOR QUE SE LEE A SÍ MISMO: el reloj adentro de un texto.
    const enUnTexto = [
      'it("x", () => {',
      "  const codigo = 'export function f() { return Date.now() }'",
      '  expect(codigo.length).toBe(48)',
      '})',
    ].join('\n')
    expect(sinPuerta(enUnTexto), 'un `Date.now()` adentro de una cadena no lee ningún reloj').toEqual([])

    // (4) el reloj INYECTADO en un constructor: la línea lo nombra y no lo lee.
    const inyectado = [
      'it("x", () => {',
      '  const p = new Partida(conElla([]), { reloj: () => Date.now() })',
      '  expect(p.state.tick).toBeGreaterThan(0)',
      '})',
    ].join('\n')
    expect(sinPuerta(inyectado), 'una partida no es un número aunque le pasen un reloj').toEqual([])

    // (5) el nombre corto que choca: el cronómetro guarda en `a`, y más abajo hay
    // otro `a` que es un arreglo. Un tiempo se afirma entero, nunca por propiedad.
    const nombreChocado = [
      'function cronometro(f) {',
      '  const a = performance.now()',
      '  f()',
      '  return performance.now() - a',
      '}',
      'it("x", () => {',
      '  const a = proy.aLaVista()',
      '  const b = proy.aLaVista()',
      '  expect(a.length).toBe(b.length)',
      '})',
    ].join('\n')
    expect(sinPuerta(nombreChocado), '`a.length` no es el `a` del cronómetro').toEqual([])

    // Y las dos puertas tapan, en las tres formas que el árbol usa.
    const conPuertaAdentro = [
      'it("x", () => {',
      '  const ms = performance.now() - t0',
      '  if (CONTRA_EL_RELOJ) expect(ms).toBeLessThan(50)',
      '})',
    ].join('\n')
    expect(sinPuerta(conPuertaAdentro)).toEqual([])
    const conRetornoTemprano = [
      'it("x", () => {',
      '  const ms = performance.now() - t0',
      '  if (!MIDIENDO_EN_SERIO) return',
      '  expect(ms).toBeLessThan(50)',
      '})',
    ].join('\n')
    expect(sinPuerta(conRetornoTemprano)).toEqual([])
    const conSkipIf = [
      'it.skipIf(!CONTRA_EL_RELOJ)("x", () => {',
      '  const ms = performance.now() - t0',
      '  expect(ms).toBeLessThan(50)',
      '})',
    ].join('\n')
    expect(sinPuerta(conSkipIf)).toEqual([])

    // (6) el CRONÓMETRO: el reloj envuelto en una función, que es como lo
    // escriben todos los bancos de este árbol. Sin esto el detector veía 4 de 12.
    const conCronometro = [
      'function minMs(f) {',
      '  let mejor = Number.POSITIVE_INFINITY',
      '  for (let r = 0; r < 7; r++) {',
      '    const t0 = process.hrtime.bigint()',
      '    f()',
      '    const ms = Number(process.hrtime.bigint() - t0) / 1e6',
      '    if (ms < mejor) mejor = ms',
      '  }',
      '  return mejor',
      '}',
      'it("x", () => {',
      '  const porTick = minMs(() => paso()) / TICKS',
      '  expect(porTick).toBeLessThan(5)',
      '})',
    ].join('\n')
    expect(sinPuerta(conCronometro), 'un reloj adentro de una función sigue siendo el reloj').toEqual([13])

    // (7) LOS FINES DE LÍNEA DE WINDOWS. El mismo fragmento, con `\r\n`.
    // En JavaScript el `.` no matchea `\r`, así que sobre un archivo con CRLF el
    // detector devolvía cero manchadas sin fallar en ningún lado. Y el árbol
    // tiene las dos clases mezcladas.
    expect(sinPuerta(noSeLlamaMs.split('\n').join('\r\n')), 'un archivo con CRLF se lee igual que uno con LF').toEqual([4])

    // Y el blanqueo no se come líneas: los números de línea tienen que valer.
    const conBloque = ['/* uno', '   dos */', 'const x = 1'].join('\n')
    expect(sinComentariosNiTextos(conBloque).split('\n').length).toBe(3)
  })

  it('EL CONTROL SOBRE UN ARCHIVO DE VERDAD: sacándole la puerta, la aserción aparece', () => {
    // La carnada de arriba corre sobre fragmentos que escribí yo, y un fragmento
    // que escribe el mismo que escribe el detector se parece demasiado a lo que
    // el detector espera. Esto corre sobre un archivo del árbol, tal como está, y
    // le saca la puerta EN MEMORIA —no toca el disco—.
    // `plan/tests/banco-las-referencias.test.ts` NO está en esta lista, y hay que
    // decir por qué: su aserción gateada saca el número de un
    // `for (const [que, ns] of filas)`, y el detector no sigue desestructuraciones.
    // O sea que ese archivo está tapado por la puerta y NO por el detector. Es el
    // caso conocido del hueco que el encabezado nombra.
    const cuales = ['world/tests/determinismo.test.ts', 'skills/tests/hito-4-el-criterio.test.ts']
    for (const nombre of cuales) {
      const a = todosLosTests().find((x) => x.nombre === nombre)
      expect(a, `${nombre} no existe: este control mira el lugar equivocado`).toBeDefined()
      const texto = a?.texto ?? ''
      const conPuerta = sinPuerta(texto).length
      const desnudo = texto.replace(/if \(CONTRA_EL_RELOJ\) /g, '')
      expect(
        sinPuerta(desnudo).length,
        `${nombre}: sacándole la puerta aparecen las mismas ${String(conPuerta)} de siempre, así que ` +
          `el detector no está viendo la aserción que la puerta tapa y su verde no significa nada`,
      ).toBeGreaterThan(conPuerta)
    }
  })

  it('no crecieron: la deuda de relojes sólo puede bajar', () => {
    const quedan = losQueQuedan()
    console.log(
      `\n─── ASERCIONES DE RELOJ DE PARED SIN PUERTA ───\n` +
        `  línea base ... ${String(BASE.relojesSinPuerta.cuantos)}\n` +
        `  ahora ........ ${String(quedan.length)}\n` +
        quedan.map((f) => `    · ${f}`).join('\n') +
        `\n`,
    )

    // Que el detector esté mirando algo: si diera cero archivos de test, «no
    // creció» sería cierto sobre una lista vacía.
    expect(todosLosTests().length, 'no se leyó ni un test: el detector mira el lugar equivocado').toBeGreaterThan(50)

    expect(
      quedan.length,
      `apareció una aserción contra el reloj de pared en la suite determinista. Si es a propósito, ` +
        `pasala por la puerta de \`tests/reloj-de-pared.ts\` — y si de verdad tiene que quedar, hay que subir ` +
        `\`relojesSinPuerta\` en tests/linea-base.json A MANO y escribir por qué`,
    ).toBeLessThanOrEqual(BASE.relojesSinPuerta.cuantos)
  })

  it('y las copias de la puerta no se separaron: son el mismo par de constantes', () => {
    // `reloj-de-pared.ts` está copiado en cinco paquetes porque un test no
    // importa de otro paquete y dos constantes no justifican esa dependencia. El
    // precio de copiar es la deriva, y esto es lo que la paga: se comparan las
    // líneas `export const`, que son el contrato; los encabezados pueden diferir
    // y de hecho difieren, porque el largo vive en la fragua.
    const copias = todosLosTests()
      .filter((a) => a.nombre.endsWith('/tests/reloj-de-pared.ts'))
      .map((a) => ({
        nombre: a.nombre,
        contrato: a.texto
          .split('\n')
          .filter((l) => l.startsWith('export const'))
          .join('\n'),
      }))
    console.log(`  copias de la puerta: ${String(copias.length)} · ${copias.map((c) => c.nombre.split('/')[0] ?? '').join(', ')}`)
    expect(copias.length, 'las copias de la puerta se perdieron o cambiaron de nombre').toBe(BASE.copiasDeLaPuerta.cuantas)
    const primera = copias[0]
    expect(primera, 'no se encontró ninguna copia: el detector mira el lugar equivocado').toBeDefined()
    expect(primera?.contrato.length, 'el contrato tiene que traer las DOS constantes').toBeGreaterThan(100)
    for (const c of copias) expect(c.contrato, `${c.nombre} se separó de las demás`).toBe(primera?.contrato)
  })

  it('la puerta existe de los dos lados: apagada por omisión, encendible', () => {
    expect(CONTRA_EL_RELOJ).toBe(process.env['ANIMA_RELOJ'] === '1')
  })
})
