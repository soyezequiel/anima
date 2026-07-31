// ─── @anima/skills — la superficie que ve el código que escribe el modelo ───
//
// ARCHIVO GENERADO. No se edita a mano: se emite de `src/tipos.ts` y `src/ctx.ts`
// con `tsc --declaration`, y hay un test que falla si lo commiteado difiere de lo
// emitido. Para regenerarlo:
//
//     pnpm --filter @anima/skills emitir-api
//
// Que se emita y no se transcriba es lo que hace imposible la clase entera de
// bugs «la referencia quedó vieja»: si la física suma una cualidad, acá está sin
// que nadie la copie; si alguien escribe acá una cualidad que la física no
// tiene, no compila. En Ánima I la referencia del lenguaje se mantenía a mano en
// `codex.ts`, divergió, y por eso el modelo no puede colocar bloques.
//
// Todo lo que sigue sale de `@anima/physics`, `@anima/world` y `@anima/oracle`.

import type { CellQuality, Commitment, QualityId, Tag } from '@anima/physics';
import type { ActorId, BodyId, Cell, Motivo } from '@anima/world';
/**
 * De `@anima/physics`:
 *
 * - `QualityId`   las 29 del catálogo CERRADO: 4 conservadas, 17 con ley,
 *                 8 derivadas. Agregar una sustancia es agregar un punto en un
 *                 espacio que ya existe; agregar una cualidad es agregar una
 *                 dimensión, y toda ley escrita antes queda muda sobre ella. Por
 *                 eso las sustancias las inventa el oráculo y las cualidades no.
 * - `CellQuality` las 4 de celda (ADR II-0002). `wet` y `sheltered` NO existen
 *                 como cualidad de cuerpo: un cuerpo tiene `moisture`, y estar a
 *                 reparo es una relación con la celda.
 * - `Commitment`  los tres grados. Lo declara el mundo, no quien emite.
 * - `ProcessId`   ABIERTO (`string`) a propósito: el oráculo puede dar de alta
 *                 procesos que hoy no existen. Lo que una habilidad puede
 *                 APLICAR es `SeedProcessId`, el subconjunto con roles tipados.
 * - `Tag`         de qué CLASE es una materia. Es el tipo de `BodyView.tags`, y
 *                 se re-exporta por lo mismo que los otros: una segunda lista de
 *                 clases mantenida acá divergiría de la de la física sin que
 *                 nada falle. A diferencia de `QualityId`, el catálogo de tags
 *                 lo puede agrandar el oráculo — `residuoDe` da de alta
 *                 sustancias con `carbonoso`/`mineral` en cada pirólisis.
 */
export type { QualityId, CellQuality, Commitment, ProcessId, Tag } from '@anima/physics';
/**
 * De `@anima/world`:
 *
 * - `Cell` / `Placement`  la celda. Enteros siempre: una posición fraccionaria
 *                 haría que dos mundos gemelos dependieran del orden en que se
 *                 acumularon los desplazamientos. Son el mismo tipo con dos
 *                 nombres porque el mundo usa `Placement` en las intenciones.
 * - `Intent`      LO QUE EL `yield` ENTREGA AL MUNDO. Es la intención de
 *                 `@anima/world`, la misma que emite el cuidador cuando teclea
 *                 una orden, y `stepWorld` la juzga igual. Antes era un tipo
 *                 opaco con un `unique symbol` inventado acá: una garantía falsa
 *                 —el runtime tenía que castear para construir una— que además
 *                 escondía que el compromiso de cada clase de intención LO
 *                 DECLARA EL MUNDO y se recalcula.
 * - `Motivo`      por qué el mundo rechazó algo. El vocabulario de los rechazos
 *                 es del mundo, y una habilidad que ramifique sobre él ramifica
 *                 sobre lo mismo que decidió el rechazo.
 */
