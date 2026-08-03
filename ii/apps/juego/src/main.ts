// ─── EL JUEGO, MÍNIMO Y CORRIENDO ───────────────────────────────────────────
//
// Todo lo que hay en `@anima/dibujo` se construyó y se midió **sin un solo
// consumidor**: el mapa se emitía desde un test, los sprites nunca se pedían de
// verdad y el surtidor no lo llamaba nadie. Esto es el consumidor.
//
// ─── LAS DOS COSAS QUE ESTE ARCHIVO TIENE QUE HACER BIEN ───────────────────
//
//   1. **el tick y el cuadro son cosas distintas.** El mundo avanza a 20 Hz
//      pase lo que pase con la pantalla; el navegador dibuja cuando puede. Un
//      bucle que los mezcle hace que la partida dependa de la placa de video, y
//      con eso el replay muere. Por eso hay un acumulador y no un `tick()` por
//      cuadro;
//   2. **`surtir` corre FUERA del tick.** Es la única parte asíncrona de todo
//      esto y va entre cuadros, nunca entre el `tick()` y el dibujo.
//
// ─── Y LA VELOCIDAD 0 ESTÁ DESDE EL PRIMER DÍA, A PROPÓSITO ────────────────
//
// Una pestaña abierta avanza la partida real. Este proyecto ya perdió una
// generación por mirar el mundo mientras corría, así que la pausa no es una
// comodidad que se agrega después: es lo primero que tiene que existir.

import { Partida } from '@anima/perceive'
import { vivir } from '@anima/mind'
import { escenaDe, relojDe } from '@anima/world'
import type { RenderDescriptor } from '@anima/world'
import { ESQUEMAS } from '@anima/plan'
import {
  CELDA,
  DE_FABRICA,
  cargarDeposito,
  depositoHttp,
  glifoDe,
  mapaDe,
  pintar,
  spritesEnMemoria,
  surtir,
  type Proveedor,
  type Sprites,
} from '@anima/dibujo'

import { cargar, claveDe, guardar } from '@anima/store'
import { conQuien } from './con-quien.js'
import type { ConQuien } from './con-quien.js'
import { encuadrePara } from './el-encuadre.js'
import type { Espacio } from './el-encuadre.js'
import { loQueSeVeDe } from './criatura.js'
import {
  celdaEnEscena,
  describir,
  firmaDe,
  loSenaladoEn,
  piePara,
  ubicarElCartel,
  ubicarElGlobo,
} from './lo-senalado.js'
import type { Senalado } from './lo-senalado.js'
import { depositoIndexedDB } from './deposito-indexeddb.js'
import { Ordenes, enCastellano } from './ordenes.js'
import { agrupar, clausulasDe, firmaDelRegistro } from './turnos.js'
import type { Paso, Turno } from './turnos.js'
import { sugerencias } from './sugerencias.js'
import { dibujanteDePrueba } from './dibujante-de-prueba.js'
import { proveedorDelDeposito } from './proveedor-del-deposito.js'
import { Lienzo } from './lienzo.js'
import { PHYS, arrancar } from './mundo.js'

const SEMILLA = 20260727n
const HZ = 20
const MS_POR_TICK = 1000 / HZ
/** Cada cuántos cuadros se le pregunta al depósito por lo que falta. */
const CUADROS_ENTRE_SURTIDOS = 120
/**
 * Cada cuántos cuadros se vuelve a preguntar quién hay del otro lado. A 60 Hz
 * son quince segundos, y el número sale de qué se está mirando: prender o
 * apagar el depósito es algo que hace una persona a mano, no el mundo. Sondear
 * más seguido gastaría un viaje por segundo para ver lo mismo.
 */
const CUADROS_ENTRE_SONDEOS = 900
/**
 * Cada cuántos cuadros se guarda la partida. A 60 Hz son unos cinco segundos.
 *
 * El número sale de qué se pierde si el navegador se cierra de golpe: cinco
 * segundos de mundo son cien ticks, o sea que lo peor que puede pasar es
 * repetir un pedacito. Guardar cada cuadro escribiría sesenta veces por segundo
 * para no ganar nada — y aunque pase fuera del tick, sigue siendo el disco.
 */
const CUADROS_ENTRE_GUARDADOS = 300

const $ = (id: string): HTMLElement => {
  const e = document.getElementById(id)
  if (e === null) throw new Error(`falta #${id} en el html`)
  return e
}

// ─── LO GUARDADO, ANTES QUE NADA ──────────────────────────────────────────
//
// El punto 9 de la vertical: cerrar y reabrir sin perder la sesión. La carga va
// ACÁ y no después de arrancar el bucle, y el orden es la mitad del asunto: con
// la partida ya corriendo, restaurar sería reemplazarle el mundo abajo de los
// pies a algo que ya avanzó ticks.
//
// El `await` de arriba de todo es legal por lo mismo que en `@anima/store`: la
// regla 2 protege al TICK, y esto pasa antes de que exista el primer tick.
//
// Si el navegador no deja usar IndexedDB —modo privado, permisos, cuota— el
// juego arranca igual con una partida nueva. Es la misma decisión que con el
// depósito de sprites: nada de esto puede apagar el juego.
const QUIEN = 'ana'
const baul = depositoIndexedDB()
let guardadoAlArrancar: Awaited<ReturnType<typeof cargar>>
try {
  guardadoAlArrancar = await cargar(baul, QUIEN)
} catch (e) {
  console.warn('[guardado] no se pudo leer, se arranca de cero:', e)
}

const { state, parada } = arrancar(SEMILLA)
const partida = new Partida(guardadoAlArrancar?.state ?? state)
// Las dos cosas que una partida cargada tiene que recuperar: lo que aprendió y de
// qué estaban hablando. La segunda entró con el C1 de la convergencia, y sin ella
// reabrir la pestaña devolvía el mundo y borraba la conversación entera.
const ordenes = new Ordenes(partida, QUIEN, PHYS, {
  ...(guardadoAlArrancar === undefined
    ? {}
    : { memoria: guardadoAlArrancar.creencias, charla: guardadoAlArrancar.charla }),
  // Y el encargo en curso (C3): sin esto, recargar a mitad de un pedido de
  // varias partes lo pierde entero y hay que volver a pedirlo.
  ...(guardadoAlArrancar?.encargo === undefined ? {} : { encargo: guardadoAlArrancar.encargo }),
})
const canvas = $('mapa') as HTMLCanvasElement
const lienzo = new Lienzo(canvas)
canvas.style.cursor = 'crosshair'
canvas.addEventListener('click', mirar)
// Los de fábrica primero: la criatura viene con el juego y no se le pide a
// nadie. Cargados antes que el depósito, así «primero gana» los protege.
const sprites: Sprites = spritesEnMemoria(DE_FABRICA)

// ─── El depósito, si está ─────────────────────────────────────────────────
//
// Si no contesta, no pasa nada: el juego dibuja procedural. Es la regla 3 del
// surtidor y acá se ve cuánto vale — la página arranca igual con el backend
// apagado, y el único síntoma es que los dibujos son los del motor.
const DONDE_EL_DEPOSITO = 'http://localhost:5190'
const deposito = depositoHttp(DONDE_EL_DEPOSITO)
let hayDeposito = false
let preguntando = false

/**
 * LAS DOS LUCES, y acá no se decide nada: todo lo que hay que pensar —qué luz,
 * qué rótulo, qué dice el detalle— está en `con-quien.ts`, que se prueba sin
 * abrir un navegador. Esto escribe tres clases y dos textos.
 */
function pintarEnlace(c: ConQuien): void {
  for (const [quien, l] of [['codex', c.codex], ['claude', c.claude]] as const) {
    const caja = $(`lampara-${quien}`)
    caja.classList.remove('buscando', 'vive', 'no')
    caja.classList.add(l.luz)
    caja.title = l.detalle
    $(`rol-${quien}`).textContent = l.rol
  }
  $('enlace-nota').textContent = c.nota
}

/**
 * PREGUNTARLE AL DEPÓSITO CÓMO ESTÁ, que ahora son dos cosas de un viaje:
 * cuántos dibujos tiene y con qué modelos está la máquina que lo corre.
 *
 * `cargarDeposito` devuelve CUÁNTOS entraron y se traga los errores a propósito
 * —un depósito caído no puede apagar el juego—, así que su cero no distingue
 * «está vacío» de «no está». Por eso el catálogo se pide recién después de que
 * `/salud` contestó.
 *
 * Y se pregunta cada tanto, no una sola vez al abrir. El cambio se paga solo:
 * antes, levantar el depósito con el juego ya abierto no servía de nada hasta
 * recargar la página, porque el único intento había pasado y fallado.
 */
async function mirarElDeposito(): Promise<void> {
  if (preguntando) return
  preguntando = true
  try {
    const r = await fetch(`${DONDE_EL_DEPOSITO}/salud`)
    if (!r.ok) throw new Error(`salud contestó ${String(r.status)}`)
    const salud: unknown = await r.json()
    pintarEnlace(conQuien(salud))
    if (!hayDeposito) {
      hayDeposito = true
      $('deposito').textContent = `${String(await cargarDeposito(sprites, deposito))} dibujos`
    }
  } catch {
    // Sin depósito no hay forma de saber qué modelos hay: las dos luces se
    // apagan juntas y la nota aclara que el juego sigue. Ver `con-quien.ts`.
    hayDeposito = false
    pintarEnlace(conQuien(undefined))
    $('deposito').textContent = 'apagado (se juega igual)'
  } finally {
    preguntando = false
  }
}

void mirarElDeposito()

