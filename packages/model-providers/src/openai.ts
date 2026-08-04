import type { CodexTransport, CodexTransportInput } from './codex.js';

/**
 * ═══ TRAÉ TU PROPIA API ════════════════════════════════════════════════════
 *
 * Un transporte hacia cualquier servidor que hable el dialecto de OpenAI
 * (`POST /chat/completions`): la API de OpenAI, OpenRouter, Groq, un Ollama o
 * un LM Studio corriendo en la máquina del que juega.
 *
 * ─── QUÉ ES UN «TRANSPORTE» ACÁ, QUE ES LA MITAD DE POR QUÉ ESTO ES CORTO ──
 *
 * `CodexModelProvider` no sabe con qué modelo habla. Arma un prompt y un
 * esquema JSON, se los pasa a una función, y espera texto de vuelta. Toda la
 * inteligencia de Ánima —los prompts, el parseo, la validación de lo que
 * vuelve— ya está escrita del otro lado de esa función y no se toca. Este
 * archivo es nada más que esa función, hablando otro protocolo.
 *
 * ─── Y POR QUÉ LO LLAMA EL NAVEGADOR Y NO EL SERVIDOR (ADR 0089) ───────────
 *
 * Porque la llave es del que juega. Si viajara al backend para que él haga el
 * pedido, el backend pasaría a ser un lugar donde hay llaves ajenas: en la
 * memoria del proceso, en un log que a alguien se le escape, en un volcado. No
 * guardarlas no alcanza — basta con tocarlas.
 *
 * Yendo directo, la llave sale del `localStorage` del visitante y va a su
 * proveedor. Nunca existe en ninguna máquina nuestra. El precio es que el
 * proveedor tiene que mandar cabeceras CORS (permiso para que una página de
 * otro dominio le hable), y los cuatro de arriba las mandan.
 */

export interface OpenAiCompatibleConfig {
  /**
   * La raíz de la API. Se acepta con `/v1` o sin él: pegar
   * `https://api.openai.com` sin la versión es el error más común de todos, y
   * cuesta menos arreglarlo acá que explicarlo en la interfaz.
   */
  baseUrl: string;
  apiKey: string;
  /** El nombre exacto que use ese proveedor: `gpt-4o-mini`, `llama3.1`, etc. */
  model: string;
  /**
   * Cuánto se espera una respuesta. Generoso a propósito: los prompts de
   * habilidades son largos y un modelo que razona tarda.
   */
  timeoutMs?: number;
  /** Solo para pruebas: sustituye el `fetch` real. */
  fetchImpl?: typeof globalThis.fetch;
}

const TIMEOUT_POR_OMISION_MS = 120_000;

/**
 * Normaliza lo que el usuario pegó en el campo. Dos reglas y nada más:
 * se le saca la barra final, y si no tiene camino se le pone `/v1`.
 *
 * La segunda es una adivinanza y por eso está acotada: solo cuando NO hay
 * camino ninguno. `https://api.openai.com` → `/v1`; pero
 * `http://localhost:11434/v1` o un `.../api/openai/v1` se respetan tal cual,
 * porque ahí el usuario ya dijo dónde está la API y adivinarle encima sería
 * romperle una URL que funciona.
 */
export function normalizarBaseUrl(crudo: string): string {
  const limpio = crudo.trim().replace(/\/+$/, '');
  if (limpio === '') return '';
  try {
    const url = new URL(limpio);
    if (url.pathname === '' || url.pathname === '/') return `${url.origin}/v1`;
    return limpio;
  } catch {
    // No es una URL: se devuelve como vino y que falle el pedido con un error
    // del navegador, que es más claro que uno inventado por nosotros.
    return limpio;
  }
}

