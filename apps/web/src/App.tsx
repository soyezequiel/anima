import { useState, useSyncExternalStore } from 'react';
import { PhaserStage } from './phaser/PhaserStage.js';
import type { GameSession } from './session/GameSession.js';
import type { CloudAccount } from './auth/cloud.js';
import { AccountBar } from './components/AccountBar.js';
import { ChatPanel } from './components/ChatPanel.js';
import { SettingsMenu } from './components/SettingsMenu.js';
import { Controls } from './components/Controls.js';
import { DeathOverlay } from './components/DeathOverlay.js';
import { DevPanel } from './components/DevPanel.js';
import { ExperimentsPanel } from './components/ExperimentsPanel.js';
import { ItemsPanel } from './components/ItemsPanel.js';
import { MindPanel } from './components/MindPanel.js';
import { SkillsPanel } from './components/SkillsPanel.js';
import { StatusPanel } from './components/StatusPanel.js';
import { ThoughtTicker } from './components/ThoughtTicker.js';
import { WelcomeOverlay } from './components/WelcomeOverlay.js';

type Tab = 'estado' | 'chat' | 'mente' | 'items' | 'skills' | 'experimentos' | 'dev';

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
  const [tab, setTab] = useState<Tab>('estado');
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
      // Sin storage (modo incógnito estricto): la bienvenida vuelve la próxima
      // vez, que es mejor que romperse.
    }
    setShowWelcome(false);
    // La acción está en el chat: que el primer paso caiga donde se juega.
    setTab('chat');
  };

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'estado', label: 'Estado' },
    { id: 'chat', label: 'Chat', badge: view.chat.length },
    { id: 'mente', label: 'Mente', badge: view.thoughts.length },
    { id: 'items', label: 'Items', badge: view.items.length },
    { id: 'skills', label: 'Skills', badge: view.skills.length },
    { id: 'experimentos', label: 'Experimentos', badge: view.experiments.length },
    { id: 'dev', label: 'Dev' },
  ];

  return (
    // Estado de fondo en la raíz: ni la historia ni el motor tienen ya un
    // cartel propio en la cabecera, pero siguen siendo observables.
    <div
      className="app"
      data-story={view.storyCompleted ? 'completed' : 'learning'}
      data-ai={view.aiProvider}
    >
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
        {/* Solo mientras aprende: una vez completada dejaba de decir nada. */}
        {!view.storyCompleted && (
          <span className="story-badge" data-testid="story-status">
            aprendiendo…
          </span>
        )}
        <Controls session={session} view={view} />
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
          <PhaserStage
            view={view}
            onDropItem={(kind, at) => session.placeItemOnMap(kind, at)}
          />
          {/* En qué parte del pensamiento va: visible desde cualquier pestaña. */}
          {view.currentThought && !view.death && <ThoughtTicker thought={view.currentThought} />}
          {view.death && <DeathOverlay report={view.death} session={session} />}
        </section>
        <aside className="panel">
          <nav className="tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? 'tab active' : 'tab'}
                data-testid={`tab-${t.id}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.badge !== undefined && t.badge > 0 && <span className="badge">{t.badge}</span>}
              </button>
            ))}
          </nav>
          <div className="panel-body">
            {tab === 'estado' && <StatusPanel view={view} session={session} />}
            {tab === 'chat' && <ChatPanel view={view} session={session} />}
            {tab === 'mente' && <MindPanel view={view} />}
            {tab === 'items' && <ItemsPanel view={view} />}
            {tab === 'skills' && <SkillsPanel view={view} />}
            {tab === 'experimentos' && <ExperimentsPanel view={view} />}
            {tab === 'dev' && <DevPanel view={view} session={session} />}
          </div>
        </aside>
      </main>
      {showWelcome && <WelcomeOverlay onStart={startPlaying} />}
    </div>
  );
}
