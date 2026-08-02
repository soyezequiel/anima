// ─── EL DIBUJANTE DE VERDAD: `codex exec` ───────────────────────────────────
//
// ─── POR QUÉ ESTO VIVE EN EL BACKEND Y NO EN LA PÁGINA ─────────────────────
//
// Porque Codex es un PROCESO, no una API que un navegador pueda llamar: hay que
// hacerle `spawn`. Y aunque se pudiera, las credenciales de una cuenta no viajan
// al cliente — cualquiera que abra el juego se las llevaría.
//
// Así que el reparto queda: **el navegador pide un dibujo por clave, el backend
// lo consigue**. De paso sale gratis lo que más importa: el dibujo se valida y
// se guarda en el mismo lugar donde se pidió, así que nunca existe un sprite que
// una pantalla usó y el depósito no tenga.
//
// ─── LO QUE SE APRENDIÓ EN ÁNIMA I Y SE HEREDA SIN DISCUTIR ────────────────
//
//   - **en Windows `codex` es un shim `.cmd`**, así que el `spawn` necesita
//     `shell: true`;
//   - **la respuesta sale por `--output-last-message`** y no por stdout: stdout
//     trae el ruido del CLI;
//   - **el slug del modelo lleva sufijo.** `gpt-5.6` a secas no existe y
//     devuelve 400: los que hay son `-sol`, `-terra` y `-luna`. Y si la cuenta
//     igual no ofrece el pedido, **se cae solo al Automático** en vez de dejar
//     de dibujar — la caída que Ánima I ya tenía escrita;
//   - **`--sandbox read-only` y `--ephemeral`**: esto dibuja, no toca nada.

import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TIMEOUT_MS = Number.parseInt(process.env['ANIMA_CODEX_TIMEOUT'] ?? '120000', 10)

/**
 * EL MODELO, y por qué está escrito acá y no se deja al Automático.
 *
 * Lo eligió el usuario. Sin `--model`, Codex usa el predeterminado de la cuenta
 * —que en esta máquina es `gpt-5.6-sol` con razonamiento `high`, o sea el modelo
 * caro razonando fuerte para dibujar 576 celdas de pixel art—.
 *
 * El slug lleva sufijo a propósito: **`gpt-5.6` a secas no existe** y devuelve
 * 400. Los que hay son `-sol`, `-terra` y `-luna`, y esa lección ya la pagó este
 * proyecto una vez.
 */
const MODELO_POR_OMISION = 'gpt-5.6-luna'
const MODELO = process.env['ANIMA_CODEX_MODELO'] ?? MODELO_POR_OMISION

/**
 * Si la cuenta no ofrece el modelo pedido, se recuerda y se sigue con el
 * Automático. Es la caída que Ánima I ya tenía: **un modelo que no está no puede
 * apagar el dibujante**, y preguntar dos veces por lo mismo es gastar dos veces.
 */
let modeloRechazado = false

function noOfreceElModelo(stderr: string): boolean {
  const s = stderr.toLowerCase()
  return s.includes('model') && (s.includes('not found') || s.includes('unsupported') || s.includes('400'))
}

export interface Salida {
  readonly ok: boolean
  readonly texto: string
  readonly porque?: string
}

/** Le pide un dibujo a Codex. Nunca tira: contesta si salió o no. */
export async function dibujarConCodex(prompt: string): Promise<Salida> {
  let dir: string | undefined
  try {
    dir = await mkdtemp(join(tmpdir(), 'anima-dibujo-'))
    // Una copia `const`: adentro de `armar` TypeScript no puede saber que la
    // `let` de afuera ya está asignada, y `--cd undefined` sería un comando roto.
    const donde = dir
    const salida = join(donde, 'ultimo.txt')
    const armar = (conModelo: boolean): string[] => {
      const args = [
        'exec',
        '--skip-git-repo-check',
        '--ephemeral',
        '--sandbox',
        'read-only',
        '--color',
        'never',
        '--cd',
        donde,
        '--output-last-message',
        salida,
      ]
      if (conModelo && MODELO !== '') args.push('--model', MODELO)
      args.push('-') // el prompt entra por stdin
      return args
    }

    let r = await correr(armar(!modeloRechazado), prompt)
    if (r.arranco === false) return { ok: false, texto: '', porque: 'no encontré el CLI de codex en el PATH' }

    // La caída: si la cuenta no ofrece el modelo, se anota y se va al Automático.
    if (r.codigo !== 0 && !modeloRechazado && noOfreceElModelo(r.stderr)) {
      modeloRechazado = true
      console.warn(`[dibujante] esta cuenta no ofrece ${MODELO}; sigo con el modelo Automático`)
      r = await correr(armar(false), prompt)
    }
    if (r.codigo !== 0) {
      return { ok: false, texto: '', porque: `codex salió con ${String(r.codigo)}: ${r.stderr.slice(0, 300)}` }
    }
    const texto = await readFile(salida, 'utf8')
    return { ok: true, texto }
  } catch (e) {
    return { ok: false, texto: '', porque: e instanceof Error ? e.message : 'falló el dibujante' }
  } finally {
    if (dir !== undefined) await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

interface Corrida {
  readonly codigo: number | null
  readonly stderr: string
  readonly arranco: boolean
}

function correr(args: readonly string[], stdin: string): Promise<Corrida> {
  return new Promise((resolve) => {
    // Los argumentos son constantes de este archivo o una ruta temporal que
    // generamos nosotros: no hay nada del usuario en la línea de comandos. Lo
    // que sí viene de afuera —el prompt— entra por STDIN, que no se interpreta.
    const linea = args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')
    const hijo = spawn(`codex ${linea}`, { shell: true, windowsHide: true })

    let stderr = ''
    let listo = false
    const terminar = (c: Corrida): void => {
      if (!listo) {
        listo = true
        resolve(c)
      }
    }
    const reloj = setTimeout(() => {
      hijo.kill()
      terminar({ codigo: null, stderr: `${stderr}\n[se pasó de ${String(TIMEOUT_MS)} ms]`, arranco: true })
    }, TIMEOUT_MS)

    hijo.stderr?.on('data', (c: Buffer) => (stderr += c.toString()))
    hijo.on('error', () => {
      clearTimeout(reloj)
      terminar({ codigo: null, stderr, arranco: false })
    })
    hijo.on('close', (codigo) => {
      clearTimeout(reloj)
      terminar({ codigo, stderr, arranco: true })
    })
    hijo.stdin?.write(stdin)
    hijo.stdin?.end()
  })
}
