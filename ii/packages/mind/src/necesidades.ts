// ─── @anima/mind/necesidades.ts ──────────────────────────────────────────────
//
// QUÉ LE DUELE A LA CRIATURA, y cuánto la calma tener algo.
//
// Son las dos mitades de la misma pregunta y por eso viven juntas: `necesidades`
// lee el cuerpo y el reloj y contesta cuánto duele cada cosa; `satisfaccion` lee
// el catálogo de la física y contesta cuánto de ese dolor apaga una clase de
// materia. La escalera multiplica las dos y ordena.
//
// ─── LAS CUATRO DECISIONES DE ESTE ARCHIVO ──────────────────────────────────
//
//   1. LA CURVA DE `energia` ACELERA HACIA EL CERO, Y NO PUEDE ADEMÁS IR POR
//      ENCIMA DE LA RECTA. Las dos cosas se piden solas al leer «una criatura con
//      50 de stamina no está al 5% de necesidad» y son INCOMPATIBLES, con
//      demostración de tres líneas: si `f(0)=1`, `f(1)=0` y `f(x) ≥ 1−x` cerca de
//      cero, entonces `(f(x)−f(0))/x ≥ −1`, o sea `|f'(0)| ≤ 1`; y como la
//      pendiente promedio en `[0,1]` es exactamente `−1`, la pendiente máxima
//      cae en el extremo LLENO y no en el vacío. O sea: **una curva que va por
//      arriba de la recta crece más despacio cerca del cero, no más rápido.**
//      Se elige la aceleración —que es lo que el enunciado pide con esas
//      palabras— y se paga que en 50 de stamina el número sea 0,9025 y no 0,95.
//      Sigue sin ser «5% de necesidad» por dos órdenes de magnitud, y lo que la
//      escalera usa para decidir es el INCREMENTO: los últimos 50 de stamina
//      mueven la necesidad 0,0975 y los primeros 50 la mueven 0,0025, o sea **39×**
//      (medido en el test, no estimado).
//
//   2. NINGÚN NÚMERO SALE DE UN GUSTO: el tanque, el piso térmico y el neutro
//      ambiente se le preguntan a `@anima/physics` (`specOf('stamina').range`,
//      `specOf('temperature').range`, `T_AMBIENTE`). Si alguien recalibra el
//      catálogo, esto se recalibra solo. Un `1000` escrito acá sería una tercera
//      copia del tanque, que es el bug de `DSL_REFERENCE` de Ánima I con otro
//      nombre.
//
//   3. `satisfaccion` NO TIENE UNA FILA POR SUSTANCIA NI UNA FILA POR TAG. No
//      hay un solo literal `'carnoso'` ni `'pescado'` en el código de este
//      archivo —lo verifica un test que lee el fuente con los comentarios
//      sacados—. Lo que hay es: para el tag que se pregunte, el TECHO de lo que
//      las sustancias que lo llevan pueden rendir, contra el techo de todo el
//      catálogo. Una sustancia que el oráculo invente mañana entra en la cuenta
//      el mismo tick, sin fila propia, y puede cambiar lo que un tag promete —que
//      es exactamente lo que el test estrella del Hito 1 exige y acá se repite.
//
//   4. NINGÚN TAG CALMA `refugio`, Y NO ES UN OLVIDO. Está abajo, en
//      `promesaDeTag`, con el número que se descartó.

import { buildSeedPhysics, specOf, T_AMBIENTE, type Physics } from '@anima/physics'

import type { NeedVector, VistaDeLaMente } from './tipos.js'

// ─── Lo que el catálogo dicta ────────────────────────────────────────────────

/**
 * El tanque de `stamina`, leído del catálogo cerrado. Hoy son 1000, y son 1000
 * SEGUNDOS DE VIDA: el ADR II-0009 fijó `COSTO_VIVIR_POR_SEGUNDO = 1,0` justo
 * para que la cualidad se leyera así de un vistazo.
 */
const TANQUE = specOf('stamina').range[1]

/**
 * El fondo de la escala térmica del catálogo. Es el cero de la comodidad, no una
 * temperatura de muerte: **el mundo no tiene ninguna ley que lastime por frío**
 * (ver `elCalor`), así que lo único honesto que se puede usar de escala es hasta
 * dónde llega el eje.
 */
const PISO_TERMICO = specOf('temperature').range[0]

/**
 * Cuánta escala térmica hay entre estar cómodo y el fondo del eje. Se calcula
 * una vez porque es una división que no depende de nada.
 */
