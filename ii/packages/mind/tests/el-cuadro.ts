// EL CUADRO «EL HITO 5, MEDIDO» SOBREVIVIENDO AL CORTE DEL ARCHIVO
//
// ─── EL PROBLEMA, QUE ES EL ÚNICO QUE EL CORTE NO RESOLVÍA SOLO ─────────────
//
// `hito-5-el-criterio.test.ts` tenía un `Map` a nivel de módulo —`MEDIDO`— que cada
// test alimentaba con SU número y que un test final leía para imprimir el cuadro de
// los cuatro criterios. Ese cuadro se cita en cada informe del proyecto, así que no
// puede salir a medias.
//
// Y vitest **aísla el grafo de módulos por archivo**: partido el archivo, cada
// pedazo tendría su propio `Map` y vería sólo lo suyo. El cuadro saldría cinco veces
// y ninguna completo, que es exactamente la falla que este módulo existe para no
// cometer —y peor: saldría sin avisar que le falta la mitad—.
//
// ─── LA SALIDA: UN CUADERNO EN DISCO, Y UNA CITA ────────────────────────────
//
// Cada pedazo escribe lo suyo en `node_modules/.cuaderno/<slug>.json` cuando termina
// (`afterAll`), y el archivo del cuadro **espera** a que estén los cinco antes de
// imprimir. Tres cosas hacen que eso no sea frágil:
//
//   · **el directorio se borra al empezar la corrida**, en el `globalSetup` de
//     `vitest.config.ts`. Sin eso, un `.json` viejo dejaría al cuadro imprimiendo el
//     número de la corrida ANTERIOR, que es la peor falla posible acá: un número mal
//     que parece medido. Ver `el-cuadro-global.ts`;
//   · **el que espera es el archivo más barato del paquete**, así que el planificador
//     de vitest —que ordena de más lento a más rápido— lo larga último y casi no
//     espera. Y mientras espera no hace nada: es un `await`, no un bucle;
//   · **si falta alguno, el cuadro lo dice con todas las letras** y el renglón sale
//     como `—`. Un cuadro incompleto y callado sería peor que ninguno.
//
// ─── POR QUÉ NO SE HIZO DE LAS OTRAS DOS MANERAS ────────────────────────────
//
//   · **imprimirlo desde el `teardown` del `globalSetup`** —que corre después de
//     todo y no necesita esperar a nadie— deja el cuadro fuera de todo test: no
//     habría nada que se ponga rojo si el cuaderno queda vacío, y el proyecto ya se
//     comió dos veces un «exit 0» sobre un árbol roto;
//   · **ordenar los archivos para que el cuadro corra último** no existe: el
//     `sequencer` de vitest decide en qué orden se LARGAN, no en qué orden terminan.
//     Con dieciséis núcleos se largan todos juntos.

import { afterAll } from 'vitest'

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** El cuaderno vive en `node_modules/`, que ya está ignorado por git. */
export const CUADERNO = fileURLToPath(new URL('../node_modules/.cuaderno/', import.meta.url))

/**
 * LOS SEIS QUE ANOTAN, con nombre y a mano.
 *
 * Es la lista de a quién hay que esperar, y está escrita y no deducida a propósito:
 * si alguien parte otro pedazo y se olvida de anotarlo acá, el cuadro sale sin ese
 * renglón **y lo dice**. Deducirla del directorio sería deducirla de quién llegó
 * primero, que es justo lo que no se puede hacer con archivos que corren en paralelo.
 */
export const CONTRIBUYENTES = [
  '0-1-3',
  '2a-la-cadena',
  '2b-las-paredes',
  '2c-la-contraprueba',
  '2d-el-cierre',
  '4-los-ticks',
] as const

/**
 * EL CUADERNO DE UN PEDAZO. Devuelve el mismo `Map<string, string>` de antes —así
 * las treinta líneas `MEDIDO.set(...)` de los tests quedaron intactas— y le engancha
 * un `afterAll` que lo vuelca a disco cuando ese archivo termina.
 *
 * Se vuelca al final y no en cada `set` porque un `it` puede escribir dos claves y
 * porque escribir treinta veces un archivo no compra nada: el que lee espera igual.
 */
export function cuaderno(slug: string): Map<string, string> {
  const m = new Map<string, string>()
  afterAll(() => {
    mkdirSync(CUADERNO, { recursive: true })
    writeFileSync(`${CUADERNO}${slug}.json`, JSON.stringify([...m.entries()]), 'utf8')
  })
  return m
}

/** Cuánto se espera sin que llegue NADIE nuevo antes de darse por vencido. */
const SIN_NOVEDADES = 90_000
/** Y el tope duro, por si algo quedó colgado: el archivo más lento tarda 46 s. */
const TOPE = 900_000

function leer(): Map<string, string> {
  const out = new Map<string, string>()
  for (const slug of CONTRIBUYENTES) {
    const f = `${CUADERNO}${slug}.json`
    if (!existsSync(f)) continue
    for (const [k, v] of JSON.parse(readFileSync(f, 'utf8')) as [string, string][]) out.set(k, v)
  }
  return out
}

function cuantosLlegaron(): number {
  return CONTRIBUYENTES.filter((s) => existsSync(`${CUADERNO}${s}.json`)).length
}

/**
 * ESPERA A LOS CINCO Y DEVUELVE EL CUADERNO ENTERO, más la lista de los que no
 * llegaron. Se rinde si pasan 90 s sin que llegue uno nuevo —que es el caso de
 * «corrieron el archivo del cuadro solo», donde no va a llegar nadie— y avisa.
 */
export async function elCuadroCompleto(): Promise<{
  readonly medido: ReadonlyMap<string, string>
  readonly faltan: readonly string[]
}> {
  const arranque = Date.now()
  let ultimaNovedad = Date.now()
  let vistos = cuantosLlegaron()
  while (vistos < CONTRIBUYENTES.length) {
    if (Date.now() - ultimaNovedad > SIN_NOVEDADES) break
    if (Date.now() - arranque > TOPE) break
    await new Promise((listo) => setTimeout(listo, 250))
    const ahora = cuantosLlegaron()
    if (ahora > vistos) {
      vistos = ahora
      ultimaNovedad = Date.now()
    }
  }
  return {
    medido: leer(),
    faltan: CONTRIBUYENTES.filter((s) => !existsSync(`${CUADERNO}${s}.json`)),
  }
}
