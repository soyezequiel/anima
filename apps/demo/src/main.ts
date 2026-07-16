import { runMilestone } from './milestone.js';

const seed = Number(process.argv[2] ?? 5);

const report = await runMilestone(seed);

const line = (text = ''): void => {
  console.log(text);
};

line('==========================================================');
line(' ÁNIMA - Hito 1: historia de aprendizaje headless');
line(` (semilla ${seed}, sin claves de IA: MockModelProvider)`);
line('==========================================================');
line();
line('--- Cronología ---');
for (const entry of report.timeline) {
  line(`  [tick ${String(entry.tick).padStart(3)}] ${entry.type.padEnd(20)} ${entry.detail}`);
}
line();
line('--- Habilidades ---');
for (const skill of report.skills) {
  line(
    `  ${skill.name} v${skill.version} [${skill.status}] éxito medido: ${
      skill.metrics.lastEvaluationSuccessRate !== undefined
        ? `${Math.round(skill.metrics.lastEvaluationSuccessRate * 100)}%`
        : 'n/a'
    } usos reales: ${skill.metrics.totalRuns}`,
  );
  for (const failure of skill.knownFailures) {
    line(`    fallo conocido: ${failure.description}`);
  }
}
line();
line('--- Regresiones conservadas ---');
for (const regression of report.regressions) {
  line(`  ${regression.scenarioName} (semilla ${regression.seed}): ${regression.description}`);
}
line();
line('--- Memoria de la mascota ---');
for (const hypothesis of report.hypotheses) {
  line(`  hipótesis [${hypothesis.resolved}] (${hypothesis.confidence}): ${hypothesis.statement}`);
}
for (const fact of report.facts) {
  line(`  sabe: ${fact}`);
}
line();
line(`--- La mascota explica ---`);
line(`  "${report.petExplanation}"`);
line();
line('--- Resumen ---');
line(`  Ticks simulados:       ${report.ticks}`);
line(`  Energía:               ${report.energy.initial} -> ${Math.round(report.energy.final * 100) / 100}`);
line(
  `  Consultas al "modelo": propose=${report.modelCalls.propose} revise=${report.modelCalls.revise} interpret=${report.modelCalls.interpret}`,
);
line(`  Resultado:             ${report.success ? 'HITO SUPERADO' : 'FALLÓ'}`);

if (!report.success) process.exitCode = 1;
