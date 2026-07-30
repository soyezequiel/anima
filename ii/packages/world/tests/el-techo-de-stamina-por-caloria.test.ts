// ─── ¿HASTA DÓNDE SE PUEDE SUBIR `STAMINA_POR_CALORIA`? ──────────────────────
//
// La aritmética de la cocción tenía tres palancas y dos eran de calibración: la
// `eficiencia` de la fricción y esta. La primera está cerrada por arriba desde
// hace dos tramos —haría falta una eficiencia mayor que 1, o sea una máquina de
// movimiento perpetuo, medido en `oracle/tests/presupuesto.test.ts`— y de la
// segunda nadie había medido el techo. Se hablaba de ella como de una perilla.
//
// Este archivo mide cuánto se puede girar esa perilla, y lo mide con el guardián
// que la limita, no con la aritmética de nadie:
//
//   comer declara un evento `convierte` con `gastado` y `acreditado`, y
//   `revisarConservacion` exige `acreditado <= gastado`. O sea EFICIENCIA ≤ 1.
//
// Con `gastado = nutrition · masa` y `acreditado = calories · STAMINA_POR_CALORIA`,
// y `calories = nutrition · masa · digestibility`, la razón entre los dos ES la
// digestibilidad. El factor más grande que no rompe el invariante es entonces
// `1 / digestibility` del alimento MÁS digerible del catálogo — y la ley 5 empuja
// la digestibilidad de lo cocido justo hasta ese techo.
//
// Los tres bloques, en el orden que decide:
//
//   1. lo que un bocado DECLARA de verdad, comido en `stepWorld`;
//   2. el techo del factor, barrido sobre el catálogo entero;
//   3. y el control positivo: que el guardián marque un `convierte` que se pase.
//      Sin él, el techo de arriba sería una deducción y no una medición — y este
//      proyecto ya pagó dos veces por publicar un cero que nadie hizo disparar.

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, qualityOf, SUSTANCIAS_SEMILLA } from '@anima/physics'
import type { Body, Physics, QualityId } from '@anima/physics'

import { stepWorld, STAMINA_POR_CALORIA } from '../src/step.js'
import type { SimEvent, WorldState } from '../src/step.js'
import { eat } from '../src/intent.js'
import { revisarInvariantes } from '../src/invariants.js'
import { actor, criatura, cuerpo, enElPiso, mundo } from './mundo-minimo.js'

const PHYS: Physics = buildSeedPhysics()
const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

function q(b: Body, id: QualityId): number {
  return qualityOf(b, id, PHYS)
}

/** Lo que hace falta para cerrar la cuenta del fuego, medido en otros dos archivos. */
const LO_QUE_HARIA_FALTA = [
  { que: 'la razón costo/devuelve del fuego frotado (`el-primer-fuego-no-se-paga`)', factor: 5.11 },
  { que: 'la salida 1 del presupuesto, partida más flaca (`oracle/presupuesto`)', factor: 1.62 },
] as const

/** Come un cuerpo de `sub` y devuelve el `convierte` que el mundo declaró. */
function loQueDeclaraComer(sub: string, extra: Record<string, number> = {}): {
  gastado: number
  acreditado: number
} | undefined {
  const comida = cuerpo('bocado', sub, 1, extra)
  const w: WorldState = mundo({
    bodies: [enElPiso(criatura('ana', 500), EN(0, 0)), enElPiso(comida, EN(0, 0))],
    actors: [actor('ana')],
  })
  const out = stepWorld(w, [eat({ by: 'ana', seq: 1 }, 'bocado')])
  const e = out.events.find((x): x is Extract<SimEvent, { k: 'convierte' }> => x.k === 'convierte')
  return e === undefined ? undefined : { gastado: e.gastado, acreditado: e.acreditado }
}