/**
 * ARRANCA EN PAUSA, y el guardado automático es lo que lo convirtió en obligación.
 *
 * El encabezado de este archivo ya decía que la velocidad 0 tenía que existir
 * desde el primer día —una pestaña abierta avanza la partida real, y este
 * proyecto ya perdió una generación por mirar el mundo mientras corría—, pero el
 * juego igual arrancaba en ×1.
 *
 * Con la partida persistiendo sola cada cinco segundos, eso pasó de incómodo a
 * peligroso: abrir la pestaña y olvidarse ya no cuesta una sesión de mirar,
 * **escribe lo que pasó**. Que la primera decisión sea del jugador.
 */
let velocidad = 0
let zoom = 2
let acumulado = 0
let ultimo = performance.now()
let cuadros = 0
let msDelCuadro = 0
let surtiendo = false
let guardando = false
/** El tick del último guardado escrito. `-1` es «todavía ninguno en esta sesión». */
let guardadoEn = -1
/**
 * EL ÚLTIMO TURNO DE CHARLA ESCRITO, y hace falta porque el tick dejó de alcanzar.
 *
 * La guarda de abajo era «si el mundo no avanzó, no reescribas»: con la partida
 * en pausa el estado es el mismo y guardar sería escribir en disco para dejar lo
 * mismo. Con el log conversacional adentro del guardado **eso dejó de ser
 * cierto**: hablarle a la criatura en pausa cambia lo que hay que guardar y no
 * mueve un solo tick, así que tres turnos escritos con el mundo quieto se perdían
 * enteros al recargar. El guardado tiene dos motivos ahora, y se miran los dos.
 */
let charlaGuardadaEn = 0

const botones = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-vel]'))
for (const b of botones) {
  b.addEventListener('click', () => {
    velocidad = Number(b.dataset['vel'] ?? '1')
    for (const otro of botones) otro.classList.toggle('on', otro === b)
  })
}

const zooms = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-zoom]'))
for (const b of zooms) {
  b.addEventListener('click', () => {
    zoom = Number(b.dataset['zoom'] ?? '2')
    for (const otro of zooms) otro.classList.toggle('on', otro === b)
    $('zoom-dice').textContent = `×${String(zoom)}`
    // El zoom cambia cuánto ocupa una celda, así que cambia cuántas entran. Sin
    // esto, el ×4 dibujaría el mismo encuadre cuatro veces más grande y se
    // saldría de la ventana — que es lo que hacía cuando el encuadre era fijo.
    remedirElEncuadre()
  })
}

// ─── EL ENCUADRE SALE DE LA VENTANA, Y NO DE UNA CONSTANTE ─────────────────
//
// Era `const RADIO = 7`: quince por quince celdas, siempre, y en una pantalla
// apaisada eso dejaba setecientos píxeles muertos a la derecha del mapa. La
// cuenta de cuánto entra vive en `el-encuadre.ts` —y por eso se puede probar sin
// navegador—; acá está la otra mitad, la que sí necesita uno: **medir el lugar**.
//
// ─── Y AHORA EL LUGAR ES LA VENTANA ENTERA ─────────────────────────────────
//
// Esto eran diez renglones explicando por qué el ancho salía de `#columna` y el
// alto de la ventana menos la tapa del canvas. Todo eso existía por una sola
// razón: **el mapa vivía en una celda de una grilla de dos columnas**, así que
// había que preguntarle a la celda cuánto le habían dado. El rodeo era correcto
// y el problema que esquivaba era real —preguntarle al canvas, o a `.mapa-caja`
// que mide lo que mide su contenido, es preguntarle al mapa cuánto quiere medir
// el mapa, y esa respuesta se congela en el primer cuadro—.
//
// Con el mapa como pantalla el rodeo se cae solo: el tablero es `inset: 0` sobre
// una caja del tamaño de la ventana, o sea que **la ventana ES la medida** y no
// hay ningún elemento intermedio al que preguntarle. La trampa del observador
// que crece por lo que él mismo agranda queda imposible por construcción, y no
// evitada con cuidado.
//
// `ORILLA_DE_ABAJO` se fue con lo mismo: existía para que el mapa no quedara
// pegado al borde inferior de la página. Ahora lo que hay abajo no es un borde,
// es el mapa siguiendo hasta el final — lo que se apoya encima flota, no empuja.
function medirElEspacio(): Espacio {
  return { ancho: window.innerWidth, alto: window.innerHeight }
}

let encuadre = encuadrePara(medirElEspacio(), zoom)

/**
 * REMEDIR, y por qué esto NO es un `ResizeObserver`.
 *
 * Un observador sobre el contenedor se dispararía por cambios que el propio mapa
 * causa —el canvas crece, la página se hace más alta, aparece la barra de
 * scroll, el contenedor se angosta quince píxeles, el mapa se vuelve a calcular—
 * y ése es el bucle de realimentación clásico de los observadores de tamaño.
 *
 * El evento `resize` de la ventana no tiene ese problema: lo dispara la persona,
 * no el contenido. Los otros dos momentos en que la cuenta cambia son el zoom y
 * el arranque, y los dos llaman a mano.
 */
function remedirElEncuadre(): void {
  encuadre = encuadrePara(medirElEspacio(), zoom)
}

window.addEventListener('resize', remedirElEncuadre)

// ─── El dibujante ──────────────────────────────────────────────────────────
//
// El botón existe porque **pedir dibujos cuesta plata** y no puede ser algo que
// pase solo mientras alguien mira. Cuando haya un modelo de verdad, lo que
// cambia es UNA línea —cuál proveedor entra en `surtir`— y no el ciclo.
function pedirDibujos(proveedor: Proveedor, tope: number): void {
  if (surtiendo) return
  surtiendo = true
  $('surtido').textContent = 'dibujando…'
  void surtir(sprites, { phys: PHYS, proveedor, deposito, tope })
    .then((r) => {
      $('surtido').textContent =
        `${String(r.delModelo.length)} nuevos · ${String(r.delDeposito.length)} del depósito` +
        (r.rechazados.length > 0 ? ` · ${String(r.rechazados.length)} rechazados` : '')
      for (const x of r.rechazados) console.warn(`[dibujo] ${x.clave}: ${x.porque}`)
    })
    .finally(() => {
      surtiendo = false
    })
}

// Codex de a UNO por vez y no doce: cada dibujo es una consulta a la cuenta del
// usuario, así que el tope acá es una decisión de plata y no de rendimiento.
$('dibujar').addEventListener('click', () => {
  pedirDibujos(proveedorDelDeposito(DONDE_EL_DEPOSITO), 1)
})
// ─── TODOS LOS QUE FALTAN, CON EL NÚMERO DELANTE ───────────────────────────
//
// El botón de al lado pide de a uno porque cada dibujo es una consulta a la
// cuenta del usuario, y esa decisión no cambió: **ésta pregunta antes**, y la
// pregunta incluye cuántas van a ser. Un botón que dispare doce consultas sin
// decirlo es exactamente lo que el de a uno estaba evitando.
//
// El tope es lo que falta y nada más: pedir de más sería pedir dibujos para
// claves que ninguna vista está mirando.
$('dibujar-todos').addEventListener('click', () => {
  const cuantos = sprites.loQueFalta().length
  if (cuantos === 0) {
    $('surtido').textContent = 'no falta ninguno'
    return
  }
  const uno = cuantos === 1
  if (!confirm(`Van ${String(cuantos)} ${uno ? 'consulta' : 'consultas'} a tu cuenta de Codex, ${uno ? 'una' : 'una por dibujo'}. ¿Voy?`)) return
  pedirDibujos(proveedorDelDeposito(DONDE_EL_DEPOSITO), cuantos)
})

$('dibujar-prueba').addEventListener('click', () => {
  pedirDibujos(dibujanteDePrueba(), 12)
})

function hud(escena: ReturnType<typeof escenaDe>): void {
  const s = partida.state
  const reloj = relojDe(s)
  $('tick').textContent = String(s.tick)
  $('cuerpos').textContent = String(s.bodies.size)
  // CUÁNTOS ENTRAN EN EL ENCUADRE, aparte de cuántos tiene el mundo. Los dos
  // números juntos son lo que hace verificable el punto 3 de la vertical —«ver
  // todos los objetos del área visible»—: sin el segundo, barrer el mapa a click
  // y encontrar tres no distingue «el mapa está vacío» de «se perdieron setenta».
  //
  // No cuenta lo que está en una mano: eso no se dibuja en el suelo (decisión 1
  // de `mapa.ts`), así que no se puede clickear y contarlo mentiría.
  $('a-la-vista').textContent = String([...escena.cuerpos.values()].filter((c) => c.heldBy === undefined).length)
  $('perdidos').textContent = String(partida.ticksPerdidos)
  $('cuadro').textContent = `${msDelCuadro.toFixed(1)} ms`
  $('fase').textContent = reloj.phase
  // EL MISMO TICK Y LA MISMA FASE, al lado del botón que los decide. Se
  // escriben acá y no en otra función a propósito: son dos vistas del mismo
  // dato y una sola línea que lo produce. Duplicar el nodo es barato; duplicar
  // de dónde sale el número es cómo se llega a dos relojes que no coinciden.
  $('reloj').textContent = `tick ${String(s.tick)} · ${reloj.phase}`
  // SEGUNDOS DE MUNDO y no de reloj de pared: el tiempo del mundo va en
  // segundos y no en ticks (ADR II-0008), así que cocinar tarda lo mismo a 10,
  // 20 o 100 Hz. Mostrar sólo el tick esconde eso justo en el panel que se mira
  // para entender el ritmo.
  $('segundos').textContent = `${(s.tick / HZ).toFixed(1)} s`
  $('faltan').textContent = String(sprites.loQueFalta().length)
}

/** Debajo de esto el aliento se pinta en rojo. Es aviso, no una regla del mundo. */
const ALIENTO_FLACO = 0.15

