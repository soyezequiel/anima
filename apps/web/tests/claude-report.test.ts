import { describe, expect, it } from 'vitest';
import { MemoryKeyValueStore } from '@anima/persistence';
import { GameSession } from '../src/session/GameSession.js';

async function runTicks(session: GameSession, ticks: number): Promise<void> {
  for (let i = 0; i < ticks; i++) await session.stepOnce();
}

describe('reporte para Claude Code', () => {
  it('describe la corrida, las brechas y adjunta los datos crudos', async () => {
    const session = await GameSession.create({
      seed: 5,
      autostart: false,
      store: new MemoryKeyValueStore(),
    });
    await runTicks(session, 30);

    const { fileName, markdown } = session.buildClaudeReport();

    expect(fileName).toMatch(/^anima-reporte-claude-.+-t\d+\.md$/);

    // La visión y las brechas son el corazón del reporte.
    expect(markdown).toContain('# Reporte de Ánima para Claude Code');
    expect(markdown).toContain('## Visión objetivo');
    expect(markdown).toContain('## Brechas contra la visión');
    expect(markdown).toContain('no determinista');
    expect(markdown).toContain('packages/sim-core/src/step.ts');
    expect(markdown).toContain('packages/shared/src/rng.ts');

    // Evidencia viva: las recetas base del mundo aparecen listadas.
    expect(markdown).toContain('`campfire`');
    expect(markdown).toContain('`chair`');

    // Los datos crudos son JSON válido y traen el estado esencial.
    const rawBlock = /```json\n([\s\S]+)\n```/.exec(markdown);
    expect(rawBlock).not.toBeNull();
    const raw = JSON.parse(rawBlock![1]!) as {
      seed: number;
      tick: number;
      recipes: unknown[];
      skills: unknown[];
      evaluationSeeds: number[];
    };
    expect(raw.seed).toBe(5);
    expect(raw.tick).toBeGreaterThan(0);
    expect(raw.recipes.length).toBeGreaterThan(0);
    expect(raw.evaluationSeeds).toEqual([11, 22, 33]);

    session.dispose();
  });
});
