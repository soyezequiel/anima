// ─── HABLARLE A LA CRIATURA, DESDE EL JUEGO ─────────────────────────────────
//
// Los puntos 4, 5 y 6 de la vertical del Hito 12B: escribir una orden, recibir
// acuse **inmediato**, y ver que algo pasa. `@anima/lang` está entero desde el
// Hito 6 y hasta hoy su único consumidor era un demo de terminal.
//
// ─── EL CAMINO, Y POR QUÉ LA MENTE SIGUE HACIENDO FALTA ────────────────────
//
// Uno esperaría que «traé un palo» se convierta en una intención y se la mande al
// mundo. No es así, y la razón es del diseño de Ánima II: una frase se convierte
// en una **meta** —una firma de predicado como `emitsPower>0`— y quien sabe
// convertir una meta en pasos es la escalera de la mente. El chat no reemplaza a
// la mente: **le pone el objetivo**.
//
//     frase → leer() → encargoDe() → drive de la Mente → habilidades → intents
//
// La consecuencia práctica es la que importa: ordenar desde el chat no es un
// atajo que evita la mente, es la mente trabajando para vos en vez de para sus
// propias necesidades.
//
// ─── LAS DOS COSAS QUE ESTE ARCHIVO NO INVENTA ─────────────────────────────
//
//   1. **el acuse sale de `leer()` y de ningún otro lado.** El criterio pide que
//      aparezca en el mismo cuadro que el mensaje, así que no puede esperar a que
//      nada se planifique. Acá se muestra tal cual viene;
//   2. **una frase con varias cláusulas se manda de a una.** No es una
//      simplificación de esta app: el único canal hacia la mente es
//      `MenteOptions.drive`, que lleva UNA firma. `EncargoEnCurso` es el cursor
//      que `@anima/lang` ya escribió para eso.
//
// ═══ LO QUE CAMBIÓ EN EL C1 DE LA CONVERGENCIA CONVERSACIONAL ══════════════
//
// El tramo entero está en `docs/product/convergencia-conversacional.md` y el
// mapa de integración en `ii/docs/convergencia.md`. Acá se pagaron tres
// deudas, y ninguna era código que faltara escribir: era código escrito que
// nadie llamaba.
//
//   1. **había DOS rutas de salida.** `CanalDeHabla` existe desde el Hito 6 con
//      sus clases y su tick, y este archivo tenía su propia lista de
//      `{de:'vos'|'ella'}`. En la de acá, «voy por X» y «listo» quedaban
//      guardados **como si el personaje los hubiera dicho**, que es exactamente
//      lo que el documento prohíbe. Ahora hay un solo canal y la clase distingue;
//   2. **el historial no era durable.** La lista moría con la pestaña. Ahora es
//      la cuarta ranura de `@anima/store` y vuelve con su orden y su identidad;
//   3. **el turno anterior no llegaba al lector.** `leer()` acepta una
//      `MemoriaDeLaCharla` desde el Hito 6 y nadie se la pasaba, así que «comé
//      eso» salía por `orientacion` siempre. Ahora la memoria se DERIVA de la
//      ventana reciente del log, que es lo que hace que el historial alimente la
//      lectura y no sólo la pantalla.
//
// ═══ Y LO QUE AGREGÓ EL C2 ═════════════════════════════════════════════════
//
// La misma decisión, un piso más arriba: **los recuerdos también son una vista
// del log**, no un almacén nuevo (ver el encabezado de `recuerdos.ts`). De ahí
// salen las dos cosas que se enchufaron acá:
//
//   1. **«hacé lo que te pedí» recupera el pedido.** La línea de `entrada` guarda
//      la META que la frase pidió, así que el pedido sobrevive a la recarga
//      aunque el encargo no —el encargo es efímero y el durable es C3—;
//   2. **se puede citar qué recuerda y de dónde.** `queRecuerda()` devuelve cada
//      recuerdo con sus turnos y su procedencia, y el panel los pinta. Lo que el
//      cuidador AFIRMA queda como `dicho` y nunca como `hecho`: una frase no se
//      promueve a observación.
//
// ═══ Y EL C3: EL ENCARGO DEJA DE MORIRSE CON LA PESTAÑA ════════════════════
//
// `EncargoEnCurso` era un cursor sobre una lista de metas, con un índice adentro
// y sin identidad. Ahora es un GRAFO con nombre, con lo hecho anotado por nodo y
// con el tick en que el mundo lo probó, y se guarda en la quinta ranura.
//
// La consecuencia es la del criterio: **una recarga a mitad de un pedido de
// varias partes no repite la parte que ya estaba hecha**. Y no la repite ni
// siquiera si el mundo dejó de cumplirla, porque lo que se afirma es que se
// cumplió una vez — el ADR 0083 de Ánima I portado.
//
// El `Plan` sigue sin guardarse: es una hipótesis sobre el mundo de ahora y se
// reconstruye contra el que quedó.
//
// Lo que NO se hizo, y se dice para que nadie lo busque: aplicar la respuesta del
// proveedor (C4), prioridad e interrupción (C5), fragua y juez (C6). Y del C3
// mismo quedan dos mitades medidas y sin hacer: **el vocabulario de objetivo para
// cantidad y lugar** —«dos troncos», «junto al fuego»— y **el ejecutor de la
// ligadura diferida**, que se anota pero todavía no la usa nadie.