export type { Cell, Placement, BodyId, ActorId, Intent, Motivo } from '@anima/world';
/** Un test sobre una cualidad de CUERPO. Misma forma que el de la física. */
export interface QualityTest {
    readonly q: QualityId;
    readonly op: '>=' | '<=' | '>' | '<';
    readonly v: number;
}
/** Un test sobre una cualidad de CELDA. */
export interface CellQualityTest {
    readonly q: CellQuality;
    readonly op: '>=' | '<=' | '>' | '<';
    readonly v: number;
}
export type Where = readonly QualityTest[];
export type WhereCell = readonly CellQualityTest[];
/**
 * Los CUATRO procesos aplicables. `ProcessId` de la física es `string` porque el
 * catálogo es abierto; esto es el subconjunto que una habilidad puede invocar y
 * para el que hay roles tipados.
 *
 * Es una unión de literales escrita acá y no derivada de `SEED_PROCESSES`,
 * porque `Process.id` es `string` y de un `string` no sale un literal. Que no
 * pueda divergir lo garantiza un TEST que compara esta unión contra el catálogo
 * de `@anima/physics` — el mismo trato que se le da a cualquier otra lista que
 * no se puede derivar en tipos.
 */
export type SeedProcessId = 'friccion' | 'union' | 'deshilachar' | 'extraccion';
/** Los cuatro, en el orden del catálogo. Lo verifica el test contra `SEED_PROCESSES`. */
export declare const SEED_PROCESS_IDS: readonly SeedProcessId[];
/**
 * Los nombres de rol de cada proceso, con el sufijo `?` de los opcionales tal
 * como los escribe el catálogo (`isOptionalRole` de la física). Existe para que
 * el test pueda comparar `RolesOf` contra `Process.roles` sin que nadie
 * transcriba la lista una tercera vez.
 */
export declare const SEED_ROLE_NAMES: {
    readonly friccion: readonly ["a", "b", "actor"];
    readonly union: readonly ["binder", "a", "b?"];
    readonly deshilachar: readonly ["source", "actor"];
    readonly extraccion: readonly ["gear", "source"];
};
/**
 * Los roles de cada proceso, tipados.
 *
 * Con `roles: Record<string, BodyView>` —lo que decía el documento— un corpus de
 * veinte llamadas malformadas era rechazado CERO veces: el compilador como juez
 * estaba apagado justo donde más se lo necesita.
 *
 * ARIDAD DE `union`: `b` es OPCIONAL, y no es comodidad. Con `b`, el atador se
 * gasta en la atadura y salen dos cuerpos unidos (el trípode). Sin `b`, el
 * atador sobrevive como parte con una punta suelta — y esa punta suelta es
 * `freeStrandEnds`, que es lo único que da `catch`, que es lo único que califica
 * para `extraccion`. Con `b` obligatorio, pescar es imposible.
 */
export type RolesOf<P extends SeedProcessId> = P extends 'friccion' ? {
    a: BodyView;
    b: BodyView;
    actor: BodyView;
} : P extends 'union' ? {
    binder: BodyView;
    a: BodyView;
    b?: BodyView;
} : P extends 'deshilachar' ? {
    source: BodyView;
    actor: BodyView;
} : P extends 'extraccion' ? {
    gear: BodyView;
    source: BodyView;
} : never;
/**
 * Una junta del cuerpo. `a` y `b` son ÍNDICES DE PARTE, no cuerpos.
 *
 * El `.d.ts` a mano los declaraba `BodyView`, y eso era falso: `Joint` de la
 * física une dos partes DEL MISMO cuerpo. Una habilidad que creyera que una
 * junta relaciona dos cuerpos —«¿a qué está atada mi caña?»— compilaba y leía
 * una relación que no existe.
 */
export interface JointView {
    readonly a: number;
    readonly b: number;
    /** Lo que se afloja con el uso. Es de lo que trata jubilar una herramienta. */
    readonly strength: number;
}
/**
 * Un cuerpo visto desde una habilidad: el cuerpo de la física más sus relaciones
 * espaciales, que son del mundo (`WorldBody`) y no de la materia.
 *
 * Las cuatro relaciones son las cuatro que el mundo guarda, más el dual de una:
 * `covering` está en el cuerpo que tapa, y `coveredBy` es su inverso, que es el
 * lado que la habilidad necesita («¿ya está tapada la fogata?»).
 */