/**
 * ═══ EL ESQUEMA, PODADO PARA QUE `strict` NO LO RECHACE ════════════════════
 *
 * Los esquemas de Ánima usan cosas que las «salidas estructuradas» de OpenAI
 * NO admiten: `minItems`, `maxItems`, `minimum`. Mandarlos con `strict: true`
 * devuelve un 400 que no habla del modelo ni del prompt, sino de una palabra
 * del esquema — el peor error posible para alguien que acaba de pegar su llave
 * y no sabe si el problema es la llave, la URL o el modelo.
 *
 * Así que se poda a lo que el subconjunto acepta. Se pierde una cota que el
 * modelo igual tiene escrita en el prompt («máximo 3 piezas»), y lo que vuelva
 * lo revisa el proveedor como siempre: nada de acá se ejecuta ni se guarda sin
 * pasar por su validación.
 *
 * De paso fuerza las dos condiciones que `strict` exige en CADA objeto —
 * `additionalProperties: false` y todas las propiedades en `required`—. Los
 * esquemas de Ánima ya las cumplen a mano (es su convención: lo que no aplica
 * viaja vacío, no ausente), así que forzarlas hoy no cambia ninguno; existe
 * para que el que escriba el esquema número 21 no tenga que acordarse.
 */
export function podarEsquema(esquema: unknown): unknown {
  if (Array.isArray(esquema)) return esquema.map(podarEsquema);
  if (typeof esquema !== 'object' || esquema === null) return esquema;
  const entra = esquema as Record<string, unknown>;
  const sale: Record<string, unknown> = {};
  for (const clave of ['type', 'enum', 'description', 'anyOf'] as const) {
    if (entra[clave] !== undefined) sale[clave] = podarEsquema(entra[clave]);
  }
  if (entra.items !== undefined) sale.items = podarEsquema(entra.items);
  if (typeof entra.properties === 'object' && entra.properties !== null) {
    const propiedades = entra.properties as Record<string, unknown>;
    const podadas: Record<string, unknown> = {};
    for (const [nombre, valor] of Object.entries(propiedades)) {
      podadas[nombre] = podarEsquema(valor);
    }
    sale.properties = podadas;
    sale.required = Object.keys(podadas);
    sale.additionalProperties = false;
  }
  return sale;
}

/**
 * Saca el JSON de adentro de un cerco de ```. Los servidores que no admiten
 * salida estructurada suelen contestar el bloque de código igual, aunque el
 * prompt pida lo contrario, y un `JSON.parse` sobre eso falla por una razón
 * que no tiene nada que ver con lo que el modelo entendió.
 */
export function desenvolverJson(texto: string): string {
  const limpio = texto.trim();
  const cercado = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/.exec(limpio);
  return (cercado?.[1] ?? limpio).trim();
}

/**
 * Cómo se le pide el JSON a este servidor. Se empieza por lo más estricto y se
 * BAJA un escalón cada vez que el servidor rechaza el de arriba, recordando el
 * escalón para el resto de la sesión.
 *
 * Recordarlo es lo que importa: sin eso, cada consulta de la partida paga un
 * pedido fallido antes del bueno. Es la misma lección que el puente de Codex ya
 * tenía escrita para los modelos que la cuenta no ofrece.
 */
type ModoDeSalida = 'json_schema' | 'json_object' | 'ninguno';

const SIGUIENTE_MODO: Record<ModoDeSalida, ModoDeSalida | null> = {
  json_schema: 'json_object',
  json_object: 'ninguno',
  ninguno: null,
};

/**
 * ¿Este 400 es «no sé hacer eso» o «tu pedido está mal»? Solo el primero
 * merece bajar un escalón; con el segundo, reintentar es gastar dos veces para
 * fallar igual.
 */
export function esRechazoDeFormato(estado: number, cuerpo: string): boolean {
  if (estado !== 400 && estado !== 404 && estado !== 422) return false;
  return /response_format|json_schema|structured|schema|unsupported|not supported/i.test(cuerpo);
}

/** El esquema dicho en el prompt, para cuando el servidor no sabe imponerlo. */
function esquemaEnElPrompt(prompt: string, esquema: unknown): string {
  return `${prompt}

Respondé ÚNICAMENTE con un objeto JSON que cumpla este esquema. Sin texto
antes ni después, sin explicaciones y sin bloque de código:
${JSON.stringify(esquema)}`;
}

