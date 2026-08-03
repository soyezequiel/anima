/**
 * EL PUENTE — y es conocimiento humano, escrito a mano, a propósito.
 *
 * El documento de arquitectura lo avisó antes de que existiera este paquete, y
 * conviene citarlo entero porque es la única parte del Hito 6 que no se deriva
 * de nada:
 *
 * > «pescar existe como verbo el día que existe el proceso `extraccion`» es
 * > falso. El lexema de `extraccion` es *extraer*; *pescar* es extraer fauna de
 * > un cuerpo de agua con un aparejo. El puente entre castellano rioplatense
 * > conversacional y nombres de procesos físicos es conocimiento humano que hay
 * > que escribir: **una tabla de alias de composición**, chica pero real, y hay
 * > que presupuestarla.
 *
 * Y el ADR II-0024, que dejó entrar al modelo al Hito 6, cierra con la misma
 * advertencia dicha al revés: **el modelo no ahorra esta tabla**. Ayuda con la
 * paráfrasis y con la ambigüedad del castellano; no sabe que en ESTE mundo
 * pescar es sacar algo carnoso de un pozo con un aparejo, porque eso no está en
 * ningún corpus — está en la física que escribimos nosotros.
 *
 * ─── Cuánto conocimiento humano lleva, medido ───────────────────────────────
 *
 * Vive en su propio archivo para que se pueda CONTAR. El léxico derivado son 81
 * cadenas que salen solas de la física; esto es lo que hubo que agregar, y un
 * test publica los dos números lado a lado. El día que alguien quiera saber
 * «cuánto de esto es magia escrita a mano», la respuesta es el tamaño de este
 * archivo y no una estimación.
 *
 * ─── La regla que ordena qué entra acá ──────────────────────────────────────
 *
 * **Entra lo que el mundo no puede nombrar solo.** Nada más. Si una palabra ya
 * está en un `lexeme`, no se repite acá: `palo` no está en esta tabla porque ya
 * es sinónimo de `madera` en la física, y duplicarlo sería empezar a mantener el
 * diccionario que este paquete existe para no tener.
 *
 * ─── Y una advertencia sobre las METAS ──────────────────────────────────────
 *
 * Las firmas de abajo se eligieron **midiendo cuáles llegan a un plan de verdad**,
 * no por elegantes. De los siete `holding(tag:X)` que el sistema admite, seis dan
 * `gap`: la criatura sólo sabe conseguir carne. Por eso «comida» apunta a
 * `holding(tag:carnoso)` y no a algo más general que sonaría mejor y no haría
 * nada.
 */

import type { AliasCrudo } from './lexico.js'

/**
 * LAS METAS QUE EL MUNDO NO NOMBRA.
 *
 * Un `lexeme` nombra MATERIA. Nadie pide materia: se pide un estado del mundo.
 * «Hacé fuego» no nombra ninguna sustancia — nombra que algo emita potencia.
 *
 * Cada firma de acá se probó contra `plan()` con una vista real antes de
 * escribirse, y al lado va lo que dio.
 */