// ─── INSPECCIONAR UN CUERPO: el punto 8 de la vertical ─────────────────────
//
// El punto estaba dado por hecho —«`descriptorDe` publica forma, materiales,
// partes, juntas y captura»— y era verdad a medias: el dato existía y **no había
// dónde hacer click**. Es el mismo error que el 6 y el 7, que se marcaban como
// resueltos porque el motor estaba escrito.
//
// La cuenta de dónde cayó el click no es adivinanza y conviene seguirla: el
// canvas tiene `lado` píxeles adentro y `lado × zoom` en pantalla, porque el
// agrandado lo hace CSS (ver `lienzo.ts`). Así que se divide por el zoom para
// volver al píxel del mapa, por `CELDA` para saber qué casilla es, y se corre al
// origen del mundo sumando el foco menos el radio.
let ultimaEscena: ReturnType<typeof escenaDe> | undefined

/**
 * DE UN PUNTO DE LA PANTALLA A UNA CELDA DEL MUNDO.
 *
 * Toma coordenadas de ventana y no un evento porque el mouse quieto **también
 * cambia de celda**: el foco sigue a la criatura, así que con el mundo corriendo
 * el mapa se desliza abajo del puntero. El cuadro vuelve a preguntar con el
 * último punto conocido, y para eso el evento ya no está.
 */
function celdaEn(x: number, y: number, e: ReturnType<typeof escenaDe>): { x: number; y: number } {
  const caja = canvas.getBoundingClientRect()
  const px = Math.floor(((x - caja.left) / caja.width) * canvas.width)
  const py = Math.floor(((y - caja.top) / caja.height) * canvas.height)
  return {
    x: Math.floor(px / CELDA) + e.foco.x - e.radio.x,
    y: Math.floor(py / CELDA) + e.foco.y - e.radio.y,
  }
}

// ─── EL GLOBO SE ANCLA A UNA CELDA, NO A UN PUNTO DE LA PANTALLA ───────────
//
// Es la decisión de este tramo y no es obvia hasta que se ve corriendo: el foco
// sigue a la criatura, así que **el mapa se desliza abajo de un punto quieto**.
// Guardando el píxel clickeado, el globo empezaría a describir cosas distintas
// sin que nadie toque nada — clickeás una vara y treinta ticks después el mismo
// globo habla de un charco.
//
// Guardando la CELDA, el globo sigue hablando de lo que tocaste y el ancla se
// mueve con ella, que es lo que la persona espera de una marca sobre un mapa. Es
// la misma cuenta que `ubicarLaSenal` hace para el recuadro del hover, y por eso
// el ancla y el recuadro nunca se desfasan entre sí.
//
// Y cuando la celda se va del encuadre, el globo se cierra: un ancla apuntando
// afuera de la pantalla es una flecha a ninguna parte.
const pantalla = $('pantalla')
const ancla = $('ancla')
const globo = $('globo')
let anclada: { x: number; y: number } | undefined
let firmaDelGlobo = ''

function cerrarElGlobo(): void {
  anclada = undefined
  firmaDelGlobo = ''
  ancla.hidden = true
  globo.hidden = true
}

$('globo-cerrar').addEventListener('click', cerrarElGlobo)

function mirar(ev: MouseEvent): void {
  const e = ultimaEscena
  if (e === undefined) return
  anclada = celdaEn(ev.clientX, ev.clientY, e)
  // La firma se limpia para forzar el reescrito: se puede clickear dos veces la
  // misma celda después de cerrar, y con la firma vieja el globo no se rearmaría.
  firmaDelGlobo = ''
  refrescarElGlobo()
}

/**
 * EL CENTRO DE UNA CELDA, EN COORDENADAS DE `#pantalla`.
 *
 * Contra `#pantalla` y no contra la ventana porque el globo y el ancla son
 * `position: absolute` adentro de ella. Se restan los dos rectángulos en vez de
 * usar `offsetLeft`, que mide contra el ancestro posicionado más cercano y
 * cambiaría de significado el día que alguien le ponga `position` a `#tablero`.
 */
function puntoDeLaCelda(celda: { x: number; y: number }, e: ReturnType<typeof escenaDe>): { x: number; y: number } {
  const p = pantalla.getBoundingClientRect()
  const c = canvas.getBoundingClientRect()
  const lado = CELDA * (canvas.clientWidth / canvas.width)
  return {
    x: c.left - p.left + (celda.x - e.foco.x + e.radio.x + 0.5) * lado,
    y: c.top - p.top + (celda.y - e.foco.y + e.radio.y + 0.5) * lado,
  }
}

/**
 * LO QUE EL GLOBO NO PUEDE TAPAR, medido y no supuesto.
 *
 * Un globo detrás de la charla está tan perdido como uno fuera de la pantalla, y
 * peor: el ancla sigue marcando su celda y al lado no hay nada. Hoy lo único que
 * ocupa la derecha es el panel provisorio; cuando sea la charla y aparezca el
 * dock, esto sigue dando el número correcto porque lo LEE.
 *
 * ─── ABAJO SE RESERVA LA VELOCIDAD, Y NO LA FICHA ENTERA ───────────────────
 *
 * El diseño reserva «150 más el alto del dock», y 150 son más o menos la barra
 * de velocidad más la bandeja. Acá se mide, y se mide hasta la VELOCIDAD y no
 * más arriba, porque las dos cosas que hay ahí abajo no valen lo mismo:
 *
 *   · la ficha es INFORMACIÓN, y vuelve sola en cuanto cerrás el globo. Que un
 *     panel que pediste tape un rato el aliento es lo que hace un popover;
 *   · la pausa es un CONTROL, y es el único irrenunciable de la pantalla.
 *     Taparlo con algo que hay que cerrar primero es encerrar al jugador
 *     adentro de una respuesta que él pidió.
 *
 * Y medido en vez de con el 150 escrito porque el alto de esa barra depende de
 * la tipografía, que es justo lo que este rediseño cambió.
 */
function loReservado(): { derecha: number; abajo: number } {
  const p = pantalla.getBoundingClientRect()
  const derecha = document.querySelector('aside')?.getBoundingClientRect()
  const vel = $('velocidad').getBoundingClientRect()
  return {
    derecha: derecha === undefined ? 0 : Math.max(0, p.right - derecha.left),
    abajo: Math.max(0, p.bottom - vel.top),
  }
}

/**
 * EL GLOBO, EN CADA CUADRO MIENTRAS ESTÉ ABIERTO — y por lo mismo que el cartel.
 *
 * El mundo corre abajo: la vara que clickeaste puede empezar a arder, alguien
 * puede levantarla, o la criatura puede caminar y llevarse el encuadre. Un globo
 * escrito una sola vez al clickear diría lo que era verdad entonces.
 */
function refrescarElGlobo(): void {
  const celda = anclada
  const e = ultimaEscena
  if (celda === undefined || e === undefined) return

  // ¿Se fue del encuadre? La escena publica las celdas que entran, así que
  // preguntarle a ella es preguntarle a la única fuente que sabe.
  const cel = celdaEnEscena(e, celda)
  if (cel === undefined) {
    cerrarElGlobo()
    return
  }

  const s = loSenaladoEn(e, celda, PHYS)
  const pie = piePara(s, cel)
  const firma = `${firmaDe(s)}|${pie}`
  if (firma !== firmaDelGlobo) {
    firmaDelGlobo = firma
    const dibujo = $('globo-dibujo')
    dibujo.replaceChildren()
    if (s !== undefined) dibujo.appendChild(enUnCanvas(s.d, 24, s.esAgente))
    $('globo-que').textContent = s?.titulo ?? `nada en (${String(celda.x)}, ${String(celda.y)})`
    // Las tres frases seguidas, igual que el cartel: es una línea de lectura y
    // no una planilla. Las vacías no dejan un separador colgado.
    $('globo-detalle').textContent = s === undefined ? '' : [s.de, s.piezas, s.comoEs].filter((t) => t !== '').join(' · ')
    $('globo-pie').textContent = pie
  }

  const punto = puntoDeLaCelda(celda, e)
  ancla.style.left = `${String(punto.x)}px`
  ancla.style.top = `${String(punto.y)}px`
  ancla.hidden = false
  globo.hidden = false
  // Se mide DESPUÉS de escribir y de mostrarlo: un elemento con `hidden` mide
  // cero, y ubicarlo con esa medida lo pega a la esquina de abajo.
  const donde = ubicarElGlobo(
    punto,
    { ancho: globo.offsetWidth, alto: globo.offsetHeight },
    { ancho: pantalla.clientWidth, alto: pantalla.clientHeight },
    loReservado(),
  )
  globo.style.left = `${String(donde.left)}px`
  globo.style.top = `${String(donde.top)}px`
}

// ─── PASARLE EL MOUSE POR ARRIBA: SABER QUÉ ES SIN TENER QUE CLICKEAR ──────
//
// El mapa son manchas de color de doce píxeles. Averiguar qué es una mancha
// costaba **un click y un viaje del ojo** hasta el panel de la derecha, o sea que
// mirar el mundo era imposible: para reconocer seis cosas había que clickear seis
// veces y leer seis veces en otro lado.
//
// El cartel es lo mismo que ya decía el panel, puesto **donde está el ojo**. No
// agrega información: baja el costo de pedirla de un click a nada.
//
// ─── LAS TRES DECISIONES ───────────────────────────────────────────────────
//
//   1. **en una celda vacía no aparece nada.** Un cartel que diga «nada en
//      (12, 7)» al barrer el mapa parpadearía en las tres cuartas partes del
//      recorrido, y lo que se busca es lo contrario: que el cartel aparezca sea
//      la señal de que ahí hay algo;
//   2. **el click no se toca.** El cartel se va con el mouse, así que no sirve
//      para comparar dos cosas ni para leer con calma. El panel queda para eso, y
//      además es lo único de los dos que se puede leer sin un mouse encima;
//   3. **el mismo dibujo que el mapa.** El cartel muestra el glifo por `glifoDe`,
//      igual que el inventario y el catálogo (caso 7 del 12C). Un ícono propio
//      acá sería una cuarta representación de lo mismo, que es exactamente lo que
//      ese caso persigue.
const cartel = $('cartel')
const senal = $('senal')

