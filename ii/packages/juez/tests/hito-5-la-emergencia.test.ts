// ═══ EL CRITERIO DE EMERGENCIA, CORRIDO ═════════════════════════════════════
//
// El documento de arquitectura (`docs/architecture/remake-anima-ii.md:~1462`) pide
// esto y no otra cosa:
//
//   «se define ANTES una lista de 10 secuencias objetivo que nadie implementó. En
//    20 partidas con semillas distintas tienen que aparecer al menos 4 de las 10,
//    registradas por UN DETECTOR AUTOMÁTICO DE SECUENCIAS, no por observación.»
//
// La lista está cerrada en `ii/docs/hito-5-las-diez-secuencias.md` y tiene NUEVE
// entradas; el detector es `@anima/juez`, escrito sin ver la mente. Este archivo
// es la corrida: veinte partidas, una criatura con su `Mente`, un mundo decretado
// por el dios, y el juez escuchando tick a tick.
//
// ═══ LO QUE ESTE ARNÉS DECÍA ANTES, Y POR QUÉ ESTABA MAL ════════════════════
//
// Va primero y no en una nota al pie, porque es la vara con la que hay que leer
// todo lo de abajo. La corrida anterior de este mismo archivo publicó esto:
//
//   «(A) EL MUNDO NO MATERIALIZA NADA DE LO QUE EL DIOS SIEMBRA … (E) NO PUEDE
//    HABER FUEGO … el encendible más liviano que existió en las veinte partidas
//    pesa 1,0000 kg contra un techo de 0,7132 … el bloque (4) contesta lo mismo en
//    las nueve: EL MUNDO.»
//
// **Nueve filas de nueve diciendo EL MUNDO, y la mitad era del arnés.** El
// «1,0000 kg» salía en las VEINTE semillas, al cuarto decimal. Veinte semillas
// distintas dando el mismo número no es un sorteo: era esta línea, que este mismo
// archivo escribía a mano tres renglones más arriba de donde medía —
//
//     { body: cuerpo('vara', 'madera', 1), at: { x: p.x + 3, y: p.y } }
//
// — y con ella una liana de 0,2 kg, y nada más. O sea que el arnés armaba una
// escena de tres cuerpos, la medía, y publicaba el resultado como una propiedad
// del mundo. Es la cuarta vez en este proyecto que una conclusión sale de medir el
// catálogo o el arnés en vez del mundo; la anterior dio por muerta la propagación
// del fuego, que sí existe, y la de antes contó despegues y las llamó pescados.
//
// LO QUE EL DIOS DECRETA DE VERDAD, medido en `lo-que-el-mundo-si-siembra.test.ts`
// sobre los mismos 9 chunks de arranque y las mismas veinte semillas de §10:
//
//   semillas con al menos una vara encendible ... 13 de 20
//   la más liviana de las veinte ............... 0,0610 kg  (el techo es 0,7132)
//
// La conclusión de la corrida anterior era correcta SOBRE ESA ESCENA y falsa sobre
// el mundo.
//
// ═══ Y LA PREMISA DE LA CORRECCIÓN TAMBIÉN HABÍA QUE MEDIRLA ════════════════
//
// El encargo de este tramo decía que los cuerpos sueltos del dios «ya se
// materializan solos» y que alcanzaba con sacar la escena a mano. **No se
// materializan.** Medido antes de escribir una línea, con una criatura sola en la
// orilla de `20260728n` y cinco ticks de `Partida`: el dios decretó 90 sueltas en
// los 3×3 chunks de alrededor y lo único que apareció fueron tres bancos de peces.
// Cero. Sacar la escena y no poner nada habría dejado un mundo MÁS pobre que el de
// la corrida anterior.
//
// Así que el arnés siembra el decreto él mismo (`tests/el-mundo-decretado.ts`), y
// eso es un rodeo declarado y no una reparación —la reparación es del motor, y su
// `it.fails` sigue en rojo en el bloque (1)—. Lo que el arnés NO hace es elegir:
// qué hay, cuánto pesa y en qué celda está salen de `decretoDe`, o sea de la
// semilla. Lo único que sigue plantado a mano es el cuerpo de la criatura.
//
// ═══ EL VEREDICTO, ARRIBA Y CON LOS NÚMEROS DE ESTA CORRIDA ═════════════════
//
//   APARECIERON 0 DE 9. El criterio no se cumple, y el número crudo se publica sin
//   tocar un umbral: el criterio pide 4 y §10 ya resolvió antes de correr que con
//   nueve entradas el 4 absoluto y el 40% proporcional caen en el mismo número.
//
//   PERO EL CERO CAMBIÓ DE SIGNIFICADO, y ése es el resultado de este tramo:
//
//   ─── (A) TRES DE LAS NUEVE FILAS AHORA MIDEN A LA MENTE ───────────────────
//
//   Con la escena a mano, los NUEVE contra-detectores daban `false` en las veinte
//   partidas: el mundo no le ponía NINGUNO de los nueve problemas delante y las
//   nueve filas contestaban EL MUNDO. Con el mundo decretado, tres se encienden:
//
//     no-frotar-lo-que-no-alcanza-a-encender   situación en  7/20   → LA MENTE
//     la-vara-mas-liviana-que-igual-cocina     situación en  7/20   → LA MENTE
//     ponerle-punta-al-aparejo                 situación en  5/20   → LA MENTE
//
//   O sea: el mundo SÍ le puso esos tres problemas delante, en cinco a siete de las
//   veinte partidas, y la criatura no los resolvió ni una vez. Ese cero mide a la
//   mente. Los otros seis siguen sin medirse, y §10 sigue diciendo que con más de
//   tres no-medidas sobre nueve el resultado no es interpretable — pero seis no es
//   nueve, y las tres que se movieron cambiaron de casilla.
//
//   ─── (B) SÍ HAY CON QUÉ ENCENDER, Y NO ERA UN PROBLEMA DE LA FÍSICA ───────
//
//   Partidas con algún cuerpo encendible: **20 de 20**. Con uno POR DEBAJO del
//   techo de la fricción: **19 de 20**. El más liviano de las veinte partidas pesa
//   **0,0570 kg** contra los 1,0000 que publicaba el arnés viejo — un factor 17,5.
//   Y las que no tienen NO SE DESCARTAN: se corren igual y la columna se publica,
//   porque filtrarlas sería armar el banco para que dé bien.
//
//   (Y hay que decir por qué 19/20 acá y 13/20 en `lo-que-el-mundo-si-siembra`: no
//   son las mismas veinte semillas. Aquéllas son las de §10; éstas son las que de
//   verdad se juegan, con los trece reemplazos que §10 manda hacer cuando una
//   semilla no tiene orilla. Dos poblaciones distintas, dos números, los dos
//   medidos.)
//
//   ─── (C) EL AZAR SE VOLVIÓ A CORRER, Y BAJÓ DE TRES A UNA ─────────────────
//
//   Si el arnés cambia de mundo y el control no, la resta entre los dos no mide
//   nada. Así que el control del dado corre ahora sobre **las mismas veinte
//   semillas, el mismo decreto y la misma orilla**, con las dos concesiones de
//   siempre declaradas (fogata regalada, tanque de 40.000). Firma **1 de 9** —
//   `el-leno-mas-grande-que-todavia-cocina`, 8/20, y sólo con el fuego regalado—
//   contra las 3 de 9 que firmaba sobre su escena vieja. El piso de cuatro hay que
//   cruzarlo sobre las OCHO que quedan.
//
//   Y hay que decir lo que el control NO dice, porque la comparación fácil sería
//   falsa: el dado sin fuego vive 19.212 ticks de promedio con un tanque de 1000, y
//   la mente se muere entre el 3.262 y el 6.199 — pero con un tanque de **310**.
//   Con el tanque igualado en 1000 la mente también llega al 100,0% del presupuesto
//   (bloque 3, tres partidas), así que **no es que el dado sobreviva mejor**: los
//   dos aguantan lo que el tanque les da. La corrida anterior tenía al dado
//   muriéndose en el tick 3.132, y eso sí era de su escena vieja.
//
//   ─── (D) LA CRIATURA SIGUE SIN COMER, Y AHORA SE SABE MEJOR POR QUÉ ───────
//
//   Cero bocados en las veinte, con el mundo narrando cero `comio`. El mejor bocado
//   que ofreció algún cuerpo con calorías en cualquier tick vale **−0,0305 de
//   stamina**, y es una COTA SUPERIOR. Con el veneno cobrado (ADR II-0013) lo que
//   hay tirado en la orilla no paga, y rechazarlo es lo que corresponde. Lo que
//   cambió respecto de la corrida anterior es que ahora hay 2.280 cosas sueltas
//   decretadas alrededor y el número sigue siendo negativo: ya no se puede
//   explicar por la pobreza de la escena.
//
//   ─── (E) LA MUERTE TEMPRANA SIGUE SIN SER LA CAUSA ────────────────────────
//
//   Con el tanque canónico se muere en el 27,7% del presupuesto; con el tanque
//   lleno llega al 100,0% y el juez sigue diciendo 0 de 9. Multiplicar por tres y
//   medio el tiempo vivido no movió una sola fila.
//
//   Y el asterisco, que hay que ponerlo: sin `ANIMA_BANCO=1` el control con el
//   tanque lleno corre TRES partidas de las veinte, así que ese 100,0% y ese 0 de 9
//   son sobre tres. El de las veinte es el canónico. Es una separación más floja de
//   lo que se quisiera y está dicho en la salida en vez de escondido.
//
//   ─── (F) Y EL MUNDO SOBRE EL QUE SE MIDIÓ ES LEGAL ────────────────────────
//
//   **Cero estados ilegales** en los 110.964 ticks auditados con `revisarEstado`,
//   contra los cuatro de la corrida anterior. Y no porque el agujero se haya
//   arreglado: `materializarPozos` sigue poniendo el banco de peces encima de lo
//   que haya sin preguntarle a `estorbo`. Lo que dejó de pasar es que este banco lo
//   pise, porque el decreto no siembra sobre agua. El hallazgo quedó pinado aparte,
//   en su forma mínima y en rojo, para que no se pierda con el cambio de escena.
//
// ═══ QUÉ SE PUBLICA, QUE ES LO QUE §10 MANDA ════════════════════════════════
//
// Las nueve filas con sus tres cifras (apareció en N/20 · la situación existió en
// M/20 · no medida en 20−M), el tick de la primera aparición de cada una, la lista
// de semillas con sus reemplazos, el tanque de arranque, `PHYSICS_VERSION` y el
// hash de cada partida. Lo que §10 pide y esta corrida NO puede publicar —la masa
// del cuerpo elegido en cada disparo de las entradas 2 y 8, y si el fuego de cada
// disparo era de vara sola o de cadena— no se publica porque **no hubo un solo
// disparo ni un solo fuego**, y eso está dicho en la salida en vez de omitido.
//
// ═══ EL UMBRAL: NO SE TOCA ACÁ ══════════════════════════════════════════════
//
// El criterio publicado es «al menos 4», y §10 del documento ya resolvió cómo se
// lee con nueve entradas en vez de diez: el 4 absoluto y el 40% proporcional
// (3,6 → 4) caen en el mismo número, así que no hay nada que elegir. Este archivo
// **no ajusta nada**: reporta el número crudo —aparecieron K de 9— y deja la
// discusión escrita. Con K = 0 la disyuntiva es académica de todos modos.
//
// ═══ CÓMO SE MIDE ACÁ ═══════════════════════════════════════════════════════
//
// Todo lo de este archivo es DETERMINISTA: no se mide un milisegundo que decida
// nada, así que el `ANIMA_BANCO` de abajo no está por flakiness sino por COSTO —el
// control con el tanque lleno son 400.000 ticks de mundo con una mente encima—.
// Se imprime siempre y se afirma sólo midiendo en serio, con una corrida corta que
// sí afirma siempre, que es el patrón que `world/tests/banco-el-tick.test.ts:165`
// dejó escrito. Lo que NO se gatilla es el banco del criterio: es el criterio de
// corte del proyecto, y un criterio que sólo corre si alguien se acuerda de
// exportar una variable de entorno no es un criterio.
//
// Y lo que no se cumple no se ablanda: va en `it.fails` con la salida medida al
// lado, que es el idioma con el que este repositorio ya dejó abiertos el techo del
// tick, los diez huecos de `admit()` y el criterio (2) del Hito 5.

