// ─── Ataque adversario a la PUERTA ───────────────────────────────────────────
//
// Este archivo no prueba la física: prueba a `admit()`. Cada caso es un proceso
// construido a mano con la única intención de COLARSE. La pregunta no es «¿esto
// es físico?» sino «¿la puerta lo deja pasar?», y sobre todo la peor de las dos:
// «¿lo deja pasar algo que produciría conducta absurda en el mundo?».
//
// El archivo tiene dos mitades, y la separación es lo que lo hace útil:
//
//   RECHAZOS CONFIRMADOS — ataques que la puerta paró. Quedan como regresión:
//   si mañana alguien toca `admit.ts` y uno de éstos se cuela, el test grita.
//
//   LOS ONCE QUE SE COLABAN — ataques que PASARON cuando este archivo se
//   escribió, y que la reparación de las seis causas cerró. Cada uno conserva su
//   `porque` original —la evidencia de por qué producía conducta absurda— y ahora
//   afirma el CÓDIGO con el que la puerta lo rechaza. Los dos tests de antes (uno
//   documentando la realidad rota, uno `it.fails` con lo que debería pasar) son
//   ahora un `it` normal por caso.
//
//   NADA DE ESTE ARCHIVO ARREGLA `admit.ts`: los ataques se escribieron primero,
//   se midió qué se colaba, y recién después se reparó la puerta.

import { describe, expect, it } from 'vitest'
import { admit, tieneCodigo, type Codigo, type Verdict } from '../src/admit.js'
import { buildSeedPhysics } from '../src/physics.js'
import { FRICCION, PHYSICS_VERSION, type Process } from '../src/process.js'
import { seg } from '../src/fixed.js'

const phys = buildSeedPhysics()

const codigos = (v: Verdict): readonly Codigo[] => v.razones.map((r) => r.codigo)

/** Un proceso mínimo y plausible. Cada ataque le rompe una cosa por vez. */
const p = (id: string, extra: Partial<Process> = {}): Process => ({
  id,
  lexeme: { nombre: id },
  roles: [{ name: 'a', where: [] }],
  arrangement: { k: 'held' },
  gate: [],
  effects: [],
  establishes: [],
  commitment: 'reversible',
  trust: 'borrador',
  physicsVersion: PHYSICS_VERSION,
  provenance: { by: 'modelo' },
  ...extra,
})

// ═══════════════════════════════════════════════════════════════════════════
// PRIMERA MITAD — lo que la puerta SÍ para. Regresiones.
// ═══════════════════════════════════════════════════════════════════════════

describe('RECHAZOS CONFIRMADOS · roles que no existen', () => {
  it('un efecto sobre un rol no declarado no entra', () => {
    const v = admit(
      p('efecto-fantasma', {
        effects: [{ k: 'drain', q: 'stamina', on: 'nadie', porSegundo: 20 }],
      }),
      phys,
    )
    expect(tieneCodigo(v, 'rol-desconocido')).toBe(true)
  })

  it('un poweredBy que drena de un rol inventado no entra', () => {
    const v = admit(
      p('poder-fantasma', {
        effects: [
          {
            k: 'drive',
            q: 'temperature',
            on: 'a',
            toward: 400,
            porSegundo: 120,
            poweredBy: { from: 'el-viento', q: 'stamina', efficiency: 0.5 },
          },
        ],
      }),
      phys,
    )
    expect(tieneCodigo(v, 'rol-desconocido')).toBe(true)
  })

  it('un yield que reparte un rol inventado no entra', () => {
    const v = admit(
      p('parte-fantasma', {
        completion: { at: seg(0.5), yields: [{ k: 'split', role: 'el-otro', at: 'grain' }] },
      }),
      phys,
    )
    expect(tieneCodigo(v, 'rol-desconocido')).toBe(true)
  })

  it('citar «b» cuando el rol se llama «b?» tampoco entra: el sufijo es parte del nombre', () => {
    const v = admit(
      p('opcional-mal-citado', {
        roles: [
          { name: 'a', where: [] },
          { name: 'b?', where: [] },
          { name: 'binder', where: [] },
        ],
        completion: { at: seg(0.25), yields: [{ k: 'join', a: 'a', b: 'b', via: 'binder' }] },
      }),
      phys,
    )
    expect(tieneCodigo(v, 'rol-desconocido')).toBe(true)
  })

  it('un proceso sin ningún rol no entra', () => {
    expect(tieneCodigo(admit(p('sin-nada', { roles: [] }), phys), 'sin-roles')).toBe(true)
  })
})

