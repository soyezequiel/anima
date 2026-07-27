import { fx, seg } from '@anima/physics'
import { describe, expect, it } from 'vitest'

import { biomaDe, caloricBudget } from '../src/bioma.js'
import {
  CAPACIDAD_MAXIMA,
  CELDAS_DE_LADO,
  CELDAS_POR_CHUNK,
  climaDe,
  crearStock,
  indiceLocal,
  nivelDeAgua,
  PER_MILLE_MAXIMO,
  population,
  resolveChunk,
  retirarUno,
  SEGUNDOS_MAXIMOS,
  tieneAgua,
  type ChunkFacts,
  type Stock,
} from '../src/ley.js'
import { rngFor, type Seed } from '../src/pregunta.js'

const SEMILLA: Seed = 0xa11a5eed0d10500dn

/**
 * Una huella canónica de todo lo que el dios decretó sobre un chunk. Los
 * `Int32Array` se aplanan a arreglos porque `toEqual` los compara por
 * referencia de clase y lo que se quiere comparar es el CONTENIDO.
 */
function huella(f: ChunkFacts): string {
  return JSON.stringify({
    cx: f.cx,
    cy: f.cy,
    clima: f.clima,
    bioma: f.bioma.id,
    wet: [...f.terreno.wet],
    cover: [...f.terreno.cover],
    temperatura: f.terreno.temperatura,
    oxigeno: f.terreno.oxigeno,
    sustancias: [...f.sustancias],
    sueltas: f.sueltas.map((s) => [s.substance, s.i, s.masa]),
    presupuesto: f.presupuestoCalorico,
  })
}

