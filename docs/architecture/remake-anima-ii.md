# ÁNIMA II — Cuerpo, Materia y Vara
### Arquitectura del remake

---

# La idea en una frase

El tick nunca espera a nadie porque toda decisión rápida es aritmética sobre cualidades de la materia; el LLM no decide, escribe TypeScript que un juez que ella no escribió mide antes de que pueda romper nada; y "fogata", "carbón", "pescado asado" y "caña de pescar" no son filas de una tabla sino consecuencias de once leyes que se escriben una sola vez.

> **Orden de producto después del hito 12:** antes de usar esta arquitectura
> para crear objetos nuevos, se completa la
> [convergencia conversacional C0–C6](../product/convergencia-conversacional.md).
> Ese plan integra conversación, memoria, `GoalGraph`, proveedor, fragua, juez,
> persistencia y app con aceptación E2E por estado del mundo.

---

# Los cinco principios que no se rompen

### 1. El tick no tiene un solo `await`

```ts
decide(view: PerceptionView, bb: Blackboard): Intent   // sincrónica, nunca null
```

No es una promesa. Es estructuralmente imposible que una llamada de red entre al paso de simulación. Con esto desaparecen de un saque `THINK_TICK_BUDGET`, `pendingThink`, la carrera contra `setTimeout(0)`, la pantalla de "el mundo espera su mente" y los cuatro ADRs (0039/0040/0043/0045) que son cuatro capas de parche sobre una firma equivocada. `think(): Promise<ActionIntent|null>` esperado dentro del tick es la enfermedad; todo lo demás era el síntoma.

Corolario operativo: el mundo corre en su propio worker a **30 Hz fijos**, consumiendo de una cola de intenciones que **siempre tiene algo**. Si la mente todavía no produjo nada mejor, sale el reflejo o la continuación de la actividad en curso. Nunca hay un tick sin intención.

### 2. Proponer no es poder

Nada de lo que devuelve el modelo se ejecuta. El modelo **propone**: una lectura del chat, una ley, una sustancia, un programa. El mundo determinista valida y aplica. Una habilidad no muta nada: emite una `Intent` que `stepWorld` juzga exactamente igual que si viniera de cualquier otro lado. Código real y aislado **no** significa código privilegiado.

Esto es lo que separa Ánima de un chatbot fantaseando y no se toca ni por velocidad ni por expresividad.

### 3. Todo lo que sube tiene que salir de algún lado

La conservación no es una lista negra de nombres (`PROTECTED_KINDS = ['pet','food','tree']` repartido en cinco archivos) ni una lista blanca de componentes (`INVENTED_COMPONENT_BOUNDS` sin `edible`). Es una desigualdad:

- Hay cualidades **conservadas** (`mass`, `nutrition`, `stamina`): su suma total no puede aumentar salvo aporte del dios, y el aporte del dios está acotado por un presupuesto derivado de la semilla.
- Toda cualidad **no conservada** que un proceso haga SUBIR (temperatura, filo, tensión) tiene que declarar `poweredBy`: de qué cuenta conservada drena, y con qué eficiencia ≤ 1.

Con eso, cocinar es legal (no agrega nutrientes, desbloquea los que ya había) y "la madera alimenta" es imposible (la madera tiene `nutrition: 0` y ninguna ley puede subir de cero). Y las máquinas de movimiento perpetuo — el gradiente que un LLM encuentra siempre — quedan refutadas por clase, no por caso.

### 4. La vara no la escribe la examinada, y tampoco el cuidador apurado

El contrato de aprendizaje lo escribe **el planificador**, en el mismo lenguaje de predicados en el que el mundo juzga. Cuando `plan()` no puede establecer un objetivo, devuelve `{ gap: Predicate, nearest: Step[], why }`. Ese `gap` **es** el contrato: *"no conozco proceso que suba `digestibility` de `carne-de-pez` por encima de 0.7"*.

Se acabaron los dos síes del cuidador antes de la primera línea de código. La confirmación es lo que **promueve**, no lo que arranca. El ADR 0030 se conserva íntegro y cuesta cero turnos de chat.

### 5. El sello gobierna lo que la criatura puede hacerle al mundo, no su reputación

| Sello | Puede planificar | Puede ejecutar | Actos reversibles | Actos costosos | Actos irreversibles |
|---|---|---|---|---|---|
| `borrador` | sí | **no** | — | — | — |
| `provisional` | sí | sí | sí | cuarentena (tope N usos + re-juicio) | requiere confirmación |
| `estable` | sí | sí | sí | sí | sí |
| `sin-vara` | sí | sí | sí | no | no |

Toda `Intent` lleva `commitment: 'reversible' | 'costly' | 'irreversible'`, y eso lo verifica `stepWorld`, no la cortesía del código generado. Un smoke test de 4 mundos no es un juez: es un filtro para **descartar**. Pasarlo te habilita a entrar a la grilla completa y a tocar el mundo con actos reversibles — no a quemar la casa que ella construyó en la vida anterior.

---

# Mapa de capas

```
┌──────────────────────── HILO PRINCIPAL (60 fps) ────────────────────────┐
│                                                                          │
│   @anima/web        chat  ·  canal de HABLA  ·  render por diff          │
│                     (nunca reconstruye la vista entera)                  │
└──────────────┬──────────────────────────────────┬────────────────────────┘
               │ postMessage: Utterance           │ WorldDelta[]
               ▼                                  ▲
┌──────────────────────── WORKER DEL MUNDO (30 Hz, determinista) ─────────┐
│                                                                          │
│  @anima/lang      readFast()  ·  resolveReference()  ·  léxico vivo      │
│       │           (trie + fuzzy sobre datos, 0 llamadas al modelo)       │
│       ▼                                                                  │
│  @anima/plan      goalGraph()  ·  plan() anytime  ·  gap = contrato      │
│       │           índice de esquemas de construcción                     │
│       ▼                                                                  │
│  @anima/mind      escalera de decisión  ·  necesidades  ·  creencias β   │
│       │           decide(view, bb): Intent   ← SINCRÓNICA, nunca null    │
│       ▼                                                                  │
│  @anima/skills    ejecutor de generadores  ·  combustible instrumentado  │
│       │           (síncrono, acotado, sin QuickJS)                       │
│       ▼                                                                  │
│  @anima/world     grilla en chunks · índice O(1) por celda · journal     │
│       │           stepWorld(state, intents): SimEvent[]  ← puro          │
│       ├──────────► @anima/physics   cualidades · sustancias · cuerpos    │
│       ├──────────► @anima/process   las 11 leyes · admit()               │
│       ├──────────► @anima/oracle    dios perezoso · ledger · stocks      │
│       └──────────► @anima/perceive  una vista congelada por tick         │
└──────────────┬─────────────────────────┬─────────────────────────────────┘
               │ Contrato (gap)          │ Patch (parche aplicado en
               ▼                         ▲ frontera de tick)
┌──────────────────────── WORKERS DE FONDO (nadie los espera) ────────────┐
│                                                                          │
│  @anima/forge     tsc incremental · reparador determinista · esbuild     │
│  @anima/judge     smoke → grilla → cuarto reservado · veredictos         │
│  @anima/store     journal append-only · snapshot por delta · IndexedDB   │
└──────────────┬───────────────────────────────────────────────────────────┘
               │ HTTP (streaming, prompt caching, AbortController)
               ▼
┌──────────────────────── apps/api (se CONSERVA) ─────────────────────────┐
│  proxy con CODEX_HOME por pubkey · app-server persistente con reconexión │
└──────────────────────────────────────────────────────────────────────────┘
```

**Por qué la mente vive en el worker del mundo y no en el hilo principal:** las tres propuestas prometían "percepción compartida por referencia entre política, plan, juez y render". Entre hilos **no hay referencias compartidas**: hay `structuredClone` (el costo que dijimos eliminar) o serialización a `TypedArray`. Poniendo lectura, plan, mente y ejecutor del lado del mundo, la percepción se calcula una vez por tick y se comparte por referencia de verdad. Lo único que cruza el límite es el texto del chat (entrada) y los deltas (salida), que son chicos.

---

# El camino de un mensaje

**Presupuestos, no mediciones.** Cada uno se instrumenta desde el Hito 0 y el build falla si se degrada contra la línea base.

## Caso caliente — la habilidad ya está en la biblioteca

*Ejemplo: "andá a pescar al río" con `pescar-con-aparejo` ya promovida (que es el caso normal, ver "biblioteca semilla" más abajo).*

| # | Etapa | p50 | p95 | Notas |
|---|---|---|---|---|
| 1 | `submit` → `mind.inbox.push()` por postMessage | 0.2 ms | 1 ms | **No pasa por el timer del tick.** Hoy son hasta 250 ms de nada |
| 2 | normalizar + caché exacta `fnv1a(texto \| firma de percepción \| versión de léxico)` | 0.1 ms | 0.5 ms | objetivo de cobertura: 30% |
| 3 | `readFast()` — trie + fuzzy sobre el léxico vivo | 2 ms | 6 ms | cobertura acumulada objetivo: 70% |
| 4 | `resolveReference()` — determinista, contra percepción + memoria | 1 ms | 3 ms | portado casi tal cual de `reference-resolver.ts` |
| 5 | `goalGraph()` — cláusulas → grafo con orden parcial y ligaduras | 0.3 ms | 1 ms | |
| 6 | `plan()` anytime, techo duro | 3 ms | 8 ms | guarda la frontera entre ticks |
| 7 | instanciar la habilidad (bytecode cacheado en IndexedDB) | 1 ms | 4 ms | |
| 8 | **acuse por canal de HABLA** | — | — | se pinta en el **mismo frame** que el mensaje del usuario. Cuesta 0 en el camino de acción |
| 9 | encolar `Intent` + forzar tick (no esperar el timer) | 0 ms | 33 ms | un tick a 30 Hz, único componente irreducible |
| 10 | `stepWorld` | 1.5 ms | 4 ms | |
| 11 | `WorldDelta` → render | 4 ms | 16 ms | un frame |
| | **Total hasta movimiento visible** | **~13 ms** | **~77 ms** | objetivo de producto: **p95 < 150 ms** |

## Caso frío — no existe la habilidad, hay que escribirla

*Y acá va la honestidad que las tres propuestas escondieron: los números lindos eran todos del caso caliente, y la demo es el caso frío.*

| # | Etapa | p50 | p95 | Notas |
|---|---|---|---|---|
| 1-5 | idéntico al caliente | ~4 ms | ~12 ms | |
| 6 | `plan()` devuelve `{ gap, nearest }` | 3 ms | 8 ms | |
| 7 | emitir el prefijo `nearest` (todo `reversible`) | 0.5 ms | 2 ms | **el cuerpo ya se mueve** |
| 8 | habla: *"voy juntando lo que veo mientras pienso cómo se hace"* | 0 ms | 0 ms | |
| | **Movimiento visible** | **~15 ms** | **~80 ms** | igual que el caliente |
| 9 | disparar consulta (K=2 candidatas, streaming, prefijo cacheado) | 0 ms | 0 ms | asíncrona |
| 10 | **TTFT con prompt cache caliente** | 400 ms | 900 ms | requiere warm-up al montar la sesión |
| 10' | *TTFT con cache fría (primera consulta de la sesión)* | *1.5 s* | *3.5 s* | por eso el warm-up |
| 11 | generar 2 candidatas de ~400 tokens a 40-80 tok/s | 6 s | 18 s | |
| 12 | typecheck incremental (`Program` tibio) | 90 ms | 250 ms | |
| 12' | *typecheck en frío (crear `Program` con `lib.d.ts`)* | *600 ms* | *2.5 s* | por eso la precarga del toolchain al montar |
| 13 | reparador determinista + `admit()` | 8 ms | 60 ms | 10 reparaciones sin gastar viaje |
| 14 | smoke: 4 mundos estadificados × 120 ticks | 25 ms | 90 ms | |
| 15 | hot-swap del drive (el `Blackboard` sobrevive) | 2 ms | 8 ms | |
| | **Total hasta acción PERTINENTE** | **~7 s** | **~22 s** | y hay que decirlo así |

**Dos métricas de producto, no una.** `msHastaPrimerMovimiento` (p95 < 150 ms) y `msHastaAcciónPertinente` (frío: segundos, y se muestra en la UI como progreso honesto). Y una tercera que ninguna propuesta tenía y que es la que decide si el preposicionamiento funciona o parece estupidez:

```
consistenciaDelPrimerGesto = órdenes donde el primer gesto fue coherente
                             con la conducta final / órdenes totales
```

Si está por debajo de 0.85, la especulación está regalando torpeza y hay que subir el umbral de confianza.

**Reglas del camino:**

- **Multiplexado:** tres mensajes seguidos se procesan los tres en el mismo instante (`while`, no `shift`). Hoy escribir rápido empeora la latencia.
- **Corte a los 25 ms:** si las etapas 1-6 se pasan, se corta y sale la intención de aproximación. No existe rama que devuelva "nada".
- **Especulación acotada por reversibilidad:** solo se especula con `reversible`. El último paso `irreversible` de un plan espera la confirmación del carril lento, que para entonces ya llegó porque caminar hasta el río tarda más que la consulta.
- **Nada estético en el camino crítico:** dibujar un glifo y bautizar una sustancia son cola de prioridad cero, con placeholder procedural inmediato. Hoy `drawWhatIsInSight` corre **antes** de continuar la actividad que el usuario pidió.

---

# El mundo: materia, propiedades y procesos

## Modelo de datos

```ts
// ─── @anima/physics/quality.ts ───────────────────────────────────────────
// El ÚNICO vocabulario cerrado del sistema, y es física, no objetos.

export interface QualitySpec {
  id: QualityId;
  range: readonly [number, number];
  extent: 'intensive' | 'extensive';     // temperatura vs masa
  conserved: boolean;                    // su suma total no puede aumentar
  relaxesTo?: { target: 'ambient' | number; perTick: number };
  derived?: QualityExpr;                 // si está, no se guarda: se calcula
}

// Conservadas (4): mass, nutrition, stamina, fuelEnergy
// Con ley (14): temperature, ignitionPoint, moisture, oxygen, charred,
//               rigidity, toughness, flexibility, tensile, sharpness,
//               cohesion, digestibility, toxicity, decay
// Derivadas (8): reach, catch, calories, solid, portable, footing,
//                emitsPower, heatCapacity

export type QualityExpr =
  | { k: 'const'; v: number }
  | { k: 'own'; q: QualityId }
  | { k: 'sumParts'; q: QualityId }
  | { k: 'maxParts'; q: QualityId }
  | { k: 'geom'; f: 'longestAxis' | 'freeStrandEnds' | 'jointCount' }
  | { k: 'op'; f: '+' | '-' | '*' | '/' | 'min' | 'max' | 'step';
      a: QualityExpr; b: QualityExpr };
```

```ts
// ─── @anima/physics/substance.ts ─────────────────────────────────────────
// ABIERTO: el oráculo agrega cuantas quiera. No trae tabla de transiciones.

export interface Substance {
  id: SubstanceId;
  lexeme: Lexeme;                        // nombre, género, sinónimos
  tags: readonly Tag[];                  // 'organico' 'vegetal' 'mineral'
                                         // 'fibroso' 'carnoso' 'carbonoso'
  perUnitMass: QualityVector;
  specificHeat: number;                  // J-equivalente por unidad de masa
  provenance: Provenance;
}
```

> **Diferencia con las tres propuestas:** ninguna sustancia trae `transitions: [{ under: ProcessId, into: SubstanceId, ... }]`. Eso era la tabla de recetas indexada al revés, y lo señaló la crítica: el costo de autoría es el mismo o peor (N sustancias × 11 procesos en vez de M recetas), y una sustancia nueva del dios no se comporta bien hasta que alguien le escribe su fila. Acá las transiciones se resuelven **por tag**, una sola vez, y una sustancia nueva funciona sin fila propia.

```ts
// ─── @anima/physics/body.ts ──────────────────────────────────────────────
// Un cuerpo NO tiene `kind`. Tiene forma, partes y juntas.

export const MAX_PARTS = 6;              // cota dura, decidida acá y no
export const MAX_JOINTS = 8;             // como "mitigación de riesgo"
export const MAX_ASSEMBLY_DEPTH = 2;

export interface Body {
  id: BodyId;
  form: FormId;                          // 'vara' 'hebra' 'filete' 'malla'
  parts: readonly Part[];                // ≤ MAX_PARTS
  joints: readonly Joint[];              // ≤ MAX_JOINTS
  state: QualityVector;
  at: Placement;
  supportedBy?: BodyId;                  // ← la parrilla vive acá
}

export interface Part { substance: SubstanceId; mass: number; q: QualityVector }
export interface Joint { a: number; b: number; via: JoinId; strength: number }

export function qualityOf(b: Body, q: QualityId, phys: Physics): number;
export function nameOf(b: Body, phys: Physics, lex: Lexicon): string;
// 'pescado crudo' / 'pescado asado' / 'pescado quemado' son el MISMO cuerpo
// con distinta cocción. Nombrar es una vista, no un tipo.
```

```ts
// ─── @anima/process/process.ts ───────────────────────────────────────────

export interface Process {
  id: ProcessId;
  lexeme: Lexeme;
  roles: readonly Role[];                // predicados sobre CUALIDADES
  arrangement: { k: 'contact' } | { k: 'within'; radius: number }
             | { k: 'held' } | { k: 'supported' } | { k: 'inside' };
  gate: readonly QualityTest[];
  effects: readonly Effect[];
  completion?: { at: number; yields: readonly Yield[] };
  establishes: readonly PredicateSignature[];  // ← lo que el planificador indexa
  commitment: Commitment;                       // reversible | costly | irreversible
  trust: 'borrador' | 'provisional' | 'estable';
  physicsVersion: number;                       // ← invalida sellos al recalibrar
  provenance: Provenance;
}

export type Effect =
  | { k: 'drain';    q: QualityId; on: RoleName; perTick: number }
  | { k: 'drive';    q: QualityId; on: RoleName; toward: number; perTick: number;
      poweredBy?: { from: RoleName; q: QualityId; efficiency: number } }
  | { k: 'transfer'; q: QualityId; from: RoleName; to: RoleName; perTick: number }
  | { k: 'couple';   q: QualityId; on: RoleName;
      follows: { q: QualityId; of: RoleName; inverse?: boolean }; curve: CurveId };

export type Yield =
  | { k: 'transmute'; role: RoleName }   // resuelve por TAG, no por tabla
  | { k: 'join'; a: RoleName; b: RoleName; via: RoleName; type: JoinId }
  | { k: 'split'; role: RoleName; at: 'joint' | 'grain' }
  | { k: 'drawFromStock'; of: RoleName; into: 'hands' | 'ground-adjacent' };
```