import { nameOf } from '@anima/physics'
import type { Physics } from '@anima/physics'
import { Contexto } from '@anima/perceive'
import type { Partida } from '@anima/perceive'
import { Creencias, Mente } from '@anima/mind'
import { ESQUEMAS, cumple, interpretar } from '@anima/plan'
import {
  CanalDeHabla,
  EncargoEnCurso,
  PUENTE,
  consultaDe,
  encargoDe,
  enPalabras,
  leer,
  lexicoDe,
  loQuePidio,
  memoriaDe,
  recuerdosDe,
  recuperar,
} from '@anima/lang'
import type {
  Consulta,
  Dicho,
  EncargoGuardado,
  Lectura,
  Lexico,
  LoRecuperado,
  Recuerdo,
  RespuestaDelModelo,
} from '@anima/lang'

/** Lo que se está persiguiendo ahora, para mostrarlo al lado del progreso. */
export interface EnCurso {
  readonly meta: string
  /**
   * DE QUIÉN ES LA META, y no es un adorno.
   *
   * Se descubrió escribiendo el test: con la mente conectada y sin ninguna orden,
   * la criatura ya persigue metas propias —camina, junta— porque el `drive` del
   * cuidador **compite** con sus necesidades en vez de reemplazarlas. Entonces
   * «hay una meta en curso» no distingue obedecer de vivir, y una pantalla que no
   * lo dijera haría creer al jugador que todo lo que ve es consecuencia de lo que
   * pidió.
   */
  readonly de: 'vos' | 'ella'
  readonly hechas: number
  readonly total: number
}

/**
 * UNA META EN CASTELLANO, con dos intentos y en este orden.
 *
 *   1. **el puente**, que mapea «fuego» ↔ `emitsPower>0`. Leído al revés da el
 *      nombre humano, sale gratis y da la palabra corta y linda. Es exacto;
 *   2. **armar la frase leyendo el predicado**, para todo lo demás.
 *
 * El segundo existe porque el panel llegó a mostrar esto tal cual:
 *
 *     holding(tag:carnoso,toxicity<0.0528) (suya)
 *
 * y no se arreglaba agregando una fila: **el `0,0528` lo calcula la criatura en
 * el momento** —es cuánto veneno le conviene tragar, y depende de lo vacío que
 * tenga el tanque— así que cambia a cada tick. Una tabla necesitaría una fila por
 * número posible. Hoy eso se lee «tener algo carnoso y poco venenoso».
 *
 * Si los dos fallan sale la firma cruda, y eso se deja a propósito: verla en
 * pantalla es la señal de que a esa meta le falta una palabra.
 */
export function enCastellano(firma: string): string {
  for (const a of PUENTE) {
    if (a.denota.k === 'meta' && a.denota.firma === firma) return a.dice[0] ?? firma
  }
  const p = interpretar(firma)
  return p === undefined ? firma : enPalabras(p)
}

const ESTABLECIBLES = new Set(ESQUEMAS.map((e) => e.establishes))