import { describe, expect, it } from 'vitest'

import {
  buildSeedPhysics,
  cumpleRol,
  EXTRACCION,
  HZ_DE_REFERENCIA,
  PHYSICS_VERSION,
  qualityOf,
} from '@anima/physics'
import type { Body } from '@anima/physics'
import {
  COSTO_POR_TOXICIDAD_Y_KILO,
  crearDios,
  decretoDe,
  describir,
  hashWorldState,
  mapaDeCuerpos,
  STAMINA_POR_CALORIA,
} from '@anima/world'
import type { Placement, Violacion } from '@anima/world'
import { Partida } from '@anima/perceive'
import { Creencias, Mente } from '@anima/mind'

import { Detector, potenciaSiArdiera, resumir, ROL_A_DE_FRICCION, SECUENCIAS, TECHO_DE_LA_FRICCION } from '../src/index.js'
import type { FilaDelBanco, NombreDeSecuencia, Situaciones, Veredicto } from '../src/index.js'
import { ruidoDelAzar, tablaDelControl, correrElControl } from './azar.js'
import {
  cuerpo,
  escenaDe,
  firmaDeSueltas,
  laOrilla,
  PARTIDAS,
  RADIO_EN_CHUNKS,
  respirar,
  SEMILLA_BASE,
  SEMILLA_DE_REEMPLAZO,
  semillasQueSeJuegan,
} from './el-mundo-decretado.js'

/** Ver el encabezado: acá el gatillo es el COSTO y no la varianza. */
const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'

/** §10: 20.000 ticks a 20 Hz = 1000 s de mundo, la ventana con la que está medida la economía. */
const TICKS = 20_000

/**
 * EL TANQUE DE ARRANQUE, publicado como §3 exige («el tanque de arranque decide
 * si el criterio se puede medir»).
 *
 * 310 y no 1000, y el motivo es de la mente y no del juez: con el tanque lleno
 * `energia` vale 0,0025 y D3 no elige comida, así que la criatura ni siquiera va
 * al río (`mind/tests/hito-5-el-criterio.test.ts`, la escena del documento). 310
 * es el número con el que la cadena de la caña sale sola, o sea el único con el
 * que el Hito 5 tiene una corrida canónica. El otro se corre igual, como control.
 */
const TANQUE = 310

/** El control de §3: el tanque entero. Es el que separa «no llega» de «no vivió». */
const TANQUE_LLENO = 1000

/** Cuántas partidas del control se corren cuando NO se está midiendo en serio. */
const PARTIDAS_CORTAS = 3

// ─── El arnés: la escena la decreta el dios, y acá sólo se corre ─────────────
//
// LO QUE ESTE BLOQUE TENÍA ANTES, y por qué se fue: armaba a mano la orilla, la
// criatura, una `vara` de madera de 1 kg a tres celdas y un `matorral` de liana de
// 0,2 kg a dos y media. Ochenta líneas de escena inventada, y la corrida entera
// medía esa escena. De ahí salió el «encendible vara 1.0000 kg» de las veinte
// semillas — ver el encabezado.
//
// Ahora la escena vive en `el-mundo-decretado.ts`, la comparten el banco y su
// control, y **todo lo que hay en el piso sale de `decretoDe`**. Lo único que este
// arnés sigue plantando es el cuerpo de la criatura, con su porqué escrito allá.

// ─── La corrida de una partida ───────────────────────────────────────────────

interface Corrida {
  readonly semilla: bigint
  readonly cx: number
  readonly cy: number
  readonly parada: Placement
  /** Ticks que avanzó el mundo. Se CORTA en la muerte: ver el encabezado del bucle. */
  readonly ticks: number
  /** El tick en que la criatura se fue de `state.actors`, o `-1` si llegó viva. */
  readonly murioEn: number
  readonly alientoFinal: number
  readonly veredicto: Veredicto
  /** Los nueve contra-detectores de ESTA partida, para poder decir CUÁL faltó. */
  readonly situaciones: Situaciones
  /** Qué habilidades despegaron y cuántas veces. El denominador de todo diagnóstico. */
  readonly vuelos: ReadonlyMap<string, number>
  /**
   * CUERPOS QUE NACIERON DE UN PROCESO, y cuántos de ellos tenían calorías.
   *
   * ─── POR QUÉ ESTA COLUMNA REEMPLAZA A «pescas», y no es un detalle ─────────
   *
   * La corrida anterior publicaba `pescas` contando DESPEGUES de
   * `aplicar(extraccion)`, y el proyecto entero leyó ese número como pescados:
   * «pescó 199 y le faltaban 83» (`mind/tests/hito-5-el-criterio.test.ts`).
   * Medido acá, en la misma semilla: 198 extracciones COMPLETAS y **dos cuerpos
   * comestibles nacidos en toda la partida**. Un despegue no es un proceso
   * completo y un proceso completo no es una pieza: el que rinde es el dado del
   * mundo contra el `catch` del aparejo, y el pozo tiene `capacity: 1`.
   */
  readonly nacidos: number
  readonly comestibles: number
  /** Procesos `extraccion` COMPLETOS. Ni despegues ni piezas: lo del medio. */
  readonly extraccionesCompletas: number
  /** Lo que el MUNDO narró de comer, que es la única verdad sobre bocados. */
  readonly comio: number
  readonly enveneno: number
  /**
   * EL MEJOR BOCADO QUE EL MUNDO OFRECIÓ ALGUNA VEZ, en stamina neta.
   *
   * `calories · STAMINA_POR_CALORIA − toxicity · masa · COSTO_POR_TOXICIDAD_Y_KILO`,
   * o sea las dos mitades de `intencionComer` (ADR II-0013) con las dos constantes
   * IMPORTADAS del motor y no copiadas. Se calcula sobre todo cuerpo con calorías
   * que no sea una criatura, en todos los ticks.
   *
   * Es una COTA SUPERIOR y a propósito: la mente topa lo acreditado contra lo que
   * todavía entra en el tanque y acá no se topa nada. Si hasta la cota es
   * negativa, no hubo un solo bocado que valiera la pena en toda la partida.
   */
  readonly mejorNeto: number | undefined
  /**
   * EL CUERPO ENCENDIBLE MÁS LIVIANO QUE EXISTIÓ, en cualquier tick.
   *
   * «Encendible» es la misma pregunta que hace el juez para los detectores 1 y 2:
   * cumple el rol `a` de `friccion` Y entregaría potencia si ardiera. Es el número
   * que decide si en esta partida podía haber fuego, porque frotar se paga del
   * tanque y el techo medido es `TECHO_DE_LA_FRICCION`.
   */
  readonly encendible: { readonly id: string; readonly masa: number } | undefined
  /** Cuántas cosas sueltas decretó el dios en los 3×3 chunks alrededor de la parada. */
  readonly sueltasDecretadas: number
  /**
   * Cuántas de esas pudo sembrar el arnés. La diferencia son las que el decreto
   * puso en una celda ya ocupada, que la ley 8 no admite: ver `escenaDe`.
   */
  readonly sueltasSembradas: number
  /** Y cuántos cuerpos puso el mundo por su cuenta: ni sembrados, ni pozo, ni nacidos. */
  readonly cuerposDelMundo: number
  /**
   * LA FIRMA DEL MUNDO que le tocó a esta partida: dónde está la orilla y qué
   * sembró el dios en los 3×3 chunks de alrededor. Es lo que hace verificable la
   * premisa del banco —«veinte partidas con semillas distintas»— sin creerle a la
   * semilla: dos semillas distintas con la misma firma son una partida repetida.
   */
  readonly firma: string
  readonly hash: string
  /**
   * LOS ESTADOS ILEGALES QUE EL ARNÉS VIO EN ESTA PARTIDA.
   *
   * Es la otra mitad de que un cero signifique algo. Un «0 de 9 secuencias» sobre
   * un mundo que nadie auditó no distingue «no emergió nada» de «el mundo estaba
   * roto y nadie miró»: hasta este tramo, `revisarEstado` no lo llamaba una sola
   * línea de `ii/` fuera de su propio test.
   */
  readonly violaciones: readonly { readonly tick: number; readonly v: Violacion }[]
}

/**
 * UNA PARTIDA. El bucle es el de producción con UNA diferencia declarada.
 *
 * `vivir(p, mentes, 1)` es lo que corre en `@anima/mind`, y adentro hace
 * `m.pensar(p)` y después `p.avanzar(1)`. Acá se llama a `p.tick()` en vez de a
 * `p.avanzar(1)` por una sola razón: **`avanzar` se come los `SimEvent`** —los
 * devuelve `tick()` y `avanzar` los descarta (`perceive/src/bucle.ts:420-451`)— y
 * el juez come `{ state, events }` por tick. Sin reloj de pared las dos son la
 * MISMA función: `avanzar` sin `#reloj` es `for (…) this.tick()`, y ese `if` está
 * en la primera línea del bucle. Lo que se pierde es la contabilidad de
 * `ticksPerdidos`, que es del criterio (4) y no de éste.
 *
 * **SE CORTA EN LA MUERTE**, y es lo que el informe necesita para separar «la
 * mente no llega» de «no vivió lo suficiente»: seguir corriendo un mundo sin
 * criatura agrega ticks al denominador y ni una decisión al numerador.
 */
