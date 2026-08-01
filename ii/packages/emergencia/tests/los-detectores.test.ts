// ─── EL TEST QUE DECIDE SI EL DETECTOR SIRVE ─────────────────────────────────
//
// Cada uno de los nueve tiene su POSITIVO ARMADO y su NEGATIVO ARMADO, y el
// negativo es la mitad que importa.
//
// ─── POR QUÉ, EN UNA LÍNEA QUE COSTÓ CARA ───────────────────────────────────
//
// Un detector que nadie hizo disparar a mano puede estar mirando el campo
// equivocado y va a medir cero para siempre. Y un cero que nadie pudo mover no es
// un resultado: es un detector roto haciéndose pasar por una criatura que no
// aprendió. Del otro lado, un detector que devuelve `true` siempre pasa el
// positivo con las mismas nueve luces verdes. Los dos modos de falla son
// invisibles con la mitad de este archivo; con las dos mitades, ninguno lo es.
//
// El negativo de cada uno es un mundo CASI IGUAL al positivo, y lo que cambia es
// exactamente la condición que la secuencia dice medir. No un mundo vacío: un
// mundo vacío prueba que el detector no dispara solo, que es mucho menos.
//
// ─── Y AL FINAL, UNA PARTIDA CORRIDA DE VERDAD ──────────────────────────────
//
// El último bloque no arma ningún estado: le pasa a la criatura dos varas y la
// deja frotar contra `stepWorld` cuarenta y ocho pasos, y le da al juez lo que el
// mundo devolvió. Es la prueba de que los eventos y los campos que los detectores
// leen son los que el motor escribe de verdad, y no los que este banco inventó.

import { describe, expect, it } from 'vitest'
import { qualityOf, unir } from '@anima/physics'
import type { Body } from '@anima/physics'
import { apply, stepWorld } from '@anima/world'
import type { Intent, RoleBinding, WorldBody, WorldState } from '@anima/world'

import { Detector, juzgar, resumir, SECUENCIAS, tabla } from '../src/index.js'
import type { FilaDelBanco, Muestra, NombreDeSecuencia, Resumen, Veredicto } from '../src/index.js'
import {
  actor,
  apoyadoEn,
  comio,
  criatura,
  cuerpo,
  EN,
  enElPiso,
  enLaMano,
  haciendo,
  mundo,
  nacio,
  partida,
  PHYS,
  proceso,
  puso,
  tapando,
} from './banco.js'
import type { Cuerpos, Paso } from './banco.js'

// ─── El instrumental ─────────────────────────────────────────────────────────

function vio(v: Veredicto, nombre: NombreDeSecuencia): boolean {
  for (const f of v.filas) if (f.nombre === nombre) return f.aparecio
  throw new Error(`el juez no conoce «${nombre}»`)
}

function situacionDe(v: Veredicto, nombre: NombreDeSecuencia): boolean {
  for (const f of v.filas) if (f.nombre === nombre) return f.situacion
  throw new Error(`el juez no conoce «${nombre}»`)
}

function evidenciaDe(v: Veredicto, nombre: NombreDeSecuencia): string {
  for (const f of v.filas) if (f.nombre === nombre) return f.evidencia ?? ''
  return ''
}

/** Juzga una partida armada y devuelve el veredicto. */
const juez = (pasos: readonly Paso[]): Veredicto => juzgar(partida(pasos))

/**
 * LA ASERCIÓN DOBLE, escrita una vez.
 *
 * Se afirma el par entero en un solo `expect` a propósito: `[true, false]` contra
 * `[positivo, negativo]` falla con los dos valores a la vista, así que un
 * detector que devuelve siempre lo mismo se lee de la salida sin abrir nada.
 */
function positivoYNegativo(
  nombre: NombreDeSecuencia,
  positivo: readonly Paso[],
  negativo: readonly Paso[],
): void {
  const p = juez(positivo)
  const n = juez(negativo)
  expect([vio(p, nombre), vio(n, nombre)], `${nombre}: [positivo, negativo]`).toEqual([true, false])
}

// ─── La lista, antes que nada ────────────────────────────────────────────────

describe('la lista está cerrada y es la del documento', () => {
  it('son NUEVE y los nombres son los de §4, letra por letra', () => {
    // Si alguien agrega, borra o renombra una entrada, este test lo dice. La lista
    // se congeló ANTES de que existiera la mente: si se pudiera ajustar después de
    // ver qué hace la criatura, el criterio mediría al que lo escribió.
    expect(SECUENCIAS.map((s) => s.nombre)).toEqual([
      'no-frotar-lo-que-no-alcanza-a-encender',
      'la-vara-mas-liviana-que-igual-cocina',
      'taparlo-con-lo-que-respira',
      'ponerle-punta-al-aparejo',
      'comerla-en-el-pico-de-calorias',
      'cocinar-el-lote-en-un-solo-fuego',
      'el-fardo-de-corteza',
      'el-leno-mas-grande-que-todavia-cocina',
      'la-piedra-primero-y-la-comida-encima',
    ])
  })

  it('cada una declara qué función del motor llama y qué la paga', () => {
    // La Regla 1 y la Regla 2, hechas dato y verificadas. Un detector sin `llama`
    // es un detector del que no se puede saber si transcribe; una secuencia sin
    // `paga` es coreografía.
    for (const s of SECUENCIAS) {
      expect([s.nombre, s.llama.length > 0, s.paga.length > 20]).toEqual([s.nombre, true, true])
      expect(s.llama, `${s.nombre} tiene que llamar a qualityOf`).toContain('qualityOf')
    }
  })

  it('y un mundo donde no pasa nada no dispara ninguna', () => {
    // El piso. No prueba gran cosa por sí solo —de ahí los nueve negativos de
    // abajo— pero un detector que dispara sobre una criatura parada al lado de un
    // palo no hace falta seguir mirándolo.
    const quieto: Paso[] = [
      { bodies: [enElPiso(criatura('ana'), EN(0, 0)), enElPiso(cuerpo('vara', 'madera', 0.4), EN(0, 0))], actors: [actor('ana')] },
      { bodies: [enElPiso(criatura('ana'), EN(0, 0)), enElPiso(cuerpo('vara', 'madera', 0.4), EN(0, 0))], actors: [actor('ana')] },
    ]
    expect(juez(quieto).aparecidas).toEqual([])
  })
})

// ─── 1 ───────────────────────────────────────────────────────────────────────

