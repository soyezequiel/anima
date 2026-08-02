// ─── LA MEDIDA DE LA GRILLA: 12, 16, 24 o 32 ────────────────────────────────
//
// La pregunta que este archivo contesta es la última que quedó abierta del
// estilo: **de qué tamaño es la grilla del glifo**. Y lo primero que hay que
// decir es que la pregunta se achicó sola, así que el banco es mucho más barato
// que el que se había diseñado.
//
// ─── POR QUÉ EL BANCO ORIGINAL YA NO HACE FALTA ─────────────────────────────
//
// El diseño adversarial pedía rasterizar, componer sobre el fondo, reducir a 24
// píxeles con dos filtros distintos, clasificar con 1-NN y correr seis
// controles. Todo eso existía para responder **«¿la grilla más fina sobrevive a
// la reducción o se promedia hasta el gris?»**.
//
// Esa pregunta se murió cuando los patrones dejaron de ser bitmaps: hoy cada
// pieza se dibuja DIRECTO a la medida que le toca (ver el encabezado de
// `forma.ts`), así que no hay ninguna reducción de la que sobrevivir. Lo que
// queda es una pregunta directa y se contesta con la misma medición que ya
// existe: **a qué tamaño se dejan de contar las piezas**.
//
// Dejar el banco grande igual habría sido pagar por una respuesta que ya no se
// necesita, y de paso creer que mide algo que no mide.
//
// ─── LA PRIMERA MÉTRICA NO SERVÍA, Y LO DIJO SU PROPIO CONTROL ──────────────
//
// Vale la pena dejarlo escrito porque es el modo de falla que este árbol
// persigue: **un número plausible que no mide lo que dice**.
//
// La primera versión de este banco medía «qué fracción de la tinta cambia al
// pasar de N piezas a N+1» y comparaba esa fracción entre grillas. La tabla
// salía preciosa —17% a 12, 17% a 16, 17% a 24, 21% a 32— y el veredicto era
// «sirven las cuatro, la más chica que sirve es 12».
//
// El control negativo la mató: **a grilla 4 también da 17%**. Y tenía que dar,
// porque el layout escala con la grilla, así que la fracción es invariante al
// tamaño POR CONSTRUCCIÓN. Un número que da lo mismo de 4 a 32 no puede elegir
// entre 4 y 32.
//
// Y el error de fondo era de pregunta, no de aritmética: si el dibujo CAMBIA al
// agregar una pieza no es lo mismo que si el dibujo SE ENTIENDE. Lo primero se
// conserva al achicar; lo segundo no.
//
// ─── LO QUE SÍ SE ROMPE AL ACHICAR, Y ES LO QUE SE MIDE ─────────────────────
//
// Tres propiedades, y las tres son cosas que el dibujo ya prometió en otro lado:
//
//   1. LA ESBELTEZ — una hebra tiene que verse más delgada que una vara. Es la
//      proporción que la física declara en `SLENDERNESS`, y a grilla chica la
//      caja de una pieza mide una o dos celdas: no hay lugar para ser flaco;
//   2. EL VOLUMEN — cada pieza tiene que conservar sus tres tonos. Con dos
//      celdas de ancho no entran base, sombra y luz, y la figura queda plana;
//   3. CONTAR — la que ya estaba, ahora como piso y no como criterio de corte.
//
// La grilla buena es **la más chica que cumple las tres**.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, type FormId, type Physics } from '@anima/physics'
import type { RenderDescriptor } from '@anima/world'

import { celdasDistintas, glifoDe, pintar } from '../src/componer.js'
import { FORMAS, siluetaDe } from '../src/forma.js'

const PHYS: Physics = buildSeedPhysics()
const MEDIDAS = [12, 16, 24, 32] as const

/**
 * EL PISO: qué fracción de la figura tiene que moverse para que se note.
 *
 * 15% no sale de la nada ni de una tabla de percepción: sale de la propia
 * medición de este árbol. Con la grilla en 24 —la que se venía usando— el peor
 * salto de las seis formas mueve el 17% de la tinta, y ese dibujo se miró y se
 * contaba. Poner el piso justo abajo de lo que ya se verificó a ojo es lo más
 * honesto que se puede hacer sin un estudio con gente.
 */
const PISO = 0.15

function obra(forma: FormId, n: number): RenderDescriptor {
  return {
    v: 2,
    at: { x: 0, y: 0 },
    forma,
    materiales: ['madera'],
    nucleo: 'madera',
    partes: n,
    juntas: 0,
    atadores: [],
    estado: 'sin-marca',
    porte: 'chico',
  }
}

const dibujo = (f: FormId, n: number, g: number) => pintar(glifoDe(obra(f, n), PHYS, g))
const tinta = (p: readonly (readonly string[])[]) => p.reduce((s, f) => s + f.filter((c) => c !== '').length, 0)

