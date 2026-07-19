import { ItemIcon } from './ItemIcon.js';
import { MaterialTree } from './MaterialTree.js';
import type { Expansion } from './expansion.js';
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
 * El motor guarda el encargo como «petición del usuario: crea una cocina»
 * porque ahí adentro el prefijo ES el dato que distingue un encargo de un
 * impulso propio (y hay tests que buscan el objetivo por ese nombre exacto).
 * En pantalla, en cambio, al lado ya hay un «se lo pediste» diciendo lo mismo:
 * el título se queda con el encargo y la procedencia se dice una sola vez.
 */
function goalTitle(description: string): string {
  return description.replace(/^petición del usuario:\s*/i, '');
}

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

function Need({
  need,
  byKind,
  onInspect,
  expansion,
  scope,
  ofTotal = false,
}: {
  need: GoalNeedView;
  byKind: Map<string, ItemView>;
  /** Llevar al catálogo: la ficha del objeto responde mejor que un resumen. */
  onInspect: (kind: string) => void;
  expansion: Expansion;
  /** De qué objetivo cuelga: dos objetivos que piden lo mismo no se pisan. */
  scope: string;
  /**
   * Decir "0/4" en vez de "1×". Dentro de un paso el total ya está escrito en
   * su título ("conseguir 4× pared escuela"), y un chip que dice "1×" al lado
   * parecía contradecirlo: son cosas distintas —lo que falta y lo que pide—
   * pero nada lo decía. La forma larga («falta 1 de 4») decía lo mismo tres
   * veces contando el título; lleva/pide lo dice una sola y agrega el único
   * número que el título NO tiene: cuánto juntó ya.
   */
  ofTotal?: boolean;
}) {
  const treeId = `arbol:${scope}:${need.kind}`;
  const openTree = expansion.isOpen(treeId);
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
      {ofTotal ? (
        <span className="goal-need-count">
          {need.have}/{need.need}
        </span>
      ) : (
        <>
          <span className="goal-need-count">{need.short}×</span>
          <span className="goal-need-label">{need.label}</span>
        </>
      )}
      <span className="goal-need-hint muted">{hint.text}</span>
      {/* De qué está hecho, hasta la materia prima (ADR 0069). Se abre acá y no
          se muestra siempre: la respuesta a «por qué no lo consigue» suele
          estar dos niveles más abajo, pero mostrarla entera de entrada sería
          tapar la lista con un árbol que casi nunca se mira.

          La flecha va sola, con la frase en el título: escrita entera se
          repetía en cada chip y pesaba más que la materia que anuncia — y es
          la misma flecha con la que se abre cada rama del árbol que despliega,
          así que el gesto ya se aprende una sola vez. */}
      {byKind.get(need.kind)?.ingredients.length ? (
        <button
          type="button"
          className="need-tree-toggle"
          data-testid="need-tree-toggle"
          data-kind={need.kind}
          aria-expanded={openTree}
          onClick={() => expansion.toggle(treeId)}
          title="Ver de qué está hecho"
          aria-label="Ver de qué está hecho"
        >
          {openTree ? '▾' : '▸'}
        </button>
      ) : null}
      {openTree && (
        <MaterialTree
          kind={need.kind}
          count={need.short}
          byKind={byKind}
          onInspect={onInspect}
          expansion={expansion}
          rootPath={scope}
        />
      )}
    </li>
  );
}

/**
 * Un paso del objetivo (sub-objetivo, ADR 0053): fila chica con tilde cuando
 * está cumplido y la cuenta viva de su materia cuando es un paso de juntar.
 * Comparte los estados del padre porque ES un objetivo de verdad — solo que
 * vive dentro de su tarjeta, no en la fila.
 */
