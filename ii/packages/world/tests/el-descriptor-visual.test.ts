// ─── PUNTO 11 DEL GATE 5→6: EL DESCRIPTOR VISUAL ────────────────────────────
//
// > existe un **descriptor visual procedural determinista**
//
// El [ADR II-0017] lo especifica entero, y el gate lo exige **aunque la UI no
// exista todavía**: es dato derivado del estado, y se puede afirmar sin dibujar un
// píxel. Ése es justamente el punto — un descriptor que sólo se pueda probar
// mirando la pantalla no se prueba nunca.
//
// ─── LOS CINCO CRITERIOS ────────────────────────────────────────────────────
//
//   (a) TOTAL: todo cuerpo tiene descriptor, siempre. Sin arte, sin nombre, sin
//       sprite y sin excepciones — que es lo que hace que el mapa no tenga huecos
//       justo donde está lo que la criatura inventó;
//   (b) DETERMINISTA: el mismo estado da el mismo hash, siempre;
//   (c) SENSIBLE A LO ESTRUCTURAL: una pieza más, una junta más o una captura más
//       cambian el hash. Sin esto el (b) lo cumpliría una constante;
//   (d) CIEGO A LO COSMÉTICO: las claves son las siete declaradas y ni una más. Es
//       lo que impide que dos clientes con distinto idioma dejen de coincidir;
//   (e) NO INVENTA: no hay orientación, ni aberturas, ni contención. Lo que la
//       física no modela, el descriptor no lo dice.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, type Body, type Physics } from '@anima/physics'

import { VERSION_DEL_DESCRIPTOR, descriptorDe, descriptoresDe, renderDescriptorHash } from '../src/descriptor.js'
import { hashWorld } from '../src/hash.js'
import { place } from '../src/intent.js'
import { stepWorld, type WorldState } from '../src/step.js'
import { actor, criatura, cuerpo, enElPiso, enLaMano, mundo } from './mundo-minimo.js'

const PHYS: Physics = buildSeedPhysics()
const PARADA = { x: 0, y: 0 }
const SITIO = { x: 1, y: 0 }

/** Una obra de dos piezas atadas. No se llama de ninguna manera. */
function obra(id: string): Body {
  return {
    id,
    form: 'vara',
    parts: [
      { substance: 'madera', mass: 0.5, q: {} },
      { substance: 'liana', mass: 0.2, q: {} },
    ],
    joints: [{ a: 0, b: 1, via: 'liana', strength: 0.4 }],
    state: {},
  }
}

function escena(b: Body = obra('obra')): WorldState {
  return mundo({
    phys: PHYS,
    bodies: [enElPiso(criatura('yo'), PARADA), enLaMano(b, PARADA, 'yo')],
    actors: [actor('yo', { holding: [b.id], capacity: 4 })],
  })
}

function desplegada(b: Body = obra('obra')): WorldState {
  return stepWorld(escena(b), [place({ by: 'yo', seq: 0 }, b.id, SITIO)]).state
}

// ─── (a) Total ──────────────────────────────────────────────────────────────

describe('(a) todo cuerpo tiene descriptor, sin arte y sin excepciones', () => {
  it('el mundo entero: tantos descriptores como cuerpos', () => {
    const w = desplegada()
    expect(descriptoresDe(w).size).toBe(w.bodies.size)
  })

  it('un cuerpo de UNA pieza y sin juntas también tiene el suyo', () => {
    // El caso que una UI real deja afuera: lo que no es nada interesante. Un palo
    // se dibuja igual, y el fallback no es una rama especial — es que no hay rama.
    const d = descriptorDe({ body: cuerpo('palo', 'madera', 1), at: PARADA })
    expect(d.partes).toBe(1)
    expect(d.juntas).toBe(0)
    expect(d.forma).toBe('vara')
  })

  it('y una obra que nadie diseñó tampoco necesita nada de afuera', () => {
    const d = descriptorDe({ body: obra('lo-que-invento'), at: SITIO })
    expect(d.materiales).toEqual(['liana', 'madera'])
    expect(d.partes).toBe(2)
    expect(d.juntas).toBe(1)
  })
})

