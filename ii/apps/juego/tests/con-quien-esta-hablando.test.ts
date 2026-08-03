// ─── LAS TRES LUCES, SIN ABRIR UN NAVEGADOR ─────────────────────────────────
//
// Lo que se afirma acá es que el indicador **no miente**, y las mentiras
// posibles son cuatro y ninguna es de CSS:
//
//   1. decir que Codex dibuja porque el CLI está instalado. No alcanza: el
//      depósito puede no tener dibujante y sólo repartir lo que otros subieron;
//   2. decir que Claude está conectado. Está *instalado*; el juego todavía no le
//      manda una sola frase, y el rótulo tiene que decirlo;
//   3. mostrar «no están» mientras el backend todavía no sondeó. Son estados
//      distintos: uno es una respuesta y el otro es no haber preguntado;
//   4. con las dos apagadas, no aclarar que el juego anda igual. Un panel en
//      gris sin explicación se lee como una falla.
//
// Los cuatro se prueban con objetos planos, que es lo que la red devuelve.

import { describe, expect, it } from 'vitest'

import { BUSCANDO, conQuien } from '../src/con-quien.js'

const salud = (dibuja: string | null, modelos: unknown): unknown => ({
  ok: true,
  sprites: 3,
  dibuja,
  modelos,
})

const VIVOS = {
  codex: { vive: true, version: 'codex-cli 0.4.2' },
  claude: { vive: true, version: '2.0.1 (Claude Code)' },
}

describe('con quién está hablando la partida', () => {
  it('CODEX DIBUJANDO Y CLAUDE INSTALADO: las dos prendidas, con roles distintos', () => {
    const c = conQuien(salud('codex', VIVOS))
    expect(c.codex.luz).toBe('vive')
    expect(c.codex.rol).toBe('dibuja')
    expect(c.claude.luz).toBe('vive')
    // La línea que evita la mentira 2: prendida NO quiere decir que se use.
    expect(c.claude.rol).toBe('en espera')
    expect(c.claude.detalle).toContain('todavía no le habla')
    expect(c.nota, 'con alguien prendido no hace falta aclarar nada').toBe('')
  })

  it('la versión que dijo el CLI llega al detalle', () => {
    // No es adorno: es lo único que distingue «anda» de «anda esta versión»
    // cuando algo se rompe y hay que contarlo.
    expect(conQuien(salud('codex', VIVOS)).codex.detalle).toContain('codex-cli 0.4.2')
    expect(conQuien(salud('codex', VIVOS)).claude.detalle).toContain('2.0.1')
  })

  it('CODEX INSTALADO PERO ESTE DEPÓSITO NO DIBUJA: prendida, y el rol lo dice', () => {
    // La mentira 1. Pasa de verdad: un depósito compartido puesto a repartir no
    // lleva dibujante, y el CLI puede estar igual en esa máquina.
    const c = conQuien(salud(null, VIVOS))
    expect(c.codex.luz).toBe('vive')
    expect(c.codex.rol).toBe('no dibuja acá')
    expect(c.codex.detalle).toContain('sólo guarda y reparte')
  })

  it('NINGUNO DE LOS DOS: apagadas, y se aclara que el juego sigue', () => {
    const c = conQuien(salud(null, { codex: { vive: false }, claude: { vive: false } }))
    expect(c.codex.luz).toBe('no')
    expect(c.claude.luz).toBe('no')
    expect(c.nota).not.toBe('')
    expect(c.nota).toContain('se juega igual')
  })

  it('TODAVÍA NO SONDEÓ no es lo mismo que NO ESTÁN', () => {
    // La mentira 3. `modelos: null` es el «no sé» del backend.
    const c = conQuien(salud('codex', null))
    expect(c.codex.luz).toBe('buscando')
    expect(c.claude.luz).toBe('buscando')
    // Y sin nota: no hay nada que aclarar todavía.
    expect(c.nota).toBe('')
  })

  it('el depósito apagado apaga las dos, porque no hay con qué saber', () => {
    const c = conQuien(undefined)
    expect(c.codex.luz).toBe('no')
    expect(c.claude.luz).toBe('no')
    expect(c.codex.rol).toBe('sin depósito')
    expect(c.nota).toContain('se juega igual')
  })

  it('una respuesta rara no rompe ni inventa: se pinta como apagado', () => {
    // Viene de la red. Un `modelos: "sí"` o un campo que falta no puede tirar el
    // juego abajo ni encender una luz que nadie afirmó.
    for (const raro of ['sí', 42, [], null, { modelos: 'sí' }, { modelos: { codex: 'sí' } }]) {
      const c = conQuien(raro)
      expect(c.codex.luz).not.toBe('vive')
      expect(c.claude.luz).not.toBe('vive')
    }
  })

  it('lo que se muestra antes de la primera respuesta es «buscando»', () => {
    expect(BUSCANDO.codex.luz).toBe('buscando')
    expect(BUSCANDO.claude.luz).toBe('buscando')
  })
})