/**
 * «TENERLO» SIEMPRE TIENE CAMINO, aunque ningún esquema lo establezca.
 *
 * El acuse distingue «dale, voy» de «te entendí, pero no sé cómo hacerlo
 * todavía», y para eso pregunta si algún ESQUEMA establece la firma. Eso dejó de
 * alcanzar: el planificador aprendió una vía que no es un esquema —caminar hasta
 * algo que ya cumple la meta y agarrarlo, ver `agarrarLoQueYaHay`— así que
 * «traé un palo» tenía plan y el acuse seguía diciendo que no sabía.
 *
 * Lo que se afirma acá es lo que el planificador puede intentar, no que vaya a
 * encontrar algo: si no hay ningún palo a la vista no va a poder, y eso se ve
 * cuando no pasa nada. Es la misma honestidad que el resto del acuse — dice si
 * entendió y si conoce un camino, no si va a salir bien.
 */
function esUnTenerlo(firma: string): boolean {
  return interpretar(firma)?.k === 'sostiene'
}

/**
 * LO QUE UNA SESIÓN TRAE PUESTO, y las tres cosas entran juntas por una razón.
 *
 * Las tres son lo que una partida CARGADA tiene que recuperar —lo que aprendió,
 * de qué hablaron— más el borde asincrónico. Un cuarto parámetro posicional por
 * cada una convierte `new Ordenes(p, quien, phys, undefined, undefined, x)` en
 * algo que nadie lee.
 */
export interface OpcionesDeOrdenes {
  /** Lo que la criatura aprendió. Sin esto, una partida cargada vuelve a fallar en lo que sabía. */
  readonly memoria?: Creencias
  /** El log conversacional guardado. Sin esto, vuelve el mundo y se pierde la charla. */
  readonly charla?: readonly Dicho[]
  /**
   * EL ENCARGO EN CURSO, guardado. Sin esto, una recarga a mitad de un pedido de
   * varias partes lo pierde entero y hay que volver a pedirlo (C3).
   */
  readonly encargo?: EncargoGuardado
  /**
   * EL BORDE DEL PROVEEDOR, y lo importante es lo que NO hace.
   *
   * `@anima/lang` **describe** la consulta y no la manda (ADR II-0024): el que
   * espera es el de afuera. Acá se le entrega y **no se la espera**: no hay
   * `await`, la respuesta no se aplica y el tick ni se entera.
   *
   * Aplicar la respuesta —en frontera de tick, con correlación, firma de contexto
   * y cancelación— es C4 y no se adelanta. Lo que C1 pone es la FRONTERA, y tiene
   * que estar puesta para que el criterio signifique algo: «el proveedor colgado
   * no mueve el p95» es trivialmente verde si no hay proveedor, y eso lo anota el
   * propio ADR II-0024.
   */
  readonly preguntar?: (c: Consulta) => Promise<RespuestaDelModelo | undefined>
}

export class Ordenes {
  readonly #partida: Partida
  readonly #quien: string
  readonly #lexico: Lexico
  readonly #memoria: Creencias
  #mente: Mente
  readonly #mentes = new Map<string, Mente>()
  #encargo: EncargoEnCurso | undefined
  /** La última meta puesta, para no reconstruir la `Mente` en cada tick. */
  #ultimaPuesta: string | undefined
  /** EL ÚNICO canal de salida: entrada, acuse, aviso, progreso y listo. */
  readonly #canal = new CanalDeHabla()
  readonly #preguntar: OpcionesDeOrdenes['preguntar']
  #ultimaLectura: Lectura | undefined
  #ventanaUsada = 0
  #consultas = 0
  /**
   * LO QUE TENÍA EN LA MANO EN EL TICK ANTERIOR.
   *
   * Arranca con lo que la criatura YA lleva y no vacío, y esa línea es la que
   * evita duplicar una salida al restaurar: con la lista vacía, el primer tick
   * después de una recarga narraría «agarró» todo lo que venía en la mano desde
   * antes de cerrar la pestaña.
   */
  #manosAntes: readonly string[]

