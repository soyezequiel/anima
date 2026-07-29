// ═══ EL CRITERIO DE CORTE DEL PROYECTO, MEDIDO ══════════════════════════════
//
// El documento de arquitectura le pide al Hito 5 cuatro cosas, CON EL PROVEEDOR
// APAGADO, y de las cuatro depende que haya producto aunque el modelo nunca se
// conecte:
//
//   (1) con hambre y un río a la vista, la criatura deshilacha un matorral, ata
//       una vara, va y pesca. Sin una sola llamada al modelo.
//   (2) sobrevive 20.000 ticks sola.
//   (3) p99 de tick < 5 ms con 5000 cuerpos.
//   (4) `ticksPerdidos === 0` durante toda la corrida.
//
// Este archivo mide (1), (2) y (4). El (3) YA ESTÁ MEDIDO Y ACEPTADO fallando
// por 5 a 7× en `world/tests/banco-el-camino-de-intenciones.test.ts`, y acá se
// CITA con su número en vez de volver a medirlo peor: un banco de milisegundos
// corriendo al lado de los otros paquetes mide la contención tanto como el
// código, y ese archivo ya lo dice con la corrida entera. Lo único que se hace
// acá con el (3) es verificar que la cita no envejeció.
//
// ═══ EL VEREDICTO, ARRIBA Y SIN ADORNOS ═════════════════════════════════════
//
//   (1) SE CUMPLE en lo sustancial y NO en la letra.
//
//       La cadena entera sale sola contra `stepWorld`, sin proveedor y sin que
//       nadie le diga qué hacer: de «me falta aliento» a un pescado en la mano,
//       en siete eslabones y 35 ticks. Lo que NO sale es el eslabón
//       `deshilachar` que la frase del documento nombra, y no porque la mente no
//       sepa: porque ESTA FÍSICA NO LO PIDE. Medido con cinco matorrales
//       distintos —de 0,2 a 2 kg, en hebra y en bloque—: los cinco se atan
//       derecho a la vara y ninguno necesita partirse antes. Está clavado en un
//       `it.fails` más abajo para que la diferencia no se pierda.
//
//   (2) NO SE CUMPLE, y de los dos eslabones que lo rompían **queda UNO**. La
//       criatura muere de hambre en el tick 3627 de 20.000 —el 18%— con CERO
//       bocados, PERO con un pescado en la mano desde el tick 96 y sin un solo
//       rechazo del mundo.
//
//       ─── LO QUE SE CERRÓ, CON LOS DOS NÚMEROS AL LADO ────────────────────
//
//                                    tramo anterior        hoy
//         tiros de caña                        199           2
//         rechazos `apply/sin-pozo`            196           0
//         pescados sacados del agua              1           1
//         plan(holding(tag:carnoso))    aplicar(…)   0 pasos: ya está cumplida
//         con un leño ardiendo          5 pasos, 7   4 pasos, 5 expansiones
//                                       expansiones  (se cayó el `aplicar`)
//
//       Eran dos bugs acotados y estaban los dos afuera de este paquete:
//       `cumpleCuerpo` de `@anima/plan` contestaba `false` para TODA forma
//       `sostiene` —un `case 'sostiene': return false` literal—, así que
//       `holding(tag:carnoso)` no se daba por cumplida ni con el pescado
//       agarrado; y el rol `source` de `extraccion` pedía `mass > 0` y nada más,
//       así que el cuerpo más cercano que calificaba era el de su propia mano.
//       El bucle de 199 tiros de caña adentro de su propio pescado ya no existe.
//
//       ─── Y MUERE ANTES QUE ANTES (3627 < 6194), QUE NO ES UN RETROCESO ───
//
//       Es el único número de este archivo que se puede leer al revés, así que
//       está medido aparte (DIAGNÓSTICO 6/6):
//
//         · el bucle viejo era PARADA —tirar la caña adentro de su propio
//           pescado falla sin mover una pata— y gastaba −0,0500 por tick, que es
//           `COSTO_VIVIR_POR_SEGUNDO / hz` exacto: 310 ÷ 0,05 = 6200, murió en
//           6194. Pagaba sólo por respirar;
//         · el bucle nuevo CAMINA: con el pescado en la mano y el fuego fuera de
//           alcance, la mente cae a explorar / guarecerse / juntar. Medido:
//           −0,08636 por tick, **1,73×** lo que cuesta estar viva.
//
//       El mismo tanque rinde 6200 ticks quieta y 3600 caminando. El criterio (2)
//       no se mide en ticks aguantados —se mide en si comió, y las dos corridas
//       comieron cero—: lo que se movió no es la distancia al criterio, es que el
//       eslabón que falta quedó aislado y con contraprueba. (Con el tanque lleno
//       pasa lo mismo a otra escala: 19.995 antes, 11.618 hoy, 0,0861 por tick.)
//
//       Y de paso se ve algo que nadie estaba mirando: **el pescado se le pudre
//       en la mano** mientras espera. Sale del agua con `toxicity` 0,25 y a los
//       3000 ticks marca 0,7100; pudrirse no le saca el tag `carnoso`, así que la
//       meta que lo retiene sigue cumplida.
//
//       ─── EL ESLABÓN QUE QUEDA, Y ES UNO SOLO ────────────────────────────
//
//       **No sabe pedir un fuego de la potencia justa.**
//           La mente SÍ quiere lo cocido —cambia la meta a
//           `holding(tag:carnoso,toxicity<0.0528)` en el tick 98, medido— y
//           `plan()` regresa hasta la ley 5 y se corta con
//           `missing «emitsPower<410&emitsPower>=253»` y el porqué textual
//           «ningún esquema conocido establece «emitsPower<410» (lo más cerca que
//           llega el catálogo es «emitsPower>0»)». `friccion` promete que algo va
//           a EMITIR; no promete cuánto. La ventana de cocción es acotada por los
//           dos lados y no hay quien la establezca.
//
//           Y la contraprueba, que es lo que hace que esto sea un diagnóstico y
//           no una sospecha: **con un leño ya ardiendo adentro de la ventana
//           (emitsPower 310,62) el plan CIERRA en 5 expansiones** y sale
//           `ir → poner → poner → sostener`, que es ir al fuego, apoyar la losa
//           encima, apoyar el pescado que ya tiene en la losa y levantarlo
//           cocido. O sea que el planificador sabe LIGAR un fuego que existe; lo
//           que no sabe es ENCENDER uno del que pueda prometer la potencia.
//
//       ─── Y EL VENENO, QUE ES LO QUE VOLVIÓ OBLIGATORIO EL FUEGO ──────────
//
//       Forzada a tragar, el pescado crudo le SACA 11,40 de aliento (228 ticks de
//       vida menos). Antes del ADR II-0013 daba **+8,37** y la lectura de este
//       archivo era «le sobraba comida: pescó 199 y le hacían falta 83». Esa
//       lectura tenía las dos mitades mal —ni pescó 199, ni le servían crudas— y
//       la segunda mitad la arregló el ADR: el mundo no cobraba `toxicity` y
//       comer veneno salía gratis. Hoy no hay ningún número de pescados CRUDOS
//       que alcance, y por eso el fuego dejó de ser un lujo.
//
//       ─── LO QUE PRUEBA QUE NO FALTA NADA MÁS QUE ESO ─────────────────────
//
//       Regalándole el eslabón que no sabe hacer —cien pescados YA COCIDOS en la
//       celda donde está parada, con los números que la ley 5 deja de verdad—
//       **la misma mente, sin tocar una línea, sobrevive los 20.000 ticks**:
//       murió en −1, 65 bocados, aliento final 1,4593. No es que coasteó con lo
//       que traía puesto: la cuenta cierra en 310 (inicial) + 691,46 (comidos)
//       − 1000 (vivir) = 1,46. Comió, y por eso llegó.
//
//       El número que hace que esto no sea opinable: **20.000 ticks a 20 Hz son
//       1000 segundos de mundo, `COSTO_VIVIR_POR_SEGUNDO` es 1,0 y el tanque de
//       `stamina` topa en 1000.** O sea que el criterio (2), dicho en la moneda
//       del mundo, es literalmente «comé al menos una vez». Medido: con el tanque
//       LLENO tampoco llega — se muere en el 11.618 gastando 0,0861 por tick, o
//       sea que ni siquiera le rinde el tanque: se lo va en deambular. (El tramo
//       anterior moría en el 19.995 y el de más atrás en el 18.524; los tres son
//       la misma cosa dicha con distinta plata, y en los tres comió cero.)
//
//   (4) SE CUMPLE, y medido con un reloj de pared de verdad, que es la única
//       forma de que el contador pueda moverse. Sin reloj, `porTiempo` es cero
//       POR CONSTRUCCIÓN (`bucle.ts`: «sin reloj de pared no hay ninguna ventana
//       que vencer») y un `expect(0)` no mediría nada. Con reloj: entre 0,18 y
//       0,20 ms de trabajo por tick contra una ventana de 50 ms, y CERO ticks
//       perdidos en los 20.000, ni por tiempo ni por falla. Sobra un factor de
//       entre 250 y 270. (Los milisegundos se mueven entre corridas porque son
//       reloj de máquina; los que gobiernan son los que imprime la corrida de
//       hoy, no los de este comentario. Lo que no se mueve es el cero.)
//
//       De ese total, el mundo se lleva ~0,058 ms y la mente ~0,24 encima
//       —medido aparte, sobre 4000 ticks con una criatura—. El tramo anterior
//       medía 0,034 y 0,041: la mente pasó de costar 1,2 mundos a costar 4, y
//       está medido POR QUÉ y no es la reparación. Un `plan()` que CIERRA cuesta
//       0,003 ms y uno que se CORTA cuesta 0,25 —**entre 68× y 80× según la
//       corrida**, porque rendirse obliga a recorrer la búsqueda entera—, y lo
//       que la criatura pide todo el tiempo pasó de cerrar a cortarse. Cuando se
//       cierre el eslabón B el número vuelve solo. Aun así entra 250 veces en la
//       ventana de 50 ms, y lo que hace inalcanzable el (3) sigue sin ser la
//       mente: son 5000 cuerpos de física, que es lo que aquel banco ya
//       diagnosticó.
//
// ═══ CÓMO SE MIDE ACÁ ═══════════════════════════════════════════════════════
//
// Los números se IMPRIMEN siempre y se AFIRMAN siempre, con DOS excepciones que
// siguen el patrón ya decidido del proyecto —`ANIMA_BANCO=1`—: el que depende del
// reloj del sistema (el de pared del criterio 4), porque un test de rendimiento
// adentro de la suite normal es flaky y un test flaky enseña a ignorar el rojo; y
// el más CARO de todos (los 20.000 ticks con la despensa de cien cuerpos, **30 s
// medidos hoy** contra los 4,1 s del tramo anterior), que se imprime siempre y se
// afirma sólo midiendo en serio. Ése tiene al lado una corrida corta —2000 ticks—
// que SÍ afirma siempre, así que la guarda de regresión existe igual sin pagar los
// treinta segundos en cada `pnpm ii:test`.
//
// El 30 s tiene la misma causa que el párrafo de arriba, y está medido aparte: en
// la despensa el pedido de la criatura TAMBIÉN se corta —los cocidos que le
// quedan se pudren por encima del `toxicity<0,0528` que pide— y cada `plan()` que
// se corta con cien cuerpos a la vista cuesta 0,6929 ms. La mente se lleva ahí
// 0,795 ms por tick sobre 0,601 del mundo, o sea del orden de un plan cortado por
// tick. No es que la reparación haya puesto lenta la escalera: es que pedir algo
// que no se puede conseguir cuesta más que conseguirlo.
//
// Y lo que no se cumple NO se ablanda: va en `it.fails` con la salida medida al
// lado, que es el idioma con el que este repositorio ya dejó abiertos el techo
// del tick y los diez huecos de `admit()`.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { HZ_DE_REFERENCIA, qualityOf, specOf } from '@anima/physics';
import type { QualityId } from '@anima/physics';
import { COSTO_VIVIR_POR_SEGUNDO } from '@anima/world';
import type { WorldState } from '@anima/world';
import { Contexto, Partida } from '@anima/perceive';
import { EXPANSIONES_POR_TICK, interpretar, plan } from '@anima/plan';
import type { GoalNode, Step } from '@anima/plan';
import { comer } from '@anima/skills/innatas';

import { Creencias } from '../src/creencias.js';
import { Mente, vivir } from '../src/mente.js';
import { necesidades } from '../src/necesidades.js';
import { metaComestibleDe, opportunities } from '../src/oportunidades.js';
import type { VistaDeLaMente } from '../src/tipos.js';
import { actor, criatura, cuerpo, enElPiso, laOrilla, mundo } from './mundo.js';

/** El único número que se afirma contra el reloj del sistema. Ver el encabezado. */
const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1';

/** Los ticks del criterio (2). No es un largo elegido acá: es el del documento. */
const CRITERIO_TICKS = 20_000;

// ─── La escena del documento ─────────────────────────────────────────────────

