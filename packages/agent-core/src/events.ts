import type { StructuredEvent } from '@anima/shared';

export type AgentEventType =
  | 'goal.created'
  | 'goal.selected'
  | 'goal.completed'
  | 'goal.suspended'
  | 'goal.reactivated'
  /** Un paso (sub-objetivo) quedó cumplido por la cuenta del mundo (ADR 0053).
   * Es SU evento y no `goal.completed` a propósito: quien escucha el cierre de
   * un encargo entero no tiene por qué enterarse de cada paso intermedio. */
  | 'goal.step.completed'
  | 'strategy.selected'
  | 'strategy.failed'
  | 'strategy.forbidden'
  | 'skill.requested'
  /**
   * Vista previa del contrato de una habilidad enseñada (ADR 0030): se le
   * muestra el criterio al cuidador y se espera su sí antes de aprender nada.
   */
  | 'skill.contract.preview'
  /** El cuidador rechazó el criterio propuesto: no se aprende contra esa vara. */
  | 'skill.contract.declined'
  /**
   * Conducta heredada de un legado cuyo criterio nació de un pedido (o falta):
   * se adopta experimental y NO se promueve hasta que la cuidadora lo confirme
   * (ADR 0030 fase E). Sin esto, el legado lavaría una vara que nadie miró.
   */
  | 'skill.inherited.unconfirmed'
  /** Contrato acordado con el cuidador antes de intentar aprender algo. */
  | 'skill.contract.agreed'
  | 'skill.created'
  | 'skill.test.started'
  | 'skill.test.failed'
  | 'skill.test.passed'
  | 'skill.promoted'
  /**
   * No llegó a la vara pero queda utilizable mientras no haya estable (ADR
   * 0050). Se anuncia a propósito: usar algo que falla 1 de cada 20 veces sin
   * decirlo sería vender por probado lo que no lo está.
   */
  | 'skill.provisional'
  | 'skill.rejected'
  | 'skill.used'
  /** Se le ocurrió un objeto que su mundo no sabía construir. */
  | 'recipe.proposed'
  /**
   * Tradujo la descripción del cuidador a una receta que la puerta acepta, y
   * la muestra antes de proponerla: nada entra al mundo sin confirmación.
   */
  | 'recipe.preview'
  /**
   * El veredicto de la IA Dios sobre una receta inventada (ADR 0042): si de
   * esos materiales puede salir eso, y si ese nombre dice la verdad.
   */
  | 'recipe.judged'
  /** El mundo aceptó su invento: la física ahora lo admite. */
  | 'recipe.learned'
  /** El mundo lo rechazó, con el motivo. Imaginarlo no lo vuelve posible. */
  | 'recipe.rejected'
  /** El mundo rechazó una obra propuesta (ADR 0032), con el motivo. */
  | 'blueprint.rejected'
  /** Se le ocurrió una interacción que su mundo no admitía (ADR 0027). */
  | 'interaction.proposed'
  /** El veredicto de la IA Dios: si la interacción tiene lógica, y por qué. */
  | 'interaction.judged'
  /** El mundo la aceptó: es una regla, y no habrá que inventarla de nuevo. */
  | 'interaction.learned'
  /** La puerta o el mundo la rechazaron, con el motivo. */
  | 'interaction.rejected'
  /** Se le ocurrió en qué se deshace algo al romperlo (la cuarta puerta). */
  | 'decomposition.proposed'
  /** El veredicto de la IA Dios: si esos fragmentos son materia honesta. */
  | 'decomposition.judged'
  /** El mundo la aceptó: romper ese tipo deja eso, y ya no se re-imagina. */
  | 'decomposition.learned'
  /** La puerta o el mundo la rechazaron, con el motivo. */
  | 'decomposition.rejected'
  /** Dibujó cómo se ve un tipo que nadie había dibujado (la quinta puerta). */
  | 'glyph.proposed'
  /** El mundo lo aceptó: ese tipo se ve así, y ya no se re-dibuja. */
  | 'glyph.learned'
  /** La puerta o el mundo lo rechazaron, con el motivo. */
  | 'glyph.rejected'
  /** Dibujó una obra entera, celda por celda: cómo se ve armada. */
  | 'workGlyphs.proposed'
  /** El mundo los aceptó: esa obra ya tiene aspecto propio. */
  | 'workGlyphs.learned'
  /** La puerta o el mundo los rechazaron, con el motivo. */
  | 'workGlyphs.rejected'
  | 'memory.created'
  | 'memory.consolidated'
  | 'hypothesis.updated'
  | 'guidance.shown'
  | 'legacy.read'
  | 'help.requested'
  | 'provider.error'
  | 'user.message.received'
  | 'user.request.accepted'
  | 'user.request.refused'
  /** Repensó una negativa de valores con su situación concreta (ADR 0019). */
  | 'judgement.made'
  /** El cuidador le puso un nombre nuevo; la capa de identidad lo persiste. */
  | 'pet.renamed'
  /** Se apartó de algo que la estaba dañando. Reflejo del cuerpo, no decisión. */
  | 'pain.reflex'
  /** Fue a donde recordaba algo y ya no estaba: el recuerdo se descarta. */
  | 'place.invalidated'
  /** El ciclo de desarrollo quedó practicando en segundo plano (ADR 0043):
   * ella sigue viviendo y un think futuro consumirá el veredicto. */
  | 'skill.dev.background'
  /** El ciclo cortó por meseta (ADR 0051): tenía una versión decente y varias
   * consultas seguidas no la mejoraron — seguir pagando viajes al modelo no
   * compraba nada. Queda la provisional (ADR 0050). */
  | 'skill.dev.plateau';

export type AgentEvent = StructuredEvent<AgentEventType>;
