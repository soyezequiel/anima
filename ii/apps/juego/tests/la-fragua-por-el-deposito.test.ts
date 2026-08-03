// ─── LA MITAD DE LA FRAGUA QUE CORRE DONDE VIVE EL MUNDO ────────────────────
//
// El depósito hace lo caro y devuelve texto. Acá pasa lo que necesita el mundo
// delante —derivar el contrato, montar, juzgar— y sale un veredicto que
// `Ordenes` sabe leer.
//
// ─── LO QUE SE AFIRMA, Y ES LO QUE HACÍA QUE NO SIRVIERA ───────────────────
//
//   1. **el contrato sale del mundo de esta partida.** Es la pieza que faltaba:
//      sin contrato el juez contesta `injuzgable` y todo lo que el modelo escriba
//      se tira. Y el reparto entre precondición y promesa depende de qué tiene la
//      criatura EN LA MANO, así que dos partidas con el mismo hueco pueden pedir
//      cosas distintas — correctamente;
//   2. **no se paga el viaje si el hueco no da contrato.** Preguntar primero
//      serían 25 segundos y una consulta para llegar a la misma conclusión que se
//      saca gratis antes de salir;
//   3. **una habilidad que no hace nada NO se promueve.** Es el modo de falla
//      peligroso de todo el tramo: una fragua que aprueba al azar instala en el
//      catálogo de la partida y el planificador después elige eso.
//
// El depósito se falsifica con un `fetch` de mentira: del otro lado hay un
// `codex exec` que cuesta plata y medio minuto, y lo que se prueba acá es el
// camino, que es el mismo.

import { describe, expect, it, vi } from 'vitest'

import { PHYS, arrancar } from '../src/mundo.js'
import { forjarPorElDeposito } from '../src/forjar-por-el-deposito.js'

const QUIEN = 'ana'
const DONDE = 'http://localhost:5190'

/** El hueco real de la partida donde la criatura no pudo hacer fuego. */
const EL_HUECO = {
  gap: 'fuelEnergy>0&heatCapacity<=9&ignitionPoint<=400&moisture<0.45&rigidity>=0.5&tensile>=0.3',
  meta: 'emitsPower>0',
  porQue: 'ningún esquema conocido lo establece',
  tick: 170,
}

/**
 * UN MUNDO CON UNA VARA DE MADERA EN LA MANO.
 *
 * Es lo que la criatura tenía en la partida medida: cumple cinco de las seis
 * condiciones del hueco y falla la humedad. De ese reparto sale el contrato.
 */
function conUnaVaraEnLaMano(): ReturnType<typeof arrancar>['state'] {
  const { state } = arrancar(20260727n)
  const vara = [...state.bodies.entries()].find(
    ([, b]) => b.body.parts.some((p) => p.substance === 'madera') && b.body.form === 'vara',
  )
  if (vara === undefined) throw new Error('la semilla dejó de traer una vara de madera')
  const actor = state.actors.get(QUIEN)
  if (actor === undefined) throw new Error('no hay actor')
  const actors = new Map(state.actors)
  actors.set(QUIEN, { ...actor, holding: [vara[0]] })

  // ─── Y SE LA MOJA A MANO, que es la mitad del fixture ──────────────────────
  //
  // En el tick 0 la madera trae la humedad de su sustancia —0,25— y eso YA cumple
  // `moisture<0.45`: el contrato saldría `no-falta-nada` y el test mediría un
  // mundo donde el problema no existe. Los 0,60 son los de la partida de verdad,
  // y no son del material: los junta el cuerpo relajando hacia el ambiente de la
  // orilla, unos cinco mil ticks después. Es el estado exacto en el que la
  // criatura pidió ayuda.
  const bodies = new Map(state.bodies)
  const b = bodies.get(vara[0])
  if (b === undefined) throw new Error('la vara se fue del mapa')
  bodies.set(vara[0], { ...b, body: { ...b.body, state: { ...b.body.state, moisture: 0.6 } } })
  return { ...state, actors, bodies }
}

function laFragua(
  mundo: () => ReturnType<typeof arrancar>['state'],
  fetch: typeof globalThis.fetch,
): ReturnType<typeof forjarPorElDeposito> {
  return forjarPorElDeposito({
    donde: DONDE,
    phys: PHYS,
    quien: QUIEN,
    mundo,
    enCastellano: (f) => `en castellano: ${f}`,
    // POR PARÁMETRO Y NO CON `vi.stubGlobal`: el global es del PROCESO, y vitest
    // corre varios archivos en el mismo worker. Pisarlo hacía fallar al test del
    // inventario —que pide sprites— una corrida sí y una no, y aislado pasaba
    // siempre. Ver `OpcionesDeLaFragua.fetch`.
    fetch,
  })
}