## Las once leyes (enumeradas, porque un catálogo cerrado que no está escrito no se puede auditar)

| # | Ley | Qué hace | Por qué existe |
|---|---|---|---|
| 1 | `termica` | transferencia de calor con `heatCapacity = mass × specificHeat`, modulada por distancia, contacto y **soporte** | sin esto, la fogata sube el pescado 7 °C y no cocina nunca |
| 2 | `friccion` | única fuente primordial de calor: drena `stamina` (conservada) y sube `temperature` | sin esto, el primer fuego de la partida es imposible |
| 3 | `combustion` | un cuerpo ardiendo drena `fuelEnergy` al campo térmico, sube `charred`, pierde masa; modulada por `oxygen` de la celda | es lo que calienta a la criatura: se murió `heatSource` como componente |
| 4 | `transmutacion` | a `charred ≥ 0.8`: con oxígeno bajo → residuo carbonoso; con oxígeno alto → mineral | **la ley que hace el carbón, sin la palabra "carbón"** |
| 5 | `desnaturalizacion` | sobre `organico` entre su punto de desnaturalización y el de pirólisis: sube `digestibility`, baja `toxicity` y `decay`, evapora `moisture` | **la ley que hace el pescado asado** |
| 6 | `descomposicion` | `decay` sube con humedad y temperatura, baja `nutrition` y sube `toxicity` | el pescado que se guarda se pudre; el asado dura más |
| 7 | `union` | juntas entre cuerpos con `strength = f(tensile, cohesion)` | **la ley que hace la caña** |
| 8 | `estructura` | colisión, apoyo, rotura por tensión, `supportedBy` | la parrilla sostiene; el ensamble se puede romper |
| 9 | `extraccion` | sacar de un stock del dios, probabilidad derivada de `reach` y `catch` del aparejo | **la ley que hace pescar** |
| 10 | `metabolismo` | `stamina`, hambre, temperatura corporal; la cuenta conservada desde la que se paga todo trabajo | el motor de la historia |
| 11 | `humedad` | agua moja lo que toca, la humedad divide la inflamabilidad, el sol y el fuego secan | sin esto, una fogata en la orilla del río nunca se apaga |

**Once, no ocho.** Las propuestas estimaban ocho o nueve y las críticas mostraron que los tres ejemplos del usuario ya exigen soporte, humedad e ignición. Cada ley nueva multiplica la superficie de calibración: esto es la parte cara del proyecto y son semanas de perilla, no días.

> **DOCE, NO ONCE.** El [ADR II-0002](../../ii/docs/decisions/II-0002-la-ley-de-la-oclusion.md)
> agrega la **ley 12, `oclusion`**: un cuerpo colocado sobre una celda reduce el
> intercambio de esa celda con el ambiente, en proporción a cuánto la cubre y a
> qué tan permeable es.
>
> No es física nueva: **es la ley que la ley 4 ya invocaba sin declarar.** La
> transmutación lee `w.oxygenAt(b.at)` y nadie escribía qué bajaba ese número, así
> que tapar la fogata no tenía efecto en ninguna parte y la técnica emblema de
> toda esta arquitectura —hacer carbón— era imposible.
>
> Una ley, tres capacidades: **carbón** (baja el oxígeno de la celda), **reparo**
> (baja el acoplamiento térmico con el ambiente) y **techo** (baja el aporte de
> humedad). Y le da función real a la malla y al tejido vía `permeability`, que
> hasta ahora eran formas sin consecuencia.

## La puerta: `admit()`

```ts
export function admit(p: Process, phys: Physics): Verdict {
  // 1. CONSERVACIÓN — solo sobre entradas CONSUMIDAS.
  //    `consume` NO lo escribe el modelo: se deriva de si la salida hereda
  //    masa de la entrada. Ésta era la bomba de materia de una línea:
  //    `consume: false` hacía que una entrada intacta contara como aporte
  //    y la masa se duplicaba en bucle.
  for (const q of phys.conserved) {
    const dentro = sum(consumedInputs(p), q);
    const fuera  = sum(p.completion?.yields ?? [], q);
    if (fuera > dentro + EPS) return no(`${q}: sale ${fuera}, entra ${dentro}`);
  }

  // 2. NADA SUBE GRATIS — la regla que cierra las máquinas de movimiento
  //    perpetuo. Sin esto, 'frotar dos piedras' produce calor infinito y
  //    el hambre deja de doler en el tick 300.
  for (const e of p.effects) {
    if (e.k !== 'drive') continue;
    if (e.toward <= currentBound(e.q, e.on)) continue;      // baja: libre
    if (!e.poweredBy) return no(`${e.q} sube sin fuente de energía`);
    if (!phys.spec(e.poweredBy.q).conserved)
      return no(`${e.poweredBy.q} no es una cuenta conservada`);
    if (e.poweredBy.efficiency > MAX_EFFICIENCY)
      return no(`eficiencia ${e.poweredBy.efficiency} > ${MAX_EFFICIENCY}`);
  }

  // 3. ENVOLVENTES POR TAG — algo `organico` no puede tener el poder
  //    calorífico del plutonio.
  for (const y of p.completion?.yields ?? [])
    if (!withinTagEnvelope(y, phys)) return no(`fuera de envolvente para ${y.tags}`);

  // 4. CIERRE DIMENSIONAL, COTAS DE RANGO, NO-DOMINANCIA, REALIZABILIDAD.
  // 5. CICLOS RENTABLES — se corre sobre el grafo completo de procesos cada
  //    vez que entra uno nuevo. Si A→B→A deja saldo positivo en alguna
  //    cualidad conservada, se rechaza. Como PUERTA, no como auditoría.
  if (hasProfitableCycle(phys.processes.concat(p))) return no('ciclo rentable');

  return yes();
}
```

Costo: ~0.2 ms para las reglas 1-4, ~5 ms para la 5 (que corre en el worker de la fragua, no en el tick).

## Los tres ejemplos, paso a paso

### (a) Palo quemado → carbón

**Datos** (tabla de materiales, `packages/physics/data/`):

```ts
madera: { tags: ['organico','vegetal','fibroso'], specificHeat: 1.7,
          perUnitMass: { fuelEnergy: 18, ignitionPoint: 300, moisture: 0.25,
                         rigidity: 0.70, flexibility: 0.20, nutrition: 0 } }
```

**Paso 1 — ignición.** No hay nada caliente en un mundo decretado por ruido. Ánima aplica `friccion` con dos varas rígidas en las manos:

```ts
{ id: 'friccion',
  roles: [ { name: 'a',     where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
           { name: 'b',     where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
           { name: 'actor', where: [{ q: 'stamina',  op: '>=', v: 1 }] } ],
  arrangement: { k: 'held' },
  effects: [
    { k: 'drive', q: 'temperature', on: 'a', toward: 400, perTick: 6,
      poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.35 } } ],
  commitment: 'reversible' }
```

60 ticks (2 s a 30 Hz) llevan la madera de 15 a 375 °C y cuestan 48 de `stamina`. **El fuego cuesta.** Con hambre y poca energía, no puede: eso es la distancia entre querer y poder hecha aritmética.

**Paso 2 — combustión.** A `temperature ≥ ignitionPoint` y `moisture < 0.45`, la ley 3 la pone `ardiendo`: drena `fuelEnergy` al campo térmico (`emitsPower ≈ 300`), sube `charred`, pierde masa.

**Paso 3 — transmutación por tag, no por tabla.**

```ts
export const TRANSMUTACION: TagRule = {
  id: 'transmutacion',
  when: [{ q: 'charred', op: '>=', v: 0.8 }],
  resolve(b: Body, w: World): Transmutation | null {
    const s = w.substanceOf(b);
    const oxi = w.oxygenAt(b.at);                    // baja si está tapado
    if (!s.tags.includes('organico')) return null;   // el mineral no arde
    const carbonoso = oxi < 0.35;
    return {
      into: residueFor(s, carbonoso ? 'carbonoso' : 'mineral'),
      massFraction: carbonoso ? 0.28 : 0.06,
      carries: { fuelEnergy: 1.6, rigidity: 0.3, nutrition: 0 },
    };
  },
};
```

`residueFor` deriva del **tag** de la sustancia, no de una fila. Un hongo nuevo que el dios inventó ayer se piroliza igual, sin que nadie le escriba nada.

**Consecuencias que nadie escribió:** una silla de madera da carbón proporcional a su masa. La leña mojada no prende hasta secarse (ley 11). Una fogata **tapada** da carbón y una al aire libre da ceniza — o sea, *hacer carbón es una técnica que la criatura puede descubrir*, no un caso especial. Y el carbón producido no se autodestruye, porque tapado el oxígeno de la celda está bajo y no vuelve a arder: eso era el bug del ejemplo (a) de una de las propuestas, donde el carbón nacía adentro del fuego y se convertía en ceniza sola.

### (b) Pescado crudo → asado, comestible, con otras propiedades

```ts
carne: { tags: ['organico','carnoso'], specificHeat: 3.5,
         perUnitMass: { nutrition: 9, digestibility: 0.35, toxicity: 0.30,
                        moisture: 0.72, fuelEnergy: 2, ignitionPoint: 280,
                        denaturesAt: 63 } }
```

**La aritmética térmica, que es donde una de las propuestas se rompió.** Fogata con `emitsPower = 300`. Pérdida al ambiente `h = 0.5`. Temperatura de equilibrio del pescado:

```
T_eq = T_ambiente + (emitsPower × formFactor(d, soporte)) / h
```

> **CORREGIDO EN EL HITO 0** — ver
> [`ii/docs/hito-0-barrido-termico.md`](../../ii/docs/hito-0-barrido-termico.md).
> La tabla de abajo **no es una tabla**: las cuatro filas son la misma función
> evaluada en cuatro puntos, y reproduce los cuatro números exactos.
>
> ```
> formFactor(d, montaje) = exposicion(montaje) / (1 + d²)
> exposicion:  piso 0.06  ·  parrilla 0.25  ·  contacto 0.60
> ```
>
> `exposicion` es una enumeración **cerrada** de relaciones espaciales, no una
> fila por situación. La auditoría acusaba a esta tabla de ser «la tabla de
> recetas disfrazada, pero en la ley 1»; era falso, y queda corregido acá.

| Situación | formFactor | T_eq | Resultado |
|---|---|---|---|
| en el piso a 2 celdas | `0.06/(1+4) = 0.012` | 15 + 7 = **22 °C** | no cocina (< 63) |
| en el piso a 1 celda | `0.06/(1+1) = 0.03` | 15 + 18 = **33 °C** | no cocina |
| en contacto con las brasas | `0.60` | 15 + 360 = **375 °C** | se quema (> 280) |
| **sobre parrilla, `supportedBy`, d=1** | `0.25/(1+1) = 0.125` | 15 + 75 = **90 °C** | **cocina y no se quema** |

**La parrilla gana función real** porque la ley 8 (`estructura`/`supportedBy`) le pasa a la ley 1 (`termica`) un `formFactor` estable a distancia fija. Sin la ley de soporte, cocinar era "estar parado en el anillo tibio" y la parrilla era un adorno que el usuario podía sacar sin que cambiara nada. Ése era el agujero del ejemplo (b) en dos de las tres propuestas.

**Paso a paso.** A 90 °C entra la ley 5 con `k = (90 - 63)/100 = 0.27`:

```ts
export const DESNATURALIZACION: TagRule = {
  id: 'desnaturalizacion',
  appliesTo: ['organico'],
  step(b, w, phys) {
    const s = phys.substanceOf(b);
    const T = q(b, 'temperature');
    if (s.denaturesAt === undefined) return;
    if (T < s.denaturesAt || T >= q(b, 'ignitionPoint')) return;
    const k = (T - s.denaturesAt) / 100;
    const dur = q(b, 'toughness');
    drive(b, 'digestibility', /*hacia*/ 0.95, /*tasa*/ 0.010 * k / (0.2 + dur));
    decay(b, 'toxicity', 0.030 * k);
    decay(b, 'decay',    0.008 * k);
    // CORREGIDO EN EL HITO 0: el exponente 2 no es un tipeo. Con `0.0006 * k`,
    // el agua perdida por unidad de progreso de cocción es evap/r =
    // 0.06·(0.2+toughness), que NO depende de la temperatura — así que más
    // caliente es SIEMPRE estrictamente mejor y cocinar deja de ser una técnica
    // para volverse «hacé el fuego más grande que puedas». Es una degeneración
    // matemática de estas dos fórmulas, y no se ve leyendo: se ve dividiendo una
    // por otra. Desnaturalizar una proteína y evaporar agua son dos procesos con
    // energías de activación distintas; la evaporación escala más rápido.
    // Con k², aparece la tensión «comer antes o comer mejor».
    // Ver ii/docs/hito-0-barrido-termico.md.
    const evap = Math.min(q(b, 'moisture'), 0.0006 * k * k);
    sub(b, 'moisture', evap); scale(b, 'mass', 1 - evap);   // se va agua, NO nutrientes
  },
};
```

En ~300 ticks (10 s) sobre la parrilla: `digestibility` 0.35 → 0.91, `toxicity` 0.30 → ~0.01.

**Comer es una función derivada, no un permiso:**

```ts
export function calories(b: Body, phys: Physics): number {
  return qualityOf(b, 'nutrition', phys)
       * qualityOf(b, 'mass', phys)
       * qualityOf(b, 'digestibility', phys);
}
// `eat` SIEMPRE está permitido. Lo que varía es cuánto rinde y cuánto enferma.
// energía += calories(b);  salud -= toxicity(b) × K;
```

- Crudo: `9 × 0.4 × 0.35 = 1.26` y hace daño por toxicidad.
- Asado: `9 × 0.33 × 0.91 = 2.70` y no enferma. **Duplica largo el rendimiento.**
- Olvidado sobre las brasas: pasa 280 °C, entra la ley 3, `charred` sube, `nutrition` se va a cero. El mundo no negocia.

**Esto resuelve la tensión que el ADR 0018 resolvió cerrando la puerta.** Ánima **puede** hacer pescado asado comestible. **No puede** inventar madera nutritiva: la madera tiene `nutrition: 0` y ninguna ley puede subir una cualidad conservada. Se van `INVENTED_COMPONENT_BOUNDS` (que no admitía `edible` ni `nutrition`), `PROTECTED_KINDS` (protección por string repetida en cinco archivos) y `edible` como permiso.

### (c) Palo + hilo → caña, y pescar

**Primero el hilo, que ninguna propuesta explicaba de dónde salía.** Proceso `DESHILACHAR`:

```ts
{ id: 'deshilachar',
  roles: [{ name: 'source', where: [{ q: 'fibrous', op: '>=', v: 0.5 }] },
          { name: 'actor',  where: [{ q: 'stamina', op: '>=', v: 3 }] }],
  arrangement: { k: 'held' },
  effects: [{ k: 'drain', q: 'stamina', on: 'actor', perTick: 0.1 }],
  completion: { at: 40, yields: [{ k: 'split', role: 'source', at: 'grain' }] },
  establishes: ['flexibility>=0.8 & tensile>=0.3'],
  commitment: 'costly' }
```

Sirve el matorral, la corteza, el tendón, la liana: cualquier cosa `fibrous`.

**La caña.** `UNION` no produce un tipo nuevo: produce un cuerpo compuesto.

```ts
{ id: 'union',
  roles: [
    { name: 'binder', where: [{ q: 'flexibility', op: '>=', v: 0.8 },
                              { q: 'tensile',     op: '>=', v: 0.3 }] },
    { name: 'a',      where: [] },
    { name: 'b',      where: [] } ],
  arrangement: { k: 'held' },
  completion: { at: 20,
    yields: [{ k: 'join', a: 'a', b: 'b', via: 'binder', type: 'atadura' }] },
  establishes: ['freeStrandEnds>=1', 'reach>=2'],
  commitment: 'reversible' }
```

Y las afordancias salen de **cualidades derivadas de la geometría de partes**:

```ts
reach: { k: 'geom', f: 'longestAxis' }
catch: { k: 'op', f: '*',
         a: { k: 'geom', f: 'freeStrandEnds' },
         b: { k: 'op', f: '+', a: { k: 'const', v: 0.15 },
                               b: { k: 'op', f: '*',
                                    a: { k: 'maxParts', q: 'sharpness' },
                                    b: { k: 'const', v: 0.5 } } } }
```

**Nadie escribió "caña".** Califica cualquier cosa larga con una hebra flexible colgando: un palo con una liana, un hueso con un tendón. Si además la punta tiene filo (un anzuelo de espina), `catch` sube. Eso es la emergencia que el requisito 3 pide, y es la razón de que el LLM tenga que escribir mucho menos.

**Lo que se descartó acá:** la idea de que una red emerja sola por una cualidad `apertureArea` derivada de la topología del ensamble. La crítica tiene razón: calcular el área de apertura de un grafo arbitrario de hebras es detección de ciclos planares, o sea un motor de geometría, o sea un caso especial cableado con otro nombre. La malla existe como `form: 'malla'` con un **esquema de construcción declarado a mano** — y se dice que es conocimiento humano, no consecuencia de las leyes.

**Pescar.** `EXTRACCION` sobre un stock del dios:

