// ═══ LOS TRES EJEMPLOS DEL USUARIO, COMO TESTS DEL MOTOR ═════════════════════
//
// El criterio verificable del Hito 1 pide estos tres, y pide una cosa más que es
// la que de verdad se está probando: que se puedan escribir SIN LAS TRES
// PALABRAS — el nombre de lo que queda cuando algo se quema, el verbo de
// cocinar sobre el fuego, y el verbo de sacar comida del río.
//
// La prohibición no es un juego. Si para probar que una rama junto al fuego
// termina hecha tizón hubiera que escribir el nombre del tizón, entonces el
// tizón sería un tipo del mundo y habría una fila en algún lado que lo dice —
// que es exactamente el modelo que este remake vino a no tener. Que los tres
// ejemplos se puedan escribir hablando SOLO de cualidades, tags y números es la
// prueba de que las leyes no tienen vocabulario de objetos.
//
// Hay un test al final que lee este archivo y falla si alguna de las tres se
// coló, con acentos y mayúsculas normalizados. La lista se arma en pedazos para
// que el propio guardián no la contenga.
//
// Lo que SÍ se nombra son las sustancias de entrada (la vegetal fibrosa, la
// carnosa), y tiene que ser así: alguien tiene que poner algo sobre el fuego. Lo
// que no aparece por ningún lado es el nombre de lo que SALE, porque eso no lo
// decide nadie: lo decide la aritmética.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Body, FormId } from '../src/body.js'
import { qualityOf } from '../src/body.js'
import {
  CELDA_AL_AIRE,
  CELDA_TAPADA,
  correr,
  cumpleRol,
  FRACCION_DE_RESIDUO,
  formFactor,
  TAG_RESIDUO_CON_AIRE,
  TAG_RESIDUO_SIN_AIRE,
  temperaturaDeEquilibrio,
  totalConservado,
  unir,
  type Entorno,
} from '../src/leyes.js'
import { buildSeedPhysics } from '../src/physics.js'
import { EXTRACCION, UNION } from '../src/process.js'
import { HZ_DE_REFERENCIA, dtDeFrecuencia } from '../src/fixed.js'

/**
 * El paso de tiempo de los tests de este archivo: la frecuencia de referencia
 * del ADR II-0007. Las leyes son por segundo y `dt` dice con qué finura se las
 * muestrea; a otra frecuencia estos mismos tests miden otra trayectoria, y eso
 * es correcto (ADR II-0008).
 */
const DT = dtDeFrecuencia(HZ_DE_REFERENCIA)

const phys = buildSeedPhysics()

/** Un cuerpo de una sola parte. Lo mínimo para poner algo en el mundo. */
function cosa(id: string, form: FormId, sustancia: string, masa: number): Body {
  return { id, form, parts: [{ substance: sustancia, mass: masa, q: {} }], joints: [], state: {} }
}

/** La fogata del documento: 300 de potencia. Es la fuente contra la que se calibró todo. */
const FOGATA = 300
/** El fuego grande. Sirve para el borde de arriba: el que arruina la comida. */
const HOGUERA = 600

// ═════════════════════════════════════════════════════════════════════════════
// (a) UNA RAMA JUNTO AL FUEGO
//
// El documento pide: «rama junto al fuego → residuo con 0.28 de la masa y
// nutrition 0». Los dos números salen de la ley 4, que resuelve por TAG y por
// una sola pregunta al entorno —cuánto aire hay—, no por una tabla de qué se
// convierte en qué.