const ESCALA_DE_FRIO = T_AMBIENTE - PISO_TERMICO

/**
 * La física por omisión de `satisfaccion`. Existe para que el llamador de dos
 * argumentos —que es el que `oportunidades.ts` va a escribir— siga andando; el
 * tercer argumento es el que le permite a un test, y al oráculo, preguntar por un
 * catálogo que tiene sustancias que hoy no existen.
 */
const FISICA_SEMILLA: Physics = buildSeedPhysics()

// ─── Qué le duele ────────────────────────────────────────────────────────────

/**
 * Qué le duele a la criatura, ahora. Los tres en [0, 1], cero es «no duele».
 *
 * Es una función PURA de la vista: no guarda nada, no promedia con el tick
 * anterior y no tiene histéresis. La histéresis es de la escalera —`D2` tiene
 * `MARGEN_DE_HISTERESIS` y `PERMANENCIA_EN_TICKS` para eso— y meterla acá sería
 * tener dos amortiguadores en serie sin que ninguno de los dos sepa del otro.
 */
export function necesidades(v: VistaDeLaMente): NeedVector {
  return { energia: laEnergia(v), calor: elCalor(v), refugio: elRefugio(v) }
}

/**
 * LO ÚNICO QUE DUELE DE VERDAD (ADR II-0009): la `stamina`, que la ley del
 * metabolismo drena a un segundo por segundo, que no vuelve sola, y que en cero
 * mata.
 *
 * `falta²`, con `falta` la fracción de tanque que NO está. Tres propiedades, y
 * las tres son la razón de que sea ésta y no otra:
 *
 *   · **0 con el tanque lleno y 1 con el vacío**, exactos y por construcción, sin
 *     acotar nada y sin una constante de ajuste.
 *   · **acelera hacia el cero**: la derivada es `2·falta/TANQUE`, o sea que crece
 *     recto con lo vacío que está el tanque. Medido en el test: los últimos 50 de
 *     stamina mueven la necesidad **39×** más que los primeros 50.
 *   · **no inventa un codo.** Cualquier «umbral de pánico» sería un número sin
 *     fuente, y acá no hay ninguno: el codo es la curva entera.
 *
 * Y el precio, dicho: en 50 de stamina da **0,9025**, apenas por debajo de los
 * 0,95 de una recta. Por qué no se puede tener las dos cosas está en la decisión
 * 1 del encabezado, con la demostración. Lo que importa para decidir no es el
 * valor sino el incremento, y ahí la diferencia no es «apenas».
 */
function laEnergia(v: VistaDeLaMente): number {
  const falta = acotar01((TANQUE - v.self.stamina) / TANQUE)
  return falta * falta
}

/**
 * EL FRÍO ES EL PEOR DE DOS: lo que la criatura ES y lo que la criatura VA A SER.
 *
 * La ley 1 relaja la `temperature` del cuerpo hacia la de la celda, así que el
 * ambiente no es contexto: es el destino. Un cuerpo tibio parado en una celda
 * helada tiene un problema aunque el termómetro propio todavía no lo diga, y una
 * criatura helada parada al lado del fuego lo tiene aunque el ambiente ya la esté
 * salvando. Tomar el máximo de los dos es la forma más chica de decir las dos
 * cosas sin un tercer término que amortigüe.
 *
 * Cero desde `T_AMBIENTE` para arriba, y eso es deliberado: **el calor de más no
 * es esta necesidad**. Quemarse duele, pero duele en otra coordenada que hoy no
 * existe, y estirar `calor` para que también signifique «me estoy achicharrando»
 * la volvería no monótona y la escalera no podría ordenar con ella.
 *
 * ─── EL HUECO, DICHO CON TODAS LAS LETRAS ───────────────────────────────────
 *
 * **Esta necesidad no tiene motor**, y no es una impresión: `world/src/step.ts`
 * declara `CONSERVADAS_QUE_SOLO_MUEVE_EL_MUNDO = ['stamina']` y enumera las TRES
 * formas que el mundo tiene de bajarla —vivir, entrar en una celda, y el aliento
 * que la fricción convierte en calor—. Ninguna es el frío. La criatura a −80 °C
 * está exactamente igual de viva que a 15.
 *
 * `tipos.ts` ya lo dice —«`energia` es la única que hoy tiene un motor real»— y
 * acá se repite porque es lo que decide la FORMA: sin una ley que castigue el
 * frío no hay ningún codo medible que justifique una curva, así que la rampa es
 * recta a propósito. El día que exista la ley, la curva se calibra contra ella y
 * no contra el gusto de nadie.
 */
