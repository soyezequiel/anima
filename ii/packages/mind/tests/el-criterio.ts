// EL ARNÉS DEL CRITERIO DE CORTE, COMPARTIDO POR LOS SEIS ARCHIVOS QUE LO MIDEN
//
// ─── POR QUÉ ESTO EXISTE, Y NO ES UN REFACTOR DE GUSTO ──────────────────────
//
// `hito-5-el-criterio.test.ts` era UN archivo de 3054 líneas que tardaba **146 s**
// de los 148 que tardaba `@anima/mind` entero. Y la unidad de paralelismo de vitest
// es EL ARCHIVO: uno de 146 s ocupa un núcleo y deja quince mirando. El segundo
// archivo más caro del paquete tarda 47 s (`ataque-a-la-parrilla`), o sea que el
// criterio solo costaba tres veces lo que costaba todo lo demás junto.
//
// Partido en seis pedazos que corren a la vez, el paquete pasa a valer lo que vale
// su archivo más lento. **No se movió una aserción, ni un número, ni un nombre de
// test**: los cuerpos de los `it` se cortaron por rango de líneas y se pegaron tal
// cual, y lo único escrito a mano son los encabezados y los `import`.
//
// ─── DÓNDE QUEDÓ CADA BLOQUE, Y CUÁNTO TARDA ────────────────────────────────
//
//   hito-5-el-criterio.test.ts ..................... (0) proveedor · (1) la cadena · (3) el p99 ... ~11 s
//   hito-5-el-criterio-2a-la-cadena.test.ts ........ (2) el criterio y los dos eslabones ......... ~39 s
//   hito-5-el-criterio-2b-las-paredes.test.ts ...... (2) los diagnósticos 7 a 11 ................. ~17 s
//   hito-5-el-criterio-2c-la-contraprueba.test.ts .. (2) el eslabón regalado ..................... ~30 s
//   hito-5-el-criterio-2d-el-cierre.test.ts ........ (2) lo que aguanta y el tanque lleno ........ ~17 s
//   hito-5-el-criterio-4-los-ticks.test.ts ......... (4) ticksPerdidos === 0 ..................... ~47 s
//   hito-5-el-cuadro.test.ts ....................... EL HITO 5, MEDIDO ................. espera a los seis
//
// El encabezado largo —el veredicto de los cuatro criterios, con sus números y sus
// correcciones— sigue entero arriba de `hito-5-el-criterio.test.ts`, que es el que
// alguien abre cuando busca «el criterio».
//
// ─── POR QUÉ EL CORTE CAYÓ DONDE CAYÓ ───────────────────────────────────────
//
// Por COSTO medido, no por tema: el bloque (2) solo se llevaba ~100 s de los 146, y
// ningún corte que lo dejara entero servía de nada. Adentro de (2) el corte sigue
// las secciones que el cuadro ya imprimía por separado —dónde se cortaba la cadena,
// las paredes que quedan, la contraprueba del eslabón regalado y el cierre—, así que
// cada pedazo llena renglones contiguos del cuadro y se puede leer solo. El bloque
// (4), que son 42 s en dos tests, va aparte porque no comparte una sola escena con
// nadie.
//
// ─── LO QUE HAY QUE SABER SI SE VUELVE A CORTAR ─────────────────────────────
//
// **Cada archivo tiene su propia `Physics`, y eso es una condición y no un detalle.**
// `decretoDe` memoiza por `(Physics, "cx:cy")` y **la semilla NO entra en la llave**,
// así que dos corridas con semillas distintas que compartan el objeto `Physics` leen
// el decreto de la otra —ya produjo un número mal en este proyecto—. Acá se cumple
// solo: `PHYS` sale de `./mundo.js`, vitest aísla el grafo de módulos POR ARCHIVO, y
// este arnés no guarda estado entre tests. Por lo mismo, `it.concurrent` adentro de
// un archivo NO es seguro y no se usa.
//
// Y el respiro entre tests se registra desde acá: el `beforeEach` del final corre en
// el archivo que importe este módulo, que es lo que hace que no haya que repetirlo.

import { beforeEach } from 'vitest';
import { qualityOf } from '@anima/physics';
import { decretoDe } from '@anima/world';
import type { WorldBody, WorldState } from '@anima/world';
import { Contexto, Partida } from '@anima/perceive';
import { Creencias } from '../src/creencias.js';
import { Mente, vivir } from '../src/mente.js';
import type { VistaDeLaMente } from '../src/tipos.js';
import { PHYS, actor, criatura, cuerpo, enElPiso, laOrilla, mundo } from './mundo.js';
import type { Orilla } from './mundo.js';
/** El único número que se afirma contra el reloj del sistema. Ver el encabezado. */
export const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1';