// ─── (b) Determinista ───────────────────────────────────────────────────────

describe('(b) el mismo estado da el mismo hash', () => {
  it('dos corridas idénticas dibujan idéntico', () => {
    expect(renderDescriptorHash(desplegada())).toBe(renderDescriptorHash(desplegada()))
  })

  it('y el hash no depende de en qué orden se armó el mapa de cuerpos', () => {
    // `descriptoresDe` recorre `s.bodies`, que el mundo mantiene por id — y
    // `hashWorld` además ordena las claves de un `Map`. Las dos cosas: una para
    // que el recorrido sea canónico, la otra para que el hash lo sea aunque
    // alguien construya el mapa de otra forma.
    const a = mundo({ phys: PHYS, bodies: [enElPiso(obra('z'), PARADA), enElPiso(obra('a'), SITIO)] })
    const b = mundo({ phys: PHYS, bodies: [enElPiso(obra('a'), SITIO), enElPiso(obra('z'), PARADA)] })
    expect(renderDescriptorHash(a)).toBe(renderDescriptorHash(b))
  })
})

// ─── (c) Sensible a lo estructural ──────────────────────────────────────────

describe('(c) lo estructural cambia el hash', () => {
  it('una PIEZA más', () => {
    const tres: Body = {
      ...obra('obra'),
      parts: [...obra('obra').parts, { substance: 'madera', mass: 0.3, q: {} }],
    }
    expect(renderDescriptorHash(escena(tres))).not.toBe(renderDescriptorHash(escena()))
  })

  it('una JUNTA más', () => {
    const dos: Body = { ...obra('obra'), joints: [...obra('obra').joints, { a: 1, b: 0, via: 'liana', strength: 0.2 }] }
    expect(renderDescriptorHash(escena(dos))).not.toBe(renderDescriptorHash(escena()))
  })

  it('un MATERIAL distinto', () => {
    const conJunco: Body = {
      ...obra('obra'),
      parts: [{ substance: 'madera', mass: 0.5, q: {} }, { substance: 'junco', mass: 0.2, q: {} }],
    }
    expect(renderDescriptorHash(escena(conJunco))).not.toBe(renderDescriptorHash(escena()))
  })

  it('ESTAR DESPLEGADO cambia el dibujo, y no estarlo lo deja como siempre', () => {
    // Las dos mitades. Que desplegar se note es lo que pide el Hito 12C —«los
    // siete casos del objeto emergente»—; que NO desplegar no mueva nada es lo que
    // hace que el campo nuevo no le cambie el dibujo a una partida que no lo usa.
    expect(renderDescriptorHash(desplegada())).not.toBe(renderDescriptorHash(escena()))
    expect(descriptorDe({ body: obra('x'), at: PARADA }).desplegado).toBeUndefined()
  })

  it('y LA CAPTURA se nota: dos peces no se dibujan como cero', () => {
    const base = descriptorDe({ body: obra('x'), at: SITIO }, { at: SITIO, proximoIntento: 0, captura: [] })
    const con = descriptorDe({ body: obra('x'), at: SITIO }, { at: SITIO, proximoIntento: 0, captura: ['p1', 'p2'] })
    expect(base.desplegado?.captura).toBe(0)
    expect(con.desplegado?.captura).toBe(2)
  })
})

// ─── (d) Ciego a lo cosmético ───────────────────────────────────────────────

