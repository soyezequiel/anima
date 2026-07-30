// ─── EL HAMBRE SE MIDE EN SEGUNDOS, Y MATA ───────────────────────────────────
//
// El criterio verificable del ADR II-0009, decisiones 1, 2 y 3, escrito antes que
// el código. Tres preguntas:
//
//   (b) **una criatura quieta y sin comer tarda LO MISMO en quedarse sin
//       `stamina` a 10, 20, 25, 50 y 100 Hz.** Antes tardaba cinco veces menos a
//       100 Hz que a 20 —`COSTO_VIVIR` se cobraba por TICK— y ése es el bug que
//       este archivo cierra. Se miden las dos, la de antes y la de ahora, y la
//       tabla sale por consola: sin el número, «se arregló» es una palabra;
//   (c) **el punto de equilibrio, en números**: cuántos segundos de mundo aguanta
//       sin comer, y cuántos pescados tiene que sacarle al mundo para llegar viva
//       a los 20.000 ticks del criterio del Hito 5;
//   (3) **llegar a cero mata**: el actor sale de `actors`, el cuerpo se queda en
//       su celda como carne comestible, lo que tenía en la mano cae, y sale un
//       `murio` con `por: 'hambre'`. Con los invariantes puestos, porque ésta es
//       la primera vez que el mundo ve irse a un actor.
//
// LO QUE ESTE ARCHIVO NO PRUEBA: que 0,34 por segundo sea el número correcto. Eso
// se mide sobre cien partidas en `oracle/tests/presupuesto.test.ts`, y se afirma
// como VENTANA —el borde de abajo es el tanque de 310 llegando a los 20.000 ticks
// quieta, el de arriba es cocinar dejando de alcanzar— y no como constante. Un
// test que dijera `COSTO_VIVIR_POR_SEGUNDO === 0.34` estaría midiendo su propia
// copia.
//
// LA CONSTANTE ERA 1,0 Y HOY ES 0,34, y este archivo se remidió entero por eso.
// Cada número que se movió tiene el viejo escrito al lado.

import { describe, expect, it } from 'vitest'
import {
  buildSeedPhysics,
  dtDeFrecuencia,
  FRECUENCIAS_ADMISIBLES,
  HZ_DE_REFERENCIA,
  qualityOf,
} from '@anima/physics'

import {
  COSTO_POR_CELDA,
  COSTO_POR_TOXICIDAD_Y_KILO,
  COSTO_VIVIR_POR_SEGUNDO,
  stepWorld,
} from '../src/step.js'
import type { SimEvent, WorldState } from '../src/step.js'
import { revisarInvariantes } from '../src/invariants.js'
import { eat, goTo, take } from '../src/intent.js'
import { actor, criatura, cuerpo, enElPiso, enLaMano, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number) => ({ x, y })

const FISICA = buildSeedPhysics()

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

/** Con cuánta `stamina` llega la criatura: la mitad del techo del catálogo. */
const TANQUE = 500

/**
 * Con cuánta llega la del Hito 5, que NO es la de este archivo. Está acá desde que
 * `COSTO_VIVIR_POR_SEGUNDO` bajó a 0,34: con el tanque de 500 la criatura quieta
 * pasa los 20.000 ticks sin comer, así que el tanque que le da contenido al
 * criterio es éste y no aquél. Es el borde de abajo de la ventana que
 * `oracle/tests/presupuesto.test.ts` publica.
 */
const TANQUE_DEL_HITO_5 = 310

/** El criterio del Hito 5, en ticks y a la frecuencia de referencia. */
const TICKS_DEL_CRITERIO = 20_000

function staminaDe(w: WorldState, id: string): number {
  const c = w.bodies.get(`${id}-cuerpo`)
  return c === undefined ? Number.NaN : qualityOf(c.body, 'stamina', w.phys)
}

interface Ayuno {
  readonly ticks: number
  readonly segundos: number
  readonly murio: boolean
}

/**
 * Una criatura quieta, sin comer, hasta que se muere. Mundo aparte y mínimo: un
 * solo cuerpo, ninguna intención, ningún proceso. Lo único que le pasa es el
 * tiempo.
 */