/**
 * «Con hambre y un río a la vista», sobre la orilla DE VERDAD de la semilla.
 *
 * El río no se inventa: `laOrilla()` barre los chunks del dios hasta encontrar
 * uno con pozo y una celda seca pegada, y el banco de peces lo materializa
 * `stepWorld` desde el decreto. Un cuerpo puesto a mano con el mismo nombre no
 * es un pozo para `extraccion`.
 *
 * Los dos números de la escena y qué compran, medidos:
 *
 *   · **stamina 310 de 1000** — con el tanque lleno `energia` vale 0,0025 y D3
 *     no elige comida. Con 310 vale 0,48, que es lo que hace que la meta gane;
 *   · **el matorral pesa 0,2 kg** — un `hebra` de liana de 1 kg ya es aparejo
 *     solo (`reach = 6 × masa`), y entonces el plan que sale es «andá y pescá
 *     con el matorral», de tres pasos. Con 0,2 kg el alcance cae a 1,2 y la
 *     única forma de llegar a `reach >= 2` es atarlo a la vara, que es la cadena
 *     que el criterio pide.
 */
function laEscenaDelDocumento(
  stamina = 310,
  masa = 0.2,
  forma: 'hebra' | 'bloque' = 'hebra',
): WorldState {
  const o = laOrilla();
  const p = o.parada;
  return mundo({
    dios: o.dios,
    bodies: [
      enElPiso(criatura('ana', stamina), p),
      enElPiso(cuerpo('vara', 'madera', 1, {}, 'vara'), { x: p.x + 3, y: p.y }),
      enElPiso(cuerpo('matorral', 'liana', masa, {}, forma), { x: p.x - 2, y: p.y + 1 }),
    ],
    actors: [actor('ana', { capacity: 3 })],
  });
}

/** Lo que la ley 5 le deja a una pieza de 2 kg sobre la parrilla. Medido, no elegido. */
const COMO_LO_DEJA_EL_FUEGO = { digestibility: 0.85, toxicity: 0.0345 };

/**
 * LA MISMA ESCENA CON EL ESLABÓN QUE FALTA REGALADO: cien pescados ya cocidos.
 *
 * No es una escena distinta: es `laEscenaDelDocumento()` con una despensa en la
 * celda donde la criatura está parada. Todo lo demás —el río, la vara, el
 * matorral, el hambre, la mente sin `drive`— es idéntico, así que lo único que
 * cambia entre esta corrida y la del criterio es si alguien puso comida
 * comestible al alcance. Eso la convierte en la contraprueba del diagnóstico:
 * dice si lo que falta es EL FUEGO o si además falta otra cosa.
 *
 * Los dos números del cocido no se inventan: `digestibility 0,85` y
 * `toxicity 0,0345` son lo que `world/tests/el-veneno-se-cobra.test.ts` midió
 * corriendo `stepWorld` sobre una pieza de 2 kg en una parrilla sobre un leño
 * encendido (0,38 → 0,8526 y 0,25 → 0,0345). Van en `Body.state` porque es
 * exactamente donde la ley 5 los escribe: cocinar no cambia la sustancia, cambia
 * el cuerpo.
 *
 * CIEN y no diez: comió 65. Un montón más chico se lo termina antes de llenar el
 * tanque y la corrida mediría la despensa en vez de medir la mente.
 */
function laDespensa(cuantos = 100, stamina = 310): WorldState {
  const o = laOrilla();
  const p = o.parada;
  const cocidos: ReturnType<typeof enElPiso>[] = [];
  for (let i = 0; i < cuantos; i++) {
    cocidos.push(
      enElPiso(cuerpo(`cocido${String(i)}`, 'pescado', 2, COMO_LO_DEJA_EL_FUEGO, 'bloque'), p),
    );
  }
  return mundo({
    dios: o.dios,
    bodies: [
      enElPiso(criatura('ana', stamina), p),
      enElPiso(cuerpo('vara', 'madera', 1, {}, 'vara'), { x: p.x + 3, y: p.y }),
      enElPiso(cuerpo('matorral', 'liana', 0.2, {}, 'hebra'), { x: p.x - 2, y: p.y + 1 }),
      ...cocidos,
    ],
    actors: [actor('ana', { capacity: 3 })],
  });
}

/**
 * LA MISMA ESCENA CON UN FUEGO YA PRENDIDO Y UNA LOSA. La contraprueba del 5/5.
 *
 * Los tres números y qué compran, y ninguno es de gusto:
 *
 *   · **1,2 kg de madera** — `emitsPower` es `step(T ≥ ignitionPoint) · fuelEnergy
 *     · mass · 16,7`, o sea `18 × 1,2 × 16,7 = 360,72` con la madera de la
 *     semilla. La ventana que la ley 5 le pide al rol `fuego` es `[253 ; 410)`,
 *     así que arranca en el medio y AGUANTA ahí mientras se consume: a los 200
 *     ticks —que es cuando la contraprueba le pide el plan— midió 310,62. Con 1
 *     kg empieza en 300,60 y a los mismos 200 ticks ya cayó a 250,50, o sea que
 *     se sale de la ventana por abajo y la contraprueba mediría el reloj del
 *     fuego en vez de medir el planificador. Los dos números están medidos;
 *   · **`temperature: 500`** — arriba de los 300 °C de ignición de la madera, que
 *     es lo que hace que el `step` valga 1. No es «prender el fuego»: es ponerlo
 *     ya prendido, que es exactamente lo que la criatura no sabe hacer;
 *   · **piedra para la losa** — `ignitionPoint` de la piedra es `NO_ARDE`, y lo
 *     que la fila le pide a la parrilla es no prenderse estando en contacto.
 */
function conFuegoYLosa(): WorldState {
  const o = laOrilla();
  const p = o.parada;
  return mundo({
    dios: o.dios,
    bodies: [
      enElPiso(criatura('ana', 310), p),
      enElPiso(cuerpo('vara', 'madera', 1, {}, 'vara'), { x: p.x + 3, y: p.y }),
      enElPiso(cuerpo('matorral', 'liana', 0.2, {}, 'hebra'), { x: p.x - 2, y: p.y + 1 }),
      enElPiso(cuerpo('fogata', 'madera', 1.2, { temperature: 500 }, 'bloque'), p),
      enElPiso(cuerpo('losa', 'piedra', 0.5, {}, 'bloque'), p),
    ],
    actors: [actor('ana', { capacity: 3 })],
  });
}

function aliento(p: Partida, quien: string): number {
  const b = p.state.bodies.get(`${quien}-cuerpo`);
  return b === undefined ? 0 : qualityOf(b.body, 'stamina', p.state.phys);
}

/** La vista de la mente, armada como la arma la mente: con el `Ctx` de producción. */
function vistaDe(p: Partida, quien: string): VistaDeLaMente {
  return new Contexto(p.proyeccion, { actor: quien, rng: p.dado.tirar, lugares: p.lugares }).ctx;
}

// ─── La corrida ──────────────────────────────────────────────────────────────

interface Corrida {
  /** Ticks que avanzó EL MUNDO. Llega a `n` aunque la criatura se muera antes. */
  readonly ticks: number;
  readonly ticksPerdidos: number;
  readonly porTiempo: number;
  readonly porFalla: number;
  /** El tick en que la criatura se fue de `state.actors`, o `-1` si llegó viva. */
  readonly murioEn: number;
  readonly alientoFinal: number;
  /** Qué despegó y en qué tick. Una línea por vuelo, no por tick. */
  readonly volados: readonly string[];
  /** Lo mismo sin el tick adelante, para comparar contra la cadena esperada. */
  readonly nombres: readonly string[];
  /** En qué tick despegó cada vuelo, en el mismo orden que `nombres`. */
  readonly cuando: readonly number[];
  /** DESPEGUES por nombre. Ojo: no son aterrizajes. Ver `aterrizados`. */
  readonly cuenta: ReadonlyMap<string, number>;
  /**
   * ATERRIZAJES con `ok: true`, por nombre. **Ésta es la que dice qué pasó.**
   *
   * Existe porque `cuenta` mintió durante tres documentos: la línea
   * `r.cuenta.get('aplicar(extraccion)')` se imprimía como «pescas 199» y son
   * despegues. Medido: 199 despegues, 1 pescado. Un vuelo que sale y vuelve con
   * `ok:false` gastó los mismos ticks y no consiguió nada, y la diferencia entre
   * las dos cuentas es exactamente el diagnóstico del criterio (2).
   */
  readonly aterrizados: ReadonlyMap<string, number>;
  /** Los aterrizajes con `ok: false`, por «nombre: porqué». */
  readonly fallados: ReadonlyMap<string, number>;
  /**
   * EL TICK EN QUE UN PESCADO APARECE EN LA MANO, o `-1` si nunca apareció.
   *
   * Es la tercera cuenta de este arnés, y existe por la misma razón que
   * `aterrizados`: acá ya se contaron despegues creyendo que eran pescas. Pero
   * `aterrizados` TAMPOCO alcanza, y este tramo lo midió: el vuelo que de verdad
   * sacó el pescado aterriza con `ok:false` —«ya tengo «holding(tag:carnoso)»:
   * corto lo que estaba haciendo»—, porque la mente lo interrumpe en el mismo
   * tick en que la meta se cumple. Contar ESE vuelo como fracaso es la misma
   * clase de error que contar despegues como pescas, sólo que con el signo
   * cambiado. Lo único que no se puede leer mal es el estado del mundo: hay un
   * cuerpo de pescado en la mano, o no lo hay.
   */
  readonly pescoEn: number;
  readonly aliento: readonly string[];
  /** La misma curva de aliento en números, para poder sacarle la pendiente. */
  readonly muestras: readonly number[];
  readonly ms: number;
  readonly partida: Partida;
  readonly mente: Mente;
  /**
   * LOS ESTADOS ILEGALES QUE EL ARNÉS VIO EN TODA LA CORRIDA, ya escritos.
   *
   * Es cero por primera vez porque por primera vez se está mirando: hasta este
   * tramo, `revisarEstado` no lo llamaba una sola línea de `ii/` fuera de su
   * propio test. Ver `PartidaOptions.vigilar`.
   */
  readonly violaciones: readonly string[];
}

/**
 * `n` ticks de mundo con UNA mente puesta, por el bucle de producción.
 *
 * Se llama a `vivir(p, mentes, 1)` y no a `vivir(p, mentes, n)` de una: es
 * exactamente el mismo bucle —la única diferencia es dónde está el `for`— y
 * permite anotar tick a tick sin escribir una segunda copia del bucle que
 * después habría que creerle. El mundo sigue avanzando después de que la
 * criatura se muere, porque el criterio (4) habla de LA CORRIDA y no de la
 * criatura: 20.000 ticks son 20.000 ventanas, las viva alguien o no.
 */
function correr(
  w: WorldState,
  quien: string,
  n: number,
  o: { reloj?: boolean; cada?: number } = {},
): Corrida {
  // ─── `vigilar: true`, Y NO ES DECORACIÓN ──────────────────────────────────
  //
  // `grep exigirInvariantes ii/` devolvía dos archivos: el que lo define y su
  // propio test. NINGUNA corrida real lo llamaba, y esta corrida de 20.000 ticks
  // es la corrida real más larga que hay. El adversario del veneno lo midió con un
  // caso que atravesaba esta misma función sin ponerse rojo: una criatura que se
  // comía a sí misma quedaba de ACTOR SIN CUERPO, y como la muerte se detecta acá
  // abajo con `p.state.actors.has(quien)`, ese fantasma contaba como VIVO — o sea
  // que había una forma de «sobrevivir 20.000 ticks» sin estar viva. El agujero
  // está cerrado en el mundo (`es-uno-mismo`); el arnés queda encendido para que
  // el próximo no atraviese la medición del criterio en silencio.
  //
  // Son las cinco preguntas que un estado contesta solo. La sexta —conservación—
  // no se puede encender con dios todavía: ver `PartidaOptions.vigilar`.
  const p =
    o.reloj === true
      ? new Partida(w, { vigilar: true, reloj: () => Number(process.hrtime.bigint()) / 1e6 })
      : new Partida(w, { vigilar: true });
  const m = new Mente({ actor: quien, memoria: new Creencias() });
  const mentes = new Map([[quien, m]]);
  const volados: string[] = [];
  const nombres: string[] = [];
  const cuando: number[] = [];
  const cuenta = new Map<string, number>();
  const aterrizados = new Map<string, number>();
  const fallados = new Map<string, number>();
  const curva: string[] = [];
  const muestras: number[] = [];
  const cada = o.cada ?? 2000;
  let murioEn = -1;
  let ultimoAliento = 0;
  let pescoEn = -1;
  // ─── CÓMO SE CUENTA UN ATERRIZAJE, Y POR QUÉ ASÍ ──────────────────────────
  //
  // `Partida` no publica un contador de vuelos terminados, pero sí publica EL
  // VUELO: `p.vuelo(quien)` devuelve el objeto que está volando, y cuando la
  // criatura arranca otro es OTRO objeto. Entonces alcanza con guardar la
  // referencia del tick anterior: si cambió, el de antes aterrizó, y su
  // `outcome` ya está escrito. Es la única forma de leer esto sin duplicar el
  // bucle de producción ni tocar `src/`.
  let vueloAnterior: unknown;
  let nombreEnVuelo = '';

  const t0 = process.hrtime.bigint();
  for (let t = 0; t < n; t++) {
    const antes = m.despegues;
    vivir(p, mentes, 1);
    const ahora: unknown = p.vuelo(quien);
    if (vueloAnterior !== undefined && ahora !== vueloAnterior) {
      const o = (vueloAnterior as { outcome?: { ok: boolean; why?: string } }).outcome;
      if (o?.ok === true) aterrizados.set(nombreEnVuelo, (aterrizados.get(nombreEnVuelo) ?? 0) + 1);
      else {
        const k = `${nombreEnVuelo}: ${o?.why ?? 'sin respuesta'}`;
        fallados.set(k, (fallados.get(k) ?? 0) + 1);
      }
    }
    vueloAnterior = ahora;
    if (m.despegues > antes) {
      const nombre = m.ultimoDespegue ?? '?';
      volados.push(`  ${String(t).padStart(5)}  ${nombre}`);
      nombres.push(nombre);
      cuando.push(t);
      cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + 1);
      nombreEnVuelo = nombre;
    }
    if (murioEn < 0) {
      if (p.state.actors.has(quien)) ultimoAliento = aliento(p, quien);
      else murioEn = t;
    }
    // El estado del mundo, que es lo único que no se puede leer mal: si hay un
    // cuerpo de pescado en la mano, pescó. Se busca sólo hasta encontrarlo.
    if (pescoEn < 0 && enLaMano(p, quien).some((s) => s.includes('pescado'))) pescoEn = t;
    if (t % cada === 0) {
      curva.push(`${String(t)}:${aliento(p, quien).toFixed(1)}`);
      muestras.push(aliento(p, quien));
    }
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const i = p.informe;

  return {
    ticks: i.ticks,
    ticksPerdidos: i.ticksPerdidos,
    porTiempo: i.porTiempo,
    porFalla: i.porFalla,
    murioEn,
    alientoFinal: murioEn < 0 ? aliento(p, quien) : ultimoAliento,
    volados,
    nombres,
    cuando,
    cuenta,
    aterrizados,
    fallados,
    pescoEn,
    aliento: curva,
    muestras,
    ms,
    partida: p,
    mente: m,
    violaciones: p.violaciones,
  };
}