describe('(a) una rama junto al fuego', () => {
  const MASA = 1

  it('a 375 °C sobre las brasas termina hecha residuo, con la fracción de masa que corresponde y sin alimentar', () => {
    const rama = cosa('rama', 'vara', 'madera', MASA)
    // En contacto con la fogata, la ley 1 da 375 °C: es la cuenta del documento,
    // y está por encima del punto de pirólisis de lo leñoso (280).
    const tapado: Entorno = {
      celda: CELDA_TAPADA,
      fuente: { potencia: FOGATA, distancia: 0, montaje: 'contacto' },
    }
    expect(temperaturaDeEquilibrio(FOGATA, 0, 'contacto')).toBe(375)

    // 60 s y no 10: desde el ADR II-0011 la ley 3 avanza `charred` a 0,016 por
    // segundo y cruza los 0,8 que la ley 4 pide a los 50 s. Con los 0,2 de antes,
    // cualquier cosa encendida cruzaba ese umbral a los cuatro segundos y ninguna
    // fogata llegaba a cocinar nada. Ver la tasa de la ley 3 en `leyes.ts`.
    const fin = correr(rama, tapado, phys, DT, 60)

    // 1. Cambió de materia, y la materia nueva no existía en el catálogo.
    expect(fin.nuevas).toHaveLength(1)
    const residuo = fin.nuevas[0]!
    expect(phys.substances.has(residuo.id)).toBe(false)
    expect(residuo.tags).toEqual([TAG_RESIDUO_SIN_AIRE])
    // Y NO es orgánico, que es lo que impide que lo recién hecho se deshaga
    // adentro del mismo fuego que lo hizo.
    expect(residuo.tags).not.toContain('organico')

    // 2. La fracción de masa. Exacta, no aproximada: lo leñoso no tiene punto de
    //    cocción, así que la ley 5 nunca corre sobre él y no evapora nada por el
    //    camino. Todo lo que se fue, se lo llevó la ley 4 de una sola vez.
    //
    //    El número se lee de la ley por su CLASE de residuo y no se escribe acá:
    //    si mañana la calibración lo mueve, este test se mueve con ella, y lo que
    //    sigue diciendo es lo que importa — que la masa que queda es la que la
    //    ley 4 declaró y ni un gramo más.
    const fraccion = FRACCION_DE_RESIDUO[TAG_RESIDUO_SIN_AIRE]
    expect(qualityOf(fin.body, 'mass', fin.phys)).toBe(MASA * fraccion)
    expect(fraccion).toBe(0.28)

    // 3. No alimenta, y no porque una lista lo prohíba: `nutrition` es conservada
    //    y lo leñoso ya venía con cero. Ninguna ley pudo subirla.
    expect(qualityOf(fin.body, 'nutrition', fin.phys)).toBe(0)
    expect(totalConservado(fin.body, 'nutrition', fin.phys)).toBe(0)

    // 4. Y quedó lo que hace falta para que sirva de algo: el poder calorífico
    //    concentrado, más alto que el de la materia de la que salió.
    const madre = phys.substances.get('madera')!
    expect(residuo.perUnitMass.fuelEnergy!).toBeGreaterThan(madre.perUnitMass.fuelEnergy!)
  })

  it('no se deshace adentro del fuego que lo hizo', () => {
    // Ése era el bug del ejemplo (a) de una de las propuestas: lo recién hecho
    // nacía adentro de las llamas y se convertía en polvo solo. Acá el residuo
    // no lleva el tag `organico`, así que la ley 4 ya no lo agarra, y su punto de
    // ignición (420) está por encima de los 375 del sitio.
    const rama = cosa('rama', 'vara', 'madera', MASA)
    const tapado: Entorno = {
      celda: CELDA_TAPADA,
      fuente: { potencia: FOGATA, distancia: 0, montaje: 'contacto' },
    }
    const corto = correr(rama, tapado, phys, DT, 60)
    const largo = correr(rama, tapado, phys, DT, 200)
    expect(qualityOf(largo.body, 'mass', largo.phys)).toBe(
      qualityOf(corto.body, 'mass', corto.phys),
    )
    expect(largo.nuevas).toHaveLength(1)
  })

  it('taparlo o no taparlo son dos técnicas distintas, y la diferencia es un número', () => {
    // Ésta es la parte que hace que sea una TÉCNICA y no un caso especial: la
    // misma rama, el mismo fuego, el mismo tiempo. Lo único que cambia es el
    // oxígeno de la celda, y de ahí sale casi cinco veces más materia.
    const rama = cosa('rama', 'vara', 'madera', MASA)
    const fuente = { potencia: FOGATA, distancia: 0, montaje: 'contacto' } as const

    const tapado = correr(rama, { celda: CELDA_TAPADA, fuente }, phys, DT, 60)
    const alAire = correr(rama, { celda: CELDA_AL_AIRE, fuente }, phys, DT, 60)

    expect(tapado.nuevas[0]!.tags).toEqual([TAG_RESIDUO_SIN_AIRE])
    expect(alAire.nuevas[0]!.tags).toEqual([TAG_RESIDUO_CON_AIRE])
    expect(qualityOf(alAire.body, 'mass', alAire.phys)).toBe(
      MASA * FRACCION_DE_RESIDUO[TAG_RESIDUO_CON_AIRE],
    )

    const rinde =
      qualityOf(tapado.body, 'mass', tapado.phys) / qualityOf(alAire.body, 'mass', alAire.phys)
    expect(rinde).toBeCloseTo(4.667, 3)

    // Y lo que sale de taparlo arde; lo otro, no. Ésa es toda la recompensa.
    expect(tapado.nuevas[0]!.perUnitMass.fuelEnergy!).toBeGreaterThan(20)
    expect(alAire.nuevas[0]!.perUnitMass.fuelEnergy!).toBe(0)
  })

  it('lo mineral no cambia de materia por más fuego que se le ponga', () => {
    // La ley 4 se corta en `tags.includes('organico')`. No hay ningún `if` con
    // un nombre adentro: hay un tag que no está.
    const canto = cosa('canto', 'bloque', 'piedra', MASA)
    const fin = correr(
      canto,
      { celda: CELDA_TAPADA, fuente: { potencia: HOGUERA, distancia: 0, montaje: 'contacto' } },
      phys,
      DT,
      100,
    )
    expect(fin.nuevas).toHaveLength(0)
    expect(qualityOf(fin.body, 'mass', fin.phys)).toBe(MASA)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// (b) UN FILETE CARNOSO SOBRE LA PARRILLA
//
// El documento pide: sobre parrilla a d=1, `digestibility` 0.35 → arriba de 0.85
// con la nutrición intacta; y arruinado si se lo deja subir de su punto de
// pirólisis. Los dos lados del mismo borde.

describe('(b) un filete carnoso sobre la parrilla', () => {
  const MASA = 0.4
  const filete = cosa('filete', 'filete', 'carne', MASA)

  it('la parrilla a distancia 1 da 90 °C, que es la ventana y no el borde', () => {
    // Las cuatro filas de `formFactor` del documento, que resultaron ser la
    // misma función evaluada en cuatro puntos (Hito 0, hallazgo 1).
    expect(formFactor(2, 'piso')).toBeCloseTo(0.012, 12)
    expect(formFactor(1, 'piso')).toBeCloseTo(0.03, 12)
    expect(formFactor(0, 'contacto')).toBeCloseTo(0.6, 12)
    expect(formFactor(1, 'parrilla')).toBeCloseTo(0.125, 12)

    expect(temperaturaDeEquilibrio(FOGATA, 1, 'parrilla')).toBe(90)
    const materia = phys.substances.get('carne')!
    expect(90).toBeGreaterThan(materia.perUnitMass.denaturesAt!)
    expect(90).toBeLessThan(materia.perUnitMass.pyrolysisAt!)
  })

  it('sube de 0.35 a más de 0.85 sin perder la comida', () => {
    const crudo = qualityOf(filete, 'digestibility', phys)
    expect(crudo).toBe(0.35)
    const nutricionAntes = totalConservado(filete, 'nutrition', phys)
    const caloriasAntes = qualityOf(filete, 'calories', phys)

    const fin = correr(
      filete,
      { celda: CELDA_AL_AIRE, fuente: { potencia: FOGATA, distancia: 1, montaje: 'parrilla' } },
      phys,
      DT,
      20,
    )

    expect(qualityOf(fin.body, 'digestibility', fin.phys)).toBeGreaterThan(0.85)
    // Y la toxicidad se fue con la cocción: es la otra mitad del premio.
    expect(qualityOf(fin.body, 'toxicity', fin.phys)).toBeLessThan(0.05)

    // LA NUTRICIÓN INTACTA, y hay que ser preciso sobre qué quiere decir: el
    // número de la sustancia —9 por unidad de masa— sale prácticamente igual que
    // entró, porque la ley 5 no lo toca. Lo que se fue es agua, y el agua se
    // lleva masa. El 0.07% que falta no es de la cocción: es la ley 6 mordiendo
    // durante los diez ticks que el filete tarda en llegar a 63 °C desde frío.
    // El test de acá abajo lo separa y lo mide exacto.
    //
    // El número MEDIDO es 0,998910 y hasta el ADR II-0011 era 0,999163: la ley 1
    // pasó a integrarse en forma cerrada y el Euler explícito venía SOBREESTIMANDO
    // el calentamiento (con `r·dt` = 0,357, `r` contra `1 − e^(−r)` = 0,300), así
    // que el filete tarda unos ticks más en llegar a sus 63 °C y la ley 6 muerde
    // esos ticks de más. Es el mismo 0,1%, medido con la integración que no
    // depende de la frecuencia.
    expect(qualityOf(fin.body, 'nutrition', fin.phys) / 9).toBeGreaterThan(0.9989)
    expect(qualityOf(fin.body, 'mass', fin.phys)).toBeLessThan(MASA)

    // Y el TOTAL, que es lo que la conservación mira, baja exactamente lo que
    // pesa el agua que se fue. Nunca sube: eso es lo que hace que Ánima no pueda
    // fabricar comida cocinando.
    const nutricionDespues = totalConservado(fin.body, 'nutrition', fin.phys)
    expect(nutricionDespues).toBeLessThanOrEqual(nutricionAntes)
    expect(nutricionDespues / nutricionAntes).toBeGreaterThan(0.98)

    // Y el resultado de todo esto: rinde más del doble que crudo. `calories` es
    // derivada (`nutrition · mass · digestibility`), no un permiso.
    expect(caloriasAntes).toBeCloseTo(1.26, 10)
    expect(qualityOf(fin.body, 'calories', fin.phys)).toBeGreaterThan(2 * caloriasAntes)
  })

  it('la ley 5 no toca la nutrición: ni un bit, en cuatrocientos ticks', () => {
    // El mismo filete, pero puesto ya a temperatura de la parrilla. Así la ley 6
    // nunca corre —arriba del punto de cocción no hay putrefacción— y lo único
    // que actúa es la ley 5. El número de nutrición sale IDÉNTICO al que entró:
    // no aproximadamente, idéntico. Lo que baja es la masa, y con ella el total.
    const yaCaliente: Body = { ...filete, state: { temperature: 90 } }
    const fin = correr(
      yaCaliente,
      { celda: CELDA_AL_AIRE, fuente: { potencia: FOGATA, distancia: 1, montaje: 'parrilla' } },
      phys,
      DT,
      20,
    )
    expect(fin.leyes).toEqual(['termica', 'desnaturalizacion'])
    expect(qualityOf(fin.body, 'nutrition', fin.phys)).toBe(9)
    expect(qualityOf(fin.body, 'digestibility', fin.phys)).toBeGreaterThan(0.85)
    expect(qualityOf(fin.body, 'mass', fin.phys)).toBeLessThan(MASA)
    expect(totalConservado(fin.body, 'nutrition', fin.phys)).toBeLessThan(
      totalConservado(yaCaliente, 'nutrition', phys),
    )
  })

  it('comer antes o comer mejor: el sitio rápido rinde menos', () => {
    // La tensión que el barrido térmico del Hito 0 midió y que el exponente 2 de
    // la evaporación hace existir. Sin ella, cocinar sería «hacé el fuego más
    // grande que puedas» y no habría técnica que aprender.
    const parrilla: Entorno = {
      celda: CELDA_AL_AIRE,
      fuente: { potencia: FOGATA, distancia: 1, montaje: 'parrilla' },
    }
    const masCaliente: Entorno = {
      celda: CELDA_AL_AIRE,
      fuente: { potencia: HOGUERA, distancia: 1, montaje: 'parrilla' },
    }
    const meta = 0.86

    // En SEGUNDOS y no en ticks (ADR II-0008): «cuánto tarda en cocinarse» es
    // ritmo, y el ritmo no depende de la frecuencia. Se busca de a un paso
    // porque un paso es la resolución con la que el mundo puede contestar.
    const segundosHasta = (e: Entorno): number => {
      for (let n = 1; n <= 2000; n++) {
        const segundos = n * DT
        const r = correr(filete, e, phys, DT, segundos)
        if (qualityOf(r.body, 'digestibility', r.phys) >= meta) return segundos
      }
      return -1
    }
    const tLento = segundosHasta(parrilla)
    const tRapido = segundosHasta(masCaliente)
    expect(tRapido).toBeGreaterThan(0)
    expect(tRapido).toBeLessThan(tLento)

    // Más rápido, sí. Pero con menos comida adentro: el agua se va más rápido de
    // lo que la carne se ablanda, y eso es el `k²` de la ley 5.
    const lento = correr(filete, parrilla, phys, DT, tLento)
    const rapido = correr(filete, masCaliente, phys, DT, tRapido)
    expect(qualityOf(rapido.body, 'calories', rapido.phys)).toBeLessThan(
      qualityOf(lento.body, 'calories', lento.phys),
    )
  })

  it('se arruina si se lo deja subir de su punto de pirólisis', () => {
    // En contacto con el fuego grande, 735 °C. El agua se va, se cruza el punto,
    // y de ahí no se vuelve: `charred` no relaja hacia ningún lado.
    const brasas: Entorno = {
      celda: CELDA_AL_AIRE,
      fuente: { potencia: HOGUERA, distancia: 0, montaje: 'contacto' },
    }
    expect(temperaturaDeEquilibrio(HOGUERA, 0, 'contacto')).toBe(735)
    expect(735).toBeGreaterThan(phys.substances.get('carne')!.perUnitMass.pyrolysisAt!)

    // 80 s y no 10, por la misma razón que arriba: la tasa de `charred` pasó de
    // 0,2 a 0,016 por segundo (ADR II-0011) y llega a 1 a los 62,5 s. Y eso es lo
    // que hace que sacarla a tiempo sea una técnica: antes se arruinaba en cuatro
    // segundos, que no alcanza para ir a buscarla.
    const olvidado = correr(filete, brasas, phys, DT, 80)
    expect(qualityOf(olvidado.body, 'charred', olvidado.phys)).toBeGreaterThan(0.9)
    expect(qualityOf(olvidado.body, 'nutrition', olvidado.phys)).toBe(0)
    expect(qualityOf(olvidado.body, 'calories', olvidado.phys)).toBe(0)
    // El mundo no negocia: lo que era comida ya no lo es, y no hay ley que lo
    // devuelva porque `nutrition` es conservada y solo baja.
    expect(totalConservado(olvidado.body, 'nutrition', olvidado.phys)).toBe(0)
  })

  it('el sitio que no alcanza tampoco cocina, y eso también es información', () => {
    // En el piso a dos celdas, 22 °C: por debajo del punto de cocción de la
    // carne. La ley 5 nunca corre. Estar cerca del fuego no es cocinar.
    expect(temperaturaDeEquilibrio(FOGATA, 2, 'piso')).toBeCloseTo(22.2, 10)
    const lejos = correr(
      filete,
      { celda: CELDA_AL_AIRE, fuente: { potencia: FOGATA, distancia: 2, montaje: 'piso' } },
      phys,
      DT,
      20,
    )
    expect(lejos.leyes).not.toContain('desnaturalizacion')
    expect(qualityOf(lejos.body, 'digestibility', lejos.phys)).toBe(0.35)
    // Y encima se pudre, porque a 22 °C la ley 6 sigue corriendo.
    expect(qualityOf(lejos.body, 'decay', lejos.phys)).toBeGreaterThan(0.05)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// (c) UNA VARA Y UNA HEBRA
//
// El documento pide: `union(vara, hebra)` → ensamble con `catch > 0` y
// `reach ≥ 2`, e IGUAL con hueso y tendón. El «e igual» es todo el ejemplo: si
// hubiera que escribir el objeto, habría que escribirlo dos veces.

describe('(c) atar una hebra a una vara', () => {
  /** Cualquier cosa larga y rígida. Sale de un árbol o de un animal, da lo mismo. */
  const largos: readonly (readonly [string, string])[] = [
    ['vegetal', 'madera'],
    ['animal', 'hueso'],
  ]
  /** Cualquier cosa flexible que aguante tracción. Sale de una planta o de un animal. */
  const ataduras: Readonly<Record<string, string>> = { vegetal: 'liana', animal: 'tendon' }

  it.each(largos)('%s: el ensamble alcanza y engancha, y nadie escribió el objeto', (linaje, largo) => {
    const atadura = ataduras[linaje]!
    const palo = cosa('largo', 'vara', largo, 0.5)
    const hebra = cosa('atadura', 'hebra', atadura, 0.2)

    // 1. La atadura califica por CUALIDADES, no por sustancia: flexibilidad y
    //    tracción. El rol no dice de qué está hecha y no podría decirlo.
    const rolAtador = UNION.roles.find((r) => r.name === 'binder')!
    expect(cumpleRol(hebra, rolAtador, phys), `${atadura} no sirve de atadura`).toBe(true)

    // 2. El rol opcional: sin `b`, la atadura SOBREVIVE como parte, atada de un
    //    solo lado, y le queda una punta suelta. Esa punta es todo el asunto.
    const ensamble = unir(palo, undefined, hebra, phys, `ensamble-${linaje}`)
    expect(ensamble).toBeDefined()

    // 3. Las dos afordancias que pide el hito, y las dos son DERIVADAS de la
    //    geometría de las partes: no se guardan en ningún lado.
    expect(qualityOf(ensamble!, 'reach', phys)).toBeGreaterThanOrEqual(2)
    expect(qualityOf(ensamble!, 'catch', phys)).toBeGreaterThan(0)

    // 4. Y con eso califica para sacar del río. Nadie escribió el aparejo: se
    //    presentó cualquier cosa que cumpliera los dos números.
    const rolAparejo = EXTRACCION.roles.find((r) => r.name === 'gear')!
    expect(cumpleRol(ensamble!, rolAparejo, phys)).toBe(true)
  })

  it('ninguna de las dos partes sueltas califica: lo que sirve es el ensamble', () => {
    const rolAparejo = EXTRACCION.roles.find((r) => r.name === 'gear')!
    for (const [, largo] of largos) {
      const palo = cosa('largo', 'vara', largo, 0.5)
      // Alcance tiene; enganche no, porque no le cuelga nada.
      expect(qualityOf(palo, 'reach', phys)).toBeGreaterThanOrEqual(2)
      expect(qualityOf(palo, 'catch', phys)).toBe(0)
      expect(cumpleRol(palo, rolAparejo, phys)).toBe(false)
    }
    for (const linaje of Object.keys(ataduras)) {
      const hebra = cosa('atadura', 'hebra', ataduras[linaje]!, 0.2)
      // Cuelga, pero no llega: `reach` es el eje más largo y una hebra de 0.2
      // no alcanza los 2 que pide el rol.
      expect(cumpleRol(hebra, rolAparejo, phys)).toBe(false)
    }
  })

  it('una punta con filo engancha más, y tampoco hay que escribir el anzuelo', () => {
    // `catch = freeStrandEnds × (0.15 + max(sharpness) × 0.5)`. Lo animal trae
    // `sharpness` porque astillado ya corta; lo vegetal no. La misma fórmula da
    // dos números distintos y nadie escribió ninguno de los dos objetos.
    const conFilo = unir(
      cosa('largo', 'vara', 'hueso', 0.5),
      undefined,
      cosa('atadura', 'hebra', 'tendon', 0.2),
      phys,
      'con-filo',
    )!
    const sinFilo = unir(
      cosa('largo', 'vara', 'madera', 0.5),
      undefined,
      cosa('atadura', 'hebra', 'liana', 0.2),
      phys,
      'sin-filo',
    )!
    expect(qualityOf(conFilo, 'catch', phys)).toBeGreaterThan(qualityOf(sinFilo, 'catch', phys))
  })

  it('atar dos cosas gasta la atadura, y entonces no queda punta suelta', () => {
    // Con el rol `b` puesto, la atadura se va adentro de la junta y el ensamble
    // queda firme — que es lo que hace falta para un trípode y lo que NO sirve
    // para enganchar. La misma ley, dos resultados, según qué se le dé.
    const tripode = unir(
      cosa('a', 'vara', 'madera', 0.5),
      cosa('b', 'vara', 'madera', 0.5),
      cosa('atadura', 'hebra', 'liana', 0.2),
      phys,
      'tripode',
    )!
    expect(qualityOf(tripode, 'catch', phys)).toBe(0)
    expect(tripode.joints).toHaveLength(1)
    expect(tripode.joints[0]!.via).toBe('liana')
    // Y la atadura buena ata más fuerte que la floja, sin ninguna tabla.
    const conTendon = unir(
      cosa('a', 'vara', 'madera', 0.5),
      cosa('b', 'vara', 'madera', 0.5),
      cosa('atadura', 'hebra', 'tendon', 0.2),
      phys,
      'tripode-2',
    )!
    expect(conTendon.joints[0]!.strength).toBeGreaterThan(tripode.joints[0]!.strength)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// EL GUARDIÁN

describe('el vocabulario prohibido', () => {
  it('ninguna de las tres palabras aparece en este archivo', () => {
    // Se arman en pedazos para que este mismo test no las contenga. Y se
    // normaliza el texto —minúsculas y sin acentos— porque prohibir una palabra
    // pero admitirla con tilde o en mayúscula sería una prohibición decorativa.
    // El chequeo es por SUBCADENA y no por palabra entera, que es más duro de lo
    // que el criterio pide: acá adentro no puede aparecer ni «traspapelar» si
    // llevara una de las tres adentro.
    const prohibidas = [
      ['car', 'bon'].join(''),
      ['as', 'ar'].join(''),
      ['pes', 'car'].join(''),
    ]
    const fuente = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
    for (const p of prohibidas) {
      expect(fuente.includes(p), `se coló «${p}» en el test de los tres ejemplos`).toBe(false)
    }
  })
})