/**
 * QUIÉN ESTÁ PIDIENDO EL CARTEL, o nadie. Devuelve qué mostrar y —sólo el mapa—
 * sobre qué celda va el recuadro.
 *
 * Es una función y no un dato porque el mundo se mueve: mientras el puntero está
 * quieto, lo que hay abajo puede cambiar de celda, empezar a arder o
 * desaparecer. Preguntar de nuevo en cada cuadro es lo que hace que el cartel
 * diga la verdad y no lo que era verdad cuando entró el mouse.
 */
type Fuente = () => { s: Senalado; celda?: { x: number; y: number } } | undefined
let fuente: Fuente | undefined
let raton = { x: 0, y: 0 }
let firmaDelCartel = ''

function escribirElCartel(s: Senalado): void {
  cartel.replaceChildren()
  const dibujo = enUnCanvas(s.d, 24, s.esAgente)
  dibujo.className = 'glifo'
  cartel.appendChild(dibujo)

  const texto = document.createElement('div')
  const que = document.createElement('b')
  que.textContent = s.titulo
  texto.appendChild(que)
  for (const linea of [s.de, s.piezas, s.comoEs]) {
    if (linea === '') continue
    const span = document.createElement('span')
    span.textContent = linea
    texto.appendChild(span)
  }
  cartel.appendChild(texto)
}

/**
 * EL RECUADRO SOBRE LA CELDA, y por qué se calcula con el ancho en pantalla.
 *
 * El canvas mide `lado` píxeles adentro y `lado × zoom` afuera, pero el CSS le
 * pone `max-width: 100%`: en una ventana angosta el navegador lo achica y el zoom
 * deja de ser el factor. `offsetWidth / width` es el factor de verdad, cualquiera
 * sea el motivo por el que la imagen quedó de ese tamaño.
 */
function ubicarLaSenal(celda: { x: number; y: number }, e: ReturnType<typeof escenaDe>): void {
  const factor = canvas.clientWidth / canvas.width
  const lado = CELDA * factor
  senal.style.width = `${String(lado)}px`
  senal.style.height = `${String(lado)}px`
  // `transform` y no `left`/`top`: el recuadro se desliza de celda en celda y con
  // posiciones eso es un layout por cuadro; con transform, no toca el layout.
  senal.style.transform = `translate(${String((celda.x - e.foco.x + e.radio.x) * lado)}px, ${String((celda.y - e.foco.y + e.radio.y) * lado)}px)`
}

function refrescarElCartel(): void {
  const f = fuente
  if (f === undefined) return
  const hay = f()
  if (hay === undefined) {
    cartel.classList.remove('se-ve')
    senal.classList.remove('se-ve')
    return
  }

  const firma = firmaDe(hay.s)
  if (firma !== firmaDelCartel) {
    firmaDelCartel = firma
    escribirElCartel(hay.s)
  }
  // Se mide DESPUÉS de escribir: el alto depende de cuántas líneas entraron, y
  // ubicarlo con la medida vieja lo deja saliéndose por abajo justo cuando el
  // objeto tiene más para contar.
  const donde = ubicarElCartel(
    raton,
    { ancho: cartel.offsetWidth, alto: cartel.offsetHeight },
    { ancho: window.innerWidth, alto: window.innerHeight },
  )
  cartel.style.left = `${String(donde.left)}px`
  cartel.style.top = `${String(donde.top)}px`
  cartel.classList.add('se-ve')

  const e = ultimaEscena
  if (hay.celda !== undefined && e !== undefined) {
    const yaSeVeia = senal.classList.contains('se-ve')
    ubicarLaSenal(hay.celda, e)
    // Leer `offsetWidth` fuerza el cálculo de estilos ACÁ, con el recuadro
    // todavía apagado. Sin eso, el navegador junta las dos cosas —ponerlo en su
    // celda y prenderlo— en un solo cambio, y como el estado prendido sí tiene
    // transición de `transform`, el recuadro entra volando desde la esquina.
    if (!yaSeVeia) void senal.offsetWidth
    senal.classList.add('se-ve')
  } else {
    senal.classList.remove('se-ve')
  }
}

/** Le engancha el cartel a un elemento. `que` contesta qué mostrar. */
function conCartel(el: HTMLElement, que: Fuente): void {
  el.addEventListener('mousemove', (ev) => {
    raton = { x: ev.clientX, y: ev.clientY }
    fuente = que
    refrescarElCartel()
  })
  el.addEventListener('mouseleave', () => {
    fuente = undefined
    cartel.classList.remove('se-ve')
    senal.classList.remove('se-ve')
  })
}

conCartel(canvas, () => {
  const e = ultimaEscena
  if (e === undefined) return undefined
  const celda = celdaEn(raton.x, raton.y, e)
  // ─── Y SE CALLA SOBRE LA CELDA QUE YA TIENE EL GLOBO ────────────────────
  //
  // Los dos dicen lo mismo del mismo objeto, así que sobre la celda anclada se
  // apilarían a catorce píxeles uno del otro contando la misma cosa dos veces.
  // Callarse ahí es además lo que hace que el par tenga sentido: el hover
  // contesta lo que TODAVÍA no preguntaste, y sobre esa celda ya preguntaste.
  if (anclada !== undefined && anclada.x === celda.x && anclada.y === celda.y) return undefined
  const s = loSenaladoEn(e, celda, PHYS)
  return s === undefined ? undefined : { s, celda }
})

/**
 * EL PANEL DE LA CRIATURA: los puntos 6 y 7 de la vertical del Hito 12B.
 *
 * Todo lo que muestra sale de `loQueSeVeDe`, que es donde están las decisiones.
 * Acá sólo se escriben nodos: si esta función tuviera un `if` sobre el mundo,
 * habría lógica que ningún test puede tocar sin abrir un navegador.
 */
function panel(escena: ReturnType<typeof escenaDe>): void {
  const actor = escena.actores[0]
  if (actor === undefined) return
  const c = loQueSeVeDe(actor, escena, PHYS)

  // DÓNDE ESTÁ. Es la única forma de ver desde afuera que la criatura camina: el
  // mapa la muestra siempre en el centro, porque el foco la sigue. Sin este par
  // de números, «se mueve» sólo se puede afirmar mirando el fondo pasar.
  $('donde').textContent = `${String(escena.foco.x)}, ${String(escena.foco.y)}`

  muestrearElAliento(c.aliento.fraccion)
  $('aliento').textContent = `${String(c.aliento.valor)} / ${String(c.aliento.de)}`
  $('aliento-barra').style.width = `${String(c.aliento.fraccion * 100)}%`
  $('aliento-caja').classList.toggle('poco', c.aliento.fraccion < ALIENTO_FLACO)

  const caja = $('hace-caja')
  const barra = $('hace-barra')
  if (c.haciendo !== undefined) {
    $('hace').textContent = c.haciendo.que
    $('hace-cuanto').textContent = `${c.haciendo.segundos.toFixed(1)} s`
    caja.classList.toggle('sin-total', c.haciendo.barra === undefined)
    barra.style.width = `${String((c.haciendo.barra?.fraccion ?? 0) * 100)}%`
    $('sobre').textContent = c.haciendo.sobre.length > 0 ? c.haciendo.sobre.join(' · ') : '—'
  } else if (c.esperando !== undefined) {
    $('hace').textContent = 'esperando'
    $('hace-cuanto').textContent = `${c.esperando.valor.toFixed(1)} / ${c.esperando.de.toFixed(1)} s`
    caja.classList.remove('sin-total')
    barra.style.width = `${String(c.esperando.fraccion * 100)}%`
    $('sobre').textContent = '—'
  } else {
    $('hace').textContent = 'quieta'
    $('hace-cuanto').textContent = ''
    caja.classList.remove('sin-total')
    barra.style.width = '0%'
    $('sobre').textContent = '—'
  }

  $('manos').textContent = c.manos.length > 0 ? c.manos.join(' · ') : 'nada'

}

/**
 * UN GLIFO EN UN CANVAS. La misma función para las tres vistas.
 *
 * Es el caso 7 del 12C —«la misma representación coherente en mapa, inventario y
 * catálogo»— y la garantía no es que las tres se parezcan: es que **las tres
 * llaman a esto**, con el mismo descriptor. Coinciden por construcción, no porque
 * alguien se acuerde de mantenerlas iguales.
 *
 * ─── Y EL QUINTO PARÁMETRO FALTABA, QUE ERA JUSTO EL CASO 7 FALLANDO ───────
 *
 * `glifoDe` toma un `esAgente` y `componer.ts` lo usa para pedir la clave de
 * CRIATURA en vez de la de la materia — «una criatura pide un dibujo de
 * criatura, no uno de la materia de la que está hecha», dice ahí. `mapa.ts` se
 * lo pasaba y esto no, así que la criatura salía como el MUÑECO en el mapa y
 * como un bloque de carne en el cartel, en el globo y en el inspector: la misma
 * cosa, dibujada por la misma función, vista de dos maneras.
 *
 * Y el dato nunca faltó: `Senalado.esAgente` existe desde que se escribió
 * `lo-senalado.ts`. Estaba publicado y no lo leía nadie, que es la forma más
 * cara que tiene un bug de esconderse.
 */
function enUnCanvas(d: RenderDescriptor, grilla: number, esAgente = false): HTMLCanvasElement {
  const px = pintar(glifoDe(d, PHYS, grilla, sprites, esAgente))
  const cv = document.createElement('canvas')
  cv.width = px.length
  cv.height = px.length
  const ctx = cv.getContext('2d')
  if (ctx === null) return cv
  for (let y = 0; y < px.length; y++) {
    const fila = px[y]
    if (fila === undefined) continue
    for (let x = 0; x < fila.length; x++) {
      const color = fila[x]
      if (color === undefined || color === '') continue
      ctx.fillStyle = color
      ctx.fillRect(x, y, 1, 1)
    }
  }
  return cv
}

