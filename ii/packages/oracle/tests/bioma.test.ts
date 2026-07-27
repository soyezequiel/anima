import { fx, SUSTANCIAS_POR_ID, T_AMBIENTE, type Fixed } from '@anima/physics'
import { describe, expect, it } from 'vitest'

import {
  BIOMAS,
  biomaDe,
  biomaPorClima,
  caloricBudget,
  CANTERA_DEL_MUNDO,
  FLEXIBILIDAD_DE_ATADURA,
  OCTAVAS_CLIMA,
  OCTAVAS_TERRENO,
  RIGIDEZ_DE_VARA,
  RUIDO_ESCALA,
  temperaturaDelBioma,
  valueNoise,
  type BiomaId,
  type Clima,
} from '../src/bioma.js'

const SEMILLA = 987654321n

function clima(h: number, f: number, a: number): Clima {
  return { humedad: fx(h), fertilidad: fx(f), altura: fx(a) }
}

describe('el ruido de valor', () => {
  it('es puro: la misma coordenada da lo mismo, siempre y en cualquier orden', () => {
    const antes: number[] = []
    for (let i = 0; i < 20; i++) antes.push(valueNoise(SEMILLA, i, -i))
    // Otra historia entre medio: se muestrea medio mapa en otro orden.
    for (let i = 100; i > -100; i--) valueNoise(SEMILLA, i, i)
    const despues: number[] = []
    for (let i = 0; i < 20; i++) despues.push(valueNoise(SEMILLA, i, -i))
    expect(despues).toEqual(antes)
  })

  it('se queda adentro de [0, 1] en un barrido grande, con coordenadas negativas', () => {
    for (let x = -200; x <= 200; x += 7) {
      for (let y = -200; y <= 200; y += 11) {
        const v = valueNoise(SEMILLA, x, y, OCTAVAS_TERRENO)
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1000)
      }
    }
  })

  it('es CONTINUO: dos vecinos no saltan de un extremo al otro', () => {
    // Es la propiedad que hace que haya biomas y no confeti. Con ruido blanco,
    // el salto medio entre vecinos sería ~333 milésimas; con interpolación tiene
    // que ser un orden de magnitud menor.
    let sumaSaltos = 0
    let n = 0
    let peor = 0
    for (let x = -60; x <= 60; x++) {
      for (let y = -60; y <= 60; y++) {
        const d = Math.abs(valueNoise(SEMILLA, x + 1, y, OCTAVAS_TERRENO) - valueNoise(SEMILLA, x, y, OCTAVAS_TERRENO))
        sumaSaltos += d
        peor = Math.max(peor, d)
        n++
      }
    }
    expect(sumaSaltos / n).toBeLessThan(40)
    expect(peor).toBeLessThan(250)
  })

  it('no es constante: recorre buena parte del rango', () => {
    let min = 1000
    let max = 0
    for (let x = -300; x <= 300; x += 3) {
      const v = valueNoise(SEMILLA, x, 0)
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
    expect(max - min).toBeGreaterThan(400)
  })

  it('dos semillas dan dos mapas', () => {
    let distintos = 0
    for (let x = 0; x < 100; x++) if (valueNoise(1n, x, 0) !== valueNoise(2n, x, 0)) distintos++
    expect(distintos).toBeGreaterThan(80)
  })

  it('rechaza períodos que no son potencia de dos, porque ahí la división redondearía', () => {
    expect(() => valueNoise(SEMILLA, 0, 0, [{ periodo: 3, peso: 1 }])).toThrow(/período/)
    expect(() => valueNoise(SEMILLA, 0, 0, [{ periodo: RUIDO_ESCALA * 2, peso: 1 }])).toThrow(/período/)
    expect(() => valueNoise(SEMILLA, 0, 0, [])).toThrow(/octava/)
    expect(() => valueNoise(SEMILLA, 0.5, 0)).toThrow(/entera/)
  })

  it('las octavas del clima son más gruesas que las del terreno', () => {
    const clim = OCTAVAS_CLIMA[0]?.periodo ?? 0
    const terr = OCTAVAS_TERRENO[0]?.periodo ?? 0
    expect(clim).toBeGreaterThan(terr)
  })
})

