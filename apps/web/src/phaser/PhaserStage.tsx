import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import type { GameView } from '../session/view.js';
import { CELL, WorldScene } from './WorldScene.js';

/**
 * Monta Phaser dentro de React y le reenvía cada view model. El globo de
 * diálogo se dibuja como overlay HTML para tipografía nítida.
 */
export function PhaserStage({ view }: { view: GameView }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<WorldScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    const scene = new WorldScene();
    sceneRef.current = scene;
    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: view.worldSize.width * CELL,
      height: view.worldSize.height * CELL,
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

  useEffect(() => {
    sceneRef.current?.applyView(view);
  }, [view]);

  const bubble = view.speech && view.pet && (
    <div
      className="speech-bubble"
      data-testid="speech-bubble"
      style={{
        left: view.pet.x * CELL + CELL / 2,
        top: view.pet.y * CELL - 6,
      }}
    >
      {view.speech.text}
    </div>
  );

  return (
    <div className="stage-wrap" style={{ width: view.worldSize.width * CELL }}>
      <div ref={hostRef} />
      {bubble}
    </div>
  );
}