function ayunar(hz: number, tanque = TANQUE): Ayuno {
  let w = mundo({ hz, bodies: [enElPiso(criatura('ana', tanque), EN(0, 0))], actors: [actor('ana')] })
  const dt = dtDeFrecuencia(hz)
  // 1600 s y no 600: con 0,34 por segundo el tanque de 500 dura 1470,6 s. Es el
  // techo del ARNÉS —cuándo deja de mirar— y no un umbral del mundo.
  const techo = Math.round(1600 / dt)
  for (let n = 1; n <= techo; n++) {
    const paso = stepWorld(w, [])
    w = paso.state
    const seFue = paso.events.some((e) => e.k === 'murio' && e.por === 'hambre')
    if (seFue) return { ticks: n, segundos: n * dt, murio: !w.actors.has('ana') }
  }
  return { ticks: -1, segundos: Number.NaN, murio: false }
}

/**
 * EL MODELO VIEJO, en tres líneas: `COSTO_VIVIR = 0.01` restado por TICK, sin
 * pasar por `porPaso`. No se importa de ningún lado porque ya no existe —el ADR
 * II-0009 lo borró sin dejar alias— y está acá para que la tabla tenga con qué
 * comparar. Fijate que el número de TICKS no depende de `hz`: ése es el bug.
 */
function ayunarComoAntes(hz: number): Ayuno {
  const COSTO_VIVIR_POR_TICK = 0.01
  let s = TANQUE
  let n = 0
  while (s > 0) {
    s = s - COSTO_VIVIR_POR_TICK
    n++
  }
  return { ticks: n, segundos: n / hz, murio: false }
}

// ─── (b) EL CRITERIO: el ayuno dura lo mismo a las cinco frecuencias ────────

