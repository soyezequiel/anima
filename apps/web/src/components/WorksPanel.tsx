import { ItemIcon } from './ItemIcon.js';
import type { BlueprintView, GameView, ItemIngredientView, ItemView } from '../session/view.js';

/**
 * Las OBRAS que Ánima aprendió a levantar (ADR 0056).
 *
 * Ninguna viene de fábrica: el mundo nace con la lista de planos vacía, así
 * que todo lo que aparece acá lo imaginó ella —o lo heredó de una antecesora
 * que lo imaginó—. Es, literalmente, el catálogo de sus ideas de arquitectura.
 *
 * La forma se DIBUJA porque el plano es la idea: «escuela» no significa nada
 * hasta ver que son cinco muros y un pizarrón puestos así. Y el costo se
 * muestra bajado a materia bruta (ADR 0031), que es la pregunta que de verdad
 * se hace el cuidador: no «cuántos muros» sino «cuántos troncos».
 */

/**
 * Las piezas del plano, cada una una PUERTA (ADR 0056, adenda). Tocar una
 * salta al catálogo de Objetos, abre su ficha y la resalta: de qué está hecha
 * y qué hace se responden donde ya viven esas respuestas, en vez de repetirlas
 * acá a medias.
 *
 * Antes había en su lugar una fila «Sale de» con la materia bruta de la obra
 * entera. Decía el total pero no dejaba preguntar nada: un número sin camino.
 */
function Pieces({
  list,
  byKind,
  testId,
  onInspect,
}: {
  list: ItemIngredientView[];
  byKind: Map<string, ItemView>;
  testId: string;
  onInspect: (kind: string) => void;
}) {
  return (
    <span className="item-ingredients" data-testid={testId}>
      {list.map((piece) => {
        const known = byKind.get(piece.kind);
        return (
          <button
            key={piece.kind}
            type="button"
            className="item-ingredient item-ingredient-link"
            data-testid="work-piece"
            data-kind={piece.kind}
            title={`Ver de qué está hecho: ${known?.name ?? piece.kind}`}
            onClick={() => onInspect(piece.kind)}
          >
            <ItemIcon
              kind={piece.kind}
              traits={known?.traits ?? {}}
              material={known?.material}
              glyph={known?.glyph}
            />
            {piece.label}
            <span className="item-ingredient-arrow" aria-hidden="true">
              ›
            </span>
          </button>
        );
      })}
    </span>
  );
}

/**
 * La silueta del plano, celda por celda, con el mismo ícono que cada bloque
 * tiene en el tablero. La celda del ancla se marca aparte: es donde queda
 * ella, y el hueco que el plano deja libre a propósito para no tapiarse.
 */
function Shape({ work, byKind }: { work: BlueprintView; byKind: Map<string, ItemView> }) {
  const at = new Map(work.cells.map((cell) => [`${cell.x},${cell.y}`, cell.kind]));
  const rows = [];
  for (let y = 0; y < work.height; y++) {
    const cells = [];
    for (let x = 0; x < work.width; x++) {
      const kind = at.get(`${x},${y}`);
      const isAnchor = work.anchor.x === x && work.anchor.y === y;
      const known = kind ? byKind.get(kind) : undefined;
      cells.push(
        <span
          key={x}
          className={`work-cell${kind ? ' work-cell-block' : ''}${isAnchor ? ' work-cell-anchor' : ''}`}
          title={kind ? (known?.name ?? kind) : isAnchor ? 'acá queda ella' : 'vacío'}
        >
          {kind ? (
            <ItemIcon
              kind={kind}
              traits={known?.traits ?? {}}
              material={known?.material}
              glyph={known?.glyph}
            />
          ) : isAnchor ? (
            <span aria-hidden="true">🙂</span>
          ) : null}
        </span>,
      );
    }
    rows.push(
      <div key={y} className="work-row">
        {cells}
      </div>,
    );
  }
  return (
    <div className="work-shape" data-testid="work-shape" aria-hidden="true">
      {rows}
    </div>
  );
}

function WorkCard({
  work,
  byKind,
  onInspect,
}: {
  work: BlueprintView;
  byKind: Map<string, ItemView>;
  onInspect: (kind: string) => void;
}) {
  const blocks = work.cells.length;
  return (
    <li className="item-card work-card" data-testid="work-entry" data-blueprint={work.id}>
      <div className="item-head item-head-plain">
        <span className="item-head-row">
          <strong>{work.label}</strong>
          <span className="pill pill-origin-invented">inventada (IA)</span>
          <span className="muted item-where">
            {blocks} {blocks === 1 ? 'bloque' : 'bloques'} · {work.width}×{work.height}
          </span>
        </span>
      </div>
      <div className="work-body">
        <Shape work={work} byKind={byKind} />
        <dl className="item-stats work-stats">
          <dt>Lleva</dt>
          <dd>
            <Pieces
              list={work.blocks}
              byKind={byKind}
              testId="work-blocks"
              onInspect={onInspect}
            />
            <span className="muted work-hint">tocá una pieza para ver de qué está hecha</span>
          </dd>
        </dl>
      </div>
    </li>
  );
}

export function WorksPanel({
  view,
  onInspect,
}: {
  view: GameView;
  /** Mirar un tipo de cerca: salta al catálogo de Objetos y abre su ficha. */
  onInspect: (kind: string) => void;
}) {
  const byKind = new Map(view.items.map((item) => [item.kind, item]));
  return (
    <div className="works-panel">
      {/* La leyenda del 🙂 no se perdió: cada celda del ancla la lleva en su
          `title` («acá queda ella»), que es donde sirve —al lado del dibujo—
          y no en un párrafo que hay que recordar mientras se mira otra cosa. */}
      {view.blueprints.length === 0 && (
        <p className="muted" data-testid="no-works">
          Todavía no sabe levantar ninguna obra: el mundo empieza sin planos, así que cada una tiene
          que imaginarla. Aparecen cuando le pedís algo demasiado grande para una sola celda —una
          casa, un refugio, una escuela— y ella imagina cómo armarlo por partes.
        </p>
      )}
      <ul className="list">
        {view.blueprints.map((work) => (
          <WorkCard key={work.id} work={work} byKind={byKind} onInspect={onInspect} />
        ))}
      </ul>
    </div>
  );
}
