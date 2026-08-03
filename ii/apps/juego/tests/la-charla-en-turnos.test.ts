// ─── LA CHARLA AGRUPADA, SIN NAVEGADOR ──────────────────────────────────────
//
// El agrupado es presentación pura: el registro por dentro sigue siendo plano y
// así lo escribe el mundo. Por eso se puede probar con una lista escrita a mano,
// que es la única forma de cubrir los casos que en pantalla aparecen una vez cada
// mil ticks — el log recortado, la respuesta que se reemplaza, la cláusula que
// pasa de pendiente a en curso.
//
// Y las sugerencias se prueban CONTRA EL CATÁLOGO DE VERDAD y no contra una
// tabla de mentira: lo único que hay que afirmar de ellas es que sean lo que la
// criatura entiende y sabe hacer, y eso no se puede simular.

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics } from '@anima/physics'
import { ESQUEMAS, interpretar } from '@anima/plan'
import { PUENTE, leer, lexicoDe } from '@anima/lang'
import type { Dicho } from '@anima/lang'

import { agrupar, clausulasDe, firmaDelRegistro } from '../src/turnos.js'
import { sugerencias } from '../src/sugerencias.js'

let siguiente = 0
/**
 * `sobre` es opcional porque su AUSENCIA significa algo: un `progreso` que no
 * habla de ningún cuerpo es un anuncio y no un hecho, y de eso depende el filtro
 * de los anuncios. Un helper que lo pusiera siempre escondería ese caso.
 */
function dicho(clase: Dicho['clase'], texto: string, sobre?: string): Dicho {
  siguiente++
  return { turno: siguiente, tick: 0, clase, texto, ...(sobre === undefined ? {} : { sobre }) }
}

describe('el registro plano se agrupa en turnos', () => {
  it('UNA ENTRADA ABRE UN TURNO Y SE LLEVA TODO LO QUE SIGUE', () => {
    const t = agrupar([
      dicho('entrada', 'hacé fuego'),
      dicho('acuse', 'dale, voy'),
      dicho('progreso', 'agarró madera'),
      dicho('entrada', 'hacé cuerda'),
      dicho('acuse', 'dale, voy'),
    ])

    expect(t).toHaveLength(2)
    expect(t[0]?.pedido).toBe('hacé fuego')
    expect(t[0]?.pasos.map((p) => p.texto)).toEqual(['agarró madera'])
    expect(t[1]?.pedido).toBe('hacé cuerda')
    expect(t[1]?.pasos).toEqual([])
  })

  it('LA ÚLTIMA RESPUESTA GANA: el desenlace reemplaza al acuse de recibo', () => {
    // Es la regla que hace que la charla no crezca: sin ella, «listo» se apila
    // debajo de «dale, voy» y el turno tiene dos frases que dicen lo mismo en
    // dos momentos. Lo que importa es en qué terminó.
    const t = agrupar([
      dicho('entrada', 'hacé trampa'),
      dicho('acuse', 'dale, voy'),
      dicho('progreso', 'agarró liana'),
      dicho('listo', 'listo'),
    ])

    expect(t[0]?.respuesta?.texto).toBe('listo')
    // Y el progreso NO se comió: es la lista de pasos, no la respuesta.
    expect(t[0]?.pasos.map((p) => p.texto)).toEqual(['agarró liana'])
  })

  it('el aviso también es respuesta, y es el caso que dice que NO se puede', () => {
    const t = agrupar([
      dicho('entrada', 'traeme la luna'),
      dicho('acuse', 'te entendí, pero no sé cómo hacerlo todavía'),
    ])
    expect(t[0]?.respuesta?.texto).toContain('no sé cómo')
  })

  it('SIN RESPUESTA TODAVÍA, el turno existe igual', () => {
    // Con el mundo en pausa el acuse sale en el acto, pero un turno recién
    // abierto puede pintarse antes: un turno sin respuesta no es un turno roto.
    const t = agrupar([dicho('entrada', 'hacé fuego')])
    expect(t[0]?.pedido).toBe('hacé fuego')
    expect(t[0]?.respuesta).toBeUndefined()
  })

  it('EL LOG RECORTADO NO PIERDE LO QUE PASÓ: turno huérfano', () => {
    // El canal se recorta a cien líneas por arriba, así que un log restaurado
    // puede empezar por un progreso sin su entrada. Tirarlo sería esconder lo
    // que la criatura hizo porque el pedido se perdió.
    const t = agrupar([
      dicho('progreso', 'agarró madera'),
      dicho('listo', 'listo'),
      dicho('entrada', 'hacé cuerda'),
    ])

    expect(t).toHaveLength(2)
    expect(t[0]?.pedido).toBeUndefined()
    expect(t[0]?.pasos.map((p) => p.texto)).toEqual(['agarró madera'])
    expect(t[0]?.respuesta?.texto).toBe('listo')
  })

  it('LA RESPUESTA LLEVA SU TURNO Y NO EL DEL PEDIDO', () => {
    // Lo encontró el spec de la recarga y es la clase de bug que sólo se ve
    // contando: con el turno del pedido, el pedido y la respuesta salen al DOM
    // con la MISMA identidad, y «nada se repite» —que es lo que ese spec
    // afirma después de cerrar la pestaña— deja de poder comprobarse.
    const t = agrupar([dicho('entrada', 'hacé fuego'), dicho('acuse', 'dale, voy')])
    expect(t[0]?.respuesta?.turno).toBe((t[0]?.turno ?? 0) + 1)
  })

  it('y cada paso también, porque cada uno es una línea del log', () => {
    const t = agrupar([dicho('entrada', 'hacé fuego'), dicho('progreso', 'agarró madera')])
    expect(t[0]?.pasos[0]?.turno).toBe((t[0]?.turno ?? 0) + 1)
  })

  it('EL ABIERTO ES EL ÚLTIMO, y es el único', () => {
    const t = agrupar([
      dicho('entrada', 'uno'),
      dicho('entrada', 'dos'),
      dicho('entrada', 'tres'),
    ])
    expect(t.map((x) => x.abierto)).toEqual([false, false, true])
  })

  it('un registro vacío no es un turno vacío: no hay turnos', () => {
    expect(agrupar([])).toEqual([])
  })
})