/** Los ticks del criterio (2). No es un largo elegido acá: es el del documento. */
export const CRITERIO_TICKS = 20_000;

/**
 * EL TICK EN QUE EL PESCADO ENTRA A LA MANO, sobre el mundo decretado.
 *
 * No es un umbral: es un número MEDIDO por el bloque (1) —que lo imprime y lo
 * afirma `> 0`— y se copia acá porque el DIAGNÓSTICO 8 lo necesita para una
 * carrera: la yesca de la orilla se ahoga en el tick 85, y lo que decide si eso
 * importa es si el pescado llega antes o después. Era 96 con la escena plantada.
 */
export const PESCADO_EN_LA_MANO = 109;

// ─── La escena del documento ─────────────────────────────────────────────────

/**
 * «Con hambre y un río a la vista», sobre la orilla DE VERDAD de la semilla y
 * con **lo único plantado que puede quedar plantado: el cuerpo de la criatura**.
 *
 * ═══ POR QUÉ ACÁ NO HAY NI UNA VARA NI UN MATORRAL, Y ES UNA CORRECCIÓN ══════
 *
 * Hasta el tramo J esta función ponía a mano `cuerpo('vara','madera',1)` y
 * `cuerpo('matorral','liana',0,2)` y después MEDÍA esa escena para sacar
 * conclusiones sobre el mundo. Es exactamente la falla número 3 de los dieciséis
 * del traspaso —«el mundo no permite fuego: el encendible más liviano pesa
 * 1,0000 kg», que era la línea del arnés medida veinte veces— y acá venía
 * pasando de nuevo, en dos conclusiones que hubo que corregir:
 *
 *   · el `DIAGNÓSTICO 7` decía «el dios siembra 62 cuerpos y se materializan 0»
 *     y era cierto del MOTOR, no de la escena; pero la escena, sin esos 62, era
 *     la que hacía cierto el «después de atar la caña no queda nada que arda»;
 *   · el `DIAGNÓSTICO 5/6` decía «no hay una sola vara de madera de ese tamaño
 *     en el mundo» sobre un mundo de tres cuerpos, o sea sin haber mirado los 62
 *     que el dios ponía. La conclusión resultó CIERTA —está medida contra el
 *     decreto en el DIAGNÓSTICO 11— y eso no la salva: era cierta por casualidad
 *     y sobre la evidencia equivocada, que es la peor forma de tener razón.
 *
 * El tramo K reparó el motor (`world/src/step.ts`, `materializarLoDecretado` →
 * `abrirChunk`), así que la siembra a mano dejó de ser un rodeo y pasó a ser una
 * MENTIRA: la escena tendría la materia dos veces —la del arnés en la celda que
 * eligió el arnés, y la del dios corrida a la de al lado por la ley 8—. El juez
 * ya hizo esta misma corrección en `juez/tests/el-mundo-decretado.ts`.
 *
 * ─── LO QUE QUEDA PLANTADO, Y SU PORQUÉ ────────────────────────────────────
 *
 * **El cuerpo de la criatura, y nada más.** El decreto dice qué hay tirado en el
 * piso; no decreta criaturas. Alguien la tiene que poner en algún lado, y se la
 * pone en la `parada` —la celda seca pegada al pozo— porque la escena del
 * documento es «con hambre y un río a la vista» y ésa es la celda desde la que
 * se pesca.
 *
 * ─── EL ÚNICO NÚMERO QUE ESTA FUNCIÓN ELIGE, Y QUÉ COMPRA ──────────────────
 *
 * **stamina 310 de 1000.** Con el tanque lleno `energia` vale 0,0025 y D3 no
 * elige comida; con 310 vale 0,48, que es lo que hace que la meta gane. O sea
 * que el 310 es lo que la pone HAMBRIENTA, que es la premisa del criterio.
 *
 * ─── Y LO QUE SE PIERDE AL SACAR LA VARA Y EL MATORRAL, DICHO ──────────────
 *
 * Nada de la cadena, medido: el dios pone en el chunk de la parada una vara de
 * madera de 2,3280 kg (`suelta:-6:-7:0`) y una hebra de junco de 0,1590
 * (`suelta:-6:-7:1`), y la mente las ata igual. La cadena de siete eslabones sale
 * idéntica en forma, y los dos ticks se mueven en direcciones distintas: la caña
 * queda armada en el **23** contra el 32 —el junco le queda más cerca que el
 * matorral que el arnés le dejaba a dos celdas y media— y el pescado entra a la
 * mano en el **109** contra el 96, porque desde donde queda la caña el pozo está
 * más lejos. Neto: trece ticks más tarde.
 */
