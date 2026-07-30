// ═══ (2) VEINTE MIL TICKS · d · EL CIERRE ═══
//
// Lo que SÍ aguanta hoy —2000 ticks sin tropiezos, que es la guarda de regresión de
// lo que anda— y la corrida con el TANQUE LLENO, que es la que cierra la discusión:
// separa «no llega» de «no vivió lo suficiente».
//
// Va aparte de 2c y no pegado, aunque los dos sean «el final», por una razón
// medida: juntos daban 63 s y eran el archivo más lento del paquete; separados dan
// 30 y 17 y el paquete pasa a valer lo que vale `ataque-a-la-parrilla` (45 s).
//
// Alimenta el cuaderno con: `tanque lleno`.
//
// El bloque (2) está partido en CUATRO archivos —2a, 2b, 2c y 2d— y los cuatro
// declaran el MISMO `describe`, así que el informe de vitest los sigue agrupando
// bajo «(2) sobrevive 20.000 ticks sola» como cuando era un archivo solo. El corte
// es por costo: juntos tardaban ~100 s. El arnés y el mapa del corte están en
// `./el-criterio.ts`.

import { describe, expect, it } from 'vitest';
import { HZ_DE_REFERENCIA } from '@anima/physics';
import { COSTO_VIVIR_POR_SEGUNDO } from '@anima/world';
import { CRITERIO_TICKS, laEscenaDelDocumento, correr } from './el-criterio.js';
import { cuaderno } from './el-cuadro.js';

/** Lo que este pedazo anota para el cuadro. Ver `./el-cuadro.ts`. */
const MEDIDO = cuaderno('2d-el-cierre');

describe('(2) sobrevive 20.000 ticks sola', () => {
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