describe('RECHAZOS CONFIRMADOS · cualidades y números', () => {
  it('una cualidad inventada no entra ni disfrazada de test de rol', () => {
    const v = admit(
      p('cualidad-magica', {
        roles: [{ name: 'a', where: [{ q: 'magia' as never, op: '>=', v: 1 }] }],
      }),
      phys,
    )
    expect(tieneCodigo(v, 'cualidad-fuera-del-catalogo')).toBe(true)
  })

  it('empujar fuera del rango declarado no entra', () => {
    const v = admit(
      p('horno-imposible', {
        effects: [
          {
            k: 'drive',
            q: 'temperature',
            on: 'a',
            toward: 5000,
            porSegundo: 120,
            poweredBy: { from: 'a', q: 'stamina', efficiency: 0.5 },
          },
        ],
      }),
      phys,
    )
    expect(tieneCodigo(v, 'fuera-de-rango')).toBe(true)
  })

  it('un NaN en una tasa no entra', () => {
    const v = admit(
      p('tasa-nan', { effects: [{ k: 'drain', q: 'stamina', on: 'a', porSegundo: Number.NaN }] }),
      phys,
    )
    expect(tieneCodigo(v, 'numero-no-finito')).toBe(true)
  })

  it('una tasa negativa —un drain que en realidad es un drive— no entra', () => {
    const v = admit(
      p('drain-al-reves', { effects: [{ k: 'drain', q: 'stamina', on: 'a', porSegundo: -100 }] }),
      phys,
    )
    expect(tieneCodigo(v, 'tasa-negativa')).toBe(true)
  })

  it('un completion más corto que el micro-segundo no entra', () => {
    // En ticks esto era «2,5 ticks no entra», porque medio tick no existía. En
    // segundos medio segundo sí existe —`extraccion` tarda 1,5— y lo que no
    // existe es una duración por debajo de la resolución del reloj del mundo.
    const v = admit(p('medio-micro', { completion: { at: seg(5e-7), yields: [] } }), phys)
    expect(tieneCodigo(v, 'completion-invalida')).toBe(true)
    // Y el control por el otro lado: 2,5 SEGUNDOS es una duración perfectamente
    // legal, y en ticks habría sido «2,5 ticks» y habría rebotado.
    const bien = admit(p('dos-y-medio', { completion: { at: seg(2.5), yields: [] } }), phys)
    expect(tieneCodigo(bien, 'completion-invalida')).toBe(false)
  })
})

