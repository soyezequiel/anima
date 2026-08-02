// ─── EL DEPÓSITO COMPARTIDO DE DIBUJOS ──────────────────────────────────────
//
// Lo que el usuario pidió, textual: *«esta creación de sprite queda guardada en
// el backend y se usará en cualquier partida de cualquiera»*.
//
// Es un servidor chico a propósito: cuatro rutas, cero dependencias fuera de
// `node:`, y **la misma puerta que corre en el cliente**. Esa última parte no es
// ahorro de código: si el servidor validara distinto que el cliente, un dibujo
// podría entrar al depósito y romperse en la pantalla de otro, y la falla
// aparecería en la máquina de alguien que no lo dibujó.
//
// Es exactamente el reparto de Ánima I, que ya tenía las dos puertas —la del
// agente, que ahorra el viaje, y la del mundo, que decide— con la regla escrita:
// *«las dos tienen que aplicar exactamente la misma regla»*.
//
// ─── PRIMERO GANA, Y POR QUÉ NO «EL MEJOR» ─────────────────────────────────
//
// Una clave dibujada no se pisa. Las alternativas suenan mejores y ninguna lo
// es a esta altura del proyecto:
//
//   «el último gana»    dos jugadores pueden dejar el mundo distinto turnándose,
//                       y nadie sabría por qué la vara cambia de dibujo sola;
//   «el mejor gana»     pide un criterio de calidad automático, y no existe:
//                       si se pudiera medir que un dibujo es lindo, no haría
//                       falta un modelo para hacerlo;
//   «el más votado»     pide jugadores votando, o sea un producto que todavía
//                       no existe.
//
// Primero gana es estable, es explicable en una frase y **se puede cambiar
// después sin migrar nada**: lo único que hay guardado son dibujos válidos.
//
// ─── LO QUE ESTE SERVIDOR NO HACE, DICHO ANTES DE QUE ALGUIEN LO ASUMA ─────
//
// No autentica, no modera y no borra. Con el alfabeto de cuatro índices y una
// grilla de 24 el espacio de lo ofensivo es chico pero **no es vacío**, y hoy la
// única defensa es que un dibujo entra una sola vez por clave. Antes de abrir
// esto a internet hace falta al menos: quién lo mandó, y una forma de sacar uno.
// Está escrito acá para que sea una decisión y no un olvido.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import { buildSeedPhysics } from '@anima/physics'
import {
  aspectoDe,
  encargoDe,
  partirClave,
  revisarRespuesta,
  revisarSprite,
  type ClaveDeSprite,
  type Sprite,
} from '@anima/dibujo'

/**
 * La física está acá por una sola cosa: **pintar la portada**. Un sprite guarda
 * índices de paleta, no colores, así que para mostrarlo hay que saber de qué
 * materia es — y eso lo dice el catálogo.
 *
 * Es la misma indirección que hace segura a toda la puerta, vista del otro lado:
 * el depósito guarda dibujos que no pueden tener un color equivocado, porque no
 * tienen ninguno.
 */
const PHYS = buildSeedPhysics()

/** Dónde quedan los dibujos. Interfaz por lo mismo que `Deposito` en `store`. */
export interface Baul {
  todos: () => readonly Sprite[]
  uno: (clave: ClaveDeSprite) => Sprite | undefined
  poner: (s: Sprite) => void
}

export function baulEnMemoria(iniciales: readonly Sprite[] = []): Baul {
  const m = new Map<ClaveDeSprite, Sprite>()
  for (const s of iniciales) m.set(s.clave, s)
  return {
    // Ordenado por clave: dos servidores con los mismos dibujos contestan
    // idéntico, y un cliente puede comparar respuestas sin normalizar.
    todos: () => [...m.values()].sort((a, b) => (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0)),
    uno: (clave) => m.get(clave),
    poner: (s) => {
      // PRIMERO GANA: si ya está, no se pisa. Ver el encabezado.
      if (!m.has(s.clave)) m.set(s.clave, s)
    },
  }
}

/** Un sprite como SVG, con los colores que le tocan a su materia. */
function svgDe(s: Sprite): string {
  const p = partirClave(s.clave)
  const paleta = aspectoDe(p?.sustancia ?? '', PHYS).paleta
  const tono = (i: string): string => (i === '2' ? paleta.sombra : i === '3' ? paleta.luz : paleta.base)
  let cuerpo = ''
  for (let y = 0; y < s.filas.length; y++) {
    const fila = s.filas[y]
    if (fila === undefined) continue
    for (let x = 0; x < fila.length; x++) {
      const i = fila.charAt(x)
      if (i === '0') continue
      cuerpo += `<rect x="${String(x)}" y="${String(y)}" width="1" height="1" fill="${tono(i)}"/>`
    }
  }
  return `<svg viewBox="0 0 ${String(s.lado)} ${String(s.lado)}" width="72" height="72" shape-rendering="crispEdges">${cuerpo}</svg>`
}

