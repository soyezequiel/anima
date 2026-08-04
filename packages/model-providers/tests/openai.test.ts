import { describe, expect, it } from 'vitest';
import {
  createOpenAiTransport,
  desenvolverJson,
  esRechazoDeFormato,
  normalizarBaseUrl,
  podarEsquema,
} from '../src/openai.js';
import type { CodexTransportInput } from '../src/codex.js';

/**
 * El transporte hacia una API OpenAI-compatible que trae el que juega. Lo que
 * más se prueba acá no es el camino feliz —es un POST y un `.json()`— sino los
 * tres lugares donde un servidor ajeno se porta distinto del de OpenAI, que es
 * el único motivo por el que este archivo existe y no son diez líneas.
 */

/** Un `fetch` de mentira que anota lo que le pidieron y contesta lo guionado. */
function fetchDeMentira(respuestas: (() => Response)[]): {
  fetch: typeof globalThis.fetch;
  pedidos: { url: string; cuerpo: Record<string, unknown> }[];
} {
  const pedidos: { url: string; cuerpo: Record<string, unknown> }[] = [];
  let i = 0;
  const fetch = ((url: string, init?: RequestInit) => {
    pedidos.push({
      url,
      cuerpo: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    const siguiente = respuestas[i] ?? respuestas.at(-1);
    i += 1;
    return Promise.resolve(siguiente!());
  }) as unknown as typeof globalThis.fetch;
  return { fetch, pedidos };
}

function respuestaOk(contenido: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: contenido } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function respuestaError(status: number, mensaje: string): Response {
  return new Response(JSON.stringify({ error: { message: mensaje } }), { status });
}

const CONSULTA: CodexTransportInput = {
  kind: 'dialogue',
  prompt: 'decí algo',
  schema: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
    additionalProperties: false,
  },
};

describe('la URL base, que es donde más se equivoca el que la pega', () => {
  it('le pone /v1 cuando no hay camino ninguno', () => {
    expect(normalizarBaseUrl('https://api.openai.com')).toBe('https://api.openai.com/v1');
    expect(normalizarBaseUrl('https://api.openai.com/')).toBe('https://api.openai.com/v1');
  });

  it('respeta el camino que el usuario ya escribió', () => {
    // Acá adivinar rompería una URL que anda: si escribió el camino, sabe.
    expect(normalizarBaseUrl('http://localhost:11434/v1')).toBe('http://localhost:11434/v1');
    expect(normalizarBaseUrl('https://casa.ar/api/openai/v1/')).toBe('https://casa.ar/api/openai/v1');
  });

  it('un vacío sigue vacío, y un disparate no se disfraza de URL', () => {
    expect(normalizarBaseUrl('   ')).toBe('');
    expect(normalizarBaseUrl('esto no es una url')).toBe('esto no es una url');
  });
});

describe('el esquema podado para las salidas estructuradas', () => {
  it('saca las palabras que strict no admite', () => {
    const podado = podarEsquema({
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: { type: 'number', minimum: 0 },
    }) as Record<string, unknown>;
    expect(podado).toEqual({ type: 'array', items: { type: 'number' } });
  });

  it('exige todas las propiedades en cada objeto, por dentro también', () => {
    const podado = podarEsquema({
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'object', properties: { c: { type: 'string' } } },
      },
      required: ['a'],
    }) as Record<string, unknown>;
    expect(podado.required).toEqual(['a', 'b']);
    expect(podado.additionalProperties).toBe(false);
    const b = (podado.properties as Record<string, Record<string, unknown>>).b;
    expect(b.required).toEqual(['c']);
    expect(b.additionalProperties).toBe(false);
  });

  it('deja pasar enum y anyOf, que sí se admiten', () => {
    const podado = podarEsquema({ type: 'string', enum: ['day', 'night'] });
    expect(podado).toEqual({ type: 'string', enum: ['day', 'night'] });
  });
});

describe('el cerco de ```', () => {
  it('lo saca cuando el servidor lo manda igual', () => {
    expect(desenvolverJson('```json\n{"text":"hola"}\n```')).toBe('{"text":"hola"}');
    expect(desenvolverJson('```\n{"text":"hola"}\n```')).toBe('{"text":"hola"}');
  });

  it('no toca lo que ya viene limpio', () => {
    expect(desenvolverJson('  {"text":"hola"}  ')).toBe('{"text":"hola"}');
  });
});

describe('cuándo bajar un escalón y cuándo no', () => {
  it('un 400 que habla del formato baja', () => {
    expect(esRechazoDeFormato(400, 'response_format is not supported')).toBe(true);
    expect(esRechazoDeFormato(400, "unknown field 'json_schema'")).toBe(true);
  });

  it('un 400 de la llave o del prompt NO baja: reintentar gasta dos veces', () => {
    expect(esRechazoDeFormato(400, 'invalid api key')).toBe(false);
    expect(esRechazoDeFormato(401, 'response_format bla')).toBe(false);
  });
});

