// ═══ EL TEST DE EMERGENCIA ═══════════════════════════════════════════════════
//
// Éste es el que decide si la tesis vive.
//
// Todo lo demás del Hito 1 se puede cumplir con un modelo tramposo: alcanza con
// que alguien haya escrito, en algún lado, una fila por cada cosa del mundo. Lo
// que no se puede fingir es esto: una MATERIA NUEVA, inventada acá adentro, que
// nadie previó y a la que nadie le escribió nada, tiene que quemarse, cocinarse
// y atarse igual que las que vinieron de fábrica.
//
// Si esto falla, el remake es la tabla de recetas con otro nombre y hay que
// enterarse ahora y no en el mes cinco.
//
// ─── Las dos reglas de este archivo ─────────────────────────────────────────
//
// 1. NINGUNA LÍNEA MENCIONA UNA SUSTANCIA POR SU NOMBRE. Ni la materia nueva se
//    compara contra una vieja, ni las leyes se llaman con una vieja de testigo.
//    Hay un guardián al final que lee este archivo y falla si aparece el id de
//    cualquiera de las treinta que trae el mundo.
//
// 2. LA MATERIA NUEVA NO SE PARECE A NINGUNA. Cada número que declara es
//    distinto de los de las treinta, cualidad por cualidad. Eso también se
//    verifica acá y no se afirma: si fuera una copia con otro id, el test estaría
//    probando que el mundo reconoce lo que ya conocía.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { admitSubstance, porQue } from '../src/admit.js'
import type { Body, FormId } from '../src/body.js'
import { qualityOf } from '../src/body.js'
import {
  CELDA_AL_AIRE,
  CELDA_TAPADA,
  conSustancia,
  correr,
  cumpleRol,
  FRACCION_DE_RESIDUO,
  TAG_RESIDUO_SIN_AIRE,
  temperaturaDeEquilibrio,
  totalConservado,
  unir,
  type Entorno,
} from '../src/leyes.js'
import { buildSeedPhysics } from '../src/physics.js'
import { EXTRACCION, UNION } from '../src/process.js'
import type { QualityId } from '../src/quality.js'
import type { Substance } from '../src/substance.js'
import { HZ_DE_REFERENCIA, dtDeFrecuencia } from '../src/fixed.js'
import { SUSTANCIAS_SEMILLA } from '../src/data/sustancias.js'

/**
 * El paso de tiempo de los tests de este archivo: la frecuencia de referencia
 * del ADR II-0007. Las leyes son por segundo y `dt` dice con qué finura se las
 * muestrea; a otra frecuencia estos mismos tests miden otra trayectoria, y eso
 * es correcto (ADR II-0008).
 */
const DT = dtDeFrecuencia(HZ_DE_REFERENCIA)

// ─── Lo que el dios trajo ayer ───────────────────────────────────────────────
//
// Orgánica y carnosa, como pide el criterio. Flexible y resistente a la tracción
// —una tira fibrosa y tierna, si hay que imaginarla— porque así puede hacer las
// tres cosas ella sola, sin pedirle nada prestado al mundo viejo.
//
// Ni una sola de estas líneas existe en ningún otro archivo del paquete.

const SIN_FILA: Substance = {
  id: 'sustancia-sin-fila',
  lexeme: { nombre: 'lo que el dios trajo ayer', genero: 'm', sinonimos: [] },
  tags: ['organico', 'carnoso'],
  perUnitMass: {
    nutrition: 12.5,
    digestibility: 0.27,
    toxicity: 0.42,
    moisture: 0.31,
    fuelEnergy: 7.5,
    denaturesAt: 58.5,
    pyrolysisAt: 265,
    ignitionPoint: 265,
    toughness: 0.42,
    decay: 0.07,
    rigidity: 0.12,
    flexibility: 0.86,
    tensile: 0.38,
    cohesion: 0.47,
    permeability: 0.28,
  },
  specificHeat: 3.15,
  provenance: { by: 'oraculo' },
}

/** El mundo de siempre, más una materia que nadie previó. Nada más cambia. */
const phys = conSustancia(buildSeedPhysics(), SIN_FILA)

function trozo(id: string, form: FormId, masa: number): Body {
  return { id, form, parts: [{ substance: SIN_FILA.id, mass: masa, q: {} }], joints: [], state: {} }
}

const FOGATA = 300
const HOGUERA = 600

// ─────────────────────────────────────────────────────────────────────────────