/**
 * EL CATÁLOGO: lo que la criatura sabe hacer — el caso 6 del 12C.
 *
 * Dos listas, y están separadas porque se ganan distinto:
 *
 *   · las METAS que el catálogo core sabe establecer. Vienen con el juego y no
 *     cambian, así que se pintan una vez;
 *   · las OBRAS que la criatura APRENDIÓ a armar (`buildCapabilities`). Ésas sí
 *     crecen en la partida, y son las que tienen dibujo — una obra es un cuerpo,
 *     y un cuerpo tiene descriptor.
 *
 * Hoy la segunda lista está vacía en una partida normal: la fragua da de alta
 * capacidades y el juego todavía no la corre. Que se vea vacía es información y no
 * un hueco tapado — cuando aprenda algo, aparece con su dibujo y sin tocar nada.
 */
let catalogoPintado = false

function catalogo(): void {
  if (catalogoPintado) return
  catalogoPintado = true
  const caja = $('lista-catalogo')
  caja.replaceChildren()

  const filas: readonly (readonly [string, RenderDescriptor | undefined])[] = [
    ...[...new Set(ESQUEMAS.map((e) => e.establishes))].map(
      (f) => [enCastellano(f), undefined] as const,
    ),
  ]
  for (const [texto, d] of filas) {
    const fila = document.createElement('div')
    fila.className = 'fila'
    if (d === undefined) {
      const hueco = document.createElement('span')
      hueco.className = 'sinDibujo'
      hueco.textContent = '·'
      fila.appendChild(hueco)
    } else {
      fila.appendChild(enUnCanvas(d, 24))
    }
    const nombre = document.createElement('span')
    nombre.textContent = texto
    fila.appendChild(nombre)
    caja.appendChild(fila)
  }
}

/**
 * LO QUE LLEVA EN LA MANO, DIBUJADO — y por qué esto destraba los sprites.
 *
 * ─── LA MEDICIÓN QUE LO PIDIÓ ──────────────────────────────────────────────
 *
 * El registro decía «faltan los sprites de lado 12 y 8, así que todo objeto de
 * dos o más piezas se dibuja procedural». Medido sobre 400 ticks del juego: **de
 * las once claves que se piden, las once son de lado 24**. Ni una de 12 ni de 8.
 *
 * No era que se dibujaran mal: es que **no se dibujaban en ningún lado**. En todo
 * el mundo hay UN cuerpo de varias piezas —la caña que la criatura ata— y está
 * en la mano; el mapa no dibuja lo que está en una mano (decisión 1 de `mapa.ts`,
 * y está bien: pintarlo en el suelo diría que está tirado ahí). Con el mapa como
 * único dibujante, lo compuesto era invisible.
 *
 * Así que esto no es un panel más: es el primer lugar donde un objeto de varias
 * piezas se dibuja. `glifoDe` compone las piezas en una grilla de 24, y a dos
 * piezas les toca lado 12 — o sea que **las claves de 12 empiezan a pedirse solas
 * en cuanto la criatura ata algo**.
 *
 * Un canvas por objeto y no uno solo con todo: cada uno se escala por CSS a 48
 * px con `pixelated`, y el buffer sigue midiendo 24 — el mismo truco del mapa,
 * por la misma razón.
 */
function inventario(escena: ReturnType<typeof escenaDe>): void {
  const actor = escena.actores[0]
  if (actor === undefined) return
  const caja = $('inventario')
  // Se repinta sólo cuando cambia lo que lleva. El contenido de un glifo puede
  // cambiar igual —llega el sprite del modelo— y eso lo cubre el `data-clave`.
  const firma = actor.holding.join(',')
  if (caja.dataset['lleva'] === firma) return
  caja.dataset['lleva'] = firma
  caja.replaceChildren()

  // ─── Y CUANDO NO LLEVA NADA SE DICE, EN VEZ DE NO MOSTRAR NADA ───────────
  //
  // La bandeja vacía y la bandeja que no existe se ven igual, y no significan lo
  // mismo: la primera dice «tiene las manos libres» y la segunda dice «no sé».
  // Con el mapa de fondo la diferencia importa todavía más, porque un hueco sin
  // texto se lee como que algo no terminó de cargar.
  //
  // En itálica y en serif, que es la marca de este proyecto para lo que NO es un
  // dato del mundo sino una aclaración de la pantalla.
  if (actor.holding.length === 0) {
    const vacia = document.createElement('span')
    vacia.className = 'vacia'
    vacia.textContent = 'no lleva nada'
    caja.appendChild(vacia)
    return
  }

  for (const id of actor.holding) {
    const c = escena.cuerpos.get(id)
    if (c === undefined) continue
    // La MISMA función que el mapa y el catálogo, con el mismo descriptor. Es el
    // caso 7 del 12C y por eso no hay una copia de este bucle acá.
    const cv = enUnCanvas(c.d, 24)
    // El `title` queda: es lo único de esto que llega sin un mouse. El cartel se
    // le suma porque el nativo tarda un segundo largo en aparecer y no muestra el
    // dibujo — y acá el dibujo es la mitad de la respuesta.
    cv.title = describir(id, c.d, PHYS, { mas: 0, esAgente: false }).titulo
    // Lo que está en la mano no está en ninguna celda del mapa, así que se
    // describe por el cuerpo. Es el mismo texto que el del mapa, por construcción.
    //
    // Se busca el cuerpo de AHORA y no el de este cuadro: el inventario se
    // repinta sólo cuando cambia lo que lleva, así que una vara que se prende
    // fuego en la mano seguiría descrita como cruda hasta que la suelte.
    conCartel(cv, () => {
      const ahora = ultimaEscena?.cuerpos.get(id)
      return ahora === undefined
        ? undefined
        : { s: describir(id, ahora.d, PHYS, { mas: 0, esAgente: false }) }
    })
    caja.appendChild(cv)
  }
}

/**
 * EL REGISTRO, AGRUPADO EN TURNOS. Todo lo que decide está en `turnos.ts`.
 *
 * Acá sólo se escriben nodos: si esta función tuviera un `if` sobre el log,
 * habría lógica de agrupado que ningún test puede tocar sin abrir un navegador.
 * Es la misma división que `panel()` y `pintarEnlace()`.
 *
 * ─── SE REPINTA ENTERO, Y ES UN CAMBIO RESPECTO DE ANTES ───────────────────
 *
 * La versión plana pintaba SÓLO LO NUEVO y llevaba un contador del último turno
 * escrito. Con turnos eso deja de servir, y no por gusto: **al bloque abierto le
 * entran pasos y le cambia la respuesta sin que aparezca ninguna línea nueva al
 * final**, así que un contador de posición no se enteraría nunca. Y cuando llega
 * un pedido nuevo, el turno anterior tiene que PLEGARSE — o sea que un nodo ya
 * pintado cambia de forma.
 *
 * Reescribir cien líneas cuesta nada; hacerlo sesenta veces por segundo rompe la
 * selección de texto del que está leyendo. Por eso hay firma: se repinta cuando
 * algo cambió, y `firmaDelRegistro` mira ADENTRO del turno abierto.
 */
let firmaPintada = ''

function unPaso(p: Paso): HTMLElement {
  const fila = document.createElement('p')
  fila.className = `paso ${p.estado}`
  // Sólo los pasos que salen del log llevan identidad. Una cláusula del encargo
  // no es una línea de la conversación, así que no tiene turno que mostrar.
  if (p.turno !== undefined) {
    fila.dataset['turno'] = String(p.turno)
    fila.dataset['clase'] = 'progreso'
  }
  const marca = document.createElement('i')
  // ✓ hecho · › en curso · · pendiente. Tres formas distintas y no tres colores
  // del mismo signo: el estado se tiene que poder leer sin distinguir el verde
  // del ámbar, igual que las dos luces del enlace.
  marca.textContent = p.estado === 'hecho' ? '✓' : p.estado === 'en-curso' ? '›' : '·'
  fila.append(marca, p.texto)
  return fila
}

function unTurno(t: Turno): HTMLElement {
  const caja = document.createElement('div')
  caja.className = t.abierto ? 'turno' : 'turno plegado'
  // El CONTENEDOR no lleva `data-turno`, y es a propósito: ese atributo
  // significa «esta línea sale de un `Dicho` del log», y un bloque que agrupa
  // tres líneas no es una de ellas. Con él puesto, contar `[data-turno]` daba
  // tres por turno donde hay dos, y el número dejaba de decir cuántas líneas
  // tiene el log. La identidad es de la línea; el turno es cómo se la muestra.

  if (t.pedido !== undefined) {
    const q = document.createElement('p')
    q.className = 'pedido'
    // `data-turno` y `data-clase` en cada línea que salga de un `Dicho`, y no es
    // para estilar: es lo que deja afirmar «orden e identidad» y «el progreso no
    // vuelve convertido en habla» después de una recarga, sin comparar textos.
    // El agrupado es presentación; la identidad del log tiene que sobrevivirle.
    q.dataset['turno'] = String(t.turno)
    q.dataset['clase'] = 'entrada'
    q.textContent = t.pedido
    caja.appendChild(q)
  }

  if (t.respuesta !== undefined) {
    const r = document.createElement('p')
    r.className = 'respuesta'
    r.dataset['turno'] = String(t.respuesta.turno)
    r.dataset['clase'] = 'respuesta'
    r.textContent = t.respuesta.texto
    caja.appendChild(r)
  }

  if (t.pasos.length === 0) return caja

  if (t.abierto) {
    const lista = document.createElement('div')
    lista.className = 'pasos'
    for (const p of t.pasos) lista.appendChild(unPaso(p))
    caja.appendChild(lista)
    return caja
  }

  // ─── PLEGADO: LOS PASOS SE VAN Y QUEDA LA CUENTA ────────────────────────
  //
  // Dice «N pasos» y no «N de M» como el diseño dibuja, y el motivo es del dato:
  // el encargo NO persiste por turno —vive el actual y nada más— así que de un
  // turno viejo lo único que queda son sus líneas de progreso, que son todas
  // cosas que pasaron. El M sería siempre igual al N, o sea un número que no
  // informa. Cuando el encargo se guarde por turno, esto puede decir los dos.
  const cuantos = document.createElement('p')
  cuantos.className = 'cuantos'
  cuantos.textContent = `${String(t.pasos.length)} paso${t.pasos.length === 1 ? '' : 's'}`
  caja.appendChild(cuantos)
  return caja
}

