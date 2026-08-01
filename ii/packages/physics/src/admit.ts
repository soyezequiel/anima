// ─── @anima/physics/admit.ts ─────────────────────────────────────────────────
//
// LA PUERTA. Es lo único que separa a Ánima de un chatbot que se inventa la
// realidad: un proceso propuesto —por el modelo, por el oráculo o por quien sea—
// no entra a la física porque suene bien, entra porque la aritmética cierra.
//
// Las cinco reglas del documento, y por qué cada una:
//
//   1. CONSERVACIÓN, y solo sobre las entradas CONSUMIDAS. Que una entrada se
//      consuma NO lo escribe quien propone: se DERIVA de si la salida hereda
//      masa de la entrada. Ésa era la bomba de materia de una línea — con un
//      campo `consume: false`, una entrada intacta contaba como aporte y la masa
//      se duplicaba en bucle.
//   2. NADA SUBE GRATIS. Bajar es libre. Subir declara de qué cuenta conservada
//      drena y con qué eficiencia ≤ 1. Sin esto, frotar dos piedras produce
//      calor infinito y el hambre deja de doler en el tick 300.
//   3. ENVOLVENTES POR TAG. Algo `organico` no puede tener el poder calorífico
//      del plutonio. Y las envolventes NO se escriben a mano: se derivan del
//      catálogo de sustancias, que es el único lugar donde ese número ya vive.
//   4. CIERRE DIMENSIONAL, COTAS DE RANGO, NO-DOMINANCIA, REALIZABILIDAD.
//   5. CICLOS RENTABLES. Ver la sección de la regla 5: acá hay un hallazgo, y
//      cambia lo que esta regla puede honestamente prometer.
//
// ─── Lo que siete adversarios encontraron, y qué se hizo ─────────────────────
//
// PRIMERA VUELTA. 62 procesos tirados contra esta puerta dejaron 39 huecos,
// agrupados en seis causas raíz. Están reparadas, y cada regla nueva lleva escrito
// ARRIBA el ataque que la motivó, porque dentro de seis meses alguien la va a
// querer sacar por molesta y va a necesitar saber qué entra si la saca.
//
// SEGUNDA VUELTA. Otros 70 procesos contra la puerta YA reparada dejaron 33 huecos,
// y esta vez uno de los adversarios buscó lo contrario que los demás: procesos
// HONESTOS que la puerta rebota. Ese lente encontró seis, y el peor de todos era que
// `comer` no se podía escribir — o sea que la criatura pescaba y no comía. De los
// 33, 30 están cerrados. Los tres que quedan van con su `it.fails` y con el ADR que
// haría falta anotado al lado; ver `ii/docs/la-puerta.md`.
//
// LAS DOS FORMAS DE EQUIVOCARSE NO SON SIMÉTRICAS, y toda esta segunda vuelta lo
// confirma: una puerta que deja pasar de más se endurece después, y una que no deja
// construir mata el juego. Por eso, cuando una reparación honesta no se podía hacer
// sin rechazar algo legítimo, se dejó el hueco anotado en vez de tapado. El ejemplo
// vivo es el calor específico: cobrarlo con el peor caso de cada lado cerraba el
// ataque Y rechazaba `asar`, así que se cobra solo cuando se puede AFIRMAR.
//
//   1. La regla 2 abría con `if (e.k !== 'drive') continue`: miraba un tercio de
//      los efectos. Un `couple` o un `transfer` subían lo que quisieran gratis.
//      → `reglaAcoplesYTransferencias`.
//   2. `transfer` miraba PRESENCIA y nunca CANTIDAD: al origen le alcanzaba con
//      garantizar «mayor que cero» para que le sacaran quinientos.
//      → la cota del rol es el techo. Ver `disponibleEn`.
//   3. INTENSIVA CONTRA EXTENSIVA, la más profunda, y `quality.ts` la tenía
//      escrita desde el primer día. → ver el bloque de intensivas más abajo.
//   4. Se podía escribir una cualidad DERIVADA. Una derivada no se escribe: se
//      deriva. → `esDerivada` y el bloque de `cualidad-derivada`.
//   5. Se acreditaba una conservada sin consumir nada y sin terminar nunca.
//      OJO: un proceso sin `completion` que solo GASTA es legítimo —`friccion` es
//      exactamente eso—, así que la regla es sobre lo que ACREDITA, no sobre
//      tener o no tener rendimientos.
//   6. Los metadatos no se miraban: id, nombre, radio del arreglo, compuerta
//      contradictoria, `trust` contra `provenance`, promesas que mienten, y un
//      rol de adorno que esquivaba la no-dominancia.
//
// Y las cinco causas de la segunda vuelta, cada una con su función:
//
//   7. TODA CUENTA SE HACÍA POR EFECTO Y NUNCA EN TOTAL. Lo que entra una vez
//      pagaba N veces con solo escribir N efectos, y ningún efecto mentía por su
//      cuenta. → el presupuesto acumulado de `reglaConservacion`.
//   8. LAS COTAS DEL ROL SE TOMABAN COMO INVARIANTES. `Role.where` se comprueba al
//      ENTRAR: el techo de masa se engordaba con un transfer, y el piso se usaba
//      para decidir dirección como si nadie lo tocara. → `techoEfectivo` y
//      `pisoParaDireccion`.
//   9. LO QUE ESCRIBE QUIEN PROPONE DECIDÍA SI LA REGLA MIRABA. Nombres de rol,
//      espacios en `establishes`, un operador unicode, `provenance`, un `establishes`
//      vacío: cinco evasiones de un carácter. → los roles se cruzan por lo que
//      piden, las promesas por lo que parsean, la confianza contra lo que la física
//      ya tiene sellado, y el grafo con lo que el proceso HACE.
//  10. `inverse` NO SE LEÍA. Cuatro líneas y toda la economía de herramientas se
//      cortocircuitaba. → `techoQueEscribeElAcople`.
//  11. NO HABÍA CONVERSIÓN ENTRE DOS CUENTAS CONSERVADAS, y sin ella el bucle
//      central del juego no se podía escribir. → `esConversionAdmisible`.
//
// LA REGLA DE ORO DE ESA REPARACIÓN, y es la que hay que respetar al tocar algo
// de acá: una puerta que rechaza todo es trivialmente segura y completamente
// inútil. Los cuatro procesos semilla —`friccion`, `union`, `deshilachar`,
// `extraccion`— tienen que seguir entrando sin una sola razón en contra. Si
// alguno deja de entrar, la regla nueva está mal, no el proceso.
//
// ─── Dos decisiones de forma que valen la pena decir ─────────────────────────
//
// NO CORTA EN EL PRIMER NO. El documento escribe `return no(...)` en cada regla.
// Acá se juntan TODAS las razones antes de contestar, porque el consumidor del
// veredicto es la fragua, que tiene que corregir: un rechazo por vez la obliga a
// N viajes al modelo para arreglar N errores que ya se conocían en el primero.
//
// EL VEREDICTO DICE EL NÚMERO. Cada `Razon` lleva la cualidad, lo que se
// encontró y la cota que se pedía. «Fuera de envolvente» no le sirve a nadie;
// «fuelEnergy 5000 contra 45 para `organico`» se puede corregir.
//
// Determinismo: acá no hay `Math.exp`, `Math.pow`, `Math.log`, `**`,
// `Math.random`, `Date`, `Intl`, `performance` ni `localeCompare`. Solo +, −, ×,
// ÷, comparaciones y `Math.min` / `Math.max` / `Math.round`, que ECMAScript sí
// especifica bit a bit. Todo recorrido es sobre arrays o sobre `Map` en orden de
// inserción, nunca sobre `Object.keys` de un vector de cualidades.

import { fx, HZ_DE_REFERENCIA, MICROS_POR_SEGUNDO } from './fixed.js'
import type { Physics } from './physics.js'
import { conservedIn, specIn } from './physics.js'
import type { QualityExpr, QualityId, QualitySpec } from './quality.js'
import type { Effect, Process, ProcessId, QualityTest, Role, Yield } from './process.js'
import { baseRoleName, unknownRoleRefs } from './process.js'
import type { Substance, SubstanceId, Tag } from './substance.js'

// ─── Constantes de la puerta ─────────────────────────────────────────────────

/**
 * Eficiencia máxima de un `poweredBy`. Es 1 y no puede ser otra cosa: sale menos
 * trabajo del que entra, o el proceso es una máquina de movimiento perpetuo.
 * Está acá como constante con nombre y no como un `> 1` suelto porque es la
 * desigualdad entera del principio 4 del paquete.
 */
export const MAX_EFFICIENCY = 1

/**
 * Cuánto se le permite a una sustancia nueva salirse de lo que la semilla midió
 * para su tag. Medio: el oráculo puede inventar algo la mitad más calórico que
 * lo más calórico que existe, no diez veces más.
 *
 * Es multiplicativo sobre el extremo y no sobre la dispersión a propósito. Con
 * dispersión, un tag donde todas las sustancias declaran el mismo número tendría
 * envolvente de ancho cero y ninguna sustancia nueva entraría jamás.
 */
export const ENVELOPE_SLACK = 0.5

/**
 * Cuántas sustancias hacen falta para que un par (tag, cualidad) tenga
 * envolvente. Con una sola muestra no hay envolvente: hay una anécdota, y
 * rechazar contra una anécdota es escribir la tabla a mano con otro nombre.
 */
export const MIN_ENVELOPE_SAMPLES = 2

/**
 * La UNIDAD DE CUENTA de la puerta: la ventana con la que juzga un proceso que
 * NO declara `completion`. Vale 0,05 s, que es un tick de la frecuencia de
 * referencia.
 *
 * Un proceso sin final no tiene corrida —corre mientras el arreglo se sostenga—
 * y la puerta compara CANTIDADES POR CORRIDA, así que sin una ventana declarada
 * no hay nada que comparar. `friccion` es exactamente ese caso: frotar no
 * termina, termina la criatura.
 *
 * ─── Por qué VALE ESO Y NO «un segundo», que es lo que uno escribiría ───────
 *
 * Porque es la ventana con la que se cerraron los 62 huecos, y este número
 * decide veredictos. Toda la aritmética de esta puerta es `tasa × duración`; el
 * ADR II-0008 multiplicó las tasas por la frecuencia de referencia y dividió las
 * duraciones por ella, así que el producto NO SE MUEVE para ningún proceso que
 * declare `completion`. Para los que no la declaran, el producto lo fija ESTA
 * ventana, y solo un tick de referencia lo deja donde estaba.
 *
 * MEDIDO, y en las dos direcciones: con la ventana en un segundo, `friccion`
 * pasa a juzgarse por 120 grados en vez de 6, el ciclo
 * `frotar → piedra-batería → frotar` deja de dar positivo y la regla 5 se apaga
 * sola — tres huecos cerrados que se reabren. Con la ventana en un tick pero sin
 * reescalar los procesos de los adversarios, se abren otros cinco por el lado
 * contrario. Las dos mitades van juntas o no van.
 *
 * ─── Y esto es lo ÚNICO de la puerta que mira la frecuencia ─────────────────
 *
 * No es física: es la unidad en la que el juez cuenta. La física de este paquete
 * no tiene ticks. Subir esta ventana endurece la puerta y bajarla la afloja, y
 * las dos cosas hay que MEDIRLAS contra los 132 procesos de los siete
 * adversarios antes de tocarla — no razonarlas.
 */
export const VENTANA_SIN_FINAL = 1 / HZ_DE_REFERENCIA

/** Tope de ciclos enumerados por llamada. El grafo es chico; esto es un cinturón. */
const MAX_CYCLES = 64

/**
 * Tope de aristas recorridas al enumerar ciclos. Enumerar caminos simples es
 * exponencial en el peor caso y el grafo crece con cada proceso que la criatura
 * aprende: sin presupuesto, la puerta se cuelga en vez de contestar. Cuando se
 * agota, el veredicto lo DICE (`ciclo-busqueda-truncada`) en vez de fingir que
 * miró todo.
 *
 * Medido, y son los dos números que la auditoría le reclamaba a los «~5 ms» de
 * la regla 5: sobre la semilla, `admit` entero cuesta 0.014 ms; sobre un grafo
 * denso de 80 procesos, 4.5 ms; y en el peor caso —30 procesos completamente
 * conectados a los que se entra y de los que no se vuelve, o sea 30! caminos
 * simples y ni un solo ciclo— 7.4 ms y sale avisando que se cortó.
 */
const MAX_STEPS = 200000

// ─── El veredicto ────────────────────────────────────────────────────────────

export type Regla = 1 | 2 | 3 | 4 | 5

export type Codigo =
  // regla 1 — conservación
  | 'conservacion-drive'
  | 'conservacion-couple'
  | 'conservacion-transfer'
  | 'materia-sin-origen'
  | 'tasa-negativa'
  | 'magnitud-intensiva'
  // regla 2 — nada sube gratis
  | 'sube-gratis'
  | 'fuente-no-conservada'
  | 'eficiencia'
  | 'fuente-sin-respaldo'
  // regla 3 — envolventes por tag
  | 'fuera-de-envolvente'
  | 'envolvente-por-abajo'
  // regla 4 — cierre dimensional, cotas, no-dominancia, realizabilidad
  | 'cualidad-fuera-del-catalogo'
  | 'cualidad-derivada'
  | 'cualidad-de-estado'
  | 'numero-no-finito'
  | 'fuera-de-rango'
  | 'acople-inconmensurable'
  | 'rol-desconocido'
  | 'rol-repetido'
  | 'sin-roles'
  | 'rol-contradictorio'
  | 'rol-irrealizable'
  | 'completion-invalida'
  | 'completion-sin-rendimientos'
  | 'version-de-fisica'
  | 'id-repetido'
  | 'dominancia'
  | 'sin-tags'
  | 'sin-nombre'
  | 'calor-especifico'
  | 'compuerta-contradictoria'
  | 'confianza-autodeclarada'
  | 'promesa-derivada'
  | 'transferencia-eterna'
  // regla 4 — el plano (Gate 5→6): las cotas del ensamble y la forma del grafo
  | 'partes-fuera-de-cota'
  | 'juntas-fuera-de-cota'
  | 'junta-reflexiva'
  // regla 4 — la OBRA contra el plano (tramo F). Son dos y no una porque son dos
  // fracasos distintos: la obra puede estar mal ATADA aunque cada pieza sirva, y
  // puede estar bien atada con la pieza equivocada adentro.
  | 'obra-no-es-el-plano'
  | 'pieza-no-cumple'
  // Y la quinta que salio de escribir el constructor: un rol que ata su propia
  // junta y ademas es pieza en otra. Ver la demostracion en `plano.ts`.
  | 'atador-que-no-es-punta'
  // regla 5 — ciclos
  | 'ciclo-rentable'
  | 'ciclo-con-aporte'
  | 'ciclo-busqueda-truncada'
  // advertencias que no cierran la puerta
  | 'costo-mayor-que-la-garantia'
  | 'tasa-mayor-que-el-rango'
  | 'drenaje-sin-respaldo'
  | 'promesa-sin-respaldo'

/** Lo que hay que poder citar para que el rechazo sea corregible. */
export interface Cita {
  q?: QualityId
  rol?: string
  proceso?: ProcessId
  sustancia?: SubstanceId
  tag?: Tag
  /** El número que se midió. */
  encontrado?: number
  /** El número que se permitía. */
  cota?: number
}

export interface Razon extends Cita {
  regla: Regla
  codigo: Codigo
  /** En castellano, con la cualidad y los dos números. La fragua lee esto. */
  mensaje: string
}

export interface Verdict {
  ok: boolean
  /** Vacío si `ok`. Cada una cierra la puerta por su cuenta. */
  razones: readonly Razon[]
  /** Cosas raras que no cierran la puerta. Ver la regla 5. */
  advertencias: readonly Razon[]
}

function razon(regla: Regla, codigo: Codigo, mensaje: string, cita: Cita = {}): Razon {
  return { regla, codigo, mensaje, ...cita }
}

/** El veredicto entero como texto. Para el log del juez y para el reporte. */
export function porQue(v: Verdict): string {
  const linea = (r: Razon): string => `  [regla ${r.regla} · ${r.codigo}] ${r.mensaje}`
  const partes: string[] = [v.ok ? 'ADMITIDO' : 'RECHAZADO']
  for (const r of v.razones) partes.push(linea(r))
  if (v.advertencias.length > 0) partes.push('  — con reparos:')
  for (const r of v.advertencias) partes.push(linea(r))
  return partes.join('\n')
}

/**
 * Redondeo para los mensajes. `Math.round` está especificado bit a bit; lo que
 * está prohibido son las trascendentes. Y nada de `toLocaleString`, que depende
 * del locale y haría que el mismo rechazo se escriba distinto en dos máquinas.
 */
function num(v: number): string {
  if (!Number.isFinite(v)) return String(v)
  return String(Math.round(v * 1000) / 1000)
}

// ─── Lecturas del catálogo ───────────────────────────────────────────────────

function spec(phys: Physics, q: QualityId): QualitySpec | undefined {
  return specIn(phys, q)
}

function esConservada(phys: Physics, q: QualityId): boolean {
  return spec(phys, q)?.conserved === true
}

function span(phys: Physics, q: QualityId): number {
  const s = spec(phys, q)
  if (s === undefined) return 0
  return s.range[1] - s.range[0]
}

function rolDe(p: Process, name: string): Role | undefined {
  for (const r of p.roles) if (r.name === name) return r
  return undefined
}

export interface Cotas {
  lo: number
  hi: number
}

/**
 * Lo que el proceso GARANTIZA sobre una cualidad de un rol, antes de mirar el
 * mundo. Es la única cota estática honesta: el rol dice `stamina >= 1`, así que
 * de ese rol se puede contar con 1 y ni un gramo más.
 *
 * Sin rol o sin cualidad en el catálogo, el rango entero: no se sabe nada.
 */
