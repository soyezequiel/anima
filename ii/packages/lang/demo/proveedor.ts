/**
 * EL PROVEEDOR — lo único de todo esto que habla con el mundo de afuera.
 *
 * Vive en `demo/` y no en `src/` a propósito, y no es una cuestión de orden: en
 * `src/` **no puede vivir**. La regla 2 prohíbe `await` y `async` en todo `src/`,
 * hay un guardián que lo hace cumplir, y una llamada de red sin `await` no
 * existe. Que el proveedor no entre al paquete no es una limitación: es la forma
 * que el ADR II-0024 le dio al hito.
 *
 * `@anima/lang` produce una `Consulta` —un DATO— y este archivo la manda. Cuando
 * llega el Hito 8 esto se muda a `@anima/llm` con más cosas (caché, presupuesto,
 * `AbortController`, streaming) y la firma no cambia.
 *
 * ─── Los tres transportes ───────────────────────────────────────────────────
 *
 *     ANIMA_LLM=claude   `claude --print`, con la sesión del CLI de la máquina
 *     ANIMA_LLM=codex    `codex exec`, con la cuenta de ChatGPT del usuario
 *     ANIMA_LLM=openai   HTTP, con `OPENAI_API_KEY` del entorno
 *     ANIMA_LLM=falso    un modelo de mentira, para probar el enchufe sin gastar
 *
 * **Este archivo nunca ve una credencial.** El transporte `codex` usa la sesión
 * que el CLI ya tiene abierta en `~/.codex`, y el `openai` lee una variable de
 * entorno que pone el usuario. No hay nada que escribir acá.
 *
 * ─── Lo que se le pide al modelo, y lo que NO ───────────────────────────────
 *
 * Se le pide que **elija de una lista**. No que escriba un predicado, no que
 * invente una meta, no que devuelva texto libre: que mire la frase y diga cuál
 * de las N firmas que este mundo sabe establecer es la que se pidió.
 *
 * Y lo que conteste pasa igual por los seis portones de `revisar()`, incluido el
 * que verifica que la firma esté en la lista que se le ofreció. **El modelo
 * propone, el código local dispone** — un modelo que alucine una firma de más no
 * llega a ninguna criatura.
 */

import { spawn } from 'node:child_process'
import type { Consulta, RespuestaDelModelo } from '../src/consulta.js'

export type Transporte = 'claude' | 'codex' | 'openai' | 'falso'

export function transporteElegido(): Transporte {
  const v = process.env['ANIMA_LLM']
  if (v === 'claude' || v === 'codex' || v === 'openai') return v
  return 'falso'
}

/**
 * EL PROMPT. Corto a propósito: cada palabra de más es una forma de que el
 * modelo conteste otra cosa.
 *
 * El vocabulario va porque es lo que le permite decir «cuando dice *leña*
 * quiere decir *madera*» en vez de inventar una sustancia — y sale de `Physics`,
 * así que si el oráculo inventa algo, el prompt lo incluye solo.
 */
export function promptDe(c: Consulta): string {
  return [
    'Sos el lector de un juego. Una persona le habla a su criatura y vos decidís',
    'a qué ESTADO DEL MUNDO se refiere. No expliques nada.',
    '',
    `LA FRASE: «${c.texto}»`,
    '',
    'Las cláusulas que no se entendieron son estos índices: ' + c.clausulas.join(', '),
    '',
    'LOS ÚNICOS ESTADOS QUE ESTE MUNDO SABE CONSEGUIR (elegí de acá, textual):',
    ...c.firmas.map((f) => `  ${f}`),
    '',
    'Lo que el mundo sabe nombrar, por si ayuda a entender de qué habla:',
    `  ${c.vocabulario.slice(0, 120).join(', ')}`,
    '',
    'Elegí el estado que MEJOR sirva a lo que la persona quiere, aunque no sea',
    'literal: si pide comida, el estado es tenerla en la mano.',
    '',
    'CONTESTÁ SÓLO CON UN JSON, sin markdown y sin comentarios, de esta forma:',
    '  {"clausulas":[{"indice":0,"firma":"<una de las de arriba, textual>"}]}',
    '',
    'Sólo contestá {"clausulas":[]} si NINGUNA de las de arriba acerca a lo pedido.',
  ].join('\n')
}

