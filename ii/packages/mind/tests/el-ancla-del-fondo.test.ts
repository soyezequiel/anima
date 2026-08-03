// ─── EL ANCLA DEL FONDO: la que sabe dónde comer no deambula ─────────────────
//
// Viene del número 35 de la sección 5 de `como-se-trabaja.md`. El deambular de
// fondo se apoyaba, sin que nadie lo supiera, en un BUG del mundo: `explore`
// caminaba un ciclo cerrado de 8 celdas que sumaba (0,0), así que deambular no
// alejaba a nadie de sus cosas. El día que el rumbo se arregló —96 celdas
// distintas en 100 ticks en vez de 8— dos logros del criterio se cayeron por EL
// VIAJE DE VUELTA: la criatura se iba lejos del pozo y del fuego y pagaba la
// caminata de regreso (`ir(pozo:-12:-3)` ×31 contra una guarda de 10).
//
// Este archivo afirma la conducta que reemplaza al ancla accidental: **cuando la
// rueda de fondo elige deambular, no hay meta en curso, y hay un ancla a la
// vista —comida (el pozo es un cuerpo con calorías) o un fuego encendido—, la
// escalera emite `esperar` y no `explorar`.** Y las tres fronteras de esa frase
// se afirman también, porque son las que evitan que el ancla se coma la función
// del deambular:
//
//   · sin ancla a la vista, deambular sigue: es la búsqueda de la que no sabe;
//   · con una meta en curso gapped, deambular sigue: es LA HERRAMIENTA que
//     desbloquea el gap («la vista cambia, y la próxima búsqueda encuentra»);
//   · el propio cuerpo no ancla: la carne propia tiene calorías, y sin el filtro
//     `soyYo` toda criatura estaría anclada a sí misma para siempre.

import { describe, expect, it } from 'vitest'

import { Partida } from '@anima/perceive'
import type { WorldBody } from '@anima/world'

import { Creencias } from '../src/creencias.js'
import { Mente } from '../src/mente.js'
import { metaDe } from '../src/oportunidades.js'
import { actor, criatura, cuerpo, enElPiso, mundo } from './mundo.js'

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })

/**
 * Una criatura SACIADA y sola: el tanque casi lleno apaga la necesidad de
 * energía, no hay nada que juntar ni de qué guarecerse, así que la escalera cae
 * al fondo en el primer tick. Es la escena mínima donde el fondo decide.
 */
function saciadaCon(extras: readonly WorldBody[] = []): Partida {
  return new Partida(
    mundo({
      bodies: [enElPiso(criatura('ana', 990), EN(0, 0)), ...extras],
      actors: [actor('ana')],
    }),
  )
}

/** El primer vuelo de fondo que la mente despega en `ticks` ticks. */
function primerFondo(p: Partida, ticks: number): string {
  const m = new Mente({ actor: 'ana', memoria: new Creencias() })
  for (let t = 0; t < ticks; t += 1) {
    const antes = m.despegues
    m.pensar(p)
    if (m.despegues > antes) {
      const que = m.ultimoDespegue ?? '?'
      // Las otras dos filas de la rueda no son de este archivo: se busca la
      // decisión de la rama del deambular, que es la única con ancla.
      if (que.startsWith('esperar') || que.startsWith('explorar')) return que
    }
    p.avanzar(1)
  }
  return 'no despegó nada de la rama del deambular'
}

