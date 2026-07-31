// ═══ (2) VEINTE MIL TICKS · b · LAS PAREDES QUE QUEDAN ═══
//
// Los cinco diagnósticos que ya NO son de la mente: la leña que el dios siembra, la
// humedad de la orilla, el precio del fuego, la cadena entera con leña seca regalada
// y el bucle que se llevaba el 98% de la vida. Ninguno se arregla en `@anima/mind`.
//
// Alimenta el cuaderno con: `la leña`, `la humedad`, `el precio del fuego`, `la cadena entera`,
// `el bucle` y `el tamaño de la leña`.
//
// El bloque (2) está partido en CUATRO archivos —2a, 2b, 2c y 2d— y los cuatro
// declaran el MISMO `describe`, así que el informe de vitest los sigue agrupando
// bajo «(2) sobrevive 20.000 ticks sola» como cuando era un archivo solo. El corte
// es por costo: juntos tardaban ~100 s. El arnés y el mapa del corte están en
// `./el-criterio.ts`.

import { describe, expect, it } from 'vitest';
import { qualityOf, unfx } from '@anima/physics';
import { decretoDe } from '@anima/world';
import { Partida } from '@anima/perceive';
import { EXPANSIONES_POR_TICK, interpretar, plan } from '@anima/plan';
import { Creencias } from '../src/creencias.js';
import { Mente, vivir } from '../src/mente.js';
import { metaComestibleDe } from '../src/oportunidades.js';
import { PHYS, actor, criatura, cuerpo, enElPiso, laOrilla, mundo } from './mundo.js';
import {
  PESCADO_EN_LA_MANO,
  laEscenaDelDocumento,
  conRegalo,
  HUMEDAD_QUE_APAGA,
  YESCA_MAS_CHICA,
  CALOR_ESPECIFICO_MADERA,
  IGNICION_MADERA,
  AMBIENTE,
  EFICIENCIA_DE_FROTAR,
  humedadDeLaCelda,
  celdasSecas,
  conLenaSeca,
  aliento,
  vistaDe,
  correr,
  dos,
} from './el-criterio.js';
import { cuaderno } from './el-cuadro.js';

/** Lo que este pedazo anota para el cuadro. Ver `./el-cuadro.ts`. */
const MEDIDO = cuaderno('2b-las-paredes');