function elCalor(v: VistaDeLaMente): number {
  const cuerpo = frio(v.q(v.self, 'temperature'))
  const ambiente = frio(v.qAt(v.self.at, 'temperature'))
  return Math.max(cuerpo, ambiente)
}

function frio(t: number): number {
  return acotar01((T_AMBIENTE - t) / ESCALA_DE_FRIO)
}

/**
 * LA NOCHE SE MIDE EN FRACCIÓN DE DÍA, NUNCA EN SEGUNDOS SUELTOS.
 *
 * Ésta es la prueba T2.1 de `ii/docs/escalera-capacidades.md`, y es un control
 * antes que una fórmula: *«la maniobra arranca N ticks antes del anochecer y N
 * escala cuando se cambia `dayLength`. Si al duplicar el día sigue arrancando en
 * el mismo tick absoluto, el largo del día está cableado adentro.»*
 *
 * Por eso el único número que entra acá es un COCIENTE: `secondsToNightfall`
 * contra la mitad del día, que es cuánto dura la luz (`relojDe` hace el día
 * mitad y mitad, y de noche contesta 0 — no «lo que falta para el próximo
 * anochecer»). Un `100` escrito acá sería el cableo que el control busca, y
 * `LARGO_DEL_DIA` importado de `@anima/world` sería el mismo cableo con permiso.
 *
 * La forma es la misma que la de `energia` y por la misma razón: acelera hacia el
 * mal lado. Con la mitad de la luz gastada la urgencia vale 0,25; con tres
 * cuartos gastados, 0,5625. De noche vale 1 y no hay gradiente, porque no lo hay:
 * ya es tarde.
 *
 * ─── Y SE APAGA BAJO TECHO ──────────────────────────────────────────────────
 *
 * Multiplicar por `1 − sheltered` no es un adorno: `refugio` es la única de las
 * tres necesidades cuya satisfacción es un LUGAR y no una cosa (ver
 * `promesaDeTag`), y sin este término la criatura metida en la cueva seguiría
 * reportando que necesita una cueva. La oscilación que esto abre —adentro no
 * duele, así que salgo; afuera duele, así que entro— es exactamente para lo que
 * la escalera tiene `PERMANENCIA_EN_TICKS`, y amortiguarla también acá sería
 * poner dos resortes en serie.
 */
function elRefugio(v: VistaDeLaMente): number {
  const luzDelDia = v.clock.dayLength / 2
  // Un día de largo cero o negativo no es un mundo: sin luz que gastar, la noche
  // es todo. Se contesta el extremo en vez de dividir por cero, que envenenaría
  // el vector entero con un `NaN` cuarenta ticks más tarde y lejos de acá.
  const transcurrido = luzDelDia > 0 ? 1 - acotar01(v.clock.secondsToNightfall / luzDelDia) : 1
  const alDescubierto = 1 - acotar01(v.qAt(v.self.at, 'sheltered'))
  return transcurrido * transcurrido * alDescubierto
}

// ─── Cuánto calma ────────────────────────────────────────────────────────────

/**
 * Lo que una clase de materia PROMETE para cada necesidad, en [0, 1].
 *
 * `1` no quiere decir «lo máximo que el catálogo de cualidades permite» sino **lo
 * mejor que este mundo tiene hoy para eso**, y la diferencia es la que hace que
 * las dos coordenadas se puedan comparar entre sí. Normalizar contra el rango
 * declarado (`nutrition ≤ 100`, `digestibility ≤ 1`, `fuelEnergy ≤ 100`) parece
 * más puro y es peor: en la semilla la mejor comida rinde 15,40 de calorías por
 * unidad de masa (la grasa) y el mejor combustible 32,00 (el carbón), así que con
 * esa normalización «algo que arde» le ganaría **2,08 a 1** a «algo carnoso» con
 * las dos necesidades empatadas — una ventaja que no sale de la física sino de
 * que las dos cualidades comparten escala nominal y no comparten escala real.
 *
 * El precio de normalizar contra el catálogo hay que decirlo y está medido: si el
 * oráculo inventa algo más nutritivo que la grasa, lo carnoso **baja**. Es
 * deliberado y es lo que la frase «lo mejor que este mundo tiene hoy» significa,
 * y tiene su propio test para que nadie lo descubra como sorpresa.
 */
export interface Promesa {
  readonly energia: number
  readonly calor: number
  readonly refugio: number
}

