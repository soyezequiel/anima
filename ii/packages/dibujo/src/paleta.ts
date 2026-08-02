// ─── LA PALETA: de qué está hecho algo, a cómo se ve ────────────────────────
//
// Éste es el primer archivo de la capa de presentación del Hito 12, y lo que
// tiene que quedar claro antes de leer una línea es **qué problema NO tiene**.
//
// ─── LO QUE ÁNIMA I HACÍA Y ACÁ NO HACE FALTA ───────────────────────────────
//
// En Ánima I, `paletteFor(kind, material)` elegía el color **buscando palabras
// en el nombre**: una tabla `MATERIAL_WORDS` con doce entradas y vocabulario en
// dos idiomas, preguntando si el nombre «incluye» la palabra «piedra» o «stone».
// No era una torpeza: era la compensación por no tener el dato. El catálogo de
// Ánima I es abierto (`EntityKind = string`) y la IA Dios bautizaba lo que
// inventaba como quería, así que adivinar era todo lo que había.
//
// **Acá la sustancia llega tipada y con sus cualidades.** La muleta se tira
// entera. Y la prueba de que se tiró es un test: ninguna decisión de este
// archivo mira el texto de un id.
//
// ─── LOS TRES EJES, Y POR QUÉ SON TRES Y NO DOS ─────────────────────────────
//
// El plan original eran dos —el tono lo da el material, la silueta la forma—,
// que es lo que Ánima I inventó y funciona. **La medición lo tumbó**: el mundo
// de Ánima II sólo produce TRES de las seis formas (`formaDeLoSuelto` reparte
// las treinta sustancias en bloque 21 · hebra 7 · vara 2), así que la silueta
// casi no discrimina. Con nueve familias de color y tres siluetas, veintiséis de
// las treinta sustancias quedaban visualmente idénticas a alguna otra — y las
// colisiones caían justo sobre las decisiones que el juego quiere que duelan:
// qué vara frotar, qué sirve de yesca, si eso es hueso o es piedra.
//
// El tercer eje es la TRAMA, y sale de dos cualidades:
//
//     tono   ← la familia, de los tags y las cualidades  (qué clase de cosa es)
//     silueta ← la forma                                  (cómo está repartida)
//     trama  ← rigidez y tensión                          (cómo se comporta)
//
// La trama no es decoración: **rigidez y tensión son las dos cualidades con las
// que la criatura decide**. Una vara frota si `rigidity >= 0.5`; una hebra ata
// si tiene `tensile`. Que el dibujo las muestre es que el dibujo muestre lo que
// hay que saber para elegir.
//
// ─── EL LÍMITE, DICHO ANTES DE QUE ALGUIEN LO DESCUBRA ──────────────────────
//
// Esto **no** hace únicas a las treinta. Los seis tipos de carne cruda se ven
// parecidos, y está bien: entre carne y pescado no se elige mirando, se elige
// por `nutrition`. Lo que el criterio de este archivo afirma es otra cosa, más
// chica y más honesta: **los pares que el juego obliga a distinguir se
// distinguen**, y la lista está escrita en el test con el porqué de cada uno.
// Los pares que quedan iguales se imprimen, para que nadie los descubra tarde.
//
// ─── ARITMÉTICA ─────────────────────────────────────────────────────────────
//
// Sólo comparaciones. Ni `Math.pow`, ni `sqrt`, ni `**`, ni azar, ni reloj: la
// regla 2 de `ii/` los prohíbe porque ECMAScript no especifica su precisión y
// dos motores devuelven el último bit distinto. Un dibujo que dependa de eso
// deja de ser comparable entre clientes, que es justo lo que el E2E compara.

import type { Physics, Substance, SubstanceId } from '@anima/physics'

/**
 * LOS TRES TONOS DE UN MATERIAL, y el índice 0 que no está acá.
 *
 * Un glifo no guarda colores: guarda ÍNDICES de paleta. `0` es transparente, `1`
 * es la base, `2` la sombra y `3` la luz. Esa indirección la heredamos de Ánima
 * I y es lo mejor que tenía, por un motivo que conviene copiar entero:
 *
 * > quien dibuje la forma elige volumen, jamás color, así que el polvo de
 * > piedra sale color piedra aunque el dibujante quisiera otra cosa.
 *
 * La coherencia no se valida: es imposible romperla.
 */
