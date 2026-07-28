// ─── LA CRÓNICA: lo que el juez recuerda de una partida ──────────────────────
//
// Los nueve detectores no miran el mundo: miran esto. La razón es de costo y de
// honestidad a la vez. De costo, porque muestrear una cualidad por cuerpo y por
// tick es lo caro de todo el paquete y hacerlo nueve veces sería hacerlo nueve
// veces. De honestidad, porque con una crónica en el medio queda escrito EN UN
// SOLO LUGAR qué mira el juez, y se puede leer entero sin leer ningún detector.
//
// ─── QUÉ ENTRA ACÁ Y QUÉ NO, que es la regla del paquete ────────────────────
//
// Entra el ESTADO DEL MUNDO —cuerpos, cualidades, relaciones espaciales— y los
// `SimEvent`. No entra el código de ninguna habilidad, ni el `Intent` que la
// mente emitió, ni qué decidió la escalera. Una secuencia es un patrón de estado
// que OCURRIÓ, no un plan que alguien tuvo.
//
// ─── LA ÚNICA LECTURA QUE HAY QUE JUSTIFICAR: `Actor.doing` ─────────────────
//
// Tres detectores necesitan saber QUÉ CUERPO llenaba el rol `a` de una fricción
// —el 1 y el 2— o el rol `gear` de una extracción —el 4—, y el evento `proceso`
// no lo trae: es `{ process, segundos, completo }` y nada más (`step.ts:2075`).
// Lo único que lo tiene es `Actor.doing.roles`, o sea `WorldState`.
//
// Eso NO es mirar la intención, y la diferencia importa: `doing` es lo que el
// MUNDO anotó que está pasando —«este actor está frotando estos dos palos»—, lo
// escribe `intencionAplicar` DESPUÉS de que `cumpleRol` dejó pasar la intención,
// y sobrevive del tick anterior porque un proceso dura. La alternativa —leer el
// chorro de `Intent`— sí sería mirar la intención, incluida la que el mundo
// rechazó, y por eso no se toma. Lo que el juez lee es un hecho consumado: hay un
// proceso corriendo sobre estos cuerpos.
//
// Y trae una arruga que hay que declarar: en el tick en que un proceso se
// completa, el mundo le SACA la actividad al actor (`step.ts:2070`), así que los
// roles de una unión completada hay que haberlos visto en el tick anterior. De
// ahí `recordar`/`rolesDe`, y de ahí que la memoria valga UN tick y no más: una
// memoria sin vencimiento le atribuiría a una unión los cuerpos de otra.

import {
  baseRoleName,
  cumpleRol,
  EXTRACCION,
  FRICCION,
  qualityOf,
  temperaturaDeEquilibrio,
  UNION,
} from '@anima/physics'
import type { Placement, RoleBinding, SimEvent, WorldState } from '@anima/world'

import {
  alAlcance,
  candidatosDeFriccion,
  combustiblesCerca,
  cuerposDeActores,
  dondeEsta,
  enCoccion,
  esPieza,
  hayMasasDistintas,
  mismaCelda,
  ROL_GEAR_DE_EXTRACCION,
  sePodiaArmarLaCadena,
} from './lectura.js'
import type { Pesado } from './lectura.js'
import type { Muestra } from './tipos.js'

// ─── Las piezas de la crónica ────────────────────────────────────────────────

