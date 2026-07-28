// ─── LAS NUEVE, UNA POR UNA ──────────────────────────────────────────────────
//
// La lista está CERRADA y es de `ii/docs/hito-5-las-diez-secuencias.md` §4. Este
// archivo no la decide: la ejecuta. Si se pudiera ajustar después de ver qué hace
// la criatura, el criterio no mediría nada — mediría al que lo escribió.
//
// Cada entrada declara cuatro cosas y las cuatro son parte del contrato:
//
//   · `nombre`     el kebab-case EXACTO del documento. `tsc` lo verifica.
//   · `mira`       qué patrón de estado busca, en una línea.
//   · `llama`      QUÉ FUNCIONES EXPORTADAS DEL MOTOR usa. La Regla 1 hecha dato,
//                  y la razón por la que existe está en `lectura.ts`.
//   · `paga`       qué paga la secuencia en el mundo, con número y fuente. La
//                  Regla 2: sin stamina, calorías, tiempo o supervivencia de por
//                  medio no es emergencia, es coreografía.
//
// Ninguno de los nueve mira qué habilidad se voló. Todos miran cuerpos,
// cualidades, relaciones espaciales y la crónica de eventos.
//
// ─── LOS UMBRALES QUE NO ESTÁN ACÁ, y es a propósito ────────────────────────
//
// No hay un 0,47 kg, ni un 0,7132, ni un 237,5, ni un 0,893 en ningún detector.
// Los umbrales del documento se INFIEREN DEL DESENLACE: el detector 2 no
// pregunta si la vara pesaba 0,47 —pregunta si el fuego prendió y si algo se
// cocinó después—, y el 7 no pregunta si el fardo llegaba a 0,893 kg —pregunta si
// el leño prendió—. El único lugar del paquete donde hay números del documento es
// el de los CONTRA-detectores (`cronica.ts`), que no deciden ningún disparo: sólo
// deciden si un cero se lee como ausencia o como no-medida.

import { elMasLiviano, masasIguales } from './lectura.js'
import type { Cronica } from './cronica.js'
import type { Aparicion, NombreDeSecuencia } from './tipos.js'

export interface Secuencia {
  readonly nombre: NombreDeSecuencia
  readonly mira: string
  readonly llama: readonly string[]
  readonly paga: string
  /** El disparo, con su evidencia. `undefined` si no ocurrió. */
  readonly dispara: (c: Cronica) => Aparicion | undefined
  /** EL CONTRA-DETECTOR: ¿el mundo le puso el problema delante? */
  readonly situacion: (c: Cronica) => boolean
}

// ─── Lo que varios comparten ─────────────────────────────────────────────────

/** ¿Este cuerpo llegó a arder en algún tick a partir de `desde`? */
function ardio(c: Cronica, id: string, desde: number): boolean {
  const f = c.fuegos.get(id)
  return f !== undefined && f.ultimoTickArdiendo >= desde
}

/** ¿Alguna pieza estuvo en su ventana de cocción DESPUÉS de este tick? */
function cocinoDespuesDe(c: Cronica, tick: number): boolean {
  return c.ultimoTickDeCoccion !== undefined && c.ultimoTickDeCoccion > tick
}

const kg = (m: number): string => `${m.toFixed(4)} kg`

// ─── 1 ───────────────────────────────────────────────────────────────────────