describe('las cláusulas del encargo se cuelgan del turno QUE LAS PIDIÓ', () => {
  const CLAUSULAS = [
    { texto: 'fuego', estado: 'hecho' as const },
    { texto: 'cuerda', estado: 'en-curso' as const },
  ]

  it('van después de lo que ya hizo, que es el orden en que pasan', () => {
    const uno = dicho('entrada', 'hacé fuego y cuerda')
    const t = agrupar(
      [uno, dicho('acuse', 'dale, arranco por lo primero'), dicho('progreso', 'agarró madera', 'vara')],
      { turnos: [uno.turno], clausulas: CLAUSULAS },
    )

    expect(t[0]?.pasos.map((p) => `${p.estado}:${p.texto}`)).toEqual([
      'hecho:agarró madera',
      'hecho:fuego',
      'en-curso:cuerda',
    ])
  })

  it('Y NO AL ÚLTIMO TURNO, que sería verdad casi siempre', () => {
    // El caso que lo distingue: decís algo en el medio que no pide nada —una
    // afirmación, una corrección— mientras el encargo sigue corriendo. Con «el
    // último» las cláusulas se cuelgan del comentario y el pedido queda pelado.
    const pedido = dicho('entrada', 'hacé fuego y cuerda')
    const t = agrupar([pedido, dicho('acuse', 'dale'), dicho('entrada', 'hay un río al norte')], {
      turnos: [pedido.turno],
      clausulas: CLAUSULAS,
    })

    expect(t[0]?.pasos).toHaveLength(2)
    expect(t[1]?.pasos).toEqual([])
  })

  it('LAS CLÁUSULAS NO LLEVAN TURNO: no son líneas de la conversación', () => {
    // Y esa ausencia es información: una cláusula sale del encargo, no de algo
    // que alguien dijo, así que no hay a qué turno del registro ir a buscarla.
    const uno = dicho('entrada', 'hacé fuego y cuerda')
    const t = agrupar([uno], { turnos: [uno.turno], clausulas: CLAUSULAS })
    expect(t[0]?.pasos.every((p) => p.turno === undefined)).toBe(true)
  })

  it('un encargo de otra partida no se cuelga de ningún lado', () => {
    const t = agrupar([dicho('entrada', 'hacé fuego')], { turnos: [9999], clausulas: CLAUSULAS })
    expect(t[0]?.pasos).toEqual([])
  })
})

