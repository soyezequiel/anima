import Phaser from 'phaser';
import type { EntityTraits, GameView } from '../session/view.js';
import type { AppearanceHints, MatterLook } from './appearance.js';
import { appearanceFor } from './appearance.js';
import { GLYPH_SIZE, toneAt } from './matter.js';

/** Celda de referencia: toda la geometría se define a esta escala y se reescala desde aquí. */
export const BASE_CELL = 64;

/** Cuánto se levanta lo señalado. Aparecer tiene que terminar acá si ya está señalado. */
const LIFTED_SCALE = 1.16;

/** El azul de la noche y su opacidad máxima (plena noche). El tablero nunca se
 *  vuelve negro del todo: se sigue viendo lo que pasa, solo que a oscuras. */
const NIGHT_COLOR = 0x0a1533;
const NIGHT_MAX_ALPHA = 0.55;

/**
 * Un nombre corto y estable para un dibujo, con el que se lo cachea. Resume las
 * 256 casillas: dos dibujos iguales dan el mismo nombre —y comparten textura,
 * que es todo el punto del caché— y dos distintos, distinto. `derivado` es el
 * caso sin dibujo propio, que la pantalla compone sola.
 */
function drawingId(glyph: unknown): string {
  if (!Array.isArray(glyph)) return 'derivado';
  const rows = glyph.join('');
  let hash = 2166136261;
  for (let i = 0; i < rows.length; i++) {
    hash ^= rows.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Escena de renderizado puro: dibuja el view model y anima diferencias.
 * No contiene ninguna regla del mundo — si algo se mueve, rompe o desaparece,
 * es porque el motor lo dijo.
 */
export class WorldScene extends Phaser.Scene {
  private sprites = new Map<string, Phaser.GameObjects.Container>();
  private pet: Phaser.GameObjects.Container | null = null;
  private petBody: Phaser.GameObjects.Arc | null = null;
  /** Los ojos, para la mirada pensativa (se van hacia arriba mientras piensa). */
  private petEyes: Phaser.GameObjects.Arc[] = [];
  /** Balanceo del cuerpo mientras el modelo piensa; null cuando no piensa. */
  private thinkingSway: Phaser.Tweens.Tween | null = null;
  private grid: Phaser.GameObjects.Graphics | null = null;
  /** El velo de la noche sobre el tablero; su opacidad sigue a la luz del mundo. */
  private nightTint: Phaser.GameObjects.Rectangle | null = null;
  /** Las siluetas de lo que va a construir (ADR 0049); null si no hay obra. */
  private ghosts: Phaser.GameObjects.Container | null = null;
  /** Última forma dibujada: redibujar solo cuando el plan cambia de verdad. */
  private plannedSignature: string | null = null;
  /** Hasta dónde ve, dibujado; null cuando el cuidador no lo pidió. */
  private vision: Phaser.GameObjects.Container | null = null;
  /** El pulso que recorre el borde de la vista; se detiene al apagarla. */
  private visionPulse: Phaser.Tweens.Tween | null = null;
  private visionSignature: string | null = null;
  /** Hasta dónde barre el pulso; cambia al acercarse a un borde del mundo. */
  private visionReach: number | null = null;
  private cell = BASE_CELL;
  private lastView: GameView | null = null;
  private ready = false;
  /** Id de la entidad señalada con el puntero; null si el cursor no toca ninguna. */
  private hovered: string | null = null;
  /**
   * Lo que ya estaba en el mundo la vez anterior. Sobrevive al reescalado a
   * propósito: `setCell` destruye todos los sprites y los rehace, y eso no es
   * que las cosas aparezcan de nuevo — el mundo no cambió, cambió la ventana.
   */
  private knownEntities = new Set<string>();
  /**
   * La primera vista no es una aparición. Al abrir la sesión el mundo ya
   * estaba: la choza y la piedra llevan ahí desde antes de que mirásemos.
   */
  private greeted = false;

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
    this.syncVision(view);
    this.syncPlannedStructures(view);
    this.syncEntities(view);
    this.syncPet(view);
    this.syncThinkingPose(view);
    this.syncNightTint(view);
  }

  /**
   * El velo de la noche: un rectángulo azul oscuro sobre todo el tablero cuya
   * opacidad sube al caer la noche y baja al amanecer, siguiendo la luz continua
   * del mundo (`view.daylight`). De día es transparente. No intercepta el
   * puntero —quién está debajo lo calcula la geometría, no el input de Phaser—
   * así que oscurece sin estorbar. Va por encima de las cosas y la mascota para
   * que la noche caiga sobre todo por igual.
   */
  private syncNightTint(view: GameView): void {
    const alpha = (1 - Math.max(0, Math.min(1, view.daylight))) * NIGHT_MAX_ALPHA;
    if (!this.nightTint) {
      const { width, height } = view.worldSize;
      this.nightTint = this.add
        .rectangle(0, 0, width * this.cell, height * this.cell, NIGHT_COLOR)
        .setOrigin(0, 0)
        .setDepth(2.8);
    }
    this.nightTint.setFillStyle(NIGHT_COLOR, alpha);
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
    // El velo de la noche está dimensionado en píxeles del tablero: se rehace
    // con la escala nueva, como la grilla.
    this.discard(this.nightTint);
    this.nightTint = null;
    // Las siluetas están dibujadas a la escala vieja: se rehacen como todo lo
    // demás. La firma se limpia para que el próximo view las vuelva a pintar.
    this.ghosts?.destroy();
    this.ghosts = null;
    this.plannedSignature = null;
    // La vista está dibujada a la escala vieja, y su pulso mide el rango en
    // píxeles: se rehace entera con el próximo view, como todo lo demás.
    this.clearVision();
    for (const sprite of this.sprites.values()) this.discard(sprite);
    this.sprites.clear();
    // Los tweens de la pose pensativa apuntan a los HIJOS del contenedor:
    // matarlos antes de destruirlo, o revientan al siguiente frame.
    for (const eye of this.petEyes) this.tweens.killTweensOf(eye);
    this.petEyes = [];
    this.thinkingSway = null;
    this.discard(this.pet);
    this.pet = null;
    this.petBody = null;
    // Los sprites que estaban levantados ya no existen: el señalado se vuelve a
    // pedir desde afuera en el próximo movimiento del puntero.
    this.hovered = null;
    if (this.lastView) this.applyView(this.lastView);
  }

  /**
   * Señala una entidad (o ninguna). La escena sigue sin decidir nada: quién
   * está bajo el puntero lo calcula la capa que conoce la geometría de la
   * pantalla, acá solo se dibuja el acuse — el objeto se levanta un poco, que
   * es lo que hace que el rótulo se lea como suyo y no como del tablero.
   */
  setHovered(id: string | null): void {
    if (id === this.hovered) return;
    const before = this.hovered ? this.sprites.get(this.hovered) : undefined;
    this.hovered = id;
    if (before) this.lift(before, false);
    const after = id ? this.sprites.get(id) : undefined;
    if (after) this.lift(after, true);
  }

  /**
   * Levanta o baja un sprite. Se guarda el tween en el propio objeto para
   * cortarlo si el puntero va y viene rápido: dos tweens peleando por la misma
   * escala dejan el objeto en un tamaño intermedio que ya no vuelve.
   */
  private lift(sprite: Phaser.GameObjects.Container, lifted: boolean): void {
    this.stopLift(sprite);
    sprite.setDepth(lifted ? 2.5 : 1);
    sprite.setData(
      'lift',
      this.tweens.add({
        targets: sprite,
        scale: lifted ? LIFTED_SCALE : 1,
        duration: 140,
        ease: lifted ? 'Back.easeOut' : 'Quad.easeOut',
      }),
    );
  }

  /**
   * Una cosa entra al mundo: crece hasta su tamaño con un halo que se abre en
   * su casilla. No promete nada sobre cuánto tardó en hacerse — craftear es un
   * tick — solo dice dónde acaba de pasar algo, que es lo que el ojo pierde
   * cuando un objeto se materializa de golpe en un tablero quieto.
   */
  private appear(sprite: Phaser.GameObjects.Container, rest: number): void {
    sprite.setScale(rest * 0.4);
    sprite.setAlpha(0);
    // El alfa va en su propio tween y NO se guarda como 'lift': si el puntero
    // señala la cosa a mitad de aparecer, `stopLift` corta el crecimiento (que
    // es lo correcto, lo toma el tween de levantar) pero el desvanecido tiene
    // que llegar a 1 igual, o el objeto queda medio transparente para siempre.
    this.tweens.add({ targets: sprite, alpha: 1, duration: 200 });
    sprite.setData(
      'lift',
      this.tweens.add({ targets: sprite, scale: rest, duration: 300, ease: 'Back.easeOut' }),
    );
    this.halo(sprite.x, sprite.y);
  }

  /** El halo de aparición: un anillo que se abre y se apaga en la casilla. */
  private halo(x: number, y: number): void {
    const ring = this.add.circle(x, y, this.cell * 0.22);
    ring.setStrokeStyle(2 * this.cellScale, 0xfcd34d, 0.9);
    // Debajo de las entidades (1) y encima de la grilla (0): el protagonista
    // es lo que aparece, el halo solo señala dónde mirar.
    ring.setDepth(0.5);
    this.tweens.add({
      targets: ring,
      scale: 2.4,
      alpha: 0,
      duration: 360,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private stopLift(sprite: Phaser.GameObjects.Container): void {
    const running = sprite.getData('lift') as Phaser.Tweens.Tween | undefined;
    running?.stop();
    sprite.setData('lift', undefined);
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

  /**
   * Hasta dónde ve, dibujado sobre el suelo.
   *
   * Se dibuja la SOMBRA, no la luz. Iluminar lo que ve no se leía: su rango
   * es más grande que muchos mundos, así que el claro cubría el tablero
   * entero y no contrastaba contra nada. Oscurecer lo que NO ve deja ver de
   * una la respuesta que importa —qué le esconde cada muro— porque el muro
   * proyecta su sombra y la sombra tiene forma.
   *
   * El borde marca el cuadrado del rango: hasta ahí llegaría si nada la
   * tapara. Lo que quede oscuro adentro de ese borde es exactamente lo que le
   * roba un obstáculo.
   *
   * El pulso sale de ella y se expande hasta el borde: es lo que convierte una
   * mancha quieta en «está mirando». Va acá y no en el claro porque animar la
   * opacidad de cientos de celdas cada cuadro es caro y además late como un
   * cartel; un solo contorno que se abre cuesta nada y se lee mejor.
   *
   * El contenedor SOBREVIVE entre ticks a propósito: recrearlo mataría el
   * tween y el pulso volvería a empezar en cada avance del mundo, así que
   * nunca se vería completo. Solo se redibuja el claro, y solo cuando cambió.
   */
  private syncVision(view: GameView): void {
    if (!view.vision || !view.pet) {
      this.clearVision();
      return;
    }
    const { range, cells } = view.vision;
    const pet = view.pet;
    const k = this.cellScale;

    // Hasta dónde tiene sentido que llegue el pulso. Su rango suele ser MÁS
    // GRANDE que el mundo —12 celdas sobre un tablero de 13— y un pulso que
    // se expande hasta el rango se va de la pantalla apenas arranca: se ve un
    // parpadeo junto a ella y nada más. Acotado al borde del tablero, el
    // barrido recorre justo lo que hay para mirar.
    const reach = Math.min(
      range,
      Math.max(pet.x, view.worldSize.width - 1 - pet.x, pet.y, view.worldSize.height - 1 - pet.y),
    );

    if (this.vision && reach !== this.visionReach) this.clearVision();
    if (!this.vision) {
      this.visionReach = reach;
      this.vision = this.add.container(0, 0);
      // Encima de las cosas, no debajo: la sombra tiene que apagar TAMBIÉN lo
      // que hay en las celdas que no ve, porque eso es justamente lo que ella
      // no sabe que está ahí. Por debajo, un tronco fuera de su vista se
      // seguiría dibujando brillante y la sombra no querría decir nada.
      //
      // A ella no la tapa: su propia celda siempre entra en `visibleCells`
      // —la línea de visión a uno mismo es trivial—, así que nunca cae en la
      // parte oscura.
      this.vision.setDepth(2.6);
      this.vision.add(this.add.graphics());
      this.vision.add(this.add.graphics());
      this.startVisionPulse(reach);
    }

    // Redibujar solo si cambió algo. La firma incluye cuántas celdas ve, que
    // es lo que se mueve cuando cae un muro sin que ella se mueva.
    const signature = `${pet.x},${pet.y}|${range}|${cells.length}|${this.cell}`;
    if (signature === this.visionSignature) return;
    this.visionSignature = signature;

    const [shadow, edge] = this.vision.list as Phaser.GameObjects.Graphics[];
    const seen = new Set(cells.map((c) => `${c.x},${c.y}`));
    shadow!.clear();
    shadow!.fillStyle(0x0c0a09, 0.55);
    for (let y = 0; y < view.worldSize.height; y++) {
      for (let x = 0; x < view.worldSize.width; x++) {
        if (seen.has(`${x},${y}`)) continue;
        shadow!.fillRect(x * this.cell, y * this.cell, this.cell, this.cell);
      }
    }

    edge!.clear();
    edge!.lineStyle(2 * k, 0xfde68a, 0.22);
    const left = (pet.x - range) * this.cell;
    const top = (pet.y - range) * this.cell;
    const side = (range * 2 + 1) * this.cell;
    edge!.strokeRect(left, top, side, side);

    this.positionVisionPulse(pet.x, pet.y);
  }

  /**
   * El pulso: un cuadrado que nace en ella y se abre hasta el borde del rango.
   *
   * Se respeta `prefers-reduced-motion`: quien pidió que la pantalla no se
   * mueva igual necesita ver hasta dónde llega la vista, así que el contorno
   * se dibuja quieto en el borde en vez de latir.
   */
  private startVisionPulse(reach: number): void {
    const graphics = this.add.graphics();
    const side = (reach * 2 + 1) * this.cell;
    graphics.lineStyle(2 * this.cellScale, 0xfde68a, 0.85);
    graphics.strokeRect(-side / 2, -side / 2, side, side);
    this.vision?.add(graphics);

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (still) {
      graphics.setAlpha(0.3);
      return;
    }
    graphics.setScale(0.05);
    this.visionPulse = this.tweens.add({
      targets: graphics,
      scale: 1,
      alpha: { from: 0.55, to: 0 },
      duration: 2200,
      ease: 'Sine.easeOut',
      repeat: -1,
    });
  }

  /** El pulso late donde está ella, así que la sigue cuando camina. */
  private positionVisionPulse(cellX: number, cellY: number): void {
    const pulse = this.vision?.list[2] as Phaser.GameObjects.Graphics | undefined;
    if (!pulse) return;
    const pixel = this.toPixel(cellX, cellY);
    pulse.setPosition(pixel.x, pixel.y);
  }

  private clearVision(): void {
    if (!this.vision) return;
    this.visionPulse?.remove();
    this.visionPulse = null;
    this.vision.destroy(true);
    this.vision = null;
    this.visionSignature = null;
    this.visionReach = null;
  }

  /**
   * La obra que todavía no existe, dibujada donde va a quedar (ADR 0049).
   *
   * Cada celda pendiente es una silueta punteada con el emoji del bloque en
   * transparente; las ya levantadas no se dibujan —ahí ya hay una entidad de
   * verdad— pero su celda queda marcada tenue para que se lea la forma entera.
   * Va por debajo de todo lo real: es un plan, no una cosa.
   */
  private syncPlannedStructures(view: GameView): void {
    const planned = view.plannedStructures;
    const signature = JSON.stringify(planned);
    if (signature === this.plannedSignature) return;
    this.plannedSignature = signature;
    this.ghosts?.destroy();
    this.ghosts = null;
    if (planned.length === 0) return;

    const container = this.add.container(0, 0);
    const k = this.cellScale;
    const graphics = this.add.graphics();
    container.add(graphics);
    for (const structure of planned) {
      for (const cell of structure.cells) {
        const pixel = this.toPixel(cell.x, cell.y);
        const size = this.cell - 8 * k;
        if (cell.done) {
          // Ya está: solo el contorno tenue, para que la silueta se lea entera.
          graphics.lineStyle(2 * k, 0x86efac, 0.25);
          graphics.strokeRect(pixel.x - size / 2, pixel.y - size / 2, size, size);
          continue;
        }
        graphics.fillStyle(0xbbf7d0, 0.1);
        graphics.fillRect(pixel.x - size / 2, pixel.y - size / 2, size, size);
        graphics.lineStyle(2 * k, 0xbbf7d0, 0.55);
        graphics.strokeRect(pixel.x - size / 2, pixel.y - size / 2, size, size);
        const look = appearanceFor(cell.kind, {}, {});
        if (look.as === 'emoji') {
          const text = this.add.text(pixel.x, pixel.y, look.emoji, {
            fontSize: `${Math.round(28 * k)}px`,
          });
          text.setOrigin(0.5);
          text.setAlpha(0.35);
          container.add(text);
        }
      }
    }
    // Encima del suelo, debajo de todo lo que existe de verdad.
    container.setDepth(0.5);
    this.ghosts = container;
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

  /**
   * La textura de un glifo, pintada una sola vez por DIBUJO. Son 256 casillas:
   * dibujarlas como rectángulos sueltos serían 256 objetos por entidad y el
   * tablero tiene muchas. Como textura es una imagen sola, y además la
   * comparten todas las entidades que se ven igual.
   */
  private matterTexture(kind: string, hints: AppearanceHints, look: MatterLook): string | null {
    // Todo lo que cambia el dibujo entra en la clave. El material, porque si
    // Ánima inventa después la receta que dice de qué está hecho algo, el color
    // cambia. Y el dibujo mismo, resumido: "propio o derivado" alcanzaba
    // mientras un tipo tenía un dibujo y solo uno, pero desde que una pieza
    // puede verse distinto DENTRO de su obra, dos entidades del mismo tipo
    // tienen dibujos distintos — y con la clave vieja la primera en pintarse le
    // prestaba su textura a todas las demás. Un puente entero con la cara de su
    // primer tablón.
    const key = `matter:${kind}:${hints.material ?? ''}:${drawingId(hints.glyph)}`;
    if (this.textures.exists(key)) return key;
    const canvas = this.textures.createCanvas(key, GLYPH_SIZE, GLYPH_SIZE);
    if (!canvas) return null;
    const ctx = canvas.getContext();
    for (let y = 0; y < GLYPH_SIZE; y++) {
      for (let x = 0; x < GLYPH_SIZE; x++) {
        const color = toneAt(look.glyph, x, y, look.palette);
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    canvas.refresh();
    // Sin esto el escalado interpola y el pixel art sale borroso.
    canvas.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return key;
  }

  /**
   * Todo lo que decide cómo se ve una entidad, en una cadena comparable. Es lo
   * mismo que entra en `appearanceFor`: si dos entidades comparten firma, el
   * mismo sprite las sirve; si a una le cambia, hay que redibujarla.
   */
  private lookSignature(kind: string, traits: EntityTraits, hints: AppearanceHints): string {
    const marks = Object.entries(traits)
      .filter(([, on]) => on)
      .map(([name]) => name)
      .sort()
      .join(',');
    // El glifo llega sin validar (lo escribe el modelo): si es cualquier cosa,
    // `appearanceFor` lo descarta igual. Acá solo hace falta que la firma
    // cambie cuando cambia el dibujo, así que sirve cualquier forma estable.
    const drawn = Array.isArray(hints.glyph) ? hints.glyph.join('') : String(hints.glyph ?? '');
    return `${kind}|${marks}|${hints.material ?? ''}|${drawn}`;
  }

  private makeEntitySprite(
    kind: string,
    traits: EntityTraits,
    hints: AppearanceHints,
  ): Phaser.GameObjects.Container {
    const k = this.cellScale;
    const container = this.add.container(0, 0);
    const look = appearanceFor(kind, traits, hints);
    if (look.as === 'emoji') {
      const text = this.add.text(0, 0, look.emoji, { fontSize: `${Math.round(34 * k)}px` });
      text.setOrigin(0.5);
      container.add(text);
    } else if (look.as === 'block') {
      const rect = this.add.rectangle(0, 0, this.cell - 6 * k, this.cell - 6 * k, look.fill);
      rect.setStrokeStyle(2 * k, look.stroke);
      container.add(rect);
    } else {
      const key = this.matterTexture(kind, hints, look);
      if (key) {
        const image = this.add.image(0, 0, key);
        image.setDisplaySize(this.cell - 6 * k, this.cell - 6 * k);
        container.add(image);
      }
    }
    container.setDepth(1);
    return container;
  }

  private syncEntities(view: GameView): void {
    const seen = new Set<string>();
    for (const entity of view.entities) {
      seen.add(entity.id);
      const pixel = this.toPixel(entity.x, entity.y);
      const hints = { material: entity.material, glyph: entity.glyph };
      const look = this.lookSignature(entity.kind, entity.traits, hints);
      let sprite = this.sprites.get(entity.id);
      // Una cosa puede entrar al mundo antes de que Ánima termine de dibujarla:
      // hasta entonces sale con el dibujo procedural. Cuando el glifo llega (o
      // cuando la receta dice recién ahora de qué está hecha), el sprite viejo
      // ya no la representa y hay que rehacerlo — moverlo no alcanza.
      if (sprite && sprite.getData('look') !== look) {
        this.stopLift(sprite);
        this.discard(sprite);
        this.sprites.delete(entity.id);
        sprite = undefined;
      }
      if (!sprite) {
        sprite = this.makeEntitySprite(entity.kind, entity.traits, hints);
        sprite.setData('look', look);
        sprite.setPosition(pixel.x, pixel.y);
        this.sprites.set(entity.id, sprite);
        const lifted = this.hovered === entity.id;
        // Aparecer es entrar al mundo, no volver a dibujarse: lo que ya estaba
        // (un reescalado, un glifo que llegó tarde) se rehace en silencio.
        if (!this.knownEntities.has(entity.id) && this.greeted) {
          this.appear(sprite, lifted ? LIFTED_SCALE : 1);
        } else if (lifted) {
          // Si el puntero seguía encima mientras se rehacía, el acuse de
          // señalado viaja al sprite nuevo: si no, queda apuntado sin levantar.
          this.lift(sprite, true);
        }
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
      // Lo señalado se fue del mundo: sin esto, el tween de levantarlo seguiría
      // corriendo encima del de irse.
      this.stopLift(sprite);
      if (this.hovered === id) this.hovered = null;
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
    // Lo de esta vista es lo conocido de la próxima. Se guarda al final, con
    // las bajas ya descontadas: si algo se va y vuelve (se suelta lo que se
    // había levantado), vuelve a aparecer, que es exactamente lo que pasó.
    this.knownEntities = seen;
    this.greeted = true;
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
      this.petEyes = [eyeL, eyeR];
    } else if (this.pet.x !== pixel.x || this.pet.y !== pixel.y) {
      this.tweens.add({ targets: this.pet, x: pixel.x, y: pixel.y, duration: 160 });
    }
    const color = Number.parseInt(view.petColor.replace('#', ''), 16);
    if (!Number.isNaN(color)) this.petBody?.setFillStyle(color);
    this.pet.setAlpha(view.pet.alive ? 1 : 0.35);
    // Debajo de algo, el objeto la tapa; en cualquier otro caso, ella tapa.
    this.pet.setDepth(mount?.mode === 'underneath' ? 0.5 : 2);
  }

  /**
   * Lenguaje corporal del pensar: mientras el modelo trabaja, el cuerpo se
   * balancea despacio y la mirada se va hacia arriba, como quien busca la
   * idea en el techo. Es puro dibujo — no toca la simulación — y se deshace
   * solo cuando la respuesta llega.
   */
  private syncThinkingPose(view: GameView): void {
    const pet = this.pet;
    if (!pet) return;
    const busy = view.aiBusy && (view.pet?.alive ?? false);
    const k = this.cellScale;
    if (busy && !this.thinkingSway) {
      pet.setAngle(-3);
      this.thinkingSway = this.tweens.add({
        targets: pet,
        angle: 3,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.petEyes.forEach((eye, i) => {
        this.tweens.killTweensOf(eye);
        this.tweens.add({
          targets: eye,
          x: (i === 0 ? -6 : 12) * k,
          y: -9 * k,
          duration: 260,
          ease: 'Quad.easeOut',
        });
      });
    } else if (!busy && this.thinkingSway) {
      this.thinkingSway.stop();
      this.thinkingSway = null;
      this.tweens.add({ targets: pet, angle: 0, duration: 200, ease: 'Quad.easeOut' });
      this.petEyes.forEach((eye, i) => {
        this.tweens.killTweensOf(eye);
        this.tweens.add({
          targets: eye,
          x: (i === 0 ? -9 : 9) * k,
          y: -6 * k,
          duration: 260,
          ease: 'Quad.easeOut',
        });
      });
    }
  }
}
