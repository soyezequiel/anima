// ─── EL CRITERIO DEL REPORTE ────────────────────────────────────────────────
//
// Un reporte de debug se usa el día en que algo se rompió, o sea el peor día
// posible para descubrir que el reporte también estaba roto. Por eso lo que se
// prueba acá no es «el markdown se ve bien»: son las cuatro formas en que un
// reporte MIENTE, que son peores que no tenerlo.
//
//   1. dice «ninguna violación» cuando en realidad nadie miró;
//   2. se come un stack, o lo parte, y el error queda ilegible;
//   3. explota al volcar el mundo y no baja nada — justo cuando más falta hace;
//   4. trae un volcado que no se puede volver a cargar, o sea que dice que se
//      puede reproducir la partida y no se puede.
//
// El quinto es del vigía y es de la misma familia: si el buffer se llena y no lo
// dice, «200 roturas» se lee como «hubo 200» cuando hubo cuarenta mil.

import { describe, expect, it } from 'vitest'

import { nombreDelArchivo, pares, reporteEnMarkdown, type DatosDelReporte } from '../src/el-reporte.js'
import { Vigia, type ConsolaMinima, type DondeEscuchar, type PromesaRechazada, type RoturaDeVentana } from '../src/lo-que-se-rompio.js'

/** Lo mínimo que hace un reporte válido. Cada test cambia lo suyo y nada más. */
function datos(cambios: Partial<DatosDelReporte> = {}): DatosDelReporte {
  return {
    cuando: '2026-08-03T12:00:00.000Z',
    maquina: [['navegador', 'Chrome']],
    conQue: [['semilla', '20260727']],
    donde: [['tick', '412']],
    roturas: { roturas: [], tiradas: 0 },
    fallasDelTick: [],
    violaciones: [],
    criatura: [['dónde', '3, 7']],
    mente: { persigue: 'comer (suya)', pasos: [], nota: 'No le pediste nada.' },
    lectura: undefined,
    enlace: [['claude', 'vive']],
    charla: [],
    recuerdos: [],
    catalogo: [],
    guardado: { version: 3, tick: 412 },
    ...cambios,
  }
}

/** El bloque ```json del final, tal como lo va a sacar quien lea el archivo. */
function elVolcado(md: string): string {
  const m = /```json\n([\s\S]*?)\n```/.exec(md)
  if (m === null) throw new Error('el reporte no tiene bloque json')
  return m[1] as string
}

/**
 * Una sección del reporte, sola.
 *
 * Hace falta porque los asserts sobre el archivo entero se vuelven falsos con el
 * tiempo sin que nadie toque lo que probaban: el `not.toContain('ninguna')` de
 * los invariantes se puso rojo el día que otra sección estrenó un «no leyó
 * ninguna frase». Recortar es lo que hace que el test siga hablando de lo suyo.
 */
