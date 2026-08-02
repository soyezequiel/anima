// ═══ HITO 9 · LA BIBLIOTECA SEMILLA ══════════════════════════════════════════
//
// El criterio entero está en `ii/docs/hito-9-la-biblioteca-semilla.md`, con las
// cinco mediciones que lo reescribieron. Lo que hay que leer para entender ESTE
// archivo son dos de ellas:
//
//   M1 · «la fragua no se despierta ni una vez» era VERDE POR OMISIÓN. Ningún
//        `package.json` de `ii/` declara `@anima/forge`, así que la afirmación
//        era cierta porque no había por dónde despertarla. Un `expect(0)` que no
//        puede subir no mide nada.
//
//   M3 · el «40 a 60 habilidades» del plan no corresponde a esta arquitectura:
//        7 de las 12 capacidades que nombra YA SON innatas, 3 son procesos y 1
//        es una cadena de plan. Lo que la biblioteca semilla es de verdad es el
//        CATÁLOGO DE ESQUEMAS, y ya está escrito.
//
// ─── LO QUE ESTE ARCHIVO HACE, ENTONCES ──────────────────────────────────────
//
// Convierte «no hizo falta inventar nada» de una afirmación sobre el
// `package.json` en una MEDICIÓN sobre una corrida, y le pone el control que la
// puede tirar abajo: **la misma historia con un esquema menos**.
//
// Son cinco puntos y van en el orden en que se leen:
//
//   1 · la historia (c) —atar la caña y pescar— sale de punta a punta
//   2 · y el primer movimiento no se hace esperar
//   3 · EL CONTROL: sin el puente de `catch>0`, la misma corrida se queda sin plan
//   4 · el espía de la costura cuenta CERO consultas a la fragua...
//       ...y en la corrida ablacionada cuenta MÁS DE CERO
//   5 · la biblioteca no trae la trampa reservada
//
// El punto 4 es el que M1 pedía: el espía es `MenteOptions.costura`, que
// `escalera.ts` llama en el `case 'gap'` —donde el contrato de `PlanResult` dice
// desde el gate 5→6 que «el Hito 8 lee esto y le pide a la fragua un proceso
// nuevo»— y que hasta hoy no llamaba nadie.
//
// ─── LO QUE EL ESPÍA MIDIÓ APENAS SE ENCENDIÓ, Y CAMBIÓ EL PUNTO 4 ──────────
//
// La primera versión de este archivo cortaba la corrida en cuanto el pescado
// llegaba (`pararCuando: pescoEn >= 0`) y afirmaba «cero consultas». Salía
// verde, y era **el corte el que lo ponía verde**: la corrida terminaba en el
// tick 108 y ahí todavía no había pasado nada. Dejándola correr los 300:
//
//     consultas a la fragua en 300 ticks ...... 22
//     todas por el mismo hueco ................ emitsPower<410 & emitsPower>=253
//     y todas para la misma meta .............. holding(tag:carnoso,toxicity<0.0528)
//
// O sea: **ninguna es de la historia (c)**. Las 22 son de la historia (b) —comer
// el pescado sin envenenarse, que pide cocinarlo, que pide fuego— y el fuego es
// exactamente el rojo aceptado del Hito 5, que espera una decisión de física del
// usuario y no una biblioteca más grande.
//
// Así que el punto 4 se afirma como se puede afirmar de verdad: **cero consultas
// PARA LA META DE LA HISTORIA (c)**, con las otras contadas, nombradas e
// impresas al lado. Un `toBe(0)` que hubiera necesitado el corte para ser cierto
// habría sido el séptimo verde por omisión del proyecto.
//
// Y de paso es la primera vez que se mide CADA CUÁNTO despertaría a la fragua un
// mundo de verdad: 22 pedidos en 300 ticks, todos por lo mismo. Eso es un dato
// para el Hito 10, no para éste.

import { describe, expect, it } from 'vitest';
import { CATALOGO_CORE, ESQUEMAS, catalogoDe } from '@anima/plan';
import type { ConstructionSchema } from '@anima/plan';
import type { PedidoALaFragua } from '../src/tipos.js';
import { PESCADO_EN_LA_MANO, laEscenaDelDocumento, correr, enLaMano } from './el-criterio.js';