describe('una criatura quieta y sin comer tarda lo mismo a 10, 20, 25, 50 y 100 Hz', () => {
  it('la tabla: lo que duraba antes y lo que dura ahora', () => {
    const antes = FRECUENCIAS_ADMISIBLES.map((hz) => ayunarComoAntes(hz))
    const ahora = FRECUENCIAS_ADMISIBLES.map((hz) => ayunar(hz))

    // AHORA: los mismos segundos a las cinco. La tolerancia es de MEDIO TICK del
    // muestreo más grueso más el residuo de punto flotante de restar diez mil
    // veces un número que no es exacto en binario, y no un «epsilon por las
    // dudas»: la dispersión medida es de 4·10⁻⁵ s.
    const referencia = ahora[FRECUENCIAS_ADMISIBLES.indexOf(HZ_DE_REFERENCIA)] as Ayuno
    let peor = 0
    for (let i = 0; i < ahora.length; i++) {
      const a = ahora[i] as Ayuno
      expect([FRECUENCIAS_ADMISIBLES[i], a.murio]).toEqual([FRECUENCIAS_ADMISIBLES[i], true])
      const desvio = Math.abs(a.segundos - referencia.segundos)
      if (desvio > peor) peor = desvio
      expect(
        [FRECUENCIAS_ADMISIBLES[i], desvio <= 0.1],
        `a ${String(FRECUENCIAS_ADMISIBLES[i])} Hz aguanta ${a.segundos.toFixed(2)} s contra ${referencia.segundos.toFixed(2)} s a ${String(HZ_DE_REFERENCIA)} Hz`,
      ).toEqual([FRECUENCIAS_ADMISIBLES[i], true])
    }

    // ANTES: el control negativo, y es el bug entero en una línea. El mismo mundo
    // aguantaba CINCO VECES MENOS a 100 Hz que a 20, porque el costo se contaba en
    // muestras y no en segundos.
    // Y el bug entero cabe en una afirmación: los TICKS que aguantaba eran los
    // mismos a las cinco frecuencias, así que los SEGUNDOS no podían serlo.
    expect(antes.map((a) => a.ticks)).toEqual(FRECUENCIAS_ADMISIBLES.map(() => antes[0]?.ticks))
    const antes20 = (antes[FRECUENCIAS_ADMISIBLES.indexOf(20)] as Ayuno).segundos
    const antes100 = (antes[FRECUENCIAS_ADMISIBLES.indexOf(100)] as Ayuno).segundos
    const antes10 = (antes[FRECUENCIAS_ADMISIBLES.indexOf(10)] as Ayuno).segundos
    expect(Number((antes20 / antes100).toFixed(9))).toBe(5)
    expect(Number((antes10 / antes100).toFixed(9))).toBe(10)

    log([
      '══ LO QUE AGUANTA SIN COMER, EN SEGUNDOS DE MUNDO ═══════════════════════',
      `  ${''.padEnd(26)}${FRECUENCIAS_ADMISIBLES.map((h) => `${String(h)} Hz`.padStart(12)).join('')}`,
      `  ANTES (0,01 por TICK)     ${antes.map((a) => `${a.segundos.toFixed(2)} s`.padStart(12)).join('')}`,
      `  AHORA (0,34 por SEGUNDO)  ${ahora.map((a) => `${a.segundos.toFixed(2)} s`.padStart(12)).join('')}`,
      '',
      `  ANTES, en ticks           ${antes.map((a) => String(a.ticks).padStart(12)).join('')}`,
      `  AHORA, en ticks           ${ahora.map((a) => String(a.ticks).padStart(12)).join('')}`,
      '',
      `  antes: los TICKS no dependían de la frecuencia, así que los SEGUNDOS sí.`,
      `  ahora: al revés, que es lo que el ADR II-0007 pide. Peor desvío: ${peor.toFixed(5)} s.`,
    ])
  }, 120_000)

  it('documentado · aguanta 1470,6 s, y con el tanque del Hito 5 no llega a los 20.000', () => {
    // ─── EL NÚMERO SE MOVIÓ CON `COSTO_VIVIR_POR_SEGUNDO` 1,0 → 0,34 ────────
    //
    // Este bloque se llamaba «aguanta 500 s, o sea la MITAD EXACTA del criterio del
    // Hito 5» y afirmaba `a.ticks === 10.000`. Con el segundo cinco veces más barato
    // el tanque de 500 de ESTE archivo dura 1470,6 s = 29.412 ticks, o sea que pasa
    // los 20.000 sin hacer nada. La mitad exacta era una coincidencia de aquella
    // constante y ya no existe.
    //
    // Lo que sí sigue en pie —y es lo que el bloque venía a decir, «el criterio no
    // lo cumple una piedra»— hay que medirlo con el tanque del criterio, que es 310
    // y no 500: ahí la criatura quieta se muere en el 18.236 de los 20.000.
    const a = ayunar(HZ_DE_REFERENCIA)
    expect(a.ticks).toBe(29_412) // era 10.000 con 1,0 por segundo
    expect(Number(a.segundos.toFixed(4))).toBe(1470.6) // eran 500,00 s
    // Y `stamina` se lee como lo que ahora es: SEGUNDOS DE VIDA, sólo que el segundo
    // salió más barato. Mil de `stamina` son 2941 s de mundo (eran 1000), y el tanque
    // de 500 son 1470,59 s (eran 500).
    expect(Number((TANQUE / COSTO_VIVIR_POR_SEGUNDO).toFixed(4))).toBe(1470.5882)
    // EL CONTENIDO DEL CRITERIO, con el tanque que el criterio usa.
    const delCriterio = ayunar(HZ_DE_REFERENCIA, TANQUE_DEL_HITO_5)
    expect(delCriterio.ticks).toBe(18_236)
    expect(delCriterio.ticks).toBeLessThan(TICKS_DEL_CRITERIO)
  }, 120_000)

  it('documentado · el tick exacto de la muerte a cada frecuencia', () => {
    // Los ticks no son `500 × hz` clavados: restar diez mil veces un número que no
    // es exacto en binario deja un residuo, y a 50 y 100 Hz sobrevive un tick más.
    // Se clava lo medido —no lo redondo— para que un cambio en `porPaso` se vea.
    const medidos = FRECUENCIAS_ADMISIBLES.map((hz) => ayunar(hz).ticks)
    for (let i = 0; i < medidos.length; i++) {
      const hz = FRECUENCIAS_ADMISIBLES[i] as number
      const exacto = (TANQUE / COSTO_VIVIR_POR_SEGUNDO) * hz
      expect([hz, Math.abs((medidos[i] as number) - exacto) <= 2]).toEqual([hz, true])
    }
    log([`══ EL TICK DE LA MUERTE ══  ${FRECUENCIAS_ADMISIBLES.map((h, i) => `${String(h)} Hz: ${String(medidos[i])}`).join('   ')}`])
  }, 120_000)

  it('vivir diez segundos de mundo cuesta 3,4 de stamina a cualquier frecuencia', () => {
    // El mismo hecho mirado desde el otro lado y sin esperar a la muerte: es el
    // `it.fails` que `el-tiempo-no-depende-del-tick.test.ts` tenía abierto.
    // Eran 10,0 con `COSTO_VIVIR_POR_SEGUNDO` en 1,0 y hoy son 3,4: lo que se afirma
    // es la CUENTA `10 × la constante`, no el número escrito a mano, y los dos lados
    // se redondean porque `10 × 0.34` da 3,4000000000000004 en IEEE-754.
    const esperado = Number((10 * COSTO_VIVIR_POR_SEGUNDO).toFixed(6))
    for (const hz of FRECUENCIAS_ADMISIBLES) {
      let w = mundo({ hz, bodies: [enElPiso(criatura('ana', TANQUE), EN(0, 0))], actors: [actor('ana')] })
      const pasos = Math.round(10 / dtDeFrecuencia(hz))
      for (let n = 0; n < pasos; n++) w = stepWorld(w, []).state
      const gastado = TANQUE - staminaDe(w, 'ana')
      expect([hz, Number(gastado.toFixed(6))]).toEqual([hz, esperado])
    }
    expect(esperado).toBe(3.4)
  })
})

