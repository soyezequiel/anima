import type { EntityQuery, SkillOp } from '@anima/skill-runtime';

/**
 * De qué habla una habilidad: los objetos que TOCA, leídos de su programa.
 *
 * El panel de habilidades no tenía por dónde escanear —slugs con guiones, uno
 * abajo del otro— y encontrar «la de la comida» obligaba a leer nombres. Los
 * objetos ya estaban en el programa; solo que escondidos detrás de variables.
 *
 * Porque la DSL no nombra tipos donde uno actúa: `consume` recibe `objetivo`,
 * un STORE, y el tipo quedó atrás en el `findEntities` que lo llenó. Sin
 * seguir esa cadena la tira mostraría dos objetos de los cinco que la
 * habilidad realmente usa — que es peor que no mostrar ninguno, porque miente
 * con cara de completa.
 */

/** Qué papel juega un objeto en la habilidad. El orden es el de la tira. */
export type SubjectRole =
  | 'busca'
  | 'junta'
  | 'come'
  | 'usa'
  | 'golpea'
  | 'construye'
  | 'fabrica';

export interface SkillSubject {
  /** El tipo, o `null` si la búsqueda fue por rasgo y no por tipo. */
  kind: string | null;
  /** Cómo llamarlo en pantalla: el tipo, o el rasgo («algo comestible»). */
  label: string;
  role: SubjectRole;
}

/**
 * Cuánto pesa cada papel. Un tipo que aparece dos veces se queda con el más
 * específico: si la mascota camina hasta una baya Y se la come, es «come
 * baya», no «busca baya» — ir hasta algo es el trámite, comérselo es el acto.
 */
const ROLE_RANK: Record<SubjectRole, number> = {
  busca: 0,
  junta: 1,
  construye: 2,
  golpea: 3,
  usa: 4,
  fabrica: 5,
  come: 6,
};

/** Los rasgos, dichos como los diría el cuidador. */
const TRAIT_LABEL: Record<string, string> = {
  tool: 'una herramienta',
  edible: 'algo comestible',
  portable: 'algo que se pueda llevar',
  warm: 'algo que dé calor',
  shelter: 'un refugio',
};

/**
 * Qué describe una búsqueda. Con `kind` es el tipo; sin él, la mascota buscó
 * por lo que la cosa HACE (`{edible: true}`) y no por lo que es, así que eso
 * es lo que hay para mostrar. `held` se ignora: filtra por dónde está la cosa,
 * no por qué cosa es.
 */
function describeQuery(query: EntityQuery): { kind: string | null; label: string } | null {
  if (query.kind) return { kind: query.kind, label: query.kind };
  for (const [trait, label] of Object.entries(TRAIT_LABEL)) {
    if (query[trait as keyof EntityQuery] === true) return { kind: null, label };
  }
  return null;
}

type Resolved = { kind: string | null; label: string };

/**
 * Sigue las variables del programa hasta el tipo que guardan.
 *
 * Tres ops llenan stores de entidades: `findEntities` (desde una query),
 * `selectTarget` (elige uno de una lista, hereda su tipo) y `gpsTo` (camina
 * hasta un tipo). Las anclas (`markAnchor`, `markCell`, `markTarget`) guardan
 * CELDAS, no cosas: no entran acá ni aunque `markTarget` venga de una entidad,
 * porque lo que queda guardado es el lugar donde estaba.
 */
class StoreTable {
  private readonly byStore = new Map<string, Resolved>();

  define(store: string, value: Resolved | null): void {
    if (value) this.byStore.set(store, value);
  }

  /** Copia el tipo de una variable a otra: `selectTarget` no cambia la cosa. */
  alias(from: string, to: string): void {
    const value = this.byStore.get(from);
    if (value) this.byStore.set(to, value);
  }

  get(store: string): Resolved | undefined {
    return this.byStore.get(store);
  }
}

/**
 * Los objetos de una habilidad, en el orden en que el programa los toca.
 *
 * `recipeProduct` traduce el id de receta al tipo que sale de ella: `craft`
 * dice «receta-pico», y lo que hay que dibujar es el pico.
 */
export function skillSubjects(
  ops: SkillOp[],
  recipeProduct: (recipeId: string) => string | null,
): SkillSubject[] {
  const stores = new StoreTable();
  const found: SkillSubject[] = [];

  const push = (value: Resolved | undefined | null, role: SubjectRole): void => {
    if (!value) return;
    found.push({ kind: value.kind, label: value.label, role });
  };

  const walk = (list: SkillOp[]): void => {
    for (const op of list) {
      switch (op.op) {
        case 'findEntities':
          stores.define(op.store, describeQuery(op.query));
          break;
        case 'selectTarget':
          stores.alias(op.from, op.store);
          break;
        case 'gpsTo': {
          const value = { kind: op.kind, label: op.kind };
          if (op.store) stores.define(op.store, value);
          push(value, 'busca');
          break;
        }
        case 'pickup':
          push(stores.get(op.target), 'junta');
          break;
        case 'consume':
          push(stores.get(op.target), 'come');
          break;
        case 'useItem':
          // Dos objetos distintos y dos papeles: el pico es la herramienta, la
          // roca es lo que recibe el golpe. Aplastarlos en uno solo perdería
          // justo lo que hace legible a la habilidad.
          push(stores.get(op.item), 'usa');
          push(stores.get(op.target), 'golpea');
          break;
        case 'interact':
          push(stores.get(op.target), 'usa');
          break;
        case 'place':
        case 'placeAt':
          push({ kind: op.kind, label: op.kind }, 'construye');
          break;
        case 'craft': {
          const product = recipeProduct(op.recipeId);
          if (product) push({ kind: product, label: product }, 'fabrica');
          break;
        }
        case 'branch':
          walk(op.then);
          if (op.else) walk(op.else);
          break;
        case 'repeatWithLimit':
          walk(op.body);
          break;
        default:
          // `drop`, `makeRoom`, `explore`, `wait`, `speak`, `moveToward`… son
          // trámite, no objeto de la habilidad. `makeRoom.keep` nombra tipos,
          // pero son los que NO suelta: mostrarlos llenaría la tira de cosas
          // que la habilidad justamente no toca.
          break;
      }
    }
  };

  walk(ops);
  return dedupe(found);
}

/**
 * Un objeto, una vez. Se queda con el papel más específico y con el lugar de
 * su primera aparición, que es el orden en que la habilidad lo encuentra.
 *
 * Los buscados por rasgo se agrupan por su etiqueta: dos `{edible: true}` son
 * la misma idea aunque no haya tipo que los una.
 */
function dedupe(subjects: SkillSubject[]): SkillSubject[] {
  const best = new Map<string, SkillSubject>();
  const order: string[] = [];
  for (const subject of subjects) {
    const key = subject.kind ?? `rasgo:${subject.label}`;
    const previous = best.get(key);
    if (!previous) {
      best.set(key, subject);
      order.push(key);
      continue;
    }
    if (ROLE_RANK[subject.role] > ROLE_RANK[previous.role]) best.set(key, subject);
  }
  return order.map((key) => best.get(key)!);
}
