import { Fragment, useEffect, useRef, useState } from 'react';
import { DND_ITEM_KIND } from '../dnd.js';
import { ItemIcon } from './ItemIcon.js';
import { MaterialTree } from './MaterialTree.js';
import type { Expansion } from './expansion.js';
import type { GameSession } from '../session/GameSession.js';
import type { GameView, ItemIngredientView, ItemView } from '../session/view.js';

/**
 * Catálogo de todos los tipos de objeto del mundo: los que están en el mapa,
 * los que van en la mochila y los que las recetas saben construir. Cada uno
 * lleva su origen a la vista — de fábrica (definido en el código) o inventado
 * (lo construyó un modelo en tiempo de ejecución, ADR 0018 / 0024).
 */

function whereLine(item: ItemView): string {
  const parts: string[] = [];
  if (item.inWorld > 0) parts.push(`${item.inWorld} en el mundo`);
  if (item.inInventory > 0) parts.push(`${item.inInventory} en la mochila`);
  if (item.craftable) parts.push('construible');
  return parts.join(' · ');
}

/**
 * Los ingredientes dibujados, no solo nombrados: el ícono de cada uno sale del
 * catálogo (`byKind`), que es la misma regla con la que se dibujan en el
 * tablero y en la mochila. Un ingrediente que ninguna receta produce y que hoy
 * no existe en el mundo no está en el catálogo — se dibuja igual, con lo que
 * su tipo permita deducir.
 */
function Ingredients({
  list,
  byKind,
  testId,
}: {
  list: ItemIngredientView[];
  byKind: Map<string, ItemView>;
  testId: string;
}) {
  return (
    <span className="item-ingredients" data-testid={testId}>
      {list.map((ingredient) => {
        const known = byKind.get(ingredient.kind);
        return (
          <span key={ingredient.kind} className="item-ingredient">
            <ItemIcon
              kind={ingredient.kind}
              traits={known?.traits ?? {}}
              material={known?.material}
              glyph={known?.glyph}
            />
            {ingredient.label}
          </span>
        );
      })}
    </span>
  );
}

/**
 * El botón de quitar (ADR 0075). No borra: abre la confirmación, que es donde
 * se ve el arrastre. Va en su propia función porque aparece en tres lugares y
 * los tres tienen que verse y sonar igual — la acción destructiva no puede ser
 * un botón distinto según en qué lista estés.
 */
function PruneButton({ onPrune, label }: { onPrune: () => void; label: string }) {
  return (
    <button
      className="prune-button"
      data-testid="prune-button"
      title={label}
      aria-label={label}
      // El clic no tiene que abrir/cerrar la ficha que lo contiene.
      onClick={(e) => {
        e.stopPropagation();
        onPrune();
      }}
    >
      quitar
    </button>
  );
}

function ItemCard({
  item,
  byKind,
  onInspect,
  onPrune,
  expansion,
  focusNonce,
}: {
  item: ItemView;
  byKind: Map<string, ItemView>;
  /** Seguir bajando por el árbol sin salir del catálogo. */
  onInspect?: ((kind: string) => void) | undefined;
  /** Pedir que este tipo salga del mundo. */
  onPrune: (kind: string) => void;
  expansion: Expansion;
  /**
   * Cambia cada vez que alguien pide mirar ESTE objeto de cerca (ADR 0056,
   * adenda). `undefined` = nadie lo pidió. Es un contador y no un booleano
   * para que pedirlo dos veces seguidas vuelva a abrir y a resaltar.
   */
  focusNonce?: number;
}) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLLIElement>(null);
  // Un pedernal no tiene nada que desplegar: es portátil y se acabó. Solo abre
  // lo que de verdad tiene detalle.
  const hasDetail = item.stats.length > 0 || item.baseCost.length > 0 || item.costTruncated;

  // Llegar desde otra pestaña tiene que TERMINAR en la respuesta, no al lado:
  // se abre la ficha, se la trae al centro y se la resalta un momento. Sin
  // esto el salto dejaba al cuidador en una lista larga, buscando a mano el
  // objeto que acababa de tocar.
  useEffect(() => {
    if (focusNonce === undefined) return;
    if (hasDetail) setOpen(true);
    cardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusNonce, hasDetail]);
  const head = (
    <>
      <span className="item-head-row">
        <ItemIcon
          kind={item.kind}
          traits={item.traits}
          material={item.material}
          glyph={item.glyph}
        />
        <strong>{item.name}</strong>
        <span className={`pill pill-origin-${item.origin}`}>
          {item.origin === 'invented' ? 'inventado (IA)' : 'de fábrica'}
        </span>
        <span className="muted item-where">{whereLine(item)}</span>
      </span>
      {item.does.length > 0 && <span className="muted item-does">{item.does.join(' · ')}</span>}
      {/* Con qué se hizo, sin tener que abrir nada: es lo primero que se
          pregunta de un objeto crafteado. */}
      {item.ingredients.length > 0 && (
        <span className="item-recipe">
          <span className="muted">se hace con</span>
          <Ingredients list={item.ingredients} byKind={byKind} testId="item-ingredients" />
        </span>
      )}
    </>
  );
  return (
    <li
      ref={cardRef}
      // La `key` del resaltado va en el className y no en el elemento: cambiar
      // la key remontaría la ficha y perdería el `open` que acabamos de poner.
      className={`item-card item-card-draggable${focusNonce !== undefined ? ' item-card-focused' : ''}`}
      data-testid="item-entry"
      data-kind={item.kind}
      data-origin={item.origin}
      // Arrástralo al tablero para ponerlo en el mundo (lo recibe PhaserStage).
      // El tipo va en el dataTransfer; la celda la resuelve el tablero al soltar.
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_ITEM_KIND, item.kind);
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      {/* El botón de quitar va al lado de la cabecera y no adentro: la
          cabecera ya es un botón cuando hay detalle, y un botón dentro de otro
          no es HTML válido ni se puede alcanzar con el teclado. */}
      <div className="item-head-wrap">
        {hasDetail ? (
          <button className="item-head" onClick={() => setOpen(!open)} aria-expanded={open}>
            {head}
          </button>
        ) : (
          <div className="item-head item-head-plain">{head}</div>
        )}
        <PruneButton label={`Quitar ${item.name} del mundo`} onPrune={() => onPrune(item.kind)} />
      </div>
      {open && (
        <dl className="item-stats" data-testid="item-stats">
          {/* El árbol seguido hasta el suelo (ADR 0031): lo que cuesta de
              verdad si no se tiene ninguna de las partes intermedias. Solo
              aparece cuando hay partes intermedias que seguir. */}
          {item.baseCost.length > 0 && (
            <>
              <dt>Sale de</dt>
              <dd>
                <Ingredients list={item.baseCost} byKind={byKind} testId="item-base-cost" />
              </dd>
            </>
          )}
          {item.costTruncated && (
            <>
              <dt>Ojo</dt>
              <dd>su árbol no toca el suelo: da vueltas o tiene demasiadas capas</dd>
            </>
          )}
          {item.stats.map((stat) => (
            <Fragment key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </Fragment>
          ))}
          {/* Y su árbol, nivel por nivel y a demanda (ADR 0069). Llegar acá
              desde una obra o desde un objetivo y no poder seguir bajando era
              cortar el camino justo donde empieza la pregunta interesante. */}
          {item.ingredients.length > 0 && onInspect && (
            <>
              <dt>De qué sale</dt>
              <dd>
                <MaterialTree
                  kind={item.kind}
                  count={1}
                  byKind={byKind}
                  onInspect={onInspect}
                  expansion={expansion}
                  rootPath={`ficha:${item.kind}`}
                />
              </dd>
            </>
          )}
        </dl>
      )}
    </li>
  );
}