const NO_FROTAR: Secuencia = {
  nombre: 'no-frotar-lo-que-no-alcanza-a-encender',
  mira:
    'todas las fricciones de la partida terminaron en ignición, y en al menos una había ' +
    'a tiro un candidato del rol `a` estrictamente más pesado que nunca se frotó',
  llama: ['qualityOf', 'cumpleRol', 'chebyshev', 'FRICCION.roles'],
  paga:
    'frotar un leño de 1 kg cuesta 1401,26 contra un tanque de 1000: no enciende nada y deja ' +
    'el tanque en cero, o sea mil segundos de vida tirados (`world/tests/el-fuego.test.ts:225-233`)',
  dispara(c) {
    if (c.fricciones.length === 0) return undefined
    // «TODAS terminaron en ignición». Una sola que no llegó y la secuencia no es
    // ésta: es la criatura vaciando el tanque sobre un palo que no prende, que es
    // exactamente lo que `frotar` hace hoy (`innatas/frotar.ts:107-108`).
    for (const f of c.fricciones) if (!ardio(c, f.cuerpo, f.tick)) return undefined
    for (const f of c.fricciones) {
      let peor = undefined as { id: string; masa: number } | undefined
      for (const cand of f.candidatos) {
        if (cand.masa <= f.masa) continue
        // Que NUNCA se haya frotado, en toda la partida. Si después lo frotó, no
        // se negó: postergó.
        if (c.frotados.has(cand.id)) continue
        if (peor === undefined || cand.masa > peor.masa) peor = cand
      }
      if (peor === undefined) continue
      return {
        tick: f.tick,
        evidencia:
          `${f.actor} frotó «${f.cuerpo}» de ${kg(f.masa)} y prendió; ` +
          `tenía a tiro «${peor.id}» de ${kg(peor.masa)}, que cumplía el mismo rol y no tocó nunca`,
      }
    }
    return undefined
  },
  situacion: (c) => c.situaciones.dosCandidatosDeFriccion && c.situaciones.candidatoDeFriccionPesado,
}

// ─── 2 ───────────────────────────────────────────────────────────────────────

const LA_VARA_MAS_LIVIANA: Secuencia = {
  nombre: 'la-vara-mas-liviana-que-igual-cocina',
  mira:
    'una fricción cuyo cuerpo del rol `a` NO era el más liviano de los que cumplían ese rol ' +
    'a tiro, que aun así prendió, y después de la cual algo se cocinó',
  llama: ['qualityOf', 'cumpleRol', 'estaEnVentanaDeCoccion', 'chebyshev', 'FRICCION.roles'],
  paga:
    'a 0,46 kg el pescado se queda crudo y los 645,87 de stamina se tiraron enteros; a 0,47 cocina ' +
    'y sale 659,86. Es una pared y no una pendiente (`perceive/tests/ataque-a-la-costura.test.ts:1537-1561`)',
  dispara(c) {
    for (const f of c.fricciones) {
      const liviano = elMasLiviano(f.candidatos)
      if (liviano === undefined) continue
      if (f.masa <= liviano.masa) continue
      if (!ardio(c, f.cuerpo, f.tick)) continue
      if (!cocinoDespuesDe(c, f.tick)) continue
      return {
        tick: f.tick,
        // §4 entrada 2, nota de la tanda tres: «el informe tiene que publicar la
        // masa del cuerpo elegido en cada disparo», porque 0,47 y 0,66 miden dos
        // cosas distintas —cocinar una pieza contra arrancar la cadena del fardo—.
        evidencia:
          `${f.actor} eligió «${f.cuerpo}» de ${kg(f.masa)} teniendo a mano ` +
          `«${liviano.id}» de ${kg(liviano.masa)}; prendió y después algo entró en cocción`,
      }
    }
    return undefined
  },
  situacion: (c) => c.situaciones.dosCandidatosDeFriccion,
}

// ─── 3 ───────────────────────────────────────────────────────────────────────

