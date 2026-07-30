// ═══ (2) VEINTE MIL TICKS · a · EL CRITERIO Y LOS DOS ESLABONES ═══
//
// La corrida del criterio, la aritmética que la explica, y los seis diagnósticos que
// cuentan por qué NO come: lo que ya NO es el problema (la mente quiere, y no come
// crudo porque la mata) y dónde se cortaba la cadena (el eslabón A y el eslabón B).
//
// Alimenta el cuaderno con: `aritmética`, `supervivencia`, `quiere`, `toxicidad`, `comida`,
// `eslabón A`, `eslabón B` y `deambular`.
//
// El bloque (2) está partido en CUATRO archivos —2a, 2b, 2c y 2d— y los cuatro
// declaran el MISMO `describe`, así que el informe de vitest los sigue agrupando
// bajo «(2) sobrevive 20.000 ticks sola» como cuando era un archivo solo. El corte
// es por costo: juntos tardaban ~100 s. El arnés y el mapa del corte están en
// `./el-criterio.ts`.

import { describe, expect, it } from 'vitest';
import { HZ_DE_REFERENCIA, qualityOf, specOf } from '@anima/physics';
import type { QualityId } from '@anima/physics';
import { COSTO_VIVIR_POR_SEGUNDO } from '@anima/world';
import { Partida } from '@anima/perceive';
import { EXPANSIONES_POR_TICK, SEGUNDOS_DE_COCCION, interpretar, plan } from '@anima/plan';
import type { GoalNode } from '@anima/plan';
import { comer } from '@anima/skills/innatas';
import { Creencias } from '../src/creencias.js';
import { Mente, vivir } from '../src/mente.js';
import { necesidades } from '../src/necesidades.js';
import { metaComestibleDe, opportunities } from '../src/oportunidades.js';
import {
  CRITERIO_TICKS,
  laEscenaDelDocumento,
  conFuegoYLosa,
  conLenaSeca,
  aliento,
  vistaDe,
  correr,
  rechazosDelMundo,
  nacidos,
  enLaMano,
  dos,
} from './el-criterio.js';
import { cuaderno } from './el-cuadro.js';

/** Lo que este pedazo anota para el cuadro. Ver `./el-cuadro.ts`. */
const MEDIDO = cuaderno('2a-la-cadena');