describe('el transporte hablando con un servidor', () => {
  it('pide el esquema estricto y devuelve el contenido', async () => {
    const { fetch, pedidos } = fetchDeMentira([() => respuestaOk('{"text":"hola"}')]);
    const transporte = createOpenAiTransport({
      baseUrl: 'https://api.openai.com',
      apiKey: 'sk-x',
      model: 'gpt-4o-mini',
      fetchImpl: fetch,
    });

    expect(await transporte(CONSULTA)).toBe('{"text":"hola"}');
    expect(pedidos[0]!.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(pedidos[0]!.cuerpo.model).toBe('gpt-4o-mini');
    expect(pedidos[0]!.cuerpo.response_format).toMatchObject({ type: 'json_schema' });
  });

  /**
   * LA PRUEBA QUE JUSTIFICA EL DISEÑO. Un Ollama viejo no sabe `json_schema`;
   * si eso tumbara la consulta, media lista de proveedores compatibles quedaría
   * afuera por una palabra del pedido.
   */
  it('baja a json_object cuando el servidor no sabe imponer el esquema', async () => {
    const { fetch, pedidos } = fetchDeMentira([
      () => respuestaError(400, "response_format 'json_schema' is not supported"),
      () => respuestaOk('{"text":"igual salió"}'),
    ]);
    const transporte = createOpenAiTransport({
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'x',
      model: 'llama3.1',
      fetchImpl: fetch,
    });

    expect(await transporte(CONSULTA)).toBe('{"text":"igual salió"}');
    expect(pedidos[1]!.cuerpo.response_format).toEqual({ type: 'json_object' });
    // Y el esquema pasa a decirse en el prompt, que es la única forma que queda
    // de que el modelo sepa qué forma tiene que tener lo que conteste.
    const mensajes = pedidos[1]!.cuerpo.messages as { content: string }[];
    expect(mensajes[0]!.content).toContain('cumpla este esquema');
  });

  it('el escalón se recuerda: la segunda consulta no vuelve a pagar el fallo', async () => {
    const { fetch, pedidos } = fetchDeMentira([
      () => respuestaError(400, 'response_format not supported'),
      () => respuestaOk('{"text":"a"}'),
      () => respuestaOk('{"text":"b"}'),
    ]);
    const transporte = createOpenAiTransport({
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'x',
      model: 'llama3.1',
      fetchImpl: fetch,
    });

    await transporte(CONSULTA);
    await transporte(CONSULTA);
    // Tres pedidos y no cuatro: el fallo se pagó una sola vez en la sesión.
    expect(pedidos).toHaveLength(3);
    expect(pedidos[2]!.cuerpo.response_format).toEqual({ type: 'json_object' });
  });

  it('llega hasta sin response_format si el servidor tampoco sabe json_object', async () => {
    const { fetch, pedidos } = fetchDeMentira([
      () => respuestaError(400, 'response_format unsupported'),
      () => respuestaError(400, 'response_format unsupported'),
      () => respuestaOk('```json\n{"text":"al final"}\n```'),
    ]);
    const transporte = createOpenAiTransport({
      baseUrl: 'http://casa.ar/v1',
      apiKey: 'x',
      model: 'lo-que-sea',
      fetchImpl: fetch,
    });

    expect(await transporte(CONSULTA)).toBe('{"text":"al final"}');
    expect(pedidos[2]!.cuerpo.response_format).toBeUndefined();
  });

  it('una llave rechazada dice que es la llave, y no reintenta', async () => {
    const { fetch, pedidos } = fetchDeMentira([
      () => respuestaError(401, 'Incorrect API key provided'),
    ]);
    const transporte = createOpenAiTransport({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-mala',
      model: 'gpt-4o-mini',
      fetchImpl: fetch,
    });

    await expect(transporte(CONSULTA)).rejects.toThrow(/llave/);
    expect(pedidos).toHaveLength(1);
  });

  it('sin respuesta nombra las dos causas reales, porque el CORS no se puede distinguir', async () => {
    const fetch = (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof globalThis.fetch;
    const transporte = createOpenAiTransport({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'x',
      model: 'gpt-4o-mini',
      fetchImpl: fetch,
    });

    await expect(transporte(CONSULTA)).rejects.toThrow(/navegador/);
  });

  it('un modelo que no existe suele volver sin texto, y eso se dice', async () => {
    const { fetch } = fetchDeMentira([() => respuestaOk('   ')]);
    const transporte = createOpenAiTransport({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'x',
      model: 'inventado',
      fetchImpl: fetch,
    });

    await expect(transporte(CONSULTA)).rejects.toThrow(/modelo que no existe/);
  });
});
