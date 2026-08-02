// ─── EL CRITERIO DE LA PALETA ───────────────────────────────────────────────
//
// Lo que este archivo afirma NO es «las treinta sustancias se ven distintas».
// Eso sería mentira y además no hace falta: entre carne y pescado nadie elige
// mirando, se elige por `nutrition`.
//
// Lo que afirma es más chico y se puede sostener:
//
//   (a) TOTAL — toda sustancia tiene aspecto, incluidas las que el mundo fabrica
//       en runtime y ningún catálogo escrito a mano va a tener;
//   (b) NO ADIVINA POR EL NOMBRE — es la muleta de Ánima I y hay un guardián de
//       texto para que no vuelva de contrabando;
//   (c) LOS PARES QUE EL JUEGO OBLIGA A DISTINGUIR se distinguen, con la lista
//       escrita y el porqué de cada uno;
//   (d) Y LOS QUE NO, SE PUBLICAN CONTADOS. Un límite que no se imprime es un
//       límite que alguien descubre tarde.
//
// ─── DE DÓNDE SALE LA LISTA DEL PUNTO (c) ───────────────────────────────────
//
// De la evidencia del proyecto, no del gusto. Cada par de abajo es una decisión
// que la criatura o el cuidador tienen que tomar mirando el mapa, y las cuatro
// primeras están medidas en documentos de este repositorio.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, type Physics, type Substance } from '@anima/physics'

import { PALETAS, aspectoDe, familiaDe, tramaDe } from '../src/paleta.js'

const PHYS: Physics = buildSeedPhysics()

/** Dos sustancias se ven distinto si difieren en familia, grano o veta. */
function seDistinguen(a: string, b: string): boolean {
  const x = aspectoDe(a, PHYS)
  const y = aspectoDe(b, PHYS)
  return x.familia !== y.familia || x.trama.grano !== y.trama.grano || x.trama.veta !== y.trama.veta
}

/**
 * LOS PARES QUE NO SE PUEDEN VER IGUAL, y por qué cada uno.
 *
 * Si alguno se cae, no se afloja el test: se arregla el eje. Ver el encabezado
 * de `src/paleta.ts`, sección «los tres ejes».
 */
const LOS_QUE_IMPORTAN: readonly (readonly [string, string, string])[] = [
  ['madera', 'madera-dura', 'qué vara frotar: ignición 300 contra 340, y frotar la equivocada cuesta el tanque entero'],
  ['corteza', 'hoja-seca', 'qué sirve de yesca: ignición 250 contra 180, y es lo que hace posible el primer fuego'],
  ['hueso', 'piedra', 'si eso se puede partir para sacarle médula, o es una piedra'],
  ['pedernal', 'carbon', 'lo único que corta contra lo que ya ardió'],
  ['liana', 'junco', 'con qué atar: tensile 0,72 contra 0,42, y `unir` gasta el atador'],
  ['tendon', 'piel', 'la mejor atadura del mundo (tensile 0,95) contra una del montón'],
  ['arcilla', 'tuberculo', 'la tapa de la fogata contra la comida'],
  ['agua', 'savia', 'dónde se apaga un fuego contra lo que pega'],
]

// ─── (a) Total ──────────────────────────────────────────────────────────────

describe('(a) toda sustancia tiene aspecto, sin excepciones', () => {
  it('las treinta del catálogo semilla', () => {
    expect(PHYS.substances.size).toBe(30)
    for (const [id] of PHYS.substances) {
      const a = aspectoDe(id, PHYS)
      expect(PALETAS[a.familia], `sin paleta: ${id}`).toBeDefined()
      expect(a.paleta.base.startsWith('#'), `sin color: ${id}`).toBe(true)
    }
  })

  it('Y LAS QUE EL MUNDO FABRICA EN RUNTIME, que son las que rompen todo catálogo a mano', () => {
    // `residuoDe` arma ids como `residuo-carbonoso-de-madera` con UN solo tag.
    // Ningún `Record<SubstanceId, Paleta>` los puede tener, y por eso la familia
    // sale de tags y cualidades y no de una tabla por id.
    const residuo = (tag: string, q: Record<string, number>): Substance =>
      ({ id: 'residuo-x-de-y', lexeme: { nombre: 'residuo', genero: 'm', sinonimos: [] }, tags: [tag], perUnitMass: q, specificHeat: 1, provenance: 'test' }) as unknown as Substance

    expect(familiaDe(residuo('carbonoso', { charred: 1 }))).toBe('tizon')
    expect(familiaDe(residuo('mineral', { rigidity: 0.3 }))).toBe('ocre')
    expect(familiaDe(residuo('organico', {}))).toBe('rosa')
  })

  it('y una sustancia que el catálogo NO CONOCE se dibuja igual, en gris', () => {
    // El fallback del ADR II-0017: no hay rama que devuelva undefined ni que
    // pida arte. Gris porque no promete ni que alimenta ni que arde.
    const a = aspectoDe('esto-no-existe', PHYS)
    expect(a.familia).toBe('gris')
    expect(a.paleta).toEqual(PALETAS.gris)
  })
})

