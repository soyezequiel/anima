import { join } from 'node:path';
import { createCodexBridge } from '@anima/api/ai';
import { mapById, MAPS } from '@anima/missions';
import { CodexModelProvider, MockModelProvider } from '@anima/model-providers';
import type { ModelProvider } from '@anima/model-providers';
import { runMission } from './run.js';

/**
 * Corre un mapa y cuenta qué pasó. Es la herramienta de trabajo del ciclo
 * "implementar → mirar dónde falla → arreglar la causa general": el informe
 * está pensado para que el diagnóstico salga de los datos y no de la
 * imaginación de quien lo lee.
 *
 *   pnpm mission vado                    # con Codex (el cerebro real)
 *   pnpm mission vado --mock             # sin IA: prueba el andamiaje
 *   pnpm mission vado --seed 7 --ticks 600
 */
function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main(): Promise<void> {
  const mapId = process.argv[2];
  const map = mapId ? mapById(mapId) : undefined;
  if (!map) {
    console.error(`Mapas disponibles: ${MAPS.map((m) => m.id).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const useMock = process.argv.includes('--mock');
  let provider: ModelProvider;
  if (useMock) {
    provider = new MockModelProvider();
  } else {
    const model = arg('model');
    const bridge = createCodexBridge(model !== undefined ? { model } : {});
    provider = new CodexModelProvider(
      async (input) => bridge.complete({ prompt: input.prompt, schema: input.schema }),
      {},
      'codex',
    );
  }

  const seed = Number(arg('seed', '1'));
  const maxTicks = Number(arg('ticks', '500'));
  const stamp = `${map.id}-s${seed}-${Date.now()}`;
  const tracePath = join(process.cwd(), 'traces', `${stamp}.jsonl`);

  console.log(`\n▶ ${map.name} — ${map.mission.name}`);
  console.log(`  «${map.mission.briefing}»`);
  console.log(`  proveedor: ${provider.name} · semilla ${seed} · tope ${maxTicks} ticks\n`);

  // Ayuda humana, por el canal de siempre: `--hint 120:"probá con un balde"`.
  // Es lo mismo que escribir en el chat mientras se juega — no toca el mundo,
  // no toca el código, y queda registrada en la traza como lo que es: algo que
  // dijo el cuidador. Se puede repetir.
  const hintsAt: Record<number, string> = {};
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] !== '--hint') continue;
    const raw = process.argv[i + 1] ?? '';
    const at = raw.indexOf(':');
    if (at <= 0) continue;
    const tick = Number(raw.slice(0, at));
    if (Number.isFinite(tick)) hintsAt[tick] = raw.slice(at + 1);
  }
  for (const [tick, text] of Object.entries(hintsAt)) {
    console.log(`  pista del cuidador en el tick ${tick}: «${text}»`);
  }

  const report = await runMission({
    map,
    provider,
    seed,
    maxTicks,
    tracePath,
    ...(Object.keys(hintsAt).length > 0 ? { hintsAt } : {}),
  });

  console.log(report.status.completed ? '✅ MISIÓN SUPERADA' : '❌ misión no superada');
  console.log(`   ticks: ${report.ticks} · consultas al modelo: ${report.modelCalls}`);
  if (report.died) console.log('   (la mascota murió)');
  console.log('\n Objetivos:');
  for (const objective of report.status.objectives) {
    const mark = objective.met ? '✓' : '·';
    const when = objective.metAtTick !== undefined ? ` [tick ${objective.metAtTick}]` : '';
    console.log(`   ${mark} ${objective.describe}${when}`);
    console.log(`       ${objective.detail}`);
  }

  if (report.rejections.length > 0) {
    console.log('\n Propuestas que el mundo rechazó:');
    for (const rejection of report.rejections.slice(0, 15)) {
      console.log(`   tick ${rejection.tick} · ${rejection.gate}: ${rejection.reason}`);
    }
  }

  const failures = Object.entries(report.failedActions).sort((a, b) => b[1] - a[1]);
  if (failures.length > 0) {
    console.log('\n Acciones que el mundo no dejó hacer:');
    for (const [key, count] of failures.slice(0, 12)) console.log(`   ${count}× ${key}`);
  }

  if (report.speech.length > 0) {
    console.log('\n Lo que dijo:');
    for (const line of report.speech.slice(-12)) console.log(`   [${line.tick}] ${line.text}`);
  }

  console.log(`\n Traza completa: ${report.tracePath}\n`);
  // Salida explícita, y no `exitCode`: el puente de Codex mantiene abierto un
  // `codex app-server` persistente (ADR 0044) que no se cierra solo, así que
  // el proceso nunca terminaría por su cuenta. Sin esto cada corrida deja vivo
  // su árbol entero —pnpm, tsx, node y el app-server— y una tarde de pruebas
  // llena la máquina de procesos que nadie va a cerrar. Pasó: 13 app-servers y
  // ~300 procesos node.
  process.exit(report.status.completed ? 0 : 1);
}

void main();