describe('(2) sobrevive 20.000 ticks sola', () => {
  it('la aritmética del criterio: el tanque de ARRANQUE no llega a los 20.000 ticks', () => {
    // ─── ESTE BLOQUE DECÍA OTRA COSA, Y LA CONCLUSIÓN SOBREVIVIÓ ────────────
    //
    // Decía «20.000 ticks SON exactamente un tanque de aliento» y afirmaba
    // `soloVivir === tanque`: con `COSTO_VIVIR_POR_SEGUNDO` en 1,0 los 1000
    // segundos costaban 1000 y el tanque topa en 1000. Era cierto y era bonito.
    //
    // El usuario bajó la constante a **0,34** (tramo M), así que los 1000 segundos
    // cuestan 340 y el tanque LLENO alcanzaría para 58.823 ticks. Lo que salva la
    // conclusión —«el criterio (2) es comé al menos una vez»— es que la criatura
    // **no arranca con el tanque lleno: arranca con 310**, que es lo que la pone
    // hambrienta (ver `laEscenaDelDocumento`). Con 310 y 0,34, estar quieta compra
    // 18.235 ticks contra los 20.000 que el criterio pide.
    //
    // Y eso no es casualidad tampoco: es **el borde de abajo de la ventana** con la
    // que se eligió el 0,34 (`oracle/tests/presupuesto.test.ts`, «LA VENTANA
    // ENTERA»). Abajo de 0,3100 el tanque de arranque llegaría solo y el criterio
    // se cumpliría sin comer. O sea que este `expect` es el guardián de ese borde,
    // visto desde el otro paquete.
    const tanque = specOf('stamina').range[1];
    const arranque = 310;
    const segundos = CRITERIO_TICKS / HZ_DE_REFERENCIA;
    const soloVivir = segundos * COSTO_VIVIR_POR_SEGUNDO;
    const ticksQuieta = Math.floor((arranque / COSTO_VIVIR_POR_SEGUNDO) * HZ_DE_REFERENCIA);
    expect(soloVivir).toBeGreaterThan(arranque);
    expect(ticksQuieta).toBeLessThan(CRITERIO_TICKS);
    console.log(
      `\n─── LA ARITMÉTICA DEL CRITERIO ───\n` +
        `  ${String(CRITERIO_TICKS)} ticks ÷ ${String(HZ_DE_REFERENCIA)} Hz = ${String(segundos)} s de mundo\n` +
        `  × COSTO_VIVIR_POR_SEGUNDO (${String(COSTO_VIVIR_POR_SEGUNDO)}) = ${String(soloVivir)} de aliento SÓLO por estar viva\n` +
        `  y arranca con ${String(arranque)} de un tanque que topa en ${String(tanque)}:\n` +
        `  estar quieta le compra ${String(ticksQuieta)} ticks de los ${String(CRITERIO_TICKS)}.\n` +
        `  O sea: el criterio (2) sigue siendo «comé al menos una vez».\n`,
    );
    MEDIDO.set(
      'aritmética',
      `${String(CRITERIO_TICKS)} ticks = ${String(soloVivir)} de aliento y arranca con ${String(arranque)}: quieta llega al ${String(ticksQuieta)}`,
    );
  });

  it.fails(
    'CRITERIO: 20.000 ticks viva — ACEPTADO ROJO: no puede pagar el primer fuego (645,5 contra un tanque de 310)',
    () => {
      // ─── POR QUÉ ESTE ROJO ESTÁ ACEPTADO, Y NO ES «TODAVÍA NO LLEGAMOS» ────
      //
      // Lo de más abajo describe el SÍNTOMA —pesca, guarda el pescado y se muere
      // esperando un fuego— y se escribió cuando parecía que faltaba enseñarle
      // algo a la mente. No falta. La causa está medida y es aritmética:
      //
      //   comida cruda que paga, en lo que el dios decreta ...... NINGUNA, 20/20
      //   lo más barato que se puede encender EN TODO EL MUNDO ... 645,5 de aliento
      //   con qué arranca esta criatura .......................... 310
      //
      // (`world/tests/hay-comida-sin-fuego.test.ts` y
      // `world/tests/la-escalera-construible.test.ts`, bloque 1. El piso es del
      // MUNDO y no de esta parada: sale de la sustancia ardible más fácil de
      // prender del catálogo, la hoja a 180 °C, y de que frotar cuesta
      // proporcional a la masa.)
      //
      // Comer pide cocinar, cocinar pide fuego, y el fuego más barato sale 2,08×
      // el tanque ENTERO. **Ningún trabajo sobre el planificador ni sobre la mente
      // puede dar vuelta este criterio con el tanque canónico**, y la escalera de
      // la yesca tampoco: abarata el fuego GRANDE (4020 → 860) y no el primer
      // fósforo, que es el que no se paga.
      //
      // Se le presentaron al usuario cuatro salidas, todas del mundo y ninguna de
      // este archivo: sembrar comida cruda, subir el tanque, abaratar la fricción,
      // o aceptar el rojo y marcarlo. **La primera se implementó y se midió: no
      // cierra** —choca con «SIN TRABAJO la energía neta es NEGATIVA» de
      // `oracle/tests/presupuesto.test.ts`, y la ventana está vacía por estructura
      // (punto 0 de la sección 6 de `ii/docs/continuar-aca.md`)—. **El usuario
      // eligió la cuarta.**
      //
      // Así que este `it.fails` no es una deuda de implementación: es el criterio
      // publicado en rojo con su causa medida, y las guardas verdes de abajo son
      // lo que se sigue vigilando mientras tanto. Aceptar un número no es dejar de
      // mirarlo, igual que con el p99.
      //
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
      // `pararAlMorir`: el criterio se decide en el tick de la muerte y no en el
      // 20.000. Todo lo que este test afirma —`murioEn`, `pescoEn`, los despegues,
      // los ticks perdidos— ya está escrito cuando la criatura cae, y los ticks que
      // vienen después solo mueven el mundo, que acá no se mide. El día que el
      // criterio se cumpla no va a haber muerte, no va a haber corte, y la corrida
      // va a valer los 20.000 enteros sin tocar una línea.
      const r = correr(laEscenaDelDocumento(), 'ana', CRITERIO_TICKS, { pararAlMorir: true });
      const despegues = r.cuenta.get('aplicar(extraccion)') ?? 0;
      const comidas = [...r.cuenta]
        .filter(([k]) => k.startsWith('comer') || k.startsWith('tragar'))
        .reduce((a, [, v]) => a + v, 0);

      console.log(
        `\n─── VEINTE MIL TICKS ───\n` +
          `  murió en el tick ${String(r.murioEn)} de ${String(CRITERIO_TICKS)} ` +
          `(${((r.murioEn * 100) / CRITERIO_TICKS).toFixed(0)}%)\n` +
          `  el bucle corrió ${String(r.ticksCorridos)}: ${r.porQueParo === '' ? 'los pidió todos' : r.porQueParo}\n` +
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
    //
    // ─── EL CALENTAMIENTO SE CORTA CUANDO EL PESCADO ENTRA A LA MANO ────────
    //
    // Antes eran 200 ticks fijos, y este bloque medía DOS cosas a la vez —el
    // planificador y cuánto había avanzado la escena—; su propio comentario de
    // abajo ya lo decía, y el largo del plan iba y venía entre cinco y siete
    // según eso. El tramo L lo rompió del todo: con el bucle podado la criatura
    // llega en 200 ticks a tener el pescado **YA COCIDO** en la mano
    // (`digestibility 0,8691`, `toxicity 0,0272`, verificado contra
    // `state.bodies`), o sea que la meta está cumplida y `plan()` contesta —bien—
    // un plan de CERO pasos. Medido contra el árbol de antes, en el mismo tick
    // 200 la mano tenía sólo la caña.
    //
    // O sea que la escena de 200 ticks dejó de servir para preguntar «¿sabe ligar
    // un fuego que existe?», y no porque el planificador cambiara. Se corta el
    // calentamiento en el tick en que el pescado entra a la mano, que es
    // exactamente el estado que este bloque quería: crudo, agarrado, con un fuego
    // al lado. Así el largo del plan vuelve a ser una propiedad del planificador
    // y no de cuánto se dejó correr el mundo.
    const p2 = new Partida(conFuegoYLosa());
    const m2 = new Map([['ana', new Mente({ actor: 'ana', memoria: new Creencias() })]]);
    let calentado = 0;
    for (let t = 0; t < 200; t++) {
      if (enLaMano(p2, 'ana').some((s) => s.includes('pescado'))) break;
      vivir(p2, m2, 1);
      calentado = t + 1;
    }
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
        `\n  (b) con un leño YA ardiendo (emitsPower ${potencia.toFixed(2)}) y una losa, ` +
        `pedido en el tick ${String(calentado)} —el pescado recién entró a la mano—:  ${conFuego.k}` +
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
    // Se afirma la FORMA y no el largo: lo que importa es el orden —armar la
    // pila, esperar, levantar— y que el `esperar` esté en el medio, que es el
    // paso que el tramo J tuvo que coser.
    //
    // ─── Y EL `ir` DE ADELANTE YA NO ESTÁ, POR LA MISMA RAZÓN QUE ARRIBA ────
    //
    // Con el calentamiento cortado en el tick 109 la criatura está PARADA EN LA
    // CELDA de la fogata —el arnés la pone ahí, `conFuegoYLosa` regala los dos
    // cuerpos en `parada`—, así que ese `ir` era un no-op: la innata contestaba
    // `done()` sin emitir una intención y el tick se tiraba. Lo poda
    // `sinLoQueYaEstaHecho` (`plan/src/regresion.ts`). Se afirma la distancia
    // acá abajo para que, si algún día la escena mueve a la criatura, esto se
    // ponga rojo por el motivo correcto y no por el número de pasos.
    expect(conFuego.k).toBe('plan');
    if (conFuego.k !== 'plan') throw new Error('imposible');
    const ella = p2.state.bodies.get('ana-cuerpo')?.at;
    const donde = p2.state.bodies.get('fogata')?.at;
    if (ella === undefined || donde === undefined) throw new Error('escena sin ana o sin fogata');
    expect(Math.max(Math.abs(ella.x - donde.x), Math.abs(ella.y - donde.y))).toBeLessThanOrEqual(1);
    expect(conFuego.steps.map((s) => s.k)).toEqual([
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
    //
    // ─── Y EL TECHO SUBIÓ DE 2,5 A 3,5, que NO es aflojarlo ────────────────
    //
    // El usuario bajó `COSTO_VIVIR_POR_SEGUNDO` de 1,0 a 0,34 (tramo M), o sea que
    // **el denominador de esta razón se dividió por 2,94 y lo que gastan las patas
    // no se movió**. La razón pasó de 1,64× a 2,89× sin que la criatura cambie una
    // sola decisión: es la misma caminata contra un respirar más barato.
    //
    // Por eso, además de la banda, se afirma lo que NO depende de la constante: los
    // gramos por tick que se van EN PATAS. Ése es el número que mide la conducta, y
    // el que hay que mirar si algún día esto vuelve a moverse.
    expect(pendiente).toBeGreaterThan(porTick * 1.3);
    expect(pendiente).toBeLessThan(porTick * 3.5);
    const enPatas = pendiente - porTick;
    expect(enPatas).toBeGreaterThan(0.02);
    expect(enPatas).toBeLessThan(0.05);
    // Y el pescado sigue ahí, cada vez más podrido, esperando un fuego que no llega.
    expect(podrido).toBeGreaterThan(0.25);
    MEDIDO.set(
      'deambular',
      `gasta ${pendiente.toFixed(5)}/tick contra ${porTick.toFixed(5)} de sólo vivir (${(pendiente / porTick).toFixed(2)}×): ` +
        `con el pescado en la mano y sin vía al fuego cae a las conductas de fondo, que CAMINAN`,
    );
  }, 300_000);
});
