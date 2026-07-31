// ─── EL PLANO ES CANÓNICO, VERSIONADO Y NO LLEVA EL SITIO ───────────────────
//
// Criterio del **tramo C del Gate 5→6**, escrito antes de implementar. Cubre el
// punto 1 de los doce —«`BlueprintDefinition` canónico y versionado»— y deja
// puesta la mitad del 9 que le toca al plano: un cambio de física cambia la
// revisión.
//
// ─── POR QUÉ EL PLANO VIVE EN `@anima/physics` ──────────────────────────────
//
// Tres razones y la tercera es la que decide:
//
//   · acá están las cotas del ensamble (`MAX_PARTS`, `MAX_JOINTS`) y el catálogo
//     de cualidades contra el que hay que validar;
//   · `@anima/physics` no depende de nadie, así que el tipo llega a `world`,
//     `skills`, `plan`, `mind` y `juez` sin abrir una arista nueva — y el orden
//     real es `physics → oracle → world → skills → plan`, o sea que el
//     `Blueprint` placeholder de `skills/src/tipos.ts` está ARRIBA del mundo, que
//     es justamente quien lo tiene que construir;
//   · **la puerta es `admit()`**, y está acá. Un candidato del modelo se valida
//     como se valida una sustancia del oráculo o un proceso: `admitX(x, phys)`
//     devuelve un `Verdict` con razones citables. Poner el plano en otro paquete
//     habría dejado la puerta afuera de la puerta.
//
// Que el tipo viva en la física NO quiere decir que el modelo escriba física
// (ADR II-0001): un candidato es DATO que la puerta juzga, exactamente igual que
// una `Substance`, que también vive acá y la propone el oráculo.
//
// ─── LOS CINCO CRITERIOS, ESCRITOS ANTES ────────────────────────────────────
//
//   (a) dos candidatos que dicen LO MISMO escrito distinto dan la MISMA revisión;
//   (b) cualquier cambio de contenido da OTRA revisión — y ésa es la mitad que
//       hace valioso al (a), porque un hash constante cumpliría el (a) solo;
//   (c) la revisión depende de `physicsVersion`: bajar un número de la física
//       invalida el sello, que es el punto 9 del criterio del gate;
//   (d) la definición NO lleva el sitio (ADR II-0015), así que una misma revisión
//       se puede levantar dos veces y dos partidas la pueden compartir;
//   (e) la puerta rechaza con razón citable: cotas, roles y cualidades.
//
// ─── LO QUE ESTE ARCHIVO NO PRUEBA, DICHO PARA QUE NADIE LO SUPONGA ─────────
//
// Que el plano se pueda CONSTRUIR. Eso es `BuildSkill` y es el punto 5, y es
// deliberadamente otra pieza: **construir algo no demuestra que funcione** y
// levantar algo no demuestra que se pueda levantar. Acá sólo se afirma que la
// estructura es una estructura legal y que tiene identidad estable.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics } from '../src/index.js'
import { MAX_JOINTS, MAX_PARTS } from '../src/body.js'
import { definirPlano, type BlueprintCandidate, type BlueprintPart } from '../src/plano.js'
import type { Physics } from '../src/index.js'

const PHYS: Physics = buildSeedPhysics()

/**
 * EL CANDIDATO FIJO, y es fijo a propósito: el gate se demuestra **sin
 * proveedor**, así que lo que se juzga es un archivo versionado del repo y no lo
 * que el modelo haya contestado hoy.
 *
 * No se llama de ninguna manera. No hay `kind`, ni nombre de objeto, ni
 * `establishes`: es una estructura —qué piezas y cómo se atan— descrita en
 * CUALIDADES. Lo que la obra vaya a hacer es el `ConstructionSchema`, que es otra
 * de las cinco piezas del ADR II-0015 y no está acá.
 */
