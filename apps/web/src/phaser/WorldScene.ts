import Phaser from 'phaser';
import { kindLabel } from '@anima/shared';
import type { EntityTraits, GameView } from '../session/view.js';
import { appearanceFor } from './appearance.js';

/** Celda de referencia: toda la geometría se define a esta escala y se reescala desde aquí. */
export const BASE_CELL = 64;

/**
 * Escena de renderizado puro: dibuja el view model y anima diferencias.
 * No contiene ninguna regla del mundo — si algo se mueve, rompe o desaparece,
 * es porque el motor lo dijo.
 */
export class WorldScene extends Phaser.Scene {
  private sprites = new Map<string, Phaser.GameObjects.Container>();
  private pet: Phaser.GameObjects.Container | null = null;
  private petBody: Phaser.GameObjects.Arc | null = null;
  private grid: Phaser.GameObjects.Graphics | null = null;
  private cell = BASE_CELL;
  private lastView: GameView | null = null;
  private ready = false;

  constructor() {
    super('world');
  }

  create(): void {
    this.ready = true;
    if (this.lastView) this.applyView(this.lastView);
  }

  /** Punto de entrada desde React: aplica el último view model. */
  applyView(view: GameView): void {
    this.lastView = view;
    if (!this.ready) return;
    this.drawGrid(view);
    this.syncEntities(view);
    this.syncPet(view);
  }

  /**
   * Reescala el tablero a un nuevo tamaño de celda. La escena se reconstruye a
   * la resolución nueva en vez de estirar el canvas, para que los trazos y los
   * emoji sigan nítidos por grande que sea la pantalla.
   */
  setCell(cell: number): void {
    if (cell === this.cell) return;
    this.cell = cell;
    this.discard(this.grid);
    this.grid = null;
    for (const sprite of this.sprites.values()) this.discard(sprite);
    this.sprites.clear();
    this.discard(this.pet);
    this.pet = null;
    this.petBody = null;
    if (this.lastView) this.applyView(this.lastView);
  }

  /** Un tween sobre un objeto ya destruido revienta al siguiente frame. */
  private discard(object: Phaser.GameObjects.GameObject | null): void {
    if (!object) return;
    this.tweens.killTweensOf(object);
    object.destroy();
  }

  /** Factor respecto a la geometría de referencia. */
  private get cellScale(): number {
    return this.cell / BASE_CELL;
  }

  private toPixel(cellX: number, cellY: number): { x: number; y: number } {
    return { x: cellX * this.cell + this.cell / 2, y: cellY * this.cell + this.cell / 2 };
  }

  private drawGrid(view: GameView): void {
    if (this.grid) return;
    const { width, height } = view.worldSize;
    const graphics = this.add.graphics();
    this.grid = graphics;
    graphics.fillStyle(0x14532d, 1);
    graphics.fillRect(0, 0, width * this.cell, height * this.cell);
    graphics.lineStyle(1, 0x166534, 1);
    for (let x = 0; x <= width; x++) {
      graphics.lineBetween(x * this.cell, 0, x * this.cell, height * this.cell);
    }
    for (let y = 0; y <= height; y++) {
      graphics.lineBetween(0, y * this.cell, width * this.cell, y * this.cell);
    }
    graphics.setDepth(0);
  }