describe('1 · no-frotar-lo-que-no-alcanza-a-encender', () => {
  const ROLES: readonly RoleBinding[] = [
    { name: 'a', body: 'vara' },
    { name: 'actor', body: 'ana-cuerpo' },
    { name: 'b', body: 'vb' },
  ]
  const ROLES_DEL_LENO: readonly RoleBinding[] = [
    { name: 'a', body: 'leno' },
    { name: 'actor', body: 'ana-cuerpo' },
    { name: 'b', body: 'vb' },
  ]

  /**
   * `vara` y `vb` pesan lo mismo para que el único candidato ESTRICTAMENTE más
   * pesado sea el leño de 2 kg — que es el que `agua-dulce` siembra de sobra
   * (madera de 0,3 a 2,5 kg, `bioma.ts:295`) y el que no se puede encender jamás.
   */
  const escena = (tVara: number, doing?: readonly RoleBinding[], eventos: readonly ReturnType<typeof proceso>[] = []): Paso => ({
    bodies: [
      enElPiso(criatura('ana'), EN(0, 0)),
      enLaMano(cuerpo('vara', 'madera', 0.4, { temperature: tVara }), EN(0, 0), 'ana'),
      enLaMano(cuerpo('vb', 'madera', 0.4, { temperature: 15 }), EN(0, 0), 'ana'),
      enElPiso(cuerpo('leno', 'madera', 2, { temperature: 15 }), EN(0, 0)),
    ],
    actors: [actor('ana', doing === undefined ? {} : { doing: haciendo('friccion', doing) })],
    events: eventos,
  })

  const POSITIVO: Paso[] = [
    escena(15),
    escena(15, ROLES, [proceso('ana', 'friccion')]),
    escena(700, ROLES, [proceso('ana', 'friccion')]),
  ]

  it('POSITIVO · frotó la vara de 0,4, prendió, y el leño de 2 kg quedó sin tocar', () => {
    const v = juez(POSITIVO)
    expect(vio(v, 'no-frotar-lo-que-no-alcanza-a-encender')).toBe(true)
    expect(evidenciaDe(v, 'no-frotar-lo-que-no-alcanza-a-encender')).toContain('2.0000 kg')
  })

  it('NEGATIVO · si DESPUÉS frota también el leño, no se negó a nada: postergó', () => {
    // El mundo es idéntico y lo único que cambia es que el candidato pesado deja
    // de estar sin tocar. Es la diferencia entre presupuestar y demorar.
    const conElLeno: Paso[] = [
      ...POSITIVO,
      escena(700, ROLES_DEL_LENO, [proceso('ana', 'friccion')]),
      {
        bodies: [
          enElPiso(criatura('ana'), EN(0, 0)),
          enLaMano(cuerpo('vara', 'madera', 0.4, { temperature: 700 }), EN(0, 0), 'ana'),
          enLaMano(cuerpo('vb', 'madera', 0.4, { temperature: 15 }), EN(0, 0), 'ana'),
          enElPiso(cuerpo('leno', 'madera', 2, { temperature: 700 }), EN(0, 0)),
        ],
        actors: [actor('ana', { doing: haciendo('friccion', ROLES_DEL_LENO) })],
        events: [proceso('ana', 'friccion')],
      },
    ]
    positivoYNegativo('no-frotar-lo-que-no-alcanza-a-encender', POSITIVO, conElLeno)
  })

  it('NEGATIVO · y si la fricción NO llegó a la ignición, tampoco: eso es vaciar el tanque', () => {
    // «TODAS terminaron en ignición». Una vara que se quedó fría es exactamente lo
    // que `frotar` hace hoy —`while (ctx.self.stamina > piso)`, sin guarda de
    // presupuesto— y no es la secuencia: es su contrario.
    const sinPrender: Paso[] = [escena(15), escena(15, ROLES, [proceso('ana', 'friccion')]), escena(180, ROLES, [proceso('ana', 'friccion')])]
    positivoYNegativo('no-frotar-lo-que-no-alcanza-a-encender', POSITIVO, sinPrender)
  })

  it('y el contra-detector ve la trampa: había un candidato arriba de 0,72 kg', () => {
    expect(situacionDe(juez(POSITIVO), 'no-frotar-lo-que-no-alcanza-a-encender')).toBe(true)
  })
})

// ─── 2 ───────────────────────────────────────────────────────────────────────

describe('2 · la-vara-mas-liviana-que-igual-cocina', () => {
  const roles = (a: string): readonly RoleBinding[] => [
    { name: 'a', body: a },
    { name: 'actor', body: 'ana-cuerpo' },
    { name: 'b', body: 'vb' },
  ]

  const escena = (
    elegida: string,
    tElegida: number,
    tPez: number,
    doing: readonly RoleBinding[] | undefined,
    eventos: readonly ReturnType<typeof proceso>[] = [],
  ): Paso => ({
    bodies: [
      enElPiso(criatura('ana'), EN(0, 0)),
      enElPiso(cuerpo('chica', 'madera', 0.2, { temperature: elegida === 'chica' ? tElegida : 15 }), EN(0, 0)),
      enElPiso(cuerpo('justa', 'madera', 0.5, { temperature: elegida === 'justa' ? tElegida : 15 }), EN(0, 0)),
      enElPiso(cuerpo('vb', 'madera', 0.5, { temperature: 15 }), EN(0, 0)),
      enElPiso(cuerpo('pez', 'pescado', 2, { temperature: tPez }), EN(0, 0)),
    ],
    actors: [actor('ana', doing === undefined ? {} : { doing: haciendo('friccion', doing) })],
    events: eventos,
  })

  const guion = (elegida: string): Paso[] => [
    escena(elegida, 15, 15, undefined),
    escena(elegida, 15, 15, roles(elegida), [proceso('ana', 'friccion')]),
    escena(elegida, 700, 15, roles(elegida), [proceso('ana', 'friccion')]),
    escena(elegida, 700, 100, undefined),
  ]

  it('POSITIVO · se salteó la de 0,2 kg, eligió la de 0,5, prendió y cocinó', () => {
    const v = juez(guion('justa'))
    expect(vio(v, 'la-vara-mas-liviana-que-igual-cocina')).toBe(true)
    // §4, nota de la tanda tres: el informe TIENE que publicar la masa elegida,
    // porque 0,47 y 0,66 miden dos cosas distintas.
    expect(evidenciaDe(v, 'la-vara-mas-liviana-que-igual-cocina')).toContain('0.5000 kg')
  })

  it('NEGATIVO · si eligió la MÁS LIVIANA de las que había, no eligió nada', () => {
    positivoYNegativo('la-vara-mas-liviana-que-igual-cocina', guion('justa'), guion('chica'))
  })

  it('NEGATIVO · y si prendió pero nunca se cocinó nada, tampoco: eso es fuego y no cocina', () => {
    const sinCocinar = guion('justa').map((p, i) => (i === 3 ? { ...p, bodies: guion('justa')[2]?.bodies ?? [] } : p))
    expect(vio(juez(sinCocinar), 'la-vara-mas-liviana-que-igual-cocina')).toBe(false)
  })
})

// ─── 3 ───────────────────────────────────────────────────────────────────────