export function cotasDeRol(r: Role | undefined, q: QualityId, phys: Physics): Cotas {
  const s = spec(phys, q)
  let lo = s === undefined ? Number.NEGATIVE_INFINITY : s.range[0]
  let hi = s === undefined ? Number.POSITIVE_INFINITY : s.range[1]
  if (r === undefined) return { lo, hi }
  for (const t of r.where) {
    if (t.q !== q) continue
    if (t.op === '>=' || t.op === '>') {
      if (t.v > lo) lo = t.v
    } else if (t.v < hi) hi = t.v
  }
  return { lo, hi }
}

/**
 * Las mismas cotas, pero SIN colapsar `>` en `>=` ni `<` en `<=`.
 *
 * ATAQUE QUE LA MOTIVÓ: «compuerta-estricta». `cotasDeRol` mete los cuatro
 * operadores en dos cotas cerradas, así que `q >= 400 && q < 400` daba
 * `lo === hi === 400` y la única prueba que existía —`lo > hi`— contestaba que no
 * había contradicción. El proceso queda en el índice y no se dispara JAMÁS, que es
 * exactamente el fallo silencioso que `rol-contradictorio` existe para evitar. Y
 * sobre `stamina` —que ninguna sustancia declara, y que es la cualidad del rol
 * `actor` de todo proceso que la criatura ejecuta— no hay ninguna red abajo.
 */
interface CotasEstrictas extends Cotas {
  /** El piso vino de un `>`: el valor exacto NO lo cumple. */
  loAbierto: boolean
  hiAbierto: boolean
}

function cotasEstrictasDeRol(r: Role | undefined, q: QualityId, phys: Physics): CotasEstrictas {
  const s = spec(phys, q)
  let lo = s === undefined ? Number.NEGATIVE_INFINITY : s.range[0]
  let hi = s === undefined ? Number.POSITIVE_INFINITY : s.range[1]
  let loAbierto = false
  let hiAbierto = false
  if (r === undefined) return { lo, hi, loAbierto, hiAbierto }
  for (const t of r.where) {
    if (t.q !== q) continue
    if (t.op === '>=' || t.op === '>') {
      if (t.v > lo) {
        lo = t.v
        loAbierto = t.op === '>'
      } else if (t.v === lo && t.op === '>') loAbierto = true
    } else if (t.v < hi) {
      hi = t.v
      hiAbierto = t.op === '<'
    } else if (t.v === hi && t.op === '<') hiAbierto = true
  }
  return { lo, hi, loAbierto, hiAbierto }
}

/** No existe ningún número que cumpla estas cotas. */
function cotasVacias(c: CotasEstrictas): boolean {
  return c.lo > c.hi || (c.lo === c.hi && (c.loAbierto || c.hiAbierto))
}

/** El rol promete que esta cualidad es estrictamente positiva en quien lo llene. */
function garantizaPositivo(r: Role | undefined, q: QualityId): boolean {
  if (r === undefined) return false
  for (const t of r.where) {
    if (t.q !== q) continue
    if (t.op === '>' && t.v >= 0) return true
    if (t.op === '>=' && t.v > 0) return true
  }
  return false
}

// ─── Intensiva contra extensiva · el producto por masa ───────────────────────
//
// LA CAUSA MÁS PROFUNDA, y `quality.ts` la tenía escrita desde el primer día con
// todas las letras: «la regla 1 de admit() tiene que comparar el producto;
// comparar el intensivo dejaría pasar una bomba de materia». Nadie la leyó.
//
// `nutrition` y `fuelEnergy` viven en `Substance.perUnitMass`: el número es POR
// UNIDAD DE MASA. Conservar el número NO conserva el total. Medido con el propio
// `qualityOf` del paquete: mover 9 de `nutrition` de un trocito de masa 0.1 a un
// tronco de masa 100 va de 0.315 calorías a 18. Multiplica por 57.
//
// Entonces toda comparación de conservación se hace sobre la magnitud EXTENSIVA,
// que para una intensiva es `q · masa`. Y cuando la masa del rol no está acotada
// por ninguna cota, la respuesta correcta es RECHAZAR por indecidible: un proceso
// que no se puede juzgar no entra.

function esIntensiva(phys: Physics, q: QualityId): boolean {
  return spec(phys, q)?.extent === 'intensive'
}

/**
 * ¿Esta cualidad se CALCULA en vez de guardarse?
 *
 * UNA SOLA PREGUNTA para toda la puerta (ADR II-0006). Antes había dos —ésta y
 * `spec.derived !== undefined`— porque `heatCapacity` era derivada sin
 * expresión, y quien preguntara por el campo la dejaba escribible. Desde que la
 * gramática tiene el nodo `substance`, las ocho derivadas llevan expresión y las
 * dos preguntas son la misma. Sigue siendo una función y no el campo pelado para
 * que haya UN lugar donde cambiarla si alguna vez vuelve a haber una excepción.
 */
function esDerivada(phys: Physics, q: QualityId): boolean {
  return spec(phys, q)?.derived !== undefined
}

/**
 * La masa que el rol GARANTIZA. Es la cota honesta por abajo: sin un `mass >= x`
 * en el rol no se puede contar con ningún gramo. Se usa para lo que ENTRA y para
 * lo que un origen puede dar.
 */
function masaGarantizada(r: Role | undefined, phys: Physics): number {
  const c = cotasDeRol(r, 'mass', phys)
  return Number.isFinite(c.lo) && c.lo > 0 ? c.lo : 0
}

/**
 * La masa MÁXIMA que el rol admite, o `undefined` si nadie la acota.
 *
 * El rango del catálogo —`mass ∈ [0, 10000]`— NO cuenta como cota: es el límite
 * del mundo, no algo que el proceso declare. Multiplicar por diez mil daría un
 * rechazo con un número inventado; decir «acá no se puede saber cuánto es» es la
 * verdad, y además es corregible: la fragua le agrega `mass <= x` al rol.
 */
function masaMaxima(r: Role | undefined): number | undefined {
  if (r === undefined) return undefined
  let hi: number | undefined
  for (const t of r.where) {
    if (t.q !== 'mass') continue
    if (t.op !== '<=' && t.op !== '<') continue
    if (hi === undefined || t.v < hi) hi = t.v
  }
  return hi
}

/**
 * Por cuánta masa hay que multiplicar el trabajo hecho sobre una cualidad para
 * que el costo esté en la misma moneda que la cuenta conservada que lo paga.
 *
 * ATAQUE QUE LA MOTIVÓ: «frotar la montaña». La energía de subir un grado es
 * `masa · calor específico · ΔT`, así que calentar un peñasco de masa 5000 cuesta
 * cinco mil veces lo que calentar un guijarro — y las dos cosas costaban 17.14 de
 * stamina, porque el trabajo se medía en grados y los grados no saben de masa.
 *
 * SEGUNDO ATAQUE: «frotar-la-montania-v2». La primera versión cobraba por la masa
 * GARANTIZADA (`mass >= x`), y nadie escribe eso en el rol que quiere calentar: con
 * `mass <= 10000` —el rango entero del mundo— el rol admitía peñascos y pagaba por
 * una unidad. La cota que el juez usaba para cobrar era justo la que el proponente
 * elige no escribir. Para COBRAR, la cota honesta es la del PEOR caso: el TECHO,
 * el mismo que `revisarIntensiva` usa para lo que se escribe.
 *
 * Sin ninguna cota de masa se cobra por UNA unidad. Es una subestimación DECLARADA,
 * no un olvido: cobrar por el máximo del RANGO mataría a `friccion` —cuyo rol no
 * acota nada—, que es el primer fuego de la partida.
 */
function masaQuePaga(r: Role | undefined, q: QualityId, phys: Physics): number {
  if (!esIntensiva(phys, q)) return 1
  const techo = masaMaxima(r)
  const piso = masaGarantizada(r, phys)
  const m = techo === undefined ? piso : Math.max(techo, piso)
  return m > 1 ? m : 1
}

/**
 * El techo REAL de la masa de un rol mientras el proceso corre.
 *
 * ATAQUE QUE LA MOTIVÓ: «el-techo-no-es-invariante». `Role.where` es una condición
 * de ENTRADA —la puerta ya lo aprendió del otro lado, con `pisoEfectivo`— y el
 * techo de masa no tenía su gemelo: se declaraba `mass <= 1` para que la cuenta de
 * la intensiva cerrara clavada, y por la puerta de al lado se le transferían 100 de
 * masa al mismo cuerpo. Termina pesando 101 con la nutrición de un cuerpo de 1.
 */
function techoEfectivo(p: Process, rol: string, phys: Physics): number | undefined {
  const base = masaMaxima(rolDe(p, rol))
  if (base === undefined) return undefined
  let extra = 0
  for (const e of p.effects) {
    if (e.k === 'transfer' && e.q === 'mass' && e.to === rol) extra += movidoPor(p, e)
    if (e.k === 'drive' && e.q === 'mass' && e.on === rol) {
      const t = trabajoDe(p, e, phys)
      if (t > 0) extra += t
    }
  }
  return base + extra
}

/**
 * El piso REAL de una cualidad en un rol mientras el proceso corre.
 *
 * ATAQUE QUE LA MOTIVÓ: el recargador de aliento invisible. `Role.where` es una
 * condición de ENTRADA, no un invariante: se comprueba al empezar y nadie la
 * sostiene después. Un rol que pide `stamina >= 50`, un `drain` de 1 por tick y
 * un `drive` hacia 50 gasta 1 y recupera 10 — y las reglas 1 y 2 lo saltearon las
 * dos, por la misma línea escrita dos veces (`if (e.toward <= lo) continue`),
 * leyendo como «esto baja» lo que en el mundo sube.
 *
 * Así que el umbral del rol solo vale como piso si el proceso no se lo lleva por
 * abajo él mismo. Si se lo lleva, el piso es el del catálogo.
 */
function pisoEfectivo(p: Process, q: QualityId, rol: string, phys: Physics): number {
  for (const e of p.effects) {
    const seLoLleva =
      (e.k === 'drain' && e.q === q && e.on === rol) ||
      (e.k === 'transfer' && e.q === q && e.from === rol)
    if (seLoLleva) {
      const s = spec(phys, q)
      return s === undefined ? Number.NEGATIVE_INFINITY : s.range[0]
    }
  }
  return cotasDeRol(rolDe(p, rol), q, phys).lo
}

/**
 * El piso que se usa para decidir SI ESTO SUBE O BAJA, que no es el mismo que se
 * usa para medir CUÁNTO.
 *
 * ATAQUE QUE LA MOTIVÓ, y es del lente opuesto —un falso rechazo—: «apagar la
 * brasa». `pisoEfectivo` tira el umbral del rol entero y vuelve al piso del
 * catálogo apenas el proceso se lleve la cualidad. Apagar una brasa en el agua hace
 * las dos cosas a la vez: le mueve el calor al agua Y la deja a 20 °C. Con el piso
 * del catálogo en −100, `toward: 20` se leía como una SUBIDA de 120 grados y la
 * puerta pedía un `poweredBy` para enfriar. Enfriarse es lo que hace el mundo solo
 * cada tick.
 *
 * La cota honesta no es «tirar el piso», es BAJARLO por lo que el proceso se lleva:
 * el rol garantiza 300 y el proceso saca 200, así que abajo de 100 no puede estar.
 * El recargador de aliento —el ataque que escribió `pisoEfectivo`— sigue cayendo:
 * pide `stamina >= 50`, drena 10 en la corrida y empuja hacia 50, o sea por encima
 * de los 40 que le quedan garantizados.
 *
 * Sin `completion` el efecto que se la lleva corre para siempre: ahí sí, el piso es
 * el del catálogo.
 */
function pisoParaDireccion(p: Process, q: QualityId, rol: string, phys: Physics): number {
  const s = spec(phys, q)
  const suelo = s === undefined ? Number.NEGATIVE_INFINITY : s.range[0]
  const declarado = cotasDeRol(rolDe(p, rol), q, phys).lo
  const duracion = p.completion?.at
  let seLleva = 0
  for (const e of p.effects) {
    const quita =
      (e.k === 'drain' && e.q === q && e.on === rol) ||
      (e.k === 'transfer' && e.q === q && e.from === rol)
    if (!quita) continue
    if (duracion === undefined) return suelo
    seLleva += (e.k === 'drain' || e.k === 'transfer' ? e.porSegundo : 0) * duracion
  }
  if (seLleva <= 0) return declarado
  const piso = declarado - seLleva
  return piso < suelo ? suelo : piso
}

/**
 * Las cualidades GUARDADAS de las que se calcula una derivada, y si además
 * depende de la geometría. Sirve para saber qué puede establecer honestamente un
 * proceso: `reach` es geometría pura y solo la mueve un rendimiento; `solid` sale
 * de `rigidity`, así que un `drive` de rigidez sí la establece.
 *
 * El nodo `substance` (ADR II-0006) no aporta ninguna de las dos cosas: leer el
 * calor específico de la materia no es leer una cualidad guardada ni es
 * geometría. Un proceso que promete más `heatCapacity` la establece moviendo la
 * MASA —que sí es una entrada— o cambiando de qué está hecho el cuerpo, y eso
 * último solo lo hace un rendimiento.
 */
function entradasDeDerivada(e: QualityExpr | undefined): {
  qualities: ReadonlySet<QualityId>
  geometrica: boolean
} {
  const qualities = new Set<QualityId>()
  let geometrica = false
  const caminar = (x: QualityExpr): void => {
    switch (x.k) {
      case 'const':
      case 'substance':
        return
      case 'own':
      case 'sumParts':
      case 'maxParts':
        qualities.add(x.q)
        return
      case 'geom':
        geometrica = true
        return
      case 'op':
        caminar(x.a)
        caminar(x.b)
        return
    }
  }
  if (e !== undefined) caminar(e)
  return { qualities, geometrica }
}

// ─── Qué sustancia puede llenar qué rol ──────────────────────────────────────

interface Indice {
  /** Cualidades que alguna sustancia del catálogo declara en `perUnitMass`. */
  deSustancia: ReadonlySet<QualityId>
  /** Sustancias en orden de inserción del `Map`, para recorridos reproducibles. */
  sustancias: readonly Substance[]
  envolventes: ReadonlyMap<Tag, ReadonlyMap<EnvelopeKey, Envelope>>
}

const INDICE = new WeakMap<Physics, Indice>()

function indiceDe(phys: Physics): Indice {
  const cache = INDICE.get(phys)
  if (cache !== undefined) return cache
  const sustancias: Substance[] = []
  for (const s of phys.substances.values()) sustancias.push(s)
  // Se recorre `phys.qualities` (array, orden del catálogo) y no las claves de
  // los vectores: el orden de `Object.keys` depende de cómo se escribió cada
  // objeto, y eso es exactamente la clase de cosa que hace divergir un replay.
  const deSustancia = new Set<QualityId>()
  for (const qs of phys.qualities) {
    for (const s of sustancias) {
      if (s.perUnitMass[qs.id] !== undefined) {
        deSustancia.add(qs.id)
        break
      }
    }
  }
  const armado: Indice = { deSustancia, sustancias, envolventes: construirEnvolventes(phys, sustancias) }
  INDICE.set(phys, armado)
  return armado
}

/**
 * Las sustancias del catálogo que podrían llenar este rol.
 *
 * Solo se miran los tests sobre cualidades que una SUSTANCIA puede aportar: los
 * de `mass`, `stamina`, `reach` o `catch` no dicen nada de la materia (son
 * geometría, o son la criatura, o son estado del cuerpo) y se saltean. Un rol
 * cuyos tests son todos de ésos acepta cualquier sustancia, que es la verdad.
 *
 * Aproximación declarada: se compara contra `perUnitMass`, o sea contra el valor
 * por unidad de masa. Para las intensivas es exacto; para `nutrition` y
 * `fuelEnergy` un cuerpo grande da más que el número de la tabla, así que la
 * candidatura es CONSERVADORA por abajo y nunca inventa candidatos.
 */
export function candidatasDeRol(r: Role, phys: Physics): readonly Substance[] {
  const idx = indiceDe(phys)
  const out: Substance[] = []
  for (const s of idx.sustancias) {
    let sirve = true
    for (const t of r.where) {
      if (spec(phys, t.q) === undefined || esDerivada(phys, t.q)) continue
      if (!idx.deSustancia.has(t.q)) continue
      const v = s.perUnitMass[t.q] ?? 0
      if (!cumple(v, t)) {
        sirve = false
        break
      }
    }
    if (sirve) out.push(s)
  }
  return out
}

function cumple(v: number, t: QualityTest): boolean {
  switch (t.op) {
    case '>=':
      return v >= t.v
    case '<=':
      return v <= t.v
    case '>':
      return v > t.v
    case '<':
      return v < t.v
  }
}

/**
 * ¿Este rol dice de qué está HECHO el cuerpo que lo llena?
 *
 * Un rol que pide `rigidity >= 0.5` está pidiendo una piedra, una vara o un
 * hueso: pin­cha la materia. Uno que solo pide `stamina >= 1` no dice nada del
 * material, y por eso lo puede llenar la criatura.
 */
function pinaLaMateria(r: Role, phys: Physics): boolean {
  const idx = indiceDe(phys)
  for (const t of r.where) {
    if (spec(phys, t.q) === undefined || esDerivada(phys, t.q)) continue
    if (idx.deSustancia.has(t.q)) return true
  }
  return false
}