describe('la tabla de biomas', () => {
  it('todas sus sustancias existen en el catálogo de la física', () => {
    for (const b of BIOMAS) {
      for (const s of b.sustancias) expect(SUSTANCIAS_POR_ID.has(s), `${b.id} → ${s}`).toBe(true)
      for (const s of b.siembra) expect(b.sustancias.includes(s.substance), `${b.id} → ${s.substance}`).toBe(true)
    }
  })

  it('todo bioma acuático siembra con qué armar un aparejo — la resolubilidad, en la tabla', () => {
    // La verificación de radio 2 sobre el mundo decretado es otra cosa; ésta es
    // la que impide que el bioma acuático nazca sin materia prima, que es el
    // caso en el que aquélla no tendría nada que encontrar.
    for (const b of BIOMAS.filter((x) => x.acuatico)) {
      const flex = b.siembra.map((s) => SUSTANCIAS_POR_ID.get(s.substance)?.perUnitMass.flexibility ?? 0)
      const rig = b.siembra.map((s) => SUSTANCIAS_POR_ID.get(s.substance)?.perUnitMass.rigidity ?? 0)
      expect(Math.max(...flex), `${b.id} sin atadura`).toBeGreaterThanOrEqual(FLEXIBILIDAD_DE_ATADURA)
      expect(Math.max(...rig), `${b.id} sin vara`).toBeGreaterThanOrEqual(RIGIDEZ_DE_VARA)
    }
  })

  it('ningún bioma nombra la misma sustancia dos veces en su siembra', () => {
    for (const b of BIOMAS) {
      const ids = b.siembra.map((s) => s.substance)
      expect(new Set(ids).size, b.id).toBe(ids.length)
    }
  })

  it('`biomaDe` lanza con nombre ante un id que no existe', () => {
    expect(() => biomaDe('selva' as BiomaId)).toThrow(/desconocido/)
  })
})