```ts
{ id: 'extraccion',
  roles: [ { name: 'gear',   where: [{ q: 'reach', op: '>=', v: 2 },
                                     { q: 'catch', op: '>',  v: 0 }] },
           { name: 'source', where: [{ q: 'stock', op: '>',  v: 0 }] } ],
  arrangement: { k: 'within', radius: 1 },
  completion: { at: 30, yields: [{ k: 'drawFromStock', of: 'source', into: 'hands' }] },
  establishes: ['holding(tag:carnoso)'],
  commitment: 'costly' }
```

A mano (`reach = 0`) no califica el rol: no se puede. Con caña sí. Con lanza también (`reach` + `sharpness`). Y el río **se agota**: `stock.amount--`, y se repone a la tasa del bioma. La criatura no puede pedirle comida infinita al mundo.

## Por qué ninguno está hardcodeado

**Y por qué la prueba de aceptación NO es un grep.** Una de las propuestas ofrecía `grep -ri 'fogata|caña|carbon|asado' packages/*/src` = 0, y la crítica lo desarmó: da cero porque los datos viven en `packages/physics/data/`, que no matchea el glob. Es un test que se pasa moviendo un archivo.

La prueba real es **semántica**:

```ts
test('una sustancia nueva del oráculo se comporta sin fila propia', () => {
  const s = oracle.novelSubstance({ tags: ['organico','carnoso'], seed: 42 });
  const b = spawnBody({ substance: s.id, form: 'filete', mass: 0.5 });
  const fogata = spawnBurning();
  const parrilla = spawnSupport({ over: fogata, height: 1 });
  place(b, { supportedBy: parrilla.id });
  run(world, 400);
  expect(calories(b)).toBeGreaterThan(2 * calories(rawCopy));   // se cocinó
  expect(q(b, 'toxicity')).toBeLessThan(0.05);                  // se desinfectó
  run(world, 2000);
  expect(q(b, 'charred')).toBeGreaterThan(0.8);                 // se quemó
  expect(calories(b)).toBe(0);                                  // el mundo no negocia
});
```

Ninguna línea de ese test menciona una sustancia por nombre. Si pasa, la emergencia es real. Si falla, la tabla de sustancias es una tabla de recetas disfrazada — que es exactamente el pecado que las críticas encontraron en las tres propuestas.

---

# El dios perezoso

## La regla madre

**La respuesta a una pregunta no depende de cuándo ni en qué orden se preguntó.** El ledger no es la fuente del determinismo (eso sería frágil): es la autoridad para lo que la ley no puede reproducir, más una caché.

Esto mata de raíz la falla que una crítica encontró: pre-decretar regiones "en el tiempo ocioso entre ticks" y dejarlas reponiendo por tick hace que la población de un río dependa del reloj de pared y de si el Taller estaba compilando. Misma semilla, mismas órdenes, dos mundos distintos.

## Nivel 1 — la ley (99% de las preguntas, ~0 ms, pura)

```ts
export type Question =
  | { k: 'chunk';     cx: number; cy: number }
  | { k: 'waterBody'; id: WaterBodyId }        // componente CONEXA, no celda
  | { k: 'draw';      stock: StockId; n: number }
  | { k: 'novelty';   topic: string; nonce: number };

export function keyOf(q: Question): string {   // canónica, ordenada, estable
  switch (q.k) {
    case 'chunk':     return `c:${q.cx}:${q.cy}`;
    case 'waterBody': return `w:${q.id}`;
    case 'draw':      return `d:${q.stock}:${q.n}`;
    case 'novelty':   return `n:${q.topic}:${q.nonce}`;
  }
}

// DiosRng es un tipo NOMINAL distinto de WorldRng. El decretador no tiene
// acceso léxico al dado del mundo. Es barato de prevenir y carísimo de
// descubrir seis meses después, cuando un guardado no reproduce.
export function rngFor(q: Question, seed: bigint): DiosRng {
  return mulberry32(fnv1a(`${seed}|${keyOf(q)}`)) as DiosRng;
}

export function resolveChunk(seed: bigint, cx: number, cy: number): ChunkFacts {
  const rng = rngFor({ k: 'chunk', cx, cy }, seed);
  const humedad    = valueNoise(seed ^ 0xA1n, cx, cy);
  const fertilidad = valueNoise(seed ^ 0xB2n, cx, cy);
  const altura     = valueNoise(seed ^ 0xC3n, cx, cy);
  const bioma      = biomaPorClima(humedad, fertilidad, altura);
  return {
    bioma,
    terreno:   terrainFor(bioma, rng),
    sustancias: bioma.substances,
    sueltas:   scatter(bioma, fertilidad, rng),
    presupuestoCalorico: caloricBudget(bioma, fertilidad),  // ← tope del dios
  };
}
```

Dos partidas con la misma semilla ven el mismo río con la misma población. Re-preguntar es idempotente **por construcción**, no por memoria.

## La reposición se integra perezosamente, no por tick

```ts
export interface Stock {
  id: StockId;
  yields: SubstanceId;
  capacity: number;
  perMilleTick: number;   // punto fijo: milésimas de individuo por tick
  atTick: number;
  amount: number;
  depth: number;          // cuánto alcance hace falta para llegar
}

export function population(s: Stock, tick: number): number {
  const crecido = s.amount + Math.floor(s.perMilleTick * (tick - s.atTick) / 1000);
  return Math.min(s.capacity, crecido);
}
```

Materializar el chunk en el tick 40 o en el 398 da **exactamente lo mismo**. Con eso, el pre-decreto del anillo de chunks vecinos en tiempo ocioso vuelve a ser seguro, y ahí está la ventana que el oráculo necesita.

**Regla general que hay que escribir en el CLAUDE.md:** *ningún trabajo de tiempo ocioso puede escribir estado que entre en `hashWorld`.*

## El compromiso, con dos granos

La falla de una de las propuestas era que el disparador de resolución y el de compromiso eran **el mismo evento**, así que el oráculo (que tarda segundos) nunca podía enmendar nada: ventana de ancho cero, nivel oracular = código muerto.

```ts
export type Grain = 'gruesa' | 'fina';

export interface Commitment {
  key: string;
  answer: Answer;
  grain: Grain;
  decidedAtTick: number;
  by: 'ley' | 'oraculo';
  witnessed: boolean;
}

export class Ledger {
  ask<T>(q: Question, byLaw: () => T): T;         // sincrónico, nunca espera
  witness(key: string, grain: Grain): void;       // sella para siempre
  amend(key: string, a: Answer): boolean;         // false si ya hay testigo
  entries(): Iterable<Commitment>;                // append-only, es narrativa
}
```

- **Grano grueso** (hay agua acá, es un bioma de bosque húmedo): compromete **al verlo**.
- **Grano fino** (qué especie vive en este cuerpo de agua, cuánto stock, qué hay adentro de la cueva): compromete **al interactuar** — acercarse, inspeccionar, meter la mano.

El oráculo tiene minutos, y además es mejor ficción: *"de lejos veo agua"* y *"de cerca veo que hay mojarras"* son dos hechos distintos y el juego mejora si lo son.

**Invariante duro, verificado por tick:** escribir una respuesta distinta para una clave existente lanza `InvariantError`. El dios no puede contradecirse porque el motor no lo deja.

**Granularidad por componente conexa** (union-find sobre celdas de agua de los chunks resueltos): no puede haber pescado en un tile y ninguno en el de al lado. El stock es de la población, no del agua.

**Fusión de dos lagos** (el caso difícil): si solo uno tiene testigo, el fusionado hereda su respuesta y el otro se reescribe (nadie lo vio, no hay contradicción posible). Si ambos tienen testigo, siguen siendo **dos stocks lógicos compartiendo agua** — una población no se mezcla instantáneamente porque se juntaron los charcos.

## Nivel 2 — el oráculo (raro, caro, y NO escribe números)

```ts
// El oráculo elige la FORMA y el NOMBRE de la novedad.
// El procedural fija su ECONOMÍA. Es la reparación de la falla más peligrosa
// que tenían las propuestas: "el modelo no puede declarar que la madera
// alimenta" se convertía en "el modelo puede sembrar comida infinita mientras
// la llame terreno".
export function admitNovelty(prop: NoveltyProposal, chunk: ChunkFacts): Answer {
  const base = interpolateFromCatalog(prop.tags, chunk.bioma);  // números del catálogo
  const cap  = chunk.presupuestoCalorico;                        // función pura de la semilla
  return {
    substance: { ...base, lexeme: prop.lexeme, tags: prop.tags },   // nombre: del modelo
    stock: { capacity: Math.min(prop.hint ?? cap, cap), ... },      // economía: del procedural
  };
}
```

Y el invariante de conservación se endurece: `aportadoEsteTick ≤ min(loQuePidióElOráculo, presupuestoCalóricoDelChunk)`. No es un cheque en blanco.

## Regla de resolubilidad

Un mundo decretado por ruido puede no tener con qué armar la caña donde hay río, y el fallo sería **silencioso**: `admit` no falla, el proceso simplemente nunca encuentra entradas y Ánima queda tanteando. El requisito 3 dice literalmente *"con la materia prima que hay EN EL LUGAR"*.

```ts
// Al decretar un chunk con bioma acuático, se garantiza co-presencia en radio 2
// de al menos un insumo por rol de cada proceso CORE que establezca
// 'holding(tag:carnoso)'. Es una restricción del generador, no una plegaria.
function ensureSolvable(chunk: ChunkFacts, core: Process[], rng: DiosRng): void;
```

Y del otro lado, el diagnóstico: cuando falta un rol, el planificador dice *"me falta algo largo y flexible"* (ADR 0052 y 0065, que existen hoy y hay que portar).

## La extracción usa el dado del MUNDO, no el del dios

```ts
export function draw(w: World, s: Stock, gear: Body, tick: number): SubstanceId | null {
  const pob = population(s, tick);
  if (pob <= 0) return null;
  const alcance  = qualityOf(gear, 'reach', w.phys);
  const enganche = qualityOf(gear, 'catch', w.phys);
  const p = clamp01((pob / s.capacity) * enganche * Math.min(1, alcance / s.depth));
  if (w.rng() >= p) return null;          // ← dado del MUNDO: es una acción
  s.amount = pob - 1; s.atTick = tick;
  return s.yields;
}
```

Decidir **qué existe** es del dios. Decidir **si esta vez picó** es del mundo. Esa separación es lo que hace que pensar no le corra el dado a la partida — el mismo razonamiento que hoy hace bien `skill-evaluator/src/seeds.ts` y que hay que conservar.

## Ver agua no revela el stock

La percepción entrega la **forma** del cuerpo de agua y la cualidad `wet` de las celdas. El stock se resuelve la primera vez que alguien pesca o inspecciona de cerca. La expectativa —"probablemente haya pescado"— es **creencia de la criatura**, no dato del mundo, y por eso puede equivocarse.

Que a veces no haya pescado es exactamente lo que hace que la vez que sí hay valga algo.

---

# La mente: cómo decide sin pensar (y cómo piensa sin frenar)

## La escalera de decisión

Cada peldaño tiene presupuesto duro y se corta al agotarlo. **Nunca se baja del último peldaño sin una intención.**

| Peldaño | Qué es | Presupuesto | Cobertura acumulada |
|---|---|---|---|
| **D0** | reflejo (tabla estática: dolor, caída, fuego encima) | 5 µs | — |
| **D1** | continuar la actividad en curso si sigue válida | 20 µs | ~60% de los ticks |
| **D2** | drive asignado por el chat (histéresis: margen 0.15, permanencia 8 ticks) | 50 µs | |
| **D3** | `opportunities()` — necesidad × creencia β × escasez | 1 ms | |
| **D4** | `plan()` anytime sobre el grafo de procesos, frontera guardada entre ticks | 8 ms | |
| **D5** | conducta de fondo (deambular, recolectar lo útil, guarecerse) | 10 µs | **100%, siempre** |

Y el **carril lento**, que corre en paralelo y no bloquea nada:

| Peldaño | Qué es | Latencia | Efecto |
|---|---|---|---|
| **L0** | caché exacta de lectura | 0.1 ms | 30% de los mensajes |
| **L1** | `readFast` — trie + fuzzy sobre el léxico vivo | 3 ms | 70% acumulado |
| **L2** | plantilla parametrizable de la biblioteca | 5 ms | 85% acumulado |
| **L3** | modelo chico: corrige la lectura | 400-900 ms | hot-swap del drive |
| **L4** | modelo grande: escribe código | 6-25 s | hot-swap de la habilidad |

**Lo que se descartó:** el carril de embeddings locales en el arranque. Un modelo int8 de ~20-30 MB en el camino de la primera frase de la sesión no cuesta 2 ms sino entre 200 y 900 ms de carga y warm-up, y encima suma 30 MB al arranque de página que ninguna propuesta presupuestaba. Se reemplaza por BM25 sobre nombres, sinónimos y descripciones de habilidades — que resuelve el grueso de "buscá algo para comer" sin bajar nada — y los embeddings quedan como mejora perezosa que se carga en segundo plano y se saltea si no está lista.

## De objetivo a sub-objetivos (el requisito 6)

**Ninguna de las tres propuestas tenía esta capa.** Una devolvía un predicado; otra arbitraba prioridades (que no es lo mismo); la tercera escribía un módulo por contrato. Y el repo actual **sí lo tiene** (ADR 0053, 0082, 0083, 0085), así que tirarlo sin reemplazo era una regresión.

```ts
export interface GoalNode {
  id: GoalId;
  goal: Predicate;                       // predicado sobre el estado del mundo
  after: readonly GoalId[];              // orden parcial
  binds?: { slot: string; from: GoalId }; // ← referencia DIFERIDA
  temporal?: GoalTemporal;               // ADR 0085: startWhen / until / plazo
}

export function goalGraph(reading: Reading, view: PerceptionView): GoalNode[];
```

Tres piezas:

**1. Descomposición conjuntiva determinista.** La gramática separa cláusulas. *"hacé una caña y andá a pescar, después asá el pescado"* produce tres nodos con orden parcial. Cuesta microsegundos.

**2. Ligadura de referencia diferida.** *"el pescado"* de la tercera cláusula **no existe** cuando se lee la frase. `resolveReference` devuelve `missing` — correcto y bueno, pero fatal si nadie lo maneja. Se liga al `yield` del nodo anterior: `binds: { slot: 'target', from: 'g2' }`. Es el ADR 0082 portado, no redescubierto.

**3. Encadenado hacia atrás sobre `establishes`.** Si un nodo requiere un predicado que ningún proceso ni habilidad satisface, se emite automáticamente un sub-nodo cuyo objetivo es ese predicado. Regression planning clásico sobre los manifiestos.

## `plan()` en 8 ms: el precio honesto

La crítica más aguda del corpus fue ésta: regresar `catch > 0 ∧ reach ≥ 2` a través de un `yield: join` exige **invertir** una `QualityExpr` geométrica sobre el espacio de ensambles posibles. Eso no es regresión, es síntesis constructiva con ramificación combinatoria, y no entra en 8 ms.

La reparación, y hay que decirla con todas las letras:

```ts
// Cada proceso PUBLICA qué predicados puede establecer y con qué forma.
// Esto es CONOCIMIENTO HUMANO SOBRE LAS LEYES, no una consecuencia de ellas.
// El catálogo cerrado no son 22 cualidades y 11 procesos: son 22 + 11 + N
// esquemas de construcción. Decirlo ahora es más barato que descubrirlo
// en el hito 5.
export interface ConstructionSchema {
  establishes: PredicateSignature;       // 'catch>0 & reach>=2'
  via: ProcessId;                        // 'union'
  roleHints: Record<RoleName, Where>;    // binder: fibra flexible; a: vara larga
  estimatedTicks: number;
}

export const SCHEMA_INDEX: Map<PredicateSignature, ConstructionSchema[]>;

export function plan(g: GoalNode, v: PerceptionView, budgetMs: number): PlanResult;
export type PlanResult =
  | { k: 'plan'; steps: Step[] }
  | { k: 'gap'; missing: Predicate; nearest: Step[]; why: string };
```

Con el índice, `plan()` es una regresión ordinaria sobre un grafo con factor de ramificación acotado, y sí entra en 8 ms. Sin él, no entra en ningún presupuesto.

**Corolario de diseño:** cuando la fragua escribe un proceso nuevo, tiene que declarar su `establishes`. El juez lo **verifica por ablación** (ver más abajo) antes de aceptarlo en el índice.

## El ejemplo: "tengo hambre, veo un río, probablemente haya pescado"

Cero llamadas al modelo. ~1.2 ms en total.

```ts
export interface AffordanceMemory {
  belief(ctx: ContextKey, yields: SubstanceTag): Beta;     // {a, b}
  observe(ctx: ContextKey, yields: SubstanceTag, ok: boolean): void;
  seed(ctx: ContextKey, yields: SubstanceTag, prior: Beta,
       by: 'instinto' | 'modelo'): void;
}

export function opportunities(
  v: PerceptionView, m: AffordanceMemory, need: NeedVector,
): Opportunity[] {
  const out: Opportunity[] = [];
  for (const f of v.features) {                    // biomas y cuerpos a la vista
    for (const tag of m.tagsSeenIn(f.ctx)) {
      const β = m.belief(f.ctx, tag);
      const p = β.a / (β.a + β.b);                 // media del posterior
      const sat = satisfaction(need, tag);         // cuánto calma el hambre
      const cost = estimateTicks(f, v);
      if (sat <= 0) continue;
      out.push({ goal: holdingOf(tag), value: p * sat / cost, why:
        `creo que ${f.name} rinde ${tag} (p=${p.toFixed(2)}, n=${β.a + β.b - 2})` });
    }
  }
  return out.sort((x, y) => y.value - x.value);
}
```

**Tres fuentes de prior, en ese orden:**

1. **Instinto** — cinco filas heredables del genoma de la especie: *"un cuerpo de agua rinde `carnoso`, Beta(2,2)"*. Los animales tienen instintos; esto es legítimo y no es hardcodear pescado. Pero se dice sin maquillaje: **es cableado, movido de `pursueWarmth` a una tabla de priors**. Cinco filas hoy son cincuenta cuando el mundo tenga treinta sustancias, y hay que presupuestarlo.
2. **Evidencia propia** — pescó tres veces acá, sacó dos, el posterior se mueve. La evidencia **pisa** al instinto.
3. **Semilla del modelo** — para contextos genuinamente novedosos, asíncrona, y la evidencia la pisa igual.

