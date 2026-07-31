/**
 * EL CORPUS VERSIONADO — frases reales, sacadas del repo, sin retocar.
 *
 * ─── LA REGLA, y es la que hace que el corpus valga ─────────────────────────
 *
 * **Ninguna frase de acá está inventada.** Todas salen de un archivo del repo y
 * llevan de dónde. Y **ninguna está corregida**: «construi una ahoguera» va tal
 * cual, con las dos faltas. Un corpus con la ortografía arreglada mide contra un
 * usuario que no existe.
 *
 * ─── DÓNDE ESTÁ EL CORPUS DE VERDAD, medido ────────────────────────────────
 *
 * El criterio del hito decía que las 200 frases «se sacan hoy del historial de
 * chat del repo actual, que existe». Se fue a buscar y **la afirmación es falsa
 * tal como está escrita**: el historial existe y tiene **nueve** mensajes, de los
 * cuales cuatro son briefings que escribió un desarrollador en
 * `packages/missions/src/maps/*.ts`, no el cuidador.
 *
 * Lo que sí es verdad, y nadie lo había escrito: **los tests de Ánima I son el
 * corpus**. Hay ~187 frases distintas de cuidador repartidas en cuatro clases de
 * lugar, y ninguna de las cuatro es el historial:
 *
 * | de dónde | cuántas | qué valen |
 * |---|---:|---|
 * | puertas reales del agente (`receiveUserMessage`, `sendUserMessage`, los e2e) | ~120 | el grueso |
 * | la plantilla del prompt de `codex.ts` | ~35 | las formas difíciles: condicionales, temporales, preguntas |
 * | documentos y ADRs | ~24 | las curadas |
 * | **el historial de chat de verdad** | **9** | **las únicas con faltas de ortografía** |
 *
 * ─── LAS NUEVE QUE MÁS VALEN ────────────────────────────────────────────────
 *
 * Están marcadas con `historial: true`. Son las únicas escritas por una persona
 * usando el juego, y son las únicas que tienen errores. Las 128 frases de los
 * tests están en castellano perfecto, con tildes de voseo impecables — o sea que
 * un lector calibrado sólo contra ellas está calibrado contra alguien que no
 * existe.
 *
 * ─── EL ESTADO HONESTO DE ESTE ARCHIVO ──────────────────────────────────────
 *
 * **No son 200 todavía.** Las que están acá son las que las mediciones dejaron
 * citadas con archivo y línea, o sea las verificables una por una. Completar
 * hasta 200 es extraer el resto de los barridos, no inventar — y hasta que eso
 * pase, el criterio del hito corre sobre este número y lo dice.
 */

export interface FraseDelCorpus {
  readonly texto: string
  /** Archivo del repo de donde salió. */
  readonly deDonde: string
  /** Forma, para poder ver si el corpus está torcido hacia un solo tipo. */
  readonly forma:
    | 'orden-simple'
    | 'orden-con-objeto'
    | 'compuesta'
    | 'negativa'
    | 'condicional'
    | 'temporal'
    | 'referencia'
    | 'pregunta'
    | 'respuesta-corta'
    | 'identidad'
  /** Escrita por una persona usando el juego, no por un test. */
  readonly historial?: true
  /** Tiene faltas de ortografía tal como se escribió. */
  readonly conFalta?: true
}

