// Lo que este archivo cuida del motor no es que las leyes den los números que
// dan —eso lo cuidan `tres-ejemplos.test.ts` y el barrido del Hito 0—: cuida las
// propiedades sin las que esos números no valdrían nada. Que un tick sea puro,
// que no mute lo que le dan, que el orden de las leyes esté fijo, y que en todo
// el paquete no haya una sola función de `Math` cuya precisión ECMAScript no
// especifique.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Body } from '../src/body.js'
import { qualityOf } from '../src/body.js'
import {
  capacidadTermica,
  CELDA_AL_AIRE,
  correr,
  EXPOSICION,
  formFactor,
  H_PERDIDA,
  MONTAJES,
  normalizarMasa,
  paso,
  T_AMBIENTE,
  temperaturaDeEquilibrio,
  totalConservado,
  type Entorno,
} from '../src/leyes.js'
import { buildSeedPhysics } from '../src/physics.js'

const phys = buildSeedPhysics()

const cosa = (sustancia: string, masa: number, state: Body['state'] = {}): Body => ({
  id: 'x',
  form: 'filete',
  parts: [{ substance: sustancia, mass: masa, q: {} }],
  joints: [],
  state,
})

const SOBRE_LA_PARRILLA: Entorno = {
  celda: CELDA_AL_AIRE,
  fuente: { potencia: 300, distancia: 1, montaje: 'parrilla' },
}

describe('un tick es puro', () => {
  it('no toca el cuerpo que le dan', () => {
    // Si el motor mutara la entrada, el journal del mundo guardaría estados que
    // ya cambiaron y el replay reproduciría otra partida. Es el bug que no se ve
    // hasta que alguien intenta cargar una partida vieja.
    const antes = cosa('carne', 0.4)
    const foto = JSON.stringify(antes)
    paso(antes, SOBRE_LA_PARRILLA, phys)
    expect(JSON.stringify(antes)).toBe(foto)
  })

  it('dos veces la misma entrada da exactamente el mismo cuerpo', () => {
    const b = cosa('carne', 0.4, { temperature: 90 })
    const uno = paso(b, SOBRE_LA_PARRILLA, phys)
    const dos = paso(b, SOBRE_LA_PARRILLA, phys)
    expect(uno.body).toEqual(dos.body)
    expect(uno.leyes).toEqual(dos.leyes)
  })

  it('mil ticks de a uno dan lo mismo que mil ticks de corrido', () => {
    // `correr` no puede ser más que `paso` mil veces. Si difiriera, habría estado
    // escondido en algún lado y el mundo dejaría de poder pausarse.
    const b = cosa('carne', 0.4)
    let unoPorUno = b
    for (let i = 0; i < 200; i++) unoPorUno = paso(unoPorUno, SOBRE_LA_PARRILLA, phys).body
    const deCorrido = correr(b, SOBRE_LA_PARRILLA, phys, 200)
    expect(unoPorUno).toEqual(deCorrido.body)
  })
})

describe('el orden de las leyes está fijo', () => {
  it('lo que está en su ventana de cocción no pasa por la ley de la humedad', () => {
    // Las dos mueven `moisture`. Si corrieran las dos, el agua se contaría dos
    // veces y la evaporación calibrada del Hito 0 dejaría de ser la que se midió.
    const enVentana = paso(cosa('carne', 0.4, { temperature: 90 }), SOBRE_LA_PARRILLA, phys)
    expect(enVentana.leyes).toEqual(['termica', 'desnaturalizacion'])

    const frio = paso(cosa('carne', 0.4, { temperature: 20 }), SOBRE_LA_PARRILLA, phys)
    expect(frio.leyes).toContain('humedad')
    expect(frio.leyes).not.toContain('desnaturalizacion')
  })

  it('la ley térmica corre siempre y corre primero', () => {
    const quieto = paso(cosa('piedra', 3), { celda: CELDA_AL_AIRE }, phys)
    expect(quieto.leyes[0]).toBe('termica')
  })

  it('lo que no se cocina no se pudre por estar caliente, pero lo crudo sí', () => {
    // La ley 6 se corta arriba del punto de cocción. Ésa es toda la razón por la
    // que guardar comida cocida tiene sentido, y no hay ninguna regla que lo diga.
    const templado = paso(cosa('carne', 0.4, { temperature: 20 }), { celda: CELDA_AL_AIRE }, phys)
    expect(templado.leyes).toContain('descomposicion')
    const caliente = paso(cosa('carne', 0.4, { temperature: 90 }), SOBRE_LA_PARRILLA, phys)
    expect(caliente.leyes).not.toContain('descomposicion')
  })
})

