// Sonda temporal: conversación real con la cuenta de Codex a través del
// camino completo (GameSession -> agente -> interpret.command/dialogue ->
// puente /ai/complete -> codex exec). Ejecutar a mano (consume cuota):
//   pnpm vitest run probe-dialogo.test.ts --config vitest.probe.config.ts
import { describe, expect, it } from 'vitest';
import { CodexModelProvider } from '@anima/model-providers';
import { MemoryKeyValueStore } from '@anima/persistence';
import { GameSession } from './src/session/GameSession.js';

const transport = async (input: { kind: string; prompt: string; schema: unknown }) => {
  const res = await fetch('http://127.0.0.1:8787/ai/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = (await res.json()) as { text?: string; error?: string };
  if (!res.ok) throw new Error(body.error ?? String(res.status));
  return body.text!;
};

async function conversar(mensajes: string[]): Promise<string[]> {
  const session = await GameSession.create({
    seed: 5,
    autostart: false,
    store: new MemoryKeyValueStore(),
    provider: new CodexModelProvider(transport),
  });
  const replies = () =>
    session
      .getView()
      .chat.filter((c) => c.from === 'pet')
      .map((c) => c.text);

  for (const [i, mensaje] of mensajes.entries()) {
    session.sendUserMessage(mensaje);
    const deadline = Date.now() + 120_000;
    while (replies().length < i + 1 && Date.now() < deadline) {
      await session.stepOnce();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    console.log(`TÚ:    ${mensaje}\nÁNIMA: ${replies().at(-1) ?? '(sin respuesta)'}\n`);
  }
  const out = replies();
  session.dispose();
  return out;
}

describe('diálogo real con Codex', () => {
  it('las frases que el parser secuestraba ahora las interpreta el modelo', async () => {
    const [martillo, porque] = await conversar([
      '¿el martillo sirve para algo?', // antes: "Puedo esperar aquí un momento."
      '¿por qué la comida te da energía?', // antes: "Gracias, eso me ayuda a entender qué me pasa."
    ]);

    expect(martillo).not.toContain('Puedo esperar aquí');
    expect(porque).not.toContain('Gracias, eso me ayuda a entender');
    for (const reply of [martillo, porque]) {
      expect(reply).toBeDefined();
      expect(reply).not.toContain('No pude consultar');
    }
  }, 300_000);

  it('una lección sigue activando la experiencia guiada; una orden se ejecuta', async () => {
    const [leccion, orden] = await conversar([
      'comer alimento te devuelve la energía', // debe clasificarse como explanation
      'da un pasito hacia la derecha, porfa', // orden libre: move-direction
    ]);

    expect(leccion).toContain('Gracias');
    expect(orden).toMatch(/derecha|Listo|Voy/i);
  }, 300_000);
});