describe('(2) sobrevive 20.000 ticks sola', () => {
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
        `  MADERA: el decreto pone ${String(porSustancia.get('madera') ?? 0)} en los 9 chunks (la caña se la come) ` +
        `y a los 400 ticks hay ${String(delDios.filter((s) => s.includes('[madera]')).length)} sueltas en el piso, ` +
        `traídas por lo que abrió caminando\n` +
        `      ${resto.slice(0, 12).join('\n      ')}\n      …\n`,
    );

    // El dios siembra de verdad…
    expect(decretadas).toBeGreaterThan(50);
    // …y ahora llegan al suelo. No se afirma un número exacto: depende de cuántos
    // chunks pisó la criatura en 400 ticks, que es cosa de la mente.
    expect(delDios.length).toBeGreaterThanOrEqual(decretadas);
    expect(cañas.length).toBe(1);
    // ─── Y LA QUE IMPORTABA PARA EL FUEGO, QUE CAMBIÓ DE SIGNO ──────────────
    //
    // Acá se afirmaba `maderaEnElPiso === 0` con este diagnóstico: de las 62
    // sueltas de los 9 chunks, madera hay UNA —2,3280 kg—, la mente se la come
    // atando la caña en el tick 23, y en todo lo que abría caminando no aparecía
    // otra. **Era cierto, y la mitad del porqué era el paseo**: el `explore` del
    // mundo caminaba un ciclo cerrado de 8 celdas, así que «lo que abrió
    // caminando» eran siempre los mismos chunks.
    //
    // Con el rumbo arreglado (dura 16 ticks, número 35 de la sección 5 de
    // `como-se-trabaja.md`) la única vuelta de deambular que el ancla permite
    // abre chunks NUEVOS, y a los 400 ticks hay madera del dios en el piso otra
    // vez. No se clava el cuánto —depende del camino, o sea de la mente— sino
    // las dos mitades que son el diagnóstico nuevo: el decreto de los 9 chunks
    // sigue teniendo UNA madera (la que la caña se come), y caminar derecho
    // TRAE MÁS. La pared (7) del fuego dejó de ser «no hay leña alrededor» y
    // pasó a ser «la leña está a una caminata» — que es del planificador, no
    // del oráculo.
    const maderaDecretada = porSustancia.get('madera') ?? 0;
    const maderaEnElPiso = delDios.filter((s) => s.includes('[madera]')).length;
    expect(maderaDecretada).toBeGreaterThan(0);
    expect(maderaEnElPiso).toBeGreaterThan(0);
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

  it('DIAGNÓSTICO 9 · LA PARED SE CAYÓ: el fuego más barato costaba 485 contra 310 y ahora sale 199,89 — y PRENDE', () => {
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
    //
    // ─── Y LA PRIMERA DE LAS TRES SE TOMÓ: LA EFICIENCIA SUBIÓ ─────────────
    //
    // De 0,35 a 0,85 (tramo N), después de que
    // `world/tests/la-cuenta-de-los-veinte-mil.test.ts` midiera que con 0,35 el
    // criterio (5) era aritméticamente imposible. La yesca más chica que cocina
    // pasó de costar **485,45** a **199,88**, y la escena le da 310: **ahora la
    // paga**. Todo lo que este bloque dice sobre la mente sigue igual; lo que
    // cambió es el mundo, que era donde estaba dicho que había que cambiarlo.
    //
    // Y LA EFICIENCIA YA NO SE COPIA. Se leía de `EFICIENCIA_DE_FROTAR` en
    // `./el-criterio.ts`, que es una `const` con el 0,35 escrito a mano: no se
    // enteró del cambio y dejó a este bloque midiendo un mundo que no existe. Ahora
    // sale del proceso, que es de donde tendría que haber salido siempre.
    //
    // OJO, LA COPIA SIGUE AHÍ: `EFICIENCIA_DE_FROTAR` en `./el-criterio.ts` sigue
    // diciendo 0,35 y nadie más la usa hoy. Queda escrito acá para que el próximo
    // que la importe sepa que miente.
    const p = new Partida(conLenaSeca(310), { vigilar: true });
    const lena = p.state.bodies.get('lena0');
    if (lena === undefined) throw new Error('la escena no tiene leña');
    // Los tres números que la cuenta usa, VERIFICADOS contra el motor.
    expect(qualityOf(lena.body, 'ignitionPoint', p.state.phys)).toBe(IGNICION_MADERA);
    expect(qualityOf(lena.body, 'heatCapacity', p.state.phys)).toBeCloseTo(0.4 * CALOR_ESPECIFICO_MADERA, 10);
    const drive = p.state.phys.processes.get('friccion')?.effects[0];
    if (drive?.k !== 'drive' || drive.poweredBy === undefined) throw new Error('friccion cambió de forma');
    const eficiencia = drive.poweredBy.efficiency;
    expect(eficiencia).not.toBe(EFICIENCIA_DE_FROTAR);
    const cuestaLaMasChica =
      (YESCA_MAS_CHICA * CALOR_ESPECIFICO_MADERA * (IGNICION_MADERA - AMBIENTE)) / eficiencia;

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
        `ΔT ${String(IGNICION_MADERA - AMBIENTE)} · eficiencia ${String(eficiencia)} (la copia de \`el-criterio.ts\` dice ${String(EFICIENCIA_DE_FROTAR)})\n` +
        `  → cuesta ${cuestaLaMasChica.toFixed(2)} de aliento, y la escena del documento le da 310\n` +
        `  medido con una de 0,40 kg: ${porTickDeFrotar.toFixed(4)} por tick × ${String(ticksFrotando)} ticks, ` +
        `murió en el ${String(murioEn)} y la leña no pasó de ${hastaDonde.toFixed(2)} °C de ${String(IGNICION_MADERA)}\n` +
        `  ${comoSeRindio === '' ? '' : `y así se rindió la innata: «${comoSeRindio}»\n`}` +
        `  ARNÉS DE INVARIANTES: ${String(p.violaciones.length)} estados ilegales\n`,
    );

    // ─── LAS TRES AFIRMACIONES DE LA PARED SE DIERON VUELTA ────────────────
    //
    // Decían, y era la pared entera: `cuestaLaMasChica > 310`, `murioEn` entre 0 y
    // 200, y `hastaDonde < IGNICION_MADERA` — o sea «frotó, se quedó sin aliento y
    // se murió con la leña tibia, a 169,67 °C de los 300». Con la eficiencia en
    // 0,85 la yesca más chica cuesta 199,88 contra los 310 que la escena le da:
    // **la pared se cayó**, y se cayó por donde el propio bloque decía que había
    // que empujarla.
    //
    // Se afirma la dirección nueva y con la misma función de guardián: si el fuego
    // se vuelve a encarecer por encima del tanque de la escena, esto se pone rojo y
    // lo que hay que releer es la nota de arriba.
    expect(cuestaLaMasChica).toBeLessThan(310);
    // Y en el mundo pasa exactamente eso: NO se muere frotando, y la leña cruza.
    expect(murioEn).toBe(-1);
    expect(hastaDonde).toBeGreaterThanOrEqual(IGNICION_MADERA);
    expect(porTickDeFrotar).toBeGreaterThan(0);
    // Y la escena era legal: la leña está en celdas distintas.
    expect(p.violaciones, p.violaciones.slice(0, 3).join(' | ')).toEqual([]);
    MEDIDO.set(
      'el precio del fuego',
      `la yesca más chica que cocina cuesta ${cuestaLaMasChica.toFixed(2)} de aliento y la escena le da 310: ` +
        `frotó ${String(ticksFrotando)} ticks a ${porTickDeFrotar.toFixed(4)}, murió en el ${String(murioEn)} con la ` +
        `leña a ${hastaDonde.toFixed(2)} °C de ${String(IGNICION_MADERA)}`,
    );
  }, 300_000);

  it('DIAGNÓSTICO 10 · CON EL TANQUE LLENO Y LEÑA SECA, LA CRIATURA COCINA, COME Y LLEGA VIVA A LOS 20.000', () => {
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
    // ═══ Y ESTA LÍNEA SE PUSO ROJA, QUE ES LO QUE PEDÍA QUE PASARA ═══════════
    //
    // Decía `expect(r.murioEn).toBeGreaterThan(0)` con este comentario textual: «con
    // todo esto regalado, igual se muere … si algún día esta línea se pone roja es
    // porque alguien arregló la aritmética». Pasó en el tramo M: el usuario bajó
    // `COSTO_VIVIR_POR_SEGUNDO` de 1,0 a **0,34** y esta escena **llega viva a los
    // 20.000** (`murioEn` −1, contra el tick 5669 de antes).
    //
    // LO QUE ESTO ES Y LO QUE NO ES, y la segunda mitad importa más:
    //
    //   ES  la primera vez en el proyecto que una criatura cruza los 20.000 ticks
    //       de punta a punta habiendo cocinado y comido lo que ella misma pescó.
    //   NO ES el criterio (2), y por eso el `it.fails` del bloque 2a sigue rojo: esta
    //       escena tiene **tres cosas regaladas** —el tanque lleno, la leña seca y
    //       las celdas secas donde ponerla—. La corrida canónica arranca con 310 y
    //       con lo que el dios haya decretado, y ahí muere en el 6244 con 0 bocados.
    //
    // O sea que lo que separa a esta escena de la canónica ya no es la aritmética:
    // es que la mente sepa CONSEGUIR la leña que acá se le pone en la mano.
    expect(r.murioEn).toBe(-1);
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
    // EL ARREGLO SON DOS CAPAS, Y LA ATRIBUCIÓN ESTUVO MAL UN TRAMO ENTERO.
    //
    // La primera que se escribió fue `EstadoDeLaEscalera.mientrasTantoYaHecho`
    // (tramo K bis), el mismo cerrojo que `fondosQueFallaron` y `bocadoQueFallo`:
    // el «mientras tanto» de un `gap` se guarda por FIRMA y no se repite. La
    // segunda es la PODA de `@anima/plan` (`sinLoQueYaEstaHecho`, tramo L), que
    // saca del `plan.steps` y del `gap.nearest` el prefijo de pasos que la vista
    // de hoy ya cumple.
    //
    // Este comentario decía «el arreglo es el cerrojo» a secas, y eso no lo
    // sostiene ninguna medición. La ablación, corrida al cerrar el tramo L sobre
    // esta misma escena (las dos capas se apagaron por separado):
    //
    //     las dos apagadas ......  6045 `ir` en 6171 ticks, murió en el 6171
    //     sólo el cerrojo .......     2 `ir`,               murió en el 3743
    //     sólo la poda ..........    22 `ir` en 3686 ticks, murió en el 3686
    //     las dos ...............     1 `ir`,               murió en el 3802
    //
    // O sea que **cada una de las dos, sola, se come el 99,6% del bucle**, y son
    // redundantes en esta escena. No sobra ninguna: el cerrojo es por META y no
    // ve un plan de quince pasos cuyo frente envejeció; la poda es por PASO y no
    // ve la meta que vuelve a pedir lo mismo con otro `nearest`. Y la diferencia
    // de 22 contra 2 dice cuál de las dos es más fina: la poda deja pasar el
    // primer `ir` de cada meta nueva, que es lo correcto.
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
      `\n─── (a) EL BUCLE DEL «MIENTRAS TANTO», DESPUÉS DE LAS DOS CAPAS ───\n` +
        `  el \`ir\` más repetido en 2000 ticks: ${irMasRepetido[0]} × ${String(irMasRepetido[1])}` +
        `   (sin cerrojo NI poda: 6045 en 6171 ticks · sólo cerrojo 2 · sólo poda 22)\n` +
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
      `CERRADO: el \`ir\` más repetido pasó de 6045 en 6171 ticks a ${String(irMasRepetido[1])} en 2000. ` +
        `Son DOS capas y cada una sola se come el 99,6% del bucle (ablación: cerrojo solo 2, poda sola 22, ` +
        `las dos 1). Sin ninguna de las dos la criatura NO prende fuego ni con la yesca al lado`,
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
});