/** ¿De este rol se puede SACAR esta cualidad conservada, o sería sacarla de la nada? */
function respalda(r: Role | undefined, q: QualityId, phys: Physics): boolean {
  // La masa la tiene todo cuerpo por definición: un cuerpo de masa cero no es un
  // cuerpo. No hace falta que ningún rol la prometa. (CUÁNTA masa es otra
  // pregunta, y la contesta la cota del rol: ver `conservacion-transfer`.)
  if (q === 'mass') return true
  if (r === undefined) return false
  const idx = indiceDe(phys)
  if (garantizaPositivo(r, q)) {
    if (idx.deSustancia.has(q)) return true
    // ATAQUE QUE LA MOTIVÓ: la piedra-batería con una línea más. `stamina` no la
    // declara ninguna sustancia —es la criatura, no el material—, así que el
    // único respaldo posible es que el rol la pida. Y entonces alcanzaba con
    // escribirle `stamina >= 100` al rol de una PIEDRA para que el trabajo
    // saliera «pagado»: el calor gratis con la declaración puesta, que es
    // textualmente lo que `fuente-sin-respaldo` promete impedir.
    //
    // Un rol que además dice de qué está hecho el cuerpo ya eligió: una piedra no
    // tiene aliento por mucho que el rol se lo escriba.
    return !pinaLaMateria(r, phys)
  }
  if (!idx.deSustancia.has(q)) return false
  const cands = candidatasDeRol(r, phys)
  if (cands.length === 0) return false
  // TODAS y no ALGUNA: el respaldo tiene que ser una garantía. Si una sola
  // sustancia que puede llenar el rol trae la cualidad en cero, existe un mundo
  // donde el proceso saca de donde no hay — y ése es el mundo que hay que negar.
  for (const s of cands) if ((s.perUnitMass[q] ?? 0) <= 0) return false
  return true
}

// ─── Regla 3 · las envolventes, derivadas y no escritas ──────────────────────

export type EnvelopeKey = QualityId | 'specificHeat'

export interface Envelope {
  lo: number
  hi: number
  /** Cuántas sustancias del catálogo la sostienen. Menos de dos: no hay envolvente. */
  muestras: number
}

function construirEnvolventes(
  phys: Physics,
  sustancias: readonly Substance[],
): ReadonlyMap<Tag, ReadonlyMap<EnvelopeKey, Envelope>> {
  const claves: EnvelopeKey[] = []
  for (const qs of phys.qualities) if (!esDerivada(phys, qs.id)) claves.push(qs.id)
  // `specificHeat` es campo de la sustancia y no una cualidad, así que no sale
  // del recorrido de arriba — pero SÍ tiene envolvente por tag, porque el oráculo
  // puede inventar una sustancia con un calor específico absurdo y la ley 1
  // divide por él. Desde el ADR II-0006 hay además un nodo de `QualityExpr` que
  // lo lee; la envolvente es lo que impide que ese nodo devuelva cualquier cosa.
  claves.push('specificHeat')

  const porTag = new Map<Tag, Map<EnvelopeKey, Envelope>>()
  for (const s of sustancias) {
    for (const tag of s.tags) {
      let m = porTag.get(tag)
      if (m === undefined) {
        m = new Map<EnvelopeKey, Envelope>()
        porTag.set(tag, m)
      }
      for (const k of claves) {
        const v = k === 'specificHeat' ? s.specificHeat : s.perUnitMass[k]
        if (v === undefined || !Number.isFinite(v)) continue
        const e = m.get(k)
        if (e === undefined) m.set(k, { lo: v, hi: v, muestras: 1 })
        else m.set(k, { lo: Math.min(e.lo, v), hi: Math.max(e.hi, v), muestras: e.muestras + 1 })
      }
    }
  }

  const salida = new Map<Tag, ReadonlyMap<EnvelopeKey, Envelope>>()
  for (const [tag, m] of porTag) {
    const abierta = new Map<EnvelopeKey, Envelope>()
    for (const [k, e] of m) {
      if (e.muestras < MIN_ENVELOPE_SAMPLES) continue
      let hi = e.hi > 0 ? e.hi * (1 + ENVELOPE_SLACK) : e.hi
      let lo = e.lo > 0 ? e.lo * (1 - ENVELOPE_SLACK) : e.lo
      if (k !== 'specificHeat') {
        const sp = spec(phys, k)
        if (sp !== undefined) {
          if (hi > sp.range[1]) hi = sp.range[1]
          if (lo < sp.range[0]) lo = sp.range[0]
        }
      }
      abierta.set(k, { lo, hi, muestras: e.muestras })
    }
    salida.set(tag, abierta)
  }
  return salida
}

/**
 * Las envolventes por tag, derivadas del catálogo de sustancias. Memorizadas por
 * objeto `Physics`, así que una recalibración —que produce una `Physics` nueva—
 * las recalcula sola y no queda una envolvente vieja contestando.
 */
export function tagEnvelopes(phys: Physics): ReadonlyMap<Tag, ReadonlyMap<EnvelopeKey, Envelope>> {
  return indiceDe(phys).envolventes
}

/**
 * La envolvente que le toca a algo con estos tags: la UNIÓN de las de sus tags.
 * Unión y no intersección porque los tags no son excluyentes —el hueso es
 * `organico` y `mineral` a la vez— y la clase más permisiva es la que manda:
 * rechazar al hueso por no parecerse a la carne sería un error de la puerta.
 */
export function envolventeDe(
  phys: Physics,
  tags: readonly Tag[],
  k: EnvelopeKey,
): Envelope | undefined {
  const todas = tagEnvelopes(phys)
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  let muestras = 0
  for (const tag of tags) {
    const e = todas.get(tag)?.get(k)
    if (e === undefined) continue
    lo = Math.min(lo, e.lo)
    hi = Math.max(hi, e.hi)
    muestras += e.muestras
  }
  if (muestras === 0) return undefined
  return { lo, hi, muestras }
}

// ─── La puerta de las sustancias ─────────────────────────────────────────────

/**
 * La regla 3 en su hábitat: una sustancia que el oráculo o el modelo inventan.
 *
 * Está acá y no en `substance.ts` porque es un JUEZ, no un dato, y porque es la
 * misma envolvente que usa `admit()` para los `drive`. Que vivan juntas es lo
 * que impide que dos números digan lo mismo distinto.
 */
export function admitSubstance(s: Substance, phys: Physics): Verdict {
  const razones: Razon[] = []
  const advertencias: Razon[] = []

  if (s.id.length === 0) razones.push(razon(4, 'sin-nombre', 'la sustancia no tiene id'))
  if (s.lexeme.nombre.length === 0)
    razones.push(razon(4, 'sin-nombre', `la sustancia ${s.id} no tiene nombre`, { sustancia: s.id }))
  if (s.tags.length === 0) {
    // Sin tag no la agarra ninguna ley: no arde, no se pudre, no se cocina. Es
    // materia invisible para la física, y eso no es una sustancia.
    razones.push(
      razon(4, 'sin-tags', `la sustancia ${s.id} no declara ningún tag: ninguna ley la alcanza`, {
        sustancia: s.id,
      }),
    )
  }

  if (!Number.isFinite(s.specificHeat) || s.specificHeat <= 0) {
    razones.push(
      razon(
        4,
        'calor-especifico',
        `${s.id}: specificHeat ${num(s.specificHeat)}; la ley 1 divide por él y cero es una división por cero`,
        { sustancia: s.id, encontrado: s.specificHeat, cota: 0 },
      ),
    )
  }

  for (const qs of phys.qualities) {
    const v = s.perUnitMass[qs.id]
    if (v === undefined) continue
    revisarValorDeSustancia(s, qs.id, v, qs, phys, razones, advertencias)
  }

  // Cualquier cualidad del vector que el catálogo no conozca. Se recorre el
  // vector una sola vez y para esto: una cualidad inventada es un dato que
  // ninguna ley va a leer nunca, y el silencio es peor que el rechazo.
  for (const k of Object.keys(s.perUnitMass)) {
    const q = k as QualityId
    if (spec(phys, q) === undefined) {
      razones.push(
        razon(4, 'cualidad-fuera-del-catalogo', `${s.id} declara «${k}», que no está en el catálogo`, {
          sustancia: s.id,
        }),
      )
    }
  }

  const env = envolventeDe(phys, s.tags, 'specificHeat')
  if (env !== undefined && s.specificHeat > env.hi) {
    razones.push(
      razon(
        3,
        'fuera-de-envolvente',
        `${s.id}: specificHeat ${num(s.specificHeat)} contra ${num(env.hi)} para ${s.tags.join('+')}`,
        { sustancia: s.id, encontrado: s.specificHeat, cota: env.hi },
      ),
    )
  }

  return { ok: razones.length === 0, razones, advertencias }
}

function revisarValorDeSustancia(
  s: Substance,
  q: QualityId,
  v: number,
  sp: QualitySpec,
  phys: Physics,
  razones: Razon[],
  advertencias: Razon[],
): void {
  if (!Number.isFinite(v)) {
    razones.push(
      razon(4, 'numero-no-finito', `${s.id}: ${q} vale ${String(v)}`, { sustancia: s.id, q }),
    )
    return
  }
  if (esDerivada(phys, q)) {
    razones.push(
      razon(4, 'cualidad-derivada', `${s.id} declara ${q}, que es derivada y no se guarda`, {
        sustancia: s.id,
        q,
      }),
    )
    return
  }
  if (q === 'mass' || q === 'temperature') {
    // `mass` sería circular (la masa vive en `Part.mass`) y `temperature` es
    // estado del cuerpo que relaja al ambiente, no una propiedad del material.
    razones.push(
      razon(4, 'cualidad-de-estado', `${s.id} declara ${q}, que es estado del cuerpo y no materia`, {
        sustancia: s.id,
        q,
      }),
    )
    return
  }
  if (v < sp.range[0] || v > sp.range[1]) {
    razones.push(
      razon(
        4,
        'fuera-de-rango',
        `${s.id}: ${q} ${num(v)} fuera de [${num(sp.range[0])}, ${num(sp.range[1])}]`,
        { sustancia: s.id, q, encontrado: v, cota: v > sp.range[1] ? sp.range[1] : sp.range[0] },
      ),
    )
    return
  }
  const env = envolventeDe(phys, s.tags, q)
  if (env === undefined) return
  if (v > env.hi) {
    razones.push(
      razon(
        3,
        'fuera-de-envolvente',
        `${s.id}: ${q} ${num(v)} contra ${num(env.hi)} para ${s.tags.join('+')} (${env.muestras} muestras)`,
        { sustancia: s.id, q, encontrado: v, cota: env.hi },
      ),
    )
    return
  }
  if (v < env.lo) {
    // Por abajo es reparo y no rechazo, y la asimetría es a propósito: de que
    // algo tenga POCO de una cualidad no sale ninguna máquina de movimiento
    // perpetuo. Lo que rompe el mundo es tener de más.
    advertencias.push(
      razon(
        3,
        'envolvente-por-abajo',
        `${s.id}: ${q} ${num(v)} por debajo de ${num(env.lo)} para ${s.tags.join('+')}`,
        { sustancia: s.id, q, encontrado: v, cota: env.lo },
      ),
    )
  }
}

// ─── Regla 1 · qué entradas se consumen ──────────────────────────────────────

/**
 * Los roles que el proceso CONSUME, derivados de los rendimientos y de nada más.
 *
 * Ésta es la línea que cierra la bomba de materia. Quien propone no escribe
 * «esta entrada se consume»: se lee de si la salida hereda masa de la entrada.
 *
 *   transmute      el cuerpo del rol se convierte en otra cosa → se consume
 *   join           `a`, `b?` y el atador se van adentro del cuerpo nuevo
 *   split          el cuerpo del rol se parte en los pedazos que salen
 *   drawFromStock  lo que sale sale del stock, que baja
 *
 * Un rol que ningún rendimiento menciona NO se consume: el `actor` de `friccion`
 * paga con `stamina` (que es un `drain`, o sea un costo) y sigue entero.
 */
export function consumedRoles(p: Process): readonly string[] {
  const out: string[] = []
  const push = (name: string | undefined): void => {
    if (name === undefined) return
    if (out.includes(name)) return
    out.push(name)
  }
  for (const y of p.completion?.yields ?? []) {
    switch (y.k) {
      case 'transmute':
        push(y.role)
        break
      case 'join':
        push(y.a)
        push(y.b)
        push(y.via)
        break
      case 'split':
        push(y.role)
        break
      case 'drawFromStock':
        push(y.of)
        break
    }
  }
  return out
}

/**
 * Los roles cuyo contenido el proceso puede PONER SOBRE LA MESA como insumo.
 *
 * Son los consumidos, MENOS los de `drawFromStock`. ATAQUE QUE LO MOTIVÓ: «el río
 * paga dos veces». De un stock del dios ya sale un cuerpo entero por el
 * rendimiento; contar además su `nutrition · masa` como presupuesto para un `drive`
 * sobre un tercer cuerpo es cobrar el mismo aporte dos veces adentro de un solo
 * proceso. Que el stock sea un agujero de la conservación no lo vuelve una fuente
 * ilimitada: lo que da, lo da UNA vez, y ya está dado.
 */
function rolesQueAportan(p: Process): readonly string[] {
  const sacados: string[] = []
  for (const y of p.completion?.yields ?? []) if (y.k === 'drawFromStock') sacados.push(baseRoleName(y.of))
  const out: string[] = []
  for (const name of consumedRoles(p)) if (!sacados.includes(baseRoleName(name))) out.push(name)
  return out
}

function excluido(name: string, salvo: readonly string[]): boolean {
  for (const s of salvo) if (baseRoleName(name) === baseRoleName(s)) return true
  return false
}

/**
 * Lo que el proceso puede garantizar que ENTRA de una cualidad conservada.
 *
 * `salvo` son los roles que están RECIBIENDO el efecto, y excluirlos no es un
 * detalle: un cuerpo no se puede alimentar de sí mismo. Sin eso, un proceso que
 * consume al actor y le sube la `stamina` al mismo actor cerraba la cuenta con su
 * propia entrada — el recargador de aliento gastaba 10 y se acreditaba 50 contra
 * los 50 que él mismo declaraba consumir.
 *
 * Y el rol tiene que RESPALDAR la cualidad. ATAQUE QUE LO MOTIVÓ: la piedra-batería
 * por el camino del consumo. `respalda()` y `pinaLaMateria()` existen exactamente
 * para negar que una piedra tenga aliento por mucho que el rol se lo escriba, y no
 * se llamaban en este camino: alcanzaba con escribirle `stamina > 100` al rol de
 * una piedra y consumirla con un `transmute` para que el trabajo saliera pagado.
 */
function entraDe(p: Process, q: QualityId, phys: Physics, salvo: readonly string[] = []): number {
  let total = 0
  for (const name of rolesQueAportan(p)) {
    if (excluido(name, salvo)) continue
    const r = rolDe(p, name)
    if (!respalda(r, q, phys)) continue
    const lo = cotasDeRol(r, q, phys).lo
    if (Number.isFinite(lo) && lo > 0) total += lo
  }
  return total
}

/**
 * Lo mismo, pero en magnitud EXTENSIVA: para una intensiva, `q · masa`.
 *
 * Sin `mass >= x` en el rol consumido no entra NADA, y eso es la verdad: de un
 * cuerpo del que solo se sabe que tiene «nutrición mayor que cero» no se puede
 * contar con ninguna caloría. Ver el bloque de intensivas de más arriba.
 */
function entraExtensivoDe(
  p: Process,
  q: QualityId,
  phys: Physics,
  salvo: readonly string[] = [],
): number {
  const intensiva = esIntensiva(phys, q)
  let total = 0
  for (const name of rolesQueAportan(p)) {
    if (excluido(name, salvo)) continue
    const r = rolDe(p, name)
    if (!respalda(r, q, phys)) continue
    const lo = cotasDeRol(r, q, phys).lo
    if (!Number.isFinite(lo) || lo <= 0) continue
    total += intensiva ? lo * masaGarantizada(r, phys) : lo
  }
  return total
}

/** Cuánto empuja realmente un `drive`, acotado por el objetivo y por la corrida. */
function trabajoDe(p: Process, e: Extract<Effect, { k: 'drive' }>, phys: Physics): number {
  const duracion = p.completion?.at ?? VENTANA_SIN_FINAL
  // El piso EFECTIVO y no el del rol: si el mismo proceso baja la cualidad, el
  // umbral de entrada no es un piso y el recorrido real arranca más abajo.
  const lo = pisoEfectivo(p, e.q, e.on, phys)
  const recorrido = Number.isFinite(lo) ? e.toward - lo : e.toward
  const porTasa = e.porSegundo * duracion
  if (recorrido <= 0 || porTasa <= 0) return 0
  return Math.min(porTasa, recorrido)
}

/**
 * Lo que un `transfer` mueve por corrida, y lo que el ORIGEN garantiza tener.
 *
 * ATAQUE QUE LA MOTIVÓ: `transfer` no miraba CANTIDAD, solo presencia. Al origen
 * le alcanzaba con garantizar la cualidad mayor que cero para que se le pudieran
 * sacar 500 por tick. Un `drain` que gasta de más cobra reparo desde el primer
 * día; un `transfer` que mueve mil veces más no cobraba nada.
 */
function movidoPor(p: Process, e: Extract<Effect, { k: 'transfer' }>): number {
  return e.porSegundo * (p.completion?.at ?? VENTANA_SIN_FINAL)
}

function disponibleEn(p: Process, q: QualityId, rol: string, phys: Physics): number {
  const lo = cotasDeRol(rolDe(p, rol), q, phys).lo
  return Number.isFinite(lo) && lo > 0 ? lo : 0
}

/**
 * El saldo DECLARADO del proceso sobre una cuenta conservada, por corrida.
 * Negativo = cuesta. Es la cuenta que suma la regla 5 a lo largo de un ciclo.
 *
 * Un `transfer` cuenta el crédito en el destino SIEMPRE y el débito en el origen
 * SOLO hasta lo que el origen GARANTIZA. Ésa es la asimetría que hace visible la
 * piedra-batería: transferir `stamina` desde una piedra no le saca nada a nadie y
 * sin embargo se la pone a alguien.
 *
 * Que el tope sea la garantía y no la presencia es lo que cerró el ataque de la
 * piedra-batería «con una línea más»: agregarle `stamina > 0` al rol hacía que
 * `respalda()` dijera que sí, el débito pasaba a valer lo mismo que el crédito y
 * el saldo daba CERO — con lo cual el ciclo frotar → batería → frotar dejaba de
 * dar positivo y la regla 5 se apagaba sola. `stamina > 0` garantiza cero.
 */