function correrPartida(semilla: bigint, tanque: number, tope: number): Corrida | undefined {
  const o = laOrilla(semilla)
  if (o === undefined) return undefined

  // `vigilar: true`: las cinco preguntas que un estado contesta solo, corridas
  // sobre cada uno de los 20.000 ticks. Hasta este tramo el arnés de invariantes
  // no lo llamaba una sola línea de `ii/` fuera de su propio test, y el adversario
  // del veneno midió un estado ilegal —un actor sin cuerpo— que atravesaba una
  // corrida entera sin que nada se pusiera rojo. Un cero de secuencias emergentes
  // sobre un mundo que nadie está auditando vale menos que un cero auditado.
  const escena = escenaDe(o, tanque)
  const p = new Partida(escena.state, { vigilar: true })
  const m = new Mente({ actor: 'ana', memoria: new Creencias() })
  const d = new Detector()
  // El contrato de alimentación del detector: la primera muestra es el estado
  // INICIAL con la lista de eventos vacía.
  d.observar({ state: p.state, events: [] })

  const vuelos = new Map<string, number>()
  const nacidos = new Set<string>()
  const vistos = new Set<string>()
  let comestibles = 0
  let extraccionesCompletas = 0
  let comio = 0
  let enveneno = 0
  let mejorNeto: number | undefined
  let encendible: { readonly id: string; readonly masa: number } | undefined
  /** Los `Body` que el recorrido del diagnóstico ya interrogó. Ver el bucle. */
  const yaMirados = new Set<Body>()
  const rolA = ROL_A_DE_FRICCION()
  let murioEn = -1
  let aliento = tanque
  let t = 0
  for (; t < tope; t++) {
    const antes = m.despegues
    if (p.state.actors.has('ana')) m.pensar(p)
    if (m.despegues > antes) {
      const n = m.ultimoDespegue ?? '?'
      vuelos.set(n, (vuelos.get(n) ?? 0) + 1)
    }
    const eventos = p.tick()
    const w = p.state
    d.observar({ state: w, events: eventos })
    for (const e of eventos) {
      if (e.k === 'nacio') {
        nacidos.add(e.id)
        const b = w.bodies.get(e.id)
        if (b !== undefined && qualityOf(b.body, 'calories', w.phys) > 0) comestibles += 1
      }
      if (e.k === 'proceso' && e.process === EXTRACCION.id && e.completo) extraccionesCompletas += 1
      if (e.k === 'comio') comio += 1
      if (e.k === 'enveneno') enveneno += 1
    }
    // ─── EL RECORRIDO DEL DIAGNÓSTICO, y por qué es por tick ────────────────
    //
    // Las dos preguntas —«¿hubo alguna vez un bocado que valiera la pena?» y
    // «¿hubo alguna vez algo lo bastante liviano como para poder encenderlo?»—
    // son sobre TODA la partida y no sobre el estado final: el cuerpo que las
    // contesta puede haber existido treinta ticks. Mirar sólo el final diría que
    // no hubo vara justo porque la vara se gastó en la caña.
    //
    // ─── Y POR QUÉ SE SALTEA EL CUERPO QUE YA SE MIRÓ ───────────────────────
    //
    // Antes de este tramo el mundo tenía tres cuerpos y esto era gratis. Ahora
    // tiene entre 26 y 152 —los que el dios decretó—, y mirarlos todos en cada uno
    // de los 20.000 ticks era la mitad de lo que costaba el banco.
    //
    // El salteo es EXACTO y no una aproximación, y el porqué es del mundo: los
    // `WorldState` son inmutables por copia, así que el objeto `Body` de un cuerpo
    // que no cambió es EL MISMO objeto tick a tick. Y las cuatro preguntas de acá
    // abajo —masa, calorías, toxicidad, y si cumple el rol `a` con potencia— son
    // funciones puras de `(Body, Physics)`, con la `Physics` fija en la partida.
    // O sea que preguntarle de nuevo al mismo objeto da lo mismo por construcción.
    // Un cuerpo que se calienta, se parte o se ata es OTRO objeto y se vuelve a
    // mirar.
    const cuerpoDeAna = w.actors.get('ana')?.body
    for (const [id, b] of w.bodies) {
      if (id === cuerpoDeAna || yaMirados.has(b.body)) continue
      yaMirados.add(b.body)
      const masa = qualityOf(b.body, 'mass', w.phys)
      const cal = qualityOf(b.body, 'calories', w.phys)
      if (cal > 0) {
        const neto = cal * STAMINA_POR_CALORIA - qualityOf(b.body, 'toxicity', w.phys) * masa * COSTO_POR_TOXICIDAD_Y_KILO
        if (mejorNeto === undefined || neto > mejorNeto) mejorNeto = neto
      }
      if (encendible !== undefined && masa >= encendible.masa) continue
      if (!cumpleRol(b.body, rolA, w.phys) || potenciaSiArdiera(b.body, w.phys) <= 0) continue
      encendible = { id, masa }
    }
    for (const id of w.bodies.keys()) vistos.add(id)
    const cuerpo = w.bodies.get('ana-cuerpo')
    if (w.actors.has('ana')) {
      if (cuerpo !== undefined) aliento = qualityOf(cuerpo.body, 'stamina', w.phys)
    } else {
      murioEn = t
      break
    }
  }

  // CUERPOS QUE PUSO EL MUNDO POR SU CUENTA. Todo lo que se vio alguna vez, menos
  // lo que el ARNÉS sembró —la criatura y las sueltas del decreto—, menos los
  // bancos de peces —que `stepWorld` sí materializa— menos los que nacieron de un
  // proceso. Lo que queda es lo que el mundo trajo solo, y sigue dando CERO: ver
  // el agujero (A) del encabezado, que es por lo que el arnés tiene que sembrar.
  let cuerposDelMundo = 0
  for (const id of vistos) {
    if (escena.plantados.has(id) || id.startsWith('pozo:') || nacidos.has(id)) continue
    cuerposDelMundo += 1
  }

  let firma = `${String(o.cx)}:${String(o.cy)}|${String(o.pozo.x)},${String(o.pozo.y)}|${String(o.parada.x)},${String(o.parada.y)}`
  const cx = Math.floor(o.parada.x / 16)
  const cy = Math.floor(o.parada.y / 16)
  for (let dx = -RADIO_EN_CHUNKS; dx <= RADIO_EN_CHUNKS; dx++) {
    for (let dy = -RADIO_EN_CHUNKS; dy <= RADIO_EN_CHUNKS; dy++) {
      firma += `#${firmaDeSueltas(decretoDe(o.dios, o.phys, cx + dx, cy + dy).chunk.sueltas)}`
    }
  }

  return {
    semilla,
    cx: o.cx,
    cy: o.cy,
    parada: o.parada,
    ticks: t,
    murioEn,
    alientoFinal: aliento,
    veredicto: d.veredicto(),
    situaciones: { ...d.cronica.situaciones },
    vuelos,
    nacidos: nacidos.size,
    comestibles,
    extraccionesCompletas,
    comio,
    enveneno,
    mejorNeto,
    encendible,
    sueltasDecretadas: escena.decretadas,
    sueltasSembradas: escena.sembradas,
    cuerposDelMundo,
    firma,
    hash: hashWorldState(p.state),
    violaciones: p.informe.violaciones,
  }
}

/**
 * LAS VEINTE, con la política de reemplazo de §10 escrita y no improvisada: «si
 * alguna resulta no resoluble se reemplaza en orden por `20260728n + 20 + j` y el
 * reemplazo se anota». Acá «no resoluble» es lo único que puede serlo desde
 * afuera: que la semilla no tenga una sola orilla en 13×13 chunks.
 */
interface Banco {
  readonly corridas: readonly Corrida[]
  readonly reemplazos: readonly string[]
}

async function correrElBanco(tanque: number, cuantas: number, tope = TICKS): Promise<Banco> {
  // La lista de semillas NO se calcula acá: sale de `semillasQueSeJuegan`, que la
  // comparten este banco y el control del azar. Ver allá el porqué — si cada
  // archivo arma la suya, la mente y el dado se miden en mundos distintos.
  const { semillas, reemplazos } = semillasQueSeJuegan(cuantas)
  const corridas: Corrida[] = []
  for (const semilla of semillas) {
    // Un respiro entre partida y partida, para que el canal del worker no se
    // caiga por los 60 s de birpc. No cambia una sola medición: ver `respirar`.
    await respirar()
    const c = correrPartida(semilla, tanque, tope)
    // `semillasQueSeJuegan` ya garantizó que cada una tiene orilla, así que un
    // `undefined` acá es un mundo que dejó de ser el mismo entre dos llamadas —o
    // sea un determinismo roto— y no un caso de §10 que haya que reemplazar.
    if (c === undefined) throw new Error(`la semilla ${String(semilla)} tenía orilla y ahora no`)
    corridas.push(c)
  }
  return { corridas, reemplazos }
}

// ─── Memoización, para no correr el mismo banco dos veces ────────────────────

// Se memoriza LA PROMESA y no el resultado: así dos tests que pidan el banco a la
// vez lo corren una sola vez, y el `await` de cada uno espera al mismo trabajo.
let elCanonico: Promise<Banco> | undefined
function canonico(): Promise<Banco> {
  elCanonico ??= correrElBanco(TANQUE, PARTIDAS)
  return elCanonico
}

let elControl: Promise<Banco> | undefined
function control(): Promise<Banco> {
  elControl ??= correrElBanco(TANQUE_LLENO, MIDIENDO_EN_SERIO ? PARTIDAS : PARTIDAS_CORTAS)
  return elControl
}

// ─── El informe ──────────────────────────────────────────────────────────────

const dos = (x: number): string => x.toFixed(2)

/** El tick de la PRIMERA aparición de cada secuencia sobre todas las partidas. */
function primerasApariciones(b: Banco): ReadonlyMap<NombreDeSecuencia, number> {
  const out = new Map<NombreDeSecuencia, number>()
  for (const c of b.corridas) {
    for (const f of c.veredicto.filas) {
      if (!f.aparecio || f.tick === undefined) continue
      const y = out.get(f.nombre)
      if (y === undefined || f.tick < y) out.set(f.nombre, f.tick)
    }
  }
  return out
}

/**
 * LA TABLA CRUDA. Las tres cifras de §10 por secuencia, más el tick de la primera
 * aparición y la evidencia del primer disparo si lo hubo.
 */
function tablaDelBanco(b: Banco, titulo: string, ruidoMedido: readonly NombreDeSecuencia[]): string {
  const r = resumir(b.corridas.map((c) => c.veredicto))
  const primeras = primerasApariciones(b)
  const ruido = new Set(ruidoMedido)
  const n = b.corridas.length
  const lineas: string[] = [
    ``,
    `═══ ${titulo} ═══`,
    ``,
    `  ${'secuencia'.padEnd(38)} apareció  situación  no medida  azar  cuenta  1ª vez`,
    `  ${'─'.repeat(38)} ────────  ─────────  ─────────  ────  ──────  ──────`,
  ]
  for (const f of r.filas) {
    const t = primeras.get(f.nombre)
    lineas.push(
      `  ${f.nombre.padEnd(38)} ${`${String(f.aparecioEn)}/${String(n)}`.padStart(8)}  ` +
        `${`${String(f.situacionEn)}/${String(n)}`.padStart(9)}  ` +
        `${`${String(f.noMedidaEn)}/${String(n)}`.padStart(9)}  ` +
        `${(ruido.has(f.nombre) ? 'SÍ' : '·').padStart(4)}  ` +
        `${(f.cuenta && !ruido.has(f.nombre) ? 'SÍ' : 'no').padStart(6)}  ` +
        `${(t === undefined ? '—' : `t=${String(t)}`).padStart(6)}`,
    )
  }
  const cuentanDeVerdad = r.filas.filter((f) => f.cuenta && !ruido.has(f.nombre)).length
  lineas.push(
    ``,
    `  APARECIERON ${String(cuentanDeVerdad)} DE ${String(r.filas.length - ruido.size)} ` +
      `(§10.2: cuenta la que apareció en ≥ 2 de las ${String(n)} con situación, y que el azar NO firma)`,
    `  el azar firma ${String(ruido.size)} de ${String(r.filas.length)}: ${[...ruido].join(', ')}`,
    `  el crudo, sin descontar el ruido: ${String(r.cuantasCuentan)} de ${String(r.filas.length)}`,
    `  sin medir: ${String(r.filas.filter((f) => f.situacionEn === 0).length)} de ${String(r.filas.length)} ` +
      `→ ${r.interpretable ? 'interpretable' : 'NO INTERPRETABLE (§10: más de tres sin medir sobre nueve)'}`,
    `  contradicciones (disparó y el contra-detector negó la situación): ` +
      `${String(r.filas.reduce((a, f) => a + f.contradictorioEn, 0))}`,
  )
  // §10, «qué se publica pase lo que pase»: la masa del cuerpo elegido en cada
  // disparo de las entradas 2 y 8, y si el fuego era de vara sola o de cadena. Si
  // no hubo disparos se dice que no hubo, en vez de omitir la fila.
  const evidencias: string[] = []
  for (const c of b.corridas) {
    for (const f of c.veredicto.filas) {
      if (f.evidencia !== undefined) evidencias.push(`  ${String(c.semilla)} · ${f.nombre}: ${f.evidencia}`)
    }
  }
  lineas.push(
    ``,
    `  evidencia de los disparos (§10 pide la masa elegida y si el fuego era de vara o de cadena):`,
    evidencias.length === 0 ? `    NO HUBO UN SOLO DISPARO, ni un solo fuego en ninguna partida.` : evidencias.join('\n'),
    ``,
  )
  return lineas.join('\n')
}

