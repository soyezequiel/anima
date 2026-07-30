// ═══ (2) VEINTE MIL TICKS · c · LA CONTRAPRUEBA DEL ESLABÓN REGALADO ═══
//
// Qué pasa cuando alguien le REGALA el eslabón que le falta: una despensa de cien
// pescados ya cocidos al lado. Come 68 y muere igual, y eso es lo que dice que lo
// que falta no es sólo el fuego. Son 20.000 ticks con la boca abierta, o sea el par
// de tests más caro del bloque.
//
// Alimenta el cuaderno con: `regalado`.
//
// El bloque (2) está partido en CUATRO archivos —2a, 2b, 2c y 2d— y los cuatro
// declaran el MISMO `describe`, así que el informe de vitest los sigue agrupando
// bajo «(2) sobrevive 20.000 ticks sola» como cuando era un archivo solo. El corte
// es por costo: juntos tardaban ~100 s. El arnés y el mapa del corte están en
// `./el-criterio.ts`.

import { describe, expect, it } from 'vitest';
import { HZ_DE_REFERENCIA, qualityOf } from '@anima/physics';
import { COSTO_VIVIR_POR_SEGUNDO } from '@anima/world';
import { CRITERIO_TICKS, laEscenaDelDocumento, laDespensa, correr, dos } from './el-criterio.js';
import { cuaderno } from './el-cuadro.js';

/** Lo que este pedazo anota para el cuadro. Ver `./el-cuadro.ts`. */
const MEDIDO = cuaderno('2c-la-contraprueba');

describe('(2) sobrevive 20.000 ticks sola', () => {
  it('CONTRAPRUEBA · con el eslabón REGALADO la mente come, y a 2000 ticks le LLENÓ el tanque', () => {
    // EL BUCLE DE LA NECESIDAD, CERRADO Y BARATO DE VIGILAR. Es la mitad de la
    // contraprueba que sigue estando verde: con comida comestible al alcance, la
    // criatura la come sola y el aliento SUBE. Lo que ya no se sostiene es que
    // eso alcance para los 20.000, y eso lo mide el `it.fails` de abajo.
    //
    // MEDIDO sobre el mundo decretado, después de la poda del tramo L: **68
    // bocados y 869,28 de aliento a los 2000 ticks**, contra 148,00 de la misma
    // escena sin cocidos (antes de la poda eran 66 y 849,30 contra 147,50). O sea
    // que en 2000 ticks se comió DOS TERCIOS de la despensa y llenó el tanque; el
    // resto de la corrida no tiene con qué (los 32 que quedan se pudren).
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

  it('CONTRAPRUEBA · con el eslabón regalado LLEGA: 64 bocados y los 20.000 ticks', () => {
    // ─── ESTA CONTRAPRUEBA SE DIO VUELTA DOS VECES, Y HAY QUE CONTAR LAS TRES ──
    //
    // Es la misma pregunta desde el principio —«¿falta sólo el fuego, o además
    // falta otra cosa?»— contestada regalándole EXACTAMENTE el eslabón que no sabe
    // hacer, cien pescados ya cocidos, y nada más:
    //
    //   (a) sobre la escena PLANTADA ....... llegaba viva, 65 bocados, aliento 1,4593
    //   (b) sobre el mundo DECRETADO ....... murió en el 12.847 con 68 bocados
    //   (c) con vivir a 0,34 (tramo M) ..... **llega viva, 64 bocados, aliento 64,6625**
    //
    // La (b) no fue un retroceso de la mente: fue que en un mundo con cosas
    // alrededor **la criatura CAMINA**, y caminar no estaba pago. La (c) no la
    // arregló la mente tampoco —come uno MENOS que en la (b)—: la arregló bajar lo
    // que cuesta el segundo, que es lo que el usuario decidió con la ventana
    // medida delante.
    //
    // O sea que la frase que este bloque existe para sostener vuelve a valer, y
    // ahora con el número al lado: **la conducta está, y lo que faltaba era la
    // aritmética.** Lo que sigue faltando es que la mente CONSIGA los cocidos que
    // acá se le regalan, y eso es el fuego que se paga (la escalera de la yesca).
    //
    // ─── LO QUE DECÍA CUANDO ERA `it.fails` ────────────────────────────────
    //
    // Contestaba «¿falta sólo el fuego, o además falta otra cosa?» regalándole
    // EXACTAMENTE el eslabón que no sabe hacer —cien pescados ya cocidos— y nada
    // más, y la respuesta era «sólo el fuego»: murió en −1, 65 bocados, aliento
    // final 1,4593. Sobre el mundo decretado la respuesta es otra (medido al
    // cerrar el tramo L; entre paréntesis, lo mismo antes de la poda):
    //
    //     murió en el 12.847 de 20.000 · 68 bocados · aliento final 0,0824
    //     aliento: 0:321,8 → 2000:869,2 → 6000:552,0 → 10000:229,8 → 12000:71,4
    //     quedaron 32 cocidos con toxicity 0,9921 — la ley 6 los pudrió
    //     (antes de la poda del tramo L: murió en el 12.031, 66 bocados, 34 podridos)
    //
    // Los 816 ticks que la poda le agregó son la medida honesta de lo que vale
    // dejar de dar un paso ya dado con la despensa al lado: **+6,8%, y no llega
    // igual**. La pared es la aritmética y no el bucle.
    //
    // ─── Y EL MOTIVO ESTABA ESCRITO EN EL NÚMERO VIEJO ─────────────────────
    //
    // **Aquel 1,4593 era el margen con el que pasaba, sobre un presupuesto de
    // 1000: el 0,15%.** Las dos cuentas, lado a lado:
    //
    //     plantada   310 + 691,46 comidos − 1000 de vivir = +1,46  → llegaba
    //     decretada  310 + 690,08 comidos − 1000 de vivir = +0,08  → no llegaba
    //     con 0,34   310 + 94,66 comidos  −  340 de vivir = +64,66 → LLEGA
    //
    // (los «comidos» de la tercera fila son muchísimos menos porque el aliento topa
    //  en 1000 y comer con el tanque lleno tira la mitad del bocado: lo que cambió
    //  no es cuánto entra, es cuánto se va)
    //
    // Comió MÁS (68 contra 65) y llegó menos lejos. Lo que cambió no es la boca:
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
    // no se guarda.** Comió 68 de los 100 y los 32 que quedan terminan en
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
            `(310 + ${comidos.toFixed(0)} comidos − ${String(CRITERIO_TICKS * (COSTO_VIVIR_POR_SEGUNDO / HZ_DE_REFERENCIA))} de vivir)`
        : `NO CUMPLE: come ${String(bocados)} y muere en el ${String(r.murioEn)} (310 + ${comidos.toFixed(0)} ` +
            `comidos − ${String(CRITERIO_TICKS * (COSTO_VIVIR_POR_SEGUNDO / HZ_DE_REFERENCIA))} de vivir = ${r.alientoFinal.toFixed(4)}). Sobre la escena plantada llegaba, y por +1,46`,
    );

    expect(r.ticks).toBe(CRITERIO_TICKS);
    // La boca sigue cerrando el bucle, y eso NO es lo que falla.
    expect(bocados).toBeGreaterThan(50);
    // Y LLEGA. Era un `it.fails` con esta misma línea adentro: la aserción no se
    // tocó ni un carácter, lo que cambió es que ahora se cumple. Si algún día
    // vuelve a morirse con la despensa al lado, el problema volvió a ser la
    // aritmética y no la mente.
    expect(r.murioEn, `se murió en el tick ${String(r.murioEn)}`).toBe(-1);
  }, 600_000);
});
