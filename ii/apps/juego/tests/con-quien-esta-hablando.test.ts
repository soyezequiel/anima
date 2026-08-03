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

import { BUSCANDO, conQuien, elAvisoDeQueNoLlego } from '../src/con-quien.js'
import type { IntentoAlModelo } from '../src/ordenes.js'

const salud = (dibuja: string | null, modelos: unknown, contesta: string | null = null): unknown => ({
  ok: true,
  sprites: 3,
  dibuja,
  // Quién contesta el chat en este depósito, que es un permiso distinto de
  // dibujar: por omisión nadie, que es lo que contesta un depósito sin la ruta.
  contesta,
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
    // El detalle dice QUIÉN hace los trabajos y ya no cuál nadie hace: la
    // segunda forma se venció dos veces, una por cada puerto que se enchufó.
    expect(c.claude.detalle).toContain('no le habla')
    expect(c.claude.detalle).toContain('Codex')
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
    // «No se usa acá» y ya no «no dibuja acá»: desde que Codex puede hacer dos
    // cosas, un rol que sólo hable de dibujar dejaría sin nombrar al depósito
    // que contesta el chat y no dibuja, que es un estado que existe.
    expect(c.codex.rol).toBe('no se usa acá')
    expect(c.codex.detalle).toContain('sólo guarda y reparte')
  })

  it('CODEX DIBUJANDO Y ADEMÁS CONTESTANDO: el rol dice las dos', () => {
    const c = conQuien(salud('codex', VIVOS, 'codex'))
    expect(c.codex.rol).toBe('dibuja y contesta')
    // Con dos trabajos o más el detalle los enumera en vez de describir uno:
    // repetir la descripción larga de cada uno no entra en un `title`.
    expect(c.codex.detalle).toContain('dibuja y contesta')
  })

  it('y un depósito que SÓLO contesta lo dice sin hablar de dibujos', () => {
    const c = conQuien(salud(null, VIVOS, 'codex'))
    expect(c.codex.rol).toBe('contesta')
    expect(c.codex.detalle).not.toContain('sprites')
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

// ═══ LA CUARTA MENTIRA: «EN ESPERA» MIENTRAS EL JUEGO YA INTENTÓ ═══════════
//
// Las cuatro de arriba son sobre el SONDEO: qué contestó el backend y cómo se
// pinta. Éstas son sobre lo otro, que el sondeo no puede saber — si el juego le
// habló al modelo y no llegó. Sale de `Ordenes`, que es la que intentó.
//
// El caso que las trajo está medido en una partida real: la criatura pidió ayuda
// dos veces, no salió del cuarto, y arriba decía «vive · en espera» con la
// lámpara prendida y respirando.

/** Un intento de LEER una frase, que es el que hoy tiene a alguien del otro lado. */
const LEER: IntentoAlModelo = { tick: 155, para: 'entender', porque: 'se-cayo', sobre: 'xyzzy plugh' }
/** Y uno de FORJAR una habilidad, que es el que todavía no tiene a nadie. */
const FORJAR: IntentoAlModelo = { tick: 155, para: 'aprender', porque: 'sin-cable', sobre: 'secar la leña' }

describe('cuando el juego quiso ir al modelo y no llegó', () => {
  it('SE MARCA AL QUE TENÍA QUE ATENDER, y hoy el chat lo atiende Codex', () => {
    const antes = conQuien(salud('codex', VIVOS, 'codex'))
    expect(antes.codex.rol, 'el punto de partida cambió: este test perdió su contraste').toBe('dibuja y contesta')

    const c = conQuien(salud('codex', VIVOS, 'codex'), LEER)
    expect(c.codex.luz).toBe('cortado')
    expect(c.codex.rol).toBe('se cortó')
    // Y la de al lado NO se ensucia: Claude no tuvo nada que ver con esto.
    expect(c.claude.luz, 'le echó la culpa al que no atendía').toBe('vive')
    expect(c.claude.rol).toBe('en espera')
  })

  it('SI NADIE ATIENDE ESE TRABAJO, no se marca ninguna lámpara', () => {
    // Que no haya nadie anunciado es información, y ensuciar una lámpara ajena
    // la escondería. El aviso sale igual, por la nota y por el cartel.
    const c = conQuien(salud('codex', VIVOS), LEER)
    expect(c.codex.luz).toBe('vive')
    expect(c.claude.luz).toBe('vive')
    expect(c.nota, 'sin lámpara marcada, la nota es lo único que queda').not.toBe('')
  })

  it('LO QUE FALTA FORJAR NO ES DE NADIE TODAVÍA', () => {
    // El hueco `fragua` sigue vacío: no hay a quién marcar aunque los dos CLIs
    // estén prendidos. Ésta es la partida que originó el tramo.
    const c = conQuien(salud('codex', VIVOS, 'codex'), FORJAR)
    expect(c.codex.luz).toBe('vive')
    expect(c.claude.luz).toBe('vive')
    expect(c.nota).toContain('no sabe hacer')
  })

  it('CON EL CLI AUSENTE NO LE ROBA LA LUZ, y eso es a propósito', () => {
    // `cortado` quiere decir «está y no le llegué». Sobre una lámpara apagada
    // mandaría a buscar un cable cuando lo que falta es el programa. El intento
    // no se pierde: se suma al detalle.
    const sinCodex = { codex: { vive: false }, claude: VIVOS.claude }
    const c = conQuien(salud('codex', sinCodex, 'codex'), LEER)
    expect(c.codex.luz).toBe('no')
    expect(c.codex.rol).toBe('no está')
    expect(c.codex.detalle).toContain('el juego le quiso hablar')
  })

  it('CON EL SONDEO EN VUELO tampoco adivina', () => {
    // Sin respuesta del backend no se sabe si hay CLI, así que no se puede
    // decir por qué no llegó. La luz se queda buscando.
    expect(conQuien(salud('codex', null, 'codex'), LEER).codex.luz).toBe('buscando')
  })

  it('LA NOTA DICE EL PORQUÉ Y EL CARTEL EL QUÉ, y no se repiten', () => {
    // Se dibujan a tres píxeles de distancia. Con el mismo texto en los dos, la
    // pantalla lo decía dos veces seguidas y se leía como un defecto de render.
    const c = conQuien(salud('codex', VIVOS), FORJAR)
    const a = elAvisoDeQueNoLlego(FORJAR)
    expect(c.nota, 'la nota es la que explica: es el detalle que antes pedía pasar el mouse').toBe(a.detalle)
    expect(c.nota, 'la nota repite el cartel').not.toBe(a.cartel)
    // Y lo que se perdió va en el cartel, que es el que interrumpe.
    expect(a.sobre).toBe('secar la leña')
  })

  it('«NO TRAJO NADA» NO DICE QUE NO LLEGÓ, porque llegó', () => {
    // El modelo contestó y dijo que no tenía nada mejor. Meterlo en el mismo
    // texto que el cable desenchufado sería la misma mentira al revés.
    const vacio: IntentoAlModelo = { ...FORJAR, porque: 'no-trajo-nada' }
    const a = elAvisoDeQueNoLlego(vacio)
    expect(a.rol).toBe('no trajo nada')
    expect(a.detalle).toContain('contestó')
    expect(a.cartel).not.toContain('no tengo')
  })

  it('LOS TRES MOTIVOS DAN TRES TEXTOS DISTINTOS, en los tres campos', () => {
    // Si dos coincidieran, la pantalla volvería a mostrar dos hechos distintos
    // con las mismas palabras, que es lo que este archivo existe para evitar.
    const motivos = ['sin-cable', 'se-cayo', 'no-trajo-nada'] as const
    for (const campo of ['rol', 'detalle', 'cartel'] as const) {
      const dichos = motivos.map((porque) => elAvisoDeQueNoLlego({ ...FORJAR, porque })[campo])
      expect(new Set(dichos).size, `dos motivos dicen lo mismo en «${campo}»`).toBe(3)
    }
  })

  it('EL CARTEL DE «SIN CABLE» DISTINGUE ENTENDER DE APRENDER', () => {
    // Son los dos únicos motivos por los que este juego llama a un modelo, y al
    // que juega le importan cosas distintas: una es «no te entendí» y la otra es
    // «no sé hacerlo». Un cartel solo para los dos no diría ninguna.
    const entender = elAvisoDeQueNoLlego({ ...FORJAR, para: 'entender' }).cartel
    const aprender = elAvisoDeQueNoLlego({ ...FORJAR, para: 'aprender' }).cartel
    expect(entender).not.toBe(aprender)
    expect(entender).toContain('preguntado')
    expect(aprender).toContain('no sé hacer')
  })

  it('SIN INTENTOS NO CAMBIA NADA: el parámetro es opcional y no se nota', () => {
    // El control negativo. Sin él, este tramo podría estar prendiendo la cuarta
    // luz siempre y los tests de arriba seguirían pasando por otro camino.
    expect(conQuien(salud('codex', VIVOS))).toEqual(conQuien(salud('codex', VIVOS), undefined))
  })
})
