/**
 * EL LÉXICO VIVO, y la medición que decidió la forma del paquete.
 *
 * Este archivo hace tres cosas y la tercera es la que vale:
 *
 * 1. afirma que el léxico derivado SALE de los datos y no de una lista;
 * 2. impide que la única lista copiada —los adjetivos de estado— se
 *    desincronice de `physics/src/body.ts`, que es de donde la copiamos;
 * 3. **mide cuánto castellano entiende el mundo solo, y cuánto agrega el
 *    puente escrito a mano.** Ese número es el que justifica que `alias.ts`
 *    exista, y es el que hay que volver a mirar cuando alguien proponga
 *    achicarlo.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildSeedPhysics } from '@anima/physics'
import { describe, expect, it } from 'vitest'
import { PUENTE, PUENTE_METAS, PUENTE_VERBOS } from '../src/alias.js'
import { lexicoDe } from '../src/lexico.js'
import { clave, tokenizar } from '../src/normalizar.js'

const phys = buildSeedPhysics()
const SOLO_MUNDO = lexicoDe(phys)
const CON_PUENTE = lexicoDe(phys, PUENTE)

/**
 * Las once frases con las que se midió el agujero antes de escribir el puente.
 * Son las mismas del informe, palabra por palabra, para que el número de hoy se
 * pueda comparar con el de entonces.
 */
const FRASES: readonly string[] = [
  'fabricá una trampa para peces',
  'traé un palo',
  'andá al río',
  'no comas eso',
  'hacé fuego',
  'juntá leña',
  'pescá algo',
  'asá el pescado',
  'dejá de caminar',
  'conseguí comida',
  'atá la vara con la hebra',
]

/** Cuántas palabras de la frase caen adentro de alguna entrada del léxico. */
function cubiertas(lex: ReturnType<typeof lexicoDe>, frase: string): number {
  const t = tokenizar(frase)
  let n = 0
  for (let i = 0; i < t.length; i++) {
    const e = lex.buscar(t, i)
    if (e !== undefined) n += e.palabras
    // No se saltea `i`: se cuenta cobertura de palabras, no de entradas, y una
    // entrada de dos palabras cubre dos. Avanzar de a una sobreestimaría si dos
    // entradas se solapan, y en este léxico no se solapan (medido: las 17
    // multipalabra son todas de sustancias distintas).
  }
  return n
}

describe('el léxico sale de los datos', () => {
  it('las sustancias entran todas, con sus sinónimos', () => {
    // 30 sustancias, y `huevo` es la única sin sinónimos. No se afirma el 30 a
    // secas: se afirma que ENTRARON TODAS, que es lo que quiere decir «vivo».
    const nombres = [...phys.substances.values()].map((s) => clave(s.lexeme.nombre))
    for (const n of nombres) expect(SOLO_MUNDO.entradas.has(n), `falta «${n}»`).toBe(true)
    expect(nombres.length).toBe(phys.substances.size)

    let sinonimos = 0
    for (const s of phys.substances.values()) {
      for (const sin of s.lexeme.sinonimos) {
        sinonimos++
        expect(SOLO_MUNDO.entradas.has(clave(sin)), `falta el sinónimo «${sin}»`).toBe(true)
      }
    }
    // El número que importa: la mayor parte del léxico son SINÓNIMOS, no
    // nombres. Un lector que sólo mirara `nombre` perdería el 63%.
    expect(sinonimos).toBeGreaterThan(phys.substances.size)
    console.log(`  sustancias ${String(phys.substances.size)} · sinónimos ${String(sinonimos)}`)
  })

  it('los cuatro verbos del mundo, y son cuatro', () => {
    const verbos = [...phys.processes.values()].map((p) => p.lexeme.nombre)
    for (const v of verbos) expect(SOLO_MUNDO.entradas.has(clave(v)), `falta «${v}»`).toBe(true)
    console.log(`  verbos del mundo: ${verbos.join(', ')}`)
  })

  it('una sustancia NUEVA entra sola, sin tocar este paquete', () => {
    // El control de que «vivo» no es una palabra del comentario. Si el léxico
    // tuviera una lista adentro, esto sería rojo.
    const conInvento = buildSeedPhysics({
      substances: [
        ...phys.substances.values(),
        {
          id: 'vidrio-de-rio',
          lexeme: { nombre: 'vidrio de río', genero: 'm', sinonimos: ['cristal'] },
          tags: ['mineral'],
          perUnitMass: {},
          specificHeat: 0.8,
          provenance: { by: 'oraculo' },
        },
      ],
    })
    const lex = lexicoDe(conInvento)
    expect(lex.entradas.has('vidrio de rio')).toBe(true)
    expect(lex.entradas.has('cristal')).toBe(true)
    // Y cambia la identidad del léxico, que es lo que hace que una caché de
    // lectura no conteste con el vocabulario de antes.
    expect(lex.digest).not.toBe(SOLO_MUNDO.digest)
    expect(lex.epoca).not.toBe(SOLO_MUNDO.epoca)
  })

  it('el digest no depende del orden en que se construyó', () => {
    // Un `Map` conserva el orden de inserción. Si el digest lo heredara, el
    // mismo léxico reconstruido cambiaría de identidad al reiniciar.
    const alRevés = lexicoDe(phys, [...PUENTE].reverse())
    expect(alRevés.digest).toBe(CON_PUENTE.digest)
  })
})