export interface BodyView {
    readonly id: BodyId;
    readonly at: Cell;
    /** Sale de `nameOf(body, phys)`. No es un `kind`: es cómo se lee lo que hay. */
    readonly name: string;
    /**
     * DE QUÉ CLASE ES LA MATERIA DE ESTE CUERPO — `tagsDe(body, phys)`, la UNIÓN de
     * los tags de todas sus partes, con la `Physics` VIVA en la mano.
     *
     * ─── POR QUÉ ESTE CAMPO EXISTE, Y EL BUG QUE LO PIDIÓ ───────────────────────
     *
     * Porque `name` no alcanza y el intento de que alcanzara mintió. `@anima/plan`
     * contestaba `holding(tag:carnoso)` con un índice `nombre → tags` derivado de
     * `SUSTANCIAS_SEMILLA`, buscado por PREFIJO sobre `name`. El índice era honesto;
     * la lectura no, porque la ley 4 bautiza a sus residuos
     * ``${madre.lexeme.nombre} hecho tizón`` (`physics/src/leyes.ts`), así que un
     * pescado pasado de fuego se llama «pescado hecho tizón» y el prefijo contesta
     * los tags del pescado. Medido en el motor: sustancia
     * `residuo-carbonoso-de-pescado`, tags REALES `["carbonoso"]`, `nutrition 0`,
     * `digestibility 0` — y `cumpleCuerpo(holding(tag:carnoso), …)` decía que SÍ.
     * Los 60 residuos de las 30 sustancias de la semilla empiezan con el nombre de
     * su madre: no era un borde, era la regla de bautismo.
     *
     * Y el eslabón donde disparaba es el siguiente EXACTO de la cadena del Hito 5:
     * pescar → cocinar → pasarse de cocción. Con la meta de comida dada por cumplida
     * sobre un carbón, la criatura deja de tener hambre para siempre.
     *
     * ─── POR QUÉ EN LA VISTA Y NO EN UN `Ctx.tags(b)` ──────────────────────────
     *
     * Porque cuesta lo mismo que `name` —la vista ya tiene la `Physics` en la mano y
     * `tagsDe` está memorizada por el arreglo de partes, que es lo único de lo que
     * depende— y porque un método más en `Ctx` es una puerta más que el modelo tiene
     * que descubrir. Con el campo, los TRES límites que el índice por nombre tenía
     * escritos desaparecen de una: el del catálogo de la semilla (esto lee la
     * `Physics` viva, con las sustancias que la ley 4 dio de alta), el de la parte
     * dominante (esto es la unión de TODAS las partes, así que una caña con un
     * pescado atado es carnosa —que es lo que es—) y el del cuerpo sin partes (sin
     * partes, `[]`, que es la verdad y no una mentira sacada del `id`).
     */
    readonly tags: readonly Tag[];
    /**
     * ADR II-0003 — autoría, no propiedad. Sale de `Body.madeBy`, que es el actor
     * que lo hizo. «No es lo mío, es lo que hice.»
     */
    readonly madeByMe: boolean;
    /** En la mano de quién. Un cuerpo en la mano de otro no está en el piso. */
    readonly heldBy?: ActorId;
    /** Ley 8: sobre qué se apoya. La parrilla vive acá. */
    readonly supportedBy?: BodyView;
    /** Ley 12 (ADR II-0002): a qué está tapando este cuerpo. */
    readonly covering?: BodyView;
    /** El dual: qué lo está tapando a él, si algo. */
    readonly coveredBy?: BodyView;
    readonly joints: readonly JointView[];
}
/**
 * La criatura ES un cuerpo, así que `SelfView extends BodyView`: puede pasarse a
 * sí misma como rol de un proceso, que es el paso 1 de encender el primer fuego
 * de la partida (`friccion` cobra la `stamina` del rol `actor`).
 *
 * `hunger` NO está, y su ausencia es un hallazgo y no un olvido: el `.d.ts` a
 * mano lo prometía y **la física no tiene ninguna cualidad `hunger`**. Lo que
 * duele es la `stamina`, que es conservada y que la ley del metabolismo drena
 * sola. Un campo que typechequea y no lo escribe nadie es peor que un error de
 * compilación.
 */
export interface SelfView extends BodyView {
    readonly holding: readonly BodyView[];
    /** Cuántas cosas le entran en las manos. Lo fija el cuidador (ADR 0070). */
    readonly capacity: number;
    /** Atajo de `ctx.q(ctx.self, 'stamina')`. Es la cualidad conservada, no otra cosa. */
    readonly stamina: number;
    /**
     * Hasta dónde le está permitido comprometer al mundo. Una habilidad
     * `provisional` entra con `reversible` y no puede quemar la casa que la
     * criatura construyó en la vida anterior: la cuarentena es VISIBLE desde
     * adentro, para que se pueda elegir el camino barato en vez de chocar.
     */
    readonly permits: Commitment;
}
/**
 * El recuerdo de un lugar. Un lugar no tiene cuerpo, así que lo que se recuerda
 * de él son cualidades DE CELDA.
 */