**La corrida completa:**

```
tick 0    metabolismo: stamina 0.31 → need.energy = 0.69
tick 0    D3 opportunities():
            río a 6 celdas · β(2,2) → p=0.5 · sat=0.9 · cost≈50 → value 0.009
            matorral a 2 celdas · β(2,6) → p=0.25 · sat=0.2 · cost≈8 → value 0.006
          gana el río
tick 0    D4 plan(holding(tag:carnoso)):
            EXTRACCION necesita gear con reach≥2 ∧ catch>0 → no tengo
            SCHEMA_INDEX['catch>0 & reach>=2'] → { via: 'union', ... }
            UNION necesita binder flexible → no tengo
            SCHEMA_INDEX['flexibility>=0.8'] → { via: 'deshilachar', source: fibroso }
            veo un matorral fibroso a 2 celdas ✓
          PLAN: [ir(matorral), deshilachar, ir(vara), tomar, unir, ir(río), extraer]
tick 1    primera intención: goTo(matorral), commitment: 'reversible'
```

**Cero llamadas al modelo. Cero ramas cableadas.** Se acabaron `pursueSafety`, `pursueWarmth` y el `return null` para todo lo demás.

Y si en el paso 4 el planificador **no** encontrara esquema para `catch>0`, devolvería `{ gap: 'catch>0 & reach>=2', nearest: [ir(río), tantear], why: 'ningún proceso conocido establece enganche' }` — y ahí nace un contrato, mientras el cuerpo ya está caminando.

---

# Las habilidades: el lenguaje, el sandbox y el juez

## Por qué TypeScript aislado y no una DSL

El diagnóstico es del usuario y está confirmado en el código: 29 operaciones, 17 condiciones cerradas, sin variables, sin aritmética, un solo bucle, `runSkill` sin argumentos, el programa viajando como **string JSON dentro del sobre** porque el schema recursivo no entra en structured output, y una referencia del lenguaje copiada a mano en `codex.ts:81-144` que **ya está desincronizada** — le faltan seis operaciones y cinco condiciones, y por eso el modelo no puede inventar nada que coloque bloques. Ni una parrilla.

Cuatro cosas cambian de raíz:

1. **El modelo escribe en un lenguaje que ya sabe escribir.** No hay 4.473 caracteres de manual por consulta.
2. **La superficie se publica sola.** El `.d.ts` se emite con `tsc --declaration` del código real. La clase entera de bugs "la referencia quedó vieja" desaparece por construcción.
3. **Un programa mal formado cuesta 90 ms, no un viaje de 20 segundos.** Typecheck local + reparador determinista. Muere el `invalidRetries > 2` que hoy quema hasta tres de las ocho versiones en errores de forma que no midieron nada.
4. **Los límites pasan de forma a recursos.** `MAX_PROGRAM_OPS=200` y `MAX_PROGRAM_DEPTH=6` son lo peor de los dos mundos: no protegen de nada y castigan lo legítimo. Los límites reales son combustible, memoria y efectos observables.

## Qué se descartó del sandbox, y por qué

**QuickJS-ng compilado a WASM: descartado.** Las tres propuestas lo daban por hecho y las críticas lo desarmaron con aritmética:

- **El cruce de frontera es el costo dominante y no se puede evitar.** Inyectar la percepción a un heap WASM separado es `JSON.stringify` + `evalCode('JSON.parse(...)')` (o sea, el `structuredClone` que dijimos eliminar, una vez por habilidad viva) o construir el grafo con `newObject`/`setProp` (~2400 llamadas cruzadas por habilidad con 200 entidades visibles = 2.4-12 ms **por habilidad**, contra un presupuesto declarado de 0.5 ms). Error de dos órdenes de magnitud.
- **El presupuesto de opcodes estaba mal.** "200.000 opcodes ≈ 0.2 ms" implica 400M-1000M opcodes/s. QuickJS en WASM anda en 20-100M. Son 2-10 ms reales.
- **`setInterruptHandler` no suspende: lanza.** Un generador atravesado por una excepción queda `completed` para siempre. "Agotar el presupuesto suspende el generador y lo reanuda el tick siguiente" no es implementable: no es difícil, no existe.
- **Una corutina suspendida no se serializa.** No hay API. Y como los snapshots caen cada N ticks y las habilidades duran cientos, *todo* snapshot cae en medio de una habilidad.

**Se adopta:** ejecución **síncrona dentro del worker que hospeda el mundo**, en JS nativo, con **combustible instrumentado por un transformer de TypeScript sobre AST**.

```ts
// El transformer inyecta __fuel() en cada back-edge de bucle y cada entrada
// de función. Al agotarse NO lanza: emite un yield cooperativo.
// Un plugin de esbuild NO sirve: esbuild no expone su AST a los plugins,
// opera sobre texto. ts.transform() sí da AST.
export function fuelTransformer(ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile>;
```

Consecuencias:

- **Un bucle infinito no cuelga el frame**, porque todo bucle tiene back-edge y todo back-edge cuenta combustible.
- **La suspensión es un `yield` de verdad**, cooperativo y reanudable.
- **Correr 40 mundos en el juez es barato**, porque la habilidad corre en el mismo hilo que la simulación, sin cruces.
- **No hace falta `SharedArrayBuffer`**, así que no hace falta aislamiento cross-origin (COOP/COEP), que rompe embeds y puede pelearse con la integración Nostr.

Y el **modelo de amenaza se declara**: *código tonto de un proveedor de confianza media, no adversario con exploits de motor*. Si algún día se ejecutan habilidades compartidas entre usuarios, esto no alcanza y hay que volver a un intérprete propio. Está anotado como deuda, no escondido.

El seguro de última instancia es un watchdog de pared del **host** (no del guest): si un tick pasa de 50 ms, se marca el worker como corrupto y se reinicia desde el último snapshot. El transformer es la garantía; el watchdog es el seguro.

## La API que ve el código generado (firmas reales)

```ts
// ─── @anima/skills/skill-api.d.ts ────────────────────────────────────────
// Este archivo ES el prompt. Se emite del código real. No se transcribe.

export type Skill<A> = (ctx: Ctx, args: A) => Generator<Intent, Outcome, StepResult>;

export type Where = readonly QualityTest[];
export interface QualityTest { q: QualityId; op: '>=' | '<=' | '>' | '<'; v: number }

export interface Ctx {
  readonly tick: number;
  readonly self: SelfView;

  /** Cómputo puro sobre la percepción congelada del tick. No cruza nada. */
  see(w: Where): BodyView[];
  recall(w: Where): PlaceMemory[];
  q(b: BodyView, q: QualityId): number;

  /** ¿Puedo? Verifica roles y arrangement contra el mundo. No ejecuta. */
  can(p: ProcessId, roles: Record<string, BodyView>): Verdict;

  /** Constructores puros de Intent. yield los entrega al mundo. */
  goTo(t: BodyView | Cell, o?: { within?: number }): Intent;
  take(b: BodyView): Intent;
  put(b: BodyView, at: Cell, o?: { onTopOf?: BodyView }): Intent;
  apply(p: ProcessId, roles: Record<string, BodyView>): Intent;
  explore(o: { until: (v: PerceptionView) => boolean; maxTicks: number }): Intent;

  /** Canal de habla. No cuesta turno del cuerpo. */
  say(text: string): void;

  /** Punto de re-entrada tras cargar la partida. Ver "continuidad". */
  phase(name: string): void;

  /** KV tipado. Persiste entre corridas Y entre partidas. Es la ÚNICA sede
   *  de estado que sobrevive a un guardado. Las variables locales no. */
  readonly memory: SkillMemory;

  /** Determinismo: no hay Math.random ni Date en el scope. */
  readonly rng: Rng;
  readonly math: DetMath;   // exp, pow, log, sin en punto fijo, iguales en toda máquina
}
```

Ejemplo real, del tipo que el modelo escribe bien (idiom `redux-saga`):

```ts
export function* pescarConAparejo(
  ctx: Ctx, args: { con: BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('buscar-agua');
  let agua = ctx.see([{ q: 'wet', op: '>=', v: 0.9 }])[0];
  if (!agua) {
    const r = yield ctx.explore({
      until: v => v.see([{ q: 'wet', op: '>=', v: 0.9 }]).length > 0,
      maxTicks: 400,
    });
    if (r.status !== 'found') return fail('no encontré agua');
    agua = ctx.see([{ q: 'wet', op: '>=', v: 0.9 }])[0];
  }

  ctx.phase('ir');
  ctx.memory.set('pozo', agua.at);            // ← esto sobrevive al guardado
  const ir = yield ctx.goTo(agua, { within: 1 });
  if (ir.status !== 'arrived') return fail('no llegué');

  ctx.phase('pescar');
  const yaIntenté = ctx.memory.get<number>('intentos') ?? 0;
  for (let i = yaIntenté; i < 40; i++) {
    ctx.memory.set('intentos', i);
    const o = yield ctx.apply('extraccion', { gear: args.con, source: agua });
    if (o.got.length > 0) { ctx.memory.del('intentos'); return done(o.got[0]); }
  }
  return fail('no picó');
}
```

## Dos garantías de reproducibilidad, con nombre distinto

Las tres propuestas prometían "replay bit a bit" y las tres tenían el mismo agujero. Acá se separan y se dice cuál es fuerte:

**Reproducibilidad del mundo (fuerte, es la que sostiene al juez).**
`journal de intenciones + snapshot → hashWorld idéntico`, entre máquinas y entre navegadores. Requiere:
- Aritmética del motor en **punto fijo i32**. `Math.exp`, `Math.pow`, `Math.log`, `**` **no tienen precisión especificada en ECMAScript**: dos navegadores pueden devolver el último bit distinto y el replay diverge en el tick 400. Se prohíben por lint en `@anima/physics` y `@anima/process`, y se reemplazan por tablas y polinomios propios.
- `Intl`, `localeCompare`, `toLocaleString`, `performance` sombreados en todos lados.
- Test de propiedad con `fast-check`: 200 intenciones arbitrarias sobre dos mundos gemelos, mismo hash.

**Continuidad de la criatura (débil, y se dice que es débil).**
Al cargar una partida, las habilidades en vuelo **se reinician desde arriba** y se saltan a su `phase` declarada leyendo `ctx.memory`. Pueden repetir trabajo. El criterio de aceptación no es "reproduce el final exacto" sino **"termina el objetivo"**:

```ts
test('una habilidad interrumpida por un guardado converge', () => {
  const w = run(world, 800);                    // a mitad de pescar
  const saved = save(w);
  const a = run(w, 2000);                       // sin cortar
  const b = run(load(saved), 2000);             // cortando y cargando
  expect(goalReached(a)).toBe(true);
  expect(goalReached(b)).toBe(true);            // NO se compara el hash
  expect(ticksTo(b) - ticksTo(a)).toBeLessThan(200);   // repite poco
});
```

Fingir lo contrario era la falla común: si el estado vive en el stack de un generador, no hay snapshot posible, y el usuario que cierra la pestaña a mitad de una obra cae justo en el camino que no está testeado.

**Y el test que falta en todas las propuestas:** un replay que **re-ejecuta las habilidades** y compara la traza de intenciones contra la registrada. Es el único que detecta que un bump del compilador rompió el mundo. Corre en CI, sobre tres partidas grabadas.

## Cómo se verifica sin frenar la partida

Evaluación **jerárquica**, en `@anima/judge`, en su propio worker:

| Etapa | Mundos | Ticks | Costo | Para qué |
|---|---|---|---|---|
| tipos + combustible | — | — | 90 ms | descartar lo que no compila, sin viaje |
| `admit()` | — | — | 0.2 ms | descartar lo que viola la física |
| **smoke** | 4 estadificados | 120 | 25 ms | descartar el grueso barato |
| **grilla** | 20 semillas × escenarios | 400 | 3-8 s | medir de verdad |
| **cuarto reservado** | 5 semillas ocultas | 400 | 1-2 s | funciona donde no la corrigieron |
| **ablación** | 1 por precondición | 200 | 1-3 s | ver abajo |

**Mundos estadificados** (reparación de una falla seria): un smoke de 60 ticks mata *toda* candidata correcta que tenga que explorar 120 ticks para encontrar el agua. El smoke corre con las precondiciones del contrato **ya satisfechas** — mide el núcleo, no la búsqueda. La búsqueda se mide en la grilla.

**Banco derivado del contrato, con adversarios obligatorios.** Si el contrato habla de fauna en agua, el juez le pide al oráculo mundos con río. Pero la crítica tiene razón: variar la semilla no varía la distribución, y un examen escrito por el enunciado es el examinado escribiéndose el examen en versión sutil. Entonces:
- **1/3 de los mundos son adversarios** con parámetros que el generador del contrato no eligió: río sin stock, fibra que se rompe, noche, lluvia, distancia mayor, sin la herramienta.
- **Las regresiones del mundo real** con snapshot embebido son obligatorias, no opcionales. Es lo mejor que tiene el repo hoy y no se degrada a nota al pie.

**Ablación** (reparación de la falla del manifiesto): las precondiciones no se acreditan por co-ocurrencia sino **por contraste**. Para cada `requires` candidato, se corren N mundos donde esa condición **no** se cumple. Si la habilidad funciona igual, la precondición era espuria y se borra. Cuesta más simulación, y la simulación es local y barata: es exactamente la asimetría que hay que explotar.

**Veredictos que se conservan del evaluador actual**, porque cada uno nació de un fallo real:
- `inconcluso` cuando lo perdió el dado y no la incapacidad (sale del denominador).
- `injuzgable` cuando el oráculo no puede sintetizar ni un mundo donde el contrato sea satisfacible. **Jamás un 0% falso**, jamás una regresión envenenada. Hoy `return fitting.length > 0 ? fitting : scenarios` juzga una habilidad de pesca en cuarenta mundos secos.
- No empeorar a la **mejor** versión previa, no a la última.
- Cobertura real de sub-habilidades: solo se acredita lo que efectivamente se ejecutó.

## Cómo se promueve, versiona y hereda

**Promoción:** `borrador` → (tipos + admit + smoke) → `provisional` → (grilla 1.0 + cuarto reservado + regresiones + no empeorar) → `estable`. Y `sin-vara` si el banco dio `injuzgable`: usable, pero nunca llega a estable, y el chat lo dice. *"Esto nunca lo pude probar."* Es más honesto que la vara falsa de hoy, y además es un buen momento de personaje.

**Cuarentena de lo provisional** (reparación de la falla más peligrosa del corpus). Una habilidad `provisional` no puede hacer actos `costly` sin tope ni `irreversible` sin confirmación. Y un **proceso** provisional:
- no se indexa como disparo automático global (ése era el caso del `SECADO` que pasaba un smoke de dos mundos, se disparaba sobre todo cuerpo con humedad en radio 3, secaba el mapa entero, y a los 2000 ticks la primera fogata quemaba todo — con revocación solo hacia adelante y ledger sellado por testigo, el daño era permanente);
- tiene tope de N aplicaciones antes de re-juicio obligatorio;
- se revoca hacia adelante, y **los cuerpos que ya existen siguen existiendo** — el mundo no se desdice, pero justamente por eso la puerta de entrada no puede ser un filtro de 25 ms.

**Versionado de física.** Cada `Process`, `Substance` y `QualitySpec` lleva `physicsVersion`. Cambiar cualquier número **invalida todos los sellos `stable` que dependan de él** y encola re-juicio. Sin esto, la biblioteca acumula habilidades selladas contra una física que ya no existe — y como la calibración va a llevar semanas, eso pasaría todo el tiempo.

**Herencia.** La heredera recibe:
- la biblioteca completa (fuente + bytecode + manifiesto medido + procedencia),
- los procesos y sustancias admitidos,
- el ledger del oráculo,
- **las regresiones y los gaps abiertos** — viajan a propósito: son el criterio, y si no viajan la vara se lava en cada generación.

Pero **hereda código, no credenciales**: todo vuelve a `provisional` hasta re-superar el cuarto reservado en **su** mundo. Con re-validación **perezosa y priorizada**: una habilidad se re-juzga la primera vez que se la quiere usar, en el fondo, y la cola se ordena por frecuencia de uso de la generación anterior. Re-validar 60 habilidades de golpe son minutos de CPU en el momento más emotivo del producto.

**Caché persistente por contrato:** `hash(gap + firma de la física + firma del mundo) → programa`. El segundo encuentro con el mismo problema tiene latencia cero y costo cero. **Eso** es "lo que aprende queda para siempre" implementado bien. Y la biblioteca se indexa por lo que establece, no por su nombre:

```ts
library.index: Map<PredicateSignature, SkillId[]>
```

La falta que generó el contrato es la llave que después lo encuentra. Circuito cerrado.

## Qué escribe el modelo, y qué no — **decidido**

Ésta era la ambigüedad más cara del documento y quedó resuelta: **el modelo
escribe habilidades. Nada más.**

| Capa | ¿La escribe el modelo? | Puerta | Radio de daño si sale mal |
|---|---|---|---|
| **Habilidad** (generador TypeScript contra `Ctx`) | **sí** | tipos → combustible → smoke → grilla → cuarto reservado | una criatura hace una tontería; se revoca y listo |
| **Proceso** (ley declarativa nueva que entra al `SCHEMA_INDEX`) | **no, por ahora** | `admit()` + ablación | el mundo entero cambia de reglas, en todas las partidas |
| **Física** (cualidades, constantes, envolventes por tag) | **nunca** | — | se invalidan todos los sellos de la biblioteca |
| **Motor, UI, persistencia, `apps/api`** | **nunca** | — | es un producto distinto |

Codex escribe código que corre **adentro del sandbox**, contra `skill-api.d.ts` y
nada más. No toca `@anima/physics`, no toca `@anima/world`, no toca la interfaz.
El juego no se automodifica: **la criatura sí.**

