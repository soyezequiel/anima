// ═══ HITO 10 · punto 2 SOBRE MATERIAL REAL ══════════════════════════════════
//
// El mecanismo y su control están en
// `perceive/tests/la-traza-ve-lo-que-el-hash-no-ve.test.ts`, con una habilidad
// escrita a mano para que la fuente de no-determinismo esté exactamente donde
// tiene que estar.
//
// Este archivo hace la otra mitad, y es la que el Hito 9 enseñó a hacer:
// **probar el mecanismo contra lo que de verdad corre.** La lección está
// escrita en `anima-ii-medir-el-catalogo`: el fuego «no se propagaba» hasta que
// alguien ató dos cortezas. Un mecanismo verde contra un ejemplo de laboratorio
// no dice nada sobre la historia de la caña, que es la que tiene siete
// eslabones, un dios que decreta materia y una mente eligiendo.
//
// Lo que se afirma acá: la historia de la caña, corrida dos veces desde el mismo
// mundo, deja **la misma secuencia de trazas** — no sólo el mismo hash de mundo.

import { describe, expect, it } from 'vitest';
import { compararVuelos, porQueDivergen } from '@anima/perceive';
import { hashWorldState } from '@anima/world';
import { PESCADO_EN_LA_MANO, laEscenaDelDocumento, correr } from './el-criterio.js';

const QUIEN = 'ana';
const TICKS = 150;

describe('(Hito 10 · 2) la historia de la caña deja la misma traza dos veces', () => {
  it('dos corridas del mismo mundo: mismo hash Y misma secuencia de trazas', () => {
    const a = correr(laEscenaDelDocumento(), QUIEN, TICKS, { anotarVuelos: true });
    const b = correr(laEscenaDelDocumento(), QUIEN, TICKS, { anotarVuelos: true });
    const d = compararVuelos(a.partida.vuelosAnotados, b.partida.vuelosAnotados);

    console.log(
      `\n─── LA HISTORIA DE LA CAÑA, DOS VECES ───\n` +
        `  pescado en la mano ..... tick ${String(a.pescoEn)} y ${String(b.pescoEn)} (Hito 5: ${String(PESCADO_EN_LA_MANO)})\n` +
        `  vuelos anotados ........ ${String(a.partida.vuelosAnotados.length)}\n` +
        `  y son de verdad ........ ${a.partida.vuelosAnotados
          .slice(0, 6)
          .map((v) => v.nombre)
          .join(' → ')}\n` +
        `  hash del mundo ......... ${hashWorldState(a.partida.state)}\n` +
        `  divergencias ........... ${d.length === 0 ? 'ninguna' : porQueDivergen(d[0] as never)}\n`,
    );

    // ── Lo primero, y sin esto lo demás no significa nada: que se anotó ALGO, y
    //    que lo anotado es la historia y no dos vuelos de relleno.
    expect(a.partida.vuelosAnotados.length, 'no se anotó ningún vuelo').toBeGreaterThan(4);
    expect(a.partida.vuelosAnotados.some((v) => v.nombre.startsWith('unir(')), 'no ató la caña').toBe(true);
    expect(a.pescoEn, 'no pescó: esta corrida no es la historia').toBeGreaterThan(0);

    // ── El punto 2: las habilidades se re-ejecutaron y dejaron lo mismo.
    expect(d, d.length === 0 ? '' : porQueDivergen(d[0] as never)).toEqual([]);
    // ── Y el hash del mundo también, que es la mitad que ya cumplía.
    expect(hashWorldState(b.partida.state)).toBe(hashWorldState(a.partida.state));
  });

  it('y el nombre de cada vuelo llega hasta la anotación, que es lo que hace legible una divergencia', () => {
    // Sin `VueloOptions.nombre`, todos los vuelos se anotarían con nombre vacío y
    // una divergencia diría «el vuelo 11 de ana». Esto vigila esa costura, que
    // pasa por tres paquetes: la mente lo arma, `Vuelo` lo guarda y `Partida` lo
    // copia a la anotación.
    const r = correr(laEscenaDelDocumento(), QUIEN, TICKS, { anotarVuelos: true });
    const sinNombre = r.partida.vuelosAnotados.filter((v) => v.nombre === '');
    console.log(
      `  vuelos anotados: ${String(r.partida.vuelosAnotados.length)} · sin nombre: ${String(sinNombre.length)}`,
    );
    expect(sinNombre).toEqual([]);
  });
});
