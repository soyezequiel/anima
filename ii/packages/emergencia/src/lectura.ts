// ─── LO ÚNICO QUE EL JUEZ SABE HACER: PREGUNTARLE AL MOTOR ───────────────────
//
// La regla 1 del criterio de emergencia, la que tumbó la tanda anterior de
// detectores, dice así:
//
//   «EL DETECTOR LLAMA A LAS FUNCIONES EXPORTADAS DEL MOTOR. Un detector que
//    transcribe una fórmula mide su propia copia.»
//
// De los diez detectores de aquella tanda, seis reimplementaban una fórmula del
// motor y tres la reimplementaban MAL: el de `no-frotar-lo-que-no-alcanza`
// transcribía `capacidadTermica × (ignitionPoint − temperature) / 0,35` y su
// copia daba 1384,29 donde el mundo cobra 1401,26 — a tres renglones de
// distancia, en el mismo documento, sin que nadie viera que no eran el mismo
// número.
//
// Este archivo es la respuesta operativa a eso: **todo lo que el juez sabe del
// mundo pasa por acá y por `cronica.ts`, y en los dos no hay ni una fórmula de
// física propia**. Éstas son las funciones exportadas que el paquete llama, y no
// hay ninguna otra fuente de verdad sobre el mundo:
//
//   qualityOf                 @anima/physics · body.ts     · toda cualidad, derivadas incluidas
//   cumpleRol                 @anima/physics · leyes.ts    · el mismo juicio que usa `intencionAplicar`
//   estaEnVentanaDeCoccion    @anima/physics · leyes.ts    · «¿esto se está cocinando?»
//   temperaturaDeEquilibrio   @anima/physics · leyes.ts    · la ley 1 en régimen
//   unir                      @anima/physics · leyes.ts    · el ensamble que la criatura PODRÍA armar
//   chebyshev                 @anima/world   · intent.ts   · «a tiro» quiere decir lo que camina
//   FRICCION / UNION / EXTRACCION — los roles se leen DEL CATÁLOGO, no se copian
//
// Y una sola constante del documento, `TECHO_DE_LA_FRICCION`, escrita abajo con
// el motivo: no existe función exportada que devuelva el precio de encender.
//
// ─── EL HUECO DEL ARNÉS, declarado ──────────────────────────────────────────
//
// `montajeDe`, `celdaDe`, `entornoDe` y `stockDe` **no están exportadas** de
// `@anima/world` —son funciones de módulo de `step.ts` y `index.ts` re-exporta el
// módulo, así que lo que no dice `export` no sale—. O sea que ningún detector
// puede preguntarle al motor «¿esto está en parrilla o en contacto?». Los que lo
// necesitan leen `supportedBy` y `covering` del `WorldBody`, que es LEER EL
// ESTADO DEL MUNDO y no copiar una fórmula, y está dicho en cada uno.

import {
  baseRoleName,
  cumpleRol,
  estaEnVentanaDeCoccion,
  EXTRACCION,
  FRICCION,
  qualityOf,
  temperaturaDeEquilibrio,
  UNION,
  unir,
} from '@anima/physics'
import type { Body, Physics, Process, Role } from '@anima/physics'
import { chebyshev } from '@anima/world'
import type { Actor, Placement, WorldBody, WorldState } from '@anima/world'

/**
 * EL ALCANCE, y es el único número de este archivo.
 *
 * Sale de los detectores del documento, que dicen «a Chebyshev ≤ 3» en cuatro
 * entradas distintas (§4, entradas 1, 2 y 8). No es una constante de la física:
 * es la vecindad dentro de la cual el juez considera que la criatura TENÍA a la
 * vista un candidato. Vive acá, escrito una vez, para que no aparezca un 3 suelto
 * en cinco detectores y alguien mueva cuatro.
 */
export const ALCANCE = 3

/** Un cuerpo y su masa, que es lo que casi todos los detectores comparan. */
export interface Pesado {
  readonly id: string
  readonly masa: number
}

