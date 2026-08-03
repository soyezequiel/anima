/**
 * EL TRANSPORTE — lo único de todo esto que habla con el mundo de afuera.
 *
 * Vive en `demo/` y no en `src/` a propósito, y no es una cuestión de orden: en
 * `src/` **no puede vivir**. La regla 2 prohíbe `await` y `async` en todo `src/`,
 * hay un guardián que lo hace cumplir, y una llamada de red sin `await` no
 * existe.
 *
 * ─── POR QUÉ ESTE ARCHIVO SE SEPARÓ DEL PROVEEDOR DEL CHAT ──────────────────
 *
 * Porque al intentar mudarlo entero apareció que **no se podía**: el cliente del
 * Hito 6 importa `Consulta`, que es **la forma del CHAT**. Mudarlo tal cual
 * habría hecho que `@anima/llm` dependa de `@anima/lang` — la flecha al revés, y
 * la fragua tiene otra forma (`Encargo`).
 *
 * Así que se partió por donde correspondía:
 *
 *   ESTE archivo          prompt (texto) → respuesta (texto). No sabe de nadie.
 *   lang/demo/proveedor   `Consulta` → prompt, y respuesta → `RespuestaDelModelo`
 *   forge (cuando toque)  `Encargo` → prompt, y respuesta → candidata
 *
 * **Un transporte que conoce la forma del que pregunta sirve para uno solo.**
 *
 * ─── Los cuatro transportes ─────────────────────────────────────────────────
 *
 *     ANIMA_LLM=claude   `claude --print`, con la sesión del CLI de la máquina
 *     ANIMA_LLM=codex    `codex exec`, con la cuenta de ChatGPT del usuario
 *     ANIMA_LLM=openai   HTTP, con `OPENAI_API_KEY` del entorno
 *     ANIMA_LLM=falso    no habla con nadie: devuelve `undefined`
 *
 * **Este archivo nunca ve una credencial.** El de `codex` usa la sesión que el
 * CLI ya tiene abierta, y el de `openai` lee una variable de entorno que pone el
 * usuario. No hay nada que escribir acá.
 */

import { spawn } from 'node:child_process'

export type Transporte = 'claude' | 'codex' | 'openai' | 'falso'

/**
 * QUÉ PROVEEDOR USAR — por bandera o por variable de entorno, en ese orden.
 *
 * La bandera existe porque la variable no es portable y eso rompió el primer
 * intento del usuario: `ANIMA_LLM=claude pnpm ...` es sintaxis de bash y en
 * PowerShell da «no se reconoce como nombre de un cmdlet». Ahí hay que escribir
 * `$env:ANIMA_LLM="claude"; pnpm ...`, que nadie se acuerda.
 *
 * Un demo que sólo se puede correr en un shell es un demo que la mitad de las
 * veces no se corre.
 */
export function transporteElegido(): Transporte {
  for (const a of process.argv.slice(2)) {
    if (a === '--claude') return 'claude'
    if (a === '--codex') return 'codex'
    if (a === '--openai') return 'openai'
    if (a === '--falso') return 'falso'
  }
  const v = process.env['ANIMA_LLM']
  if (v === 'claude' || v === 'codex' || v === 'openai') return v
  return 'falso'
}

/**
 * LO QUE COSTÓ LA ÚLTIMA CONSULTA, si el transporte lo dice.
 *
 * Es un dato y no un `console.log`, y el cambio no es cosmético: antes este
 * código IMPRIMÍA `[modelo haiku · US$ 0.0149]` desde adentro, o sea que se
 * colaba en la parte liviana del demo sin que el demo pudiera decidir. Un módulo
 * que escribe en la pantalla de otro no se puede acomodar.
 *
 * Y desde el Hito 8 tiene un segundo lector: el contador de `@anima/llm`, que lo
 * convierte a milésimas enteras con `deUsd`.
 */
let ultimoCosto: { modelo: string; usd: number } | undefined
export function costoDeLaUltima(): { modelo: string; usd: number } | undefined {
  return ultimoCosto
}

/** Los argumentos que NO son banderas. Lo usa cualquier demo que reciba texto. */
export function loQueNoEsBandera(): string {
  return process.argv
    .slice(2)
    .filter((a) => !a.startsWith('--'))
    .join(' ')
    .trim()
}