/** Un cuerpo que ardió. Uno por `BodyId`, con lo que hizo mientras ardía. */
export interface Fuego {
  readonly id: string
  /** El primer tick con `emitsPower > 0`. Es «cuándo prendió», dicho por el motor. */
  readonly primerTick: number
  ultimoTickArdiendo: number
  rachaActual: number
  /** Ticks SEGUIDOS ardiendo, el máximo de la partida. Es lo que compara el detector 3. */
  rachaMaxima: number
  readonly potenciaAlEncender: number
  readonly masaAlEncender: number
  /** Los leños —que arden y no se comen— a tiro en el tick en que prendió: la alternativa. */
  readonly combustiblesCerca: readonly Pesado[]
  /** Ley 12: hubo un `puso` de un cuerpo cuyo `covering` apunta a éste. */
  tapadoAlgunaVez: boolean
  /**
   * Y mientras estaba tapado, alguna pieza estuvo en su ventana de cocción
   * **A TIRO DE ESTE FUEGO**.
   *
   * El «a tiro» no estaba y era un agujero: la condición se prendía con
   * `f.enVentana.length > 0`, o sea con cualquier pieza en cocción del mundo
   * entero, aunque estuviera a cien celdas y sobre otro fuego. Un fuego tapado no
   * puede acreditarse la cocción de otro.
   */
  coccionMientrasTapado: boolean
  /**
   * LAS PIEZAS QUE ESTE FUEGO —Y NO EL INTERVALO— COCINÓ.
   *
   * Es lo que cuenta el detector 6, y la razón de que no sea el `Set` del
   * intervalo es aritmética: el costo fijo que la secuencia dice amortizar es el
   * de UN fuego (659,86 de stamina), y dos fogatas son dos costos y no uno
   * amortizado. Con el conteo por intervalo, dos fuegos a diez celdas con dos
   * piezas cada uno firmaban «cuatro piezas en un solo fuego».
   */
  readonly cocidasCerca: Set<string>
}

/** Una fricción, UNA por cada par (actor, cuerpo frotado): el tick en que empezó. */
export interface Friccion {
  readonly actor: string
  readonly cuerpo: string
  readonly tick: number
  readonly masa: number
  /** Los que cumplían el rol `a` a tiro del actor en ese tick. La elección que había. */
  readonly candidatos: readonly Pesado[]
}

/** Un cuerpo nacido del rendimiento de una `union` completa. */
export interface Ensamble {
  readonly id: string
  readonly actor: string
  readonly tick: number
  /** `qualityOf(b,'catch')` al nacer. Derivada de la geometría: la calcula el motor. */
  readonly enganche: number
  readonly cumpleGear: boolean
  /** El `catch` del ensamble ANTERIOR del mismo actor. `undefined` si es el primero. */
  readonly engancheAnterior: number | undefined
  /**
   * ¿NACIÓ POR DEBAJO DE SU PUNTO DE IGNICIÓN?
   *
   * ─── LO QUE ESTE CAMPO ARREGLA, Y ERA EL AGUJERO QUE MATABA EL HITO ────────
   *
   * `unir` devuelve `state: { ...otro.state, ...a.state }`
   * (`physics/src/leyes.ts:1735`): **el ensamble hereda la temperatura del cuerpo
   * `a`**. Atar una vara ARDIENDO a una corteza devuelve un cuerpo que ya arde,
   * con un id nuevo que no está en `frotados` porque el que se frotó se llamaba
   * de otra manera. Corrido con `stepWorld` de punta a punta: la criatura frota
   * `vara` (0,5 kg, prende en el tick 47, 701,8286 de stamina medidos), la ata, y
   * el juez escribía «nació de una union completa … y ardió … SIN QUE NADIE LO
   * FROTARA NUNCA» sobre el fuego que la criatura había encendido con las manos.
   * No hubo propagación: hubo un cambio de nombre.
   *
   * Las dos preguntas son al motor —`temperature` y `ignitionPoint`, las dos por
   * `qualityOf`— y no hay ninguna fórmula: nació frío, y si después arde es
   * porque algo lo prendió.
   */
  readonly nacioApagado: boolean
}

/** Una pieza de comida, y lo que le pasó a sus calorías. */
export interface Pieza {
  readonly id: string
  /** El tick en que se la vio por primera vez. El origen de la subida del 5. */
  readonly primerTick: number
  /** `calories` en el primer tick en que se la vio. El `c[0]` del detector 5. */
  readonly primeras: number
  maximas: number
  /**
   * EL TICK DEL MÁXIMO —el `argmax`—, que es lo que le faltaba al detector 5.
   *
   * ─── POR QUÉ UN PORCENTAJE NO ACOTA NADA, MEDIDO ──────────────────────────
   *
   * Un pescado de 2 kg sobre la vara de 0,47 kg —el fuego más barato que cocina—
   * corrido 20.000 ticks: las calorías arrancan en 6,0800, topan en 13,7459 en el
   * tick **129** y se quedan por encima del 90% del máximo durante **19.943 de
   * los 20.000 ticks**. O sea que la puerta del 90% está abierta el 99,7% de la
   * partida: comer mil segundos de mundo después del máximo pasaba por «el pico».
   * La asimetría es de 129 ticks de subida contra más de 19.870 de caída, así que
   * CUALQUIER umbral porcentual equivale a no poner ninguno.
   */
  tickMaximas: number
  estuvoEnVentana: boolean
  comida: { readonly tick: number; readonly calorias: number } | undefined
}