export interface PlaceMemory {
    readonly at: Cell;
    /** Cuándo lo vio por última vez. Un recuerdo viejo es una hipótesis. */
    readonly atTick: number;
    /** Qué había. Vacío si vino y no había nada: eso también es información. */
    readonly what: readonly BodyId[];
    /** Puede estar vieja; por eso está `atTick`. */
    q(q: CellQuality): number;
}
/**
 * La vista congelada del tick, la que ve el predicado de corte de `explore`.
 *
 * Tiene `qAt` y no solo `see` porque el agua del mundo **es un campo de celda y
 * no un cuerpo**: sin leer la celda, «explorá hasta encontrar agua» no se puede
 * escribir. `features` se fue: lo declaraba el `.d.ts` a mano para un
 * `opportunities()` que no existe en ningún paquete.
 */
export interface PerceptionView {
    see(w: Where): BodyView[];
    qAt(at: Cell, q: CellQuality): number;
    /** Sin esto no se puede dejar de buscar porque se acabó la fuerza. */
    readonly self: SelfView;
}
/** ADR 0085 de Ánima I, portado a segundos (ADR II-0008). El día y la noche existen. */
export interface Clock {
    readonly phase: 'dia' | 'noche';
    /**
     * SEGUNDOS de mundo, no ticks. Guarecerse antes de que caiga la noche es una
     * decisión de ritmo, y el ritmo no se mide en muestras.
     */
    readonly secondsToNightfall: number;
    /** La duración del día completo, en segundos. */
    readonly dayLength: number;
}
/**
 * ─── SE FUE EL PLACEHOLDER `Blueprint` ─────────────────────────────────────
 *
 * Era `{ id, at }` y lo tomaba `Ctx.place`, con el sentido «levantá este plano
 * acá». El tramo C·bis del Gate 5→6 midió que eso no se sostiene —armar un plano
 * son N−1 uniones encadenadas, y cuando algo se puede desplegar el plano YA se
 * realizó— así que `place` pasó a tomar un CUERPO (ADR II-0022).
 *
 * El plano de verdad existe y no es esto: es `BlueprintDefinition`, en
 * `@anima/physics`, canónico y versionado, y NO lleva el sitio adentro (ADR
 * II-0015). Acá no se re-exporta porque una habilidad no necesita conocerlo: lo
 * único que le llega es una revisión, que es texto.
 */
/**
 * Lo que el mundo devuelve al `yield`.
 *
 * `por` es el motivo del mundo cuando `status` es `'rejected'`. Está opcional y
 * no en una unión discriminada a propósito: `r.got` se lee después de mirar el
 * status, y una unión obligaría a una guarda por cada acceso.
 */
export interface StepResult {
    readonly status: 'arrived' | 'found' | 'done' | 'blocked' | 'rejected' | 'timeout';
    readonly got: readonly BodyView[];
    readonly por?: Motivo;
}
export type Outcome = {
    readonly ok: true;
    readonly got?: BodyView;
} | {
    readonly ok: false;
    readonly why: string;
};
/** Terminó bien. `got` es lo que consiguió, si consiguió algo. */
export declare function done(got?: BodyView): Outcome;
export declare function fail(why: string): Outcome;
/**
 * La respuesta de `ctx.can()`. Lleva el `Motivo` del mundo además del texto: el
 * texto es para el informe de fallo y el motivo es para decidir, y una habilidad
 * que ramifique sobre una cadena de caracteres es una habilidad frágil.
 */
export type Verdict = {
    readonly ok: true;
} | {
    readonly ok: false;
    readonly por: Motivo;
    readonly why: string;
};
/**
 * La ÚNICA sede de estado que sobrevive a un guardado. Las variables locales de
 * un generador no: una corutina suspendida no se serializa, y como los snapshots
 * caen cada N ticks y las habilidades duran cientos, *todo* snapshot cae en
 * medio de una habilidad.
 */
export interface SkillMemory {
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T): void;
    del(key: string): void;
}
/**
 * El dado DEL MUNDO, no el del dios.
 *
 * Es el tipo nominal de `@anima/oracle` y no un `() => number` cualquiera, y esa
 * es toda la gracia: una habilidad no puede recibir el dado del dios ni por
 * accidente, y lo verifica `tsc`. El dado del dios decide qué hay en el mundo y
 * queda en el ledger; el del mundo decide si picó el pez.
 */