// ─── (c) EL PUNTO DE EQUILIBRIO, EN NÚMEROS ─────────────────────────────────

/**
 * La `toxicity` de un pescado de 2 kg **EN EL INSTANTE EN QUE EL MUNDO LO LLAMA
 * COCIDO** (`digestibility ≥ 0,85`), medida corriendo la ley 5 de verdad adentro
 * de `stepWorld` en `tests/el-veneno-se-cobra.test.ts` (c), que la clava.
 *
 * No se estima y no se supone cero: baja de 0,25 a 0,0345, o sea que **la ley 5 se
 * lleva el 86% del veneno antes de terminar de ablandar**. Esa asimetría no la
 * escribió nadie —la destoxificación es multiplicativa y la digestibilidad se
 * acerca a un techo— y es la mitad de por qué cocinar paga.
 */
const TOXICIDAD_DEL_PESCADO_COCIDO = 0.0345

describe('cuántas comidas hacen falta para llegar viva a los 20.000 ticks', () => {
  /** Lo que rinde en `stamina` un pescado de 2 kg, crudo y cocinado, **con el
   *  veneno ya descontado** (ADR II-0013). Las dos mitades salen de la física: las
   *  calorías de la cualidad derivada y el veneno de `toxicity · masa · K`. */
  const pescado = (digestibility?: number, toxicity?: number): number => {
    const b = cuerpo('pez', 'pescado', 2, {
      ...(digestibility === undefined ? {} : { digestibility }),
      ...(toxicity === undefined ? {} : { toxicity }),
    })
    const cal = qualityOf(b, 'calories', FISICA)
    const veneno =
      qualityOf(b, 'toxicity', FISICA) * qualityOf(b, 'mass', FISICA) * COSTO_POR_TOXICIDAD_Y_KILO
    return cal - veneno
  }

  it('los números, sin prosa', () => {
    const segundosDeLaCorrida = TICKS_DEL_CRITERIO / HZ_DE_REFERENCIA
    const costo = segundosDeLaCorrida * COSTO_VIVIR_POR_SEGUNDO
    // Lo que tiene que sacarle al mundo: el costo menos lo que trae puesto.
    const conTanque = costo - TANQUE
    // Y sin contar el tanque, que es lo que pide el riesgo 4: que el balance no
    // dependa de con cuánto arrancó.
    const sinTanque = costo

    const crudo = pescado()
    const cocinado = pescado(0.95, TOXICIDAD_DEL_PESCADO_COCIDO)

    // ─── LOS TRES SE MOVIERON CON `COSTO_VIVIR_POR_SEGUNDO` 1,0 → 0,34 ──────
    //
    // Eran 1000 s, 1000 de costo y 500 que sacarle al mundo. Vivir los mil segundos
    // ahora sale 340, o sea que **el tanque de 500 de este archivo ya le sobra**: el
    // saldo da +160 y la criatura quieta llega a los 20.000 ticks sin comer. Con el
    // tanque del criterio (310) el saldo se da vuelta y faltan 30, que son las tres
    // piezas cocinadas de más abajo.
    expect(segundosDeLaCorrida).toBe(1000)
    expect(costo).toBe(340) // era 1000
    expect(conTanque).toBe(-160) // eran 500
    expect(costo - TANQUE_DEL_HITO_5).toBe(30)

    // ─── EL NÚMERO QUE DIO VUELTA: 83 PESCADOS CRUDOS YA NO ALCANZAN ───────
    //
    // Este bloque decía «un pescado de 2 kg CRUDO rinde 6,08 → 83 piezas», y el 83
    // es el número que el criterio del Hito 5 cita textual («para llegar a 20.000
    // le faltaban 83 pescados»). Con el ADR II-0013 ese 83 **no existe**: el mismo
    // pescado acredita 6,08 de calorías y el veneno se lleva 12,50 (`toxicity` 0,25
    // × 2 kg × 25), así que cada bocado crudo deja −6,42 y **ninguna cantidad de
    // pescado crudo llega a los 20.000 ticks**. Comer crudo dejó de ser una
    // estrategia lenta y pasó a ser una estrategia imposible.
    //
    // Cocinado sí: 15,20 de calorías contra 1,73 de veneno, o sea 13,47 netos.
    expect(Number(crudo.toFixed(4))).toBe(-6.42)
    expect(Number(cocinado.toFixed(4))).toBe(13.475)
    // Y la única cosa que separa a los dos es lo que la ley 5 hizo: nadie escribió
    // «cocinar rinde más». Antes del ADR II-0013 el cociente era 2,50× y salía sólo
    // de `digestibility`; ahora el crudo es negativo y el cociente no es un número:
    // es un cambio de signo.
    expect(crudo).toBeLessThan(0)
    expect(cocinado).toBeGreaterThan(0)

    const piezas = (falta: number, rinde: number): number =>
      falta <= 0 ? 0 : rinde > 0 ? Math.ceil(falta / rinde) : Number.POSITIVE_INFINITY
    // La rama `falta <= 0` no existía y hay que decir por qué existe: con el tanque
    // de 500 y el segundo a 0,34 ya no falta nada, así que la cuenta vieja
    // (`Math.ceil(-160 / 13,475)`) devolvía −11 piezas, que no es un número de
    // piezas. Lo que sigue significando algo es el balance SIN tanque —lo que el
    // riesgo 4 pide— y el balance con el tanque del criterio.
    expect(piezas(sinTanque, crudo)).toBe(Number.POSITIVE_INFINITY)
    expect(piezas(conTanque, cocinado)).toBe(0) // eran 38: con 500 de tanque ya no falta
    expect(piezas(sinTanque, cocinado)).toBe(26) // eran 75
    expect(piezas(costo - TANQUE_DEL_HITO_5, cocinado)).toBe(3)

    log([
      `══ EL PRESUPUESTO DE UNA PARTIDA DE ${String(TICKS_DEL_CRITERIO)} TICKS A ${String(HZ_DE_REFERENCIA)} Hz ══`,
      `  dura ......................... ${segundosDeLaCorrida.toFixed(0)} s de mundo (cinco días)`,
      `  vivir cuesta ................. ${costo.toFixed(0)} de stamina   (eran 1000 con 1,0 por segundo)`,
      `  llega con .................... ${String(TANQUE)}   (el tanque del Hito 5 es ${String(TANQUE_DEL_HITO_5)})`,
      `  tiene que sacarle al mundo ... ${conTanque.toFixed(0)}   (o ${sinTanque.toFixed(0)} si el tanque no cuenta, o ${(costo - TANQUE_DEL_HITO_5).toFixed(0)} con el del Hito 5)`,
      '',
      `  un pescado de 2 kg CRUDO ..... ${crudo.toFixed(2)} de stamina  →  NUNCA alcanza (era 6,08 → 83 piezas)`,
      `  el mismo COCINADO ............ ${cocinado.toFixed(2)} de stamina  →  ${String(piezas(sinTanque, cocinado))} piezas sin tanque  (${String(piezas(costo - TANQUE_DEL_HITO_5, cocinado))} con el tanque del Hito 5)`,
      '',
      '  el veneno del ADR II-0013 le da vuelta el signo al crudo: 6,08 de calorías',
      '  contra 12,50 de veneno. Cocinar dejó de ser una mejora y pasó a ser la',
      '  única forma de que el pescado alimente, y nadie lo escribió: sale de que la',
      '  ley 5 se lleva el 86% de la `toxicity` mientras sube la `digestibility`.',
    ])
  })

  it.fails('SE ROMPIÓ · caminar sin parar ya no cuesta lo mismo que vivir: cuesta 2,94×', () => {
    // ─── LO QUE SE PERDIÓ AL BAJAR `COSTO_VIVIR_POR_SEGUNDO` A 0,34 ─────────
    //
    // Este bloque afirmaba una coincidencia que valía la pena: `intencionCaminar`
    // avanza una celda por tick, o sea 20 celdas por segundo a 20 Hz, y cada celda
    // cuesta 0,05 → caminar sin parar salía 1,00 por segundo, EXACTAMENTE lo mismo
    // que vivir. «Ninguna de las dos constantes se eligió mirando a la otra» y aun
    // así daban igual; andar duplicaba el gasto y nada más.
    //
    // Con 0,34 la coincidencia se terminó, y no es un número viejo: es una
    // propiedad del mundo que cambió de forma. MEDIDO acá abajo:
    //
    //   caminar sin parar ... 0,05 × 20 = 1,00 por segundo
    //   vivir ............... 0,34 por segundo
    //   la razón ............ 2,94× a favor de caminar
    //   quieta .............. el tanque de 500 dura 1470,6 s
    //   caminando ........... 373,1 s (eran 250), o sea que andar ahora
    //                         CUADRUPLICA el gasto en vez de duplicarlo
    //
    // No se afloja: se deja fallando la igualdad, porque el día que la locomoción
    // pase a medirse en celdas por SEGUNDO (el hueco 2 de
    // `tests/el-tiempo-no-depende-del-tick.test.ts`) esta cuenta se vuelve a
    // escribir entera y conviene que el rojo esté esperando ahí.
    //
    // Lo que sigue siendo cierto va PRIMERO, para que se afirme de verdad: el
    // `it.fails` corta en la primera que revienta.
    expect(TANQUE / COSTO_POR_CELDA).toBe(10_000)
    expect(COSTO_POR_CELDA * HZ_DE_REFERENCIA).toBe(1)
    expect(Number((TANQUE / (COSTO_POR_CELDA * HZ_DE_REFERENCIA + COSTO_VIVIR_POR_SEGUNDO)).toFixed(4))).toBe(373.1343)
    expect(Number(((COSTO_POR_CELDA * HZ_DE_REFERENCIA) / COSTO_VIVIR_POR_SEGUNDO).toFixed(4))).toBe(2.9412)
    // Y la que se rompió, al final.
    expect(COSTO_POR_CELDA * HZ_DE_REFERENCIA).toBe(COSTO_VIVIR_POR_SEGUNDO)
  })
})