describe('de los nodos del encargo a los tres estados', () => {
  const castellano = (f: string): string => ({ 'emitsPower>0': 'fuego', 'freeStrandEnds>=1': 'cuerda', 'catch>0': 'trampa' })[f] ?? f

  const ENCARGO = {
    nodos: [
      { id: 'g1', meta: 'emitsPower>0' },
      { id: 'g2', meta: 'freeStrandEnds>=1' },
      { id: 'g3', meta: 'catch>0' },
    ],
    hechos: [{ nodo: 'g1' }],
  }

  it('hecho, en curso y pendiente, cada uno por su motivo', () => {
    expect(clausulasDe(ENCARGO, 'freeStrandEnds>=1', castellano)).toEqual([
      { texto: 'fuego', estado: 'hecho' },
      { texto: 'cuerda', estado: 'en-curso' },
      { texto: 'trampa', estado: 'pendiente' },
    ])
  })

  it('LA QUE ESTÁ EN CURSO SE BUSCA POR SU FIRMA, no por su posición', () => {
    // El encargo es un orden PARCIAL —los nodos declaran `after`, no una fila—
    // así que «la primera sin hacer» sería inventar una secuencia que el dato no
    // promete. Acá el mundo persigue la TERCERA con la segunda sin hacer.
    const p = clausulasDe(ENCARGO, 'catch>0', castellano)
    expect(p.map((x) => x.estado)).toEqual(['hecho', 'pendiente', 'en-curso'])
  })

  it('sin nada en curso, lo que falta queda pendiente y ninguna miente', () => {
    const p = clausulasDe(ENCARGO, undefined, castellano)
    expect(p.map((x) => x.estado)).toEqual(['hecho', 'pendiente', 'pendiente'])
  })

  it('CON UNA SOLA CLÁUSULA NO HAY LISTA, y eso es una decisión', () => {
    // El pedido ya está escrito arriba del turno, palabra por palabra. Una lista
    // de un ítem que lo repite traducido es leer lo mismo dos veces, y encima
    // ocupa el lugar donde se ven los pasos que sí valen — los que la criatura
    // hizo. Es el caso NORMAL: casi todos los pedidos son uno solo.
    expect(clausulasDe({ nodos: [{ id: 'g1', meta: 'emitsPower>0' }], hechos: [] }, undefined, castellano)).toEqual([])
  })
})

describe('el registro se repinta cuando cambió, y no en cada cuadro', () => {
  it('LA FIRMA MIRA ADENTRO DEL TURNO ABIERTO, y el contador viejo no podía', () => {
    // El contador de antes era la CANTIDAD pintada, y con turnos no alcanza: al
    // último bloque le entran pasos y le cambia la respuesta sin que aparezca
    // ninguna línea nueva al final. Con un contador, eso no se repinta nunca.
    const base = [dicho('entrada', 'hacé fuego'), dicho('acuse', 'dale, voy')]
    const antes = firmaDelRegistro(agrupar(base))
    const conPaso = firmaDelRegistro(agrupar([...base, dicho('progreso', 'agarró madera')]))
    expect(conPaso).not.toBe(antes)
  })

  it('y una cláusula que pasa de pendiente a en curso también la mueve', () => {
    const uno = dicho('entrada', 'hacé fuego y cuerda')
    const con = (estado: 'pendiente' | 'en-curso'): string =>
      firmaDelRegistro(agrupar([uno], { turnos: [uno.turno], clausulas: [{ texto: 'cuerda', estado }] }))
    expect(con('pendiente')).not.toBe(con('en-curso'))
  })

  it('sin cambios da lo mismo dos veces: es lo que evita el repintado', () => {
    const r = [dicho('entrada', 'hacé fuego'), dicho('acuse', 'dale, voy')]
    expect(firmaDelRegistro(agrupar(r))).toBe(firmaDelRegistro(agrupar(r)))
  })
})

