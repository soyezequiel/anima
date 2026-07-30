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
//       **NO alcanza: come 66 y se muere en el 12.031.** El `it.fails` está
//       puesto con la salida al lado, y no se ablandó nada.
//
//       Y el motivo es aritmética, no conducta, y estaba escrito en el número
//       viejo sin que nadie lo leyera: **aquel 1,4593 era el margen con el que
//       pasaba, sobre un presupuesto de 1000 — el 0,15%.** La cuenta de las dos
//       corridas, lado a lado:
//
//         plantada  310 + 691,46 comidos − 1000 de vivir = +1,46  → llega
//         decretada 310 + 690,00 comidos − 1000 de vivir = +0,00  → no llega
//
//       Comió MÁS (66 contra 65) y llegó menos lejos, porque en un mundo con
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
// «murió en −1» a «murió en el 12.031»— nadie se habría enterado. Hoy la corrida
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

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it } from 'vitest';

import { HZ_DE_REFERENCIA, qualityOf, specOf, unfx } from '@anima/physics';
import type { QualityId } from '@anima/physics';
import { COSTO_VIVIR_POR_SEGUNDO, decretoDe } from '@anima/world';
import type { WorldBody, WorldState } from '@anima/world';
import { Contexto, Partida } from '@anima/perceive';
import { EXPANSIONES_POR_TICK, SEGUNDOS_DE_COCCION, interpretar, plan } from '@anima/plan';
import type { GoalNode, Step } from '@anima/plan';
import { comer } from '@anima/skills/innatas';

import { Creencias } from '../src/creencias.js';
import { Mente, vivir } from '../src/mente.js';
import { necesidades } from '../src/necesidades.js';
import { metaComestibleDe, opportunities } from '../src/oportunidades.js';
import type { VistaDeLaMente } from '../src/tipos.js';
import { PHYS, actor, criatura, cuerpo, enElPiso, laOrilla, mundo } from './mundo.js';
import type { Orilla } from './mundo.js';

/** El único número que se afirma contra el reloj del sistema. Ver el encabezado. */
const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1';

/** Los ticks del criterio (2). No es un largo elegido acá: es el del documento. */
const CRITERIO_TICKS = 20_000;

/**
 * EL TICK EN QUE EL PESCADO ENTRA A LA MANO, sobre el mundo decretado.
 *
 * No es un umbral: es un número MEDIDO por el bloque (1) —que lo imprime y lo
 * afirma `> 0`— y se copia acá porque el DIAGNÓSTICO 8 lo necesita para una
 * carrera: la yesca de la orilla se ahoga en el tick 85, y lo que decide si eso
 * importa es si el pescado llega antes o después. Era 96 con la escena plantada.
 */