describe('3 · taparlo-con-lo-que-respira', () => {
  /**
   * Dos fuegos y un solo trapo. `f1` está en (0,0) con la criatura y `f2` a cinco
   * celdas — lejos, para que el `covering` no pueda confundirse de dueño.
   */
  const escena = (f1: number, f2: number, conTapa: boolean, tPez: number): Cuerpos => [
    enElPiso(criatura('ana'), EN(0, 0)),
    enElPiso(cuerpo('f1', 'madera', 0.5, { temperature: f1 }), EN(0, 0)),
    conTapa
      ? tapando(cuerpo('tapa', 'junco', 0.2, { temperature: 15 }), EN(0, 0), 'f1')
      : enElPiso(cuerpo('tapa', 'junco', 0.2, { temperature: 15 }), EN(0, 0)),
    enElPiso(cuerpo('f2', 'madera', 0.5, { temperature: f2 }), EN(5, 5)),
    enElPiso(cuerpo('pez', 'pescado', 2, { temperature: tPez }), EN(0, 0)),
  ]

  const guion = (ticksF1: number, ticksF2: number, conPuso = true): Paso[] => {
    const pasos: Paso[] = [{ bodies: escena(15, 15, false, 15), actors: [actor('ana')] }]
    const maximo = Math.max(ticksF1, ticksF2)
    for (let t = 1; t <= maximo; t += 1) {
      pasos.push({
        bodies: escena(t <= ticksF1 ? 600 : 15, t <= ticksF2 ? 600 : 15, true, 100),
        actors: [actor('ana')],
        events: t === 1 && conPuso ? [puso('ana', 'tapa', EN(0, 0))] : [],
      })
    }
    pasos.push({ bodies: escena(15, 15, true, 15), actors: [actor('ana')] })
    return pasos
  }

  const POSITIVO = guion(5, 2)

  it('POSITIVO · el fuego tapado ardió 5 ticks contra los 2 del que estaba al aire', () => {
    const v = juez(POSITIVO)
    expect(vio(v, 'taparlo-con-lo-que-respira')).toBe(true)
    expect(evidenciaDe(v, 'taparlo-con-lo-que-respira')).toContain('contra 2')
  })

  it('NEGATIVO · si el tapado dura MENOS que el que está al aire, taparlo no compró nada', () => {
    positivoYNegativo('taparlo-con-lo-que-respira', POSITIVO, guion(2, 5))
  })

  it('y la tapa cuenta DESDE EL TICK DEL `puso`, no desde el siguiente', () => {
    // El `covering` que hay que mirar está en el estado del MISMO tick que el
    // evento, porque el estado es el de después. Anotar el `puso` al final del
    // tick le daba a la tapa un tick de retraso —justo el primero— y un fuego que
    // ardiera un solo tick tapado quedaba clasificado como fuego al aire.
    const d = new Detector()
    d.observarTodo(partida(guion(1, 0)))
    const f1 = d.cronica.fuegos.get('f1')
    expect([f1?.rachaMaxima, f1?.tapadoAlgunaVez]).toEqual([1, true])
  })

  it('NEGATIVO · y sin un `puso` que lo explique, el `covering` no es de nadie', () => {
    // La Regla 6 con la puerta cerrada por los dos lados. `covering` sólo lo
    // escribe `intencionPoner` (`step.ts:1828`), pero el detector pide ADEMÁS el
    // evento: un `covering` que apareció en el estado inicial no es una conducta.
    positivoYNegativo('taparlo-con-lo-que-respira', POSITIVO, guion(5, 2, false))
  })

  it('NEGATIVO · y el nuevo: un leño GRANDE tapado no le gana a una ramita al aire', () => {
    // ─── POR QUÉ EL TESTIGO TIENE QUE PESAR LO MISMO ─────────────────────────
    //
    // Medido corriendo el mundo: la duración es EXACTAMENTE lineal en la masa
    // —0,2 kg → 199 ticks, 0,5 → 499, 1,5 → 1499, 2,5 → 2500—. Un leño de 2,5 kg
    // tapado con MADERA (permeabilidad 0,12, la fila que la tabla del documento
    // marca «CRUDO, ni se movió») le ganaba a una ramita de 0,2 kg al aire y el
    // juez firmaba `taparlo-con-lo-que-RESPIRA` sobre lo que la ahoga. Acá el
    // único fuego sin tapar pesa otra cosa, así que no hay testigo y no hay nada
    // que afirmar: es la diferencia entre medir la tapa y medir la masa.
    const desigual = (t: number): Paso => ({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enElPiso(cuerpo('grande', 'madera', 2.5, { temperature: 600 }), EN(0, 0)),
        tapando(cuerpo('tabla', 'madera', 0.3, { temperature: 15 }), EN(0, 0), 'grande'),
        enElPiso(cuerpo('ramita', 'madera', 0.2, { temperature: t >= 3 ? 15 : 600 }), EN(5, 5)),
        enElPiso(cuerpo('pez', 'pescado', 2, { temperature: 100 }), EN(0, 0)),
      ],
      actors: [actor('ana')],
      events: t === 0 ? [puso('ana', 'tabla', EN(0, 0))] : [],
    })
    positivoYNegativo('taparlo-con-lo-que-respira', POSITIVO, [0, 1, 2, 3, 4, 5, 6].map(desigual))
  })

  it('NEGATIVO · y la cocción de OTRO fuego, a diez celdas, no la acredita el tapado', () => {
    // `coccionMientrasTapado` se prendía con «hubo alguna pieza en ventana en el
    // mundo», sin mirar dónde. Acá la única pieza que se cocina está a diez celdas
    // del fuego tapado y sobre el otro: el tapado no cocinó nada.
    const lejos = (t: number): Paso => ({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enElPiso(cuerpo('f1', 'madera', 0.5, { temperature: t <= 5 ? 600 : 15 }), EN(0, 0)),
        tapando(cuerpo('tapa', 'junco', 0.2, { temperature: 15 }), EN(0, 0), 'f1'),
        enElPiso(cuerpo('f2', 'madera', 0.5, { temperature: t <= 2 ? 600 : 15 }), EN(10, 10)),
        enElPiso(cuerpo('pez', 'pescado', 2, { temperature: 100 }), EN(10, 10)),
      ],
      actors: [actor('ana')],
      events: t === 1 ? [puso('ana', 'tapa', EN(0, 0))] : [],
    })
    positivoYNegativo('taparlo-con-lo-que-respira', POSITIVO, [0, 1, 2, 3, 4, 5, 6].map(lejos))
  })

  /**
   * HUECO ABIERTO · si en una partida TODO fuego estuvo tapado, la fila sale
   * «no apareció» cuando lo correcto es «no medida».
   *
   * ─── POR QUÉ SIGUE ABIERTO, y por qué no lo arreglo acá ────────────────────
   *
   * El detector es el del documento, letra por letra: «dispara si hubo un fuego
   * tapado que ardió MÁS TICKS QUE EL FUEGO MÁS LARGO SIN TAPAR DE LA MISMA
   * PARTIDA». Si no hubo ninguno sin tapar, el patrón de comparación no existe y
   * el detector no puede afirmar nada — y el `?? 0` que lo haría disparar igual
   * sería peor: cualquier fuego tapado pasaría.
   *
   * Hasta ahí es correcto. Lo que está mal es la LECTURA: el contra-detector de
   * esta entrada es «hubo un fuego y ≥ 2 permeabilidades distintas a mano», que
   * en esta partida es verdadero, así que la fila sale con `situacion: true` y el
   * cero se lee como AUSENCIA. Y no lo es: es una partida en la que el detector
   * no tenía con qué medir.
   *
   * MEDIDO acá abajo: dos fuegos, los dos tapados, uno de 5 ticks y otro de 2,
   * con un pescado en ventana todo el tiempo. El juez contesta
   * `[aparecio, situacion] = [false, true]`, y lo que corresponde es `[false,
   * false]` — o sea, «no medida».
   *
   * No se arregla porque arreglarlo es tocar un contra-detector de la lista
   * congelada, y §0 sólo deja tocar un ERROR DE DETECTOR —uno que reimplemente
   * una fórmula del motor— sin volver a correr todo. Éste no es de ésos: es una
   * condición que falta. Y el propio documento ya lo tenía anotado como lo que no
   * midió (§6.c): «qué pasa con un fuego SIN NADA QUE LO TAPE: el campamento del
   * banco siempre tiene algo tapando la vara, y no se escribió código para medir
   * el caso desnudo». El arreglo es agregarle al contra-detector la condición
   * «hubo al menos un fuego sin tapar», y es una línea; lo que no es de una línea
   * es la decisión de mover la lista.
   */
  it.fails('SIGUE ABIERTO · con TODO fuego tapado, el cero se lee como ausencia y no lo es', () => {
    const todosTapados: Paso[] = [
      { bodies: escena(15, 15, false, 15), actors: [actor('ana')] },
      ...[1, 2, 3, 4, 5].map((t) => ({
        bodies: [
          ...escena(600, t <= 2 ? 600 : 15, true, 100),
          tapando(cuerpo('tapa2', 'junco', 0.2, { temperature: 15 }), EN(5, 5), 'f2'),
        ],
        actors: [actor('ana')],
        events: t === 1 ? [puso('ana', 'tapa', EN(0, 0)), puso('ana', 'tapa2', EN(5, 5))] : [],
      })),
    ]
    const v = juez(todosTapados)
    expect([vio(v, 'taparlo-con-lo-que-respira'), situacionDe(v, 'taparlo-con-lo-que-respira')]).toEqual([false, false])
  })
})