export interface Paleta {
  /** Índice 1: el color liso del material. */
  readonly base: string
  /** Índice 2: zonas en sombra, bordes de abajo. */
  readonly sombra: string
  /** Índice 3: brillos, bordes de arriba. */
  readonly luz: string
}

/**
 * LAS NUEVE FAMILIAS. Es una unión cerrada a propósito: agregar una es una
 * decisión de producto y tiene que doler lo que cuesta escribirla acá.
 */
export type Familia =
  | 'gris'
  | 'tizon'
  | 'ocre'
  | 'pardo'
  | 'verde'
  | 'rosa'
  | 'tostado'
  | 'ambar'
  | 'azul'

/**
 * `Record<Familia, Paleta>` SÍ es exhaustivo, y ésa es la diferencia con
 * intentar una tabla por sustancia: `SubstanceId` es `string` —el catálogo crece
 * en runtime con los residuos y con el overlay del oráculo— así que un
 * `Record<SubstanceId, Paleta>` no lo puede chequear nadie. `Familia` es cerrada
 * y `tsc` obliga a cubrirla entera.
 */
export const PALETAS: Record<Familia, Paleta> = {
  // Gris tibio y no el azulado de Ánima I: la misma familia tiene que aguantar
  // piedra (rigidity 0,95), hueso (0,92) y la ceniza que el mundo fabrica en
  // runtime. Es la de más luz de las nueve, y por eso es también el ESCAPE: lo
  // que no matchea ninguna regla sale gris, que no promete ni que alimenta ni
  // que arde.
  gris: { base: '#b4afa3', sombra: '#6b665d', luz: '#e8e4d9' },
  // La base NO es negra, y no es un descuido. Con un negro real quedaba a ocho
  // puntos de luma del fondo nocturno y el pedernal —lo único que corta en la
  // semilla— desaparecía justo de noche. El negro vive en la sombra y la
  // fractura vidriosa en la luz: el filo se ve porque brilla, no porque es
  // oscuro.
  tizon: { base: '#6b635c', sombra: '#221e1b', luz: '#cec7bb' },
  // Ocre mate: el mineral que se amasa y el órgano vegetal de reserva. A la
  // vista son lo mismo —materia terrosa, opaca, sin fibra— y las dos son lo que
  // se guarda: la arcilla tapa la fogata, el almidón pasa el invierno.
  ocre: { base: '#ba8442', sombra: '#714c1a', luz: '#e2bb72' },
  // Marrón cálido = esto prende. El corte de la familia es `moisture < 0.45`,
  // que es exactamente `HUMEDAD_QUE_APAGA` de la ley 3. O sea que el color no es
  // decoración: es el único aviso de combustibilidad que hay antes de intentar.
  pardo: { base: '#9a6135', sombra: '#55321a', luz: '#c9924f' },
  // El complemento exacto del anterior: lo vegetal que la ley 3 NO deja prender.
  // Que la raíz de anclaje salga verde y no marrón es deliberado — verde quiere
  // decir «no arde», y eso es más útil que verde quiera decir «tiene clorofila».
  verde: { base: '#6b9640', sombra: '#3a5720', luz: '#a3cd63' },
  // Rojo apagado y no rojo sangre, para que el huevo y la médula no queden
  // absurdos adentro de la misma familia.
  rosa: { base: '#b06860', sombra: '#6f342e', luz: '#dd9d95' },
  // Fibra ANIMAL. Se separa de la carne (que se come) y de la madera (que se
  // quema) porque «me como el cuero o lo uso de atadura» es una decisión que el
  // mundo quiere que duela, y una decisión que no se ve no duele.
  tostado: { base: '#a97b52', sombra: '#634226', luz: '#d4ac80' },
  // Lo que pega y no tira. Son dos, savia y grasa, y son las dos que se
  // derraman. La grasa se parece más a la savia que a la carne en todo lo que
  // importa, así que esta regla corre ANTES que el tag `carnoso`.
  ambar: { base: '#dda328', sombra: '#8a5c08', luz: '#f7d271' },
  // Una sola sustancia y una familia entera, porque es el único azul del mundo:
  // si el agua compartiera paleta, se perdería la señal más barata que hay para
  // saber dónde se apaga un fuego y dónde se moja la leña.
  azul: { base: '#4fa5c9', sombra: '#1d5b78', luz: '#9bd8ee' },
}

