import { useState, useSyncExternalStore } from 'react';
import { PhaserStage } from './phaser/PhaserStage.js';
import type { GameSession } from './session/GameSession.js';
import type { CloudAccount } from './auth/cloud.js';
import { AccountBar } from './components/AccountBar.js';
import { ChatFeedPanel } from './components/ChatFeedPanel.js';
import { SettingsMenu } from './components/SettingsMenu.js';
import { Controls } from './components/Controls.js';
import { DeathOverlay } from './components/DeathOverlay.js';
import { DevPanel } from './components/DevPanel.js';
import { GoalsPanel } from './components/GoalsPanel.js';
import { useExpansion } from './components/expansion.js';
import { ItemsPanel } from './components/ItemsPanel.js';
import { LearningPanel } from './components/LearningPanel.js';
import { PruneOverlay } from './components/PruneOverlay.js';
import { StatusPanel } from './components/StatusPanel.js';
import { useTabActivity } from './components/tabActivity.js';
import { WorksPanel } from './components/WorksPanel.js';
import { ThoughtTicker } from './components/ThoughtTicker.js';
import { VitalsHeader } from './components/VitalsHeader.js';
import { WelcomeOverlay } from './components/WelcomeOverlay.js';

/**
 * Rediseño UX: de 7 pestañas a 4 (+ enlace dev discreto) y signos vitales
 * SIEMPRE visibles encima de las pestañas. El usuario nuevo entra por Chat
 * —la acción principal— y nunca pierde el contexto vital.
 */
type Tab = 'chat' | 'objetivos' | 'estado' | 'objetos' | 'obras' | 'aprendizaje' | 'dev';

const WELCOME_SEEN_KEY = 'anima.welcomeSeen';