// ─── 4 ───────────────────────────────────────────────────────────────────────

describe('4 · ponerle-punta-al-aparejo', () => {
  const vara = cuerpo('vara', 'madera', 1)
  const h1 = cuerpo('h1', 'liana', 0.2)
  const h2 = cuerpo('h2', 'liana', 0.2)
  const lasca = cuerpo('lasca', 'pedernal', 0.1)
  const palo = cuerpo('palo', 'madera', 1)
  const banco = cuerpo('banco', 'pescado', 20)

  const atar = (a: Body, b: Body | undefined, binder: Body, id: string): Body => {
    const r = unir(a, b, binder, PHYS, id)
    if (r === undefined) throw new Error(`no se pudo atar ${id}`)
    return r
  }
  const cana = atar(vara, undefined, h1, 'cana')
  const anzuelo = atar(cana, lasca, h2, 'anzuelo')
  const romo = atar(cana, palo, h2, 'romo')

  it('el banco mide lo que el documento dice: 0,15 pelada contra 0,575 con filo', () => {
    // Si esto se moviera, los tres tests de abajo estarían midiendo otra cosa.
    expect([qualityOf(cana, 'catch', PHYS), qualityOf(anzuelo, 'catch', PHYS), qualityOf(romo, 'catch', PHYS)]).toEqual([0.15, 0.575, 0.15])
  })

  const ROLES_1: readonly RoleBinding[] = [{ name: 'a', body: 'vara' }, { name: 'binder', body: 'h1' }]
  const ROLES_2 = (b: string): readonly RoleBinding[] => [
    { name: 'a', body: 'cana' },
    { name: 'b', body: b },
    { name: 'binder', body: 'h2' },
  ]
  const ROLES_PESCA = (gear: string): readonly RoleBinding[] => [
    { name: 'gear', body: gear },
    { name: 'source', body: 'banco' },
  ]

  const piso = (cuerpos: readonly Body[]): Cuerpos => [
    enElPiso(criatura('ana'), EN(0, 0)),
    enElPiso(banco, EN(0, 0)),
    ...cuerpos.map((b) => enLaMano(b, EN(0, 0), 'ana')),
  ]

  /** Una unión completa: un tick con la actividad y otro con el rendimiento. */
  const unir2 = (
    antes: readonly Body[],
    despues: readonly Body[],
    roles: readonly RoleBinding[],
    id: string,
  ): Paso[] => [
    { bodies: piso(antes), actors: [actor('ana', { doing: haciendo('union', roles, 0.95) })], events: [proceso('ana', 'union')] },
    { bodies: piso(despues), actors: [actor('ana')], events: [nacio('ana', id), proceso('ana', 'union', true)] },
  ]

  const pescar = (gear: Body): Paso[] => [
    {
      bodies: piso([gear]),
      actors: [actor('ana', { doing: haciendo('extraccion', ROLES_PESCA(gear.id), 1.45) })],
      events: [proceso('ana', 'extraccion')],
    },
    {
      bodies: [...piso([gear]), enLaMano(cuerpo('pez1', 'pescado', 2), EN(0, 0), 'ana')],
      actors: [actor('ana')],
      events: [nacio('ana', 'pez1'), proceso('ana', 'extraccion', true)],
    },
  ]

  const POSITIVO: Paso[] = [
    { bodies: piso([vara, h1, h2, lasca]), actors: [actor('ana')] },
    ...unir2([vara, h1, h2, lasca], [cana, h2, lasca], ROLES_1, 'cana'),
    ...unir2([cana, h2, lasca], [anzuelo], ROLES_2('lasca'), 'anzuelo'),
    ...pescar(anzuelo),
  ]

  it('POSITIVO · dos uniones encadenadas, la segunda con filo, y después pescó', () => {
    const v = juez(POSITIVO)
    expect(vio(v, 'ponerle-punta-al-aparejo')).toBe(true)
    expect(evidenciaDe(v, 'ponerle-punta-al-aparejo')).toContain('0.5750')
  })

  it('NEGATIVO · UNA sola unión es armar una caña, no ponerle punta', () => {
    const unaSola: Paso[] = [
      { bodies: piso([vara, h1]), actors: [actor('ana')] },
      ...unir2([vara, h1], [cana], ROLES_1, 'cana'),
      ...pescar(cana),
    ]
    positivoYNegativo('ponerle-punta-al-aparejo', POSITIVO, unaSola)
  })

  it('NEGATIVO · y dos uniones sin filo dejan el `catch` donde estaba: 0,15 contra 0,15', () => {
    // El mundo es el mismo salvo que la segunda unión ata un palo en vez de una
    // lasca. Sin filo, `maxParts(sharpness)` no se mueve y el `catch` tampoco: la
    // secuencia no es «atar dos veces», es «atar dos veces y que sirva».
    const sinFilo: Paso[] = [
      { bodies: piso([vara, h1, h2, palo]), actors: [actor('ana')] },
      ...unir2([vara, h1, h2, palo], [cana, h2, palo], ROLES_1, 'cana'),
      ...unir2([cana, h2, palo], [romo], ROLES_2('palo'), 'romo'),
      ...pescar(romo),
    ]
    positivoYNegativo('ponerle-punta-al-aparejo', POSITIVO, sinFilo)
  })

  it('NEGATIVO · y un aparejo que nunca rindió una pieza no cuenta', () => {
    const sinPescar: Paso[] = [
      { bodies: piso([vara, h1, h2, lasca]), actors: [actor('ana')] },
      ...unir2([vara, h1, h2, lasca], [cana, h2, lasca], ROLES_1, 'cana'),
      ...unir2([cana, h2, lasca], [anzuelo], ROLES_2('lasca'), 'anzuelo'),
    ]
    positivoYNegativo('ponerle-punta-al-aparejo', POSITIVO, sinPescar)
  })

  it('y el contra-detector cuenta el filo, que es el riesgo declarado de esta entrada', () => {
    // §4 entrada 4: el pedernal se siembra en estepa, roquedal y arenal, y el
    // pescado está en `agua-dulce` y `pantano`. El filo no está donde está la
    // comida, y si no lo hubo la entrada se reporta NO MEDIDA y no como ausencia.
    const conFilo = juez(POSITIVO)
    const sinFilo = juez([{ bodies: [enElPiso(criatura('ana'), EN(0, 0))], actors: [actor('ana')] }])
    expect([situacionDe(conFilo, 'ponerle-punta-al-aparejo'), situacionDe(sinFilo, 'ponerle-punta-al-aparejo')]).toEqual([true, false])
  })
})

// ─── 5 ───────────────────────────────────────────────────────────────────────