/** Compila y no hace nada: el peor caso honesto de lo que un modelo escribe. */
const LA_QUE_NO_HACE_NADA = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secar = secar;
const skill_api_js_1 = require("../../src/skill-api.js");
function* secar(ctx) {
  ctx.phase('secar');
  return skill_api_js_1.done();
}
`

function contesta(cuerpo: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn(() =>
    Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(cuerpo) } as Response),
  ) as unknown as typeof globalThis.fetch
}

/** El que no tiene que sonar nunca: si suena, se pagó un viaje que no iba. */
const noDebeSonar = (): typeof globalThis.fetch =>
  vi.fn(() => {
    throw new Error('salió a preguntar y no debía')
  }) as unknown as typeof globalThis.fetch

describe('la fragua del juego', () => {
  it('NO PAGA EL VIAJE si el hueco no da un contrato juzgable', async () => {
    // Con la mano vacía no hay materia de la que partir, así que `bancoDe` no
    // tendría con qué armar el objetivo y todo terminaría en `injuzgable`.
    // Sacarlo acá ahorra la consulta entera.
    const espia = noDebeSonar()
    const { state } = arrancar(20260727n)
    const r = await laFragua(() => state, espia)(EL_HUECO)

    expect(espia, 'salió a preguntar sabiendo que iba a tirar la respuesta').not.toHaveBeenCalled()
    expect(r?.grado).toBe('injuzgable')
    expect(r?.porQue).toContain('nada en la mano')
  })

  it('EL CONTRATO SE DERIVA DE LO QUE TIENE EN LA MANO, y viaja en el pedido', async () => {
    const espia = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, forjadas: [] }) } as Response),
    )
    await laFragua(conUnaVaraEnLaMano, espia as unknown as typeof globalThis.fetch)(EL_HUECO)

    expect(espia).toHaveBeenCalledTimes(1)
    const cuerpo = JSON.parse(String((espia.mock.calls[0]?.[1] as RequestInit).body)) as {
      gap: string
      queVerificar: string[]
      enCastellano: string
    }
    // Lo que se le va a verificar es SÓLO lo que falta: la vara ya trae las otras
    // cinco. Sin esta línea el modelo inventa qué quiere decir «que sirva».
    expect(cuerpo.queVerificar).toEqual(['moisture < 0.45'])
    expect(cuerpo.gap).toBe(EL_HUECO.gap)
    expect(cuerpo.enCastellano, 'la prosa es la única forma medida contra un modelo').toContain('en castellano')
  })

  it('UNA HABILIDAD QUE NO HACE NADA NO SE PROMUEVE', async () => {
    // El modo de falla peligroso. Compila, corre, dice que llegó, y el mundo
    // quedó igual: si esto pasara, la fragua instalaría basura en el catálogo.
    const r = await laFragua(
      conUnaVaraEnLaMano,
      contesta({
        ok: true,
        forjadas: [{ nombre: 'secar', desenlace: 'limpia', codigo: '…', js: LA_QUE_NO_HACE_NADA, puntos: 1, conceptos: [] }],
      }),
    )(EL_HUECO)

    expect(r).toBeDefined()
    expect(r?.grado, `el juez la promovió: ${r?.porQue ?? ''}`).not.toBe('promueve')
    // Y no por no haberla podido correr: eso sería el arnés fallando, no ella.
    expect(r?.grado).not.toBe('injuzgable')
  })

  it('UNA CANDIDATA ROTA se cuenta con lo que le faltó al mundo', async () => {
    const r = await laFragua(
      conUnaVaraEnLaMano,
      contesta({ ok: true, forjadas: [{ nombre: 'secar', desenlace: 'rota', codigo: '…', js: '', puntos: 0, conceptos: ['secador'] }] }),
    )(EL_HUECO)
    expect(r?.grado).toBe('injuzgable')
    expect(r?.porQue).toContain('secador')
  })

  it('«NO ESCRIBIÓ NADA» ES `undefined`, que es distinto de un veredicto', async () => {
    expect(await laFragua(conUnaVaraEnLaMano, contesta({ ok: true, forjadas: [] }))(EL_HUECO)).toBeUndefined()
  })

  it('Y EL VIAJE QUE FALLA TIRA, para que la lámpara diga «se cortó»', async () => {
    // La misma distinción que el proveedor del chat: una cosa es que el modelo no
    // supo y otra que no llegamos a preguntarle. Hay una luz esperando cada una.
    const f = contesta({ ok: false, porque: 'no encontré el CLI de codex' }, 502)
    await expect(laFragua(conUnaVaraEnLaMano, f)(EL_HUECO)).rejects.toThrow(/codex/)
  })
})
