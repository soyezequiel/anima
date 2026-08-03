/**
 * LA CANTIDAD ENTRA AL LENGUAJE DE OBJETIVOS — C3, y el `some` que la comía.
 *
 * ─── LA MEDICIÓN QUE LO PIDIÓ ───────────────────────────────────────────────
 *
 * La frase del criterio del C3 dice «juntá DOS troncos», y salía
 * `holding(tag:fibroso)`: **el dos se perdía entero y en silencio**. `cumple`
 * contesta la forma `sostiene` con un `some` sobre la mano, o sea que el pedido
 * quedaba cumplido con el primero. Y no había forma de escribirlo: `count>=2`
 * daba `undefined` en `interpretar`.
 *
 * ─── LO QUE ESTE ARCHIVO CUIDA, Y NO ES LA LECTURA ──────────────────────────
 *
 * Que la cuenta **ordene el índice**. Agregar vocabulario que el índice no
 * distingue es peor que no tenerlo: el esquema que promete agarrar UNO
 * contestaría un pedido de DOS, y la criatura diría «dale, voy» sobre algo que
 * no sabe hacer. Ese es el bloque de `implica`, y es el que importa.
 */

import { describe, expect, it } from 'vitest'
import { firmaDe, implica, interpretar, textoDe } from '../src/predicado.js'

/** El predicado de «dos cosas fibrosas en la mano», escrito como se escribe. */
const DOS = 'holding(tag:fibroso,count>=2)'

describe('la cuenta se lee, se escribe y vuelve igual', () => {
  it('`count>=2` adentro de la mano se entiende', () => {
    const p = interpretar(DOS)
    expect(p?.k).toBe('sostiene')
    expect(p?.k === 'sostiene' ? p.cuantos : undefined).toBe(2)
  })

  it('IDA Y VUELTA: lo que se lee se escribe igual', () => {
    expect(textoDe(interpretar(DOS) as NonNullable<ReturnType<typeof interpretar>>)).toBe(DOS)
    expect(firmaDe(DOS)).toBe(DOS)
  })

  it('`count>1` es `count>=2`: una sola escritura canónica', () => {
    // Son cuerpos, o sea enteros, así que la conversión es exacta. Sin
    // normalizar, el índice tendría dos llaves para el mismo pedido.
    expect(firmaDe('holding(tag:fibroso,count>1)')).toBe(DOS)
  })

  it('UNO NO SE ESCRIBE, porque es lo que ya se pedía', () => {
    expect(firmaDe('holding(tag:fibroso,count>=1)')).toBe('holding(tag:fibroso)')
  })

  it('la cuenta se ordena con las otras condiciones, no aparte', () => {
    const a = firmaDe('holding(tag:carnoso,count>=2,toxicity<=0.05)')
    const b = firmaDe('holding(tag:carnoso,toxicity<=0.05,count>=2)')
    expect(a).toBe(b)
  })

  it('UN MÁXIMO NO ES UN OBJETIVO y se rechaza', () => {
    // «No tengas más de uno» es una restricción, y `objetivosDe` ya rechaza las
    // prohibiciones con el mismo argumento: `GoalNode` no tiene signo y el
    // planificador iría a cumplirla.
    expect(interpretar('holding(tag:fibroso,count<=1)')).toBeUndefined()
    expect(interpretar('holding(tag:fibroso,count<3)')).toBeUndefined()
  })

  it('y lo mal escrito se rechaza en vez de colarse como cualidad', () => {
    expect(interpretar('holding(tag:fibroso,count>=0)')).toBeUndefined()
    expect(interpretar('holding(tag:fibroso,count>=1.5)')).toBeUndefined()
    expect(interpretar('holding(tag:fibroso,count>=x)')).toBeUndefined()
    // Y fuera de la mano no quiere decir nada: `count>=2` a secas no dice de qué
    // dos habla.
    expect(interpretar('count>=2')).toBeUndefined()
  })
})

describe('EL PORTÓN: la cuenta ordena el índice', () => {
  it('AGARRAR UNO NO CONTESTA UN PEDIDO DE DOS', () => {
    // Es la línea que hace que esto sirva. Sin ella, el esquema que promete
    // `holding(tag:fibroso)` cubriría el pedido de dos y la criatura diría «dale,
    // voy» sobre algo que no sabe hacer.
    const uno = interpretar('holding(tag:fibroso)')
    const dos = interpretar(DOS)
    expect(implica(uno as never, dos as never)).toBe(false)
  })

  it('y tener DOS sí contesta un pedido de uno', () => {
    const uno = interpretar('holding(tag:fibroso)')
    const dos = interpretar(DOS)
    expect(implica(dos as never, uno as never)).toBe(true)
  })

  it('tres cubre dos, y dos no cubre tres', () => {
    const dos = interpretar(DOS) as never
    const tres = interpretar('holding(tag:fibroso,count>=3)') as never
    expect(implica(tres, dos)).toBe(true)
    expect(implica(dos, tres)).toBe(false)
  })

  it('sigue siendo reflexiva, que es de lo que dependía lo que ya andaba', () => {
    const p = interpretar(DOS) as never
    expect(implica(p, p)).toBe(true)
  })

  it('y la cuenta no salva un tag distinto', () => {
    const a = interpretar('holding(tag:fibroso,count>=5)') as never
    const b = interpretar('holding(tag:carnoso)') as never
    expect(implica(a, b)).toBe(false)
  })
})
