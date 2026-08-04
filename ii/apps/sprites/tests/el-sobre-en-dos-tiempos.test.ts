import { describe, expect, it } from 'vitest'

import { baulEnMemoria, crearServidor, sobresEnMemoria } from '../src/servidor.js'

/**
 * ═══ EL SOBRE EN DOS TIEMPOS (ADR 0089) ════════════════════════════════════
 *
 * El depósito dejó de poner la cuenta: arma el prompt, el navegador lo lleva a
 * SU modelo, y vuelve con el texto. Lo que se prueba acá es que ese reparto no
 * aflojó ninguna de las dos cosas que el camino de un solo tiro garantizaba:
 *
 *   · **el prompt lo arma el servidor** — el navegador dice QUÉ quiere, nunca
 *     CÓMO se pregunta;
 *   · **lo que vuelve pasa por la misma puerta** — un texto que no es un dibujo
 *     válido no entra al baúl porque lo haya traído un cliente.
 */

/** Levanta el servidor en un puerto libre y devuelve su raíz. */
async function levantar(o: Parameters<typeof crearServidor>[1] = {}, baul = baulEnMemoria()) {
  const server = crearServidor(baul, o)
  await new Promise<void>((listo) => server.listen(0, listo))
  const dir = server.address()
  const puerto = typeof dir === 'object' && dir !== null ? dir.port : 0
  return {
    raiz: `http://127.0.0.1:${String(puerto)}`,
    baul,
    cerrar: () => new Promise<void>((listo) => server.close(() => listo())),
  }
}

function postear(url: string, cuerpo: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
}

/**
 * Un dibujo válido: un bloque con borde en sombra, que es el mismo fixture que
 * usa `el-deposito.test.ts`. Se manda como TEXTO —filas separadas por saltos—
 * porque eso es lo que contesta un modelo.
 */
function dibujoValido(lado = 24): string {
  const filas: string[] = []
  for (let y = 0; y < lado; y++) {
    let f = ''
    for (let x = 0; x < lado; x++) {
      const borde = y === 0 || x === 0 || y === lado - 1 || x === lado - 1
      f += borde ? '2' : '1'
    }
    filas.push(f)
  }
  return filas.join('\n')
}

describe('pedir un sobre', () => {
  it('devuelve un ticket y el prompt que armó el servidor', async () => {
    const d = await levantar()
    try {
      const r = await postear(`${d.raiz}/sobre`, { tipo: 'dibujar', clave: 'vara/madera/24' })
      expect(r.status).toBe(200)
      const j = (await r.json()) as { ticket?: string; prompt?: string }
      expect(typeof j.ticket).toBe('string')
      // El prompt es del servidor y habla del mundo: el cliente nunca lo escribe.
      expect(j.prompt).toContain('24')
    } finally {
      await d.cerrar()
    }
  });

  /**
   * «PRIMERO GANA» CORRE ANTES DE QUE NADIE GASTE. Sin esto, el jugador con su
   * API enchufada pagaría por cada dibujo que otro ya dibujó — que es
   * exactamente lo que el depósito compartido vino a evitar.
   */
  it('un dibujo que ya está no arma sobre: lo devuelve y listo', async () => {
    const d = await levantar()
    try {
      // Se mete por el camino normal, con la puerta de siempre.
      const sobre = await postear(`${d.raiz}/sobre`, { tipo: 'dibujar', clave: 'vara/madera/24' })
      const { ticket } = (await sobre.json()) as { ticket: string }
      await postear(`${d.raiz}/sobre/${ticket}`, { texto: dibujoValido() })

      const otraVez = await postear(`${d.raiz}/sobre`, { tipo: 'dibujar', clave: 'vara/madera/24' })
      const j = (await otraVez.json()) as { yaEstaba?: boolean; ticket?: string; sprite?: unknown }
      expect(j.yaEstaba).toBe(true)
      expect(j.ticket).toBeUndefined()
      expect(j.sprite).toBeDefined()
    } finally {
      await d.cerrar()
    }
  })

  it('una clave que este mundo no conoce no llega a ser sobre', async () => {
    const d = await levantar()
    try {
      const r = await postear(`${d.raiz}/sobre`, { tipo: 'dibujar', clave: 'dragon/oro/24' })
      expect(r.status).toBe(400)
    } finally {
      await d.cerrar()
    }
  })

  it('un tipo que no existe se rechaza', async () => {
    const d = await levantar()
    try {
      const r = await postear(`${d.raiz}/sobre`, { tipo: 'hackear' })
      expect(r.status).toBe(400)
    } finally {
      await d.cerrar()
    }
  })
})