describe('(d) las claves son las declaradas y ni una más', () => {
  it('un cuerpo suelto: seis claves', () => {
    // El guardián del ADR II-0017. El modo de falla de este tipo es que alguien le
    // agregue `nombre` o `sprite` «total es una línea», y con eso el hash deja de
    // ser comparable entre dos clientes con distinto idioma **sin que nada se
    // ponga rojo**. Por eso la lista se afirma entera y a mano.
    expect(Object.keys(descriptorDe({ body: obra('x'), at: PARADA })).sort()).toEqual([
      'at',
      'forma',
      'juntas',
      'materiales',
      'partes',
      'v',
    ])
  })

  it('uno desplegado: las mismas seis más `desplegado`', () => {
    const d = descriptorDe({ body: obra('x'), at: SITIO }, { at: SITIO, proximoIntento: 0, captura: [] })
    expect(Object.keys(d).sort()).toEqual(['at', 'desplegado', 'forma', 'juntas', 'materiales', 'partes', 'v'])
    expect(Object.keys(d.desplegado ?? {})).toEqual(['captura'])
  })

  it('EL ID DEL CUERPO NO ESTÁ ADENTRO, y es a propósito', () => {
    // El id es la LLAVE del mapa, no parte de lo que se dibuja: dos obras iguales
    // en dos lugares se dibujan iguales. Meterlo adentro haría que el hash del
    // dibujo cambiara con el contador de nombres del mundo, que es historia y no
    // estado visible.
    const uno = descriptorDe({ body: obra('obra-a'), at: PARADA })
    const otro = descriptorDe({ body: obra('obra-b'), at: PARADA })
    expect(JSON.stringify(uno)).toBe(JSON.stringify(otro))
  })

  it('y el orden en que se escribieron las partes NO cambia el descriptor', () => {
    // `materiales` va ordenado y sin repetir: cómo se armó la obra es un accidente
    // del orden de las uniones (medido en el tramo C·bis), no algo que se vea.
    const alReves: Body = { ...obra('x'), parts: [...obra('x').parts].reverse() }
    expect(descriptorDe({ body: alReves, at: PARADA }).materiales).toEqual(
      descriptorDe({ body: obra('x'), at: PARADA }).materiales,
    )
  })
})

// ─── (e) No inventa ─────────────────────────────────────────────────────────

describe('(e) el descriptor no dice nada que la física no modele', () => {
  it('no hay orientación, ni aberturas, ni contención, ni tamaño de dibujo', () => {
    // La regla 3 del ADR: lo que no está en el estado no se dibuja. Un descriptor
    // con `orientacion` haría que la pantalla afirme una geometría que el mundo no
    // tiene — el jugador vería una jaula donde hay un estado.
    const claves = new Set(Object.keys(descriptorDe({ body: obra('x'), at: PARADA })))
    for (const inventada of ['orientacion', 'rotacion', 'abertura', 'contiene', 'sprite', 'icono', 'nombre', 'color']) {
      expect(claves.has(inventada), `apareció «${inventada}»`).toBe(false)
    }
  })

  it('la versión del descriptor entra en el hash: dos clientes distintos no coinciden', () => {
    // ─── ESTE TEST NO HACIA LO QUE SU NOMBRE DICE ─────────────────────────────
    //
    // La primera version sólo comprobaba que `descriptorDe` devolviera la constante
    // que el propio test importa. Eso no toca el hash ni compara dos versiones: es
    // `VERSION === VERSION`, y habria quedado verde aunque la version no entrara.
    //
    // Ahora se hashea el MISMO mundo con dos versiones y se exige que no coincidan.
    // Es lo mismo que `physicsVersion` para los sellos, y se afirma el mecanismo
    // —que la version esta adentro— y no un numero, que cambiaria al subirla.
    const w = desplegada()
    const conLaSuya = renderDescriptorHash(w)
    const conOtra = hashWorld({ v: VERSION_DEL_DESCRIPTOR + 1, cuerpos: descriptoresDe(w) })
    expect(conOtra).not.toBe(conLaSuya)
    // Y el control: con la MISMA version, el mismo mundo da el mismo numero. Sin
    // esto, un hash que devolviera algo distinto en cada llamada pasaria igual.
    expect(hashWorld({ v: VERSION_DEL_DESCRIPTOR, cuerpos: descriptoresDe(w) })).toBe(conLaSuya)
    expect(descriptorDe({ body: obra('x'), at: PARADA }).v).toBe(VERSION_DEL_DESCRIPTOR)
  })
})
