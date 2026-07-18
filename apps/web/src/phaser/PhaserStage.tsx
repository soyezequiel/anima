import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import type { GameView } from '../session/view.js';
import { DND_ITEM_KIND } from '../dnd.js';
import { KIND_EMOJI } from './appearance.js';
import { BASE_CELL, WorldScene } from './WorldScene.js';

/** Por debajo de esto el mundo deja de leerse: preferimos recortar antes que encoger más. */
const MIN_CELL = 24;

/**
 * Monta Phaser dentro de React y le reenvía cada view model. El tablero se
 * ajusta al hueco libre: la celda sale de lo que la pantalla permita, no de una
 * constante. El globo de diálogo se dibuja como overlay HTML para tipografía
 * nítida.
 */
export function PhaserStage({
  view,
  onDropItem,
}: {
  view: GameView;
  /** Soltar un tipo del catálogo sobre el tablero lo pone en esa celda. */
  onDropItem?: (kind: string, at: { x: number; y: number }) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<WorldScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [cell, setCell] = useState(BASE_CELL);
  // La celda bajo el cursor mientras se arrastra un item: se resalta para que
  // el jugador vea dónde va a caer antes de soltar. null cuando no hay arrastre.
  const [dropCell, setDropCell] = useState<{ x: number; y: number } | null>(null);

  const cols = view.worldSize.width;
  const rows = view.worldSize.height;

  // La celda bajo el puntero, en coordenadas de mundo; null si cae fuera del
  // tablero. Se mide contra el propio `.stage-board`, que tiene el tamaño exacto
  // cols*cell × rows*cell, así el redondeo coincide con lo que dibuja Phaser.
  const cellFromEvent = (e: DragEvent<HTMLDivElement>): { x: number; y: number } | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cell);
    const y = Math.floor((e.clientY - rect.top) / cell);
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
    return { x, y };
  };

  const isItemDrag = (e: DragEvent<HTMLDivElement>) => e.dataTransfer.types.includes(DND_ITEM_KIND);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!onDropItem || !isItemDrag(e)) return;
    // preventDefault en dragover es lo que habilita el drop (contrato del DnD).
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropCell(cellFromEvent(e));
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!onDropItem || !isItemDrag(e)) return;
    e.preventDefault();
    const at = cellFromEvent(e);
    const kind = e.dataTransfer.getData(DND_ITEM_KIND);
    setDropCell(null);
    if (at && kind) onDropItem(kind, at);
  };

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    const scene = new WorldScene();
    sceneRef.current = scene;
    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: cols * BASE_CELL,
      height: rows * BASE_CELL,
      backgroundColor: '#14532d',
      scene: [scene],
      banner: false,
    });
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
    // El tamaño del mundo no cambia durante una sesión: montaje único.
  }, []);

  // La celda más grande que entra sin deformar el mundo. El suelo garantiza que
  // el tablero nunca desborde la caja que lo mide, así que no hay realimentación.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      setCell(Math.max(MIN_CELL, Math.floor(Math.min(width / cols, height / rows))));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [cols, rows]);

  useEffect(() => {
    gameRef.current?.scale.resize(cols * cell, rows * cell);
    sceneRef.current?.setCell(cell);
  }, [cell, cols, rows]);

  useEffect(() => {
    sceneRef.current?.applyView(view);
  }, [view]);

  const bubble = !view.aiBusy && view.speech && view.pet && (
    <div
      className="speech-bubble"
      data-testid="speech-bubble"
      style={{
        left: view.pet.x * cell + cell / 2,
        top: view.pet.y * cell - 6,
      }}
    >
      {view.speech.text}
    </div>
  );

  const thinkingBubble = view.aiBusy && view.pet && (
    <div
      className="thinking-bubble"
      data-testid="stage-thinking"
      role="status"
      aria-live="polite"
      style={{
        left: view.pet.x * cell + cell / 2,
        top: view.pet.y * cell - 6,
      }}
    >
      <span>pensando</span>
      <span className="thinking-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );

  // Nombra lo recogido mientras el objeto aún viaja por el tablero. La `key`
  // ata el elemento a esa recogida concreta: dos seguidas reinician la animación
  // en vez de reutilizar un cartel a medio camino.
  const pickupFlash = view.pickup && view.pet && (
    <div
      key={`${view.pickup.itemId}:${view.pickup.tick}`}
      className="pickup-flash"
      data-testid="pickup-flash"
      role="status"
      aria-live="polite"
      style={{
        left: view.pet.x * cell + cell / 2,
        top: view.pet.y * cell - 4,
      }}
    >
      <span aria-hidden="true">+{KIND_EMOJI[view.pickup.kind] ?? '📦'}</span>
      <span className="pickup-flash-kind">{view.pickup.kind}</span>
    </div>
  );

  const dropHint = dropCell && (
    <div
      className="drop-cell"
      data-testid="drop-cell"
      style={{
        left: dropCell.x * cell,
        top: dropCell.y * cell,
        width: cell,
        height: cell,
      }}
    />
  );

  return (
    <div className="stage-wrap" ref={boxRef}>
      <div
        className="stage-board"
        style={{ width: cols * cell, height: rows * cell }}
        onDragOver={handleDragOver}
        onDragLeave={() => setDropCell(null)}
        onDrop={handleDrop}
      >
        <div ref={hostRef} />
        {bubble}
        {thinkingBubble}
        {pickupFlash}
        {dropHint}
      </div>
    </div>
  );
}