export function saldoDeclarado(p: Process, q: QualityId, phys: Physics): number {
  const duracion = p.completion?.at ?? VENTANA_SIN_FINAL
  const conservada = esConservada(phys, q)
  const destinos: string[] = []
  let saldo = 0
  for (const e of p.effects) {
    switch (e.k) {
      case 'drain':
        // Un drenaje sobre un rol que NO garantiza la cualidad puede valer cero, y
        // la puerta ya lo dice como reparo (`drenaje-sin-respaldo`). Contarlo como
        // costo era el escudo de «frotar-con-peaje»: una milmillonésima de nutrición
        // sobre un actor que no la tiene garantizada volvía «peor en alguna» a un
        // clon tres veces más barato, y la regla 4 se apagaba sola.
        if (e.q === q && respalda(rolDe(p, e.on), q, phys)) saldo -= e.porSegundo * duracion
        break
      case 'transfer':
        if (e.q === q) {
          const movido = e.porSegundo * duracion
          saldo += movido
          const tope = respalda(rolDe(p, e.from), q, phys) ? disponibleEn(p, q, e.from, phys) : 0
          saldo -= Math.min(movido, tope)
        }
        break
      case 'drive': {
        if (e.q === q) {
          saldo += trabajoDe(p, e, phys)
          if (conservada && !destinos.includes(e.on)) destinos.push(e.on)
        }
        const pb = e.poweredBy
        if (pb !== undefined && pb.q === q) {
          const eff = pb.efficiency > 0 ? pb.efficiency : 1
          // El trabajo, llevado a la masa que se está empujando: subirle un grado
          // a una montaña no puede costar lo mismo que subírselo a un guijarro.
          saldo -= (trabajoDe(p, e, phys) * masaQuePaga(rolDe(p, e.on), e.q, phys)) / eff
        }
        break
      }
      case 'couple':
        // Un `couple` escribe la cualidad sin cota propia: lo peor que puede
        // pasar es el rango entero, y ésa es la cota honesta.
        if (e.q === q) saldo += span(phys, q)
        break
    }
  }
  // Lo que se acredita MENOS lo que se consume para acreditarlo, UNA sola vez: el
  // presupuesto no se gasta de nuevo con cada efecto. Sin esta resta, un proceso que
  // se come 2000 de nutrición·masa para escribir 1500 declaraba un saldo POSITIVO y
  // la regla 5 lo rechazaba por «ciclo rentable» —el ataque «panificar»—, prometiendo
  // que el ciclo rinde de verdad en algún estado del mundo cuando no rinde en
  // ninguno. `entraDe` ya sabía la cuenta: la usa la regla 1, y la dejaba pasar.
  if (destinos.length > 0) saldo -= entraDe(p, q, phys, destinos)
  return saldo
}

function reglaConservacion(p: Process, phys: Physics, razones: Razon[]): void {
  const conservadas = conservedIn(phys)

  for (const e of p.effects) {
    const tasa = tasaDe(e)
    if (tasa !== undefined && tasa < 0) {
      // Una tasa negativa da vuelta el signo de TODO efecto: un `drain` de −5 es
      // un `drive` disfrazado, y pasaría por debajo de las reglas 1 y 2 sin
      // tocarlas. Es la bomba de materia de un solo carácter.
      const conservada = esConservada(phys, e.q)
      razones.push(
        razon(
          conservada ? 1 : 2,
          'tasa-negativa',
          `${p.id}: ${e.k} de ${e.q} con porSegundo ${num(tasa)}; una tasa negativa invierte el efecto`,
          { proceso: p.id, q: e.q, encontrado: tasa, cota: 0 },
        ),
      )
    }
  }

  for (const q of conservadas) {
    const entra = entraDe(p, q, phys)

    // ── los `drive`, con PRESUPUESTO ACUMULADO ──────────────────────────────
    //
    // ATAQUE QUE LO MOTIVÓ, y lo encontraron dos adversarios por separado: «dos
    // bocas comen la misma miga» y «el doble gasto». La cuenta se hacía POR EFECTO
    // y nunca en total, así que `entraAqui` era el presupuesto ENTERO cada vez.
    // Ningún efecto mentía por su cuenta —cada uno, mirado solo, cerraba clavado—;
    // lo que no cerraba era la SUMA, y la suma no la miraba nadie. Con dos cuerpos
    // de destino salían el doble; con tres, el triple.
    const destinos: string[] = []
    for (const e of p.effects) {
      if (e.k !== 'drive' || e.q !== q || e.porSegundo < 0) continue
      if (e.toward <= pisoEfectivo(p, q, e.on, phys)) continue
      if (!destinos.includes(e.on)) destinos.push(e.on)
    }
    // Lo que entra SIN contar los cuerpos que reciben: nadie se alimenta de sí.
    const entraAqui = entraDe(p, q, phys, destinos)
    const entraExt = entraExtensivoDe(p, q, phys, destinos)
    let saleAcumulado = 0
    let saleExtAcumulado = 0
    const movidoPorOrigen = new Map<string, number>()

    for (const e of p.effects) {
      // Con la tasa en negativo el efecto está dado vuelta y ya lo dijo
      // `tasa-negativa`; volver a contarlo acá daría un «sale −10» ilegible.
      if (e.k === 'drive' && e.q === q && e.porSegundo >= 0) {
        const lo = pisoEfectivo(p, q, e.on, phys)
        if (e.toward <= lo) continue
        // La CONVERSIÓN: ver `esConversionAdmisible`. La paga la regla 2, que sabe
        // mirar un `poweredBy` entero; acá no hay nada que sumar.
        if (esConversionAdmisible(p, e, q, phys)) continue
        const sale = trabajoDe(p, e, phys)
        saleAcumulado += sale
        if (saleAcumulado > entraAqui) {
          razones.push(
            razon(
              1,
              'conservacion-drive',
              `${q} es conservada y «${p.id}» la sube en el rol «${e.on}» hacia ${num(e.toward)}: sale ${num(saleAcumulado)}, entra ${num(entraAqui)}`,
              { proceso: p.id, q, rol: e.on, encontrado: saleAcumulado, cota: entraAqui },
            ),
          )
          continue
        }
        // La cuenta cruda cerró. Falta la de verdad: para una intensiva lo que se
        // conserva es `q · masa`, y los mismos «9» en un cuerpo grande son mucha
        // más comida que en uno chico.
        const escrito = revisarIntensiva(p, phys, 1, q, sale, e.on, saleExtAcumulado, entraExt, razones)
        saleExtAcumulado += escrito
      }
      if (e.k === 'couple' && e.q === q) {
        razones.push(
          razon(
            1,
            'conservacion-couple',
            `${q} es conservada y «${p.id}» la hace seguir a ${e.follows.q} de «${e.follows.of}»: sale hasta ${num(span(phys, q))}, entra ${num(entra)}`,
            { proceso: p.id, q, rol: e.on, encontrado: span(phys, q), cota: entra },
          ),
        )
      }
      if (e.k === 'transfer' && e.q === q && e.porSegundo >= 0) {
        const origen = rolDe(p, e.from)
        // ACUMULADO POR ORIGEN. ATAQUE: «dos caños vacían la misma cantera». Cada
        // caño se llevaba exactamente lo que la cantera garantiza, y salían dos
        // veces: la comparación era por efecto y la cantera es una sola.
        const sale = (movidoPorOrigen.get(e.from) ?? 0) + movidoPor(p, e)
        movidoPorOrigen.set(e.from, sale)
        if (!respalda(origen, q, phys)) {
          razones.push(
            razon(
              1,
              'conservacion-transfer',
              `«${p.id}» mueve ${q} desde «${e.from}», que no la tiene garantizada: sale ${num(sale)}, entra ${num(entra)}`,
              { proceso: p.id, q, rol: e.from, encontrado: sale, cota: entra },
            ),
          )
          continue
        }
        // CANTIDAD, y no solo presencia. Que el origen tenga «más que cero» no
        // autoriza a sacarle quinientos: el rol garantiza un número y ése es el
        // techo. Es el mismo control que el `drain` cobra desde el primer día.
        //
        // De acá para abajo NO se corta: las tres razones son distintas —cuánto
        // se mueve, por cuánto tiempo, y en qué cuerpo aterriza— y la fragua las
        // quiere todas juntas o hace tres viajes al modelo por el mismo proceso.
        const disponible = disponibleEn(p, q, e.from, phys)
        if (sale > disponible) {
          razones.push(
            razon(
              1,
              'conservacion-transfer',
              `«${p.id}» mueve ${num(sale)} de ${q} desde «${e.from}», y el rol solo garantiza ${num(disponible)}: la diferencia sale de la nada`,
              { proceso: p.id, q, rol: e.from, encontrado: sale, cota: disponible },
            ),
          )
        }
        // Sin `completion` el efecto corre tick tras tick mientras el arreglo se
        // sostenga: `porSegundo × ∞`. Un proceso que ACREDITA una cuenta conservada
        // tiene que terminar alguna vez, o no hay cantidad que acotar. (Un
        // proceso sin `completion` que solo GASTA es legítimo: `friccion` es eso.)
        if (p.completion === undefined) {
          razones.push(
            razon(
              1,
              'conservacion-transfer',
              `«${p.id}» acredita ${q} en «${e.to}» sin declarar completion: el efecto corre para siempre y nada lo consume`,
              { proceso: p.id, q, rol: e.to, encontrado: e.porSegundo, cota: disponible },
            ),
          )
        }
        revisarIntensivaTransfer(p, phys, 1, q, sale, e, disponible, razones)
      }
    }
  }

  for (const y of p.completion?.yields ?? []) {
    if (y.k !== 'drawFromStock') continue
    const fuente = rolDe(p, y.of)
    if (!garantizaPositivo(fuente, 'mass')) {
      // `drawFromStock` es EL agujero de la conservación: es por donde el dios
      // le mete materia al mundo. Que exista está bien; que no declare de qué
      // cuerpo sale, no. Sin cota de masa en el rol, esto es materia de la nada
      // y el río no se agota nunca.
      razones.push(
        razon(
          1,
          'materia-sin-origen',
          `«${p.id}» saca de «${y.of}» sin exigirle masa: el rol tiene que pedir mass > 0 o la materia sale de la nada`,
          { proceso: p.id, q: 'mass', rol: y.of, cota: 0 },
        ),
      )
    }
  }
}

/**
 * El producto por masa, para lo que un efecto ESCRIBE en un rol.
 *
 * ATAQUE QUE LA MOTIVÓ: «engordar el tronco». Mover el número de una cualidad
 * intensiva a un cuerpo más grande multiplica el total sin que ninguna cuenta
 * cruda se entere. Y cuando el rol de destino no acota su masa, no hay ningún
 * número con el que comparar: eso NO se deja pasar, se rechaza por indecidible.
 */
function revisarIntensiva(
  p: Process,
  phys: Physics,
  regla: Regla,
  q: QualityId,
  cantidad: number,
  rolDestino: string,
  yaEscrito: number,
  entraExt: number,
  razones: Razon[],
): number {
  if (!esIntensiva(phys, q) || cantidad <= 0) return 0
  // El techo EFECTIVO y no el del rol: si el mismo proceso le mete masa al cuerpo
  // de destino, el `mass <= x` del rol es lo que pesaba al entrar y nada más.
  const hi = techoEfectivo(p, rolDestino, phys)
  if (hi === undefined) {
    razones.push(
      razon(
        regla,
        'magnitud-intensiva',
        `${q} es intensiva —el número es por unidad de masa— y «${p.id}» la escribe en «${rolDestino}», que no acota su masa: lo que se conserva es ${q}·masa y acá no se puede acotar. Poné un mass <= x en el rol`,
        { proceso: p.id, q, rol: rolDestino, encontrado: cantidad, cota: entraExt },
      ),
    )
    return 0
  }
  const sale = yaEscrito + cantidad * hi
  if (sale > entraExt) {
    razones.push(
      razon(
        regla,
        'magnitud-intensiva',
        `${q} es intensiva: «${p.id}» escribe ${num(cantidad)} en «${rolDestino}», que pesa hasta ${num(hi)}, o sea ${num(sale)} de ${q}·masa, y entra ${num(entraExt)}`,
        { proceso: p.id, q, rol: rolDestino, encontrado: sale, cota: entraExt },
      ),
    )
  }
  return cantidad * hi
}

/**
 * El calor específico de lo que puede llenar un rol, o `undefined` si el rol no
 * dice de qué está hecho el cuerpo.
 *
 * Es lo que convierte grados en energía, y vive en cada `Substance` del catálogo:
 * la puerta lo usaba para armar envolventes y no para conservar.
 */
function calorEspecificoDe(
  r: Role | undefined,
  phys: Physics,
): { min: number; max: number } | undefined {
  if (r === undefined || !pinaLaMateria(r, phys)) return undefined
  const cands = candidatasDeRol(r, phys)
  if (cands.length === 0) return undefined
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const s of cands) {
    if (!Number.isFinite(s.specificHeat)) continue
    min = Math.min(min, s.specificHeat)
    max = Math.max(max, s.specificHeat)
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined
  return { min, max }
}

/**
 * Lo mismo para un `transfer`, donde el origen es lo que hay y el destino es lo
 * que aparece. Mover 50 °C de una brasa de masa 0.1 a una olla de masa 100 no
 * conserva nada: la energía es `masa · calor específico · ΔT`, así que del lado
 * del destino aparece mil veces la que se fue. Es la bomba de calor sin motor.
 */
function revisarIntensivaTransfer(
  p: Process,
  phys: Physics,
  regla: Regla,
  q: QualityId,
  movido: number,
  e: Extract<Effect, { k: 'transfer' }>,
  disponible: number,
  razones: Razon[],
): void {
  if (!esIntensiva(phys, q) || movido <= 0) return
  const hi = techoEfectivo(p, e.to, phys)
  if (hi === undefined) {
    razones.push(
      razon(
        regla,
        'magnitud-intensiva',
        `${q} es intensiva y «${p.id}» la mueve a «${e.to}», que no acota su masa: mover el número a un cuerpo más grande MULTIPLICA el total. Poné un mass <= x en el rol de destino`,
        { proceso: p.id, q, rol: e.to, encontrado: movido },
      ),
    )
    return
  }
  const lo = masaGarantizada(rolDe(p, e.from), phys)
  // EL CALOR ESPECÍFICO. ATAQUE QUE LO MOTIVÓ: «mojar la brasa». La energía de un
  // cuerpo es `masa · calor específico · ΔT`, y la cuenta comparaba `ΔT · masa`
  // nada más: origen pinchado a mineral (cp ∈ [0.75, 0.8]) y destino pinchado a
  // líquido (cp ∈ [3.9, 4.2]), las dos masas clavadas en 1, y mover 200 grados
  // sacaba 160 de energía y metía 780.
  //
  // Y SOLO SE COBRA CUANDO SE PUEDE AFIRMAR, que es la diferencia entre esto y
  // rechazar todo. Hace falta que los dos roles digan de qué están hechos Y que los
  // dos conjuntos de candidatas estén SEPARADOS: que lo más liviano térmicamente
  // que puede llenar el destino siga siendo más pesado que lo más pesado que puede
  // llenar el origen. Si se solapan, existe un mundo donde no hay diferencia que
  // cobrar y cobrarla sería inventar un número. Medido contra el catálogo: `asar`
  // —el fuego (cp ∈ [0.9, 2.8]) contra la comida (cp ∈ [1.9, 3.9])— se solapa y
  // pasa, que es lo que tiene que pasar; la brasa mineral contra el agua, no.
  let cpDestino = 1
  let cpOrigen = 1
  if (q === 'temperature') {
    const cd = calorEspecificoDe(rolDe(p, e.to), phys)
    const co = calorEspecificoDe(rolDe(p, e.from), phys)
    if (cd !== undefined && co !== undefined && cd.min > co.max) {
      cpDestino = cd.min
      cpOrigen = co.max
    }
  }
  const aparece = movido * hi * cpDestino
  const desaparece = disponible * lo * cpOrigen
  if (aparece > desaparece) {
    const conCalor =
      cpDestino === cpOrigen
        ? ''
        : ` (calor específico ${num(cpOrigen)} contra ${num(cpDestino)})`
    razones.push(
      razon(
        regla,
        'magnitud-intensiva',
        `${q} es intensiva: «${p.id}» pone ${num(movido)} en «${e.to}» (hasta ${num(hi)} de masa) y saca de «${e.from}» (${num(lo)} de masa garantizada)${conCalor}: aparecen ${num(aparece)} de ${q}·masa y desaparecen ${num(desaparece)}`,
        { proceso: p.id, q, rol: e.to, encontrado: aparece, cota: desaparece },
      ),
    )
  }
}

function tasaDe(e: Effect): number | undefined {
  switch (e.k) {
    case 'drain':
    case 'drive':
    case 'transfer':
      return e.porSegundo
    case 'couple':
      return undefined
  }
}

// ─── Regla 2 · nada sube gratis ──────────────────────────────────────────────