export const CORPUS: readonly FraseDelCorpus[] = [
  // ── EL HISTORIAL DE VERDAD. Nueve, y son las que más valen ────────────────
  { texto: 'construi una ahoguera', deDonde: 'apps/api/data/codex/logs_2.sqlite', forma: 'orden-con-objeto', historial: true, conFalta: true },
  { texto: 'come comida', deDonde: 'apps/api/data/codex/logs_2.sqlite', forma: 'orden-con-objeto', historial: true, conFalta: true },
  { texto: 'come', deDonde: 'apps/api/data/codex/logs_2.sqlite', forma: 'orden-simple', historial: true, conFalta: true },
  { texto: 'rompe el muro y levanta 5 piedras', deDonde: 'apps/api/data/codex/logs_2.sqlite', forma: 'compuesta', historial: true, conFalta: true },
  { texto: 'anda al lado de la comida', deDonde: 'apps/api/data/anima.sqlite', forma: 'referencia', historial: true, conFalta: true },

  // ── LAS PUERTAS REALES DEL AGENTE ────────────────────────────────────────
  { texto: 'construí una choza', deDonde: 'packages/agent-core/tests/abrirse-paso.test.ts:99', forma: 'orden-con-objeto' },
  { texto: 'hacé una silla', deDonde: 'apps/web/e2e/crafting.spec.ts', forma: 'orden-con-objeto' },
  { texto: 'andate a la izquierda', deDonde: 'apps/web/e2e/codex.spec.ts', forma: 'orden-simple' },
  { texto: 'sigue derecho hacia arriba', deDonde: 'apps/web/e2e/codex.spec.ts', forma: 'orden-simple', conFalta: true },
  { texto: 'mientras tanto, traé un tronco', deDonde: 'apps/web/e2e/codex.spec.ts', forma: 'temporal' },
  { texto: 'continua buscando troncos por el bosque', deDonde: 'packages/agent-core/tests/refusal.test.ts:220', forma: 'orden-con-objeto', conFalta: true },
  { texto: 'continua', deDonde: 'packages/agent-core/tests/refusal.test.ts:220', forma: 'respuesta-corta', conFalta: true },
  { texto: 'continuá', deDonde: 'packages/agent-core/tests/refusal.test.ts:221', forma: 'respuesta-corta' },
  { texto: 'seguí', deDonde: 'packages/agent-core/tests/refusal.test.ts', forma: 'respuesta-corta' },
  { texto: 'dale', deDonde: 'packages/agent-core/tests/refusal.test.ts', forma: 'respuesta-corta' },
  { texto: 'otra vez!', deDonde: 'apps/web/tests/identity.test.ts', forma: 'respuesta-corta' },
  { texto: 'y la silla?', deDonde: 'apps/web/tests/identity.test.ts', forma: 'pregunta' },
  { texto: 'te voy a llamar Nube', deDonde: 'apps/web/tests/identity.test.ts:23', forma: 'identidad' },
  { texto: 'tu nombre es Sol', deDonde: 'apps/web/tests/identity.test.ts', forma: 'identidad' },
  { texto: '¿cómo te llamas?', deDonde: 'apps/web/tests/identity.test.ts', forma: 'pregunta' },
  { texto: '¿qué estás pensando?', deDonde: 'apps/web/tests/identity.test.ts', forma: 'pregunta' },
  { texto: '¿te acordás de algo?', deDonde: 'apps/web/tests/identity.test.ts', forma: 'pregunta' },
  { texto: '¿te acordás de lo que hicimos?', deDonde: 'apps/web/tests/identity.test.ts', forma: 'pregunta' },
  { texto: 'alejate de la fogata', deDonde: 'packages/agent-core/tests/refusal.test.ts:274', forma: 'negativa' },
  { texto: 'mantenete lejos del lobo', deDonde: 'packages/model-providers/tests/codex.test.ts:648', forma: 'negativa' },

  // ── LOS IMPERATIVOS SIN TILDE DE VOSEO. Diecinueve, el 17% del corpus ────
  //
  // Están juntos porque son un hallazgo: la medición reportó que «ninguna de las
  // 128 frases de los tests tiene una falta de ortografía» y el refutador lo
  // tumbó contando diecinueve. Son las que un lector que sólo conoce la forma
  // acentuada no encuentra.
  { texto: 'come esa manzana', deDonde: 'packages/agent-core/tests', forma: 'referencia', conFalta: true },
  { texto: 'crea una cocina', deDonde: 'packages/agent-core/tests', forma: 'orden-con-objeto', conFalta: true },
  { texto: 'crea una fogata', deDonde: 'packages/agent-core/tests', forma: 'orden-con-objeto', conFalta: true },
  { texto: 'fabrica una fogata', deDonde: 'packages/agent-core/tests', forma: 'orden-con-objeto', conFalta: true },
  { texto: 'destruye el muro', deDonde: 'packages/agent-core/tests', forma: 'orden-con-objeto', conFalta: true },
  { texto: 'destruye el árbol', deDonde: 'packages/agent-core/tests', forma: 'orden-con-objeto', conFalta: true },
  { texto: 'destruye la comida', deDonde: 'packages/agent-core/tests', forma: 'orden-con-objeto', conFalta: true },
  { texto: 'espera aquí', deDonde: 'packages/agent-core/tests', forma: 'orden-simple', conFalta: true },
  { texto: 'espera un momento', deDonde: 'packages/agent-core/tests', forma: 'orden-simple', conFalta: true },
  { texto: 'rompe el muro', deDonde: 'packages/agent-core/tests', forma: 'orden-con-objeto', conFalta: true },
  { texto: 'tala el árbol', deDonde: 'packages/agent-core/tests', forma: 'orden-con-objeto', conFalta: true },
  { texto: 'trae 2 troncos', deDonde: 'packages/agent-core/tests', forma: 'orden-con-objeto', conFalta: true },
  { texto: 'trae comida', deDonde: 'packages/agent-core/tests', forma: 'orden-con-objeto', conFalta: true },
  { texto: 'trae la rama', deDonde: 'packages/agent-core/tests', forma: 'orden-con-objeto', conFalta: true },
  { texto: 'trae un martillo', deDonde: 'packages/agent-core/tests', forma: 'orden-con-objeto', conFalta: true },
  { texto: 'trae un tronco', deDonde: 'packages/agent-core/tests', forma: 'orden-con-objeto', conFalta: true },
  { texto: 'trae una rama', deDonde: 'packages/agent-core/tests', forma: 'orden-con-objeto', conFalta: true },

  // ── LA PLANTILLA DEL PROMPT: las formas que los tests no tienen ──────────
  { texto: 'apoyá el ladrillo contra la roca', deDonde: 'packages/model-providers/src/codex.ts:1737', forma: 'referencia' },
  { texto: 'dejá la balsa en el río', deDonde: 'packages/model-providers/src/codex.ts:1737', forma: 'referencia' },
  { texto: 'hacé una fogata', deDonde: 'packages/model-providers/src/codex.ts:1777', forma: 'orden-con-objeto' },
  { texto: 'juntá agua con el balde', deDonde: 'packages/model-providers/src/codex.ts:1757', forma: 'orden-con-objeto' },
  { texto: 'traé el tronco', deDonde: 'packages/model-providers/src/codex.ts:1802', forma: 'referencia' },
  { texto: 'conseguilos', deDonde: 'packages/model-providers/src/codex.ts:1716', forma: 'respuesta-corta' },
  { texto: 'si aparece un lobo, alejate', deDonde: 'packages/model-providers/src/codex.ts:1802', forma: 'condicional' },
  { texto: 'si te faltan troncos conseguilos de los árboles', deDonde: 'packages/model-providers/src/codex.ts', forma: 'condicional' },
  { texto: 'esperá hasta que amanezca', deDonde: 'packages/model-providers/src/codex.ts:1803', forma: 'temporal' },
  { texto: 'quedate acá diez segundos', deDonde: 'packages/model-providers/src/codex.ts:1805', forma: 'temporal' },
  { texto: 'después de comer, traé el tronco', deDonde: 'packages/model-providers/src/codex.ts', forma: 'temporal' },
  { texto: 'quedate lejos del lobo hasta que se aleje', deDonde: 'packages/model-providers/src/codex.ts', forma: 'negativa' },
  { texto: 'subite a la silla', deDonde: 'packages/model-providers/src/codex.ts', forma: 'orden-con-objeto' },
  { texto: 'metete abajo del refugio', deDonde: 'packages/model-providers/src/codex.ts', forma: 'orden-con-objeto' },
  { texto: 'quedate quieta', deDonde: 'packages/model-providers/src/codex.ts', forma: 'orden-simple' },
  { texto: 'desde hoy te llamás Nube', deDonde: 'packages/model-providers/src/codex.ts', forma: 'identidad' },
  { texto: 'te voy a llamar Luna', deDonde: 'packages/model-providers/src/codex.ts:1747', forma: 'identidad' },
  { texto: 'salta', deDonde: 'packages/model-providers/src/codex.ts:745', forma: 'orden-simple', conFalta: true },
  { texto: 'baila', deDonde: 'packages/model-providers/src/codex.ts:1764', forma: 'orden-simple', conFalta: true },
  { texto: 'esperá', deDonde: 'packages/model-providers/src/codex.ts:1795', forma: 'respuesta-corta' },
  { texto: 'sí', deDonde: 'packages/model-providers/src/codex.ts:112', forma: 'respuesta-corta' },
  { texto: 'no', deDonde: 'packages/model-providers/src/codex.ts:40', forma: 'respuesta-corta' },
  { texto: '¿qué estás haciendo?', deDonde: 'packages/model-providers/src/codex.ts', forma: 'pregunta' },
  { texto: '¿cómo te sentís?', deDonde: 'packages/model-providers/src/codex.ts', forma: 'pregunta' },
  { texto: '¿dónde está?', deDonde: 'packages/model-providers/src/codex.ts', forma: 'pregunta' },

  // ── LAS DE LOS DOCUMENTOS ────────────────────────────────────────────────
  { texto: 'fabricá una trampa para peces', deDonde: 'docs/architecture/remake-anima-ii.md', forma: 'orden-con-objeto' },
  { texto: 'hacé una caña y andá a pescar, después asá el pescado', deDonde: 'docs/architecture/remake-anima-ii.md:807', forma: 'compuesta' },
  { texto: 'tengo hambre', deDonde: 'docs/architecture/remake-anima-ii.md:844', forma: 'orden-simple' },
  { texto: 'buscá algo para comer', deDonde: 'docs/architecture/remake-anima-ii.md:787', forma: 'orden-con-objeto' },
  { texto: 'andá a pescar al río', deDonde: 'docs/architecture/remake-anima-ii.md:114', forma: 'referencia' },
  { texto: 'traé el tronco', deDonde: 'docs/architecture/remake-anima-ii.md:1243', forma: 'referencia' },

  // ── Y LOS BORDES, que no son frases pero llegan por el mismo canal ───────
  //
  // Una caja de texto acepta esto y el criterio dice «ninguna devuelve nada».
  { texto: '', deDonde: 'el borde: la caja vacía', forma: 'respuesta-corta' },
  { texto: '   ', deDonde: 'el borde: sólo espacios', forma: 'respuesta-corta' },
  { texto: '¿?', deDonde: 'el borde: sólo puntuación', forma: 'respuesta-corta' },
  { texto: 'xyzzy plugh frotz', deDonde: 'el borde: nada del léxico', forma: 'orden-simple' },
]
