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
//   (2) NO SE CUMPLE. La criatura se muere de hambre en el tick 6194 de 20.000
//       —el 31%— con CERO bocados comidos. El tick de la muerte no se movió ni
//       uno desde la primera medición; **todo lo demás sí, y lo que se movió es
//       el diagnóstico entero.**
//
//       ─── PRIMERO, UNA CORRECCIÓN DE ESTE MISMO ARCHIVO ───────────────────
//
//       Donde decía «pescas 199» decía una cosa falsa, y la escribió esta línea:
//       `r.cuenta.get('aplicar(extraccion)')`, que cuenta DESPEGUES y no
//       aterrizajes. Medido ahora, contando las dos cosas por separado:
//
//         199 despegues de `aplicar(extraccion)`
//         197 aterrizaron con `ok:false` («extraccion no dio resultado en 1 intentos»)
//           2 eventos `nacio` en toda la corrida: la caña y UN pescado
//
//       **Sacó UN pescado, no 199.** La frase «pescó 199 veces y se murió de
//       hambre» viajó por tres documentos y un ADR, y era un artefacto del
//       contador. Lo que hacía las otras 198 veces está medido abajo.
//
//       ─── LO QUE LE CONTESTA EL MUNDO, Y ES LA PISTA ──────────────────────
//
//       De los 197 rechazos, **196 son `sin-pozo`** —«no hay stock detrás de ese
//       cuerpo»— y uno solo es `no-pico`. Y el banco del dios al que le apunta
//       termina la corrida con 129,91 kg de stock: no se vació nunca (eso sería
//       `pozo-vacio`, y no aparece). O sea que no le fallaba la suerte ni se le
//       agotó el río: **le estaba pescando a otra cosa**. A qué, medido con los
//       roles del paso que el planificador emite:
//
//           aplicar(extraccion)  gear = w000000001 (la caña)
//                                source = w000000002 (EL PESCADO QUE TIENE EN LA MANO)
//
//       Le tira la caña adentro del pescado que ya pescó. 196 veces.
//
//       ─── LOS DOS ESLABONES DONDE SE CORTA LA CADENA ──────────────────────
//
//       (A) **La mitad de abajo: `holding(tag:carnoso)` no se sabe cumplida.**
//           `cumpleCuerpo` de `@anima/plan` contesta `false` para TODA forma
//           `sostiene` —una `BodyView` no trae la sustancia ni sus tags— así que
//           todo plan que quiera algo carnoso arranca con «pescá uno», y el rol
//           `source` de `extraccion` sólo pide `mass > 0`: el cuerpo más cercano
//           que cumple es el pescado de su propia mano. Un paso que falla se
//           lleva puesto el plan entero, así que replanifica, sale el mismo plan,
//           y vuelve a fallar. **Ése es el bucle que consume la corrida.**
//
//       (B) **La mitad de arriba: no sabe pedir un fuego de la potencia justa.**
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
//           (emitsPower 310,62) el plan CIERRA en 7 expansiones** y sale
//           `aplicar → ir → poner → poner → sostener`, que es pescar, ir al
//           fuego, apoyar la losa encima, apoyar el pescado en la losa y
//           levantarlo cocido. O sea que el planificador sabe LIGAR un fuego que
//           existe; lo que no sabe es ENCENDER uno del que pueda prometer la
//           potencia.
//
//       ─── Y EL VENENO, QUE ES LO QUE VOLVIÓ OBLIGATORIO EL FUEGO ──────────
//
//       Forzada a tragar, el pescado crudo le SACA 11,56 de aliento (231 ticks de
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
//       murió en −1, 65 bocados, aliento final 1,4331. No es que coasteó con lo
//       que traía puesto: la cuenta cierra en 310 (inicial) + 691,43 (comidos)
//       − 1000 (vivir) = 1,43. Comió, y por eso llegó.
//
//       El número que hace que esto no sea opinable: **20.000 ticks a 20 Hz son
//       1000 segundos de mundo, `COSTO_VIVIR_POR_SEGUNDO` es 1,0 y el tanque de
//       `stamina` topa en 1000.** O sea que el criterio (2), dicho en la moneda
//       del mundo, es literalmente «comé al menos una vez». Medido: con el tanque
//       LLENO tampoco llega — se muere en el 19.995, y eso NO es «a cinco ticks
//       del final»: es exactamente haber sobrevivido lo que traía puesto y ni un
//       segundo más, porque 1000 de tanque SON los 1000 segundos de la corrida.
//       (Antes de la reparación del tramo G eran 18.524: se quedaba pegada a una
//       meta que ningún esquema establece y se pasaba media vida deambulando.)
//
//   (4) SE CUMPLE, y medido con un reloj de pared de verdad, que es la única
//       forma de que el contador pueda moverse. Sin reloj, `porTiempo` es cero
//       POR CONSTRUCCIÓN (`bucle.ts`: «sin reloj de pared no hay ninguna ventana
//       que vencer») y un `expect(0)` no mediría nada. Con reloj: entre 0,08 y
//       0,13 ms de trabajo por tick contra una ventana de 50 ms, y CERO ticks
//       perdidos en los 20.000, ni por tiempo ni por falla. Sobra un factor de
//       entre 400 y 600. (Los milisegundos se mueven entre corridas porque son
//       reloj de máquina; los que gobiernan son los que imprime la corrida de
//       hoy, no los de este comentario. Lo que no se mueve es el cero.)
//
//       De ese total, el mundo se lleva ~0,034 ms y la mente ~0,041 encima
//       —medido aparte, sobre 4000 ticks con una criatura—: la escalera cuesta
//       del orden de lo que cuesta el `stepWorld` de este mundito, y las dos
//       juntas entran cientos de veces en la ventana. Lo que hace inalcanzable el
//       (3) no es la mente: son 5000 cuerpos de física, que es lo que aquel banco
//       ya diagnosticó.
//
// ═══ CÓMO SE MIDE ACÁ ═══════════════════════════════════════════════════════
//
// Los números se IMPRIMEN siempre y se AFIRMAN siempre, con DOS excepciones que
// siguen el patrón ya decidido del proyecto —`ANIMA_BANCO=1`—: el que depende del
// reloj del sistema (el de pared del criterio 4), porque un test de rendimiento
// adentro de la suite normal es flaky y un test flaky enseña a ignorar el rojo; y
// el más CARO de todos (los 20.000 ticks con la despensa de cien cuerpos, 4,1 s
// medidos), que se imprime siempre y se afirma sólo midiendo en serio. Ése tiene
// al lado una corrida corta —2000 ticks— que SÍ afirma siempre, así que la guarda
// de regresión existe igual sin pagar los cuatro segundos en cada `pnpm ii:test`.
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
  readonly aliento: readonly string[];
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
function correr(w: WorldState, quien: string, n: number, o: { reloj?: boolean } = {}): Corrida {
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
  let murioEn = -1;
  let ultimoAliento = 0;
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
    if (t % 2000 === 0) curva.push(`${String(t)}:${aliento(p, quien).toFixed(1)}`);
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
    aliento: curva,
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

    const primeraPesca = r.cuando[r.nombres.indexOf('aplicar(extraccion)')];
    MEDIDO.set(
      'cadena',
      `7 eslabones, primera pesca en el tick ${String(primeraPesca ?? -1)}, ` +
        `${dos(calorias(r.partida, 'ana'))} calorías en la mano`,
    );
    console.log(
      `\n─── LA CADENA DE LA CAÑA, CONTRA EL MUNDO DE VERDAD ───\n${r.volados.slice(0, 8).join('\n')}\n` +
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
    'CRITERIO: 20.000 ticks viva — se muere de hambre a un tercio del camino',
    () => {
      // LA SALIDA MEDIDA, y está impresa abajo por la corrida de verdad:
      //
      //   murió en el tick 6194 de 20.000 (31%), con el aliento en 0
      //   199 DESPEGUES de aplicar(extraccion), 197 aterrizajes con ok:false, 0 bocados
      //   aliento: 0:309,9 → 2000:209,7 → 4000:109,7 → 6000:9,7   (−0,05 por tick, clavado)
      //
      // Los −0,05 por tick son `COSTO_VIVIR_POR_SEGUNDO / hz` y NADA MÁS: después
      // del tick 66 la criatura no camina, se queda al lado del pozo tirando la caña
      // adentro del pescado que ya tiene en la mano. O sea que no se muere por gastar
      // de más: se muere porque **cada plan suyo arranca por un paso que el mundo
      // rechaza, y un paso que falla se lleva el plan entero**.
      //
      // ─── LO QUE ESTE MISMO TEST IMPRIMÍA MAL, Y HAY QUE DEJARLO ESCRITO ─────
      //
      // Decía `pescas 199` leyendo `r.cuenta`, que cuenta DESPEGUES. La frase
      // «pescó 199 veces y se murió de hambre» salió de acá y viajó a tres
      // documentos y a un ADR. Sacó UN pescado. La cuenta de aterrizajes está abajo
      // y es la que gobierna de acá en adelante.
      //
      // POR QUÉ NO SE ABLANDA A «sobrevive lo que pueda»: el criterio es del
      // documento de arquitectura y es el criterio de corte del proyecto. Los tests
      // que siguen miden POR QUÉ no llega, que es lo único que sirve para decidir
      // qué se hace.
      const r = correr(laEscenaDelDocumento(), 'ana', CRITERIO_TICKS);
      const despegues = r.cuenta.get('aplicar(extraccion)') ?? 0;
      const pescadas = r.aterrizados.get('aplicar(extraccion)') ?? 0;
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
          `\n  pescas DE VERDAD ${String(pescadas)} de ${String(despegues)} intentos · bocados ${String(comidas)} · ` +
          `ticks perdidos ${String(r.ticksPerdidos)} · ${r.ms.toFixed(0)} ms de reloj\n` +
          `  ARNÉS DE INVARIANTES: ${String(r.violaciones.length)} estados ilegales en ${String(CRITERIO_TICKS)} ticks` +
          `${r.violaciones.length === 0 ? ' (y por primera vez alguien estaba mirando)' : `\n      ${r.violaciones.slice(0, 5).join('\n      ')}`}\n`,
      );
      MEDIDO.set(
        'supervivencia',
        `murió en el tick ${String(r.murioEn)} de ${String(CRITERIO_TICKS)} · ` +
          `${String(pescadas)} pescas DE VERDAD en ${String(despegues)} intentos · ${String(comidas)} bocados`,
      );

      // Lo que la corrida tiene que seguir mostrando aunque el criterio esté rojo.
      expect(despegues).toBeGreaterThan(100);
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

  it('DIAGNÓSTICO 1/5 · LO QUE YA NO PASA: la mente SÍ tiene por dónde comer, y quiere lo cocido', () => {
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

  it('DIAGNÓSTICO 2/5 · y no come porque el crudo la MATA: `comer` rechaza el pescado', () => {
    // La innata filtra `calories > 0 && toxicity <= toxicidadTolerada`, con el
    // tolerado en 0,2 por omisión. Y el pescado que ella misma sacó del agua mide
    // 0,2761 — apenas por encima, y no porque se haya podrido: la sustancia
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

  it('DIAGNÓSTICO 3/5 · forzada a comer, el pescado CRUDO le SACA aliento (ADR II-0013)', () => {
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
    //   · **no pescó 199**: pescó UNO. Las otras 198 veces tiró la caña y el mundo
    //     le contestó que ahí no había pozo (ver el DIAGNÓSTICO 4/5);
    //   · y **no le servían crudas**: con el ADR II-0013 el mundo cobra `toxicity`
    //     al tragar, y el mismo pescado le SACA 11,56. El «le sobraba comida» se
    //     apoyaba en un hueco: comer veneno salía gratis.
    //
    // ─── QUÉ SIGNIFICA PARA EL CRITERIO (2), dicho sin adornos ─────────────
    //
    // No hay número de pescados CRUDOS que alcance. Para llegar a los 20.000 hay
    // que cocinar, y la tolerancia de 0,2 de la innata dejó de ser prudencia sin
    // respaldo: el `DIAGNÓSTICO 2/5` mide un rechazo que ahora el mundo respalda.
    //
    // Lo que la cadena del fuego ya sabe hacer está medido y anda
    // (`world/tests/el-fuego.test.ts`, `perceive/tests/ataque-a-la-costura.test.ts`):
    // el mismo pescado cocido deja +16,08. Que la mente ya lo QUIERE lo mide el
    // 1/5; dónde se le corta la cadena, el 4/5 y el 5/5.
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

  it('DIAGNÓSTICO 4/5 · ESLABÓN A: le tira la caña adentro del pescado que tiene en la mano', () => {
    // ─── EL ESLABÓN QUE SE COME LA CORRIDA, Y NADIE LO HABÍA MIRADO ────────
    //
    // 199 despegues de `aplicar(extraccion)` y UN pescado. Lo que pasaba las otras
    // 198 veces lo dice el mundo, y lo dice con una palabra que es un diagnóstico
    // entero: **`sin-pozo`**, «no hay stock detrás de ese cuerpo». No es que no
    // picara (eso sería `no-pico`, y pasó UNA vez) ni que se hubiera vaciado el
    // río (eso sería `pozo-vacio`, y el pozo termina la corrida con 129,915 kg).
    //
    // Le estaba pescando a otra cosa. A qué, con los roles del paso que el
    // planificador emite:
    //
    //     aplicar(extraccion)  gear   = w000000001  (la caña que ella misma ató)
    //                          source = w000000002  (EL PESCADO DE SU PROPIA MANO)
    //
    // ─── POR QUÉ, Y POR QUÉ NO ES UN BUG DE LA MENTE ───────────────────────
    //
    // Son dos cosas que se juntan, y ninguna de las dos vive en este paquete:
    //
    //   · `cumpleCuerpo` de `@anima/plan` contesta `false` para TODA forma
    //     `sostiene` —una `BodyView` no trae la sustancia ni sus tags— así que
    //     `holding(tag:carnoso)` no se da por cumplida NUNCA, ni con el pescado
    //     agarrado. Todo plan que quiera algo carnoso arranca con «pescá uno»;
    //   · y el rol `source` de `extraccion` pide `mass > 0` y nada más —el mundo
    //     distingue un pozo de un pescado con el motivo `sin-pozo`, que no es
    //     expresable en un `Where`, y está dicho en `regresion.ts`— así que el
    //     cuerpo más cercano que califica es el que tiene en la mano.
    //
    // Y como un paso que falla se lleva puesto el plan entero, replanifica, sale
    // el mismo plan, y vuelve a fallar. **Ése es el bucle que consume los 6194
    // ticks**, y es AGUAS ARRIBA del fuego: aunque supiera encender, no pasaría de
    // este primer paso.
    const rechazos = rechazosDelMundo(laEscenaDelDocumento(), 'ana', 6300);
    const sinPozo = rechazos.porQue.get('apply/sin-pozo') ?? 0;
    const noPico = rechazos.porQue.get('apply/no-pico') ?? 0;
    const nac = nacidos(laEscenaDelDocumento(), 'ana', 6300);

    // A quién le pesca, leído del plan de verdad y no del relato.
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
    const paso = (r.k === 'plan' ? r.steps : r.k === 'gap' ? r.nearest : []).find(
      (s) => s.k === 'aplicar',
    );
    const roles = paso !== undefined && paso.k === 'aplicar' ? paso.roles : {};
    const enMano = new Set(p.state.actors.get('ana')?.holding ?? []);
    const fuente = roles['source'];
    const seLaTiraAlPescado =
      fuente !== undefined && fuente.k === 'id' && enMano.has(fuente.id ?? '');

    console.log(
      `\n─── A QUIÉN LE ESTÁ PESCANDO ───\n` +
        `  rechazos del mundo en 6300 ticks: ${[...rechazos.porQue].map(([k, n]) => `${k}×${String(n)}`).join(' · ')}\n` +
        `  cuerpos NACIDOS en toda la corrida: ${String(nac.total)} → ${nac.peces.join(', ') || '(ningún pescado)'}\n` +
        `  el paso que emite el planificador: aplicar(${paso?.k === 'aplicar' ? paso.proceso : '?'}) ` +
        `${JSON.stringify(roles)}\n` +
        `  y en la mano tiene: ${[...enMano].join(', ')}\n` +
        `  → el \`source\` ${seLaTiraAlPescado ? 'ES lo que tiene en la mano' : 'no es lo que tiene en la mano'}\n` +
        `  el pozo al que le apunta, al final de la corrida: ${dos(rechazos.pozo)} kg de stock — nunca se vació\n`,
    );

    // `sin-pozo` domina: no es mala suerte ni escasez, es que apunta mal.
    expect(sinPozo).toBeGreaterThan(100);
    expect(sinPozo).toBeGreaterThan(noPico * 10);
    // Y sacó UN pescado, no 199. `nacio` cuenta cuerpos nuevos: la caña y el pez.
    expect(nac.peces.length).toBe(1);
    expect(seLaTiraAlPescado).toBe(true);
    // Y el pozo NO se vació: si se hubiera vaciado, el motivo sería `pozo-vacio`.
    expect(rechazos.pozo).toBeGreaterThan(100);
    MEDIDO.set(
      'eslabón A',
      `${String(sinPozo)} × \`sin-pozo\`: le pesca al pescado de su propia mano ` +
        `(\`source\` = ${fuente?.k === 'id' ? String(fuente.id) : '?'}), y el pozo sigue lleno`,
    );
  }, 300_000);

  it('DIAGNÓSTICO 5/5 · ESLABÓN B: sabe LIGAR un fuego, no sabe pedir uno de la potencia justa', () => {
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
    // cierra**: `aplicar → ir → poner → poner → sostener`, que es pescar, ir al
    // fuego, apoyar la losa encima, apoyar el pescado en la losa y levantarlo
    // cocido. Nadie escribió «parrilla»: sale de que la pila tiene tres cuerpos.
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
    expect(conFuego.steps.map((s) => s.k)).toEqual(['aplicar', 'ir', 'poner', 'poner', 'sostener']);

    MEDIDO.set(
      'eslabón B',
      `gap «${sinFuego.missing}» (lo más cerca del catálogo es \`emitsPower>0\`); ` +
        `con un leño ardiendo a ${potencia.toFixed(2)} el plan CIERRA en ${String(conFuego.expansiones)} expansiones`,
    );
  }, 120_000);

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
    // Y el número se movió con la reparación del tramo G, así que conviene tener
    // los dos: **antes moría en el 18.524** —se quedaba pegada a una meta sin
    // esquema y se pasaba media vida en las conductas de fondo, que caminan— y
    // **ahora muere en el 19.995**.
    //
    // ─── CÓMO NO SE LEE ESTE NÚMERO ────────────────────────────────────────
    //
    // «Murió en el 19.995: le faltaban CINCO ticks» es la lectura equivocada, y
    // se escribió una vez. 1000 de tanque SON 1000 segundos de vida, o sea los
    // 20.000 ticks exactos de la corrida: lo que este número dice no es «estuvo a
    // cinco ticks», es **«sobrevivió exactamente lo que traía puesto y ni un
    // segundo más»**. Los cinco ticks son las cinco celdas que caminó armando la
    // caña. El criterio (2) no es «aguantá»: es «comé al menos una vez», y acá
    // comió cero.
    const r = correr(laEscenaDelDocumento(1000), 'ana', CRITERIO_TICKS);
    expect(r.murioEn).toBeGreaterThan(0);
    expect(r.murioEn).toBeLessThan(CRITERIO_TICKS);
    const bocados = [...r.cuenta]
      .filter(([k]) => k.startsWith('tragar'))
      .reduce((a, [, v]) => a + v, 0);
    expect(bocados).toBe(0);
    console.log(
      `\n  con el tanque lleno (1000): murió en el tick ${String(r.murioEn)} de ${String(CRITERIO_TICKS)} · ` +
        `${String(r.aterrizados.get('aplicar(extraccion)') ?? 0)} pescas DE VERDAD en ` +
        `${String(r.cuenta.get('aplicar(extraccion)') ?? 0)} intentos · ${String(bocados)} bocados · ${r.ms.toFixed(0)} ms\n` +
        `  y eso NO es «a cinco ticks del final»: 1000 de tanque son los 20.000 ticks enteros,\n` +
        `  así que lo que midió es haber sobrevivido lo que traía puesto sin comer nada.\n`,
    );
    MEDIDO.set(
      'tanque lleno',
      `murió en el tick ${String(r.murioEn)} de ${String(CRITERIO_TICKS)} con ${String(bocados)} bocados: ` +
        `gastó el tanque entero y no comió`,
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
    const conMente = correr(laEscenaDelDocumento(1000), 'ana', 4000);
    const p = new Partida(laEscenaDelDocumento(1000));
    const t0 = process.hrtime.bigint();
    p.avanzar(4000);
    const soloMundo = Number(process.hrtime.bigint() - t0) / 1e6;

    const porTick = conMente.ms / 4000;
    console.log(
      `\n─── LO QUE LA MENTE LE AGREGA AL TICK (1 criatura, 4000 ticks) ───\n` +
        `  mundo solo ......... ${(soloMundo / 4000).toFixed(4)} ms/tick\n` +
        `  mundo + mente ...... ${porTick.toFixed(4)} ms/tick\n` +
        `  la mente ........... ${((conMente.ms - soloMundo) / 4000).toFixed(4)} ms/tick ` +
        `(la ventana de un tick a ${String(HZ_DE_REFERENCIA)} Hz son ${(1000 / HZ_DE_REFERENCIA).toFixed(0)} ms)\n`,
    );
    MEDIDO.set(
      'la mente',
      `${((conMente.ms - soloMundo) / 4000).toFixed(4)} ms/tick encima de ` +
        `${(soloMundo / 4000).toFixed(4)} del mundo, con 1 criatura`,
    );
    // Sin aserción de tiempo: es informativo y corre al lado de los otros
    // paquetes. Lo único que se afirma es que las dos corridas hicieron el trabajo.
    expect(conMente.ticks).toBe(4000);
    expect(p.informe.ticks).toBe(4000);
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
        `      DÓNDE SE CORTA LA CADENA, los dos eslabones:`,
        `        A · ${l('eslabón A')}`,
        `        B · ${l('eslabón B')}`,
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