function escapar(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** La portada: qué hay adentro y cómo se le habla. */
function portada(todos: readonly Sprite[]): string {
  const galeria =
    todos.length === 0
      ? '<p class="vacio">Todavía no hay ningún dibujo. Los va a ir subiendo el juego a medida que el modelo los haga.</p>'
      : `<div class="grilla">${todos
          .map(
            (s) =>
              `<figure><div class="lienzo">${svgDe(s)}</div><figcaption>${escapar(s.clave)}</figcaption></figure>`,
          )
          .join('')}</div>`

  return `<!doctype html>
<meta charset="utf-8">
<title>Ánima II — depósito de dibujos</title>
<style>
 :root { color-scheme: dark }
 body { margin:0; background:#14161a; color:#e8e6e1; padding:24px;
        font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace }
 h1 { font-size:15px; margin:0 0 4px; font-weight:600 }
 p { color:#8b8f98; margin:0 0 18px; max-width:74ch; font-size:12px }
 .grilla { display:flex; flex-wrap:wrap; gap:12px }
 figure { margin:0; width:110px }
 .lienzo { background:#0d0f12; border:1px solid #262a31; border-radius:6px; padding:8px;
           display:flex; justify-content:center; line-height:0 }
 figcaption { margin-top:5px; font-size:10.5px; color:#8b8f98; word-break:break-all }
 .vacio { border:1px dashed #262a31; border-radius:8px; padding:16px; color:#8b8f98 }
 h2 { font-size:11px; margin:26px 0 8px; color:#8b8f98; font-weight:600;
      text-transform:uppercase; letter-spacing:.07em }
 table { border-collapse:collapse; font-size:12px }
 td { padding:2px 14px 2px 0; vertical-align:top }
 td:first-child { color:#d4b96a; white-space:nowrap }
 code { color:#e8e6e1 }
</style>
<h1>Depósito de dibujos · ${String(todos.length)} guardados</h1>
<p>Los sprites que el modelo dibujó, compartidos entre todas las partidas. Un dibujo entra una sola vez
por clave: <b>primero gana</b>. Nada de esto es necesario para jugar — sin depósito, el juego dibuja
procedural y no se entera.</p>
${galeria}
<h2>Rutas</h2>
<table>
<tr><td>GET /salud</td><td>si está vivo, y cuántos dibujos tiene</td></tr>
<tr><td>GET /sprites</td><td>el catálogo entero, que un cliente carga al abrir</td></tr>
<tr><td>GET /sprites/:clave</td><td>uno solo. La clave va escapada: <code>vara%2Fmadera%2F24</code></td></tr>
<tr><td>POST /sprites/:clave</td><td>una propuesta: <code>{"filas": ["0011…", …]}</code></td></tr>
</table>
`
}

const LARGO_MAXIMO = 64 * 1024

function json(res: ServerResponse, codigo: number, cuerpo: unknown): void {
  const texto = JSON.stringify(cuerpo)
  res.writeHead(codigo, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(texto)),
    // El cliente es una página; sin esto no puede ni preguntar.
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  })
  res.end(texto)
}

function leerCuerpo(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let datos = ''
    req.on('data', (parte: Buffer | string) => {
      datos += String(parte)
      // Un cuerpo enorme no es un dibujo: 24 filas de 24 son 600 bytes.
      if (datos.length > LARGO_MAXIMO) reject(new Error('demasiado grande'))
    })
    req.on('end', () => {
      resolve(datos)
    })
    req.on('error', reject)
  })
}

/**
 * EL SERVIDOR. Se le pasa el baúl, así que la suite lo corre en memoria y la
 * versión con disco es un adaptador de afuera — misma forma que `store`.
 *
 * Cuatro rutas:
 *
 *   GET  /salud          para saber si está vivo
 *   GET  /sprites        TODO el catálogo, que un cliente carga una vez al abrir
 *   GET  /sprites/:clave uno solo
 *   POST /sprites/:clave una propuesta; pasa la puerta o se rechaza con el motivo
 */
/**
 * QUIEN SABE DIBUJAR. Entra por parámetro y es opcional, por lo mismo que el
 * baúl: la suite corre el servidor entero sin gastar una consulta, y sin él el
 * depósito sigue siendo un depósito — guarda y reparte lo que otros dibujaron.
 */