export function ItemsPanel({
  view,
  session,
  focus,
  onInspect,
  expansion,
}: {
  view: GameView;
  session: GameSession;
  /** Saltar a otra ficha desde el árbol: el catálogo se recorre a sí mismo. */
  onInspect?: (kind: string) => void;
  expansion: Expansion;
  /** Qué objeto mirar de cerca, si se llegó acá desde otra pestaña. */
  focus?: { kind: string; nonce: number } | null;
}) {
  const pruneKind = (kind: string) => session.askPrune({ type: 'kind', id: kind });
  const invented = view.items.filter((i) => i.origin === 'invented');
  const builtin = view.items.filter((i) => i.origin === 'builtin');
  // El catálogo se indexa una vez y lo comparten todas las tarjetas: cada
  // ingrediente se dibuja con la misma definición que tiene su propia fila.
  const byKind = new Map(view.items.map((item) => [item.kind, item]));
  return (
    <div className="items-panel">
      <p className="muted">
        Todo lo que este mundo tiene o sabe construir. Lo <em>de fábrica</em> viene definido en el
        código; lo <em>inventado</em> lo construyó la IA en tiempo de ejecución y entró por la
        puerta de validación del mundo. Tocá un objeto para ver sus números.
      </p>
      <h3>Inventados en runtime ({invented.length})</h3>
      {invented.length === 0 && (
        <p className="muted" data-testid="no-invented-items">
          Todavía no hay objetos inventados: aparecen cuando la mascota inventa una receta o el
          cuidador le describe un objeto nuevo.
        </p>
      )}
      <ul className="list">
        {invented.map((item) => (
          <ItemCard
            key={item.kind}
            item={item}
            byKind={byKind}
            onInspect={onInspect}
            onPrune={pruneKind}
            expansion={expansion}
            {...(focus?.kind === item.kind ? { focusNonce: focus.nonce } : {})}
          />
        ))}
      </ul>
      <h3>De fábrica ({builtin.length})</h3>
      <ul className="list">
        {builtin.map((item) => (
          <ItemCard
            key={item.kind}
            item={item}
            byKind={byKind}
            onInspect={onInspect}
            onPrune={pruneKind}
            expansion={expansion}
            {...(focus?.kind === item.kind ? { focusNonce: focus.nonce } : {})}
          />
        ))}
      </ul>
      <h3>Interacciones aprendidas ({view.interactions.length})</h3>
      {view.interactions.length === 0 && (
        <p className="muted" data-testid="no-interactions">
          Todavía no hay interacciones: aparecen cuando la mascota inventa una forma nueva de usar
          un objeto, la física la admite y la IA Dios la aprueba. Una vez aprendida, la reusa sin
          volver a inventarla.
        </p>
      )}
      <ul className="list">
        {view.interactions.map((interaction) => (
          <li
            key={interaction.id}
            className="item-card"
            data-testid="interaction-entry"
            data-interaction={interaction.id}
          >
            <div className="item-head-wrap">
              <div className="item-head item-head-plain">
                <span className="item-head-row">
                  <strong>{interaction.description}</strong>
                  <span className="pill pill-origin-invented">inventada (IA)</span>
                </span>
                <span className="muted item-does">
                  {`postura: ${interaction.stanceLabel} · objetivo: ${interaction.targetLabel}`}
                  {interaction.requiresLabel ? ` · lleva: ${interaction.requiresLabel}` : ''}
                </span>
              </div>
              <PruneButton
                label={`Que se olvide de ${interaction.description}`}
                onPrune={() => session.askPrune({ type: 'interaction', id: interaction.id })}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
