// ═══ LAS DOS MITADES DE LA COSTURA, UNIDAS ══════════════════════════════════
//
// El Hito 9 dejó una costura hecha por un solo lado. La mente avisa cuando el
// plan no llega —`MenteOptions.costura`, que `escalera.ts` dispara en el
// `case 'gap'`— y el aviso sale A PROPÓSITO INCOMPLETO: no trae el vocabulario,
// porque la mente no tiene la física de esta partida.
//
// La otra mitad la puso `@anima/forge`: `encargoDe(pedido, phys)`, que le agrega
// los nombres de la materia de ESTE mundo y devuelve el `Encargo` que se le
// manda al modelo.
//
// **Nada las unía**, y ése era el agujero: el aviso lo describe `@anima/mind`, el
// encargo lo arma `@anima/forge`, y los dos declaran la misma forma POR
// SEPARADO —`PedidoALaFragua` allá, `PedidoDeLaMente` acá— porque la fragua no
// puede importar la mente (la mente depende del mundo, y la fragua no puede
// necesitar un mundo para escribir código). Dos formas escritas dos veces se van
// separando en silencio.
//
// Este archivo es el llamador que ve los dos lados, que es lo único que las
// obliga a coincidir. Y no lo hace con un pedido inventado a mano: lo hace con
// **el gap de verdad** que la corrida ablacionada del Hito 9 produce.
//
// ─── POR QUÉ `@anima/forge` ENTRA COMO devDependency Y NO COMO dependency ───
//
// Porque el Hito 9 mide justamente que la fragua NO se despierte en una partida
// normal, y una dependencia de producción diría lo contrario de lo que el hito
// afirma. Que la unión viva en un test es exactamente su estado real hoy: la
// pieza existe, está probada, y todavía no hay nadie en producción que la use —
// eso es el Hito 10. No hay ciclo: `@anima/forge` no depende de `@anima/mind`.

import { describe, expect, it } from 'vitest';
import { encargoDe, textoDe, vocabularioDe } from '@anima/forge';
import type { PedidoDeLaMente } from '@anima/forge';
import { buildSeedPhysics } from '@anima/physics';
import { ESQUEMAS, catalogoDe } from '@anima/plan';
import type { PedidoALaFragua } from '../src/tipos.js';
import { laEscenaDelDocumento, correr } from './el-criterio.js';

const QUIEN = 'ana';

/**
 * EL MISMO PUENTE QUE ABLACIONA EL HITO 9, y por eso está copiado y no importado.
 *
 * Importarlo del otro archivo ataría los dos tests: el día que uno cambie de
 * ablación, el otro cambiaría de sujeto sin que nadie lo pida. Acá lo que
 * importa no es CUÁL esquema falta, es que el pedido que sale llegue entero.
 */
const EL_PUENTE = 'catch>0';

describe('el pedido de la mente llega a la fragua, con la materia de esta partida', () => {
  it('un gap de verdad se convierte en un encargo que nombra las 30 sustancias', () => {
    const pedidos: PedidoALaFragua[] = [];
    correr(laEscenaDelDocumento(), QUIEN, 300, {
      mente: {
        catalogo: catalogoDe(
          ESQUEMAS.filter((e) => !(e.establishes === EL_PUENTE && e.k === 'proceso' && e.via === 'union')),
        ),
        costura: (p) => pedidos.push(p),
      },
    });

    const dePescar = pedidos.find((p) => p.gap.includes(EL_PUENTE));
    expect(dePescar, 'la corrida ablacionada no produjo el gap del puente').toBeDefined();

    // ─── LA LÍNEA QUE OBLIGA A LAS DOS FORMAS A COINCIDIR ──────────────────
    //
    // Sin anotación de tipo esto pasaría por duck typing y no probaría nada. Con
    // ella, el día que a `PedidoALaFragua` le cambie un campo de nombre, ESTA
    // asignación no compila — que es la garantía que el comentario de
    // `PedidoDeLaMente` promete y que hasta ahora nadie estaba dando.
    const paraLaFragua: PedidoDeLaMente = dePescar as PedidoALaFragua;

    const phys = buildSeedPhysics();
    const encargo = encargoDe(paraLaFragua, phys);
    const texto = textoDe(encargo);

    console.log(
      `\n─── DE UN GAP DE LA MENTE A UN ENCARGO PARA EL MODELO ───\n` +
        `  el gap ................ ${paraLaFragua.gap}\n` +
        `  la meta ............... ${paraLaFragua.meta}\n` +
        `  en el tick ............ ${String(paraLaFragua.tick)}\n` +
        `  sustancias que viajan . ${String(vocabularioDe(phys).length)}\n` +
        `  el texto mide ......... ${String(texto.length)} caracteres\n`,
    );

    // El pedido entra entero: la firma, la meta y por dónde se cortó.
    expect(encargo.gap).toContain(paraLaFragua.gap);
    expect(encargo.gap).toContain(paraLaFragua.meta);
    // Y el vocabulario es el de ESTA física, con las dos que la caña usa. Antes
    // de este arreglo el encargo decía seis nombres y estos dos no estaban.
    expect(encargo.seSabeNombrar).toEqual(vocabularioDe(phys));
    expect(texto).toContain('pescado');
    expect(texto).toContain('junco');
  });

  it('EL CONTROL: sin gap no hay encargo, porque no hay pedido', () => {
    // El cero de este test tiene que salir de que la biblioteca alcanzó, no de
    // que nadie estuviera mirando — es el mismo control que sostiene el punto 4
    // del Hito 9, visto desde acá.
    const pedidos: PedidoALaFragua[] = [];
    correr(laEscenaDelDocumento(), QUIEN, 300, {
      mente: { costura: (p) => pedidos.push(p) },
    });
    const dePescar = pedidos.filter((p) => p.gap.includes(EL_PUENTE));
    console.log(
      `  con el catálogo entero: ${String(dePescar.length)} pedidos por «${EL_PUENTE}» ` +
        `(y ${String(pedidos.length)} en total, que son los del fuego)`,
    );
    expect(dePescar).toEqual([]);
  });
});