function charla(): void {
  // Las cláusulas del encargo son lo que el log NO tiene: lo que está haciendo y
  // lo que falta. Se leen del encargo de AHORA y se le cuelgan al turno que las
  // pidió, que el propio encargo dice cuál fue.
  const encargo = ordenes.encargo
  const abierto =
    encargo === undefined
      ? undefined
      : {
          turnos: encargo.turnos,
          clausulas: clausulasDe(encargo, ordenes.metaEnCurso, enCastellano),
        }
  const turnos = agrupar(ordenes.charla, abierto)

  const firma = firmaDelRegistro(turnos)
  if (firma === firmaPintada) return
  firmaPintada = firma

  const caja = $('registro')
  caja.replaceChildren()
  if (turnos.length === 0) {
    const vacio = document.createElement('p')
    vacio.className = 'vacio'
    vacio.textContent =
      'Pedile algo en castellano común. Te contesta si entendió y si conoce un camino — no si va a salir bien.'
    caja.appendChild(vacio)
    return
  }
  for (const t of turnos) caja.appendChild(unTurno(t))
  caja.scrollTop = caja.scrollHeight
}

/**
 * LAS SUGERENCIAS, UNA VEZ. Salen del catálogo (ver `sugerencias.ts`) y el
 * catálogo core no cambia dentro de una partida, así que pintarlas en cada
 * cuadro sería rearmar seis botones para dejar los mismos seis.
 *
 * Clickear una **equivale a tipearla y enviar**, y por eso llama a
 * `requestSubmit()` en vez de a `ordenes.decir()`: con una ruta propia habría dos
 * caminos hacia la criatura y el día que uno gane un paso —guardar, limpiar el
 * campo, pintar el acuse— el otro se queda sin él.
 */
function pintarSugerencias(): void {
  const caja = $('sugerencias')
  const campo = $('orden') as HTMLInputElement
  const forma = $('charla') as HTMLFormElement
  for (const frase of sugerencias()) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.textContent = frase
    chip.addEventListener('click', () => {
      campo.value = frase
      forma.requestSubmit()
    })
    caja.appendChild(chip)
  }
}

pintarSugerencias()

/**
 * LO QUE RECUERDA, CON SU FUENTE — el C2 hecho pantalla.
 *
 * Se repinta entero y sólo cuando el log creció, por lo mismo que `charla()`: son
 * pocas líneas y un diff acá sería código para ahorrar nada.
 *
 * Lo que se muestra al lado de cada recuerdo no es adorno: **el turno del que
 * salió** —que se puede ir a buscar al registro— y **quién lo dijo**. Sin eso,
 * «me acuerdo de que hay un pescado en el río» se lee igual si se lo contaron que
 * si lo vio, que es exactamente la confusión que el tramo prohíbe.
 */
let recuerdosPintados = 0

function recuerdos(): void {
  const ultimo = ordenes.charla.at(-1)?.turno ?? 0
  if (ultimo === recuerdosPintados) return
  recuerdosPintados = ultimo
  const caja = $('lista-recuerdos')
  caja.replaceChildren()
  for (const r of ordenes.queRecuerda()) {
    const fila = document.createElement('div')
    fila.className = 'fila'
    fila.dataset['clase'] = r.clase
    fila.dataset['procedencia'] = r.procedencia

    const que = document.createElement('span')
    const clase = document.createElement('b')
    clase.textContent = `${r.clase} `
    que.appendChild(clase)
    que.append(r.texto + (r.veces > 1 ? ` (×${String(r.veces)})` : ''))

    const fuente = document.createElement('span')
    fuente.className = 'fuente'
    // El turno con `#` porque es una identidad y no una cuenta: `#7` se puede
    // buscar en el registro, «7» parece un total.
    fuente.textContent = `#${r.turnos.join(', #')} · ${r.procedencia}`

    fila.append(que, fuente)
    caja.appendChild(fila)
  }
}

// ─── EMPEZAR DE CERO ───────────────────────────────────────────────────────
//
// No es una comodidad: sin esto, una partida guardada que quede en un estado
// raro deja al jugador trabado para siempre, porque el juego la carga sola al
// abrir y no hay por dónde salir. Recarga la página después de borrar, así el
// mundo se arma de nuevo desde la semilla por el camino normal.
$('olvidar').addEventListener('click', () => {
  if (!confirm('¿Borrar la partida guardada y empezar de nuevo?')) return
  void baul
    .borrar(claveDe(QUIEN))
    .catch((e: unknown) => {
      console.error('[guardado] no se pudo borrar:', e)
    })
    .finally(() => {
      location.reload()
    })
})

$('charla').addEventListener('submit', (ev) => {
  ev.preventDefault()
  const caja = $('orden') as HTMLInputElement
  ordenes.decir(caja.value)
  caja.value = ''
  // El acuse se pinta ACÁ y no en el cuadro que viene: el criterio pide que
  // aparezca en el mismo frame que el mensaje, y con el mundo en pausa el
  // próximo cuadro podría tardar. `leer()` ya lo dejó en el registro.
  charla()
  recuerdos()
})

// ─── EL MODO DEV Y SU DOCK ──────────────────────────────────────────────────
//
// Un solo interruptor decide cuánta pantalla hay. Apagado quedan TRES cosas: el
// mapa, la charla y quién está del otro lado. Todo lo demás —los ocho módulos—
// es para mirar cómo funciona esto por dentro, y mirar cómo funciona por dentro
// no es jugar.
//
// ─── POR QUÉ EL TOPE ES CUATRO Y NO «LOS QUE QUIERAS» ──────────────────────
//
// Con cinco abiertos, cada panel mide 180 px de ancho sobre una ventana de 1440
// menos la charla: ahí no entra ni una fila de `dl` sin envolverse, así que lo
// que se gana en cantidad se pierde en poder leer alguno. Y el dock crece hacia
// arriba comiéndose el mapa, que es lo que este rediseño vino a evitar.
//
// El quinto CIERRA EL MÁS VIEJO en vez de rebotar. Rebotar obligaría a acordarse
// de cuál cerrar antes de abrir el que se quiere; cerrar el más viejo hace lo
// que la persona iba a hacer igual, y el renglón de la derecha lo dice antes.
const MODULOS = [
  ['diagnostico', 'Diagnóstico', 'tick, segundos, cuadro, ticks perdidos y la criatura en detalle'],
  ['aliento', 'Aliento', 'cómo viene el aliento en los últimos diez minutos de mundo'],
  ['plan', 'Plan de la mente', 'qué meta persigue ahora y qué pasos le faltan'],
  ['catalogo', 'Catálogo', 'las metas que sabe conseguir y las obras que aprendió a armar'],
  ['ver', 'Ver y dibujar', 'zoom del mapa, y pedirle dibujos a Codex'],
  ['partida', 'La partida', 'dónde se guardó, con qué semilla, y empezar de cero'],
  ['journal', 'Journal', 'lo que pasó, lo último arriba, con de dónde salió cada cosa'],
  ['inspector', 'Inspector', 'el cuerpo que clickeaste, en detalle'],
] as const

const TOPE_DE_MODULOS = 4
const DONDE_SE_GUARDA = 'anima:dock'

/**
 * LO QUE EL DOCK RECUERDA ENTRE SESIONES, y no es una comodidad.
 *
 * Quien prende el modo dev lo prende porque está mirando algo, y va a seguir
 * mirándolo después de recargar — recargar es justamente lo que hace todo el
 * tiempo. Que se apague solo obliga a rearmar la pantalla en cada vuelta.
 *
 * Se lee con desconfianza: un `localStorage` es texto que cualquiera edita, y
 * una clave vieja de una versión anterior puede traer módulos que ya no
 * existen. Lo que no se reconoce se descarta en silencio en vez de reventar,
 * que es la misma decisión que el juego toma con un guardado ilegible.
 */
interface LoGuardadoDelDock {
  dev: boolean
  abiertos: string[]
}

function leerElDock(): LoGuardadoDelDock {
  const idsQueExisten = new Set(MODULOS.map(([id]) => id as string))
  const porOmision: LoGuardadoDelDock = { dev: false, abiertos: ['diagnostico', 'aliento', 'plan'] }
  try {
    const crudo: unknown = JSON.parse(localStorage.getItem(DONDE_SE_GUARDA) ?? 'null')
    if (typeof crudo !== 'object' || crudo === null) return porOmision
    const o = crudo as Record<string, unknown>
    const lista = Array.isArray(o['abiertos']) ? o['abiertos'] : []
    return {
      dev: o['dev'] === true,
      abiertos: lista.filter((x): x is string => typeof x === 'string' && idsQueExisten.has(x)).slice(0, TOPE_DE_MODULOS),
    }
  } catch {
    return porOmision
  }
}

const guardado = leerElDock()
let dev = guardado.dev
/** En orden de APERTURA, del más viejo al más nuevo. Ver `abrirOCerrar`. */
let abiertos = guardado.abiertos

