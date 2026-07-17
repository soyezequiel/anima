import { Fragment, useState } from 'react';
import { appearanceFor, hexColor } from '../phaser/appearance.js';
import type { GameView, ItemView } from '../session/view.js';

/**
 * Catálogo de todos los tipos de objeto del mundo: los que están en el mapa,
 * los que van en la mochila y los que las recetas saben construir. Cada uno
 * lleva su origen a la vista — de fábrica (definido en el código) o inventado
 * (lo construyó un modelo en tiempo de ejecución, ADR 0018 / 0024).
 */

/**
 * El mismo dibujo que el tablero, por la misma regla (appearance.ts): una cosa
 * no puede verse de dos maneras según dónde la mires. Acá el bloque ámbar no
 * necesita rótulo — el nombre ya está al lado.
 */
function ItemIcon({ item }: { item: ItemView }) {
  const look = appearanceFor(item.kind, item.traits);
  if (look.as === 'emoji') {
    return (
      <span className="item-icon" aria-hidden="true">
        {look.emoji}
      </span>
    );
  }
  return (
    <span
      className="item-icon item-icon-block"
      aria-hidden="true"
      style={{ background: hexColor(look.fill), borderColor: hexColor(look.stroke) }}
    />
  );
}

function whereLine(item: ItemView): string {
  const parts: string[] = [];
  if (item.inWorld > 0) parts.push(`${item.inWorld} en el mundo`);
  if (item.inInventory > 0) parts.push(`${item.inInventory} en la mochila`);
  if (item.craftable) parts.push('construible');
  return parts.join(' · ');
}

function ItemCard({ item }: { item: ItemView }) {
  const [open, setOpen] = useState(false);
  // Un pedernal no tiene nada que desplegar: es portátil y se acabó. Solo abre
  // lo que de verdad tiene detalle.
  const hasDetail = item.stats.length > 0 || item.ingredients.length > 0;
  const head = (
    <>
      <span className="item-head-row">
        <ItemIcon item={item} />
        <strong>{item.name}</strong>
        <span className={`pill pill-origin-${item.origin}`}>
          {item.origin === 'invented' ? 'inventado (IA)' : 'de fábrica'}
        </span>
        <span className="muted item-where">{whereLine(item)}</span>
      </span>
      {item.does.length > 0 && <span className="muted item-does">{item.does.join(' · ')}</span>}
    </>
  );
  return (
    <li className="item-card" data-testid="item-entry" data-kind={item.kind} data-origin={item.origin}>
      {hasDetail ? (
        <button className="item-head" onClick={() => setOpen(!open)} aria-expanded={open}>
          {head}
        </button>
      ) : (
        <div className="item-head item-head-plain">{head}</div>
      )}
      {open && (
        <dl className="item-stats" data-testid="item-stats">
          {item.ingredients.length > 0 && (
            <>
              <dt>Cuesta</dt>
              <dd>{item.ingredients.join(' + ')}</dd>
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
          <ItemCard key={item.kind} item={item} />
        ))}
      </ul>
      <h3>De fábrica ({builtin.length})</h3>
      <ul className="list">
        {builtin.map((item) => (
          <ItemCard key={item.kind} item={item} />
        ))}
      </ul>
    </div>
  );
}