export type { WorldRng as Rng } from '@anima/oracle';
/**
 * Punto fijo: los mismos bits en toda máquina.
 *
 * `Math.exp`, `Math.pow` y `Math.log` **no tienen precisión especificada en
 * ECMAScript**: dos navegadores pueden devolver el último bit distinto y el
 * replay diverge en el tick 400. Estas tres son las envolturas en doubles de
 * `fexp`, `fln` y `fpow` de `@anima/physics`.
 *
 * `sin` NO está: el `.d.ts` a mano la prometía y la física no tiene ningún seno
 * determinista. Una habilidad que la llamara habría typechequeado contra nada.
 */
export interface DetMath {
    exp(x: number): number;
    log(x: number): number;
    pow(base: number, exp: number): number;
}

export interface Ctx {
    /**
     * El contador de PASOS: cuántas veces llamaron a esta habilidad. No es tiempo.
     * Cuánto tiempo pasó se pregunta con `clock`, y cuánto tiempo esperar se dice
     * con `wait(segundos)` (ADR II-0008).
     */
    readonly tick: number;
    /**
     * La frecuencia del mundo, en Hz. Está acá porque la API mezcla las dos
     * unidades y sin esto no se pueden relacionar: `wait` va en SEGUNDOS porque
     * esperar es ritmo, y `explore.maxTicks` va en TICKS porque es un presupuesto
     * de cómputo, o sea cuántas veces se llama a la mente. Sólo son admisibles las
     * que dan un `dt = 1/Hz` exacto: 10, 20, 25, 50 y 100.
     */
    readonly hz: number;
    /** El día y la noche (ADR 0085 de Ánima I, en segundos por el ADR II-0008). */
    readonly clock: Clock;
    /**
     * La criatura. `SelfView extends BodyView`, así que se puede pasar a sí misma
     * como rol de un proceso — que es cómo enciende el primer fuego de la partida.
     *
     * El `.d.ts` a mano tenía además un `ctx.me: BodyView` para eso mismo. Se fue:
     * con la herencia es literalmente el mismo objeto, y dos nombres para una cosa
     * son dos formas de escribirla mal.
     */
    readonly self: SelfView;
    /**
     * Los CUERPOS que cumplen el predicado. Cualidades de cuerpo, las 29 del
     * catálogo.
     *
     * OJO, y esto rompió el ejemplo canónico del documento de arquitectura: el
     * agua NO es un cuerpo. Es un campo de la celda (`wet`), porque un lago de
     * 4000 celdas como entidades son 4000 objetos que hay que filtrar diez veces
     * por tick. Buscar agua es `qAt` o `recall`, nunca `see`.
     */
    see(w: Where): BodyView[];
    /** Los lugares recordados que cumplen un predicado de CELDA. Ver `PlaceMemory`. */
    recall(w: WhereCell): PlaceMemory[];
    /** Una cualidad de un cuerpo, ya agregada según su `extent` y sus partes. */
    q(b: BodyView, q: QualityId): number;
    /**
     * Una cualidad de la CELDA. Cuatro de las doce leyes actúan acá: la 1 relaja
     * hacia el ambiente, la 3 se modula por el oxígeno de la celda, la 4 lo lee
     * para decidir carbón o ceniza, y la 11 vive en `wet`.
     *
     * Sin esto, tapar la fogata —la técnica emblema de toda la arquitectura—
     * compilaba y producía ceniza siempre: `q(fogata, 'oxygen')` typechequea y
     * contesta el oxígeno DEL CUERPO, mientras la ley 4 lee el DE LA CELDA.
     */
    qAt(at: Cell, q: CellQuality): number;
    /**
     * ADR II-0004 — la tasa instantánea con la que las leyes están moviendo esa
     * cualidad AHORA, en unidades por SEGUNDO de mundo. No simula: lee lo que el
     * motor ya calculó este tick. Cero si ninguna ley la está tocando.
     *
     * Con esto, «¿me conviene esperar?» se contesta con una división y sin
     * proyectar el mundo: `(objetivo − actual) / rateOf(...)`. El supuesto «si
     * nada cambia» queda a la vista de quien lo escribe, que es donde el juez lo
     * puede castigar. Una habilidad no simula el futuro; el planificador sí.
     */
    rateOf(b: BodyView, q: QualityId): number;
    /**
     * ¿Puedo? Verifica roles y arrangement contra el mundo. NO ejecuta y no cuesta
     * nada. El `Motivo` del veredicto es el mismo con el que `stepWorld` rechaza.
     */
    can<P extends SeedProcessId>(p: P, roles: RolesOf<P>): Verdict;
    goTo(t: BodyView | Cell, o?: {
        within?: number;
    }): Intent;
    take(b: BodyView): Intent;
    /**
     * ADR II-0002 — `onTopOf` APOYA (ley 8: sostiene peso); `covering` TAPA
     * (ley 12: ocluye el intercambio con el ambiente). No son lo mismo: la
     * parrilla apoya sin tapar, la losa tapa sin sostener. Confundirlos haría que
     * cocinar sobre la parrilla ahogue el fuego.
     */
    put(b: BodyView, at: Cell, o?: {
        onTopOf?: BodyView;
        covering?: BodyView;
    }): Intent;
    /** Soltar es soltar. `put` es elegir dónde. */
    drop(b: BodyView): Intent;
    /**
     * DEJAR UNA OBRA PUESTA Y FUNCIONANDO. No construye nada ([ADR II-0022]).
     *
     * Tomaba un `Blueprint` —`{ id, at }`— y significaba «levantá este plano acá».
     * El tramo C·bis del Gate 5→6 midió que eso no se sostiene: armar un plano son
     * N−1 uniones encadenadas —once cuerpos para una obra de seis piezas— y cuando
     * algo se puede desplegar el plano YA se realizó. Lo que hay en la mano es un
     * cuerpo.
     *
     * Construir sigue siendo `apply('union', …)` encadenado, y que no tenga verbo
     * propio es correcto: uno nuevo tendría que justificar qué hace que `union` ya
     * no haga.
     *
     * `revision`, si se pasa, es de qué plano salió. El mundo no la usa para nada:
     * la anota, porque el juez necesita a qué plano atribuirle un resultado y
     * porque guardar y restaurar tiene que conservarla.
     */
    place(b: BodyView, at: Cell, revision?: string): Intent;
    apply<P extends SeedProcessId>(p: P, roles: RolesOf<P>): Intent;
    /**
     * `maxTicks` en TICKS y no en segundos, a diferencia de `wait`: es un
     * presupuesto de CÓMPUTO —cuántas veces se evalúa `until`— y eso sí es
     * muestreo. Ver `ctx.hz` para pasar de uno al otro.
     */
    explore(o: {
        until: (v: PerceptionView) => boolean;
        maxTicks: number;
    }): Intent;
    /**
     * Comer SIEMPRE está permitido. No es un permiso: lo que varía es cuánto rinde
     * (`calories = nutrition · mass · digestibility`) y cuánto enferma
     * (`toxicity`). `edible` no existe como cualidad ni como puerta, y ésa fue una
     * decisión de la física, no una omisión de esta superficie.
     */
    eat(b: BodyView): Intent;
    /**
     * Esperar, en SEGUNDOS de mundo y no en ticks (ADR II-0008): esperar es ritmo,
     * no muestreo, y `wait(2)` son dos segundos a 20 Hz y a 100 Hz.
     *
     * Sin esto, la única forma de dejar pasar el tiempo era `yield
     * ctx.goTo(ctx.self.at)` — caminar hasta donde ya estoy.
     */
    wait(segundos: number): Intent;
    /** Canal de habla. No cuesta turno del cuerpo. */
    say(text: string): void;
    /**
     * Punto de re-entrada tras cargar la partida, y de paso el informe de fallo:
     * al reanudar, la habilidad arranca de arriba y se saltea a su fase leyendo
     * `memory`. Es lo que convierte un «falló» en un «muere en `buscar-agua` 9 de
     * 10 veces», que es lo que hace corregible una habilidad.
     */
    phase(name: string): void;
    /** La ÚNICA sede de estado que sobrevive a un guardado. Las locales no. */
    readonly memory: SkillMemory;
    /** Determinismo: no hay `Math.random` ni `Date` en el scope. */
    readonly rng: Rng;
    readonly math: DetMath;
}
/**
 * La firma de una habilidad. Un generador al idiom `redux-saga`: emite
 * intenciones con `yield`, recibe el resultado del mundo, y termina con
 * `done()` o `fail()`.
 */
export type Skill<A> = (ctx: Ctx, args: A) => Generator<Intent, Outcome, StepResult>;