export function laEscenaDelDocumento(stamina = 310): WorldState {
  return conRegalo(stamina, []);
}

/**
 * LA MISMA ESCENA CON ALGO REGALADO ENCIMA, que es la forma de toda contraprueba.
 *
 * Existe para que el regalo se lea de un renglón y no se confunda con la escena:
 * lo que está en `extra` es lo que ALGUIEN PUSO, y todo lo demás lo pone el
 * mundo desde el decreto. Los cuerpos regalados entran en `state.bodies` en el
 * tick 0 y el dios materializa en el 1, así que la ley 8 corre a la suelta
 * decretada que caiga en una celda ocupada (`celdaLibreCerca`) y no al revés: un
 * regalo nunca queda tapado por el decreto.
 */
export function conRegalo(stamina: number, extra: readonly WorldBody[]): WorldState {
  const o = laOrilla();
  return mundo({
    dios: o.dios,
    bodies: [enElPiso(criatura('ana', stamina), o.parada), ...extra],
    actors: [actor('ana', { capacity: 3 })],
  });
}

/** Lo que la ley 5 le deja a una pieza de 2 kg sobre la parrilla. Medido, no elegido. */
export const COMO_LO_DEJA_EL_FUEGO = { digestibility: 0.85, toxicity: 0.0345 };

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
export function laDespensa(cuantos = 100, stamina = 310): WorldState {
  const p = laOrilla().parada;
  const cocidos: WorldBody[] = [];
  for (let i = 0; i < cuantos; i++) {
    cocidos.push(
      enElPiso(cuerpo(`cocido${String(i)}`, 'pescado', 2, COMO_LO_DEJA_EL_FUEGO, 'bloque'), p),
    );
  }
  return conRegalo(stamina, cocidos);
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
export function conFuegoYLosa(): WorldState {
  const p = laOrilla().parada;
  return conRegalo(310, [
    enElPiso(cuerpo('fogata', 'madera', 1.2, { temperature: 500 }, 'bloque'), p),
    enElPiso(cuerpo('losa', 'piedra', 0.5, {}, 'bloque'), p),
  ]);
}

// ─── LA LEÑA, Y DÓNDE SE LA PUEDE DEJAR SIN QUE SE AHOGUE ────────────────────
//
// Estas cuatro funciones son de este tramo entero, y existen porque los tres
// diagnósticos nuevos son sobre el MUNDO y no sobre la mente: lo que le falta a la
// criatura para cocinar no es saber, es que haya con qué.

/** `HUMEDAD_QUE_APAGA` de `@anima/plan`, que es el techo de lo que se prende. */
export const HUMEDAD_QUE_APAGA = 0.45;

/**
 * LA MASA DE LA YESCA MÁS CHICA QUE LLENA LA VENTANA DEL CONTACTO, y el aliento
 * que cuesta prenderla. Los dos salen de `@anima/plan` y de la física, no de acá:
 * el `roleHint` de la fila de encender pide `mass >= 0,3506875138611668`, y frotar
 * cobra `heatCapacity × ΔT / eficiencia`.
 *
 * Se escriben como constantes porque son la vara de dos tests y hay que poder
 * leerlas de un renglón; los dos las verifican contra el mundo antes de usarlas.
 */
export const YESCA_MAS_CHICA = 0.3506875138611668;
/** El calor específico de la madera de la semilla. Se verifica contra el motor. */
export const CALOR_ESPECIFICO_MADERA = 1.7;
/** Los tres números de frotar, del catálogo: ignición, ambiente y eficiencia. */
export const IGNICION_MADERA = 300;
export const AMBIENTE = 15;
export const EFICIENCIA_DE_FROTAR = 0.35;

/** El `wet` de una celda, leído del decreto y no de un cuerpo puesto ahí. */
export function humedadDeLaCelda(o: Orilla, c: { x: number; y: number }): number {
  const cx = Math.floor(c.x / 16);
  const cy = Math.floor(c.y / 16);
  const dec = decretoDe(o.dios, PHYS, cx, cy);
  const i = (((c.y % 16) + 16) % 16) * 16 + (((c.x % 16) + 16) % 16);
  return (dec.celdas[i] as { wet: number }).wet;
}

/**
 * LAS CELDAS DE VERDAD SECAS más cercanas a la parada, en orden de distancia.
 *
 * «Seca» acá quiere decir `wet < HUMEDAD_QUE_APAGA`, que es lo que la leña
 * necesita para seguir prendiéndose. `laOrilla()` usa otro umbral —`wet < 0,9`, que
 * es «no es agua»— y esa diferencia es el diagnóstico 8: la celda que la escena del
 * documento elige mide 0,6000 y ahoga cualquier yesca en noventa ticks.
 */
export function celdasSecas(o: Orilla, cuantas: number): { x: number; y: number }[] {
  const out: { x: number; y: number; d: number }[] = [];
  for (let dx = -12; dx <= 12; dx++) {
    for (let dy = -12; dy <= 12; dy++) {
      const c = { x: o.parada.x + dx, y: o.parada.y + dy };
      if (humedadDeLaCelda(o, c) >= HUMEDAD_QUE_APAGA) continue;
      const ax = dx < 0 ? -dx : dx;
      const ay = dy < 0 ? -dy : dy;
      out.push({ ...c, d: ax > ay ? ax : ay });
    }
  }
  // Orden total y estable: por distancia de Chebyshev y después por coordenada.
  out.sort((a, b) => (a.d !== b.d ? a.d - b.d : a.x !== b.x ? a.x - b.x : a.y - b.y));
  return out.slice(0, cuantas).map((c) => ({ x: c.x, y: c.y }));
}

/**
 * LA ESCENA DEL DOCUMENTO CON LEÑA, y en celdas SECAS.
 *
 * Es la contraprueba del tramo, y cada cosa que cambia está acá y no en otro lado:
 *
 *   · **cuatro varas de 0,40 kg de madera** — 0,40 cae adentro de la ventana de la
 *     yesca del contacto ([0,3507 ; 0,4871) kg) y da `emitsPower` 120,24, adentro
 *     de la ventana que la fila de cocción le pide al fuego ([105,42 ; 170,83)).
 *     CUATRO y no una porque `friccion` necesita DOS cuerpos rígidos y porque una
 *     yesca se consume: con una sola el plan sale `gap` en «rigidity>=0.5», medido;
 *   · **una celda distinta para cada una** — dos cuerpos sueltos en la misma celda
 *     es un estado ilegal, y `vigilar: true` lo canta: la primera versión de esta
 *     escena juntaba tres leñas en una celda y el arnés devolvió 20.107 violaciones
 *     en 20.000 ticks. Que las cuente es exactamente para qué está encendido;
 *   · **`stamina` a elección** — porque el diagnóstico 9 es que 310 no alcanza para
 *     encender NADA que cocine, y hay que poder correr las dos.
 *
 * Y LO QUE ESTA ESCENA NO REGALA MÁS: la vara y el matorral de la caña, que hoy
 * los pone el dios. Lo único regalado es la MASA de la leña, que es exactamente
 * lo que el diagnóstico 11 mide que el decreto no tiene.
 */
export function conLenaSeca(stamina: number, cuantas = 4): WorldState {
  const secas = celdasSecas(laOrilla(), cuantas);
  return conRegalo(
    stamina,
    secas.map((c, i) => enElPiso(cuerpo(`lena${String(i)}`, 'madera', 0.4, {}, 'vara'), c)),
  );
}

export function aliento(p: Partida, quien: string): number {
  const b = p.state.bodies.get(`${quien}-cuerpo`);
  return b === undefined ? 0 : qualityOf(b.body, 'stamina', p.state.phys);
}

/** La vista de la mente, armada como la arma la mente: con el `Ctx` de producción. */
export function vistaDe(p: Partida, quien: string): VistaDeLaMente {
  return new Contexto(p.proyeccion, { actor: quien, rng: p.dado.tirar, lugares: p.lugares }).ctx;
}

// ─── La corrida ──────────────────────────────────────────────────────────────

export interface Corrida {
  /** Ticks que avanzó EL MUNDO. Llega a `n` salvo que se haya pedido un corte. */
  readonly ticks: number;
  /**
   * LOS TICKS QUE EL BUCLE CORRIÓ DE VERDAD, y `n` si nadie cortó.
   *
   * Existe para que el corte sea legible desde el test: `ticksCorridos < n` dice
   * que la corrida terminó antes, y el `porQueParo` dice por qué. Sin esto, un
   * test que imprime «de 20.000» estaría mintiendo sobre una corrida de 6.194.
   */
  readonly ticksCorridos: number;
  /** `''` si corrió los `n` enteros. Si no, qué lo cortó. */
  readonly porQueParo: string;
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
  /**
   * LOS TRES TICKS DE LA COCINA, y son la medición nueva de este tramo.
   *
   * Van al lado de `pescoEn` y por la misma razón que aquél existe: se leen del
   * ESTADO DEL MUNDO y no de lo que la mente dice que hizo. `prendioEn` es el
   * primer tick en que hay un cuerpo con `emitsPower > 0`; `cocinoEn` el primero en
   * que hay uno con `digestibility >= 0,85` y calorías —o sea la promesa de la fila
   * cumplida sobre materia de verdad—; y `comioEn` el primer despegue de `comer` o
   * `tragar`, que es lo único de los tres que sí es una decisión y no un hecho.
   *
   * Los tres valían `-1` hasta este tramo. Ver el veredicto del encabezado.
   */
  readonly prendioEn: number;
  readonly cocinoEn: number;
  readonly comioEn: number;
  /** El aliento que tenía justo antes del primer bocado. Para la cuenta del 10. */
  readonly alientoAntesDelBocado: number;
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
 *
 * ─── LOS DOS CORTES, Y POR QUÉ SON OPT-IN ──────────────────────────────────
 *
 * Por omisión no se corta nada, y ese default es el que sostiene la frase de
 * arriba: el criterio (4) mide LA CORRIDA y necesita las 20.000 ventanas aunque
 * adentro no viva nadie. Cortar ahí no sería una optimización, sería medir otra
 * cosa.
 *
 * Los cortes se piden test por test, y solo valen donde **la conclusión ya está
 * escrita cuando el corte llega**:
 *
 *   · `pararAlMorir` — un cadáver no cambia de opinión. Todo lo que la corrida
 *     anota (`murioEn`, `pescoEn`, los tres de la cocina, los despegues) queda
 *     fijo en el tick de la muerte; lo único que sigue moviéndose después es el
 *     mundo, que este test no está midiendo.
 *   · `pararCuando` — para los tests que preguntan «¿pasa X?». Recibe lo que la
 *     corrida lleva anotado y corta cuando el test ya tiene su respuesta.
 *
 * LO QUE SE PIERDE, DICHO: el arnés de invariantes (`vigilar: true`) audita
 * menos ticks, así que una corrida cortada da menos cobertura de estados
 * ilegales que una entera. Se acepta porque la auditoría larga la paga el
 * criterio (4), que corre los 20.000 completos y no lleva corte.
 */
export function correr(
  w: WorldState,
  quien: string,
  n: number,
  o: {
    reloj?: boolean;
    cada?: number;
    /** Corta en el tick en que la criatura se va de `state.actors`. */
    pararAlMorir?: boolean;
    /** Corta cuando devuelve `true`, mirando lo que la corrida ya anotó. */
    pararCuando?: (c: {
      t: number;
      murioEn: number;
      pescoEn: number;
      prendioEn: number;
      cocinoEn: number;
      comioEn: number;
    }) => boolean;
  } = {},
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
  let prendioEn = -1;
  let cocinoEn = -1;
  let comioEn = -1;
  let alientoAntesDelBocado = 0;
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
  let corridos = 0;
  let porQueParo = '';

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
      if (comioEn < 0 && (nombre.startsWith('comer') || nombre.startsWith('tragar'))) {
        comioEn = t;
        alientoAntesDelBocado = aliento(p, quien);
      }
    }
    if (murioEn < 0) {
      if (p.state.actors.has(quien)) ultimoAliento = aliento(p, quien);
      else murioEn = t;
    }
    // El estado del mundo, que es lo único que no se puede leer mal: si hay un
    // cuerpo de pescado en la mano, pescó. Se busca sólo hasta encontrarlo.
    if (pescoEn < 0 && enLaMano(p, quien).some((s) => s.includes('pescado'))) pescoEn = t;
    // Lo mismo para el fuego y para lo cocido: se le pregunta al MUNDO, no a la
    // mente. Se barre una sola vez y sólo mientras falte alguno de los dos, que es
    // lo que hace que esto no le cueste nada a los 20.000 ticks: en la corrida del
    // criterio los dos quedan en `-1` y el barrido corre igual, pero son quince
    // cuerpos; en la de la contraprueba se apaga en el tick 251.
    if (prendioEn < 0 || cocinoEn < 0) {
      for (const b of p.state.bodies.values()) {
        if (b.body.id.startsWith('pozo:')) continue;
        if (prendioEn < 0 && qualityOf(b.body, 'emitsPower', p.state.phys) > 0) prendioEn = t;
        if (
          cocinoEn < 0 &&
          qualityOf(b.body, 'digestibility', p.state.phys) >= 0.85 &&
          qualityOf(b.body, 'calories', p.state.phys) > 0
        ) {
          cocinoEn = t;
        }
      }
    }
    if (t % cada === 0) {
      curva.push(`${String(t)}:${aliento(p, quien).toFixed(1)}`);
      muestras.push(aliento(p, quien));
    }
    // Los cortes van AL FINAL del tick, después de anotar: lo que se ahorra son
    // los ticks siguientes, nunca el que acaba de pasar.
    corridos = t + 1;
    if (o.pararAlMorir === true && murioEn >= 0) {
      porQueParo = `murió en el tick ${String(murioEn)} y no quedaba nadie a quien medir`;
      break;
    }
    if (
      o.pararCuando?.({ t, murioEn, pescoEn, prendioEn, cocinoEn, comioEn }) === true
    ) {
      porQueParo = `lo que el test pregunta quedó contestado en el tick ${String(t)}`;
      break;
    }
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const i = p.informe;

  return {
    ticks: i.ticks,
    ticksCorridos: corridos,
    porQueParo,
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
    prendioEn,
    cocinoEn,
    comioEn,
    alientoAntesDelBocado,
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
export function rechazosDelMundo(
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
export function nacidos(w: WorldState, quien: string, n: number): { total: number; peces: string[] } {
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
export function enLaMano(p: Partida, quien: string): string[] {
  const a = p.state.actors.get(quien);
  const out: string[] = [];
  for (const id of a?.holding ?? []) {
    const b = p.state.bodies.get(id);
    if (b !== undefined) out.push(b.body.parts.map((x) => x.substance).join('+'));
  }
  return out;
}

export function calorias(p: Partida, quien: string): number {
  const a = p.state.actors.get(quien);
  let total = 0;
  for (const id of a?.holding ?? []) {
    const b = p.state.bodies.get(id);
    if (b !== undefined) total += qualityOf(b.body, 'calories', p.state.phys);
  }
  return total;
}

export const dos = (x: number): string => x.toFixed(2);
// ─── UN RESPIRO ENTRE TESTS, Y NO ES COSMÉTICA ───────────────────────────────
//
// Este archivo son **ochenta segundos de bucle sincrónico** —el criterio pide
// 20.000 ticks y hay siete corridas que los hacen— y eso rompe el worker de vitest
// por un lado que no tiene nada que ver con lo que se está midiendo:
//
//     Error: [vitest-worker]: Timeout calling "onTaskUpdate"
//
// El mecanismo, leído del paquete: el runner le manda al proceso principal el
// resultado de cada test por RPC (`vitest/dist/chunks/index.CwejwG0H.js` parchea
// `onTaskUpdate` para que devuelva la promesa de `rpc().onTaskUpdate`), birpc le
// pone un vencimiento de 60 s con un `setTimeout`, y el aviso de vuelta llega por
// IPC. Un `for` sincrónico de 34 segundos no deja correr NI el temporizador NI la
// lectura del socket; cuando por fin suelta el hilo, Node corre la fase de
// TEMPORIZADORES antes que la de POLL, así que el vencimiento gana la carrera
// aunque la respuesta ya esté en la cola. El resultado es una suite con los 291
// tests en verde y `exit 1`, que es la peor clase de rojo: enseña a ignorarlo.
//
// Un `await` sobre una promesa ya resuelta NO alcanza —eso es una microtarea y no
// drena la fase de poll—: hace falta un `setTimeout`, que es una macrotarea de
// verdad. Va en un `beforeEach` de raíz para no tocar el cuerpo de ningún test, y
// por lo tanto NO puede mover ninguna medición: corre antes de que el test empiece,
// y las dos cosas que este archivo mide con reloj de pared —`ms` y
// `ticksPerdidos`— arrancan su cronómetro adentro de `correr`.
beforeEach(async () => {
  await new Promise((listo) => {
    setTimeout(listo, 0);
  });
});