const TAPARLO: Secuencia = {
  nombre: 'taparlo-con-lo-que-respira',
  mira:
    'un fuego TAPADO que ardió más ticks seguidos que el fuego más largo SIN TAPAR de la misma ' +
    'partida, y con algo en cocción mientras estaba tapado',
  llama: ['qualityOf', 'estaEnVentanaDeCoccion'],
  paga:
    'misma vara, mismo pescado, mismos 80 s: con junco encima el pescado llega a 0,8619 y con ' +
    'corteza se queda en 0,3800, el valor crudo. El precio de equivocarse es la pieza entera y ' +
    'los 659,86 del fuego (`ataque-a-la-costura.test.ts:1562-1660`)',
  dispara(c) {
    // ─── EL TESTIGO TIENE QUE PESAR LO MISMO, y acá está por qué ─────────────
    //
    // El fuego más largo SIN TAPAR es el patrón de comparación, y si no hubo
    // ninguno la secuencia no se puede afirmar: sin alternativa medida, «duró
    // más» no quiere decir nada. Queda declarado acá y no escondido en un `?? 0`,
    // que habría hecho que cualquier fuego tapado disparara.
    //
    // Y no alcanza con que exista: **tiene que pesar lo mismo**. La duración del
    // fuego es EXACTAMENTE lineal en la masa —corrido: 0,2 kg → 199 ticks, 0,5 →
    // 499, 1,5 → 1499, 2,5 → 2500— así que comparar contra «el más largo sin
    // tapar de la partida» sin controlar la masa mide masa y le pone el nombre de
    // la permeabilidad. Un leño de 2,5 kg tapado con MADERA —permeabilidad 0,12,
    // la fila que la tabla del documento marca como «CRUDO, ni se movió»— le
    // ganaba a una ramita de 0,2 kg al aire y disparaba: la secuencia se llama
    // `taparlo-con-lo-que-RESPIRA` y eso era taparlo con lo que la apaga.
    //
    // El «al centésimo» no es una tolerancia inventada: es la resolución con la
    // que el dios siembra las masas. Y la masa se lee del propio motor, en el
    // tick en que cada fuego prendió.
    for (const f of c.fuegos.values()) {
      if (!f.tapadoAlgunaVez || !f.coccionMientrasTapado) continue
      let testigo: { readonly id: string; readonly racha: number } | undefined
      for (const g of c.fuegos.values()) {
        if (g.tapadoAlgunaVez || !masasIguales(g.masaAlEncender, f.masaAlEncender)) continue
        if (testigo === undefined || g.rachaMaxima > testigo.racha) {
          testigo = { id: g.id, racha: g.rachaMaxima }
        }
      }
      if (testigo === undefined || f.rachaMaxima <= testigo.racha) continue
      return {
        tick: f.ultimoTickArdiendo,
        evidencia:
          `«${f.id}» de ${kg(f.masaAlEncender)} ardió tapado ${String(f.rachaMaxima)} ticks seguidos ` +
          `contra ${String(testigo.racha)} de «${testigo.id}», que pesaba lo mismo y estaba al aire, ` +
          `y hubo cocción a tiro del tapado mientras lo estaba`,
      }
    }
    return undefined
  },
  situacion: (c) => c.situaciones.fuegoYDosPermeabilidades,
}

// ─── 4 ───────────────────────────────────────────────────────────────────────

const PONERLE_PUNTA: Secuencia = {
  nombre: 'ponerle-punta-al-aparejo',
  mira:
    'un ensamble nacido de una `union` completa que cumple el rol `gear`, con `catch` ' +
    'estrictamente mayor que el del ensamble anterior del mismo actor, y que después rindió pesca',
  llama: ['qualityOf', 'cumpleRol', 'EXTRACCION.roles'],
  paga:
    'pelada `catch` 0,15 → 7 piezas en 60 s; con anzuelo `catch` 0,575 → 23 piezas. Y a mano ' +
    '`catch` es 0: sin aparejo no se pesca nunca (`world/tests/hito-5-la-pesca.test.ts`)',
  dispara(c) {
    for (const e of c.ensambles) {
      if (!e.cumpleGear) continue
      // Sin ensamble anterior no hay «le puso punta»: hay «armó una caña». Son
      // DOS uniones encadenadas y por eso la comparación pide un antes.
      const antes = e.engancheAnterior
      if (antes === undefined || e.enganche <= antes) continue
      if (!c.gearQueRindio.has(e.id)) continue
      return {
        tick: e.tick,
        evidencia:
          `${e.actor} armó «${e.id}» con catch ${e.enganche.toFixed(4)} contra ` +
          `${antes.toFixed(4)} del anterior; cumple el rol gear y rindió al menos una pieza`,
      }
    }
    return undefined
  },
  situacion: (c) => c.situaciones.filoALaVista,
}