/** El presupuesto: cuánto de los 20.000 ticks se usó de verdad. */
function tablaDelPresupuesto(b: Banco, titulo: string): string {
  const lineas: string[] = [``, `═══ ${titulo} ═══`, ``]
  let vividos = 0
  let muertas = 0
  for (const c of b.corridas) {
    if (c.murioEn >= 0) muertas += 1
    vividos += c.ticks
    // TRES COLUMNAS DONDE ANTES HABÍA UNA, y las tres dicen cosas distintas:
    // cuántas veces despegó la habilidad, cuántas veces el proceso llegó a
    // completarse, y cuántos cuerpos comestibles nacieron de verdad. La corrida
    // anterior publicaba sólo la primera con el nombre «pescas», y el proyecto la
    // leyó como pescados.
    const despegues = c.vuelos.get(`aplicar(${EXTRACCION.id})`) ?? 0
    // `comer` Y `tragar`: la mente bautiza `tragar(x)` al bocado que decide sola
    // (`mind/src/mente.ts`, la conducta `tragar`) y `comer` al que sale de un
    // plan. Contar sólo el prefijo `comer` daba cero aunque la criatura comiera.
    const bocados = [...c.vuelos]
      .filter(([k]) => k.startsWith('comer') || k.startsWith('tragar'))
      .reduce((a, [, v]) => a + v, 0)
    lineas.push(
      `  ${String(c.semilla)} · ${c.murioEn < 0 ? 'viva' : `murió t=${String(c.murioEn)}`} ` +
        `(${((c.ticks * 100) / TICKS).toFixed(1)}%) · aliento ${dos(c.alientoFinal)} · ` +
        `extraccion ${String(despegues)} despegues → ${String(c.extraccionesCompletas)} completas → ` +
        `${String(c.comestibles)} comestibles de ${String(c.nacidos)} nacidos · ` +
        `bocados ${String(bocados)} (el mundo narró comio ${String(c.comio)} · enveneno ${String(c.enveneno)}) · ` +
        `mejor neto ${c.mejorNeto === undefined ? 'no hubo comida' : dos(c.mejorNeto)} · ` +
        `sembradas ${String(c.sueltasSembradas)}/${String(c.sueltasDecretadas)} · ` +
        `encendible ${c.encendible === undefined ? 'NINGUNO' : `${c.encendible.id} ${c.encendible.masa.toFixed(4)} kg`} · ` +
        `hash ${c.hash.slice(0, 8)}`,
    )
  }
  const presupuesto = b.corridas.length * TICKS
  lineas.push(``, columnaDelEncendible(b), ``)
  lineas.push(
    `  ${String(muertas)} de ${String(b.corridas.length)} partidas terminaron con la criatura muerta`,
    `  presupuesto usado: ${String(vividos)} de ${String(presupuesto)} ticks ` +
      `(${((vividos * 100) / presupuesto).toFixed(1)}%)`,
    ``,
  )
  return lineas.join('\n')
}

/**
 * LA COLUMNA DE «¿HAY CON QUÉ ENCENDER?», que es la que este tramo vino a corregir.
 *
 * `lo-que-el-mundo-si-siembra.test.ts` mide sobre el DECRETO que 13 de las 20
 * semillas de §10 tienen al menos una vara por debajo del techo de la fricción y 7
 * no. Esta columna mide lo mismo sobre las partidas que de verdad se jugaron —que
 * no son las mismas semillas, porque §10 reemplaza las que no tienen orilla— y con
 * el cuerpo que existió EN CUALQUIER TICK, o sea contando también lo que la
 * criatura armó.
 *
 * **Las que no tienen no se descartan.** Filtrarlas sería armar el banco para que
 * dé bien; se corren, y el numerador se publica al lado del denominador.
 */
function columnaDelEncendible(b: Banco): string {
  let conEncendible = 0
  let bajoElTecho = 0
  let masLiviana = Number.POSITIVE_INFINITY
  for (const c of b.corridas) {
    if (c.encendible === undefined) continue
    conEncendible += 1
    if (c.encendible.masa <= TECHO_DE_LA_FRICCION) bajoElTecho += 1
    if (c.encendible.masa < masLiviana) masLiviana = c.encendible.masa
  }
  const n = b.corridas.length
  return (
    `  ¿HAY CON QUÉ ENCENDER? · partidas con algún cuerpo encendible: ${String(conEncendible)}/${String(n)} · ` +
    `con uno POR DEBAJO del techo de ${String(TECHO_DE_LA_FRICCION)} kg: ${String(bajoElTecho)}/${String(n)}\n` +
    `  el más liviano de todas las partidas: ` +
    `${masLiviana === Number.POSITIVE_INFINITY ? '—' : `${masLiviana.toFixed(4)} kg`} ` +
    `(el arnés viejo, con su escena a mano, decía 1,0000 kg en las veinte)\n` +
    // ─── LAS DOS POBLACIONES EN EL MISMO RENGLÓN, Y NO EN DOS ARCHIVOS ───────
    //
    // El «13 de 20» que este tramo publica como corrección está medido sobre las
    // VEINTE SEMILLAS DE §10 (`lo-que-el-mundo-si-siembra.test.ts`), y las que se
    // juegan acá no son ésas: §10 reemplaza las que no tienen orilla, y son trece.
    // Comparar el número de arriba con el «13 de 20» sin decirlo es comparar dos
    // poblaciones distintas, así que se dicen las dos juntas.
    `  (poblaciones: las 20 de §10 dan 13/20 con encendible sobre el DECRETO; ` +
    `las ${String(n)} que se juegan acá dan ${String(conEncendible)}/${String(n)} — no son las mismas semillas)`
  )
}

/** Qué despegó, sumado sobre todas las partidas. El diagnóstico de la mente. */
function tablaDeVuelos(b: Banco): string {
  const total = new Map<string, number>()
  for (const c of b.corridas) for (const [k, v] of c.vuelos) total.set(k, (total.get(k) ?? 0) + v)
  const orden = [...total].sort((a, x) => x[1] - a[1])
  return (
    `  habilidades que despegaron en las ${String(b.corridas.length)} partidas:\n` +
    (orden.length === 0 ? '    (ninguna)' : orden.map(([k, v]) => `    ${k.padEnd(24)} ×${String(v)}`).join('\n'))
  )
}

// ═══ (0) ANTES DE CORRER: ¿SON VEINTE MUNDOS O ES UNO? ══════════════════════