/**
 * UN INTERVALO DE FUEGO: del primer tick en que algo arde al primero posterior en
 * que no arde nada. La definición es del documento (§4, entrada 6).
 *
 * ─── LO QUE YA NO DECIDE, y es un arreglo y no una poda ────────────────────
 *
 * El detector 6 contaba `cocidas` de acá, y `cocidas` es un `Set` DE LA PARTIDA:
 * dos fogatas a diez celdas con dos piezas cada una sumaban cuatro y firmaban «un
 * solo fuego». El conteo se mudó a `Fuego.cocidasCerca`, que es por cuerpo que
 * arde y con la proximidad resuelta. El intervalo sigue siendo la unidad en la
 * que se miran las SITUACIONES —«¿hubo cuatro piezas al alcance mientras había
 * fuego?», «¿hubo dos combustibles de masas distintas?»—, que es una pregunta
 * sobre el mundo y no sobre a qué fuego se le acredita cada pieza.
 */
export interface Intervalo {
  readonly desde: number
  hasta: number
  /** Las piezas que entraron en cocción en este intervalo, de cualquier fuego. */
  readonly cocidas: Set<string>
  /** Hubo ≥ 4 piezas a tiro de algún actor en algún tick del intervalo. */
  loteAlAlcance: boolean
  /** Hubo ≥ 2 cuerpos con `fuelEnergy > 0` y masas distintas a tiro. */
  dosCombustiblesDistintos: boolean
}

/** La firma del detector 9, con los dos números que la separan de «usó una parrilla». */
export interface Parrilla {
  readonly tick: number
  readonly pieza: string
  readonly soporte: string
  readonly fuego: string
  /** Lo que el CONTACTO le habría hecho, según `temperaturaDeEquilibrio`. */
  readonly contacto: number
  readonly ignicion: number
}

/**
 * LOS CONTRA-DETECTORES, uno por secuencia y todos booleanos de partida.
 *
 * La Regla 4 dice para qué existen: «un detector que no se puede disparar porque
 * el mundo nunca puso el problema delante mide cero, y ese cero se lee como “la
 * mente no lo descubrió”». Si acá hay un `false`, el `aparecio: false` de al lado
 * no es una ausencia: es una no-medida.
 */
export interface Situaciones {
  /** ≥ 2 cuerpos con rol `a` de `friccion` y masas distintas a la vista. */
  dosCandidatosDeFriccion: boolean
  /** Y al menos uno arriba del techo de lo encendible: la trampa servida. */
  candidatoDeFriccionPesado: boolean
  /** Un fuego encendido y ≥ 2 permeabilidades distintas a mano. */
  fuegoYDosPermeabilidades: boolean
  /** Algo con `sharpness >= 0,15` a la vista alguna vez. */
  filoALaVista: boolean
  /** Alguna pieza estuvo en su ventana de cocción. */
  algoSeCocino: boolean
  /** Hubo un intervalo de fuego con ≥ 4 piezas a tiro. */
  loteAlAlcance: boolean
  /** Hubo con qué armar el fardo: dos combustibles que atados pasan 0,9 kg, atador y vara. */
  fardoPosible: boolean
  /** Hubo un intervalo con ≥ 2 combustibles de masas distintas a tiro. */
  dosCombustiblesEnIntervalo: boolean
  /** Hubo un fuego que en contacto arruinaba la pieza, y algo sólido con qué hacer parrilla. */
  parrillaOfrecida: boolean
}

/**
 * El techo de la fricción, redondeado como lo escribe el contra-detector de la
 * entrada 1 («al menos uno por encima de 0,72 kg»). El techo medido es 0,7132 kg
 * (§2.2). Es umbral de SITUACIÓN y no de detección: no decide ningún disparo.
 */