// ─── La cascada ─────────────────────────────────────────────────────────────
//
// El orden IMPORTA y cada salto de fila está justificado. Se lee de arriba
// abajo y la primera que matchea gana, igual que `adjectivesOf` en la física.

const RIGIDEZ_DE_LO_QUE_SE_AMASA = 0.5
const FILO_QUE_CORTA = 0.5
const COHESION_QUE_PEGA = 0.5
const TENSION_QUE_TIRA = 0.1
const RIGIDEZ_QUE_SE_SOSTIENE = 0.15
const NUTRICION_DE_RESERVA = 5

/**
 * HUMEDAD_QUE_APAGA de la ley 3, repetida acá con su nombre.
 *
 * Es el único número de este archivo que también vive en la física, y no se
 * importa porque la ley lo usa para decidir si algo prende y esto lo usa para
 * decidir de qué color se ve. Si algún día divergen, lo que hay que arreglar es
 * el color: el corte del dibujo tiene que seguir al de la ley, nunca al revés.
 */
const HUMEDAD_QUE_APAGA = 0.45

function tiene(s: Substance, tag: string): boolean {
  return s.tags.includes(tag as never)
}

function q(s: Substance, k: string): number {
  const v = (s.perUnitMass as Record<string, number | undefined>)[k]
  return v === undefined ? 0 : v
}

/**
 * DE QUÉ FAMILIA ES UNA SUSTANCIA. Total: siempre devuelve una.
 *
 * La totalidad no es cortesía — es el requisito del ADR II-0017, que pide que
 * todo cuerpo se pueda dibujar sin arte y sin excepciones. Y hace falta de
 * verdad: el mundo fabrica sustancias en runtime (`residuo-carbonoso-de-madera`
 * y compañía) que ningún catálogo escrito a mano va a tener.
 */
export function familiaDe(s: Substance): Familia {
  // 1. Lo que ya ardió. Va primero porque el carbón conserva los tags de su
  //    madre y si no lo atajamos acá saldría del color de lo que fue.
  if (tiene(s, 'carbonoso')) return 'tizon'
  // 2. Lo mineral, en tres. El filo antes que nada: es lo único que corta, y en
  //    el mapa hay que poder encontrarlo.
  if (tiene(s, 'mineral')) {
    if (q(s, 'sharpness') >= FILO_QUE_CORTA) return 'tizon'
    if (q(s, 'rigidity') < RIGIDEZ_DE_LO_QUE_SE_AMASA) return 'ocre'
    return 'gris'
  }
  // 3. Lo que pega y no tira, ANTES que el tag carnoso y que el líquido: la
  //    grasa es comida y la savia es líquida, y las dos se comportan como
  //    pegamento, que es lo que se ve.
  if (
    q(s, 'cohesion') >= COHESION_QUE_PEGA &&
    q(s, 'tensile') <= TENSION_QUE_TIRA &&
    q(s, 'rigidity') <= RIGIDEZ_QUE_SE_SOSTIENE
  ) {
    return 'ambar'
  }
  if (tiene(s, 'liquido')) return 'azul'
  if (tiene(s, 'carnoso')) return 'rosa'
  // 4. Fibra ANIMAL: fibrosa y no vegetal. El orden con lo vegetal importa —
  //    la corteza y la liana también son fibrosas y no van acá.
  if (tiene(s, 'fibroso') && !tiene(s, 'vegetal')) return 'tostado'
  if (tiene(s, 'vegetal')) {
    if (q(s, 'nutrition') >= NUTRICION_DE_RESERVA) return 'ocre'
    return q(s, 'moisture') < HUMEDAD_QUE_APAGA ? 'pardo' : 'verde'
  }
  // 5. Lo orgánico que no es nada de lo anterior. Hoy es el hongo, que trae un
  //    solo tag.
  if (tiene(s, 'organico')) return 'rosa'
  // 6. El escape. Gris, que no promete nada.
  return 'gris'
}