describe('buscar toma la entrada MÁS LARGA', () => {
  it('«madera verde» le gana a «madera»', () => {
    const t = tokenizar('traé madera verde')
    const e = CON_PUENTE.buscar(t, 1)
    expect(e?.clave).toBe('madera verde')
    expect(e?.palabras).toBe(2)
    // Y sola, «madera» sigue estando.
    expect(CON_PUENTE.buscar(tokenizar('traé madera'), 1)?.clave).toBe('madera')
  })

  it('y devuelve `undefined` en vez de adivinar', () => {
    expect(CON_PUENTE.buscar(tokenizar('xyzzy'), 0)).toBeUndefined()
  })
})

describe('la lista copiada no se puede desincronizar', () => {
  it('todos los adjetivos de `adjectivesOf` están en el léxico', () => {
    // EL GUARDIÁN DEL ENCABEZADO DE `lexico.ts`. `adjectivesOf` es privada de
    // `physics/src/body.ts`, así que la lista está copiada — y una copia sin
    // guardián es el bug de `DSL_REFERENCE` de Ánima I con otra ropa.
    //
    // Se leen los literales de `out.push(...)`, incluidos los que van adentro
    // de `agree(...)` y los del ternario.
    const fuente = readFileSync(
      fileURLToPath(new URL('../../physics/src/body.ts', import.meta.url)),
      'utf8',
    )
    const cuerpo = fuente.slice(fuente.indexOf('function adjectivesOf'))
    const hasta = cuerpo.indexOf('\nfunction ')
    const texto = hasta > 0 ? cuerpo.slice(0, hasta) : cuerpo
    // SÓLO de las líneas con `out.push(`, y no de toda la función: la primera
    // versión de este guardián barría los literales del bloque entero y se
    // traía `'temperature'`, `'charred'`, `'nutrition'`, `'digestibility'`,
    // `'moisture'` y `'decay'` — que son los `QualityId` que la función LEE,
    // no los adjetivos que ESCRIBE. Se puso rojo pidiendo que el léxico
    // tuviera una entrada llamada «temperature», que es exactamente lo que un
    // guardián demasiado ancho hace: exigir de más y enseñar a ignorarlo.
    // Y sólo lo que va ADENTRO del paréntesis, no la línea entera: la segunda
    // versión filtraba por línea y seguía trayendo `'moisture'` y `'decay'`,
    // porque `} else if (qualityOf(b, 'moisture', phys) >= 0.6) out.push(...)`
    // tiene las dos cosas en el mismo renglón.
    const lemas = texto
      .split('\n')
      .flatMap((l) => {
        const i = l.indexOf('out.push(')
        if (i < 0) return []
        return [...l.slice(i).matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '')
      })
      .filter((s) => s !== 'm' && s !== 'f')

    expect(lemas.length).toBeGreaterThanOrEqual(9)
    const faltan = lemas.filter((l) => !SOLO_MUNDO.entradas.has(clave(l)))
    expect(faltan, `en body.ts y no en el léxico: ${faltan.join(', ')}`).toEqual([])
    console.log(`  adjetivos leídos de body.ts: ${lemas.join(', ')}`)
  })

  it('y las formas femeninas también, que `agree` las produce', () => {
    for (const f of ['asada', 'cruda', 'quemada', 'chamuscada', 'mojada', 'podrida', 'consumida']) {
      expect(SOLO_MUNDO.entradas.has(f), `falta «${f}»`).toBe(true)
    }
  })
})