/**
 * `claude --print`, con los mismos argumentos que Ánima I usa en
 * `apps/api/src/claude.ts` — no se inventaron, están copiados de ahí.
 *
 * ─── Los cuatro argumentos que importan ─────────────────────────────────────
 *
 *     --safe-mode                sin CLAUDE.md, sin plugins, sin hooks, sin MCP
 *     --no-session-persistence   no deja sesión guardada
 *     --tools ""                 sin herramientas: puro prompt → respuesta
 *     --model haiku              ver abajo
 *
 * Los tres primeros son de higiene: esta consulta no tiene por qué ver el
 * proyecto ni dejar rastro. El cuarto es de PLATA, y está medido: sin `--model`
 * el CLI usa Opus y una sola frase costó **US$ 0,024**. Con Haiku sale ~40×
 * menos.
 *
 * Se puede pisar con `ANIMA_LLM_MODELO`.
 *
 * ─── La respuesta viene envuelta ────────────────────────────────────────────
 *
 * `--output-format json` devuelve un sobre con `duration_ms`, `usage`, `cost` y
 * el texto del modelo adentro de `result` —ESCAPADO—, así que buscar sobre la
 * salida cruda no engancha nada. Hay que abrir el sobre primero.
 */
function porClaude(prompt: string, timeoutMs: number, signal?: AbortSignal): Promise<string | undefined> {
  const modelo = process.env['ANIMA_LLM_MODELO'] ?? 'haiku'
  const args = [
    '--print',
    '--output-format',
    'json',
    '--safe-mode',
    '--no-session-persistence',
    '--tools',
    '""',
    '--effort',
    'low',
    '--model',
    modelo,
  ]
  return new Promise((resolve) => {
    const child = spawn(`claude ${args.join(' ')}`, { shell: true, windowsHide: true })
    let out = ''
    let err = ''
    let listo = false
    const cerrar = (r: string | undefined): void => {
      if (listo) return
      listo = true
      clearTimeout(t)
      resolve(r)
    }
    const t = setTimeout(() => {
      child.kill()
      console.log('     [el proveedor no contestó a tiempo — y el cuerpo ya se movió]')
      cerrar(undefined)
    }, timeoutMs)
    matarSiCortan(child, cerrar, signal)
    child.stdout.on('data', (d: Buffer) => (out += d.toString()))
    child.stderr.on('data', (d: Buffer) => (err += d.toString()))
    child.on('error', () => cerrar(undefined))
    child.on('close', () => {
      // El sobre. Si no se puede abrir, se prueba con la salida cruda: un CLI que
      // cambie de formato no tiene por qué tirar todo abajo.
      let texto = out
      let costo: number | undefined
      try {
        const sobre = JSON.parse(out.slice(out.indexOf('{'))) as {
          result?: unknown
          is_error?: unknown
          total_cost_usd?: unknown
        }
        if (sobre.is_error === true) {
          console.log(`     [claude contestó con error]`)
          cerrar(undefined)
          return
        }
        if (typeof sobre.result === 'string') texto = sobre.result
        if (typeof sobre.total_cost_usd === 'number') costo = sobre.total_cost_usd
      } catch {
        if (err.trim() !== '') console.log(`     [claude: ${err.trim().slice(0, 120)}]`)
      }
      ultimoCosto = costo === undefined ? undefined : { modelo, usd: costo }
      cerrar(texto)
    })
    child.stdin.end(prompt)
  })
}

/** `codex exec`, tal como lo llama Ánima I: shell, porque en Windows es un .cmd. */
function porCodex(prompt: string, timeoutMs: number, signal?: AbortSignal): Promise<string | undefined> {
  return new Promise((resolve) => {
    const child = spawn('codex exec --skip-git-repo-check -', { shell: true, windowsHide: true })
    let out = ''
    let err = ''
    let listo = false
    const cerrar = (r: string | undefined): void => {
      if (listo) return
      listo = true
      clearTimeout(t)
      resolve(r)
    }
    const t = setTimeout(() => {
      child.kill()
      console.log('     [el proveedor no contestó a tiempo — y el cuerpo ya se movió]')
      cerrar(undefined)
    }, timeoutMs)
    matarSiCortan(child, cerrar, signal)
    child.stdout.on('data', (d: Buffer) => (out += d.toString()))
    child.stderr.on('data', (d: Buffer) => (err += d.toString()))
    child.on('error', () => cerrar(undefined))
    child.on('close', () => {
      if (/usage limit|quota/i.test(out + err)) {
        console.log('     [el proveedor dijo que no hay cuota]')
        cerrar(undefined)
        return
      }
      cerrar(out)
    })
    child.stdin.end(prompt)
  })
}