/**
 * LA CONVERSIÓN. Un `drive` que sube una cuenta conservada pagándola con OTRA.
 *
 * FALSO RECHAZO QUE LA MOTIVÓ, y es el más caro de todos los que encontró el lente
 * opuesto: `comer` no se podía escribir. Convertir la nutrición de un bocado en
 * aliento es el bucle central del juego y ninguna ley lo hace —`leyes.ts` no toca
 * `stamina`—, así que tiene que ser un `Process`. Pero `nutrition` y `stamina` son
 * las dos conservadas, y la regla 1 solo sabía sumar la MISMA cuenta: «sale 20,
 * entra 0», porque un pescado no garantiza aliento. Sin esto la criatura pesca y no
 * come.
 *
 * Y `poweredBy` YA ES una conversión: `friccion` convierte aliento en calor. Lo
 * único que pasaba es que ahí el destino no era conservado, y cuando el destino
 * TAMBIÉN lo es, la regla 1 pisaba a la regla 2 y no quedaba camino.
 *
 * LO QUE SE EXIGE, y es lo que impide que esto sea la puerta de atrás de todas las
 * demás:
 *
 *   · lo que se sube NO es materia. `stamina` es la única cuenta conservada que
 *     ninguna sustancia declara: es la criatura, no el material. Convertir comida
 *     en aliento es lo que hace un cuerpo vivo; convertir aliento en MASA, en
 *     nutrición o en combustible sería una bomba de materia con otro nombre.
 *   · lo que paga es otra cuenta conservada, con eficiencia en (0, 1].
 *   · el cuerpo que paga está RESPALDADO y el proceso lo CONSUME. No se convierte
 *     lo que no se destruye: el bocado se transmuta, y por eso no se lo puede comer
 *     dos veces.
 *
 * LO QUE NO SE PUEDE EXIGIR, y hay que decirlo en voz alta: la CANTIDAD. No existe
 * ninguna constante en la física que diga cuánto aliento vale una caloría —eso es
 * calibración, y la puerta juzga contra lo calibrado, no calibra—, así que el
 * desbalance se cobra como el reparo `costo-mayor-que-la-garantia`, exactamente
 * igual que para `friccion`. Es el mismo agujero que la regla 2 tiene desde el
 * primer día para todo `poweredBy`, ni más ni menos.
 */
function esConversionAdmisible(
  p: Process,
  e: Extract<Effect, { k: 'drive' }>,
  q: QualityId,
  phys: Physics,
): boolean {
  const pb = e.poweredBy
  if (pb === undefined) return false
  if (pb.q === q) return false // la misma cuenta no se paga a sí misma
  if (!esConservada(phys, pb.q)) return false
  if (!(pb.efficiency > 0) || pb.efficiency > MAX_EFFICIENCY) return false
  // La masa la tiene todo cuerpo por definición, y lo que alguna sustancia declara
  // es materia. Ni una ni otra salen de una conversión.
  if (q === 'mass' || indiceDe(phys).deSustancia.has(q)) return false
  const fuente = rolDe(p, pb.from)
  if (!respalda(fuente, pb.q, phys)) return false
  for (const name of consumedRoles(p)) {
    if (baseRoleName(name) === baseRoleName(pb.from)) return true
  }
  return false
}

function reglaNadaSubeGratis(
  p: Process,
  phys: Physics,
  razones: Razon[],
  advertencias: Razon[],
): void {
  reglaAcoplesYTransferencias(p, phys, razones, advertencias)
  const idx = indiceDe(phys)

  for (const e of p.effects) {
    if (e.k !== 'drive') continue
    // Una conservada que sube ya la rechazó la regla 1, con mejor mensaje. La
    // excepción es la CONVERSIÓN, que la regla 1 le pasa a ésta justamente porque
    // acá está el único lugar que sabe mirar un `poweredBy` entero.
    if (esConservada(phys, e.q) && !esConversionAdmisible(p, e, e.q, phys)) continue

    // El piso para DIRECCIÓN, que no es el mismo que el piso para medir: ver
    // `pisoParaDireccion`. Un `drive` hacia el propio umbral de entrada de un rol
    // al que el mismo proceso le drena la cualidad NO baja, sube — y ésa era la
    // puerta de atrás por la que el `poweredBy` dejaba de revisarse entero.
    const lo = pisoParaDireccion(p, e.q, e.on, phys)
    if (e.toward <= lo) continue // baja: libre, y tiene que serlo

    const pb = e.poweredBy
    if (pb === undefined) {
      const declara = cotasDeRol(rolDe(p, e.on), e.q, phys).lo > (spec(phys, e.q)?.range[0] ?? 0)
      const comoSeCorrige = declara
        ? ''
        : `. Si el proceso BAJA ${e.q}, el rol tiene que declarar de dónde baja: poné un ${e.q} >= x`
      razones.push(
        razon(
          2,
          'sube-gratis',
          `«${p.id}» sube ${e.q} hacia ${num(e.toward)} en «${e.on}» sin declarar poweredBy: de qué cuenta conservada drena${comoSeCorrige}`,
          { proceso: p.id, q: e.q, rol: e.on, encontrado: e.toward, cota: lo },
        ),
      )
      continue
    }
    if (!esConservada(phys, pb.q)) {
      razones.push(
        razon(
          2,
          'fuente-no-conservada',
          `«${p.id}» sube ${e.q} con poweredBy sobre ${pb.q}, que no es una cuenta conservada: drenarla no le cuesta nada a nadie`,
          { proceso: p.id, q: pb.q, rol: pb.from },
        ),
      )
      continue
    }
    if (!(pb.efficiency > 0)) {
      razones.push(
        razon(
          2,
          'eficiencia',
          `«${p.id}»: eficiencia ${num(pb.efficiency)} sobre ${pb.q}; con cero o menos el proceso no termina nunca`,
          { proceso: p.id, q: pb.q, encontrado: pb.efficiency, cota: MAX_EFFICIENCY },
        ),
      )
    } else if (pb.efficiency > MAX_EFFICIENCY) {
      razones.push(
        razon(
          2,
          'eficiencia',
          `«${p.id}»: eficiencia ${num(pb.efficiency)} > ${num(MAX_EFFICIENCY)} sobre ${pb.q}; sale más trabajo del que entra`,
          { proceso: p.id, q: pb.q, encontrado: pb.efficiency, cota: MAX_EFFICIENCY },
        ),
      )
    }
    // ATAQUE QUE LO MOTIVÓ (el segundo): «piedra-bateria-sin-pin». `pinaLaMateria`
    // cierra la piedra-batería, pero solo se dispara si el rol DICE de qué está
    // hecho el cuerpo; borrando el `rigidity >= 0.5` el mismo proceso entraba, con
    // un rol que acepta un SUPERCONJUNTO de los cuerpos de antes. La mitad que sí
    // se puede cerrar sin inventar un campo nuevo: un cuerpo que paga SU PROPIO
    // cambio tiene que tener el combustible adentro, y adentro de la materia solo
    // está lo que alguna sustancia declara. `fermentar` se paga con su propia
    // `nutrition` y pasa; calentarse con el propio aliento, no.
    const mismoCuerpo = baseRoleName(pb.from) === baseRoleName(e.on)
    const laMateriaLaTiene = pb.q === 'mass' || idx.deSustancia.has(pb.q)
    if (!respalda(rolDe(p, pb.from), pb.q, phys)) {
      // Drenar `stamina` de una piedra no le saca `stamina` a nadie: el calor
      // sale gratis igual, con la declaración puesta y todo. La declaración
      // tiene que apuntar a algo que efectivamente tenga de dónde.
      razones.push(
        razon(
          2,
          'fuente-sin-respaldo',
          `«${p.id}» dice drenar ${pb.q} de «${pb.from}», pero el rol no garantiza ${pb.q}: el trabajo saldría gratis`,
          { proceso: p.id, q: pb.q, rol: pb.from },
        ),
      )
    } else if (mismoCuerpo && !laMateriaLaTiene) {
      razones.push(
        razon(
          2,
          'fuente-sin-respaldo',
          `«${p.id}» empuja ${e.q} en «${e.on}» y lo paga con la ${pb.q} del MISMO cuerpo, y ${pb.q} no la declara ninguna sustancia: un cuerpo solo puede pagar su propio cambio con lo que la materia trae adentro`,
          { proceso: p.id, q: pb.q, rol: pb.from },
        ),
      )
    }

    if (pb.efficiency > 0) {
      // El trabajo llevado a la masa que se empuja: ver `masaQuePaga`. Frotar una
      // montaña no puede costar lo mismo que frotar un guijarro.
      //
      // Sin `completion` este reparo NO se cobraba, y el ataque «frotar-la-montania-v2»
      // vive justo ahí: un proceso que no declara cuándo termina se quedaba sin la
      // única línea que dice cuánto cuesta. `trabajoDe` ya sabe qué hacer sin
      // corrida —un tick, acotado por el objetivo—, así que la cuenta existe igual.
      const costo = (trabajoDe(p, e, phys) * masaQuePaga(rolDe(p, e.on), e.q, phys)) / pb.efficiency
      const disponible = cotasDeRol(rolDe(p, pb.from), pb.q, phys).lo
      if (Number.isFinite(disponible) && costo > disponible) {
        advertencias.push(
          razon(
            2,
            'costo-mayor-que-la-garantia',
            `«${p.id}» gasta ${num(costo)} de ${pb.q} y el rol «${pb.from}» solo garantiza ${num(disponible)}: quien empiece justo no llega a terminar`,
            { proceso: p.id, q: pb.q, rol: pb.from, encontrado: costo, cota: disponible },
          ),
        )
      }
    }
  }

  for (const e of p.effects) {
    if (e.k !== 'drain') continue
    if (!respalda(rolDe(p, e.on), e.q, phys)) {
      advertencias.push(
        razon(
          2,
          'drenaje-sin-respaldo',
          `«${p.id}» drena ${e.q} de «${e.on}», que no la tiene garantizada: el costo puede ser cero y el proceso, gratis`,
          { proceso: p.id, q: e.q, rol: e.on },
        ),
      )
      continue
    }
    const duracion = p.completion?.at
    if (duracion === undefined) continue
    const costo = e.porSegundo * duracion
    const disponible = cotasDeRol(rolDe(p, e.on), e.q, phys).lo
    if (Number.isFinite(disponible) && costo > disponible) {
      // Reparo y no rechazo: que quien empiece con lo justo se quede sin
      // aliento a mitad de camino no es una violación de la física, es la
      // distancia entre querer y poder. Pero tiene que estar dicho, porque un
      // proceso que NUNCA se puede terminar desde su propio umbral de entrada
      // es indistinguible de uno que anda, hasta que se lo mira.
      advertencias.push(
        razon(
          2,
          'costo-mayor-que-la-garantia',
          `«${p.id}» gasta ${num(costo)} de ${e.q} en ${num(duracion)} s y el rol «${e.on}» solo garantiza ${num(disponible)}: quien empiece justo no llega a terminar`,
          { proceso: p.id, q: e.q, rol: e.on, encontrado: costo, cota: disponible },
        ),
      )
    }
  }
}

/**
 * La regla 2 sobre `couple` y `transfer`, que hasta ahora no la pisaban.
 *
 * ATAQUE QUE LA MOTIVÓ: `reglaNadaSubeGratis` abría con `if (e.k !== 'drive')
 * continue`. O sea que la regla que impide sacar trabajo de la nada miraba UN
 * tercio de los efectos. De ahí salieron el espejo térmico, encender por decreto,
 * la piedra que irradia, la bomba de calor y prender por acople: cinco máquinas
 * de movimiento perpetuo escritas con otro `k`.
 *
 * Y las dos formas pagan distinto, porque hacen cosas distintas:
 *
 *   COUPLE — no mueve nada del mundo: CREA. «Tu temperatura sigue la de aquél»
 *   deja a aquél igual de caliente y calienta a éste. Es una copia, y una copia
 *   de una cualidad es materia o energía de la nada. Y no se puede pagar: el tipo
 *   `Effect.couple` NO TIENE `poweredBy`, así que no existe manera de declarar de
 *   qué cuenta drena. Entonces el único acople admisible es el que provablemente
 *   nunca sube: lo seguido tiene que entrar entero por debajo del piso de lo que
 *   sigue. El día que haga falta un acople que suba, el campo se le agrega al
 *   tipo — no se deja la puerta abierta.
 *
 *   TRANSFER — sí mueve, pero solo hasta lo que hay. Para una extensiva mover
 *   conserva por definición y no hay nada que pagar. Para una INTENSIVA no: el
 *   número es por unidad de masa, así que mover «50 grados» de una brasa a una
 *   olla cien veces más pesada crea cien veces la energía que se fue.
 */
/**
 * Lo más alto que un `couple` puede llegar a ESCRIBIR en el rol que sigue.
 *
 * ATAQUE QUE LA MOTIVÓ: `inverse` no aparecía ni una vez en las 2333 líneas de este
 * archivo, y el control nuevo lee «el techo de lo seguido entra por debajo del piso
 * de lo que sigue» como «esto solo baja». Con `inverse` eso significa exactamente lo
 * contrario: si lo seguido está clavado en su MÍNIMO, el invertido está clavado en
 * su MÁXIMO, así que CUMPLIR el control era la condición de subir al tope. Un rol
 * que pide `temperature <= -100` prendía el mundo, y uno que pide `toxicity <= 0`
 * —piedra, pedernal y agua— regalaba filo 1 para siempre.
 *
 * Con `inverse`, entonces, lo que se escribe es el ESPEJO de lo seguido dentro de su
 * rango, y la cota honesta es el espejo de su PISO. Un acople inverso sigue siendo
 * admisible: hace falta que el rol seguido garantice estar arriba.
 */
function techoQueEscribeElAcople(
  p: Process,
  e: Extract<Effect, { k: 'couple' }>,
  phys: Physics,
): number {
  const c = cotasDeRol(rolDe(p, e.follows.of), e.follows.q, phys)
  if (e.follows.inverse !== true) return c.hi
  const s = spec(phys, e.follows.q)
  if (s === undefined || !Number.isFinite(c.lo)) return Number.POSITIVE_INFINITY
  return s.range[0] + s.range[1] - c.lo
}

function reglaAcoplesYTransferencias(
  p: Process,
  phys: Physics,
  razones: Razon[],
  advertencias: Razon[],
): void {
  for (const e of p.effects) {
    if (e.k === 'couple') {
      // Sobre una conservada ya lo rechazó la regla 1, con mejor mensaje.
      if (esConservada(phys, e.q)) continue
      const piso = pisoParaDireccion(p, e.q, e.on, phys)
      const techoSeguido = techoQueEscribeElAcople(p, e, phys)
      if (Number.isFinite(techoSeguido) && techoSeguido <= piso) continue // solo baja
      const alReves = e.follows.inverse === true ? ' al revés' : ''
      razones.push(
        razon(
          2,
          'sube-gratis',
          `«${p.id}» hace que ${e.q} de «${e.on}» siga${alReves} a ${e.follows.q} de «${e.follows.of}»: eso puede subir hasta ${num(techoSeguido)} sin drenar nada, y un couple no tiene poweredBy con el que pagarlo`,
          { proceso: p.id, q: e.q, rol: e.on, encontrado: techoSeguido, cota: piso },
        ),
      )
      continue
    }
    if (e.k !== 'transfer') continue
    // Sin `completion` el efecto corre mientras el arreglo se sostenga:
    // `porSegundo × ∞`, y la puerta compara CANTIDADES POR CORRIDA. Para una
    // conservada ya lo
    // dice la regla 1; para la temperatura no lo decía nadie, y la temperatura es
    // energía igual. ATAQUE: «el sifón de calor» — y de yapa la ley 1 relaja la
    // brasa hacia el ambiente cada tick, o sea que la fuente se REPONE sola y el
    // sifón mueve mucho más que los grados que el rol garantiza una sola vez.
    if (p.completion === undefined && !esConservada(phys, e.q)) {
      razones.push(
        razon(
          2,
          'transferencia-eterna',
          `«${p.id}» mueve ${e.q} de «${e.from}» a «${e.to}» a ${num(e.porSegundo)} por segundo y no declara completion: el efecto corre mientras el arreglo se sostenga, y la puerta juzga cantidades por corrida`,
          { proceso: p.id, q: e.q, rol: e.to, encontrado: e.porSegundo },
        ),
      )
    }
    const movido = movidoPor(p, e)
    // Sobre una conservada el producto por masa ya lo miró la regla 1, que tiene
    // el mejor mensaje porque además sabe cuánto ENTRA.
    if (!esConservada(phys, e.q) && movido > 0) {
      revisarIntensivaTransfer(p, phys, 2, e.q, movido, e, disponibleEn(p, e.q, e.from, phys), razones)
    }
    // Y el mismo reparo de cantidad que el `drain` cobra desde el primer día: si
    // el origen garantiza menos de lo que el efecto se lleva, quien empiece justo
    // no llega a terminar. Sobre el `transfer` no había ni razón ni reparo.
    const duracion = p.completion?.at
    if (duracion === undefined) continue
    if (!respalda(rolDe(p, e.from), e.q, phys)) continue
    const disponible = cotasDeRol(rolDe(p, e.from), e.q, phys).lo
    if (Number.isFinite(disponible) && movido > disponible) {
      advertencias.push(
        razon(
          2,
          'costo-mayor-que-la-garantia',
          `«${p.id}» mueve ${num(movido)} de ${e.q} en ${num(duracion)} s y el rol «${e.from}» solo garantiza ${num(disponible)}: quien empiece justo no llega a terminar`,
          { proceso: p.id, q: e.q, rol: e.from, encontrado: movido, cota: disponible },
        ),
      )
    }
  }
}

// ─── Regla 3 sobre el proceso ────────────────────────────────────────────────

function reglaEnvolventes(p: Process, phys: Physics, razones: Razon[]): void {
  const idx = indiceDe(phys)
  for (const e of p.effects) {
    if (e.k !== 'drive') continue
    if (!idx.deSustancia.has(e.q)) continue // no es una cualidad de la materia
    const r = rolDe(p, e.on)
    if (r === undefined) continue // ya lo dice la regla 4
    const cands = candidatasDeRol(r, phys)
    if (cands.length === 0) continue // ya lo dice la realizabilidad

    // El techo es el de la sustancia MÁS PERMISIVA que puede llenar el rol: para
    // rechazar hace falta que ninguna de las que califican pueda llegar ahí.
    let techo = Number.NEGATIVE_INFINITY
    let quien: Substance | undefined
    for (const s of cands) {
      const env = envolventeDe(phys, s.tags, e.q)
      if (env === undefined) continue
      if (env.hi > techo) {
        techo = env.hi
        quien = s
      }
    }
    if (quien === undefined || !Number.isFinite(techo)) continue
    if (e.toward > techo) {
      razones.push(
        razon(
          3,
          'fuera-de-envolvente',
          `«${p.id}» empuja ${e.q} hasta ${num(e.toward)} en «${e.on}», y lo más alto que llega una sustancia que pueda llenar ese rol es ${num(techo)} (${quien.id}, ${quien.tags.join('+')})`,
          { proceso: p.id, q: e.q, rol: e.on, encontrado: e.toward, cota: techo },
        ),
      )
    }
  }
}

