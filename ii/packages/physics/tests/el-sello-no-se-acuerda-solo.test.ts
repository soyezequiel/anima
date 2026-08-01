// ─── EL GUARDIÁN DEL SELLO — Hito 7, tramo B, puntos 5 y 7 ───────────────────
//
// ─── El problema, y no es hipotético: ya pasó ───────────────────────────────
//
// `physics.ts` dice, en su encabezado, para qué existe `version`:
//
//   > una recalibración produce una `Physics` nueva con otra `version` en vez de
//   > mutar la vieja — que es lo que invalida los sellos de los procesos **sin
//   > que nadie se acuerde de invalidarlos**.
//
// La intención es correcta y el mecanismo existe: `realizaElPlano()` rechaza un
// plano sellado contra otra física, y el sello lleva la versión adentro
// (`plano.ts`, `claveDe`: `v|${version}\n...`).
//
// **Pero el sello no depende de los números: depende de un entero escrito a
// mano.** Y ese entero nunca se movió mientras la física sí:
//
//   commits que tocaron `process.ts`        4
//   commits que movieron `PHYSICS_VERSION`  1  ← el que lo creó
//   `FRICCION.efficiency`                   0.35 → 0.85, tramo N del Hito 5
//
// O sea que un `Process` sellado con eficiencia 0,35 y uno sellado con 0,85
// **tienen el mismo sello**. La frase «sin que nadie se acuerde» describe
// exactamente lo que pasó: nadie se acordó, y no había quién avisara.
//
// ─── Por qué la huella de conducta NO alcanza, medido ───────────────────────
//
// La respuesta barata habría sido «ya lo cubre `huella-de-conducta.test.ts`».
// No lo cubre, y la evidencia no es un razonamiento: es el commit `d825a69`,
// el que movió la eficiencia. Tocó **20 archivos** —4 de `physics/tests`— y
// `huella-de-conducta.test.ts` **no está entre ellos**.
//
// El motivo es estructural: esa huella corre `paso()`, y `paso()` **no lee los
// números de un proceso**. `leyes.ts` los menciona una sola vez y es para
// TRANSPORTARLOS (`conSustancia`, línea 1624). Los procesos aplicables los lee
// el mundo, no la ley.
//
// Y conviene decir la otra mitad, porque es la que sorprende: **los tests SÍ
// atraparon el cambio**. Veinte archivos con números clavados se pusieron rojos
// y hubo que arreglarlos a mano. Lo único que sobrevivió callado fue el sello,
// que es justo la cosa que se inventó para esto.
//
// ─── Qué hace este archivo ──────────────────────────────────────────────────
//
// Junta **todos los números de la física semilla** con su ruta, ordenados, y los
// compara contra un sellado guardado. Si se movió alguno, se pone rojo y **dice
// cuál**.
//
// Números y nada más. La prosa —`lexeme`, `provenance`, los comentarios— no
// entra, y es deliberado: este repo tiene encabezados enormes que cambian todo
// el tiempo, y un guardián que se pone rojo cuando alguien arregla una coma es
// un guardián que en dos semanas está desactivado.
//
// ─── Los dos rojos, que dicen cosas distintas ───────────────────────────────
//
//   la versión NO cambió  → cambiaste un número y el sello no se enteró.
//                           ES EL FALLO QUE ESTE ARCHIVO EXISTE PARA ATAJAR.
//   la versión SÍ cambió  → hiciste lo correcto. Falta re-sellar.
//
// Los dos son rojos a propósito: **toda recalibración pide un gesto humano
// deliberado**. Un guardián que se arregla solo no guarda nada.
//
// ─── Y lo que este guardián NO es ───────────────────────────────────────────
//
// No es la dependencia POR NÚMERO que el criterio del Hito 7 pide con esas
// palabras («los sellos que dependen de ÉL»). Esto invalida TODO cuando cambia
// CUALQUIER número. Un sello que sólo leyó `rigidity` muere igual porque se
// movió `heatCapacity`.
//
// Eso está decidido y anotado, no olvidado: decisión D3 de
// `ii/docs/hito-7-el-juez.md`. La dependencia por número es la salida cara y
// queda para el día que un sello sobreviviente valga lo que cuesta.

