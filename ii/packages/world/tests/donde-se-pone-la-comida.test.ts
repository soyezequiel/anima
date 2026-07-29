// ─── DÓNDE SE PONE LA COMIDA ─────────────────────────────────────────────────
//
// El único criterio del Hito 5 que falta —sobrevivir 20.000 ticks— está reducido
// a un `gap` del planificador, medido en `mind/tests/hito-5-el-criterio.test.ts`:
//
//     gap · missing «emitsPower<410 & emitsPower>=253»
//           ningún esquema conocido establece «emitsPower<410»
//
// O sea: la mente sabe LIGAR un fuego, no sabe PEDIR uno de la potencia justa.
// Y la lectura obvia de ese gap —«hay que poder encender un fuego más grande»—
// es la equivocada, porque **la potencia no es la única variable libre**.
//
// Lo que la ley 1 entrega en régimen es
//
//     T_eq = ambiente + potencia · EXPOSICION[montaje] / (1 + d²) / H_PERDIDA
//
// y `EXPOSICION` tiene TRES filas —piso 0,06, parrilla 0,25, contacto 0,6— que se
// llevan un factor DIEZ entre las puntas. O sea que la misma fogata cocina, quema
// o no hace nada según DÓNDE se ponga la comida.
//
// Este archivo mide las tres, contra el techo real de lo que la criatura puede
// encender (0,7132 kg de madera → 214,4 de potencia, limitado por el tanque de
// `stamina`). Si alguna de las tres cae adentro de la ventana de cocción del
// pescado, el `gap` no se arregla encendiendo más fuerte: se arregla eligiendo
// dónde apoyar el pescado — que es, además, una de las nueve secuencias de
// emergencia del criterio («usar la parrilla en vez del piso»).

import { describe, expect, it } from 'vitest'
import { qualityOf, temperaturaDeEquilibrio, EXPOSICION } from '@anima/physics'
import type { Montaje } from '@anima/physics'

import { cuerpo, enElPiso, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

/**
 * El techo de lo que se puede encender frotando: `(1000 − 2,40) / (1,7 · 288 /
 * 0,35)`. Medido en `el-fuego.test.ts` (0,6 kg llega, 1,0 no) y usado en
 * `el-fuego-no-se-propaga.test.ts`.
 */
const TECHO_DE_LA_FRICCION = 0.7132

describe('la misma fogata, tres lugares', () => {
  it('LA TABLA: el fuego más grande que se puede encender, contra los tres montajes', () => {
    // Las tres cualidades del pescado salen del catálogo, no de acá.
    const w = mundo({
      bodies: [
        enElPiso(cuerpo('fuego', 'madera', TECHO_DE_LA_FRICCION, { temperature: 700 }), EN(0, 0)),
        enElPiso(cuerpo('pez', 'pescado', 2, { temperature: 15 }), EN(0, 0)),
      ],
    })
    const potencia = qualityOf(w.bodies.get('fuego')!.body, 'emitsPower', w.phys)
    const cocinaDesde = qualityOf(w.bodies.get('pez')!.body, 'denaturesAt', w.phys)
    const seQuemaEn = qualityOf(w.bodies.get('pez')!.body, 'ignitionPoint', w.phys)

    const filas: string[] = [
      '─── LA MISMA FOGATA, TRES LUGARES ───',
      `  el fuego más grande que se puede encender pesa ${TECHO_DE_LA_FRICCION.toFixed(4)} kg y entrega ${potencia.toFixed(2)} de potencia`,
      `  el pescado cocina entre ${cocinaDesde.toFixed(0)} y ${seQuemaEn.toFixed(0)} °C`,
      '',
      '  montaje  │ exposición │ T que le llega │ ¿qué le pasa?',
      '  ─────────┼────────────┼────────────────┼──────────────',
    ]

    const veredictos = new Map<Montaje, string>()
    for (const montaje of ['piso', 'parrilla', 'contacto'] as const) {
      const t = temperaturaDeEquilibrio(potencia, 0, montaje)
      const v = t < cocinaDesde ? 'no cocina' : t >= seQuemaEn ? 'SE QUEMA' : 'COCINA'
      veredictos.set(montaje, v)
      filas.push(
        `  ${montaje.padEnd(8)} │ ${EXPOSICION[montaje].toFixed(2).padStart(10)} │ ${t.toFixed(2).padStart(14)} │ ${v}`,
      )
    }
    log(filas)

    // ESTO ES LO QUE REORDENA EL PROBLEMA, y por eso se afirma fila por fila: con
    // el MISMO fuego, el piso se queda corto, el contacto se pasa, y la parrilla
    // —que es la de al medio y la que nadie programó— es la única que cocina.
    expect(veredictos.get('piso')).toBe('no cocina')
    expect(veredictos.get('contacto')).toBe('SE QUEMA')
    expect(veredictos.get('parrilla')).toBe('COCINA')
  })

  it('Y LA VENTANA DE POTENCIA DE CADA MONTAJE, que es lo que el plan tendría que pedir', () => {
    const w = mundo({ bodies: [enElPiso(cuerpo('pez', 'pescado', 2), EN(0, 0))] })
    const desde = qualityOf(w.bodies.get('pez')!.body, 'denaturesAt', w.phys)
    const hasta = qualityOf(w.bodies.get('pez')!.body, 'ignitionPoint', w.phys)

    // Se despeja la ley 1: `P = (T − ambiente) · H / formFactor`. No se copia el
    // 0,5 ni el 15: se los saca invirtiendo la función del motor sobre dos puntos,
    // así que si alguien recalibra la ley, esto se entera.
    const cero = temperaturaDeEquilibrio(0, 0, 'contacto')
    const pendienteDe = (m: Montaje): number => temperaturaDeEquilibrio(1, 0, m) - cero
    const potenciaPara = (t: number, m: Montaje): number => (t - cero) / pendienteDe(m)

    const filas: string[] = [
      '─── QUÉ POTENCIA PIDE CADA MONTAJE PARA COCINAR ───',
      `  la ventana del pescado es [${desde.toFixed(0)}, ${hasta.toFixed(0)}) °C`,
      `  y lo máximo encendible entrega ${(18 * TECHO_DE_LA_FRICCION * 16.7).toFixed(2)}`,
      '',
      '  montaje  │ potencia mínima │ potencia máxima │ ¿alcanza con lo encendible?',
      '  ─────────┼─────────────────┼─────────────────┼────────────────────────────',
    ]
    const tope = 18 * TECHO_DE_LA_FRICCION * 16.7
    let alcanzables = 0
    for (const m of ['piso', 'parrilla', 'contacto'] as const) {
      const min = potenciaPara(desde, m)
      const max = potenciaPara(hasta, m)
      const ok = min <= tope
      if (ok) alcanzables += 1
      filas.push(
        `  ${m.padEnd(8)} │ ${min.toFixed(2).padStart(15)} │ ${max.toFixed(2).padStart(15)} │ ${ok ? 'SÍ' : 'no'}`,
      )
    }
    filas.push('')
    filas.push(
      '  El `gap` del planificador pedía «emitsPower entre 253 y 410», que no es la ventana',
      '  de NINGUNO de los tres montajes. Está resolviendo por la variable equivocada:',
      '  la potencia se elige una vez y el LUGAR se elige cada vez.',
    )
    log(filas)

    expect(alcanzables).toBeGreaterThan(0)
  })
})