const MAS_PESADO_QUE_EL_TECHO = 0.72

/** El filo mínimo que el dios siembra —`madera-dura` 0,15— y con el que hay aparejo. */
const FILO_MINIMO = 0.15

// ─── La máquina ──────────────────────────────────────────────────────────────

export class Cronica {
  /** El `tick` de la última muestra. */
  ticks = 0
  readonly fuegos = new Map<string, Fuego>()
  readonly intervalos: Intervalo[] = []
  readonly fricciones: Friccion[] = []
  /** Todo cuerpo que alguna vez llenó el rol `a` de una fricción. */
  readonly frotados = new Set<string>()
  /**
   * TODO CUERPO QUE PASÓ POR UNA MANO O POR UN `puso`.
   *
   * ─── LA REGLA 6 APLICADA AL DETECTOR 8, y era el segundo agujero mortal ────
   *
   * El detector 8 pedía tres cosas y **el motor firmaba las tres solo**: un
   * mundo con una fogata ya prendida y seis pescados en el piso, corrido 3000
   * ticks con la lista de intenciones VACÍA, disparaba. La fogata no estaba en
   * `frotados` porque el juez no vio la fricción que la prendió, el pescado
   * entraba como leño alternativo, y los pescados de al lado entraban solos en
   * ventana de cocción. Nadie levantó nada, nadie eligió nada.
   *
   * Lo que se agrega es el acto: para acreditarle a alguien la elección de un
   * leño hace falta que ese leño **haya pasado por su mano o lo haya puesto**.
   * `heldBy` lo escribe el mundo cuando alguien levanta algo y el `puso` lo narra
   * el mundo cuando alguien lo apoya: las dos son lecturas del estado y del
   * relato, no del `Intent` que alguien emitió.
   */
  readonly tocados = new Set<string>()
  readonly ensambles: Ensamble[] = []
  /** Los `gear` que aparecieron en una `extraccion` completa que rindió una pieza. */
  readonly gearQueRindio = new Set<string>()
  readonly piezas = new Map<string, Pieza>()
  primerTickDeCoccion: number | undefined
  ultimoTickDeCoccion: number | undefined
  parrilla: Parrilla | undefined
  readonly situaciones: Situaciones = {
    dosCandidatosDeFriccion: false,
    candidatoDeFriccionPesado: false,
    fuegoYDosPermeabilidades: false,
    filoALaVista: false,
    algoSeCocino: false,
    loteAlAlcance: false,
    fardoPosible: false,
    dosCombustiblesEnIntervalo: false,
    parrillaOfrecida: false,
  }

  private abierto: Intervalo | undefined
  /** Los que llegaron a su lugar con un `puso`. Sin eso, un `covering` no es de nadie. */
  private readonly puestos = new Set<string>()
  /** `${actor}|${proceso}` → los roles, y en qué tick se los vio. Vale UN tick. */
  private readonly actividades = new Map<string, { roles: readonly RoleBinding[]; tick: number }>()
  private readonly episodios = new Set<string>()
  private readonly ultimoEnsamble = new Map<string, Ensamble>()

  /**
   * UN TICK. `m.state` es el estado DESPUÉS de `m.events`.
   *
   * El orden de adentro no es cosmético: primero se RECUERDAN las actividades del
   * estado —que es lo que hace legibles los roles de la fricción de este mismo
   * tick—, después se recorre el mundo una sola vez, y recién al final se leen los
   * eventos, que ya tienen contra qué mirarse.
   */
  observar(m: Muestra): void {
    const w = m.state
    this.ticks = w.tick
    this.recordar(w)
    // Los `puso` van ANTES del recorrido y no con el resto de los eventos, y es
    // un bug arreglado y no un gusto: el `covering` que el detector 3 mira está en
    // el estado DE ESTE tick, así que anotar el `puso` al final le daba a la tapa
    // un tick de retraso — el primero, justamente el que la crónica usa para
    // decidir si el fuego nació tapado.
    for (const e of m.events) {
      if (e.k !== 'puso') continue
      this.puestos.add(e.what)
      this.tocados.add(e.what)
    }
    const foto = this.recorrer(w)
    this.actualizarPiezas(w, foto)
    this.actualizarFuegos(w, foto)
    this.actualizarIntervalos(foto)
    this.mirarLaParrilla(w, foto)
    this.mirarLasSituaciones(w, foto)
    this.leerLosEventos(w, m.events)
  }