/** Quién vive la historia. Es el mismo nombre que usa todo el arnés del Hito 5. */
const QUIEN = 'ana';

/**
 * CUÁNTOS TICKS SE LE DAN A LA HISTORIA.
 *
 * No es un número de acá: `PESCADO_EN_LA_MANO` está medido en 109 sobre esta
 * misma escena, y esto le deja un margen de casi 3× para que un cambio de
 * paisaje no lo convierta en un test frágil. La corrida corta sola cuando el
 * pescado llega, así que el margen no cuesta tiempo salvo cuando el plan falla —
 * que es exactamente el caso del control, donde hay que dejarlo intentar.
 */
const TICKS = 300;

/**
 * EL PUENTE QUE SE LE SACA AL CATÁLOGO PARA EL CONTROL, y por qué éste y no otro.
 *
 * ─── LA ABLACIÓN OBVIA NO SIRVE, Y ESTÁ MEDIDO POR QUÉ ─────────────────────
 *
 * Lo primero que uno saca es el esquema de la META: `holding(tag:carnoso)` por
 * `extraccion`. **No funciona como control**, y no porque el plan aguante: porque
 * la mente NI SIQUIERA TOMA LA META. `sinVocabulario` (`escalera.ts`) veta de
 * antemano toda meta que ninguna cadena del catálogo pueda establecer, así que
 * sacarle el esquema de arriba hace que la criatura no lo intente nunca — cero
 * `gap`, cero consultas, y el control diría «el espía no anda» cuando lo que
 * pasó es que nadie pidió nada.
 *
 * El que sí sirve es el ESLABÓN DEL MEDIO. `catch>0` por `union` es el puente que
 * convierte una vara en una caña, y su propio comentario en `esquemas.ts` lo dice
 * con todas las letras: *«la fila que hace el trabajo es el puente de `catch>0`,
 * que es lo que una vara NO tiene»*. Sin él la meta sigue teniendo vocabulario
 * —`extraccion` la establece— así que la mente la toma, planifica, y se estrella
 * contra un sub-objetivo que nadie sabe cumplir. Eso es un `gap`, que es lo que
 * el control necesita que aparezca.
 */
const EL_PUENTE = 'catch>0';

const SIN_EL_PUENTE: readonly ConstructionSchema[] = ESQUEMAS.filter(
  (e) => !(e.establishes === EL_PUENTE && e.k === 'proceso' && e.via === 'union'),
);

/**
 * LA META DE LA HISTORIA (c), exacta y sin adornos: tener algo carnoso en la mano.
 *
 * Va sin cualidades pegadas a propósito. `holding(tag:carnoso,toxicity<0.0528)`
 * —comer sin envenenarse— es OTRA historia, la (b), y es la que pide fuego. Que
 * las dos empiecen igual es lo que hacía tan fácil contarlas juntas.
 */
const LA_HISTORIA_C = 'holding(tag:carnoso)';

/** Un espía: cuenta lo que se le pediría a la fragua, y se acuerda de qué. */
function espia(): { pedidos: PedidoALaFragua[]; costura: (p: PedidoALaFragua) => void } {
  const pedidos: PedidoALaFragua[] = [];
  return { pedidos, costura: (p) => pedidos.push(p) };
}

/** Lo que se pidió PARA una meta, separado de lo que se pidió para las otras. */
function para(pedidos: readonly PedidoALaFragua[], meta: string): readonly PedidoALaFragua[] {
  return pedidos.filter((p) => p.meta === meta);
}

/** «gap ×n · gap ×n», para que ningún número quede sin nombre al lado. */
function conteo(pedidos: readonly PedidoALaFragua[]): string {
  const m = new Map<string, number>();
  for (const p of pedidos) m.set(p.gap, (m.get(p.gap) ?? 0) + 1);
  return [...m].map(([g, n]) => `${g} ×${String(n)}`).join(' · ');
}