// ─── 5 ───────────────────────────────────────────────────────────────────────

const EN_EL_PICO: Secuencia = {
  nombre: 'comerla-en-el-pico-de-calorias',
  mira:
    'una pieza que estuvo en cocción, cuyas calorías subieron sobre su valor inicial, y que se ' +
    'comió con al menos el 90% de su máximo',
  llama: ['qualityOf', 'estaEnVentanaDeCoccion'],
  paga:
    'hay un máximo interior: cocinar multiplica por 2,13 y no por 2,50 porque la ley 5 evapora ' +
    'agua y con ella masa (`ataque-a-la-costura.test.ts:1257-1266`), y 80 s de más dejan ' +
    '`calories` en 0 (`physics/tests/tres-ejemplos.test.ts:332-338`)',
  dispara(c) {
    for (const p of c.piezas.values()) {
      if (!p.estuvoEnVentana) continue
      const com = p.comida
      if (com === undefined) continue
      // `max(c) > c[0]`: sin eso, comerse una pieza cruda que nunca subió pasaría
      // el 90% por la puerta de atrás.
      if (p.maximas <= p.primeras) continue
      if (com.calorias < 0.9 * p.maximas) continue
      // ─── Y LA VENTANA EN TICKS, que es lo que el 90% no acota ──────────────
      //
      // Medido: las calorías del pescado suben en 129 ticks y tardan MÁS DE
      // 19.870 en perder el 10%, así que la puerta del 90% está abierta el 99,7%
      // de una partida de 20.000 y comer mil segundos de mundo después del máximo
      // pasaba por «el pico». La secuencia dice medir DETENERSE en un máximo, y
      // detenerse es un instante.
      //
      // La tolerancia sale de la PROPIA CURVA DE LA PIEZA y no de una constante
      // elegida: la ventana de después dura lo que duró la subida —del primer
      // tick en que se la vio hasta el del máximo—. Es simétrica, se escala sola
      // con la pieza y con el fuego que la cocina, y no hay ningún número del
      // documento adentro. Con la subida de 129 ticks del banco, la ventana se
      // cierra en el 258 y el bocado del 19.999 queda afuera por 19.741.
      const subida = p.tickMaximas - p.primerTick
      if (com.tick > p.tickMaximas + subida) continue
      return {
        tick: com.tick,
        evidencia:
          `«${p.id}» arrancó en ${p.primeras.toFixed(4)} calorías, topó en ${p.maximas.toFixed(4)} ` +
          `en el tick ${String(p.tickMaximas)} tras subir ${String(subida)} ticks, ` +
          `y se comió en el ${String(com.tick)} con ${com.calorias.toFixed(4)}, o sea el ` +
          `${((com.calorias / p.maximas) * 100).toFixed(1)}% del pico`,
      }
    }
    return undefined
  },
  situacion: (c) => c.situaciones.algoSeCocino,
}

// ─── 6 ───────────────────────────────────────────────────────────────────────

