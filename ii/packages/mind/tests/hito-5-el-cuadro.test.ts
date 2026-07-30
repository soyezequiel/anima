// ═══ EL CUADRO ══════════════════════════════════════════════════════════════
//
// EL HITO 5, MEDIDO: el cuadro que se cita en cada informe del proyecto. Sale acá y
// no adentro de `hito-5-el-criterio.test.ts` porque ese archivo se partió en seis
// —eran 146 de los 148 segundos del paquete, ver `./el-criterio.ts`— y este test es
// el único que necesita ver lo que midieron LOS SEIS.
//
// Cómo llega lo de los otros cuatro hasta acá, y por qué eso no puede imprimir un
// número viejo, está entero en `./el-cuadro.ts`. Lo que hay que saber para leer la
// salida: **si algún pedazo no llegó, el cuadro lo dice arriba de todo y el renglón
// que le tocaba sale como `—`**. Un cuadro incompleto y callado sería peor que
// ninguno, porque es el que después se copia a un documento.
//
// El `timeout` de 15 minutos no es una medición: es el tope duro de la espera, y el
// que manda en la práctica es «90 s sin que llegue nadie nuevo».


import { describe, expect, it } from 'vitest';

import { elCuadroCompleto } from './el-cuadro.js';


describe('los cuatro criterios, con los números de esta corrida', () => {
  it(
    'el cuadro',
    async () => {
      const { medido: MEDIDO, faltan } = await elCuadroCompleto();
      const l = (k: string): string => MEDIDO.get(k) ?? '—';
      if (faltan.length > 0) {
        console.log(
          [
            '',
            '⚠══ CUADRO INCOMPLETO ══════════════════════════════════════════════════════',
            `  no anotaron: ${faltan.join(', ')}`,
            '  (los renglones que les tocaban salen como «—». Si corriste un archivo suelto,',
            '   es esto; si corriste el paquete entero, alguno se cayó y hay que mirarlo.)',
            '═══════════════════════════════════════════════════════════════════════════',
          ].join('\n'),
        );
      }
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
    },
    900_000,
  );
});
