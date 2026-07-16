import { useEffect, useRef, useState } from 'react';
import type { AiLimits, AiLimitWindow, AiStatus, CodexSettings } from '../auth/ai.js';
import {
  CODEX_MODEL_SUGGESTIONS,
  codexLogout,
  fetchAiLimits,
  fetchAiStatus,
  readCodexSettings,
  startCodexLogin,
  storeAiChoice,
  storeCodexSettings,
  waitForCodexLogin,
} from '../auth/ai.js';
import type { CloudAccount } from '../auth/cloud.js';
import type { GameView } from '../session/view.js';

function windowLabel(window: AiLimitWindow): string {
  const mins = window.windowDurationMins;
  if (mins === null) return 'Ventana de uso';
  if (mins >= 10_000) return 'Límite semanal';
  if (mins >= 1440) return `Límite de ${Math.round(mins / 1440)} días`;
  if (mins >= 60) return `Límite de ${Math.round(mins / 60)} h`;
  return `Límite de ${mins} min`;
}

function resetLabel(window: AiLimitWindow): string {
  if (window.resetsAt === null) return '';
  const date = new Date(window.resetsAt * 1000);
  return ` · se reinicia ${date.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function LimitRow({ window }: { window: AiLimitWindow }) {
  return (
    <small className="ai-limit-row">
      {windowLabel(window)}: {window.usedPercent}% usado{resetLabel(window)}
      <progress value={window.usedPercent} max={100} />
    </small>
  );
}

/**
 * Selector de proveedor de IA. El mock determinista es la base; con la
 * cuenta de Codex (ChatGPT) conectada, la mascota piensa con un modelo real.
 * Con identidad iniciada, la sesión de Codex es propia de esa identidad;
 * como invitado se usa la sesión de Codex de la máquina.
 */
export function AiBar({ view, account }: { view: GameView; account: CloudAccount | null }) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'waiting' | 'error'>('idle');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [settings, setSettings] = useState<CodexSettings>(() => readCodexSettings());
  const [limits, setLimits] = useState<AiLimits | 'loading' | 'error' | null>(null);
  const settingsRef = useRef<HTMLDetailsElement>(null);

  // Los límites se consultan al abrir el panel: son datos frescos de la
  // cuenta y consultarlos no consume cuota del modelo.
  const loadLimits = (): void => {
    setLimits('loading');
    void fetchAiLimits().then((value) => setLimits(value ?? 'error'));
  };

  useEffect(() => {
    void fetchAiStatus().then(setStatus);
  }, []);

  useEffect(() => {
    const closeOutside = (event: PointerEvent): void => {
      const element = settingsRef.current;
      if (element?.open && event.target instanceof Node && !element.contains(event.target)) {
        element.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && settingsRef.current?.open) {
        settingsRef.current.open = false;
        settingsRef.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const usingCodex = view.aiProvider === 'codex';

  const updateSettings = (next: CodexSettings): void => {
    setSettings(next);
    storeCodexSettings(next);
  };

  const fail = (detail: string): void => {
    setErrorDetail(detail);
    setPhase('error');
  };

  const connect = async (): Promise<void> => {
    setPhase('connecting');
    setErrorDetail(null);
    const current = await fetchAiStatus();
    // Distinguir el porqué evita el diagnóstico a ciegas: la causa más
    // común es que la API local no esté levantada.
    if (current === null) {
      fail(
        'la API local no responde: inicia el backend con «pnpm dev:full» (o «pnpm --filter @anima/api dev»)',
      );
      return;
    }
    if (!current.installed) {
      fail('no se encontró el CLI de Codex en esta máquina (npm i -g @openai/codex)');
      return;
    }
    if (!current.loggedIn) {
      const authUrl = await startCodexLogin();
      if (!authUrl) {
        fail('codex login no entregó la URL de autorización; revisa la consola de la API');
        return;
      }
      window.open(authUrl, '_blank', 'noopener');
      setPhase('waiting');
      const ok = await waitForCodexLogin();
      if (!ok) {
        fail('la autorización no se completó a tiempo; vuelve a intentarlo');
        return;
      }
    }
    storeAiChoice('codex');
    window.location.reload();
  };

  if (usingCodex) {
    return (
      <div className="ai-bar">
        <span
          className={`ai-chip codex${view.aiBusy ? ' busy' : ''}`}
          data-testid="ai-chip"
          aria-busy={view.aiBusy}
          aria-live="polite"
        >
          <span className="ai-pulse" aria-hidden="true" />
          🧠 codex{view.aiBusy ? ' · pensando…' : ''}
        </span>
        <details
          className="ai-settings"
          ref={settingsRef}
          onToggle={(event) => {
            if (event.currentTarget.open) loadLimits();
          }}
        >
          <summary data-testid="ai-settings-toggle" aria-label="Configurar Codex">
            ⚙ ajustes
          </summary>
          <div className="ai-settings-panel">
            <label>
              <span>Modelo</span>
              <input
                data-testid="ai-model"
                list="codex-model-suggestions"
                value={settings.model}
                disabled={view.aiBusy}
                placeholder="Automático"
                autoComplete="off"
                onChange={(event) =>
                  updateSettings({ ...settings, model: event.currentTarget.value })
                }
              />
              <datalist id="codex-model-suggestions">
                {CODEX_MODEL_SUGGESTIONS.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </label>
            <label>
              <span>Nivel de razonamiento</span>
              <select
                data-testid="ai-reasoning-effort"
                value={settings.reasoningEffort}
                disabled={view.aiBusy}
                onChange={(event) =>
                  updateSettings({
                    ...settings,
                    reasoningEffort: event.currentTarget.value as CodexSettings['reasoningEffort'],
                  })
                }
              >
                <option value="">Automático</option>
                <option value="minimal">Mínimo</option>
                <option value="low">Bajo</option>
                <option value="medium">Medio</option>
                <option value="high">Alto</option>
                <option value="xhigh">Muy alto</option>
              </select>
            </label>
            <small>
              {view.aiBusy
                ? 'Ánima ya está pensando; el cambio se habilita al terminar.'
                : 'Se aplica a la próxima consulta y queda guardado en este navegador.'}
            </small>
            <div className="ai-limits" data-testid="ai-limits">
              <span>Límites de la cuenta</span>
              {limits === 'loading' && <small>consultando…</small>}
              {limits === 'error' && <small>no se pudieron consultar los límites</small>}
              {limits !== null && limits !== 'loading' && limits !== 'error' && (
                <>
                  {limits.planType && <small>Plan: {limits.planType}</small>}
                  {limits.primary && <LimitRow window={limits.primary} />}
                  {limits.secondary && <LimitRow window={limits.secondary} />}
                  {!limits.primary && !limits.secondary && (
                    <small>la cuenta no informa ventanas de uso</small>
                  )}
                </>
              )}
            </div>
            <small>
              {account
                ? 'Cuenta de Codex ligada a tu identidad.'
                : 'Cuenta de Codex compartida de esta máquina (modo invitado).'}
            </small>
            <button
              data-testid="ai-logout-codex"
              disabled={view.aiBusy}
              onClick={() => {
                void codexLogout().then(() => {
                  storeAiChoice('mock');
                  window.location.reload();
                });
              }}
            >
              Desconectar Codex
            </button>
          </div>
        </details>
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
              : account
                ? 'Conecta tu propia cuenta de Codex (ChatGPT); queda ligada a tu identidad'
                : 'Usa la cuenta de Codex (ChatGPT) de esta máquina; inicia sesión para conectar la tuya'
          }
          onClick={() => void connect()}
        >
          🧠 Conectar Codex
        </button>
      )}
      {status?.loggedIn && phase !== 'waiting' && (
        <button
          data-testid="ai-logout-codex"
          title="Cierra la sesión de Codex sin activarla como proveedor"
          onClick={() => {
            void codexLogout().then(() => fetchAiStatus().then(setStatus));
          }}
        >
          cerrar sesión de Codex
        </button>
      )}
      {phase === 'error' && (
        <span className="account-error" data-testid="ai-error">
          {errorDetail ?? 'no se pudo conectar Codex'}
        </span>
      )}
    </div>
  );
}