/** El JSON que el modelo tenía que devolver, sacado de lo que sea que devolvió. */
export function leerRespuesta(salida: string, llave: string): RespuestaDelModelo | undefined {
  // ─── SE CUENTAN LAS LLAVES, no se adivina con un regex ────────────────────
  //
  // La primera versión buscaba con
  // `/\{[\s\S]*?"clausulas"[\s\S]*?\}\s*\}/` y fallaba con la respuesta
  // correcta: `{"clausulas":[{"indice":0,"firma":"..."}]}` termina en `}` `]`
  // `}`, y ese `]` del medio rompe el `\}\s*\}`. O sea que el proveedor
  // contestaba bien y el demo decía «no aportó nada».
  //
  // Un objeto JSON no se reconoce con una expresión regular —el anidamiento no
  // es regular— así que se cuenta: desde cada `{`, se avanza sumando y restando
  // llaves hasta cerrar, salteando las que están adentro de un string.
  const candidatos: string[] = []
  for (let i = 0; i < salida.length; i++) {
    if (salida[i] !== '{') continue
    let hondo = 0
    let enTexto = false
    let escapado = false
    for (let j = i; j < salida.length; j++) {
      const c = salida[j]
      if (escapado) {
        escapado = false
        continue
      }
      if (c === '\\') {
        escapado = true
        continue
      }
      if (c === '"') enTexto = !enTexto
      if (enTexto) continue
      if (c === '{') hondo++
      else if (c === '}') {
        hondo--
        if (hondo === 0) {
          const trozo = salida.slice(i, j + 1)
          if (trozo.includes('"clausulas"')) candidatos.push(trozo)
          break
        }
      }
    }
  }
  // De atrás para adelante: los CLI escriben encabezados y razonamiento antes del
  // mensaje final, y el último objeto con la forma correcta es el que vale.
  for (let i = candidatos.length - 1; i >= 0; i--) {
    const crudo = candidatos[i]
    if (crudo === undefined) continue
    try {
      const v = JSON.parse(crudo) as { clausulas?: unknown }
      if (!Array.isArray(v.clausulas)) continue
      const cs: { indice: number; firma: string }[] = []
      for (const c of v.clausulas) {
        const o = c as { indice?: unknown; firma?: unknown }
        if (typeof o.indice === 'number' && typeof o.firma === 'string') {
          cs.push({ indice: o.indice, firma: o.firma })
        }
      }
      return { llave, clausulas: cs }
    } catch {
      continue
    }
  }
  return undefined
}

/**
 * `claude --print`, con los mismos argumentos que Ánima I usa en
 * `apps/api/src/claude.ts` — no los inventé, están copiados de ahí.
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
 * menos, y la tarea es elegir una fila de una lista de doce — el «modelo chico
 * que corrige la lectura» del documento de arquitectura, que es literalmente
 * este caso.
 *
 * Se puede pisar con `ANIMA_LLM_MODELO`.
 *
 * ─── La respuesta viene envuelta ────────────────────────────────────────────
 *
 * `--output-format json` devuelve un sobre con `duration_ms`, `usage`, `cost` y
 * el texto del modelo adentro de `result` —ESCAPADO—, así que buscar
 * `"clausulas"` sobre la salida cruda no engancha nada: en el sobre dice
 * `{\"clausulas\"`. Hay que abrir el sobre primero.
 */
function porClaude(prompt: string, llave: string, timeoutMs: number): Promise<RespuestaDelModelo | undefined> {
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
    const cerrar = (r: RespuestaDelModelo | undefined): void => {
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
      if (costo !== undefined) console.log(`     [modelo ${modelo} · US$ ${costo.toFixed(4)}]`)
      cerrar(leerRespuesta(texto, llave))
    })
    child.stdin.end(prompt)
  })
}

