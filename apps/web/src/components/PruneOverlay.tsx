import type { PrunePreview } from '../session/view.js';

/**
 * La confirmación de una poda (ADR 0075). Muestra el arrastre completo antes
 * de tocar nada: el cuidador aprueba una lista, no un botón.
 *
 * Es deliberadamente incómoda de aceptar sin leer — el título dice qué se
 * pidió y debajo va, agrupado, todo lo que se cae con eso. Cuando no arrastra
 * nada lo dice con todas las letras, que es la mitad de las veces y también es
 * información: saber que quitar algo NO va a romper el resto es justo lo que
 * hace falta para animarse a limpiar.
 */
function groupsOf(preview: PrunePreview): Array<{ group: string; labels: string[] }> {
  const groups: Array<{ group: string; labels: string[] }> = [];
  for (const line of preview.lines) {
    const found = groups.find((g) => g.group === line.group);
    if (found) found.labels.push(line.label);
    else groups.push({ group: line.group, labels: [line.label] });
  }
  return groups;
}

export function PruneOverlay({
  preview,
  onConfirm,
  onCancel,
}: {
  preview: PrunePreview;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const groups = groupsOf(preview);
  return (
    <div
      className="prune-overlay"
      data-testid="prune-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar que se quita"
      // Cancelar tiene que ser lo fácil: Escape y clic afuera alcanzan. La
      // acción destructiva pide el botón, y el botón pide haber leído.
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="prune-card">
        <h2>
          Quitar <em>{preview.title}</em>
        </h2>

        {preview.blocked !== null ? (
          <>
            <p className="prune-blocked" data-testid="prune-blocked">
              No se puede: {preview.blocked}.
            </p>
            <div className="death-actions">
              <button onClick={onCancel} data-testid="prune-cancel" autoFocus>
                Entendido
              </button>
            </div>
          </>
        ) : (
          <>
            {groups.length === 0 ? (
              <p className="muted" data-testid="prune-no-cascade">
                No se lleva puesto nada más: nada de lo que este mundo sabe se apoya en eso.
              </p>
            ) : (
              <>
                <p className="muted">Esto también se va, porque se apoyaba en eso:</p>
                <dl className="prune-groups" data-testid="prune-cascade">
                  {groups.map((group) => (
                    <div key={group.group} className="prune-group">
                      <dt>{group.group}</dt>
                      <dd>
                        <ul className="prune-list">
                          {group.labels.map((label) => (
                            <li key={label}>{label}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <p className="muted prune-warning">No se puede deshacer.</p>
            <div className="death-actions">
              <button onClick={onCancel} data-testid="prune-cancel" autoFocus>
                Dejarlo como está
              </button>
              <button className="danger" onClick={onConfirm} data-testid="prune-confirm">
                Quitar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
