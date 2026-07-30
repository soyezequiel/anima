// ─── LA FUENTE SE ELIGE POR CALOR ENTREGADO Y NO POR POTENCIA ────────────────
//
//   pnpm --filter @anima/world test tests/la-fuente-se-elige-por-calor.test.ts
//
// `Entorno` de la física acepta UNA fuente, así que `entornoDe` (`src/step.ts`)
// tiene que ordenar las que hay y quedarse con una. Hasta este tramo ordenaba por
// `emitsPower` —lo que la fuente EMITE— y la ley 1, dos líneas después, no usa eso:
// usa `potencia · formFactor(distancia, montaje)`. Ordenar por la mitad de la
// cuenta rompía la cocción de dos maneras distintas, las dos medidas acá:
//
//   1. LA FUENTE SECUESTRADA. `fuentes()` barre `d.bodies` entero y no tiene
//      ningún corte por distancia, así que un fuego más grande a SESENTA celdas le
//      ganaba el hueco a la brasa que la comida tenía apoyada debajo. El pescado
//      se quedaba en `digestibility` 0,3800 —el valor crudo del catálogo, o sea que
//      la ley 5 no corría un solo tick— y no había radio a partir del cual dejara
//      de pasar.
//   2. EL DESEMPATE POR ABECEDARIO. Con dos fuegos de potencia exactamente igual,
//      uno pegado a la comida y otro a seis celdas, decidía `compararTexto` del id:
//      la misma escena cocinaba o no según cómo se llamaran los cuerpos. Es
//      determinista y es arbitrario, y las dos juntas son lo peor: no se ve como
//      una corrida que varía, se ve como un mundo donde cocinar «a veces no anda».
//
// Las dos desaparecen con el MISMO arreglo y sin inventar ninguna constante: el
// radio de corte no hace falta porque el `(1 + d²)` de `formFactor` ya lo pone, y
// el desempate por id queda para el empate de verdad —misma potencia, mismo
// montaje, misma distancia—, que es donde tiene sentido.
//
// Este archivo mide las dos y además el orden que el arreglo NO tiene que romper:
// entre dos fuegos en el MISMO montaje y a la MISMA distancia sigue ganando el más
// grande, porque `formFactor` es el mismo factor para los dos.

import { describe, expect, it } from 'vitest'
import { formFactor, qualityOf, temperaturaDeEquilibrio } from '@anima/physics'
import type { QualityId } from '@anima/physics'

import { stepWorld } from '../src/step.js'
import type { WorldBody, WorldState } from '../src/step.js'
import { actor, criatura, cuerpo, enElPiso, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })
const num = (x: number): string => x.toFixed(4)
const log = (l: readonly string[]): void => {
  console.log(['', ...l, ''].join('\n'))
}

function q(w: WorldState, id: string, cual: QualityId): number {
  const c = w.bodies.get(id)
  if (c === undefined) throw new Error(`no está ${id}`)
  return qualityOf(c.body, cual, w.phys)
}

function correr(w0: WorldState, ticks: number): WorldState {
  let w = w0
  for (let i = 0; i < ticks; i++) w = stepWorld(w, []).state
  return w
}

/**
 * Un cuerpo YA ARDIENDO, y por qué se lo regala a 700 °C.
 *
 * Porque lo que este archivo mide es la ELECCIÓN de fuente, no el precio de
 * encender: pagar la fricción metería el techo de `stamina` en el medio de cada
 * medición. La ley 1 lo baja al régimen de la llama en los primeros ticks sola, y
 * `emitsPower` no depende de la temperatura de la fuente más que por el `step`
 * (`el-fuego-no-se-propaga.test.ts` lo mide: 350 y 700 °C entregan lo mismo).
 */
function ardiendo(id: string, sustancia: string, masa: number): WorldBody {
  return enElPiso(cuerpo(id, sustancia, masa, { temperature: 700 }), EN(0, 0))
}

/** La brasa buena, la comida encima, y otro fuego más grande a `d` celdas. */
function laEscenaDelSecuestro(d: number): WorldState {
  const brasa = ardiendo('brasa', 'madera', 0.4)
  const pez: WorldBody = {
    body: cuerpo('pez', 'pescado', 2, {}),
    at: EN(0, 0),
    supportedBy: 'brasa',
  }
  return mundo({
    bodies: [
      enElPiso(criatura('ana', 1000), EN(200, 200)),
      brasa,
      pez,
      { ...ardiendo('otro', 'madera', 1), at: EN(d, 0) },
    ],
    actors: [actor('ana')],
  })
}

const COCIDO = 0.85
/** La `digestibility` que el pescado trae del catálogo. Si no se movió, la ley 5 no corrió. */
const CRUDO = 0.38

