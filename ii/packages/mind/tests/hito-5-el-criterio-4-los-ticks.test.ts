// ═══ (4) `ticksPerdidos === 0` DURANTE TODA LA CORRIDA ══════════════════════
//
// Las dos mitades del criterio (4), en su propio archivo porque son **42 s de los
// 146** que tardaba el archivo entero y no comparten una sola escena con lo demás:
// son dos corridas de 20.000 ticks, una sin reloj de pared y otra con él. La única
// que contesta el criterio es la segunda —sin reloj, `porTiempo` no se puede mover
// POR CONSTRUCCIÓN y el cero no dice nada—.
//
// La CONDICIÓN que va con el cero (el tick cuesta por cuerpo, y esta partida no
// recorre mundo) se imprime en el cuadro, no acá. El arnés está en `./el-criterio.ts`.

import { describe, expect, it } from 'vitest';
import { MIDIENDO_EN_SERIO, CRITERIO_TICKS, laEscenaDelDocumento, correr } from './el-criterio.js';
import { cuaderno } from './el-cuadro.js';

/** Lo que este pedazo anota para el cuadro. Ver `./el-cuadro.ts`. */
const MEDIDO = cuaderno('4-los-ticks');

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
