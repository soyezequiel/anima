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
// ═══ EL ARNÉS DEJÓ DE PLANTAR LA ESCENA, Y ESO CAMBIA QUÉ SIGNIFICAN ESTOS ══
// ═══ NÚMEROS ═══════════════════════════════════════════════════════════════
//
// Hasta el tramo J, `laEscenaDelDocumento()` ponía a mano una vara de madera de
// 1 kg y un matorral de liana de 0,2 kg, le pedía al dios sólo el terreno y el
// pozo, y después medía ESA escena para sacar conclusiones sobre el mundo. Dos
// de las conclusiones que salieron de acá hubo que corregirlas después.
//
// Desde el tramo K el mundo materializa lo que el dios decreta
// (`world/src/step.ts`, `materializarLoDecretado` → `abrirChunk`), así que la
// siembra a mano dejó de ser un rodeo y pasó a ser una mentira: la materia
// estaría DOS VECES. **Lo único plantado en todo el archivo es el cuerpo de la
// criatura** (y, donde hay una contraprueba, el regalo que la contraprueba
// existe para regalar, con su nombre y su porqué al lado).
//
// Lo que la orilla de la semilla `20260727` pone sola alrededor de la parada:
// **62 sueltas decretadas en los 3×3 chunks, 62 materializadas**, y a los 400
// ticks 95 sueltas en el piso (el chunk se abre cuando alguien llega). Entre
// ellas la vara de madera de 2,3280 kg y la hebra de junco de 0,1590 con las que
// la criatura se hace la caña sin que nadie se las ponga.
//
// ═══ EL VEREDICTO, ARRIBA Y SIN ADORNOS ═════════════════════════════════════
//
//   (1) SE CUMPLE en lo sustancial y NO en la letra.
//
//       La cadena entera sale sola contra `stepWorld`, sin proveedor y sin que
//       nadie le diga qué hacer, y ahora **sobre materia que puso el mundo**: de
//       «me falta aliento» a un pescado en la mano, en siete eslabones. Ninguno
//       de los cuerpos que nombra lo puso el arnés:
//
//           ir(suelta:-6:-7:0) → sostener(suelta:-6:-7:0)      la vara, 2,3280 kg
//           ir(suelta:-6:-7:1) → sostener(suelta:-6:-7:1)      el junco, 0,1590 kg
//           unir(suelta:-6:-7:1+suelta:-6:-7:0)                la caña, madera+junco
//           ir(pozo:-6:-6) → aplicar(extraccion)               el pescado, 2,887 kg
//
//       La caña queda armada en el tick 23 (con la escena plantada era el 32) y
//       el pescado entra a la mano en el **109** (era el 96: el pozo le queda más
//       lejos que la vara que el arnés le dejaba a tres celdas).
//
//       Lo que NO sale es el eslabón `deshilachar` que la frase del documento
//       nombra, y no porque la mente no sepa: porque ESTA FÍSICA NO LO PIDE.
//       Medido con cinco matorrales distintos —de 0,2 a 2 kg, en hebra y en
//       bloque, y ahora ENCIMA del mundo decretado—: los cinco se atan derecho a
//       la vara y ninguno necesita partirse antes. Está clavado en un `it.fails`.
//
//   (2) NO SE CUMPLE. Muere en el tick 3743 de 20.000 con CERO bocados.
//
//       Y el número no se puede comparar con el de ningún tramo anterior sin
//       decir por qué, porque los tres anteriores se midieron sobre una escena
//       inventada: 3627 (escena plantada), 6184 (mundo decretado + un bucle que
//       no gastaba aliento, ver más abajo) y **3743 hoy**.
//
//       ─── LO QUE EL MUNDO DECRETADO CERRÓ, Y LO QUE DESTAPÓ ───────────────
//
//       **La pared (7) está cerrada**: el dios decreta 62 sueltas en los nueve
//       chunks de la parada y el mundo las pone en el piso, las 62. Ya no hay
//       «tres cosas en el mundo entero». Y con eso quedaron a la vista dos cosas
//       que la escena inventada tapaba:
//
//         · **UN BUCLE DE LA MENTE, y era el que se llevaba la vida entera.**
//           `plan()` contesta `gap` con un `nearest` de un paso —«acercate a lo
//           que podría hacer de parrilla»— y la criatura ya está A UNA CELDA de
//           esa pieza, así que el `ir` aterriza con `ok:true` sin mover una pata
//           y al tick siguiente sale igual. Medido antes de arreglarlo:
//           **6045 despegues de `ir(suelta:-6:-7:2)` en 6171 ticks** con tanque
//           310, y **19.846 en 19.971** con el tanque lleno. El 98% de su vida
//           dando un paso que ya estaba dado. Está arreglado en `src/` con un
//           cerrojo por firma (`EstadoDeLaEscalera.mientrasTantoYaHecho`) y
//           medido en el DIAGNÓSTICO 11; sin el arreglo la criatura **no prende
//           fuego ni con la leña seca al lado**, o sea que la cadena de la
//           cocción se cae entera;
//         · **LA MADERA DEL DECRETO NO ES YESCA.** De las 62 sueltas, madera hay
//           UNA y pesa **2,3280 kg**, contra una ventana de yesca de
//           [0,3507 ; 0,4871) kg — casi **cinco veces** el techo. Y la mente se
//           la gasta en la caña, que es lo único para lo que le sirve. O sea que
//           la pared (7) se movió de «no hay leña» a **«no hay leña DEL TAMAÑO
//           que la fricción admite»**, que es una pared del oráculo y no del
//           motor. Medido en el DIAGNÓSTICO 11.
//
//       ─── Y LA CADENA ENTERA SIGUE CORRIENDO, CON LA LEÑA REGALADA ────────
//
//       **La cadena existe, sale de `plan()` en un solo pedido y CORRE contra
//       `stepWorld`**: regalándole cuatro varas de 0,40 kg en celdas de verdad
//       secas —y NADA MÁS: la vara y el junco de la caña los sigue poniendo el
//       dios— y con el tanque lleno, la corrida mide
//
//           tick 163  el primer cuerpo del mundo con `emitsPower > 0`   PRENDIÓ
//           tick 263  el primero con `digestibility >= 0,85` y calorías  COCINÓ
//           tick 271  el primer `tragar`, y aterriza con `ok: true`      COMIÓ
//
//       y los dieciséis despegues salen en fila, sin que nadie los escriba:
//
//           ir → sostener → ir → sostener → unir     la caña, del decreto
//           ir → aplicar → ir → aplicar              dos pescados
//           ir → sostener → frotar                   el fuego, con la leña regalada
//           poner → esperar(15 s) → sostener         la cocción
//           tragar                                   el bocado
//
//       Y aun así **muere en el 5672 con UN bocado**, que es la pared (10): el
//       fuego cuesta ~485 de aliento y un pescado cocido de 2,887 kg devuelve
//       21,81. Un fuego vale veintidós pescados.
//
//       ─── LAS PAREDES QUE QUEDAN, CADA UNA CON SU TEST ────────────────────
//
//         8 · SE AHOGA. La celda que `laOrilla()` llama seca mide `wet` 0,6000
//             (su prueba es `wet < 0,9`), la `moisture` de la yesca relaja hacia
//             ahí y cruza el 0,45 que apaga en el tick **85**. El pescado no
//             llega a la mano hasta el 109: pierde la carrera por 24 ticks.
//             Tenerla en la mano no la protege y a UNA celda hay tierra con
//             `wet` 0,1500.
//         9 · EL FUEGO CUESTA MÁS QUE EL TANQUE. La yesca más chica que llena la
//             ventana del contacto pesa 0,3506875 kg y frotar cobra
//             `heatCapacity × ΔT / 0,35` = **485,45** de aliento. La escena le da
//             **310**, y los 310 no son de gusto: están puestos para que tenga
//             hambre. Medido: frotó 25 ticks a 11,7071 y murió en el 141 con la
//             leña a 169,67 °C de 300.
//        10 · Y AUN ASÍ NO CIERRA, por aritmética. Ver arriba.
//        11 · EL BUCLE Y EL TAMAÑO DE LA MADERA. Ver arriba.
//
//       ─── LO QUE SE CERRÓ EN TRAMOS ANTERIORES, Y SIGUE CERRADO ───────────
//
//                                    tramo G/H            hoy
//         tiros de caña                        199           2
//         rechazos `apply/sin-pozo`            196           0
//         pescados sacados del agua              1           1
//         plan(holding(tag:carnoso))    aplicar(…)   0 pasos: ya está cumplida
//
//       Eran dos bugs acotados y estaban los dos afuera de este paquete:
//       `cumpleCuerpo` de `@anima/plan` contestaba `false` para TODA forma
//       `sostiene` —un `case 'sostiene': return false` literal—, así que
//       `holding(tag:carnoso)` no se daba por cumplida ni con el pescado
//       agarrado; y el rol `source` de `extraccion` pedía `mass > 0` y nada más,
//       así que el cuerpo más cercano que calificaba era el de su propia mano.
//       El bucle de 199 tiros de caña adentro de su propio pescado ya no existe.
//
//       ─── DE DÓNDE SALE CADA GRAMO, QUE ES CÓMO NO SE LEE MAL EL 3743 ─────
//
//       Está medido aparte (DIAGNÓSTICO 6/6): la pendiente del aliento entre el
//       tick 100 y el 2000 es **0,08242/tick contra 0,05000 de sólo respirar, o
//       sea 1,65×**, y la diferencia son las patas. Con el pescado en la mano y
//       sin vía al fuego, la mente cae a las conductas de fondo —explorar,
//       guarecerse, juntar— y explorar son ocho ticks de patas.
//
//       Los cuatro números que hay que leer JUNTOS, porque sueltos mienten:
//
//         6194  escena plantada, bucle de la caña: PARADA, 0,0500/tick
//         6184  mundo decretado, bucle del `ir`:   PARADA, 0,0500/tick
//         3627  escena plantada, sin bucle:        camina, 0,0864/tick
//         3743  mundo decretado, sin bucle:        camina, 0,0824/tick
//
//       Los dos que aguantan más son los dos que no hacen NADA. El criterio (2)
//       no se mide en ticks aguantados —se mide en si comió, y las cuatro
//       corridas comieron cero—.
//
//       Y de paso se ve algo que nadie estaba mirando: **el pescado se le pudre
//       en la mano** mientras espera. Sale del agua con `toxicity` 0,25 y a los
//       3000 ticks marca 0,5725; pudrirse no le saca el tag `carnoso`, así que la
//       meta que lo retiene sigue cumplida.
//
//       ─── EL ESLABÓN QUE ERA «EL ÚNICO QUE QUEDA», Y SE CERRÓ ────────────
//
//       Acá decía, con estas palabras: «**no sabe pedir un fuego de la potencia
//       justa**», y lo medía con `missing «emitsPower<410&emitsPower>=253»` y el
//       porqué textual «lo más cerca que llega el catálogo es «emitsPower>0»».
//       Está cerrado, y se cerró de dos lados que no eran el que se esperaba:
//
//         · `@anima/plan` dejó de tener UNA fila de cocción con el montaje clavado
//           en la parrilla: barre los tres montajes por tres distancias y saca DOS
//           filas, y le agregó a `friccion` las dos que acotan el producto
//           `fuelEnergy × mass` que ES `emitsPower`. Con eso el catálogo YA
//           establece las dos puntas de una ventana, y el mismo `why` que decía
//           «lo más cerca es emitsPower>0» hoy nombra «emitsPower>=105,42» y
//           «emitsPower<170,83». Está afirmado en el DIAGNÓSTICO 5/6;
//         · y faltaba UN PASO que no era de potencia sino de TIEMPO. `Step` tenía
//           diez variantes y ninguna era esperar, así que el plan ponía la comida
//           sobre el fuego y la levantaba dos ticks después: medido, `poner` en el
//           151 y `sostener` en el 153, la ley 5 corriendo dos ticks y la
//           `digestibility` del pescado clavada en 0,3800 en veinte mil. La innata
//           `esperar` ya existía; lo que faltaba era la costura —`{k:'esperar'}` en
//           `Step`, un caso en `firmaDePaso`, y los dos `switch` de este paquete—.
//
//       Con las dos cosas puestas, el pedido de la mente sale COMPLETO en un solo
//       plan, quince pasos y dieciséis expansiones, y nadie los escribió:
//
//           ir → sostener → ir → sostener → unir      la caña
//           ir → aplicar                              el pescado
//           ir → sostener → ir → sostener → frotar    el fuego
//           poner → esperar → sostener                la cocción
//
//       ─── Y EL VENENO, QUE ES LO QUE VOLVIÓ OBLIGATORIO EL FUEGO ──────────
//
//       Forzada a tragar, el pescado crudo le SACA 10,91 de aliento (218 ticks de
//       vida menos). Antes del ADR II-0013 daba **+8,37** y la lectura de este
//       archivo era «le sobraba comida: pescó 199 y le hacían falta 83». Esa
//       lectura tenía las dos mitades mal —ni pescó 199, ni le servían crudas— y
//       la segunda mitad la arregló el ADR: el mundo no cobraba `toxicity` y
//       comer veneno salía gratis. Hoy no hay ningún número de pescados CRUDOS
//       que alcance, y por eso el fuego dejó de ser un lujo.
//
//       ─── Y LA CONTRAPRUEBA DE LA DESPENSA SE DIO VUELTA. HAY QUE DECIRLO ─
//
//       Sobre la escena plantada, regalarle cien pescados YA COCIDOS alcanzaba:
//       «murió en −1, 65 bocados, aliento final 1,4593». Sobre el mundo decretado
//       **NO alcanza: come 68 y se muere en el 12.847.** El `it.fails` está
//       puesto con la salida al lado, y no se ablandó nada. (Antes de la poda
//       del tramo L eran 66 bocados y el 12.031: dejar de dar un paso ya dado le
//       compró 816 ticks, un 6,8%, y no le alcanzó.)
//
//       Y el motivo es aritmética, no conducta, y estaba escrito en el número
//       viejo sin que nadie lo leyera: **aquel 1,4593 era el margen con el que
//       pasaba, sobre un presupuesto de 1000 — el 0,15%.** La cuenta de las dos
//       corridas, lado a lado:
//
//         plantada  310 + 691,46 comidos − 1000 de vivir = +1,46  → llega
//         decretada 310 + 690,08 comidos − 1000 de vivir = +0,08  → no llega
//
//       Comió MÁS (68 contra 65) y llegó menos lejos, porque en un mundo con
//       cosas alrededor la mente camina: el tanque se le llena a los 2000 ticks
//       (849,3 de aliento), los 34 cocidos que le quedan se pudren hasta
//       `toxicity` 0,9921 —la ley 6— y desde ahí gasta 0,0847/tick en deambular
//       sin nada que comer. **La despensa no es una despensa: es una ración que
//       se pudre antes de la mitad de la corrida.**
//
//       O sea que lo que la contraprueba contesta cambió: ya no dice «falta sólo
//       el fuego». Dice que el bucle de la necesidad CIERRA —66 bocados, el
//       tanque lleno a los 2000 ticks— y que aun cerrando no alcanza, que es
//       exactamente lo mismo que dice la pared (10) por el otro lado.
//
//       El número que hace que esto no sea opinable: **20.000 ticks a 20 Hz son
//       1000 segundos de mundo, `COSTO_VIVIR_POR_SEGUNDO` es 1,0 y el tanque de
//       `stamina` topa en 1000.** O sea que el criterio (2), dicho en la moneda
//       del mundo, es literalmente «comé al menos una vez» — y, si además
//       caminás, más de una. Medido: con el tanque LLENO tampoco llega — se muere
//       en el **11.851** gastando 0,0844 por tick.
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
//       De ese total, el mundo se lleva ~0,19 ms y la mente ~0,57 encima
//       —medido aparte, sobre 4000 ticks con una criatura, y las dos mitades
//       subieron con el mundo lleno: son 95 cuerpos más en cada `see()`—. Un
//       `plan()` que CIERRA cuesta 0,0019 ms y uno que se CORTA cuesta 0,613
//       —**323×** en esta corrida, porque rendirse obliga a recorrer la búsqueda
//       entera—, y lo que la criatura pide todo el tiempo es de los que se
//       cortan. Aun así entra 65 veces en la ventana de 50 ms, y lo que hace
//       inalcanzable el (3) sigue sin ser la mente: son 5000 cuerpos de física,
//       que es lo que aquel banco ya diagnosticó.
//
// ═══ CÓMO SE MIDE ACÁ ═══════════════════════════════════════════════════════
//
// Los números se IMPRIMEN siempre y se AFIRMAN siempre, con UNA excepción que
// sigue el patrón ya decidido del proyecto —`ANIMA_BANCO=1`—: el que depende del
// reloj del sistema (el de pared del criterio 4), porque un test de rendimiento
// adentro de la suite normal es flaky y un test flaky enseña a ignorar el rojo.
//
// **La segunda excepción se fue en este tramo, y era una trampa.** Los 20.000
// ticks con la despensa se afirmaban sólo con `ANIMA_BANCO=1`, así que en una
// corrida normal el test hacía `return` antes de la única línea que medía el
// criterio: era verde por no preguntar. Cuando la corrida se dio vuelta —de
// «murió en −1» a «murió en el 12.847»— nadie se habría enterado. Hoy la corrida
// entera es determinista y no toca un reloj, así que el gate no compraba nada y
// el caso quedó como `it.fails` con la salida al lado: cuesta los mismos 18,5 s
// y ahora dice la verdad todos los días.
//
// Esos 18,5 s están medidos aparte: en la despensa el pedido de la criatura
// TAMBIÉN se corta —los cocidos que le quedan se pudren por encima del
// `toxicity<0,0528` que pide— y un `plan()` que se corta cuesta 0,613 ms contra
// 0,0019 de uno que cierra. No es que la escalera se haya puesto lenta: es que
// pedir algo que no se puede conseguir cuesta más que conseguirlo.
//
// Y lo que no se cumple NO se ablanda: va en `it.fails` con la salida medida al
// lado, que es el idioma con el que este repositorio ya dejó abiertos el techo
// del tick y los diez huecos de `admit()`.