### El techo del requisito 1, dicho sin maquillaje

Con esta decisión, *"puede hacer cualquier cosa, y si no sabe, aprende"*
significa exactamente esto:

**Puede aprender** cualquier cosa que se pueda **componer** con las once leyes y
la geometría de ensambles. Y eso es mucho más de lo que suena, porque incluye las
**técnicas**, que es donde vive casi todo lo interesante:

- tapar la fogata para que la pirólisis dé carbón en vez de ceniza — nadie
  programó "hacer carbón": es una secuencia que explota la ley 4 y el oxígeno de
  la celda;
- secar la fibra antes de atarla, porque mojada no aguanta;
- poner el pescado sobre la parrilla y no en las brasas, y sacarlo antes de los
  280 °C;
- ahumar guardando el pescado arriba del humo, si de las leyes 3 y 6 sale que el
  humo baja el `decay`;
- pescar con lanza en vez de con caña cuando hay filo y no hay fibra.

**No puede aprender** una transformación física que las once leyes no contemplen:
fermentar, curtir, destilar, fundir metal. Eso no es una habilidad: es una ley
nueva, y las leyes las escribimos nosotros.

Esto hay que decírselo al usuario **antes** de empezar, no después. "Aprende para
siempre" es verdad; "aprende cualquier cosa" tiene un techo y el techo tiene
nombre: el catálogo de leyes.

### La puerta queda abierta, con la forma ya definida

Si algún día se quiere que la criatura invente una **ley** y no solo una técnica,
la arquitectura ya lo permite sin reescribir nada: `Process` es dato, `admit()`
es la puerta, la ablación verifica `establishes` y `physicsVersion` invalida los
sellos que dependan de la ley nueva. Sería un Hito 12, con un requisito propio:
un proceso `provisional` **no puede indexarse como disparo automático global**
(ése era el caso del `SECADO` que secaba el mapa entero). Queda **diferido, no
borrado** — y no se construye hasta que el resto esté vivo.

## El carril de mejora: lo que ya sabe, pero mejor

Acá aterriza tu idea de que *«lo que el LLM tarda en pensar se usa después para
mejorar»*. El documento la tenía solo como hot-swap de una habilidad que **no
existía**; falta el caso más importante, que es la habilidad que **sí existe y
anda mal**.

**Cuatro disparadores, los cuatro deterministas.** Ninguno consulta al modelo
para decidir si vale la pena mejorar: eso sería pagar un viaje para saber si
pagar un viaje.

```ts
export type ImprovementTrigger =
  /** La tasa real cayó por debajo de la que midió el juez al promoverla. */
  | { k: 'degradada'; skill: SkillId; grid: number; real: number }
  /** Otra habilidad establece lo mismo por menos ticks o menos stamina. */
  | { k: 'dominada'; skill: SkillId; by: SkillId; ratio: number }
  /** Falla siempre en la misma fase declarada con ctx.phase(). */
  | { k: 'atascada'; skill: SkillId; phase: string; fails: number }
  /** El mundo cambió: la física se recalibró y el sello quedó viejo. */
  | { k: 'sello-vencido'; skill: SkillId; physicsVersion: number };

export function improvementQueue(lib: Library, tel: Telemetry): ImprovementTrigger[];
```

`atascada` es el que más rinde, y sale gratis: `ctx.phase()` ya existe para la
continuidad tras un guardado, así que el informe de fallo dice *"muere en
`buscar-agua` 9 de 10 veces"* en vez de *"falló"*. Un informe así es lo que
convierte una revisión en una corrección.

**Cómo corre, sin que se vea nunca:**

- **Prioridad negativa.** El carril de mejora cede ante todo: ante el chat, ante
  la fragua de una habilidad que falta, ante el juez. Consume presupuesto
  económico **solo lo que sobra** de la cuota de sesión, y se apaga entero en
  modo austero.
- **Acá sí `K=6`.** Es el único lugar del sistema donde la latencia no se ve, así
  que es el único donde conviene el máximo de seis muestras (que es ≈ p90 de la
  distribución, no p50). En el camino caliente sigue siendo K=2.
- **Duelo, no examen.** La candidata no compite contra un umbral: compite contra
  la **titular**, en los mismos mundos —su grilla, su cuarto reservado y sus
  regresiones— y tiene que ganarle. Si empata, gana la titular. Si pierde, se
  archiva como regresión, y esa regresión la hereda la próxima generación.
- **Hot-swap solo en frontera de fase**, nunca a mitad de un `yield`, y nunca si
  la titular está ejecutando un acto `irreversible`.
- **Tope de dos rondas por habilidad.** Si dos candidatas seguidas no le ganan a
  la titular, la habilidad sale de la cola y no vuelve hasta que cambie algo
  medible: la física, el mundo, o una regresión nueva. Sin esto, la cola de
  mejora se convierte en una máquina de quemar cuota puliendo lo que ya está bien.

**Verificable** (va al Hito 8, con criterio propio): una habilidad a la que se le
degrada la tasa a propósito entra en la cola, se re-forja en segundo plano,
la candidata gana el duelo y reemplaza a la titular **sin un solo tick perdido**;
una candidata peor no reemplaza nada y queda archivada como regresión; con el
presupuesto económico agotado, la cola no dispara ni una consulta.

---

# La escalera de costo del LLM

**Objetivo: que el 85% de los mensajes y el 95% de los ticks no toquen la red.**

| Peldaño | Mecanismo | Latencia | Costo | Cobertura acumulada |
|---|---|---|---|---|
| E0 | caché exacta `fnv1a(texto \| firma \| léxico)` | 0.1 ms | 0 | 30% |
| E1 | `readFast` sobre léxico vivo (trie + fuzzy + BM25) | 3 ms | 0 | 70% |
| E2 | plantilla parametrizable de la biblioteca | 5 ms | 0 | 85% |
| E3 | `plan()` resuelve con lo que hay | 8 ms | 0 | 95% de los ticks |
| E4 | modelo chico: corrige la lectura, ≤200 tokens de salida | 400-900 ms | bajo | |
| E5 | modelo grande: escribe código, K=2 candidatas | 6-25 s | alto | |
| E6 | oráculo: novedad del mundo | 6-25 s | alto | rarísimo |
| E7 | glosa: nombres y glifos | cuando sobre | mínimo | prioridad cero |

**Cosas que hoy son una consulta y pasan a ser aritmética:**

| Hoy | Ahora | Ahorro |
|---|---|---|
| `recipe.judge` por cada receta del plan (hasta 4 en serie) | `admit()` | 4 consultas → 0.2 ms |
| `interaction.judge`, `decomposition.judge` | `admit()` | 2 consultas → 0 |
| "hay pescado en el río" | posterior Beta | 1 consulta → 0.01 ms |
| interpretar "traé el tronco" con mega-prompt de 7.5 KB | trie sobre léxico vivo | 1 consulta → 3 ms |
| `glyph.propose` por tipo nuevo, **antes** de continuar la actividad | glifo procedural de sustancia+forma, glosa en cola 7 | 1 consulta → 0 |

Queda en el modelo solo lo genuinamente semántico o creativo: inventar una ley, escribir una habilidad, juzgar **valores** (asíncrono y revocable, nunca en el camino), poner nombres bonitos. Nada de eso bloquea nada.

**Decisiones de transporte, con la corrección que las críticas obligan:**

- **`apps/api` se conserva.** "HTTP directo con key" no es posible en el navegador: una key en el bundle es inviable para una demo pública, y el requisito 7 pide apoyarse en Codex con la cuenta del usuario. El `CODEX_HOME` por pubkey sigue existiendo. El ahorro real es **menor** que el que las propuestas anunciaban.
- **Se mata el `spawn` por consulta** con `mkdtemp` y `--no-session-persistence`: ~1733 ms fijos medidos (ADR 0044) que multiplican todo lo demás.
- **El app-server persistente deja de degradarse para siempre.** Hoy, ante cualquier fallo de transporte, "sigue con exec por el resto de su vida" y solo vuelve reiniciando la API. Se agrega reconexión con backoff y un contador visible.
- **Prompt caching sobre prefijo estable de verdad**: `skill-api.d.ts` + registro de cualidades + procesos core + cotas de `admit()`. Hoy va el glosario entero, todas las recetas y todo el catálogo de capacidades revueltos en cada mensaje, lo que hace imposible cachear nada. **Advertencia honesta:** durante la calibración, ese prefijo cambia seguido y la caché se invalida; conviene congelar la física antes de apoyarse fuerte en el caching.
- **Warm-up al montar la sesión**: una consulta mínima que deja el prefijo cacheado. Sin esto, la primera consulta de la demo paga escritura de caché, que es más cara.
- **`AbortController` de punta a punta**, timeouts en segundos y no en 240, y **cero reintentos ciegos** (hoy `try { await consult() } catch { await consult() }` duplica la espera en silencio).
- **K=2, no K=6.** K alto sube la calidad a costa de la latencia: el máximo de K muestras es ≈ p90 de la distribución, no p50. K=6 se reserva para el carril de mejora en segundo plano, donde la latencia no se ve.
- **Presupuesto económico desde el Hito 8, no desde el 11.** Cuota por sesión, cola con descarte por prioridad, y un modo austero explícito en el que la criatura aprende más lento. Si no se diseña temprano, la factura decide la arquitectura por vos.
- **Test de presupuesto de consultas en CI** (heredando `MockModelProvider.callCount`): el build falla si una operación empieza a costar más viajes de los declarados.

---

# Qué se conserva del Ánima actual y qué se tira

## Se conserva (y se porta, no se redescubre)

| Qué | Dónde está hoy | Por qué |
|---|---|---|
| **El contrato de percepción** | `harness.ts:10-12`, `perception.ts:289` | El agente nunca ve `WorldState`. Es lo que hace del mundo un juez y no un decorado, y lo que impide que el modelo alucine estado. **No negociable.** |
| **Proponer no es poder** | `actions.ts:45`, `step.ts:540/578/614` | Ni una idea confirmada por el cuidador se saltea la puerta. Es la esencia hecha código. |
| **`reference-resolver.ts`** | 197 líneas, cero llamadas al modelo | El patrón exacto: el modelo describe el selector, el código local decide, con `missing`/`ambiguous` explícitos. Ya está escrito y probado. |
| **`spatial-goals.ts:75`** | `groundSpatialRequest` | Traduce relación semántica a geometría usando solo percepción. Responde "cruzá al otro lado" en microsegundos. |
| **El `PlanExecutor` paso a paso** | `capabilities/executor.ts:19-42, 205-212` | Que "el programa terminó" y "el mundo muestra el efecto" sean dos cosas distintas, con `unverifiedSteps`. La pieza mejor diseñada del repo. |
| **`progress.ts`** | 185 líneas | Prohibir tras dos fallos por (objetivo, estrategia), en código determinista, sin depender de que el modelo note que está en un bucle. Y el crédito por **problema**, no por vida. |
| **El evaluador independiente completo** | `skill-evaluator/` | Cuarto reservado, `inconcluso`, regresiones con snapshot real, no empeorar la mejor previa, cobertura real de sub-habilidades, semillas derivadas de la partida. Es la mitad del producto. |
| **`provisional` desde 0.6** | `promotion.ts:108-122` | Usable mientras no haya estable, elegida por tasa **medida**. Ya existe: no es una conquista del remake. |
| **Hechos → valores en las negativas** | `refusal.ts` + `agent.ts:4701-4713` | Cuatro de cinco clasificaciones deterministas; solo `will_not` consulta al modelo, y solo después de que el mundo dijo que se puede. **El modelo opina, nunca autoriza.** |
| **El veto como conocimiento persistente** | `invention.ts:479-491` | Caché semántica de negativas. Un rechazo viaja al próximo intento. |
| **`ModelProvider` por momentos cognitivos** | `types.ts:38-510` | Nombrar `interpret.command`, `recipe.judge`, `skill.contract` como tipos distintos es correcto. Se lleva tal cual. |
| **`interpretsLanguage`** | `types.ts:646-650` | El sistema sabe si del otro lado hay alguien que entiende. Permite tests deterministas y modo sin costos. |
| **La instrumentación de latencia** | `GameSession.ts:772-792`, `metrics.ts` | `ai.timing`, `ticksToFirstAction`, `LONG_TASK_MS`. Es la infraestructura que va a decir si el remake cumple. Desde el día uno. |
| **`expandRecipeCost` como fuente única** | `recipes.ts:195-233` | Nadie escribe lo que cuesta una casa: se deriva. Ese principio se replica en todo. |
| **`isMadeFrom`** | `recipes.ts:150-166` | Nunca romper algo hecho de lo que buscás. Invariante económico real, salido de una partida real. |
| **Desenlaces probabilísticos** | `recipes.ts:25-45` | "Tener los ingredientes da derecho al INTENTO, no al producto". Hace que el mundo no negocie. |
| **Poda en dos tiempos** | `pruning.ts:107-133, 207-232` | `planPrune` mira, `applyPrune` ejecuta lo ya mostrado. La única operación de olvido que hay, y está bien diseñada. |
| **Los invariantes por tick** | `invariants.ts:14-78` | El arnés que hace seguro dejar que un LLM escriba comportamiento. |
| **`gpsTo` y la memoria espacial corporal** | `interpreter.ts:121-182, 924-996` | BFS sobre lo percibido y lo golpeado, con desmentido por línea de visión. Conocimiento caro que ningún lenguaje nuevo regala. Suben a `ctx.recall()` y `ctx.goTo()`. |
| **`apps/api` y el backend Nostr** | | Requisito 7 y despliegue real. |

**Inventario obligatorio de ADRs antes del Hito 1.** Ninguna de las tres propuestas lo tenía y las tres iban a redescubrir 86 ADRs a los golpes. Hay que hacer una tabla explícita, ADR por ADR, de qué comportamiento tiene que existir en el remake y en qué hito entra. Los que ya sé que faltan en las tres: 0013 (prioridad entre intérpretes), 0030 (portón de criterio), 0034 (colocación idempotente), 0036 (inventar desde el hambre bloqueada), 0052 (lo que le falta se ve), 0053 (el encargo se descompone), 0058 (romper X para sacar X da negativo), 0065 (el encargo sale a buscar lo que le falta), 0079 (el veto tiene forma), 0082 (las referencias conservan identidad), 0083 (objetivos como predicados), 0084 (registro epistemológico), 0085 (envoltura temporal), más memoria episódica, personalidad, misiones y día/noche.

## Se tira

| Qué | Por qué |
|---|---|
| `AnimaAgent` (7679 líneas, 140 métodos, 161 campos, 22 responsabilidades) | No es refactorizable: la mitad de los métodos leen dos o tres de los 161 campos. Se reescribe como procesos con contratos explícitos. |
| `think(perception): Promise<ActionIntent \| null>` dentro del tick | La causa raíz. Cuatro ADRs de mitigación sobre una decisión que hay que revertir. |
| `THINK_TICK_BUDGET` y el congelamiento del mundo | Si el mundo nunca espera, el presupuesto no hace falta. Se está vendiendo el bug como feature ("el mundo espera su mente"). |
| La no-reentrancia global del agente | Un solo pensamiento en vuelo serializa todo el sistema. |
| La DSL de `skill-runtime` entera como superficie de autoría | 29 ops, 17 condiciones, sin variables, sin aritmética, `runSkill` sin argumentos. |
| `programJson` / `recipeJson` / `glyphJson`: JSON dentro de string | Se paga la rigidez del structured output sin cobrar el beneficio. Doble parseo, doble modo de fallo. |
| `DSL_REFERENCE` copiado a mano | Ya divergió: le faltan 6 ops y 5 condiciones, y por eso el modelo no puede inventar nada que coloque bloques. |
| `Components` como interfaz cerrada de 24 campos-marca | `heatSource` no prende nada, `water` no moja nada, `hazard` no quema objetos. Sin propiedades no hay emergencia. |
| Los cinco validadores (~860 líneas) y las cuatro formas de transformación | `PROTECTED_KINDS` escrito cinco veces. Una sola `Process` y una sola puerta. |
| `INVENTED_COMPONENT_BOUNDS` sin `edible` ni `nutrition` | Es lo que hace imposible el pescado asado. Se reemplaza por conservación numérica. |
| `PROTECTED_KINDS = ['pet','food','tree']` | Proteger un string es frágil y bloquea lo legítimo junto con lo ilegítimo. Se reemplaza por sellado por testigo + conservación. |
| Cuotas globales (`MAX_INVENTED_RECIPES=12`, etc.) y productor único por tipo | La historia que el usuario quiere ver son 7+ recetas. Con 5 cupos libres el mundo dice "no admito más" a mitad de la demo. |
| `vocabulary.ts` como tabla cerrada + `KIND_EMOJI` | Ya divergió: inglés en el mundo principal, castellano en `missions/terrain.ts`. El nombre es dato de la sustancia. |
| El mapa fijo escrito celda por celda (`foodBehindWall.build`) | 13×7, ~40 spawns literales, semilla que elige entre 3 posiciones. |
| `entitiesAt` = `Object.values().sort().filter()` | `allEntities()` diez veces por tick, con un sort que parsea ids string. |
| `structuredClone` como aislamiento por defecto | Percepción, snapshot por tick, goals, progress, save. Impuesto que crece con la partida. |
| `EventLog` como array ilimitado con `ofType` lineal | Consultado 4 veces por segundo, clonado entero en cada guardado. |
| `rebuildView()` completo por tick **y por cada chunk de razonamiento SSE** | O(entidades × recetas) a 4 Hz más una vez por evento. |
| Hablar como `ActionIntent` que consume el turno | Hablar es UI. No debería costarle un tick al cuerpo. |
| `drawWhatIsInSight` / `drawTheWork` antes de continuar la actividad | Estética bloqueando la acción que el usuario pidió. |
| El portón de doble confirmación para aprender | 3 turnos de chat + 2 consultas antes de intentar nada. La idea del ADR 0030 se conserva; el trámite no. |
| Las ramas cableadas de `pursueGoal` y las listas de estrategias a mano | `return null` para todo lo que no sea las tres necesidades. Mata el requisito 4. |
| El parser determinista como **segundo intérprete en la sombra** | Dos sistemas que interpretan la misma frase distinto. Acá hay un solo camino con peldaños y orden de autoridad explícito y unidireccional. |
| El `spawn` de CLI con `mkdtemp` por consulta | Techo duro de la latencia y del despliegue. |

