// Lo que este archivo cuida no es que las treinta sustancias estén «bien»:
// eso lo decide el barrido y lo deciden las leyes. Cuida que ninguna pueda
// mentirle al motor — que ningún número salga del rango que su propia cualidad
// declaró, que nadie contrabandee una tabla de transiciones con otro nombre, y
// que la madera siga sin alimentar.

import { describe, expect, it } from 'vitest'
import { QUALITIES, specOf } from '../src/quality.js'
import type { QualityId } from '../src/quality.js'
import { SUBSTANCE_FIELDS, TAGS } from '../src/substance.js'
import type { Substance, Tag } from '../src/substance.js'
import { SUSTANCIAS_POR_ID, SUSTANCIAS_SEMILLA } from '../src/data/sustancias.js'

/** Las claves de `perUnitMass`, ya como `QualityId` y con el valor al lado. */
function entradas(s: Substance): readonly (readonly [QualityId, number])[] {
  return Object.entries(s.perUnitMass).map(([q, v]) => [q as QualityId, v as number] as const)
}

describe('el catálogo de sustancias semilla', () => {
  it('tiene treinta y ningún id repetido', () => {
    expect(SUSTANCIAS_SEMILLA).toHaveLength(30)
    expect(SUSTANCIAS_POR_ID.size).toBe(SUSTANCIAS_SEMILLA.length)
  })

  it('todas vienen declaradas como semilla', () => {
    for (const s of SUSTANCIAS_SEMILLA) expect(s.provenance.by, s.id).toBe('semilla')
  })

  it('todas se pueden nombrar', () => {
    for (const s of SUSTANCIAS_SEMILLA) {
      expect(s.lexeme.nombre.length, s.id).toBeGreaterThan(0)
      expect(['m', 'f'], s.id).toContain(s.lexeme.genero)
    }
  })

  it('cubre los siete tags: ninguna rama de ninguna ley queda sin materia que la ejercite', () => {
    const vistos = new Set<Tag>(SUSTANCIAS_SEMILLA.flatMap((s) => s.tags))
    for (const t of TAGS) expect(vistos.has(t), `nadie tiene el tag ${t}`).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EL TEST QUE PIDE EL HITO: ningún valor fuera del rango que declaró su propia
// cualidad. Si esto no se chequea, una sustancia con `moisture: 1.4` no explota
// acá: explota tres leyes más adelante, como una división rara en el tick 600.

describe('ninguna sustancia viola el rango declarado de su cualidad', () => {
  it('cada entrada de perUnitMass está dentro de [min, max]', () => {
    for (const s of SUSTANCIAS_SEMILLA) {
      for (const [q, v] of entradas(s)) {
        const spec = specOf(q)
        expect(Number.isFinite(v), `${s.id}.${q} no es un número finito`).toBe(true)
        expect(v, `${s.id}.${q} = ${v} por debajo de ${spec.range[0]}`).toBeGreaterThanOrEqual(
          spec.range[0],
        )
        expect(v, `${s.id}.${q} = ${v} por encima de ${spec.range[1]}`).toBeLessThanOrEqual(
          spec.range[1],
        )
      }
    }
  })

  it('nadie declara una cualidad que no está en el catálogo', () => {
    const conocidas = new Set<string>(QUALITIES.map((q) => q.id))
    for (const s of SUSTANCIAS_SEMILLA) {
      for (const [q] of entradas(s)) {
        expect(conocidas.has(q), `${s.id} declara ${q}, que no existe`).toBe(true)
      }
    }
  })

  it('nadie guarda una cualidad DERIVADA', () => {
    // Una derivada guardada es una que puede quedar vieja. `heatCapacity` sale
    // de `mass × specificHeat` y `calories` de tres factores: escribirlas a mano
    // es abrir la puerta a que el número guardado y el calculado difieran.
    for (const s of SUSTANCIAS_SEMILLA) {
      for (const [q] of entradas(s)) {
        expect(specOf(q).derived, `${s.id} guarda ${q}, que es derivada`).toBeUndefined()
      }
    }
  })

  it('nadie declara masa, temperatura ni vigor', () => {
    // `mass` sería circular (el vector ya es POR unidad de masa), `temperature`
    // es estado del cuerpo y relaja al ambiente, y `stamina` es de la criatura.
    const prohibidas: readonly string[] = ['mass', 'temperature', 'stamina']
    for (const s of SUSTANCIAS_SEMILLA) {
      for (const [q] of entradas(s)) {
        expect(prohibidas.includes(q), `${s.id} declara ${q}`).toBe(false)
      }
    }
  })

  it('el calor específico es positivo y finito', () => {
    // Un cero acá es una división por cero en la ley 1, no un material liviano.
    for (const s of SUSTANCIAS_SEMILLA) {
      expect(Number.isFinite(s.specificHeat), s.id).toBe(true)
      expect(s.specificHeat, s.id).toBeGreaterThan(0)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LO QUE REEMPLAZA A `PROTECTED_KINDS`

describe('lo que alimenta y lo que no', () => {
  // Escrita a mano y a propósito: si alguien le sube `nutrition` a la madera,
  // que tenga que venir acá y agregarla a esta lista con nombre y apellido.
  const ALIMENTAN: readonly string[] = [
    'carne',
    'pescado',
    'molusco',
    'huevo',
    'tuberculo',
    'raiz-dura',
    'grano',
    'hongo',
    'hoja',
    'savia',
    'cuero',
    'medula',
    'tendon',
    'grasa',
    'piel',
  ]

  it('solo alimenta lo que de verdad alimenta', () => {
    for (const s of SUSTANCIAS_SEMILLA) {
      const n = s.perUnitMass.nutrition ?? 0
      expect(n > 0, `${s.id} tiene nutrition ${n} y no está en la lista`).toBe(
        ALIMENTAN.includes(s.id),
      )
    }
  })

  it('la madera no alimenta, y ninguna ley puede cambiarlo', () => {
    // `nutrition` es conservada: no sube sin aporte del dios. Ánima PUEDE hacer
    // pescado asado comestible; NO PUEDE inventar madera nutritiva. La primera
    // mitad es el objetivo del remake, la segunda es su límite.
    for (const id of ['madera', 'madera-verde', 'madera-dura', 'piedra', 'agua', 'carbon']) {
      expect(SUSTANCIAS_POR_ID.get(id)?.perUnitMass.nutrition, id).toBe(0)
    }
    expect(specOf('nutrition').conserved).toBe(true)
  })

  it('cocinar solo tiene sentido sobre lo que alimenta', () => {
    // `denaturesAt` es la puerta de la ley 5. Que coincida exactamente con
    // `nutrition > 0` no es un capricho: desnaturalizar algo que no nutre sube
    // una digestibilidad que después multiplica por cero.
    for (const s of SUSTANCIAS_SEMILLA) {
      const alimenta = (s.perUnitMass.nutrition ?? 0) > 0
      const seCocina = s.perUnitMass.denaturesAt !== undefined
      expect(seCocina, `${s.id}: alimenta=${alimenta} pero se cocina=${seCocina}`).toBe(alimenta)
    }
  })

  it('todo cuerpo tiene techo térmico', () => {
    // Sin `pyrolysisAt` la ley 5 no sabe dónde parar y la 3 no sabe dónde
    // empezar. Que lo mineral lo tenga altísimo no es lo mismo que no tenerlo.
    for (const s of SUSTANCIAS_SEMILLA) {
      expect(s.perUnitMass.pyrolysisAt, `${s.id} sin pyrolysisAt`).toBeDefined()
      expect(s.perUnitMass.ignitionPoint, `${s.id} sin ignitionPoint`).toBeDefined()
    }
  })

  it('lo cocinable se quema donde el barrido dijo que se quema', () => {
    // La ley 5 se corta en `ignitionPoint` y el barrido juzgó «se quema» con
    // `pyrolysisAt`. Si difirieran, la ventana medida no sería la simulada.
    for (const s of SUSTANCIAS_SEMILLA) {
      if (s.perUnitMass.denaturesAt === undefined) continue
      expect(s.perUnitMass.ignitionPoint, s.id).toBe(s.perUnitMass.pyrolysisAt)
      expect(s.perUnitMass.denaturesAt, s.id).toBeLessThan(s.perUnitMass.pyrolysisAt as number)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LA CALIBRACIÓN DEL HITO 0, CLAVADA

describe('los doce del barrido térmico conservan sus números medidos', () => {
  // Copia literal de `ii/docs/hito-0-barrido-termico.md`. No es duplicación
  // ociosa: es el trinquete. Estos tres números por sustancia son los que dieron
  // 12/12 con ventana y 5 óptimos distintos. Cambiarlos sin volver a correr
  // `pnpm ii:banco` rompe en silencio la tensión «comer antes o comer mejor»,
  // que es lo único que hace que cocinar valga la pena aprenderlo.
  const MEDIDOS: readonly (readonly [string, number, number, number])[] = [
    ['carne', 63, 280, 0.3],
    ['pescado', 55, 260, 0.18],
    ['molusco', 48, 240, 0.55],
    ['huevo', 62, 220, 0.05],
    ['tuberculo', 75, 300, 0.7],
    ['raiz-dura', 88, 310, 0.9],
    ['grano', 92, 290, 0.8],
    ['hongo', 45, 200, 0.2],
    ['hoja', 40, 180, 0.08],
    ['savia', 70, 190, 0.02],
    ['cuero', 58, 250, 0.95],
    ['medula', 52, 230, 0.25],
  ]

  it.each(MEDIDOS)('%s: denaturesAt %d, pyrolysisAt %d, toughness %d', (id, den, pyr, dur) => {
    const s = SUSTANCIAS_POR_ID.get(id)
    expect(s, `falta ${id}`).toBeDefined()
    expect(s?.perUnitMass.denaturesAt).toBe(den)
    expect(s?.perUnitMass.pyrolysisAt).toBe(pyr)
    expect(s?.perUnitMass.toughness).toBe(dur)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('nadie contrabandea una tabla de transiciones', () => {
  it('ninguna sustancia tiene campos fuera de los seis declarados', () => {
    // `transitions: [{ under, into }]` sería la tabla de recetas indexada al
    // revés: N sustancias × 12 leyes en vez de M recetas, y una sustancia nueva
    // que no se comporta hasta que alguien le escriba su fila. Las
    // transformaciones se resuelven por TAG, en las leyes, una sola vez.
    const legales = new Set(SUBSTANCE_FIELDS)
    for (const s of SUSTANCIAS_SEMILLA) {
      for (const k of Object.keys(s)) {
        expect(legales.has(k), `${s.id} trae el campo ${k}`).toBe(true)
      }
    }
  })

  it('los tags compuestos son coherentes', () => {
    // `carnoso` y `vegetal` son subdivisiones de `organico`; si algo las lleva
    // sin llevar `organico`, las leyes que agarran por `organico` lo saltean y
    // el material queda inerte sin que nadie se entere.
    for (const s of SUSTANCIAS_SEMILLA) {
      const t = new Set<Tag>(s.tags)
      if (t.has('carnoso')) expect(t.has('organico'), `${s.id} carnoso sin organico`).toBe(true)
      if (t.has('vegetal')) expect(t.has('organico'), `${s.id} vegetal sin organico`).toBe(true)
      expect(s.tags.length, `${s.id} sin tags`).toBeGreaterThan(0)
      expect(new Set(s.tags).size, `${s.id} repite tags`).toBe(s.tags.length)
    }
  })

  it('el carbón no lleva el tag organico', () => {
    // La ley 4 se aplica sobre `organico`. Si el carbón lo llevara, el carbón
    // recién hecho volvería a transmutar y se convertiría en ceniza solo dentro
    // del fuego que lo hizo. Ése era el bug del ejemplo (a).
    expect(SUSTANCIAS_POR_ID.get('carbon')?.tags).not.toContain('organico')
    expect(SUSTANCIAS_POR_ID.get('carbon')?.tags).toContain('carbonoso')
  })
})