/**
 * LO QUE LE CONTESTA EL MUNDO, contado por motivo.
 *
 * Es el MISMO bucle que `vivir()` —pensar todas las mentes, después un tick—
 * escrito acá con `p.tick()` en lugar de `p.avanzar(1)` por una sola razón:
 * `tick()` devuelve los `SimEvent` y `avanzar()` devuelve el informe del reloj
 * de pared. Se usa SÓLO para diagnosticar, nunca para medir un criterio: lo que
 * se pierde al cambiar de puerta es la contabilidad de ticks perdidos, que es
 * justamente lo que el criterio (4) mide por el otro lado.
 */
function rechazosDelMundo(
  w: WorldState,
  quien: string,
  n: number,
): { porQue: Map<string, number>; pozo: number } {
  const p = new Partida(w);
  const m = new Mente({ actor: quien, memoria: new Creencias() });
  const porQue = new Map<string, number>();
  for (let t = 0; t < n; t++) {
    if (p.state.actors.has(quien)) m.pensar(p);
    for (const e of p.tick()) {
      if (e.k === 'rechazada') {
        const clave = `${e.que}/${e.por}`;
        porQue.set(clave, (porQue.get(clave) ?? 0) + 1);
      }
    }
  }
  // EL pozo al que le pesca, por id y no «el primero que aparezca»: la orilla de
  // la semilla tiene tres bancos a la vista y leer otro contestaría otra cosa.
  const banco = p.state.bodies.get(laOrilla().banco);
  return { porQue, pozo: banco === undefined ? -1 : qualityOf(banco.body, 'mass', p.state.phys) };
}

/** Cuántos cuerpos NUEVOS nació la corrida. Un pescado sacado del pozo es uno. */
function nacidos(w: WorldState, quien: string, n: number): { total: number; peces: string[] } {
  const p = new Partida(w);
  const m = new Mente({ actor: quien, memoria: new Creencias() });
  let total = 0;
  for (let t = 0; t < n; t++) {
    if (p.state.actors.has(quien)) m.pensar(p);
    for (const e of p.tick()) if (e.k === 'nacio') total += 1;
  }
  const peces = [...p.state.bodies.values()]
    .filter(
      (b) => !b.body.id.startsWith('pozo:') && b.body.parts.some((x) => x.substance === 'pescado'),
    )
    .map((b) => `${b.body.id} (${qualityOf(b.body, 'mass', p.state.phys).toFixed(3)} kg)`);
  return { total, peces };
}

/** Lo que la criatura tiene en la mano, por sustancia. */
function enLaMano(p: Partida, quien: string): string[] {
  const a = p.state.actors.get(quien);
  const out: string[] = [];
  for (const id of a?.holding ?? []) {
    const b = p.state.bodies.get(id);
    if (b !== undefined) out.push(b.body.parts.map((x) => x.substance).join('+'));
  }
  return out;
}

function calorias(p: Partida, quien: string): number {
  const a = p.state.actors.get(quien);
  let total = 0;
  for (const id of a?.holding ?? []) {
    const b = p.state.bodies.get(id);
    if (b !== undefined) total += qualityOf(b.body, 'calories', p.state.phys);
  }
  return total;
}

const dos = (x: number): string => x.toFixed(2);

// ─── Lo medido, para el cuadro final ─────────────────────────────────────────

/**
 * Lo que cada bloque midió, para poder imprimir el cuadro de los cuatro criterios
 * al final con NÚMEROS y no con veredictos. Se llena a medida que corren los
 * tests —vitest corre un archivo en orden— y lo que falte sale como `—`.
 */
const MEDIDO = new Map<string, string>();

// ═══ (0) EL PROVEEDOR ESTÁ APAGADO, Y NO ES UNA PROMESA ═════════════════════

const PAQUETES = fileURLToPath(new URL('../../', import.meta.url));