// ═══ ESTE ARCHIVO SE PARTIÓ EN SIETE, Y ACÁ QUEDARON (0), (1) Y (3) ════════
//
// Eran 3054 líneas y **146 de los 148 segundos** que tardaba `@anima/mind`. La
// unidad de paralelismo de vitest es el ARCHIVO, así que eso ocupaba un núcleo y
// dejaba quince mirando. El mapa del corte —qué bloque quedó en qué archivo, cuánto
// tarda cada uno y por qué el corte cayó ahí— está arriba de `./el-criterio.ts`, que
// es el arnés que los seis comparten.
//
// Acá quedaron los tres bloques baratos, y los tres juntos por una razón concreta:
// (0) y (3) comparten `PAQUETES` —los dos LEEN archivos de otros paquetes en vez de
// correr mundo— y (1) es un segundo.
//
// El cuadro «EL HITO 5, MEDIDO» sale de `hito-5-el-cuadro.test.ts`, que espera a que
// los seis anoten lo suyo. Ver `./el-cuadro.ts`.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HZ_DE_REFERENCIA } from '@anima/physics';
import { Partida } from '@anima/perceive';
import { EXPANSIONES_POR_TICK, interpretar, plan } from '@anima/plan';
import type { GoalNode, Step } from '@anima/plan';
import { Creencias } from '../src/creencias.js';
import { Mente, vivir } from '../src/mente.js';
import { necesidades } from '../src/necesidades.js';
import { metaComestibleDe, opportunities } from '../src/oportunidades.js';
import { cuerpo, enElPiso, laOrilla } from './mundo.js';
import {
  laEscenaDelDocumento,
  conRegalo,
  vistaDe,
  correr,
  enLaMano,
  calorias,
  dos,
} from './el-criterio.js';
import { cuaderno } from './el-cuadro.js';