const CANDIDATO: BlueprintCandidate = {
  parts: [
    { rol: 'costilla-a', pide: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { rol: 'costilla-b', pide: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { rol: 'costilla-c', pide: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { rol: 'paño', pide: [{ q: 'flexibility', op: '>=', v: 0.6 }] },
    { rol: 'atadura', pide: [{ q: 'tensile', op: '>=', v: 0.3 }] },
  ],
  joints: [
    { a: 'costilla-a', b: 'costilla-b', binder: 'atadura' },
    { a: 'costilla-b', b: 'costilla-c', binder: 'atadura' },
    { a: 'costilla-c', b: 'paño', binder: 'atadura' },
  ],
}

function definido(c: BlueprintCandidate, phys: Physics = PHYS): ReturnType<typeof definirPlano> {
  return definirPlano(c, phys)
}

/** La revisión, o el porqué del rechazo si no salió. Corta los tests con mensaje. */
function revisionDe(c: BlueprintCandidate, phys: Physics = PHYS): string {
  const r = definido(c, phys)
  if (r.k !== 'ok') throw new Error(`el candidato no pasó la puerta: ${JSON.stringify(r.verdict.razones)}`)
  return r.def.revision
}

// ─── (a) La forma canónica ──────────────────────────────────────────────────

describe('(a) dos candidatos que dicen lo mismo dan la misma revisión', () => {
  it('la premisa: el candidato fijo pasa la puerta', () => {
    const r = definido(CANDIDATO)
    expect(r.k, r.k === 'rechazado' ? JSON.stringify(r.verdict.razones) : '').toBe('ok')
  })

  it('el ORDEN DE LAS PIEZAS no cambia la revisión', () => {
    // Un plano es un grafo, no una lista: en qué orden lo escribió el que lo
    // propuso no es parte de lo que el plano dice. Sin esto, la fragua produce
    // dos «planos distintos» que son el mismo y el registro se llena de gemelos.
    const alReves: BlueprintCandidate = { ...CANDIDATO, parts: [...CANDIDATO.parts].reverse() }
    expect(revisionDe(alReves)).toBe(revisionDe(CANDIDATO))
  })

  it('el ORDEN DE LAS JUNTAS tampoco', () => {
    const alReves: BlueprintCandidate = { ...CANDIDATO, joints: [...CANDIDATO.joints].reverse() }
    expect(revisionDe(alReves)).toBe(revisionDe(CANDIDATO))
  })

  it('ni el orden de las CLÁUSULAS de una pieza', () => {
    const conDos: BlueprintCandidate = {
      ...CANDIDATO,
      parts: CANDIDATO.parts.map((p) =>
        p.rol === 'paño'
          ? {
              rol: p.rol,
              pide: [
                { q: 'flexibility', op: '>=', v: 0.6 },
                { q: 'tensile', op: '>=', v: 0.2 },
              ] as const,
            }
          : p,
      ),
    }
    const alReves: BlueprintCandidate = {
      ...conDos,
      parts: conDos.parts.map((p) => (p.rol === 'paño' ? { rol: p.rol, pide: [...p.pide].reverse() } : p)),
    }
    expect(revisionDe(alReves)).toBe(revisionDe(conDos))
  })

  it('ni de qué lado de la junta quedó cada pieza: atar A con B es atar B con A', () => {
    // `union` no distingue `a` de `b` —los dos son el mismo rol material y lo que
    // los une es el `binder`— así que dar vuelta una junta no dice nada nuevo.
    const dadaVuelta: BlueprintCandidate = {
      ...CANDIDATO,
      joints: CANDIDATO.joints.map((j) => ({ a: j.b, b: j.a, binder: j.binder })),
    }
    expect(revisionDe(dadaVuelta)).toBe(revisionDe(CANDIDATO))
  })

  it('LO QUE SÍ SE CONSERVA: renombrar un rol da OTRO plano, y es a propósito', () => {
    // La línea honesta de este tramo. Decidir que `costilla-a` y `varilla-1` son
    // el mismo plano pide isomorfismo de grafos con etiquetas, que es el problema
    // caro de verdad. Se elige el lado CONSERVADOR: dos planos con la misma forma
    // y etiquetas distintas son dos planos.
    //
    // El precio es acotado y se puede decir en una frase: un duplicado se puede
    // registrar dos veces, lo que cuesta memoria. El error del otro lado —dos
    // planos distintos colapsando en la misma revisión— cuesta correctitud.
    const renombrado: BlueprintCandidate = {
      ...CANDIDATO,
      parts: CANDIDATO.parts.map((p) => (p.rol === 'paño' ? { ...p, rol: 'tela' } : p)),
      joints: CANDIDATO.joints.map((j) => ({ ...j, a: j.a === 'paño' ? 'tela' : j.a, b: j.b === 'paño' ? 'tela' : j.b })),
    }
    expect(revisionDe(renombrado)).not.toBe(revisionDe(CANDIDATO))
  })
})

// ─── (b) Cualquier cambio de contenido se nota ──────────────────────────────

describe('(b) un cambio de contenido cambia la revisión', () => {
  it('mover un NÚMERO de una cláusula', () => {
    const tocado: BlueprintCandidate = {
      ...CANDIDATO,
      parts: CANDIDATO.parts.map((p) =>
        p.rol === 'costilla-a' ? { ...p, pide: [{ q: 'rigidity', op: '>=', v: 0.51 } as const] } : p,
      ),
    }
    expect(revisionDe(tocado)).not.toBe(revisionDe(CANDIDATO))
  })

  it('cambiar el OPERADOR de una cláusula', () => {
    const tocado: BlueprintCandidate = {
      ...CANDIDATO,
      parts: CANDIDATO.parts.map((p) =>
        p.rol === 'costilla-a' ? { ...p, pide: [{ q: 'rigidity', op: '>', v: 0.5 } as const] } : p,
      ),
    }
    expect(revisionDe(tocado)).not.toBe(revisionDe(CANDIDATO))
  })

  it('una obra de tres piezas no es la misma que una de cuatro', () => {
    // Antes esto decía «sacar una junta», y sacar una junta ya no da otro plano:
    // da un plano INVÁLIDO, porque deja una pieza suelta. Es la primera de las
    // consecuencias de haber medido `unir` — ver el bloque (e).
    const tres: BlueprintCandidate = {
      parts: CANDIDATO.parts.filter((p) => p.rol !== 'paño'),
      joints: CANDIDATO.joints.filter((j) => j.a !== 'paño' && j.b !== 'paño'),
    }
    expect(revisionDe(tres)).not.toBe(revisionDe(CANDIDATO))
  })

  it('cambiar QUÉ ATADOR usa cada junta', () => {
    // Los dos declaran los mismos seis roles y usan los dos atadores, así que los
    // dos son construibles: lo único que cambia es con cuál se ata cada junta. Y
    // eso es contenido, porque la junta se queda con la sustancia del atador.
    const dosAtadores: readonly BlueprintPart[] = [
      ...CANDIDATO.parts,
      { rol: 'atadura-2', pide: [{ q: 'tensile', op: '>=', v: 0.3 }] },
    ]
    const uno: BlueprintCandidate = {
      parts: dosAtadores,
      joints: [
        { a: 'costilla-a', b: 'costilla-b', binder: 'atadura' },
        { a: 'costilla-b', b: 'costilla-c', binder: 'atadura-2' },
        { a: 'costilla-c', b: 'paño', binder: 'atadura' },
      ],
    }
    const elOtro: BlueprintCandidate = {
      parts: dosAtadores,
      joints: [
        { a: 'costilla-a', b: 'costilla-b', binder: 'atadura-2' },
        { a: 'costilla-b', b: 'costilla-c', binder: 'atadura' },
        { a: 'costilla-c', b: 'paño', binder: 'atadura' },
      ],
    }
    expect(revisionDe(elOtro)).not.toBe(revisionDe(uno))
  })
})

// ─── (c) La física versiona el plano ────────────────────────────────────────

describe('(c) un cambio de física invalida la revisión', () => {
  it('la MISMA estructura con otra `physicsVersion` es otra revisión', () => {
    // Es la mitad del punto 9 que le toca al plano. Un plano dice
    // «algo con `rigidity >= 0,5`», y qué significa ese número lo dice la física:
    // si el rango de `rigidity` cambia, la misma frase promete otra cosa. Sellar
    // sin la versión adentro dejaría planos de otro mundo pasando por buenos.
    const otra: Physics = { ...PHYS, version: PHYS.version + 1 }
    expect(revisionDe(CANDIDATO, otra)).not.toBe(revisionDe(CANDIDATO))
  })

  it('y la definición lleva la versión adentro, para poder decir de cuál es', () => {
    const r = definido(CANDIDATO)
    if (r.k !== 'ok') throw new Error('la premisa cambió')
    expect(r.def.physicsVersion).toBe(PHYS.version)
  })
})

// ─── (d) La definición no lleva el sitio ────────────────────────────────────

describe('(d) la definición NO contiene el sitio', () => {
  it('no tiene ni `at` ni nada que nombre un lugar', () => {
    // ADR II-0015: el sitio es del proyecto de obra, no de la definición. Es lo
    // que permite levantar la misma revisión dos veces y que dos partidas
    // compartan el plano sin compartir mundo (la herencia es el Hito 10).
    //
    // Se mira el objeto de verdad y no el tipo: `readonly at?: Cell` se borra al
    // compilar y el placeholder que esto reemplaza —`{ id, at }`— tenía
    // exactamente ese campo.
    const r = definido(CANDIDATO)
    if (r.k !== 'ok') throw new Error('la premisa cambió')
    const claves = Object.keys(r.def)
    expect(claves).not.toContain('at')
    expect(claves).not.toContain('cell')
    expect(claves).not.toContain('sitio')
  })

  it('y un plano NO NOMBRA NINGUNA SUSTANCIA: pide cualidades', () => {
    // El punto 12 del criterio del gate, del lado del plano y por construcción:
    // una pieza se describe con `QualityTest`, o sea cualidad, operador y número.
    // No hay dónde escribir «junco». Se afirma sobre el TEXTO canónico y no sobre
    // el tipo, porque el tipo no impide que alguien meta un id de sustancia en el
    // nombre de un rol.
    const r = definido(CANDIDATO)
    if (r.k !== 'ok') throw new Error('la premisa cambió')
    const texto = JSON.stringify(r.def)
    const nombradas = [...PHYS.substances.keys()].filter((s) => texto.includes(s))
    expect(nombradas).toEqual([])
  })
})

// ─── (e) La puerta rechaza con razón citable ────────────────────────────────

describe('(e) la puerta rechaza, y dice por qué', () => {
  function razonesDe(c: BlueprintCandidate): readonly string[] {
    const r = definido(c)
    if (r.k === 'ok') return []
    return r.verdict.razones.map((x) => x.codigo)
  }

  it('un plano sin piezas no es un plano', () => {
    expect(razonesDe({ parts: [], joints: [] })).toContain('sin-roles')
  })

  it('más de `MAX_PARTS` PIEZAS — y son las piezas, no los roles declarados', () => {
    // Una estrella de `MAX_PARTS + 1` piezas: cada una atada a la primera, con un
    // atador. Los roles declarados son ocho y las PIEZAS son siete, y la cota se
    // le aplica a las siete. Medido en `lo-que-cuesta-armar-un-plano`: el atador
    // se consume y no queda en la obra.
    const n = MAX_PARTS + 1
    const muchas: BlueprintCandidate = {
      parts: [
        ...Array.from({ length: n }, (_, i) => ({
          rol: `p${String(i)}`,
          pide: [{ q: 'rigidity', op: '>=', v: 0.5 } as const],
        })),
        { rol: 'at', pide: [{ q: 'tensile', op: '>=', v: 0.3 }] },
      ],
      joints: Array.from({ length: n - 1 }, (_, i) => ({ a: 'p0', b: `p${String(i + 1)}`, binder: 'at' })),
    }
    expect(razonesDe(muchas)).toContain('partes-fuera-de-cota')
  })

  it('y un rol de ATADOR no cuenta contra esa cota: `MAX_PARTS` piezas más su atador entra', () => {
    // El control con el signo al revés, y el que prueba que la cota mira lo que
    // tiene que mirar. Sin él, «cuenta los roles declarados» pasaría el test de
    // arriba igual.
    const justas: BlueprintCandidate = {
      parts: [
        ...Array.from({ length: MAX_PARTS }, (_, i) => ({
          rol: `p${String(i)}`,
          pide: [{ q: 'rigidity', op: '>=', v: 0.5 } as const],
        })),
        { rol: 'at', pide: [{ q: 'tensile', op: '>=', v: 0.3 }] },
      ],
      joints: Array.from({ length: MAX_PARTS - 1 }, (_, i) => ({
        a: 'p0',
        b: `p${String(i + 1)}`,
        binder: 'at',
      })),
    }
    expect(razonesDe(justas)).toEqual([])
  })

  it('piezas declaradas que ninguna junta nombra: materia que nadie va a usar', () => {
    // El hueco que encontró el test de arriba al ponerse verde por el motivo
    // equivocado: siete piezas y CERO juntas cerraba la cuenta —cero juntas para
    // cero piezas— y describía una pila de materia suelta.
    const sueltas: BlueprintCandidate = {
      parts: Array.from({ length: 3 }, (_, i) => ({
        rol: `p${String(i)}`,
        pide: [{ q: 'rigidity', op: '>=', v: 0.5 } as const],
      })),
      joints: [],
    }
    expect(razonesDe(sueltas)).toContain('rol-desconocido')
  })

  it('la cuenta de las juntas: una obra de N piezas tiene N−1, ni una más', () => {
    // Cada `union` agrega exactamente una pieza y exactamente una junta, así que
    // de más sería un ciclo —que `union` no sabe armar— y de menos, dos obras.
    const conCiclo: BlueprintCandidate = {
      ...CANDIDATO,
      joints: [...CANDIDATO.joints, { a: 'paño', b: 'costilla-a', binder: 'atadura' }],
    }
    expect(razonesDe(conCiclo)).toContain('juntas-fuera-de-cota')
  })

  it('y una obra HONDA de pocas piezas tampoco entra', () => {
    // La cota que manda no es cuántas piezas hay sino qué tan honda es la obra, y
    // se toca antes de lo que uno cree. Medido: un árbol de cuatro piezas armado
    // como dos pares ya mide 3, que es el techo exacto — así que una cadena de
    // cinco, que mide 4, no se puede construir.
    const cadena: BlueprintCandidate = {
      parts: [
        ...Array.from({ length: 5 }, (_, i) => ({
          rol: `p${String(i)}`,
          pide: [{ q: 'rigidity', op: '>=', v: 0.5 } as const],
        })),
        { rol: 'at', pide: [{ q: 'tensile', op: '>=', v: 0.3 }] },
      ],
      joints: Array.from({ length: 4 }, (_, i) => ({
        a: `p${String(i)}`,
        b: `p${String(i + 1)}`,
        binder: 'at',
      })),
    }
    expect(razonesDe(cadena)).toContain('partes-fuera-de-cota')
  })

  it('más de `MAX_JOINTS` juntas', () => {
    const muchas: BlueprintCandidate = {
      parts: CANDIDATO.parts,
      joints: Array.from({ length: MAX_JOINTS + 1 }, () => ({
        a: 'costilla-a',
        b: 'costilla-b',
        binder: 'atadura',
      })),
    }
    expect(razonesDe(muchas)).toContain('juntas-fuera-de-cota')
  })

  it('dos piezas con el mismo rol', () => {
    const repetido: BlueprintCandidate = {
      parts: [CANDIDATO.parts[0] as never, CANDIDATO.parts[0] as never],
      joints: [],
    }
    expect(razonesDe(repetido)).toContain('rol-repetido')
  })

  it('una junta que nombra un rol que no existe', () => {
    const colgada: BlueprintCandidate = {
      ...CANDIDATO,
      joints: [{ a: 'costilla-a', b: 'no-existe', binder: 'atadura' }],
    }
    expect(razonesDe(colgada)).toContain('rol-desconocido')
  })

  it('un `binder` que no es una pieza del plano', () => {
    // El que más fácil se cuela: el atador es UNA PIEZA MÁS y hay que traerlo. Un
    // plano cuyo binder no está declarado se construye a medias y nadie se entera
    // hasta que `union` pide un cuerpo que nadie fue a buscar.
    const sinAtador: BlueprintCandidate = {
      parts: CANDIDATO.parts.filter((p) => p.rol !== 'atadura'),
      joints: CANDIDATO.joints,
    }
    expect(razonesDe(sinAtador)).toContain('rol-desconocido')
  })

  it('una junta de una pieza consigo misma', () => {
    const reflexiva: BlueprintCandidate = {
      ...CANDIDATO,
      joints: [{ a: 'costilla-a', b: 'costilla-a', binder: 'atadura' }],
    }
    expect(razonesDe(reflexiva)).toContain('junta-reflexiva')
  })

  it('una cualidad que no está en el catálogo', () => {
    const inventada: BlueprintCandidate = {
      parts: [{ rol: 'x', pide: [{ q: 'resistencia-magica' as never, op: '>=', v: 1 }] }],
      joints: [],
    }
    expect(razonesDe(inventada)).toContain('cualidad-fuera-del-catalogo')
  })

  it('un número que no es finito', () => {
    const roto: BlueprintCandidate = {
      parts: [{ rol: 'x', pide: [{ q: 'rigidity', op: '>=', v: Number.POSITIVE_INFINITY }] }],
      joints: [],
    }
    expect(razonesDe(roto)).toContain('numero-no-finito')
  })

  it('un número fuera del rango que la cualidad admite', () => {
    const fuera: BlueprintCandidate = {
      parts: [{ rol: 'x', pide: [{ q: 'rigidity', op: '>=', v: 99 }] }],
      joints: [],
    }
    expect(razonesDe(fuera)).toContain('fuera-de-rango')
  })

  it('y un rechazo NO devuelve definición: no hay revisión de algo que no pasó', () => {
    const r = definido({ parts: [], joints: [] })
    expect(r.k).toBe('rechazado')
  })
})
