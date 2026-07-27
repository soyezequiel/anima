// ─── LA LEY QUE FALTABA: `agua → Stock` ─────────────────────────────────────
//
// `pesca.ts` es la pieza que el Hito 3 dejó sin escribir: `resolverAlPescar(agua,
// resolver)` le pedía el `resolver` al llamador y **ese resolver no existía en
// ningún `src/`** — los dos únicos usos del repo estaban en tests, con un
// `() => stock({...})` a mano. O sea que el río no tenía peces y nadie lo notaba
// porque nadie pescaba.
//
// Lo que se verifica acá es lo que hace que una ley sea una ley y no una tabla:
//
//   1. es PURA — la misma pregunta da el mismo stock hoy y dentro de mil ticks;
//   2. sale del BIOMA — la especie, la capacidad y la profundidad se explican por
//      la tabla y por el clima, no por una fila por situación;
//   3. sabe decir QUE NO — un charco en la pradera no tiene peces;
//   4. sus números CIERRAN contra el techo calórico, que es lo único que impide
//      que un río sea comida infinita.
//
// Y el dado del mundo, que es lo otro que este frente agregó al oráculo.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, seg, type Physics } from '@anima/physics'

import { biomaDe, biomaPorClima } from '../src/bioma.js'
import { decretarChunk, pozoLocal } from '../src/decreto.js'
import { climaDe, population, resolveChunk, retirarUno, tieneAgua } from '../src/ley.js'
import {
  especiesDe,
  MASA_MAXIMA_RAW,
  MASA_MINIMA_RAW,
  SEGUNDOS_PARA_LLENAR,
  stockDeAgua,
  type Pozo,
} from '../src/pesca.js'
import { caloricBudget } from '../src/bioma.js'
import { milicaloriasDe } from '../src/presupuesto.js'
import { dadoDelMundo, mulberry32, waterCellKey } from '../src/index.js'

const PHYS: Physics = buildSeedPhysics()
const SEMILLA = 20260727n

/** Los chunks con agua de un barrido, con su pozo ya armado. Es el banco de
 *  pruebas de todo el archivo: nada de acá está inventado a mano. */
function pozosDelBarrido(radio: number): readonly { readonly pozo: Pozo; readonly bioma: string }[] {
  const out: { pozo: Pozo; bioma: string }[] = []
  for (let cx = -radio; cx <= radio; cx++) {
    for (let cy = -radio; cy <= radio; cy++) {
      const c = resolveChunk(SEMILLA, cx, cy)
      const { pozo, celdas } = pozoLocal(SEMILLA, cx, cy, c.terreno)
      if (pozo === null) continue
      const x = cx * 16 + (pozo % 16)
      const y = cy * 16 + Math.floor(pozo / 16)
      out.push({ pozo: { id: waterCellKey(x, y), cx, cy, celdas }, bioma: c.bioma.id })
    }
  }
  return out
}

// ─── El pozo: dónde está el agua ────────────────────────────────────────────

describe('pozoLocal: dónde está el agua y cuánta hay', () => {
  it('la celda que devuelve es AGUA, y el conteo es el conteo', () => {
    let mirados = 0
    for (let cx = -8; cx <= 8; cx++) {
      for (let cy = -8; cy <= 8; cy++) {
        const c = resolveChunk(SEMILLA, cx, cy)
        const { pozo, celdas } = pozoLocal(SEMILLA, cx, cy, c.terreno)
        let aMano = 0
        for (let i = 0; i < 256; i++) if (tieneAgua(c.terreno, i)) aMano++
        expect(celdas).toBe(aMano)
        if (aMano === 0) {
          expect(pozo).toBeNull()
        } else {
          expect(pozo).not.toBeNull()
          expect(tieneAgua(c.terreno, pozo as number)).toBe(true)
          mirados++
        }
      }
    }
    expect(mirados).toBeGreaterThan(20)
    console.log(`pozoLocal · ${String(mirados)} chunks con agua en 17×17, todos con su pozo en una celda mojada`)
  })

  it('un chunk ENTERAMENTE inundado tiene pozo aunque no tenga orilla', () => {
    // Es el caso que importa y no el raro: el 88,8% de los chunks de `agua-dulce`
    // está enteramente bajo el agua. Si el pozo dependiera de la orilla, casi
    // ningún lago tendría peces y sólo se pescaría en los charcos.
    let inundados = 0
    let conPozo = 0
    for (let cx = -10; cx <= 10; cx++) {
      for (let cy = -10; cy <= 10; cy++) {
        const d = decretarChunk(SEMILLA, cx, cy, [...PHYS.processes.values()], PHYS)
        if (d.celdasDeAgua !== 256) continue
        inundados++
        expect(d.orilla).toBeNull()
        if (d.pozo !== null) conPozo++
      }
    }
    console.log(`pozoLocal · ${String(inundados)} chunks enteramente inundados, ${String(conPozo)} con pozo`)
    expect(inundados).toBeGreaterThan(0)
    expect(conPozo).toBe(inundados)
  })

  it('y prefiere la celda que DA A TIERRA, para que se pueda llegar', () => {
    // La criatura pesca desde una celda seca a radio 1 del banco. Un banco en el
    // medio de un lago de 200 celdas sería pescado que nadie puede alcanzar.
    let conBorde = 0
    let daATierra = 0
    for (const { pozo } of pozosDelBarrido(8)) {
      if (pozo.celdas === 256) continue
      conBorde++
      const c = resolveChunk(SEMILLA, pozo.cx, pozo.cy)
      const i = (pozo.id.split(',').map(Number) as [number, number]).map((v) => ((v % 16) + 16) % 16)
      const li = (i[1] as number) * 16 + (i[0] as number)
      const lx = li % 16
      const ly = Math.floor(li / 16)
      const seco = [
        [0, -1],
        [-1, 0],
        [1, 0],
        [0, 1],
      ].some(([dx, dy]) => {
        const x = lx + (dx as number)
        const y = ly + (dy as number)
        if (x < 0 || y < 0 || x > 15 || y > 15) return true
        return !tieneAgua(c.terreno, y * 16 + x)
      })
      if (seco) daATierra++
    }
    console.log(`pozoLocal · ${String(daATierra)} de ${String(conBorde)} pozos de chunks NO inundados dan a tierra`)
    expect(daATierra).toBe(conBorde)
  })
})