const PESCADO_EN_LA_MANO = 109;

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
function laEscenaDelDocumento(stamina = 310): WorldState {
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
function conRegalo(stamina: number, extra: readonly WorldBody[]): WorldState {
  const o = laOrilla();
  return mundo({
    dios: o.dios,
    bodies: [enElPiso(criatura('ana', stamina), o.parada), ...extra],
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
function conFuegoYLosa(): WorldState {
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
const HUMEDAD_QUE_APAGA = 0.45;

/**
 * LA MASA DE LA YESCA MÁS CHICA QUE LLENA LA VENTANA DEL CONTACTO, y el aliento
 * que cuesta prenderla. Los dos salen de `@anima/plan` y de la física, no de acá:
 * el `roleHint` de la fila de encender pide `mass >= 0,3506875138611668`, y frotar
 * cobra `heatCapacity × ΔT / eficiencia`.
 *
 * Se escriben como constantes porque son la vara de dos tests y hay que poder
 * leerlas de un renglón; los dos las verifican contra el mundo antes de usarlas.
 */
const YESCA_MAS_CHICA = 0.3506875138611668;
/** El calor específico de la madera de la semilla. Se verifica contra el motor. */
const CALOR_ESPECIFICO_MADERA = 1.7;
/** Los tres números de frotar, del catálogo: ignición, ambiente y eficiencia. */
const IGNICION_MADERA = 300;
const AMBIENTE = 15;
const EFICIENCIA_DE_FROTAR = 0.35;

/** El `wet` de una celda, leído del decreto y no de un cuerpo puesto ahí. */
function humedadDeLaCelda(o: Orilla, c: { x: number; y: number }): number {
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
function celdasSecas(o: Orilla, cuantas: number): { x: number; y: number }[] {
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
function conLenaSeca(stamina: number, cuantas = 4): WorldState {
  const secas = celdasSecas(laOrilla(), cuantas);
  return conRegalo(
    stamina,
    secas.map((c, i) => enElPiso(cuerpo(`lena${String(i)}`, 'madera', 0.4, {}, 'vara'), c)),
  );
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
      // LA SALIDA MEDIDA HOY, SOBRE EL MUNDO DECRETADO, y está impresa abajo por
      // la corrida de verdad:
      //
      //   murió en el tick 3743 de 20.000 (19%), con el aliento en 0
      //   2 despegues de aplicar(extraccion) · UN pescado en la mano desde el 109
      //   0 bocados · ticks perdidos 0 · 0 estados ilegales
      //   aliento: 0:309,9 → 2000:147,4 → 4000:0
      //   despegues: la cadena de 7, y después 361 explorar + 362 guarecerse +
      //              361 juntar, TODOS aterrizando mal
      //
      // ─── QUÉ CAMBIÓ, Y CON QUÉ SE PUEDE Y CON QUÉ NO SE PUEDE COMPARAR ────
      //
      // Este archivo ya no planta la escena: la criatura está sola en la orilla y
      // los 62 cuerpos sueltos los pone el dios (ver `laEscenaDelDocumento`). O
      // sea que este 3743 y el 3627 del tramo J **no son el mismo experimento**,
      // y ponerlos uno al lado del otro sin decirlo sería el cuarto encuadre
      // engañoso del proyecto. Los cuatro números que hay que leer juntos están
      // en el encabezado; el corto es que los dos que aguantan más (6194 y 6184)
      // son los dos en los que la criatura NO HACE NADA, porque los dos bucles
      // que los produjeron eran gratis.
      //
      // ─── LO QUE EL MUNDO LLENO CERRÓ Y LO QUE DESTAPÓ ─────────────────────
      //
      // La pared (7) —«no hay leña»— está cerrada: el mundo le pone 95 sueltas
      // alrededor a los 400 ticks, madera incluida. Y quedaron a la vista dos
      // cosas que la escena inventada tapaba, las dos medidas en el DIAGNÓSTICO
      // 11: un BUCLE de la mente que se llevaba el 98% de la corrida (arreglado
      // en `src/`), y que **la única madera del decreto pesa 2,3280 kg contra una
      // ventana de yesca de [0,3507 ; 0,4871)** — o sea que la pared (7) se movió
      // de «no hay leña» a «no hay leña de ese tamaño», que es del oráculo.
      //
      // ─── LO QUE MEDÍA EL TRAMO G, QUE ES LA VARA DE LA MEJORA ─────────────
      //
      //   murió en el tick 6194 · 199 despegues de aplicar(extraccion) · 1 pescado
      //
      // El bucle de 199 tiros de caña adentro de su propio pescado SE TERMINÓ: son
      // 2 despegues, y el mundo ya no contesta `sin-pozo` ni una vez (196 antes,
      // 0 ahora — medido en el 4/6). Ése era el eslabón A y está cerrado.
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
    // No dice que el criterio (2) se cumpla: no se cumple, se muere en el 3743.
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

  it('DIAGNÓSTICO 5/6 · EL ESLABÓN B SE CERRÓ: el plan sale ENTERO, de la vara al pescado cocido', () => {
    // ─── ESTE DIAGNÓSTICO SE DIO VUELTA, Y ES EL TRAMO ENTERO ──────────────
    //
    // Decía, con este título: «sabe LIGAR un fuego, no sabe pedir uno de la potencia
    // justa», y medía el `gap` de `emitsPower<410&emitsPower>=253` como lo único que
    // separaba a la criatura de comer. Eso era verdad de la tabla que había: UNA
    // fila de cocción, con el montaje clavado en la parrilla, cuya ventana no la
    // llenaba ningún fuego que se pueda encender frotando.
    //
    // Hoy la tabla barre los tres montajes por tres distancias y saca DOS filas
    // —parrilla y contacto, las dos a distancia 0—, y de las dos sólo la del
    // contacto se puede encender. Con eso el `plan()` deja de cortarse: **pedirle
    // `holding(tag:carnoso,toxicity<0.0528)` con dos varas de madera de 0,40 kg a la
    // vista devuelve la cadena completa de QUINCE pasos**, que es esto y nadie lo
    // escribió:
    //
    //     ir → sostener → ir → sostener → unir     la caña
    //     ir → aplicar                             el pescado
    //     ir → sostener → ir → sostener → frotar   el fuego
    //     poner → esperar → sostener               la cocción
    //
    // Los dos `poner` de la vieja versión son uno solo: la parrilla no está porque
    // la fila que se liga es la del CONTACTO, o sea el pescado apoyado sobre la
    // brasa. Y el `esperar` es el paso que este tramo tuvo que coser —`Step` no lo
    // tenía y la mente no lo sabía traducir—: sin él la criatura apoyaba el pescado
    // en el tick 151 y lo levantaba en el 153, la ley 5 corría dos ticks y la
    // `digestibility` no se movía de 0,3800 en veinte mil.
    //
    // ─── LO QUE SIGUE FALLANDO YA NO ES ESTO, Y ESTÁ EN LOS 7, 8, 9 Y 10 ────
    //
    // En la escena del documento, TAL CUAL, el pedido sigue saliendo `gap`. Pero el
    // motivo cambió de piso: ya no es que falte una vía, es que **no hay una sola
    // vara de madera de ese tamaño en el mundo**. El `gap` lo dice con todas las
    // letras si se le saca la fila de la parrilla —que es la que gana el reporte por
    // ser la rama más barata—: lo que falta es un cuerpo con
    // «fuelEnergy∈[18;21] ∧ mass∈[0,3507;0,4871) ∧ moisture<0,45 ∧ rigidity>=0,5»,
    // y eso no se planifica: se encuentra o no se encuentra.
    //
    // O sea que lo que falta ya no es la ley, ni la geometría, ni la vía, ni el
    // vocabulario de la mente: es MATERIA, y después ARITMÉTICA. Los cuatro
    // diagnósticos nuevos la miden pieza por pieza.
    const meta = interpretar(metaComestibleDe('carnoso') ?? '');
    if (meta === undefined) throw new Error('sin predicado');
    const g: GoalNode = { id: 'meta', goal: meta, after: [], porque: 'el test' };

    // (a) la escena del documento, tal cual: el `gap` que queda.
    const p1 = new Partida(laEscenaDelDocumento());
    vivir(p1, new Map([['ana', new Mente({ actor: 'ana', memoria: new Creencias() })]]), 200);
    const sinLena = plan(g, vistaDe(p1, 'ana'), EXPANSIONES_POR_TICK * 60);

    // (b) la MISMA escena con un fuego ya prendido y una losa. Ligar lo que existe.
    const p2 = new Partida(conFuegoYLosa());
    vivir(p2, new Map([['ana', new Mente({ actor: 'ana', memoria: new Creencias() })]]), 200);
    const fogata = p2.state.bodies.get('fogata');
    const potencia = fogata === undefined ? 0 : qualityOf(fogata.body, 'emitsPower', p2.state.phys);
    const conFuego = plan(g, vistaDe(p2, 'ana'), EXPANSIONES_POR_TICK * 60);

    // (c) LA CONTRAPRUEBA DEL TRAMO: la escena del documento con leña seca, y el
    // plan pedido EN EL TICK 0 —antes de que el mundo le moje la yesca, que es el
    // diagnóstico 8—. Acá sale la cadena entera.
    const p3 = new Partida(conLenaSeca(1000));
    const entera = plan(g, vistaDe(p3, 'ana'), EXPANSIONES_POR_TICK * 400);

    console.log(
      `\n─── DE LA VARA AL PESCADO COCIDO, EN UN SOLO PLAN ───\n` +
        `  (a) la escena del documento tal cual:  ${sinLena.k}` +
        (sinLena.k === 'gap' ? `  missing «${sinLena.missing}»\n          ${sinLena.why}` : '') +
        `\n  (b) con un leño YA ardiendo (emitsPower ${potencia.toFixed(2)}) y una losa:  ${conFuego.k}` +
        (conFuego.k === 'plan'
          ? `  →  ${conFuego.steps.map((s) => s.k).join(' → ')}  (${String(conFuego.expansiones)} expansiones)`
          : conFuego.k === 'gap'
            ? `  missing «${conFuego.missing}»`
            : '') +
        `\n  (c) con leña de 0,40 kg en celdas SECAS, en el tick 0:  ${entera.k}` +
        (entera.k === 'plan'
          ? `\n        ${entera.steps.map((s) => s.k).join(' → ')}` +
            `\n        ${String(entera.steps.length)} pasos, ${String(entera.expansiones)} expansiones, y NADIE los escribió`
          : entera.k === 'gap'
            ? `  missing «${entera.missing}»\n          ${entera.why}`
            : '') +
        `\n`,
    );

    // (a) Sigue habiendo `gap`, y el `why` sigue nombrando la potencia: la rama que
    // gana el reporte es la de la parrilla, que es la más barata de las dos.
    expect(sinLena.k).toBe('gap');
    if (sinLena.k !== 'gap') throw new Error('imposible');
    expect(sinLena.missing).toContain('emitsPower');
    // Y ACÁ ESTÁ LO QUE CAMBIÓ DE VERDAD: el catálogo YA establece las dos puntas de
    // una ventana. Donde este test afirmaba `toContain('emitsPower>0')` como «lo más
    // cerca que llega», hoy el mismo `why` nombra las dos filas nuevas.
    expect(sinLena.why).toContain('emitsPower>=105');
    expect(sinLena.why).toContain('emitsPower<170');

    // (b) Ligar un fuego que existe: la parrilla, el tiempo y el `sostener`.
    //
    // ─── ESTE LARGO VA Y VIENE, Y HAY QUE SABER POR QUÉ ─────────────────────
    //
    // Son CINCO pasos hoy, fueron SIETE en el tramo J y cinco antes. **Lo que se
    // mueve no es el planificador: es cuánto pasó en la escena antes de pedirle
    // el plan**, porque este bloque le corre 200 ticks de mente de verdad. La
    // regla ya está escrita en el traspaso («un test que calienta la escena con
    // `vivir()` está midiendo dos cosas»), y acá se ve de los dos lados:
    //
    //   · siete pasos = la criatura ya cocinó y se comió el primer pescado
    //     adentro de los 200 ticks, así que el plan arranca con `ir → aplicar`
    //     para conseguir otro;
    //   · cinco pasos = todavía tiene el pescado en la mano, así que el plan
    //     arranca directo en la pila.
    //
    // Sobre el mundo decretado son cinco, y el motivo está medido: el pescado
    // entra a la mano en el tick 109 y no en el 96 —el pozo le queda más lejos
    // que la vara que el arnés le ponía a tres celdas— y con trece ticks menos
    // de margen la cocción no termina adentro de la ventana de 200.
    //
    // Se afirma la forma de CINCO y se comenta la de siete: lo que importa es el
    // orden —armar la pila, esperar, levantar— y que el `esperar` esté en el
    // medio, que es el paso que el tramo J tuvo que coser.
    expect(conFuego.k).toBe('plan');
    if (conFuego.k !== 'plan') throw new Error('imposible');
    expect(conFuego.steps.map((s) => s.k)).toEqual([
      'ir', // hasta la fogata
      'poner', // la losa sobre la fogata
      'poner', // el pescado sobre la losa
      'esperar',
      'sostener',
    ]);

    // (c) Y LA CADENA ENTERA. Lo que se afirma es la FORMA y no el largo: que estén
    // los cuatro tramos, en este orden, y que el tiempo esté entre poner y levantar.
    expect(entera.k).toBe('plan');
    if (entera.k !== 'plan') throw new Error('imposible');
    const ks = entera.steps.map((s) => s.k);
    expect(ks).toEqual([
      'ir',
      'sostener',
      'ir',
      'sostener',
      'unir', // la caña
      'ir',
      'aplicar', // el pescado
      'ir',
      'sostener',
      'ir',
      'sostener',
      'frotar', // el fuego
      'poner',
      'esperar',
      'sostener', // la cocción
    ]);
    // Y la espera dura lo que la fila declara, no lo que este test quiera.
    const espera = entera.steps.find((s) => s.k === 'esperar');
    expect(espera?.k).toBe('esperar');
    if (espera?.k !== 'esperar') throw new Error('imposible');
    expect(espera.segundos).toBe(SEGUNDOS_DE_COCCION);

    MEDIDO.set(
      'eslabón B',
      `CERRADO: con leña de 0,40 kg a la vista el plan sale ENTERO —${String(entera.steps.length)} pasos, ` +
        `${String(entera.expansiones)} expansiones— y lleva \`esperar(${String(espera.segundos)}s)\` entre ` +
        `poner la comida y levantarla. El \`gap\` que queda es «${sinLena.missing}» y ya no es por falta de vía: ` +
        `es porque no hay una vara de ese tamaño en el mundo`,
    );
  }, 120_000);

  it('DIAGNÓSTICO 6/6 · DE DÓNDE SALE CADA GRAMO: el bucle era gratis, deambular no, y el mundo lleno tampoco', () => {
    // ─── EL NÚMERO QUE SE PUEDE LEER MAL, MEDIDO PARA QUE NO SE LEA MAL ────
    //
    // Este bloque nació para explicar por qué la corrida moría en el 3627 cuando el
    // tramo anterior moría en el 6194. Dicho pelado, parecía que la reparación la
    // había matado antes; lo que pasaba eran dos renglones de aritmética:
    //
    //   · el bucle viejo era PARADA. Tirar la caña adentro de su propio pescado
    //     falla sin mover una pata, y la corrida vieja gastaba −0,0500 por tick,
    //     que es `COSTO_VIVIR_POR_SEGUNDO / hz` exacto y nada más. 310 de tanque
    //     ÷ 0,05 = 6200 ticks, y murió en 6194: estaba pagando SÓLO por respirar;
    //   · el bucle de entonces CAMINABA. Con el pescado ya en la mano y el fuego
    //     fuera de alcance, la mente caía a las conductas de fondo —explorar,
    //     guarecerse, juntar— y explorar son ocho ticks de patas: −0,08636 por
    //     tick, 1,73× lo que cuesta estar viva.
    //
    // ─── Y EL MUNDO DECRETADO NO LA HIZO CAMINAR MENOS: CASI IGUAL ─────────
    //
    // Con la escena plantada la pendiente medía 0,08636/tick (1,73×). Sobre el
    // mundo decretado mide **0,08242/tick, o sea 1,65×**. Es el mismo régimen: el
    // pescado en la mano, el fuego sin vía, y las conductas de fondo caminando.
    // Que el mundo esté lleno de cosas no le da nada, porque ninguna de las 62
    // sirve para lo que le falta (DIAGNÓSTICO 11).
    //
    // ─── EL 1,00× QUE HUBO EN EL MEDIO ERA UN BUCLE, Y NO UNA MEJORA ───────
    //
    // Entre medio se midió acá **0,05000/tick clavado, 1,00×**, y se escribió que
    // «la escalera pasó a vivir en D4 y pensar no cuesta aliento». Era cierto y
    // era la peor noticia posible: lo que hacía era repetir 6045 veces el mismo
    // `ir(suelta:-6:-7:2)` que aterrizaba bien sin moverla. Un régimen de gasto
    // igual al de respirar quería decir que la criatura NO ESTABA HACIENDO NADA.
    // → **REGLA: una pendiente que baja no es una mejora. Preguntá qué dejó de
    // hacer.** El bucle está arreglado (DIAGNÓSTICO 11) y la pendiente volvió,
    // con razón, a la de alguien que camina.
    //
    // Los cuatro números, que sueltos mienten:
    //
    //   6194  escena plantada, bucle de la caña: PARADA, 0,0500/tick
    //   6184  mundo decretado, bucle del `ir`:   PARADA, 0,0500/tick
    //   3627  escena plantada, sin bucle:        camina, 0,0864/tick
    //   3743  mundo decretado, sin bucle:        camina, 0,0824/tick
    //
    // El criterio (2) no se mide en ticks aguantados —se mide en si comió, y las
    // cuatro corridas comieron cero—, y por eso este test no afirma «murió más
    // tarde»: afirma de dónde sale cada gramo de aliento.
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
        `  murió en el tick ${String(r.murioEn)} adentro de los 4000 de este bloque ` +
        `(-1 quiere decir que llegó viva)\n` +
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
    //
    // **Y el PISO es lo que caza el bucle**: si algún día la pendiente vuelve a
    // 1,00× esto se pone rojo, y esa vez hay que preguntar qué dejó de hacer y no
    // festejar. La versión anterior de este bloque afirmaba exactamente lo
    // contrario (`>= porTick × 0,99` y `< porTick × 1,3`) y por eso el bucle pasó
    // en verde.
    expect(pendiente).toBeGreaterThan(porTick * 1.3);
    expect(pendiente).toBeLessThan(porTick * 2.5);
    // Y el pescado sigue ahí, cada vez más podrido, esperando un fuego que no llega.
    expect(podrido).toBeGreaterThan(0.25);
    MEDIDO.set(
      'deambular',
      `gasta ${pendiente.toFixed(5)}/tick contra ${porTick.toFixed(5)} de sólo vivir (${(pendiente / porTick).toFixed(2)}×): ` +
        `con el pescado en la mano y sin vía al fuego cae a las conductas de fondo, que CAMINAN`,
    );
  }, 300_000);

  // ══════════════════════════════════════════════════════════════════════════
  // LOS CUATRO DIAGNÓSTICOS NUEVOS. Con la cadena cerrada, lo que queda entre la
  // criatura y el criterio ya no es saber: son tres paredes de MUNDO y una de
  // ARITMÉTICA, y ninguna se arregla en `@anima/mind`.
  // ══════════════════════════════════════════════════════════════════════════

  it('DIAGNÓSTICO 7 · CERRADO: el dios siembra 62 cuerpos y el mundo los pone en el piso', () => {
    // ─── LA PARED MÁS BARATA DE ARREGLAR Y LA QUE NADIE ESTABA MIRANDO ─────
    //
    // La escena del documento le pone DOS cuerpos: una vara de madera de 1 kg y un
    // matorral de liana de 0,2 kg. La mente los ata y hace la caña, o sea que se
    // gasta la única madera que hay. Después de eso, en el mundo entero no quedaba
    // nada que ardiera.
    //
    // Y NO ERA QUE EL DIOS NO SEMBRARA. `decretoDe` trae `chunk.sueltas` y en los
    // nueve chunks alrededor de la parada hay 62 cuerpos decretados. Lo que pasaba
    // es que `stepWorld` **materializaba los pozos y nada más**: `grep sueltas
    // ii/*/src` devolvía UN comentario que no hablaba de esto. Los 62 existían en el
    // decreto y no existían en `state.bodies`.
    //
    // Es la misma clase de error que el número 3 de los dieciséis —«el mundo no
    // permite fuego: el encendible más liviano pesa 1 kg», que era el arnés y no el
    // mundo— pero al revés: el arnés era POBRE de más y el dios es generoso.
    //
    // ─── LA REPARACIÓN, Y LO QUE MIDE AHORA ESTE TEST ──────────────────────
    //
    // `world/src/step.ts` materializa `chunk.sueltas` una vez por chunk
    // (`materializarLoDecretado` → `abrirChunk`), con el chunk anotado en
    // `EstadoDelDios.sembrados` para que lo quemado no reaparezca. MEDIDO acá, con
    // 400 ticks de vivir en la misma orilla:
    //
    //     sueltas DECRETADAS en los 9 chunks de la parada ...... 62
    //     cuerpos MATERIALIZADOS a los 400 ticks ............... 109
    //         = 11 bancos de peces + 98 cuerpos, de los cuales 95 son sueltas
    //           del dios (los otros 3 son ella, la caña y el pescado)
    //
    // Son MÁS de 62 y no menos, y no es un error de cuenta: el chunk se abre cuando
    // alguien llega, así que en 400 ticks la criatura abrió más de los 9 del
    // arranque. Por eso lo que se afirma es «hay sueltas del dios en el piso» y no
    // un número exacto: el número exacto depende de cuánto caminó, o sea de la
    // mente, y este test no mide la mente.
    //
    // ─── Y LA CAÑA CAMBIÓ DE SUSTANCIAS, QUE ES LA PRUEBA DE QUE ES DEL DIOS ─
    //
    // Acá se afirmaba `madera+liana`, que eran los dos cuerpos que este arnés
    // plantaba. Hoy la caña que sale es **madera+junco**, porque el dios puso
    // junco en el chunk de la parada y liana en el de al lado. Se afirma lo que
    // significa —«hay un cuerpo con dos sustancias unidas», o sea que ató algo— y
    // se imprime cuáles son: clavar `madera+junco` sería volver a clavar la
    // semilla en una afirmación que no habla de ella.
    const o = laOrilla();
    const cxp = Math.floor(o.parada.x / 16);
    const cyp = Math.floor(o.parada.y / 16);
    let decretadas = 0;
    const porSustancia = new Map<string, number>();
    for (let cx = cxp - 1; cx <= cxp + 1; cx++) {
      for (let cy = cyp - 1; cy <= cyp + 1; cy++) {
        for (const s of decretoDe(o.dios, PHYS, cx, cy).chunk.sueltas) {
          decretadas += 1;
          porSustancia.set(s.substance, (porSustancia.get(s.substance) ?? 0) + 1);
        }
      }
    }

    // Y lo que hay DE VERDAD después de 400 ticks de vivir en esa orilla.
    const p = new Partida(laEscenaDelDocumento());
    vivir(p, new Map([['ana', new Mente({ actor: 'ana', memoria: new Creencias() })]]), 400);
    const materializados = [...p.state.bodies.values()];
    const pozos = materializados.filter((b) => b.body.id.startsWith('pozo:')).length;
    const resto = materializados
      .filter((b) => !b.body.id.startsWith('pozo:'))
      .map(
        (b) =>
          `${b.body.id} [${b.body.parts.map((x) => x.substance).join('+')}] ${qualityOf(b.body, 'mass', p.state.phys).toFixed(4)} kg`,
      );

    const delDios = resto.filter((s) => s.startsWith('suelta:'));
    // La caña que ella ató: un cuerpo con dos sustancias, y las dos las puso el
    // dios. Su cuerpo y el pescado son los otros dos que no son `suelta:`.
    const cañas = resto.filter((s) => !s.startsWith('suelta:') && s.includes('+'));
    console.log(
      `\n─── LO QUE EL DIOS DECRETA CONTRA LO QUE EL MUNDO PONE ───\n` +
        `  sueltas DECRETADAS en los 9 chunks de la parada: ${String(decretadas)}\n` +
        `      ${[...porSustancia].map(([k, v]) => `${k}×${String(v)}`).join(' · ')}\n` +
        `  cuerpos MATERIALIZADOS a los 400 ticks: ${String(materializados.length)} ` +
        `= ${String(pozos)} bancos de peces + ${String(resto.length)} cuerpos, ` +
        `de los cuales ${String(delDios.length)} los puso EL MUNDO\n` +
        `  la caña que ella ató, con materia del dios: ${cañas.join(', ')}\n` +
        `  MADERA: el decreto pone ${String(porSustancia.get('madera') ?? 0)} en los 9 chunks y a los 400 ` +
        `ticks quedan ${String(delDios.filter((s) => s.includes('[madera]')).length)} sueltas — se la comió la caña\n` +
        `      ${resto.slice(0, 12).join('\n      ')}\n      …\n`,
    );

    // El dios siembra de verdad…
    expect(decretadas).toBeGreaterThan(50);
    // …y ahora llegan al suelo. No se afirma un número exacto: depende de cuántos
    // chunks pisó la criatura en 400 ticks, que es cosa de la mente.
    expect(delDios.length).toBeGreaterThanOrEqual(decretadas);
    expect(cañas.length).toBe(1);
    // ─── Y LA QUE IMPORTABA PARA EL FUEGO, QUE ES LA NOTICIA MALA ───────────
    //
    // Acá se afirmaba «entre lo que el mundo puso hay MADERA». **Es falso a los
    // 400 ticks, y no porque el mundo no la ponga: porque ella se la gastó.** De
    // las 62 sueltas de los 9 chunks, madera hay UNA —`suelta:-6:-7:0`, 2,3280
    // kg— y es exactamente la que la mente ata a la caña en el tick 23. Después
    // de eso, en todo lo que abrió caminando no aparece otra.
    //
    // Se afirman las DOS mitades, porque juntas son el diagnóstico: el decreto
    // TIENE madera, y a los 400 ticks NO QUEDA NINGUNA suelta. Lo que hay que
    // decidir arriba es si un bioma que siembra una sola madera por chunk es un
    // bioma donde se puede hacer fuego — y eso es del oráculo (ver el 11).
    const maderaDecretada = porSustancia.get('madera') ?? 0;
    const maderaEnElPiso = delDios.filter((s) => s.includes('[madera]')).length;
    expect(maderaDecretada).toBeGreaterThan(0);
    expect(maderaEnElPiso).toBe(0);
    MEDIDO.set(
      'la leña',
      `el dios decreta ${String(decretadas)} cuerpos sueltos en los 9 chunks de la parada y \`stepWorld\` ` +
        `los materializa: a los 400 ticks hay ${String(delDios.length)} sueltas del dios en el piso ` +
        `(más que 62 porque el chunk se abre cuando alguien llega) y ${String(pozos)} pozos. ` +
        `Pero madera decreta ${String(maderaDecretada)} y a los 400 ticks quedan ${String(maderaEnElPiso)}: ` +
        `se la gastó en la caña`,
    );
  }, 300_000);

  it('DIAGNÓSTICO 8 · Y SI SE LE PONE, SE AHOGA: la celda «seca» mide wet 0,6 y la yesca cruza el 0,45 en el tick 85, once antes del pescado', () => {
    // ─── LA CARRERA QUE PIERDE POR DIEZ TICKS ──────────────────────────────
    //
    // `laOrilla()` busca «una celda seca pegada al pozo», y su prueba de seco es
    // `wet < 0.9`, o sea «no es agua». La celda que devuelve mide **0,6000**. La
    // `moisture` de un cuerpo relaja hacia el `wet` de su celda, así que una vara de
    // madera puesta ahí arranca en 0,2500 y sube: 0,3277 al tick 25, 0,3882 al 50,
    // **0,4719 al 100**. `HUMEDAD_QUE_APAGA` es 0,45.
    //
    // Y la criatura no tiene el pescado en la mano hasta el tick 109. O sea que
    // cuando por fin quiere cocinar, la leña ya no prende. El plan que salía ENTERO
    // en el tick 0 —los quince pasos del 5/6— es `gap` en el tick 100.
    //
    // TENERLA EN LA MANO NO LA PROTEGE, y es lo primero que uno probaría: la misma
    // vara agarrada y la misma en el piso dan la misma `moisture` **hasta el último
    // decimal**. El agua no la pone la celda de abajo, la pone el aire de la celda.
    //
    // NO ES UNA PARED DEL MUNDO, y por eso este diagnóstico es el más accionable de
    // los cuatro: a UNA celda de la parada hay tierra con `wet` 0,1500, y ahí la
    // leña no se moja nunca. Lo que está mal es de qué lado del río deja la escena
    // la leña, y eso lo elige el arnés.
    //
    // ─── Y LA MENTE SE SACÓ DEL MEDIO, QUE ES UNA CORRECCIÓN DE MÉTODO ─────
    //
    // Este bloque corría `vivir(p, mentes, 1)` para hacer avanzar el mundo, o sea
    // que además de la ley 11 estaba corriendo una criatura que decide. Mientras el
    // piso estuvo vacío no se notaba; con el mundo materializando el decreto
    // (tramo K) la criatura levanta la vara `seca`, se la lleva a la orilla y la
    // moja: medido, la «seca» terminaba en `moisture` **0,9433** a los 400 ticks —y
    // el test lo leía como si el agua se la hubiera puesto la CELDA—.
    //
    // Lo que este diagnóstico afirma es físico y no tiene nada que ver con la
    // mente: una vara en una celda con `wet` 0,15 no cruza el 0,45 nunca, y una en
    // una celda con `wet` 0,60 lo cruza en el tick 85. Así que el mundo avanza solo
    // (`p.avanzar(1)`) y no hay nadie que mueva nada. **REGLA, y es la del tramo J
    // repetida del otro lado: un test que hace avanzar la escena con `vivir()` está
    // midiendo dos cosas.**
    const o = laOrilla();
    const secas = celdasSecas(o, 3);
    const p = new Partida(
      mundo({
        dios: o.dios,
        bodies: [
          enElPiso(criatura('ana', 310), o.parada),
          enElPiso(cuerpo('mojada', 'madera', 0.4, {}, 'vara'), o.parada),
          enElPiso(cuerpo('seca', 'madera', 0.4, {}, 'vara'), secas[0] ?? o.parada),
        ],
        actors: [actor('ana', { capacity: 3 })],
      }),
    );
    const hum = (id: string): number => {
      const b = p.state.bodies.get(id);
      return b === undefined ? -1 : qualityOf(b.body, 'moisture', p.state.phys);
    };
    const filas: string[] = [];
    let cruzoLaDeLaOrilla = -1;
    for (let t = 0; t <= 400; t++) {
      if (t > 0) p.avanzar(1);
      if (cruzoLaDeLaOrilla < 0 && hum('mojada') >= HUMEDAD_QUE_APAGA) cruzoLaDeLaOrilla = t;
      if (t % 50 === 0) {
        filas.push(
          `      tick ${String(t).padStart(3)}  en la orilla ${hum('mojada').toFixed(4)}  ` +
            `en lo seco ${hum('seca').toFixed(4)}`,
        );
      }
    }

    console.log(
      `\n─── LA YESCA SE AHOGA EN LA ORILLA ───\n` +
        `  la celda que \`laOrilla()\` elige: ${JSON.stringify(o.parada)} con wet ` +
        `${humedadDeLaCelda(o, o.parada).toFixed(4)}  (su prueba de «seca» es wet < 0,9)\n` +
        `  la celda seca más cercana: ${JSON.stringify(secas[0])} con wet ` +
        `${(secas[0] === undefined ? -1 : humedadDeLaCelda(o, secas[0])).toFixed(4)}, a 1 celda\n` +
        `  HUMEDAD_QUE_APAGA = ${String(HUMEDAD_QUE_APAGA)}\n${filas.join('\n')}\n` +
        `  la de la orilla cruza el 0,45 en el tick ${String(cruzoLaDeLaOrilla)} ` +
        `y el pescado no llega a la mano hasta el ${String(PESCADO_EN_LA_MANO)}: pierde la carrera por ` +
        `${String(PESCADO_EN_LA_MANO - cruzoLaDeLaOrilla)} ticks\n`,
    );

    // La celda de la escena NO es seca para lo que la yesca necesita…
    expect(humedadDeLaCelda(o, o.parada)).toBeGreaterThan(HUMEDAD_QUE_APAGA);
    // …y hay una de verdad seca a una celda de ahí.
    expect(secas[0]).toBeDefined();
    expect(humedadDeLaCelda(o, secas[0] ?? o.parada)).toBeLessThan(HUMEDAD_QUE_APAGA);
    // La de la orilla se ahoga ANTES de que la criatura tenga el pescado…
    expect(cruzoLaDeLaOrilla).toBeGreaterThan(0);
    expect(cruzoLaDeLaOrilla).toBeLessThan(PESCADO_EN_LA_MANO);
    // …y la de al lado no se ahoga nunca.
    expect(hum('seca')).toBeLessThan(HUMEDAD_QUE_APAGA);
    MEDIDO.set(
      'la humedad',
      `la celda de la escena mide wet ${humedadDeLaCelda(o, o.parada).toFixed(4)} y la yesca cruza el ` +
        `${String(HUMEDAD_QUE_APAGA)} en el tick ${String(cruzoLaDeLaOrilla)}, ${String(PESCADO_EN_LA_MANO - cruzoLaDeLaOrilla)} ` +
        `ticks antes de que el pescado llegue a la mano. A una celda hay wet 0,1500`,
    );
  }, 300_000);

  it('DIAGNÓSTICO 9 · EL FUEGO MÁS BARATO CUESTA MÁS QUE EL TANQUE QUE LA ESCENA LE DA: 485 contra 310', () => {
    // ─── LA PARED QUE NO ES DE MATERIA NI DE HUMEDAD: ES DE PLATA ──────────
    //
    // La ventana de potencia del contacto empieza en 105,42, y para llegar ahí hace
    // falta una vara de al menos 0,3506875 kg de madera (`emitsPower = fuelEnergy ×
    // mass × 16,7`). Frotar cobra `heatCapacity × ΔT / eficiencia`, y para esa vara
    // eso es 0,3507 × 1,7 × (300 − 15) / 0,35 = **485,45 de aliento**.
    //
    // La escena del documento le da **310**. Y los 310 no son de gusto: están
    // elegidos —dice el comentario de `laEscenaDelDocumento`— porque con el tanque
    // lleno D3 no elige comida. O sea que la escena la pone hambrienta para que
    // QUIERA cocinar, y con eso mismo la deja sin plata para PODER.
    //
    // Medido en el mundo, con una vara de 0,40 kg: frotar le saca 11,7071 por tick
    // durante 25 ticks, se muere en el tick 141 y la leña no pasa de 169,67 °C de
    // los 300 que necesita. Le faltaron 130 grados de los 285 que hay que subir.
    //
    // Esto NO se arregla en la mente y hay que decirlo: o la eficiencia de frotar
    // sube, o el tanque de la escena sube, o la ventana del contacto baja. Las tres
    // son decisiones de otro y ninguna se toma acá.
    const p = new Partida(conLenaSeca(310), { vigilar: true });
    const lena = p.state.bodies.get('lena0');
    if (lena === undefined) throw new Error('la escena no tiene leña');
    // Los tres números que la cuenta usa, VERIFICADOS contra el motor.
    expect(qualityOf(lena.body, 'ignitionPoint', p.state.phys)).toBe(IGNICION_MADERA);
    expect(qualityOf(lena.body, 'heatCapacity', p.state.phys)).toBeCloseTo(0.4 * CALOR_ESPECIFICO_MADERA, 10);
    const cuestaLaMasChica =
      (YESCA_MAS_CHICA * CALOR_ESPECIFICO_MADERA * (IGNICION_MADERA - AMBIENTE)) / EFICIENCIA_DE_FROTAR;

    const m = new Mente({ actor: 'ana', memoria: new Creencias() });
    const mentes = new Map([['ana', m]]);
    let porTickDeFrotar = 0;
    let ticksFrotando = 0;
    let murioEn = -1;
    let anterior = aliento(p, 'ana');
    // ─── LA TEMPERATURA SE MIDE COMO MÁXIMO Y SOBRE TODAS LAS LEÑAS ──────────
    //
    // Y las dos cosas hacen falta. La primera versión de este test leía `lena0` al
    // final de la corrida y imprimía 15,00 °C: la criatura había frotado `lena1` —el
    // planificador elige por su propio orden, no por el mío— y, muerta ella, la leña
    // se había enfriado sola hasta el ambiente. El máximo sobre las cuatro contesta
    // «hasta dónde llegó a calentar», que es la pregunta.
    let hastaDonde = 0;
    // Y el motivo con el que la innata se rinde trae el número adentro: se lee del
    // `outcome` del vuelo que aterriza, que es lo único que lo dice.
    let comoSeRindio = '';
    let vueloAnterior: unknown;
    for (let t = 0; t < 400 && murioEn < 0; t++) {
      vivir(p, mentes, 1);
      const enVuelo: unknown = p.vuelo('ana');
      if (vueloAnterior !== undefined && enVuelo !== vueloAnterior) {
        const o = (vueloAnterior as { outcome?: { ok: boolean; why?: string } }).outcome;
        if (o?.ok === false && (o.why ?? '').includes('aliento')) comoSeRindio = o.why ?? '';
      }
      vueloAnterior = enVuelo;
      for (const b of p.state.bodies.values()) {
        if (!b.body.id.startsWith('lena')) continue;
        const T = qualityOf(b.body, 'temperature', p.state.phys);
        if (T > hastaDonde) hastaDonde = T;
      }
      if (!p.state.actors.has('ana')) {
        murioEn = t;
        break;
      }
      const ahora = aliento(p, 'ana');
      if ((m.ultimoDespegue ?? '').startsWith('frotar') && anterior - ahora > 1) {
        porTickDeFrotar = anterior - ahora;
        ticksFrotando += 1;
      }
      anterior = ahora;
    }

    console.log(
      `\n─── LO QUE CUESTA PRENDER EL FUEGO MÁS CHICO QUE COCINA ───\n` +
        `  la yesca más chica de la ventana del contacto: ${YESCA_MAS_CHICA.toFixed(7)} kg de madera\n` +
        `  heatCapacity ${(YESCA_MAS_CHICA * CALOR_ESPECIFICO_MADERA).toFixed(6)} · ` +
        `ΔT ${String(IGNICION_MADERA - AMBIENTE)} · eficiencia ${String(EFICIENCIA_DE_FROTAR)}\n` +
        `  → cuesta ${cuestaLaMasChica.toFixed(2)} de aliento, y la escena del documento le da 310\n` +
        `  medido con una de 0,40 kg: ${porTickDeFrotar.toFixed(4)} por tick × ${String(ticksFrotando)} ticks, ` +
        `murió en el ${String(murioEn)} y la leña no pasó de ${hastaDonde.toFixed(2)} °C de ${String(IGNICION_MADERA)}\n` +
        `  ${comoSeRindio === '' ? '' : `y así se rindió la innata: «${comoSeRindio}»\n`}` +
        `  ARNÉS DE INVARIANTES: ${String(p.violaciones.length)} estados ilegales\n`,
    );

    // La cuenta, dicha como afirmación: el fuego más barato que cocina cuesta MÁS
    // que el tanque entero con el que la escena arranca.
    expect(cuestaLaMasChica).toBeGreaterThan(310);
    // Y en el mundo pasa exactamente eso: frotó, se quedó sin aliento y se murió con
    // la leña tibia.
    expect(murioEn).toBeGreaterThan(0);
    expect(murioEn).toBeLessThan(200);
    expect(hastaDonde).toBeLessThan(IGNICION_MADERA);
    expect(porTickDeFrotar).toBeGreaterThan(10);
    // Y la escena era legal: la leña está en celdas distintas.
    expect(p.violaciones, p.violaciones.slice(0, 3).join(' | ')).toEqual([]);
    MEDIDO.set(
      'el precio del fuego',
      `la yesca más chica que cocina cuesta ${cuestaLaMasChica.toFixed(2)} de aliento y la escena le da 310: ` +
        `frotó ${String(ticksFrotando)} ticks a ${porTickDeFrotar.toFixed(4)}, murió en el ${String(murioEn)} con la ` +
        `leña a ${hastaDonde.toFixed(2)} °C de ${String(IGNICION_MADERA)}`,
    );
  }, 300_000);

  it('DIAGNÓSTICO 10 · CON EL TANQUE LLENO Y LEÑA SECA, LA CRIATURA COCINA Y COME — y la cuenta igual no cierra', () => {
    // ═══ ESTE ES EL TEST QUE MIDE LO QUE EL TRAMO CONSIGUIÓ ═════════════════
    //
    // Sacadas las tres paredes de arriba —leña que existe, en celdas de verdad
    // secas, y un tanque que alcance para pagarla— la cadena entera corre sola
    // contra `stepWorld`, sin proveedor y sin que nadie le diga qué hacer. Los
    // cuatro ticks que lo dicen, y son de la corrida:
    //
    //     tick 163   el primer cuerpo del mundo con `emitsPower > 0`  ← PRENDIÓ
    //     tick 263   el primero con `digestibility >= 0,85` y calorías  ← COCINÓ
    //     tick 271   el primer `tragar`, y aterriza con `ok: true`  ← COMIÓ
    //
    // (el bocado era el 457 hasta que la espera dejó de ser ciega; hoy la espera
    // corta cuando la comida está lista —100 ticks en vez de 300— y el pescado se
    // levanta del fuego ocho ticks después de estar cocido en vez de cincuenta)
    //
    // Y los dieciséis despegues salen en fila, sin que nadie los escriba, con la
    // caña hecha de materia que puso el dios y sólo la yesca regalada:
    //
    //     ir → sostener → ir → sostener → unir     la caña, del decreto
    //     ir → aplicar → ir → aplicar              dos pescados
    //     ir → sostener → frotar                   el fuego, con la leña regalada
    //     poner → esperar(15 s) → sostener         la cocción
    //     tragar                                   el bocado
    //
    // **Es la primera vez en el proyecto que la criatura come algo que ella
    // cocinó**, y ahora además lo hace sobre un mundo que no le armó nadie.
    //
    // ─── Y ESTE BLOQUE ES EL QUE PRUEBA QUE EL CERROJO DEL 11 HACÍA FALTA ──
    //
    // Sin el cerrojo de `mientrasTantoYaHecho` esta misma corrida mide
    // **prendió −1, cocinó −1, comió −1, 0 bocados**: la criatura se queda
    // repitiendo el `ir` del `gap` y nunca va a buscar la leña que tiene al lado.
    // O sea que la cadena de la cocción, sobre el mundo decretado, **no corre sin
    // el arreglo**. Está medido en el DIAGNÓSTICO 11.
    //
    // ─── Y LA MITAD QUE NO SE PUEDE LEER DE MÁS ────────────────────────────
    //
    // No sobrevive los 20.000. Come UNA vez y se muere en el **5672**, y el motivo
    // es aritmético y no de conducta: un pescado cocido de 2,887 kg tiene
    // `calories` 21,81 (el de 2 kg, 15,11), y el fuego costó 485. **Un fuego vale
    // veintidós pescados**, y una yesca de 0,40 kg se consume en veinte segundos
    // mientras cocinar tarda cinco: alcanza para tres o cuatro. Cocinar, en esta
    // física y por esta vía, pierde por un factor de entre 5 y 22.
    //
    // ─── Y ARREGLAR LA ESPERA NO LO MOVIÓ, QUE ES EL DATO ──────────────────
    //
    // La espera dejó de ser ciega —corta a los 100 ticks y no a los 300, o sea que
    // le devuelve DIEZ de los veinte segundos que el fuego dura— y el resultado es
    // el mismo: **UN bocado**. El techo de «un fuego, un bocado» subió a tres o
    // cuatro en teoría y en la corrida sigue siendo uno, porque después de frotar
    // se queda con el tizón apagado en la mano y no le entra otra leña. Y la
    // no-monotonía, medida en el tramo J: con SEIS manos enciende dos fuegos y se
    // muere quince veces antes que con tres. Cuando una capacidad extra empeora el
    // resultado, lo que está mal es el signo de lo que esa capacidad habilita.
    //
    // Lo que eso quiere decir para el criterio (2) —que traducido a la moneda del
    // mundo es «comé al menos una vez»— es que comer una vez NO alcanza: hay que
    // comer mil de aliento, y el fuego se lleva medio tanque por adelantado. Y la
    // salida NO es cocinar más rápido: eso ya se hizo y no alcanzó. Aun con la
    // parada perfecta, un fuego da 20 s / 5 s = 4 piezas ≈ 81,5 de aliento contra
    // 485 de costo: sigue siendo 6× negativo. Las dos salidas que quedan son (a) no
    // volver a pagar el `frotar` —la ley 3 ya sabe propagar el fuego, medido en
    // `world/tests/el-fuego-no-se-propaga.test.ts`, y el planificador no lo sabe— y
    // (b) la calibración: `eficiencia` de la fricción (0,35) o
    // `STAMINA_POR_CALORIA` (1). La (b) es decisión del usuario y no se toca acá.
    // La ventana son 10.000 ticks y no 6000: muere en el 5672, así que 6000
    // alcanzaría por 328 ticks, y un margen de ese tamaño convierte cualquier
    // corrimiento en un rojo que no habla de nada. Se paga el reloj de más y la
    // afirmación —«no llega»— se lee holgada adentro de la corrida.
    const r = correr(conLenaSeca(1000), 'ana', 10_000);
    const bocados = [...r.cuenta]
      .filter(([k]) => k.startsWith('comer') || k.startsWith('tragar'))
      .reduce((a, [, v]) => a + v, 0);
    const tragoBien = [...r.aterrizados]
      .filter(([k]) => k.startsWith('comer') || k.startsWith('tragar'))
      .reduce((a, [, v]) => a + v, 0);

    console.log(
      `\n─── LA CADENA ENTERA, CONTRA EL MUNDO ───\n` +
        `  PRENDIÓ en el tick ${String(r.prendioEn)} · COCINÓ en el ${String(r.cocinoEn)} · ` +
        `COMIÓ en el ${String(r.comioEn)} (con ${dos(r.alientoAntesDelBocado)} de aliento)\n` +
        `  bocados ${String(bocados)}, de los cuales aterrizaron bien ${String(tragoBien)}\n` +
        `  murió en el tick ${String(r.murioEn)} · ticks perdidos ${String(r.ticksPerdidos)}\n` +
        `  aliento ${r.aliento.join(' ')}\n` +
        `  los pasos de la cadena, en orden de despegue:\n` +
        `      ${r.nombres.slice(0, 16).join(' → ')}\n` +
        `  ARNÉS DE INVARIANTES: ${String(r.violaciones.length)} estados ilegales\n` +
        `  ─── y por qué igual no llega ───\n` +
        `  el fuego costó ~485 de aliento y un pescado cocido de 2,887 kg tiene calories 21,81:\n` +
        `  un fuego vale 22 pescados, y la yesca de 0,40 kg dura 20 s cocinando de a 5.\n` +
        `  con la espera que ya NO es ciega (100 ticks en vez de 300) el bocado se adelantó del\n` +
        `  tick 457 al 257 y el conteo de bocados no se movió: sigue siendo UNO en 20.000.\n`,
    );

    // LOS TRES HECHOS, en orden, y cada uno leído del ESTADO DEL MUNDO.
    expect(r.prendioEn).toBeGreaterThan(0);
    expect(r.cocinoEn).toBeGreaterThan(r.prendioEn);
    expect(r.comioEn).toBeGreaterThan(r.cocinoEn);
    // Y el bocado no es un despegue: aterrizó bien. Es la regla del número 2 de los
    // catorce —no midas el proxy, medí la cosa— aplicada a la boca.
    expect(tragoBien).toBeGreaterThan(0);
    // Y el mundo sobre el que se midió es legal.
    expect(r.violaciones, r.violaciones.slice(0, 3).join(' | ')).toEqual([]);
    expect(r.ticksPerdidos).toBe(0);
    // Y LO QUE NO SE ABLANDA: con todo esto regalado, igual se muere. El criterio
    // (2) no se cumple, y si algún día esta línea se pone roja es porque alguien
    // arregló la aritmética y hay que ir a levantar el `it.fails` de arriba.
    expect(r.murioEn).toBeGreaterThan(0);
    MEDIDO.set(
      'la cadena entera',
      `PRENDIÓ en el ${String(r.prendioEn)}, COCINÓ en el ${String(r.cocinoEn)} y COMIÓ en el ` +
        `${String(r.comioEn)} (${String(tragoBien)} bocado bien aterrizado) — la primera vez en el proyecto. ` +
        `Y aun así muere en el ${String(r.murioEn)}: el fuego cuesta 485 y un pescado cocido devuelve 21,81`,
    );
  }, 300_000);

  it('DIAGNÓSTICO 11 · EL BUCLE QUE SE LLEVABA EL 98% DE LA VIDA, y la madera que no es yesca', () => {
    // ═══ LAS DOS COSAS QUE EL MUNDO DECRETADO DESTAPÓ ═══════════════════════
    //
    // Las dos estaban tapadas por la escena plantada, y las dos son de este
    // tramo. La primera se arregló en `src/`; la segunda no se arregla acá.
    //
    // ─── (a) EL BUCLE, Y POR QUÉ ERA INVISIBLE ─────────────────────────────
    //
    // Con el pescado en la mano, la criatura pide
    // `holding(tag:carnoso,toxicity<0.0528)` y `plan()` contesta `gap` con un
    // `nearest` de UN paso: `ir(suelta:-6:-7:2, within:1)`, o sea «acercate a lo
    // que podría hacer de parrilla» (el `porQue` de ese paso dice
    // `ignitionPoint>507`, que es la arcilla). Y la criatura **ya está a una
    // celda** de esa pieza, así que el `ir` aterriza con `ok:true` en un tick sin
    // moverla; al tick siguiente D4 vuelve a pedir el mismo plan, sale el mismo
    // `gap`, y con él el mismo `ir`. Medido ANTES del arreglo:
    //
    //     tanque 310 ....  6045 despegues de `ir(suelta:-6:-7:2)` en  6171 ticks
    //     tanque 1000 ... 19846 despegues de `ir(suelta:-6:-7:2)` en 19971 ticks
    //     con leña seca al lado ... prendió −1, cocinó −1, comió −1, 0 bocados
    //
    // La tercera línea es la que decide: **sin el arreglo, la cadena de la
    // cocción no corre**. La criatura tiene la yesca a la vista y no va a
    // buscarla nunca, porque se le va la vida en un paso ya dado.
    //
    // Y era invisible por dos motivos que hay que dejar escritos: sobre la escena
    // plantada NO HABÍA ninguna pieza que pudiera hacer de parrilla, así que
    // `nearest` venía vacío y la escalera caía a D5 (la rama que su propio
    // encabezado describe); y el bucle **no gasta aliento**, así que la criatura
    // «vivía más» y la pendiente del 6/6 daba exactamente la de respirar, que se
    // leyó como una mejora. → **REGLA: una pendiente que baja no es una mejora.
    // Preguntá qué dejó de hacer.**
    //
    // EL ARREGLO es `EstadoDeLaEscalera.mientrasTantoYaHecho`, el mismo cerrojo
    // que `fondosQueFallaron` y `bocadoQueFallo`: el «mientras tanto» de un `gap`
    // se guarda por FIRMA y no se repite; con la firma puesta la escalera cae a
    // D5, que es lo que ya hacía cuando `nearest` venía vacío. Se limpia cuando
    // la meta cambia y cuando aparece un plan de verdad.
    //
    // LO QUE CUESTA, dicho sin maquillaje: la criatura pasa a deambular, o sea a
    // gastar 1,65× lo que cuesta respirar, y **muere ANTES** (3743 contra 6184).
    // Es la misma cuenta del 6/6: aguantar no es el criterio. Lo que compra es
    // que la cadena del fuego vuelva a correr.
    const r = correr(laEscenaDelDocumento(), 'ana', 2000);
    const irMasRepetido = [...r.cuenta]
      .filter(([k]) => k.startsWith('ir('))
      .reduce<readonly [string, number]>((a, b) => (b[1] > a[1] ? b : a), ['—', 0]);

    // ─── (b) LA MADERA DEL DECRETO NO ES YESCA, Y ESO NO SE ARREGLA ACÁ ────
    //
    // La ventana de masa NO se copia de ningún comentario **y tampoco se parsea
    // del `why`**: se MIDE con el planificador, que es el único que sabe si una
    // masa sirve. Se le regala a la misma escena cuatro varas de madera de masa
    // `m`, se le pide lo cocido, y se anota si el plan CIERRA. Barriendo `m` sale
    // la ventana de verdad, y adentro del barrido va **la masa exacta de la
    // madera que el dios decreta**.
    //
    // (Se intentó primero leyendo el `why` con una expresión regular y salió mal
    // en el primer intento: el `why` nombra CINCO cotas de `emitsPower` —la que
    // falta, la que el catálogo alcanza, y la de la otra fila— y las dos primeras
    // que matchean son de ventanas distintas. Quedó anotado porque es el mismo
    // error de siempre: medir el texto en vez de medir la cosa.)
    //
    // MEDIDO: de las 62 sueltas de los 9 chunks de la parada madera hay UNA y
    // pesa **2,3280 kg**, y con esa masa el plan no cierra. O sea que la pared (7)
    // se movió de «no hay leña» a **«no hay leña DEL TAMAÑO que la fricción
    // admite»**, y eso es del oráculo —qué masas siembra un bioma— y no del motor
    // ni de la mente.
    const o = laOrilla();
    const cxp = Math.floor(o.parada.x / 16);
    const cyp = Math.floor(o.parada.y / 16);
    const maderas: number[] = [];
    for (let cx = cxp - 1; cx <= cxp + 1; cx++) {
      for (let cy = cyp - 1; cy <= cyp + 1; cy++) {
        for (const s of decretoDe(o.dios, PHYS, cx, cy).chunk.sueltas) {
          // `unfx` Y NO `s.masa` A SECAS. El `masa` del decreto es un `Fixed`
          // —punto fijo— y no kilos: sin la conversión esta línea imprimía
          // «2328,0000 kg» de madera, que es mil veces la pieza que el mundo
          // materializa (2,3280 kg, verificado contra `state.bodies` abajo). Es
          // exactamente la clase de número que este archivo existe para no
          // publicar. `world/src/dios.ts` lo hace igual: `mass: unfx(s.masa)`.
          if (s.substance === 'madera') maderas.push(unfx(s.masa));
        }
      }
    }
    maderas.sort((a, b) => a - b);

    // Y LA CONVERSIÓN SE VERIFICA CONTRA EL MUNDO, que es lo que impide volver a
    // publicar «2328 kg»: un tick de mundo y la pieza está en `state.bodies` con
    // la masa que el motor le dio. Si algún día `Suelta.masa` deja de ser `Fixed`,
    // esto se pone rojo acá y no en un informe.
    const unTick = new Partida(laEscenaDelDocumento());
    unTick.avanzar(1);
    const maderasEnElPiso = [...unTick.state.bodies.values()]
      .filter(
        (b) => b.body.id.startsWith('suelta:') && b.body.parts.some((x) => x.substance === 'madera'),
      )
      .map((b) => qualityOf(b.body, 'mass', unTick.state.phys))
      .sort((a, b) => a - b);
    expect(maderasEnElPiso.length).toBe(maderas.length);
    for (let i = 0; i < maderas.length; i++) {
      expect(maderasEnElPiso[i] ?? -1).toBeCloseTo(maderas[i] ?? -1, 9);
    }

    const meta = interpretar(metaComestibleDe('carnoso') ?? '');
    if (meta === undefined) throw new Error('sin predicado');
    const secas = celdasSecas(o, 4);
    const cierraCon = (masa: number): boolean => {
      const w = conRegalo(
        1000,
        secas.map((c, i) => enElPiso(cuerpo(`lena${String(i)}`, 'madera', masa, {}, 'vara'), c)),
      );
      const rr = plan(
        { id: 'meta', goal: meta, after: [], porque: 'el test' },
        vistaDe(new Partida(w), 'ana'),
        EXPANSIONES_POR_TICK * 400,
      );
      return rr.k === 'plan';
    };
    // El barrido incluye las dos masas que importan: la 0,40 de la contraprueba
    // (que cierra, y por eso el DIAGNÓSTICO 10 existe) y la del decreto.
    const barrido = [0.2, 0.3, 0.35, 0.4, 0.48, 0.6, 1, ...maderas].sort((a, b) => a - b);
    const filas = barrido.map((m) => ({ m, cierra: cierraCon(m) }));
    const cierraLaDelDecreto = filas.filter((f) => maderas.includes(f.m)).every((f) => f.cierra);
    const algunaCierra = filas.some((f) => f.cierra);

    console.log(
      `\n─── (a) EL BUCLE DEL «MIENTRAS TANTO», DESPUÉS DEL CERROJO ───\n` +
        `  el \`ir\` más repetido en 2000 ticks: ${irMasRepetido[0]} × ${String(irMasRepetido[1])}` +
        `   (antes del cerrojo: 6045 en 6171 ticks)\n` +
        `  el cerrojo puesto al final de la corrida: ${String(r.mente.estado.mientrasTantoYaHecho)}\n` +
        `\n─── (b) QUÉ MASA DE MADERA DEJA CERRAR EL PLAN, MEDIDO CON EL PLANIFICADOR ───\n` +
        `  la madera que el dios decreta en los 9 chunks de la parada: ` +
        `${maderas.length === 0 ? '(ninguna)' : maderas.map((m) => `${m.toFixed(4)} kg`).join(', ')}\n` +
        filas
          .map(
            (f) =>
              `      ${f.m.toFixed(4)} kg  ${f.cierra ? 'plan  ← CIERRA' : 'gap'}` +
              `${maderas.includes(f.m) ? '   ← ÉSTA ES LA DEL DECRETO' : ''}`,
          )
          .join('\n') +
        `\n`,
    );

    // (a) EL MECANISMO, Y NO EL RELOJ: el cerrojo existe y está puesto —o sea que
    // la escalera pasó por la rama del `gap` y la cerró—, y ningún `ir` se repite
    // más que un puñado de veces. El techo de 10 es holgadísimo contra los 2
    // medidos y contra los 6045 de antes: lo que separa es un orden de magnitud,
    // no un decimal.
    expect(r.mente.estado.mientrasTantoYaHecho).toBeTypeOf('string');
    expect(irMasRepetido[1], `${irMasRepetido[0]} se repitió de más`).toBeLessThan(10);

    // (b) El dios SÍ decreta madera…
    expect(maderas.length).toBeGreaterThan(0);
    // …hay masas con las que el plan cierra, o sea que el barrido mide algo…
    expect(algunaCierra).toBe(true);
    // …y con la masa que el dios decreta NO cierra. Ésta es la pared.
    expect(cierraLaDelDecreto).toBe(false);
    MEDIDO.set(
      'el bucle',
      `CERRADO: el \`ir\` más repetido pasó de 6045 en 6171 ticks a ${String(irMasRepetido[1])} en 2000 ` +
        `(\`mientrasTantoYaHecho\`). Sin el cerrojo la criatura NO prende fuego ni con la yesca al lado`,
    );
    MEDIDO.set(
      'el tamaño de la leña',
      `con las masas que cierran el plan (${filas
        .filter((f) => f.cierra)
        .map((f) => f.m.toFixed(2))
        .join(', ')} kg) la cadena corre, y la única madera que el dios decreta pesa ` +
        `${(maderas[0] ?? -1).toFixed(4)} kg: no cierra`,
    );
  }, 300_000);

  it('CONTRAPRUEBA · con el eslabón REGALADO la mente come, y a 2000 ticks le LLENÓ el tanque', () => {
    // EL BUCLE DE LA NECESIDAD, CERRADO Y BARATO DE VIGILAR. Es la mitad de la
    // contraprueba que sigue estando verde: con comida comestible al alcance, la
    // criatura la come sola y el aliento SUBE. Lo que ya no se sostiene es que
    // eso alcance para los 20.000, y eso lo mide el `it.fails` de abajo.
    //
    // MEDIDO sobre el mundo decretado: **66 bocados y 849,30 de aliento a los
    // 2000 ticks**, contra 147,50 de la misma escena sin cocidos. O sea que en
    // 2000 ticks se comió DOS TERCIOS de la despensa y llenó el tanque; el resto
    // de la corrida no tiene con qué (los 34 que quedan se pudren).
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
    // La guarda subió de `> 0` a `> 50`: con 66 medidos, un `> 0` no distinguiría
    // «come» de «comió una vez y se trabó», que es exactamente la diferencia que
    // este bloque existe para vigilar.
    expect(bocados).toBeGreaterThan(50);
    expect(r.murioEn).toBe(-1);
    // Y la diferencia es la vida: con la despensa SUBE el aliento, sin ella baja.
    expect(r.alientoFinal).toBeGreaterThan(control.alientoFinal);
    expect(r.alientoFinal).toBeGreaterThan(800);
    expect(r.mente.tropiezo).toBeUndefined();
  }, 300_000);

  it.fails('CONTRAPRUEBA · y con el eslabón regalado TAMPOCO llega: come 66 y muere en el 12.031', () => {
    // ─── ESTA CONTRAPRUEBA SE DIO VUELTA, Y ES LA NOTICIA MÁS INCÓMODA ─────
    //
    // Contestaba «¿falta sólo el fuego, o además falta otra cosa?» regalándole
    // EXACTAMENTE el eslabón que no sabe hacer —cien pescados ya cocidos— y nada
    // más, y la respuesta era «sólo el fuego»: murió en −1, 65 bocados, aliento
    // final 1,4593. Sobre el mundo decretado la respuesta es otra:
    //
    //     murió en el 12.031 de 20.000 · 66 bocados · aliento final 0,0029
    //     aliento: 0:321,8 → 2000:849,3 → 6000:510,6 → 10000:171,9 → 12000:2,7
    //     quedaron 34 cocidos con toxicity 0,9921 — la ley 6 los pudrió
    //
    // ─── Y EL MOTIVO ESTABA ESCRITO EN EL NÚMERO VIEJO ─────────────────────
    //
    // **Aquel 1,4593 era el margen con el que pasaba, sobre un presupuesto de
    // 1000: el 0,15%.** Las dos cuentas, lado a lado:
    //
    //     plantada   310 + 691,46 comidos − 1000 de vivir = +1,46  → llega
    //     decretada  310 + 690,00 comidos − 1000 de vivir = +0,00  → no llega
    //
    // Comió MÁS (66 contra 65) y llegó menos lejos. Lo que cambió no es la boca:
    // es que en un mundo con cosas alrededor la mente CAMINA. El tanque se llena
    // a los 2000 ticks, los 34 cocidos que sobran se pudren, y desde ahí gasta
    // 0,0847/tick en deambular sin nada que comer.
    //
    // → **REGLA: un test que pasa por el 0,15% de su presupuesto no está
    // midiendo lo que dice medir.** «La conducta está, falta la aritmética» era
    // cierto y estaba sostenido por 1,46 de aliento.
    //
    // ─── Y ACÁ SE FUE UN `ANIMA_BANCO=1` QUE ERA UNA TRAMPA ────────────────
    //
    // Las dos líneas que medían el criterio estaban detrás de `if
    // (!MIDIENDO_EN_SERIO) return`, o sea que en una corrida normal este test era
    // verde POR NO PREGUNTAR. El gate se puso por costo (4,1 s entonces, 18,5 s
    // hoy), y el costo es real — pero la corrida es determinista y no toca un
    // reloj, así que el gate no protegía de ninguna flakiness: sólo escondía el
    // resultado. Hoy afirma siempre, en rojo esperado.
    //
    // Lo que ADEMÁS se ve, y es un hallazgo aparte que sigue en pie: **la comida
    // no se guarda.** Comió 66 de los 100 y los 34 que quedan terminan en
    // `toxicity` 0,9921. Una criatura que llene el tanque y se siente al lado de
    // la despensa la pierde igual.
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
        : `NO CUMPLE: come ${String(bocados)} y muere en el ${String(r.murioEn)} (310 + ${comidos.toFixed(0)} ` +
            `comidos − 1000 de vivir = ${r.alientoFinal.toFixed(4)}). Sobre la escena plantada llegaba, y por +1,46`,
    );

    expect(r.ticks).toBe(CRITERIO_TICKS);
    // La boca sigue cerrando el bucle, y eso NO es lo que falla.
    expect(bocados).toBeGreaterThan(50);
    // EL CRITERIO, y no se ablanda: con el eslabón regalado tampoco llega.
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
    //   11.851  HOY, sobre el mundo decretado y con el eslabón A cerrado
    //
    // Y el 11.851 no es un retroceso: es el mismo diagnóstico del 6/6 con el
    // tanque grande. Consigue el pescado, sube el pedido a lo cocido, se queda sin
    // vía y cae a las conductas de fondo, que CAMINAN — 1000 ÷ 11.851 = 0,0844 por
    // tick contra los 0,0500 de sólo respirar, el mismo 1,7× medido allá.
    // Deambular con el tanque lleno cuesta lo mismo por tick que deambular con el
    // tanque en 310; lo único que cambia es cuánto dura.
    //
    // El número intermedio que hubo acá —19.971, con el mundo decretado y el
    // bucle del `ir` sin arreglar— es el mismo espejismo del 6/6: aguantaba casi
    // los 20.000 porque no hacía NADA. 19.846 de esos ticks eran despegues de
    // `ir(suelta:-6:-7:2)`.
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
    // ─── HASTA DÓNDE LLEGA ESTE CERO, Y ES LA MITAD QUE FALTABA ─────────────
    //
    // El adversario del tramo K lo cobró bien: desde que el mundo materializa el
    // decreto, **el tick cuesta por cuerpo y la población crece con lo caminado**.
    // Medido en `world/tests/las-sueltas-se-materializan.test.ts`: una criatura
    // que camina derecho sin parar deja 4493 cuerpos a los 2000 ticks y 23.353 a
    // los 10.000, y el tick pasa de 7,55 a 74,06 ms — o sea que cruza la ventana
    // de 50 ms ANTES de los 20.000, y ahí `ticksPerdidos` deja de ser cero.
    //
    // O sea que el cero de este renglón vale para ESTA partida y no para
    // cualquiera, y lo que decide si vale es cuántos cuerpos terminó habiendo.
    // Por eso se imprime, y por eso hay una guarda: el día que esta partida
    // empiece a recorrer mundo, el número que se publica como criterio (4) deja de
    // ser el que se midió. El mecanismo —la población sólo sube y ningún cuerpo se
    // retira nunca— está afirmado sin cronómetro en el bloque (4) de
    // `world/tests/ataque-a-las-sueltas.test.ts`.
    const cuerpos = r.partida.state.bodies.size;
    console.log(
      `\n─── EL CRITERIO (4), CON EL RELOJ DE PARED PUESTO ───\n` +
        `  ${String(r.ticks)} ticks en ${r.ms.toFixed(0)} ms = ${porTick.toFixed(3)} ms por tick\n` +
        `  la ventana de un tick a ${String(r.partida.state.hz)} Hz son ${ventana.toFixed(1)} ms ` +
        `→ sobra un factor de ${(ventana / porTick).toFixed(0)}\n` +
        `  ticksPerdidos ${String(r.ticksPerdidos)} (porTiempo ${String(r.porTiempo)}, porFalla ${String(r.porFalla)})\n` +
        `  Y CON CUÁNTO MUNDO: ${String(cuerpos)} cuerpos al final. Una criatura que camina\n` +
        `  derecho llega a 23.353 a los 10.000 ticks y ahí el tick vale 74 ms contra 50\n` +
        `  de ventana, así que este cero NO se puede leer como «el criterio (4) vale\n` +
        `  para cualquier criatura»: vale para una que no recorre mundo.\n`,
    );
    MEDIDO.set(
      'ticks perdidos',
      `${String(r.ticksPerdidos)} en ${String(r.ticks)} ticks con reloj de pared ` +
        `(${porTick.toFixed(3)} ms/tick contra una ventana de ${ventana.toFixed(0)}), ` +
        `con ${String(cuerpos)} cuerpos al final — NO vale para una criatura que camine`,
    );
    // LA GUARDA, determinista y siempre afirmada: si esta partida pasara a recorrer
    // mundo, el cero de arriba dejaría de significar lo que dice y hay que volver a
    // discutirlo. 5000 es el punto donde el tick de esta máquina ya cuesta ~8 ms.
    expect(cuerpos).toBeLessThan(5000);

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
        `        de dónde sale cada gramo: ${l('deambular')}`,
        '',
        `      LAS PAREDES QUE QUEDAN, sobre el mundo DECRETADO y no sobre una escena plantada:`,
        `        7 · ${l('la leña')}`,
        `        8 · ${l('la humedad')}`,
        `        9 · ${l('el precio del fuego')}`,
        `       10 · ${l('la cadena entera')}`,
        `       11 · ${l('el bucle')}`,
        `            ${l('el tamaño de la leña')}`,
        '',
        `      y con el eslabón regalado: ${l('regalado')}`,
        '',
        `  (3) p99 < 5 ms ............. NO CUMPLE (medido y aceptado en @anima/world)`,
        `        ${l('p99')}`,
        `        lo que esta mente agrega: ${l('la mente')}`,
        '',
        `  (4) ticksPerdidos === 0 .... CUMPLE, CON UNA CONDICIÓN PUESTA`,
        `        ${l('ticks perdidos')}`,
        `        la condición: el tick cuesta por cuerpo y la población crece con lo`,
        `        caminado. Una criatura que camina derecho deja 23.353 cuerpos a los`,
        `        10.000 ticks y el tick pasa a 74 ms contra una ventana de 50, o sea`,
        `        que cruza ADENTRO de los 20.000 del criterio. El cero de arriba vale`,
        `        para esta partida, que no recorre mundo, y no para cualquiera.`,
        '',
        '═══════════════════════════════════════════════════════════════════════════',
        '',
      ].join('\n'),
    );
    expect(MEDIDO.size).toBeGreaterThan(0);
  });
});