// ─── LA MUERTE ──────────────────────────────────────────────────────────────

/** Una criatura a la que le queda un solo tick de vida a la frecuencia de referencia. */
function alBorde(stamina = 0.01): WorldState {
  return mundo({
    bodies: [enElPiso(criatura('ana', stamina), EN(0, 0))],
    actors: [actor('ana')],
  })
}

function murioDeHambre(events: readonly SimEvent[]): SimEvent | undefined {
  return events.find((e) => e.k === 'murio' && e.por === 'hambre')
}

describe('con la stamina en cero, la criatura se muere', () => {
  it('el actor se va, el cuerpo se queda en su celda, y sale el evento', () => {
    const s = alBorde()
    const r = stepWorld(s, [])
    // El actor se fue.
    expect(r.state.actors.has('ana')).toBe(false)
    // El cuerpo NO: la materia no se destruye, y encima es comida.
    const cadaver = r.state.bodies.get('ana-cuerpo')
    expect(cadaver).toBeDefined()
    expect(cadaver?.at).toEqual(EN(0, 0))
    expect(qualityOf(cadaver!.body, 'stamina', r.state.phys)).toBe(0)
    // Y el evento, con su motivo y sin `by` ni `seq`: a este `murio` no lo causó
    // ninguna intención, así que no hay a qué correlacionarlo.
    const e = murioDeHambre(r.events)
    expect(e).toEqual({ k: 'murio', id: 'ana-cuerpo', por: 'hambre' })
  })

  it('y los invariantes siguen en pie, en el tick de la muerte y en los siguientes', () => {
    // Es la primera vez que el mundo ve irse a un actor. `referencia-colgada` ya
    // existía para esto —`invariants.ts:258` mira que ningún `heldBy` nombre a un
    // actor que no está— así que el detector es más viejo que la muerte.
    let s = alBorde()
    for (let t = 0; t < 5; t++) {
      const r = stepWorld(s, [])
      expect([t, revisarInvariantes(s, r.state, r.events)]).toEqual([t, []])
      s = r.state
    }
    // Y el mundo sigue andando sin actores: los sistemas no se cuelgan con la
    // lista vacía.
    expect(s.tick).toBe(5)
    expect(s.actors.size).toBe(0)
  })

  it('lo que tenía en la mano CAE, y cae en una celda libre y sin dueño', () => {
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana', 0.01), EN(0, 0)),
        enLaMano(cuerpo('cana', 'madera', 1), EN(0, 0), 'ana'),
        enLaMano(cuerpo('piedra', 'piedra', 1), EN(0, 0), 'ana'),
      ],
      actors: [actor('ana', { holding: ['cana', 'piedra'], capacity: 2 })],
    })
    const r = stepWorld(s, [])
    expect(revisarInvariantes(s, r.state, r.events)).toEqual([])
    for (const id of ['cana', 'piedra']) {
      const c = r.state.bodies.get(id)
      expect([id, c === undefined]).toEqual([id, false])
      // Sin dueño: un `heldBy` que nombre al muerto es `referencia-colgada`.
      expect([id, c?.heldBy]).toEqual([id, undefined])
      // Y a los pies, no en el otro extremo del mapa.
      expect([id, Math.abs(c!.at.x) <= 1 && Math.abs(c!.at.y) <= 1]).toEqual([id, true])
    }
    // Y no en la celda del cadáver, que la ocupa el cadáver: dos sólidos sueltos
    // en la misma celda son un `solidos-solapados`.
    expect(r.state.bodies.get('cana')?.at).not.toEqual(EN(0, 0))
  })

  it('el cadáver es comida: la que viene se come a la que no llegó', () => {
    // El bucle cierra solo. Nadie escribió «canibalismo»: el cuerpo de la criatura
    // es carne con `nutrition`, y comer no pregunta de quién era.
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana', 0.01), EN(0, 0)),
        enElPiso(criatura('beto', 500), EN(1, 0)),
      ],
      actors: [actor('ana'), actor('beto')],
    })
    const muerte = stepWorld(s, [])
    expect(muerte.state.actors.has('ana')).toBe(false)
    const cadaver = muerte.state.bodies.get('ana-cuerpo')!
    expect(qualityOf(cadaver.body, 'calories', muerte.state.phys)).toBeGreaterThan(0)

    const antes = staminaDe(muerte.state, 'beto')
    const comio = stepWorld(muerte.state, [eat({ by: 'beto', seq: 0 }, 'ana-cuerpo')])
    expect(comio.events.some((e) => e.k === 'comio')).toBe(true)
    expect(comio.state.bodies.has('ana-cuerpo')).toBe(false)
    // ─── PERO CRUDO NO PAGA, y eso es del ADR II-0013 ──────────────────────
    //
    // Acá decía `toBeGreaterThan(antes)`, y era cierto sólo mientras el mundo no
    // cobrara `toxicity`. El cadáver son 2 kg de carne: acredita 6,30 de calorías
    // (`9 × 2 × 0,35`) y el veneno se lleva 15 (`0,3 × 2 × 25`). O sea que comerse
    // a la que no llegó, sin fuego, cuesta 8,70 más de lo que da.
    //
    // El bucle sigue cerrando y sigue sin que nadie escribiera «canibalismo»: el
    // cadáver ES comida —el `comio` sale, las calorías son positivas— y lo que el
    // catálogo agrega es que es comida que hay que COCINAR. Nadie lo escribió
    // tampoco: la carne tiene `toxicity` 0,30 desde el Hito 0.
    //
    // Los −8,7288 medidos no son los −8,70 de la cuenta a mano, y la diferencia es
    // información: el cadáver ya vivió UN TICK en el mundo, y la ley 6 le subió el
    // `decay` —y con él la `toxicity`— antes de que nadie lo levantara. La carne
    // muerta empeora desde el primer tick, que es exactamente lo que esa ley dice.
    //
    // Eran −8,7618 con `COSTO_VIVIR_POR_SEGUNDO` en 1,0. Lo único que se movió es el
    // tick de vivir que va adentro del neto: 0,05 → 0,017, o sea 0,033 más arriba.
    const neto = staminaDe(comio.state, 'beto') - antes
    expect(Number(neto.toFixed(4))).toBe(-8.7288)
    const ven = comio.events.find((e) => e.k === 'enveneno')
    expect(ven?.k === 'enveneno' ? Number(ven.cobrado.toFixed(4)) : 0).toBeGreaterThan(15)
    // Y la conversión queda declarada, así que el invariante de conservación la
    // acepta: comer un cadáver no es distinto de comer un pescado.
    expect(revisarInvariantes(muerte.state, comio.state, comio.events)).toEqual([])
  })

  it('las intenciones del muerto se rechazan con un motivo que ya existía', () => {
    const muerte = stepWorld(alBorde(), [])
    const despues = stepWorld(muerte.state, [
      goTo({ by: 'ana', seq: 0 }, EN(3, 3)),
      take({ by: 'ana', seq: 1 }, 'lo-que-sea'),
    ])
    expect(despues.events.filter((e) => e.k === 'rechazada').map((e) => e.por)).toEqual([
      'actor-desconocido',
      'actor-desconocido',
    ])
    // El journal no necesitó nada nuevo para la muerte.
  })

  it('gastar el último aliento caminando mata en el MISMO tick', () => {
    // Los sistemas corren DESPUÉS de las intenciones, así que el paso se da, se
    // cobra hasta exactamente cero, y el metabolismo cierra la puerta al final del
    // mismo tick. Es el orden del contrato de `stepWorld` mirado desde el hambre.
    const s = mundo({
      bodies: [enElPiso(criatura('ana', COSTO_POR_CELDA), EN(0, 0))],
      actors: [actor('ana')],
    })
    const r = stepWorld(s, [goTo({ by: 'ana', seq: 0 }, EN(5, 0))])
    expect(r.events.some((e) => e.k === 'movio')).toBe(true)
    expect(murioDeHambre(r.events)).toBeDefined()
    expect(r.state.actors.has('ana')).toBe(false)
    // Dio el paso: el cadáver quedó una celda más allá de donde arrancó.
    expect(r.state.bodies.get('ana-cuerpo')?.at).toEqual(EN(1, 0))
  })

  it('no se muere quien todavía tiene con qué', () => {
    // El control negativo de todo el bloque: si la muerte se disparara sola, todos
    // los tests de arriba darían verde midiendo nada.
    let w = mundo({ bodies: [enElPiso(criatura('ana', 1), EN(0, 0))], actors: [actor('ana')] })
    for (let t = 0; t < 58; t++) {
      const r = stepWorld(w, [])
      expect([t, murioDeHambre(r.events)]).toEqual([t, undefined])
      w = r.state
    }
    expect(w.actors.has('ana')).toBe(true)
    // Uno de `stamina` son 2,94 s de vida —eran 1,00 con el segundo a 1,0—, o sea
    // 59 ticks a 20 Hz, y el 59 es el último. Antes eran 20.
    const ultimo = stepWorld(w, [])
    expect(murioDeHambre(ultimo.events)).toBeDefined()
  })
})