describe('EL AGUJERO, medido antes y después del puente', () => {
  it('el mundo solo entiende el 15% de once frases reales', () => {
    let total = 0
    let cubiertasSolas = 0
    let cubiertasConPuente = 0
    const filas: string[] = []
    for (const f of FRASES) {
      const t = tokenizar(f)
      const a = cubiertas(SOLO_MUNDO, f)
      const b = cubiertas(CON_PUENTE, f)
      total += t.length
      cubiertasSolas += a
      cubiertasConPuente += b
      filas.push(
        `  ${f.padEnd(30)} mundo ${String(a)}/${String(t.length)}   con puente ${String(b)}/${String(t.length)}`,
      )
    }
    const pctSolo = Math.round((cubiertasSolas * 100) / total)
    const pctPuente = Math.round((cubiertasConPuente * 100) / total)
    console.log('\n── COBERTURA SOBRE ONCE FRASES REALES ──')
    for (const f of filas) console.log(f)
    console.log(`\n  SÓLO EL MUNDO ...... ${String(cubiertasSolas)}/${String(total)} = ${String(pctSolo)}%`)
    console.log(`  CON EL PUENTE ...... ${String(cubiertasConPuente)}/${String(total)} = ${String(pctPuente)}%`)
    console.log(
      `  el puente son ${String(PUENTE.length)} filas (${String(PUENTE_METAS.length)} metas + ${String(PUENTE_VERBOS.length)} verbos)`,
    )
    console.log(
      `  contra ${String(SOLO_MUNDO.entradas.size)} entradas que el mundo trae solo\n`,
    )

    // El número medido antes de escribir nada. Se afirma con holgura porque el
    // punto no es el 15 exacto: es que el mundo NO alcanza y que este archivo
    // se ponga rojo el día que alguien crea que sí.
    expect(pctSolo).toBeLessThan(30)
    // Y el puente tiene que más que duplicarlo, o no está haciendo su trabajo.
    expect(pctPuente).toBeGreaterThan(pctSolo * 2)
  })

  it('los verbos: el mundo conoce CERO de doce, no uno', () => {
    // ─── UN NÚMERO CORREGIDO, Y ES DEL LADO EXIGENTE ────────────────────────
    //
    // La medición que precedió a este paquete reportó «1 de 12: `atá` → el
    // proceso `union`». Este test lo puso rojo y tiene razón: el acierto
    // dependía de un paso que el léxico NO da, desconjugar el voseo quitando el
    // acento y agregando una `r` (`atá` → `ata` → `atar`).
    //
    // Y ese paso no se dio porque la misma receta produce `comasr`, `caminarr`
    // y `hacer`-que-no-es-proceso: acierta 1 de 12 y ensucia 11. O sea que el
    // «1» del informe era el resultado de una regla que se descartó por mala.
    //
    // Con el léxico tal como es —la clave normalizada contra el lexema— el
    // mundo entiende **cero** verbos de la calle. El agujero es más grande de lo
    // que se había medido, no más chico.
    const VERBOS_DE_LA_CALLE = [
      'fabricá', 'traé', 'andá', 'comé', 'hacé', 'juntá',
      'pescá', 'asá', 'dejá', 'conseguí', 'atá', 'buscá',
    ]
    const sabeSolo = VERBOS_DE_LA_CALLE.filter((v) => SOLO_MUNDO.entradas.has(clave(v)))
    const sabeConPuente = VERBOS_DE_LA_CALLE.filter((v) => CON_PUENTE.entradas.has(clave(v)))
    console.log(`  el mundo solo: ${String(sabeSolo.length)}/12 → [${sabeSolo.join(', ')}]`)
    console.log(`  con el puente: ${String(sabeConPuente.length)}/12`)

    expect(sabeSolo).toEqual([])
    expect(sabeConPuente.length).toBe(VERBOS_DE_LA_CALLE.length)

    // El control de que el cero significa algo: la FORMA INFINITIVA del único
    // proceso que se le parece SÍ está, o sea que el léxico no está vacío ni
    // roto — lo que falta es la conjugación, y ésa es del puente.
    expect(SOLO_MUNDO.entradas.has('atar')).toBe(true)
  })

  it('«trampa» apunta a una CUALIDAD y no a un objeto con nombre', () => {
    // La línea del caso de aceptación. Si esto alguna vez apunta a un `kind`,
    // el punto 12 del Gate 5→6 se rompió por el lado del lenguaje.
    const e = CON_PUENTE.buscar(tokenizar('fabricá una trampa para peces'), 2)
    expect(e?.clave).toBe('trampa')
    expect(e?.denota).toEqual([{ k: 'meta', firma: 'catch>0' }])
    // Y no hay NINGUNA entrada del léxico que nombre la solución.
    for (const k of CON_PUENTE.entradas.keys()) {
      expect(k).not.toContain('trampa para')
      expect(k).not.toContain('caña')
      expect(k).not.toContain('cana de pescar')
    }
  })
})