describe('5 · comerla-en-el-pico-de-calorias', () => {
  const pez = (t: number, digestibility: number, nutrition?: number): Cuerpos => [
    enElPiso(criatura('ana'), EN(0, 0)),
    enElPiso(
      cuerpo(
        'pez',
        'pescado',
        2,
        nutrition === undefined
          ? { temperature: t, digestibility }
          : { temperature: t, digestibility, nutrition },
      ),
      EN(0, 0),
    ),
  ]
  const sinPez: Cuerpos = [enElPiso(criatura('ana'), EN(0, 0))]

  const POSITIVO: Paso[] = [
    { bodies: pez(15, 0.38), actors: [actor('ana')] },
    { bodies: pez(100, 0.6), actors: [actor('ana')] },
    { bodies: pez(100, 0.9), actors: [actor('ana')] },
    { bodies: sinPez, actors: [actor('ana')], events: [comio('ana', 'pez', 14.0)] },
  ]

  it('POSITIVO · arrancó en 6,08 calorías, topó en 14,4 y se comió con 14,0', () => {
    const v = juez(POSITIVO)
    expect(vio(v, 'comerla-en-el-pico-de-calorias')).toBe(true)
    expect(evidenciaDe(v, 'comerla-en-el-pico-de-calorias')).toContain('14.4000')
  })

  it('NEGATIVO · si se fue tarde y la pieza perdió nutrición, no la comió en el pico', () => {
    // El otro lado del máximo interior: 80 s de más dejan `nutrition` en 0
    // (`physics/tests/tres-ejemplos.test.ts:332-338`). Acá baja a 2 y las calorías
    // caen a 3,6, o sea el 25% del pico.
    const tarde: Paso[] = [
      ...POSITIVO.slice(0, 3),
      { bodies: pez(100, 0.9, 2), actors: [actor('ana')] },
      { bodies: sinPez, actors: [actor('ana')], events: [comio('ana', 'pez', 3.6)] },
    ]
    positivoYNegativo('comerla-en-el-pico-de-calorias', POSITIVO, tarde)
  })

  it('NEGATIVO · y el nuevo: comerla CIEN TICKS después del máximo, con el 97% del pico', () => {
    // ─── POR QUÉ EL 90% NO ACOTA NADA, MEDIDO ────────────────────────────────
    //
    // Corrido con `stepWorld`: un pescado sobre la vara de 0,47 kg topa en 13,7459
    // calorías en el tick 129 y se queda por encima del 90% del máximo durante
    // 19.943 de 20.000 ticks. O sea que un umbral porcentual deja pasar «mil
    // segundos de mundo después del pico». Acá la pieza sube en 2 ticks y se come
    // en el 103: pasa el 90% de sobra y no es detenerse en ningún máximo.
    const tardisimo: Paso[] = [
      ...POSITIVO.slice(0, 3),
      ...Array.from({ length: 100 }, () => ({ bodies: pez(100, 0.9), actors: [actor('ana')] })),
      { bodies: sinPez, actors: [actor('ana')], events: [comio('ana', 'pez', 14.0)] },
    ]
    positivoYNegativo('comerla-en-el-pico-de-calorias', POSITIVO, tardisimo)
  })

  it('NEGATIVO · y comerse una pieza CRUDA que nunca subió tampoco es el pico', () => {
    // `max(c) > c[0]` es lo que atrapa esto: sin esa condición, cualquier bocado
    // pasaría el 90% por la puerta de atrás, porque el máximo de una constante es
    // ella misma.
    const cruda: Paso[] = [
      { bodies: pez(15, 0.38), actors: [actor('ana')] },
      { bodies: pez(100, 0.38), actors: [actor('ana')] },
      { bodies: sinPez, actors: [actor('ana')], events: [comio('ana', 'pez', 6.08)] },
    ]
    positivoYNegativo('comerla-en-el-pico-de-calorias', POSITIVO, cruda)
  })
})

// ─── 6 ───────────────────────────────────────────────────────────────────────

describe('6 · cocinar-el-lote-en-un-solo-fuego', () => {
  const escena = (fuego: number, cuantasEnVentana: number): Cuerpos => {
    const out: WorldBody[] = [
      enElPiso(criatura('ana'), EN(0, 0)),
      enElPiso(cuerpo('f', 'madera', 0.5, { temperature: fuego }), EN(0, 0)),
    ]
    for (let i = 1; i <= 4; i += 1) {
      out.push(enElPiso(cuerpo(`pez${String(i)}`, 'pescado', 2, { temperature: i <= cuantasEnVentana ? 100 : 15 }), EN(0, 0)))
    }
    return out
  }

  const guion = (cuantas: number): Paso[] => [
    { bodies: escena(15, 0), actors: [actor('ana')] },
    { bodies: escena(600, cuantas), actors: [actor('ana')] },
    { bodies: escena(600, cuantas), actors: [actor('ana')] },
    { bodies: escena(15, 0), actors: [actor('ana')] },
  ]

  it('POSITIVO · cuatro piezas distintas en cocción dentro del mismo intervalo de fuego', () => {
    const v = juez(guion(4))
    expect(vio(v, 'cocinar-el-lote-en-un-solo-fuego')).toBe(true)
    expect(evidenciaDe(v, 'cocinar-el-lote-en-un-solo-fuego')).toContain('4 piezas')
  })

  it('NEGATIVO · con tres no alcanza, y la ausencia es REAL: las cuatro estaban ahí', () => {
    positivoYNegativo('cocinar-el-lote-en-un-solo-fuego', guion(4), guion(3))
    // El contra-detector cuenta las piezas AL ALCANCE y no las cocidas, así que el
    // cero de arriba se lee como ausencia y no como no-medida. Es exactamente la
    // distinción de §10 y hay que poder mostrarla.
    expect(situacionDe(juez(guion(3)), 'cocinar-el-lote-en-un-solo-fuego')).toBe(true)
  })

  it('NEGATIVO · y el nuevo: DOS fuegos con dos piezas cada uno no son un lote', () => {
    // El costo fijo que esta secuencia dice amortizar es el de UN fuego —659,86 de
    // stamina—: dos fogatas son dos costos y no uno amortizado. Con el conteo por
    // intervalo global el juez firmaba «4 piezas distintas en cocción dentro del
    // intervalo de fuego» sobre dos fuegos a diez celdas de distancia.
    const dosFuegos = (): Paso => ({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enElPiso(cuerpo('f1', 'madera', 0.5, { temperature: 600 }), EN(0, 0)),
        enElPiso(cuerpo('p1', 'pescado', 2, { temperature: 100 }), EN(0, 0)),
        enElPiso(cuerpo('p2', 'pescado', 2, { temperature: 100 }), EN(1, 0)),
        enElPiso(cuerpo('f2', 'madera', 0.5, { temperature: 600 }), EN(10, 10)),
        enElPiso(cuerpo('p3', 'pescado', 2, { temperature: 100 }), EN(10, 10)),
        enElPiso(cuerpo('p4', 'pescado', 2, { temperature: 100 }), EN(11, 10)),
      ],
      actors: [actor('ana')],
    })
    positivoYNegativo('cocinar-el-lote-en-un-solo-fuego', guion(4), [dosFuegos(), dosFuegos(), dosFuegos()])
  })
})

// ─── 7 ───────────────────────────────────────────────────────────────────────

