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

import { dibujarConCodex } from './codex.js'
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

crearServidor(baul, { dibujante: { nombre: 'codex', dibujar: dibujarConCodex }, vigia }).listen(PUERTO, () => {
  console.log(`depósito de dibujos en http://localhost:${String(PUERTO)}`)
  console.log(`  guardando en ${ARCHIVO}`)
  console.log(`  ${String(baul.todos().length)} dibujos ya adentro`)
  console.log(`  dibujante: codex exec · modelo ${MODELO_DICHO}`)
})