describe('(Hito 9) la biblioteca semilla alcanza sola', () => {
  it('1 y 2 y 4 · la historia de la caña sale entera, rápido, y sin despertar a la fragua', () => {
    const e = espia();
    // ─── SIN CORTE, Y ES LA MITAD DEL PUNTO 4 ────────────────────────────────
    //
    // Cortar en cuanto el pescado llega dejaba la corrida en 108 ticks, y el
    // «cero consultas» salía de eso y no de la biblioteca. Ver el encabezado.
    const r = correr(laEscenaDelDocumento(), QUIEN, TICKS, {
      mente: { catalogo: CATALOGO_CORE, costura: e.costura },
    });

    const primerMovimiento = r.cuando[0] ?? -1;
    const deLaCania = para(e.pedidos, LA_HISTORIA_C);
    const deLasOtras = e.pedidos.filter((p) => p.meta !== LA_HISTORIA_C);
    console.log(
      `\n─── (1) LA HISTORIA (c), CON EL CATÁLOGO COMPLETO, ${String(TICKS)} TICKS ───\n` +
        `  primer movimiento ...... tick ${String(primerMovimiento)}\n` +
        `  pescado en la mano ..... tick ${String(r.pescoEn)} (medido en el Hito 5: ${String(PESCADO_EN_LA_MANO)})\n` +
        `  eslabones del plan ..... ${String(r.nombres.length)} vuelos: ${r.nombres.join(' → ')}\n` +
        `  en la mano al final .... ${enLaMano(r.partida, QUIEN).join(', ')}\n` +
        `\n  ─── el espía de la costura ───\n` +
        `  para «${LA_HISTORIA_C}» ... ${String(deLaCania.length)} consultas\n` +
        `  para las otras historias .. ${String(deLasOtras.length)} consultas: ${conteo(deLasOtras)}\n` +
        `  y sus metas ............... ${[...new Set(deLasOtras.map((p) => p.meta))].join(', ')}\n`,
    );

    // ── (1) la historia sale
    expect(r.pescoEn, 'la caña no pescó nada').toBeGreaterThan(0);
    // ── (2) el primer movimiento no se hace esperar. La línea base del Hito 6
    //    es 1 tick para una meta puesta por el cuidador (`los-tres-relojes`);
    //    acá no hay cuidador y la meta la elige D3, así que lo que se afirma es
    //    lo que esa diferencia permite: que arranque en el primer puñado de
    //    ticks y no a mitad de la historia.
    expect(primerMovimiento).toBeGreaterThanOrEqual(0);
    expect(primerMovimiento).toBeLessThan(10);
    // ── (4) para la historia (c), la fragua no se despierta. Solo, esto sería el
    //    verde de M1 otra vez; el bloque de abajo es el que lo hace significar.
    expect(deLaCania.length, 'la biblioteca semilla no alcanzó para la caña').toBe(0);
    // ── Y LO QUE SÍ SE PIDIÓ NO QUEDA TAPADO. Las consultas que hay son de la
    //    historia (b) y son TODAS por el mismo hueco: el fuego, que es el rojo
    //    aceptado del Hito 5 y espera una decisión de física, no una biblioteca
    //    más grande. Si algún día aparece acá un hueco que no sea ése, esto se
    //    pone rojo y obliga a mirarlo, en vez de dejarlo pasar dentro de un total.
    expect(
      deLasOtras.length,
      'sin consultas de las otras historias no hay nada que separar, y el punto 4 vuelve a ser un cero sin control',
    ).toBeGreaterThan(0);
    expect(new Set(deLasOtras.map((p) => p.gap)).size, `hueco inesperado: ${conteo(deLasOtras)}`).toBe(1);
    expect(deLasOtras[0]?.gap).toContain('emitsPower');
  });

  it('3 y el control del 4 · sacándole EL PUENTE, la misma corrida se queda sin plan y SÍ despierta a la fragua', () => {
    // El guardián de la ablación: si alguien renombra el puente o lo parte en
    // dos filas, esto se pone rojo acá y no más adelante disfrazado de
    // «el control no controla».
    expect(
      ESQUEMAS.length - SIN_EL_PUENTE.length,
      `se esperaba sacar exactamente una fila de «${EL_PUENTE}» por «union»`,
    ).toBe(1);

    const e = espia();
    const r = correr(laEscenaDelDocumento(), QUIEN, TICKS, {
      mente: { catalogo: catalogoDe(SIN_EL_PUENTE), costura: e.costura },
    });

    const deLaCania = para(e.pedidos, LA_HISTORIA_C);
    console.log(
      `\n─── (3) EL CONTROL: EL MISMO MUNDO SIN «${EL_PUENTE}» POR «union» ───\n` +
        `  pescado en la mano ......... ${r.pescoEn < 0 ? 'NUNCA' : `tick ${String(r.pescoEn)}`}\n` +
        `  vuelos .................... ${String(r.nombres.length)}: ${r.nombres.slice(0, 6).join(' → ')}\n` +
        `\n  ─── el espía de la costura ───\n` +
        `  para «${LA_HISTORIA_C}» ... ${String(deLaCania.length)} consultas: ${conteo(deLaCania)}\n` +
        `  primer pedido en tick ...... ${String(deLaCania[0]?.tick ?? -1)}\n` +
        `  y lo dijo así .............. «${deLaCania[0]?.porQue ?? ''}»\n` +
        `  todo lo demás .............. ${String(e.pedidos.length - deLaCania.length)} consultas: ${conteo(e.pedidos.filter((p) => p.meta !== LA_HISTORIA_C))}\n`,
    );

    // ── (3) sin el puente, la historia NO sale. Es la mitad que hace que el
    //    «sin un solo gap» del bloque de arriba signifique algo.
    expect(r.pescoEn, 'pescó igual sin el puente: la ablación no ablacionó nada').toBeLessThan(0);
    // ── el control del (4): el espía SÍ cuenta, Y CUENTA PARA LA MISMA META que
    //    arriba dio cero. Comparar contra el total no serviría: el total ya era
    //    distinto de cero antes de la ablación, por el fuego.
    expect(
      deLaCania.length,
      'el espía no contó nada para la caña: la costura no está conectada',
    ).toBeGreaterThan(0);
    // Y cuenta LO QUE FALTA, no cualquier cosa. La firma que vuelve es CONJUNTIVA
    // —`catch>0&reach>=2`, las dos condiciones que `extraccion` le pide al `gear`
    // juntas— así que se busca el puente ADENTRO de la firma y no como texto
    // entero: pedir igualdad sería cablear cómo el planificador arma sus firmas.
    expect(
      deLaCania.every((p) => p.gap.includes(EL_PUENTE)),
      `algún pedido no nombra el puente que se sacó: ${conteo(deLaCania)}`,
    ).toBe(true);
  });

  it('5 · la biblioteca semilla NO trae la trampa reservada', () => {
    // ─── POR QUÉ ESTE PUNTO ESTÁ EN EL CRITERIO ─────────────────────────────
    //
    // La trampa para peces es el caso reservado con el que el gate 5→6 y el
    // Hito 8 miden si la criatura sabe INVENTAR. Si viniera de fábrica, todas
    // esas mediciones darían verde sin que nadie invente nada — sería el verde
    // por omisión más caro del proyecto, porque taparía el hito entero.
    //
    // Se afirma sobre el CATÁLOGO y no sobre un nombre: lo que la trampa
    // establece es `catch>0` sin `union`, o sea atrapar sin atar. Ninguna fila
    // del core puede establecer eso.
    const atrapaSinAtar = ESQUEMAS.filter(
      (e) => e.establishes === EL_PUENTE && !(e.k === 'proceso' && e.via === 'union'),
    );
    const porObra = ESQUEMAS.filter((e) => e.k === 'obra');
    console.log(
      `\n─── (5) LO QUE LA SEMILLA NO TRAE ───\n` +
        `  filas del core ............................ ${String(ESQUEMAS.length)}\n` +
        `  que establecen «${EL_PUENTE}» sin «union» ...... ${String(atrapaSinAtar.length)}\n` +
        `  esquemas de OBRA (planos de fábrica) ...... ${String(porObra.length)}\n`,
    );
    expect(atrapaSinAtar.length).toBe(0);
    // Y no hay ningún plano de fábrica: toda obra de esta partida la ató alguien.
    expect(porObra.length).toBe(0);
  });
});