  // ─── Las actividades, y su vencimiento de un tick ─────────────────────────

  private recordar(w: WorldState): void {
    for (const a of w.actors.values()) {
      const d = a.doing
      if (d === undefined) continue
      this.actividades.set(`${a.id}|${d.process}`, { roles: d.roles, tick: w.tick })
    }
  }

  private rolesDe(w: WorldState, actor: string, proceso: string): readonly RoleBinding[] | undefined {
    const guardado = this.actividades.get(`${actor}|${proceso}`)
    if (guardado === undefined) return undefined
    // Un tick de gracia y ni uno más: el proceso que se completa en el tick T dejó
    // sus roles escritos en el estado de T−1 y el mundo se los sacó en T.
    return guardado.tick >= w.tick - 1 ? guardado.roles : undefined
  }

  // ─── El único recorrido de los cuerpos ────────────────────────────────────

  private recorrer(w: WorldState): Foto {
    const ardiendo: Ardiendo[] = []
    const piezasAhora: string[] = []
    const enVentana: string[] = []
    const tapaDe = new Map<string, string>()
    const criaturas = cuerposDeActores(w)
    for (const [id, c] of w.bodies) {
      const potencia = qualityOf(c.body, 'emitsPower', w.phys)
      if (potencia > 0) {
        ardiendo.push({ id, at: c.at, potencia, masa: qualityOf(c.body, 'mass', w.phys) })
      }
      if (esPieza(w, id, c, criaturas)) {
        piezasAhora.push(id)
        if (enCoccion(c.body, w.phys)) enVentana.push(id)
      }
      // `heldBy` lo escribe el mundo al levantar (`step.ts`, `intencionTomar`) y
      // es la mitad barata de `tocados`: un cuerpo que estuvo en una mano pasó por
      // una decisión de alguien, aunque el juez no vea cuál.
      if (c.heldBy !== undefined) this.tocados.add(id)
      // La Regla 6 en su forma dura: `covering` lo escribe UN SOLO lugar del
      // motor, `intencionPoner` (`step.ts:1828`). Nadie lo produce caminando. El
      // `puestos` de al lado es el segundo cerrojo, y es el que pide el documento.
      const tapa = c.covering
      if (tapa !== undefined && this.puestos.has(id)) tapaDe.set(tapa, id)
    }
    return { ardiendo, piezasAhora, enVentana, tapaDe }
  }

  private actualizarPiezas(w: WorldState, f: Foto): void {
    for (const id of f.piezasAhora) {
      const cal = caloriasDe(w, id)
      const vieja = this.piezas.get(id)
      if (vieja === undefined) {
        this.piezas.set(id, {
          id,
          primerTick: w.tick,
          primeras: cal,
          maximas: cal,
          tickMaximas: w.tick,
          estuvoEnVentana: false,
          comida: undefined,
        })
      } else if (cal > vieja.maximas) {
        vieja.maximas = cal
        vieja.tickMaximas = w.tick
      }
    }
    for (const id of f.enVentana) {
      const p = this.piezas.get(id)
      if (p !== undefined) p.estuvoEnVentana = true
      if (this.primerTickDeCoccion === undefined) this.primerTickDeCoccion = w.tick
      this.ultimoTickDeCoccion = w.tick
      this.situaciones.algoSeCocino = true
    }
  }

