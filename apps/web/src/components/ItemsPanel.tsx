import type { GameView, ItemView } from '../session/view.js';

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

function ItemCard({ item }: { item: ItemView }) {
  return (
    <li className="item-card" data-testid="item-entry" data-origin={item.origin}>
      <div className="item-head">
        <strong>{item.name}</strong>
        <span className={`pill pill-origin-${item.origin}`}>
          {item.origin === 'invented' ? 'inventado (IA)' : 'de fábrica'}
        </span>
        <span className="muted item-where">{whereLine(item)}</span>
      </div>
      {item.does.length > 0 && <div className="muted item-does">{item.does.join(' · ')}</div>}
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
        puerta de validación del mundo.
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