describe('la fuente secuestrada: un fuego más grande, lejos, no le roba el lugar a la brasa', () => {
  it('el pescado apoyado en la brasa correcta COCINA con otro fuego a 1, 2, 5, 20 y 60 celdas', () => {
    const filas: string[] = ['d del otro fuego │ T del pez a los 15 s │ dig │ ¿cocinó?']
    const digs: number[] = []
    for (const d of [1, 2, 5, 20, 60]) {
      const t = correr(laEscenaDelSecuestro(d), 300)
      const dig = q(t, 'pez', 'digestibility')
      digs.push(dig)
      filas.push(
        `${String(d).padStart(16)} │ ${num(q(t, 'pez', 'temperature')).padStart(19)} │ ${num(dig)} │ ${dig >= COCIDO ? 'SÍ' : 'no'}`,
      )
    }
    // El control: la misma brasa y el mismo pescado, SIN el otro fuego.
    const solo = correr(
      mundo({
        bodies: [
          enElPiso(criatura('ana', 1000), EN(200, 200)),
          ardiendo('brasa', 'madera', 0.4),
          { body: cuerpo('pez', 'pescado', 2, {}), at: EN(0, 0), supportedBy: 'brasa' },
        ],
        actors: [actor('ana')],
      }),
      300,
    )
    const digSolo = q(solo, 'pez', 'digestibility')
    filas.push(
      '',
      `  sin el otro fuego (el control): dig ${num(digSolo)}`,
      '  ANTES del arreglo las cinco filas daban 0,3800 — el pescado crudo del catálogo — porque',
      '  `entornoDe` le daba el único hueco de `Fuente` al fuego de 1 kg y le calculaba `piso`.',
    )
    log(filas)

    // Las cinco cocinan, y cocinan LO MISMO que el control: el fuego lejano no
    // cambia nada, que es exactamente lo que la ley 1 dice cuando el `(1 + d²)` lo
    // deja atrás.
    for (const dig of digs) {
      expect(dig).toBeGreaterThanOrEqual(COCIDO)
      expect(dig).toBeCloseTo(digSolo, 6)
    }
    // Y el control cocina, o sea que la medición mide algo.
    expect(digSolo).toBeGreaterThanOrEqual(COCIDO)
    // El número que el bug dejaba: si volviera, esta línea es la que lo ve.
    for (const dig of digs) expect(dig).not.toBeCloseTo(CRUDO, 3)
  })

  it('y la razón, aritmética: el calor entregado del pegado le gana al del lejano en las cinco', () => {
    // No hace falta correr el mundo para verla, y vale escribirla porque es la
    // cuenta que el arreglo hace: `potencia · formFactor`. La brasa de 0,40 kg
    // emite 120,24 en `contacto` (0,60, distancia 0) y el fuego de 1 kg emite 300
    // en `piso` (0,06 / (1 + d²)).
    const filas: string[] = ['d │ calor de la brasa (contacto, d=0) │ calor del otro (piso, d) │ gana']
    for (const d of [1, 2, 5, 20, 60]) {
      const pegado = 120.24 * formFactor(0, 'contacto')
      const lejano = 300 * formFactor(d, 'piso')
      filas.push(
        `${String(d).padStart(2)} │ ${num(pegado).padStart(33)} │ ${num(lejano).padStart(24)} │ ${pegado > lejano ? 'la brasa' : 'EL OTRO'}`,
      )
      expect(pegado).toBeGreaterThan(lejano)
    }
    filas.push(
      '',
      '  Y por potencia sola, las cinco las ganaba el otro: 300 > 120,24 a cualquier distancia.',
      '  Ése es el bug en una línea: se ordenaba por la mitad de la cuenta que la ley 1 hace.',
    )
    log(filas)
    // Y el contrafáctico, que es lo que hay que dejar escrito: por potencia sola,
    // el lejano ganaba siempre.
    expect(300).toBeGreaterThan(120.24)
  })

  it('lo que NO se rompió: a igual montaje y distancia, sigue ganando el más grande', () => {
    // El arreglo no puede haber invertido el orden natural. Dos fuegos en el MISMO
    // montaje y a la MISMA distancia comparten el `formFactor`, así que el producto
    // los ordena igual que la potencia sola. La comida está apoyada en el chico
    // —o sea `contacto` con los dos, porque el grande está en la misma celda y
    // también la sostiene... no: el grande NO la sostiene, así que le toca
    // `parrilla` si está en la celda de su apoyo. Para que el montaje sea el mismo
    // se los pone a los dos a UNA celda, en el piso.
    const arma = (masaA: number, masaB: number): WorldState =>
      mundo({
        bodies: [
          enElPiso(criatura('ana', 1000), EN(200, 200)),
          { ...ardiendo('grande', 'madera', masaA), at: EN(1, 0) },
          { ...ardiendo('chico', 'madera', masaB), at: EN(-1, 0) },
          enElPiso(cuerpo('pez', 'pescado', 2, {}), EN(0, 0)),
        ],
        actors: [actor('ana')],
      })
    // Con los dos a una celda y en el piso, el que manda es el de más masa: el
    // pescado se calienta más con el grande de 3 kg que con dos chicos de 0,4.
    const conGrande = correr(arma(3, 0.4), 300)
    const dosChicos = correr(arma(0.4, 0.4), 300)
    const tG = q(conGrande, 'pez', 'temperature')
    const tC = q(dosChicos, 'pez', 'temperature')
    log([
      `dos fuegos a una celda, en el piso:`,
      `  grande 3,00 kg + chico 0,40 kg → el pez llega a ${num(tG)} °C`,
      `  chico  0,40 kg + chico 0,40 kg → el pez llega a ${num(tC)} °C`,
      `  predicho por la ley 1 para el grande: ${num(temperaturaDeEquilibrio(3 * 18 * 16.7, 1, 'piso'))} °C`,
    ])
    expect(tG).toBeGreaterThan(tC)
  })
})