const EL_LOTE: Secuencia = {
  nombre: 'cocinar-el-lote-en-un-solo-fuego',
  mira: 'cuatro o más piezas distintas en ventana de cocción a tiro de UN MISMO cuerpo que arde',
  llama: ['qualityOf', 'estaEnVentanaDeCoccion', 'chebyshev'],
  paga:
    'el fuego que cocina cuesta 659,86 y cocinar una pieza de 2 kg paga 9,12: hacen falta 73 ' +
    'piezas por fuego y la partida común más flaca de cien saca 76 ' +
    '(`oracle/tests/presupuesto.test.ts:1557-1570`)',
  dispara(c) {
    // ─── POR CUERPO QUE ARDE Y NO POR INTERVALO, y es aritmética ─────────────
    //
    // El intervalo de fuego es GLOBAL —«del primer tick en que algo arde al
    // primero posterior en que no arde nada»— y su `cocidas` era un `Set` de la
    // partida entera. Dos fogatas a diez celdas de distancia con dos pescados en
    // cada una contaban cuatro, y el juez firmaba «4 piezas distintas en cocción
    // dentro del intervalo de fuego». El costo fijo que esta secuencia dice
    // amortizar es el de UN fuego —659,86 de stamina—: dos fuegos son dos costos
    // y no uno amortizado, y contarlos juntos mide lo contrario de lo que dice.
    for (const f of c.fuegos.values()) {
      if (f.cocidasCerca.size < 4) continue
      return {
        tick: f.ultimoTickArdiendo,
        evidencia:
          `${String(f.cocidasCerca.size)} piezas distintas en cocción a tiro de «${f.id}», ` +
          `que ardió del tick ${String(f.primerTick)} al ${String(f.ultimoTickArdiendo)}: ` +
          `${[...f.cocidasCerca].join(', ')}`,
      }
    }
    return undefined
  },
  situacion: (c) => c.situaciones.loteAlAlcance,
}

// ─── 7 ───────────────────────────────────────────────────────────────────────

const EL_FARDO: Secuencia = {
  nombre: 'el-fardo-de-corteza',
  mira:
    'un cuerpo nacido del rendimiento de una `union` completa que nació POR DEBAJO de su punto ' +
    'de ignición y lo cruzó DESPUÉS, sin haber sido nunca el rol `a` de una fricción',
  llama: ['qualityOf'],
  paga:
    'una corteza de 0,50 kg entrega 175,32 °C y no prende nada; dos atadas entregan 335,64 y el ' +
    'leño llegó a 933,83 °C en el mundo (`world/tests/el-fuego-no-se-propaga.test.ts:463-547`). ' +
    'La cadena cuesta 918,6 de stamina —el tanque entero— y compra 75 s de fuego contra 23,5',
  dispara(c) {
    for (const e of c.ensambles) {
      if (c.frotados.has(e.id)) continue
      const f = c.fuegos.get(e.id)
      if (f === undefined) continue
      // ─── LAS DOS CONDICIONES QUE SEPARAN PROPAGARSE DE RENOMBRARSE ────────
      //
      // `unir` hereda el estado del cuerpo `a` (`physics/src/leyes.ts:1735`), así
      // que atar una vara ARDIENDO devuelve un ensamble que ya arde, con un id
      // nuevo que no está en `frotados`. Corrido con `stepWorld`, el juez escribía
      // «sin que nadie lo frotara nunca» sobre el fuego que la criatura había
      // encendido con las manos cuarenta ticks antes: no hubo propagación, hubo un
      // cambio de nombre. Para que el fuego se PROPAGUE, el cuerpo tiene que haber
      // nacido apagado y haber cruzado su ignición después de nacer.
      if (!e.nacioApagado || f.primerTick <= e.tick) continue
      return {
        tick: f.primerTick,
        evidencia:
          `«${e.id}» nació apagado de una union completa de ${e.actor} en el tick ${String(e.tick)} ` +
          `y recién en el ${String(f.primerTick)} cruzó su ignición, con ` +
          `${f.potenciaAlEncender.toFixed(2)} de potencia, sin que nadie lo frotara nunca`,
      }
    }
    return undefined
  },
  situacion: (c) => c.situaciones.fardoPosible,
}

// ─── 8 ───────────────────────────────────────────────────────────────────────

