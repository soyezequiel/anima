/**
 * «EL tronco», «ESO», «traeLO» — y lo que NO se portó.
 *
 * El Hito 6 pedía «`resolveReference` portado casi tal cual». Se midió primero y
 * el resultado dio vuelta el trabajo: **`plan/src/referencias.ts` ya es un
 * resolutor**, así que portar el de Ánima I encima habría dejado dos resolutores
 * que pueden contestar distinto sobre el mismo mundo.
 *
 * Lo que faltaba eran dos cosas y ninguna es resolver: **detectar** que una frase
 * señala, y **acordarse** de qué se nombró. Este archivo mide las dos, y mide
 * también las tres que se decidió NO portar — porque una decisión de no hacer
 * algo sin su medición al lado es una excusa.
 */

import { buildSeedPhysics, nameOf } from '@anima/physics'
import { ESQUEMAS, resolverCuerpo } from '@anima/plan'
import { Contexto, Partida } from '@anima/perceive'
import { Creencias, Mente, vivir } from '@anima/mind'
import { describe, expect, it } from 'vitest'
import { PUENTE } from '../src/alias.js'
import { leer } from '../src/leer.js'
import { lexicoDe } from '../src/lexico.js'
import { CanalDeHabla } from '../src/habla.js'
import { MemoriaDeLaCharla, memoriaDe, referenciaDe, sinEnclitico } from '../src/referencias.js'
import { actor, criatura, enElPiso, laOrilla, mundo } from './mundo.js'

const QUIEN = 'ana'
const phys = buildSeedPhysics()
const lexico = lexicoDe(phys, PUENTE)
const FIRMAS = new Set(ESQUEMAS.map((e) => e.establishes))
const conoce = (p: string): boolean => lexico.entradas.has(p)

function opc(memoria?: MemoriaDeLaCharla) {
  return {
    phys,
    lexico,
    sabeElCatalogo: (f: string): boolean => FIRMAS.has(f),
    ...(memoria === undefined ? {} : { memoria }),
  }
}

describe('detectar que una frase señala', () => {
  it('«traé un palo» NO señala y «traé el palo» SÍ', () => {
    // Es la distinción que el paquete no hacía: las dos frases se leían igual.
    expect(leer('traé un palo', opc()).clausulas[0]?.referencia).toBeUndefined()
    expect(leer('traé el palo', opc()).clausulas[0]?.referencia?.clase).toBe('definida')
  })

  it('los demostrativos y los enclíticos', () => {
    expect(leer('comé eso', opc()).clausulas[0]?.referencia?.clase).toBe('demostrativa')
    expect(leer('traelo', opc()).clausulas[0]?.referencia?.clase).toBe('pronominal')
    expect(leer('dejalos ahí', opc()).clausulas[0]?.referencia?.clase).toBe('pronominal')
  })

  it('y el enclítico NO dispara con cualquier palabra terminada en -lo', () => {
    // El control, y es el que hace usable la regla: sin el portón del léxico,
    // «pelo», «solo» y «malas» serían pedidos con objeto.
    for (const p of ['pelo', 'solo', 'malas', 'suelo']) {
      expect(referenciaDe([p], 0, conoce), p).toBe('ninguna')
    }
    // Y el piso de largo: «solo» no se parte en «so» + «lo».
    expect(sinEnclitico('solo')).toBeUndefined()
    expect(sinEnclitico('traelo')).toBe('trae')
  })

  it('«traelo» además se ENTIENDE, no sólo se detecta', () => {
    // El enclítico dejaba la palabra fuera del léxico, así que la frase entera
    // caía a `no-entendida`. Ahora se prueba la raíz.
    const c = leer('traelo', opc()).clausulas[0]
    expect(c?.verbo).toBe('traer')
    expect(c?.grado).not.toBe('no-entendida')
  })
})