const METAS: readonly AliasCrudo[] = [
  // → plan de 4 pasos: ir · sostener · deshilachar · frotar. El fuego se hace
  //   frotando, y eso el planificador lo sabe solo desde el Hito 5.
  //
  // Y NO va `ahoguera`, que es como está escrito en el único historial de chat
  // real del repo. Estaba, y un test lo sacó: con la falta de ortografía
  // adentro de la tabla, «construi una ahoguera» y «construí una hoguera» daban
  // **la misma confianza**, o sea que el emparejamiento difuso —que existe
  // justamente para eso— no se estaba ejerciendo en el único caso que lo
  // justifica. Una tabla que absorbe los errores de ortografía se convierte en
  // la lista infinita que este paquete existe para no tener.
  { dice: ['fuego', 'fogata', 'hoguera', 'llama', 'calor'], denota: { k: 'meta', firma: 'emitsPower>0' } },

  // → plan de 7 pasos, que incluye armar la caña. «Comida» apunta a lo carnoso y
  //   no a algo más amplio por la medición del encabezado: los otros seis tags
  //   dan `gap`.
  { dice: ['comida', 'alimento', 'algo de comer', 'de comer'], denota: { k: 'meta', firma: 'holding(tag:carnoso)' } },

  // LA DEL CASO DE ACEPTACIÓN, y es la línea más importante del archivo.
  //
  // «Trampa» NO se traduce a un objeto con nombre: se traduce a la CUALIDAD que
  // hace que algo atrape, que es `catch`. Es exactamente lo que el criterio pide
  // —«el resultado se expresa como captura autónoma y recuperable, no como un
  // objeto con nombre»— y es lo que el punto 12 del Gate 5→6 hizo posible: no
  // existe ni puede existir un `kind` llamado `trampa-para-peces`, así que acá
  // no hay adónde apuntar salvo a la física.
  { dice: ['trampa', 'aparejo', 'red', 'atrapar'], denota: { k: 'meta', firma: 'catch>0' } },

  // El estado cocido, tal como la física lo define: digerible y sin veneno.
  // Escrito como firma y no como «asado» porque «asado» ya es un ADJETIVO del
  // léxico derivado, y son dos cosas: uno describe un cuerpo, el otro pide un
  // estado del mundo.
  {
    // «comida cocida» va PRIMERO y no es un detalle: el puente se lee al reves
    // para decirle a una persona que entendio, y ahi la primera de la lista es
    // la que sale. Con `cocido` sola, el demo decia «queres cocido».
    dice: ['comida cocida', 'cocido', 'cocinado'],
    denota: { k: 'meta', firma: 'holding(tag:carnoso,digestibility>=0.85,toxicity<=0.05)' },
  },

  // Lo que hace falta para atar: una punta suelta y alcance. Los dos son
  // `establishes` del proceso `union`, o sea que el planificador los alcanza.
  { dice: ['cuerda', 'atadura', 'hebra'], denota: { k: 'meta', firma: 'freeStrandEnds>=1' } },
  { dice: ['largo', 'alcance'], denota: { k: 'meta', firma: 'reach>=2' } },
]

/**
 * LOS VERBOS DEL CUIDADOR, en voseo rioplatense y en las formas que se escriben
 * de verdad.
 *
 * ─── Por qué las formas van escritas y no derivadas ─────────────────────────
 *
 * Porque la receta obvia falla. Se midió: quitarle el acento al voseo y
 * agregarle una `r` acierta **1 de 12** — da `comasr`, `caminarr`, `traer`
 * (bien), `fabricar` (bien pero no existe como proceso). El castellano tiene
 * verbos irregulares y este puente tiene trece entradas; una tabla de trece
 * filas se lee, se revisa y no miente. Un derivador morfológico que acierta el
 * 8% se ve inteligente y arruina la lectura.
 *
 * ─── Y las que están sin tilde también ──────────────────────────────────────
 *
 * `traé` y `trae`, `hacé` y `hace`, `andá` y `anda`. No es por las dudas: el
 * único historial de chat real que hay en el repo tiene **«construi una
 * ahoguera»** escrito por una persona, y la normalización ya saca el acento —
 * pero la forma SIN tilde de voseo es otra palabra («trae» es tercera persona),
 * y un lector que sólo conoce la acentuada no la encuentra. Los tests de Ánima I
 * ya modelaban esto: `refusal.test.ts` prueba `continua` y `continuá` uno debajo
 * del otro.
 */
