import { describe, expect, it } from 'vitest';
import type { CodexTransportInput } from '../src/index.js';
import { CodexModelProvider } from '../src/index.js';

/**
 * El texto con el que imagina una obra no puede ser más estricto que el mundo
 * que la valida.
 *
 * Decía «cada offset es una celda contigua (x,y ∈ {-1,0,1})» — el alcance del
 * brazo del ADR 0032 — mucho después de que el ADR 0035 pasara la obra a
 * levantarse caminando hasta cada celda (footprint 9×9, 24 bloques). Con esa
 * reja, el plano más largo que podía imaginar medía 3 celdas. El cauce del mapa
 * mide 4: no era que calculara mal el ancho del río, era que no tenía cómo
 * escribir un puente que lo cruzara.
 *
 * Un límite copiado a mano es un límite que se desincroniza. Estos tests fijan
 * que el tope venga del pedido y que la obra tome la forma del problema.
 */

function transportReturning(text: string, seen: CodexTransportInput[] = []) {
  return async (input: CodexTransportInput) => {
    seen.push(input);
    return text;
  };
}

/** Una obra cualquiera: lo que conteste da igual, se mira lo que se le PIDIÓ. */
const ANY_WORK = JSON.stringify({
  recipeJson: JSON.stringify({
    recipes: [
      {
        id: 'pasarela',
        output: { kind: 'pasarela', components: { portable: {}, footing: {} } },
        ingredients: [{ kind: 'log', count: 1 }],
      },
    ],
    blueprint: { id: 'puente', placements: [{ kind: 'pasarela', offset: { x: 1, y: 0 } }] },
  }),
  rationale: 'para cruzar',
});

async function promptFor(extra: {
  reach?: number;
  maxBlocks?: number;
  obstacle?: { kind: string; width: number };
}): Promise<string> {
  const seen: CodexTransportInput[] = [];
  const provider = new CodexModelProvider(transportReturning(ANY_WORK, seen));
  await provider.complete({
    kind: 'recipe.propose',
    problem: 'cruzar el cauce',
    wantedId: 'puente',
    materials: ['log (lo veo)'],
    existingRecipes: [],
    ...extra,
  });
  // Aplanado: el texto va en un template con saltos de línea que el ajuste
  // mueve cada vez que se toca una palabra. Lo que se afirma es lo que DICE,
  // no dónde corta el renglón.
  return (seen[0]?.prompt ?? '').replace(/\s+/g, ' ');
}

describe('la obra se imagina a la medida del mundo, no de una copia vieja', () => {
  it('el alcance que ofrece es el que manda el validador, no uno escrito a mano', async () => {
    const prompt = await promptFor({ reach: 4, maxBlocks: 24 });

    // El tope viajado aparece tal cual, y con él el largo que habilita: 4
    // celdas para cada lado son 9 de punta a punta, de sobra para un cauce
    // de 4. Con la reja vieja acá decía 1, y el techo era 3.
    expect(prompt).toContain('4');
    expect(prompt).toContain('9 celdas de punta a punta');
    expect(prompt).toContain('24 bloques');

    // Y ya no queda rastro de la jaula de 3×3 ni del tope de los brazos.
    expect(prompt).not.toContain('{-1,0,1}');
    expect(prompt).not.toContain('celda contigua');
    expect(prompt).not.toContain('junta la obra entera antes de colocarla');
  });

  it('un mundo más chico achica el texto: el número no está clavado', async () => {
    const prompt = await promptFor({ reach: 2, maxBlocks: 8 });

    expect(prompt).toContain('5 celdas de punta a punta');
    expect(prompt).toContain('8 bloques');
    expect(prompt).not.toContain('9 celdas de punta a punta');
  });

  it('le pide medir el obstáculo antes de elegir el largo del cruce', async () => {
    const prompt = await promptFor({ reach: 4, maxBlocks: 24 });

    // Lo que faltaba no era solo permiso para un plano largo: era que supiera
    // que un cruce se mide contra el obstáculo. Un puente más corto que el río
    // pasa todas las validaciones del mundo y no sirve para nada.
    expect(prompt).toContain('ENTERA');
    expect(prompt).toContain('contá las celdas');
  });

  it('el cruce sale de sus pies hacia un lado, no repartido alrededor', async () => {
    const prompt = await promptFor({ reach: 4, maxBlocks: 24 });

    // Diseñaba el puente centrado en sí misma: «-3,-2,-1,[hueco],1,2,3». Como
    // ella se para siempre en tierra firme, ese hueco del medio cae en la
    // orilla y el tramo seguido más largo queda en 3 — un cauce de 4 no se
    // cruza NUNCA, se plante donde se plante. El 0,0 prohibido se leía como
    // «dejá un huequito» en vez de «no te pares en medio de tu propio puente».
    expect(prompt).toContain('TODA PARA EL MISMO LADO');
    expect(prompt).toContain('sin huecos');
    expect(prompt).toContain('es TU celda');
    // Y con el largo de un solo lado dicho en números, no deducido.
    expect(prompt).toContain('hasta 4 celdas de largo');
  });

  it('los bloques de un cruce son pisables; lo de tapiarse es para lo que encierra', async () => {
    const prompt = await promptFor({ reach: 4, maxBlocks: 24 });

    // Antes exigía sólidos SIEMPRE y avisaba de la abertura SIEMPRE: forma de
    // choza para toda obra. Un puente de bloques sólidos no se camina.
    expect(prompt).toContain('"footing"');
    expect(prompt).toContain('NO sólidos');
    // El consejo de la abertura sigue existiendo, pero atado a encerrar.
    expect(prompt).toContain('ENCERRAR UN ESPACIO');
    expect(prompt).toContain('ABERTURA');
  });

  it('la medida del obstáculo viaja y se dice como número, no como adjetivo', async () => {
    const prompt = await promptFor({
      reach: 4,
      maxBlocks: 24,
      obstacle: { kind: 'agua', width: 4 },
    });

    // El ancho lo contó ella mirando: sin esto diseñaba a ciegas y el juez la
    // corregía después, quemando intentos. Peor: en el cauce salía bien en
    // parte porque el propio encargo del cuidador decía «cuatro pasos» — o sea
    // que el resultado dependía del enunciado y no de lo que ella percibía.
    expect(prompt).toContain('agua de 4 celdas de ancho');
    expect(prompt).toContain('lo contaste vos mirando');
    expect(prompt).toContain('fila de 4 celdas seguidas lo tapa entero');
  });

  it('un obstáculo más ancho que su alcance se dice imposible, no «diseñá mejor»', async () => {
    const prompt = await promptFor({
      reach: 4,
      maxBlocks: 24,
      obstacle: { kind: 'agua', width: 9 },
    });

    // Mandarla a corregir lo incorregible le quema los tres intentos contra una
    // pared. Que sepa que el techo es del mundo y no de su idea es lo que hace
    // que la próxima sea de OTRA clase, no otra variante de la misma.
    expect(prompt).toContain('más de lo que una sola obra');
    expect(prompt).toContain('otra cosa');
    expect(prompt).not.toContain('fila de 9 celdas seguidas lo tapa entero');
  });

  it('sin nada que cruzar, no le inventamos un obstáculo', async () => {
    const prompt = await promptFor({ reach: 4, maxBlocks: 24 });
    expect(prompt).not.toContain('LO QUE TE CORTA EL PASO');
  });
});
