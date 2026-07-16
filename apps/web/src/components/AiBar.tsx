import { useEffect, useState } from 'react';
import type { AiStatus } from '../auth/ai.js';
import { fetchAiStatus, startCodexLogin, storeAiChoice, waitForCodexLogin } from '../auth/ai.js';
import type { GameView } from '../session/view.js';

/**
 * Selector de proveedor de IA. El mock determinista es la base; con la
 * cuenta de Codex (ChatGPT) conectada, la mascota piensa con un modelo real.
 */
export function AiBar({ view }: { view: GameView }) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'waiting' | 'error'>('idle');

  useEffect(() => {
    void fetchAiStatus().then(setStatus);
  }, []);

  const usingCodex = view.aiProvider === 'codex';

  const connect = async (): Promise<void> => {
    setPhase('connecting');
    const current = await fetchAiStatus();
    if (!current?.installed) {
      setPhase('error');
      return;
    }
    if (!current.loggedIn) {
      const authUrl = await startCodexLogin();
      if (!authUrl) {
        setPhase('error');
        return;
      }
      window.open(authUrl, '_blank', 'noopener');
      setPhase('waiting');
      const ok = await waitForCodexLogin();
      if (!ok) {
        setPhase('error');
        return;
      }
    }
    storeAiChoice('codex');
    window.location.reload();
  };

  if (usingCodex) {
    return (
      <div className="ai-bar">
        <span className="ai-chip codex" data-testid="ai-chip">
          🧠 codex{view.aiBusy ? ' · pensando…' : ''}
        </span>
        <button
          data-testid="ai-use-mock"
          onClick={() => {
            storeAiChoice('mock');
            window.location.reload();
          }}
        >
          usar simulado
        </button>
      </div>
    );
  }

  return (
    <div className="ai-bar">
      <span className="ai-chip" data-testid="ai-chip">
        🤖 simulado
      </span>
      {phase === 'waiting' ? (
        <span className="muted">esperando autorización…</span>
      ) : (
        <button
          data-testid="ai-connect-codex"
          disabled={phase === 'connecting' || status?.installed === false}
          title={
            status?.installed === false
              ? 'No se encontró el CLI de Codex en esta máquina'
              : 'Usa tu cuenta de Codex (ChatGPT) como mente de la mascota'
          }
          onClick={() => void connect()}
        >
          🧠 Conectar Codex
        </button>
      )}
      {phase === 'error' && <span className="account-error">no se pudo conectar Codex</span>}
    </div>
  );
}