describe('el empate: el abecedario ya no decide, y sigue habiendo un orden total', () => {
  /** Dos fuegos IGUALES: uno sosteniendo la comida, otro a seis celdas. */
  function laEscenaDelEmpate(contacto: string, lejano: string): WorldState {
    return mundo({
      bodies: [
        enElPiso(criatura('ana', 1000), EN(200, 200)),
        ardiendo(contacto, 'madera', 0.4),
        { body: cuerpo('pez', 'pescado', 2, {}), at: EN(0, 0), supportedBy: contacto },
        { ...ardiendo(lejano, 'madera', 0.4), at: EN(6, 0) },
      ],
      actors: [actor('ana')],
    })
  }

  it('con los ids al derecho y al revés, cocina en las dos', () => {
    const filas: string[] = ['fuego de contacto │ fuego a 6 celdas │ T del pez │ dig │ ¿cocinó?']
    const digs = new Map<string, number>()
    for (const [contacto, lejano] of [
      ['zorro', 'alfa'],
      ['alfa', 'zorro'],
    ] as const) {
      const t = correr(laEscenaDelEmpate(contacto, lejano), 300)
      const dig = q(t, 'pez', 'digestibility')
      digs.set(contacto, dig)
      filas.push(
        `${contacto.padStart(17)} │ ${lejano.padStart(16)} │ ${num(q(t, 'pez', 'temperature')).padStart(9)} │ ${num(dig)} │ ${dig >= COCIDO ? 'SÍ' : 'no'}`,
      )
    }
    filas.push(
      '',
      '  ANTES: `zorro` de contacto daba 0,3800 (crudo) y `alfa` de contacto daba 0,9438.',
      '  La misma geometría, la misma potencia, la misma distancia: decidía el nombre.',
    )
    log(filas)

    const conZorro = digs.get('zorro')
    const conAlfa = digs.get('alfa')
    if (conZorro === undefined || conAlfa === undefined) throw new Error('faltó una de las dos')
    expect(conZorro).toBeGreaterThanOrEqual(COCIDO)
    expect(conAlfa).toBeGreaterThanOrEqual(COCIDO)
    // Y no es que «casi» dan igual: dan el MISMO número, porque el nombre dejó de
    // entrar en la cuenta.
    expect(conZorro).toBeCloseTo(conAlfa, 12)
  })

  it('el empate DE VERDAD —mismo calor entregado— sigue desempatándose por id, y es estable', () => {
    // Dos fuegos idénticos, a la misma distancia, en el mismo montaje: acá el
    // calor entregado empata de verdad y el desempate por id es lo correcto. Lo que
    // hay que probar es que el resultado no depende del ORDEN en que los cuerpos
    // entraron al mundo, que es lo que el desempate existe para garantizar.
    const arma = (primero: string, segundo: string): WorldState =>
      mundo({
        bodies: [
          enElPiso(criatura('ana', 1000), EN(200, 200)),
          { ...ardiendo(primero, 'madera', 0.4), at: EN(1, 0) },
          { ...ardiendo(segundo, 'madera', 0.4), at: EN(-1, 0) },
          enElPiso(cuerpo('pez', 'pescado', 2, {}), EN(0, 0)),
        ],
        actors: [actor('ana')],
      })
    const alDerecho = correr(arma('alfa', 'zorro'), 300)
    const alReves = correr(arma('zorro', 'alfa'), 300)
    log([
      `dos fuegos empatados de verdad (misma masa, d=1, montaje piso):`,
      `  cuerpos en orden alfa→zorro: el pez queda en ${num(q(alDerecho, 'pez', 'temperature'))} °C`,
      `  cuerpos en orden zorro→alfa: el pez queda en ${num(q(alReves, 'pez', 'temperature'))} °C`,
    ])
    expect(q(alDerecho, 'pez', 'temperature')).toBe(q(alReves, 'pez', 'temperature'))
  })
})