/**
 * El rol `nombre` de un proceso del catálogo, o una excepción.
 *
 * `FRICCION.roles[0]` con `noUncheckedIndexedAccess` es `Role | undefined`, y la
 * salida fácil sería un `?? algo`. No: si el catálogo dejara de tener el rol `a`
 * de `friccion`, el juez tiene que ROMPERSE y no medir cero en silencio. Un
 * detector que se degrada solo es el modo de falla que este paquete existe para
 * no tener.
 */
export function rolDe(p: Process, nombre: string): Role {
  for (const r of p.roles) if (baseRoleName(r.name) === nombre) return r
  throw new Error(`el proceso ${p.id} ya no tiene el rol ${nombre}`)
}

/** El rol `a` de `friccion`: `rigidity >= 0,5`. Del catálogo, no copiado. */
export const ROL_A_DE_FRICCION = (): Role => rolDe(FRICCION, 'a')
/** El rol `binder` de `union`: `flexibility >= 0,8` y `tensile >= 0,3`. */
export const ROL_BINDER_DE_UNION = (): Role => rolDe(UNION, 'binder')
/** El rol `gear` de `extraccion`: `reach >= 2` y `catch > 0`. */
export const ROL_GEAR_DE_EXTRACCION = (): Role => rolDe(EXTRACCION, 'gear')

/** ¿Los dos están en la MISMA celda? La ley 1 en contacto pide eso y no menos. */
export function mismaCelda(a: Placement, b: Placement): boolean {
  return a.x === b.x && a.y === b.y
}

/** ¿Está a tiro? `chebyshev` es del motor: diagonal cuesta un paso, como caminar. */
export function alAlcance(a: Placement, b: Placement): boolean {
  return chebyshev(a, b) <= ALCANCE
}

/**
 * LOS CUERPOS QUE SON CRIATURAS Y NO MATERIA TIRADA, y por qué el juez los saca.
 *
 * Es la REGLA 6 en su forma más barata y más cara a la vez: el cuerpo de un actor
 * es de `carne`, o sea que tiene `calories` 3,15 por kilo, `fuelEnergy` 2 y una
 * `permeability` propia. Sin este filtro:
 *
 *   · una criatura parada en la celda del fuego entra sola en la ventana de
 *     cocción y dispara «se cocinó algo» en cuatro detectores, nada más caminando;
 *   · su propio cuerpo aparece como candidato a leño en el detector 8;
 *   · y el contra-detector del fardo lo ata al fardo, que fue exactamente lo que
 *     pasó la primera vez que se corrió este banco.
 *
 * Un actor no es una pieza ni un tronco: es el que cocina.
 */
export function cuerposDeActores(w: WorldState): ReadonlySet<string> {
  const s = new Set<string>()
  for (const a of w.actors.values()) s.add(a.body)
  return s
}

/**
 * ¿ESTO ES UNA PIEZA DE COMIDA?
 *
 * La pregunta de fondo es al motor: `qualityOf(b,'calories')` es derivada
 * —`nutrition · mass · digestibility`— y da cero para la madera sin que nadie
 * escriba «la madera no se come». La otra mitad es el filtro de arriba.
 */
export function esPieza(
  w: WorldState,
  id: string,
  c: WorldBody,
  // El conjunto se puede pasar hecho, y `cronica.ts` lo pasa: esta función corre
  // una vez por cuerpo y por tick sobre veinte mil ticks, y armar el `Set` adentro
  // convertía un recorrido lineal en uno cuadrático sin que nada se pusiera rojo.
  criaturas: ReadonlySet<string> = cuerposDeActores(w),
): boolean {
  if (qualityOf(c.body, 'calories', w.phys) <= 0) return false
  return !criaturas.has(id)
}

/** ¿Este cuerpo, ahora, está en su ventana de cocción? Una llamada, cero fórmulas. */
export function enCoccion(b: Body, phys: Physics): boolean {
  return estaEnVentanaDeCoccion(b, phys)
}