function welcomeAlreadySeen(): boolean {
  try {
    return localStorage.getItem(WELCOME_SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

export function App({ session, account }: { session: GameSession; account: CloudAccount | null }) {
  const view = useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.getView(),
  );
  const [tab, setTab] = useState<Tab>('chat');
  /**
   * El objeto a mirar de cerca (ADR 0056, adenda): tocar una pieza en Obras
   * salta a Objetos, abre esa ficha y la resalta. El contador es lo que
   * permite repetir el salto sobre la MISMA pieza — sin él, volver a tocarla
   * no cambiaría el estado y la ficha no se movería ni se resaltaría.
   */
  const [focusItem, setFocusItem] = useState<{ kind: string; nonce: number } | null>(null);
  const inspectItem = (kind: string) => {
    setFocusItem((previous) => ({ kind, nonce: (previous?.nonce ?? 0) + 1 }));
    setTab('objetos');
  };
  /**
   * Qué está desplegado (ADR 0069). Vive acá arriba y no en cada fila porque
   * el panel se rehace con cada tick del mundo: un `useState` adentro se
   * perdía a los pocos segundos y el árbol se cerraba solo.
   */
  const expansion = useExpansion();
  /**
   * Qué pestaña se está moviendo ahora mismo. Se mira sola —es una lectura del
   * view— y sirve justamente para las cinco que NO se están viendo.
   */
  const live = useTabActivity(view);
  const [showWelcome, setShowWelcome] = useState(() => !welcomeAlreadySeen());
  const [nameDraft, setNameDraft] = useState<string | null>(null);

  const confirmRename = () => {
    if (nameDraft !== null && nameDraft.trim()) session.renamePet(nameDraft);
    setNameDraft(null);
  };

  const startPlaying = () => {
    try {
      localStorage.setItem(WELCOME_SEEN_KEY, '1');
    } catch {
      // Sin storage (incógnito estricto): la bienvenida vuelve la próxima vez.
    }
    setShowWelcome(false);
    setTab('chat');
  };

  // Pestañas primarias + una técnica (dev) empujada al costado y de bajo peso.
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'chat', label: 'Chat', badge: view.chat.length },
    // El contador son los ABIERTOS, no todos: lo terminado no reclama atención.
    {
      id: 'objetivos',
      label: 'Objetivos',
      badge: view.goals.filter((g) => g.status === 'active' || g.status === 'suspended').length,
    },
    { id: 'estado', label: 'Estado' },
    { id: 'objetos', label: 'Objetos', badge: view.items.length },
    { id: 'obras', label: 'Obras', badge: view.blueprints.length },
    { id: 'aprendizaje', label: 'Aprendizaje', badge: view.skills.length },
  ];

  return (
    <div className="app" data-story={view.storyCompleted ? 'completed' : 'learning'} data-ai={view.aiProvider}>
      <header className="topbar">
        <h1>
          {nameDraft === null ? (
            <>
              <span data-testid="pet-name">{view.identity.name}</span>
              {!view.death && (
                <button
                  className="rename-button"
                  data-testid="rename-button"
                  title="Cambiar nombre"
                  aria-label="Cambiar nombre"
                  onClick={() => setNameDraft(view.identity.name)}
                >
                  ✎
                </button>
              )}
            </>
          ) : (
            <form
              className="rename-form"
              onSubmit={(e) => {
                e.preventDefault();
                confirmRename();
              }}
            >
              <input
                data-testid="rename-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setNameDraft(null);
                }}
                maxLength={24}
                autoFocus
                aria-label="nuevo nombre"
              />
              <button type="submit" data-testid="rename-confirm" aria-label="confirmar nombre">
                ✓
              </button>
            </form>
          )}{' '}
          <span className="gen-badge" data-testid="generation">
            gen {view.identity.generation}
          </span>
        </h1>
        {!view.storyCompleted && (
          <span className="story-badge" data-testid="story-status">
            aprendiendo…
          </span>
        )}
        <Controls session={session} view={view} />
        {/* Modo creativo (ADR 0061). Va en la barra y no dentro de Ajustes
            porque cambia las reglas del mundo mientras se juega: tiene que
            verse encendido de un vistazo, no dos clics adentro de un menú. */}
        <button
          className={`creative-toggle${view.creativeMode ? ' active' : ''}`}
          data-testid="creative-toggle"
          role="switch"
          aria-checked={view.creativeMode}
          title={
            view.creativeMode
              ? 'Modo creativo encendido: su cuerpo se mantiene lleno'
              : 'Modo creativo: mantiene energía, salud y calor al máximo'
          }
          onClick={() => session.setCreativeMode(!view.creativeMode)}
        >
          <span aria-hidden="true">✨</span> Creativo
        </button>
        <SettingsMenu session={session} view={view} account={account} />
        <AccountBar account={account} />
        <button
          className="help-button"
          data-testid="help-button"
          title="¿Cómo se juega?"
          aria-label="Cómo se juega"
          onClick={() => setShowWelcome(true)}
        >
          ?
        </button>
      </header>

      <main className="layout">
        <section className="stage">
          <PhaserStage view={view} onDropItem={(kind, at) => session.placeItemOnMap(kind, at)} />
          {view.currentThought && !view.death && <ThoughtTicker thought={view.currentThought} />}
          {view.death && <DeathOverlay report={view.death} session={session} />}
        </section>

        <aside className="panel">
          {/* Signos vitales + «Ahora» SIEMPRE visibles, sin importar la pestaña. */}
          <VitalsHeader view={view} onInspect={inspectItem} expansion={expansion} />

          <nav className="tabs rd-tabs">
            {tabs.map((t) => {
              // La pestaña abierta no necesita el punto: lo que pasa ahí se ve.
              const active = live.has(t.id as Exclude<Tab, 'dev'>) && tab !== t.id;
              return (
                <button
                  key={t.id}
                  className={tab === t.id ? 'tab active' : 'tab'}
                  data-testid={`tab-${t.id}`}
                  data-live={active ? 'true' : undefined}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  {active && (
                    <span className="tab-live" title={`Hay actividad en ${t.label}`} role="img" aria-label="hay actividad" />
                  )}
                  {t.badge !== undefined && t.badge > 0 && <span className="badge">{t.badge}</span>}
                </button>
              );
            })}
            {/* Registro técnico: accesible pero fuera del foco. */}
            <button
              className={`tab rd-dev${tab === 'dev' ? ' active' : ''}`}
              data-testid="tab-dev"
              title="Registro técnico"
              onClick={() => setTab('dev')}
            >
              dev
            </button>
          </nav>

          <div className="panel-body">
            {tab === 'chat' && <ChatFeedPanel view={view} session={session} />}
            {tab === 'objetivos' && <GoalsPanel view={view} onInspect={inspectItem} expansion={expansion} />}
            {tab === 'estado' && <StatusPanel view={view} session={session} />}
            {tab === 'objetos' && <ItemsPanel view={view} session={session} focus={focusItem} onInspect={inspectItem} expansion={expansion} />}
            {tab === 'obras' && <WorksPanel view={view} onInspect={inspectItem} />}
            {tab === 'aprendizaje' && <LearningPanel view={view} session={session} />}
            {tab === 'dev' && <DevPanel view={view} session={session} />}
          </div>
        </aside>
      </main>

      {showWelcome && <WelcomeOverlay onStart={startPlaying} />}
      {view.prune && (
        <PruneOverlay
          preview={view.prune}
          onConfirm={() => session.confirmPrune()}
          onCancel={() => session.cancelPrune()}
        />
      )}
    </div>
  );
}
