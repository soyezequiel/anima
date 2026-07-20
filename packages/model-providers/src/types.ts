/**
 * Interfaz neutral hacia modelos de lenguaje. El agente formula peticiones
 * cognitivas estructuradas; los proveedores devuelven respuestas
 * estructuradas. Nada del resto del sistema conoce proveedores concretos.
 *
 * Importante: lo que devuelve un proveedor NUNCA se ejecuta directamente.
 * Los programas propuestos pasan por validación de la DSL y por el evaluador
 * independiente antes de tocar el mundo real.
 */

/**
 * Una habilidad de la biblioteca como se la muestra al modelo (ADR 0055):
 * lo justo para decidir si le sirve de pieza. El `id` interno no viaja — el
 * modelo compone por NOMBRE, que es lo que puede escribir sin equivocarse.
 */
export interface SkillSummary {
  name: string;
  /** Para qué sirve, en una línea. */
  purpose: string;
  /** Qué deja hecho cuando termina bien. */
  expectedOutcome: string;
  /** `probada` (pasó el evaluador) o `a medio probar` (provisional). */
  trust: 'probada' | 'a medio probar';
}

export type ModelRequest =
  | {
      kind: 'skill.propose';
      skillName: string;
      problem: string;
      /** Observaciones del agente: entidades relevantes, fallos previos. */
      context: string[];
      /** Criterios que el evaluador medirá: el programa debe satisfacerlos. */
      successCriteria?: string[];
      /** Lo que ya sabe hacer, para poder componer con ello (ADR 0055). */
      library?: SkillSummary[];
      /**
       * Si puede contestar «esto es muy grande, creá antes estas piezas»
       * (ADR 0055). Falso en el ciclo de una sub-habilidad: descomponer lo ya
       * descompuesto no termina nunca.
       */
      mayDecompose?: boolean;
    }
  | {
      kind: 'skill.revise';
      skillName: string;
      /**
       * Por qué se vuelve a preguntar. No es lo mismo un programa que se midió
       * en simulación y no alcanzó, que uno que ni siquiera se pudo leer:
       * decirle «fallaste las pruebas» a quien escribió mal la forma lo manda
       * a corregir lo que no está roto, y encima le miente sobre unas pruebas
       * que nunca corrieron.
       */
      reason: 'evaluation-failed' | 'invalid-program' | 'repeated-program';
      /** El problema original: la revisión no puede perder de vista el objetivo. */
      problem: string;
      /** Criterios que el evaluador medirá: la vara no cambia entre versiones. */
      successCriteria: string[];
      /** Observaciones del agente al abrir el ciclo (entidades, fallos previos). */
      context: string[];
      /** El mejor programa hasta ahora: la base de la corrección. */
      previousProgram: unknown;
      failureObservations: string[];
      /** Qué versión es la base y cómo le fue, para razonar sobre la trayectoria. */
      baseVersion?: number;
      /**
       * Cómo le fue a la base, mundo por mundo: dónde pasa y dónde falla.
       * `inconclusive` es el mundo que no dio (ADR 0030): se muestra para que
       * el modelo no lo confunda con un fallo y corrija lo que no está roto.
       */
      caseResults?: {
        scenario: string;
        seed: number;
        verdict: 'passed' | 'failed' | 'inconclusive';
        observations: string[];
      }[];
      /** Versiones ya intentadas: enfoques que no hay que repetir. */
      history?: {
        version: number;
        rationale: string;
        successRate: number;
        failureObservations: string[];
      }[];
      attempt: number;
      /** Cuántos intentos hay en total: administrar el crédito también es razonar. */
      maxAttempts?: number;
      /** Lo que ya sabe hacer, para poder componer con ello (ADR 0055). */
      library?: SkillSummary[];
    }
  | {
      kind: 'interpret.signal';
      signal: string;
      userMessage?: string;
    }
  | {
      kind: 'interpret.command';
      text: string;
      facts: string[];
      /** Turnos anteriores para resolver referencias como "eso" o "allá". */
      history?: { from: 'user' | 'pet'; text: string }[];
      /** Habilidades ya aprendidas: el catálogo ejecutable no es fijo. */
      skills?: { name: string; description: string }[];
      /** Lo que este mundo admite construir: sin esto, "craft-item" no existe. */
      recipes?: { id: string; ingredients: string }[];
    }
  | {
      /**
       * Traduce lo que el cuidador quiere enseñar a un contrato evaluable.
       * Es un momento cognitivo aparte del que propone el programa: primero
       * hay que acordar qué significaría lograrlo, y recién después intentarlo.
       */
      kind: 'skill.contract';
      request: string;
      conversation: { from: 'user' | 'pet'; text: string }[];
      facts: string[];
    }
  | {
      /** Destila una afirmación didáctica del cuidador a un enunciado guardable. */
      kind: 'distill.knowledge';
      text: string;
      conversation: { from: 'user' | 'pet'; text: string }[];
    }
  | {
      /**
       * "¿Quiero hacer esto?" — NO "¿puedo?". Solo se pregunta cuando el mundo
       * ya dijo que se puede y la única duda que queda es de valores: destruir
       * algo que quizá necesite. El modelo pesa el contexto real (cuántos
       * quedan, su energía, lo que cree saber), que es justo lo que una tabla
       * no puede: talar el único árbol es suicidio; con otros dos, no.
       */
      kind: 'judge.destruction';
      /** Lo que el cuidador pidió, con sus palabras. */
      request: string;
      targetKind: string;
      /** Estado real y verificable: la base de la decisión, no una opinión. */
      facts: string[];
      conversation: { from: 'user' | 'pet'; text: string }[];
    }
  | {
      /**
       * Inventar un objeto que su mundo todavía no sabe construir. El modelo
       * propone el arquetipo; el mundo lo valida y decide. Proponer no es
       * poder: la física no la escribe quien la imagina.
       *
       * La respuesta puede ser un `recipe-plan`: lo complejo se hace de lo
       * simple (ADR 0031), así que una casa se propone junto con las paredes y
       * las tablas que hacen falta abajo. Cada receta del plan pasa por la
       * puerta por separado.
       */
      kind: 'recipe.propose';
      /** Para qué lo necesita: el problema, no la solución. */
      problem: string;
      /**
       * El id (y tipo) que la receta DEBE tener, cuando el problema es una
       * petición del cuidador. Pidió "una casa" y la idea tiene que llamarse
       * así: si la bautizara distinto, la petición seguiría sin encontrar su
       * receta y ella inventaría en círculos hasta quedarse sin crédito.
       *
       * Ausente cuando la idea nace de un problema suyo (tengo frío): ahí el
       * nombre es cosa de ella.
       */
      wantedId?: string;
      /** Materiales que existen a su alcance. */
      materials: string[];
      /** Recetas que ya existen: no tiene sentido reinventarlas. */
      existingRecipes: string[];
      /**
       * Hasta dónde llega una obra desde su ancla, en celdas (ADR 0035). Viaja
       * porque quien imagina no puede leer al validador: el texto decía «x,y ∈
       * {-1,0,1}» —el alcance del brazo del ADR 0032— mucho después de que la
       * obra pasara a levantarse caminando. Con esa reja, el puente más largo
       * que podía imaginar medía 3 celdas y el cauce medía 4: no era un error
       * de cálculo, era un imposible.
       */
      reach?: number;
      /**
       * Cuántos bloques admite un plano. Ya no es lo que puede cargar: desde el
       * ADR 0035 camina hasta cada celda, así que las manos dejaron de ser el
       * techo.
       */
      maxBlocks?: number;
      /** Rechazos previos del mundo: por qué su idea anterior no era posible. */
      rejections?: string[];
      /**
       * Experiencia previa relacionada (ADR 0033): lo que ya hizo o ya le
       * falló, recuperado de su memoria episódica. Contexto, no instrucción:
       * la idea nueva no debería ignorar la historia.
       */
      priorExperience?: string[];
    }
  | {
      /**
       * La IA Dios juzgando una receta inventada (ADR 0042). La puerta
       * determinista ya midió lo que se puede medir — que no cree materia, que
       * no cicle, que los componentes estén en cota. Lo que ninguna tabla mide
       * es la PROPORCIÓN entre lo que la cosa es y lo que costó.
       *
       * "celular = 1 rama + 1 pedernal" pasa todas las comprobaciones porque
       * cada una mira un paso aislado, y el paso está bien formado. Lo que está
       * mal es que falten los pasos del medio: un celular no es imposible en un
       * mundo abierto, pero se gana bajando por procesador, memoria y pantalla,
       * y cada una por su propia cadena, hasta la materia prima. El juez no
       * prohíbe la idea: exige el árbol que la sostiene (ADR 0031).
       */
      kind: 'recipe.judge';
      /** Para qué la inventó: el problema que decía resolver. */
      problem: string;
      /** Cómo se llamará lo construido. */
      outputKind: string;
      /** De qué se hace, en frases humanas ("1x rama", "2x pedernal"). */
      ingredientsSummary: string[];
      /** Qué haría lo construido, en frases humanas ("se puede llevar"). */
      effectsSummary: string[];
      /** Qué dejaría al romperse, si algo. */
      dropsSummary?: string[];
      /**
       * Esta receta es una PIEZA de una obra que ya se propuso, no la cosa
       * pedida (ADR 0074).
       *
       * Cambia qué se le pregunta al juez. La pregunta «¿esto es una cosa o un
       * lugar?» (ADR 0072) solo tiene sentido sobre lo pedido: si la respuesta
       * del modelo fue un plano, ya contestó que es un lugar —el tipo de la
       * respuesta ES la decisión, ADR 0032— y volver a preguntárselo a cada
       * ladrillo hace que rechace ladrillos. Pasó: tumbó un fogón por llamarse
       * como una cocina.
       */
      partOfWork?: boolean;
      /**
       * Qué sabe construir ya su mundo. Es lo que separa un salto de un paso:
       * "celular de procesador + pantalla" es honesto SI el procesador y la
       * pantalla están en esta lista, y es el mismo salto de siempre si no.
       */
      knownRecipes: string[];
      /**
       * Cuántas capas de receta le quedan por debajo antes del tope del mundo.
       * El juez tiene que saber si el árbol que va a exigir cabe: pedirle seis
       * pisos a un mundo que admite cuatro es mandarla a una pared.
       */
      depthBudget: number;
      /** Estado real y verificable del mundo: la base del juicio. */
      facts: string[];
    }
  | {
      /**
       * Traducir la descripción libre del cuidador ("un glorb es un mineral
       * azul que da calor") a una receta propuesta. Es el mismo trato que
       * `recipe.propose`: el modelo traduce, la receta viaja cruda y el mundo
       * la valida — que la describa el cuidador no le da más poder que a la
       * mascota (ADR 0024).
       */
      kind: 'entity.describe';
      /** La descripción del cuidador, con sus palabras. */
      description: string;
      /** Tipos de objeto que existen a su alcance: los ingredientes salen de aquí. */
      knownKinds: string[];
      /** Recetas que ya existen: no tiene sentido re-describirlas. */
      existingRecipes: string[];
    }
  | {
      /**
       * Inventar una interacción con un objeto que su mundo todavía no admite
       * (ADR 0027). El modelo propone; la puerta determinista y la IA Dios
       * juzgan después. Proponer no es poder, tampoco aquí.
       */
      kind: 'interaction.propose';
      /** Para qué la necesita: el problema, no la solución. */
      problem: string;
      /** El id que la interacción DEBE tener (sale del pedido del cuidador). */
      wantedId?: string;
      /** El tipo del objeto con el que quiere interactuar. */
      targetKind: string;
      /** Lo que se sabe del objetivo: rasgos observables, en voz humana. */
      targetFacts: string[];
      /** Tipos que lleva encima: candidatos a `requires.heldKind`. */
      heldKinds: string[];
      /** Interacciones que ya existen: no tiene sentido reinventarlas. */
      existingInteractions: string[];
      /** Rechazos previos (de la puerta o del Dios): corregir, no insistir. */
      rejections?: string[];
    }
  | {
      /**
       * La IA Dios (ADR 0027): juzga si una interacción propuesta tiene LÓGICA
       * en el mundo, no si es físicamente expresable (eso ya lo decidió la
       * puerta determinista). Es la voz que dice que el agua no se lleva en
       * las manos: coherencia, no física. Responde con un `judgement`.
       */
      kind: 'interaction.judge';
      interactionId: string;
      description: string;
      stance: string;
      targetKind: string;
      /** Qué haría, en frases humanas ("el balde se vuelve balde-con-agua"). */
      effectsSummary: string[];
      /** Qué exige llevar encima, si algo. */
      requiresHeld?: string;
      /** Estado real y verificable del mundo: la base del juicio. */
      facts: string[];
    }
  | {
      /**
       * Inventar en QUÉ se deshace un objeto al romperse (la cuarta puerta).
       * Solo para materia base: lo crafteado ya sabe lo que costó y lo devuelve
       * solo. La materia no desaparece — picar un pedernal deja algo, y qué
       * cosa es lo que este momento cognitivo decide.
       */
      kind: 'decomposition.propose';
      /** El tipo que se está por romper. */
      targetKind: string;
      /** Lo que se sabe del objetivo: rasgos observables, en voz humana. */
      targetFacts: string[];
      /** Tipos que ya existen en su mundo: los fragmentos deberían parecerse. */
      knownKinds: string[];
      /** Rechazos previos (de la puerta o del Dios): corregir, no insistir. */
      rejections?: string[];
    }
  | {
      /**
       * Dibujar un tipo que nadie dibujó a mano (la quinta puerta). El catálogo
       * del mundo es abierto —la mascota bautiza lo que inventa como quiera— así
       * que ninguna tabla de dibujos hecha de antemano lo cubre. Dibuja quien
       * mejor sabe qué inventó.
       *
       * Elige FORMA, nunca color: la respuesta son índices de paleta, y el color
       * lo pone quien pinta a partir del material. Es lo que mantiene coherente
       * un catálogo infinito.
       */
      kind: 'glyph.propose';
      /** El tipo que hay que dibujar. */
      targetKind: string;
      /** Lo que se sabe de él: rasgos observables, en voz humana. */
      targetFacts: string[];
      /** De qué está hecho, si se sabe. Orienta la forma, nunca el color. */
      material?: string;
      /** Rechazos previos de la puerta: corregir, no insistir. */
      rejections?: string[];
    }
  | {
      /**
       * Dibujar una OBRA entera, celda por celda, en un solo viaje.
       *
       * Va junto y no de a una pieza por dos razones. La barata: cada consulta
       * cuesta medio minuto de reloj mientras el mundo sigue andando, y seis
       * piezas de a una son tres minutos parada. La que importa: la coherencia
       * es el punto entero. Dibujando de a una, quien dibuja no sabe qué tiene
       * al lado, y seis tablones correctos puestos en fila se leen como seis
       * tablones, no como una pasarela. Viendo el plano completo puede hacer
       * que la del medio continúe a la del costado y que las puntas rematen.
       *
       * No reemplaza al dibujo suelto de cada tipo: convive con él. El tablón
       * que llevás en la mano se sigue viendo como el tablón que ella dibujó.
       */
      kind: 'workGlyphs.propose';
      /** El plano que hay que ilustrar. */
      blueprintId: string;
      /** Cómo se llama la obra en voz humana, si tiene un nombre mejor que el id. */
      workLabel?: string;
      /** Qué pieza va en cada celda, con su desplazamiento desde el ancla. */
      cells: { offset: { x: number; y: number }; kind: string }[];
      /** Rechazos previos de la puerta: corregir, no insistir. */
      rejections?: string[];
    }
  | {
      /**
       * La IA Dios juzgando una descomposición: ¿es coherente que romper ESTO
       * deje ESO? Aquí vive la conservación de materia fina — que un pedernal
       * deje esquirlas sí, diez troncos no. La puerta determinista ya comprobó
       * que es expresable; esto es sentido común, no física.
       */
      kind: 'decomposition.judge';
      targetKind: string;
      /** Qué dejaría, en frases humanas ("2x esquirla"). */
      dropsSummary: string[];
      /** Estado real y verificable del mundo: la base del juicio. */
      facts: string[];
    }
  | {
      kind: 'dialogue';
      topic: string;
      facts: string[];
      /** Turnos anteriores, del más antiguo al más reciente. */
      history?: { from: 'user' | 'pet'; text: string }[];
    };