describe('la ley 1 es una función, no una tabla', () => {
  it('los montajes son una enumeración cerrada, y son tres', () => {
    expect(MONTAJES).toHaveLength(3)
    expect(Object.keys(EXPOSICION).sort()).toEqual([...MONTAJES].sort())
  })

  it('reproduce las cuatro filas del documento con una sola fórmula', () => {
    expect(formFactor(2, 'piso') * 1000).toBeCloseTo(12, 9)
    expect(formFactor(1, 'piso') * 1000).toBeCloseTo(30, 9)
    expect(formFactor(0, 'contacto') * 1000).toBeCloseTo(600, 9)
    expect(formFactor(1, 'parrilla') * 1000).toBeCloseTo(125, 9)
  })

  it('sin fuente, el cuerpo vuelve al ambiente y se queda ahí', () => {
    const fin = correr(cosa('piedra', 1, { temperature: 400 }), { celda: CELDA_AL_AIRE }, phys, 500)
    expect(qualityOf(fin.body, 'temperature', fin.phys)).toBeCloseTo(T_AMBIENTE, 6)
  })

  it('lo grande se calienta más lento que lo chico, y nadie escribió ninguno de los dos', () => {
    // `heatCapacity = Σ (masa × calor específico)`. La ley 1 divide por eso, y de
    // ahí sale la diferencia entera. No hay ningún caso por tamaño.
    const chico = cosa('piedra', 0.2)
    const grande = cosa('piedra', 20)
    expect(capacidadTermica(grande, phys)).toBeGreaterThan(capacidadTermica(chico, phys))
    const sitio: Entorno = {
      celda: CELDA_AL_AIRE,
      fuente: { potencia: 300, distancia: 0, montaje: 'contacto' },
    }
    const tChico = qualityOf(correr(chico, sitio, phys, 10).body, 'temperature', phys)
    const tGrande = qualityOf(correr(grande, sitio, phys, 10).body, 'temperature', phys)
    expect(tChico).toBeGreaterThan(tGrande)
    // Y los dos van al MISMO equilibrio: lo que cambia es cuánto tardan.
    const largo = 20000
    expect(qualityOf(correr(grande, sitio, phys, largo).body, 'temperature', phys)).toBeCloseTo(
      temperaturaDeEquilibrio(300, 0, 'contacto'),
      3,
    )
  })

  it('el acoplamiento con el ambiente es el declarado y no otro', () => {
    expect(H_PERDIDA).toBe(0.5)
    expect(temperaturaDeEquilibrio(0, 0, 'contacto')).toBe(T_AMBIENTE)
  })
})