// ─── Regla 4 · cierre dimensional, cotas, no-dominancia, realizabilidad ──────

function reglaCierreYCotas(p: Process, phys: Physics, razones: Razon[], advertencias: Razon[]): void {
  // — cualidades que el catálogo no conoce, y números que no son números —
  for (const { q, donde } of cualidadesDe(p)) {
    if (spec(phys, q) === undefined) {
      razones.push(
        razon(4, 'cualidad-fuera-del-catalogo', `«${p.id}» nombra ${q} en ${donde}, que no está en el catálogo`, {
          proceso: p.id,
          q,
        }),
      )
    }
  }
  for (const n of numerosDe(p)) {
    if (Number.isFinite(n.v)) continue
    const cita: Cita = n.q === undefined ? { proceso: p.id } : { proceso: p.id, q: n.q }
    razones.push(razon(4, 'numero-no-finito', `«${p.id}»: ${n.donde} vale ${String(n.v)}`, cita))
  }

  // — una derivada no se escribe: se deriva —
  //
  // ATAQUE QUE LA MOTIVÓ: `admitSubstance` rechaza que una SUSTANCIA declare una
  // cualidad derivada, con el código ya escrito y el motivo puesto. Sobre un
  // PROCESO no lo emitía nadie. Con un `drive` de `catch` una piedra pesca; con
  // uno de `reach` la criatura estira el brazo; con un `couple` de `emitsPower`
  // una piedra irradia por pesar; y `calories` —que ES la comida— se puede
  // empujar directo, salteando la conservación de `nutrition` por la puerta de
  // atrás. Escribirlas es peor que inútil: o el mundo las ignora y la criatura
  // gasta aliento sin que pase nada, o las guarda y quedan viejas para siempre.
  for (const e of p.effects) {
    if (!esDerivada(phys, e.q)) continue
    razones.push(
      razon(
        4,
        'cualidad-derivada',
        `«${p.id}» escribe ${e.q} con un ${e.k}, y ${e.q} no se guarda: se calcula de la geometría y de las partes cada vez que se lee`,
        { proceso: p.id, q: e.q, rol: e.k === 'transfer' ? e.to : e.on },
      ),
    )
  }

  // — el radio del arreglo —
  //
  // Era el único número del proceso que se escapaba del control de finitud, y
  // justo el que decide a qué distancia pasan las cosas: `radius: Infinity` es
  // acción a distancia, `NaN` hace que toda comparación dé falso y el proceso no
  // se dispare jamás, y cero o menos es un arreglo que no se puede armar.
  //
  // ATAQUE QUE AFINÓ LA COTA: `radius: Number.MIN_VALUE` (5e-324) pasaba el `<= 0`.
  // El umbral honesto no es un número elegido a dedo: es el del punto fijo con el
  // que el mundo mide, `FIXED_SCALE = 1000`. Un radio que redondea a cero en la
  // representación en la que se van a hacer las comparaciones ES cero, y decirlo de
  // otra manera sería decir que existe una distancia que el mundo no puede medir.
  if (p.arrangement.k === 'within' && Number.isFinite(p.arrangement.radius) && fx(p.arrangement.radius) <= 0) {
    razones.push(
      razon(4, 'fuera-de-rango', `«${p.id}»: el arreglo pide un radio de ${num(p.arrangement.radius)}, que no encierra nada`, {
        proceso: p.id,
        encontrado: p.arrangement.radius,
        cota: 0,
      }),
    )
  }

  // — la compuerta contradictoria —
  //
  // A los roles se les busca la contradicción interna desde el primer día; al
  // `gate` solo se le miraban los rangos. Una compuerta que pide `temperature`
  // ≥ 1500 y ≤ 0 a la vez no se cumple NUNCA: el proceso es código muerto que
  // ensucia el índice y la búsqueda de todos los demás. Es el mismo fallo
  // silencioso que `rol-irrealizable` existe para evitar.
  const compuerta: Role = { name: 'la compuerta', where: p.gate }
  const qsGate: QualityId[] = []
  for (const t of p.gate) if (!qsGate.includes(t.q)) qsGate.push(t.q)
  for (const q of qsGate) {
    const c = cotasEstrictasDeRol(compuerta, q, phys)
    if (cotasVacias(c)) {
      razones.push(
        razon(
          4,
          'compuerta-contradictoria',
          `«${p.id}»: la compuerta pide ${q} ${c.loAbierto ? '>' : '≥'} ${num(c.lo)} y ${c.hiAbierto ? '<' : '≤'} ${num(c.hi)} a la vez, así que el proceso no se dispara nunca`,
          { proceso: p.id, q, encontrado: c.lo, cota: c.hi },
        ),
      )
    }
  }

  // — el id y el nombre —
  //
  // `admitSubstance` rechaza una sustancia sin id y sin nombre con este mismo
  // código; sobre un proceso no lo aplicaba nadie. Un id vacío es una entrada de
  // mapa que nadie puede citar ni volver a admitir, y el lexema es lo que la
  // criatura tendría que decir para nombrar lo que hace.
  if (p.id.length === 0) razones.push(razon(4, 'sin-nombre', 'el proceso no tiene id'))
  if (p.lexeme.nombre.length === 0) {
    razones.push(razon(4, 'sin-nombre', `el proceso «${p.id}» no tiene nombre: la criatura no lo puede decir`, { proceso: p.id }))
  }

  // — la confianza no se la pone quien propone —
  //
  // `trust` es lo que separa un borrador de una ley del mundo. Que el modelo se
  // firme «estable» a sí mismo es el juez que la criatura no escribió firmando lo
  // que la criatura escribió. Sube por uso y por tiempo, o no sube.
  //
  // ATAQUE QUE LA REESCRIBIÓ: «me-declaro-semilla». La versión vieja cruzaba `trust`
  // (autodeclarado) contra `provenance.by` (autodeclarado), los dos campos del mismo
  // objeto y del mismo lado, así que se esquivaba escribiendo `by: 'semilla'`. La
  // única procedencia que vale es la que sabe quién LLAMÓ a `admit`, y `admit` no la
  // recibe: no hay parámetro por el que pueda entrar. Lo que SÍ sabe la puerta es
  // qué procesos la física ya tiene sellados —el `Map` no lo escribe quien propone—,
  // así que «estable» solo lo puede llevar un proceso que ya está adentro y se está
  // revalidando. Todo lo demás entra como borrador y sube por uso.
  if (p.trust === 'estable' && phys.processes.get(p.id) !== p) {
    razones.push(
      razon(
        4,
        'confianza-autodeclarada',
        `«${p.id}» se declara trust «estable» y la física no lo tiene sellado: la confianza no se la pone quien propone, sube por uso`,
        { proceso: p.id },
      ),
    )
  }

  // — cotas de rango sobre todo número que nombre un valor de cualidad —
  for (const t of p.gate) revisarTest(p, t, 'la compuerta', phys, razones)
  for (const r of p.roles) for (const t of r.where) revisarTest(p, t, `el rol «${r.name}»`, phys, razones)
  for (const e of p.effects) {
    if (e.k !== 'drive') continue
    const sp = spec(phys, e.q)
    if (sp === undefined) continue
    if (e.toward < sp.range[0] || e.toward > sp.range[1]) {
      razones.push(
        razon(
          4,
          'fuera-de-rango',
          `«${p.id}» empuja ${e.q} hacia ${num(e.toward)}, fuera de [${num(sp.range[0])}, ${num(sp.range[1])}]`,
          {
            proceso: p.id,
            q: e.q,
            encontrado: e.toward,
            cota: e.toward > sp.range[1] ? sp.range[1] : sp.range[0],
          },
        ),
      )
    }
  }
  for (const e of p.effects) {
    const tasa = tasaDe(e)
    if (tasa === undefined || !Number.isFinite(tasa) || tasa < 0) continue
    const s = span(phys, e.q)
    if (s > 0 && tasa > s) {
      advertencias.push(
        razon(
          4,
          'tasa-mayor-que-el-rango',
          `«${p.id}»: ${e.k} de ${e.q} a ${num(tasa)} por tick, y el rango entero de ${e.q} mide ${num(s)}: el efecto es instantáneo`,
          { proceso: p.id, q: e.q, encontrado: tasa, cota: s },
        ),
      )
    }
  }

  // — cierre dimensional del `couple` —
  for (const e of p.effects) {
    if (e.k !== 'couple') continue
    const a = spec(phys, e.q)
    const b = spec(phys, e.follows.q)
    if (a === undefined || b === undefined) continue
    if (a.extent !== b.extent) {
      razones.push(
        razon(
          4,
          'acople-inconmensurable',
          `«${p.id}» acopla ${e.q} (${a.extent}) a ${e.follows.q} (${b.extent}): no son la misma clase de magnitud`,
          { proceso: p.id, q: e.q },
        ),
      )
      continue
    }
    if (b.range[0] < a.range[0] || b.range[1] > a.range[1]) {
      razones.push(
        razon(
          4,
          'acople-inconmensurable',
          `«${p.id}» acopla ${e.q} ∈ [${num(a.range[0])}, ${num(a.range[1])}] a ${e.follows.q} ∈ [${num(b.range[0])}, ${num(b.range[1])}]: lo seguido no entra en lo que sigue`,
          { proceso: p.id, q: e.q, encontrado: b.range[1], cota: a.range[1] },
        ),
      )
    }
  }

  // — versión de la física: un sello contra otra física no vale acá —
  if (p.physicsVersion !== phys.version) {
    razones.push(
      razon(
        4,
        'version-de-fisica',
        `«${p.id}» está sellado contra la física ${num(p.physicsVersion)} y ésta es la ${num(phys.version)}`,
        { proceso: p.id, encontrado: p.physicsVersion, cota: phys.version },
      ),
    )
  }
}

function revisarTest(
  p: Process,
  t: QualityTest,
  donde: string,
  phys: Physics,
  razones: Razon[],
): void {
  const sp = spec(phys, t.q)
  if (sp === undefined) return
  if (t.v < sp.range[0] || t.v > sp.range[1]) {
    razones.push(
      razon(
        4,
        'fuera-de-rango',
        `«${p.id}»: ${donde} pide ${t.q} ${t.op} ${num(t.v)}, fuera de [${num(sp.range[0])}, ${num(sp.range[1])}]`,
        { proceso: p.id, q: t.q, encontrado: t.v, cota: t.v > sp.range[1] ? sp.range[1] : sp.range[0] },
      ),
    )
  }
}

function reglaRealizabilidad(p: Process, phys: Physics, razones: Razon[], advertencias: Razon[]): void {
  if (p.roles.length === 0) {
    razones.push(razon(4, 'sin-roles', `«${p.id}» no declara ningún rol: no se puede aplicar a nada`, { proceso: p.id }))
  }
  const vistos = new Set<string>()
  for (const r of p.roles) {
    const base = baseRoleName(r.name)
    if (vistos.has(base)) {
      razones.push(
        razon(4, 'rol-repetido', `«${p.id}» declara dos veces el rol «${base}»`, { proceso: p.id, rol: base }),
      )
    }
    vistos.add(base)
  }

  for (const name of unknownRoleRefs(p)) {
    // Un efecto que apunta a un rol inexistente no falla: simplemente no hace
    // nada. Es la clase de bug que se descubre porque la criatura frota una hora
    // y no se calienta.
    razones.push(
      razon(4, 'rol-desconocido', `«${p.id}» menciona el rol «${name}», que no declara`, {
        proceso: p.id,
        rol: name,
      }),
    )
  }

  for (const r of p.roles) {
    // Contradicción interna: `q >= 5` y `q <= 2` a la vez.
    const qs: QualityId[] = []
    for (const t of r.where) if (!qs.includes(t.q)) qs.push(t.q)
    for (const q of qs) {
      const c = cotasEstrictasDeRol(r, q, phys)
      if (cotasVacias(c)) {
        razones.push(
          razon(
            4,
            'rol-contradictorio',
            `«${p.id}»: el rol «${r.name}» pide ${q} ${c.loAbierto ? '>' : '≥'} ${num(c.lo)} y ${c.hiAbierto ? '<' : '≤'} ${num(c.hi)} a la vez`,
            { proceso: p.id, rol: r.name, q, encontrado: c.lo, cota: c.hi },
          ),
        )
      }
    }

    // Un cuerpo de masa cero no es un cuerpo, y `respalda` lo dice con todas las
    // letras desde el primer día. ATAQUE QUE LO MOTIVÓ: «pan-de-masa-cero» — con
    // `mass <= 0` en el rol de destino, `revisarIntensiva` comparaba `cantidad · 0`
    // contra lo que entra, y `0 > 0` es falso: un techo de masa igual a cero no
    // vuelve imposible pasar el control de la causa 3, lo APAGA. Y `mass <= 0` cae
    // adentro del rango del catálogo, así que ni `fuera-de-rango` ni la
    // realizabilidad contra el catálogo lo tocaban.
    if (masaMaxima(r) !== undefined && (masaMaxima(r) ?? 0) <= 0) {
      razones.push(
        razon(
          4,
          'rol-irrealizable',
          `«${p.id}»: el rol «${r.name}» pide mass <= ${num(masaMaxima(r) ?? 0)}, y un cuerpo de masa cero no es un cuerpo`,
          { proceso: p.id, rol: r.name, q: 'mass', encontrado: masaMaxima(r) ?? 0, cota: 0 },
        ),
      )
    }

    // Realizabilidad contra el catálogo de sustancias. Éste es el fallo
    // SILENCIOSO que el documento marca: `admit` pasa, el proceso nunca
    // encuentra entradas, y Ánima queda tanteando sin que nadie sepa por qué.
    const pideMateria = r.where.some(
      (t) =>
        spec(phys, t.q) !== undefined &&
        !esDerivada(phys, t.q) &&
        indiceDe(phys).deSustancia.has(t.q),
    )
    if (!pideMateria) continue
    if (candidatasDeRol(r, phys).length === 0) {
      const pedido = r.where.map((t) => `${t.q} ${t.op} ${num(t.v)}`).join(' y ')
      razones.push(
        razon(
          4,
          'rol-irrealizable',
          `«${p.id}»: ninguna de las ${num(phys.substances.size)} sustancias del catálogo cumple ${pedido} para el rol «${r.name}»`,
          { proceso: p.id, rol: r.name, encontrado: 0, cota: 1 },
        ),
      )
    }
  }

  const c = p.completion
  // ─── La duración tiene que ser exacta en la escala del tiempo (ADR II-0008) ──
  //
  // Antes esto pedía UN ENTERO ≥ 1, porque `at` contaba ticks y medio tick no
  // existe. Ahora cuenta SEGUNDOS, y ahí medio segundo sí existe: `extraccion`
  // tarda 1,5 s y `union` 1 s exacto. Lo que no puede existir es una duración
  // que el reloj del mundo no puede medir: el tiempo es exacto hasta el
  // micro-segundo (ver `MICROS_POR_SEGUNDO`) y por debajo de eso una duración
  // no es corta, es inexpresable. Los tres casos que la versión en ticks paraba
  // —0, −1 y 1e-9— siguen parados por esto, y por la misma razón de fondo: una
  // duración que el reloj no alcanza es un proceso que termina cuando le toca y
  // no cuando dice.
  const MICRO = 1 / MICROS_POR_SEGUNDO
  if (c !== undefined) {
    if (!Number.isFinite(c.at) || c.at < MICRO) {
      razones.push(
        razon(
          4,
          'completion-invalida',
          `«${p.id}» completa en ${num(c.at)} s: tiene que ser una duración positiva y exacta en la escala del tiempo del mundo (10⁻⁶ s)`,
          { proceso: p.id, encontrado: c.at, cota: MICRO },
        ),
      )
    }
    if (c.yields.length === 0) {
      advertencias.push(
        razon(4, 'completion-sin-rendimientos', `«${p.id}» tiene completion sin rendimientos: al terminar no pasa nada`, {
          proceso: p.id,
        }),
      )
    }
  }
}

/** Toda cualidad que el proceso nombra, y dónde. Para el cierre dimensional. */
function cualidadesDe(p: Process): readonly { q: QualityId; donde: string }[] {
  const out: { q: QualityId; donde: string }[] = []
  for (const t of p.gate) out.push({ q: t.q, donde: 'la compuerta' })
  for (const r of p.roles) for (const t of r.where) out.push({ q: t.q, donde: `el rol «${r.name}»` })
  for (const e of p.effects) {
    out.push({ q: e.q, donde: `un ${e.k}` })
    if (e.k === 'drive' && e.poweredBy !== undefined) out.push({ q: e.poweredBy.q, donde: 'un poweredBy' })
    if (e.k === 'couple') out.push({ q: e.follows.q, donde: 'un couple' })
  }
  return out
}

