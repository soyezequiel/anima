import { useState, useSyncExternalStore } from 'react';
import { PhaserStage } from './phaser/PhaserStage.js';
import { GameSession } from './session/GameSession.js';
import { ChatPanel } from './components/ChatPanel.js';
import { Controls } from './components/Controls.js';
import { DevPanel } from './components/DevPanel.js';
import { ExperimentsPanel } from './components/ExperimentsPanel.js';
import { SkillsPanel } from './components/SkillsPanel.js';
import { StatusPanel } from './components/StatusPanel.js';

type Tab = 'estado' | 'chat' | 'skills' | 'experimentos' | 'dev';

function sessionFromUrl(): GameSession {
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed') ?? 5);
  const speed = Number(params.get('speed') ?? 1);
  const autostart = params.get('autostart') !== '0';
  return new GameSession({
    seed: Number.isFinite(seed) ? seed : 5,
    speed: Number.isFinite(speed) && speed > 0 ? speed : 1,
    autostart,
  });
}

// Una sesión por carga de página (sobrevive al doble montaje de StrictMode).
const session = sessionFromUrl();

export function App() {
  const view = useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.getView(),
  );
  const [tab, setTab] = useState<Tab>('estado');

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'estado', label: 'Estado' },
    { id: 'chat', label: 'Chat', badge: view.chat.length },
    { id: 'skills', label: 'Skills', badge: view.skills.length },
    { id: 'experimentos', label: 'Experimentos', badge: view.experiments.length },
    { id: 'dev', label: 'Dev' },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          Ánima <span className="subtitle">mundo {view.seed} · tick {view.tick}</span>
        </h1>
        <span
          className={`story-badge ${view.storyCompleted ? 'done' : ''}`}
          data-testid="story-status"
        >
          {view.storyCompleted ? 'historia completada' : 'aprendiendo…'}
        </span>
        <Controls session={session} view={view} />
      </header>
      <main className="layout">
        <section className="stage">
          <PhaserStage view={view} />
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
            {tab === 'skills' && <SkillsPanel view={view} />}
            {tab === 'experimentos' && <ExperimentsPanel view={view} />}
            {tab === 'dev' && <DevPanel view={view} />}
          </div>
        </aside>
      </main>
    </div>
  );
}
