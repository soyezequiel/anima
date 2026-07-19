import { useEffect, useRef, useState } from 'react';
import type {
  AiLimits,
  AiLimitWindow,
  AiStatus,
  ClaudeSettings,
  CodexSettings,
  RemoteAiProvider,
} from '../auth/ai.js';
import {
  aiLogout,
  CLAUDE_MODEL_SUGGESTIONS,
  CODEX_MODEL_SUGGESTIONS,
  fetchAiLimits,
  fetchAiStatus,
  readClaudeSettings,
  readCodexSettings,
  startAiLogin,
  storeAiChoice,
  storeClaudeSettings,
  storeCodexSettings,
  submitAiLoginCode,
  waitForAiLogin,
} from '../auth/ai.js';
import type { CloudAccount } from '../auth/cloud.js';
import type { GameSession } from '../session/GameSession.js';
import type { GameView } from '../session/view.js';
import { useDismissablePanel } from './useDismissablePanel.js';

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
 * Todo lo configurable detrás de un solo ⚙: con qué piensa la mascota y en
 * qué mundo vive. Reiniciar borra el mundo, así que estar tras un clic no es
 * solo cuestión de espacio.
 *
 * El mock determinista es la base; el interruptor conecta la cuenta de Codex
 * (ChatGPT) y la vuelve el motor. Con identidad iniciada la sesión de Codex es
 * propia de esa identidad; como invitado se usa la de la máquina.
 */