describe('la materia nueva no se parece a ninguna de las que ya estaban', () => {
  it('cada número que declara es distinto de los de las treinta, cualidad por cualidad', () => {
    // Sin esto, el test de emergencia podría estar probando que el mundo
    // reconoce una copia con otro id, que es una propiedad muchísimo más floja.
    const colisiones: string[] = []
    for (const vieja of SUSTANCIAS_SEMILLA) {
      for (const [k, v] of Object.entries(SIN_FILA.perUnitMass)) {
        const w = vieja.perUnitMass[k as QualityId]
        if (w !== undefined && w === v) colisiones.push(`${k} = ${String(v)} lo comparte con otra`)
      }
      if (vieja.specificHeat === SIN_FILA.specificHeat) {
        colisiones.push('specificHeat lo comparte con otra')
      }
    }
    expect(colisiones).toEqual([])
  })

  it('y no está en el catálogo de fábrica: la puerta la deja entrar igual', () => {
    const deFabrica = buildSeedPhysics()
    expect(deFabrica.substances.has(SIN_FILA.id)).toBe(false)
    const v = admitSubstance(SIN_FILA, phys)
    expect(porQue(v)).toContain('ADMITIDO')
    expect(v.ok).toBe(true)
    // Entra por la envolvente de sus TAGS, que se deriva del catálogo y no se
    // escribe a mano. Nadie tuvo que agregarle una fila a nada.
    expect(v.razones).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 1 · SE QUEMA

describe('se quema', () => {
  const MASA = 1

  it('cruza su punto de pirólisis, se carboniza y cambia de materia sola', () => {
    const cosa = trozo('cosa', 'filete', MASA)
    const sobreLasBrasas: Entorno = {
      celda: CELDA_TAPADA,
      fuente: { potencia: HOGUERA, distancia: 0, montaje: 'contacto' },
    }
    // El sitio da 735 °C y su punto de pirólisis es 265: la ley 3 la agarra sin
    // que nadie le haya dicho a la ley 3 que esta materia existe.
    expect(temperaturaDeEquilibrio(HOGUERA, 0, 'contacto')).toBeGreaterThan(
      SIN_FILA.perUnitMass.pyrolysisAt!,
    )

    // 60 s y no 10: desde el ADR II-0011 la carbonización cruza los 0,8 que la
    // ley 4 pide a los 50 s POR KILO, porque a 0,2 por segundo todo fuego se
    // volvía ceniza a los cuatro segundos. Con un kilo son 50 s. Ver
    // `TASA_CARBONIZACION` y `avanceDeCarbon`.
    const fin = correr(cosa, sobreLasBrasas, phys, DT, 60)

    expect(fin.leyes).toContain('combustion')
    expect(fin.leyes).toContain('transmutacion')
    expect(fin.nuevas).toHaveLength(1)

    // El residuo se derivó de ella, con su clase y su poder calorífico. No salió
    // de ninguna tabla: antes de este tick no existía en ningún lado.
    const residuo = fin.nuevas[0]!
    expect(residuo.tags).toEqual([TAG_RESIDUO_SIN_AIRE])
    expect(residuo.tags).not.toContain('organico')
    expect(phys.substances.has(residuo.id)).toBe(false)
    expect(residuo.provenance.by).not.toBe('semilla')

    // La fracción de masa que la ley 4 declara. Un pelo por debajo, porque en el
    // camino de 15 a 735 °C atravesó su propia ventana de cocción y ahí perdió
    // algo de humedad — que es justamente el comportamiento que se espera de
    // algo que se cocina antes de quemarse.
    const esperado = MASA * FRACCION_DE_RESIDUO[TAG_RESIDUO_SIN_AIRE]
    expect(qualityOf(fin.body, 'mass', fin.phys)).toBeLessThanOrEqual(esperado)
    expect(qualityOf(fin.body, 'mass', fin.phys)).toBeGreaterThan(esperado * 0.99)

    // Y dejó de ser comida. `nutrition` es conservada: nada la puede devolver.
    expect(qualityOf(fin.body, 'nutrition', fin.phys)).toBe(0)
    expect(qualityOf(fin.body, 'calories', fin.phys)).toBe(0)
  })

  it('tapada rinde y al aire no, igual que con la materia de siempre', () => {
    // La técnica no depende de qué es la cosa: depende del oxígeno de la celda.
    const cosa = trozo('cosa', 'filete', MASA)
    const fuente = { potencia: HOGUERA, distancia: 0, montaje: 'contacto' } as const
    const tapada = correr(cosa, { celda: CELDA_TAPADA, fuente }, phys, DT, 60)
    const alAire = correr(cosa, { celda: CELDA_AL_AIRE, fuente }, phys, DT, 60)
    expect(qualityOf(tapada.body, 'mass', tapada.phys)).toBeGreaterThan(
      qualityOf(alAire.body, 'mass', alAire.phys) * 4,
    )
    expect(tapada.nuevas[0]!.perUnitMass.fuelEnergy!).toBeGreaterThan(0)
    expect(alAire.nuevas[0]!.perUnitMass.fuelEnergy!).toBe(0)
  })

  it('lejos del fuego no se quema, y eso también hay que probarlo', () => {
    // Si se quemara siempre, el test de arriba no diría nada sobre la ley: diría
    // que la materia nueva se destruye sola.
    const cosa = trozo('cosa', 'filete', MASA)
    const fin = correr(
      cosa,
      { celda: CELDA_AL_AIRE, fuente: { potencia: FOGATA, distancia: 2, montaje: 'piso' } },
      phys,
      DT,
      25,
    )
    expect(fin.leyes).not.toContain('transmutacion')
    expect(qualityOf(fin.body, 'charred', fin.phys)).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2 · SE COCINA

describe('se cocina', () => {
  const MASA = 0.4

  it('sobre la parrilla sube la digestibilidad y baja la toxicidad, sin fila propia', () => {
    const cosa = trozo('cosa', 'filete', MASA)
    const enLaParrilla: Entorno = {
      celda: CELDA_AL_AIRE,
      fuente: { potencia: FOGATA, distancia: 1, montaje: 'parrilla' },
    }
    // El sitio da 90 °C, que cae entre su punto de cocción (58.5) y el de
    // pirólisis (265). La ventana existe para esta materia igual que para las
    // doce que el barrido del Hito 0 midió, y nadie la calibró para ella.
    const t = temperaturaDeEquilibrio(FOGATA, 1, 'parrilla')
    expect(t).toBeGreaterThan(SIN_FILA.perUnitMass.denaturesAt!)
    expect(t).toBeLessThan(SIN_FILA.perUnitMass.pyrolysisAt!)

    const crudo = qualityOf(cosa, 'digestibility', phys)
    const toxicoAntes = qualityOf(cosa, 'toxicity', phys)
    const caloriasAntes = qualityOf(cosa, 'calories', phys)
    expect(crudo).toBe(SIN_FILA.perUnitMass.digestibility)

    const fin = correr(cosa, enLaParrilla, phys, DT, 25)

    expect(fin.leyes).toContain('desnaturalizacion')
    expect(qualityOf(fin.body, 'digestibility', fin.phys)).toBeGreaterThan(0.85)
    expect(qualityOf(fin.body, 'toxicity', fin.phys)).toBeLessThan(toxicoAntes / 10)
    expect(qualityOf(fin.body, 'calories', fin.phys)).toBeGreaterThan(2 * caloriasAntes)
  })

  it('cocinar no fabrica comida: el total de nutrición solo baja', () => {
    // El límite del modelo, y es el que hace que la promesa sea honesta. Ánima
    // PUEDE mejorar lo que tiene; NO PUEDE inventar comida cocinando, ni con una
    // materia que el dios acaba de traer.
    const cosa = trozo('cosa', 'filete', MASA)
    const antes = totalConservado(cosa, 'nutrition', phys)
    const fin = correr(
      cosa,
      { celda: CELDA_AL_AIRE, fuente: { potencia: FOGATA, distancia: 1, montaje: 'parrilla' } },
      phys,
      DT,
      25,
    )
    expect(totalConservado(fin.body, 'nutrition', fin.phys)).toBeLessThanOrEqual(antes)
    // El número por unidad de masa no lo toca la ley 5: lo que se fue es humedad.
    expect(qualityOf(fin.body, 'nutrition', fin.phys) / SIN_FILA.perUnitMass.nutrition!)
      .toBeGreaterThan(0.999)
  })

  it('y el sitio importa: el que no alcanza la temperatura no cocina nada', () => {
    const cosa = trozo('cosa', 'filete', MASA)
    const fin = correr(
      cosa,
      { celda: CELDA_AL_AIRE, fuente: { potencia: FOGATA, distancia: 2, montaje: 'piso' } },
      phys,
      DT,
      25,
    )
    expect(fin.leyes).not.toContain('desnaturalizacion')
    expect(qualityOf(fin.body, 'digestibility', fin.phys)).toBe(SIN_FILA.perUnitMass.digestibility)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3 · SE ATA

describe('se ata', () => {
  it('califica como atadura por sus cualidades, no por lo que es', () => {
    // El rol `binder` pide flexibilidad y tracción. No pregunta de qué está
    // hecha nada, y no podría preguntarlo: `Role.where` solo sabe de cualidades.
    const hebra = trozo('hebra', 'hebra', 0.2)
    const rolAtador = UNION.roles.find((r) => r.name === 'binder')!
    expect(cumpleRol(hebra, rolAtador, phys)).toBe(true)
  })

  it('el ensamble alcanza y engancha, y vale más que sus partes sueltas', () => {
    const larga = trozo('larga', 'vara', 0.5)
    const hebra = trozo('hebra', 'hebra', 0.2)
    const ensamble = unir(larga, undefined, hebra, phys, 'ensamble')
    expect(ensamble).toBeDefined()

    // Las dos afordancias del criterio, las dos DERIVADAS de la geometría.
    expect(qualityOf(ensamble!, 'reach', phys)).toBeGreaterThanOrEqual(2)
    expect(qualityOf(ensamble!, 'catch', phys)).toBeGreaterThan(0)

    // Y el ensamble es estrictamente más que cualquiera de sus dos pedazos: eso
    // es lo que hace que atar valga la pena, y no lo decidió nadie.
    expect(qualityOf(ensamble!, 'reach', phys)).toBeGreaterThan(qualityOf(larga, 'reach', phys))
    expect(qualityOf(ensamble!, 'reach', phys)).toBeGreaterThan(qualityOf(hebra, 'reach', phys))

    // Con eso califica para el proceso que saca del stock del dios. Nadie
    // escribió el aparejo: se presentó algo que cumplía los dos números.
    const rolAparejo = EXTRACCION.roles.find((r) => r.name === 'gear')!
    expect(cumpleRol(ensamble!, rolAparejo, phys)).toBe(true)
  })

  it('atar no crea materia: el ensamble pesa lo que pesaban los dos pedazos', () => {
    const larga = trozo('larga', 'vara', 0.5)
    const hebra = trozo('hebra', 'hebra', 0.2)
    const ensamble = unir(larga, undefined, hebra, phys, 'ensamble')!
    expect(qualityOf(ensamble, 'mass', phys)).toBe(0.7)
    expect(totalConservado(ensamble, 'nutrition', phys)).toBeCloseTo(
      totalConservado(larga, 'nutrition', phys) + totalConservado(hebra, 'nutrition', phys),
      12,
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LOS GUARDIANES
//
// Sin estos dos, todo lo de arriba se puede satisfacer haciendo trampa: bastaría
// con que el test le pidiera al mundo una sustancia vieja de testigo, o con que
// alguna ley tuviera adentro un `if` con un nombre.

const IDS_DEL_MUNDO: readonly string[] = SUSTANCIAS_SEMILLA.map((s) => s.id)

/** Minúsculas y sin acentos: prohibir un nombre y admitirlo con tilde no prohíbe nada. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Los ids que aparecen en el texto como palabra suelta. El guión cuenta como letra. */
function nombresEn(texto: string): readonly string[] {
  const limpio = normalizar(texto)
  const hallados: string[] = []
  for (const id of IDS_DEL_MUNDO) {
    const re = new RegExp(`(?<![a-z0-9-])${id}(?![a-z0-9-])`)
    if (re.test(limpio)) hallados.push(id)
  }
  return hallados
}

/** El código, sin comentarios. Lo que se juzga es lo que corre, no lo que se cuenta. */
function soloCodigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

describe('los guardianes', () => {
  it('ninguna línea de este archivo menciona una sustancia del mundo por su nombre', () => {
    const fuente = readFileSync(fileURLToPath(import.meta.url), 'utf8')
    expect(nombresEn(fuente)).toEqual([])
  })

  it('el motor de las leyes tampoco nombra una sola sustancia', () => {
    // ÉSTE es el guardián que importa, y el que sostiene la tesis entera: si las
    // doce leyes no pueden nombrar una sustancia, entonces no puede existir una
    // que se comporte distinto por ser quien es. Se juzga el CÓDIGO y no los
    // comentarios: los comentarios están para explicar, y explicar la ley del
    // secado hablando de lo que moja es lo que hay que hacer.
    const url = new URL('../src/leyes.ts', import.meta.url)
    const codigo = soloCodigo(readFileSync(fileURLToPath(url), 'utf8'))
    expect(nombresEn(codigo)).toEqual([])
  })

  it('y el guardián sabe encontrar lo que busca', () => {
    // Un guardián que no puede fallar no guarda nada. El catálogo de sustancias
    // es el archivo donde los nombres SÍ tienen que estar, y ahí los encuentra.
    const url = new URL('../src/data/sustancias.ts', import.meta.url)
    const codigo = soloCodigo(readFileSync(fileURLToPath(url), 'utf8'))
    expect(nombresEn(codigo).length).toBe(IDS_DEL_MUNDO.length)
  })
})