// ─── LAS SUGERENCIAS, CONTRA EL CATÁLOGO DE VERDAD ──────────────────────────
describe('las sugerencias son el vocabulario, derivado', () => {
  const PHYS = buildSeedPhysics()
  const LEXICO = lexicoDe(PHYS, PUENTE)
  const ESTABLECIBLES = new Set(ESQUEMAS.map((e) => e.establishes))

  function leerla(frase: string): { confianza: number; acuse: string; firma: string | undefined } {
    const l = leer(frase, {
      phys: PHYS,
      lexico: LEXICO,
      sabeElCatalogo: (f) => ESTABLECIBLES.has(f) || interpretar(f)?.k === 'sostiene',
      yaEstaCumplida: () => false,
    })
    return { confianza: l.confianza, acuse: l.acuse, firma: l.clausulas[0]?.firma }
  }

  it('CADA CHIP SE ENTIENDE Y TIENE CAMINO — que es lo único que un chip promete', () => {
    // Un chip que ofrezca algo que la criatura no sabe hacer es peor que no
    // tener chips: enseña un vocabulario que no existe.
    const cuadro: string[] = []
    for (const s of sugerencias()) {
      const l = leerla(s)
      cuadro.push(`  ${s.padEnd(20)} ${l.confianza.toFixed(2)}  ${String(l.firma)}`)
      expect(l.firma, `«${s}» no se lee como ninguna meta`).toBeDefined()
      expect(ESTABLECIBLES.has(l.firma ?? ''), `«${s}» se lee pero no hay esquema`).toBe(true)
      expect(l.acuse, `«${s}» no da «dale»`).toContain('dale')
    }
    console.log('\n  ── LAS SUGERENCIAS, MEDIDAS ──')
    console.log(cuadro.join('\n'))
    expect(sugerencias().length).toBeGreaterThan(3)
  })

  it('Y SE LEEN AL MÁXIMO: el artículo cuesta un tercio, y por eso no va', () => {
    // La medición que decidió el texto de los chips. Se afirma porque es lo que
    // hace que la lista sea el vocabulario BUENO y no cualquier vocabulario: un
    // chip que enseñe la forma que el lector entiende peor está enseñando mal.
    for (const s of sugerencias()) {
      expect(leerla(s).confianza, `«${s}» no se lee entera`).toBe(1)
    }
    // El control, sin el cual el de arriba no dice nada: la forma CON artículo
    // —la que el handoff proponía— sí cae. Si algún día deja de caer, este
    // renglón se pone rojo y la regla de arriba se puede aflojar.
    expect(leerla('armá una trampa').confianza).toBeLessThan(1)
    expect(leerla('hacé una cuerda').confianza).toBeLessThan(1)
  })

  it('SE DERIVAN: no hay una lista escrita, y el catálogo manda', () => {
    // Lo que se afirma no es cuáles son —eso cambia cuando ESQUEMAS cambie, y
    // está bien— sino que cada una salga de las DOS tablas a la vez.
    const metas = sugerencias().map((s) => leerla(s).firma)
    for (const f of metas) expect(ESTABLECIBLES.has(f ?? '')).toBe(true)
    // Y que no sobre ninguna meta establecible con alias: si mañana alguien
    // agrega un chip a mano, esta cuenta deja de dar.
    expect(new Set(metas).size).toBe(metas.length)
  })
})

// ─── EL ANUNCIO NO ES UN HECHO, Y LA LISTA DE CLÁUSULAS LO DICE MEJOR ───────
describe('cuando llegan las cláusulas, los anuncios se van', () => {
  it('UN PASO SIN CUERPO ES UN ANUNCIO, y la lista lo repite con el estado real', () => {
    // Con más de una cláusula, el log trae un «voy por «fuego» (1 de 2)» además
    // de la lista. Son dos filas para lo mismo, y la del log lleva un ✓ que
    // MIENTE: eso no se hizo, se anunció.
    const uno = { turno: 1, tick: 0, clase: 'entrada' as const, texto: 'hacé fuego, hacé cuerda' }
    const anuncio = { turno: 2, tick: 0, clase: 'progreso' as const, texto: 'voy por «fuego» (1 de 2)' }
    const hecho = { turno: 3, tick: 0, clase: 'progreso' as const, texto: 'agarró madera', sobre: 'vara' }

    const t = agrupar([uno, anuncio, hecho], {
      turnos: [1],
      clausulas: [
        { texto: 'fuego', estado: 'en-curso' },
        { texto: 'cuerda', estado: 'pendiente' },
      ],
    })

    expect(t[0]?.pasos.map((p) => p.texto)).toEqual(['agarró madera', 'fuego', 'cuerda'])
  })

  it('SIN CLÁUSULAS NO SE FILTRA NADA: el anuncio es lo único que hay', () => {
    // El control. Con un pedido de una sola cláusula no hay lista —y tampoco
    // hay anuncios, porque `ordenes` sólo los emite con más de una— así que
    // este filtro no puede comerse una línea que era la única información.
    const uno = { turno: 1, tick: 0, clase: 'entrada' as const, texto: 'hacé fuego' }
    const suelto = { turno: 2, tick: 0, clase: 'progreso' as const, texto: 'algo sin cuerpo' }
    expect(agrupar([uno, suelto])[0]?.pasos.map((p) => p.texto)).toEqual(['algo sin cuerpo'])
  })

  it('y el filtro NO mira el texto, que es lo que lo hace durable', () => {
    // Si filtrara por «voy por», el día que alguien reescriba esa frase el
    // filtro deja de morder y nadie se entera. Mira `sobre`, que es un campo.
    const uno = { turno: 1, tick: 0, clase: 'entrada' as const, texto: 'x' }
    const otraFrase = { turno: 2, tick: 0, clase: 'progreso' as const, texto: 'arranco con el fuego' }
    const t = agrupar([uno, otraFrase], {
      turnos: [1],
      clausulas: [
        { texto: 'fuego', estado: 'en-curso' },
        { texto: 'cuerda', estado: 'pendiente' },
      ],
    })
    expect(t[0]?.pasos.map((p) => p.texto)).toEqual(['fuego', 'cuerda'])
  })
})