describe('(0) las veinte semillas, antes de correr una sola partida', () => {
  it.fails('LA CACHÉ DEL DECRETO NO LLEVA LA SEMILLA: dos dioses con una `Physics` son un mundo', async () => {
    // POR QUÉ FALLA, Y POR QUÉ NO SE BORRA: `decretoDe` arma su clave con
    // `${cx}:${cy}` y busca en un `WeakMap` indexado por el objeto `Physics`
    // (`world/src/dios.ts:305-317`). La semilla vive en `EstadoDelDios`, que es el
    // PRIMER argumento, y no entra en la clave ni en el `WeakMap`. Así que la
    // segunda pregunta devuelve la respuesta de la primera — y no una copia
    // equivalente: EL MISMO OBJETO.
    //
    // MEDIDO, y es lo que imprime este test: con dos `Physics` distintas las dos
    // semillas dan dos mundos, y con una sola `Physics` dan uno.
    //
    // POR QUÉ IMPORTA MÁS QUE UN BUG DE CACHÉ: «20 partidas con semillas
    // distintas» es media frase del criterio de corte del proyecto. Todo el
    // repositorio construye la física una vez por módulo (`const PHYS =
    // buildSeedPhysics()` arriba de cada arnés), así que el banco obvio —una
    // `Physics`, veinte dioses— mide **la misma partida veinte veces** y nadie se
    // entera: la salida es idéntica renglón por renglón, que es exactamente lo que
    // uno esperaría de un mundo determinista.
    //
    // Este arnés lo esquiva con una `Physics` por partida (`nuevaFisica`). Eso es
    // un rodeo y no una reparación: la reparación es del motor —meter la semilla
    // en la clave— y por eso queda acá en rojo.
    const compartida = buildSeedPhysics()
    const a = decretoDe(crearDios(SEMILLA_BASE), compartida, 7, 7)
    const b = decretoDe(crearDios(SEMILLA_BASE + 1n), compartida, 7, 7)

    const pA = buildSeedPhysics()
    const pB = buildSeedPhysics()
    const separadas = [
      decretoDe(crearDios(SEMILLA_BASE), pA, 7, 7),
      decretoDe(crearDios(SEMILLA_BASE + 1n), pB, 7, 7),
    ].map((d) => firmaDeSueltas(d.chunk.sueltas))

    console.log(
      `\n─── LA CACHÉ DEL DECRETO, MEDIDA ───\n` +
        `  con UNA \`Physics\` compartida, chunk 7:7:\n` +
        `    semilla ${String(SEMILLA_BASE)}      ${firmaDeSueltas(a.chunk.sueltas).slice(0, 90)}\n` +
        `    semilla ${String(SEMILLA_BASE + 1n)}      ${firmaDeSueltas(b.chunk.sueltas).slice(0, 90)}\n` +
        `    ¿es el mismo objeto?  ${String(a === b)}\n` +
        `  con una \`Physics\` POR SEMILLA, el mismo chunk 7:7:\n` +
        `    semilla ${String(SEMILLA_BASE)}      ${(separadas[0] ?? '').slice(0, 90)}\n` +
        `    semilla ${String(SEMILLA_BASE + 1n)}      ${(separadas[1] ?? '').slice(0, 90)}\n`,
    )
    // Lo que SÍ vale hoy, y se afirma acá aunque el test esté en rojo: con una
    // física por partida las semillas se separan. Es la premisa del rodeo.
    expect(separadas[0]).not.toBe(separadas[1])
    // Y esto es lo que tendría que valer y no vale.
    expect(
      firmaDeSueltas(a.chunk.sueltas),
      'dos semillas distintas decretaron el mismo chunk',
    ).not.toBe(firmaDeSueltas(b.chunk.sueltas))
  })

  it('DE LAS VEINTE SEMILLAS DE §10, sólo siete tienen orilla: el resto se reemplaza', async () => {
    // §10 fijó las semillas `20260728n + k` y dejó escrita la política: «si alguna
    // resulta no resoluble se reemplaza en orden por `20260728n + 20 + j` y el
    // reemplazo se anota». Acá se publica cuáles y por qué.
    //
    // «No resoluble» acá es lo único que puede serlo desde afuera, y es específico
    // de la escena canónica: **la semilla no tiene una sola orilla en 13×13
    // chunks**, o sea que no hay dónde poner «con hambre y un río a la vista». No
    // es un juicio sobre el mundo: es que la escena del criterio (1) del Hito 5
    // necesita un pozo con una celda seca al lado, y `world/tests/hito-5-la-pesca`
    // ya tenía medido que el 88,8% de los chunks de `agua-dulce` está enteramente
    // inundado.
    //
    // Y hay que decir de dónde sale que sean TRECE de veinte: la lista de §10 se
    // fijó sin correrla, y el agujero (B) —la caché sin semilla— hacía que
    // cualquier barrido de las veinte con una sola `Physics` encontrara orilla en
    // las veinte, todas la misma. O sea que el 13/20 no es mala suerte: es el
    // primer número que alguien mide sobre esas semillas.
    const filas: string[] = []
    let conOrilla = 0
    for (let k = 0; k < PARTIDAS; k++) {
      const semilla = SEMILLA_BASE + BigInt(k)
      const o = laOrilla(semilla)
      if (o === undefined) {
        filas.push(`  ${String(semilla)} · SIN ORILLA en 13×13 chunks → se reemplaza (§10)`)
        continue
      }
      conOrilla += 1
      filas.push(
        `  ${String(semilla)} · chunk ${String(o.cx).padStart(3)}:${String(o.cy).padStart(3)} · ` +
          `pozo ${String(o.pozo.x)},${String(o.pozo.y)} · parada ${String(o.parada.x)},${String(o.parada.y)}`,
      )
    }
    console.log(
      `\n─── LAS VEINTE SEMILLAS DE §10, UNA POR UNA ───\n${filas.join('\n')}\n` +
        `  ${String(conOrilla)} de ${String(PARTIDAS)} tienen orilla; ` +
        `las otras ${String(PARTIDAS - conOrilla)} se reemplazan en orden desde ${String(SEMILLA_DE_REEMPLAZO)}\n`,
    )
    expect(conOrilla).toBeGreaterThan(0)
    expect(conOrilla).toBeLessThanOrEqual(PARTIDAS)
  }, 300_000)

  it('y las veinte partidas que SE JUGARON son veinte mundos distintos', async () => {
    // La premisa del banco, verificada sobre las semillas que de verdad se
    // corrieron —las de §10 más los reemplazos— y no sobre las que se pensaban
    // correr. Si esto fuera falso, la tabla de más abajo sería una partida
    // repetida veinte veces y el criterio no diría nada.
    //
    // La firma no es la semilla: es DÓNDE quedó la orilla y QUÉ sembró el dios en
    // los 3×3 chunks de alrededor. Comparar semillas no probaría nada —son
    // distintas por construcción— y es exactamente el error que el agujero (B)
    // deja pasar.
    const b = await canonico()
    const firmas = new Set(b.corridas.map((c) => c.firma))
    console.log(
      `\n─── LAS VEINTE QUE SE JUGARON ───\n` +
        b.corridas
          .map(
            (c) =>
              `  ${String(c.semilla)} · chunk ${String(c.cx).padStart(3)}:${String(c.cy).padStart(3)} · ` +
              `parada ${String(c.parada.x)},${String(c.parada.y)} · ` +
              `${String(c.sueltasDecretadas)} sueltas decretadas alrededor`,
          )
          .join('\n') +
        `\n  firmas distintas: ${String(firmas.size)} de ${String(b.corridas.length)}\n`,
    )
    expect(firmas.size).toBe(PARTIDAS)
  }, 600_000)
})

// ═══ (1) EL MUNDO NO LE PONE EL PROBLEMA DELANTE ════════════════════════════

describe('(1) lo que el dios siembra y lo que el mundo materializa', () => {
  it.fails('EL DIOS SIEMBRA ALREDEDOR Y EL MUNDO MATERIALIZA CERO: por eso siembra el arnés', async () => {
    // POR QUÉ SIGUE FALLANDO, Y ES LA PREMISA QUE ESTE TRAMO TUVO QUE MEDIR.
    //
    // `decretoDe(...).chunk.sueltas` trae lo que el dios sembró en cada chunk
    // —junco, piedra, hueso, hoja, grano, raíz, tubérculo alrededor de esta
    // orilla— y **`@anima/world` no lo lee en ningún lado**: `grep -rn "sueltas"
    // world/src` devuelve UN renglón y es un comentario. Lo único que `stepWorld`
    // materializa del decreto es el banco de peces (`materializarPozos`), y
    // `conLoQueElDiosPone` de la capa de percepción copia de la sombra únicamente
    // lo que empieza con `pozo:` (`perceive/src/bucle.ts`).
    //
    // MEDIDO EN ESTE TRAMO, y no leído: una criatura sola en la orilla de
    // `20260728n`, cinco ticks de `Partida`, sin una sola línea de escena. El dios
    // decretó 90 sueltas en los 3×3 chunks de alrededor y lo único que apareció
    // fueron `pozo:-5:-2`, `pozo:-5:-3` y `pozo:-6:-2`. **Cero.** El encargo de
    // este tramo daba por hecho que ya se materializaban solas; no.
    //
    // QUÉ CAMBIÓ, ENTONCES: el arnés siembra el decreto él mismo
    // (`el-mundo-decretado.ts`), y esta columna sigue midiendo lo otro — cuántos
    // cuerpos pone el MUNDO por su cuenta, descontando lo sembrado, los pozos y lo
    // que nació de un proceso. Sigue dando cero, y por eso este test sigue en rojo:
    // el rodeo del arnés no es la reparación, que es del motor —que `stepWorld`
    // materialice `chunk.sueltas` como ya materializa `pozo`—.
    //
    // Y LA DIFERENCIA CON «FABRICAR EL MUNDO QUE UNO QUIERE MEDIR», que es lo que
    // la Regla 5 castiga: el arnés no elige qué hay, ni cuánto pesa, ni dónde está
    // —los tres salen de la semilla— y **no descarta ninguna semilla**. Las que el
    // dios dejó sin nada encendible se corren igual y la columna se publica.
    const b = await canonico()
    const filas = b.corridas.map(
      (c) =>
        `  ${String(c.semilla)} · el dios decretó ${String(c.sueltasDecretadas).padStart(3)} sueltas en 3×3 chunks · ` +
        `el arnés sembró ${String(c.sueltasSembradas).padStart(3)} (la ley 8 le comió ${String(c.sueltasDecretadas - c.sueltasSembradas)}) · ` +
        `el mundo materializó ${String(c.cuerposDelMundo)}`,
    )
    const decretadas = b.corridas.reduce((a, c) => a + c.sueltasDecretadas, 0)
    const sembradas = b.corridas.reduce((a, c) => a + c.sueltasSembradas, 0)
    const materializadas = b.corridas.reduce((a, c) => a + c.cuerposDelMundo, 0)
    console.log(
      `\n─── LO QUE EL DIOS SIEMBRA, LO QUE EL ARNÉS PUEDE PONER Y LO QUE EL MUNDO TRAE ───\n${filas.join('\n')}\n` +
        `  TOTAL: ${String(decretadas)} decretadas · ${String(sembradas)} sembradas por el arnés · ` +
        `${String(materializadas)} materializadas por el mundo\n`,
    )
    expect(decretadas).toBeGreaterThan(0)
    expect(sembradas).toBeGreaterThan(0)
    expect(materializadas, `el mundo materializó ${String(materializadas)} de ${String(decretadas)}`).toBeGreaterThan(0)
  }, 600_000)

  it('CUÁNTAS SITUACIONES PUSO EL MUNDO DELANTE, que es lo que decide si el número se puede leer', async () => {
    // La Regla 4, hecha aserción. No se afirma que las secuencias no aparecieron
    // —eso sería leer un cero que nadie pudo mover— sino CUÁNTAS situaciones el
    // mundo puso delante, que es un hecho del mundo y no de la mente. Con la
    // escena a mano eran cero de nueve y el resultado no era interpretable; con el
    // mundo decretado, lo que salga sale. Lo que se afirma es que el juez midió las
    // nueve, y el número de no-medidas se publica al lado sin ablandarlo.
    const b = await canonico()
    const r = resumir(b.corridas.map((c) => c.veredicto))
    const conSituacion = r.filas.filter((f) => f.situacionEn > 0).map((f) => f.nombre)
    const sinMedir = r.filas.filter((f) => f.situacionEn === 0).length
    console.log(
      `\n  contra-detectores que dieron verdadero en alguna de las ${String(b.corridas.length)} partidas: ` +
        `${conSituacion.length === 0 ? 'NINGUNO' : conSituacion.join(', ')}\n` +
        `  sin medir: ${String(sinMedir)} de ${String(r.filas.length)} ` +
        `→ ${r.interpretable ? 'INTERPRETABLE' : 'NO INTERPRETABLE (§10: más de tres sin medir sobre nueve)'}\n`,
    )
    expect(r.filas.length).toBe(SECUENCIAS.length)
    expect(sinMedir).toBeLessThanOrEqual(SECUENCIAS.length)
  }, 600_000)
})

// ═══ (2) EL BANCO DEL CRITERIO: VEINTE PARTIDAS ═════════════════════════════

