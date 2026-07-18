import { ItemIcon } from './ItemIcon.js';
import type { Expansion } from './expansion.js';
import type { ItemView } from '../session/view.js';

/**
 * El árbol de un material, por niveles y A DEMANDA (ADR 0069).
 *
 * Nivel 0 es lo que la obra pide; nivel 1, con qué se hace eso; nivel 2, con
 * qué se hace aquello, y así. La cadena no tiene final garantizado —una receta
 * puede apoyarse en otra indefinidamente, y hasta dar vueltas— así que el árbol
 * **no se calcula entero**: cada rama se abre cuando alguien la abre. Lo que se
 * dibuja es siempre lo que se está mirando.
 *
 * No hace falta ningún dato nuevo: cada objeto del catálogo ya trae sus
 * ingredientes directos, y encadenarlos ES el árbol.
 */

/** Cuántos ancestros se muestran antes de cortar. Ver `MaterialNode`. */
export const MAX_LEVELS = 12;

/** Un nodo del árbol, ya resuelto: cuánto hace falta y si se puede seguir. */
export interface MaterialNodeInfo {
  kind: string;
  /** Cuánto hace falta A ESTA ALTURA, ya multiplicado por toda la rama. */
  count: number;
  /** No se hace con nada: el árbol tocó el suelo. */
  raw: boolean;
  /** Su receta vuelve sobre sí misma: seguir sería no terminar nunca. */
  circular: boolean;
}

/**
 * Los hijos de un material: sus ingredientes con la cuenta ya multiplicada.
 *
 * Es la única cuenta del árbol y por eso vive aparte: si hacen falta 3
 * encimeras y cada una lleva 2 tablas, el nivel de abajo son SEIS tablas, no
 * dos. Sin multiplicar, el árbol muestra la receta de UNA y el cuidador junta
 * de menos.
 */
export function materialChildren(
  kind: string,
  count: number,
  byKind: Map<string, ItemView>,
  ancestors: readonly string[] = [],
): MaterialNodeInfo[] {
  const chain = [...ancestors, kind];
  return (byKind.get(kind)?.ingredients ?? []).map((ingredient) => ({
    kind: ingredient.kind,
    count: ingredient.count * count,
    raw: (byKind.get(ingredient.kind)?.ingredients.length ?? 0) === 0,
    circular: chain.includes(ingredient.kind),
  }));
}

function MaterialNode({
  kind,
  count,
  byKind,
  onInspect,
  level,
  ancestors,
  expansion,
}: {
  kind: string;
  /** Cuántos hacen falta EN TOTAL a esta altura, ya multiplicado por el padre. */
  count: number;
  byKind: Map<string, ItemView>;
  onInspect: (kind: string) => void;
  level: number;
  /** La rama por la que se llegó: es lo que permite cortar los círculos. */
  ancestors: readonly string[];
  expansion: Expansion;
}) {
  // La RAMA entera identifica al nodo, no el tipo: el mismo material puede
  // aparecer colgando de dos sitios distintos y abrir uno no abre el otro.
  const path = [...ancestors, kind].join('>');
  const open = expansion.isOpen(path);
  const item = byKind.get(kind);
  const ingredients = materialChildren(kind, count, byKind, ancestors);
  // Un tipo que ya está en su propia rama se repetiría para siempre: la receta
  // da vueltas (ADR 0031 lo admite) y el árbol no tocaría nunca el suelo.
  const circular = ancestors.includes(kind);
  const deep = level >= MAX_LEVELS;
  const expandable = ingredients.length > 0 && !circular && !deep;

  return (
    <li className="mat-node" data-testid="material-node" data-kind={kind} data-level={level}>
      <div className="mat-row">
        <button
          type="button"
          className={`mat-toggle${expandable ? '' : ' mat-toggle-leaf'}`}
          onClick={() => expandable && expansion.toggle(path)}
          aria-expanded={expandable ? open : undefined}
          disabled={!expandable}
          aria-label={expandable ? (open ? 'plegar' : 'desplegar') : undefined}
          title={
            circular
              ? 'su receta vuelve sobre sí misma'
              : ingredients.length === 0
                ? 'materia prima: no se hace con nada'
                : undefined
          }
        >
          {expandable ? (open ? '▾' : '▸') : circular ? '↻' : '·'}
        </button>
        {/* El nombre lleva al catálogo: de qué está hecho, qué hace y sus
            números ya viven allá, y llevar es mejor que repetir (ADR 0056). */}
        <button
          type="button"
          className="mat-name"
          data-testid="material-link"
          data-kind={kind}
          onClick={() => onInspect(kind)}
          title={`Ver ${item?.name ?? kind} en Objetos`}
        >
          <ItemIcon
            kind={kind}
            traits={item?.traits ?? {}}
            material={item?.material}
            glyph={item?.glyph}
          />
          <span className="mat-count">{count}×</span>
          <span>{item?.name ?? kind}</span>
        </button>
        {ingredients.length === 0 && <span className="mat-tag muted">materia prima</span>}
        {circular && <span className="mat-tag muted">vuelve sobre sí misma</span>}
        {deep && ingredients.length > 0 && <span className="mat-tag muted">sigue más abajo</span>}
      </div>
      {open && (
        <ul className="mat-children">
          {ingredients.map((ing) => (
            <MaterialNode
              key={ing.kind}
              kind={ing.kind}
              count={ing.count}
              byKind={byKind}
              onInspect={onInspect}
              level={level + 1}
              ancestors={[...ancestors, kind]}
              expansion={expansion}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function MaterialTree({
  kind,
  count,
  byKind,
  onInspect,
  expansion,
  rootPath = '',
}: {
  kind: string;
  count: number;
  byKind: Map<string, ItemView>;
  onInspect: (kind: string) => void;
  expansion: Expansion;
  /** Prefijo para que dos árboles del mismo material no compartan estado. */
  rootPath?: string;
}) {
  return (
    <ul className="mat-tree" data-testid="material-tree" data-root={kind}>
      <MaterialNode
        kind={kind}
        count={count}
        byKind={byKind}
        onInspect={onInspect}
        level={0}
        ancestors={rootPath ? [rootPath] : []}
        expansion={expansion}
      />
    </ul>
  );
}