/** Dónde está la criatura. `undefined` si su cuerpo ya no está en el mundo. */
export function dondeEsta(w: WorldState, a: Actor): Placement | undefined {
  return w.bodies.get(a.body)?.at
}

/**
 * Los cuerpos que cumplen un rol y están a tiro de `centro`, con su masa.
 *
 * Es el corazón de los detectores 1, 2 y 8: la ALTERNATIVA que la criatura tenía
 * y no eligió. Se pregunta con `cumpleRol` —o sea con el mismo juicio que usa
 * `intencionAplicar` para dejar pasar la intención— y no con una lista de
 * cualidades escrita a mano, que es exactamente lo que la Regla 1 prohíbe.
 */
export function candidatosDeRol(w: WorldState, centro: Placement, r: Role): Pesado[] {
  const criaturas = cuerposDeActores(w)
  const out: Pesado[] = []
  for (const [id, c] of w.bodies) {
    if (criaturas.has(id) || !alAlcance(c.at, centro)) continue
    if (!cumpleRol(c.body, r, w.phys)) continue
    out.push({ id, masa: qualityOf(c.body, 'mass', w.phys) })
  }
  return out
}

/**
 * LOS CANDIDATOS DEL ROL `a` DE `friccion` QUE ADEMÁS PUEDEN ARDER.
 *
 * ─── POR QUÉ NO ALCANZA CON `cumpleRol`, y costó dos detectores ─────────────
 *
 * El rol `a` pide `rigidity >= 0,5` y nada más, porque frotar dos piedras es
 * legal. Pero los detectores 1 y 2 no miden «frotó algo»: miden UNA ELECCIÓN
 * ENTRE COMBUSTIBLES —«se negó al que no entraba en el tanque», «se salteó el
 * más liviano»— y una piedra no es una alternativa a una vara: es una piedra.
 * Medido: `piedra` tiene `rigidity` 0,95, pasa `cumpleRol`, y a 2000 °C entrega
 * `emitsPower` **0**. Y está sembrada justo donde está el pescado —`agua-dulce`,
 * peso 3, de 0,2 a 3 kg (`oracle/src/bioma.ts:296`)—, así que con un guijarro al
 * lado el detector 2 firmaba «se salteó el más liviano» y con un canto el 1
 * firmaba «tenía a tiro uno más pesado y no lo tocó». Las dos alternativas eran
 * incombustibles: elegirlas no enciende nada, y una decisión entre una opción
 * que sirve y otra que no existe no es una decisión.
 *
 * La condición que se agrega **es otra pregunta al motor y no una fórmula**: se
 * le pasa a `potenciaSiArdiera` un cuerpo con la temperatura por encima de su
 * ignición y se lee `emitsPower`. No se escribe `fuelEnergy > 0` ni ninguna de
 * las tres constantes de la emisión: contesta la derivada.
 */
export function candidatosDeFriccion(w: WorldState, centro: Placement): Pesado[] {
  const out: Pesado[] = []
  for (const x of candidatosDeRol(w, centro, ROL_A_DE_FRICCION())) {
    const c = w.bodies.get(x.id)
    if (c === undefined || potenciaSiArdiera(c.body, w.phys) <= 0) continue
    out.push(x)
  }
  return out
}

/**
 * Los que están a tiro, tienen combustible Y NO SON COMIDA. La alternativa del 8.
 *
 * ─── EL FILTRO DE LA COMIDA, y por qué no es una licencia ───────────────────
 *
 * `pescado` tiene `fuelEnergy` **2** (medido con `qualityOf`, no supuesto), así
 * que un pescado tirado al lado del fuego entraba solo al conjunto de «leños que
 * había a tiro» y el detector 8 firmaba «prendió el grande teniendo a mano
 * «pez-0» de 2,0000 kg». La entrada 8 dice medir cuánto DURA el fuego que se
 * eligió, y una pieza de comida no es un leño alternativo: es lo que se cocina
 * con él. Las dos preguntas —¿arde? ¿se come?— son al motor: `fuelEnergy` y
 * `calories`, las dos derivadas del catálogo.
 */
