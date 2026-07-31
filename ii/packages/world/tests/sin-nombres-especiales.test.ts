// ─── PUNTO 12 DEL GATE 5→6: NO HAY NOMBRES ESPECIALES ───────────────────────
//
// El criterio, escrito en `ii/docs/gate-5-6-objetos-emergentes.md`:
//
//   > **no puede existir** un `kind`, receta, skill ni caso especial llamado
//   > `fish-trap`, `trampa-para-peces` ni equivalente en producción.
//
// Es la decisión 8 de las trece de producto, y es la que hace que el caso de
// aceptación VALGA como prueba. Un `kind` con ese nombre convierte la demo en una
// tabla de recetas con otro disfraz, que es exactamente lo que el remake existe
// para matar — ver `PROTECTED_KINDS` y `vocabulary.ts` en la tabla «se tira» del
// documento de arquitectura.
//
// ─── POR QUÉ ESTO ES UN GUARDIÁN Y NO UNA PROMESA ───────────────────────────
//
// Está calcado del guardián de la emergencia del Hito 1
// (`physics/tests/emergencia.test.ts`), que sostiene la tesis gemela: si las doce
// leyes no pueden nombrar una sustancia, no puede existir una que se comporte
// distinto por ser quien es. Acá: si el motor no puede nombrar una trampa, no
// puede existir una que pesque por llamarse así.
//
// Y hoy la tesis se sostiene por una razón más fuerte que este archivo: lo que
// hace que un cuerpo retenga es **`catch > 0`**, una cualidad DERIVADA de la
// geometría. La prueba de que eso no es una frase está en
// `el-dispositivo-retiene-solo.test.ts`, donde un palo pelado sobre el mejor pozo
// del mundo no saca nada. Este guardián cuida que nadie agregue el atajo después.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PAQUETES = fileURLToPath(new URL('../../', import.meta.url))

/**
 * LAS PALABRAS PROHIBIDAS, y las variantes que un atajo tomaría de verdad.
 *
 * No alcanza con `fish-trap`: quien vaya a tomar el atajo lo va a escribir en
 * castellano, o en camello, o con guión bajo. Se normaliza todo a minúsculas sin
 * acentos y se buscan las formas, no la ortografía de una.
 */
const PROHIBIDAS: readonly string[] = [
  'fishtrap',
  'fish-trap',
  'fish_trap',
  'trampaparapeces',
  'trampa-para-peces',
  'trampa_para_peces',
  'trampadepeces',
  'trampa-de-peces',
]

/** Minúsculas y sin acentos: prohibir un nombre y admitirlo con tilde no prohíbe nada. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** El código, sin comentarios. Se juzga lo que corre, no lo que se cuenta. */
function soloCodigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

/** Todos los `.ts` de los `src/` de los nueve paquetes. Producción y nada más. */
function fuentesDeProduccion(): readonly string[] {
  const out: string[] = []
  const bajar = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`
      if (e.isDirectory()) bajar(p)
      else if (e.name.endsWith('.ts')) out.push(p)
    }
  }
  for (const paquete of readdirSync(PAQUETES, { withFileTypes: true })) {
    if (!paquete.isDirectory()) continue
    const src = `${PAQUETES}${paquete.name}/src`
    try {
      if (!statSync(src).isDirectory()) continue
    } catch {
      continue
    }
    bajar(src)
  }
  return out
}

function prohibidasEn(texto: string): readonly string[] {
  const limpio = normalizar(texto)
  return PROHIBIDAS.filter((p) => limpio.includes(p))
}

describe('punto 12 del Gate 5→6: ningún nombre especial en producción', () => {
  const FUENTES = fuentesDeProduccion()

  it(`los ${String(FUENTES.length)} fuentes de producción no nombran la trampa`, () => {
    // La cuenta va en el NOMBRE del test para que un paquete nuevo que no se
    // barra se note en la salida sin abrir el archivo.
    expect(FUENTES.length).toBeGreaterThanOrEqual(50)
    const infracciones: string[] = []
    for (const f of FUENTES) {
      const halladas = prohibidasEn(soloCodigo(readFileSync(f, 'utf8')))
      for (const h of halladas) infracciones.push(`${f.slice(PAQUETES.length)}: «${h}»`)
    }
    expect(infracciones).toEqual([])
  })

  it('y el guardián sabe encontrar lo que busca', () => {
    // Un guardián que no puede fallar no guarda nada. Se le da de comer cada
    // forma prohibida y tiene que reconocer las ocho, incluidas las que llevan
    // acento o mayúsculas.
    for (const p of PROHIBIDAS) {
      expect(prohibidasEn(`const x = '${p}'`), `no reconoció «${p}»`).toContain(p)
    }
    expect(prohibidasEn("const k = 'TRAMPA-PARA-PECES'")).toContain('trampa-para-peces')
    expect(prohibidasEn("const k = 'trámpa-para-peces'")).toContain('trampa-para-peces')
  })

  it('y NO se lo come un comentario: lo que se juzga es el código', () => {
    // La otra mitad de «sabe lo que busca». Explicar en prosa qué es una trampa
    // para peces es exactamente lo que hay que hacer —este archivo lo hace en su
    // encabezado— y no puede ser la infracción.
    expect(prohibidasEn(soloCodigo('// una fish-trap sería el atajo\nconst x = 1'))).toEqual([])
    expect(prohibidasEn(soloCodigo("/* trampa-para-peces */\nconst x = 1"))).toEqual([])
    expect(prohibidasEn(soloCodigo("const x = 'fish-trap'"))).toContain('fish-trap')
  })
})
