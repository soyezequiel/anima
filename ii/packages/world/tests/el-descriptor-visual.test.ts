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
//   (d) CIEGO A LO COSMÉTICO: las claves son las declaradas y ni una más. Es
//       lo que impide que dos clientes con distinto idioma dejen de coincidir;
//   (e) NO INVENTA: no hay orientación, ni aberturas, ni contención. Lo que la
//       física no modela, el descriptor no lo dice;
//   (f) NO MIENTE POR OMISIÓN — el criterio que agregó el Hito 12. Dos cosas que
//       el jugador tiene que distinguir no pueden dar el mismo descriptor. Los
//       cuatro casos que fallaban están abajo, cada uno con su nombre.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, nameOf, type Body, type Physics } from '@anima/physics'

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
    const d = descriptorDe({ body: cuerpo('palo', 'madera', 1), at: PARADA }, PHYS)
    expect(d.partes).toBe(1)
    expect(d.juntas).toBe(0)
    expect(d.forma).toBe('vara')
  })

  it('y una obra que nadie diseñó tampoco necesita nada de afuera', () => {
    const d = descriptorDe({ body: obra('lo-que-invento'), at: SITIO }, PHYS)
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
    expect(descriptorDe({ body: obra('x'), at: PARADA }, PHYS).desplegado).toBeUndefined()
  })

  it('y LA CAPTURA se nota: dos peces no se dibujan como cero', () => {
    const base = descriptorDe({ body: obra('x'), at: SITIO }, PHYS, { at: SITIO, proximoIntento: 0, captura: [] })
    const con = descriptorDe({ body: obra('x'), at: SITIO }, PHYS, { at: SITIO, proximoIntento: 0, captura: ['p1', 'p2'] })
    expect(base.desplegado?.captura).toBe(0)
    expect(con.desplegado?.captura).toBe(2)
  })
})

// ─── (d) Ciego a lo cosmético ───────────────────────────────────────────────

describe('(d) las claves son las declaradas y ni una más', () => {
  it('un cuerpo suelto: diez claves', () => {
    // El guardián del ADR II-0017. El modo de falla de este tipo es que alguien le
    // agregue `nombre` o `sprite` «total es una línea», y con eso el hash deja de
    // ser comparable entre dos clientes con distinto idioma **sin que nada se
    // ponga rojo**. Por eso la lista se afirma entera y a mano.
    //
    // Eran seis hasta el Hito 12. Las cuatro que entraron —`nucleo`, `atadores`,
    // `estado` y `porte`— pasaron por la misma puerta que este test vigila, y el
    // criterio que las dejó pasar está escrito en `descriptor.ts`: **son estado
    // del mundo, no cosmética**. Ninguna es un texto, un color ni un ícono.
    expect(Object.keys(descriptorDe({ body: obra('x'), at: PARADA }, PHYS)).sort()).toEqual([
      'at',
      'atadores',
      'estado',
      'forma',
      'juntas',
      'materiales',
      'nucleo',
      'partes',
      'porte',
      'v',
    ])
  })

  it('uno desplegado: las mismas diez más `desplegado`', () => {
    const d = descriptorDe({ body: obra('x'), at: SITIO }, PHYS, { at: SITIO, proximoIntento: 0, captura: [] })
    expect(Object.keys(d).sort()).toEqual([
      'at',
      'atadores',
      'desplegado',
      'estado',
      'forma',
      'juntas',
      'materiales',
      'nucleo',
      'partes',
      'porte',
      'v',
    ])
    expect(Object.keys(d.desplegado ?? {})).toEqual(['captura'])
  })

  it('y `podrido` NO está cuando no lo está: una cosa sana hashea como antes de que existiera', () => {
    // La misma regla que `desplegado`: una clave opcional en `undefined` viaja al
    // hash igual. Si estuviera siempre, agregar la putrefacción le habría cambiado
    // el dibujo a todas las partidas donde nada se pudre.
    expect(descriptorDe({ body: obra('x'), at: PARADA }, PHYS).podrido).toBeUndefined()
    expect('podrido' in descriptorDe({ body: obra('x'), at: PARADA }, PHYS)).toBe(false)
  })

  it('EL ID DEL CUERPO NO ESTÁ ADENTRO, y es a propósito', () => {
    // El id es la LLAVE del mapa, no parte de lo que se dibuja: dos obras iguales
    // en dos lugares se dibujan iguales. Meterlo adentro haría que el hash del
    // dibujo cambiara con el contador de nombres del mundo, que es historia y no
    // estado visible.
    const uno = descriptorDe({ body: obra('obra-a'), at: PARADA }, PHYS)
    const otro = descriptorDe({ body: obra('obra-b'), at: PARADA }, PHYS)
    expect(JSON.stringify(uno)).toBe(JSON.stringify(otro))
  })

  it('y el orden en que se escribieron las partes NO cambia el descriptor', () => {
    // `materiales` va ordenado y sin repetir: cómo se armó la obra es un accidente
    // del orden de las uniones (medido en el tramo C·bis), no algo que se vea.
    const alReves: Body = { ...obra('x'), parts: [...obra('x').parts].reverse() }
    expect(descriptorDe({ body: alReves, at: PARADA }, PHYS).materiales).toEqual(
      descriptorDe({ body: obra('x'), at: PARADA }, PHYS).materiales,
    )
  })
})

// ─── (f) Lo que el Hito 12 destapó: el descriptor mentía por omisión ────────
//
// Los cuatro campos nuevos no son adornos. Cada uno tapa un caso en el que dos
// cosas que el jugador TIENE que distinguir se dibujaban idénticas, y los cuatro
// se encontraron midiendo antes de escribir una línea de UI.