/**
 * Contrato propuesto para una habilidad que el cuidador pidió enseñar. El
 * modelo traduce la conversación; el agente valida los criterios y el
 * evaluador determinista sigue siendo el único que juzga si el programa los
 * cumple. Proponer el contrato no es aprobarse a sí mismo: fija de antemano
 * la vara con la que otro lo va a medir, y esa vara queda a la vista.
 */
export interface ProposedSkillContract {
  name: string;
  purpose: string;
  expectedOutcome: string;
  successCriteria: unknown;
}

export type ModelResponse =
  /**
   * Un programa, y opcionalmente un SEGUNDO con otra estrategia (ADR 0051).
   * La consulta paga una vez el razonamiento y el arranque; el segundo programa
   * cuesta solo sus tokens de salida, y medirlo es local y gratis. Dos ideas
   * por viaje: la mejor gana, la otra deja su fracaso en la historia.
   */
  | {
      kind: 'skill.program';
      program: unknown;
      rationale: string;
      alternate?: { program: unknown; rationale: string };
    }
  /**
   * «Esto es demasiado grande: creá antes estas piezas» (ADR 0055). No es un
   * programa: es la decisión de partir el problema. Cada pieza se diseña como
   * habilidad propia y después la madre las compone con `runSkill`.
   */
  | {
      kind: 'skill.decomposition';
      parts: { name: string; purpose: string; expectedOutcome: string }[];
      rationale: string;
    }
  | { kind: 'interpretation'; hypothesis: string; confidence: number }
  | { kind: 'command.interpretation'; command: CommandInterpretation }
  | { kind: 'skill.contract'; contract: ProposedSkillContract }
  | { kind: 'knowledge'; statement: string; confidence: number }
  /** La receta viaja sin tipar: el mundo es quien la valida (validateRecipe). */
  | { kind: 'recipe'; recipe: unknown; rationale: string }
  /**
   * Un árbol de recetas (ADR 0031): la casa, y también la pared y la tabla que
   * la casa necesita. Viajan sin tipar y entran DE A UNA por la misma puerta,
   * de las hojas al tronco — proponer un plan no es un permiso para meter
   * varias cosas de golpe, es poder tener una idea que necesita otra abajo.
   *
   * Una respuesta `recipe` de un solo elemento se lee como un plan de uno: la
   * forma anterior sigue siendo válida, como el caso particular que era.
   */
  | { kind: 'recipe-plan'; recipes: unknown[]; rationale: string }
  /**
   * Una obra, no un objeto (ADR 0032). Lo que el cuidador pidió es demasiado
   * grande para una celda: es una disposición de bloques en el espacio. Trae
   * las recetas de las piezas (las paredes, las tablas — entran primero, como
   * un `recipe-plan`) y el `blueprint` que las dispone. Ambos viajan sin tipar:
   * el mundo valida las recetas y el plano por separado.
   */
  | { kind: 'blueprint'; recipes: unknown[]; blueprint: unknown; rationale: string }
  /** La interacción viaja sin tipar: la valida el mundo (validateInteraction). */
  | { kind: 'interaction'; interaction: unknown; rationale: string }
  /**
   * En qué se deshace un tipo al romperse. Viaja sin tipar, como todo lo que
   * propone un modelo: la valida el mundo (validateDecomposition).
   */
  | { kind: 'decomposition'; decomposition: unknown; rationale: string }
  /**
   * Cómo se ve un tipo. Viaja sin tipar, como todo lo que propone un modelo:
   * lo valida el mundo (validateGlyph).
   */
  | { kind: 'glyph'; glyph: unknown; rationale: string }
  /**
   * Cómo se ve cada celda de una obra. Viaja sin tipar, como todo lo que
   * propone un modelo: lo valida el mundo (validateWorkGlyphs).
   */
  | { kind: 'work-glyphs'; blueprintId: string; glyphs: unknown; rationale: string }
  /**
   * Un juicio de valores, no de física. `willing: false` mantiene la negativa;
   * `true` la levanta. El agente solo lo consulta cuando ya comprobó que la
   * acción es posible, así que esto nunca puede autorizar un imposible.
   */
  | { kind: 'judgement'; willing: boolean; reason: string }
  | { kind: 'dialogue'; text: string };