// ─── (b) No adivina por el nombre ───────────────────────────────────────────

describe('(b) ninguna decisión mira el texto de un id', () => {
  it('EL GUARDIÁN: no hay un solo nombre de sustancia escrito en `src/`', async () => {
    // La muleta de Ánima I era `MATERIAL_WORDS`: una tabla que preguntaba si el
    // nombre «incluye» la palabra «piedra». Volvería de contrabando el día que
    // alguien arregle un caso raro con un `if (id === 'pedernal')`, y no rompería
    // nada — por eso hace falta un guardián de texto y no basta con la intención.
    const { readFileSync, readdirSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const dir = fileURLToPath(new URL('../src/', import.meta.url))

    // ─── QUÉ ARCHIVOS MIRA, Y POR QUÉ NO LOS MIRA A TODOS ──────────────────
    //
    // El guardián protege UNA cosa: que **ninguna decisión de aspecto se tome
    // mirando el nombre de una sustancia**. Ésa era la muleta de Ánima I y es lo
    // que Ánima II puede tirar porque tiene los tags y las cualidades.
    //
    // `semillas.ts` no decide nada: DECLARA dibujos de fábrica, cada uno con su
    // clave. Y la clave de un sprite **contiene el id de la sustancia por
    // diseño** —`criatura/carne/24`—, así que cualquier archivo que declare
    // sprites va a tener ids adentro, igual que los tiene el JSON del depósito.
    // Exigirle lo contrario sería pedir que un dato no se pueda nombrar.
    //
    // La línea es: los archivos que RAZONAN sobre materia se revisan; los que
    // sólo la nombran para identificar un dato, no.
    const DECLARAN_DATOS = new Set(['semillas.ts'])
    for (const archivo of readdirSync(dir).filter((f) => f.endsWith('.ts') && !DECLARAN_DATOS.has(f))) {
      // `\r` normalizado ANTES de partir en líneas. En JavaScript el `.` de una
      // expresión regular no matchea `\r`, así que un detector que lea líneas de
      // un archivo con fines de línea de Windows devuelve cero sin fallar en
      // ningún lado. Este árbol ya se comió ese bicho una vez, en el detector de
      // relojes de pared del Hito 11.
      const fuente = readFileSync(dir + archivo, 'utf8').replace(/\r/g, '')
      const codigo = fuente
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
        .join('\n')

      for (const [id] of PHYS.substances) {
        // ─── LA ÚNICA EXCEPCIÓN, Y NO ES UNA CONCESIÓN ────────────────────
        //
        // `grano` es a la vez una SUSTANCIA del catálogo y una FORMA de
        // `FormId`. La colisión es de la física, no de este paquete, y las dos
        // cosas que se llaman igual son opuestas para este guardián:
        //
        //   ramificar por `FormId` es LEGÍTIMO — es una unión cerrada de seis y
        //   `tsc` obliga a cubrirla entera, así que no hay nada que adivinar;
        //   ramificar por `SubstanceId` es LA MULETA — el catálogo es abierto y
        //   crece en runtime, así que un `if` por id siempre deja casos afuera.
        //
        // Excluirla no abre un agujero: si alguien escribiera `id === 'grano'`
        // pensando en la sustancia, el test del punto (c) lo agarra igual el día
        // que esa rama cambie un color que no debía.
        if (id === 'grano') continue
        expect(codigo.includes(`'${id}'`), `«${id}» aparece como literal en ${archivo}`).toBe(false)
      }
    }
  })

  it('y el control: el guardián PUEDE fallar', () => {
    // Sin esto, un guardián que leyera el archivo equivocado —o cero archivos—
    // daría verde para siempre. Es el modo de falla que este proyecto ya se comió
    // tres veces: un detector que mide nada y publica un número plausible.
    const codigoMalo = "if (id === 'pedernal') return 'negro'"
    const encontrados = [...PHYS.substances.keys()].filter((id) => codigoMalo.includes(`'${id}'`))
    expect(encontrados).toEqual(['pedernal'])
  })
})

// ─── (c) Los pares que importan ─────────────────────────────────────────────

describe('(c) lo que el juego obliga a distinguir, se distingue', () => {
  for (const [a, b, porque] of LOS_QUE_IMPORTAN) {
    it(`${a} · ${b} — ${porque}`, () => {
      expect(seDistinguen(a, b), `${a} y ${b} se ven idénticos`).toBe(true)
    })
  }

  it('EL CONTROL: dos cosas que SÍ se pueden ver iguales, se ven iguales', () => {
    // Sin este control, un `seDistinguen` que devolviera `true` siempre —por un
    // typo, por comparar objetos por referencia— dejaría los ocho de arriba en
    // verde sin mirar nada.
    expect(seDistinguen('carne', 'carne')).toBe(false)
  })
})

// ─── (d) Y lo que no se distingue, contado ──────────────────────────────────

describe('(d) el límite se publica, no se esconde', () => {
  it('LAS QUE SE VEN IGUAL: la tabla entera, para que nadie la descubra tarde', () => {
    const ids = [...PHYS.substances.keys()].sort()
    const porAspecto = new Map<string, string[]>()
    for (const id of ids) {
      const a = aspectoDe(id, PHYS)
      const clave = `${a.familia}/${String(a.trama.grano)}${String(a.trama.veta)}`
      porAspecto.set(clave, [...(porAspecto.get(clave) ?? []), id])
    }
    const chocan = [...porAspecto.entries()].filter(([, xs]) => xs.length > 1)

    console.log('\n─── LAS QUE SE VEN IGUAL ───')
    console.log(`  aspectos distintos: ${String(porAspecto.size)} de ${String(ids.length)} sustancias`)
    for (const [clave, xs] of chocan.sort((p, q) => q[1].length - p[1].length)) {
      console.log(`  ${clave.padEnd(12)} ${String(xs.length)}: ${xs.join(' ')}`)
    }
    console.log(`  en colisión: ${String(chocan.reduce((n, [, xs]) => n + xs.length, 0))} de ${String(ids.length)}\n`)

    // No hay umbral acá a propósito: este bloque MIDE, no juzga. El criterio que
    // juzga es el (c), y es el único que puede ponerse rojo.
    expect(porAspecto.size).toBeGreaterThan(0)
  })

  it('y ningún grupo se come más de un tercio del catálogo', () => {
    // La única cota que sí vale la pena afirmar: si una familia se tragara media
    // tabla, el mapa entero sería de un color y el eje habría dejado de servir.
    const cuenta = new Map<string, number>()
    for (const [id] of PHYS.substances) {
      const a = aspectoDe(id, PHYS)
      const clave = `${a.familia}/${String(a.trama.grano)}${String(a.trama.veta)}`
      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1)
    }
    expect(Math.max(...cuenta.values())).toBeLessThanOrEqual(10)
  })
})

// ─── (e) Determinista ───────────────────────────────────────────────────────

describe('(e) mirar no consume azar', () => {
  it('mil llamadas dan el mismo aspecto', () => {
    // La regla del Hito 2 que este paquete no puede romper: mirar, pensar o
    // renderizar nunca consume RNG. Acá se afirma sobre el resultado, que es lo
    // único observable desde afuera.
    const primero = JSON.stringify(aspectoDe('madera', PHYS))
    for (let i = 0; i < 1000; i++) expect(JSON.stringify(aspectoDe('madera', PHYS))).toBe(primero)
  })

  it('y la trama sale sólo de las cualidades: dos sustancias iguales dan la misma', () => {
    const a = PHYS.substances.get('madera')
    expect(a).toBeDefined()
    if (a === undefined) return
    const gemela = { ...a, id: 'otra-madera', lexeme: { ...a.lexeme, nombre: 'zzz' } }
    expect(tramaDe(gemela)).toEqual(tramaDe(a))
    expect(familiaDe(gemela)).toBe(familiaDe(a))
  })
})