  constructor(partida: Partida, quien: string, phys: Physics, o: OpcionesDeOrdenes = {}) {
    this.#partida = partida
    this.#quien = quien
    this.#lexico = lexicoDe(phys, PUENTE)
    this.#memoria = o.memoria ?? new Creencias()
    this.#preguntar = o.preguntar
    this.#mente = new Mente({ actor: quien, memoria: this.#memoria })
    this.#mentes.set(quien, this.#mente)
    if (o.charla !== undefined) this.#canal.cargar(o.charla)
    // El encargo vuelve con lo que ya estaba probado adentro. El plan NO vuelve:
    // se replanifica contra el mundo que quedó, que es la promesa del ADR 0009.
    if (o.encargo !== undefined) this.#encargo = EncargoEnCurso.desdeGuardado(o.encargo)
    this.#manosAntes = [...(partida.state.actors.get(quien)?.holding ?? [])]
  }

  /** Lo que aprendió. Lo necesita quien guarda. */
  get memoria(): Creencias {
    return this.#memoria
  }

  get mentes(): ReadonlyMap<string, Mente> {
    return this.#mentes
  }

  /** EL LOG, entero y en orden. Lo pinta la UI y lo guarda `@anima/store`. */
  get charla(): readonly Dicho[] {
    return this.#canal.todo
  }

  /** La última lectura, tal como salió. Es lo observable de «entendió qué». */
  get ultimaLectura(): Lectura | undefined {
    return this.#ultimaLectura
  }

  /** Cuántos turnos previos entraron como contexto en la última lectura. */
  get ventanaUsada(): number {
    return this.#ventanaUsada
  }

  /** Cuántas consultas se le pasaron al proveedor. Ninguna se esperó. */
  get consultas(): number {
    return this.#consultas
  }