import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildSeedPhysics } from '../src/index.js'
import { PHYSICS_VERSION } from '../src/process.js'
import type { Effect, Process } from '../src/process.js'
import type { Physics } from '../src/index.js'
import { NUMEROS_SELLADOS, VERSION_SELLADA } from './el-sello-sellado.js'

/**
 * RE-SELLAR, y por qué va detrás de una variable de entorno.
 *
 * Porque el gesto tiene que ser deliberado. Un guardián que se regenera solo
 * cuando lo ve rojo es un `if (true)` con pasos intermedios: exactamente lo que
 * pasó con `PHYSICS_VERSION`, que nadie subió porque nada obligaba.
 */
const RESELLAR = process.env['ANIMA_RESELLAR'] === '1'

/**
 * Todo número de un valor, con la ruta por la que se llega.
 *
 * Las claves de un `Map` y de un objeto se recorren **ordenadas**, porque el
 * orden de inserción no es una propiedad de la física: si el sellado dependiera
 * de él, mover una sustancia de lugar en el archivo daría un rojo falso.
 *
 * Los `NaN` e `Infinity` no se saltean: si aparece uno, que se vea.
 */
export function numerosDe(v: unknown, ruta = ''): ReadonlyMap<string, number> {
  const out = new Map<string, number>()
  const meter = (r: string, x: unknown): void => {
    for (const [k, n] of numerosDe(x, r)) out.set(k, n)
  }

  if (typeof v === 'number') {
    out.set(ruta, v)
  } else if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) meter(`${ruta}[${String(i)}]`, v[i])
  } else if (v instanceof Map) {
    for (const k of [...v.keys()].map(String).sort()) meter(`${ruta}.${k}`, v.get(k))
  } else if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    for (const k of Object.keys(o).sort()) meter(ruta === '' ? k : `${ruta}.${k}`, o[k])
  }
  return out
}

/**
 * Los números de una física, en texto y en orden.
 *
 * El número va con `toPrecision(17)` y no con su forma corta: `0.1 + 0.2` y
 * `0.30000000000000004` son el mismo `String()` hasta que no lo son, y un
 * guardián que no distingue dos doubles distintos no sirve para atajar una
 * recalibración fina.
 */
export function selladoDe(phys: Physics): ReadonlyMap<string, string> {
  // Las cualidades vienen en un ARRAY y las otras dos en `Map`. Si se sellaran
  // por posición, mover una fila en `quality.ts` daría un rojo falso — el mismo
  // motivo por el que las claves de un `Map` se ordenan. Así que se indexan por
  // `id`, que es lo que de verdad las identifica.
  const porId = new Map(phys.qualities.map((q) => [q.id as string, q]))
  const crudo = numerosDe({
    qualities: porId,
    substances: phys.substances,
    processes: phys.processes,
  })
  const out = new Map<string, string>()
  for (const k of [...crudo.keys()].sort()) out.set(k, (crudo.get(k) as number).toPrecision(17))
  return out
}

/** Qué se movió entre dos sellados. Las tres clases, porque fallan distinto. */
function queCambio(
  viejo: ReadonlyMap<string, string>,
  nuevo: ReadonlyMap<string, string>,
): { movidos: string[]; nacidos: string[]; muertos: string[] } {
  const movidos: string[] = []
  const nacidos: string[] = []
  const muertos: string[] = []
  for (const [k, v] of nuevo) {
    const antes = viejo.get(k)
    if (antes === undefined) nacidos.push(k)
    else if (antes !== v) movidos.push(`${k}: ${antes} → ${v}`)
  }
  for (const k of viejo.keys()) if (!nuevo.has(k)) muertos.push(k)
  return { movidos, nacidos, muertos }
}