describe('7 · el-fardo-de-corteza', () => {
  const c1 = cuerpo('c1', 'corteza', 0.5, { temperature: 15 })
  const c2 = cuerpo('c2', 'corteza', 0.5, { temperature: 15 })
  const junco = cuerpo('junco', 'junco', 0.1, { temperature: 15 })
  const fardoDe = (t: number): Body => {
    const r = unir(
      cuerpo('c1', 'corteza', 0.5, { temperature: t }),
      cuerpo('c2', 'corteza', 0.5, { temperature: t }),
      junco,
      PHYS,
      'fardo',
    )
    if (r === undefined) throw new Error('no se pudo atar el fardo')
    return r
  }

  it('el banco mide lo que dice §2.3: una corteza no prende un leño y dos atadas sí', () => {
    // La Regla 7 en una línea de test. `emitsPower` de una corteza de 0,5 kg
    // ardiendo contra el de las dos atadas, preguntado al motor.
    const una = qualityOf(cuerpo('x', 'corteza', 0.5, { temperature: 600 }), 'emitsPower', PHYS)
    const dos = qualityOf(fardoDe(600), 'emitsPower', PHYS)
    expect([una, dos]).toEqual([133.6, 267.2])
  })

  const ROLES: readonly RoleBinding[] = [
    { name: 'a', body: 'c1' },
    { name: 'b', body: 'c2' },
    { name: 'binder', body: 'junco' },
  ]
  const sueltas: Cuerpos = [
    enElPiso(criatura('ana'), EN(0, 0)),
    enLaMano(c1, EN(0, 0), 'ana'),
    enLaMano(c2, EN(0, 0), 'ana'),
    enLaMano(junco, EN(0, 0), 'ana'),
    enElPiso(cuerpo('vara', 'madera', 0.7, { temperature: 15 }), EN(0, 0)),
  ]
  const conFardo = (t: number): Cuerpos => [
    enElPiso(criatura('ana'), EN(0, 0)),
    enLaMano(fardoDe(t), EN(0, 0), 'ana'),
    enElPiso(cuerpo('vara', 'madera', 0.7, { temperature: t === 600 ? 700 : 15 }), EN(0, 0)),
  ]

  const POSITIVO: Paso[] = [
    { bodies: sueltas, actors: [actor('ana')] },
    { bodies: sueltas, actors: [actor('ana', { doing: haciendo('union', ROLES, 0.95) })], events: [proceso('ana', 'union')] },
    { bodies: conFardo(15), actors: [actor('ana')], events: [nacio('ana', 'fardo'), proceso('ana', 'union', true)] },
    { bodies: conFardo(600), actors: [actor('ana')] },
  ]

  it('POSITIVO · un cuerpo atado que después ardió sin que nadie lo frotara', () => {
    const v = juez(POSITIVO)
    expect(vio(v, 'el-fardo-de-corteza')).toBe(true)
    expect(evidenciaDe(v, 'el-fardo-de-corteza')).toContain('267.20')
  })

  it('NEGATIVO · un fardo que nunca prendió es un fardo, no la cadena', () => {
    const frio: Paso[] = [...POSITIVO.slice(0, 3), { bodies: conFardo(15), actors: [actor('ana')] }]
    positivoYNegativo('el-fardo-de-corteza', POSITIVO, frio)
  })

  it('NEGATIVO · y si lo encendió FROTÁNDOLO, no se propagó nada: lo prendió la mano', () => {
    // La condición (a) del detector, que es la que hace que esto sea la cadena y
    // no otra fricción: el cuerpo tiene que haber ardido SIN haber sido nunca el
    // rol `a` de un `friccion`.
    const aMano: Paso[] = [
      ...POSITIVO.slice(0, 3),
      {
        bodies: conFardo(600),
        actors: [
          actor('ana', {
            doing: haciendo('friccion', [
              { name: 'a', body: 'fardo' },
              { name: 'actor', body: 'ana-cuerpo' },
            ]),
          }),
        ],
        events: [proceso('ana', 'friccion')],
      },
    ]
    positivoYNegativo('el-fardo-de-corteza', POSITIVO, aMano)
  })

  it('NEGATIVO · y el nuevo: un ensamble que NACIÓ ARDIENDO no se propagó, se renombró', () => {
    // ─── EL AGUJERO QUE MATABA EL HITO, hecho negativo ───────────────────────
    //
    // `unir` devuelve `state: { ...otro.state, ...a.state }`
    // (`physics/src/leyes.ts:1735`): el ensamble hereda la temperatura del cuerpo
    // `a`. Atar algo que YA ARDE devuelve un cuerpo ardiendo con un id nuevo, que
    // no está en `frotados` porque el que se frotó se llamaba de otra manera.
    // Corrido con `stepWorld` en `ataque-al-detector.test.ts`, el juez firmaba
    // «sin que nadie lo frotara nunca» sobre el fuego que la criatura había
    // encendido con las manos. Acá el fardo nace a 600 °C —340 por encima de los
    // 250 de la corteza— y no hay propagación que acreditar.
    const naceArdiendo: Paso[] = [
      { bodies: sueltas, actors: [actor('ana')] },
      { bodies: sueltas, actors: [actor('ana', { doing: haciendo('union', ROLES, 0.95) })], events: [proceso('ana', 'union')] },
      { bodies: conFardo(600), actors: [actor('ana')], events: [nacio('ana', 'fardo'), proceso('ana', 'union', true)] },
      { bodies: conFardo(600), actors: [actor('ana')] },
    ]
    positivoYNegativo('el-fardo-de-corteza', POSITIVO, naceArdiendo)
  })

  it('y el contra-detector NO suma masas a mano: llama a `unir` y pesa el ensamble', () => {
    // La Regla 7 hecha código. Con UNA corteza el mundo no ofrecía el problema
    // —0,5 kg no prenden nada— y con dos sí, sin que el juez sume nada.
    const conDos = juez(POSITIVO)
    const conUna: Paso[] = [
      {
        bodies: [
          enElPiso(criatura('ana'), EN(0, 0)),
          enLaMano(c1, EN(0, 0), 'ana'),
          enLaMano(junco, EN(0, 0), 'ana'),
          enElPiso(cuerpo('vara', 'madera', 0.7, { temperature: 15 }), EN(0, 0)),
        ],
        actors: [actor('ana')],
      },
    ]
    expect([
      situacionDe(conDos, 'el-fardo-de-corteza'),
      situacionDe(juez(conUna), 'el-fardo-de-corteza'),
    ]).toEqual([true, false])
  })

  it('y elige la MEJOR vara encendible, no la primera del mapa', () => {
    // Una piedra cumple el rol `a` de `friccion` —`rigidity` 0,95— y no tiene
    // `fuelEnergy`: frotarla no entrega nada. Con la piedra llamándose «aa» y la
    // vara «zz», tomar «la primera que cumple el rol» contestaba que el mundo NO
    // ofrecía la cadena, cuando la ofrecía entera. El contra-detector no puede
    // depender del orden alfabético de los ids.
    const conPiedraPrimero: Paso[] = [
      {
        bodies: [
          enElPiso(criatura('ana'), EN(0, 0)),
          enElPiso(cuerpo('aa-piedra', 'piedra', 0.5), EN(0, 0)),
          enLaMano(cuerpo('c1', 'corteza', 0.5, { temperature: 15 }), EN(0, 0), 'ana'),
          enLaMano(cuerpo('c2', 'corteza', 0.5, { temperature: 15 }), EN(0, 0), 'ana'),
          enLaMano(cuerpo('junco', 'junco', 0.1, { temperature: 15 }), EN(0, 0), 'ana'),
          enElPiso(cuerpo('zz-vara', 'madera', 0.7, { temperature: 15 }), EN(0, 0)),
        ],
        actors: [actor('ana')],
      },
    ]
    expect(situacionDe(juez(conPiedraPrimero), 'el-fardo-de-corteza')).toBe(true)
  })
})

// ─── 8 ───────────────────────────────────────────────────────────────────────