// ─── La ley ─────────────────────────────────────────────────────────────────

describe('stockDeAgua: una ley pura, del bioma y de la semilla', () => {
  it('es PURA: la misma pregunta, dos veces, da exactamente lo mismo', () => {
    // Es la regla madre del dios perezoso aplicada al stock: materializar el
    // chunk en el segundo 2 o en el 20 000 tiene que dar lo mismo.
    for (const { pozo } of pozosDelBarrido(5)) {
      const a = stockDeAgua(SEMILLA, pozo, PHYS)
      const b = stockDeAgua(SEMILLA, pozo, PHYS)
      expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    }
  })

  it('y depende de la semilla, o no dependería de nada', () => {
    const pozo = pozosDelBarrido(5)[0]?.pozo
    expect(pozo).toBeDefined()
    const a = stockDeAgua(SEMILLA, pozo as Pozo, PHYS)
    const b = stockDeAgua(SEMILLA + 1n, pozo as Pozo, PHYS)
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })

  it('la especie sale del TAG `carnoso` del catálogo, no de una lista de peces', () => {
    // `agua-dulce` tiene pescado y molusco; `pantano`, molusco; `pradera`, nada.
    // Lo que hace comestible a algo es una propiedad de la materia, no una fila.
    expect([...especiesDe(biomaDe('agua-dulce'), PHYS)]).toEqual(['pescado', 'molusco'])
    expect([...especiesDe(biomaDe('pantano'), PHYS)]).toEqual(['molusco'])
    expect([...especiesDe(biomaDe('pradera'), PHYS)]).toEqual(['carne'])
    expect([...especiesDe(biomaDe('roquedal'), PHYS)]).toEqual([])
  })

  it('un charco donde no vive nada extraíble devuelve `null`, y no un stock vacío', () => {
    // Un stock de capacidad cero pasaría `crearStock` y después `p` sería una
    // división por cero. Y además mentiría: no es que el pozo esté vacío, es que
    // nunca tuvo.
    const enRoquedal: Pozo = { id: '0,0', cx: 0, cy: 0, celdas: 4 }
    // Se busca un chunk de bioma sin nada carnoso, en vez de inventarlo. El radio
    // es 60 y no 20 porque MEDIDO: en 41×41 chunks de esta semilla no aparece ni
    // un `matorral`, `roquedal` ni `arenal`, que son los tres biomas sin nada
    // carnoso. El campo de clima es continuo y esta semilla cae en una zona
    // húmeda; los biomas secos están más lejos.
    let probado = false
    for (let cx = -60; cx <= 60 && !probado; cx++) {
      for (let cy = -60; cy <= 60 && !probado; cy++) {
        const b = biomaPorClima(climaDe(SEMILLA, cx, cy))
        if (especiesDe(b, PHYS).length > 0) continue
        expect(stockDeAgua(SEMILLA, { ...enRoquedal, cx, cy }, PHYS)).toBeNull()
        console.log(`stockDeAgua · ${b.id} en (${String(cx)}, ${String(cy)}) no tiene nada extraíble: null`)
        probado = true
      }
    }
    expect(probado).toBe(true)
    // Y un pozo de cero celdas tampoco, sea cual sea el bioma.
    const conAgua = pozosDelBarrido(5)[0]?.pozo as Pozo
    expect(stockDeAgua(SEMILLA, { ...conAgua, celdas: 0 }, PHYS)).toBeNull()
  })

  it('el pozo nace LLENO y con la marca en cero: no tiene una historia que no vivió', () => {
    for (const { pozo } of pozosDelBarrido(4)) {
      const s = stockDeAgua(SEMILLA, pozo, PHYS)
      if (s === null) continue
      expect(s.amount).toBe(s.capacity)
      expect(s.atSecond).toBe(0)
      expect(s.id).toBe(pozo.id)
      expect(s.cx).toBe(pozo.cx)
      expect(s.cy).toBe(pozo.cy)
    }
  })

  it('más agua y más fertilidad, más peces: la capacidad se explica', () => {
    // No se compara contra una tabla de valores esperados —eso sería copiar la
    // implementación— sino contra la MONOTONÍA, que es lo que la ley promete.
    const base: Pozo = { id: '5,5', cx: 0, cy: 0, celdas: 10 }
    const chico = stockDeAgua(SEMILLA, base, PHYS)
    const grande = stockDeAgua(SEMILLA, { ...base, celdas: 200 }, PHYS)
    if (chico === null || grande === null) throw new Error('el chunk (0,0) no da especie')
    expect(grande.capacity).toBeGreaterThan(chico.capacity)
    // Y la MASA POR PIEZA no cambia con el tamaño del pozo: un lago no tiene
    // peces más gordos, tiene más peces.
    expect(grande.masaPorUnidad).toBe(chico.masaPorUnidad)
    console.log(
      `stockDeAgua · 10 celdas → ${String(chico.capacity)} piezas · 200 celdas → ${String(grande.capacity)} piezas`,
    )
  })

  it('la masa de una pieza cae en el rango declarado, en las dos puntas', () => {
    let min = Infinity
    let max = -Infinity
    let cuantos = 0
    for (const { pozo } of pozosDelBarrido(10)) {
      const s = stockDeAgua(SEMILLA, pozo, PHYS)
      if (s === null) continue
      cuantos++
      if (s.masaPorUnidad < min) min = s.masaPorUnidad
      if (s.masaPorUnidad > max) max = s.masaPorUnidad
    }
    console.log(`stockDeAgua · ${String(cuantos)} pozos · masa por pieza entre ${String(min)} y ${String(max)} (Fixed)`)
    expect(min).toBeGreaterThanOrEqual(MASA_MINIMA_RAW)
    expect(max).toBeLessThanOrEqual(MASA_MAXIMA_RAW)
    // Y usa el rango de verdad: si todos salieran iguales, el dado no estaría
    // haciendo nada.
    expect(max - min).toBeGreaterThan((MASA_MAXIMA_RAW - MASA_MINIMA_RAW) / 2)
  })

  it('un pozo vacío tarda un DÍA de mundo en llenarse, a la milésima', () => {
    // La tasa se deriva de la capacidad y no al revés: lo que se quiere fijar es
    // el TIEMPO de recuperación, no la velocidad. Con la velocidad fija, un pozo
    // grande tardaría diez días y uno chico un rato.
    let peor = 0
    for (const { pozo } of pozosDelBarrido(8)) {
      const s = stockDeAgua(SEMILLA, pozo, PHYS)
      if (s === null) continue
      const vacio = { ...s, amount: 0 }
      expect(population(vacio, seg(SEGUNDOS_PARA_LLENAR))).toBe(s.capacity)
      // Y no antes de tiempo: a la mitad del día tiene menos de la capacidad,
      // salvo el pozo de UNA pieza, donde el redondeo hacia arriba de la tasa lo
      // llena antes y eso es correcto (una pieza no se puede repartir).
      const mitad = population(vacio, seg(SEGUNDOS_PARA_LLENAR / 2))
      if (s.capacity > 2) expect(mitad).toBeLessThan(s.capacity)
      const razon = mitad / s.capacity
      if (Math.abs(razon - 0.5) > peor) peor = Math.abs(razon - 0.5)
    }
    console.log(`stockDeAgua · a medio día de reposición, el peor pozo está a ${(peor * 100).toFixed(1)} pp del 50%`)
  })

  it('EL NÚMERO QUE CIERRA: un pozo lleno NO agota el techo calórico del chunk', () => {
    // Si el pozo lleno ya pasara el techo, la población sería decoración y el
    // único límite del mundo sería el libro. Si el pozo lleno fuera una gota del
    // techo, el techo sería el que no existiría. Lo que se mide es la RAZÓN.
    const razones: number[] = []
    const grandes: number[] = []
    for (const { pozo } of pozosDelBarrido(10)) {
      const s = stockDeAgua(SEMILLA, pozo, PHYS)
      if (s === null) continue
      const clima = climaDe(SEMILLA, pozo.cx, pozo.cy)
      const techo = caloricBudget(biomaPorClima(clima), clima.fertilidad) * 1000
      const razon = (s.capacity * milicaloriasDe(s.yields, s.masaPorUnidad, PHYS)) / techo
      razones.push(razon)
      // Un pozo GRANDE es medio chunk mojado para arriba. Es la escala del río de
      // verdad, y es la que tiene que valer algo.
      if (pozo.celdas >= 128) grandes.push(razon)
    }
    razones.sort((a, b) => a - b)
    grandes.sort((a, b) => a - b)
    const pc = (v: number | undefined): string => `${((v ?? 0) * 100).toFixed(2)}%`
    console.log(
      `stockDeAgua · ${String(razones.length)} pozos (${String(grandes.length)} grandes) · un pozo lleno vale, ` +
        `del techo calórico de su chunk: mín ${pc(razones[0])} · mediana ` +
        `${pc(razones[razones.length >> 1])} · máx ${pc(razones[razones.length - 1])} · ` +
        `y los grandes, mín ${pc(grandes[0])} · mediana ${pc(grandes[grandes.length >> 1])}`,
    )
    // NINGÚN pozo lleno agota el techo. Si lo agotara, la población sería
    // decoración y el único límite del mundo sería el libro.
    expect(razones[razones.length - 1]).toBeLessThan(0.6)
    // Y ESTO ES LO QUE HABÍA QUE REMEDIR: la primera versión de este test exigía
    // que TODO pozo valiera más del 0,5% del techo, y falla — el mínimo medido es
    // 0,07%. No es un bug: es un charco de una sola celda, que por el piso de
    // `stockDeAgua` tiene UNA pieza, en un chunk fértil con un techo grande. Un
    // charco de lluvia ES una gota al lado de lo que da un bosque, y que lo sea es
    // correcto. Lo que tiene que valer algo es el RÍO, y eso es lo que se mide.
    expect(grandes.length).toBeGreaterThan(20)
    expect(grandes[0]).toBeGreaterThan(0.01)
  })

  it('sacar del stock baja la población y re-ancla la marca, y no repone hacia atrás', () => {
    const pozo = pozosDelBarrido(5).find((p) => (stockDeAgua(SEMILLA, p.pozo, PHYS)?.capacity ?? 0) > 3)?.pozo
    expect(pozo).toBeDefined()
    const s = stockDeAgua(SEMILLA, pozo as Pozo, PHYS)
    if (s === null) throw new Error('sin stock')
    const cap = s.capacity
    expect(retirarUno(s, seg(10))).toBe(s.yields)
    expect(s.amount).toBe(cap - 1)
    expect(s.atSecond).toBe(10)
    // Preguntar por un instante ANTERIOR a la marca no resta: el estado del mundo
    // no viaja al pasado.
    expect(population(s, seg(5))).toBe(cap - 1)
  })
})