describe('el sello no se acuerda solo', () => {
  const hoy = selladoDe(buildSeedPhysics())

  it('LA CUENTA: cuántos números tiene la física semilla', () => {
    // No es una aserción de valor, es el tamaño del problema. Un guardián sobre
    // doce números y uno sobre novecientos son cosas distintas.
    const porFamilia = new Map<string, number>()
    for (const k of hoy.keys()) {
      const fam = k.split('.')[0] ?? '?'
      porFamilia.set(fam, (porFamilia.get(fam) ?? 0) + 1)
    }
    console.log(`\n  ── LOS NÚMEROS DE LA FÍSICA SEMILLA ──`)
    for (const f of [...porFamilia.keys()].sort()) {
      console.log(`    ${f.padEnd(12)} ${String(porFamilia.get(f)).padStart(5)}`)
    }
    console.log(`    ${'TOTAL'.padEnd(12)} ${String(hoy.size).padStart(5)}`)
    expect(hoy.size).toBeGreaterThan(0)
  })

  it('PUNTO 7 · cambiar un número sin subir PHYSICS_VERSION se pone ROJO', () => {
    if (RESELLAR) {
      const filas = [...hoy].map(([k, v]) => `  ['${k}', '${v}'],`).join('\n')
      writeFileSync(
        new URL('el-sello-sellado.ts', import.meta.url),
        [
          '// GENERADO — no se edita a mano.',
          '//',
          '// Los números de la física semilla, sellados. Lo escribe',
          '// `el-sello-no-se-acuerda-solo.test.ts` con `ANIMA_RESELLAR=1`, y el porqué de',
          '// que exista está entero en el encabezado de ese archivo.',
          '//',
          '// Re-sellar es un gesto DELIBERADO: si esto se regenerara solo, el guardián no',
          '// guardaría nada.',
          '',
          `export const VERSION_SELLADA = ${String(PHYSICS_VERSION)}`,
          '',
          'export const NUMEROS_SELLADOS: ReadonlyMap<string, string> = new Map([',
          filas,
          '])',
          '',
        ].join('\n'),
        'utf8',
      )
      console.log(`\n  RE-SELLADO: ${String(hoy.size)} números contra la física ${String(PHYSICS_VERSION)}`)
      return
    }

    const d = queCambio(NUMEROS_SELLADOS, hoy)
    const cambio = d.movidos.length + d.nacidos.length + d.muertos.length

    if (cambio > 0) {
      const cabeza =
        PHYSICS_VERSION === VERSION_SELLADA
          ? [
              `SE MOVIÓ UN NÚMERO DE LA FÍSICA Y «PHYSICS_VERSION» SIGUE EN ${String(PHYSICS_VERSION)}.`,
              '',
              'Es exactamente el fallo que este archivo existe para atajar: todo sello',
              'emitido contra la física vieja sigue pareciendo válido y no lo es.',
              '',
              'Si el cambio está bien, subí PHYSICS_VERSION en process.ts y re-sellá:',
            ]
          : [
              `PHYSICS_VERSION subió de ${String(VERSION_SELLADA)} a ${String(PHYSICS_VERSION)}. Eso está bien.`,
              '',
              'Falta re-sellar, que es el segundo gesto y también es a mano:',
            ]
      const cuerpo = [
        ...cabeza,
        '',
        '    ANIMA_RESELLAR=1 pnpm --filter @anima/physics test el-sello-no-se-acuerda-solo',
        '',
        `MOVIDOS (${String(d.movidos.length)}):`,
        ...d.movidos.slice(0, 40).map((x) => `  ${x}`),
        ...(d.movidos.length > 40 ? [`  … y ${String(d.movidos.length - 40)} más`] : []),
        ...(d.nacidos.length > 0 ? [`NACIDOS (${String(d.nacidos.length)}):`, ...d.nacidos.slice(0, 20).map((x) => `  ${x}`)] : []),
        ...(d.muertos.length > 0 ? [`MUERTOS (${String(d.muertos.length)}):`, ...d.muertos.slice(0, 20).map((x) => `  ${x}`)] : []),
      ].join('\n')
      expect.fail(`\n${cuerpo}\n`)
    }

    expect(PHYSICS_VERSION).toBe(VERSION_SELLADA)
  })

  it('EL CONTROL POSITIVO: si nadie mueve un número, esto es verde por nada', () => {
    // La lección de la medición M2, aplicada a este mismo archivo. El guardián
    // de arriba pasa hoy porque la física no cambió — o sea que no prueba NADA
    // sobre si sabría atajar un cambio. Esto lo prueba: se mueve la eficiencia
    // de `friccion` de vuelta a 0,35, que es el número real que se movió sin
    // que nadie lo notara, y el detector tiene que verlo.
    const phys = buildSeedPhysics()
    const friccion = phys.processes.get('friccion')
    expect(friccion, 'no existe el proceso `friccion`').toBeDefined()
    const f = friccion as Process

    const efectos: Effect[] = f.effects.map((e) =>
      e.k === 'drive' && e.poweredBy !== undefined
        ? { ...e, poweredBy: { ...e.poweredBy, efficiency: 0.35 } }
        : e,
    )
    const mutado: Process = { ...f, effects: efectos }
    const otra = buildSeedPhysics({
      substances: [...phys.substances.values()],
      processes: [...phys.processes.values()].map((p) => (p.id === 'friccion' ? mutado : p)),
    })

    const d = queCambio(hoy, selladoDe(otra))
    console.log(`\n  el control positivo movió ${String(d.movidos.length)} número(s):`)
    for (const m of d.movidos) console.log(`    ${m}`)

    // Uno solo, y es el que se movió de verdad en el tramo N del Hito 5.
    expect(d.movidos.length).toBe(1)
    expect(d.movidos[0]).toContain('efficiency')
    expect(d.nacidos.length + d.muertos.length).toBe(0)
  })

  it.fails('HUECO · un sello muere por números que NUNCA leyó (decisión D3)', () => {
    // El criterio del Hito 7 dice «los sellos que dependen de ÉL». Hoy no hay
    // dependencia por número: hay UN entero global, así que mover cualquiera de
    // los 591 mata todos los sellos.
    //
    // LA MEDICIÓN, y es la que dice cuánto se pierde:
    const phys = buildSeedPhysics()
    const leidas = new Set<string>()
    for (const p of phys.processes.values()) for (const r of p.roles) for (const t of r.where) leidas.add(t.q)
    console.log(
      `\n  los cuatro procesos semilla leen ${String(leidas.size)} cualidades distintas ` +
        `(${[...leidas].sort().join(', ')})`,
    )
    console.log(`  y su sello es sensible a los ${String(hoy.size)} números de la física entera`)

    // Lo que TENDRÍA que valer: mover la toxicidad del agua no puede tener nada
    // que ver con un sello de `friccion`, que sólo mira rigidez y aliento.
    //
    // Falla porque el guardián de arriba obliga a subir `PHYSICS_VERSION` ante
    // CUALQUIER cambio, y esa versión viaja adentro de todos los sellos. Es el
    // precio elegido a ojos abiertos en la decisión D3: la salida cara —cada
    // sello anotando qué números leyó— queda para el día que un sello
    // sobreviviente valga lo que cuesta.
    expect(leidas.size).toBeGreaterThanOrEqual(hoy.size)
  })

  it('el sellado no depende del ORDEN en que estén escritas — las tres familias', () => {
    // Sin esto, mover una fila de lugar daría un rojo falso, y un guardián con
    // rojos falsos se desactiva en dos semanas. Se dan vuelta las tres, y las
    // cualidades son la que importa: vienen en un ARRAY, así que eran las
    // únicas que se sellaban por posición hasta que se las indexó por `id`.
    const phys = buildSeedPhysics()
    const alReves = buildSeedPhysics({
      qualities: [...phys.qualities].reverse(),
      substances: [...phys.substances.values()].reverse(),
      processes: [...phys.processes.values()].reverse(),
    })
    expect(selladoDe(alReves)).toEqual(hoy)
  })
})
