import { useState, useSyncExternalStore } from 'react';
import { PhaserStage } from './phaser/PhaserStage.js';
import type { GameSession } from './session/GameSession.js';
import type { CloudAccount } from './auth/cloud.js';
import { AccountBar } from './components/AccountBar.js';
import { AiBar } from './components/AiBar.js';
import { ChatPanel } from './components/ChatPanel.js';
import { Controls } from './components/Controls.js';
import { DeathOverlay } from './components/DeathOverlay.js';
import { DevPanel } from './components/DevPanel.js';
import { ExperimentsPanel } from './components/ExperimentsPanel.js';
import { SkillsPanel } from './components/SkillsPanel.js';
import { StatusPanel } from './components/StatusPanel.js';

type Tab = 'estado' | 'chat' | 'skills' | 'experimentos' | 'dev';

export function App({
  session,
  account,
}: {
  session: GameSession;
  account: CloudAccount | null;
}) {
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
          {view.identity.name}{' '}
          <span className="gen-badge" data-testid="generation">
            gen {view.identity.generation}
          </span>{' '}
          <span className="subtitle">mundo {view.seed} · tick {view.tick}</span>
        </h1>
        <span
          className={`story-badge ${view.storyCompleted ? 'done' : ''}`}
          data-testid="story-status"
        >
          {view.storyCompleted ? 'historia completada' : 'aprendiendo…'}
        </span>
        <Controls session={session} view={view} />
        <AiBar view={view} />
        <AccountBar account={account} />
      </header>
      <main className="layout">
        <section className="stage">
          <PhaserStage view={view} />
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
            {tab === 'skills' && <SkillsPanel view={view} />}
            {tab === 'experimentos' && <ExperimentsPanel view={view} />}
            {tab === 'dev' && <DevPanel view={view} session={session} />}
          </div>
        </aside>
      </main>
    </div>
  );
}