**Y lo que se descartó de las propuestas nuevas** (por si alguien lo quiere reponer): QuickJS-WASM (costo de cruce de frontera y `interrupt` que mata generadores), corutinas serializables (no existe la API), `Substance.transitions` por sustancia (tabla de recetas al revés), `apertureArea` topológica (motor de geometría disfrazado), embeddings locales en el arranque (30 MB en el camino crítico), K=4/5/6 concurrente vendido como reducción de latencia (es p90), pre-decreto en tiempo ocioso que escribe estado del hash (rompe el determinismo), oráculo que escribe números (comida infinita), y `admit()` con una sola cualidad conservada (sello de goma).

---

# Plan de construcción

Estimaciones honestas para una persona trabajando con Claude, a tiempo completo. **Total realista: 7 a 9 meses.** El grueso no es escribir código: es calibrar once leyes acopladas para que los tres ejemplos salgan **y nada más se rompa**.

> **ESE «7 a 9 meses» ES UN PRONÓSTICO HISTÓRICO Y SE CONSERVA COMO TAL.** Se
> escribió antes de que existieran los objetos emergentes, y **no incluía**: la
> UI, los objetos emergentes, los dispositivos autónomos, la geometría, los
> procesos físicos nuevos ni la fauna materializada. **No se calcula un total
> nuevo sin base.** Las cifras de este plan se clasifican en tres —**medición
> existente**, **ROM con confianza** y **desconocido pendiente de spike**— y la
> clase va escrita al lado del número. Las referencias ROM están en la sección
> [«Presupuesto, clasificado»](#presupuesto-clasificado), y **no son aditivas**.

> **EL ORDEN OBLIGATORIO, después del Hito 5.** El caso de aceptación decidido
> —«fabricá una trampa para peces», sin trampa precargada— obliga a intercalar un
> **gate técnico** entre el Hito 5 y el Hito 6, y a poner la UI **después** del
> Hito 11:
>
> ```
> terminar el Hito 5 actual
>   → Gate técnico de objetos emergentes
>     → Hitos 6–11
>       → Hito 12 (UI presentable)
>         → Hitos post-UI de física abierta (13–16)
> ```
>
> El gate **no reabre el Hito 5**, que está ~80% implementado y termina con su
> alcance actual ([ADR II-0019](../../ii/docs/decisions/II-0019-el-gate-5-6-no-reabre-el-hito-5.md)).
> Los hitos históricos **no se renumeran todavía**.

---

### Hito 0 — El banco de latencia (1 semana)

Arnés que mide, sobre un mundo falso: p50/p99 de tick con 5000 cuerpos, costo del transformer de combustible, `ts.createProgram` **en frío y tibio**, arranque de página completo, y time-to-complete-program de una consulta real.

**Criterio de corte escrito de antemano:** si el transformer de combustible cuesta más del 15% de overhead, o si `ts.createProgram` en frío pasa de 3 s, el plan del sandbox cambia **acá** y no después de construirle encima.

> **HITO 0 CERRADO.** Las cuatro piezas se midieron. Ninguna mató el plan; una lo
> obligó a cambiar de regla y otra encontró una degeneración en la física.
>
> | Pieza | Criterio | Medido | |
> |---|---|---|---|
> | [typecheck](../../ii/docs/hito-0-banco-de-latencia.md) | < 3000 ms en frío | **240 ms** | ✔ |
> | [barrido térmico](../../ii/docs/hito-0-barrido-termico.md) | ventana para 10 sustancias | **12/12** | ✔ |
> | [combustible](../../ii/docs/hito-0-combustible.md) | ≤ 15% de overhead | **22–52%** | ✘ → regla cambiada |
> | [arranque en el navegador](../../ii/docs/hito-0-arranque-navegador.md) | typecheck tibio ≤ 250 ms | **6 ms** | ✔ |
>
> El criterio del combustible **se pasó**, y el
> [ADR II-0005](../../ii/docs/decisions/II-0005-el-presupuesto-se-mide-contra-el-tick.md)
> lo reemplazó por decisión del usuario: el presupuesto se mide **contra el
> tick** y no contra sí mismo. Una razón sobre un número chico no describe
> ningún problema del producto — 22% de 0.25 ms son 0.13 ms en un cuadro de 33.
> Los umbrales nuevos son absolutos: ≤ 2% del tick para instrumentar (medido
> 0.40%) y ≤ 10% del tick para el cómputo de la habilidad (medido 1.15%).
>
> Dos hallazgos del banco quedaron como **requisitos**: la inyección de
> combustible va **en línea** y no como llamada (1.5× gratis), y se instrumentan
> **también** las entradas de función (sacarlas no ahorra nada medible y hace que
> la recursión infinita muera por `RangeError` en vez de por combustible).
>
> Y del banco de typecheck salió una regla para el Hito 8: **el `tsconfig` de la
> fragua se declara explícito, con `lib` mínimo y `types: []`**. Sin fijarlos,
> TypeScript carga `lib.dom` y los 132 archivos de `@types/node`, y eso cuesta
> **5.6×** — más que cualquier optimización que uno se ponga a hacer después.

**Se puede mostrar:** nada. Es el hito que evita construir sobre fe. Los tres documentos anteriores tenían números clave inventados y falsables con aritmética de servilleta.

---

### Hito 1 — Materia y leyes (4-6 semanas)

`@anima/physics` + `@anima/process`: las 22 cualidades, las 11 leyes, `admit()` con las cinco reglas, ~30 sustancias semilla, cuerpos compuestos con cotas duras. Sin mundo, sin agente, sin UI, sin LLM.

**Verificable:**
- Property test: 10⁶ transformaciones aleatorias, ninguna cualidad conservada aumenta.
- **Los tres ejemplos como tests del motor**, sin la palabra "carbón", "asar" ni "pescar" en el código: rama junto al fuego → carbonizado con 0.28 de masa y `nutrition 0`; pescado sobre parrilla a d=1 → `digestibility` 0.35 → 0.91 con `nutrition` intacta, y quemado si se lo deja; `union(vara, hebra)` → ensamble con `catch > 0` y `reach ≥ 2`, e igual con hueso+tendón.
- **El test de emergencia:** una sustancia nueva del oráculo, sin fila propia, se quema, se cocina y se ata.
- `admit()` rechaza "frotar produce calor infinito" citando `poweredBy`, y "atar dos palos produce un pescado" citando conservación.

**Se puede mostrar:** un laboratorio de física en una página: poner cosas, prenderlas fuego, verlas cambiar. Sin criatura. Ya es demostrable y ya es lo que ninguna versión de Ánima tuvo.

---

### Hito 2 — El mundo determinista (2-3 semanas)

`@anima/world`: grilla en chunks, índice O(1) por celda mantenido incrementalmente, campos de terreno en `TypedArray` (el agua deja de ser 80 entidades), registro de sistemas, `stepWorld` puro, invariantes por tick, journal append-only, snapshot por delta. Worker a 30 Hz. Lint que prohíbe `Math` trascendente, `Date` y `Math.random` en todo el paquete.

**Verificable:** dos mundos gemelos con 10⁵ intenciones → mismo `hashWorld`; restaurar a mitad reproduce el final exacto; 5000 cuerpos a menos de 4 ms por tick; **el mismo hash en Chrome y en Firefox**.

> **HITO 2 CONSTRUIDO.** Ver [`ii/docs/hito-2-el-mundo.md`](../../ii/docs/hito-2-el-mundo.md).
> `@anima/world` existe y está verde: 263 tests, más 548 de la física.
>
> | Criterio | |
> |---|---|
> | dos mundos gemelos con 10⁵ intenciones → mismo `hashWorld` | ✔ |
> | restaurar un snapshot a mitad reproduce el final exacto | ✔ |
> | el replay del journal reconstruye el estado exacto | ✔ |
> | 5000 cuerpos a menos de 4 ms por tick | ✘ **8,48 ms** → criterio reemplazado |
> | el mismo hash en Chrome y en Firefox | pendiente: pide un arnés de navegador |
>
> El de rendimiento se midió en 39,66 ms y se optimizó a **8,48 ms** —4,6×,
> verificado de forma independiente, sin mover la huella de conducta— y aun así
> quedaba 2,1× arriba. Lo que faltaba no era otra micro-optimización: el perfil
> quedó plano y el piso está en la representación.
>
> El [ADR II-0007](../../ii/docs/decisions/II-0007-el-tick-es-un-parametro-y-el-presupuesto-una-fraccion.md)
> lo reemplazó por decisión del usuario. **«30 Hz fijos» deja de ser una
> constante**: el tick es un parámetro, su valor por omisión pasa a **20 Hz**, y
> el presupuesto deja de ser milisegundos para ser una **fracción**:
>
> ```
> stepWorld ≤ 25% del presupuesto de tick     ·     medido: 17,2%
> ```
>
> Y lo que de verdad vale de esa decisión: **son dos perillas y no una.** La
> frecuencia del tick gobierna el rendimiento; las tasas `perTick` de las leyes
> gobiernan el ritmo del juego. Que estuvieran mezcladas es la razón por la que
> «30 Hz» nunca tuvo argumento — no había forma de justificarlo sin decidir a la
> vez cuánto tarda en cocinarse un pescado. **Nunca se arregla el ritmo moviendo
> la frecuencia, ni el rendimiento moviendo las tasas.**
>
> Consecuencia que se acepta y queda escrita: a 20 Hz todo dura 1,5× más en reloj
> de pared. Cocinar carne pasa de 25 a 37 s, y el cuero de 40 a **60 s**. Si al
> jugarlo se siente lento, la reparación son las tasas, no la frecuencia.
>
> Y el camino del mensaje se alarga: el tick pasa de 33 a 50 ms, y el p95 de
> mensaje-a-movimiento de ~77 a **~94 ms**. Sigue holgado bajo el objetivo de
> producto de 150 ms.

**Se puede mostrar:** un mundo corriendo a 30 Hz con física, sin nadie adentro.

---

### Hito 3 — El dios perezoso (2-3 semanas)

`@anima/oracle`: campo de bioma, `resolveChunk` puro, componentes conexas de agua por union-find, stocks con integración perezosa, ledger con dos granos de compromiso, regla de resolubilidad.

**Verificable:** el mismo mundo explorado en dos órdenes **y con dos historias distintas entre medio** produce el mismo hash; escribir otra respuesta para una clave existente lanza `InvariantError`; un hecho fino enmendado antes de interactuar cambia y después no; la fusión de dos lagos con testigo no contradice a ninguno; el río se agota y se repone; ningún chunk acuático queda sin insumos para armar un aparejo en radio 2.

**Se puede mostrar:** un mapa infinito que se resuelve al caminar, con biomas y ríos, y un panel de auditoría que muestra el ledger como narrativa: *"tick 4021: el mundo decidió que este arroyo tenía mojarras"*.

---

### Hito 4 — Cuerpo, sandbox y quince habilidades innatas (3-4 semanas)

`@anima/skills`: `skill-api.d.ts` emitido con `tsc --declaration`, transformer de combustible, ejecutor de generadores, `ctx.memory` persistente, `ctx.math` determinista, globals sombreados. Quince habilidades escritas **a mano en el mismo TypeScript que después va a escribir el modelo**: ir, explorar, juntar, comer, unir, deshilachar, aplicar-proceso, poner, sostener, frotar, tantear, huir del dolor, guarecerse, esperar, seguir-orden-de-movimiento.

**Verificable:** las quince corren dentro del presupuesto; un `while(true)` plantado se corta sin caer un frame; una recursión infinita también; una habilidad corrida dos veces da el mismo hash; una habilidad interrumpida por un guardado converge (test de continuidad); un programa mal tipado se rechaza en menos de 250 ms sin viaje.

**Se puede mostrar:** una criatura que hace cosas, escrita en el mismo lenguaje que el LLM va a usar.

---

### Hito 5 — LA MENTE, SIN LLM. **El hito que decide si la tesis vive** (3-4 semanas)

`@anima/perceive` + `@anima/mind` + `@anima/plan`: vista congelada una vez por tick, necesidades, memoria de afordancias Beta, `opportunities()`, `goalGraph()` con ligaduras diferidas, `plan()` anytime con el índice de esquemas de construcción, ejecutor con verificación paso a paso, escalera de decisión D0-D5.

**Verificable, con el proveedor APAGADO:**
- Con hambre y un río a la vista, la criatura deshilacha un matorral, ata una vara, va y pesca. Sin una sola llamada al modelo.
- Sobrevive 20.000 ticks sola.
- p99 de tick < 5 ms con 5000 cuerpos.
- `ticksPerdidos === 0` durante toda la corrida. Si alguna vez es > 0, la arquitectura falló.

**Criterio de emergencia, con umbral y con juez externo** (porque "aparece un cuarto comportamiento que nadie diseñó" evaluado por el autor de las tablas no es un test): se define **antes** una lista de 10 secuencias objetivo que nadie implementó — tapar la fogata para hacer carbón, secar la fibra mojada antes de atar, usar la parrilla en vez del piso, guardar el asado porque dura más, romper el ensamble para recuperar la vara. **En 20 partidas con semillas distintas tienen que aparecer al menos 4 de las 10, registradas por un detector automático de secuencias, no por observación.**

**Si esto no pasa, el proyecto se para acá y se revisa antes de gastar en la fragua.**

**Se puede mostrar:** ésta es la demo. Una criatura viva que resuelve el hambre inventando una caña, sin IA y sin espera. Si el LLM nunca se conecta, ya hay producto.

> **EL ALCANCE DE ESTE HITO NO SE AMPLÍA.** Está ~80% implementado y termina con
> los seis criterios de arriba. **No se le agregan** planos, persistencia de
> catálogo ni dispositivos autónomos al criterio de cierre: todo eso es el gate
> de abajo. Lo único que el Hito 5 tiene que cuidar es **una costura de
> compatibilidad** — el planificador y la mente no pueden quedar
> arquitectónicamente atados a un catálogo global imposible de reemplazar.
> Medido: `plan()` **ya la tiene** (`OpcionesDePlan.esquemas` reemplaza la tabla
> entera), la **mente no** (llama a `plan()` sin opciones y precalcula precios
> desde `SCHEMA_INDEX` al cargar el módulo). **La mitad que falta es deuda del
> Gate 5→6, no motivo para reiniciar el Hito 5.**

---

### Gate 5→6 — Objetos emergentes dentro de una física fija **(gate técnico obligatorio)**

*También «extensión técnica posterior al Hito 5». Lleva número de puerta y no de hito para que quede dicho que **no reabre el Hito 5**. El criterio completo vive en [`ii/docs/gate-5-6-objetos-emergentes.md`](../../ii/docs/gate-5-6-objetos-emergentes.md).*

**Empieza cuando el Hito 5 termina, y termina antes de que empiece el Hito 6.**

**Qué demuestra:** que Ánima puede inventar objetos y habilidades **dentro de una física fija escrita por humanos**, antes de que exista la UI. El caso de aceptación es **«fabricá una trampa para peces»**, con la trampa **sin precargar**: un dispositivo autónomo desplegado sobre un `Stock`, que la criatura deja, del que se aleja, al que vuelve y del que retira la captura. Los peces **no se mueven** en esta versión y la captura es **estado autoritativo almacenado, no contención geométrica** ([ADR II-0016](../../ii/docs/decisions/II-0016-un-dispositivo-desplegado-retiene-sobre-un-stock.md)). La física genérica de despliegue, retención e interacción con stocks **la escriben humanos**; Ánima inventa **el plano, los materiales, la construcción y el uso**.

**El modelo de planos, que es la decisión estructural del gate** ([ADR II-0015](../../ii/docs/decisions/II-0015-el-plano-no-es-el-esquema-de-construccion.md)). `BlueprintCandidate` **no se inserta en `SCHEMA_INDEX`**. Se separan cinco piezas:

```
BlueprintCandidate   propuesta no confiable
BlueprintDefinition  estructura canónica, inmutable y versionada; NO contiene el sitio
ConstructionSchema   causalidad física: procesos y leyes
BuildSkill           construye una revisión exacta
UseSkill             usa la obra y demuestra su función
```

La definición, la construcción y el uso **se juzgan y se promueven por separado**. Y el catálogo pasa a ser **core inmutable + biblioteca adoptada + overlay versionado de la sesión**, sin ningún `Map` global mutable compartido por partidas ([ADR II-0018](../../ii/docs/decisions/II-0018-el-catalogo-es-core-mas-overlay-por-sesion.md)). El planificador recibe una vista explícita —`PlannerCatalogView { coreSchemas, buildCapabilities, skillCapabilities, catalogEpoch, registryDigest }`— y **una frontera creada con otro `catalogEpoch` se descarta y se replantea**.

**Verificable, con un candidato de plano FIJO y sin proveedor:**

1. `BlueprintDefinition` canónico y versionado
2. registro en un **overlay aislado por sesión**
3. **publicación de capacidades** al planificador
4. **ausencia de mutación global** de `SCHEMA_INDEX`
5. construcción **incremental e idempotente**
6. **separación entre construir y usar**
7. **dos partidas no se contaminan**
8. guardar y restaurar **conserva la revisión exacta**
9. un **cambio de física invalida** los sellos correspondientes
10. el **mismo journal produce el mismo mundo y el mismo catálogo**
11. existe un **descriptor visual procedural determinista**
12. **no hay nombres especiales** para la trampa en producción — no puede existir un `kind`, receta, skill ni caso especial llamado `fish-trap`, `trampa-para-peces` ni equivalente

**Se puede mostrar:** una criatura que fabrica algo que nadie programó, lo deja funcionando y vuelve a buscar lo que atrapó.

---

### Hito 6 — El chat, que no espera al proveedor (2-3 semanas)

`@anima/lang`: léxico vivo derivado de los datos, `readFast` con confianza y detector de polaridad (negación y prohibición **antes** del anclaje), `resolveReference` portado, `nameOf()` derivado de cualidades, canal de habla separado. Los tres relojes y la instrumentación completa.

**Aviso honesto:** "pescar existe como verbo el día que existe el proceso `extraccion`" es falso. El lexema de `extraccion` es *extraer*; *pescar* es extraer fauna de un cuerpo de agua con un aparejo. El puente entre castellano rioplatense conversacional y nombres de procesos físicos es conocimiento humano que hay que escribir: **una tabla de alias de composición**, chica pero real, y hay que presupuestarla.

**Verificable:** corpus versionado de **frases reales en castellano rioplatense**, todas con su archivo de origen y **ninguna corregida ni inventada**. Lo que se le pide al corpus no es tamaño sino FORMAS: alcanza con que estén representadas las difíciles —condicional, negativa, compuesta, con referencia— porque la comprensión la cubre el modelo y lo que el corpus prueba es que ninguna entrada deje al lector en blanco. Y la puerta del hito **no es un porcentaje de comprensión, es un invariante de camino**, con **tres** corridas del mismo corpus:

1. con el proveedor **apagado**, todas producen acuse y primer movimiento — **ninguna devuelve «nada»**;
2. con el proveedor **colgado** —responde a los 30 s, o nunca— **el mismo p95**: la diferencia entre las dos corridas tiene que ser ruido, no una cola;
3. con el proveedor **contestando**, la **cobertura sube** y el p95 del primer movimiento **no se mueve**;
4. p95 de mensaje a primer movimiento **< 150 ms** en las tres;
5. el acuse aparece en el **mismo frame** que el mensaje;
6. `consistenciaDelPrimerGesto ≥ 0.85` con el proveedor apagado.

La 2 y la 3 son las que hacen trabajo, y son un par: **la 2 sola se cumple desconectando el proveedor**. Sin la 3, el criterio mide que el modelo no estorbe y no mide que sirva — que es un piso correcto y no es un hito.

> **Y el «200» se fue, que era la otra herencia del mundo sin modelo.** Ese número medía cobertura por enumeración, que es lo único que se puede hacer cuando el léxico escrito a mano es el único lector. Ver la enmienda del [ADR II-0024](../../ii/docs/decisions/II-0024-el-piso-del-chat-no-es-sin-llm-es-sin-espera.md). Además su premisa era falsa: el historial de chat del repo **tiene nueve mensajes**, no doscientos; el corpus de verdad son los tests de Ánima I (~187 frases). Y ninguna se genera con el modelo — un corpus escrito por un modelo mide el lector contra frases que inventó otro modelo.

**La cobertura sin red se mide, no se elige.** El `≥80% resueltas sin red` era un número puesto a dedo **antes de tener el corpus**, y no hay forma de saber hoy si 80 es exigente o regalado. Pasa a regirse por la regla que la sección de latencia ya fija para todo lo demás —*presupuestos, no mediciones*—: la primera corrida del corpus establece la línea base y **el build falla si baja**. Lo que el hito exige no es entender el 80%; es **no colgarse nunca del proveedor para acusar y arrancar**.

**Por qué se aflojó.** Ver [ADR II-0024](../../ii/docs/decisions/II-0024-el-piso-del-chat-no-es-sin-llm-es-sin-espera.md). En dos líneas: lo que hace que el juego se sienta vivo no es que el parser sea local, es que el cuerpo se mueva antes de que la frase termine de leerse. «Sin LLM» era el modo más simple de garantizar eso, pero garantizaba de más — y a cambio ataba el hito a escribir a mano un léxico que el modelo resuelve gratis. La tabla de alias de composición del aviso de arriba **sigue habiendo que escribirla**: eso no lo ahorra nadie.

**Se puede mostrar:** el producto completo del requisito 1. Le hablás y hace, y **sigue haciendo con la red desenchufada** — sólo que entiende menos.

> **Suma del caso de aceptación.** El chat tiene que **transformar «fabricá una
> trampa para peces» en un objetivo funcional sin nombrar la solución**: el
> resultado se expresa como **captura autónoma y recuperable**, no como un objeto
> con nombre. Y tiene que **informar qué falta** distinguiendo las cuatro clases
> —plano, habilidad, proceso o física— y **mostrar progreso sin detener el
> cuerpo**.

---

### Hito 7 — El juez (2-3 semanas)

`@anima/judge`: evaluación jerárquica con mundos estadificados, banco derivado del contrato con **1/3 adversario**, cuarto reservado, ablación de precondiciones, `inconcluso`, `injuzgable`, regresiones con snapshot real, versionado de física que invalida sellos.

**Verificable:** una habilidad que solo funciona donde la corrigieron no promueve; una de pesca se juzga en mundos con río y nunca saca un 0% falso; un contrato insintetizable devuelve `injuzgable` y no siembra regresiones; una precondición espuria se borra por ablación; bajar un número de la física invalida los sellos que dependen de él.

**Se puede mostrar:** el panel del juez. Por qué una habilidad es estable y otra no, con los mundos donde falló.

> **Suma del caso de aceptación, y es la mitad que hoy no existe.** El juez evalúa
> **por separado**: plano · construcción · uso · utilidad. **Construir algo no
> demuestra que funcione**, y un `BuildSkill` verde con `UseSkill` rojo es un
> resultado legítimo, no un error del arnés.
>
> Los mundos adversos que el banco tiene que incluir: **stock vacío ·
> ubicación incorrecta · materiales alternativos · dispositivo roto · dos
> dispositivos compitiendo · restauración a mitad del ciclo · mundos reservados ·
> ausencia de nombres especiales**.

---

### Hito 8 — La fragua, la escalera y el carril de mejora (4-5 semanas)

`@anima/forge` + `@anima/llm`: HTTP con streaming, prompt caching, warm-up, `AbortController`, app-server con reconexión, K=2 candidatas por viaje, typecheck incremental, diez reparaciones deterministas, protocolo de parches aplicados en frontera de tick, hot-swap con abort cooperativo y `Blackboard` intacto, cuarentena de lo provisional, **presupuesto económico por sesión con política de descarte**.

Más el **carril de mejora**: cola de mejora con los cuatro disparadores deterministas, `K=6` solo en este carril, duelo contra la titular en sus propios mundos, hot-swap en frontera de fase, tope de dos rondas por habilidad.

> **UN NOVENO PUNTO, pedido por el usuario: la candidata que falla ALIMENTA a la
> siguiente.** El criterio de arriba sólo cubre la mitad barata — las
> «reparaciones deterministas» arreglan lo que **no compila**, y no tocan el caso
> que importa: **compiló bien y no sirve**. Ahí el plan empezaba de nuevo con una
> hoja en blanco.
>
> El material ya existe: el `Dictamen` del Hito 7 trae cuatro cargos con su
> `porque` en castellano llano y las regresiones con su mundo. **Se le cuenta el
> QUÉ y el PORQUÉ, no el DÓNDE** —contarle los mundos lo hace aprender los mundos
> y no la habilidad— y **los mundos reservados no entran nunca**. Se afirma
> comparando dónde mejoró: **la segunda candidata tiene que mejorar en los mundos
> reservados**, no sólo en los que le contaron. El detalle, con los tres niveles
> que se consideraron, en [`hito-8-la-fragua.md`](../../ii/docs/hito-8-la-fragua.md).

> **LO QUE EL HITO 6 DEJÓ SOBRE LA MESA DE ESTE HITO, y son tres cosas medidas.**
>
> 1. **El presupuesto tiene DOS consumidores, no uno.** Estaba pensado para la
>    fragua, que se usa poco. Desde el Hito 6 el chat también consulta, se usa
>    mucho más y tiene **otra urgencia**: la fragua puede tardar catorce segundos
>    y el chat no. Con qué prioridad se descarta cuando los dos compiten por la
>    misma cuota **no está decidido**, y es lo primero que hay que escribir acá.
>    Ya estaba anotado como deuda en «Lo que sí se paga» del
>    [ADR II-0024](../../ii/docs/decisions/II-0024-el-piso-del-chat-no-es-sin-llm-es-sin-espera.md).
> 2. **«HTTP con streaming» dejó de ser preferencia y pasó a ser un número.** El
>    puente del Hito 6 anda por el CLI y midió **14 s y US$ 0,0158 por frase**,
>    de los cuales ~10 s son **arranque del proceso**: la sonda directa dio 4 s.
>    O sea que el camino HTTP no compra estilo, compra 10 segundos.
> 3. **Ya hay un cliente de proveedor escrito, y está fuera de `src/` a
>    propósito.** `lang/demo/proveedor.ts` habla con Claude, Codex y OpenAI, y
>    vive en `demo/` porque la regla 2 prohíbe `await` en los `src/`. Este hito
>    es el que le da casa: lo que migra a `@anima/llm` es el cliente, **no** la
>    frontera —`consultaDe()`/`revisar()` se quedan en `@anima/lang`, que es
>    donde el paquete describe la consulta sin poder esperarla.

**Verificable:** dado el gap "conseguir alimento de un cuerpo de agua", al menos una de dos candidatas compila sin reparación y al menos una compila con reparación; matar la conexión a mitad de un parche no deja el mundo inconsistente; el episodio completo no supera N consultas (test de presupuesto en CI); `ticksPerdidos === 0` durante todo el episodio. Del carril de mejora: una habilidad degradada a propósito entra en la cola, se re-forja en el fondo y la candidata ganadora reemplaza a la titular sin perder un tick; una candidata peor no reemplaza nada y queda archivada como regresión; con la cuota agotada, la cola no dispara ni una consulta.

**Se puede mostrar:** aprender algo nuevo en vivo, con el mundo corriendo todo el tiempo.

> **Suma del caso de aceptación.** La fragua deja de producir un archivo y produce
> un paquete:
>
> ```
> BlueprintCandidate + BuildSkillCandidate + UseSkillCandidate
>   + dependencias + capacidades publicadas
> ```
>
> Con **cuarentena**, **reparaciones limitadas**, **máximo de consultas**,
> **aplicación en frontera de tick**, **digest base esperado** y **rechazo si el
> catálogo cambió**. Y un lint más: **prohibido copiar constantes físicas dentro
> de las skills** — un literal de calibración adentro de una habilidad es un sello
> que `physicsVersion` no puede invalidar.

---

### Hito 9 — La biblioteca semilla (2 semanas)

Cuarenta a sesenta habilidades escritas y **promovidas a estable de fábrica**: pescar, encender, asar, atar, deshilachar, recolectar, refugiarse, cocinar, secar, guardar, cargar, apilar.

**Por qué es un hito y no un detalle:** es la reparación de producto más importante del corpus entero, y las tres críticas la pidieron. El caso frío son 6-25 s, y los tres ejemplos del usuario son por definición primeras veces. Con biblioteca semilla, **la demo del pescado es caso caliente (80 ms)** y el caso frío queda para la cosa que el usuario invente en vivo — que es exactamente cuando la gente acepta que la máquina piense.

**Verificable:** las tres historias del usuario corren en camino caliente de punta a punta: **la fragua no se despierta ni una vez** —cero consultas suyas, que es exactamente lo que la biblioteca compra— y el **reloj** del primer movimiento no se mueve contra la línea base del Hito 6. El chat sí puede consultar al modelo; desde el [ADR II-0024](../../ii/docs/decisions/II-0024-el-piso-del-chat-no-es-sin-llm-es-sin-espera.md) eso no cuesta espera.

> **Decía «con cero llamadas al modelo», y era la moneda vieja.** El párrafo de acá arriba justifica el hito hablando **todo** de tiempo —«el caso frío son 6-25 s», «la demo del pescado es caso caliente (80 ms)»—, así que lo que el criterio defendía eran los 80 ms. Contar llamadas era la forma de medirlos **mientras toda llamada bloqueaba**. Desde el Hito 6 dejaron de ser lo mismo, y la frase se parte en las dos cosas que tenía pegadas: la fragua dormida (binaria, y es el mérito de la biblioteca) y el reloj (que es lo que el usuario siente). Ver la tercera enmienda del [ADR II-0024](../../ii/docs/decisions/II-0024-el-piso-del-chat-no-es-sin-llm-es-sin-espera.md).

**Se puede mostrar:** la demo definitiva.

> **Suma del caso de aceptación.** La biblioteca guarda **planos promovidos**,
> **revisiones históricas referenciadas** y **pares build/use**, con **índice por
> efectos y no por nombres**, y con la **separación core / biblioteca / sesión**
> explícita. **La biblioteca semilla no incluye la trampa reservada**: si viniera
> de fábrica, el caso de aceptación dejaría de medir nada.

---

### Hito 10 — Crónica y herencia (2 semanas)

`@anima/store`: journal append-only con snapshots por delta en IndexedDB fuera del tick, caché de contratos persistente, herencia (biblioteca + procesos + ledger + regresiones + gaps abiertos) con re-validación **perezosa y priorizada**.

**Verificable:** replay de 20.000 ticks reproduce el hash exacto **y re-ejecuta las habilidades comparando la traza**; cerrar y reabrir la pestaña a mitad de una obra no pierde el mundo y la habilidad converge; una heredera arranca con la biblioteca completa y ninguna credencial regalada; **una segunda vida resuelve "pescá" en menos de 100 ms sin despertar la fragua**.

**Se puede mostrar:** dos generaciones. La segunda sabe lo que la primera aprendió.

> **Suma del caso de aceptación.** Aparece el **journal de catálogo** con el
> **manifiesto exacto del registry**, y los cuatro gestos —**promoción,
> activación, revocación y adopción**— quedan registrados. Del lado de la obra:
> **proyecto, sitio, revisión y progreso**. Y tres reglas: **aislamiento entre
> saves**, **herencia provisional con revalidación perezosa**, y **conservación de
> las revisiones referenciadas** (borrar una revisión que un save menciona rompe
> el replay).
>
> **No se serializan generadores ni fronteras.** Al cargar, **se replanifica de
> forma idempotente**: es el ADR 0009 de Ánima I —«la actividad en vuelo no se
> guarda»— aplicado también al catálogo.

---

### Hito 11 — Calibración y presupuestos como test (4+ semanas, y después continuo)

Barrido de rangos, detección de ciclos rentables como puerta, tests de propiedad económicos, y la suite de rendimiento en CI: `msHastaPrimerMovimiento` p50/p95, `msHastaAcciónPertinente`, `consistenciaDelPrimerGesto`, tasa de escalada por peldaño, viajes al modelo por operación, combustible por habilidad, y crecimiento del costo por tick a lo largo de 50.000 ticks.

**Verificable:** el build falla si cualquiera de esos números empeora contra la línea base registrada; 100 partidas automatizadas de 20.000 ticks sin violar ningún invariante económico y sin superar el techo de consultas.

> **TRES DE ESOS RELOJES YA EXISTEN Y YA TIENEN LÍNEA BASE.** Están en
> `lang/src/relojes.ts` desde el Hito 6, corriendo sobre el corpus. Este hito no
> los inventa: los **hereda**, los extiende al resto del sistema y les pone el
> guardián de CI.
>
> | reloj | línea base del Hito 6 |
> |---|---|
> | `msHastaPrimerMovimiento` | p95 **1,35 ms** apagado contra **1,22 ms** colgado, con el control en 21,15 |
> | `consistenciaDelPrimerGesto` | **1,00**, con su control positivo |
> | `msHastaAccionPertinente` | **1 tick** |
>
> **Y el último número aclara cuándo empieza a valer su presupuesto.** La
> sección de latencia lo define bien —*«frío: segundos»*— y lo que faltaba decir
> es la consecuencia: **el caso frío no existe hasta el Hito 8**, porque hasta
> que haya fragua toda habilidad ya está escrita. Medido en el Hito 6 da **1
> tick**, indistinguible de `msHastaPrimerMovimiento`, y eso **no es una
> regresión**: es que el reloj todavía no tiene nada que medir. Su presupuesto
> propio arranca con la fragua, y la línea base contra la que este hito lo
> compara hay que tomarla **ahí**, no en el Hito 6.

**Este hito no es opcional: es donde se paga el precio de haber elegido emergencia sobre catálogo,** y es la única forma de que "velocidad es el requisito número uno" siga siendo verdad dentro de seis meses.

> **Suma del caso de aceptación.** Ocho números más: **costo del registry ·
> crecimiento del planner · replay con promociones · rendimiento de dispositivos
> autónomos · consumo de consultas · benchmark del proveedor · invalidación física
> · estabilidad económica de múltiples dispositivos**.
>
> Y una separación que no se negocia: **CI determinista, benchmark real y E2E de
> navegador corren aparte**. Mezclarlos es cómo un banco de 500 s termina adentro
> de la suite compartida y nadie la corre más — ya pasó dos veces en este
> proyecto. **No se permiten reintentos ilimitados.**

---

### Hito 12 — La UI presentable

*Va **después del Hito 11**. Se divide en subhitos, sin cambiar la numeración principal.*

**El modelo de experiencia es el de Ánima I y se conserva entero:**

- **el mapa es la vista principal**;
- la criatura **aparece dentro del mundo**;
- **se mueve y actúa visiblemente**;
- los **cuerpos, objetos, obras y dispositivos del área visible aparecen en el mapa**;
- el mapa **se actualiza en tiempo real**;
- **el chat acompaña al mapa y no lo reemplaza**;
- las acciones y construcciones **se ven mientras ocurren**.

**No se fija acá ningún estilo gráfico, paleta ni distribución**: el usuario todavía no los eligió.

#### Hito 12A — El view model

Datos de mapa · criatura · cuerpos · objetos · relaciones · obras · dispositivos · **deltas deterministas** · **descriptor visual canónico** · **`renderDescriptorHash`** · **fallback procedural**.

#### Hito 12B — La vertical visible

Nueve cosas, y son la definición de «presentable»:

1. ver el mapa
2. ver la criatura moviéndose
3. ver **todos** los objetos del área visible
4. escribir una orden en el chat
5. recibir **acuse inmediato**
6. observar progreso y acciones
7. inspeccionar la criatura
8. inspeccionar cuerpos y obras
9. cerrar y reabrir **sin perder la sesión**

#### Hito 12C — Los objetos emergentes en pantalla

Siete estados que hay que poder mostrar: **objeto sin sprite específico · obra incompleta · objeto terminado · dispositivo desplegado · dispositivo con captura · catálogo de planos · la misma representación coherente en mapa, inventario y catálogo**. **El fallback es obligatorio.**

La representación inicial es **procedural y esquemática**, derivada de: **forma · materiales · partes · juntas · progreso · estado desplegado · captura almacenada**. **No inventa posiciones, orientaciones, aberturas ni contención que la física no modele** ([ADR II-0017](../../ii/docs/decisions/II-0017-el-descriptor-visual-no-es-fisica.md)).

```
mismo snapshot + misma versión del descriptor + mismos datos estructurales
    → mismo renderDescriptorHash
```

**Quedan fuera del hash:** textos localizados, nombres narrativos, skins, íconos generados, raster, hover, selección, animaciones y cosmética. **Las skins con IA son post-1.0 y nunca pueden bloquear el render.**

---

## Después del Hito 12 — la física se abre

**No se promete «cualquier cosa».** La definición que se usa, y es la que hay que decirle al usuario:

> **Ánima puede crear cualquier artefacto cuya estructura, construcción, uso y
> efectos puedan representarse y comprobarse con las capacidades físicas
> disponibles en ese nivel.**

### Hito 13 — Procesos físicos propuestos por Ánima

Hasta acá la física es **fija y humana**. Desde acá, Ánima puede **proponer procesos nuevos**, y la distinción entre las dos cosas se mantiene escrita.

Propuesta de `Process` · **roles seguros** · `admit()` · conservación · `poweredBy` · **verificación de `establishes`** · cuarentena · límites de aplicación · **invalidación por `physicsVersion`** · **prohibición de automatismos globales provisionales** · replay y revalidación.

### Hito 14 — Geometría física autoritativa

**Después de un spike**, porque hoy no hay base para estimarlo: posiciones internas · orientación · puntos de unión · contorno · volumen · huella · aberturas · **paso según tamaño** · contención · contenido · daños localizados.

**Física, juez, percepción y renderer comparten la misma geometría.** Dos geometrías es cómo se llega a que la pantalla afirme una cosa y el mundo otra.

### Hito 15 — Objetos físicos abiertos

Integra `BlueprintDefinition` + procesos admitidos + `BuildSkill` + `UseSkill` + geometría canónica + juez + persistencia + representación gráfica.

El objeto tiene que: **no estar precargado · originarse desde el chat · declarar qué capacidades faltan · construir solamente las piezas ausentes · funcionar en mundos reservados · sobrevivir guardado y herencia · no depender de su nombre · verse según su estado real**.

### Hito 16 — Fauna y agentes físicos

**Separado a propósito, y la primera trampa no depende de este hito**: peces materializados · movimiento · corriente · colisiones · entrada y salida · contención física · daño · reconciliación entre entidades y stocks.

---

## Pruebas

**CI determinista.** Candidato fijo · sin proveedor · mundos y semillas fijos · overlay · construcción · uso · replay · invalidación · descriptor · aislamiento entre sesiones.

**Benchmark real — propuesta inicial, PENDIENTE DE LÍNEA BASE.** Ninguno de estos números está medido; son el diseño del experimento: 30 episodios · 10 mundos reservados · 3 intentos por mundo · máximo 3 rondas · máximo 6 consultas · máximo 120 s · máximo provisional de US$ 1 por episodio · éxito mínimo provisional de 21/30 · ningún mundo con 0/3 · cero violaciones de invariantes.

**E2E de navegador.** Proveedor controlado o respuesta grabada · mensaje en ticks definidos · mismo journal · comparar `worldHash`, `registryDigest` y `renderDescriptorHash` · comprobar movimiento visible · comprobar **todos** los objetos del área visible · fallback visual obligatorio.

---

## Presupuesto, clasificado

Los **7 a 9 meses** del encabezado son **pronóstico histórico**. No incluían UI, objetos emergentes, dispositivos autónomos, geometría, procesos físicos nuevos ni fauna materializada. **No se calcula un total nuevo sin base.**

Toda cifra se clasifica: **medición existente** (se corrió, tiene arnés y exit code) · **ROM con confianza** (orden de magnitud, con la confianza declarada) · **desconocido pendiente de spike**.

**Referencias ROM, NO ADITIVAS** — se solapan entre sí y con hitos ya planificados:

| trabajo | ROM | confianza |
|---|---|---|
| aparejo activo | 3–7 días | alta |
| dispositivo autónomo | 5–9 semanas | media-baja |
| vertical registry/build/replay | 6–9 semanas | media-baja |
| promoción, persistencia y herencia completas | 15–24 semanas, con solapamiento en H7–H10 | baja |
| fauna y geometría completa | 4–8 meses | muy baja |

---

# Los cinco riesgos más grandes

### 1. Calibrar once leyes acopladas es el mayor riesgo de cronograma del proyecto

El modo de falla se mueve de "no compila" a "nada se cocina nunca" o "todo se prende fuego en cadena" o "un bioma se vacía en 40 ticks". Un compilador no atrapa nada de eso, y la emergencia también emerge para el mal. Con 22 cualidades y 11 leyes el espacio de parámetros es grande y los acoplamientos son cruzados: tocar `specificHeat` de la carne cambia si la parrilla sirve.

**Mitigación:** tests de propiedad de estabilidad (ningún mundo aleatorio llega a estado absorbente antes de N ticks; ninguna cualidad conservada crece en 10⁶ procesos); envolventes por tag; modo laboratorio que barre rangos; **banco de mundos de referencia con hash** que detecta cuándo una perilla cambió una historia. Y versionado de física, para que la biblioteca no acumule sellos contra una física muerta.

**Residual honesto:** semanas de perilla, y un período en el que el juego es **peor** que el actual, porque el actual tiene el balance clavado a mano. Hay que aguantarlo.

### 2. La especulación puede leerse como estupidez, no como reactividad

Moverse en 80 ms hacia el lugar equivocado durante 20 segundos es peor, para mostrar al mundo, que un indicador honesto de dos segundos. El usuario dijo "no quiero que esté ahí pensando" — pero una criatura que junta cosas al azar y después pega un volantazo tampoco es lo que pidió.

**Mitigación:** detector de polaridad determinista antes del anclaje; umbral de confianza por debajo del cual **no se compromete a una conducta sino a orientarse**, que es una apuesta mucho más barata de equivocar; solo intenciones `reversible`; histéresis (margen 0.15, permanencia 8 ticks, un swap cada 20 ticks salvo orden explícita); y **dramaturgia**: el tanteo narra lo que hace por el canal de habla (*"voy juntando palos mientras pienso cómo se hace una caña"*), de modo que la preparación se lea como preparación.

Y sobre todo: **la métrica `consistenciaDelPrimerGesto` en CI con umbral 0.85.** Si baja, la especulación se apaga hasta que suba. Es la única defensa medible.

**Residual honesto:** va a haber casos visiblemente equivocados. La biblioteca semilla los reduce muchísimo, porque el caso caliente no especula.

### 3. `planFor` en 8 ms depende de un índice que escribe un humano

El índice de esquemas de construcción es la pieza que hace viable todo el planificador, y **no es una consecuencia de las leyes**: es conocimiento humano sobre ellas. O sea, el vocabulario cerrado no son 22 cualidades y 11 procesos: son 22 + 11 + N esquemas, y N crece con el mundo.

**Mitigación:** cada proceso nuevo que escribe la fragua declara su `establishes`, y el juez lo **verifica por ablación** antes de aceptarlo en el índice. Así el índice crece con lo aprendido y no solo con lo escrito a mano.

**Residual honesto:** al principio N lo escribimos nosotros, y "la criatura puede hacer cualquier cosa" es en realidad "puede combinar cualquier cosa cuya física ya esté escrita". Es una respuesta honesta al requisito 1, y hay que decírsela al usuario antes de empezar, no después.

### 4. El dios es el agujero de la conservación

`nutrition` es conservada, pero el oráculo puede sembrar peces. Si el presupuesto calórico por chunk está mal calibrado, la criatura tiene una fuente infinita de comida siempre que pueda caminar hasta el chunk siguiente — y ahí el hambre, que es el motor de toda la historia, deja de doler.

**Mitigación:** presupuesto calórico por chunk como **función pura de la semilla**; el oráculo elige forma y nombre pero **nunca escribe números**; `aportadoEsteTick ≤ min(pedido, presupuesto)` verificado como invariante; stocks finitos con regeneración logística; y un test económico de 100 partidas de 20.000 ticks donde la energía neta acumulada de la criatura tiene que ser **negativa sin trabajo**.

**Residual honesto:** el balance de la regeneración es una perilla de diseño, no una consecuencia física. Va a haber una versión del mundo donde comer es demasiado fácil, y se va a notar tarde.

### 5. El remake mata los guardados y 46.000 líneas de conocimiento ganado a los golpes

No hay traducción de `Components` cerrado a sustancias con cualidades que preserve lo que la criatura aprendió. Toda criatura viva hoy muere en la migración. Y además mueren ~90 archivos de test de `agent-core` (`la-cuenta-de-las-manos`, `no-girar-en-el-lugar`, `el-credito-es-del-problema`, `no-canibalizar`, `obra-a-medias`, `un-veto-no-es-sentencia`) que son comportamiento ganado peleando contra un LLM real, y los 86 ADRs que los explican.

**Mitigación:** el **inventario de ADRs antes del Hito 1**, con cada comportamiento asignado a un hito. Y la disciplina de portar `reference-resolver.ts`, `spatial-goals.ts`, `executor.ts`, `progress.ts`, `refusal.ts` y `skill-evaluator/` **casi tal cual**, no reescribirlos: son las piezas que ya funcionan.

**Residual honesto:** esto es un remake, no un refactor. El precio es empezar de cero con las vidas, y va a haber tres meses en los que el remake hace **menos** que el Ánima actual. Si eso no es aceptable, la alternativa realista es aplicar hoy, sin remake, las seis cosas que se pueden hacer esta semana y compran casi toda la latencia percibida: sacar el mensaje del timer del tick, sacar el habla del turno del cuerpo, emitir la referencia del DSL desde los schemas en vez de mantenerla a mano, congelar la percepción una vez por tick, poner índice por tipo en el `EventLog`, y hacer la vista por diff.

---

*Este documento reemplaza a las tres propuestas. Lo que quedó demolido por sus críticas no está acá, y está dicho por qué: QuickJS-WASM, corutinas serializables, transiciones por sustancia, `apertureArea` topológica, embeddings en el arranque, K alto vendido como menos latencia, pre-decreto que escribe estado del hash, el oráculo que escribe números, `admit()` con una sola cuenta conservada, y los números de latencia que describían el caso caliente mientras la demo es el caso frío.*
---

# Apéndice — Huecos conocidos de este documento

Un auditor de completitud leyó el documento terminado y encontró lo siguiente.
Está acá sin maquillar, porque un plan que esconde sus agujeros es peor que no
tener plan.

## Requisitos que quedaron resueltos con humo

**Requisito 7 — automodificación con Codex. → CERRADO.** El usuario decidió el
alcance: **el modelo escribe habilidades**, y no toca la física, el motor, la UI
ni la persistencia. Ver *«Qué escribe el modelo, y qué no — decidido»*. El juego
no se automodifica; la criatura sí.

**Requisito 1 — «cualquier cosa, y si no sabe, aprende». → CERRADO con techo
declarado.** Con el alcance de arriba, la criatura aprende cualquier cosa que se
pueda **componer** con las once leyes y la geometría de ensambles — lo que
incluye todas las **técnicas**, que es donde vive casi todo lo interesante. No
aprende transformaciones físicas que las leyes no contemplen (fermentar, curtir,
destilar). El capítulo *«cómo nace un proceso nuevo»* queda **diferido con la
forma ya definida** (`Process` es dato, `admit()` es la puerta, la ablación
verifica `establishes`), como Hito 12 opcional. Diferido, no borrado.

**Requisito 2 — el pensamiento lento como mejora. → CERRADO.** Se agregó *«El
carril de mejora»*: cuatro disparadores deterministas (degradada, dominada,
atascada, sello vencido), `K=6` solo en ese carril, duelo contra la titular en
sus propios mundos, tope de dos rondas por habilidad, y prioridad negativa contra
todo lo demás. Entra al Hito 8 con criterio verificable propio, y por eso el hito
pasó de 3-4 a 4-5 semanas.

**Requisito 5 — el dios.** Bien resuelto, con un hueco: `ensureSolvable`
garantiza insumos en radio 2 por chunk. No garantiza solubilidad global ni que la
criatura **encuentre** el insumo.

## Decisiones que quedaron sin justificar

- **30 Hz.** Con `friccion` a 6 °C/tick y `desnaturalizacion` a ~300 ticks, la
  tasa de tick **es** la calibración. Fijar 30 antes del Hito 1 es decretar una
  constante física.
- **22 cualidades y 11 leyes, esos números.** `oxygen` (cualidad de celda),
  `stock` (cualidad de rol) y `wet` (cualidad percibida) aparecen en los ejemplos
  y no están en la lista de 22. El catálogo cerrado ya no cierra en su propio
  documento.
- **`MAX_PARTS=6` / `MAX_JOINTS=8` / `DEPTH=2`.** Con profundidad 2 no hay
  parrilla-sobre-trípode-con-atadura, y eso no se verifica en ningún test.
- **Beta como única representación de creencia.** Un Beta por (contexto, tag) no
  distingue «no hay pescado» de «no sé pescar». Colapsa dos causas del fracaso en
  un solo posterior.

## Lo que se rompe primero

**La calibración térmica del Hito 1**, y no por lo que dice el riesgo 1. La tabla
de `formFactor` (0.012 / 0.03 / 0.60 / 0.125) está escrita **a mano por
situación**: es exactamente la «tabla de recetas disfrazada» que el documento
acusa en las tres propuestas, pero metida en la ley 1. En cuanto haya un tercer
cuerpo, viento, o un soporte a altura 2, hay que escribir la función real — y la
ventana entre «no cocina» (63 °C) y «se quema» (280 °C) tiene que seguir
existiendo para treinta sustancias, no para dos.

**Segundo:** `hasProfitableCycle` como puerta. Es detección de ciclos con saldo
sobre un grafo que crece con cada proceso aprendido; los «~5 ms» no están
justificados, y directamente **no existe** si los efectos son `perTick` sobre
cantidades que dependen del estado (el saldo de A→B→A depende de la temperatura
del mundo, no del proceso).

## Lo que no se menciona en absoluto

- **La UI.** Cero. `apps/web` tiene Phaser, arrastrar-y-soltar, autenticación y
  dos hojas de estilo; el documento le dedica una caja de ASCII a «render por
  diff». No hay hito de UI ni presupuesto. Es el requisito 1 literal («aparece el
  mapa») y es el único paquete sin planificar.
- **Nostr, multiusuario, despliegue.** «`apps/api` se conserva» es toda la
  mención. Y el modelo de amenaza del sandbox dice que **no aguanta habilidades
  compartidas entre usuarios**: el documento cierra la puerta a lo social sin
  avisar que la está cerrando.
- **Migración de guardados.** Se declara la muerte de las criaturas vivas como
  «residual honesto» y se termina ahí. Para un producto cuya esencia es el legado
  entre generaciones, no tener ni un museo de la generación anterior es una
  contradicción con el riesgo 5.
- **Los ~90 tests de `agent-core` y los 86 ADRs.** El «inventario obligatorio de
  ADRs» es una tarea sin hito, sin dueño y sin criterio de cierre.
- **Memoria episódica, personalidad, misiones, día/noche.** Aparecen en una
  enumeración al final de un párrafo y nunca más. `@anima/memory` y
  `apps/missions` son paquetes reales que el mapa de capas no tiene.
- **Observabilidad para el usuario.** No hay diseño de cómo el usuario ve *por
  qué* Ánima hizo lo que hizo. Hoy eso existe (razonamiento por SSE) y se tira.

## Las tres correcciones de mayor impacto

**A. ~~Escribir el capítulo «cómo nace un proceso nuevo».~~ → RESUELTO por
decisión de alcance.** No se escribe porque no entra: el modelo escribe
habilidades. El techo del requisito 1 quedó declarado en vez de disimulado, que
era el fondo del reclamo. Lo que sí se escribió, y era la otra mitad del hueco,
es el **carril de mejora**: la habilidad que ya existe y anda mal ahora tiene
quién la reescriba.

**B. Reemplazar la tabla de `formFactor` por la función, y adelantar la
calibración al Hito 0.** El Hito 0 debería correr un barrido de la ley térmica y
demostrar que existe una ventana de cocción estable para **diez** sustancias, no
para una. Si esa ventana no existe sin números por caso, el modelo físico cambia
ahí y no en el mes cinco.

**C. Agregar un hito de UI y un hito de continuidad de producto** (Nostr,
guardados, museo de la generación anterior), y clavar el inventario de ADRs como
Hito 1a con lista cerrada. Hoy el plan de 7-9 meses no incluye una sola semana de
las tres cosas que el usuario efectivamente ve: el mapa, el chat, y su criatura
anterior. Sin eso la estimación no es optimista: es incompleta.

## Deriva entre la prosa y las fórmulas

El documento dice `reach>=2` para la caña y `reach: longestAxis`. Una vara pelada
de dos celdas de largo ya cumple `reach>=2`: lo único que impide pescar con un
palo es `catch>0`, que sale de `freeStrandEnds`. Está bien — pero entonces el
ejemplo (c) **no necesita la unión para el alcance, solo para el enganche**, y el
texto lo cuenta al revés. Ese tipo de deriva entre lo que dice la prosa y lo que
dicen las fórmulas es lo que va a hacer que la calibración duela.