  private actualizarFuegos(w: WorldState, f: Foto): void {
    for (const a of f.ardiendo) {
      let fuego = this.fuegos.get(a.id)
      if (fuego === undefined) {
        fuego = {
          id: a.id,
          primerTick: w.tick,
          ultimoTickArdiendo: w.tick,
          rachaActual: 0,
          rachaMaxima: 0,
          potenciaAlEncender: a.potencia,
          masaAlEncender: a.masa,
          combustiblesCerca: combustiblesCerca(w, a.at),
          tapadoAlgunaVez: false,
          coccionMientrasTapado: false,
          cocidasCerca: new Set<string>(),
        }
        this.fuegos.set(a.id, fuego)
      }
      fuego.rachaActual = fuego.ultimoTickArdiendo === w.tick - 1 ? fuego.rachaActual + 1 : 1
      fuego.ultimoTickArdiendo = w.tick
      if (fuego.rachaActual > fuego.rachaMaxima) fuego.rachaMaxima = fuego.rachaActual
      // LAS PIEZAS DE ESTE FUEGO Y NO LAS DEL MUNDO. «A tiro» es el mismo
      // `chebyshev` de siempre: un fuego no se puede acreditar lo que se cocinó a
      // diez celdas, ni para el lote (detector 6) ni para la tapa (detector 3).
      const tapado = f.tapaDe.has(a.id)
      if (tapado) fuego.tapadoAlgunaVez = true
      for (const id of f.enVentana) {
        const pieza = w.bodies.get(id)
        if (pieza === undefined || !alAlcance(pieza.at, a.at)) continue
        fuego.cocidasCerca.add(id)
        if (tapado) fuego.coccionMientrasTapado = true
      }
    }
  }

  private actualizarIntervalos(f: Foto): void {
    const hayFuego = f.ardiendo.length > 0
    if (hayFuego && this.abierto === undefined) {
      const nuevo: Intervalo = {
        desde: this.ticks,
        hasta: this.ticks,
        cocidas: new Set<string>(),
        loteAlAlcance: false,
        dosCombustiblesDistintos: false,
      }
      this.intervalos.push(nuevo)
      this.abierto = nuevo
    }
    const abierto = this.abierto
    if (abierto === undefined) return
    if (!hayFuego) {
      this.abierto = undefined
      return
    }
    abierto.hasta = this.ticks
    for (const id of f.enVentana) abierto.cocidas.add(id)
  }

  /**
   * EL DETECTOR 9, resuelto tick a tick porque su firma es instantánea.
   *
   * Una pieza en ventana, apoyada sobre algo que NO arde, y ese algo en la misma
   * celda que algo que sí. La última condición —«y el contacto le habría arruinado
   * la pieza»— es la que separa «usó una parrilla» de «usó una parrilla cuando el
   * contacto no servía», y se le pregunta a `temperaturaDeEquilibrio`, que está
   * exportada: la ley 1 no se transcribe.
   */
  private mirarLaParrilla(w: WorldState, f: Foto): void {
    if (this.parrilla !== undefined || f.ardiendo.length === 0) return
    for (const id of f.enVentana) {
      const c = w.bodies.get(id)
      const soporte = c?.supportedBy
      if (c === undefined || soporte === undefined) continue
      const x = w.bodies.get(soporte)
      if (x === undefined) continue
      if (qualityOf(x.body, 'emitsPower', w.phys) > 0) continue
      for (const a of f.ardiendo) {
        if (!mismaCelda(a.at, x.at)) continue
        const contacto = temperaturaDeEquilibrio(a.potencia, 0, 'contacto')
        const ignicion = qualityOf(c.body, 'ignitionPoint', w.phys)
        if (contacto < ignicion) continue
        this.parrilla = { tick: w.tick, pieza: id, soporte, fuego: a.id, contacto, ignicion }
        return
      }
    }
  }