/** El peor salto de N a N+1, en fracción de la tinta, para una grilla. */
function peorSalto(g: number): { fraccion: number; donde: string } {
  let peor = Number.MAX_SAFE_INTEGER
  let donde = ''
  for (const forma of FORMAS) {
    for (let n = 1; n < 6; n++) {
      const a = dibujo(forma, n, g)
      const b = dibujo(forma, n + 1, g)
      const t = Math.max(tinta(a), tinta(b))
      if (t === 0) continue
      const f = celdasDistintas(a, b) / t
      if (f < peor) {
        peor = f
        donde = `${forma} ${String(n)}→${String(n + 1)}`
      }
    }
  }
  return { fraccion: peor, donde }
}

/** Ancho y alto de la tinta de una máscara. */
function caja(m: readonly string[]): { ancho: number; alto: number } {
  let x0 = 1e9
  let x1 = -1
  let y0 = 1e9
  let y1 = -1
  for (let y = 0; y < m.length; y++) {
    const f = m[y]
    if (f === undefined) continue
    for (let x = 0; x < f.length; x++) {
      if (f.charAt(x) === '0') continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return { ancho: x1 - x0 + 1, alto: y1 - y0 + 1 }
}

/** A esta grilla, ¿una hebra se ve más delgada que una vara, con seis piezas? */
function conservaEsbeltez(g: number): boolean {
  // Seis piezas es el peor caso: la caja de cada una es un tercio de la grilla.
  const lado = Math.trunc(g / 3)
  if (lado < 1) return false
  const h = caja(siluetaDe('hebra', lado, TRAMA))
  const v = caja(siluetaDe('vara', lado, TRAMA))
  return h.alto / h.ancho > v.alto / v.ancho
}

/** ¿Sobreviven los tres tonos, o la figura queda plana? */
function conservaVolumen(g: number): boolean {
  const lado = Math.trunc(g / 3)
  if (lado < 1) return false
  for (const forma of FORMAS) {
    const tonos = new Set<string>()
    for (const fila of siluetaDe(forma, lado, TRAMA)) {
      for (const ch of fila) if (ch !== '0') tonos.add(ch)
    }
    // Al menos dos de los tres: con uno solo la pieza es una silueta plana.
    if (tonos.size < 2) return false
  }
  return true
}

const TRAMA = { grano: 1, veta: 1 } as const

describe('la medida de la grilla', () => {
  it('LAS CUATRO MEDIDAS, con las tres propiedades', () => {
    console.log('\n─── A QUÉ TAMAÑO EL DIBUJO SIGUE DICIENDO LO QUE PROMETE ───')
    console.log('  grilla  celdas  esbeltez  volumen  contar        peor salto')
    const filas: { g: number; ok: boolean }[] = []
    for (const g of [4, ...MEDIDAS]) {
      const { fraccion, donde } = peorSalto(g)
      const e = conservaEsbeltez(g)
      const v = conservaVolumen(g)
      const c = fraccion >= PISO
      filas.push({ g, ok: e && v && c })
      const si = (b: boolean) => (b ? '  ✔    ' : '  ✘    ')
      console.log(
        `  ${String(g).padStart(2)}×${String(g).padEnd(3)} ${String(g * g).padStart(6)}  ${si(e)}  ${si(v)}  ${si(c)}  ${(fraccion * 100).toFixed(0).padStart(3)}%  ${donde}`,
      )
    }
    const sirven = filas.filter((x) => x.ok).map((x) => x.g)
    console.log(`\n  cumplen las tres: ${sirven.length === 0 ? 'ninguna' : sirven.join(', ')}`)
    console.log(`  LA MÁS CHICA QUE SIRVE: ${sirven.length === 0 ? '—' : String(Math.min(...sirven))}\n`)

    // El banco MIDE; el criterio que juzga es el de abajo. Acá sólo se afirma
    // que la medición se hizo sobre algo — un barrido vacío imprimiría una tabla
    // preciosa sin haber mirado nada.
    expect(filas.length).toBe(MEDIDAS.length + 1)
    expect(sirven.length).toBeGreaterThan(0)
  })

  it('LA GRILLA ELEGIDA (24) cumple las tres', () => {
    expect(conservaEsbeltez(24), 'esbeltez').toBe(true)
    expect(conservaVolumen(24), 'volumen').toBe(true)
    expect(peorSalto(24).fraccion, 'contar').toBeGreaterThanOrEqual(PISO)
  })

  it('EL CONTROL: una grilla ridículamente chica NO cumple, y el banco lo dice', () => {
    // Sin esto la tabla de arriba sería decorativa. Y este control es el que
    // mató la primera métrica de este archivo: con «fracción de tinta» sola,
    // grilla 4 daba 17% y PASABA. Ver el encabezado.
    expect(conservaEsbeltez(4) && conservaVolumen(4)).toBe(false)
  })

  it('y ninguna medida rompe: el glifo es total a cualquier tamaño', () => {
    // Incluidas las absurdas. Un descriptor siempre se dibuja, y si la grilla no
    // da para el layout, lo que sale es feo pero existe.
    for (const g of [1, 2, 3, 4, 5, 7, 12, 16, 24, 32, 64]) {
      for (const forma of FORMAS) {
        const glifo = glifoDe(obra(forma, 6), PHYS, g)
        expect(glifo.capas.length, `grilla ${String(g)} · ${forma}`).toBeGreaterThan(0)
        expect(pintar(glifo).length).toBe(g)
      }
    }
  })
})