describe('(2) veinte partidas con semillas distintas, cortadas en la muerte', () => {
  // ─── EL AZAR, EN TRES TESTS Y NO EN UNO ────────────────────────────────────
  //
  // Los dos controles son 20 × 20.000 ticks cada uno sobre el mundo decretado, y
  // juntos en un solo `it` pasaban de los cinco minutos: vitest le corta el canal
  // al worker («Timeout calling onTaskUpdate») y la corrida entera termina con un
  // error que no es de ninguna medición. Van separados, y el tercero sólo imprime
  // porque `correrElControl` memoiza. No se acortó ni una partida.

  it('EL AZAR SIN FUEGO, sobre las mismas veinte semillas que juega la mente', async () => {
    const sin = await correrElControl('EL AZAR SIN FUEGO', false, 1000)
    console.log(`\n${tablaDelControl(sin)}\n`)
    expect(sin.filas.length).toBe(SECUENCIAS.length)
  }, 900_000)

  it('EL AZAR CON EL FUEGO REGALADO, la concesión que va a favor del dado', async () => {
    const con = await correrElControl('EL AZAR CON EL FUEGO REGALADO', true, 40_000)
    console.log(`\n${tablaDelControl(con)}\n`)
    expect(con.filas.length).toBe(SECUENCIAS.length)
  }, 900_000)

  it('EL RUIDO DEL AZAR, publicado al lado del de la mente', async () => {
    // ─── POR QUÉ ESTE NÚMERO VA ACÁ Y NO SÓLO EN EL ARCHIVO DEL ADVERSARIO ────
    //
    // Porque es el denominador. Una criatura que elige la FORMA del acto y los
    // CUERPOS con el dado del mundo —y que no consulta una sola cualidad, que es
    // exactamente la hipótesis nula de las nueve— firma unas cuantas de las nueve
    // sobre 20 semillas y 20.000 ticks. Ninguna de ésas puede contar para el piso
    // de cuatro: una firma que produce un dado no distingue una mente de un dado.
    //
    // Y EL CONTROL SE VOLVIÓ A CORRER EN ESTE TRAMO, sobre el mundo decretado y
    // con las mismas veinte semillas que juega la mente. Antes corría sobre una
    // escena propia —diez sueltas de una tabla escrita a mano y cuatro peces
    // regalados— y el banco de la mente sobre otra: dos mundos distintos y una
    // resta entre ellos. Ver el encabezado de `tests/azar.ts`.
    //
    // Está medido y no estimado, con `dadoDe(crearDios(semilla))` y sin un solo
    // `Math.random`.
    const sin = await correrElControl('EL AZAR SIN FUEGO', false, 1000)
    const con = await correrElControl('EL AZAR CON EL FUEGO REGALADO', true, 40_000)
    const ruido = await ruidoDelAzar()
    console.log(
      `\n═══ EL RUIDO DEL AZAR, EL DENOMINADOR DEL CRITERIO ═══\n` +
        `${tablaDelControl(sin)}\n\n${tablaDelControl(con)}\n\n` +
        `  ══ EL AZAR FIRMA ${String(ruido.length)} DE ${String(SECUENCIAS.length)} ══ ${ruido.join(' · ')}\n` +
        `  ⇒ el piso de cuatro hay que cruzarlo sobre las ${String(SECUENCIAS.length - ruido.length)} que quedan\n`,
    )
    // Se afirma que el control corrió y midió las nueve, no cuánto dio: el número
    // es un hallazgo y va en la salida, no en un umbral.
    expect(sin.filas.length).toBe(SECUENCIAS.length)
    expect(con.filas.length).toBe(SECUENCIAS.length)
    expect(ruido.length).toBeLessThanOrEqual(SECUENCIAS.length)
  }, 900_000)

  it('LA TABLA CRUDA, que es lo que este archivo existe para publicar', async () => {
    const b = await canonico()
    const ruido = await ruidoDelAzar()
    console.log(
      `\n═══ EL BANCO ═══\n` +
        `  ${String(b.corridas.length)} partidas · tope ${String(TICKS)} ticks (${String(TICKS / HZ_DE_REFERENCIA)} s de mundo)\n` +
        `  tanque de arranque: ${String(TANQUE)} de 1000 · capacity 3 · PHYSICS_VERSION ${String(PHYSICS_VERSION)}\n` +
        `  semillas: ${b.corridas.map((c) => String(c.semilla)).join(' ')}\n` +
        `  reemplazos de §10 (${String(b.reemplazos.length)}):\n` +
        (b.reemplazos.length === 0 ? '    ninguno\n' : `${b.reemplazos.join('\n')}\n`) +
        tablaDelPresupuesto(b, 'EL PRESUPUESTO: CUÁNTO DE LOS 20.000 TICKS SE USÓ') +
        tablaDeVuelos(b) +
        '\n' +
        tablaDelBanco(b, 'LAS NUEVE SECUENCIAS, PARTIDA POR PARTIDA', ruido),
    )
    // Lo que se afirma siempre acá es lo ESTRUCTURAL: que el banco corrió lo que
    // dijo que iba a correr. Los números del veredicto van abajo, cada uno con su
    // aserción y su color.
    expect(b.corridas.length).toBe(PARTIDAS)
    expect(new Set(b.corridas.map((c) => c.semilla)).size).toBe(PARTIDAS)
    for (const c of b.corridas) expect(c.veredicto.filas.length).toBe(SECUENCIAS.length)
  }, 600_000)

  it.fails('EL CRITERIO DE CORTE: al menos 4 de las 9 — aparecieron 0', async () => {
    // EL NÚMERO CRUDO, que es lo único que este archivo decide: **aparecieron 0 de
    // 9**. El umbral no se toca acá y no hace falta tocarlo: §10 del documento ya
    // dejó escrito, antes de correr, que con nueve entradas el 4 absoluto del
    // criterio publicado y el 40% proporcional (3,6 → 4) caen en el mismo número.
    //
    // Y hay que leerlo con la fila de al lado: quedan SEIS no-medidas sobre nueve
    // —eran nueve con la escena a mano— y §10 dice que con más de tres el resultado
    // no es interpretable. Lo que sí es interpretable son las TRES que se movieron:
    // el mundo puso esos problemas delante en 5 a 7 de las 20 partidas y la
    // criatura no los resolvió una sola vez. Ese pedazo del cero mide a la mente, y
    // es lo que el bloque (4) contesta fila por fila.
    const b = await canonico()
    const r = resumir(b.corridas.map((c) => c.veredicto))
    console.log(
      `\n─── EL CRITERIO ───\n` +
        `  aparecieron ${String(r.cuantasCuentan)} de ${String(r.filas.length)} · ` +
        `el criterio publicado pide 4 · sin medir ${String(r.filas.filter((f) => f.situacionEn === 0).length)}\n`,
    )
    expect(r.cuantasCuentan, `aparecieron ${String(r.cuantasCuentan)} de ${String(r.filas.length)}`).toBeGreaterThanOrEqual(4)
  }, 600_000)

  it('Y EL MUNDO SOBRE EL QUE SE MIDIÓ ES LEGAL: el arnés corrió sobre los 20.000 ticks', async () => {
    // ─── POR QUÉ ESTO ES PARTE DEL CRITERIO Y NO UNA HIGIENE ────────────────
    //
    // Este archivo publica un cero. Un cero vale lo que valga el mundo sobre el
    // que se midió, y hasta este tramo ese mundo NO SE AUDITABA: `grep
    // exigirInvariantes ii/` devolvía dos archivos —el que lo define y su propio
    // test— y ninguna corrida real de `ii/` lo llamaba. El adversario del veneno
    // midió un estado ilegal que atravesaba una corrida entera en silencio: una
    // criatura que se comía a sí misma quedaba de actor SIN CUERPO, con
    // `inventario-inconsistente` en cada uno de los 500 ticks siguientes.
    //
    // Ahora `correrPartida` construye la `Partida` con `vigilar: true` y las cinco
    // preguntas que un estado contesta solo corren sobre cada tick de cada una de
    // las veinte. Si la lista sale vacía, el cero de secuencias es un cero sobre un
    // mundo legal. Si sale con algo, el cero no significaba nada — y hay que
    // saberlo ANTES de discutir umbrales.
    //
    // La sexta pregunta, la conservación, sigue sin poder encenderse acá: los tres
    // caminos por los que el dios materializa materia no emiten ningún evento que
    // `acreditado()` sepa leer, y su `it.fails` está en
    // `perceive/tests/ataque-a-la-costura.test.ts`. Lo que se afirma es lo que se
    // midió, ni una palabra más.
    const b = await canonico()
    const total = b.corridas.reduce((a, c) => a + c.violaciones.length, 0)
    const conAlguna = b.corridas.filter((c) => c.violaciones.length > 0)
    const clases = new Set(b.corridas.flatMap((c) => c.violaciones.map((x) => x.v.k)))
    console.log(
      `\n─── EL ARNÉS, SOBRE LAS VEINTE ───\n` +
        `  ${String(b.corridas.reduce((a, c) => a + c.ticks, 0))} ticks auditados con \`revisarEstado\` (orden · espacio · referencias · inventarios · rangos)\n` +
        `  estados ilegales: ${String(total)} en ${String(conAlguna.length)} de ${String(b.corridas.length)} partidas · clases: ${[...clases].join(', ') || '(ninguna)'}\n` +
        (conAlguna.length === 0
          ? '  ninguna partida los tuvo\n'
          : conAlguna
              .map(
                (c) =>
                  `  semilla ${String(c.semilla)} (${String(c.violaciones.length)}): ticks ` +
                  `${c.violaciones.map((x) => String(x.tick)).join(',')} — ${describir(c.violaciones[0]?.v as Violacion)}\n`,
              )
              .join('')),
    )
    // CERO, Y SE AFIRMA CERO. La corrida anterior tenía cuatro —`solidos-solapados`
    // entre `pozo:-5:-2` y la `vara` que el arnés dejaba a tres celdas— y esa
    // aserción decía «a lo sumo una partida, y de esa clase». Ya no hace falta
    // aflojarla: con la escena decretada no hay ninguno, porque `scatter` no
    // siembra sobre agua y el pozo está justamente en el agua. Ver el `it.fails`
    // de abajo: **el agujero del mundo sigue ahí**, lo que dejó de pasar es que
    // este banco lo pise.
    expect([...clases]).toEqual([])
    expect(total).toBe(0)
  }, 600_000)

  it.fails('EL AGUJERO QUE ESTE BANCO YA NO PISA: el dios materializa el banco encima de lo que haya', async () => {
    // ─── POR QUÉ ESTE TEST EXISTE Y NO SE BORRÓ CON LA ESCENA VIEJA ─────────
    //
    // El arnés de invariantes encontró esto la primera vez que alguien lo encendió:
    // `materializarPozos` (`world/src/step.ts`) hace `ponerCuerpo` en `pozo.at` sin
    // preguntarle a `estorbo`, que es el guardián de la ley 8 que sí aplican
    // `goTo`, `put` y `drop`. La `vara` que el arnés viejo dejaba a tres celdas
    // caía justo ahí en UNA de las veinte semillas, y el solapamiento duraba hasta
    // que la criatura levantaba la vara —`revisarEspacio` no mira lo que está en
    // una mano—, o sea que ni siquiera se arreglaba: se escondía.
    //
    // Con el mundo decretado el banco de arriba da cero, y ese cero podría leerse
    // como «se arregló». **No se arregló**: dejó de dispararse porque el decreto no
    // siembra sobre agua y el pozo está en el agua. Así que el hallazgo se pone acá
    // en su forma mínima —un cuerpo puesto a mano en la celda del pozo, UN tick— en
    // vez de depender de que a alguna semilla le toque. Perder un hallazgo porque
    // cambió la escena sería peor que no haberlo encontrado.
    //
    // POR QUÉ NO SE ARREGLA EN ESTE TRAMO: la reparación no es un `if`, es una
    // decisión — o el banco no se materializa (y la comida del mundo depende de
    // dónde alguien dejó un palo), o se corre de celda (y entonces la posición de
    // todo pozo depende del estado, o sea que el decreto deja de ser una función
    // pura de la semilla y se mueven todos los hashes). Pide su ADR.
    const o = laOrilla(SEMILLA_BASE)
    expect(o).not.toBe(undefined)
    if (o === undefined) return
    const escena = escenaDe(o, TANQUE)
    // UN cuerpo más, y en la única celda que importa: la del banco de peces. No es
    // la escena del criterio —esto no mide ninguna secuencia—: es la reproducción
    // mínima del agujero.
    const bodies = new Map(escena.state.bodies)
    bodies.set('estorbo', { body: cuerpo('estorbo', 'piedra', 1), at: o.pozo })
    const p = new Partida({ ...escena.state, bodies: mapaDeCuerpos([...bodies.values()]) }, { vigilar: true })
    p.tick()
    const v = p.informe.violaciones
    console.log(
      `\n─── EL BANCO DE PECES, ENCIMA DE LO QUE HAYA ───\n` +
        `  celda del pozo: ${String(o.pozo.x)},${String(o.pozo.y)} · violaciones en un tick: ${String(v.length)}` +
        `${v.length === 0 ? '' : ` — ${describir(v[0]?.v as Violacion)}`}\n`,
    )
    // Y esto es lo que tendría que valer y no vale.
    expect(v.length, `el mundo puso el banco encima y nadie lo frenó`).toBe(0)
  }, 120_000)

  it('CUÁNTO DEL PRESUPUESTO SE USÓ, que es la mitad de la pregunta', async () => {
    // La otra mitad —«¿cuántas no aparecieron porque la criatura se murió antes de
    // poder intentarlas?»— la contesta el control del bloque (3). Acá va el
    // denominador: cuánto vivió de verdad cada partida.
    const b = await canonico()
    const vividos = b.corridas.reduce((a, c) => a + c.ticks, 0)
    const presupuesto = b.corridas.length * TICKS
    const muertas = b.corridas.filter((c) => c.murioEn >= 0).length
    const ticksDeMuerte = b.corridas.filter((c) => c.murioEn >= 0).map((c) => c.murioEn)
    const menor = ticksDeMuerte.length === 0 ? -1 : Math.min(...ticksDeMuerte)
    const mayor = ticksDeMuerte.length === 0 ? -1 : Math.max(...ticksDeMuerte)
    console.log(
      `\n─── EL PRESUPUESTO ───\n` +
        `  ${String(muertas)}/${String(b.corridas.length)} partidas terminaron en muerte, ` +
        `entre el tick ${String(menor)} y el ${String(mayor)}\n` +
        `  ${String(vividos)} de ${String(presupuesto)} ticks vividos = ` +
        `${((vividos * 100) / presupuesto).toFixed(1)}% del presupuesto del criterio\n`,
    )
    // Se afirma que el banco midió el presupuesto, no cuánto dio: el número exacto
    // depende de la mente y esto es el juez.
    expect(vividos).toBeGreaterThan(0)
    expect(vividos).toBeLessThanOrEqual(presupuesto)
  }, 600_000)
})