function recordarElDock(): void {
  try {
    localStorage.setItem(DONDE_SE_GUARDA, JSON.stringify({ dev, abiertos }))
  } catch {
    // Modo privado, cuota llena, permisos. El dock funciona igual esta sesión:
    // lo único que se pierde es que la próxima arranque como ésta terminó.
  }
}

const dock = $('dock')
const interruptor = $('modo-dev')

function pintarElDock(): void {
  interruptor.setAttribute('aria-checked', String(dev))
  dock.hidden = !dev
  for (const [id] of MODULOS) {
    const abierto = abiertos.includes(id)
    $(`chip-${id}`).classList.toggle('on', abierto)
    const panel = document.querySelector<HTMLElement>(`[data-modulo="${id}"]`)
    if (panel !== null) panel.hidden = !abierto
  }
  $('sin-modulos').hidden = abiertos.length > 0
  $('cuantos-modulos').textContent =
    `${String(abiertos.length)} de ${String(TOPE_DE_MODULOS)} · click para abrir o cerrar`
  recordarElDock()
}

/**
 * ABRIR O CERRAR UN MÓDULO, y las DOS listas que esto necesita.
 *
 * `abiertos` va en orden de APERTURA porque de eso depende cuál se cierra al
 * abrir el quinto. Pero los PANELES se dibujan en el orden fijo de los chips, y
 * no en el de apertura: con el orden de apertura, abrir uno reacomoda a los tres
 * que ya estaban y el ojo pierde el que estaba leyendo. Un orden decide qué se
 * va; el otro, dónde está cada cosa. No son el mismo orden y no se pueden
 * unificar sin perder una de las dos propiedades.
 */
function abrirOCerrar(id: string): void {
  abiertos = abiertos.includes(id)
    ? abiertos.filter((x) => x !== id)
    : [...abiertos, id].slice(-TOPE_DE_MODULOS)
  pintarElDock()
}

for (const [id, nombre, ayuda] of MODULOS) {
  const chip = document.createElement('button')
  chip.type = 'button'
  chip.id = `chip-${id}`
  chip.title = ayuda
  chip.textContent = nombre
  chip.addEventListener('click', () => {
    abrirOCerrar(id)
  })
  $('chips').appendChild(chip)
}

interruptor.addEventListener('click', () => {
  dev = !dev
  pintarElDock()
})
// Con teclado también: es un `role="switch"` con `tabindex`, así que prometer
// que se puede llegar sin prometer que se puede accionar sería peor que nada.
interruptor.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' && ev.key !== ' ') return
  ev.preventDefault()
  dev = !dev
  pintarElDock()
})

pintarElDock()
$('semilla').textContent = String(SEMILLA)

/**
 * LOS FLOTANTES SE CORREN CUANDO APARECE EL DOCK, y el corrimiento TIENE TOPE.
 *
 * El alto se MIDE del DOM y no se supone, y no es prolijidad: la fila de chips
 * se envuelve en una ventana angosta, así que el dock mide una cosa o dos según
 * el ancho. Con una constante, la barra de velocidad termina debajo del dock
 * justo en las ventanas donde menos lugar hay.
 *
 * Y el tope: sin él, en una ventana de 540 px de alto un dock de 320 manda la
 * ficha de la criatura encima de las lámparas del enlace. Por arriba del tope la
 * ficha se queda quieta y es el dock el que la tapa — que es preferible a dos
 * textos superpuestos, porque un texto tapado se ve tapado y dos superpuestos se
 * ven rotos.
 */
const AIRE_PARA_LO_DE_ARRIBA = 210
const ficha = $('ficha')
// `barraDeVelocidad` y no `velocidad`: ese nombre ya es el número del mundo, y
// dos cosas con el mismo nombre en el mismo archivo son un bug esperando.
const barraDeVelocidad = $('velocidad')

/**
 * EL ALTO DEL DOCK Y EL HUECO QUE HAY, juntos en una cadena.
 *
 * El diseño lista un `dockAlto` como estado y acá no existe como variable, a
 * propósito: nadie más lo necesita. El globo del click, que es el otro que tiene
 * que esquivar al dock, ya lo esquiva sin saber que existe — mide hasta la barra
 * de velocidad, y la barra de velocidad se corrió arriba del dock. Un número
 * guardado que sólo se usa para compararlo consigo mismo es una segunda verdad
 * sobre el alto del dock esperando a desincronizarse.
 */
let corridoEn = ''

function correrLosFlotantes(): void {
  const alto = dev ? dock.offsetHeight : 0
  const hueco = Math.max(0, pantalla.clientHeight - AIRE_PARA_LO_DE_ARRIBA)
  // Los DOS entran en la guarda y no sólo el alto del dock: el tope depende de
  // cuánta ventana hay, así que achicar la ventana con el dock quieto cambia el
  // corrimiento sin cambiar el dock. Con la guarda sobre el alto solo, la ficha
  // se queda donde estaba y se pisa con las lámparas justo al achicar.
  const asiEsta = `${String(alto)}|${String(hueco)}`
  if (asiEsta === corridoEn) return
  corridoEn = asiEsta
  const corrimiento = Math.min(alto, hueco)
  ficha.style.bottom = `${String(corrimiento + (dev ? 78 : 76))}px`
  barraDeVelocidad.style.bottom = `${String(corrimiento + (dev ? 20 : 18))}px`
}

// ─── EL ALIENTO EN EL TIEMPO ────────────────────────────────────────────────
//
// El único módulo que no muestra un número sino una HISTORIA, y es lo que la
// barra de la ficha no puede dar: la barra dice cómo está, esto dice hacia dónde
// va. Una criatura al 40% que viene bajando y una al 40% que viene subiendo son
// la misma barra y dos situaciones distintas.
//
// ─── SE MUESTREA POR TICK DEL MUNDO Y NO POR CUADRO ────────────────────────
//
// Es la misma regla que el encabezado de este archivo declara para el tick y el
// cuadro: muestreando por cuadro, la serie mediría la placa de video —a ×16 el
// mundo avanza dieciséis veces más rápido y la misma cantidad de muestras
// cubriría dieciséis veces menos mundo—. Por tick, diez minutos de mundo son
// diez minutos de mundo a cualquier velocidad, incluso en pausa.
const MUESTRAS = 120
/** Diez minutos de mundo repartidos en 120 muestras: una cada cinco segundos. */
const TICKS_POR_MUESTRA = 5 * HZ
const serieDeAliento: number[] = []
let ultimaMuestra = -1
let serieDibujada = ''

function muestrearElAliento(fraccion: number): void {
  const t = partida.state.tick
  if (Math.floor(t / TICKS_POR_MUESTRA) === ultimaMuestra) return
  ultimaMuestra = Math.floor(t / TICKS_POR_MUESTRA)
  serieDeAliento.push(fraccion)
  if (serieDeAliento.length > MUESTRAS) serieDeAliento.shift()
}

function dibujarLaSerie(): void {
  const cv = $('serie-aliento') as HTMLCanvasElement
  // El buffer se lleva al tamaño en pantalla: un canvas estirado por CSS dibuja
  // una línea de 1,4 px como una mancha de tres.
  const ancho = Math.max(1, Math.round(cv.clientWidth))
  const alto = Math.max(1, Math.round(cv.clientHeight))
  const firma = `${String(ancho)}x${String(alto)}|${serieDeAliento.map((v) => v.toFixed(3)).join(',')}`
  if (firma === serieDibujada) return
  serieDibujada = firma
  if (cv.width !== ancho || cv.height !== alto) {
    cv.width = ancho
    cv.height = alto
  }
  const ctx = cv.getContext('2d')
  if (ctx === null) return
  ctx.clearRect(0, 0, ancho, alto)
  if (serieDeAliento.length < 2) return

  // La escala del eje de abajo es SIEMPRE la ventana entera y no lo que hay:
  // con dos muestras ocupando todo el ancho, la serie parecería llena de
  // historia cuando recién arranca.
  const paso = ancho / (MUESTRAS - 1)
  const enY = (v: number): number => alto - v * (alto - 2) - 1
  const camino = new Path2D()
  serieDeAliento.forEach((v, i) => {
    const x = i * paso
    if (i === 0) camino.moveTo(x, enY(v))
    else camino.lineTo(x, enY(v))
  })

  const relleno = new Path2D(camino)
  relleno.lineTo((serieDeAliento.length - 1) * paso, alto)
  relleno.lineTo(0, alto)
  relleno.closePath()
  ctx.fillStyle = 'rgba(109, 158, 108, .14)'
  ctx.fill(relleno)

  ctx.strokeStyle = '#6d9e6c'
  ctx.lineWidth = 1.4
  ctx.lineJoin = 'round'
  ctx.stroke(camino)
}

/**
 * EL RENGLÓN DE ABAJO DE LA SERIE, que es lo que la hace legible sin ejes.
 *
 * El gráfico no lleva ni ejes ni grilla —lo que se lee de una serie de vida es
 * la FORMA— pero sin un solo número no se sabe si esos diez minutos son diez
 * minutos o son los tres que lleva la partida. Dice las dos cosas que faltan:
 * cuánto mundo cubre lo dibujado, y de cuánto es el techo.
 */
function pieDeLaSerie(): void {
  const cubre = (serieDeAliento.length - 1) * (TICKS_POR_MUESTRA / HZ)
  $('serie-dice').textContent =
    serieDeAliento.length < 2
      ? 'todavía no hay historia: la primera muestra sale a los cinco segundos de mundo'
      : `los últimos ${String(Math.round(cubre))} s de mundo · el techo es el aliento lleno`
}