  /**
   * LO QUE RECUERDA DE LA CHARLA, con su fuente. El C2 lo pide para poder citar.
   *
   * Se deriva del log en la llamada y no se guarda: los recuerdos son una vista.
   * Ver el encabezado de `recuerdos.ts` — el repo ya rechazó dos veces abrir una
   * sede de estado más.
   */
  queRecuerda(): readonly Recuerdo[] {
    return recuerdosDe(this.#canal.todo)
  }

  /**
   * EL ENCARGO EN CURSO, como dato. Es lo que se guarda y lo que se puede leer
   * desde afuera para saber qué se pidió y qué parte de eso el mundo ya probó.
   */
  get encargo(): EncargoGuardado | undefined {
    return this.#encargo?.volcar()
  }

  /** La meta que la mente tiene puesta ahora mismo, cruda. `undefined` si ninguna. */
  get metaEnCurso(): string | undefined {
    return this.#ultimaPuesta
  }

  /** Lo que el historial tiene que ver con una frase, con su tope. */
  recuperar(texto: string): LoRecuperado {
    return recuperar(this.#canal.todo, {
      texto,
      entidades: memoriaDe(this.#canal.ventana()).nombrados,
    })
  }

  get enCurso(): EnCurso | undefined {
    const e = this.#encargo
    const meta = this.#mente.estado.metaEnCurso ?? this.#ultimaPuesta
    if (meta === undefined) return undefined
    // Es tuya sólo si hay un encargo abierto Y la meta que la escalera persigue es
    // la que se le puso. Si la mente cambió a una suya —porque el hambre le ganó
    // al pedido— esto lo dice, en vez de seguir mostrando la orden vieja.
    const tuya = e !== undefined && this.#ultimaPuesta === meta
    return {
      meta: enCastellano(meta),
      de: tuya ? 'vos' : 'ella',
      hechas: e?.hechas ?? 0,
      total: tuya ? e.total : 1,
    }
  }

  /**
   * ¿EL MUNDO YA CUMPLE ESTA FIRMA? Contra la vista de AHORA y no contra una foto.
   *
   * Existe por una medición del Hito 6 que conviene no perder: «fabricá una
   * trampa» sale como `catch>0`, y un `Predicado` es EXISTENCIAL —dice «que haya
   * algo que atrape», no «que vos hagas uno»—. Con una caña a la vista la meta ya
   * está cumplida y la mente la descarta con razón; lo que estaba mal era que
   * desde afuera se veía igual que «no me hace caso».
   */
  #yaEstaCumplida = (firma: string): boolean => {
    const pr = interpretar(firma)
    if (pr === undefined) return false
    const v = new Contexto(this.#partida.proyeccion, {
      actor: this.#quien,
      rng: this.#partida.dado.tirar,
      lugares: this.#partida.lugares,
    }).ctx
    return cumple(pr, v)
  }

  /** Lo que se le dice. El acuse entra al log en la misma llamada. */
  decir(texto: string): void {
    const dicho = texto.trim()
    if (dicho === '') return
    const tick = this.#partida.state.tick

    // ─── LA VENTANA SE TOMA ANTES DE ESCRIBIR ESTE TURNO ────────────────────
    //
    // Son «los turnos PREVIOS», así que el que se está escribiendo no cuenta. Da
    // igual para la memoria —una entrada del cuidador no trae cuerpo— y no da
    // igual para el número: `ventanaUsada` es una medición y tiene que decir
    // cuánto contexto había, no cuánto hay contando lo que se acaba de agregar.
    const ventana = this.#canal.ventana()
    this.#ventanaUsada = ventana.length

    // ─── SE LEE ANTES DE ESCRIBIR EL TURNO, y el orden es del C2 ────────────
    //
    // Porque la línea de `entrada` guarda LA META que la frase pidió, y esa meta
    // sale de la lectura. Escribir primero y corregir después dejaría un turno
    // que por un instante dice que no pidió nada — y lo que se guarda es lo que
    // se lee. En el log el orden sigue siendo entrada → acuse, y las dos salen
    // de esta misma llamada sincrónica: el acuse no espera nada.
    const l = leer(dicho, {
      phys: this.#partida.state.phys,
      lexico: this.#lexico,
      sabeElCatalogo: (f) => ESTABLECIBLES.has(f) || esUnTenerlo(f),
      yaEstaCumplida: this.#yaEstaCumplida,
      // EL CONTEXTO PREVIO, derivado del log durable. Es lo que hace que «comé
      // eso» tenga a qué apuntar — también después de cerrar la pestaña.
      memoria: memoriaDe(ventana),
      // Y la otra mitad: a qué TURNO apunta «lo que te pedí». Sale del log
      // entero y no de la ventana — un pedido de hace veinte líneas sigue siendo
      // el último pedido.
      loQuePidio: () => loQuePidio(this.#canal.todo)?.meta,
    })
    this.#ultimaLectura = l

    const meta = l.clausulas[0]?.firma
    this.#canal.decir(tick, 'entrada', dicho, {
      ...(meta === undefined ? {} : { meta }),
      confianza: l.confianza,
    })
    this.#canal.decir(tick, 'acuse', l.acuse)
    this.#consultar(l)

    const e = encargoDe(l)
    // Un encargo vacío NO se pisa sobre el anterior: si la frase no se pudo
    // convertir en nada, lo que la criatura estaba haciendo sigue. Borrarlo sería
    // castigar una frase mal entendida cancelando una orden que sí se entendió.
    if (e.metas.length === 0) return
    // El turno de la `entrada` que acaba de entrar es la procedencia del encargo:
    // de ahí salió, y por ahí se vuelve a la conversación que lo pidió.
    const turno = this.#canal.todo.at(-2)?.turno
    this.#encargo = EncargoEnCurso.nuevo(e, turno === undefined ? [] : [turno], dicho, tick)
    this.#ultimaPuesta = undefined
  }

  /**
   * LA CONSULTA AL PROVEEDOR, QUE NO SE ESPERA. Ver `OpcionesDeOrdenes.preguntar`.
   *
   * `consultaDe` devuelve `undefined` cuando no hay nada que preguntar —la
   * lectura se entendió, o falla el mundo y no la frase— así que sin proveedor y
   * con una frase clara esto no cuesta nada.
   *
   * La respuesta se descarta A PROPÓSITO: aplicarla es C4. Lo único que se hace
   * con ella es contarla, y el `catch` está para que un proveedor que revienta no
   * tire un rechazo sin dueño a la consola del jugador.
   */
  #consultar(l: Lectura): void {
    const preguntar = this.#preguntar
    if (preguntar === undefined) return
    // La ventana va adentro de la consulta: el modelo tiene que leer la frase
    // con el mismo contexto con el que la leyó el lector local, o los dos
    // contestan sobre entradas distintas.
    const c = consultaDe(l, this.#lexico, [...ESTABLECIBLES], this.#canal.ventana())
    if (c === undefined) return
    this.#consultas++
    void preguntar(c).catch((e: unknown) => {
      console.warn('[proveedor] la consulta falló, se sigue con la lectura local:', e)
    })
  }

  /**
   * LO QUE HIZO, NARRADO — y se llama DESPUÉS del paso, no antes.
   *
   * Es la regla que `narrarProgreso` ya declaraba: **el progreso se narra por lo
   * que la criatura HIZO, no por lo que va a hacer**. Un «ya casi» sacado de una
   * estimación convierte una espera en una mentira; «agarró una vara» es un hecho
   * y se comprueba mirando el mundo.
   *
   * Y el cuerpo va en `sobre` porque es lo que hace de esta línea un dato y no una
   * frase: lo último con cuerpo es a lo que apunta «eso» en el turno siguiente.
   */
  despuesDelTick(): void {
    const s = this.#partida.state
    const ahora = s.actors.get(this.#quien)?.holding ?? []
    if (ahora.length === this.#manosAntes.length && ahora.every((id, i) => this.#manosAntes[i] === id)) {
      return
    }
    for (const id of ahora) {
      if (this.#manosAntes.includes(id)) continue
      const c = s.bodies.get(id)
      // El id crudo si el cuerpo no está: no se calla la línea. Que una cosa
      // aparezca en la mano sin nombre es información, no un motivo para no
      // decirlo.
      const como = c === undefined ? id : nameOf(c.body, s.phys)
      this.#canal.decir(s.tick, 'progreso', `agarró ${como}`, { sobre: id })
    }
    this.#manosAntes = [...ahora]
  }

  /**
   * SE LLAMA ANTES DE CADA TICK, y el orden importa: si la meta de ahora ya está
   * cumplida, la criatura tiene que arrancar la siguiente EN ESTE tick y no en el
   * que viene. Con el orden al revés se pierde un tick por cláusula.
   */
  antesDelTick(tick: number): void {
    const e = this.#encargo
    if (e === undefined) return
    const quiere = e.ahora(this.#yaEstaCumplida, tick)
    if (quiere === undefined) {
      this.#canal.decir(tick, 'listo', 'listo')
      this.#encargo = undefined
      return
    }
    // ─── LA GUARDA ES SÓLO CONTRA `#ultimaPuesta`, Y ANTES ERAN DOS ────────
    //
    // Decía `if (quiere === metaEnCurso || quiere === ultimaPuesta) return`, y esa
    // primera mitad tenía un agujero que el spec de Playwright encontró: **si la
    // mente YA perseguía esa meta por su cuenta**, la función salía antes de
    // registrar la orden, `#ultimaPuesta` quedaba en `undefined` y el panel
    // mostraba «fuego (suya)» para siempre — aunque vos acabaras de pedir fuego.
    //
    // Pasa seguido, no es un borde raro: pedirle a la criatura algo que ya estaba
    // por hacer es lo más normal del mundo. Y era invisible desde adentro, porque
    // la mente hacía exactamente lo correcto: lo que estaba mal era quién se
    // llevaba el crédito.
    //
    // Ahora la meta se registra siempre y la guarda sólo evita reconstruir la
    // `Mente` en cada tick, que es para lo único que estaba.
    if (quiere === this.#ultimaPuesta) return

    this.#ultimaPuesta = quiere
    if (e.total > 1) {
      // `progreso` y no habla: explica algo verificable —cuál de las cláusulas
      // está en curso— y el documento pide que no se guarde como una frase del
      // personaje. Antes entraba con la misma marca que el acuse.
      this.#canal.decir(
        tick,
        'progreso',
        `voy por «${enCastellano(quiere)}» (${String(e.hechas + 1)} de ${String(e.total)})`,
      )
    }
    // Una `Mente` nueva y no un setter: `drive` es de sólo lectura en
    // `MenteOptions`, y la memoria —lo que aprendió— se pasa entera, así que lo
    // único que se reinicia es la escalera. Es lo que hace el demo del Hito 6.
    this.#mente = new Mente({
      actor: this.#quien,
      memoria: this.#memoria,
      drive: { meta: quiere, peso: 1, desdeTick: tick },
    })
    this.#mentes.set(this.#quien, this.#mente)
  }
}