describe('la memoria de la charla', () => {
  it('sin nada nombrado, «comé eso» no tiene a qué apuntar', () => {
    const m = new MemoriaDeLaCharla()
    const c = leer('comé eso', opc(m)).clausulas[0]
    expect(c?.referencia?.clase).toBe('demostrativa')
    // Y NO se degrada a «cualquier cosa»: sin `Ref`, en vez de uno inventado.
    expect(c?.referencia?.ref).toBeUndefined()
  })

  it('con algo nombrado, sale un `Ref` por id', () => {
    const m = new MemoriaDeLaCharla()
    m.nombrar('suelta:-6:-7:0')
    const c = leer('comé eso', opc(m)).clausulas[0]
    expect(c?.referencia?.ref).toEqual({ k: 'id', id: 'suelta:-6:-7:0' })
  })

  it('usar algo lo vuelve lo más saliente', () => {
    const m = new MemoriaDeLaCharla()
    m.nombrar('a')
    m.usar('b')
    expect(m.ultimoUsado).toBe('b')
    // Después de agarrar el palo, «eso» es el palo.
    expect(m.ultimoNombrado).toBe('b')
  })

  // ─── Y DE DÓNDE SALE, que es lo que agregó el C1 de convergencia ──────────
  //
  // De la ventana reciente del log, no de una variable viva al costado. Es lo
  // que hace que el historial durable alimente la lectura en vez de sólo
  // llenar una pantalla.

  it('LA MEMORIA SE DERIVA DEL LOG: lo último con cuerpo gana', () => {
    const c = new CanalDeHabla()
    c.decir(0, 'entrada', 'agarrá la vara', { sobre: 'vara' })
    c.decir(4, 'progreso', 'agarró una hebra de liana', { sobre: 'hebra' })
    c.decir(5, 'acuse', 'dale, voy')

    const m = memoriaDe(c.ventana())
    expect(m.ultimoNombrado).toBe('hebra')
    // Y la distinción se conserva: lo que el cuidador NOMBRA no es lo que la
    // criatura USA. La última entrada del cuidador no fue sobre ningún cuerpo.
    expect(m.ultimoUsado).toBe('hebra')
    expect(leer('comé eso', opc(m)).clausulas[0]?.referencia?.ref).toEqual({ k: 'id', id: 'hebra' })
  })

  it('EL CONTROL NEGATIVO: sin log, la misma frase no tiene a qué apuntar', () => {
    // Si esto diera un `Ref`, el de arriba no probaría que el contexto viene de
    // la charla — vendría de cualquier otro lado.
    const m = memoriaDe(new CanalDeHabla().ventana())
    expect(m.ultimoNombrado).toBeUndefined()
    expect(leer('comé eso', opc(m)).clausulas[0]?.referencia?.ref).toBeUndefined()
  })

  it('y una charla sin cuerpos nombrados tampoco inventa uno', () => {
    const c = new CanalDeHabla()
    c.decir(0, 'entrada', 'hacé fuego')
    c.decir(0, 'acuse', 'dale, voy')
    expect(memoriaDe(c.ventana()).ultimoNombrado).toBeUndefined()
  })
})

describe('CONTRA EL MUNDO: el `Ref` lo resuelve @anima/plan', () => {
  it('lo que este paquete produce, el resolutor de al lado lo entiende', () => {
    // Es el punto de no haber escrito un segundo resolutor: el `Ref` que sale de
    // una referencia hablada tiene que ser el MISMO que `plan` ya sabe resolver.
    const orilla = laOrilla()
    const p = new Partida(
      mundo({
        dios: orilla.dios,
        bodies: [enElPiso(criatura(QUIEN, 310), orilla.parada)],
        actors: [actor(QUIEN, { capacity: 3 })],
      }),
      { vigilar: true },
    )
    const m = new Mente({ actor: QUIEN, memoria: new Creencias() })
    vivir(p, new Map([[QUIEN, m]]), 40)
    const v = new Contexto(p.proyeccion, { actor: QUIEN, rng: p.dado.tirar, lugares: p.lugares }).ctx

    // Algo que la criatura tiene en la mano: eso es lo que un cuidador señalaría.
    const enLaMano = p.state.actors.get(QUIEN)?.holding[0]
    expect(enLaMano, 'la criatura no agarró nada en 40 ticks').toBeDefined()

    const charla = new MemoriaDeLaCharla()
    charla.usar(enLaMano as string)
    const c = leer('comé eso', opc(charla)).clausulas[0]
    const ref = c?.referencia?.ref
    expect(ref).toBeDefined()

    // Y el resolutor de `@anima/plan` lo encuentra en el mundo de verdad.
    const cuerpo = resolverCuerpo(ref as Parameters<typeof resolverCuerpo>[0], v, new Map())
    expect(cuerpo, 'el Ref no resolvió contra la vista').toBeDefined()
    console.log(`\n  «comé eso» → ${JSON.stringify(ref)} → ${String(cuerpo?.id)}`)

    // Y el cuerpo que salió es el que la criatura tiene en la mano.
    expect(cuerpo?.id).toBe(enLaMano)
  })

  it('LO QUE NO SE PORTÓ: `name` no es un identificador, y por eso no se usa', () => {
    // La medición que decidió no portar el filtro por nombre. El mismo cuerpo
    // cambia de nombre al cocinarse, así que un resolutor por `name` deja de
    // encontrar «el pescado» EN CUANTO se cocina — que es el paso siguiente de
    // la cadena del Hito 5.
    const crudo = {
      id: 'x',
      parts: [{ substance: 'pescado', mass: 1, q: { digestibility: 0.2, nutrition: 5 } }],
      joints: [],
      state: {},
      at: { x: 0, y: 0 },
      form: 'filete',
    }
    const asado = { ...crudo, parts: [{ ...crudo.parts[0], q: { digestibility: 0.9, nutrition: 5 } }] }
    type Cuerpo = Parameters<typeof nameOf>[0]
    const a = nameOf(crudo as unknown as Cuerpo, phys)
    const b = nameOf(asado as unknown as Cuerpo, phys)
    console.log(`  el MISMO cuerpo: «${a}» → «${b}»`)
    expect(a).not.toBe(b)
  })

  it('y los `tags` son 6 clases donde `kind` particionaba en 30', () => {
    // La otra medición: por eso tampoco se filtra por tag. Se cuenta del
    // catálogo, no de una lista.
    const tags = new Set<string>()
    for (const s of phys.substances.values()) for (const t of s.tags) tags.add(t)
    console.log(`  ${String(phys.substances.size)} sustancias repartidas en ${String(tags.size)} tags`)
    expect(tags.size).toBeLessThan(phys.substances.size / 3)
  })
})