/** Lo que este pedazo anota para el cuadro. Ver `./el-cuadro.ts`. */
const MEDIDO = cuaderno('0-1-3');

// ═══ (0) EL PROVEEDOR ESTÁ APAGADO, Y NO ES UNA PROMESA ═════════════════════

const PAQUETES = fileURLToPath(new URL('../../', import.meta.url));

/**
 * LOS PAQUETES DE `ii/`, y sólo los paquetes.
 *
 * Un directorio bajo `ii/packages/` NO es necesariamente un paquete: alcanza con
 * correr `npx` una vez parado ahí para que aparezca un `node_modules/` con la
 * caché de vitest adentro, y los dos criterios de abajo enumeraban el directorio
 * a secas. Reventaban con `ENOENT: ii/packages/node_modules/package.json` — un
 * rojo del criterio de corte del proyecto causado por una caché.
 *
 * El filtro es tener `package.json`, que es lo que hace paquete a un paquete.
 */
function paquetesDeII(): readonly string[] {
  return readdirSync(PAQUETES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => existsSync(`${PAQUETES}${n}/package.json`))
    .sort();
}

describe('(0) el proveedor apagado: no hay con qué llamar a un modelo', () => {
  it('los siete paquetes de `ii/` no dependen de NADA que no sea `ii/`', () => {
    const nombres = paquetesDeII();
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
    for (const paquete of paquetesDeII()) {
      for (const f of fuentesDe(`${PAQUETES}${paquete}/src`)) {
        archivos += 1;
        const limpio = sinComentarios(readFileSync(f, 'utf8')).replace(
          /typeof\s+import\s*\(/g,
          ' ',
        );
        for (const [nombre, re] of PROHIBIDO) {
          if (re.test(limpio))
            hallazgos.push(`${paquete}/${f.slice(f.lastIndexOf('/') + 1)}: ${nombre}`);
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

    // ─── QUÉ SE AFIRMA ACÁ, Y POR QUÉ CAMBIÓ DE FORMA ────────────────────────
    //
    // Antes esto comparaba contra `['ir(vara)', 'sostener(vara)', 'ir(matorral)',
    // …]`, que son los nombres que el ARNÉS le había puesto a los cuerpos que el
    // ARNÉS había plantado: un test que se afirma a sí mismo. Hoy la escena es la
    // criatura sola y el resto lo pone el dios, así que se afirman las DOS cosas
    // que de verdad dicen algo, y por separado:
    //
    //   · **la FORMA de la cadena** —siete eslabones en este orden—, que es lo
    //     que el documento pide y lo único que no depende de la semilla;
    //   · **que ninguno de los cuerpos que nombra lo puso el arnés**: los ids son
    //     `suelta:cx:cy:n` y `pozo:cx:cy`, los dos prefijos del mundo. Eso es lo
    //     que antes no se podía afirmar, porque era falso.
    //
    // Los ids exactos van al `console.log` y no a un `toEqual`: son función de la
    // semilla, y clavarlos convertiría un cambio del oráculo en un rojo de la
    // mente.
    expect(r.nombres.slice(0, 7).map(soloElVerbo)).toEqual([
      'ir',
      'sostener',
      'ir',
      'sostener',
      'unir',
      'ir',
      'aplicar',
    ]);
    const cuerposQueNombra = r.nombres.slice(0, 7).flatMap(cuerposDelNombre);
    expect(cuerposQueNombra.length).toBeGreaterThan(0);
    for (const id of cuerposQueNombra) {
      expect(id.startsWith('suelta:') || id.startsWith('pozo:'), `${id} no lo puso el mundo`).toBe(
        true,
      );
    }
    // Y el pescado ESTÁ, sacado del agua por `extraccion` contra un banco que
    // decretó el dios. De «me falta aliento» a «tengo algo carnoso», sin proveedor.
    expect(enLaMano(r.partida, 'ana')).toContain('pescado');
    // Y la caña también, y es de materia del dios: madera + junco, atados por ella.
    expect(enLaMano(r.partida, 'ana').some((s) => s.includes('+'))).toBe(true);
    expect(calorias(r.partida, 'ana')).toBeGreaterThan(0);
    expect(r.ticksPerdidos).toBe(0);
    expect(r.murioEn).toBe(-1);

    // LOS DOS TICKS, Y NO UNO. Acá decía «primera pesca en el tick 35» y 35 es
    // cuando TIRA LA CAÑA: es el mismo desliz de despegue-por-aterrizaje que ya se
    // pagó una vez en este archivo. El pescado entra a la mano en el 109 —era el 96
    // con la escena plantada, y los trece ticks de diferencia son que el pozo le
    // queda más lejos que la vara que el arnés le dejaba a tres celdas—, y ése es
    // el número que dice que la cadena cerró.
    const tiraLaCaña = r.cuando[r.nombres.indexOf('aplicar(extraccion)')];
    expect(r.pescoEn).toBeGreaterThan(0);
    MEDIDO.set(
      'cadena',
      `7 eslabones sobre materia del dios: tira la caña en el tick ${String(tiraLaCaña ?? -1)} y el ` +
        `pescado entra a la mano en el ${String(r.pescoEn)}, ${dos(calorias(r.partida, 'ana'))} calorías`,
    );
    console.log(
      `\n─── LA CADENA DE LA CAÑA, CONTRA EL MUNDO DE VERDAD ───\n${r.volados.slice(0, 8).join('\n')}\n` +
        `  y NINGUNO de esos cuerpos lo puso el arnés: ${[...new Set(cuerposQueNombra)].join(' · ')}\n` +
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
    //
    // ─── Y ACÁ EL MATORRAL SÍ SE PLANTA, CON EL PORQUÉ ─────────────────────
    //
    // Es el único bloque del archivo que pone materia a mano, y no es una escena
    // sino un BARRIDO PARAMÉTRICO: la pregunta es «¿existe ALGÚN matorral que
    // obligue a deshilachar?», y para contestarla hay que elegir las masas y las
    // formas, que es justo lo que el decreto no deja elegir. El regalo va ENCIMA
    // del mundo decretado (`conRegalo`), así que la criatura tiene además todo lo
    // que el dios puso: si con las dos cosas juntas ninguna escena lo pide, el
    // «esta física no lo pide» se sostiene sobre más mundo que antes, no menos.
    const filas: string[] = [];
    let alguna = false;
    for (const [masa, forma] of [
      [0.2, 'hebra'],
      [0.2, 'bloque'],
      [1, 'bloque'],
      [2, 'bloque'],
      [2, 'hebra'],
    ] as const) {
      const o = laOrilla();
      const p = new Partida(
        conRegalo(310, [
          enElPiso(cuerpo('matorral', 'liana', masa, {}, forma), {
            x: o.parada.x - 2,
            y: o.parada.y + 1,
          }),
        ]),
      );
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

/**
 * EL VERBO DE UN DESPEGUE, sin el paréntesis: `ir(suelta:-6:-7:0)` → `ir`.
 *
 * Es lo que deja afirmar la FORMA de la cadena sin clavar los ids de una
 * semilla. Ver el bloque (1).
 */
function soloElVerbo(nombre: string): string {
  const i = nombre.indexOf('(');
  return i < 0 ? nombre : nombre.slice(0, i);
}

/**
 * LOS CUERPOS QUE UN DESPEGUE NOMBRA, por id: `unir(a+b)` → `[a, b]`.
 *
 * Se filtra por los dos prefijos con `:` porque el paréntesis también lleva
 * cosas que no son cuerpos —`aplicar(extraccion)` nombra un proceso,
 * `explorar(8t)` un largo— y contarlas como cuerpos haría fallar la afirmación
 * de «esto lo puso el mundo» por el lado equivocado.
 */
function cuerposDelNombre(nombre: string): string[] {
  const a = nombre.indexOf('(');
  const b = nombre.lastIndexOf(')');
  if (a < 0 || b <= a) return [];
  return nombre
    .slice(a + 1, b)
    .split(/[+×]/)
    .filter((s) => s.includes(':'));
}

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
