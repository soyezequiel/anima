import { ItemIcon } from './ItemIcon.js';
import type { GameView, GoalNeedView, GoalView, ItemView } from '../session/view.js';

/**
 * Todo lo que quiere hacer, en el orden en que compite (ADR 0052), y —cuando
 * necesita material— QUÉ le falta, dibujado.
 *
 * Antes esto era media docena de líneas dentro de Estado: solo el estado y la
 * frase del objetivo. El cuidador veía «esperando material» y no tenía forma de
 * saber cuál, cuánto, ni si podía ir a buscarlo sola. Ahora la pantalla dice lo
 * mismo que el agente calcula para suspenderse y retomar: es la misma cuenta,
 * no una segunda opinión.
 */

const STATUS_LABEL: Record<string, string> = {
  active: 'en marcha',
  suspended: 'esperando',
  completed: 'hecho',
  failed: 'no pudo',
};

const SOURCE_LABEL: Record<string, string> = {
  'internal-signal': 'su cuerpo',
  curiosity: 'curiosidad',
  danger: 'peligro',
  'user-request': 'se lo pediste',
  promise: 'lo prometió',
  contradiction: 'algo no cerraba',
  learning: 'aprender',
};

/**
 * De dónde puede salir lo que falta. La diferencia entre las tres es
 * exactamente la diferencia entre «ya va sola» y «necesita que la ayudes»: es
 * lo único accionable de toda la tarjeta.
 */
function needHint(need: GoalNeedView): { text: string; tone: 'ready' | 'harvest' | 'absent' } {
  if (need.visible) return { text: 'a la vista', tone: 'ready' };
  if (need.fromLabel) return { text: `sale de ${need.fromLabel}`, tone: 'harvest' };
  return { text: 'no lo ve', tone: 'absent' };
}

function Need({ need, byKind }: { need: GoalNeedView; byKind: Map<string, ItemView> }) {
  const known = byKind.get(need.kind);
  const hint = needHint(need);
  return (
    <li
      className={`goal-need goal-need-${hint.tone}`}
      data-testid="goal-need"
      data-kind={need.kind}
      title={`necesita ${need.need}, lleva ${need.have}`}
    >
      <ItemIcon
        kind={need.kind}
        traits={known?.traits ?? {}}
        material={known?.material}
        glyph={known?.glyph}
      />
      <span className="goal-need-count">{need.short}×</span>
      <span className="goal-need-label">{need.label}</span>
      <span className="goal-need-hint muted">{hint.text}</span>
    </li>
  );
}

function GoalCard({
  goal,
  current,
  byKind,
}: {
  goal: GoalView;
  current: boolean;
  byKind: Map<string, ItemView>;
}) {
  const structure = goal.structure;
  return (
    <li
      className={current ? 'goal-card goal-card-current' : 'goal-card'}
      data-testid="goal-card"
      data-goal={goal.id}
      data-status={goal.status}
    >
      <div className="goal-head">
        {/* El puesto en la fila, no el orden de creación: es el número con el
            que de verdad eligió a cuál atender. */}
        {goal.rank !== null && (
          <span className="goal-rank" title={`prioridad ${goal.score}`}>
            {goal.rank}
          </span>
        )}
        <strong className="goal-desc">{goal.description}</strong>
        <span className={`pill pill-${goal.status}`}>
          {STATUS_LABEL[goal.status] ?? goal.status}
        </span>
      </div>
      <div className="goal-sub muted">
        {current ? 'lo que hace ahora · ' : ''}
        {SOURCE_LABEL[goal.source] ?? goal.source}
      </div>

      {/* Una obra tiene avance aunque no le falte nada: cuántos bloques
          levantó de cuántos. Sin esto, "en marcha" durante cien ticks se ve
          igual que estar trabada. */}
      {structure && (
        <div className="goal-progress" data-testid="goal-progress">
          <div className="goal-progress-bar" aria-hidden="true">
            <span style={{ width: `${(structure.placed / Math.max(1, structure.total)) * 100}%` }} />
          </div>
          <span className="muted">
            {structure.label}: {structure.placed} de {structure.total} puestos
          </span>
        </div>
      )}

      {goal.needs.length > 0 && (
        <>
          <div className="goal-needs-title muted">le falta conseguir</div>
          <ul className="goal-needs list" data-testid="goal-needs">
            {goal.needs.map((need) => (
              <Need key={need.kind} need={need} byKind={byKind} />
            ))}
          </ul>
        </>
      )}

      {goal.status === 'suspended' && goal.suspendedReason && (
        <div className="goal-waiting muted" data-testid="goal-waiting">
          quedó esperando: {goal.suspendedReason}
        </div>
      )}
    </li>
  );
}

export function GoalsPanel({ view }: { view: GameView }) {
  // El catálogo se indexa una vez y lo comparten todas las tarjetas: un tronco
  // se dibuja igual acá que en la mochila y que en el tablero.
  const byKind = new Map(view.items.map((item) => [item.kind, item]));
  const currentId = view.currentGoal?.id ?? null;
  // Suspendido es ABIERTO: son justo los que esperan material, o sea los que el
  // cuidador puede destrabar. Contarlos como terminados —lo que hacía el panel
  // viejo— escondía exactamente lo que hay que mirar.
  const open = view.goals.filter((g) => g.status === 'active' || g.status === 'suspended');
  const finished = view.goals.filter((g) => g.status === 'completed' || g.status === 'failed');

  return (
    <div className="goals-panel">
      <p className="muted">
        Todo lo que quiere hacer, en el orden en que compite: el número es su puesto en la fila.
        Cuando necesita material, acá se ve cuál y cuánto — y si puede ir sola a buscarlo.
      </p>

      <h3>Abiertos ({open.length})</h3>
      {open.length === 0 && (
        <p className="muted" data-testid="no-open-goals">
          Ahora mismo no persigue nada: está mirando el mundo.
        </p>
      )}
      <ul className="list goals-list" data-testid="goal-list">
        {open.map((goal) => (
          <GoalCard key={goal.id} goal={goal} current={goal.id === currentId} byKind={byKind} />
        ))}
      </ul>

      {finished.length > 0 && (
        <details className="status-details">
          <summary>
            {finished.length} {finished.length === 1 ? 'terminado' : 'terminados'}
          </summary>
          <ul className="list goals-list" data-testid="goal-list-finished">
            {finished.map((goal) => (
              <GoalCard key={goal.id} goal={goal} current={false} byKind={byKind} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