/** Todo número que el proceso escribe, y dónde. Un `NaN` acá envenena todo río abajo. */
function numerosDe(p: Process): readonly { v: number; donde: string; q?: QualityId }[] {
  const out: { v: number; donde: string; q?: QualityId }[] = []
  for (const t of p.gate) out.push({ v: t.v, donde: `la compuerta sobre ${t.q}`, q: t.q })
  for (const r of p.roles)
    for (const t of r.where) out.push({ v: t.v, donde: `el rol «${r.name}» sobre ${t.q}`, q: t.q })
  for (const e of p.effects) {
    const tasa = tasaDe(e)
    if (tasa !== undefined) out.push({ v: tasa, donde: `el porSegundo de ${e.q}`, q: e.q })
    if (e.k === 'drive') {
      out.push({ v: e.toward, donde: `el toward de ${e.q}`, q: e.q })
      if (e.poweredBy !== undefined)
        out.push({ v: e.poweredBy.efficiency, donde: 'la eficiencia', q: e.poweredBy.q })
    }
  }
  if (p.completion !== undefined) out.push({ v: p.completion.at, donde: 'el completion.at' })
  // El radio del arreglo. Estaba afuera, y es el número que decide a qué
  // distancia pasan las cosas: `Infinity` es acción a distancia y `NaN` hace que
  // el proceso no se dispare jamás sin que nadie diga nada.
  if (p.arrangement.k === 'within') out.push({ v: p.arrangement.radius, donde: 'el radio del arreglo' })
  return out
}

// ─── Regla 4 · lo que el proceso PROMETE contra lo que hace ──────────────────

/**
 * `establishes` es lo que la fragua lee para PLANIFICAR y lo que arma las aristas
 * del grafo de la regla 5. Nadie lo cruzaba contra los efectos.
 *
 * ATAQUE QUE LA MOTIVÓ: «el charlatán» — un proceso sin efectos y sin
 * rendimientos que promete filo, alcance y 1999 °C. La criatura ejecuta un no-op
 * para conseguir algo que nunca va a tener, y de paso le ensucia la búsqueda de
 * ciclos a todos los demás.
 *
 * Lo que se puede afirmar sin adivinar, y por eso el rechazo es solo éste: una
 * cualidad DERIVADA no la escribe ningún efecto (ver `cualidad-derivada`), así que
 * solo se establece moviendo sus insumos o cambiando la geometría — y la
 * geometría solo la cambia un rendimiento. `union` promete `reach>=2` y tiene un
 * `join`: pasa. El charlatán promete `reach>=16` y no hace nada: no pasa.
 */
function reglaPromesas(p: Process, phys: Physics, razones: Razon[], advertencias: Razon[]): void {
  const promesas = promesasDe(p, phys)
  if (promesas.length === 0) return
  const rendimientos = p.completion?.yields ?? []
  const hayRendimientos = rendimientos.length > 0

  for (const pr of promesas) {
    if (pr.op !== '>=' && pr.op !== '>') continue // prometer que algo BAJA no crea nada
    if (!esDerivada(phys, pr.q)) continue
    if (hayRendimientos) continue
    const insumos = entradasDeDerivada(spec(phys, pr.q)?.derived)
    if (p.effects.some((e) => insumos.qualities.has(e.q))) continue
    // FALSO RECHAZO QUE ABRIÓ ESTA PUERTA: «empuñar una vara». Cinco líneas más
    // abajo está escrito que un proceso puede establecer algo «por el mero hecho de
    // sostener un arreglo (tener algo en la mano ya es un estado del mundo), y
    // rechazarlo cerraría esa puerta sin haberla mirado» — y esta regla la cerraba
    // justo para `reach`, que es LA cualidad de tener algo largo en la mano.
    //
    // Una derivada PURAMENTE GEOMÉTRICA no la escribe ningún efecto y no puede: sale
    // del eje más largo del ensamble, y la puerta no lee geometría. Lo único que sí
    // puede exigir es que haya un cuerpo concreto en el arreglo: un rol que diga de
    // qué está hecho. `empuñar` pincha una vara (rígida y con tracción) y pasa; el
    // charlatán —que promete alcance 16 con un rol que no pide nada— no.
    if (insumos.qualities.size === 0 && insumos.geometrica) {
      if (p.roles.some((r) => pinaLaMateria(r, phys))) continue
    }
    razones.push(
      razon(
        4,
        'promesa-derivada',
        `«${p.id}» promete ${pr.q} ${pr.op} ${num(pr.v)}, y ${pr.q} es derivada: no la escribe ningún efecto. Sin un rendimiento que cambie el cuerpo, ni con un efecto sobre ${[...insumos.qualities].join(', ') || 'su geometría'}, esa promesa es falsa`,
        { proceso: p.id, q: pr.q, encontrado: pr.v },
      ),
    )
  }

  if (p.effects.length === 0 && !hayRendimientos) {
    // Reparo y no rechazo: un proceso puede establecer algo por el mero hecho de
    // sostener un arreglo (tener algo en la mano ya es un estado del mundo), y
    // rechazarlo cerraría esa puerta sin haberla mirado. Pero tiene que estar
    // dicho, porque un no-op que promete mueve a la criatura igual.
    advertencias.push(
      razon(
        4,
        'promesa-sin-respaldo',
        `«${p.id}» promete ${promesas.length === 1 ? 'algo' : `${num(promesas.length)} cosas`} y no tiene ni efectos ni rendimientos: no hace nada`,
        { proceso: p.id },
      ),
    )
  }
}

// ─── Regla 4 · no-dominancia ─────────────────────────────────────────────────

/**
 * Un proceso nuevo no puede ser el mismo que uno que ya existe pero más barato.
 *
 * No es una regla de higiene de biblioteca: es la última puerta del almuerzo
 * gratis. Las reglas 1 a 3 dejan pasar «frotar, pero con eficiencia 0.9» —está
 * declarado, drena de una cuenta conservada, la eficiencia es ≤ 1—, y sin
 * embargo es la misma técnica con el costo bajado a mano. La forma de mejorar la
 * eficiencia del mundo es RECALIBRAR la física (y subir `version`, que invalida
 * los sellos), no proponer un clon.
 */
function reglaNoDominancia(p: Process, phys: Physics, razones: Razon[]): void {
  const conservadas = conservedIn(phys)
  for (const viejo of phys.processes.values()) {
    if (viejo.id === p.id) continue
    if (viejo.arrangement.k !== p.arrangement.k) continue
    if (!prometeLoMismo(p, viejo, phys)) continue
    const exigencia = comparaExigencias(p, viejo, phys)
    if (exigencia === 'incomparable') continue

    let peorEnAlguna = false
    let mejorEn: { q: QualityId; nuevo: number; viejo: number } | undefined
    for (const q of conservadas) {
      const costoNuevo = -saldoDeclarado(p, q, phys)
      const costoViejo = -saldoDeclarado(viejo, q, phys)
      if (costoNuevo > costoViejo) {
        peorEnAlguna = true
        break
      }
      if (costoNuevo < costoViejo && mejorEn === undefined) {
        mejorEn = { q, nuevo: costoNuevo, viejo: costoViejo }
      }
    }
    if (peorEnAlguna) continue

    // El TIEMPO también es precio, y era el que faltaba. Pescar treinta veces más
    // rápido es la misma técnica con el costo bajado a mano, exactamente igual que
    // bajarle la eficiencia al `poweredBy` — y `completion.at` no entraba en la
    // comparación. Un proceso sin `completion` no termina nunca: cuesta infinito.
    const ticksNuevo = ticksDe(p)
    const ticksViejo = ticksDe(viejo)
    if (ticksNuevo > ticksViejo) continue
    const masRapido = ticksNuevo < ticksViejo

    // LA COPIA EXACTA. ATAQUE QUE LA MOTIVÓ: `{...FRICCION, id: 'friccion\u200b'}`,
    // o sea el id con un espacio de ancho cero pegado — carácter por carácter el
    // mismo proceso.
    //
    // El escape va ESCRITO. Acá estaba el carácter de verdad, que es un chiste que
    // se cuenta solo: un comentario que explica un ataque de caracteres invisibles,
    // demostrándolo con uno invisible que el lector no puede ver. Tenía que creerle.
    // Lo encontró el guardián de `world/tests/sin-nombres-especiales.test.ts` el día
    // que aprendió a buscar esta familia.
    // No es `id-repetido` (el id difiere) y no era `dominancia` (no es más barato:
    // es idéntico), así que la puerta admitía copias ilimitadas de cualquier
    // proceso, cada una con su nodo propio en el grafo de la regla 5 —cuyo
    // presupuesto es exponencial— y todas leyéndose «friccion» en el log.
    //
    // Un proceso que promete lo mismo, pide lo mismo, cuesta lo mismo y tarda lo
    // mismo no agrega NADA al mundo: es el caso degenerado de la dominancia, no una
    // excepción a ella.
    const esCopia = mejorEn === undefined && !masRapido && exigencia === 'igual'

    const porQueEs =
      mejorEn !== undefined
        ? `cuesta ${num(mejorEn.nuevo)} de ${mejorEn.q} contra ${num(mejorEn.viejo)}`
        : masRapido
          ? `termina en ${num(ticksNuevo)} ticks contra ${num(ticksViejo)}`
          : esCopia
            ? 'no se distingue de él en nada que la puerta pueda medir'
            : 'le pide menos a sus entradas'
    const cita: Cita =
      mejorEn !== undefined
        ? { proceso: viejo.id, q: mejorEn.q, encontrado: mejorEn.nuevo, cota: mejorEn.viejo }
        : { proceso: viejo.id, encontrado: ticksNuevo, cota: ticksViejo }

    razones.push(
      razon(
        4,
        'dominancia',
        `«${p.id}» domina a «${viejo.id}»: promete lo mismo, no pide más, y ${porQueEs}. Abaratar una técnica es recalibrar la física, no proponer un clon`,
        cita,
      ),
    )
  }
}

/** Sin `completion` el proceso no termina nunca, y eso no es «más rápido». */
function ticksDe(p: Process): number {
  return p.completion === undefined ? Number.POSITIVE_INFINITY : p.completion.at
}

/**
 * ¿El nuevo promete al menos lo mismo que el viejo?
 *
 * Por `establishes`, que es lo declarado, o por los RENDIMIENTOS, que es lo
 * hecho. Lo segundo hacía falta: «pescar con la mano» saca del mismo stock que
 * `extraccion`, en un tick y sin aparejo, y se volvía incomparable con solo no
 * escribir la promesa. Lo que dos procesos hacen no depende de lo que digan.
 */
function prometeLoMismo(nuevo: Process, viejo: Process, phys: Physics): boolean {
  if (contieneTodo(promesasCanonicas(nuevo, phys), promesasCanonicas(viejo, phys))) return true
  const yv = viejo.completion?.yields ?? []
  if (yv.length === 0) return false
  const yn = nuevo.completion?.yields ?? []
  for (const y of yv) if (!yn.some((z) => mismoRendimiento(z, y))) return false
  return true
}

/** Dos rendimientos hacen lo mismo. `at` e `into` cuentan: partir por el grano no
 *  es partir por la juntura, y sacar a la mano no es sacar al suelo. */
function mismoRendimiento(a: Yield, b: Yield): boolean {
  if (a.k !== b.k) return false
  if (a.k === 'split' && b.k === 'split') return a.at === b.at
  if (a.k === 'drawFromStock' && b.k === 'drawFromStock') return a.into === b.into
  return true
}

function contieneTodo(grande: readonly string[], chico: readonly string[]): boolean {
  if (chico.length === 0) return false // no prometer nada no es prometer lo mismo
  for (const s of chico) if (!grande.includes(s)) return false
  return true
}

/**
 * Qué le pide el nuevo a sus entradas comparado con el viejo: `'menos'` cuando le
 * pide estrictamente menos, `'igual'`, o `'incomparable'` cuando le pide más en
 * algo (y entonces no lo domina: es otra técnica, más cara de conseguir).
 *
 * ATAQUE QUE LA MOTIVÓ: la vieja versión arrancaba comparando la CANTIDAD de
 * roles y se rendía si difería. Con eso, un rol «testigo» con `where: []` que no
 * pide nada, no se usa en ningún efecto y no se consume volvía incomparable al
 * clon barato de `friccion` — la última puerta del almuerzo gratis se abría con
 * una línea. Y al revés: un proceso con MENOS roles que el viejo (pescar sin
 * aparejo) exige menos, que es la forma más pura de dominar, y también se
 * escapaba.
 *
 * Un rol de más solo cuenta como exigencia si pide algo o si el proceso lo usa.
 * Decoración no es exigencia.
 */
function comparaRoles(
  rn: Role,
  rv: Role,
  phys: Physics,
): 'menos' | 'igual' | 'incomparable' {
  const qs: QualityId[] = []
  for (const t of rv.where) if (!qs.includes(t.q)) qs.push(t.q)
  for (const t of rn.where) if (!qs.includes(t.q)) qs.push(t.q)
  let menos = false
  for (const q of qs) {
    const cn = cotasDeRol(rn, q, phys)
    const cv = cotasDeRol(rv, q, phys)
    if (cn.lo > cv.lo || cn.hi < cv.hi) return 'incomparable'
    if (cn.lo < cv.lo || cn.hi > cv.hi) menos = true
  }
  return menos ? 'menos' : 'igual'
}

/** Tope del emparejamiento por estructura. Los procesos reales tienen 2 a 4 roles. */
const MAX_ROLES_EMPAREJABLES = 6

/**
 * Empareja roles del viejo con roles del nuevo POR LO QUE PIDEN, cuando los nombres
 * no coinciden. Devuelve, para cada viejo, el índice del nuevo que le corresponde,
 * o −1.
 *
 * ATAQUE QUE LA MOTIVÓ: «frotar-renombrado» y «pescar-a-mano». `comparaExigencias`
 * cruzaba los roles por NOMBRE, y los nombres los elige quien propone y no los
 * verifica nada del mundo: renombrar el rol «a» a «primero» apagaba la última puerta
 * del almuerzo gratis, y llamarle «stock» al «source» de `extraccion` devolvía
 * pescar-con-la-mano en un tick y sin aparejo.
 *
 * Busca el emparejamiento con MÁS pares —sacar un rol de la comparación es lo que el
 * ataque quiere—, recorriendo en orden de declaración para que sea reproducible.
 */
function emparejarPorEstructura(
  viejos: readonly Role[],
  nuevos: readonly Role[],
  phys: Physics,
): readonly number[] {
  const asignacion: number[] = viejos.map(() => -1)
  if (viejos.length === 0 || nuevos.length === 0) return asignacion
  if (viejos.length > MAX_ROLES_EMPAREJABLES || nuevos.length > MAX_ROLES_EMPAREJABLES) {
    return asignacion
  }
  const actual: number[] = viejos.map(() => -1)
  let mejor = -1
  const buscar = (i: number, usados: ReadonlySet<number>, pares: number): void => {
    if (i === viejos.length) {
      if (pares > mejor) {
        mejor = pares
        for (let k = 0; k < actual.length; k += 1) asignacion[k] = actual[k]!
      }
      return
    }
    for (let j = 0; j < nuevos.length; j += 1) {
      if (usados.has(j)) continue
      if (comparaRoles(nuevos[j]!, viejos[i]!, phys) === 'incomparable') continue
      actual[i] = j
      buscar(i + 1, new Set([...usados, j]), pares + 1)
    }
    actual[i] = -1
    buscar(i + 1, usados, pares)
  }
  buscar(0, new Set<number>(), 0)
  return asignacion
}

function comparaExigencias(
  nuevo: Process,
  viejo: Process,
  phys: Physics,
): 'menos' | 'igual' | 'incomparable' {
  let menos = false
  const emparejados = new Set<string>()
  const viejosSinPar: Role[] = []

  // Primero por nombre: si dos roles se llaman igual, hablan de lo mismo y la
  // comparación es directa (y si ahí el nuevo pide más, ya no lo domina).
  for (const rv of viejo.roles) {
    const rn = nuevo.roles.find((r) => baseRoleName(r.name) === baseRoleName(rv.name))
    if (rn === undefined) {
      viejosSinPar.push(rv)
      continue
    }
    const c = comparaRoles(rn, rv, phys)
    if (c === 'incomparable') return 'incomparable'
    if (c === 'menos') menos = true
    emparejados.add(baseRoleName(rn.name))
  }

  // Y después por estructura, para los que quedaron sueltos de los dos lados.
  const nuevosSinPar = nuevo.roles.filter((r) => !emparejados.has(baseRoleName(r.name)))
  const asignacion = emparejarPorEstructura(viejosSinPar, nuevosSinPar, phys)
  const nuevosTomados = new Set<number>()
  for (let i = 0; i < viejosSinPar.length; i += 1) {
    const j = asignacion[i] ?? -1
    if (j < 0) {
      // No pedir el rol es no pedir nada de él: exige menos.
      menos = true
      continue
    }
    nuevosTomados.add(j)
    if (comparaRoles(nuevosSinPar[j]!, viejosSinPar[i]!, phys) === 'menos') menos = true
  }

  const usados = new Set<string>(rolesUsados(nuevo))
  for (let j = 0; j < nuevosSinPar.length; j += 1) {
    if (nuevosTomados.has(j)) continue
    const rn = nuevosSinPar[j]!
    // Un rol de más solo cuenta como exigencia si pide algo o si el proceso lo usa.
    // Decoración no es exigencia.
    if (rn.where.length > 0 || usados.has(rn.name)) return 'incomparable'
  }
  return menos ? 'menos' : 'igual'
}

/** Los roles que algún efecto o algún rendimiento nombra. Los demás son adorno. */
function rolesUsados(p: Process): readonly string[] {
  const out: string[] = []
  const push = (n: string | undefined): void => {
    if (n !== undefined && !out.includes(n)) out.push(n)
  }
  for (const e of p.effects) {
    switch (e.k) {
      case 'drain':
        push(e.on)
        break
      case 'drive':
        push(e.on)
        push(e.poweredBy?.from)
        break
      case 'transfer':
        push(e.from)
        push(e.to)
        break
      case 'couple':
        push(e.on)
        push(e.follows.of)
        break
    }
  }
  for (const y of p.completion?.yields ?? []) {
    switch (y.k) {
      case 'transmute':
      case 'split':
        push(y.role)
        break
      case 'join':
        push(y.a)
        push(y.b)
        push(y.via)
        break
      case 'drawFromStock':
        push(y.of)
        break
    }
  }
  return out
}

