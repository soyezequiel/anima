// ─── C6 · FRAGUA Y JUEZ EN EL RECORRIDO REAL ───────────────────────────────
//
// ─── LA MEDICIÓN, y es la misma forma de las tres anteriores ───────────────
//
// Antes de escribir una línea, se contaron los consumidores de cada pieza:
//
//   · `@anima/forge` y `@anima/judge` — CERO en producción. El único
//     `package.json` que los declara es el de `@anima/mind`, y ni siquiera los
//     importa: `PedidoALaFragua` está escrito estructuralmente para no depender;
//   · `MenteOptions.costura` — CERO llamadores. `escalera.ts` la llama cuando
//     `plan()` contesta `gap`, y nadie se la pasaba, así que **el gancho no podía
//     dispararse ni una vez**;
//   · `Sujeto` —lo que el juez juzga— se construye SÓLO adentro de los tests del
//     propio juez. La cadena fragua → juez no existe en ninguna parte;
//   · `Registro.instalar` —el que publica una habilidad juzgada al catálogo—
//     tampoco tiene un llamador de producción.
//
// O sea: los dos puertos están enteros, probados, y no se tocan.
//
// ─── LO QUE APARECIÓ AL ABRIR LA COSTURA, y no lo esperaba nadie ───────────
//
// Con `costura` enchufada, en 600 ticks y con CUALQUIER orden —y también **sin
// ninguna orden, viviendo sola**— la mente pide siempre exactamente lo mismo:
//
//     gap  = emitsPower<410&emitsPower>=253
//     meta = holding(tag:carnoso,toxicity<0.0528)
//     por  = ningún esquema conocido establece «emitsPower>=253»
//
// Traducido: **quiere cocinar**. Tiene hambre, la carne cruda es venenosa, cocinar
// la destoxifica, y para cocinar necesita un fuego DE ESTA FUERZA — y el catálogo
// sabe hacer «un fuego», no «un fuego de tanto». Es literalmente la frase del
// criterio: componer de forma nueva recursos que ya existen.
//
// ─── EL TECHO DEL CATÁLOGO, que ya estaba medido y escrito ─────────────────
//
// `ConstructionSchema` tiene tres formas —proceso, ley, obra— y ninguna es «una
// habilidad que establece X». Así que una candidata CON plano se puede publicar y
// una candidata suelta no: se instala, se vuela, cambia el mundo, y el
// planificador no la puede elegir porque no hay fila que la represente. Está
// escrito en `Instalada.capacidad` de `@anima/forge` y contado por `sinPublicar`.
//
// Por eso el portón de la promoción son DOS y no uno: el juez tiene que promover
// **y** la candidata tiene que traer con qué publicarse. Las dos negativas se
// dicen distinto, porque son distintas.

import { describe, expect, it } from 'vitest'
import { Partida } from '@anima/perceive'
import { vivir } from '@anima/mind'
import type { PedidoALaFragua } from '@anima/mind'
import { definirPlano } from '@anima/physics'
import { CATALOGO_CORE, esquemaDeObra } from '@anima/plan'
import type { CatalogCapability } from '@anima/plan'

import { Ordenes } from '../src/ordenes.js'
import type { Forjado } from '../src/ordenes.js'
import { PHYS, arrancar } from '../src/mundo.js'

const QUIEN = 'ana'
const SEMILLA = 20260727n

interface Sesion {
  readonly p: Partida
  readonly o: Ordenes
}

function nueva(o: ConstructorParameters<typeof Ordenes>[3] = {}): Sesion {
  const { state } = arrancar(SEMILLA)
  const p = new Partida(state)
  return { p, o: new Ordenes(p, QUIEN, PHYS, o) }
}

/**
 * CORRER ES `async`, y no es una comodidad de test.
 *
 * La fragua contesta con una promesa, y una promesa se resuelve en una microtarea
 * — o sea, cuando el hilo se suelta. Un bucle sincrónico de veinte ticks no
 * suelta el hilo ni una vez, así que lo que la fragua contestó NUNCA llega a la
 * frontera y el test mediría el mecanismo apagado. Es la misma forma que el
 * fixture del C4 tomó con el proveedor, por el mismo motivo.
 */