describe('8 · el-leno-mas-grande-que-todavia-cocina', () => {
  /**
   * EL `puso` NO ES DECORACIÓN, y por qué está acá desde ahora.
   *
   * La entrada dice «elegir el más grande que todavía deje cocinar, LEVANTARLO y
   * `poner(leño, celda del fardo, sobre: fardo)`». Sin ese acto el detector lo
   * firmaba el motor solo: medido, un mundo con una fogata ya prendida y seis
   * pescados en el piso, corrido 3000 ticks con la lista de intenciones VACÍA,
   * disparaba esta secuencia. El escenario de acá lleva el `puso` del leño que
   * ardió porque la secuencia lo lleva.
   */
  const escena = (cual: 'leno' | 'yesca' | 'nada', tPez: number): Cuerpos => [
    enElPiso(criatura('ana'), EN(0, 0)),
    enElPiso(cuerpo('leno', 'madera', 1.5, { temperature: cual === 'leno' ? 600 : 15 }), EN(0, 0)),
    enElPiso(cuerpo('yesca', 'madera', 0.3, { temperature: cual === 'yesca' ? 600 : 15 }), EN(0, 0)),
    enElPiso(cuerpo('pez', 'pescado', 2, { temperature: tPez }), EN(0, 0)),
  ]

  const guion = (cual: 'leno' | 'yesca'): Paso[] => [
    { bodies: escena('nada', 15), actors: [actor('ana')], events: [puso('ana', cual, EN(0, 0))] },
    { bodies: escena(cual, 15), actors: [actor('ana')] },
    { bodies: escena(cual, 100), actors: [actor('ana')] },
  ]

  it('POSITIVO · lo puso, prendió por contacto el de 1,5 kg teniendo a tiro el de 0,3, y cocinó', () => {
    const v = juez(guion('leno'))
    expect(vio(v, 'el-leno-mas-grande-que-todavia-cocina')).toBe(true)
    expect(evidenciaDe(v, 'el-leno-mas-grande-que-todavia-cocina')).toContain('1.5000 kg')
  })

  it('NEGATIVO · si lo que prendió era el MÁS LIVIANO, no eligió: agarró lo que había', () => {
    positivoYNegativo('el-leno-mas-grande-que-todavia-cocina', guion('leno'), guion('yesca'))
  })

  it('NEGATIVO · y si nunca se cocinó nada, el leño grande no compró la ventana', () => {
    const sinCocinar: Paso[] = [
      { bodies: escena('nada', 15), actors: [actor('ana')], events: [puso('ana', 'leno', EN(0, 0))] },
      { bodies: escena('leno', 15), actors: [actor('ana')] },
      { bodies: escena('leno', 15), actors: [actor('ana')] },
    ]
    positivoYNegativo('el-leno-mas-grande-que-todavia-cocina', guion('leno'), sinCocinar)
  })

  it('NEGATIVO · Y EL NUEVO: el mismo leño ardiendo, sin que nadie lo haya tocado', () => {
    // La REGLA 6 hecha negativo, y es el que faltaba. Mundo idéntico al positivo
    // salvo por una cosa: no hay `puso` ni mano. Con eso la firma la escribe el
    // motor —un leño que ya venía prendido y un pescado que se cocina solo— y no
    // hay ninguna elección que acreditarle a nadie.
    const sinTocarlo: Paso[] = [
      { bodies: escena('nada', 15), actors: [actor('ana')] },
      { bodies: escena('leno', 15), actors: [actor('ana')] },
      { bodies: escena('leno', 100), actors: [actor('ana')] },
    ]
    positivoYNegativo('el-leno-mas-grande-que-todavia-cocina', guion('leno'), sinTocarlo)
  })

  it('NEGATIVO · y un pescado no es un leño alternativo, aunque tenga `fuelEnergy` 2', () => {
    // Medido: `qualityOf(pescado,'fuelEnergy')` es 2, así que la comida entraba al
    // conjunto de leños a tiro. Acá el único combustible además del que ardió es el
    // pescado —de 0,3 kg, o sea MÁS LIVIANO que el leño que ardió, que es lo que
    // haría disparar al detector sin el filtro— y la secuencia no puede disparar:
    // no había otro leño entre los que elegir, había la cena.
    const soloElPez = (cual: 'leno' | 'nada', tPez: number): Cuerpos => [
      enElPiso(criatura('ana'), EN(0, 0)),
      enElPiso(cuerpo('leno', 'madera', 1.5, { temperature: cual === 'leno' ? 600 : 15 }), EN(0, 0)),
      enElPiso(cuerpo('pez', 'pescado', 0.3, { temperature: tPez }), EN(0, 0)),
    ]
    const sinAlternativa: Paso[] = [
      { bodies: soloElPez('nada', 15), actors: [actor('ana')], events: [puso('ana', 'leno', EN(0, 0))] },
      { bodies: soloElPez('leno', 15), actors: [actor('ana')] },
      { bodies: soloElPez('leno', 100), actors: [actor('ana')] },
    ]
    positivoYNegativo('el-leno-mas-grande-que-todavia-cocina', guion('leno'), sinAlternativa)
  })
})

// ─── 9 ───────────────────────────────────────────────────────────────────────

describe('9 · la-piedra-primero-y-la-comida-encima', () => {
  const escena = (masaDelFuego: number, sobre: string): Cuerpos => [
    enElPiso(criatura('ana'), EN(0, 0)),
    enElPiso(cuerpo('f', 'madera', masaDelFuego, { temperature: 600 }), EN(0, 0)),
    apoyadoEn(cuerpo('piedra', 'piedra', 1), EN(0, 0), 'f'),
    apoyadoEn(cuerpo('pez', 'pescado', 2, { temperature: 100 }), EN(0, 0), sobre),
  ]
  const frio: Cuerpos = [
    enElPiso(criatura('ana'), EN(0, 0)),
    enElPiso(cuerpo('f', 'madera', 1.5, { temperature: 15 }), EN(0, 0)),
    enElPiso(cuerpo('piedra', 'piedra', 1), EN(0, 0)),
    enElPiso(cuerpo('pez', 'pescado', 2, { temperature: 15 }), EN(0, 0)),
  ]

  const guion = (masa: number, sobre: string): Paso[] => [
    { bodies: frio, actors: [actor('ana')] },
    { bodies: escena(masa, sobre), actors: [actor('ana')] },
  ]

  const POSITIVO = guion(1.5, 'piedra')

  it('POSITIVO · el pescado se cocinó sobre la piedra, y en contacto se le pasaba de 260 °C', () => {
    const v = juez(POSITIVO)
    expect(vio(v, 'la-piedra-primero-y-la-comida-encima')).toBe(true)
    // 450,9 de potencia × 1,2 = 556,08 contra los 260 del pescado. El número lo
    // pone `temperaturaDeEquilibrio`, no el juez.
    expect(evidenciaDe(v, 'la-piedra-primero-y-la-comida-encima')).toContain('556.08')
  })

  it('NEGATIVO · el pescado apoyado DIRECTO sobre el fuego es la alternativa perdedora', () => {
    positivoYNegativo('la-piedra-primero-y-la-comida-encima', POSITIVO, guion(1.5, 'f'))
  })

  it('NEGATIVO · y con un fuego chico usar la parrilla no decide nada: el contacto no quemaba', () => {
    // La mitad (a) del veredicto que la tanda dos escribió y que §5 ✓4 corrigió:
    // «equivocarse no cuesta nada» ES cierto por debajo de 0,679 kg de vara, y ahí
    // apoyar sobre la piedra no es una decisión. Con 0,2 kg el contacto da 87,14.
    positivoYNegativo('la-piedra-primero-y-la-comida-encima', POSITIVO, guion(0.2, 'piedra'))
  })
})

// ─── El informe ──────────────────────────────────────────────────────────────