  private mirarLasSituaciones(w: WorldState, f: Foto): void {
    const s = this.situaciones
    for (const a of w.actors.values()) {
      const pos = dondeEsta(w, a)
      if (pos === undefined) continue

      if (!s.dosCandidatosDeFriccion || !s.candidatoDeFriccionPesado) {
        const cand = candidatosDeFriccion(w, pos)
        if (hayMasasDistintas(cand)) s.dosCandidatosDeFriccion = true
        for (const c of cand) if (c.masa > MAS_PESADO_QUE_EL_TECHO) s.candidatoDeFriccionPesado = true
      }

      if (!s.fardoPosible && sePodiaArmarLaCadena(w, pos)) s.fardoPosible = true

      if (!s.fuegoYDosPermeabilidades && f.ardiendo.length > 0 && dosPermeabilidades(w, pos)) {
        s.fuegoYDosPermeabilidades = true
      }

      if (!s.filoALaVista && hayFilo(w, pos)) s.filoALaVista = true

      if (!s.parrillaOfrecida && seOfreciaUnaParrilla(w, pos, f)) s.parrillaOfrecida = true

      const abierto = this.abierto
      if (abierto === undefined) continue

      if (!abierto.loteAlAlcance) {
        let cuantas = 0
        for (const id of f.piezasAhora) {
          const c = w.bodies.get(id)
          if (c !== undefined && alAlcance(c.at, pos)) cuantas += 1
        }
        if (cuantas >= 4) {
          abierto.loteAlAlcance = true
          s.loteAlAlcance = true
        }
      }

      if (!abierto.dosCombustiblesDistintos && hayMasasDistintas(combustiblesCerca(w, pos))) {
        abierto.dosCombustiblesDistintos = true
        s.dosCombustiblesEnIntervalo = true
      }
    }
  }

  // ─── Los eventos, en dos pasadas ──────────────────────────────────────────

  private leerLosEventos(w: WorldState, eventos: readonly SimEvent[]): void {
    const unionesCompletas = new Set<string>()
    const extracciones = new Map<string, string>()
    const nacidos: { readonly id: string; readonly by: string }[] = []

    for (const e of eventos) {
      switch (e.k) {
        case 'nacio':
          nacidos.push({ id: e.id, by: e.by })
          break
        case 'comio': {
          const p = this.piezas.get(e.what)
          if (p !== undefined) p.comida = { tick: w.tick, calorias: e.calorias }
          break
        }
        case 'proceso':
          if (e.process === FRICCION.id) this.anotarFriccion(w, e.by)
          if (e.process === UNION.id && e.completo) unionesCompletas.add(e.by)
          if (e.process === EXTRACCION.id && e.completo) {
            const gear = this.cuerpoDelRol(w, e.by, EXTRACCION.id, 'gear')
            if (gear !== undefined) extracciones.set(e.by, gear)
          }
          break
        default:
          break
      }
    }

    // SEGUNDA PASADA. `rendir` empuja el `nacio` ANTES que el `proceso` del mismo
    // tick (`step.ts:2069` contra `:2075`), así que «el `nacio` que sigue a un
    // `union` completo» no se puede resolver leyendo en orden: hay que tener las
    // dos listas y recién ahí cruzarlas.
    for (const n of nacidos) {
      if (unionesCompletas.has(n.by)) this.anotarEnsamble(w, n.id, n.by)
    }
    for (const [actor, gear] of extracciones) {
      for (const n of nacidos) if (n.by === actor) this.gearQueRindio.add(gear)
    }
  }

  private cuerpoDelRol(
    w: WorldState,
    actor: string,
    proceso: string,
    rol: string,
  ): string | undefined {
    const roles = this.rolesDe(w, actor, proceso)
    if (roles === undefined) return undefined
    for (const r of roles) if (baseRoleName(r.name) === rol) return r.body
    return undefined
  }

  private anotarFriccion(w: WorldState, actor: string): void {
    const cuerpo = this.cuerpoDelRol(w, actor, FRICCION.id, 'a')
    if (cuerpo === undefined) return
    this.frotados.add(cuerpo)
    // UNA por episodio y no una por tick: frotar dura cuarenta y ocho pasos, y
    // cuarenta y ocho fricciones sobre el mismo palo serían cuarenta y ocho
    // decisiones donde hubo una.
    const clave = `${actor}|${cuerpo}`
    if (this.episodios.has(clave)) return
    this.episodios.add(clave)
    const elActor = w.actors.get(actor)
    const c = w.bodies.get(cuerpo)
    const centro = (elActor === undefined ? undefined : dondeEsta(w, elActor)) ?? c?.at
    if (centro === undefined || c === undefined) return
    this.fricciones.push({
      actor,
      cuerpo,
      tick: w.tick,
      masa: qualityOf(c.body, 'mass', w.phys),
      candidatos: candidatosDeFriccion(w, centro),
    })
  }