// ─── Regla 5 · ciclos ────────────────────────────────────────────────────────
//
// EL HALLAZGO, y confirma el aviso del análisis previo: `hasProfitableCycle`
// como puerta NO es una propiedad del grafo.
//
// La demostración es corta. Después de las reglas 1 y 2, ningún proceso puede
// subir una cualidad conservada: los `drive` hacia arriba sobre conservadas
// están prohibidos, los `couple` sobre conservadas también, los `drain` solo
// bajan y los `transfer` mueven sin crear (y si el origen no respalda, la regla
// 1 los rechaza de entrada). O sea que el saldo declarado de todo proceso
// admitido es ≤ 0 en toda cuenta conservada, y la suma de cualquier ciclo
// también. Salvo por UNA cosa: `drawFromStock`, que es el agujero del dios.
//
// Entonces todo ciclo rentable, o pasa por un aporte del dios —y ahí el saldo
// depende del STOCK y de la tasa de reposición del bioma, que son estado del
// mundo y no del grafo— o no es rentable. Rechazar el primero mataría a
// `extraccion`, que es pescar, que es la única forma de comer.
//
// Lo que queda, y es lo que se implementa:
//
//   · un ciclo con aporte se ADVIERTE, con los ids, y se dice que su saldo no se
//     puede decidir acá. Es la advertencia que le corresponde a la simulación,
//     no a la puerta.
//   · un ciclo sin aporte con saldo positivo se RECHAZA. Bajo las reglas 1 y 2
//     no debería existir nunca: es un canario. Si alguna vez salta, significa
//     que la regla 1 tiene un agujero — y de hecho salta con procesos viejos que
//     entraron bajo una física anterior, que es el caso real que esto atrapa.
//
// El grafo se sobre-aproxima a propósito (ver `habilita`): más aristas, más
// ciclos, más advertencias. Para una puerta, equivocarse de más es el lado
// barato.
//
// Y la otra mitad del aviso también es cierta: los efectos son `porSegundo` sobre
// cantidades que dependen del estado, así que el saldo de A→B→A depende de la
// temperatura ambiente y no solo del proceso. `saldoDeclarado` lo resuelve
// tomando el trabajo MÁXIMO que cada efecto puede hacer (acotado por el objetivo
// y por la duración), lo que deja el saldo por DEBAJO de su cota superior real.
// La consecuencia hay que decirla en voz alta: la regla 5 es CORRECTA pero
// INCOMPLETA. Si rechaza, el ciclo rinde de verdad en algún estado del mundo; si
// no rechaza, puede haber estados en los que rinda igual. Detectar eso último
// pide simular, y simular no es lo que hace una puerta.

export interface Promesa {
  q: QualityId
  op: QualityTest['op']
  v: number
}

/**
 * Los operadores que el parser reconoce, del más largo al más corto para que `>=`
 * gane antes que `>`.
 *
 * ATAQUE QUE AGREGÓ LOS DOS ÚLTIMOS: «charlatán-unicode». El parser buscaba `'>='`
 * y lo que no parsea «no promete nada», así que un `establishes` escrito con el
 * signo `≥` se llevaba puestos LOS DOS controles de golpe —el rechazo
 * `promesa-derivada` y el reparo `promesa-sin-respaldo`— y un proceso sin efectos
 * ni rendimientos que promete alcance 16 volvía a entrar sin que la puerta dijera
 * absolutamente nada.
 */
const OPERADORES: readonly { texto: string; op: QualityTest['op'] }[] = [
  { texto: '>=', op: '>=' },
  { texto: '<=', op: '<=' },
  { texto: '≥', op: '>=' },
  { texto: '≤', op: '<=' },
  { texto: '>', op: '>' },
  { texto: '<', op: '<' },
]

/** `'temperature>=400'` → una promesa. Lo que no parsea no promete nada. */
function parsePromesa(s: string, phys: Physics): Promesa | undefined {
  for (const { texto, op } of OPERADORES) {
    const i = s.indexOf(texto)
    if (i < 0) continue
    const q = s.slice(0, i).trim() as QualityId
    const v = Number(s.slice(i + texto.length).trim())
    if (!Number.isFinite(v)) return undefined
    if (spec(phys, q) === undefined) return undefined
    return { q, op, v }
  }
  return undefined
}

/** Los trozos de `establishes`, ya separados por `&` y sin espacios de sobra. */
function trozosDe(p: Process): readonly string[] {
  const out: string[] = []
  for (const bruto of p.establishes) {
    for (const trozo of bruto.split('&')) {
      const s = trozo.trim()
      if (s.length > 0) out.push(s)
    }
  }
  return out
}

export function promesasDe(p: Process, phys: Physics): readonly Promesa[] {
  const out: Promesa[] = []
  for (const s of trozosDe(p)) {
    const pr = parsePromesa(s, phys)
    if (pr !== undefined) out.push(pr)
  }
  return out
}

/**
 * Lo que el proceso promete, en forma CANÓNICA: lo que parsea se reescribe igual
 * siempre, y lo que no parsea queda tal cual.
 *
 * ATAQUE QUE LA MOTIVÓ: «frotar-espaciado». La no-dominancia comparaba los strings
 * crudos de `establishes` con `Array.includes`, así que escribir
 * `'temperature >= 400'` en vez de `'temperature>=400'` volvía incomparable al clon
 * barato de `friccion`. Era una contradicción interna medible: la puerta TIENE un
 * parser de promesas, lo usa para la regla 5 y para `promesa-derivada`, y no lo
 * usaba para la regla 4.
 */
function promesasCanonicas(p: Process, phys: Physics): readonly string[] {
  const out: string[] = []
  for (const s of trozosDe(p)) {
    const pr = parsePromesa(s, phys)
    out.push(pr === undefined ? s : `${pr.q}${pr.op}${String(pr.v)}`)
  }
  return out
}

/**
 * Las promesas que el proceso HACE, no las que dice: las de `establishes` más las
 * que se leen de los propios `drive`.
 *
 * ATAQUE QUE LA MOTIVÓ, y es de una línea: la regla 5 arma su grafo con
 * `establishes`, que es un array de strings que escribe quien propone. Borrarlo
 * deja al proceso sin aristas de salida, o sea fuera de todo ciclo, o sea
 * invisible para la única regla que puede ver el lazo. El MISMO proceso que se
 * rechaza citando «82.857 de stamina por vuelta» entra limpio si no promete nada
 * por escrito, y en el mundo hace exactamente lo mismo.
 *
 * Un `drive` hacia arriba promete el `toward` y no hay nada que declarar: está en
 * el efecto. Un `drive` hacia abajo promete el techo.
 */
function promesasEfectivas(p: Process, phys: Physics): readonly Promesa[] {
  const out: Promesa[] = [...promesasDe(p, phys)]
  const agregar = (pr: Promesa): void => {
    if (!Number.isFinite(pr.v)) return
    if (!out.some((x) => x.q === pr.q && x.op === pr.op && x.v === pr.v)) out.push(pr)
  }
  for (const e of p.effects) {
    if (spec(phys, e.q) === undefined) continue
    if (e.k === 'drive') {
      if (!Number.isFinite(e.toward)) continue
      const sube = e.toward > pisoEfectivo(p, e.q, e.on, phys)
      agregar({ q: e.q, op: sube ? '>=' : '<=', v: e.toward })
      continue
    }
    // ATAQUE QUE AGREGÓ LAS OTRAS DOS FORMAS: «el lazo invisible». La reparación
    // anterior cerró esto para los `drive` —«borrar un string ya no borra una
    // arista»— y lo dejó abierto para `transfer` y `couple`: un proceso que solo
    // transfiere no tenía ninguna arista de salida, o sea que quedaba fuera de todo
    // ciclo, o sea invisible para la ÚNICA regla que puede ver un lazo. Quien
    // propone elegía si su proceso se dejaba mirar.
    //
    // Un `transfer` lleva la cualidad del origen al destino: lo que el origen
    // garantiza puede aparecer del otro lado. Un `couple` escribe lo que dice
    // `techoQueEscribeElAcople`. Las dos son sobre-aproximaciones, y para el grafo
    // de la regla 5 eso es el lado barato: más aristas, más ciclos, más avisos.
    if (e.k === 'transfer') {
      const lo = cotasDeRol(rolDe(p, e.from), e.q, phys).lo
      if (Number.isFinite(lo)) agregar({ q: e.q, op: '>=', v: lo })
      continue
    }
    if (e.k === 'couple') {
      const techo = techoQueEscribeElAcople(p, e, phys)
      if (Number.isFinite(techo)) agregar({ q: e.q, op: '>=', v: techo })
    }
  }
  return out
}

function promesaSatisface(pr: Promesa, t: QualityTest): boolean {
  if (pr.q !== t.q) return false
  const sube = pr.op === '>=' || pr.op === '>'
  switch (t.op) {
    case '>=':
      return sube && pr.v >= t.v
    case '>':
      return sube && (pr.op === '>' ? pr.v >= t.v : pr.v > t.v)
    case '<=':
      return !sube && pr.v <= t.v
    case '<':
      return !sube && (pr.op === '<' ? pr.v <= t.v : pr.v < t.v)
  }
}

/**
 * ¿Lo que `a` deja hecho le sirve a `b` para empezar?
 *
 * SOBRE-APROXIMACIÓN DECLARADA: alcanza con que `a` satisfaga UN test de UN rol
 * de `b`. Exigir el rol completo dejaría fuera casi todas las aristas reales
 * —`union` promete `reach>=2` y `freeStrandEnds>=1`, y lo segundo ni siquiera es
 * un `QualityId`— y un grafo sin aristas no encuentra ningún ciclo, que es la
 * peor forma de pasar la regla 5.
 */
/**
 * Un test que TODO cuerpo cumple. `stamina >= 0` no lo habilita nadie: ya está.
 *
 * FALSO RECHAZO QUE LO MOTIVÓ: `comer` pide un actor con `stamina >= 0` —que es lo
 * honesto: se come con hambre— y promete `stamina>=50`, así que se habilitaba A SÍ
 * MISMO y la regla 5 le encontraba un ciclo de largo 1. Una arista tiene que
 * significar que un proceso deja el mundo listo para otro; un test que se cumple
 * siempre no lo deja listo, ya lo estaba.
 */
function testTrivial(t: QualityTest, phys: Physics): boolean {
  const s = spec(phys, t.q)
  if (s === undefined) return false
  if (t.op === '>=' && t.v <= s.range[0]) return true
  if (t.op === '<=' && t.v >= s.range[1]) return true
  return false
}

function habilita(a: Process, b: Process, phys: Physics): boolean {
  const promesas = promesasEfectivas(a, phys)
  if (promesas.length === 0) return false
  for (const r of b.roles) {
    for (const t of r.where) {
      if (testTrivial(t, phys)) continue
      for (const pr of promesas) if (promesaSatisface(pr, t)) return true
    }
  }
  return false
}

export interface Ciclo {
  /** Los ids en orden, empezando y terminando en el proceso que se está juzgando. */
  procesos: readonly ProcessId[]
  /** Los que traen materia del dios. Si hay alguno, el saldo no se decide acá. */
  aportes: readonly ProcessId[]
  /** Saldo declarado por cuenta conservada, sumado a lo largo del ciclo. */
  saldos: ReadonlyMap<QualityId, number>
}

export interface BusquedaDeCiclos {
  ciclos: readonly Ciclo[]
  /**
   * La búsqueda se cortó por presupuesto y puede haber ciclos que no vio.
   *
   * Enumerar caminos simples es exponencial en el peor caso, y el grafo crece
   * con cada proceso que la criatura aprende. Un juez que se cuelga es peor que
   * uno que avisa: se corta, y se DICE que se cortó. Eso es exactamente lo que
   * la auditoría le reclamaba a los «~5 ms» de la regla 5, que estaban afirmados
   * y no medidos.
   */
  truncada: boolean
}

/**
 * Los ciclos que PASAN POR `p`. Los demás ya existían y ya fueron juzgados
 * cuando entraron: un proceso nuevo solo puede cerrar ciclos que lo incluyan.
 */
export function ciclosPor(p: Process, phys: Physics): BusquedaDeCiclos {
  const nodos: Process[] = []
  for (const v of phys.processes.values()) if (v.id !== p.id) nodos.push(v)
  nodos.push(p)

  // Los lazos sobre sí mismo NO se excluyen: «deshilachar lo deshilachado» es un
  // ciclo de largo 1 y merece la misma cuenta que cualquier otro. Que su saldo
  // sea negativo (cuesta stamina) es un resultado, no una excepción escrita.
  const salidas = new Map<ProcessId, ProcessId[]>()
  for (const a of nodos) {
    const dest: ProcessId[] = []
    for (const b of nodos) if (habilita(a, b, phys)) dest.push(b.id)
    salidas.set(a.id, dest)
  }
  const porId = new Map<ProcessId, Process>()
  for (const n of nodos) porId.set(n.id, n)

  const conservadas = conservedIn(phys)
  const ciclos: Ciclo[] = []
  const camino: ProcessId[] = [p.id]
  const enCamino = new Set<ProcessId>([p.id])
  let pasos = 0
  let truncada = false

  const caminar = (actual: ProcessId): void => {
    for (const sig of salidas.get(actual) ?? []) {
      pasos += 1
      if (pasos > MAX_STEPS) {
        truncada = true
        return
      }
      if (sig === p.id) {
        ciclos.push(resumirCiclo(camino, porId, conservadas, phys))
        if (ciclos.length >= MAX_CYCLES) {
          truncada = true
          return
        }
        continue
      }
      if (enCamino.has(sig)) continue
      if (camino.length >= nodos.length) continue
      camino.push(sig)
      enCamino.add(sig)
      caminar(sig)
      camino.pop()
      enCamino.delete(sig)
      if (truncada) return
    }
  }
  caminar(p.id)
  return { ciclos, truncada }
}

function resumirCiclo(
  camino: readonly ProcessId[],
  porId: ReadonlyMap<ProcessId, Process>,
  conservadas: readonly QualityId[],
  phys: Physics,
): Ciclo {
  const procesos = [...camino, camino[0]!]
  const aportes: ProcessId[] = []
  const saldos = new Map<QualityId, number>()
  for (const q of conservadas) saldos.set(q, 0)
  for (const id of camino) {
    const proc = porId.get(id)
    if (proc === undefined) continue
    for (const y of proc.completion?.yields ?? []) {
      if (y.k === 'drawFromStock' && !aportes.includes(id)) aportes.push(id)
    }
    for (const q of conservadas) saldos.set(q, (saldos.get(q) ?? 0) + saldoDeclarado(proc, q, phys))
  }
  return { procesos, aportes, saldos }
}

function reglaCiclos(p: Process, phys: Physics, razones: Razon[], advertencias: Razon[]): void {
  const busqueda = ciclosPor(p, phys)
  if (busqueda.truncada) {
    advertencias.push(
      razon(
        5,
        'ciclo-busqueda-truncada',
        `la búsqueda de ciclos por «${p.id}» se cortó por presupuesto: puede haber ciclos que la puerta no vio`,
        { proceso: p.id },
      ),
    )
  }
  for (const c of busqueda.ciclos) {
    const ruta = c.procesos.join(' → ')
    if (c.aportes.length > 0) {
      advertencias.push(
        razon(
          5,
          'ciclo-con-aporte',
          `ciclo con aporte del dios: ${ruta}. El saldo depende del stock de «${c.aportes.join(', ')}» y de su reposición, que son estado del mundo: no se decide acá`,
          { proceso: c.aportes[0]! },
        ),
      )
      continue
    }
    for (const [q, saldo] of c.saldos) {
      if (saldo <= 0) continue
      razones.push(
        razon(
          5,
          'ciclo-rentable',
          `ciclo rentable sin aporte del dios: ${ruta} deja ${num(saldo)} de ${q} por vuelta, y ${q} es conservada`,
          { proceso: p.id, q, encontrado: saldo, cota: 0 },
        ),
      )
    }
  }
}

// ─── La puerta ───────────────────────────────────────────────────────────────

/**
 * ¿Entra este proceso a la física?
 *
 * Se corren las cinco reglas ENTERAS y se devuelven todas las razones juntas.
 * Un rechazo por vez obligaría a la fragua a N viajes al modelo para arreglar N
 * cosas que ya se sabían en el primero.
 */
export function admit(p: Process, phys: Physics): Verdict {
  const razones: Razon[] = []
  const advertencias: Razon[] = []

  const previo = phys.processes.get(p.id)
  if (previo !== undefined && previo !== p) {
    // Readmitir el MISMO objeto es revalidar, y eso está bien. Otro objeto con
    // el mismo id le taparía el proceso al mundo sin que nadie se entere.
    razones.push(
      razon(4, 'id-repetido', `ya existe un proceso con id «${p.id}» y no es éste`, { proceso: p.id }),
    )
  }

  reglaConservacion(p, phys, razones)
  reglaNadaSubeGratis(p, phys, razones, advertencias)
  reglaEnvolventes(p, phys, razones)
  reglaCierreYCotas(p, phys, razones, advertencias)
  reglaRealizabilidad(p, phys, razones, advertencias)
  reglaPromesas(p, phys, razones, advertencias)
  reglaNoDominancia(p, phys, razones)
  reglaCiclos(p, phys, razones, advertencias)

  return { ok: razones.length === 0, razones, advertencias }
}

/** Atajo para los tests y para el juez: ¿alguna razón con este código? */
export function tieneCodigo(v: Verdict, c: Codigo): boolean {
  for (const r of v.razones) if (r.codigo === c) return true
  return false
}

/** Lo mismo sobre los reparos, que no cierran la puerta pero hay que poder leer. */
export function tieneReparo(v: Verdict, c: Codigo): boolean {
  for (const r of v.advertencias) if (r.codigo === c) return true
  return false
}