describe('el informe publica las tres cifras de §10, y la distinción que las separa', () => {
  const conFuego: Paso[] = [
    {
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enElPiso(cuerpo('f', 'madera', 1.5, { temperature: 600 }), EN(0, 0)),
        apoyadoEn(cuerpo('piedra', 'piedra', 1), EN(0, 0), 'f'),
        apoyadoEn(cuerpo('pez', 'pescado', 2, { temperature: 100 }), EN(0, 0), 'piedra'),
      ],
      actors: [actor('ana')],
    },
  ]
  const pelado: Paso[] = [{ bodies: [enElPiso(criatura('ana'), EN(0, 0))], actors: [actor('ana')] }]

  it('«no apareció» y «no se pudo medir» son cosas distintas y salen separadas', () => {
    // §10: «si M = 0 se reporta NO MEDIDA y NO cuenta como ausencia». Un mundo sin
    // fuego no dice nada sobre la criatura; un mundo con fuego y sin la conducta,
    // sí. Confundir los dos es leer un mundo pobre como una mente pobre.
    const v = juez(pelado)
    expect(v.aparecidas).toEqual([])
    expect(v.noMedidas.length).toBe(9)

    const w = juez(conFuego)
    expect(w.aparecidas).toEqual(['la-piedra-primero-y-la-comida-encima'])
    // Con fuego, comida y parrilla a mano, tres entradas dejan de ser no-medidas.
    expect(w.noMedidas.length).toBeLessThan(9)
  })

  it('y el resumen del banco pide DOS partidas: una sola es casualidad de semilla', () => {
    // §10.2, palabra por palabra: «una secuencia cuenta como aparecida si apareció
    // en ≥ 2 de las 20; una sola aparición es indistinguible de una casualidad de
    // semilla».
    const una = resumir([juez(conFuego), juez(pelado)])
    const dos = resumir([juez(conFuego), juez(conFuego)])
    const fila = (r: Resumen): FilaDelBanco => {
      const f = r.filas.find((x) => x.nombre === 'la-piedra-primero-y-la-comida-encima')
      if (f === undefined) throw new Error('falta la fila')
      return f
    }
    expect([fila(una).aparecioEn, fila(una).cuenta]).toEqual([1, false])
    expect([fila(dos).aparecioEn, fila(dos).cuenta]).toEqual([2, true])
    // Y las no-medidas arruinan el banco antes que la criatura: con dos partidas
    // peladas quedan nueve sin medir, muy por encima del techo de tres de §10.
    expect(resumir([juez(pelado), juez(pelado)]).interpretable).toBe(false)
  })

  it('la tabla se puede leer sin un depurador, y marca las no-medidas', () => {
    const texto = tabla(juez(conFuego))
    expect(texto).toContain('SÍ  la-piedra-primero-y-la-comida-encima')
    expect(texto).toContain('(no medida)')
  })

  it('y una fila que DISPARÓ mientras el contra-detector negaba la situación NO cuenta', () => {
    // ─── LA CONTRADICCIÓN, y era el vehículo de los dos agujeros mortales ─────
    //
    // `cuenta` salía de `aparecioEn >= 2` sin mirar el contra-detector, y `tabla()`
    // imprimía la fila como `SÍ … (no medida)`. Medido en su momento: dos partidas
    // idénticas con una fogata ya prendida daban «apareció en 2/2 con situación en
    // 0/2 → cuenta: true», y los dos disparos que el motor firmaba solo salían los
    // dos con esa marca. Un disparo que el propio contra-detector niega es un error
    // del juez, no una aparición, y no puede llegar al piso de cuatro.
    //
    // Se le pasa a `resumir` un veredicto ARMADO en vez de una partida, y a
    // propósito: lo que se afirma es la aritmética del informe, no un detector. Con
    // los nueve detectores reparados esta combinación ya no la produce ninguna
    // partida de este archivo, y justamente por eso el veredicto hay que
    // escribirlo: la regla tiene que seguir cuidada cuando la escena que la
    // motivó dejó de existir.
    const contradictorio: Veredicto = {
      ticks: 3,
      filas: SECUENCIAS.map((s) => ({
        nombre: s.nombre,
        mira: s.mira,
        llama: s.llama,
        aparecio: s.nombre === 'el-leno-mas-grande-que-todavia-cocina',
        tick: s.nombre === 'el-leno-mas-grande-que-todavia-cocina' ? 1 : undefined,
        evidencia: undefined,
        situacion: false,
      })),
      aparecidas: ['el-leno-mas-grande-que-todavia-cocina'],
      noMedidas: [],
    }
    const r = resumir([contradictorio, contradictorio])
    const f = r.filas.find((x) => x.nombre === 'el-leno-mas-grande-que-todavia-cocina')
    expect([f?.aparecioEn, f?.situacionEn, f?.contradictorioEn, f?.cuenta]).toEqual([2, 0, 2, false])
    expect(r.cuantasCuentan).toBe(0)
    expect(tabla(contradictorio)).toContain('(CONTRADICE AL CONTRA-DETECTOR)')
  })
})

// ─── La partida corrida ──────────────────────────────────────────────────────

describe('y ahora sin armar nada: una partida CORRIDA contra `stepWorld`', () => {
  /**
   * El banco de `world/tests/el-fuego.test.ts`, con un leño de 2 kg tirado al
   * lado. La criatura frota la vara de 0,2 kg y la vara cruza sus 300 °C en el
   * paso 48 — medido allá, no acá. El juez sólo recibe lo que `stepWorld` devuelve.
   */
  function frotar(ticks: number): Muestra[] {
    const w0: WorldState = mundo({
      bodies: [
        enElPiso(criatura('ana', 1000), EN(0, 0)),
        enLaMano(cuerpo('va', 'madera', 0.2, { temperature: 15 }), EN(0, 0), 'ana'),
        enLaMano(cuerpo('vb', 'madera', 0.2, { temperature: 15 }), EN(0, 0), 'ana'),
        enElPiso(cuerpo('leno', 'madera', 2, { temperature: 15 }), EN(0, 0)),
      ],
      actors: [actor('ana', { holding: ['va', 'vb'] })],
    })
    const roles: readonly RoleBinding[] = [
      { name: 'a', body: 'va' },
      { name: 'b', body: 'vb' },
      { name: 'actor', body: 'ana-cuerpo' },
    ]
    const ms: Muestra[] = [{ state: w0, events: [] }]
    let w = w0
    for (let n = 1; n <= ticks; n += 1) {
      const i: Intent | undefined = apply({ by: 'ana', seq: n }, w.phys, 'friccion', roles)
      const r = stepWorld(w, i === undefined ? [] : [i])
      w = r.state
      ms.push({ state: w, events: r.events })
    }
    return ms
  }

  it('el juez lee los eventos y los campos que el MOTOR escribe, no los que inventó el banco', () => {
    const d = new Detector()
    d.observarTodo(frotar(60))
    // Lo que la crónica reconstruyó de una partida que nadie le dictó: el episodio
    // de fricción con su cuerpo del rol `a`, y el fuego que salió de ahí.
    expect(d.cronica.fricciones.map((f) => [f.actor, f.cuerpo, f.tick])).toEqual([['ana', 'va', 1]])
    expect([...d.cronica.frotados]).toEqual(['va'])
    expect(d.cronica.fuegos.has('va')).toBe(true)
    const v = d.veredicto()
    console.log(`\n${tabla(v)}\n`)
    // Y el detector 1 dispara sobre una partida corrida: frotó lo que podía
    // encender y el leño de 2 kg —el que el tanque de 1000 no paga jamás— quedó
    // donde estaba.
    expect(vio(v, 'no-frotar-lo-que-no-alcanza-a-encender')).toBe(true)
  })

  it('y si la partida no enciende nada, no dispara ninguna de las nueve', () => {
    // Cinco ticks: la vara va por los 45 °C. El control negativo de la partida
    // corrida, y el que muestra que el disparo de arriba lo produjo la IGNICIÓN y
    // no el hecho de haber frotado.
    const v = juzgar(frotar(5))
    expect(v.aparecidas).toEqual([])
  })
})