// ─── El dado del mundo ──────────────────────────────────────────────────────

describe('dadoDelMundo: el tipo nominal por fin tiene fábrica', () => {
  it('es la MISMA secuencia que `mulberry32`, o serían dos generadores', () => {
    // La razón de que `valorMulberry` esté factorizada: copiada dos veces,
    // cambiarle una constante a uno y no al otro no rompe ningún test —los dos
    // siguen dando números— y el día que se note es cuando un guardado viejo no
    // reproduce.
    const dios = mulberry32(12345)
    const mundo = dadoDelMundo(12345)
    for (let i = 0; i < 100; i++) expect(mundo.tirar()).toBe(dios())
  })

  it('el estado avanza con cada tirada, y retomarlo continúa la secuencia', () => {
    // Es lo que hace posible guardar el dado adentro del `WorldState`: el estado
    // es UN entero, y con ese entero la partida sigue igual que si no se hubiera
    // guardado nunca.
    const a = dadoDelMundo(999)
    const primeros = [a.tirar(), a.tirar(), a.tirar()]
    const guardado = a.estado()
    const siguientes = [a.tirar(), a.tirar()]

    const b = dadoDelMundo(guardado)
    expect([b.tirar(), b.tirar()]).toEqual(siguientes)
    // Y el estado inicial no es el de después de tirar, o guardar no serviría.
    expect(guardado).not.toBe(999)
    expect(primeros.every((v) => v >= 0 && v < 1)).toBe(true)
  })

  it('no tirar no lo mueve: PENSAR NO LE CORRE EL DADO A LA PARTIDA', () => {
    // La regla madre de `extraccion.ts`. Acá se verifica del lado del dado, que es
    // donde se puede romper sin que nadie lo vea.
    const d = dadoDelMundo(7)
    const antes = d.estado()
    expect(d.estado()).toBe(antes)
    expect(d.estado()).toBe(antes)
    d.tirar()
    expect(d.estado()).not.toBe(antes)
  })
})
