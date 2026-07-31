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

// ─── EL OTRO GUARDIÁN, QUE VIAJA EN EL MISMO BARRIDO ────────────────────────
//
// No es del punto 12 y está acá por una razón sola: `fuentesDeProduccion()` ya
// enumera los nueve `src/`, y duplicar veinte líneas de recorrido para tener dos
// barridos que pueden divergir es peor que compartir el archivo.
//
// ─── EL BUG QUE LO PIDIÓ, MEDIDO ────────────────────────────────────────────
//
// `physics/src/plano.ts` tenía SEIS bytes NUL crudos adentro de tres template
// literals. Eran los separadores de `claveDeJunta` y de `comparaClausulas`, o sea
// que uno de ellos entra en `textoCanonico`, o sea en la REVISIÓN de todo plano.
//
// Lo que hace caro a este modo de falla no es que estuviera mal —un NUL de
// separador es *más* correcto que un espacio, porque un rol es texto libre y
// puede tener espacios— sino que **era invisible**. El archivo se lee como si
// dijera espacio, `tsc` no dice nada, los tests dan verde, y `grep` contesta
// «Binary file matches» en vez de la línea. Un separador que no se ve no se puede
// revisar, y de ese hash cuelga la identidad de cada plano que la fragua produzca.
//
// La regla que deja: **un carácter de control en una fuente va escrito como
// escape**. Este guardián la hace cumplir.

/** Los de control menos los tres que un archivo de texto usa: tab, LF y CR. */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

describe('ningún carácter de control crudo en las fuentes de producción', () => {
  const FUENTES = fuentesDeProduccion()

  it('los nueve `src/` no tienen bytes invisibles adentro del código', () => {
    const infracciones: string[] = []
    for (const f of FUENTES) {
      const texto = readFileSync(f, 'utf8')
      const halladas = texto.match(CONTROL)
      if (halladas === null) continue
      // La línea, para que el mensaje sirva: un archivo entero no se busca a ojo.
      const linea = texto.slice(0, texto.search(CONTROL)).split('\n').length
      const codigos = [...new Set(halladas.map((c) => `U+${c.charCodeAt(0).toString(16).padStart(4, '0')}`))]
      infracciones.push(`${f.slice(PAQUETES.length)}:${String(linea)} — ${String(halladas.length)} × ${codigos.join(' ')}`)
    }
    expect(infracciones).toEqual([])
  })

  it('y sabe encontrar lo que busca: un NUL adentro de un literal se ve', () => {
    // El control. Sin esto, el bloque de arriba pasaría igual si el regex
    // estuviera mal escrito — que es como el NUL sobrevivió en primer lugar.
    expect('const s = `${a}\u0000${b}`'.match(CONTROL)).toHaveLength(1)
    // Y no se come lo legítimo: tab, salto de línea y retorno de carro.
    expect('const s = 1\n\tconst t = 2\r\n'.match(CONTROL)).toBeNull()
    // El escape ESCRITO es texto normal y no infringe nada: es la forma correcta.
    expect('const s = `${a}\\u0000${b}`'.match(CONTROL)).toBeNull()
  })
})

// --- LA SEGUNDA CLASE DE BYTE INVISIBLE, y la encontro el Hito 6 -----------
//
// El guardian de arriba barre los caracteres de CONTROL, que es la clase que
// costo `plano.ts`. Escribiendo `@anima/lang` aparecio otra que ese barrido no
// ve y que es igual de mala: una **marca combinante suelta**.
//
// El caso, tal cual paso. La regex que le saca los acentos a una palabra es
// `/[\u0300-\u036f]/g`, y escrita con los caracteres de verdad en vez de con los
// escapes se dibuja asi:
//
//     const MARCAS = /[̀-ͯ]/g
//
// Una marca combinante no ocupa lugar propio: se pinta **encima del caracter
// anterior**. Asi que el `U+0300` se dibuja sobre el corchete, el `U+036F` sobre
// el guion, y la clase de caracteres se lee `[-]` -- una regex que engancha
// guiones y nada mas. `tsc` la acepta, los tests de esa funcion dan verde
// mientras nadie le pase un acento, y a ojo el archivo esta bien.
//
// Es peor que el NUL en un sentido: el NUL al menos hace que `grep` conteste
// «Binary file matches» y avise de que algo raro hay. Este no avisa nada.
//
// --- Como se distingue de una enie legitima --------------------------------
//
// Un comentario de este repo esta lleno de acentos y de enies, y ninguno es un
// problema: en `rio` la marca viene **despues de una letra**, y ahi se dibuja
// donde tiene que dibujarse. Lo que no puede pasar es una marca detras de algo
// que no es letra -- un corchete, un guion, una comilla, un espacio -- porque
// eso es exactamente una marca que se monto sobre puntuacion.
//
// Esa es la regla que hace cumplir el bloque de abajo, y es barata: mira el
// caracter de antes y nada mas.

/** Una marca combinante que NO viene detras de una letra: se monto en cualquier cosa. */
const MARCA_SUELTA = /(^|[^\p{L}])[\u0300-\u036f]/u

describe('ninguna marca combinante montada sobre puntuacion', () => {
  const FUENTES = fuentesDeProduccion()

  it('los `src/` de los paquetes no tienen acentos pegados a un corchete', () => {
    const infracciones: string[] = []
    for (const f of FUENTES) {
      const texto = readFileSync(f, 'utf8')
      const donde = texto.search(MARCA_SUELTA)
      if (donde < 0) continue
      const linea = texto.slice(0, donde).split('\n').length
      infracciones.push(`${f.slice(PAQUETES.length)}:${String(linea)}`)
    }
    expect(infracciones).toEqual([])
  })

  it('y distingue la marca montada de la palabra acentuada', () => {
    // El control positivo: la regex del bug, escrita como se escribio.
    expect(MARCA_SUELTA.test('const MARCAS = /[̀-ͯ]/g')).toBe(true)
    // Y los controles negativos, que son los que hacen que el guardian se pueda
    // dejar puesto: este repo escribe en castellano y sus fuentes tienen tildes.
    expect(MARCA_SUELTA.test('// el río tiene pescado')).toBe(false)
    expect(MARCA_SUELTA.test('// una caña de pescar')).toBe(false)
    // El escape ESCRITO, que es la forma correcta y la que este archivo usa.
    expect(MARCA_SUELTA.test('const MARCAS = /[\\u0300-\\u036f]/g')).toBe(false)
  })
})