// ═══ (3) EL CONTROL: ¿ES LA MUERTE O ES LA MENTE? ═══════════════════════════

describe('(3) el control con el tanque lleno', () => {
  it('con 1000 de aliento la criatura vive casi los 20.000 — y el juez dice lo mismo', async () => {
    // LA PREGUNTA QUE ESTE BLOQUE CONTESTA, y sin ella el cero de arriba no
    // significa nada: ¿las secuencias no aparecieron porque la mente no llega, o
    // porque la criatura no vivió lo suficiente para intentarlas?
    //
    // Se corre el mismo banco con el tanque entero. Si el cero se moviera, la
    // respuesta sería «no vivió»; si no se mueve, la muerte temprana no es lo que
    // manda. **No se mueve.**
    //
    // COSTO: son 20 × 20.000 ticks de mundo con una mente encima. Se corren las
    // veinte sólo con `ANIMA_BANCO=1`; sin él se corren tres y se dice cuántas.
    // Ver el encabezado: acá el gatillo es el costo y no la varianza.
    const b = await control()
    const canon = await canonico()
    const ruido = await ruidoDelAzar()
    console.log(
      `\n═══ EL CONTROL, TANQUE ${String(TANQUE_LLENO)} ═══\n` +
        `  ${String(b.corridas.length)} partidas` +
        `${MIDIENDO_EN_SERIO ? ' (midiendo en serio)' : ` de ${String(PARTIDAS)} — sin ANIMA_BANCO=1`}\n` +
        tablaDelPresupuesto(b, 'EL PRESUPUESTO DEL CONTROL') +
        tablaDeVuelos(b) +
        '\n' +
        tablaDelBanco(b, 'LAS NUEVE, CON EL TANQUE LLENO', ruido),
    )

    const vividos = b.corridas.reduce((a, c) => a + c.ticks, 0)
    const presupuesto = b.corridas.length * TICKS
    const r = resumir(b.corridas.map((c) => c.veredicto))
    console.log(
      `\n─── LA SEPARACIÓN ───\n` +
        `  con tanque ${String(TANQUE)}:  ${((canon.corridas.reduce((a, c) => a + c.ticks, 0) * 100) / (PARTIDAS * TICKS)).toFixed(1)}% del presupuesto · ` +
        `${String(resumir(canon.corridas.map((c) => c.veredicto)).cuantasCuentan)} de 9\n` +
        `  con tanque ${String(TANQUE_LLENO)}: ${((vividos * 100) / presupuesto).toFixed(1)}% del presupuesto · ` +
        `${String(r.cuantasCuentan)} de 9\n` +
        `  ⇒ ${r.cuantasCuentan === resumir(canon.corridas.map((c) => c.veredicto)).cuantasCuentan ? 'estirar el tiempo vivido no movió una sola fila: NO es la muerte' : 'el tiempo vivido SÍ mueve la aguja'}\n`,
    )

    // La corrida corta que sí afirma siempre: el control corrió y el juez lo
    // juzgó. Es lo que garantiza que el bloque no se rompa en silencio.
    expect(b.corridas.length).toBeGreaterThanOrEqual(PARTIDAS_CORTAS)
    for (const c of b.corridas) expect(c.veredicto.filas.length).toBe(SECUENCIAS.length)

    // Y lo caro se afirma sólo midiendo en serio.
    if (!MIDIENDO_EN_SERIO) return
    expect(b.corridas.length).toBe(PARTIDAS)
    expect(vividos / presupuesto).toBeGreaterThan(0.9)
  }, 900_000)
})

// ═══ (4) EL DIAGNÓSTICO: DE CUÁL DE LAS TRES CAUSAS ES CADA CERO ════════════
//
// Un cero por secuencia no dice nada solo. Puede ser una de tres cosas, y las
// tres se separan con datos que ya están medidos y sin opinar sobre ninguna:
//
//   EL MUNDO   el contra-detector dio `false` en las veinte, y también en el
//              control con el tanque lleno —que vive 3,4× más—. El mundo nunca
//              puso el problema delante, y no fue por falta de tiempo.
//   LA MUERTE  el contra-detector dio `false` en las veinte y SÍ dio `true` en
//              alguna del control. Lo que faltó fue vida, no mundo.
//   LA MENTE   el contra-detector dio `true` en alguna partida y la firma no
//              salió igual. Es el único caso en el que el cero mide a la mente.
//
// El control con el tanque lleno es lo que hace que «EL MUNDO» y «LA MUERTE» no
// sean la misma casilla, y por eso este bloque lo consume aunque sea caro.

type Causa = 'EL MUNDO' | 'LA MUERTE' | 'LA MENTE'

/**
 * QUÉ CONTRA-DETECTORES PIDE CADA SECUENCIA.
 *
 * Es una transcripción del campo `situacion` de cada entrada de `src/secuencias
 * .ts`, y una transcripción es exactamente la clase de cosa que este repositorio
 * ya vio salir mal (§ la Regla 1 del juez). Por eso no se le cree: el test de más
 * abajo verifica, partida por partida y fila por fila, que la conjunción de estas
 * claves da lo mismo que el `situacion` que el detector calculó. Si mañana alguien
 * le cambia un `&&` a un contra-detector, esto se pone rojo.
 */
const LO_QUE_PIDE: readonly (readonly [NombreDeSecuencia, readonly (keyof Situaciones)[]])[] = [
  ['no-frotar-lo-que-no-alcanza-a-encender', ['dosCandidatosDeFriccion', 'candidatoDeFriccionPesado']],
  ['la-vara-mas-liviana-que-igual-cocina', ['dosCandidatosDeFriccion']],
  ['taparlo-con-lo-que-respira', ['fuegoYDosPermeabilidades']],
  ['ponerle-punta-al-aparejo', ['filoALaVista']],
  ['comerla-en-el-pico-de-calorias', ['algoSeCocino']],
  ['cocinar-el-lote-en-un-solo-fuego', ['loteAlAlcance']],
  ['el-fardo-de-corteza', ['fardoPosible']],
  ['el-leno-mas-grande-que-todavia-cocina', ['dosCombustiblesEnIntervalo']],
  ['la-piedra-primero-y-la-comida-encima', ['parrillaOfrecida']],
]

function pideDe(n: NombreDeSecuencia): readonly (keyof Situaciones)[] {
  for (const [nombre, claves] of LO_QUE_PIDE) if (nombre === n) return claves
  throw new Error(`la secuencia ${n} no está en LO_QUE_PIDE`)
}

function causaDe(canon: FilaDelBanco, ctrl: FilaDelBanco | undefined): Causa {
  if (canon.situacionEn > 0) return 'LA MENTE'
  return ctrl !== undefined && ctrl.situacionEn > 0 ? 'LA MUERTE' : 'EL MUNDO'
}

/** En cuántas partidas cada contra-detector suelto dio verdadero. */
function cuentaDeClaves(b: Banco): ReadonlyMap<keyof Situaciones, number> {
  const out = new Map<keyof Situaciones, number>()
  for (const c of b.corridas) {
    for (const k of Object.keys(c.situaciones) as (keyof Situaciones)[]) {
      if (c.situaciones[k]) out.set(k, (out.get(k) ?? 0) + 1)
    }
  }
  return out
}

