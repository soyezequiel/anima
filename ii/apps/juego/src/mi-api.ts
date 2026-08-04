// ─── TU PROPIA API, DESDE EL NAVEGADOR ──────────────────────────────────────
//
// El depósito dejó de poner la cuenta (ADR 0089). Lo que la reemplaza es esto:
// una API compatible con OpenAI que trae el que juega, guardada en su navegador
// y llamada desde su navegador.
//
// ─── LO QUE ESTE ARCHIVO CONTRADICE, Y ESTÁ BIEN QUE SE NOTE ───────────────
//
// `apps/sprites/src/codex.ts` dice, desde que existe, que el modelo se llama
// del backend porque *«las credenciales de una cuenta no viajan al cliente»*.
// Sigue siendo cierto y por eso mismo esto vive acá: la credencial que se usa
// ahora **es del cliente**, así que el lugar donde no tiene que estar es el
// servidor. La regla no cambió; cambió de quién es la cuenta.
//
// Lo que NO se movió es el prompt: lo sigue armando el depósito. Ver el sobre
// en dos tiempos, en `apps/sprites/src/servidor.ts`.
//
// ═══ LAS LLAVES SON LAS MISMAS QUE LAS DE ÁNIMA I ══════════════════════════
//
// A propósito, y es una decisión de producto: las dos Ánimas viven en el mismo
// dominio (ADR 0088), así que comparten `localStorage`. Configurar la API una
// vez en el ⚙ de Ánima I la deja andando en las dos, que es lo que espera
// cualquiera que entró por la puerta y bajó al /v2.
//
// El precio es un acoplamiento por un string entre dos apps que no se importan
// entre sí. Está acotado a los tres nombres de acá abajo y escrito en los dos
// lados; si algún día se separan los dominios, esto deja de andar solo y hay
// que darle a Ánima II su propia pantalla de ajustes.

/** Los mismos nombres que usa `apps/web/src/auth/ai.ts`. No los cambies de a uno. */
const DONDE_LA_ELECCION = 'anima:ai:choice'
const DONDE_LA_API = 'anima:ai:openai-settings'

export interface MiApi {
  readonly baseUrl: string
  readonly apiKey: string
  readonly model: string
}

export interface Salida {
  readonly ok: boolean
  readonly texto: string
  readonly porque?: string
}

/**
 * Le pone `/v1` sólo si no hay camino ninguno. Misma regla que Ánima I: pegar
 * `https://api.openai.com` sin la versión es el error más común, y adivinarle
 * a una URL que YA tiene camino rompería una que funciona.
 */
export function normalizarBase(crudo: string): string {
  const limpio = crudo.trim().replace(/\/+$/, '')
  if (limpio === '') return ''
  try {
    const u = new URL(limpio)
    return u.pathname === '' || u.pathname === '/' ? `${u.origin}/v1` : limpio
  } catch {
    return limpio
  }
}

/**
 * LA API CONFIGURADA, o `undefined`.
 *
 * Se lee con desconfianza por lo mismo que el guardado del juego: un
 * `localStorage` es texto que cualquiera edita, y acá encima lo escribe OTRA
 * aplicación. Los tres campos van juntos o no va ninguno — con dos de tres no
 * hay a quién llamar, y devolver algo a medias haría fallar el viaje lejos de
 * la causa.
 *
 * `soloSiEstaElegida` mira además que el jugador la haya ENCENDIDO en Ánima I.
 * Tener una llave guardada no es querer gastarla: alguien que apagó la mente
 * real y volvió al simulado no debería empezar a pagar por bajar al /v2.
 */
export function miApi(soloSiEstaElegida = true): MiApi | undefined {
  try {
    if (soloSiEstaElegida && localStorage.getItem(DONDE_LA_ELECCION) !== 'openai') return undefined
    const crudo: unknown = JSON.parse(localStorage.getItem(DONDE_LA_API) ?? 'null')
    if (typeof crudo !== 'object' || crudo === null) return undefined
    const o = crudo as Record<string, unknown>
    const baseUrl = typeof o['baseUrl'] === 'string' ? normalizarBase(o['baseUrl']) : ''
    const apiKey = typeof o['apiKey'] === 'string' ? o['apiKey'].trim() : ''
    const model = typeof o['model'] === 'string' ? o['model'].trim() : ''
    if (baseUrl === '' || apiKey === '' || model === '') return undefined
    return { baseUrl, apiKey, model }
  } catch {
    return undefined
  }
}

/** Lo que hace el viaje: recibe el prompt que armó el depósito y trae texto. */
export type LlevarAlModelo = (prompt: string, timeoutMs?: number) => Promise<Salida>

const ESPERA_POR_OMISION_MS = 120_000

/**
 * EL VIAJE, y nunca tira: contesta si salió o no.
 *
 * Es la misma forma que `preguntarleACodex` —`{ok, texto, porque}`— a propósito:
 * del otro lado, `revisarRespuesta`, `leerRespuesta` y `leerCandidatas` no se
 * enteran de quién contestó, y no tienen por qué.
 *
 * Sin `response_format`: acá se le pide TEXTO, no JSON. Lo que el depósito
 * espera de vuelta son bloques de código y firmas numeradas, y forzar un objeto
 * JSON alrededor sería envolver para desenvolver.
 */
export function llevarAMiModelo(api: MiApi): LlevarAlModelo {
  return async (prompt, timeoutMs = ESPERA_POR_OMISION_MS) => {
    try {
      const r = await fetch(`${api.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${api.apiKey}` },
        body: JSON.stringify({ model: api.model, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!r.ok) {
        const cuerpo = await r.text().catch(() => '')
        return { ok: false, texto: '', porque: porQueFallo(r.status, cuerpo) }
      }
      const j = (await r.json()) as { choices?: { message?: { content?: unknown } }[] }
      const texto = j.choices?.[0]?.message?.content
      if (typeof texto !== 'string' || texto.trim() === '') {
        return { ok: false, texto: '', porque: 'tu API contestó sin texto: revisá el nombre del modelo' }
      }
      return { ok: true, texto }
    } catch (e) {
      // Sin respuesta no hay estado que leer, y el navegador no distingue un
      // CORS de una caída (por diseño). Se nombran las dos.
      const porque = e instanceof Error ? e.message : 'falló el viaje'
      return {
        ok: false,
        texto: '',
        porque: `no se pudo hablar con tu API (${porque}): la URL, que esté caída, o que no permita llamadas desde el navegador`,
      }
    }
  }
}

function porQueFallo(estado: number, cuerpo: string): string {
  let detalle = cuerpo.trim().slice(0, 200)
  try {
    const j = JSON.parse(cuerpo) as { error?: { message?: unknown } }
    if (typeof j.error?.message === 'string') detalle = j.error.message
  } catch {
    // No era JSON: sirve el crudo.
  }
  if (estado === 401 || estado === 403) return `tu API rechazó la llave: ${detalle}`
  if (estado === 404) return `tu API no encontró la ruta o el modelo: ${detalle}`
  if (estado === 429) return `tu API te está limitando (sin cuota o muy rápido): ${detalle}`
  return `tu API contestó ${String(estado)}: ${detalle}`
}