describe('RECHAZOS CONFIRMADOS · materia', () => {
  it('subir una conservada no entra ni con poweredBy', () => {
    const v = admit(
      p('multiplicar-el-pan', {
        effects: [
          {
            k: 'drive',
            q: 'nutrition',
            on: 'a',
            toward: 100,
            porSegundo: 100,
            poweredBy: { from: 'a', q: 'stamina', efficiency: 0.5 },
          },
        ],
      }),
      phys,
    )
    expect(tieneCodigo(v, 'conservacion-drive')).toBe(true)
  })

  it('acoplar una conservada a otra cosa no entra', () => {
    const v = admit(
      p('nutricion-por-decreto', {
        roles: [
          { name: 'a', where: [] },
          { name: 'b', where: [] },
        ],
        effects: [{ k: 'couple', q: 'nutrition', on: 'a', follows: { q: 'digestibility', of: 'b' } }],
      }),
      phys,
    )
    expect(tieneCodigo(v, 'conservacion-couple')).toBe(true)
  })

  it('sacar del stock de un rol al que no se le pide masa no entra', () => {
    const v = admit(
      p('rio-de-la-nada', {
        roles: [{ name: 'source', where: [] }],
        completion: { at: seg(1.5), yields: [{ k: 'drawFromStock', of: 'source', into: 'hands' }] },
      }),
      phys,
    )
    expect(tieneCodigo(v, 'materia-sin-origen')).toBe(true)
  })

  it('mover nutrición desde un rol que no la garantiza no entra', () => {
    const v = admit(
      p('bomba-de-nutricion', {
        roles: [
          { name: 'piedra', where: [{ q: 'rigidity', op: '>=', v: 0.9 }] },
          { name: 'b', where: [] },
        ],
        effects: [{ k: 'transfer', q: 'nutrition', from: 'piedra', to: 'b', porSegundo: 60 }],
      }),
      phys,
    )
    expect(tieneCodigo(v, 'conservacion-transfer')).toBe(true)
  })

  it('un rol que ninguna sustancia del catálogo puede llenar no entra', () => {
    const v = admit(
      p('rol-imposible', {
        roles: [
          {
            name: 'a',
            where: [
              { q: 'rigidity', op: '>=', v: 0.95 },
              { q: 'flexibility', op: '>=', v: 0.95 },
            ],
          },
        ],
      }),
      phys,
    )
    expect(tieneCodigo(v, 'rol-irrealizable')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SEGUNDA MITAD — LOS ONCE QUE SE COLABAN, Y CON QUÉ SE LOS PARA AHORA.
// ═══════════════════════════════════════════════════════════════════════════

interface Hueco {
  /** Qué se colaba, en una línea. */
  nombre: string
  /** Por qué produciría conducta absurda en el mundo. */
  porque: string
  proceso: Process
  /** El código con el que la puerta lo rechaza desde la reparación. */
  codigo: Codigo
}

const HUECOS: readonly Hueco[] = [
  {
    nombre: 'un `couple` sube una cualidad sin poweredBy: la regla 2 solo mira los `drive`',
    codigo: 'sube-gratis',
    porque:
      'la temperatura de «a» pasa a seguir el punto de pirólisis de «b» y el cuerpo se prende ' +
      'solo, gratis, sin drenar ninguna cuenta conservada. Es «frotar produce calor infinito» ' +
      'otra vez, escrito con otro `k`. `reglaNadaSubeGratis` arranca con `if (e.k !== "drive") ' +
      'continue`, así que ningún couple paga nada nunca.',
    proceso: p('prender-por-acople', {
      roles: [
        { name: 'a', where: [] },
        { name: 'b', where: [] },
      ],
      effects: [{ k: 'couple', q: 'temperature', on: 'a', follows: { q: 'pyrolysisAt', of: 'b' } }],
    }),
  },
  {
    nombre: 'un `couple` con `inverse` es una bomba de calor: nadie mira ese campo',
    codigo: 'sube-gratis',
    porque:
      '«me caliento tanto como frío esté el otro» es un refrigerador que produce trabajo. ' +
      '`inverse` no aparece ni una vez en `admit.ts`: se declara y nadie lo lee.',
    proceso: p('bomba-de-calor', {
      roles: [
        { name: 'a', where: [] },
        { name: 'b', where: [] },
      ],
      effects: [
        { k: 'couple', q: 'temperature', on: 'a', follows: { q: 'temperature', of: 'b', inverse: true } },
      ],
    }),
  },
  {
    nombre: 'un `drive` escribe sobre una cualidad DERIVADA',
    codigo: 'cualidad-derivada',
    porque:
      '`reach` no se guarda: es `longestAxis` de la geometría del ensamble. Empujarla es ' +
      'escribirle a un campo calculado. O el mundo la ignora —y la criatura gasta aliento ' +
      'estirando el brazo sin que pase nada, el fallo silencioso que la regla 4 dice cazar— o ' +
      'la guarda, y entonces `reach` queda vieja y ya no la deriva nadie. Vale igual para ' +
      '`catch`, `emitsPower` y `portable`: se puede DECRETAR una fogata sin fuego.',
    proceso: p('estirar-el-brazo', {
      roles: [
        { name: 'gear', where: [] },
        { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
      ],
      effects: [
        {
          k: 'drive',
          q: 'reach',
          on: 'gear',
          toward: 16,
          porSegundo: 10,
          poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.5 },
        },
      ],
    }),
  },
  {
    nombre: 'la piedra-batería, que el comentario de `admit.ts` dice cerrar, con pedirle stamina al rol',
    codigo: 'fuente-sin-respaldo',
    porque:
      '`respalda()` acepta como garantía que el ROL PIDA la cualidad. `stamina` no la declara ' +
      'ninguna sustancia, así que `candidatasDeRol` no la mira y la realizabilidad tampoco: ' +
      'escribir `{ q: "stamina", op: ">=", v: 100 }` en el rol de una piedra alcanza para que ' +
      'el trabajo salga «pagado». El calor sale gratis con la declaración puesta, que es ' +
      'textualmente lo que el comentario de `fuente-sin-respaldo` promete impedir.',
    proceso: p('piedra-bateria', {
      roles: [
        {
          name: 'a',
          where: [
            { q: 'rigidity', op: '>=', v: 0.5 },
            { q: 'stamina', op: '>=', v: 100 },
          ],
        },
      ],
      effects: [
        {
          k: 'drive',
          q: 'temperature',
          on: 'a',
          toward: 400,
          porSegundo: 120,
          poweredBy: { from: 'a', q: 'stamina', efficiency: 1 },
        },
      ],
      establishes: ['temperature>=400'],
    }),
  },
  {
    nombre: 'pescar con la mano en un tick: `drawFromStock` sin pedir nada',
    codigo: 'dominancia',
    porque:
      '`extraccion` cuesta 30 ticks y exige `reach >= 2` y `catch > 0` —o sea, haber ' +
      'aprendido a atar una caña—. Este clon saca del mismo stock en UN tick, sin gear, sin ' +
      'aliento y sin completar nada. La regla 1 se conforma con que el rol pida `mass > 0` y ' +
      'la regla 5 solo ADVIERTE los ciclos con aporte del dios. El hambre deja de doler en el ' +
      'tick 2 y con ella se va el motor de toda la historia.',
    proceso: p('pescar-con-la-mano', {
      roles: [{ name: 'source', where: [{ q: 'mass', op: '>', v: 0 }] }],
      arrangement: { k: 'within', radius: 1 },
      completion: { at: seg(0.05), yields: [{ k: 'drawFromStock', of: 'source', into: 'hands' }] },
    }),
  },
  {
    nombre: 'la no-dominancia se esquiva declarando un rol de más que no hace nada',
    codigo: 'dominancia',
    porque:
      '`exigeMenosOIgual` arranca comparando la CANTIDAD de roles y se rinde si difiere. Un ' +
      'rol «testigo» con `where: []` —que no pide nada, no se usa en ningún efecto y no se ' +
      'consume— hace que el clon barato de `friccion` deje de ser comparable. Misma técnica, ' +
      'eficiencia 0.35 → 0.99, admitida. La regla 4 es «la última puerta del almuerzo gratis» ' +
      'y se abre con una línea.',
    proceso: p('frotar-con-testigo', {
      roles: [...FRICCION.roles, { name: 'testigo', where: [] }],
      effects: [
        {
          k: 'drive',
          q: 'temperature',
          on: 'a',
          toward: 400,
          porSegundo: 120,
          poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.99 },
        },
      ],
      establishes: [...FRICCION.establishes],
    }),
  },
  {
    nombre: '`establishes` miente y nadie lo cruza contra los efectos',
    codigo: 'promesa-derivada',
    porque:
      'el proceso no tiene efectos ni rendimientos: no hace literalmente nada. Y promete filo, ' +
      'alcance y 1999 °C. `establishes` es lo que la fragua lee para PLANIFICAR, y además es lo ' +
      'que arma las aristas del grafo de la regla 5: una promesa falsa mueve a la criatura a ' +
      'ejecutar un no-op para conseguir algo que nunca va a tener, y le ensucia la búsqueda de ' +
      'ciclos a todos los demás.',
    proceso: p('el-charlatan', {
      establishes: ['sharpness>=1', 'reach>=16', 'temperature>=1999'],
    }),
  },
  {
    nombre: 'un `arrangement` imposible: radio negativo, infinito o NaN',
    codigo: 'numero-no-finito',
    porque:
      '`numerosDe()` recorre la compuerta, los roles, los efectos y el completion, y NO mira ' +
      '`arrangement.radius`. Es el único número del proceso que se escapa del control de ' +
      'finitud, justo el que decide a qué distancia pasan las cosas: acción a distancia ' +
      'infinita, o un radio NaN que hace que toda comparación de distancia dé falso y el ' +
      'proceso no se dispare jamás.',
    proceso: p('accion-a-distancia', {
      arrangement: { k: 'within', radius: Number.POSITIVE_INFINITY },
    }),
  },
  {
    nombre: 'una compuerta contradictoria: la puerta revisa los roles pero no el `gate`',
    codigo: 'compuerta-contradictoria',
    porque:
      'a los roles se les busca la contradicción interna (`rol-contradictorio`) y la ' +
      'realizabilidad contra el catálogo. Al `gate` solo se le miran los rangos. Este proceso ' +
      'pide temperatura ≥ 1500 y ≤ 0 a la vez: no se dispara nunca, y es exactamente el fallo ' +
      'SILENCIOSO que `rol-irrealizable` existe para evitar.',
    proceso: p('nunca-jamas', {
      gate: [
        { q: 'temperature', op: '>=', v: 1500 },
        { q: 'temperature', op: '<=', v: 0 },
      ],
    }),
  },
  {
    nombre: 'un proceso sin id y sin nombre entra: `sin-nombre` existe pero nunca se aplica',
    codigo: 'sin-nombre',
    porque:
      '`admitSubstance` rechaza una sustancia sin id y sin nombre. `admit` no hace ninguna de ' +
      'las dos cosas, con el mismo código de razón ya escrito y sin usar. Un proceso con ' +
      'id vacío es una entrada de mapa que nadie puede citar ni volver a admitir; su lexema ' +
      'vacío es lo que la criatura tendría que decir para nombrarlo.',
    proceso: p('', { lexeme: { nombre: '' } }),
  },
  {
    nombre: 'el modelo se autocertifica: `trust: "estable"` con `provenance.by: "modelo"`',
    codigo: 'confianza-autodeclarada',
    porque:
      'la confianza es lo que separa un borrador de una ley del mundo, y quien propone se la ' +
      'pone solo. Nada en la puerta cruza `provenance` con `trust`. Es el juez que la criatura ' +
      'no escribió, firmando lo que la criatura escribió.',
    proceso: p('me-declaro-estable', { trust: 'estable', provenance: { by: 'modelo' } }),
  },
]

describe('LOS ONCE QUE SE COLABAN · ahora la puerta los para', () => {
  for (const h of HUECOS) {
    it(`la puerta rechaza: ${h.nombre}`, () => {
      expect(admit(h.proceso, phys).ok).toBe(false)
    })

    it(`y lo dice con «${h.codigo}»: ${h.nombre}`, () => {
      // El código importa tanto como el rechazo: la fragua lee ESTO para
      // corregir. Un «no» sin motivo la manda a adivinar, y adivinar contra una
      // puerta es N viajes al modelo por un error que ya se conocía.
      const v = admit(h.proceso, phys)
      expect([h.nombre, tieneCodigo(v, h.codigo)]).toEqual([h.nombre, true])
      expect(codigos(v).length).toBeGreaterThan(0)
    })
  }
})

describe('el control del hueco de la no-dominancia', () => {
  it('sin el rol testigo, el mismo clon barato SÍ lo agarra la regla 4', () => {
    const clon = p('frotar-barato', {
      roles: [...FRICCION.roles],
      effects: [
        {
          k: 'drive',
          q: 'temperature',
          on: 'a',
          toward: 400,
          porSegundo: 120,
          poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.99 },
        },
      ],
      establishes: [...FRICCION.establishes],
    })
    expect(tieneCodigo(admit(clon, phys), 'dominancia')).toBe(true)
  })
})