/**
 * EL PLAN DE LA MENTE, y de quién es la meta.
 *
 * `DE QUIÉN` no es un adorno y se descubrió escribiendo un test: con la mente
 * conectada y sin ninguna orden, la criatura ya persigue metas propias, porque
 * el `drive` del cuidador COMPITE con sus necesidades en vez de reemplazarlas.
 * Entonces «hay una meta en curso» no distingue obedecer de vivir, y una
 * pantalla que no lo dijera haría creer que todo lo que se ve es consecuencia
 * de lo que se pidió.
 *
 * Los pasos los dibuja `unPaso()`, el MISMO que pinta los del turno abierto de
 * la charla. No es ahorro de líneas: dos vistas del mismo dato que se parecen
 * por casualidad se separan el día que alguien toca una sola.
 */
function planDeLaMente(): void {
  const meta = ordenes.enCurso
  $('persigue').textContent =
    meta === undefined
      ? '—'
      : `${meta.meta} (${meta.de === 'vos' ? 'tuya' : 'suya'})` +
        (meta.total > 1 ? ` · ${String(meta.hechas + 1)} de ${String(meta.total)}` : '')

  const encargo = ordenes.encargo
  const pasos = encargo === undefined ? [] : clausulasDe(encargo, ordenes.metaEnCurso, enCastellano)
  const caja = $('plan-pasos')
  const firma = pasos.map((p) => `${p.estado}:${p.texto}`).join('|')
  if (caja.dataset['firma'] !== firma) {
    caja.dataset['firma'] = firma
    caja.replaceChildren()
    for (const p of pasos) caja.appendChild(unPaso(p))
  }
  // Y se dice por qué la lista está vacía, que son dos motivos distintos: no le
  // pediste nada, o le pediste UNA sola cosa y el pedido ya la dice entera.
  $('plan-nota').textContent =
    pasos.length > 0
      ? ''
      : encargo === undefined
        ? 'No le pediste nada. Lo que persigue, si persigue algo, es suyo.'
        : 'Un pedido de una sola parte no tiene pasos que listar: es el pedido.'
}

/**
 * EL INSPECTOR: lo mismo que el globo, con lo que el globo deja afuera.
 *
 * El globo dice lo justo para seguir mirando el mapa; acá se queda escrito y con
 * el id crudo, que es lo único de todo esto que sirve para ir a buscar el cuerpo
 * a un log o a un test. Los dos salen de `lo-senalado.ts`, así que no se pueden
 * contradecir — es el mismo caso 7 del 12C que ya cuidan el mapa, la bandeja y
 * el catálogo.
 */
let inspeccionado = ''

function inspector(): void {
  const caja = $('inspector')
  const celda = anclada
  const e = ultimaEscena
  if (celda === undefined || e === undefined) {
    if (inspeccionado === 'nada') return
    inspeccionado = 'nada'
    caja.replaceChildren()
    const vacio = document.createElement('p')
    vacio.className = 'vacio'
    vacio.textContent = 'hacé click en algo del mapa'
    caja.appendChild(vacio)
    return
  }

  const s = loSenaladoEn(e, celda, PHYS)
  const pie = piePara(s, celdaEnEscena(e, celda))
  const firma = `${String(celda.x)},${String(celda.y)}|${firmaDe(s)}|${pie}`
  if (firma === inspeccionado) return
  inspeccionado = firma
  caja.replaceChildren()

  const cabeza = document.createElement('div')
  cabeza.className = 'cabeza'
  if (s !== undefined) cabeza.appendChild(enUnCanvas(s.d, 24, s.esAgente))
  const que = document.createElement('b')
  que.textContent = s?.titulo ?? 'nada acá'
  cabeza.appendChild(que)
  caja.appendChild(cabeza)

  const filas: readonly (readonly [string, string])[] = [
    ['celda', `${String(celda.x)}, ${String(celda.y)}`],
    ...(s === undefined
      ? []
      : ([
          ['de qué', s.de === '' ? s.d.nucleo : s.de],
          ['piezas', s.piezas],
          ['cómo es', s.comoEs],
          ['atadores', s.d.atadores.length > 0 ? s.d.atadores.join(' · ') : '—'],
          ['estado', s.d.estado + (s.d.podrido === true ? ' · podrido' : '')],
          ['id', s.id],
        ] as const)),
    ['la casilla', pie === '' ? '—' : pie],
  ]
  const dl = document.createElement('dl')
  for (const [k, v] of filas) {
    const dt = document.createElement('dt')
    dt.textContent = k
    const dd = document.createElement('dd')
    dd.textContent = v
    dl.append(dt, dd)
  }
  caja.appendChild(dl)
}

function cuadro(ahora: number): void {
  const pasado = ahora - ultimo
  ultimo = ahora

  // ─── El mundo, a su ritmo ────────────────────────────────────────────────
  if (velocidad > 0) {
    acumulado += pasado * velocidad
    // El tope existe para que volver de una pestaña en segundo plano no dispare
    // mil ticks de golpe: el mundo se atrasa y eso es lo honesto. Es la misma
    // decisión que `ticksPerdidos` mide en `perceive/src/bucle.ts`.
    let cuantos = 0
    while (acumulado >= MS_POR_TICK && cuantos < 8) {
      // `vivir` y no `partida.tick()`: el tick pelado avanza el mundo sin que
      // nadie piense, que es exactamente por qué la criatura decía «quieta» para
      // siempre. `vivir` hace pensar a las mentes ANTES del paso —la criatura
      // actúa sobre el mundo que vio, no sobre el que quedó después— y después
      // avanza uno.
      ordenes.antesDelTick(partida.state.tick)
      vivir(partida, ordenes.mentes, 1)
      // Y DESPUÉS del paso, lo que hizo. El progreso se narra por lo que pasó en
      // el mundo, así que se mira cuando el mundo ya se movió.
      ordenes.despuesDelTick()
      acumulado -= MS_POR_TICK
      cuantos++
    }
    if (acumulado > MS_POR_TICK * 8) acumulado = 0
  }

  // ─── La pantalla, al suyo ────────────────────────────────────────────────
  //
  // EL FOCO SIGUE A LA CRIATURA, y no es un lujo: hasta que la mente se conectó,
  // la criatura no se movía nunca y una cámara clavada en la orilla alcanzaba.
  // Con mente camina, y a los 241 ticks ya estaba fuera del encuadre — se veía
  // como que lo que llevaba en la mano perdía el nombre y salía el id crudo,
  // porque el cuerpo dejaba de estar en la escena.
  //
  // Cae en `parada` si la criatura ya no está: el mundo sigue existiendo después
  // de que se muere, y una cámara sin dónde mirar tiraría la pantalla abajo.
  const t0 = performance.now()
  const foco = partida.state.bodies.get('ana-cuerpo')?.at ?? parada
  const escena = escenaDe(partida.state, foco, encuadre)
  const mapa = mapaDe(escena, PHYS, relojDe(partida.state), sprites)
  lienzo.dibujar(mapa.px, zoom)
  msDelCuadro = performance.now() - t0

  hud(escena)
  panel(escena)
  inventario(escena)
  catalogo()
  charla()
  recuerdos()
  // Lo del dock va acá y no adentro de un `if (dev)`: los ocho paneles están
  // siempre en el DOM y se escriben igual con el dock apagado. La serie del
  // aliento sobre todo — si sólo se muestreara con el modo dev prendido, abrirlo
  // mostraría diez minutos de historia en blanco justo cuando se lo abre para
  // entender qué pasó.
  planDeLaMente()
  inspector()
  correrLosFlotantes()
  if (dev) {
    dibujarLaSerie()
    pieDeLaSerie()
  }
  ultimaEscena = escena
  // El cartel, DESPUÉS de la escena nueva: con el mundo corriendo, lo que está
  // abajo del puntero quieto cambia solo —el foco sigue a la criatura y el mapa
  // se desliza— y un cartel que sólo se actualice al mover el mouse mentiría.
  // Cuesta nada cuando nadie está señalando: es un `if` y se va.
  refrescarElCartel()
  refrescarElGlobo()

  // ─── Y el guardado, también entre cuadros ────────────────────────────────
  //
  // Sólo si el mundo AVANZÓ desde la última vez: con la partida en pausa el
  // estado no cambia, y reescribirlo cada cinco segundos sería escribir en disco
  // para dejar exactamente lo mismo.
  cuadros++
  const turnoDeAhora = ordenes.charla.at(-1)?.turno ?? 0
  const cambio = partida.state.tick !== guardadoEn || turnoDeAhora !== charlaGuardadaEn
  if (!guardando && cuadros % CUADROS_ENTRE_GUARDADOS === 0 && cambio) {
    guardando = true
    const tick = partida.state.tick
    void guardar(baul, partida.state, ordenes.memoria, QUIEN, ordenes.charla, ordenes.encargo)
      .then(() => {
        guardadoEn = tick
        charlaGuardadaEn = turnoDeAhora
        $('guardado').textContent = `tick ${String(tick)}`
      })
      .catch((e: unknown) => {
        // Se dice y no se apaga el juego. Un guardado que falla en silencio es
        // cómo se pierde una partida sin enterarse hasta que es tarde.
        $('guardado').textContent = 'FALLÓ (mirá la consola)'
        console.error('[guardado] no se pudo escribir:', e)
      })
      .finally(() => {
        guardando = false
      })
  }

  // ─── Y quién hay del otro lado, cada tanto ───────────────────────────────
  //
  // Por contador de cuadros y no con un `setInterval`, por lo mismo que el
  // guardado y el surtido: con la pestaña en segundo plano `rAF` se frena, y un
  // intervalo seguiría pegándole a un depósito que nadie está mirando.
  if (cuadros % CUADROS_ENTRE_SONDEOS === 0) void mirarElDeposito()

  // ─── Y el surtidor, entre cuadros ────────────────────────────────────────
  if (hayDeposito && !surtiendo && cuadros % CUADROS_ENTRE_SURTIDOS === 0 && sprites.loQueFalta().length > 0) {
    surtiendo = true
    void surtir(sprites, { phys: PHYS, deposito }).finally(() => {
      surtiendo = false
    })
  }

  requestAnimationFrame(cuadro)
}

requestAnimationFrame(cuadro)
