// ═══ EL VOCABULARIO ES DE ESTA PARTIDA, Y ESTABA ESCRITO A MANO ═════════════
//
// El Hito 9 dejó la costura hecha por un solo lado: la mente avisa cuando el
// plan no llega (`MenteOptions.costura`) y el aviso sale a propósito sin el
// vocabulario, porque la mente no tiene la física de esta partida. Faltaba el
// otro lado, y al ir a escribirlo apareció lo de abajo.
//
// ─── EL HALLAZGO ────────────────────────────────────────────────────────────
//
// El vocabulario no se armaba en ningún lado. Estaba escrito a mano en los tres
// demos del Hito 8, con seis nombres, contra los treinta que la física tiene. Y
// no es que dijera cosas de más —eso el encabezado de `Encargo` ya lo temía—:
// **escondía 24 de 30**, y entre las escondidas están `pescado` y `junco`, que
// son las dos que la historia de la caña usa.
//
// Le pedíamos al modelo una habilidad para pescar en un mundo donde le habíamos
// dicho que el pescado y el junco no existen.
//
// Este archivo mide eso y le pone el guardián que faltaba.

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics } from '@anima/physics'
import type { Substance } from '@anima/physics'
import { encargoDe, vocabularioDe } from '../src/costura.js'
import { textoDe } from '../src/encargo.js'
import type { PedidoDeLaMente } from '../src/costura.js'

/**
 * LA LISTA QUE ESTABA ESCRITA A MANO, copiada tal cual de los tres demos.
 *
 * Se deja acá para poder medir contra ella, y **no se importa del demo**: si el
 * demo se arregla —y se arregló—, la comparación tiene que seguir contando la
 * misma historia. Es un dato histórico, no una constante viva.
 */
const LA_QUE_ESTABA_A_MANO = ['madera', 'liana', 'carne', 'agua', 'piedra', 'hueso']

/** El pedido tal como sale de la mente, con la corrida ablacionada del Hito 9. */
const PEDIDO: PedidoDeLaMente = {
  gap: 'catch>0&reach>=2',
  meta: 'holding(tag:carnoso)',
  porQue: 'ningún esquema conocido establece «catch>0»; «reach>=2» sí tiene esquema, y por sí solo no alcanza',
  tick: 1,
}

describe('el vocabulario del encargo sale de la física, no de una constante', () => {
  it('EL HALLAZGO: la lista escrita a mano escondía 24 de las 30 sustancias, y dos son las de la caña', () => {
    const real = vocabularioDe(buildSeedPhysics())
    const inventadas = LA_QUE_ESTABA_A_MANO.filter((n) => !real.includes(n))
    const escondidas = real.filter((n) => !LA_QUE_ESTABA_A_MANO.includes(n))

    console.log(
      `\n─── LO QUE EL MODELO SABÍA QUE EXISTÍA, Y LO QUE EXISTE ───\n` +
        `  sustancias de esta física ..... ${String(real.length)}\n` +
        `  la lista escrita a mano ....... ${String(LA_QUE_ESTABA_A_MANO.length)}: ${LA_QUE_ESTABA_A_MANO.join(' · ')}\n` +
        `  inventadas (no existen) ....... ${inventadas.length === 0 ? 'ninguna' : inventadas.join(', ')}\n` +
        `  ESCONDIDAS .................... ${String(escondidas.length)} de ${String(real.length)} (${((escondidas.length / real.length) * 100).toFixed(0)}%)\n` +
        `  y entre ellas ................. ${escondidas.filter((n) => n === 'pescado' || n === 'junco').join(', ')}\n`,
    )

    // El error no era decir de más: era esconder. Que `inventadas` sea cero es lo
    // que hace que el diagnóstico sea ése y no el otro.
    expect(inventadas).toEqual([])
    expect(escondidas.length).toBeGreaterThan(20)
    // Las dos de la caña, nombradas: la caña es `madera+junco` y del pozo sale
    // `pescado`. Son las que vuelven todo el hallazgo concreto.
    expect(escondidas).toContain('pescado')
    expect(escondidas).toContain('junco')
  })

  it('EL CONTROL POSITIVO: otra física, otro vocabulario — no puede ser una lista fija', () => {
    // Sin esto, `vocabularioDe` podría devolver una constante y los dos tests de
    // arriba y de abajo saldrían verdes igual. Es el modo de falla que este
    // proyecto ya cazó siete veces.
    const inventadas: readonly Substance[] = [
      { id: 'vidrio', tags: ['mineral'], perUnitMass: {}, defaults: {} } as unknown as Substance,
      { id: 'niebla', tags: ['liquido'], perUnitMass: {}, defaults: {} } as unknown as Substance,
    ]
    const otra = vocabularioDe(buildSeedPhysics({ substances: inventadas }))
    const semilla = vocabularioDe(buildSeedPhysics())

    console.log(
      `\n─── EL CONTROL ───\n` +
        `  física de la semilla ... ${String(semilla.length)} nombres\n` +
        `  otra física ............ ${String(otra.length)} nombres: ${otra.join(' · ')}\n`,
    )

    expect(otra).toEqual(['vidrio', 'niebla'])
    expect(otra).not.toEqual(semilla)
    // Y el encargo que sale de ella tampoco nombra las de la semilla: la lista no
    // se cuela por ningún otro lado.
    expect(textoDe(encargoDe(PEDIDO, buildSeedPhysics({ substances: inventadas })))).not.toContain('madera')
  })

  it('el pedido de la mente entra entero: la firma, la meta y por dónde se cortó', () => {
    const e = encargoDe(PEDIDO, buildSeedPhysics())
    const t = textoDe(e)

    console.log(`\n─── EL ENCARGO QUE SALE DE UN GAP DE VERDAD ───\n${t}\n`)

    // Los tres contestan preguntas distintas y ninguno se deduce de los otros.
    expect(e.gap).toContain(PEDIDO.gap)
    expect(e.gap).toContain(PEDIDO.meta)
    expect(e.gap).toContain('planificador')
    // Y el vocabulario que viaja es el de verdad, con las dos que faltaban.
    expect(t).toContain('pescado')
    expect(t).toContain('junco')
    // La vuelta 1 no lleva `loQueFallo`: es un pedido nuevo, no una re-forja.
    expect(e.vuelta).toBe(1)
  });

  it('LO QUE NO ESTÁ MEDIDO, dicho acá: la prosa opcional va primero cuando está', () => {
    // ─── POR QUÉ ESTE CAMPO EXISTE ───────────────────────────────────────────
    //
    // La ÚNICA forma de pedido que se probó contra un modelo de verdad es la
    // prosa: «conseguir alimento de un cuerpo de agua», los tres demos del
    // Hito 8. Que una firma pelada como `catch>0&reach>=2` le alcance al modelo
    // no se midió, y medirlo cuesta plata. La firma va igual —es el dato exacto,
    // y sus cualidades son las que el modelo consulta con `ctx.q`— pero quien
    // tenga la prosa la pone adelante y no paga la apuesta.
    //
    // Este test NO afirma que la prosa funcione mejor. Afirma que se puede pasar.
    const conProsa = encargoDe(PEDIDO, buildSeedPhysics(), 'fabricar algo con qué enganchar desde lejos')
    expect(conProsa.gap.startsWith('fabricar algo con qué enganchar desde lejos')).toBe(true)
    // Y sin prosa arranca por la firma, sin inventar una traducción.
    expect(encargoDe(PEDIDO, buildSeedPhysics()).gap.startsWith(`«${PEDIDO.gap}»`)).toBe(true)
  })
})