describe('el techo de `STAMINA_POR_CALORIA`', () => {
  it('1 · LO QUE UN BOCADO DECLARA, y la razón entre los dos números ES la digestibilidad', () => {
    const filas: string[] = [
      '─── LO QUE COMER DECLARA ───',
      `  \`STAMINA_POR_CALORIA\` hoy vale ${String(STAMINA_POR_CALORIA)}`,
      '',
      '  bocado          │  gastado │ acreditado │ acreditado/gastado │ digestibility',
      '  ────────────────┼──────────┼────────────┼────────────────────┼──────────────',
    ]

    // El crudo y el cocido de la misma sustancia: la ley 5 sube `digestibility` y
    // con eso sube lo acreditado, sin que nadie escriba «cocinar rinde más».
    for (const [nombre, extra] of [
      ['pescado crudo', {}],
      ['pescado cocido', { digestibility: 0.95 }],
      ['grasa', {}],
    ] as const) {
      const sub = nombre === 'grasa' ? 'grasa' : 'pescado'
      const d = loQueDeclaraComer(sub, extra)
      if (d === undefined) {
        filas.push(`  ${nombre.padEnd(15)} │ (no se pudo comer)`)
        continue
      }
      const b = cuerpo('x', sub, 1, extra)
      filas.push(
        `  ${nombre.padEnd(15)} │ ${d.gastado.toFixed(4).padStart(8)} │ ${d.acreditado.toFixed(4).padStart(10)} │ ` +
          `${(d.acreditado / d.gastado).toFixed(4).padStart(18)} │ ${q(b, 'digestibility').toFixed(4).padStart(13)}`,
      )
    }
    log(filas)

    const crudo = loQueDeclaraComer('pescado')
    expect(crudo).toBeDefined()
    if (crudo === undefined) return
    // Lo que se afirma es el MECANISMO, no el número: lo acreditado es lo gastado
    // por la digestibilidad, y por eso el guardián no se queja hoy.
    expect(crudo.acreditado).toBeLessThanOrEqual(crudo.gastado)
  })

  it('2 · EL TECHO DEL FACTOR, barrido sobre el catálogo entero', () => {
    // El techo es `min(gastado / acreditado)` sobre todo lo que se puede comer, o
    // sea `1 / max(digestibility)`. Se barre el catálogo y no una lista escrita
    // acá: si mañana alguien agrega algo más digerible, el techo baja solo.
    const filas: string[] = [
      '─── HASTA DÓNDE SE PUEDE SUBIR EL FACTOR ───',
      '',
      '  sustancia    │ digestibility │ factor máximo que no rompe el invariante',
      '  ─────────────┼───────────────┼─────────────────────────────────────────',
    ]

    let techo = Number.POSITIVE_INFINITY
    let elMasDigerible = ''
    for (const s of SUSTANCIAS_SEMILLA) {
      // Con la digestibilidad que la ley 5 le puede dar cocinando, que es el caso
      // que aprieta: el techo lo pone lo más digerible que el mundo llega a haber.
      const cocido = cuerpo('x', s.id, 1, { digestibility: 0.95 })
      const dig = q(cocido, 'digestibility')
      const nut = q(cocido, 'nutrition')
      if (nut <= 0 || dig <= 0) continue
      const factor = 1 / dig
      if (factor < techo) {
        techo = factor
        elMasDigerible = s.id
      }
      filas.push(
        `  ${s.id.padEnd(12)} │ ${dig.toFixed(4).padStart(13)} │ ${factor.toFixed(4).padStart(41)}`,
      )
    }

    filas.push('')
    filas.push(
      `  EL TECHO ES ${techo.toFixed(4)}× (lo pone ${elMasDigerible}), o sea un ${((techo - 1) * 100).toFixed(1)}% más que hoy`,
      '',
      '  y lo que haría falta para que un fuego se pague:',
    )
    for (const x of LO_QUE_HARIA_FALTA) {
      filas.push(
        `    ${x.factor.toFixed(2)}× — ${x.que}` + `${x.factor <= techo ? '  ← ENTRA' : '  ← NO ENTRA'}`,
      )
    }
    filas.push(
      '',
      '  ⇒ LA PALANCA ESTÁ CERRADA POR ARRIBA, igual que la eficiencia de la fricción:',
      '    el invariante de conservación pide `acreditado <= gastado` y la razón entre',
      '    los dos ES la digestibilidad. Subirla más allá del techo no es recalibrar,',
      '    es cambiar qué declara el `convierte` — o sea el modelo de la conservación.',
    )
    log(filas)

    expect(techo).toBeGreaterThan(1)
    // Los dos números clavados, para que moverlos se note: el techo sale de
    // `digestibility <= 0.95` y ninguna de las dos cosas que harían falta entra.
    expect(Number(techo.toFixed(4))).toBe(1.0526)
    for (const x of LO_QUE_HARIA_FALTA) expect(x.factor).toBeGreaterThan(techo)
  })

  it('3 · EL CONTROL POSITIVO: el guardián SÍ marca un `convierte` que se pasa', () => {
    // Sin esto, el techo de arriba sería una lectura de código. Se le pasa al
    // guardián un `convierte` que acredita más de lo que gastó —lo que pasaría con
    // el factor en 1,10— y tiene que decirlo.
    const antes = mundo({ bodies: [enElPiso(criatura('ana', 500), EN(0, 0))], actors: [actor('ana')] })
    // La firma la pone el bucle del mundo (`firmar`), y acá va a mano porque el
    // evento no viene de ninguna intención: es el que se le está mostrando al
    // guardián para ver si lo agarra.
    const firma = { by: 'ana', seq: 1 } as const
    const inventado: SimEvent = { ...firma, k: 'convierte', de: 'nutrition', a: 'stamina', gastado: 100, acreditado: 110 }
    const honesto: SimEvent = { ...firma, k: 'convierte', de: 'nutrition', a: 'stamina', gastado: 100, acreditado: 95 }

    const conElInventado = revisarInvariantes(antes, antes, [inventado])
    const conElHonesto = revisarInvariantes(antes, antes, [honesto])
    log([
      '─── EL CONTROL POSITIVO ───',
      `  acreditado 110 sobre gastado 100 → ${String(conElInventado.length)} violación(es): ` +
        `${conElInventado.map((v) => v.k).join(' ') || '(ninguna)'}`,
      `  acreditado  95 sobre gastado 100 → ${String(conElHonesto.length)} violación(es): ` +
        `${conElHonesto.map((v) => v.k).join(' ') || '(ninguna)'}`,
    ])

    expect(conElInventado.map((v) => v.k)).toContain('conversion-sin-respaldo')
    expect(conElHonesto).toEqual([])
  })

  it('4 · LA PALANCA GEMELA, que sí se puede girar: el `nutrition` del catálogo', () => {
    // Si el techo de arriba fuera todo, la salida 1 estaría muerta. No lo está, y
    // conviene decir por qué con el número delante: lo que el invariante mira es la
    // RAZÓN entre acreditado y gastado, y `nutrition` está en los dos lados —
    // `gastado = nutrition · masa` y `acreditado = nutrition · masa · digestibility`.
    // O sea que multiplicar `nutrition` multiplica lo que un bocado rinde **sin
    // mover la razón ni un decimal**, y el guardián no tiene nada que decir.
    //
    // No es gratis, y por eso esto es una medición y no una propuesta: `nutrition`
    // es del catálogo, entra en el libro calórico del dios y mueve la ventana
    // entera del ADR II-0009 (`COSTO_VIVIR_POR_SEGUNDO` está calibrado adentro de
    // 0,766–1,155, que son los dos bordes medidos sobre cien partidas). Lo que este
    // bloque afirma es lo único que le toca: que la puerta existe y por dónde pasa.
    const filas: string[] = [
      '─── LA PALANCA GEMELA ───',
      '',
      '  ×nutrition │  gastado │ acreditado │ razón  │ ¿el guardián se queja?',
      '  ───────────┼──────────┼────────────┼────────┼───────────────────────',
    ]

    const base = SUSTANCIAS_SEMILLA.find((s) => s.id === 'pescado')
    expect(base).toBeDefined()
    if (base === undefined) return

    let elMayorQueEntra = 0
    for (const factor of [1, 1.62, 5.11, 10]) {
      // Una física con el pescado multiplicado, sin tocar el catálogo de nadie.
      const phys = buildSeedPhysics({
        substances: SUSTANCIAS_SEMILLA.map((s) =>
          s.id === 'pescado'
            ? { ...s, perUnitMass: { ...s.perUnitMass, nutrition: (s.perUnitMass.nutrition ?? 0) * factor } }
            : s,
        ),
      })
      const w: WorldState = mundo({
        phys,
        bodies: [
          enElPiso(criatura('ana', 500), EN(0, 0)),
          enElPiso(cuerpo('bocado', 'pescado', 1, { digestibility: 0.95 }), EN(0, 0)),
        ],
        actors: [actor('ana')],
      })
      const out = stepWorld(w, [eat({ by: 'ana', seq: 1 }, 'bocado')])
      const e = out.events.find((x): x is Extract<SimEvent, { k: 'convierte' }> => x.k === 'convierte')
      const v = revisarInvariantes(w, out.state, out.events)
      if (e === undefined) {
        filas.push(`  ${factor.toFixed(2).padStart(10)} │ (no se pudo comer)`)
        continue
      }
      if (v.length === 0) elMayorQueEntra = factor
      filas.push(
        `  ${factor.toFixed(2).padStart(10)} │ ${e.gastado.toFixed(3).padStart(8)} │ ${e.acreditado.toFixed(3).padStart(10)} │ ` +
          `${(e.acreditado / e.gastado).toFixed(4).padStart(6)} │ ${v.length === 0 ? 'no' : v.map((x) => x.k).join(' ')}`,
      )
    }
    filas.push(
      '',
      `  el mayor factor que el guardián deja pasar: ${elMayorQueEntra.toFixed(2)}×`,
      '  ⇒ por acá la salida 1 SÍ pasa, y lo que cuesta no es el invariante: es que',
      '    `nutrition` mueve el hambre entera y la ventana del ADR II-0009.',
    )
    log(filas)

    // Lo que se afirma: la razón no se mueve con el factor —que es el mecanismo—
    // y ninguno de los cuatro factores rompe un invariante.
    expect(elMayorQueEntra).toBe(10)
  })
})