export interface Dibujante {
  dibujar: (prompt: string) => Promise<{ ok: boolean; texto: string; porque?: string }>
}

export function crearServidor(baul: Baul, dibujante?: Dibujante): Server {
  return createServer((req, res) => {
    void (async () => {
      const url = req.url ?? '/'
      const metodo = req.method ?? 'GET'

      if (metodo === 'OPTIONS') {
        json(res, 204, null)
        return
      }
      if (url === '/salud') {
        json(res, 200, { ok: true, sprites: baul.todos().length })
        return
      }
      // La portada existe porque abrir un servidor en el navegador y recibir un
      // 404 es una fricción tonta, y porque un depósito de DIBUJOS que no se
      // pueden mirar es un depósito que nadie revisa.
      if (url === '/' || url === '/index.html') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(portada(baul.todos()))
        return
      }
      if (url === '/sprites' && metodo === 'GET') {
        json(res, 200, { sprites: baul.todos() })
        return
      }

      // ─── PEDIR UN DIBUJO ────────────────────────────────────────────────
      //
      // El navegador no puede llamar a Codex —es un proceso, y sus credenciales
      // no viajan al cliente— así que pide por clave y el backend consigue.
      // De paso sale gratis lo que más importa: el dibujo se valida y se guarda
      // en el mismo lugar donde se pidió, así que **nunca existe un sprite que
      // una pantalla usó y el depósito no tenga**.
      const d = /^\/dibujar\/(.+)$/.exec(url)
      if (d !== null) {
        if (metodo !== 'POST') {
          json(res, 405, { porque: 'para pedir un dibujo va POST' })
          return
        }
        const clave = decodeURIComponent(d[1] ?? '')
        // Primero gana también acá: si ya está, no se gasta una consulta.
        const yaEsta = baul.uno(clave)
        if (yaEsta !== undefined) {
          json(res, 200, { ok: true, yaEstaba: true, sprite: yaEsta })
          return
        }
        if (dibujante === undefined) {
          json(res, 501, { ok: false, porque: 'este depósito no tiene dibujante: sólo guarda y reparte' })
          return
        }
        const encargo = encargoDe(clave, PHYS)
        if (encargo === undefined) {
          json(res, 400, { ok: false, porque: 'esa clave no describe ninguna pieza de este mundo' })
          return
        }
        const salida = await dibujante.dibujar(encargo.prompt)
        if (!salida.ok) {
          json(res, 502, { ok: false, porque: salida.porque ?? 'el dibujante no contestó' })
          return
        }
        // La MISMA puerta de siempre, sobre lo que contestó el modelo.
        const v = revisarRespuesta(clave, salida.texto)
        if (!v.ok) {
          json(res, 422, { ok: false, porque: v.porque })
          return
        }
        baul.poner(v.sprite)
        json(res, 201, { ok: true, yaEstaba: false, sprite: v.sprite })
        return
      }

      const m = /^\/sprites\/(.+)$/.exec(url)
      if (m === null) {
        json(res, 404, { porque: 'no hay nada acá' })
        return
      }
      // La clave viaja en la URL, así que llega escapada: `vara%2Fmadera%2F24`.
      const clave = decodeURIComponent(m[1] ?? '')
      const lado = Number.parseInt(clave.split('/')[2] ?? '', 10)

      if (metodo === 'GET') {
        const s = baul.uno(clave)
        if (s === undefined) {
          json(res, 404, { porque: 'nadie dibujó eso todavía' })
          return
        }
        json(res, 200, s)
        return
      }

      if (metodo !== 'POST') {
        json(res, 405, { porque: `${metodo} no` })
        return
      }

      if (!Number.isInteger(lado)) {
        json(res, 400, { porque: 'la clave no dice de qué medida es el dibujo' })
        return
      }
      // Si ya está, se contesta el que había: primero gana, y el que propuso se
      // entera sin tener que preguntar de nuevo.
      const yaEsta = baul.uno(clave)
      if (yaEsta !== undefined) {
        json(res, 200, { ok: true, yaEstaba: true, sprite: yaEsta })
        return
      }

      let crudo: unknown
      try {
        crudo = JSON.parse(await leerCuerpo(req))
      } catch {
        json(res, 400, { porque: 'el cuerpo no es JSON' })
        return
      }

      // LA MISMA PUERTA QUE EL CLIENTE. Ver el encabezado.
      const v = revisarSprite(crudo, clave, lado)
      if (!v.ok) {
        json(res, 422, { ok: false, porque: v.porque })
        return
      }
      baul.poner(v.sprite)
      json(res, 201, { ok: true, yaEstaba: false, sprite: v.sprite })
    })()
  })
}