function seccion(md: string, titulo: string): string {
  const desde = md.indexOf(titulo)
  if (desde < 0) throw new Error(`el reporte no tiene la sección «${titulo}»`)
  const resto = md.slice(desde + titulo.length)
  const hasta = resto.search(/\n#{2,3} /)
  return hasta < 0 ? resto : resto.slice(0, hasta)
}

describe('el reporte no miente sobre lo que no se miró', () => {
  it('«no se miró» y «no hubo» son dos textos distintos', () => {
    const nadieMiro = seccion(reporteEnMarkdown(datos({ violaciones: undefined })), '### Invariantes del mundo')
    const seMiroYNoHubo = seccion(reporteEnMarkdown(datos({ violaciones: [] })), '### Invariantes del mundo')

    expect(nadieMiro).toContain('No se miró')
    // Y sobre todo: NO dice ninguna. Es el error que este par existe para que no
    // pase — alguien tachando a los invariantes de la lista de sospechosos.
    expect(nadieMiro).not.toContain('ninguna')
    expect(seMiroYNoHubo).toContain('ninguna')
    expect(seMiroYNoHubo).not.toContain('No se miró')
  })

  it('lo que sí se vio se escribe entero', () => {
    const md = reporteEnMarkdown(datos({ violaciones: ['tick 40: masa negativa en vara-1'] }))
    expect(md).toContain('tick 40: masa negativa en vara-1')
  })
})

describe('las roturas sobreviven al formato', () => {
  it('el stack va entero, con sus saltos de línea', () => {
    const stack = 'Error: no anduvo\n    at guardar (main.ts:1731)\n    at cuadro (main.ts:1650)'
    const md = reporteEnMarkdown(
      datos({
        roturas: {
          roturas: [{ tick: 412, desdeQueAbrio: 9000, de: 'promesa', texto: 'Error: no anduvo', stack }],
          tiradas: 0,
        },
      }),
    )
    expect(md).toContain(stack)
    expect(md).toContain('tick 412')
  })

  it('un mensaje de varias líneas NO parte la tabla', () => {
    // Un `\n` crudo adentro de una fila de tabla corta el markdown al medio y
    // todo lo que sigue se lee como texto suelto. Se aplana a una línea.
    const md = reporteEnMarkdown(datos({ criatura: [['manos', 'vara\ncaña\nhebra']] }))
    const fila = md.split('\n').find((l) => l.includes('manos'))
    expect(fila).toBe('| manos | vara ⏎ caña ⏎ hebra |')
  })

  it('una rotura de antes del primer tick no inventa un tick 0', () => {
    const md = reporteEnMarkdown(
      datos({
        roturas: {
          roturas: [{ tick: undefined, desdeQueAbrio: 12, de: 'console.warn', texto: 'no se pudo leer', stack: undefined }],
          tiradas: 0,
        },
      }),
    )
    expect(md).toContain('antes del primer tick')
    expect(md).not.toContain('tick 0')
  })

  it('cuando el buffer se llenó, el reporte lo dice', () => {
    const md = reporteEnMarkdown(
      datos({
        roturas: {
          roturas: [{ tick: 1, desdeQueAbrio: 1, de: 'excepción', texto: 'x', stack: undefined }],
          tiradas: 39_999,
        },
      }),
    )
    expect(md).toContain('39999')
    expect(md).toContain('algo estaba fallando en bucle')
  })

  it('sin roturas lo dice explícito, y no deja una sección muda', () => {
    expect(reporteEnMarkdown(datos())).toContain('Ninguna.')
  })
})

describe('el mundo en crudo', () => {
  it('el bloque JSON se vuelve a parsear tal cual entró', () => {
    // Es LA propiedad del volcado: si esto no vale, el reporte promete que se
    // puede reproducir la partida y no se puede.
    const guardado = {
      version: 3,
      tick: 412,
      mundo: [['mundo', { tick: 412, hz: 20 }] as const, ['cuerpo:ana-cuerpo', { form: 'bloque' }] as const],
      creencias: [{ que: 'pozo', cuanto: 0.7 }],
      charla: [{ turno: 1, texto: 'traeme un pescado' }],
      quien: 'ana',
    }
    const md = reporteEnMarkdown(datos({ guardado }))
    expect(JSON.parse(elVolcado(md))).toEqual(guardado)
  })

  it('un volcado imposible NO se lleva puesto el reporte', () => {
    // Un ciclo hace lanzar a `JSON.stringify`. El día que alguien meta uno en una
    // ranura, el reporte tiene que salir igual con todo lo demás: si no, el error
    // del que se quería informar se pierde junto con el que lo tapó.
    const ciclo: Record<string, unknown> = { a: 1 }
    ciclo['yo'] = ciclo

    const md = reporteEnMarkdown(datos({ guardado: ciclo, criatura: [['dónde', '3, 7']] }))

    expect(md).toContain('El volcado falló')
    expect(md).toContain('| dónde | 3, 7 |')
    expect(md).toContain('Qué se rompió')
  })

  it('dice cuánto pesa, para que quien lo abra sepa qué está por leer', () => {
    const md = reporteEnMarkdown(datos({ guardado: { relleno: 'x'.repeat(4096) } }))
    expect(md).toMatch(/\d+ KB/)
  })
})

describe('cómo entendió lo que le dijiste', () => {
  // Es la sección que separa dos bugs que desde afuera se ven idénticos: no
  // entendió la frase, o la entendió y no supo cómo hacerla. Con la misma
  // pantalla —un acuse y una criatura quieta— y en dos paquetes distintos.
  it('una frase entendida muestra la firma que sacó', () => {
    const md = reporteEnMarkdown(
      datos({
        lectura: {
          crudo: 'traeme un pescado',
          confianza: '0.90',
          clausulas: ['«traeme un pescado» → nutrition>0 · pedido · confianza 0.90 · sobre sustancia:pescado'],
        },
      }),
    )
    expect(md).toContain('«traeme un pescado»')
    expect(md).toContain('nutrition>0')
    expect(md).toContain('confianza 0.90')
  })

  it('una frase que se leyó y no dio nada lo dice, en vez de mostrar una lista vacía', () => {
    const md = reporteEnMarkdown(
      datos({ lectura: { crudo: 'hacé la cosa esa', confianza: '0.10', clausulas: [] } }),
    )
    expect(md).toContain('no entendió nada de la frase')
  })

  it('sin ninguna frase leída, no se inventa una lectura vacía', () => {
    expect(reporteEnMarkdown(datos())).toContain('No leyó ninguna frase')
  })
})

describe('las filas que no van', () => {
  it('una fila vacía no se escribe, porque se lee como un dato perdido', () => {
    expect(pares(['a', '1'], undefined, ['nota', ''], ['b', '2'])).toEqual([
      ['a', '1'],
      ['b', '2'],
    ])
  })

  it('un cero SÍ se escribe: cero es una respuesta', () => {
    // La guarda mira el texto vacío y no el valor falsy, que es la forma clásica
    // de perder un `0` — y «consultas al modelo: 0» es de los datos que más dicen.
    expect(pares(['consultas', '0'])).toEqual([['consultas', '0']])
  })
})

describe('el nombre del archivo', () => {
  it('no tiene ningún carácter que Windows rechace', () => {
    const n = nombreDelArchivo(412, '2026-08-03T12:34:56.789Z')
    expect(n).toBe('anima-ii-tick-412-2026-08-03T12-34-56-789Z.md')
    expect(n).not.toMatch(/[:*?"<>|/\\]/)
  })
})

// ─── El vigía ────────────────────────────────────────────────────────────────

/** Una ventana y una consola de mentira, con los oyentes a mano para dispararlos. */
function banco(): {
  vigia: Vigia
  romper: (ev: RoturaDeVentana) => void
  rechazar: (ev: PromesaRechazada) => void
  consola: ConsolaMinima
  loQueVioLaConsola: string[][]
} {
  let romper = (_: RoturaDeVentana): void => undefined
  let rechazar = (_: PromesaRechazada): void => undefined
  const ventana: DondeEscuchar = {
    addEventListener(tipo: 'error' | 'unhandledrejection', f: (ev: never) => void): void {
      if (tipo === 'error') romper = f as (ev: RoturaDeVentana) => void
      else rechazar = f as (ev: PromesaRechazada) => void
    },
  } as DondeEscuchar
  const loQueVioLaConsola: string[][] = []
  const consola: ConsolaMinima = {
    error: (...a: unknown[]) => loQueVioLaConsola.push(['error', ...a.map(String)]),
    warn: (...a: unknown[]) => loQueVioLaConsola.push(['warn', ...a.map(String)]),
  }
  const vigia = new Vigia(0)
  vigia.instalar(ventana, consola)
  return {
    vigia,
    romper: (ev) => {
      romper(ev)
    },
    rechazar: (ev) => {
      rechazar(ev)
    },
    consola,
    loQueVioLaConsola,
  }
}

describe('el vigía', () => {
  it('pesca las cuatro puertas', () => {
    const b = banco()
    b.romper({ message: 'boom', filename: 'main.ts', lineno: 3, colno: 1, error: new Error('boom') })
    b.rechazar({ reason: new Error('la promesa') })
    b.consola.error('[guardado] no se pudo escribir:', new Error('sin cuota'))
    b.consola.warn('[guardado] no se pudo leer')

    expect(b.vigia.juntado.roturas.map((r) => r.de)).toEqual([
      'excepción',
      'promesa',
      'console.error',
      'console.warn',
    ])
  })

  it('la consola de verdad sigue viendo todo', () => {
    // Envolver la consola para el reporte no puede APAGAR la consola: quien está
    // mirando en vivo mira ahí.
    const b = banco()
    b.consola.error('algo')
    expect(b.loQueVioLaConsola).toEqual([['error', 'algo']])
  })

  it('el stack del error que viene como segundo argumento se conserva', () => {
    // `console.error('[x] no anduvo:', e)` es como escribe todo `main.ts`, así que
    // el stack nunca está en el primer argumento.
    const b = banco()
    const e = new Error('sin cuota')
    b.consola.error('[guardado] no se pudo escribir:', e)
    expect(b.vigia.juntado.roturas[0]?.stack).toBe(e.stack)
  })

  it('un error sin `Error` adentro igual dice dónde fue', () => {
    // Es el caso de un recurso que no carga: no hay excepción, sólo el evento.
    const b = banco()
    b.romper({ message: 'Script error.', filename: 'sprites.js', lineno: 0, colno: 0, error: null })
    expect(b.vigia.juntado.roturas[0]?.texto).toBe('Script error. (sprites.js:0:0)')
  })

  it('el tick aparece recién cuando hay mundo', () => {
    const b = banco()
    b.consola.warn('antes')
    let tick = 0
    b.vigia.seguirElTick(() => tick)
    tick = 412
    b.consola.warn('después')
    expect(b.vigia.juntado.roturas.map((r) => r.tick)).toEqual([undefined, 412])
  })

  it('el tope tira las viejas y CUENTA cuántas tiró', () => {
    const b = banco()
    for (let i = 0; i < 250; i++) b.consola.error(`rotura ${String(i)}`)
    const j = b.vigia.juntado
    expect(j.roturas).toHaveLength(200)
    expect(j.tiradas).toBe(50)
    // Las que quedan son las ÚLTIMAS: cuando algo falla en bucle, en qué quedó
    // dice más que las primeras cincuenta iguales.
    expect(j.roturas[199]?.texto).toBe('rotura 249')
  })

  it('instalar dos veces no anota cada cosa dos veces', () => {
    const b = banco()
    b.vigia.instalar({ addEventListener: () => undefined } as DondeEscuchar, b.consola)
    b.consola.error('una sola vez')
    expect(b.vigia.juntado.roturas).toHaveLength(1)
  })
})