describe('(4) el diagnóstico, secuencia por secuencia', () => {
  it('DE CUÁL DE LAS TRES CAUSAS ES CADA CERO, con la evidencia al lado', async () => {
    const b = await canonico()
    const k = await control()
    const rc = resumir(b.corridas.map((x) => x.veredicto))
    const rk = resumir(k.corridas.map((x) => x.veredicto))
    const claves = cuentaDeClaves(b)
    const n = b.corridas.length

    const lineas: string[] = [
      ``,
      `═══ DE CUÁL DE LAS TRES CAUSAS ES CADA CERO ═══`,
      ``,
      `  ${'secuencia'.padEnd(38)} apar. situ.  causa      qué contra-detector faltó (en cuántas de ${String(n)} dio verdadero)`,
      `  ${'─'.repeat(38)} ───── ─────  ─────────  ${'─'.repeat(60)}`,
    ]
    for (const f of rc.filas) {
      const ctrl = rk.filas.find((x) => x.nombre === f.nombre)
      const causa = causaDe(f, ctrl)
      const detalle = pideDe(f.nombre)
        .map((c) => `${c} ${String(claves.get(c) ?? 0)}/${String(n)}`)
        .join(' ∧ ')
      lineas.push(
        `  ${f.nombre.padEnd(38)} ${`${String(f.aparecioEn)}/${String(n)}`.padStart(5)} ` +
          `${`${String(f.situacionEn)}/${String(n)}`.padStart(5)}  ${causa.padEnd(9)}  ${detalle}`,
      )
    }

    // ─── LOS TRES NÚMEROS DEL MUNDO QUE ACOMPAÑAN A LAS NUEVE FILAS ─────────
    //
    // No son adornos del informe: son el «con evidencia» de cada causa. Los tres
    // se PUBLICAN, no se interpretan en el título: la corrida anterior los tituló
    // «NO PUEDE HABER FUEGO» sobre una escena que el arnés había plantado, y ese
    // título era lo único falso de las tres líneas.
    let masLiviano: { readonly id: string; readonly masa: number } | undefined
    let sinEncendible = 0
    let mejorNeto: number | undefined
    let netosPositivos = 0
    let comestibles = 0
    let comio = 0
    for (const c of b.corridas) {
      if (c.encendible === undefined) sinEncendible += 1
      else if (masLiviano === undefined || c.encendible.masa < masLiviano.masa) masLiviano = c.encendible
      if (c.mejorNeto !== undefined) {
        if (mejorNeto === undefined || c.mejorNeto > mejorNeto) mejorNeto = c.mejorNeto
        if (c.mejorNeto > 0) netosPositivos += 1
      }
      comestibles += c.comestibles
      comio += c.comio
    }
    const decretadas = b.corridas.reduce((a, c) => a + c.sueltasDecretadas, 0)
    const sembradas = b.corridas.reduce((a, c) => a + c.sueltasSembradas, 0)
    const materializadas = b.corridas.reduce((a, c) => a + c.cuerposDelMundo, 0)

    lineas.push(
      ``,
      `  ── LOS TRES NÚMEROS DEL MUNDO QUE VAN AL LADO DE LAS NUEVE FILAS ──`,
      ``,
      `  1· ¿HABÍA CON QUÉ ENCENDER? El cuerpo encendible —rol \`a\` de fricción Y que entregaría`,
      `     potencia si ardiera— más liviano que existió en las ${String(n)} partidas es ` +
        `${masLiviano === undefined ? 'NINGUNO' : `«${masLiviano.id}» de ${masLiviano.masa.toFixed(4)} kg`},`,
      `     contra un techo medido de ${String(TECHO_DE_LA_FRICCION)} kg (§2.2: 0,7132 no prende, 0,80 sí, con el tanque LLENO).`,
      `     Partidas sin ningún encendible: ${String(sinEncendible)}/${String(n)}, y no se descarta ninguna. Siete de las nueve cuelgan del fuego.`,
      ``,
      `  2· ¿HABÍA UN BOCADO QUE VALIERA LA PENA? El mejor neto que ofreció un cuerpo con calorías,`,
      `     en cualquier tick de cualquier partida, es ${mejorNeto === undefined ? 'no hubo comida' : mejorNeto.toFixed(4)} de stamina` +
        ` — y es una COTA SUPERIOR.`,
      `     Partidas con algún bocado de neto positivo: ${String(netosPositivos)}/${String(n)}. Cuerpos comestibles nacidos en total: ${String(comestibles)}.`,
      `     El mundo narró ${String(comio)} \`comio\`. La mente SÍ sabe emitir el bocado —la conducta \`tragar\` está en`,
      `     \`mind/src\` y este banco la cuenta—, así que un cero de bocados es una decisión y no una carencia.`,
      ``,
      `  3· ¿CUÁNTA MATERIA HUBO, Y QUIÉN LA PUSO? El dios decretó ${String(decretadas)} cosas sueltas alrededor,`,
      `     el arnés pudo sembrar ${String(sembradas)} (la ley 8 se come las que caen en una celda ya ocupada) y el mundo`,
      `     materializó ${String(materializadas)} por su cuenta. De ahí salen las dos filas que ni siquiera necesitan fuego:`,
      `     \`dosCandidatosDeFriccion\` ${String(claves.get('dosCandidatosDeFriccion') ?? 0)}/${String(n)} y \`filoALaVista\` ${String(claves.get('filoALaVista') ?? 0)}/${String(n)}.`,
      ``,
    )
    console.log(lineas.join('\n'))

    // ─── LO QUE SE AFIRMA: que la transcripción no miente ───────────────────
    //
    // El `LO_QUE_PIDE` de arriba es una copia de los `situacion` de `secuencias
    // .ts`, y una copia que nadie verifica es la Regla 1 otra vez. Acá se verifica
    // contra el detector, en las veinte partidas y en las nueve filas.
    for (const c of b.corridas) {
      for (const f of c.veredicto.filas) {
        const esperado = pideDe(f.nombre).every((x) => c.situaciones[x])
        expect(
          f.situacion,
          `${String(c.semilla)} · ${f.nombre}: LO_QUE_PIDE dice ${String(esperado)} y el detector dice ${String(f.situacion)}`,
        ).toBe(esperado)
      }
    }
    expect(rc.filas.length).toBe(SECUENCIAS.length)
  }, 900_000)
})

// ═══ EL CUADRO ══════════════════════════════════════════════════════════════

describe('el criterio de emergencia, con los números de esta corrida', () => {
  it('el cuadro', async () => {
    const c = await canonico()
    const k = await control()
    const ruido = await ruidoDelAzar()
    const rc = resumir(c.corridas.map((x) => x.veredicto))
    const rk = resumir(k.corridas.map((x) => x.veredicto))
    const usado = c.corridas.reduce((a, x) => a + x.ticks, 0)
    const usadoK = k.corridas.reduce((a, x) => a + x.ticks, 0)
    const decretadas = c.corridas.reduce((a, x) => a + x.sueltasDecretadas, 0)
    const sembradasTotales = c.corridas.reduce((a, x) => a + x.sueltasSembradas, 0)
    const materializadas = c.corridas.reduce((a, x) => a + x.cuerposDelMundo, 0)
    const comestiblesTotales = c.corridas.reduce((a, x) => a + x.comestibles, 0)
    let masMagro: { readonly id: string; readonly masa: number } | undefined
    let mejorBocado: number | undefined
    let bajoElTecho = 0
    for (const x of c.corridas) {
      if (x.encendible !== undefined && (masMagro === undefined || x.encendible.masa < masMagro.masa)) {
        masMagro = x.encendible
      }
      if (x.encendible !== undefined && x.encendible.masa <= TECHO_DE_LA_FRICCION) bajoElTecho += 1
      if (x.mejorNeto !== undefined && (mejorBocado === undefined || x.mejorNeto > mejorBocado)) {
        mejorBocado = x.mejorNeto
      }
    }
    // DE QUIÉN ES CADA CERO, contado y no narrado. Es la misma `causaDe` del
    // bloque (4), y va acá porque es lo que cambió de fondo entre las dos
    // corridas: con la escena a mano las nueve filas decían EL MUNDO.
    const porCausa = new Map<Causa, number>()
    for (const f of rc.filas) {
      const causa = causaDe(f, rk.filas.find((x) => x.nombre === f.nombre))
      porCausa.set(causa, (porCausa.get(causa) ?? 0) + 1)
    }
    console.log(
      [
        '',
        '════ EL CRITERIO DE EMERGENCIA, MEDIDO ════════════════════════════════════',
        '',
        `  el criterio ............... «al menos 4 de las 10» sobre una lista de ${String(SECUENCIAS.length)}`,
        `  APARECIERON ............... ${String(rc.cuantasCuentan)} de ${String(SECUENCIAS.length)}`,
        `  RUIDO DEL AZAR ............ ${String(ruido.length)} de ${String(SECUENCIAS.length)} las firma un bicho que elige con el dado:`,
        `                              ${ruido.join(', ')}`,
        `                              ⇒ el piso de cuatro hay que cruzarlo sobre las ${String(SECUENCIAS.length - ruido.length)} que quedan`,
        `  SIN MEDIR ................. ${String(rc.filas.filter((f) => f.situacionEn === 0).length)} de ${String(SECUENCIAS.length)}` +
          `  →  ${rc.interpretable ? 'interpretable' : 'EL RESULTADO NO ES INTERPRETABLE (§10)'}`,
        '',
        `  (A) quién puso la materia . el dios decretó ${String(decretadas)} cosas sueltas alrededor de la criatura,`,
        `                              el arnés sembró ${String(sembradasTotales)} y el mundo materializó ${String(materializadas)} por su cuenta`,
        `  (B) las semillas .......... ${String(PARTIDAS)} mundos distintos SÓLO porque el arnés arma una \`Physics\` por`,
        `                              partida; \`decretoDe\` no lleva la semilla en la clave de su caché`,
        `  (C) el hambre ............. tanque ${String(TANQUE)}:  ${((usado * 100) / (c.corridas.length * TICKS)).toFixed(1)}% del presupuesto · ${String(rc.cuantasCuentan)} de ${String(SECUENCIAS.length)}`,
        `                              tanque ${String(TANQUE_LLENO)}: ${((usadoK * 100) / (k.corridas.length * TICKS)).toFixed(1)}% del presupuesto · ${String(rk.cuantasCuentan)} de ${String(SECUENCIAS.length)}`,
        `                              ⇒ ${rc.cuantasCuentan === rk.cuantasCuentan ? 'la muerte temprana NO es lo que decide el cero' : 'el tiempo vivido SÍ mueve la aguja'}`,
        `  (D) las semillas de §10 .... ${String(c.reemplazos.length)} de ${String(PARTIDAS)} no tienen orilla en 13×13 chunks`,
        `                              y se reemplazaron en orden desde ${String(SEMILLA_DE_REEMPLAZO)}, como §10 manda`,
        `  (E) ¿había con qué encender? el encendible más liviano de las ${String(PARTIDAS)} partidas pesa ` +
          `${masMagro === undefined ? '—' : `${masMagro.masa.toFixed(4)} kg («${masMagro.id}»)`} contra un techo de ${String(TECHO_DE_LA_FRICCION)}`,
        `                              partidas con alguno por debajo del techo: ${String(bajoElTecho)} de ${String(PARTIDAS)}, y ninguna se descartó`,
        `                              y el mejor bocado que ofreció el mundo vale ` +
          `${mejorBocado === undefined ? 'no hubo comida' : `${mejorBocado.toFixed(4)} de stamina`} sobre ${String(comestiblesTotales)} cuerpos comestibles`,
        `  (F) de quién es cada cero . ${String(porCausa.get('LA MENTE') ?? 0)} filas son LA MENTE · ` +
          `${String(porCausa.get('LA MUERTE') ?? 0)} LA MUERTE · ${String(porCausa.get('EL MUNDO') ?? 0)} EL MUNDO (bloque 4)`,
        '',
        `  semillas jugadas .......... ${c.corridas.map((x) => String(x.semilla)).join(' ')}`,
        `  tanque publicado (§3) ..... ${String(TANQUE)} · control ${String(TANQUE_LLENO)}`,
        `  PHYSICS_VERSION ........... ${String(PHYSICS_VERSION)}`,
        `  hashes .................... ${c.corridas.map((x) => x.hash.slice(0, 6)).join(' ')}`,
        '',
        '═══════════════════════════════════════════════════════════════════════════',
        '',
      ].join('\n'),
    )
    expect(rc.filas.length).toBe(SECUENCIAS.length)
  }, 900_000)
})