/** Lee el mensaje humano del error que devolvió el servidor. */
function detalleDelError(cuerpo: string, estado: number): string {
  try {
    const json = JSON.parse(cuerpo) as { error?: { message?: unknown } | string };
    const error = json.error;
    if (typeof error === 'string') return error;
    if (typeof error?.message === 'string') return error.message;
  } catch {
    // No era JSON: sirve el texto crudo, recortado.
  }
  return cuerpo.trim().slice(0, 300) || `el servidor contestó ${String(estado)}`;
}

/**
 * Traduce los códigos que más se ven a algo que diga qué hacer. El resto viaja
 * con el mensaje del proveedor, que suele ser mejor que cualquier paráfrasis.
 */
function comoExplicarlo(estado: number, detalle: string): string {
  if (estado === 401 || estado === 403) {
    return `tu API rechazó la llave (${String(estado)}): revisá que esté completa y que sea de este proveedor — ${detalle}`;
  }
  if (estado === 404) {
    return `tu API no encontró la ruta o el modelo (404): revisá la URL base y el nombre del modelo — ${detalle}`;
  }
  if (estado === 429) {
    return `tu API te está limitando (429): te quedaste sin cuota o vas muy rápido — ${detalle}`;
  }
  return `tu API contestó ${String(estado)}: ${detalle}`;
}

export function createOpenAiTransport(config: OpenAiCompatibleConfig): CodexTransport {
  const base = normalizarBaseUrl(config.baseUrl);
  const timeoutMs = config.timeoutMs ?? TIMEOUT_POR_OMISION_MS;
  const hacerFetch = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  // El escalón al que este servidor ya demostró que llega. Vive fuera del
  // transporte para durar toda la sesión, no una consulta.
  let modo: ModoDeSalida = 'json_schema';

  const pedir = async (input: CodexTransportInput, conModo: ModoDeSalida): Promise<Response> => {
    const podado = podarEsquema(input.schema);
    const prompt = conModo === 'json_schema' ? input.prompt : esquemaEnElPrompt(input.prompt, podado);
    const cuerpo: Record<string, unknown> = {
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
    };
    if (conModo === 'json_schema') {
      cuerpo.response_format = {
        type: 'json_schema',
        json_schema: { name: 'anima', strict: true, schema: podado },
      };
    } else if (conModo === 'json_object') {
      cuerpo.response_format = { type: 'json_object' };
    }
    return hacerFetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(timeoutMs),
    });
  };

  return async (input) => {
    let intento = modo;
    for (;;) {
      let res: Response;
      try {
        res = await pedir(input, intento);
      } catch (error) {
        // Sin respuesta: no hay estado que leer. Los dos casos que se ven son
        // el reloj y el CORS, y el segundo el navegador no lo cuenta (por
        // diseño: un error de CORS llega como un fallo de red pelado), así que
        // el mensaje nombra a los dos en vez de adivinar uno.
        const porque = error instanceof Error ? error.message : String(error);
        throw new Error(
          `no se pudo hablar con tu API (${porque}): puede ser la URL, que esté caída, ` +
            'o que el proveedor no permita llamadas desde el navegador',
        );
      }

      if (!res.ok) {
        const cuerpo = await res.text().catch(() => '');
        const siguiente = SIGUIENTE_MODO[intento];
        if (siguiente !== null && esRechazoDeFormato(res.status, cuerpo)) {
          // Este servidor no sabe imponer el esquema: se baja un escalón y se
          // recuerda, para que la próxima consulta empiece donde terminó ésta.
          intento = siguiente;
          modo = siguiente;
          continue;
        }
        throw new Error(comoExplicarlo(res.status, detalleDelError(cuerpo, res.status)));
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: unknown } }[];
      };
      const texto = json.choices?.[0]?.message?.content;
      if (typeof texto !== 'string' || texto.trim() === '') {
        throw new Error('tu API contestó sin texto: puede ser un modelo que no existe en ese servidor');
      }
      const limpio = desenvolverJson(texto);
      // El pensamiento en vivo: este camino no lo tiene (una consulta, una
      // respuesta), pero el `answer` final se emite igual para que el panel de
      // pensamiento muestre lo mismo que muestra con Codex al cerrar.
      input.onEvent?.({ type: 'answer', text: limpio });
      return limpio;
    }
  };
}