export type CommandDirection = 'up' | 'down' | 'left' | 'right';

/**
 * El modelo interpreta lenguaje, pero solo puede elegir este catálogo. El
 * agente vuelve a validar y decide de forma independiente si ejecuta.
 *
 * El catálogo tiene una parte fija (las acciones primitivas) y una abierta:
 * `run-skill` invoca lo que la mascota haya aprendido, y `learn-skill` abre el
 * ciclo para lo que todavía no sabe. Sin esas dos, todo lo que el cuidador
 * enseñe muere en el momento en que lo dice.
 */
export type CommandInterpretation =
  | { action: 'destroy-entity'; targetKind: string }
  /** `amount`: cuántas unidades pidió ("los dos troncos" son 2). 1 si no dijo. */
  | { action: 'fetch-item'; targetKind: string; amount?: number }
  | { action: 'consume-item'; targetKind: string }
  | { action: 'wait-here' }
  | { action: 'move-direction'; directions: CommandDirection[] }
  /** Ejecutar una habilidad ya aprendida, por su nombre. */
  | { action: 'run-skill'; skillName: string }
  /** Construir algo que su mundo admite, por el id de la receta. */
  | { action: 'craft-item'; recipeId: string }
  /**
   * Poner una cosa que lleva (o puede levantar) EN un lugar del mundo, dicho
   * por lo que hay ahí: «poné la tabla sobre el agua», «apoyá el ladrillo
   * contra la roca».
   *
   * Existe porque `place` era una primitiva del mundo sin ninguna vía desde el
   * chat: se podía colocar bloques levantando una obra y de ninguna otra
   * manera. Un pedido de colocar terminaba desviado a la puerta de
   * interacciones, que inventaba un sinsentido para un verbo que el mundo ya
   * sabía hacer.
   */
  | { action: 'place-item'; targetKind: string; onKind: string }
  /** Conducta que no tiene pero que sus primitivas podrían componer. */
  | { action: 'learn-skill'; summary: string }
  /**
   * Un encargo con varias partes, en el orden en que se dijeron: «fabricá una
   * tabla, ponela sobre el agua y cruzá» son TRES órdenes, no una.
   *
   * Sin esto, la traducción se quedaba con el primer verbo y tiraba el resto
   * de la frase — y lo peor no era que no hiciera lo demás, sino que daba el
   * encargo por cumplido al terminar la primera parte. Un cuidador que habla
   * como se habla quedaba sistemáticamente a medias.
   *
   * No anida: los pasos son órdenes simples. Un plan de planes sería un
   * lenguaje, y para eso ya están las habilidades.
   */
  | { action: 'sequence'; steps: CommandInterpretation[] }
  /** El cuidador le pone un nombre nuevo ("te voy a llamar Luna"). */
  | { action: 'rename-pet'; name: string }
  /** El cuidador enseña un hecho del mundo (afirmación, no orden ni pregunta). */
  | { action: 'explanation' }
  /**
   * El cuidador DESCRIBE un objeto nuevo que quiere que exista en el mundo
   * ("un glorb es un mineral azul que da calor"). No es construir (eso es
   * craft-item) ni enseñar cómo funciona lo que ya existe (explanation).
   * Solo un modelo real llega aquí: el parser determinista no la produce.
   */
  | { action: 'describe-entity'; description: string }
  /**
   * Pide MANIPULAR un objeto concreto de una forma que las primitivas no
   * cubren (llenar, encender, tapar, subirse encima): la mascota buscará una
   * interacción aprendida o inventará una y la someterá a juicio (ADR 0027).
   */
  | { action: 'interact-entity'; verb: string; targetKind: string }
  /** Orden física fuera del alcance de sus primitivas. */
  | { action: 'unsupported'; summary: string }
  | { action: 'not-command' };

export interface ModelProvider {
  readonly name: string;
  /**
   * true si el proveedor entiende lenguaje natural y puede clasificar
   * cualquier mensaje con `interpret.command`. Cuando lo es, el agente le
   * cede la interpretación completa del chat y el parser determinista queda
   * solo como red de seguridad ante fallos. Los proveedores deterministas
   * (mock, scripted) devuelven false: para ellos manda el parser.
   */
  readonly interpretsLanguage: boolean;
  complete(request: ModelRequest): Promise<ModelResponse>;
  /** Cantidad de consultas realizadas, total o por tipo (para pruebas y telemetría). */
  callCount(kind?: ModelRequest['kind']): number;
}

export abstract class BaseModelProvider implements ModelProvider {
  abstract readonly name: string;
  readonly interpretsLanguage: boolean = false;
  private calls: ModelRequest['kind'][] = [];

  protected recordCall(kind: ModelRequest['kind']): void {
    this.calls.push(kind);
  }

  callCount(kind?: ModelRequest['kind']): number {
    if (!kind) return this.calls.length;
    return this.calls.filter((k) => k === kind).length;
  }

  abstract complete(request: ModelRequest): Promise<ModelResponse>;
}