/** HTTP directo. La clave sale del entorno y este archivo no la mira. */
async function porOpenAI(prompt: string, timeoutMs: number, signal?: AbortSignal): Promise<string | undefined> {
  const clave = process.env['OPENAI_API_KEY']
  if (clave === undefined || clave === '') {
    console.log('     [ANIMA_LLM=openai pero no hay OPENAI_API_KEY en el entorno]')
    return undefined
  }
  // Las dos razones para cortar, en una sola señal: el reloj y el cuidador. La
  // primera que dispare gana, que es exactamente lo que `any` quiere decir.
  const corte = signal === undefined ? AbortSignal.timeout(timeoutMs) : AbortSignal.any([AbortSignal.timeout(timeoutMs), signal])
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${clave}` },
      body: JSON.stringify({
        model: process.env['ANIMA_LLM_MODELO'] ?? 'gpt-4o-mini',
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: corte,
    })
    if (!r.ok) {
      console.log(`     [el proveedor contestó ${String(r.status)}]`)
      return undefined
    }
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] }
    return j.choices?.[0]?.message?.content ?? ''
  } catch {
    console.log('     [el proveedor no contestó a tiempo — y el cuerpo ya se movió]')
    return undefined
  }
}

/**
 * PREGUNTARLE AL MODELO, en texto plano.
 *
 * `undefined` cuando no contesta, cuando tarda de más o cuando no hay cuota.
 * **Ninguno de esos casos es un error** para quien llama: en el chat el acuse ya
 * salió y el cuerpo ya se movió; en la fragua la criatura sigue con lo que sabe.
 *
 * `falso` devuelve `undefined` a propósito: un transporte de mentira que
 * contestara algo mediría al simulador y no al enganche. Quien quiera un modelo
 * de mentira que acierte se lo arma con su propia forma — el chat lo hace.
 */
export function preguntarTexto(
  prompt: string,
  timeoutMs = 30_000,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const t = transporteElegido()
  if (t === 'falso') return Promise.resolve(undefined)
  if (t === 'claude') return porClaude(prompt, timeoutMs, signal)
  if (t === 'codex') return porCodex(prompt, timeoutMs, signal)
  return porOpenAI(prompt, timeoutMs, signal)
}

/**
 * SI CORTAN, SE MATA EL PROCESO. Es la mitad que faltaba del corte.
 *
 * ─── LO QUE ESTABA ROTO, y estaba escrito como si no ───────────────────────
 *
 * `OpcionesDeOrdenes.preguntar` de la app dice que el `AbortSignal` «permite que
 * una corrección del cuidador **corte el viaje** en vez de sólo ignorar lo que
 * vuelva: ignorar una respuesta que ya se pagó es tarde». Era cierto del
 * contrato y falso de acá: esta función no recibía ninguna señal de afuera y se
 * armaba su propio reloj, así que la corrección ignoraba la respuesta y el CLI
 * seguía corriendo hasta el final.
 *
 * Medido contra Claude, con una corrección a los 20 ticks:
 *
 *     abortada a los     319 ms
 *     siguió viva     14.729 ms   ← y se pagó entera
 *
 * El `kill` ya existía para el timeout; lo que faltaba era el cable.
 *
 * ─── LO QUE ESTO HACE Y LO QUE NO, dicho con lo que se pudo medir ─────────
 *
 * HACE que el que preguntó **deje de esperar en el acto**: la promesa asienta a
 * los 315 ms en vez de a los 15.048. Eso es lo que le importa a la criatura, y
 * es lo único que este archivo controla.
 *
 * NO GARANTIZA que el proceso del CLI se muera. Los dos se lanzan con
 * `shell: true` —hace falta, en Windows son `.cmd`— así que lo que se mata es el
 * `cmd.exe` y el CLI queda de NIETO, y en Windows un huérfano sigue corriendo.
 * Se intentó medirlo desde afuera y se llegó hasta acá:
 *
 *   · el primer intento midió el proceso EQUIVOCADO. El filtro era «la línea de
 *     comando dice claude», y eso engancha al `pnpm`, al `tsx` y al demo, porque
 *     el proveedor se elige con `--claude`. Los números que salieron de ahí eran
 *     del demo terminando, no del CLI;
 *   · con el filtro bueno, cada CLI resulta ser una CADENA de shims distinta
 *     —`cmd` → `node` → `.exe`, y a veces uno re-ejecuta en otro— así que «el
 *     proceso» no es uno y medir cuál murió es un trabajo aparte.
 *
 * Se probó un `taskkill /T` sobre el árbol y **no se pudo demostrar que sirviera**,
 * así que se sacó: un mecanismo que no se puede medir es un guardián apagado.
 *
 * Y NO CANCELA LA INFERENCIA. Cuando el cuidador corrige, la consulta ya salió
 * para el servidor; matar cualquier cosa de este lado no descuenta los tokens que
 * el otro lado ya procesó. Lo único que se pierde es el sobre con
 * `total_cost_usd`, que el CLI imprime al final.
 */
function matarSiCortan(
  child: { kill: () => boolean },
  cerrar: (r: string | undefined) => void,
  signal?: AbortSignal,
): void {
  if (signal === undefined) return
  const matar = (): void => {
    child.kill()
    cerrar(undefined)
  }
  // Ya venía cortada: no se espera al evento, que no va a llegar nunca.
  if (signal.aborted) {
    matar()
    return
  }
  signal.addEventListener('abort', matar, { once: true })
}