const EL_LENO_MAS_GRANDE: Secuencia = {
  nombre: 'el-leno-mas-grande-que-todavia-cocina',
  mira:
    'un cuerpo que alguien LEVANTÓ o PUSO, encendido por el fuego y no por las manos, que NO era ' +
    'el más liviano de los leños que tenía a tiro, y después del cual algo entró en cocción',
  llama: ['qualityOf', 'chebyshev'],
  paga:
    'la duración es 50 s por kilo y es lineal en la masa (`physics/tests/ataque-al-borde-del-fuego.test.ts:126-153` ' +
    'y `world/tests/ataque-3-al-incendio.test.ts:403-412`): entre 15 s y 125 s de fuego según cuál ' +
    'se levante, y arriba de 1,63 kg el fuego saca la comida de su ventana',
  dispara(c) {
    for (const f of c.fuegos.values()) {
      if (c.frotados.has(f.id)) continue
      // ─── EL ACTO, sin el cual esto lo firma el motor solo ──────────────────
      //
      // MEDIDO: un mundo con una fogata ya prendida (madera 2,5 kg a 700 °C) y
      // seis pescados en el piso, corrido 3000 ticks con la lista de intenciones
      // VACÍA, disparaba esta secuencia. Las tres condiciones las escribía el
      // motor: la fogata no estaba en `frotados` porque el juez no vio la
      // fricción que la prendió, el pescado entraba como leño alternativo
      // —`fuelEnergy` 2, medido— y los pescados de al lado del fuego entraban
      // solos en ventana de cocción. Es la REGLA 6 en su forma más pura.
      //
      // La entrada dice «elegir el más grande que todavía deje cocinar,
      // LEVANTARLO y ponerlo sobre el fardo». Sin que el leño haya pasado por una
      // mano o por un `puso`, no hubo elección: hubo un fuego que estaba ahí.
      if (!c.tocados.has(f.id)) continue
      const liviano = elMasLiviano(f.combustiblesCerca)
      if (liviano === undefined) continue
      if (f.masaAlEncender <= liviano.masa) continue
      if (!cocinoDespuesDe(c, f.primerTick)) continue
      return {
        tick: f.primerTick,
        evidencia:
          `«${f.id}» de ${kg(f.masaAlEncender)}, que alguien levantó o puso, prendió por contacto ` +
          `teniendo a tiro «${liviano.id}» de ${kg(liviano.masa)}, y después algo entró en cocción`,
      }
    }
    return undefined
  },
  situacion: (c) => c.situaciones.dosCombustiblesEnIntervalo,
}

// ─── 9 ───────────────────────────────────────────────────────────────────────

const LA_PIEDRA_PRIMERO: Secuencia = {
  nombre: 'la-piedra-primero-y-la-comida-encima',
  mira:
    'una pieza en cocción apoyada sobre un cuerpo que NO arde y que está en la celda de uno que ' +
    'sí, con el contacto por encima del punto de ignición de la pieza',
  llama: ['qualityOf', 'estaEnVentanaDeCoccion', 'temperaturaDeEquilibrio'],
  paga:
    'con una vara de 0,679 kg el contacto ya da 260,0 °C y la pieza DEJA de cocinarse, porque ' +
    'arriba de `ignitionPoint` la ley 5 no corre (`leyes.ts:1540-1541`). Cocida rinde 0,8619 y ' +
    'cruda 0,3800: 2,27×, multiplicado por las 73 piezas que paga un fuego',
  dispara(c) {
    const p = c.parrilla
    if (p === undefined) return undefined
    return {
      tick: p.tick,
      evidencia:
        `«${p.pieza}» se cocinó apoyada sobre «${p.soporte}», que no arde, en la celda de ` +
        `«${p.fuego}»; en contacto habría quedado a ${p.contacto.toFixed(2)} °C contra un punto ` +
        `de ignición de ${p.ignicion.toFixed(2)} °C`,
    }
  },
  situacion: (c) => c.situaciones.parrillaOfrecida,
}

/**
 * LAS NUEVE, EN EL ORDEN DEL DOCUMENTO Y SIN MOVERSE.
 *
 * El informe se publica en este orden. Que sea un array literal y no un mapa es
 * para que ese orden sea dato y no dependa de cómo se construyó nada.
 */
export const SECUENCIAS: readonly Secuencia[] = [
  NO_FROTAR,
  LA_VARA_MAS_LIVIANA,
  TAPARLO,
  PONERLE_PUNTA,
  EN_EL_PICO,
  EL_LOTE,
  EL_FARDO,
  EL_LENO_MAS_GRANDE,
  LA_PIEDRA_PRIMERO,
]