describe('(0) el proveedor apagado: no hay con qué llamar a un modelo', () => {
  it('los siete paquetes de `ii/` no dependen de NADA que no sea `ii/`', () => {
    const nombres = readdirSync(PAQUETES, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    const ajenas: string[] = [];
    const filas: string[] = [];
    for (const n of nombres) {
      const j = JSON.parse(readFileSync(`${PAQUETES}${n}/package.json`, 'utf8')) as {
        dependencies?: Record<string, string>;
      };
      const deps = Object.entries(j.dependencies ?? {});
      for (const [d, v] of deps) if (v !== 'workspace:*') ajenas.push(`${n} → ${d}@${v}`);
      filas.push(
        `  ${n.padEnd(9)} ${deps.length === 0 ? '(ninguna)' : deps.map(([d]) => d).join(' ')}`,
      );
    }
    console.log(`\n─── LAS DEPENDENCIAS DE RUNTIME DE \`ii/\` ───\n${filas.join('\n')}\n`);
    // Cero dependencias de runtime fuera del workspace. Un cliente de un modelo
    // no es algo que se escriba a mano en 3000 líneas: viene en un paquete, y no
    // hay ninguno. `typescript` y `vitest` son `devDependencies` y no entran acá.
    expect(ajenas).toEqual([]);
    expect(nombres).toContain('mind');
  });

  it('y en `src/` no hay una sola llamada a la red, con los comentarios sacados', () => {
    // Con los comentarios sacados porque los hay, y hablan del tema: el sandbox de
    // `@anima/skills` tiene a `fetch`, `XMLHttpRequest` y `WebSocket` en su lista
    // de PROHIBIDOS —«una habilidad no habla con afuera; lo que sabe lo sabe por
    // `ctx`»— y un grep crudo contaría esa prohibición como una llamada.
    // `import(` está en la lista porque un import dinámico puede traer lo que sea
    // y no aparecería en `package.json`. El ÚNICO del repositorio es
    // `export type ApiTS = typeof import('typescript')` en `skills/combustible.ts`
    // —un import de TIPO, que TypeScript borra y que no deja un byte en el
    // bundle— y por eso se lo saca antes de buscar, con su forma exacta y no
    // apagando la regla entera.
    const PROHIBIDO: readonly (readonly [string, RegExp])[] = [
      ['fetch(', /\bfetch\s*\(/],
      ['new XMLHttpRequest', /new\s+XMLHttpRequest/],
      ['new WebSocket', /new\s+WebSocket/],
      ['node:http', /['"]node:https?['"]/],
      ['node:net', /['"]node:net['"]/],
      ['import( dinámico', /\bimport\s*\(/],
    ];
    const hallazgos: string[] = [];
    let archivos = 0;
    for (const paquete of readdirSync(PAQUETES, { withFileTypes: true }).filter((d) =>
      d.isDirectory(),
    )) {
      for (const f of fuentesDe(`${PAQUETES}${paquete.name}/src`)) {
        archivos += 1;
        const limpio = sinComentarios(readFileSync(f, 'utf8')).replace(
          /typeof\s+import\s*\(/g,
          ' ',
        );
        for (const [nombre, re] of PROHIBIDO) {
          if (re.test(limpio))
            hallazgos.push(`${paquete.name}/${f.slice(f.lastIndexOf('/') + 1)}: ${nombre}`);
        }
      }
    }
    console.log(
      `\n  ${String(archivos)} archivos de \`src/\` barridos, ${String(hallazgos.length)} llamadas a la red\n`,
    );
    expect(hallazgos).toEqual([]);
    expect(archivos).toBeGreaterThan(30);
  });

  it('y la corrida canónica no toca `fetch` ni una vez, contado sobre el global', () => {
    // El barrido de arriba dice que no hay código escrito que llame; esto dice que
    // tampoco pasó. Son dos cosas distintas: un `eval`, un `Function(...)` o una
    // dependencia transitiva no aparecerían en el grep y sí acá.
    const real = globalThis.fetch;
    let llamadas = 0;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: (...a: unknown[]): never => {
        llamadas += 1;
        throw new Error(`la mente llamó a fetch: ${JSON.stringify(a[0])}`);
      },
    });
    try {
      const r = correr(laEscenaDelDocumento(), 'ana', 400);
      expect(r.murioEn).toBe(-1);
      expect(enLaMano(r.partida, 'ana')).toContain('pescado');
    } finally {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: real,
      });
    }
    expect(llamadas).toBe(0);
    MEDIDO.set('proveedor', '0 llamadas a la red · 0 dependencias de runtime fuera de `ii/`');
  });
});

/** Los `.ts` de un `src/`, recursivo. Un archivo nuevo entra solo. */
function fuentesDe(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...fuentesDe(p));
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/**
 * El fuente sin comentarios de línea ni de bloque.
 *
 * Es deliberadamente ingenuo —no entiende de cadenas que contengan `//`— y es
 * suficiente para lo que se le pide: el barrido busca formas que sólo aparecen
 * como código (`fetch(`, `new WebSocket`), y una cadena que contuviera eso sería
 * un hallazgo que igual habría que mirar.
 */
function sinComentarios(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

// ═══ (1) LA CADENA DE LA CAÑA, Y QUE LA MENTE LLEGA SOLA ════════════════════

describe('(1) con hambre y un río: la mente llega sola a la caña y al pescado', () => {
  it('nadie le dijo qué hacer: la meta sale de necesidades × creencia / costo', () => {
    // La `Mente` se construye con DOS cosas: quién es y su memoria vacía. No hay
    // `drive` —el campo por donde el chat le diría qué hacer, y que en el Hito 6
    // va a existir— y no hay un objetivo escrito en ningún lado de la escena.
    const p = new Partida(laEscenaDelDocumento());
    const v = vistaDe(p, 'ana');
    const memoria = new Creencias();

    // 1. QUÉ DUELE. Sale del cuerpo, no de una tabla de guion.
    const n = necesidades(v);
    expect(n.energia).toBeGreaterThan(n.calor);
    expect(n.energia).toBeGreaterThan(n.refugio);

    // 2. QUÉ PODRÍA QUERER. Sale de la necesidad, de lo que cree que rinde cada
    //    contexto y de cuánto aliento cuesta llegar. La lista la arma
    //    `opportunities()` sola, mirando el mundo.
    const ops = opportunities(v, memoria, n);
    const mejor = ops[0];
    expect(mejor).toBeDefined();
    if (mejor === undefined) throw new Error('imposible');
    expect(mejor.meta).toBe('holding(tag:carnoso)');
    // Y la creencia con la que gana es INSTINTO, no experiencia y no un modelo:
    // `n = 0` quiere decir que no hay una sola observación propia detrás.
    expect(mejor.porque).toContain('n=0');

    // 3. CÓMO SE HACE. Es `plan()` de `@anima/plan` sobre la misma vista, y da la
    //    cadena entera. Se lo pide acá DIRECTO para que se vea que la mente no
    //    guarda ninguna receta: lo que sabe es regresar la meta contra el mundo.
    const pred = interpretar(mejor.meta);
    expect(pred).toBeDefined();
    if (pred === undefined) throw new Error('imposible');
    const g: GoalNode = { id: 'meta', goal: pred, after: [], porque: 'el test' };
    const r = plan(g, v, EXPANSIONES_POR_TICK);
    expect(r.k).toBe('plan');
    if (r.k !== 'plan') throw new Error('imposible');

    // 4. Y ES EXACTAMENTE LO QUE LA MENTE DECIDE. La escalera no agrega ni saca.
    const m = new Mente({ actor: 'ana', memoria: new Creencias() });
    const d = m.pensar(p);
    expect(d.k).toBe('plan');
    if (d.k !== 'plan') throw new Error('imposible');
    expect(d.por).toBe('D3');
    expect(d.meta).toBe(mejor.meta);
    expect(d.pasos.map(resumir)).toEqual(r.steps.map(resumir));

    console.log(
      `\n─── DE DÓNDE SALE LA META, CAPA POR CAPA ───\n` +
        `  necesidades:  energía ${dos(n.energia)} · calor ${dos(n.calor)} · refugio ${dos(n.refugio)}\n` +
        `  oportunidades (${String(ops.length)}):\n` +
        ops
          .map((o) => `    ${o.meta.padEnd(22)} valor ${dos(o.valor)}  ${o.id}\n      ${o.porque}`)
          .join('\n') +
        `\n  plan():       ${r.steps.map(resumir).join(' → ')}\n` +
        `  la mente:     D${d.por.slice(1)} · ${d.porque}\n`,
    );
  });

  it('CRITERIO DE CORTE: la cadena entera contra `stepWorld`, y el pescado en la mano', () => {
    const r = correr(laEscenaDelDocumento(), 'ana', 400);

    expect(r.nombres.slice(0, 7)).toEqual([
      'ir(vara)',
      'sostener(vara)',
      'ir(matorral)',
      'sostener(matorral)',
      'unir(matorral+vara)',
      'ir(pozo:-6:-6)',
      'aplicar(extraccion)',
    ]);
    // Y el pescado ESTÁ, sacado del agua por `extraccion` contra un banco que
    // decretó el dios. De «me falta aliento» a «tengo algo carnoso», sin proveedor.
    expect(enLaMano(r.partida, 'ana')).toContain('pescado');
    expect(calorias(r.partida, 'ana')).toBeGreaterThan(0);
    expect(r.ticksPerdidos).toBe(0);
    expect(r.murioEn).toBe(-1);

    // LOS DOS TICKS, Y NO UNO. Acá decía «primera pesca en el tick 35» y 35 es
    // cuando TIRA LA CAÑA: es el mismo desliz de despegue-por-aterrizaje que ya se
    // pagó una vez en este archivo. El pescado entra a la mano en el 96, sesenta y
    // un ticks después, y ése es el número que dice que la cadena cerró.
    const tiraLaCaña = r.cuando[r.nombres.indexOf('aplicar(extraccion)')];
    expect(r.pescoEn).toBeGreaterThan(0);
    MEDIDO.set(
      'cadena',
      `7 eslabones: tira la caña en el tick ${String(tiraLaCaña ?? -1)} y el pescado entra a la mano ` +
        `en el ${String(r.pescoEn)}, ${dos(calorias(r.partida, 'ana'))} calorías`,
    );
    console.log(
      `\n─── LA CADENA DE LA CAÑA, CONTRA EL MUNDO DE VERDAD ───\n${r.volados.slice(0, 8).join('\n')}\n` +
        `  tira la caña en el tick ${String(tiraLaCaña ?? -1)} · el pescado entra a la mano en el ${String(r.pescoEn)}\n` +
        `  en la mano: ${enLaMano(r.partida, 'ana').join(' · ')} (${dos(calorias(r.partida, 'ana'))} calorías)\n`,
    );
  });

  it.fails('LA LETRA DEL DOCUMENTO: «deshilacha un matorral» — esta física no lo pide', () => {
    // POR QUÉ FALLA, Y POR QUÉ NO SE BORRA LA FRASE: el documento describe cuatro
    // eslabones —deshilachar, atar, ir, pescar— y la mente hace tres. El que falta
    // no falta por ignorancia: `deshilachar` está entre las quince, la mente la
    // sabe traducir y correr (medido en `la-mente.test.ts`, tabla de las doce), y
    // el planificador tiene tres esquemas que la usan. Lo que pasa es que NINGUNA
    // de las cinco escenas razonables la necesita.
    //
    // MEDIDO, con cinco matorrales de liana distintos sobre la misma orilla:
    //
    //   0,2 kg hebra   ir → sostener → ir → sostener → unir → ir → aplicar
    //   0,2 kg bloque  ir → sostener → ir → sostener → unir → ir → aplicar
    //   1 kg bloque    ir → sostener → ir → sostener → unir → ir → aplicar
    //   2 kg bloque    ir → sostener → ir → sostener → unir → ir → aplicar
    //   2 kg hebra     ir → ir → aplicar          (¡ni siquiera necesita la vara!)
    //
    // La razón es de la física y está escrita en `esquemas.ts`: lo que `union`
    // necesita del atador es `flexibility >= 0,8`, y la flexibilidad es INTENSIVA
    // —la liana la tiene por ser liana, pese lo que pese—. `deshilachar` no
    // fabrica flexibilidad: convierte en hebra algo que YA era flexible. O sea que
    // el eslabón del documento sólo haría falta si atar exigiera la FORMA `hebra`,
    // y no la exige: exige una punta libre, que sale de que el atador pese menos
    // que aquello a lo que se ata (`freeStrandEnds`, `body.ts`).
    //
    // QUÉ HABRÍA QUE CAMBIAR PARA QUE LA FRASE SEA CIERTA: que el matorral pese
    // MÁS que la vara y que `union` lo rechace por eso, o que el rol `binder` pida
    // forma de hebra. Las dos son decisiones de la física o del catálogo, no de la
    // mente. Queda acá, en rojo esperado, para que nadie lea el (1) verde de
    // arriba y crea que la frase del documento se cumplió palabra por palabra.
    const filas: string[] = [];
    let alguna = false;
    for (const [masa, forma] of [
      [0.2, 'hebra'],
      [0.2, 'bloque'],
      [1, 'bloque'],
      [2, 'bloque'],
      [2, 'hebra'],
    ] as const) {
      const p = new Partida(laEscenaDelDocumento(310, masa, forma));
      const m = new Mente({ actor: 'ana', memoria: new Creencias() });
      const d = m.pensar(p);
      const pasos = d.k === 'plan' ? d.pasos.map((s) => s.k) : [`${d.k}/${d.por}`];
      if (pasos.includes('deshilachar')) alguna = true;
      filas.push(`  ${String(masa).padStart(3)} kg ${forma.padEnd(7)} ${pasos.join(' → ')}`);
    }
    console.log(`\n─── ¿ALGUNA ESCENA PIDE \`deshilachar\`? ───\n${filas.join('\n')}\n`);
    MEDIDO.set('deshilachar', 'ninguna de las 5 escenas lo pide: la mente ata derecho');
    expect(alguna, 'ninguna escena produjo un paso `deshilachar`').toBe(true);
  });
});

/** Cómo se lee un paso. Sólo lo que hace falta para comparar dos planes. */
function resumir(s: Step): string {
  switch (s.k) {
    case 'ir':
      return `ir(${corto(s.a)})`;
    case 'sostener':
      return `sostener(${corto(s.que)})`;
    case 'unir':
      return `unir(${corto(s.binder)}+${corto(s.a)})`;
    case 'deshilachar':
      return `deshilachar(${corto(s.fuente)})`;
    case 'aplicar':
      return `aplicar(${s.proceso})`;
    default:
      return s.k;
  }
}

function corto(r: { readonly k: string; readonly id?: string }): string {
  return r.k === 'id' ? (r.id ?? '?') : r.k;
}

// ═══ (2) VEINTE MIL TICKS ═══════════════════════════════════════════════════

describe('(2) sobrevive 20.000 ticks sola', () => {
  it('la aritmética del criterio: 20.000 ticks SON exactamente un tanque de aliento', () => {
    // No es una coincidencia y conviene decirlo antes de la corrida: el criterio
    // (2), traducido a la moneda del mundo, dice «comé al menos una vez».
    const tanque = specOf('stamina').range[1];
    const segundos = CRITERIO_TICKS / HZ_DE_REFERENCIA;
    const soloVivir = segundos * COSTO_VIVIR_POR_SEGUNDO;
    expect(soloVivir).toBe(tanque);
    console.log(
      `\n─── LA ARITMÉTICA DEL CRITERIO ───\n` +
        `  ${String(CRITERIO_TICKS)} ticks ÷ ${String(HZ_DE_REFERENCIA)} Hz = ${String(segundos)} s de mundo\n` +
        `  × COSTO_VIVIR_POR_SEGUNDO (${String(COSTO_VIVIR_POR_SEGUNDO)}) = ${String(soloVivir)} de aliento SÓLO por estar viva\n` +
        `  y el tanque topa en ${String(tanque)}.  O sea: el criterio (2) es «comé al menos una vez».\n`,
    );
    MEDIDO.set(
      'aritmética',
      `${String(CRITERIO_TICKS)} ticks = ${String(soloVivir)} de aliento = el tanque entero`,
    );
  });

  it.fails(
    'CRITERIO: 20.000 ticks viva — pesca, guarda el pescado y se muere esperando un fuego',
    () => {
      // LA SALIDA MEDIDA HOY, y está impresa abajo por la corrida de verdad:
      //
      //   murió en el tick 3627 de 20.000 (18%), con el aliento en 0
      //   2 despegues de aplicar(extraccion) · UN pescado en la mano desde el tick 96
      //   0 bocados · 321 explorar(8t) + 321 guarecerse + 321 juntar×1, todos fallando
      //   aliento: 0:309,9 → 2000:140,5 → 4000:0
      //
      // ─── LO QUE MEDÍA EL TRAMO ANTERIOR, QUE ES LA VARA DE LA MEJORA ───────
      //
      //   murió en el tick 6194 · 199 despegues de aplicar(extraccion) · 1 pescado
      //   aliento: 0:309,9 → 2000:209,7 → 4000:109,7 → 6000:9,7  (−0,05/tick, clavado)
      //
      // El bucle de 199 tiros de caña adentro de su propio pescado SE TERMINÓ: son
      // 2 despegues, y el mundo ya no contesta `sin-pozo` ni una vez (196 antes,
      // 0 ahora — medido en el 4/6). Ése era el eslabón A y está cerrado.
      //
      // ─── Y AHORA MUERE ANTES. NO ES UN RETROCESO, Y HAY QUE DECIR POR QUÉ ──
      //
      // 3627 < 6194, y leerlo como «empeoró» sería el tercer encuadre engañoso de
      // este proyecto. Lo que cambió es a QUÉ dedica el tiempo que le queda:
      //
      //   · antes se quedaba PARADA al lado del pozo tirando la caña, y un tiro
      //     fallido no cuesta patas: gastaba −0,0500 por tick, que es exactamente
      //     `COSTO_VIVIR_POR_SEGUNDO / hz` y nada más;
      //   · ahora consigue el pescado en el tick 96, sube el pedido a «lo cocido»,
      //     el planificador se corta en la ventana de potencia del fuego y la mente
      //     cae a las conductas de fondo — que CAMINAN. Medido en el 6/6: −0,08636
      //     por tick, 1,73× lo que cuesta estar viva.
      //
      // O sea que el mismo tanque de 310 rinde 6194 ticks quieta y 3627 caminando.
      // El criterio no se mide en ticks aguantados: se mide en si comió, y en las
      // dos corridas comió CERO. Lo que se movió no es la distancia al criterio,
      // es el eslabón donde se corta la cadena — que ahora es UNO solo y está
      // aislado con su contraprueba (5/6).
      //
      // ─── CÓMO NO SE CUENTAN LAS PESCAS, POR SEGUNDA VEZ ────────────────────
      //
      // Acá decía «pescas 199» leyendo `r.cuenta`, que cuenta DESPEGUES, y esa
      // frase viajó a tres documentos y a un ADR. Pero `aterrizados` tampoco sirve:
      // hoy imprime CERO pescas y el pescado está en la mano. El vuelo que lo sacó
      // aterriza con `ok:false` porque la mente lo interrumpe en el mismo tick en
      // que la meta se cumple («ya tengo «holding(tag:carnoso)»: corto lo que
      // estaba haciendo»). Lo que gobierna es `pescoEn`, que mira el mundo.
      //
      // POR QUÉ NO SE ABLANDA A «sobrevive lo que pueda»: el criterio es del
      // documento de arquitectura y es el criterio de corte del proyecto. Los tests
      // que siguen miden POR QUÉ no llega, que es lo único que sirve para decidir
      // qué se hace.
      const r = correr(laEscenaDelDocumento(), 'ana', CRITERIO_TICKS);
      const despegues = r.cuenta.get('aplicar(extraccion)') ?? 0;
      const comidas = [...r.cuenta]
        .filter(([k]) => k.startsWith('comer') || k.startsWith('tragar'))
        .reduce((a, [, v]) => a + v, 0);

      console.log(
        `\n─── VEINTE MIL TICKS ───\n` +
          `  murió en el tick ${String(r.murioEn)} de ${String(CRITERIO_TICKS)} ` +
          `(${((r.murioEn * 100) / CRITERIO_TICKS).toFixed(0)}%)\n` +
          `  aliento: ${r.aliento.join(' ')}\n` +
          `  DESPEGUES:   ${[...r.cuenta].map(([k, v]) => `${k}×${String(v)}`).join(' · ')}\n` +
          `  ATERRIZAJES ok: ${[...r.aterrizados].map(([k, v]) => `${k}×${String(v)}`).join(' · ')}\n` +
          `  ATERRIZAJES mal:\n` +
          [...r.fallados].map(([k, v]) => `      ${String(v).padStart(4)} × ${k}`).join('\n') +
          `\n  EL PESCADO ENTRA A LA MANO EN EL TICK ${String(r.pescoEn)} (${String(despegues)} tiros de caña en toda la corrida) · ` +
          `bocados ${String(comidas)} · ticks perdidos ${String(r.ticksPerdidos)} · ${r.ms.toFixed(0)} ms de reloj\n` +
          `  ARNÉS DE INVARIANTES: ${String(r.violaciones.length)} estados ilegales en ${String(CRITERIO_TICKS)} ticks` +
          `${r.violaciones.length === 0 ? ' (y por primera vez alguien estaba mirando)' : `\n      ${r.violaciones.slice(0, 5).join('\n      ')}`}\n`,
      );
      MEDIDO.set(
        'supervivencia',
        `murió en el tick ${String(r.murioEn)} de ${String(CRITERIO_TICKS)} · pescó UNO en el tick ` +
          `${String(r.pescoEn)} con ${String(despegues)} tiros de caña · ${String(comidas)} bocados`,
      );

      // Lo que la corrida tiene que seguir mostrando aunque el criterio esté rojo.
      //
      // Y ESTA GUARDA CAMBIÓ DE SIGNO, que es la forma más corta de decir lo que
      // arregló el tramo: donde decía `expect(despegues).toBeGreaterThan(100)`
      // —el bucle era tan estable que se podía afirmar— ahora se afirma que NO
      // hay bucle, y que el pescado está.
      expect(despegues).toBeLessThan(10);
      expect(r.pescoEn).toBeGreaterThan(0);
      expect(r.ticksPerdidos).toBe(0);
      // Y EL MUNDO SOBRE EL QUE SE MIDIÓ TIENE QUE SER LEGAL. Es nuevo, y no es
      // higiene: un «murió en el tick 6194» sobre un mundo que nadie audita no
      // distingue una criatura que se muere de hambre de una que se rompió. El
      // adversario del veneno midió justo eso —un actor sin cuerpo que sobrevivía
      // para siempre y que la detección de muerte de acá abajo contaba como VIVO—.
      expect(r.violaciones, r.violaciones.slice(0, 3).join(' | ')).toEqual([]);
      // EL CRITERIO, dicho como lo dice el documento.
      expect(r.murioEn, `se murió en el tick ${String(r.murioEn)}`).toBe(-1);
    },
    300_000,
  );

  it('DIAGNÓSTICO 1/6 · LO QUE YA NO PASA: la mente SÍ tiene por dónde comer, y quiere lo cocido', () => {
    // ─── ESTE DIAGNÓSTICO SE DIO VUELTA, Y ES LA MEJORA DEL TRAMO ──────────
    //
    // Decía, con estas palabras: «la mente NUNCA emite `comer`. No tiene por
    // dónde: `opportunities()` sólo fabrica metas `holding(tag:…)`». Y lo medía
    // así: `for (const o of ops) expect(o.meta.startsWith('holding(')).toBe(true)`
    // más «vuelos en 2000 ticks: … — ninguno es `comer`».
    //
    // Ya no. El hambre produce TRES clases de oportunidad y no una —el medio, el
    // BOCADO y el medio con la condición puesta— y las tres se ordenan con la
    // misma fórmula. Lo que este test mide ahora es lo contrario de lo que medía:
    // que la boca existe como destino, y que la criatura pide lo COCIDO sin que
    // nadie le haya nombrado el fuego.
    const p = new Partida(laEscenaDelDocumento());
    const v = vistaDe(p, 'ana');
    const ops = opportunities(v, new Creencias(), necesidades(v));
    const comestible = ops.find((o) => o.meta.includes('toxicity<'));
    expect(comestible).toBeDefined();
    // Y la condición NO nombra el fuego, ni la parrilla, ni la leña: nombra cuánta
    // toxicidad se banca, que es lo único que la criatura sabe de sí misma.
    expect(comestible?.meta ?? '').not.toContain('temperature');

    // Y en la corrida cambia de meta sola, cuando se da cuenta de que ya consiguió
    // la barata. El tick es medido, no elegido.
    const m = new Mente({ actor: 'ana', memoria: new Creencias() });
    const mentes = new Map([['ana', m]]);
    let cambio = -1;
    for (let t = 0; t < 400 && cambio < 0; t++) {
      vivir(p, mentes, 1);
      if ((m.estado.metaEnCurso ?? '').includes('toxicity<')) cambio = t;
    }
    expect(cambio).toBeGreaterThan(0);

    console.log(
      `\n─── LA MENTE YA QUIERE COMER, Y YA QUIERE LO COCIDO ───\n` +
        `  metas que la mente puede querer HOY: ${[...new Set(ops.map((o) => o.meta))].join(', ')}\n` +
        `  ¿alguna es un bocado —cerrarlo de un mordisco—?  ` +
        `${ops.some((o) => o.bocado !== undefined) ? 'sí' : 'no, porque el crudo da negativo'}\n` +
        `  sube el pedido a «${String(comestible?.meta)}» en el tick ${String(cambio)}\n`,
    );
    MEDIDO.set(
      'quiere',
      `sube el pedido a «${String(comestible?.meta)}» en el tick ${String(cambio)}, sin nombrar el fuego`,
    );
  }, 120_000);

  it('DIAGNÓSTICO 2/6 · y no come porque el crudo la MATA: `comer` rechaza el pescado', () => {
    // La innata filtra `calories > 0 && toxicity <= toxicidadTolerada`, con el
    // tolerado en 0,2 por omisión. Y el pescado que ella misma sacó del agua mide
    // 0,2742 —el tramo anterior midió 0,2761, y la diferencia es que hoy el pescado
    // sale del agua sesenta ticks más tarde y llega menos podrido a este test—:
    // apenas por encima del tolerado, y no porque se haya podrido: la sustancia
    // `pescado` nace con `toxicity: 0,25` en el catálogo de la semilla.
    //
    // ─── LO QUE ERA INCÓMODO ACÁ SE ARREGLÓ (ADR II-0013) ──────────────────
    //
    // Este comentario decía: «el mundo no cobra `toxicity`, así que el rechazo es
    // una decisión de la habilidad y no una regla del mundo — es la decisión
    // correcta el día que el mundo la cobre». Ese día llegó: `intencionComer`
    // descuenta `toxicity · masa · 25` de la `stamina`, aparte de lo que las
    // calorías acreditan, y el pescado crudo de 2 kg sale NETO NEGATIVO por 6,42.
    //
    // O sea que **la tolerancia de 0,2 dejó de ser prudencia sin respaldo** y este
    // rechazo pasó a ser correcto y no conservador. No comerse el pescado crudo es
    // la decisión buena: los dos diagnósticos que siguen miden por qué no consigue
    // uno cocido, que es lo que sí la salvaría.
    const r = correr(laEscenaDelDocumento(), 'ana', 200);
    const p = r.partida;
    const pez = [...p.state.bodies.values()].find(
      (b) => b.heldBy === 'ana' && b.body.parts.some((x) => x.substance === 'pescado'),
    );
    expect(pez).toBeDefined();
    if (pez === undefined) throw new Error('imposible');
    const q = (x: QualityId): number => qualityOf(pez.body, x, p.state.phys);
    expect(q('calories')).toBeGreaterThan(0);
    expect(q('toxicity')).toBeGreaterThan(0.2);

    // Se le pide comer con el default: se rinde sin gastar el bocado.
    const antes = aliento(p, 'ana');
    p.vuelo('ana')?.abortar('el test toma el mando');
    const v = p.volar('ana', (ctx) => comer(ctx, {}), undefined);
    for (let k = 0; k < 60 && !v.terminado; k++) p.avanzar(1);
    expect(v.outcome?.ok).toBe(false);
    expect(aliento(p, 'ana')).toBeLessThan(antes);

    console.log(
      `\n─── EL PESCADO QUE NO SE PUEDE COMER ───\n` +
        `  ${pez.body.id}: pescado × ${dos(q('mass'))} kg · ${dos(q('calories'))} calorías · ` +
        `toxicity ${q('toxicity').toFixed(4)} · decay ${q('decay').toFixed(4)}\n` +
        `  \`comer\` tolera 0,2 por omisión → ${JSON.stringify(v.outcome)}\n` +
        `  y la sustancia nace en 0,25: no es que se pudrió, el pescado crudo es incomible por diseño\n`,
    );
    MEDIDO.set(
      'toxicidad',
      `pescado crudo tox ${q('toxicity').toFixed(4)} contra un tolerado de 0,20 → rechazo`,
    );
  });

  it('DIAGNÓSTICO 3/6 · forzada a comer, el pescado CRUDO le SACA aliento (ADR II-0013)', () => {
    // ─── ESTE DIAGNÓSTICO CAMBIÓ DE SIGNO, Y ES LO QUE VOLVIÓ OBLIGATORIO EL FUEGO ─
    //
    // Se llamaba «le sobraba comida: pescó 199 y le hacían falta ~83» y medía
    // `gana > 0`: forzada a tragar el veneno, el pescado crudo le daba **+8,37** de
    // aliento —167 ticks de vida— y con 83 de ésos llegaba a los 20.000. La
    // conclusión era que la comida estaba y el problema era la mente. (El +8,37 se
    // remidió con `world/src/step.ts` revertido, y no se copió de ningún informe.)
    //
    // Esa lectura tenía las DOS mitades mal, y las dos están medidas en este
    // archivo:
    //
    //   · **no pescó 199**: pescó UNO. Las otras 198 veces tiraba la caña adentro
    //     de su propio pescado y el mundo le contestaba que ahí no había pozo. Ese
    //     bucle YA NO EXISTE —hoy son 2 tiros y 0 rechazos `sin-pozo`, medido en el
    //     DIAGNÓSTICO 4/6— y sigue pescando UNO: el que le alcanza para cumplir
    //     `holding(tag:carnoso)` y quedarse esperando el fuego;
    //   · y **no le servían crudas**: con el ADR II-0013 el mundo cobra `toxicity`
    //     al tragar, y el mismo pescado le SACA 11,40 (medido en esta corrida; el
    //     tramo anterior midió 11,56 sobre un pescado un poco MÁS podrido, porque
    //     salía del agua antes: `toxicity` 0,2761 contra 0,2742). El «le sobraba
    //     comida» se apoyaba en un hueco: comer veneno salía gratis.
    //
    // ─── QUÉ SIGNIFICA PARA EL CRITERIO (2), dicho sin adornos ─────────────
    //
    // No hay número de pescados CRUDOS que alcance. Para llegar a los 20.000 hay
    // que cocinar, y la tolerancia de 0,2 de la innata dejó de ser prudencia sin
    // respaldo: el `DIAGNÓSTICO 2/6` mide un rechazo que ahora el mundo respalda.
    //
    // Lo que la cadena del fuego ya sabe hacer está medido y anda
    // (`world/tests/el-fuego.test.ts`, `perceive/tests/ataque-a-la-costura.test.ts`):
    // el mismo pescado cocido deja +16,08. Que la mente ya lo QUIERE lo mide el
    // 1/6; dónde se le corta la cadena, el 4/6 y el 5/6.
    const r = correr(laEscenaDelDocumento(), 'ana', 200);
    const p = r.partida;
    const antes = aliento(p, 'ana');
    p.vuelo('ana')?.abortar('el test toma el mando');
    // Tolerando el veneno, que es exactamente el parámetro que la innata deja
    // abierto para que una criatura desesperada pueda elegir envenenarse. No se
    // toca ni una línea de `src/`: se le pasa otro argumento a la misma habilidad.
    // Con el ADR II-0013, elegirlo ahora PAGA.
    const v = p.volar('ana', (ctx) => comer(ctx, { toxicidadTolerada: 1 }), undefined);
    let k = 0;
    while (!v.terminado && k < 60) {
      p.avanzar(1);
      k++;
    }
    // El acto SE HACE —el mundo no lo prohíbe, comer nunca fue un permiso— y lo
    // que cambió es lo que deja.
    expect(v.outcome?.ok).toBe(true);
    const gana = aliento(p, 'ana') - antes;
    expect(gana).toBeLessThan(0);

    const porTick = COSTO_VIVIR_POR_SEGUNDO / HZ_DE_REFERENCIA;
    const ticksQueLeCuesta = -gana / porTick;
    const inicial = 310;
    const faltaban = CRITERIO_TICKS - inicial / porTick;

    console.log(
      `\n─── LO QUE UN PESCADO CRUDO VALE, CON EL VENENO COBRADO ───\n` +
        `  comer(tolerando el veneno): ${JSON.stringify(v.outcome)} en ${String(k)} ticks\n` +
        `  aliento ${dos(antes)} → ${dos(aliento(p, 'ana'))}  (${dos(gana)} = ${ticksQueLeCuesta.toFixed(0)} ticks de vida MENOS)\n` +
        `  para llegar a ${String(CRITERIO_TICKS)} le faltaban ${faltaban.toFixed(0)} ticks, y comer crudo la aleja: NO hay ` +
        `número de pescados crudos que alcance.\n` +
        `  el mismo pescado COCIDO deja +16,08 (medido en \`perceive/tests/ataque-a-la-costura.test.ts\`)\n`,
    );
    MEDIDO.set(
      'comida',
      `${dos(gana)} de aliento por pescado CRUDO (${ticksQueLeCuesta.toFixed(0)} ticks menos); ` +
        `ningún número de pescados crudos alcanza — hay que COCINAR`,
    );
  });

  it('DIAGNÓSTICO 4/6 · ESLABÓN A, CERRADO: pesca UNA vez y sabe que lo que tiene en la mano es carne', () => {
    // ─── EL ESLABÓN QUE SE COMÍA LA CORRIDA, Y LO QUE MIDE HOY ─────────────
    //
    // Este test medía el bucle. Ahora mide su ausencia, con los mismos tres
    // instrumentos y sin aflojar ninguno: los rechazos del mundo, los cuerpos
    // nacidos y el paso que el planificador emite.
    //
    //   ANTES (tramo anterior)            HOY (esta corrida)
    //   196 × `apply/sin-pozo`            0 × `apply/sin-pozo`
    //   1   × `apply/no-pico`             1 × `apply/no-pico`, 1 × `explore/sin-fuerza`
    //   2 nacidos, 1 pescado              2 nacidos, 1 pescado (w000000002, 2,887 kg)
    //   paso: aplicar(extraccion)         NO HAY PASO: el plan sale VACÍO
    //         source = el pescado
    //         de su propia mano
    //
    // ─── POR QUÉ EL PLAN SALE VACÍO, QUE ES EL DIAGNÓSTICO ENTERO ──────────
    //
    // Las dos causas que se juntaban están las dos tapadas, y ninguna vivía en
    // este paquete:
    //
    //   · `cumpleCuerpo` de `@anima/plan` contestaba `false` para TODA forma
    //     `sostiene` (era un `case 'sostiene': return false` literal), así que
    //     `holding(tag:carnoso)` no se daba por cumplida NUNCA, ni con el pescado
    //     agarrado. Hoy la contesta leyendo los tags de la sustancia al revés,
    //     desde el nombre que la vista ya traía — y por eso, con el pescado en la
    //     mano, `plan()` devuelve un plan de CERO PASOS: la meta ya está;
    //   · y el rol `source` de `extraccion` pedía `mass > 0` y nada más, así que
    //     el cuerpo más cercano que calificaba era el de su propia mano. Hoy la
    //     fila filtra el rol, y el mundo dejó de contestar `sin-pozo`.
    //
    // ─── LO QUE ESTE CERO NO DICE ──────────────────────────────────────────
    //
    // No dice que el criterio (2) se cumpla: no se cumple, se muere en el 3627.
    // Dice que ya no se muere ACÁ. El eslabón que queda es el 5/6, y es aguas
    // abajo: con el pescado en la mano, lo que le falta es el fuego.
    const rechazos = rechazosDelMundo(laEscenaDelDocumento(), 'ana', 6300);
    const sinPozo = rechazos.porQue.get('apply/sin-pozo') ?? 0;
    const nac = nacidos(laEscenaDelDocumento(), 'ana', 6300);

    // Qué plan sale con el pescado ya en la mano, leído del planificador de verdad
    // y no del relato.
    const p = new Partida(laEscenaDelDocumento());
    const m = new Mente({ actor: 'ana', memoria: new Creencias() });
    vivir(p, new Map([['ana', m]]), 200);
    const v = vistaDe(p, 'ana');
    const pred = interpretar('holding(tag:carnoso)');
    if (pred === undefined) throw new Error('imposible');
    const r = plan(
      { id: 'meta', goal: pred, after: [], porque: 'el test' },
      v,
      EXPANSIONES_POR_TICK * 60,
    );
    const pasos = r.k === 'plan' ? r.steps : r.k === 'gap' ? r.nearest : [];
    const enMano = new Set(p.state.actors.get('ana')?.holding ?? []);
    const tieneCarne = enLaMano(p, 'ana').some((s) => s.includes('pescado'));

    console.log(
      `\n─── EL ESLABÓN A, DESPUÉS DE LA REPARACIÓN ───\n` +
        `  rechazos del mundo en 6300 ticks: ${[...rechazos.porQue].map(([k, n]) => `${k}×${String(n)}`).join(' · ')}` +
        `   (antes: apply/sin-pozo×196)\n` +
        `  cuerpos NACIDOS en toda la corrida: ${String(nac.total)} → ${nac.peces.join(', ') || '(ningún pescado)'}\n` +
        `  y en la mano tiene: ${[...enMano].join(', ')} → ${enLaMano(p, 'ana').join(' · ')}\n` +
        `  plan(holding(tag:carnoso)) con el pescado agarrado: ${r.k} de ${String(pasos.length)} pasos ` +
        `${pasos.length === 0 ? '(la meta YA está cumplida: eso es lo que antes no sabía contestar)' : pasos.map((s) => s.k).join(' → ')}\n` +
        `  el pozo al que le apunta, al final de la corrida: ${dos(rechazos.pozo)} kg de stock — nunca se vació\n`,
    );

    // EL CERO QUE MIDE LA REPARACIÓN: el mundo ya no la rechaza por apuntar mal.
    expect(sinPozo).toBe(0);
    // Y sigue sacando UN pescado. `nacio` cuenta cuerpos nuevos: la caña y el pez.
    expect(nac.peces.length).toBe(1);
    expect(tieneCarne).toBe(true);
    // LA OTRA MITAD, y es la que prueba que `cumpleCuerpo` contesta: con el pescado
    // en la mano el planificador no propone NADA, porque no hay nada que hacer.
    expect(r.k).toBe('plan');
    expect(pasos.length).toBe(0);
    // Y el pozo NO se vació: si se hubiera vaciado, el motivo sería `pozo-vacio`.
    expect(rechazos.pozo).toBeGreaterThan(100);
    MEDIDO.set(
      'eslabón A',
      `CERRADO: 0 × \`sin-pozo\` (eran 196), 1 pescado en la mano, y \`plan(holding(tag:carnoso))\` ` +
        `sale de 0 pasos porque la meta ya está cumplida`,
    );
  }, 300_000);

  it('DIAGNÓSTICO 5/6 · ESLABÓN B, EL ÚNICO QUE QUEDA: sabe LIGAR un fuego, no sabe pedir uno de la potencia justa', () => {
    // ─── ESTE ESLABÓN NO SE MOVIÓ, Y AHORA ES EL ÚNICO ─────────────────────
    //
    // Lo que sí se movió es la contraprueba, y el cambio es la prueba más limpia
    // que hay de que el eslabón A está cerrado: con el leño ardiendo el plan salía
    // de CINCO pasos —`aplicar → ir → poner → poner → sostener`, siete
    // expansiones— y hoy sale de CUATRO —`ir → poner → poner → sostener`, cinco
    // expansiones—. El paso que desapareció es el `aplicar`, o sea PESCAR: ya no
    // hace falta, porque el pescado que tiene en la mano por fin cuenta.
    // La mente pide `holding(tag:carnoso,toxicity<0.0528)` y `plan()` regresa hasta
    // la ley 5 de desnaturalización —o sea que la mitad de arriba de la cadena
    // EXISTE— y se corta en el rol `fuego`, que la fila pide acotado por los dos
    // lados: `emitsPower >= 253` y `emitsPower < 410`. Abajo del piso la comida no
    // llega a su `denaturesAt`; arriba del techo cruza su `ignitionPoint` y se
    // quema. Los dos bordes salen del catálogo y no los eligió nadie.
    //
    // Y lo único que el catálogo sabe establecer es `emitsPower>0`, que es lo que
    // `friccion` promete: que algo va a EMITIR. No promete cuánto. Una desigualdad
    // sin techo no implica una ventana, así que la regresión se queda sin vía.
    //
    // ─── LA CONTRAPRUEBA, QUE ES LO QUE VUELVE ESTO UN DIAGNÓSTICO ─────────
    //
    // Con un leño de 1,2 kg YA ARDIENDO en la misma celda —emitsPower 310,62 en el
    // momento en que se pide el plan, o sea adentro de la ventana `[253 ; 410)`, y
    // el número lo imprime la corrida— y una losa de piedra al lado, **el mismo pedido
    // cierra**: `ir → poner → poner → sostener`, que es ir al fuego, apoyar la losa
    // encima, apoyar el pescado que ya tiene en la losa y levantarlo cocido. Nadie
    // escribió «parrilla»: sale de que la pila tiene tres cuerpos.
    //
    // O sea que lo que falta NO es la ley, ni la geometría, ni el vocabulario de
    // la mente: es **una vía que establezca una ventana de potencia**. Hoy eso se
    // arregla en `@anima/plan` o en el catálogo, no acá.
    const meta = interpretar(metaComestibleDe('carnoso') ?? '');
    if (meta === undefined) throw new Error('sin predicado');
    const g: GoalNode = { id: 'meta', goal: meta, after: [], porque: 'el test' };

    // (a) la escena del documento, tal cual.
    const p1 = new Partida(laEscenaDelDocumento());
    vivir(p1, new Map([['ana', new Mente({ actor: 'ana', memoria: new Creencias() })]]), 200);
    const sinFuego = plan(g, vistaDe(p1, 'ana'), EXPANSIONES_POR_TICK * 60);

    // (b) la MISMA escena con un fuego ya prendido y una losa. Nada más cambia.
    const p2 = new Partida(conFuegoYLosa());
    vivir(p2, new Map([['ana', new Mente({ actor: 'ana', memoria: new Creencias() })]]), 200);
    const fogata = p2.state.bodies.get('fogata');
    const potencia = fogata === undefined ? 0 : qualityOf(fogata.body, 'emitsPower', p2.state.phys);
    const conFuego = plan(g, vistaDe(p2, 'ana'), EXPANSIONES_POR_TICK * 60);

    console.log(
      `\n─── LA VENTANA DE POTENCIA DEL FUEGO ───\n` +
        `  sin fuego:  ${sinFuego.k}` +
        (sinFuego.k === 'gap'
          ? `  missing «${sinFuego.missing}»\n              ${sinFuego.why}`
          : '') +
        `\n  con un leño ardiendo (emitsPower ${potencia.toFixed(2)}, la ventana es [253 ; 410)):  ${conFuego.k}` +
        (conFuego.k === 'plan'
          ? `  →  ${conFuego.steps.map((s) => s.k).join(' → ')}  (${String(conFuego.expansiones)} expansiones)`
          : conFuego.k === 'gap'
            ? `  missing «${conFuego.missing}»`
            : '') +
        `\n`,
    );

    expect(sinFuego.k).toBe('gap');
    if (sinFuego.k !== 'gap') throw new Error('imposible');
    expect(sinFuego.missing).toContain('emitsPower');
    // Lo más cerca que llega el catálogo es una desigualdad sin techo.
    expect(sinFuego.why).toContain('emitsPower>0');
    // Y con el fuego puesto la cadena CIERRA: el problema es encenderlo, no usarlo.
    expect(conFuego.k).toBe('plan');
    if (conFuego.k !== 'plan') throw new Error('imposible');
    // Y NO LLEVA `aplicar`. El paso de pescar se cayó solo cuando `cumpleCuerpo`
    // aprendió a contestar tags: es el eslabón A visto desde el otro lado.
    expect(conFuego.steps.map((s) => s.k)).toEqual(['ir', 'poner', 'poner', 'sostener']);

    MEDIDO.set(
      'eslabón B',
      `gap «${sinFuego.missing}» (lo más cerca del catálogo es \`emitsPower>0\`); ` +
        `con un leño ardiendo a ${potencia.toFixed(2)} el plan CIERRA en ${String(conFuego.expansiones)} ` +
        `expansiones y en ${String(conFuego.steps.length)} pasos, sin volver a pescar`,
    );
  }, 120_000);

  it('DIAGNÓSTICO 6/6 · POR QUÉ MUERE ANTES QUE ANTES: el bucle era gratis y deambular no', () => {
    // ─── EL NÚMERO QUE SE PUEDE LEER MAL, MEDIDO PARA QUE NO SE LEA MAL ────
    //
    // Murió en el 3627 y el tramo anterior moría en el 6194. Dicho pelado, parece
    // que la reparación la mató antes. Lo que pasó es otra cosa, y son dos
    // renglones de aritmética:
    //
    //   · el bucle viejo era PARADA. Tirar la caña adentro de su propio pescado
    //     falla sin mover una pata, y la corrida vieja gastaba −0,0500 por tick,
    //     que es `COSTO_VIVIR_POR_SEGUNDO / hz` exacto y nada más. 310 de tanque
    //     ÷ 0,05 = 6200 ticks, y murió en 6194: estaba pagando SÓLO por respirar;
    //   · el bucle nuevo CAMINA. Con el pescado ya en la mano y el fuego fuera de
    //     alcance, la mente cae a las conductas de fondo —explorar, guarecerse,
    //     juntar— y explorar son ocho ticks de patas. Medido abajo: −0,08636 por
    //     tick, 1,73× lo que cuesta estar viva.
    //
    // O sea que el mismo tanque rinde 6200 ticks quieta y 3600 caminando, y la
    // diferencia entre las dos corridas no es cuánto aguanta: es que ahora tiene el
    // pescado. El criterio (2) no se mide en ticks aguantados —se mide en si comió,
    // y las dos corridas comieron cero—, y por eso este test no afirma «murió más
    // tarde»: afirma de dónde sale cada gramo de aliento que gasta.
    //
    // ─── Y LO QUE SE VE DE PASO, QUE ES NUEVO ──────────────────────────────
    //
    // El pescado se le PUDRE EN LA MANO mientras espera: sale del agua con
    // `toxicity` 0,25 y a los 3000 ticks marca 0,7100. La meta que lo retiene es
    // `holding(tag:carnoso)`, y pudrirse no le saca el tag: sigue siendo carne. La
    // criatura no está equivocada —lo que quiere es lo COCIDO, y eso no lo
    // consigue— pero el mundo le está cobrando la espera en la única moneda que
    // este bicho tiene, y nadie lo estaba mirando.
    const r = correr(laEscenaDelDocumento(), 'ana', 4000, { cada: 100 });
    const porTick = COSTO_VIVIR_POR_SEGUNDO / HZ_DE_REFERENCIA;
    // La pendiente DESPUÉS del gap: de la muestra del tick 100 —la mente ya cayó a
    // las conductas de fondo en el 98— a la del 2000, que es la última con aliento
    // de sobra. Antes del 100 hay armado de caña y pesca, que es otro régimen.
    const desde = r.muestras[1] ?? 0;
    const hasta = r.muestras[20] ?? 0;
    const pendiente = (desde - hasta) / 1900;

    // El pescado, todavía en la mano y todavía viva, para poder leerle la podredumbre.
    const viva = correr(laEscenaDelDocumento(), 'ana', 3000, { cada: 3000 });
    const pez = [...viva.partida.state.bodies.values()].find(
      (b) => b.heldBy === 'ana' && b.body.parts.some((x) => x.substance === 'pescado'),
    );
    const podrido =
      pez === undefined ? -1 : qualityOf(pez.body, 'toxicity', viva.partida.state.phys);

    console.log(
      `\n─── DE QUÉ SE MUERE, GRAMO POR GRAMO ───\n` +
        `  murió en el tick ${String(r.murioEn)} (el tramo anterior: 6194, con el bucle de 199 tiros)\n` +
        `  pendiente del aliento entre el tick 100 y el 2000: ${pendiente.toFixed(5)}/tick\n` +
        `  sólo estar viva cuesta ${porTick.toFixed(5)}/tick  →  gasta ${(pendiente / porTick).toFixed(2)}× ` +
        `y la diferencia son las patas\n` +
        `  (la corrida vieja gastaba ${porTick.toFixed(5)} clavado: el bucle de la caña fallaba sin caminar)\n` +
        `  el pescado que espera el fuego, a los 3000 ticks: toxicity ${podrido.toFixed(4)} ` +
        `— salió del agua en 0,25 y se le pudre en la mano\n`,
    );

    // Camina, y por eso gasta de más: la pendiente tiene que estar por ENCIMA del
    // costo de respirar. Los bordes son anchos a propósito —es reloj de mundo, no
    // de máquina, pero el largo de cada `explorar` depende de dónde la deje— y lo
    // que se afirma es el hecho, no el decimal.
    expect(pendiente).toBeGreaterThan(porTick * 1.3);
    expect(pendiente).toBeLessThan(porTick * 2.5);
    // Y el pescado sigue ahí, cada vez más podrido, esperando un fuego que no llega.
    expect(podrido).toBeGreaterThan(0.25);
    MEDIDO.set(
      'deambular',
      `gasta ${pendiente.toFixed(5)}/tick contra ${porTick.toFixed(5)} de sólo vivir (${(pendiente / porTick).toFixed(2)}×): ` +
        `muere en ${String(r.murioEn)} y no en 6194 porque ahora camina, no porque le vaya peor`,
    );
  }, 300_000);

  it('CONTRAPRUEBA · con el eslabón REGALADO la mente come, y a 2000 ticks ya se le nota', () => {
    // La versión corta de la corrida cara de abajo, y la que AFIRMA siempre. Si
    // esto se pone rojo, se rompió el bucle de la necesidad y no hace falta pagar
    // los cuatro segundos para enterarse.
    const r = correr(laDespensa(), 'ana', 2000);
    const bocados = [...r.cuenta]
      .filter(([k]) => k.startsWith('tragar'))
      .reduce((a, [, v]) => a + v, 0);
    const control = correr(laEscenaDelDocumento(), 'ana', 2000);
    console.log(
      `\n─── CON COMIDA COCIDA AL ALCANCE, 2000 TICKS ───\n` +
        `  con despensa: ${String(bocados)} bocados · aliento ${dos(r.alientoFinal)}\n` +
        `  sin despensa: 0 bocados · aliento ${dos(control.alientoFinal)}  (la MISMA escena, sin cocidos)\n`,
    );
    expect(bocados).toBeGreaterThan(0);
    expect(r.murioEn).toBe(-1);
    // Y la diferencia es la vida: con la despensa SUBE el aliento, sin ella baja.
    expect(r.alientoFinal).toBeGreaterThan(control.alientoFinal);
    expect(r.mente.tropiezo).toBeUndefined();
  }, 300_000);

  it('CONTRAPRUEBA · y con el eslabón regalado, los 20.000 ENTEROS: el criterio (2) SE CUMPLE', () => {
    // ─── LO QUE ESTA CORRIDA CONTESTA, Y NINGUNA OTRA ──────────────────────
    //
    // «¿Falta sólo el fuego, o además falta otra cosa?». Se le regala EXACTAMENTE
    // el eslabón que no sabe hacer —cien pescados ya cocidos, con los números que
    // la ley 5 deja de verdad— y no se le regala nada más: la misma mente, la
    // misma escena, el mismo hambre, sin `drive` y sin proveedor.
    //
    // MEDIDO: **murió en −1** (o sea, no murió), 65 bocados, aliento final 1,4331.
    //
    // Y hay que decir POR QUÉ llegó, porque el encuadre importa más que el número:
    // no es que sobrevivió con lo que traía puesto. La cuenta cierra sola —310 de
    // aliento inicial + 691,43 comidos − 1000 de vivir = 1,43— así que las tres
    // cuartas partes de su vida las pagó con la boca. Es lo contrario de la
    // corrida con el tanque lleno, donde llegó al 19.995 sin comer un solo bocado.
    //
    // Lo que ADEMÁS se ve, y es un hallazgo aparte: comió 65 de los 100 y se
    // detuvo. Los 35 que quedan terminan la corrida con `toxicity` 0,9921 — la
    // ley 6 los pudrió. **La comida no se guarda**, y una criatura que llene el
    // tanque y se siente al lado de la despensa la pierde igual.
    //
    // Caro —4,1 s medidos, por los cien cuerpos que entran en cada `see()`— así que
    // se AFIRMA sólo midiendo en serio: `ANIMA_BANCO=1 pnpm --filter @anima/mind test`.
    // La guarda de todos los días es la corrida de 2000 de arriba.
    const r = correr(laDespensa(), 'ana', CRITERIO_TICKS);
    const bocados = [...r.cuenta]
      .filter(([k]) => k.startsWith('tragar'))
      .reduce((a, [, v]) => a + v, 0);
    const comidos =
      r.alientoFinal + CRITERIO_TICKS * (COSTO_VIVIR_POR_SEGUNDO / HZ_DE_REFERENCIA) - 310;
    const sobrantes = [...r.partida.state.bodies.values()].filter((b) =>
      b.body.id.startsWith('cocido'),
    );
    const podridos = sobrantes.map((b) => qualityOf(b.body, 'toxicity', r.partida.state.phys));

    console.log(
      `\n─── EL CRITERIO (2) CON EL ESLABÓN REGALADO ───\n` +
        `  murió en ${String(r.murioEn)} de ${String(CRITERIO_TICKS)} ${r.murioEn < 0 ? '(NO SE MURIÓ)' : ''} · ` +
        `${String(bocados)} bocados · aliento final ${r.alientoFinal.toFixed(4)}\n` +
        `  aliento: ${r.aliento.join(' ')}\n` +
        `  la cuenta: 310 inicial + ${comidos.toFixed(2)} comidos − ` +
        `${String(CRITERIO_TICKS * (COSTO_VIVIR_POR_SEGUNDO / HZ_DE_REFERENCIA))} de vivir = ${r.alientoFinal.toFixed(4)}\n` +
        `  quedaron ${String(sobrantes.length)} cocidos sin comer, con toxicity ` +
        `${podridos.length > 0 ? `${Math.min(...podridos).toFixed(4)}…${Math.max(...podridos).toFixed(4)}` : '—'} ` +
        `— la ley 6 los pudrió: la comida no se guarda\n` +
        `  ${r.ms.toFixed(0)} ms de reloj · ticks perdidos ${String(r.ticksPerdidos)}\n`,
    );
    MEDIDO.set(
      'regalado',
      r.murioEn < 0
        ? `CUMPLE: 20.000 ticks viva, ${String(bocados)} bocados, aliento final ${r.alientoFinal.toFixed(4)} ` +
            `(310 + ${comidos.toFixed(0)} comidos − 1000 de vivir)`
        : `murió en ${String(r.murioEn)} · ${String(bocados)} bocados`,
    );

    // Lo determinista y barato se afirma siempre.
    expect(r.ticks).toBe(CRITERIO_TICKS);
    if (!MIDIENDO_EN_SERIO) return;
    expect(bocados).toBeGreaterThan(50);
    expect(r.murioEn, `se murió en el tick ${String(r.murioEn)}`).toBe(-1);
  }, 600_000);

  it('lo que SÍ aguanta, afirmado siempre: 2000 ticks viva, sin tropiezos y sin perder un tick', () => {
    // La guarda de regresión de lo que hoy anda. No es el criterio —el criterio
    // está arriba, en rojo— pero es lo que no se puede romper mientras se arregla.
    const r = correr(laEscenaDelDocumento(), 'ana', 2000);
    expect(r.ticks).toBe(2000);
    expect(r.murioEn).toBe(-1);
    expect(r.ticksPerdidos).toBe(0);
    expect(r.mente.tropiezo).toBeUndefined();
    expect(r.alientoFinal).toBeGreaterThan(0);
  }, 120_000);

  it('y con el tanque LLENO tampoco llega, que es lo que cierra la discusión', () => {
    // Si el problema fuera «arrancó con poco», esto lo arreglaría. No lo arregla:
    // con 1000 de 1000 se muere igual, y ANTES de los 20.000, porque además de
    // vivir caminó.
    //
    // ─── LOS TRES NÚMEROS, QUE JUNTOS DICEN UNA SOLA COSA ──────────────────
    //
    //   18.524  se quedaba pegada a una meta que ningún esquema establece
    //   19.995  reparado el tramo G: exactamente lo que da el tanque, quieta
    //   11.618  HOY, con el eslabón A cerrado
    //
    // Y el 11.618 no es un retroceso: es el mismo diagnóstico del 6/6 con el
    // tanque grande. Consigue el pescado, sube el pedido a lo cocido, se queda sin
    // vía y cae a las conductas de fondo, que CAMINAN — 1000 ÷ 11.618 = 0,0861 por
    // tick contra los 0,0500 de sólo respirar, el mismo 1,72× medido allá.
    // Deambular con el tanque lleno cuesta lo mismo por tick que deambular con el
    // tanque en 310; lo único que cambia es cuánto dura.
    //
    // ─── CÓMO NO SE LEE ESTE NÚMERO ────────────────────────────────────────
    //
    // «Murió en el 19.995: le faltaban CINCO ticks» fue la lectura equivocada del
    // tramo anterior, y se escribió una vez. 1000 de tanque SON 1000 segundos de
    // vida, o sea los 20.000 ticks exactos de la corrida: lo que aquel número decía
    // no era «estuvo a cinco ticks», era «sobrevivió exactamente lo que traía
    // puesto y ni un segundo más». El de hoy dice menos todavía: ni siquiera le
    // rinde el tanque, porque se lo gasta buscando. El criterio (2) no es
    // «aguantá»: es «comé al menos una vez», y en las tres corridas comió cero.
    const r = correr(laEscenaDelDocumento(1000), 'ana', CRITERIO_TICKS);
    expect(r.murioEn).toBeGreaterThan(0);
    expect(r.murioEn).toBeLessThan(CRITERIO_TICKS);
    const bocados = [...r.cuenta]
      .filter(([k]) => k.startsWith('tragar'))
      .reduce((a, [, v]) => a + v, 0);
    expect(bocados).toBe(0);
    const gastoPorTick = 1000 / r.murioEn;
    console.log(
      `\n  con el tanque lleno (1000): murió en el tick ${String(r.murioEn)} de ${String(CRITERIO_TICKS)} · ` +
        `el pescado entra a la mano en el ${String(r.pescoEn)} con ` +
        `${String(r.cuenta.get('aplicar(extraccion)') ?? 0)} tiros de caña · ${String(bocados)} bocados · ${r.ms.toFixed(0)} ms\n` +
        `  1000 de tanque ÷ ${String(r.murioEn)} ticks = ${gastoPorTick.toFixed(4)} por tick, contra ` +
        `${(COSTO_VIVIR_POR_SEGUNDO / HZ_DE_REFERENCIA).toFixed(4)} de sólo respirar: la diferencia es que deambula (ver 6/6)\n` +
        `  (el tramo anterior moría en el 19.995, quieta al lado del pozo, y eso NO era «a cinco ticks del final»)\n`,
    );
    MEDIDO.set(
      'tanque lleno',
      `murió en el tick ${String(r.murioEn)} de ${String(CRITERIO_TICKS)} con ${String(bocados)} bocados ` +
        `(${gastoPorTick.toFixed(4)}/tick: ni siquiera le rinde el tanque, se lo gasta deambulando)`,
    );
  }, 300_000);
});

// ═══ (3) EL p99 DEL TICK — CITADO, NO REMEDIDO ══════════════════════════════

describe('(3) p99 < 5 ms con 5000 cuerpos: el número ya está medido en `@anima/world`', () => {
  it('la cita, verificada contra el archivo que la sostiene', () => {
    // No se vuelve a medir acá, y no por comodidad: `pnpm -r test` corre los
    // paquetes EN PARALELO y un banco de milisegundos contra una máquina ocupada
    // mide la contención tanto como el código —el mismo renglón dio 1,20 ms solo y
    // 7,80 acompañado—. Lo que sí se puede hacer sin medir nada es que la cita no
    // envejezca: si alguien mueve los techos, esto se pone rojo.
    const BANCO = `${PAQUETES}world/tests/banco-el-camino-de-intenciones.test.ts`;
    const fuente = readFileSync(BANCO, 'utf8');
    expect(fuente).toContain('const TECHO_P99_MS = 5');
    expect(fuente).toContain('const TECHO_ACEPTADO_MS = 45');
    expect(fuente).toContain('const CUERPOS = 5000');
    // El criterio del Hito 5 sigue clavado como `it.fails` y lo aceptado sigue
    // vigilado en verde. Si el p99 bajara de 5, el `it.fails` se cae solo por
    // «test esperado fallido que pasó», y entonces hay que venir a borrar esto.
    expect(fuente).toContain('it.fails(`p99 < ${TECHO_P99_MS} ms');
    expect(readFileSync(`${PAQUETES}world/tests/banco-el-tick.test.ts`, 'utf8')).toContain(
      'const MIDIENDO_EN_SERIO',
    );

    console.log(
      `\n─── EL (3), CITADO ───\n` +
        `  «p99 de tick < 5 ms con 5000 cuerpos» — NO SE CUMPLE, y está medido y ACEPTADO así.\n` +
        `  world/tests/banco-el-camino-de-intenciones.test.ts, con 5000 cuerpos y 5000 criaturas:\n` +
        `      p50 20,34 ms · p95 24,50 ms · p99 30,94 ms · peor 38,61 ms   →  6,2× el techo\n` +
        `  De esos 30,9 ms, 10,6 son el mundo QUIETO (física sobre 5000 cuerpos, cero actores) y\n` +
        `  20,3 son 5000 criaturas moviéndose (~4,1 µs por criatura y por tick).\n` +
        `  La guarda de regresión de lo aceptado está VERDE en 45 ms; el criterio de 5 sigue en\n` +
        `  \`it.fails\`, y lo que falta no es otra micro-optimización sino un cambio de\n` +
        `  REPRESENTACIÓN de las cualidades (diagnosticado desde el Hito 2).\n`,
    );
    MEDIDO.set(
      'p99',
      'p99 30,94 ms contra 5 (6,2×) — medido y aceptado en `@anima/world`, citado acá',
    );
  });

  it('y lo que ESTA mente le agrega al tick, medido donde sí se puede: una criatura', () => {
    // El (3) habla de 5000 cuerpos y de 5000 criaturas, y el que lo mide es el
    // banco del mundo. Lo único que este paquete puede aportar sin repetir aquel
    // trabajo es cuánto cuesta la mente ENCIMA del mundo, con una criatura: es el
    // número que dice si la escalera es un problema de rendimiento o no lo es.
    //
    // ─── Y ESTE NÚMERO SE MOVIÓ FEO, ASÍ QUE SE MIDE DE DÓNDE SALE ─────────
    //
    // El tramo anterior medía ~0,041 ms de mente encima de ~0,034 de mundo, o sea
    // 1,2 veces el mundo. Hoy mide del orden de 0,24 encima de 0,058, o sea 4
    // veces el mundo: la mente se puso entre 3 y 4 veces más cara POR TICK. No es
    // ruido de máquina —la razón mente/mundo no depende de la máquina— y no es
    // `cumpleCuerpo` contestando tags. Es esto, medido abajo con `plan()` a mano
    // sobre la misma vista (dos corridas de esta misma máquina, y los que
    // gobiernan son los que imprime la de hoy: son milisegundos de reloj):
    //
    //     plan(holding(tag:carnoso))              cierra   0,0031 – 0,0046 ms
    //     plan(holding(tag:carnoso,toxicity<…))   se corta 0,2454 – 0,3128 ms
    //                                                      → entre 68× y 80×
    //
    // Un plan que CIERRA es barato: para en cuanto encuentra la vía. Un plan que
    // se CORTA paga la búsqueda entera antes de rendirse. Y lo que la reparación
    // del eslabón A hizo con la corrida es exactamente cambiarle el pedido a la
    // criatura: antes pasaba la vida pidiendo lo carnoso —que cerraba— y ahora
    // pasa la vida pidiendo lo cocido, que se corta. O sea que este 4× no mide
    // que la escalera se haya puesto pesada: mide que la criatura pasó de
    // conseguir lo que pedía a no conseguirlo, y el día que el eslabón B se
    // cierre el número tiene que volver solo. Queda escrito para que nadie lo
    // lea como una regresión de rendimiento y salga a optimizar lo que no es.
    const conMente = correr(laEscenaDelDocumento(1000), 'ana', 4000);
    const p = new Partida(laEscenaDelDocumento(1000));
    const t0 = process.hrtime.bigint();
    p.avanzar(4000);
    const soloMundo = Number(process.hrtime.bigint() - t0) / 1e6;

    // LOS DOS PEDIDOS, CRONOMETRADOS SOBRE LA MISMA VISTA. Cien vueltas cada uno,
    // con veinte de precalentamiento tiradas a la basura: sin eso, el primero paga
    // la compilación del intérprete y sale diez veces más caro de lo que es.
    const q = new Partida(laEscenaDelDocumento());
    vivir(q, new Map([['ana', new Mente({ actor: 'ana', memoria: new Creencias() })]]), 200);
    const vista = vistaDe(q, 'ana');
    const cierra = interpretar('holding(tag:carnoso)');
    const corta = interpretar(metaComestibleDe('carnoso') ?? '');
    if (cierra === undefined || corta === undefined) throw new Error('sin predicado');
    const cronometrar = (g: typeof cierra, n: number): { k: string; ms: number } => {
      const t = process.hrtime.bigint();
      let k = '';
      for (let i = 0; i < n; i++) {
        const r = plan({ id: 'meta', goal: g, after: [], porque: 'el test' }, vista, EXPANSIONES_POR_TICK * 60);
        k = r.k;
      }
      return { k, ms: Number(process.hrtime.bigint() - t) / 1e6 / n };
    };
    cronometrar(cierra, 20);
    const barato = cronometrar(cierra, 100);
    const caro = cronometrar(corta, 100);

    const porTick = conMente.ms / 4000;
    console.log(
      `\n─── LO QUE LA MENTE LE AGREGA AL TICK (1 criatura, 4000 ticks) ───\n` +
        `  mundo solo ......... ${(soloMundo / 4000).toFixed(4)} ms/tick\n` +
        `  mundo + mente ...... ${porTick.toFixed(4)} ms/tick\n` +
        `  la mente ........... ${((conMente.ms - soloMundo) / 4000).toFixed(4)} ms/tick ` +
        `(la ventana de un tick a ${String(HZ_DE_REFERENCIA)} Hz son ${(1000 / HZ_DE_REFERENCIA).toFixed(0)} ms)\n` +
        `  y de dónde sale, con \`plan()\` cronometrado sobre la misma vista:\n` +
        `      pedir lo carnoso ... ${barato.k.padEnd(4)} ${barato.ms.toFixed(4)} ms   (cierra: para en cuanto encuentra la vía)\n` +
        `      pedir lo cocido .... ${caro.k.padEnd(4)} ${caro.ms.toFixed(4)} ms   ` +
        `(se corta: paga la búsqueda entera) → ${(caro.ms / barato.ms).toFixed(0)}×\n`,
    );
    MEDIDO.set(
      'la mente',
      `${((conMente.ms - soloMundo) / 4000).toFixed(4)} ms/tick encima de ` +
        `${(soloMundo / 4000).toFixed(4)} del mundo, con 1 criatura; y el ${(caro.ms / barato.ms).toFixed(0)}× ` +
        `es que un pedido que se CORTA cuesta ${caro.ms.toFixed(4)} ms contra ${barato.ms.toFixed(4)} de uno que cierra`,
    );
    // Sin aserción de tiempo: es informativo y corre al lado de los otros
    // paquetes. Lo único que se afirma es que las dos corridas hicieron el trabajo
    // y que los dos pedidos contestaron lo que este archivo dice que contestan.
    expect(conMente.ticks).toBe(4000);
    expect(p.informe.ticks).toBe(4000);
    expect(barato.k).toBe('plan');
    expect(caro.k).toBe('gap');
  }, 300_000);
});

// ═══ (4) `ticksPerdidos === 0` DURANTE TODA LA CORRIDA ══════════════════════

describe('(4) ticksPerdidos === 0, y contado contra un reloj que puede moverlo', () => {
  it('sin reloj de pared: cero, y sólo dice que el mundo nunca lanzó', () => {
    // La mitad honesta del criterio. Sin `RelojDePared`, `porTiempo` no se puede
    // mover POR CONSTRUCCIÓN —`bucle.ts`: «sin reloj de pared no hay ninguna
    // ventana que vencer»— así que este cero mide `porFalla` y nada más: que
    // `stepWorld` no lanzó una sola vez en 20.000 ticks con una mente encima.
    // Que el contador SÍ se puede mover lo prueba `perceive/tests/el-bucle.test.ts`
    // con un reloj falso que hace que cada tick tarde el doble de su ventana.
    const r = correr(laEscenaDelDocumento(1000), 'ana', CRITERIO_TICKS);
    expect(r.ticks).toBe(CRITERIO_TICKS);
    expect(r.porFalla).toBe(0);
    expect(r.ticksPerdidos).toBe(0);
    expect(r.partida.informe.fallas).toEqual([]);
    console.log(
      `\n  ${String(r.ticks)} ticks de mundo, ${String(r.porFalla)} fallas de \`stepWorld\`, ` +
        `${String(r.ticksPerdidos)} ticks perdidos\n`,
    );
  }, 300_000);

  it('CON reloj de pared: la otra mitad, que es la que el criterio pide de verdad', () => {
    const r = correr(laEscenaDelDocumento(1000), 'ana', CRITERIO_TICKS, { reloj: true });
    const ventana = 1000 / r.partida.state.hz;
    const porTick = r.ms / r.ticks;
    console.log(
      `\n─── EL CRITERIO (4), CON EL RELOJ DE PARED PUESTO ───\n` +
        `  ${String(r.ticks)} ticks en ${r.ms.toFixed(0)} ms = ${porTick.toFixed(3)} ms por tick\n` +
        `  la ventana de un tick a ${String(r.partida.state.hz)} Hz son ${ventana.toFixed(1)} ms ` +
        `→ sobra un factor de ${(ventana / porTick).toFixed(0)}\n` +
        `  ticksPerdidos ${String(r.ticksPerdidos)} (porTiempo ${String(r.porTiempo)}, porFalla ${String(r.porFalla)})\n`,
    );
    MEDIDO.set(
      'ticks perdidos',
      `${String(r.ticksPerdidos)} en ${String(r.ticks)} ticks con reloj de pared ` +
        `(${porTick.toFixed(3)} ms/tick contra una ventana de ${ventana.toFixed(0)})`,
    );

    // Lo determinista se afirma siempre.
    expect(r.porFalla).toBe(0);
    expect(r.ticks).toBe(CRITERIO_TICKS);
    // Y lo que depende del reloj del sistema, sólo midiendo en serio: una pausa
    // del recolector de basura más larga que una ventana suma un tick perdido, y
    // un rojo intermitente enseña a ignorar el rojo. Se imprime siempre.
    if (!MIDIENDO_EN_SERIO) return;
    expect(r.ticksPerdidos).toBe(0);
  }, 300_000);
});

// ═══ EL CUADRO ══════════════════════════════════════════════════════════════

describe('los cuatro criterios, con los números de esta corrida', () => {
  it('el cuadro', () => {
    const l = (k: string): string => MEDIDO.get(k) ?? '—';
    console.log(
      [
        '',
        '════ EL HITO 5, MEDIDO ════════════════════════════════════════════════════',
        '',
        `  (0) proveedor apagado ..... ${l('proveedor')}`,
        '',
        `  (1) la cadena de la caña ... CUMPLE en lo sustancial`,
        `        ${l('cadena')}`,
        `      la letra del documento ... NO: ${l('deshilachar')}`,
        '',
        `  (2) 20.000 ticks viva ...... NO CUMPLE`,
        `        ${l('supervivencia')}`,
        `        con el tanque lleno: ${l('tanque lleno')}`,
        `        la aritmética: ${l('aritmética')}`,
        '',
        `      lo que YA no es el problema:`,
        `        la mente quiere ... ${l('quiere')}`,
        `        y no come crudo .. ${l('toxicidad')}`,
        `                           ${l('comida')}`,
        '',
        `      DÓNDE SE CORTABA LA CADENA, y dónde se corta ahora:`,
        `        A · ${l('eslabón A')}`,
        `        B · ${l('eslabón B')}`,
        `        y por qué muere antes que antes: ${l('deambular')}`,
        '',
        `      y con el eslabón regalado: ${l('regalado')}`,
        '',
        `  (3) p99 < 5 ms ............. NO CUMPLE (medido y aceptado en @anima/world)`,
        `        ${l('p99')}`,
        `        lo que esta mente agrega: ${l('la mente')}`,
        '',
        `  (4) ticksPerdidos === 0 .... CUMPLE`,
        `        ${l('ticks perdidos')}`,
        '',
        '═══════════════════════════════════════════════════════════════════════════',
        '',
      ].join('\n'),
    );
    expect(MEDIDO.size).toBeGreaterThan(0);
  });
});
