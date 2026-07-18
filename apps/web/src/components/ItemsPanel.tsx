import { Fragment, useState } from 'react';
import { DND_ITEM_KIND } from '../dnd.js';
import { ItemIcon } from './ItemIcon.js';
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

function ItemCard({ item, byKind }: { item: ItemView; byKind: Map<string, ItemView> }) {
  const [open, setOpen] = useState(false);
  // Un pedernal no tiene nada que desplegar: es portátil y se acabó. Solo abre
  // lo que de verdad tiene detalle.
  const hasDetail = item.stats.length > 0 || item.baseCost.length > 0 || item.costTruncated;
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
      className="item-card item-card-draggable"
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
      {hasDetail ? (
        <button className="item-head" onClick={() => setOpen(!open)} aria-expanded={open}>
          {head}
        </button>
      ) : (
        <div className="item-head item-head-plain">{head}</div>
      )}
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
        </dl>
      )}
    </li>
  );
}

export function ItemsPanel({ view }: { view: GameView }) {
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
          <ItemCard key={item.kind} item={item} byKind={byKind} />
        ))}
      </ul>
      <h3>De fábrica ({builtin.length})</h3>
      <ul className="list">
        {builtin.map((item) => (
          <ItemCard key={item.kind} item={item} byKind={byKind} />
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
          </li>
        ))}
      </ul>
    </div>
  );
}