export function combustiblesCerca(w: WorldState, centro: Placement): Pesado[] {
  const criaturas = cuerposDeActores(w)
  const out: Pesado[] = []
  for (const [id, c] of w.bodies) {
    if (criaturas.has(id) || !alAlcance(c.at, centro)) continue
    if (qualityOf(c.body, 'fuelEnergy', w.phys) <= 0) continue
    if (qualityOf(c.body, 'calories', w.phys) > 0) continue
    out.push({ id, masa: qualityOf(c.body, 'mass', w.phys) })
  }
  return out
}

/**
 * ¿DOS MASAS IGUALES AL CENTÉSIMO DE KILO?
 *
 * La usa el detector 3 para elegir el fuego testigo. No es una constante de la
 * física ni un umbral del documento: es la resolución con la que el propio
 * documento escribe las masas de la siembra (`bioma.ts` las publica en
 * centésimos) y la que hace falta para que «el mismo fuego sin tapar» quiera
 * decir algo. Escrita sin `Math.abs` por gusto y no por regla —`Math.abs` está
 * permitido— para que la comparación se lea entera.
 */
export function masasIguales(a: number, b: number): boolean {
  const d = a - b
  return (d < 0 ? -d : d) < 0.005
}

/** El más liviano de un conjunto. `undefined` si el conjunto está vacío. */
export function elMasLiviano(xs: readonly Pesado[]): Pesado | undefined {
  let mejor: Pesado | undefined
  for (const x of xs) if (mejor === undefined || x.masa < mejor.masa) mejor = x
  return mejor
}

/** ¿Hay dos con masas distintas? Es «había una elección», dicho sin adjetivos. */
export function hayMasasDistintas(xs: readonly Pesado[]): boolean {
  const primera = xs[0]
  if (primera === undefined) return false
  for (const x of xs) if (x.masa !== primera.masa) return true
  return false
}

/**
 * EL TECHO DE LA FRICCIÓN: 0,7132 kg, y es el único número del documento que este
 * archivo escribe.
 *
 * Sale de que `stamina` topa en 1000 y no se repone sola, y está MEDIDO por los
 * dos lados: 0,7132 no prende un leño, 0,79 tampoco, 0,80 sí (§2.2, tabla corrida
 * en `world/tests/el-fuego-no-se-propaga.test.ts`). No existe ninguna función
 * exportada que devuelva el precio de encender un cuerpo —está declarado como
 * hueco del arnés en §1— así que este umbral no se puede preguntar: hay que
 * escribirlo.
 *
 * Y se escribe SÓLO acá, en un contra-detector, que es donde un número del
 * documento no decide nada: gobierna si un cero se lee como ausencia o como
 * no-medida, nunca si una secuencia apareció.
 */
export const TECHO_DE_LA_FRICCION = 0.7132

/**
 * ¿ESTE CUERPO, SI ARDIERA, QUÉ ENTREGARÍA? Se le pregunta al motor.
 *
 * Se arma una copia con la temperatura arriba de su punto de ignición y se lee
 * `emitsPower`, que es derivada: `step(T ≥ ignitionPoint) · fuelEnergy · mass ·
 * EMISSION_PER_FUEL`. El juez no escribe esa cuenta ni ninguna de sus tres
 * constantes — arma un cuerpo hipotético y deja que la calcule quien la tiene.
 */
export function potenciaSiArdiera(b: Body, phys: Physics): number {
  const ignicion = qualityOf(b, 'ignitionPoint', phys)
  const encendido: Body = { ...b, state: { ...b.state, temperature: ignicion + 1 } }
  return qualityOf(encendido, 'emitsPower', phys)
}