describe('el ancla del fondo', () => {
  it('CON comida a la vista, el fondo espera en vez de deambular', () => {
    // Un cuerpo con calorías a tres celdas. No un pozo entero: lo que ancla es
    // «sé dónde comer», y la cualidad que lo dice es `calories > 0`.
    const p = saciadaCon([enElPiso(cuerpo('presa', 'pescado', 2, { temperature: 15 }), EN(3, 0))])
    const que = primerFondo(p, 40)
    expect(que.startsWith('esperar'), `despegó ${que}`).toBe(true)
  })

  it('CON un fuego encendido a la vista, también: el fuego costó carísimo y ancla', () => {
    const p = saciadaCon([enElPiso(cuerpo('brasa', 'madera', 1, { temperature: 400 }), EN(2, 1))])
    const que = primerFondo(p, 40)
    expect(que.startsWith('esperar'), `despegó ${que}`).toBe(true)
  })

  it('SIN nada a la vista, deambula: la que no sabe dónde comer tiene que buscar', () => {
    const p = saciadaCon([])
    const que = primerFondo(p, 40)
    expect(que.startsWith('explorar'), `despegó ${que}`).toBe(true)
  })

  it('CON una meta en curso, deambula UNA vez y después espera: herramienta, no bucle', () => {
    // Un fuego a la vista (ancla), un drive que pide algo carnoso, y el
    // presupuesto de búsqueda en 1: el plan se corta por presupuesto («parcial»),
    // la meta queda EN CURSO, y la escalera cae al fondo con `metaEnCurso`
    // puesta — que es el estado que este test pinza.
    //
    // Las DOS mitades de la conducta se afirman juntas porque son un solo
    // diseño. El deambular con meta es la herramienta documentada para que la
    // vista cambie y la próxima búsqueda de la MISMA meta encuentre — así que la
    // PRIMERA vez se deambula aunque haya ancla. Pero es una herramienta y no un
    // bucle (`yaDeambulePor`): si esa vuelta no cambió la respuesta, las
    // siguientes se espera. Sin el cerrojo el ancla no salvaba nada, medido: el
    // diagnóstico 10 moría en el 9482 igual, paseándose con la meta viva.
    //
    // (La primera versión de este test armaba la meta gapped SIN presupuesto y
    // medía otra cosa: el `gap` trae un «mientras tanto», el mientras tanto se
    // completa, la meta se da por conseguida y el fondo corre sin meta — o sea
    // que esperaba anclada LEGÍTIMAMENTE. El camino del presupuesto es el que
    // deja la meta viva mientras el fondo corre.)
    const p = saciadaCon([enElPiso(cuerpo('brasa', 'madera', 1, { temperature: 400 }), EN(2, 1))])
    const m = new Mente({
      actor: 'ana',
      memoria: new Creencias(),
      drive: { meta: metaDe('carnoso'), peso: 1, desdeTick: 0 },
      presupuesto: 1,
    })
    const rama: string[] = []
    for (let t = 0; t < 120 && rama.length < 2; t += 1) {
      const antes = m.despegues
      m.pensar(p)
      if (m.despegues > antes) {
        const u = m.ultimoDespegue ?? '?'
        if (u.startsWith('esperar') || u.startsWith('explorar')) rama.push(u)
      }
      p.avanzar(1)
    }
    expect(rama.length, `sólo despegó ${rama.join(' · ')}`).toBe(2)
    expect(rama[0]!.startsWith('explorar'), `el primero fue ${rama[0]!}`).toBe(true)
    expect(rama[1]!.startsWith('esperar'), `el segundo fue ${rama[1]!}`).toBe(true)
  })

  it('y el propio cuerpo NO ancla, que es el `soyYo` de siempre', () => {
    // La escena vacía del test anterior YA lo prueba —la criatura es carne y
    // carne tiene calorías, y aun así deambuló—, pero la afirmación merece su
    // renglón: si alguien borra el filtro, ese test y éste se caen juntos y el
    // nombre de éste dice por qué.
    const p = saciadaCon([])
    const m = new Mente({ actor: 'ana', memoria: new Creencias() })
    for (let t = 0; t < 40; t += 1) {
      const antes = m.despegues
      m.pensar(p)
      if (m.despegues > antes && (m.ultimoDespegue ?? '').startsWith('esperar')) {
        throw new Error('esperó anclada a su propio cuerpo')
      }
      p.avanzar(1)
    }
  })
})

// ─── POR QUÉ ESTE ARCHIVO SE PUSO ROJO CON «AGARRAR» ────────────────────────
//
// (Nota de diagnóstico, escrita sin arreglar el test todavía. Vale porque el
// camino ya se recorrió una vez y no conviene repetirlo.)
//
// El tercer test empezó a despegar `explorar` donde esperaba `esperar`, o sea a
// deambular DOS veces, cuando `sinVocabulario` dejó de vetar los `sostiene`.
//
// La primera sospecha era que la criatura ahora cumple la meta agarrando algo, y
// **está descartada**: la meta del drive es `holding(tag:carnoso)` y lo único que
// hay en la escena es una brasa de MADERA, cuyos tags son `organico, vegetal,
// fibroso`. No hay nada carnoso que agarrar, así que la vía nueva del planificador
// ni se activa acá.
//
// Lo que queda —y hay que confirmarlo antes de tocar nada— es la otra punta: con
// el veto sacado, **D3 puede tomar metas que antes descartaba**, y la brasa es
// vegetal y fibrosa. Si D3 ofrece `holding(tag:vegetal)` y se la lleva, la meta EN
// CURSO cambia, y `yaDeambulePor` —el cerrojo que impide deambular dos veces por
// la misma meta— se reinicia con ella. Deambular de nuevo sería entonces correcto
// según la regla escrita, y lo que habría que decidir es si el cerrojo tiene que
// ser por meta o por algo más estable.