async function correr(s: Sesion, n: number): Promise<void> {
  for (let k = 0; k < n; k++) {
    s.o.antesDelTick(s.p.state.tick)
    vivir(s.p, s.o.mentes, 1)
    s.o.despuesDelTick()
    await Promise.resolve()
  }
}

/** Corre hasta que la fragua tenga algo pedido, o se rinde. */
async function hastaQuePida(s: Sesion, tope = 600): Promise<readonly PedidoALaFragua[]> {
  for (let k = 0; k < tope; k++) {
    await correr(s, 1)
    if (s.o.pedidosALaFragua.length > 0) return s.o.pedidosALaFragua
  }
  return s.o.pedidosALaFragua
}

/**
 * UNA CAPACIDAD DE MENTIRA PERO BIEN FORMADA: una obra que establece el gap.
 *
 * Se arma con `esquemaDeObra`, que es la misma función que usaría la fragua de
 * verdad para una candidata con plano. Lo que este archivo prueba es el PORTÓN,
 * no la generación de código: de dónde salió el plano es asunto del Hito 8.
 */
function capacidadFalsa(establece: string): CatalogCapability {
  const d = definirPlano(
    {
      parts: [
        { rol: 'brazo', pide: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
        { rol: 'hebra', pide: [{ q: 'flexibility', op: '>=', v: 0.8 }] },
      ],
      joints: [{ a: 'brazo', b: 'hebra', binder: 'hebra' }],
    },
    PHYS,
  )
  if (d.k !== 'ok') throw new Error('el plano de este test no se define')
  return { clase: 'usar', de: 'fogonRegulado', esquema: esquemaDeObra(d.def, establece) }
}

/** La fragua guionada: contesta lo que este test le diga, sin tocar el modelo. */
function fraguaQueContesta(f: Forjado | undefined): ConstructorParameters<typeof Ordenes>[3]['fragua'] {
  return () => Promise.resolve(f)
}

describe('C6 · la fragua se despierta', () => {
  it('(1) LA MENTE PIDE, y hasta hoy no tenía a quién', async () => {
    const s = nueva()
    const ps = await hastaQuePida(s)
    expect(ps.length, 'la costura no se disparó ni una vez en 600 ticks').toBeGreaterThan(0)
    const p = ps[0]
    expect(p?.gap, 'el hueco vino vacío').toBeTruthy()
    expect(p?.meta, 'no dice para qué lo quería').toBeTruthy()
    expect(p?.porQue, 'no dice por dónde se cortó el planificador').toBeTruthy()
  })

  it('(2) EL MISMO HUECO NO SE PIDE DOS VECES', async () => {
    // `gap` vuelve todos los ticks mientras la meta siga sin plan. Sin cerrojo,
    // un hueco serían veinte viajes al modelo por la misma cosa.
    const s = nueva()
    await hastaQuePida(s)
    const primero = s.o.pedidosALaFragua.length
    await correr(s, 60)
    expect(s.o.pedidosALaFragua.length).toBe(primero)
  })

  it('(3) Y SE LO DICE AL CUIDADOR, que si no es magia', async () => {
    const s = nueva()
    await hastaQuePida(s)
    await correr(s, 2)
    const avisos = s.o.charla.filter((d) => d.clase === 'progreso' || d.clase === 'aviso')
    expect(avisos.some((d) => d.texto.includes('no sé cómo'))).toBe(true)
  })
})

describe('C6 · el portón de la materia', () => {
  it('(4) UN HUECO DE MATERIA QUE NO EXISTE NO SALE A PEDIR NADA', async () => {
    // El límite escrito del hito: «un gap de materia o física queda unsupported».
    // Se le pide un hueco con una cualidad que la física no conoce.
    const s = nueva({ fragua: fraguaQueContesta(undefined) })
    expect(s.o.sePuedeForjar('holding(tag:fibroso)')).toBe(true)
    expect(s.o.sePuedeForjar('emitsPower>=253')).toBe(true)
    expect(s.o.sePuedeForjar('magia>0')).toBe(false)
    expect(s.o.sePuedeForjar('holding(tag:plastico)')).toBe(false)
  })

  it('(5) Y NO TOCA NADA: ni catálogo, ni recetas, ni física', async () => {
    const s = nueva({ fragua: fraguaQueContesta(undefined) })
    const antes = s.o.catalogo.catalogEpoch
    const sustancias = s.p.state.phys.substances.size
    await hastaQuePida(s)
    await correr(s, 20)
    expect(s.o.catalogo.catalogEpoch, 'el catálogo cambió sin que nadie promoviera nada').toBe(antes)
    expect(s.p.state.phys.substances.size).toBe(sustancias)
    expect(s.o.catalogo.coreSchemas.length).toBe(CATALOGO_CORE.coreSchemas.length)
  })
})

describe('C6 · el juez es el portón, y el mundo no se frena', () => {
  it('(6) EL EPISODIO NO BLOQUEA EL TICK: se pide y el mundo sigue', async () => {
    // Una fragua que NUNCA contesta. El mundo tiene que avanzar igual, que es la
    // misma promesa que el C4 le arrancó al proveedor.
    let colgada = 0
    const s = nueva({
      fragua: () => {
        colgada++
        return new Promise<Forjado | undefined>(() => {
          /* nunca */
        })
      },
    })
    await hastaQuePida(s)
    const t = s.p.state.tick
    await correr(s, 50)
    expect(colgada, 'nunca se le pidió nada a la fragua').toBeGreaterThan(0)
    expect(s.p.state.tick, 'el mundo se frenó esperando a la fragua').toBe(t + 50)
  })

  it('(7) SÓLO SE USA SI EL JUEZ PROMUEVE', async () => {
    const s = nueva({
      fragua: fraguaQueContesta({
        nombre: 'fogonRegulado',
        grado: 'no-promueve',
        porQue: 'se cayó en dos mundos adversos',
        capacidad: capacidadFalsa('emitsPower>=253'),
      }),
    })
    const antes = s.o.catalogo.catalogEpoch
    await hastaQuePida(s)
    await correr(s, 20)
    expect(s.o.catalogo.catalogEpoch, 'se publicó algo que el juez rechazó').toBe(antes)
    expect(s.o.charla.some((d) => d.texto.includes('no me salió'))).toBe(true)
  })

  it('(8) Y CUANDO PROMUEVE, la capacidad entra al catálogo y llega a la mente', async () => {
    const s = nueva({
      fragua: fraguaQueContesta({
        nombre: 'fogonRegulado',
        grado: 'promueve',
        porQue: 'pasó los cuatro mundos del banco',
        capacidad: capacidadFalsa('emitsPower>=253'),
      }),
    })
    const antes = s.o.catalogo.catalogEpoch
    await hastaQuePida(s)
    await correr(s, 20)
    expect(s.o.catalogo.catalogEpoch, 'el catálogo no cambió').not.toBe(antes)
    expect(s.o.catalogo.skillCapabilities.length).toBe(1)
    // Y la mente lo VE: el catálogo que se le pasa es el nuevo, no el de fábrica.
    expect(s.o.mentes.get(QUIEN)?.catalogo.catalogEpoch).toBe(s.o.catalogo.catalogEpoch)
    expect(s.o.charla.some((d) => d.texto.includes('aprendí'))).toBe(true)
  })

  it('(9) UNA CANDIDATA SIN PLANO SE DICE, y no se publica', async () => {
    // El techo del catálogo: `ConstructionSchema` no tiene una forma para «una
    // habilidad que establece X». Promovida y todo, no hay fila que publicar.
    const s = nueva({
      fragua: fraguaQueContesta({
        nombre: 'frotarMasFuerte',
        grado: 'promueve',
        porQue: 'pasó el banco',
      }),
    })
    const antes = s.o.catalogo.catalogEpoch
    await hastaQuePida(s)
    await correr(s, 20)
    expect(s.o.catalogo.catalogEpoch).toBe(antes)
    expect(s.o.charla.some((d) => d.texto.includes('no la sé usar todavía'))).toBe(true)
  })

  it('(10) EL CONTROL: sin fragua enchufada, nada de esto pasa', async () => {
    // Que la costura esté abierta no puede cambiar la conducta de quien no la usa.
    const s = nueva()
    const antes = s.o.catalogo.catalogEpoch
    await hastaQuePida(s)
    await correr(s, 20)
    expect(s.o.catalogo.catalogEpoch).toBe(antes)
    expect(s.o.charla.some((d) => d.texto.includes('aprendí'))).toBe(false)
  })
})