export function SettingsMenu({
  session,
  view,
  account,
}: {
  session: GameSession;
  view: GameView;
  account: CloudAccount | null;
}) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [claudeStatus, setClaudeStatus] = useState<AiStatus | null>(null);
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'waiting' | 'error'>('idle');
  // Qué proveedor está a mitad de conexión: decide qué ayudas mostrar
  // mientras se espera (el flujo de Claude pide pegar un código).
  const [connecting, setConnecting] = useState<RemoteAiProvider | null>(null);
  const [loginCode, setLoginCode] = useState('');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [settings, setSettings] = useState<CodexSettings>(() => readCodexSettings());
  const [claudeSettings, setClaudeSettings] = useState<ClaudeSettings>(() => readClaudeSettings());
  const [limits, setLimits] = useState<AiLimits | 'loading' | 'error' | null>(null);
  const [seedInput, setSeedInput] = useState(String(view.seed));
  const menuRef = useRef<HTMLDetailsElement>(null);
  useDismissablePanel(menuRef);

  const usingCodex = view.aiProvider === 'codex';
  const usingClaude = view.aiProvider === 'claude';

  // Los límites se consultan al abrir el panel: son datos frescos de la
  // cuenta y consultarlos no consume cuota del modelo. Solo Codex los
  // informa; el CLI de Claude no los expone.
  const loadLimits = (): void => {
    setLimits('loading');
    void fetchAiLimits().then((value) => setLimits(value ?? 'error'));
  };

  useEffect(() => {
    void fetchAiStatus().then(setStatus);
    void fetchAiStatus('claude').then(setClaudeStatus);
  }, []);

  const updateSettings = (next: CodexSettings): void => {
    setSettings(next);
    storeCodexSettings(next);
  };

  const updateClaudeSettings = (next: ClaudeSettings): void => {
    setClaudeSettings(next);
    storeClaudeSettings(next);
  };

  const fail = (detail: string): void => {
    setErrorDetail(detail);
    setPhase('error');
  };

  const cliHint: Record<RemoteAiProvider, string> = {
    codex: 'no se encontró el CLI de Codex en esta máquina (npm i -g @openai/codex)',
    claude:
      'no se encontró el CLI de Claude en esta máquina (npm i -g @anthropic-ai/claude-code)',
  };

  const connect = async (provider: RemoteAiProvider): Promise<void> => {
    setPhase('connecting');
    setConnecting(provider);
    setLoginCode('');
    setErrorDetail(null);
    const current = await fetchAiStatus(provider);
    // Distinguir el porqué evita el diagnóstico a ciegas: la causa más
    // común es que la API local no esté levantada.
    if (current === null) {
      fail(
        'la API local no responde: inicia el backend con «pnpm dev:full» (o «pnpm --filter @anima/api dev»)',
      );
      return;
    }
    if (!current.installed) {
      fail(cliHint[provider]);
      return;
    }
    if (!current.loggedIn) {
      const authUrl = await startAiLogin(provider);
      if (!authUrl) {
        fail(
          provider === 'claude'
            ? 'claude auth login no entregó la URL de autorización; podés iniciar sesión con «claude /login» en una terminal y volver a intentar'
            : 'codex login no entregó la URL de autorización; revisa la consola de la API',
        );
        return;
      }
      window.open(authUrl, '_blank', 'noopener');
      setPhase('waiting');
      const ok = await waitForAiLogin(provider);
      if (!ok) {
        fail('la autorización no se completó a tiempo; vuelve a intentarlo');
        return;
      }
    }
    storeAiChoice(provider);
    window.location.reload();
  };

  /** Apagarlo es inmediato; encenderlo puede pasar por autorizar la cuenta. */
  const toggleProvider = async (provider: RemoteAiProvider, enable: boolean): Promise<void> => {
    if (!enable) {
      storeAiChoice('mock');
      window.location.reload();
      return;
    }
    // Encender uno apaga al otro: hay una sola mente pensando a la vez.
    await connect(provider);
  };

  /**
   * Cerrar la sesión del proveedor deja la cuenta fuera: si era el motor
   * activo, la mascota vuelve al simulado en vez de quedarse sin con qué
   * pensar.
   */
  const logoutProvider = (provider: RemoteAiProvider): void => {
    void aiLogout(provider).then(() => {
      if ((provider === 'codex' && usingCodex) || (provider === 'claude' && usingClaude)) {
        storeAiChoice('mock');
        window.location.reload();
        return;
      }
      void fetchAiStatus(provider).then(provider === 'claude' ? setClaudeStatus : setStatus);
    });
  };

  const switching = phase === 'connecting' || phase === 'waiting';
  const codexMissing = status?.installed === false;
  const claudeMissing = claudeStatus?.installed === false;

  return (
    <details
      className="settings-menu"
      ref={menuRef}
      onToggle={(event) => {
        if (event.currentTarget.open && usingCodex) loadLimits();
      }}
    >
      <summary data-testid="ai-settings-toggle" aria-label="Ajustes">
        ⚙ ajustes
      </summary>
      <div className="settings-panel">
        <div className="ai-toggle">
          <label htmlFor="ai-provider-toggle">
            <span>Pensar con Codex</span>
            <small>
              {usingCodex
                ? 'La mascota piensa con tu cuenta de ChatGPT.'
                : 'Apagado, la mascota piensa con el modelo simulado: determinista y sin costo.'}
            </small>
          </label>
          <input
            id="ai-provider-toggle"
            type="checkbox"
            role="switch"
            data-testid="ai-provider-toggle"
            checked={usingCodex}
            disabled={switching || (!usingCodex && codexMissing)}
            title={
              codexMissing
                ? 'No se encontró el CLI de Codex en esta máquina'
                : account
                  ? 'Usa tu propia cuenta de Codex (ChatGPT); queda ligada a tu identidad'
                  : 'Usa la cuenta de Codex (ChatGPT) de esta máquina; inicia sesión para conectar la tuya'
            }
            onChange={(event) => void toggleProvider('codex', event.currentTarget.checked)}
          />
        </div>
        {/* El interruptor queda deshabilitado: sin decir por qué es un callejón sin salida. */}
        {codexMissing && !usingCodex && (
          <small>No se encontró el CLI de Codex en esta máquina (npm i -g @openai/codex).</small>
        )}
        {/* Claude es otra opción del mismo rango que Codex: encender una
            apaga la otra, porque hay una sola mente pensando a la vez. */}
        <div className="ai-toggle">
          <label htmlFor="ai-claude-toggle">
            <span>Pensar con Claude</span>
            <small>
              {usingClaude
                ? 'La mascota piensa con la suscripción de Claude de esta máquina.'
                : 'Apagado. Usa la suscripción de Claude (Anthropic) de esta máquina, sin API key.'}
            </small>
          </label>
          <input
            id="ai-claude-toggle"
            type="checkbox"
            role="switch"
            data-testid="ai-claude-toggle"
            checked={usingClaude}
            disabled={switching || (!usingClaude && claudeMissing)}
            title={
              claudeMissing
                ? 'No se encontró el CLI de Claude en esta máquina'
                : 'Usa la sesión de Claude Code de esta máquina (tu suscripción personal)'
            }
            onChange={(event) => void toggleProvider('claude', event.currentTarget.checked)}
          />
        </div>
        {claudeMissing && !usingClaude && (
          <small>
            No se encontró el CLI de Claude en esta máquina (npm i -g @anthropic-ai/claude-code).
          </small>
        )}
        {/* Las respuestas tontas son del simulado (ADR 0006), pero el
            interruptor se queda a la vista igual con Codex encendido: una
            opción escondida es una opción que no existe. Deshabilitado y
            diciendo por qué, como el de Codex cuando falta el CLI. */}
        <div className="ai-toggle">
          <label htmlFor="mock-imperfect-toggle">
            <span>Respuestas tontas</span>
            <small>
              {usingCodex || usingClaude
                ? `Solo aplican al modelo simulado; ahora la mascota piensa con ${usingClaude ? 'Claude' : 'Codex'}.`
                : view.mockImperfect
                  ? 'El simulado propone primero un atajo imposible y aprende del rechazo del mundo: el ciclo completo, a la vista.'
                  : 'Apagadas: el simulado propone directo la idea corregida, sin el desvío del error.'}
            </small>
          </label>
          <input
            id="mock-imperfect-toggle"
            type="checkbox"
            role="switch"
            data-testid="mock-imperfect-toggle"
            checked={view.mockImperfect}
            disabled={usingCodex || usingClaude}
            title={
              usingCodex || usingClaude
                ? 'Solo aplica al modelo simulado: apaga el modelo real para usarlo'
                : 'Primeras ideas equivocadas a propósito: así se ve cómo el mundo la corrige'
            }
            onChange={(event) => session.setMockImperfect(event.currentTarget.checked)}
          />
        </div>
        {phase === 'waiting' && <small className="muted">esperando autorización…</small>}
        {/* El login de Claude termina con un código que la página muestra y
            el CLI espera: sin este campo, el flujo queda a mitad de camino. */}
        {phase === 'waiting' && connecting === 'claude' && (
          <form
            className="seed-row"
            onSubmit={(event) => {
              event.preventDefault();
              const code = loginCode.trim();
              if (!code) return;
              void submitAiLoginCode('claude', code).then((result) => {
                if (!result.ok) fail(result.error ?? 'el código no completó la autorización');
              });
            }}
          >
            <input
              data-testid="ai-claude-login-code"
              value={loginCode}
              onChange={(event) => setLoginCode(event.target.value)}
              placeholder="pegá aquí el código de la página"
              aria-label="código de autorización de Claude"
            />
            <button type="submit" data-testid="ai-claude-login-code-send">
              Enviar
            </button>
          </form>
        )}
        {phase === 'error' && (
          <span className="account-error" data-testid="ai-error">
            {errorDetail ?? 'no se pudo conectar la IA'}
          </span>
        )}
        {usingCodex && (
          <>
            <label>
              <span>Modelo</span>
              {/* Un <select> abre siempre; el <datalist> anterior solo desplegaba
                  en ciertos estados del input y se sentía intermitente. La opción
                  vacía es «Automático»: deja que la cuenta elija su modelo. Un
                  modelo guardado que ya no esté en las sugerencias se muestra
                  igual para no perderlo en silencio. */}
              <select
                data-testid="ai-model"
                value={settings.model}
                onChange={(event) =>
                  updateSettings({ ...settings, model: event.currentTarget.value })
                }
              >
                <option value="">Automático</option>
                {settings.model &&
                  !CODEX_MODEL_SUGGESTIONS.includes(
                    settings.model as (typeof CODEX_MODEL_SUGGESTIONS)[number],
                  ) && <option value={settings.model}>{settings.model}</option>}
                {CODEX_MODEL_SUGGESTIONS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Nivel de razonamiento</span>
              <select
                data-testid="ai-reasoning-effort"
                value={settings.reasoningEffort}
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
                ? 'Ánima sigue pensando con el ajuste anterior; el cambio se aplica la próxima vez que piense.'
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
          </>
        )}
        {usingClaude && (
          <>
            <label>
              <span>Modelo</span>
              {/* Mismo criterio que el select de Codex: la opción vacía es
                  «Automático» (decide la cuenta) y un modelo guardado que ya
                  no esté en las sugerencias se muestra igual para no perderlo
                  en silencio. El default de fábrica es Sonnet. */}
              <select
                data-testid="ai-claude-model"
                value={claudeSettings.model}
                onChange={(event) =>
                  updateClaudeSettings({ ...claudeSettings, model: event.currentTarget.value })
                }
              >
                <option value="">Automático</option>
                {claudeSettings.model &&
                  !CLAUDE_MODEL_SUGGESTIONS.includes(
                    claudeSettings.model as (typeof CLAUDE_MODEL_SUGGESTIONS)[number],
                  ) && <option value={claudeSettings.model}>{claudeSettings.model}</option>}
                {CLAUDE_MODEL_SUGGESTIONS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Nivel de razonamiento</span>
              <select
                data-testid="ai-claude-reasoning-effort"
                value={claudeSettings.reasoningEffort}
                onChange={(event) =>
                  updateClaudeSettings({
                    ...claudeSettings,
                    reasoningEffort: event.currentTarget
                      .value as ClaudeSettings['reasoningEffort'],
                  })
                }
              >
                <option value="">Automático</option>
                <option value="low">Bajo</option>
                <option value="medium">Medio</option>
                <option value="high">Alto</option>
                <option value="xhigh">Muy alto</option>
                <option value="max">Máximo</option>
              </select>
            </label>
            <small>
              {view.aiBusy
                ? 'Ánima sigue pensando con el ajuste anterior; el cambio se aplica la próxima vez que piense.'
                : 'Se aplica a la próxima consulta y queda guardado en este navegador.'}
            </small>
          </>
        )}
        {status?.loggedIn && (
          <div className="settings-section">
            <small>
              {account
                ? 'Cuenta de Codex ligada a tu identidad.'
                : 'Cuenta de Codex compartida de esta máquina (modo invitado).'}
            </small>
            <button
              data-testid="ai-logout-codex"
              disabled={view.aiBusy || switching}
              title="Cierra la sesión de Codex en esta máquina"
              onClick={() => logoutProvider('codex')}
            >
              Cerrar sesión de Codex
            </button>
          </div>
        )}
        {claudeStatus?.loggedIn && (
          <div className="settings-section">
            <small>
              {claudeStatus.detail
                ? `Sesión de Claude de esta máquina: ${claudeStatus.detail}.`
                : 'Sesión de Claude de esta máquina.'}
            </small>
            <button
              data-testid="ai-logout-claude"
              disabled={view.aiBusy || switching}
              title="Cierra la sesión de Claude en esta máquina"
              onClick={() => logoutProvider('claude')}
            >
              Cerrar sesión de Claude
            </button>
          </div>
        )}

        {/* La mochila (ADR 0070). Va acá y no en la barra de arriba porque no
            es un modo que se prenda y se apague mirando: es un número que se
            deja puesto. Se aplica en vivo sobre la mascota que hay. */}
        {view.pet && (
          <div className="settings-section">
            <label htmlFor="backpack-input">
              <span>Tamaño de la mochila</span>
              <small>
                Cuántas cosas puede llevar encima a la vez. Achicarla no le tira nada al piso:
                deja de levantar hasta que se descargue sola.
              </small>
            </label>
            <div className="seed-row">
              <input
                id="backpack-input"
                data-testid="backpack-input"
                type="range"
                min={1}
                max={20}
                value={view.pet.inventoryCapacity}
                aria-label="tamaño de la mochila"
                onChange={(e) => session.setBackpackSize(Number(e.target.value))}
              />
              <output data-testid="backpack-value" htmlFor="backpack-input">
                {view.pet.inventory.length}/{view.pet.inventoryCapacity}
              </output>
            </div>
          </div>
        )}

        <div className="settings-section">
          <form
            className="seed-form"
            onSubmit={(e) => {
              e.preventDefault();
              const seed = Number(seedInput);
              if (!Number.isFinite(seed)) return;
              session.reset(seed);
              // Reiniciar es un «ya está»: el panel se aparta para dejar ver
              // el mundo nuevo en vez de quedarse tapándolo.
              if (menuRef.current) menuRef.current.open = false;
            }}
          >
            <label htmlFor="seed-input">
              <span>Semilla del mundo</span>
              <small>
                Reiniciar descarta el mundo actual y empieza uno nuevo con esta semilla.
              </small>
            </label>
            <div className="seed-row">
              <input
                id="seed-input"
                data-testid="seed-input"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                size={4}
                aria-label="semilla"
              />
              <button type="submit" data-testid="reset-button">
                ⟳ Reiniciar
              </button>
            </div>
          </form>
        </div>
      </div>
    </details>
  );
}