/** `codex exec`, tal como lo llama Ánima I: shell, porque en Windows es un .cmd. */
function porCodex(prompt: string, llave: string, timeoutMs: number): Promise<RespuestaDelModelo | undefined> {
  return new Promise((resolve) => {
    const child = spawn('codex exec --skip-git-repo-check -', {
      shell: true,
      windowsHide: true,
    })
    let out = ''
    let err = ''
    let listo = false
    const cerrar = (r: RespuestaDelModelo | undefined): void => {
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
    child.stdout.on('data', (d: Buffer) => (out += d.toString()))
    child.stderr.on('data', (d: Buffer) => (err += d.toString()))
    child.on('error', () => cerrar(undefined))
    child.on('close', () => {
      if (/usage limit|quota/i.test(out + err)) {
        console.log('     [el proveedor dijo que no hay cuota]')
        cerrar(undefined)
        return
      }
      cerrar(leerRespuesta(out, llave))
    })
    child.stdin.end(prompt)
  })
}

/** HTTP directo. La clave sale del entorno y este archivo no la mira. */
async function porOpenAI(prompt: string, llave: string, timeoutMs: number): Promise<RespuestaDelModelo | undefined> {
  const clave = process.env['OPENAI_API_KEY']
  if (clave === undefined || clave === '') {
    console.log('     [ANIMA_LLM=openai pero no hay OPENAI_API_KEY en el entorno]')
    return undefined
  }
  const corte = AbortSignal.timeout(timeoutMs)
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
    return leerRespuesta(j.choices?.[0]?.message?.content ?? '', llave)
  } catch {
    console.log('     [el proveedor no contestó a tiempo — y el cuerpo ya se movió]')
    return undefined
  }
}

/**
 * UN MODELO DE MENTIRA, para probar el enchufe sin gastar cuota.
 *
 * Nueve pistas y nada más. **No está para ser bueno**, está para que el camino
 * exista y se pueda comparar contra el de sin proveedor. Uno que acertara todo
 * mediría el simulador y no el enganche.
 */
const PISTAS: readonly (readonly [string, string])[] = [
  ['rio', 'holding(tag:carnoso)'],
  ['pescar', 'holding(tag:carnoso)'],
  ['pesca', 'holding(tag:carnoso)'],
  ['comida', 'holding(tag:carnoso)'],
  ['lena', 'emitsPower>0'],
  ['tronco', 'emitsPower>0'],
  ['fuego', 'emitsPower>0'],
  ['choza', 'reach>=2'],
  ['silla', 'reach>=2'],
]

function porFalso(c: Consulta): RespuestaDelModelo | undefined {
  const t = c.texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const cs: { indice: number; firma: string }[] = []
  for (const i of c.clausulas) {
    for (const [pista, firma] of PISTAS) {
      if (t.includes(pista) && c.firmas.includes(firma)) {
        cs.push({ indice: i, firma })
        break
      }
    }
  }
  return cs.length === 0 ? undefined : { llave: c.llave, clausulas: cs }
}

/**
 * PREGUNTARLE AL MODELO.
 *
 * `undefined` cuando no contesta, cuando tarda de más, cuando no hay cuota o
 * cuando lo que dijo no se entiende. **Ninguno de esos casos es un error**: el
 * acuse ya salió y el cuerpo ya se movió. Ésa es toda la apuesta del hito.
 */
export async function preguntarle(
  c: Consulta,
  timeoutMs = 30_000,
): Promise<RespuestaDelModelo | undefined> {
  const t = transporteElegido()
  if (t === 'falso') return porFalso(c)
  const prompt = promptDe(c)
  if (t === 'claude') return porClaude(prompt, c.llave, timeoutMs)
  if (t === 'codex') return porCodex(prompt, c.llave, timeoutMs)
  return porOpenAI(prompt, c.llave, timeoutMs)
}