describe('resolveChunk — la regla madre', () => {
  it('la respuesta no depende de cuándo se preguntó', () => {
    const antes = huella(resolveChunk(SEMILLA, 5, -3))
    // Pasa una historia larga entre medio: se camina medio mapa.
    for (let i = 0; i < 200; i++) resolveChunk(SEMILLA, i, i - 7)
    expect(huella(resolveChunk(SEMILLA, 5, -3))).toBe(antes)
  })

  it('la respuesta no depende del ORDEN de exploración, ni de la historia entre medio', () => {
    const chunks: [number, number][] = []
    for (let cx = -4; cx <= 4; cx++) for (let cy = -4; cy <= 4; cy++) chunks.push([cx, cy])

    // Primera partida: en orden por filas, sin nada entre medio.
    const uno = new Map<string, string>()
    for (const [cx, cy] of chunks) uno.set(`${String(cx)}:${String(cy)}`, huella(resolveChunk(SEMILLA, cx, cy)))

    // Segunda partida: en el orden inverso, y con OTRA HISTORIA entre medio —
    // stocks que se vacían, novedades que se preguntan, chunks lejanos que se
    // decretan. Si algo del dios llevara estado, esto lo movería.
    const dos = new Map<string, string>()
    const s = crearStock({
      id: 'río-de-prueba',
      yields: 'pescado',
      cx: 0,
      cy: 0,
      masaPorUnidad: fx(1),
      capacity: 20,
      perMillePorSegundo: 300,
      depth: fx(1.5),
      atSecond: seg(0),
      amount: 20,
    })
    let t = 0
    for (const [cx, cy] of [...chunks].reverse()) {
      t += 3
      retirarUno(s, seg(t))
      rngFor({ k: 'novelty', topic: 'algo-nuevo', nonce: t }, SEMILLA)()
      resolveChunk(SEMILLA, cx + 1000, cy - 1000)
      dos.set(`${String(cx)}:${String(cy)}`, huella(resolveChunk(SEMILLA, cx, cy)))
    }

    expect(dos.size).toBe(uno.size)
    for (const [k, v] of uno) expect(dos.get(k), `el chunk ${k} salió distinto`).toBe(v)
  })

  it('dos semillas producen dos mundos', () => {
    let distintos = 0
    for (let cx = 0; cx < 30; cx++) {
      if (huella(resolveChunk(1n, cx, 0)) !== huella(resolveChunk(2n, cx, 0))) distintos++
    }
    expect(distintos).toBe(30)
  })

  it('el terreno tiene una celda por celda del chunk, y nada afuera de rango', () => {
    const f = resolveChunk(SEMILLA, 2, 2)
    expect(f.terreno.lado).toBe(CELDAS_DE_LADO)
    expect(f.terreno.wet.length).toBe(CELDAS_POR_CHUNK)
    expect(f.terreno.cover.length).toBe(CELDAS_POR_CHUNK)
    for (let i = 0; i < CELDAS_POR_CHUNK; i++) {
      expect(f.terreno.wet[i]).toBeGreaterThanOrEqual(0)
      expect(f.terreno.wet[i]).toBeLessThanOrEqual(1000)
      expect(f.terreno.cover[i]).toBeGreaterThanOrEqual(0)
      expect(f.terreno.cover[i]).toBeLessThanOrEqual(1000)
    }
  })

  it('lo suelto cae adentro del chunk, en tierra, y solo de lo que el bioma tiene', () => {
    for (let cx = -6; cx <= 6; cx++) {
      for (let cy = -6; cy <= 6; cy++) {
        const f = resolveChunk(SEMILLA, cx, cy)
        for (const s of f.sueltas) {
          expect(f.sustancias.includes(s.substance)).toBe(true)
          expect(s.i).toBeGreaterThanOrEqual(0)
          expect(s.i).toBeLessThan(CELDAS_POR_CHUNK)
          expect(tieneAgua(f.terreno, s.i), 'algo tirado en el agua').toBe(false)
          expect(s.masa).toBeGreaterThan(0)
        }
      }
    }
  })

  it('el presupuesto calórico es el del bioma y la fertilidad, y nada más', () => {
    for (let cx = -5; cx <= 5; cx++) {
      const f = resolveChunk(SEMILLA, cx, 3)
      expect(f.presupuestoCalorico).toBe(caloricBudget(f.bioma, f.clima.fertilidad))
    }
  })

  it('el clima que se ve solo es el mismo que el del chunk decretado', () => {
    for (let cx = -5; cx <= 5; cx++) {
      const f = resolveChunk(SEMILLA, cx, -2)
      expect(climaDe(SEMILLA, cx, -2)).toEqual(f.clima)
    }
  })

  it('el mapa tiene variedad: varios biomas en una caminata', () => {
    const vistos = new Set<string>()
    for (let cx = -60; cx <= 60; cx += 2) for (let cy = -60; cy <= 60; cy += 2) vistos.add(resolveChunk(SEMILLA, cx, cy).bioma.id)
    expect(vistos.size).toBeGreaterThanOrEqual(4)
  })

  it('el agua es CONTINUA cruzando el borde de dos chunks del mismo bioma', () => {
    // Es lo que hace que un cuerpo de agua sea una componente conexa de verdad y
    // no un charco por chunk. Se compara la última columna de un chunk contra la
    // primera del de al lado: si el agua saliera del dado del chunk, la
    // correlación entre esas dos columnas sería la de dos sorteos ajenos.
    let pares = 0
    let iguales = 0
    for (let cx = -20; cx <= 20; cx++) {
      for (let cy = -20; cy <= 20; cy++) {
        const a = resolveChunk(SEMILLA, cx, cy)
        const b = resolveChunk(SEMILLA, cx + 1, cy)
        if (a.bioma.id !== b.bioma.id) continue
        for (let ly = 0; ly < CELDAS_DE_LADO; ly++) {
          const izq = tieneAgua(a.terreno, indiceLocal(CELDAS_DE_LADO - 1, ly))
          const der = tieneAgua(b.terreno, indiceLocal(0, ly))
          pares++
          if (izq === der) iguales++
        }
      }
    }
    expect(pares).toBeGreaterThan(1000)
    expect(iguales / pares).toBeGreaterThan(0.95)
  })

  it('NINGÚN chunk acuático queda seco, y ningún bioma sin agua se moja', () => {
    // Un pantano sin una gota es una contradicción que se paga lejos de acá: la
    // regla de resolubilidad se dispara por `bioma.acuatico` y buscaría con qué
    // pescar en un chunk sin agua. Sin el charco garantizado, esto fallaba en el
    // 44% de los chunks acuáticos de este mismo barrido.
    let acuaticos = 0
    let secosVerificados = 0
    for (let cx = -60; cx <= 60; cx += 2) {
      for (let cy = -60; cy <= 60; cy += 2) {
        const f = resolveChunk(SEMILLA, cx, cy)
        let celdas = 0
        for (let i = 0; i < CELDAS_POR_CHUNK; i++) if (tieneAgua(f.terreno, i)) celdas++
        if (f.bioma.acuatico) {
          acuaticos++
          expect(celdas, `${f.bioma.id} en ${String(cx)},${String(cy)} sin una gota`).toBeGreaterThan(0)
        }
        if (f.bioma.nivelDeAguaPorMil === 0) {
          secosVerificados++
          expect(celdas, `${f.bioma.id} con agua`).toBe(0)
        }
      }
    }
    expect(acuaticos).toBeGreaterThan(20)
    expect(secosVerificados).toBeGreaterThan(20)
  })

  it('el nivel de agua sube con la humedad y baja con la altura', () => {
    const pantano = biomaDe('pantano')
    const alto = nivelDeAgua(pantano, { humedad: fx(0.7), fertilidad: fx(0.5), altura: fx(0.1) })
    const bajo = nivelDeAgua(pantano, { humedad: fx(0.7), fertilidad: fx(0.5), altura: fx(0.75) })
    expect(alto).toBeGreaterThan(bajo)
    const humedo = nivelDeAgua(pantano, { humedad: fx(0.95), fertilidad: fx(0.5), altura: fx(0.3) })
    const menos = nivelDeAgua(pantano, { humedad: fx(0.55), fertilidad: fx(0.5), altura: fx(0.3) })
    expect(humedo).toBeGreaterThan(menos)
    // Un bioma sin agua no la gana por ser húmedo: el cero del bioma manda.
    expect(nivelDeAgua(biomaDe('roquedal'), { humedad: fx(1), fertilidad: fx(1), altura: fx(0) })).toBe(0)
  })
})