const NADA: Promesa = { energia: 0, calor: 0, refugio: 0 }

/**
 * Cuánto calma esta necesidad tener algo con este tag. En [0, 1].
 *
 * Es el promedio de lo que el tag promete PESADO POR LO QUE DUELE: un pescado en
 * la mano vale mucho con hambre y nada sin hambre, y con hambre y frío a la vez
 * vale la parte del problema que resuelve. Sin nada que doler no calma nada y da
 * 0 — que es lo correcto y además evita dividir por cero.
 *
 * El tercer argumento es la física contra la que se pregunta. Existe para que el
 * catálogo pueda crecer: el oráculo agrega sustancias en vivo, y lo que un tag
 * promete cambia con ellas SIN que nadie escriba una fila.
 */
export function satisfaccion(n: NeedVector, tag: string, phys: Physics = FISICA_SEMILLA): number {
  const p = promesaDeTag(tag, phys)
  const duele = n.energia + n.calor + n.refugio
  if (!(duele > 0)) return 0
  const calma = n.energia * p.energia + n.calor * p.calor + n.refugio * p.refugio
  return acotar01(calma / duele)
}

/**
 * QUÉ PROMETE UN TAG, derivado del catálogo y de nada más.
 *
 * Para cada dimensión se toma el TECHO de las sustancias que llevan el tag,
 * dividido por el techo de todo el catálogo. Techo y no promedio, y la razón es
 * de conducta y no de estética: con el promedio, que el oráculo invente tres
 * sustancias flojas con tag `X` le BAJARÍA el valor a la que la criatura ya
 * conoce y ya sabe que rinde. Una criatura que cree que una clase de cosa rinde
 * está pensando en lo mejor que le puede tocar de esa clase, no en la mediana de
 * un catálogo que nunca vio entero.
 *
 * ─── LAS DOS DIMENSIONES QUE SÍ, Y CÓMO ─────────────────────────────────────
 *
 *   `energia`  `nutrition · digestibility` por unidad de masa. No es una fórmula
 *              nueva: es exactamente lo que la ley 5 llama calorías
 *              (`physics/src/leyes.ts`: «las calorías, que son
 *              `nutrition · mass · digestibility`»), sin la masa, que es del
 *              cuerpo y no de la clase. Que `digestibility` esté adentro es lo
 *              que hace que cocinar aparezca sin que nadie escriba «cocinar
 *              rinde más».
 *   `calor`    `fuelEnergy` por unidad de masa, que es lo que la ley 3 quema.
 *
 * ─── Y LA QUE NO: `refugio`. NO ES UN OLVIDO ────────────────────────────────
 *
 * `sheltered` es una cualidad DE CELDA y la ley 12 la produce con un cuerpo
 * COLOCADO encima, pesado por su `permeability`. O sea que la afordancia que
 * calma el refugio no es «tener algo con tag X» —que es lo único que esta función
 * sabe contestar— sino «estar en una celda tapada».
 *
 * Derivarlo igual de `permeability` compila, corre y da un número, y el número es
 * peor de lo que parece: con la semilla, el techo de `1 − permeability` de lo
 * carnoso es **0,9000** (la grasa) contra **0,9900** del mineral (el pedernal), o
 * sea que **un pedazo de grasa en la mano sería el 91% de un techo de piedra**.
 * Y el daño no es cosmético: con hambre 0,25 y refugio 0,90 —una criatura recién
 * nacida al caer la noche— lo carnoso saltaría de **0,2174 a 0,9289** de
 * satisfacción y le ganaría por lejos a buscar cueva. Es la clase exacta de falso
 * verde que este proyecto persigue: la propiedad existe, la fórmula corre, y la
 * afirmación es falsa. Los cuatro números están medidos en el test, que además
 * deja escrita la fórmula descartada para que se pueda volver a medir.
 *
 * Así que devuelve 0 y lo dice. El día que haya una afordancia de COLOCAR,
 * `permeability` entra por ahí, que es donde la ley 12 la lee.
 */
export function promesaDeTag(tag: string, phys: Physics = FISICA_SEMILLA): Promesa {
  const t = tagPelado(tag)
  if (t === '') return NADA
  const porTag = tablaDe(phys)
  return porTag.get(t) ?? NADA
}

/**
 * Los `rinde` de la memoria de afordancias viajan como texto y no hay un solo
 * lugar que fije su forma: `@anima/plan` escribe el predicado
 * `holding(tag:carnoso)` y la memoria guarda tags pelados. Quedarse con lo que
 * hay después del último `:` y sin el paréntesis de cierre acepta las dos formas
 * y cuesta dos líneas; rechazar una de las dos costaría un bug de integración que
 * se ve como «la criatura no tiene hambre nunca».
 */