describe('la clasificación por clima', () => {
  it('es TOTAL: no hay un solo clima sin bioma', () => {
    for (let h = 0; h <= 1000; h += 25) {
      for (let f = 0; f <= 1000; f += 25) {
        for (let a = 0; a <= 1000; a += 25) {
          const b = biomaPorClima({ humedad: h as Fixed, fertilidad: f as Fixed, altura: a as Fixed })
          expect(b.id.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('cubre todos los biomas de la tabla: ninguno es código muerto', () => {
    const vistos = new Set<BiomaId>()
    for (let h = 0; h <= 1000; h += 10) {
      for (let f = 0; f <= 1000; f += 10) {
        for (let a = 0; a <= 1000; a += 10) {
          vistos.add(biomaPorClima({ humedad: h as Fixed, fertilidad: f as Fixed, altura: a as Fixed }).id)
        }
      }
    }
    expect([...vistos].sort()).toEqual(BIOMAS.map((b) => b.id).sort())
  })

  it('lo bajo y mojado es agua, lo alto es roca, lo seco es arenal', () => {
    expect(biomaPorClima(clima(0.9, 0.5, 0.1)).id).toBe('agua-dulce')
    expect(biomaPorClima(clima(0.5, 0.5, 0.95)).id).toBe('roquedal')
    expect(biomaPorClima(clima(0.05, 0.9, 0.5)).id).toBe('arenal')
    expect(biomaPorClima(clima(0.75, 0.8, 0.5)).id).toBe('bosque-humedo')
  })

  it('es determinista y no consume nada', () => {
    const c = clima(0.55, 0.5, 0.5)
    const uno = biomaPorClima(c)
    for (let i = 0; i < 100; i++) expect(biomaPorClima(c)).toBe(uno)
  })
})

describe('el presupuesto calórico', () => {
  it('es una función pura del bioma y la fertilidad: mismo entrada, mismo techo', () => {
    for (const b of BIOMAS) {
      const uno = caloricBudget(b, fx(0.42))
      for (let i = 0; i < 20; i++) expect(caloricBudget(b, fx(0.42))).toBe(uno)
      expect(Number.isInteger(uno)).toBe(true)
    }
  })

  it('crece con la fertilidad y nunca baja', () => {
    for (const b of BIOMAS) {
      let anterior = -1
      for (let f = 0; f <= 1000; f += 50) {
        const v = caloricBudget(b, f as Fixed)
        expect(v).toBeGreaterThanOrEqual(anterior)
        anterior = v
      }
    }
  })

  it('el roquedal rinde mucho menos que el bosque húmedo, con la misma fertilidad', () => {
    expect(caloricBudget(biomaDe('roquedal'), fx(1))).toBeLessThan(caloricBudget(biomaDe('bosque-humedo'), fx(0)))
  })

  it('rechaza una fertilidad que no es una proporción', () => {
    expect(() => caloricBudget(biomaDe('bosque'), fx(1.5))).toThrow(/fertilidad/)
    expect(() => caloricBudget(biomaDe('bosque'), fx(-0.1))).toThrow(/fertilidad/)
  })
})

describe('la temperatura del bioma', () => {
  it('sale del ambiente de la física más el apartamiento del bioma', () => {
    for (const b of BIOMAS) expect(temperaturaDelBioma(b)).toBe(T_AMBIENTE + b.deltaTemperatura)
    expect(temperaturaDelBioma(biomaDe('arenal'))).toBeGreaterThan(temperaturaDelBioma(biomaDe('bosque-humedo')))
  })
})

// ─── La cantera del mundo ───────────────────────────────────────────────────

describe('la cantera del mundo: lo que se puede encontrar tirado en algún lado', () => {
  it('es exactamente la unión de las siembras, sin repetir', () => {
    // Se recalcula acá desde la tabla y se compara: si `CANTERA_DEL_MUNDO`
    // empezara a agregar cosas por su cuenta, esto lo dice.
    const esperada = new Set<string>()
    for (const b of BIOMAS) for (const s of b.siembra) esperada.add(s.substance)
    expect(new Set(CANTERA_DEL_MUNDO)).toEqual(esperada)
    expect(CANTERA_DEL_MUNDO.length).toBe(esperada.size)
    expect(CANTERA_DEL_MUNDO.length).toBe(17)
  })

  it('no tiene ni un líquido ni nada que no salga de la tabla', () => {
    // El agua está entre las `sustancias` de los biomas acuáticos —el lugar ES
    // de agua— y NO entre lo que sueltan, porque nadie encuentra un charco
    // tirado en el piso. Ésa es toda la diferencia, y es la que hacía falta.
    for (const s of CANTERA_DEL_MUNDO) {
      const sub = SUSTANCIAS_POR_ID.get(s)
      expect(sub, `la cantera nombra «${s}», que el catálogo no tiene`).toBeDefined()
      expect(sub?.tags).not.toContain('liquido')
    }
    expect(CANTERA_DEL_MUNDO).not.toContain('agua')
    expect(CANTERA_DEL_MUNDO).not.toContain('savia')
    // Y tampoco lo que es parte de un animal vivo: nadie deja plumas ni tendones
    // tirados. No hace falta prohibirlos: ningún bioma los siembra.
    for (const s of ['pluma', 'tendon', 'piel', 'huevo', 'carne', 'pescado']) {
      expect(CANTERA_DEL_MUNDO).not.toContain(s)
      expect(SUSTANCIAS_POR_ID.has(s), `«${s}» tiene que existir para que este test signifique algo`).toBe(true)
    }
  })

  it('siempre alcanza para un aparejo: hay atadura y hay vara', () => {
    // Es el chequeo que corre al CARGAR el módulo, repetido acá para que se lea
    // como criterio y no como efecto secundario de un import. Si la cantera se
    // quedara sin atadura, la garantía de resolubilidad no podría cerrar en
    // ningún chunk de ninguna semilla.
    const q = (id: string, k: 'rigidity' | 'flexibility'): number => SUSTANCIAS_POR_ID.get(id)?.perUnitMass[k] ?? 0
    expect(CANTERA_DEL_MUNDO.filter((s) => q(s, 'flexibility') >= FLEXIBILIDAD_DE_ATADURA).length).toBeGreaterThan(0)
    expect(CANTERA_DEL_MUNDO.filter((s) => q(s, 'rigidity') >= RIGIDEZ_DE_VARA).length).toBeGreaterThan(0)
  })
})