describe('los stocks, con integración perezosa', () => {
  function río(amount: number, perMille: number, at = 0): Stock {
    return crearStock({
      id: 'arroyo-1',
      yields: 'pescado',
      cx: 0,
      cy: 0,
      masaPorUnidad: fx(1),
      capacity: 12,
      perMillePorSegundo: perMille,
      depth: fx(2),
      atSecond: seg(at),
      amount,
    })
  }

  it('materializar en el segundo 2 o en el 398 da EXACTAMENTE lo mismo', () => {
    const temprano = río(0, 30)
    const tarde = río(0, 30)
    // Al primero se lo mira todo el tiempo; al segundo, nunca hasta el final.
    for (let t = 1; t <= 398; t++) population(temprano, seg(t))
    expect(population(temprano, seg(398))).toBe(population(tarde, seg(398)))
  })

  it('mirar no cambia nada: `population` no muta el stock', () => {
    const s = río(3, 100)
    const antes = JSON.stringify(s)
    for (let t = 0; t < 500; t += 7) population(s, seg(t))
    expect(JSON.stringify(s)).toBe(antes)
  })

  it('crece a la tasa dicha, en segundos de mundo y no en ticks', () => {
    // 500 milésimas por segundo = uno cada dos segundos. Que sea por SEGUNDO es
    // el ADR II-0008: con la tasa por tick, bajar la frecuencia para que el
    // juego corriera mejor habría hecho que el río se repusiera más lento.
    const s = río(0, 500)
    expect(population(s, seg(1))).toBe(0)
    expect(population(s, seg(2))).toBe(1)
    expect(population(s, seg(3))).toBe(1)
    expect(population(s, seg(4))).toBe(2)
  })

  it('no pasa de la capacidad por más que pase el tiempo', () => {
    const s = río(0, 1000)
    expect(population(s, seg(11))).toBe(11)
    expect(population(s, seg(12))).toBe(12)
    expect(population(s, seg(100))).toBe(12)
    expect(population(s, seg(SEGUNDOS_MAXIMOS))).toBe(12)
  })

  it('con tasa cero no se repone nunca', () => {
    const s = río(4, 0)
    expect(population(s, seg(1e6))).toBe(4)
  })

  it('no repone hacia atrás: preguntar por el pasado devuelve lo que había', () => {
    const s = río(5, 100, 100)
    expect(population(s, seg(50))).toBe(5)
    expect(population(s, seg(100))).toBe(5)
  })

  it('es monótona en el tiempo, muestreada fina o gruesa', () => {
    const s = río(0, 137)
    let anterior = 0
    for (let t = 0; t <= 400; t++) {
      const v = population(s, seg(t))
      expect(v).toBeGreaterThanOrEqual(anterior)
      anterior = v
    }
  })

  it('el muestreo sub-segundo no adelanta ni atrasa al del segundo entero', () => {
    // El mundo pregunta en instantes de tick (0,05 s a 20 Hz), no en segundos
    // redondos. Que el valor en t = 4 sea el mismo llegando por veinte pasos de
    // 0,05 o preguntando de una es lo que hace que el hash no dependa de la
    // frecuencia con la que se lo miró.
    const s = río(0, 250)
    // Los instantes de tick a 20 Hz, uno por uno: en ninguno la cuenta se
    // adelanta al segundo entero que le corresponde.
    for (let paso = 0; paso <= 400; paso++) {
      const t = seg(Math.round(paso * 50000) / 1_000_000)
      expect(population(s, t)).toBe(Math.min(12, Math.floor((250 * Math.round(t * 1e6)) / 1e9)))
    }
    expect(population(s, seg(4.05))).toBe(1)
    expect(population(s, seg(3.95))).toBe(0)
  })

  it('un stock viejísimo no desborda: la cuenta se acota antes de multiplicar', () => {
    const s = crearStock({
      id: 'mar',
      yields: 'pescado',
      cx: 0,
      cy: 0,
      masaPorUnidad: fx(1),
      capacity: CAPACIDAD_MAXIMA,
      perMillePorSegundo: PER_MILLE_MAXIMO,
      depth: fx(4),
      atSecond: seg(0),
      amount: 0,
    })
    expect(population(s, seg(SEGUNDOS_MAXIMOS))).toBe(CAPACIDAD_MAXIMA)
    expect(Number.isInteger(population(s, seg(12345.678901)))).toBe(true)
  })

  it('`crearStock` rechaza lo que rompería la exactitud', () => {
    const base = { id: 'x', yields: 'pescado', cx: 0, cy: 0, masaPorUnidad: fx(1), depth: fx(1), atSecond: seg(0) }
    expect(() => crearStock({ ...base, capacity: -1, perMillePorSegundo: 1, amount: 0 })).toThrow(/capacidad/)
    expect(() => crearStock({ ...base, capacity: CAPACIDAD_MAXIMA + 1, perMillePorSegundo: 1, amount: 0 })).toThrow(/capacidad/)
    expect(() => crearStock({ ...base, capacity: 5, perMillePorSegundo: 1, amount: 6 })).toThrow(/cantidad/)
    expect(() => crearStock({ ...base, capacity: 5, perMillePorSegundo: 1.5, amount: 1 })).toThrow(/reposición/)
    expect(() => crearStock({ ...base, capacity: 5, perMillePorSegundo: 1, amount: 1, atSecond: seg(-1) })).toThrow(/rango/)
  })

  it('sacar re-ancla la marca: el río no da más de lo que puede', () => {
    const s = río(1, 500)
    expect(retirarUno(s, seg(0))).toBe('pescado')
    expect(s.amount).toBe(0)
    // Si la marca no se re-anclara, la reposición se seguiría contando desde el
    // segundo 0 y en el segundo 4 habría dos en vez de uno.
    expect(population(s, seg(2))).toBe(1)
    expect(population(s, seg(4))).toBe(2)
  })

  it('sacar de un stock vacío devuelve null y no deja el stock en negativo', () => {
    const s = río(0, 0)
    expect(retirarUno(s, seg(10))).toBe(null)
    expect(s.amount).toBe(0)
  })

  it('sacar todo lo que hay lo agota, y el tiempo lo repone', () => {
    const s = río(3, 100)
    expect(retirarUno(s, seg(1))).toBe('pescado')
    expect(retirarUno(s, seg(1))).toBe('pescado')
    expect(retirarUno(s, seg(1))).toBe('pescado')
    expect(retirarUno(s, seg(1))).toBe(null)
    expect(population(s, seg(11))).toBe(1)
  })
})

describe('la geometría del chunk', () => {
  it('el índice local es por filas, igual que el de `@anima/world`', () => {
    expect(indiceLocal(0, 0)).toBe(0)
    expect(indiceLocal(1, 0)).toBe(1)
    expect(indiceLocal(0, 1)).toBe(CELDAS_DE_LADO)
    expect(indiceLocal(CELDAS_DE_LADO - 1, CELDAS_DE_LADO - 1)).toBe(CELDAS_POR_CHUNK - 1)
  })

  it('`tieneAgua` lanza fuera del chunk en vez de contestar cualquier cosa', () => {
    const f = resolveChunk(SEMILLA, 0, 0)
    expect(() => tieneAgua(f.terreno, CELDAS_POR_CHUNK)).toThrow(/fuera del chunk/)
  })

  it('un bioma seco de la tabla no tiene una sola celda de agua', () => {
    expect(biomaDe('roquedal').nivelDeAguaPorMil).toBe(0)
    expect(biomaDe('arenal').nivelDeAguaPorMil).toBe(0)
  })
})