function tagPelado(rinde: string): string {
  const corte = rinde.lastIndexOf(':')
  const cola = corte >= 0 ? rinde.slice(corte + 1) : rinde
  return cola.endsWith(')') ? cola.slice(0, -1) : cola
}

/**
 * La tabla tag → promesa de UNA física, calculada una vez.
 *
 * El `WeakMap` es el mismo truco que `TAGS_POR_PARTES` en `physics/src/leyes.ts`:
 * la clave es el objeto `Physics`, así que una física que nadie usa más se junta
 * sola y una física nueva —la que el oráculo arma cuando inventa algo— no
 * encuentra nada cacheado y se recalcula entera. No es memoria escondida: es una
 * función pura con su resultado guardado, y `buildSeedPhysics` devuelve un objeto
 * nuevo cada vez, así que dos catálogos distintos nunca comparten entrada.
 */
const TABLAS = new WeakMap<Physics, ReadonlyMap<string, Promesa>>()

function tablaDe(phys: Physics): ReadonlyMap<string, Promesa> {
  const visto = TABLAS.get(phys)
  if (visto !== undefined) return visto

  // Primera pasada: el techo de cada dimensión sobre el catálogo ENTERO. Es el
  // denominador, y tiene que mirar todo y no sólo el tag preguntado, porque la
  // pregunta que contesta es «de lo mejor que hay en este mundo, cuánto es esto».
  let techoCalorias = 0
  let techoCombustible = 0
  for (const s of phys.substances.values()) {
    const c = caloriasDe(s.perUnitMass)
    const f = combustibleDe(s.perUnitMass)
    if (c > techoCalorias) techoCalorias = c
    if (f > techoCombustible) techoCombustible = f
  }

  // Segunda pasada: el techo de cada dimensión POR TAG. El recorrido es sobre el
  // Map de sustancias, cuyo orden de iteración es el de inserción y por lo tanto
  // reproducible; y de todas formas un máximo no depende del orden.
  const crudo = new Map<string, { calorias: number; combustible: number }>()
  for (const s of phys.substances.values()) {
    const c = caloriasDe(s.perUnitMass)
    const f = combustibleDe(s.perUnitMass)
    for (const tag of s.tags) {
      const y = crudo.get(tag)
      if (y === undefined) crudo.set(tag, { calorias: c, combustible: f })
      else {
        if (c > y.calorias) y.calorias = c
        if (f > y.combustible) y.combustible = f
      }
    }
  }

  const out = new Map<string, Promesa>()
  for (const [tag, y] of crudo) {
    out.set(tag, {
      energia: contra(y.calorias, techoCalorias),
      calor: contra(y.combustible, techoCombustible),
      // Ver el comentario largo de `promesaDeTag`: no hay tag que calme el
      // refugio, porque un techo es un lugar y no una cosa que se tenga.
      refugio: 0,
    })
  }
  TABLAS.set(phys, out)
  return out
}

/**
 * Las calorías por unidad de masa. `nutrition` es lo que hay y `digestibility` es
 * cuánto de eso se aprovecha; el producto es lo que la ley 5 mueve al cocinar y
 * lo que el ADR II-0009 usa para contar cuántos pescados hacen una vida.
 */
function caloriasDe(q: { nutrition?: number; digestibility?: number }): number {
  return positivo(q.nutrition) * positivo(q.digestibility)
}

function combustibleDe(q: { fuelEnergy?: number }): number {
  return positivo(q.fuelEnergy)
}

/** Un catálogo sin nada de eso no promete nada, y no divide por cero para decirlo. */
function contra(v: number, techo: number): number {
  return techo > 0 ? acotar01(v / techo) : 0
}

/** Ausente es cero, y negativo también: una cualidad no declarada no resta. */
function positivo(v: number | undefined): number {
  return v !== undefined && v > 0 ? v : 0
}

/**
 * Acotar a [0, 1] con el orden escrito así a propósito: un `NaN` falla las dos
 * comparaciones y cae en el 0. Con `Math.min(1, Math.max(0, x))` el `NaN` pasa
 * entero y envenena el vector de necesidades, y el síntoma aparece muchos ticks
 * después, en la escalera, donde no hay forma de saber de dónde salió.
 */
function acotar01(x: number): number {
  return x > 1 ? 1 : x > 0 ? x : 0
}