// ─── El tercer eje: la trama ────────────────────────────────────────────────

/**
 * CUÁNTO SE SOSTIENE Y CUÁNTO TIRA, en tres escalones cada uno.
 *
 * Son ordinales y no números para lo mismo que la banda de estado del
 * descriptor: si viajaran continuos, el dibujo cambiaría con el cuarto decimal
 * de una cualidad y dejaría de poder compararse.
 */
export interface Trama {
  /** 0 blando · 1 firme · 2 duro. De `rigidity`. */
  readonly grano: 0 | 1 | 2
  /** 0 se corta · 1 aguanta · 2 ata. De `tensile`. */
  readonly veta: 0 | 1 | 2
}

// ─── UN CORTE VA EN UN HUECO, NUNCA ENCIMA DE UN DATO ───────────────────────
//
// Es la regla que este archivo aprendió a los golpes y la más reusable de todo
// el paquete. La primera versión puso los cortes en números redondos —0,25 y
// 0,55— y los dos cayeron JUSTO sobre valores del catálogo:
//
//   `tensile` 0,55 es el de `madera` Y el de `piel`. Con el corte ahí, `madera`
//   no se separaba de `madera-dura` (0,70) ni `piel` de `tendon` (0,95): los
//   cuatro quedaban del mismo lado.
//
// O sea que **el corte existía y no cortaba nada**, y los dos pares que se
// perdían son dos de las cuatro decisiones que el juego quiere que duelan. Lo
// encontró el test del punto (c), que por eso está escrito con la lista a mano.
//
// Los cuatro de abajo caen en huecos medidos del catálogo semilla:
//
//   grano firme  0,22   entre pluma/arcilla (0,20) y cuero (0,25)
//   grano duro   0,65   entre madera-verde/raiz-dura (0,45) y madera (0,70)
//   veta aguanta 0,17   entre piedra/tuberculo (0,15) y pescado (0,18)
//   veta ata     0,65   entre madera-verde (0,60) y madera-dura (0,70)
//
// Y el hueco es lo que los hace estables: una recalibración que mueva una
// cualidad un punto no da vuelta ninguna clasificación.
const GRANO_FIRME = 0.22
const GRANO_DURO = 0.65
const VETA_AGUANTA = 0.17
const VETA_ATA = 0.65

export function tramaDe(s: Substance): Trama {
  const r = q(s, 'rigidity')
  const t = q(s, 'tensile')
  return {
    grano: r >= GRANO_DURO ? 2 : r >= GRANO_FIRME ? 1 : 0,
    veta: t >= VETA_ATA ? 2 : t >= VETA_AGUANTA ? 1 : 0,
  }
}

/**
 * EL ASPECTO DE UNA SUSTANCIA, por su id — que es lo único que el descriptor
 * publica.
 *
 * `phys` entra por parámetro y no se guarda: es el catálogo del mundo, y quien
 * dibuja un mundo lo tiene. Es la misma frontera que `nameOf`, que también toma
 * la física para poder nombrar.
 *
 * ─── POR QUÉ ESTO NO VIVE EN EL DESCRIPTOR ─────────────────────────────────
 *
 * Porque la familia es una decisión de PRESENTACIÓN. Si viajara adentro del
 * `RenderDescriptor`, pasar de nueve familias a catorce le cambiaría el
 * `renderDescriptorHash` a un mundo que no cambió en nada — y ese hash existe
 * justamente para detectar lo contrario.
 */
export function aspectoDe(id: SubstanceId, phys: Physics): { familia: Familia; paleta: Paleta; trama: Trama } {
  const s = phys.substances.get(id)
  // El fallback obligatorio del ADR: una sustancia que el catálogo no conoce se
  // dibuja igual. No hay rama que devuelva `undefined` ni que pida arte.
  if (s === undefined) return { familia: 'gris', paleta: PALETAS.gris, trama: { grano: 1, veta: 1 } }
  const familia = familiaDe(s)
  return { familia, paleta: PALETAS[familia], trama: tramaDe(s) }
}