const VERBOS: readonly AliasCrudo[] = [
  {
    dice: ['trae', 'traeme', 'traer', 'alcanzame', 'alcanza', 'dame', 'conseguime', 'consegui', 'conseguir'],
    denota: { k: 'verbo', id: 'traer' },
  },
  {
    dice: ['anda', 'andate', 'veni', 'acercate', 'ir', 'vamos', 'segui derecho'],
    denota: { k: 'verbo', id: 'ir' },
  },
  {
    dice: ['hace', 'haceme', 'hacer', 'fabrica', 'fabricame', 'fabricar', 'construi', 'construime', 'construir', 'arma', 'armame', 'armar', 'crea', 'crear'],
    denota: { k: 'verbo', id: 'hacer' },
  },
  {
    dice: ['junta', 'juntame', 'juntar', 'recolecta', 'recoge', 'agarra', 'agarrame', 'levanta'],
    denota: { k: 'verbo', id: 'juntar' },
  },
  { dice: ['come', 'comete', 'comer', 'comeme', 'alimentate'], denota: { k: 'verbo', id: 'comer' } },
  { dice: ['asa', 'asame', 'asar', 'cocina', 'cociname', 'cocinar', 'tosta'], denota: { k: 'verbo', id: 'cocinar' } },
  { dice: ['pesca', 'pescame', 'pescar'], denota: { k: 'verbo', id: 'pescar' } },
  // ─── LA FILA QUE CASI NO SE ESCRIBE, Y LA ATAJÓ UN TEST ───────────────────
  //
  // Acá decía «`ata` ya está en el léxico derivado como el proceso `union`, así
  // que sólo van las otras formas». Era falso: lo que el mundo tiene es
  // `atar`, el INFINITIVO, que es el `lexeme` del proceso. `atá` normalizado da
  // `ata`, y `ata` ≠ `atar`.
  //
  // Es la misma confusión que hizo que la medición previa reportara «el mundo
  // conoce 1 de 12 verbos» cuando conoce cero: entre la forma que una persona
  // escribe y el lexema que el mundo publica hay un paso de conjugación, y ese
  // paso es justamente lo que esta tabla existe para dar.
  { dice: ['ata', 'atame', 'uni', 'unime', 'unir', 'amarra', 'pega'], denota: { k: 'verbo', id: 'atar' } },
  { dice: ['prende', 'prendeme', 'prender', 'enciende', 'encende', 'encender'], denota: { k: 'verbo', id: 'encender' } },
  { dice: ['solta', 'soltame', 'soltar', 'deja', 'dejame', 'pone', 'poneme', 'poner', 'apoya', 'tira'], denota: { k: 'verbo', id: 'soltar' } },
  { dice: ['busca', 'buscame', 'buscar', 'fijate', 'explora', 'explorar', 'revisa'], denota: { k: 'verbo', id: 'buscar' } },
  { dice: ['espera', 'esperame', 'esperar', 'quedate', 'aguanta'], denota: { k: 'verbo', id: 'esperar' } },
  // ─── LOS TRES DEL ENCARGO, y la fila de arriba eran dos ────────────────────
  //
  // Estos no piden nada del mundo: cambian el estado del PEDIDO. Por eso están
  // acá y no en la polaridad, aunque se le parezcan: «dejá de pescar» niega una
  // conducta en curso, y «no pesques» niega una que todavía no empezó.
  //
  // `parar` venía con `cancela` y `olvidate` adentro, y eso era colapsar dos
  // cosas distintas: **pausar se deshace y cancelar no**. La ambigüedad es real
  // —«pará» en castellano puede ser las dos— y por eso la palabra ambigua cae del
  // lado reversible: si el cuidador quería cancelar, lo vuelve a decir; al revés
  // se pierde el encargo y no hay cómo traerlo.
  { dice: ['para', 'parate', 'parar', 'frena', 'pausa', 'pausar'], denota: { k: 'verbo', id: 'parar' } },
  { dice: ['segui', 'seguir', 'continua', 'continuar', 'retoma', 'retomar'], denota: { k: 'verbo', id: 'seguir' } },
  { dice: ['cancela', 'cancelar', 'olvidate', 'olvidalo', 'basta'], denota: { k: 'verbo', id: 'cancelar' } },
]

/**
 * EL PUENTE ENTERO. Es lo que `lexicoDe(phys, PUENTE)` le suma al derivado.
 *
 * Se exporta como una constante y se pasa por parámetro —no se importa adentro
 * de `lexico.ts`— para poder construir el léxico SIN él, que es como se midió el
 * 9% de cobertura y como se va a volver a medir cuando alguien quiera saber
 * cuánto aporta esta tabla.
 */
export const PUENTE: readonly AliasCrudo[] = [...METAS, ...VERBOS]

/** Las dos mitades por separado, para que el test pueda contarlas aparte. */
export const PUENTE_METAS = METAS
export const PUENTE_VERBOS = VERBOS