describe('(f) dos cosas que se ven distinto no pueden tener el mismo descriptor', () => {
  it('UN LEÑO ARDIENDO Y UNO FRÍO. Era el mismo descriptor y el mismo hash', () => {
    // `madera` tiene `ignitionPoint` 300. El frío no llega y el otro se pasa.
    const frio = descriptorDe({ body: cuerpo('leno', 'madera', 2), at: PARADA }, PHYS)
    const arde = descriptorDe({ body: cuerpo('leno', 'madera', 2, { temperature: 400 }), at: PARADA }, PHYS)
    expect(frio.estado).toBe('sin-marca')
    expect(arde.estado).toBe('ardiendo')
    expect(renderDescriptorHash(escena(cuerpo('leno', 'madera', 2, { temperature: 400 })))).not.toBe(
      renderDescriptorHash(escena(cuerpo('leno', 'madera', 2))),
    )
  })

  it('y EL DIBUJO NO PUEDE CONTRADECIR AL NOMBRE, porque salen de la misma función', () => {
    // Es el motivo entero por el que `estadoVisibleDe` vive en `@anima/physics` y
    // no acá: si la pantalla tuviera sus propios umbrales, un día diría «ardiendo»
    // sobre algo que `nameOf` llama «chamuscado», y las dos tendrían razón.
    const b = cuerpo('leno', 'madera', 2, { temperature: 400 })
    expect(descriptorDe({ body: b, at: PARADA }, PHYS).estado).toBe('ardiendo')
    expect(nameOf(b, PHYS)).toContain('ardiendo')
  })

  it('UN GUIJARRO Y UN PEÑASCO de la misma piedra. También eran idénticos', () => {
    const porte = (m: number) => descriptorDe({ body: cuerpo('p', 'piedra', m), at: PARADA }, PHYS).porte
    expect(porte(0.1)).toBe('menudo')
    expect(porte(0.5)).toBe('chico')
    expect(porte(2)).toBe('mediano')
    expect(porte(8)).toBe('grande')
  })

  it('EL ATADOR DE CADA JUNTA, en el orden de las juntas y sin deduplicar', () => {
    // Con dos atadores distintos, un conjunto ya no diría cuál nudo es de cuál — y
    // el nudo i-ésimo se pinta con el color del atador i-ésimo.
    const dosAtaduras: Body = {
      ...obra('x'),
      parts: [...obra('x').parts, { substance: 'junco', mass: 0.1, q: {} }],
      joints: [
        { a: 0, b: 1, via: 'liana', strength: 0.4 },
        { a: 1, b: 2, via: 'tendon', strength: 0.5 },
      ],
    }
    const d = descriptorDe({ body: dosAtaduras, at: PARADA }, PHYS)
    expect(d.atadores).toEqual(['liana', 'tendon'])
    expect(d.atadores.length).toBe(d.juntas)
  })

  it('y `atadores` tiene SIEMPRE tantos como juntas, incluso sin ninguna', () => {
    const suelto = descriptorDe({ body: cuerpo('palo', 'madera', 1), at: PARADA }, PHYS)
    expect(suelto.juntas).toBe(0)
    expect(suelto.atadores).toEqual([])
  })

  it('EL NÚCLEO es la parte de MÁS MASA, no la primera que alguien escribió', () => {
    // El bug que este campo evita: una caña se llama «madera con liana» porque la
    // madera pesa más, y saldría color liana si el dibujo usara `parts[0]`.
    const alReves: Body = { ...obra('x'), parts: [...obra('x').parts].reverse() }
    expect(descriptorDe({ body: obra('x'), at: PARADA }, PHYS).nucleo).toBe('madera')
    expect(descriptorDe({ body: alReves, at: PARADA }, PHYS).nucleo).toBe('madera')
  })

  it('PODRIDO es ortogonal a la banda: un asado se pudre igual', () => {
    const podrido = cuerpo('pescado', 'pescado', 1, { decay: 0.6 })
    const d = descriptorDe({ body: podrido, at: PARADA }, PHYS)
    expect(d.podrido).toBe(true)
    // Y la banda sigue diciendo lo suyo, que es de cocción y no de putrefacción.
    expect(d.estado).not.toBe('sin-marca')
  })
})

// ─── (e) No inventa ─────────────────────────────────────────────────────────

describe('(e) el descriptor no dice nada que la física no modele', () => {
  it('no hay orientación, ni aberturas, ni contención, ni tamaño de dibujo', () => {
    // La regla 3 del ADR: lo que no está en el estado no se dibuja. Un descriptor
    // con `orientacion` haría que la pantalla afirme una geometría que el mundo no
    // tiene — el jugador vería una jaula donde hay un estado.
    //
    // ─── `porte` NO ES «TAMAÑO DE DIBUJO», Y LA DIFERENCIA ES TODO EL ADR ─────
    //
    // El tamaño de dibujo es cuántos píxeles ocupa: eso lo decide la pantalla y
    // el mundo no tiene nada que opinar. `porte` es una banda de MASA, que es
    // estado del mundo y está guardada. La prueba de que no son lo mismo: dos
    // clientes con distinto zoom coinciden en el `porte` y no en los píxeles.
    const claves = new Set(Object.keys(descriptorDe({ body: obra('x'), at: PARADA }, PHYS)))
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
    expect(descriptorDe({ body: obra('x'), at: PARADA }, PHYS).v).toBe(VERSION_DEL_DESCRIPTOR)
  })
})