describe('contestar un sobre', () => {
  it('un dibujo válido entra al baúl', async () => {
    const d = await levantar()
    try {
      const sobre = await postear(`${d.raiz}/sobre`, { tipo: 'dibujar', clave: 'vara/madera/24' })
      const { ticket } = (await sobre.json()) as { ticket: string }
      const r = await postear(`${d.raiz}/sobre/${ticket}`, { texto: dibujoValido() })
      expect(r.status).toBe(201)
      expect(d.baul.uno('vara/madera/24')).toBeDefined()
    } finally {
      await d.cerrar()
    }
  })

  /**
   * LA PRUEBA QUE SOSTIENE TODO EL DISEÑO. Que el viaje al modelo lo haya hecho
   * el navegador no le compra ni un permiso: si lo que trae no pasa la puerta,
   * no entra. Sin esto, el sobre habría convertido al depósito en un lugar donde
   * cualquiera guarda lo que quiera.
   */
  it('un texto que no es un dibujo NO entra, aunque lo traiga un cliente', async () => {
    const d = await levantar()
    try {
      const sobre = await postear(`${d.raiz}/sobre`, { tipo: 'dibujar', clave: 'vara/madera/24' })
      const { ticket } = (await sobre.json()) as { ticket: string }
      const r = await postear(`${d.raiz}/sobre/${ticket}`, { texto: 'jajaja no' })
      expect(r.status).toBe(422)
      expect(d.baul.uno('vara/madera/24')).toBeUndefined()
    } finally {
      await d.cerrar()
    }
  })

  /**
   * UN SOBRE SE CONTESTA UNA VEZ. Sin consumirlo, el mismo ticket se podría
   * redimir en repetición: no rompería la puerta —cada intento se valida igual—
   * pero convertiría un encargo en una autorización abierta a intentar.
   */
  it('el mismo ticket no sirve dos veces', async () => {
    const d = await levantar()
    try {
      const sobre = await postear(`${d.raiz}/sobre`, { tipo: 'dibujar', clave: 'vara/madera/24' })
      const { ticket } = (await sobre.json()) as { ticket: string }
      await postear(`${d.raiz}/sobre/${ticket}`, { texto: dibujoValido() })
      const otra = await postear(`${d.raiz}/sobre/${ticket}`, { texto: dibujoValido() })
      expect(otra.status).toBe(404)
    } finally {
      await d.cerrar()
    }
  })

  it('un ticket inventado es 404', async () => {
    const d = await levantar()
    try {
      const r = await postear(`${d.raiz}/sobre/no-existe`, { texto: dibujoValido() })
      expect(r.status).toBe(404)
    } finally {
      await d.cerrar()
    }
  })

  it('sin texto adentro no se toca el baúl', async () => {
    const d = await levantar()
    try {
      const sobre = await postear(`${d.raiz}/sobre`, { tipo: 'dibujar', clave: 'vara/madera/24' })
      const { ticket } = (await sobre.json()) as { ticket: string }
      const r = await postear(`${d.raiz}/sobre/${ticket}`, { texto: '   ' })
      expect(r.status).toBe(400)
    } finally {
      await d.cerrar()
    }
  })
})

/**
 * Los sobres vencen y se tiran. El reloj entra por parámetro porque probar esto
 * con el de verdad serían diez minutos de suite.
 */
describe('los sobres en vuelo', () => {
  it('un sobre vencido ya no se puede contestar', async () => {
    let ahora = 1_000_000
    const d = await levantar({ sobres: sobresEnMemoria(() => ahora) })
    try {
      const sobre = await postear(`${d.raiz}/sobre`, { tipo: 'dibujar', clave: 'vara/madera/24' })
      const { ticket } = (await sobre.json()) as { ticket: string }
      ahora += 11 * 60 * 1000
      const r = await postear(`${d.raiz}/sobre/${ticket}`, { texto: dibujoValido() })
      expect(r.status).toBe(404)
    } finally {
      await d.cerrar()
    }
  })

  it('pedir sobres y no contestarlos nunca no llena la memoria sin techo', () => {
    const sobres = sobresEnMemoria(() => 0)
    const tickets: string[] = []
    for (let i = 0; i < 600; i++) {
      tickets.push(sobres.guardar({ tipo: 'dibujar', clave: 'vara/madera/24' }))
    }
    // Los primeros se cayeron por el tope; el último tiene que seguir.
    expect(sobres.tomar(tickets[0]!)).toBeUndefined()
    expect(sobres.tomar(tickets.at(-1)!)).toBeDefined()
  })
})

/**
 * El depósito sin dibujante propio (`ANIMA_CLI_LOCAL` apagado) no deja de
 * funcionar: cambia de oficio. Guarda, reparte y arma sobres — lo único que no
 * hace es pagar.
 */
describe('un depósito sin cuenta propia', () => {
  it('dice que no dibuja, no contesta y no forja', async () => {
    const d = await levantar()
    try {
      const j = (await (await fetch(`${d.raiz}/salud`)).json()) as {
        dibuja: unknown
        contesta: unknown
        forja: unknown
        ok: unknown
      }
      expect(j.dibuja).toBeNull()
      expect(j.contesta).toBeNull()
      expect(j.forja).toBeNull()
      expect(j.ok).toBe(true)
    } finally {
      await d.cerrar()
    }
  })

  it('las tres rutas de un solo tiro contestan 501, pero el sobre anda', async () => {
    const d = await levantar()
    try {
      const directo = await postear(`${d.raiz}/dibujar/vara%2Fmadera%2F24`, {})
      expect(directo.status).toBe(501)
      const porSobre = await postear(`${d.raiz}/sobre`, { tipo: 'dibujar', clave: 'vara/madera/24' })
      expect(porSobre.status).toBe(200)
    } finally {
      await d.cerrar()
    }
  })
})