describe('la masa vive en un solo lugar', () => {
  it('un cuerpo que declara una masa distinta de la de sus partes se reconcilia sin ganar nada', () => {
    // El caso que hace materia de la nada: `state.mass` le gana a la suma de las
    // partes al LEER, pero transmutar, atar y partir reconstruyen las PARTES. Si
    // los dos números discrepan, la primera de esas tres operaciones se queda con
    // el que no era.
    const raro = cosa('carne', 10, { mass: 2 })
    expect(qualityOf(raro, 'mass', phys)).toBe(2)
    const sano = normalizarMasa(raro)
    expect(sano.state.mass).toBeUndefined()
    expect(qualityOf(sano, 'mass', phys)).toBe(2)
    expect(sano.parts[0]!.mass).toBe(2)
  })

  it('y un tick sobre ese cuerpo tampoco lo aprovecha', () => {
    const raro = cosa('carne', 10, { mass: 2, temperature: 90 })
    const antes = totalConservado(raro, 'nutrition', phys)
    const fin = correr(raro, SOBRE_LA_PARRILLA, phys, 300)
    expect(qualityOf(fin.body, 'mass', fin.phys)).toBeLessThanOrEqual(2)
    expect(totalConservado(fin.body, 'nutrition', fin.phys)).toBeLessThanOrEqual(antes)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LA REGLA 2 DE LA CARPETA, VERIFICADA EN VEZ DE PROMETIDA
//
// `ii/README.md` dice que `Math.exp`, `Math.pow`, `Math.log`, `**`,
// `Math.random`, `Date`, `performance`, `Intl` y `localeCompare` están prohibidos
// «por lint» en este paquete. No lo están: `eslint.config.js` no cubre `ii/`. Y
// una regla que nadie corre no es una regla — es exactamente el bug de
// `DSL_REFERENCE` de Ánima I, una verdad mantenida a mano que se separó del
// código. Hasta que la configuración exista, esto lo cuida un test.

const PROHIBIDAS: readonly { patron: RegExp; que: string }[] = [
  { patron: /\bMath\s*\.\s*exp\b/, que: 'Math.exp' },
  { patron: /\bMath\s*\.\s*pow\b/, que: 'Math.pow' },
  { patron: /\bMath\s*\.\s*log\b/, que: 'Math.log' },
  { patron: /\bMath\s*\.\s*random\b/, que: 'Math.random' },
  { patron: /\bMath\s*\.\s*sin\b/, que: 'Math.sin' },
  { patron: /\bMath\s*\.\s*cos\b/, que: 'Math.cos' },
  { patron: /\bMath\s*\.\s*tan\b/, que: 'Math.tan' },
  { patron: /\bMath\s*\.\s*sqrt\b/, que: 'Math.sqrt' },
  { patron: /\bMath\s*\.\s*cbrt\b/, que: 'Math.cbrt' },
  { patron: /\bMath\s*\.\s*hypot\b/, que: 'Math.hypot' },
  { patron: /\*\*/, que: 'el operador de potencia' },
  { patron: /\bnew\s+Date\b|\bDate\s*\.\s*now\b/, que: 'Date' },
  { patron: /\bperformance\s*\.\s*now\b/, que: 'performance.now' },
  { patron: /\bIntl\b/, que: 'Intl' },
  { patron: /\blocaleCompare\b/, que: 'localeCompare' },
  { patron: /\btoLocaleString\b/, que: 'toLocaleString' },
]

/** El código, sin comentarios: `/** ... *​/` lleva asteriscos y no es una potencia. */
function soloCodigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

function archivosDeSrc(): readonly string[] {
  const raiz = fileURLToPath(new URL('../src/', import.meta.url))
  const out: string[] = []
  const bajar = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}${e.name}${e.isDirectory() ? '/' : ''}`
      if (e.isDirectory()) bajar(p)
      else if (e.name.endsWith('.ts')) out.push(p)
    }
  }
  bajar(raiz)
  return out.sort()
}

describe('ningún archivo del paquete usa algo que ECMAScript no especifique', () => {
  it('los ocho archivos de `src` están limpios', () => {
    const archivos = archivosDeSrc()
    expect(archivos.length).toBeGreaterThanOrEqual(8)
    const sucios: string[] = []
    for (const ruta of archivos) {
      const codigo = soloCodigo(readFileSync(ruta, 'utf8'))
      for (const { patron, que } of PROHIBIDAS) {
        if (patron.test(codigo)) sucios.push(`${ruta.split('/src/')[1] ?? ruta}: ${que}`)
      }
    }
    expect(sucios).toEqual([])
  })

  it('y el detector detecta: sobre una línea que las use, las encuentra todas', () => {
    // Un guardián que no puede fallar no guarda nada.
    const carnada = [
      'const a = Math.exp(1)',
      'const b = Math.pow(2, 3)',
      'const c = Math.log(4)',
      'const d = Math.random()',
      'const e = Math.sin(1) + Math.cos(1) + Math.tan(1)',
      'const f = Math.sqrt(2) + Math.cbrt(8) + Math.hypot(3, 4)',
      'const g = 2 ** 10',
      'const h = new Date()',
      'const i = performance.now()',
      'const j = new Intl.NumberFormat()',
      'const k = "a".localeCompare("b")',
      'const l = (1).toLocaleString()',
    ].join('\n')
    for (const { patron, que } of PROHIBIDAS) {
      expect(patron.test(carnada), `el detector no ve ${que}`).toBe(true)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ADR II-0001 · ENCENDER NO ES UNA ACCIÓN

describe('ADR II-0001: encender no es una acción, es una consecuencia', () => {
  it('el motor no tiene ninguna función que sea un verbo de producto', () => {
    // Si existiera `encender()`, `cocinar()` o `hacerBrasas()`, existiría un
    // lugar donde alguien decide que algo pasa. Lo que hay son leyes que corren
    // y una criatura que puede colocar las cosas donde las leyes las agarren.
    const codigo = soloCodigo(readFileSync(fileURLToPath(new URL('../src/leyes.ts', import.meta.url)), 'utf8'))
    for (const verbo of ['encender', 'prender', 'cocinar', 'quemar', 'apagar', 'pescar']) {
      expect(new RegExp(`function\\s+${verbo}`, 'i').test(codigo), `existe ${verbo}()`).toBe(false)
    }
  })

  it('lo que prende, prende por colocación: mismo cuerpo, dos sitios, dos destinos', () => {
    // El único verbo aplicable de esta historia es «poner algo en algún lado». La
    // rama es la misma; lo que cambia es dónde está.
    const rama = cosa('madera', 1)
    const lejos = correr(
      rama,
      { celda: CELDA_AL_AIRE, fuente: { potencia: 300, distancia: 2, montaje: 'piso' } },
      phys,
      300,
    )
    const encima = correr(
      rama,
      { celda: CELDA_AL_AIRE, fuente: { potencia: 300, distancia: 0, montaje: 'contacto' } },
      phys,
      300,
    )
    expect(lejos.leyes).not.toContain('combustion')
    expect(encima.leyes).toContain('combustion')
    expect(qualityOf(lejos.body, 'charred', lejos.phys)).toBe(0)
    expect(qualityOf(encima.body, 'charred', encima.phys)).toBe(1)
  })
})