/**
 * ¿EL MUNDO DEJÓ TIRADO CON QUÉ ARMAR LA CADENA DEL FARDO?
 *
 * Es el contra-detector más exigente de la lista (§4, entrada 7) y el único que
 * no se puede contestar mirando piezas: la Regla 7 —«medir el catálogo no es
 * medir el mundo, y medir las piezas sueltas tampoco»— salió justamente de haber
 * declarado imposible una técnica que sale con dos piezas atadas.
 *
 * Hacen falta tres cosas a la vez y las tres se le preguntan al motor:
 *
 *   1. una VARA que cumpla el rol `a` de `friccion` y quepa en el tanque —o sea
 *      que pese menos que el techo—;
 *   2. un ATADOR que cumpla el rol `binder` de `union`;
 *   3. dos piezas de combustible que, ATADAS POR `unir`, den un fardo cuyo punto
 *      de ignición la vara alcance por contacto.
 *
 * Lo que NO se hace acá, y es la mitad del punto: no se suman masas, no se
 * escribe el 0,893 kg de §2.3 y no se nombra ninguna sustancia. El fardo lo
 * construye `unir` y el «¿alcanza?» lo contesta `temperaturaDeEquilibrio` contra
 * el `ignitionPoint` que el ensamble tenga. Si mañana el dios siembra otra cosa
 * que arda a 250 °C, este contra-detector la encuentra sin que nadie lo toque.
 */
export function sePodiaArmarLaCadena(w: WorldState, centro: Placement): boolean {
  const criaturas = cuerposDeActores(w)
  const rolA = ROL_A_DE_FRICCION()
  const rolBinder = ROL_BINDER_DE_UNION()

  const aTiro: { id: string; masa: number; body: Body }[] = []
  for (const [id, c] of w.bodies) {
    if (criaturas.has(id) || !alAlcance(c.at, centro)) continue
    aTiro.push({ id, masa: qualityOf(c.body, 'mass', w.phys), body: c.body })
  }

  // LA VARA ES LA MEJOR DE LAS ENCENDIBLES, no la primera que aparece.
  //
  // Elegir «la primera del mapa» hacía que el contra-detector dependiera del
  // orden de los ids: una piedra de medio kilo cumple el rol `a` —`rigidity`
  // 0,95— y no tiene `fuelEnergy`, así que con la piedra llamándose antes que la
  // madera la respuesta era que no. El contra-detector tiene que contestar «¿el
  // mundo ofrecía la cadena?» y no «¿la ofrecía en orden alfabético?».
  let vara: { id: string; body: Body; entrega: number } | undefined
  for (const x of aTiro) {
    if (x.masa > TECHO_DE_LA_FRICCION || !cumpleRol(x.body, rolA, w.phys)) continue
    const entrega = temperaturaDeEquilibrio(potenciaSiArdiera(x.body, w.phys), 0, 'contacto')
    if (vara === undefined || entrega > vara.entrega || (entrega === vara.entrega && x.id < vara.id)) {
      vara = { id: x.id, body: x.body, entrega }
    }
  }
  if (vara === undefined) return false

  let atador: { id: string; body: Body } | undefined
  for (const x of aTiro) {
    if (x.id === vara.id || !cumpleRol(x.body, rolBinder, w.phys)) continue
    if (atador === undefined || x.id < atador.id) atador = { id: x.id, body: x.body }
  }
  if (atador === undefined) return false

  const combustibles = aTiro.filter(
    (x) => x.id !== vara.id && x.id !== atador.id && qualityOf(x.body, 'fuelEnergy', w.phys) > 0,
  )
  // Las dos más pesadas, con el id de desempate: dos piezas de la misma masa no
  // pueden dar dos respuestas distintas según en qué orden las recorrió el `Map`.
  combustibles.sort((x, y) => (y.masa !== x.masa ? y.masa - x.masa : x.id < y.id ? -1 : 1))
  const p1 = combustibles[0]
  const p2 = combustibles[1]
  if (p1 === undefined || p2 === undefined) return false
  const fardo = unir(p1.body, p2.body, atador.body, w.phys, 'fardo-hipotetico')
  if (fardo === undefined) return false
  return vara.entrega >= qualityOf(fardo, 'ignitionPoint', w.phys)
}