  private makeEntitySprite(kind: string, traits: EntityTraits): Phaser.GameObjects.Container {
    const k = this.cellScale;
    const container = this.add.container(0, 0);
    const look = appearanceFor(kind, traits);
    if (look.as === 'emoji') {
      const text = this.add.text(0, 0, look.emoji, { fontSize: `${Math.round(34 * k)}px` });
      text.setOrigin(0.5);
      container.add(text);
    } else if (!look.labelled) {
      const rect = this.add.rectangle(0, 0, this.cell - 6 * k, this.cell - 6 * k, look.fill);
      rect.setStrokeStyle(2 * k, look.stroke);
      container.add(rect);
    } else {
      // Último recurso: nada en el mundo se parece a esto. Un cuadrado con su
      // nombre en voz humana ("tronco", no "log"), porque el tipo interno es
      // un identificador y no significa nada para quien juega.
      const rect = this.add.rectangle(0, 0, this.cell - 14 * k, this.cell - 14 * k, look.fill, 0.9);
      rect.setStrokeStyle(2 * k, look.stroke);
      const label = this.add.text(0, 0, kindLabel(kind), {
        fontSize: `${Math.round(11 * k)}px`,
        color: '#fef3c7',
        align: 'center',
        wordWrap: { width: this.cell - 18 * k },
      });
      label.setOrigin(0.5);
      container.add([rect, label]);
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
        sprite = this.makeEntitySprite(entity.kind, entity.traits);
        sprite.setPosition(pixel.x, pixel.y);
        this.sprites.set(entity.id, sprite);
      } else if (sprite.x !== pixel.x || sprite.y !== pixel.y) {
        this.tweens.add({ targets: sprite, x: pixel.x, y: pixel.y, duration: 140 });
      }
    }
    // Lo que ya no está en el mundo se va. Recogerlo no es lo mismo que
    // romperse o consumirse: si el motor dijo que fue a parar al inventario,
    // el objeto viaja hasta la mascota en vez de desvanecerse donde estaba.
    for (const [id, sprite] of this.sprites) {
      if (seen.has(id)) continue;
      this.sprites.delete(id);
      if (view.pickup?.itemId === id && view.pet) {
        this.flyToPet(sprite, this.toPixel(view.pet.x, view.pet.y));
      } else {
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

  /**
   * El objeto describe un arco hasta la mascota y se encoge al entrar: la
   * curva hace legible de dónde salió y adónde fue, cosa que un corte no dice.
   */
  private flyToPet(sprite: Phaser.GameObjects.Container, target: { x: number; y: number }): void {
    const from = { x: sprite.x, y: sprite.y };
    // Vértice del arco por encima de los dos extremos, proporcional al salto.
    const peak = {
      x: (from.x + target.x) / 2,
      y: Math.min(from.y, target.y) - (this.cell * 0.55 + Math.abs(from.x - target.x) * 0.12),
    };
    const progress = { t: 0 };
    sprite.setDepth(3);
    this.tweens.add({
      targets: progress,
      t: 1,
      duration: 340,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = progress.t;
        const inv = 1 - t;
        sprite.setPosition(
          inv * inv * from.x + 2 * inv * t * peak.x + t * t * target.x,
          inv * inv * from.y + 2 * inv * t * peak.y + t * t * target.y,
        );
        sprite.setScale(1 - 0.75 * t);
        sprite.setAlpha(t > 0.8 ? (1 - t) / 0.2 : 1);
      },
      onComplete: () => {
        sprite.destroy();
        this.bumpPet();
      },
    });
  }

  /** Acuse de recibo: la mascota se aplasta un instante cuando el objeto llega. */
  private bumpPet(): void {
    if (!this.pet) return;
    this.tweens.add({
      targets: this.pet,
      scaleX: 1.18,
      scaleY: 0.82,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => this.pet?.setScale(1),
    });
  }

  private syncPet(view: GameView): void {
    if (!view.pet) {
      this.pet?.setVisible(false);
      return;
    }
    const pixel = this.toPixel(view.pet.x, view.pet.y);
    // Postura sobre un objeto (ADR 0027): comparte celda con él, y el desvío
    // vertical hace legible el eje z que la grilla no tiene — un poco más
    // arriba si está encima, un poco más abajo (y detrás) si está debajo.
    const mount = view.pet.mount;
    if (mount) pixel.y += (mount.mode === 'on-top' ? -0.14 : 0.14) * this.cell;
    if (!this.pet) {
      const k = this.cellScale;
      const body = this.add.circle(0, 0, this.cell / 2 - 10 * k, 0xf59e0b);
      body.setStrokeStyle(3 * k, 0x78350f);
      const eyeL = this.add.circle(-9 * k, -6 * k, 4 * k, 0x1c1917);
      const eyeR = this.add.circle(9 * k, -6 * k, 4 * k, 0x1c1917);
      this.pet = this.add.container(pixel.x, pixel.y, [body, eyeL, eyeR]);
      this.pet.setDepth(2);
      this.petBody = body;
    } else if (this.pet.x !== pixel.x || this.pet.y !== pixel.y) {
      this.tweens.add({ targets: this.pet, x: pixel.x, y: pixel.y, duration: 160 });
    }
    const color = Number.parseInt(view.petColor.replace('#', ''), 16);
    if (!Number.isNaN(color)) this.petBody?.setFillStyle(color);
    this.pet.setAlpha(view.pet.alive ? 1 : 0.35);
    // Debajo de algo, el objeto la tapa; en cualquier otro caso, ella tapa.
    this.pet.setDepth(mount?.mode === 'underneath' ? 0.5 : 2);
  }
}