  private anotarEnsamble(w: WorldState, id: string, actor: string): void {
    const c = w.bodies.get(id)
    if (c === undefined) return
    const anterior = this.ultimoEnsamble.get(actor)
    const e: Ensamble = {
      id,
      actor,
      tick: w.tick,
      enganche: qualityOf(c.body, 'catch', w.phys),
      // Se le pregunta al motor con el rol DEL CATÁLOGO, que es exactamente lo
      // que el documento pide para esta entrada: `cumpleRol(b, EXTRACCION.roles
      // .find(r => r.name === 'gear'), phys)`.
      cumpleGear: cumpleRol(c.body, ROL_GEAR_DE_EXTRACCION(), w.phys),
      engancheAnterior: anterior === undefined ? undefined : anterior.enganche,
      nacioApagado:
        qualityOf(c.body, 'temperature', w.phys) < qualityOf(c.body, 'ignitionPoint', w.phys),
    }
    this.ensambles.push(e)
    this.ultimoEnsamble.set(actor, e)
  }
}

// ─── Lo que la clase usa y no merece ser método ──────────────────────────────

interface Ardiendo {
  readonly id: string
  readonly at: Placement
  readonly potencia: number
  readonly masa: number
}

interface Foto {
  readonly ardiendo: readonly Ardiendo[]
  readonly piezasAhora: readonly string[]
  readonly enVentana: readonly string[]
  /** `fuego → el cuerpo que lo tapa`. Sólo si ese cuerpo llegó con un `puso`. */
  readonly tapaDe: ReadonlyMap<string, string>
}

function caloriasDe(w: WorldState, id: string): number {
  const c = w.bodies.get(id)
  return c === undefined ? 0 : qualityOf(c.body, 'calories', w.phys)
}

function dosPermeabilidades(w: WorldState, centro: Placement): boolean {
  const criaturas = cuerposDeActores(w)
  let primera: number | undefined
  for (const [id, c] of w.bodies) {
    if (criaturas.has(id) || !alAlcance(c.at, centro)) continue
    const p = qualityOf(c.body, 'permeability', w.phys)
    if (primera === undefined) primera = p
    else if (p !== primera) return true
  }
  return false
}

function hayFilo(w: WorldState, centro: Placement): boolean {
  const criaturas = cuerposDeActores(w)
  for (const [id, c] of w.bodies) {
    if (criaturas.has(id) || !alAlcance(c.at, centro)) continue
    if (qualityOf(c.body, 'sharpness', w.phys) >= FILO_MINIMO) return true
  }
  return false
}

/**
 * ¿EL MUNDO OFRECÍA LA ELECCIÓN DE MONTAJE del detector 9?
 *
 * Un fuego que EN CONTACTO cruzaría el punto de ignición de una pieza que está a
 * tiro, y algo sólido sin combustible con qué hacer la parrilla. Los grados los
 * contesta `temperaturaDeEquilibrio`; acá no hay ninguna cuenta.
 *
 * El documento escribe este contra-detector con un umbral —«intervalos de fuego
 * con potencia ≥ 204,2»— que es la misma cuenta despejada a mano. Se usa la
 * función en vez del número, que es la única corrección que §0 deja hacer sin
 * volver a correr todo: un detector que reimplementa una fórmula del motor.
 */
function seOfreciaUnaParrilla(w: WorldState, centro: Placement, f: Foto): boolean {
  if (f.ardiendo.length === 0) return false
  const criaturas = cuerposDeActores(w)
  let hayLosa = false
  for (const [id, c] of w.bodies) {
    if (criaturas.has(id) || !alAlcance(c.at, centro)) continue
    if (qualityOf(c.body, 'fuelEnergy', w.phys) <= 0 && qualityOf(c.body, 'solid', w.phys) > 0) {
      hayLosa = true
      break
    }
  }
  if (!hayLosa) return false
  for (const a of f.ardiendo) {
    const contacto = temperaturaDeEquilibrio(a.potencia, 0, 'contacto')
    for (const id of f.piezasAhora) {
      const c = w.bodies.get(id)
      if (c === undefined || !alAlcance(c.at, centro)) continue
      if (contacto >= qualityOf(c.body, 'ignitionPoint', w.phys)) return true
    }
  }
  return false
}
