import Phaser from 'phaser';
import type { GameView } from '../session/view.js';

export const CELL = 64;

const KIND_EMOJI: Record<string, string> = {
  food: '🍎',
  branch: '🪵',
  hammer: '🔨',
  tree: '🌳',
};

/**
 * Escena de renderizado puro: dibuja el view model y anima diferencias.
 * No contiene ninguna regla del mundo — si algo se mueve, rompe o desaparece,
 * es porque el motor lo dijo.
 */
export class WorldScene extends Phaser.Scene {
  private sprites = new Map<string, Phaser.GameObjects.Container>();
  private pet: Phaser.GameObjects.Container | null = null;
  private petBody: Phaser.GameObjects.Arc | null = null;
  private gridDrawn = false;
  private pendingView: GameView | null = null;
  private ready = false;

  constructor() {
    super('world');
  }

  create(): void {
    this.ready = true;
    if (this.pendingView) {
      this.applyView(this.pendingView);
      this.pendingView = null;
    }
  }

  /** Punto de entrada desde React: aplica el último view model. */
  applyView(view: GameView): void {
    if (!this.ready) {
      this.pendingView = view;
      return;
    }
    this.drawGrid(view);
    this.syncEntities(view);
    this.syncPet(view);
  }

  private toPixel(cellX: number, cellY: number): { x: number; y: number } {
    return { x: cellX * CELL + CELL / 2, y: cellY * CELL + CELL / 2 };
  }

  private drawGrid(view: GameView): void {
    if (this.gridDrawn) return;
    this.gridDrawn = true;
    const { width, height } = view.worldSize;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x14532d, 1);
    graphics.fillRect(0, 0, width * CELL, height * CELL);
    graphics.lineStyle(1, 0x166534, 1);
    for (let x = 0; x <= width; x++) {
      graphics.lineBetween(x * CELL, 0, x * CELL, height * CELL);
    }
    for (let y = 0; y <= height; y++) {
      graphics.lineBetween(0, y * CELL, width * CELL, y * CELL);
    }
    graphics.setDepth(0);
  }

  private makeEntitySprite(kind: string): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    if (kind === 'wall') {
      const rect = this.add.rectangle(0, 0, CELL - 6, CELL - 6, 0x64748b);
      rect.setStrokeStyle(2, 0x334155);
      container.add(rect);
    } else {
      const emoji = KIND_EMOJI[kind] ?? '❓';
      const text = this.add.text(0, 0, emoji, { fontSize: '34px' });
      text.setOrigin(0.5);
      container.add(text);
    }
    container.setDepth(1);
    return container;
  }

  private syncEntities(view: GameView): void {
    const seen = new Set<string>();
    for (const entity of view.entities) {
      seen.add(entity.id);
      const pixel = this.toPixel(entity.x, entity.y);
      let sprite = this.sprites.get(entity.id);
      if (!sprite) {
        sprite = this.makeEntitySprite(entity.kind);
        sprite.setPosition(pixel.x, pixel.y);
        this.sprites.set(entity.id, sprite);
      } else if (sprite.x !== pixel.x || sprite.y !== pixel.y) {
        this.tweens.add({ targets: sprite, x: pixel.x, y: pixel.y, duration: 140 });
      }
    }
    // Lo que ya no está en el mundo (roto, consumido o recogido) se desvanece.
    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        this.sprites.delete(id);
        this.tweens.add({
          targets: sprite,
          alpha: 0,
          scale: 0.4,
          duration: 220,
          onComplete: () => sprite.destroy(),
        });
      }
    }
  }

  private syncPet(view: GameView): void {
    if (!view.pet) {
      this.pet?.setVisible(false);
      return;
    }
    const pixel = this.toPixel(view.pet.x, view.pet.y);
    if (!this.pet) {
      const body = this.add.circle(0, 0, CELL / 2 - 10, 0xf59e0b);
      body.setStrokeStyle(3, 0x78350f);
      const eyeL = this.add.circle(-9, -6, 4, 0x1c1917);
      const eyeR = this.add.circle(9, -6, 4, 0x1c1917);
      this.pet = this.add.container(pixel.x, pixel.y, [body, eyeL, eyeR]);
      this.pet.setDepth(2);
      this.petBody = body;
    } else if (this.pet.x !== pixel.x || this.pet.y !== pixel.y) {
      this.tweens.add({ targets: this.pet, x: pixel.x, y: pixel.y, duration: 160 });
    }
    const color = Number.parseInt(view.petColor.replace('#', ''), 16);
    if (!Number.isNaN(color)) this.petBody?.setFillStyle(color);
    this.pet.setAlpha(view.pet.alive ? 1 : 0.35);
  }
}