function StepRow({
  step,
  byKind,
  onInspect,
  expansion,
}: {
  step: GoalView;
  byKind: Map<string, ItemView>;
  onInspect: (kind: string) => void;
  expansion: Expansion;
}) {
  const done = step.status === 'completed';
  const failed = step.status === 'failed';
  return (
    <li
      className={`goal-step${done ? ' goal-step-done' : ''}${failed ? ' goal-step-failed' : ''}`}
      data-testid="goal-step"
      data-status={step.status}
    >
      <span className="goal-step-mark" aria-hidden="true">
        {done ? '✓' : failed ? '✕' : '○'}
      </span>
      {/* Título y materia en UNA columna: así el chip cuelga debajo del texto
          del paso, alineado con él, y se lee como suyo. Suelto al mismo margen
          que la viñeta parecía un paso hermano más. */}
      <div className="goal-step-body">
        <span className="goal-step-desc">{step.description}</span>
        {!done && step.needs.length > 0 && (
          <ul className="goal-needs goal-step-needs">
            {step.needs.map((need) => (
              <Need
                key={need.kind}
                need={need}
                byKind={byKind}
                onInspect={onInspect}
                expansion={expansion}
                scope={step.id}
                ofTotal
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * La tarjeta de un objetivo. Se exporta porque la barra de arriba muestra
 * EXACTAMENTE esta (ADR 0069): antes tenía su propio resumen —descripción y
 * poco más— y el cuidador veía dos versiones distintas del mismo objetivo
 * según dónde mirara. Una sola tarjeta, un solo relato.
 */
export function GoalCard({
  goal,
  current,
  byKind,
  onInspect,
  expansion,
  framed = false,
}: {
  goal: GoalView;
  current: boolean;
  byKind: Map<string, ItemView>;
  onInspect: (kind: string) => void;
  expansion: Expansion;
  /**
   * La tarjeta ya vive dentro de algo que dice que es la actual —el marco
   * «Ahora» del encabezado—. Entonces «lo que hace ahora» es el mismo dato
   * escrito dos veces a tres centímetros de distancia. En la pestaña de
   * Objetivos, en cambio, es lo único que distingue esta tarjeta de las otras
   * cinco de la lista, y ahí sí se escribe.
   */
  framed?: boolean;
}) {
  const structure = goal.structure;
  const steps = goal.children;
  const stepsDone = steps.filter((s) => s.status === 'completed').length;
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
        <strong className="goal-desc">{goalTitle(goal.description)}</strong>
        <span className={`pill pill-${goal.status}`}>
          {STATUS_LABEL[goal.status] ?? goal.status}
        </span>
      </div>

      {/* De dónde salió y cuánto lleva, en UNA línea.
          Eran tres renglones apilados —procedencia, puestos de la obra, cuenta
          de pasos— cada uno con su propio rótulo, y ninguno decía nada que el
          de al lado no pudiera decir en la misma línea. Peor: dos avances
          distintos escritos como dos titulares competían por ser EL avance.
          Juntos y separados por puntos se leen como lo que son, la ficha del
          objetivo; y la barra —que es el avance de verdad— queda sola. */}
      <div className="goal-meta muted" data-testid="goal-progress">
        {[
          current && !framed ? 'lo que hace ahora' : null,
          SOURCE_LABEL[goal.source] ?? goal.source,
          structure ? `${structure.label} ${structure.placed}/${structure.total} puestos` : null,
          steps.length > 0 ? `${stepsDone}/${steps.length} pasos` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </div>

      {/* Una obra tiene avance aunque no le falte nada: cuántos bloques
          levantó de cuántos. Sin esto, "en marcha" durante cien ticks se ve
          igual que estar trabada. */}
      {structure && (
        <div className="goal-progress-bar" aria-hidden="true">
          <span style={{ width: `${(structure.placed / Math.max(1, structure.total)) * 100}%` }} />
        </div>
      )}

      {/* Cuando descompuso el encargo en pasos, los pasos son la historia: cada
          uno lleva su propia cuenta de materia. Repetir los chips en el padre
          sería contar lo mismo dos veces en la misma tarjeta. El rótulo «sus
          pasos» se fue con ellos: una lista de viñetas debajo de un objetivo
          no necesita que le avisen que son sus pasos, y su cuenta ya está
          arriba con el resto de la ficha. */}
      {steps.length > 0 && (
        <ul className="goal-steps" data-testid="goal-steps">
            {steps.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                byKind={byKind}
                onInspect={onInspect}
                expansion={expansion}
            />
          ))}
        </ul>
      )}

      {steps.length === 0 && goal.needs.length > 0 && (
        <>
          <div className="goal-needs-title muted">le falta conseguir</div>
          <ul className="goal-needs list" data-testid="goal-needs">
            {goal.needs.map((need) => (
              <Need
                key={need.kind}
                need={need}
                byKind={byKind}
                onInspect={onInspect}
                expansion={expansion}
                scope={goal.id}
              />
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

export function GoalsPanel({
  view,
  onInspect,
  expansion,
}: {
  view: GameView;
  onInspect: (kind: string) => void;
  expansion: Expansion;
}) {
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
          <GoalCard
            key={goal.id}
            goal={goal}
            current={goal.id === currentId}
            byKind={byKind}
            onInspect={onInspect}
            expansion={expansion}
          />
        ))}
      </ul>

      {finished.length > 0 && (
        <details className="status-details">
          <summary>
            {finished.length} {finished.length === 1 ? 'terminado' : 'terminados'}
          </summary>
          <ul className="list goals-list" data-testid="goal-list-finished">
            {finished.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                current={false}
                byKind={byKind}
                onInspect={onInspect}
                expansion={expansion}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
