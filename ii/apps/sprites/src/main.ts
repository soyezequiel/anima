// ─── LEVANTAR EL DEPÓSITO, con el disco como baúl ───────────────────────────
//
// Este archivo es el ÚNICO del paquete que toca el disco y el reloj, y por eso
// es el único que no se prueba en la suite. La lógica entera —las rutas, la
// puerta, «primero gana»— vive en `servidor.ts` con el baúl inyectado, así que
// se corre en memoria sin abrir un archivo.
//
// Es la misma frontera que `store/src/deposito.ts` dejó escrita: *un paquete
// cuya única implementación no se puede correr en la suite es un paquete que
// nadie prueba*.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import type { Sprite } from '@anima/dibujo'

import { preguntarleACodex } from './codex.js'
import { vigilar } from './quien-hay.js'
import { baulEnMemoria, crearServidor, type Baul } from './servidor.js'

const ARCHIVO = process.env['ANIMA_SPRITES'] ?? './datos/sprites.json'
const PUERTO = Number.parseInt(process.env['PUERTO'] ?? '5190', 10)
const MODELO_DICHO = process.env['ANIMA_CODEX_MODELO'] ?? 'gpt-5.6-luna'

/** El baúl de memoria, con una copia en disco después de cada alta. */
function baulEnDisco(ruta: string): Baul {
  let iniciales: Sprite[] = []
  if (existsSync(ruta)) {
    try {
      const crudo: unknown = JSON.parse(readFileSync(ruta, 'utf8'))
      if (Array.isArray(crudo)) iniciales = crudo as Sprite[]
    } catch {
      // Un archivo ilegible no puede impedir arrancar: se empieza vacío y el
      // viejo queda donde está para que alguien lo mire.
      console.error(`no se pudo leer ${ruta}: se arranca vacío`)
    }
  }
  const dentro = baulEnMemoria(iniciales)
  return {
    todos: dentro.todos,
    uno: dentro.uno,
    poner: (s) => {
      dentro.poner(s)
      mkdirSync(dirname(ruta), { recursive: true })
      writeFileSync(ruta, JSON.stringify(dentro.todos(), null, 1), 'utf8')
    },
  }
}

// El dibujante se enchufa acá y en ningún otro lado: `servidor.ts` sólo sabe
// que existe alguien que dibuja. Cambiar Codex por otro es cambiar esta línea.
const baul = baulEnDisco(ARCHIVO)

// EL VIGÍA ARRANCA MIRANDO, y ese `mirar()` suelto es la diferencia entre que el
// juego vea las luces al abrir o quince segundos después: el primer sondeo tarda
// lo que tarden dos `--version`, y si empieza recién con el primer pedido, el
// primer pedido se lo pierde.
const vigia = vigilar()
vigia.mirar()

/**
 * CUÁNTO SE ESPERA UNA RESPUESTA DEL CHAT, y no es el de dibujar.
 *
 * Dibujar 576 celdas de pixel art se banca dos minutos porque el que espera es
 * un botón que alguien apretó. Acá el que espera es una criatura que ya contestó
 * «dale, voy» y ya se movió: una respuesta que llega dos minutos después llega a
 * un mundo donde la persona escribió otras tres frases, y `Ordenes` la va a
 * descartar por vieja igual. O sea que el tiempo de más no compra nada y sí
 * ocupa el único episodio en vuelo.
 */
const ESPERA_DEL_CHAT_MS = Number.parseInt(process.env['ANIMA_CODEX_ESPERA_CHAT'] ?? '30000', 10)

/**
 * ═══ SI ESTE DEPÓSITO GASTA LA CUENTA DE QUIEN LO CORRE ════════════════════
 *
 * Y viene en NO. Todo lo de acá abajo —dibujar, contestar el chat, forjar
 * habilidades— termina en un `codex exec` que corre en ESTA máquina, o sea con
 * la cuenta de quien levantó el depósito. Mientras el depósito vivía en un
 * `localhost` eso era el dueño usando lo suyo. Publicado, es cualquiera con la
 * URL gastándole la cuota, y ninguna de las tres rutas pregunta quién llama.
 *
 * `ANIMA_CLI_LOCAL=1` lo vuelve a encender, que es lo que corresponde en la
 * máquina del dueño. Es el mismo nombre de variable que usa Ánima I, a
 * propósito: son dos procesos y una sola decisión.
 *
 * ─── SIN DIBUJANTE ESTO NO SE APAGA: CAMBIA DE OFICIO ──────────────────────
 *
 * El depósito sigue entero. Guarda, reparte, y —esto es lo nuevo— arma los
 * prompts para que los llame el navegador con la llave del que juega (ver el
 * sobre en dos tiempos, en `servidor.ts`). Lo único que deja de hacer es pagar.
 */
const CLI_LOCAL = process.env['ANIMA_CLI_LOCAL'] === '1'

const dibujante = CLI_LOCAL
  ? {
      nombre: 'codex',
      dibujar: (prompt: string) => preguntarleACodex(prompt),
      responder: (prompt: string) => preguntarleACodex(prompt, ESPERA_DEL_CHAT_MS),
      // El reloj lo elige la forja y no este archivo: un episodio es el viaje al
      // modelo MÁS un typecheck por candidata, y quien sabe cuánto es eso es quien
      // lo arma. Acá sólo se le pasa el puente.
      forjar: (prompt: string, timeoutMs: number) => preguntarleACodex(prompt, timeoutMs),
    }
  : undefined

crearServidor(baul, {
  ...(dibujante === undefined ? {} : { dibujante }),
  vigia,
}).listen(PUERTO, () => {
  console.log(`depósito de dibujos en http://localhost:${String(PUERTO)}`)
  console.log(`  guardando en ${ARCHIVO}`)
  console.log(`  ${String(baul.todos().length)} dibujos ya adentro`)
  if (dibujante === undefined) {
    console.log('  SIN dibujante propio: no gasta ninguna cuenta (ANIMA_CLI_LOCAL=1 lo enciende)')
    console.log('  arma los prompts en /sobre y el navegador los lleva a su propia API')
  } else {
    console.log(`  dibujante: codex exec · modelo ${MODELO_DICHO}`)
    console.log(`  y contesta el chat en /leer, esperando hasta ${String(ESPERA_DEL_CHAT_MS)} ms`)
    console.log(`  y forja habilidades en /forjar`)
  }
})
