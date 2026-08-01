/**
 * LEER NUNCA DEVUELVE NADA — el punto 1 del criterio del Hito 6, afirmado.
 *
 * Y con él, las dos cosas que hacen que ese punto signifique algo:
 *
 * - **que las firmas que el puente escribe sean firmas de verdad.** Una tabla de
 *   alias que apunta a un predicado que `@anima/plan` no sabe leer es una tabla
 *   que da verde y no hace nada. El primer bloque las pasa todas por
 *   `interpretar`, que es el mismo lector que usa la mente.
 * - **que los cuatro grados se distingan.** Un lector que contestara
 *   `orientacion` a todo cumpliría «nunca devuelve nada» sin haber entendido una
 *   sola frase. Hay un bloque por grado, con una frase que lo produce.
 */

import { buildSeedPhysics } from '@anima/physics'
import { ESQUEMAS, interpretar } from '@anima/plan'
import { describe, expect, it } from 'vitest'
import { PUENTE, PUENTE_METAS } from '../src/alias.js'
import { leer } from '../src/leer.js'
import { lexicoDe } from '../src/lexico.js'
import { objetivosDe } from '../src/objetivos.js'

const phys = buildSeedPhysics()
const lexico = lexicoDe(phys, PUENTE)

/** Lo que el catálogo core sabe establecer. Es el mismo que lee la regresión. */
const ESTABLECIBLES = new Set<string>()
for (const e of ESQUEMAS) ESTABLECIBLES.add(e.establishes)
const sabeElCatalogo = (f: string): boolean => ESTABLECIBLES.has(f)

const OPC = { phys, lexico, sabeElCatalogo }

/** Las once frases con las que se midió el agujero, más las del corpus real. */
const FRASES: readonly string[] = [
  'fabricá una trampa para peces',
  'traé un palo',
  'andá al río',
  'no comas eso',
  'hacé fuego',
  'juntá leña',
  'pescá algo',
  'asá el pescado',
  'dejá de caminar',
  'conseguí comida',
  'atá la vara con la hebra',
  // Del único historial de chat real que hay en el repo, tal cual se escribió.
  'construi una ahoguera',
  'come comida',
  'rompe el muro y levanta 5 piedras',
  'anda al lado de la comida',
  // Y los bordes.
  '',
  '   ',
  'xyzzy plugh frotz',
  '¿?',
]

describe('las firmas del puente son firmas de verdad', () => {
  it('`interpretar` de @anima/plan las lee TODAS', () => {
    // Sin esto, el puente puede apuntar a cualquier cosa y nada se pone rojo
    // hasta que una criatura sale a perseguir un predicado inexistente.
    const rotas: string[] = []
    for (const m of PUENTE_METAS) {
      const d = m.denota
      if (d.k !== 'meta') continue
      if (interpretar(d.firma) === undefined) rotas.push(`${m.dice.join('/')} → ${d.firma}`)
    }
    expect(rotas, `firmas que @anima/plan no sabe leer: ${rotas.join(' · ')}`).toEqual([])
    console.log(`  ${String(PUENTE_METAS.length)} metas del puente, las ${String(PUENTE_METAS.length)} legibles`)
  })

  it('y las que COMPONE el verbo también', () => {
    // Las firmas de `componer()` no están escritas en `alias.ts` sino armadas
    // en `leer.ts`, así que hay que sacarlas leyendo de verdad.
    const rotas: string[] = []
    for (const f of FRASES) {
      for (const c of leer(f, OPC).clausulas) {
        if (c.firma === undefined) continue
        if (interpretar(c.firma) === undefined) rotas.push(`«${f}» → ${c.firma}`)
      }
    }
    expect(rotas, `compuestas ilegibles: ${rotas.join(' · ')}`).toEqual([])
  })
})

describe('ninguna frase devuelve nada', () => {
  it('las diecinueve, incluidas la vacía y la de tres palabras inventadas', () => {
    const tabla: string[] = []
    for (const f of FRASES) {
      const l = leer(f, OPC)
      // EL PUNTO 1 DEL CRITERIO, y es esto: siempre hay cláusulas y siempre hay
      // acuse. No es un `if` de relleno; `Lectura` no tiene variante vacía.
      expect(l.clausulas.length, `«${f}» salió sin cláusulas`).toBeGreaterThanOrEqual(1)
      expect(l.acuse.length, `«${f}» salió sin acuse`).toBeGreaterThan(0)
      for (const c of l.clausulas) {
        expect(['entendida', 'sin-camino', 'orientacion', 'no-entendida']).toContain(c.grado)
      }
      const c0 = l.clausulas[0] as (typeof l.clausulas)[number]
      tabla.push(
        `  ${(f === '' ? '(vacía)' : f).padEnd(34)} ${c0.grado.padEnd(13)} ${c0.firma ?? '—'}`,
      )
    }
    console.log('\n── LAS DIECINUEVE FRASES ──')
    for (const t of tabla) console.log(t)
    console.log('')
  })

  it('y los cuatro grados aparecen: un lector que contesta siempre lo mismo no sirve', () => {
    // El control del bloque de arriba. Sin esto, «nunca devuelve nada» lo
    // cumpliría un lector que contesta `no-entendida` a todo.
    const grados = new Set<string>()
    for (const f of FRASES) for (const c of leer(f, OPC).clausulas) grados.add(c.grado)
    console.log(`  grados producidos: ${[...grados].sort().join(', ')}`)
    expect(grados.size).toBeGreaterThanOrEqual(3)
    expect(grados.has('entendida')).toBe(true)
    expect(grados.has('no-entendida')).toBe(true)
  })
})

describe('el caso de aceptación', () => {
  it('«fabricá una trampa para peces» sale como CUALIDAD, no como objeto', () => {
    const l = leer('fabricá una trampa para peces', OPC)
    const c = l.clausulas[0]
    expect(c?.firma).toBe('catch>0')
    expect(c?.verbo).toBe('hacer')
    expect(c?.grado).toBe('entendida')
    // Y ninguna parte de la lectura nombra la solución.
    expect(JSON.stringify(l)).not.toContain('caña')
    console.log(`  «fabricá una trampa para peces» → ${String(c?.firma)} · acuse: «${l.acuse}»`)
  })

  it('y «peces» engancha por PLURAL: es la palabra que faltaba', () => {
    // El plural era la mitad del agujero medido en el tramo B (la cobertura
    // decía 9% y dos de las palabras que faltaban eran ésta y `con`).
    const l = leer('traé peces', OPC)
    expect(l.clausulas[0]?.firma).toBe('holding(tag:carnoso)')
  })
})

describe('la polaridad se decide antes de anclar', () => {
  it('«no comas eso» sale negada y «comé eso» no', () => {
    expect(leer('no comas eso', OPC).clausulas[0]?.polaridad).toBe('niega')
    expect(leer('comé eso', OPC).clausulas[0]?.polaridad).toBe('afirma')
  })

  it('y la frase negada tiene la MISMA firma que la afirmada', () => {
    // Es el punto entero de separar polaridad de anclaje: lo que cambia es el
    // signo, no lo que se entendió. Si la negación cambiara la firma, el
    // consumidor no podría saber qué es lo que NO hay que hacer.
    const si = leer('hacé fuego', OPC).clausulas[0]
    const no = leer('no hagas fuego', OPC).clausulas[0]
    expect(si?.firma).toBe('emitsPower>0')
    expect(no?.firma).toBe('emitsPower>0')
    expect(no?.polaridad).toBe('niega')
  })
})

describe('las cláusulas se cortan y se ordenan', () => {
  it('«hacé una caña y andá a pescar, después asá el pescado» son tres', () => {
    const l = leer('hacé fuego y andá a pescar después asá el pescado', OPC)
    console.log(
      `  ${String(l.clausulas.length)} cláusulas: ${l.clausulas.map((c) => `«${c.crudo}»[${c.liga}]`).join(' ')}`,
    )
    expect(l.clausulas.length).toBe(3)
    // La primera nunca dice «despues»: no hay nada antes a lo que atarla, y
    // `goalGraph` de @anima/plan grita si lo dijera.
    expect(l.clausulas[0]?.liga).toBe('y')
    expect(l.clausulas[1]?.liga).toBe('y')
    expect(l.clausulas[2]?.liga).toBe('despues')
  })
})

describe('el usuario que escribe mal', () => {
  it('«construi una ahoguera» encuentra el fuego', () => {
    // La frase existe: es del único historial de chat real del repo, y está mal
    // escrita de dos formas a la vez. Los 128 imperativos de los tests de Ánima
    // I están en castellano perfecto; calibrar sólo contra ellos sería calibrar
    // contra un usuario que no existe.
    const c = leer('construi una ahoguera', OPC).clausulas[0]
    expect(c?.verbo).toBe('hacer')
    expect(c?.firma).toBe('emitsPower>0')
    console.log(`  «construi una ahoguera» → ${String(c?.firma)} con confianza ${c?.confianza.toFixed(2) ?? '—'}`)
  })

  it('y la confianza baja: entendió, pero menos', () => {
    const mal = leer('construi una ahoguera', OPC).confianza
    const bien = leer('construí una hoguera', OPC).confianza
    expect(mal).toBeLessThan(bien)
  })
})

describe('lo que NO se puede pedir, y se dice', () => {
  it('«andá al río» no es una meta: sale como orientación', () => {
    // Medido antes de escribir esto: `Predicado` no puede hablar del lugar. Se
    // probó con `wet>=0.9`, `at.x>=8` y `distance<=1` y los tres dan
    // `interpretar → undefined`. La respuesta honesta no es inventar un
    // predicado —sería una meta que el planificador persigue de verdad— sino
    // decir que se entendió hacia dónde mirar.
    const c = leer('andá al río', OPC).clausulas[0]
    expect(c?.verbo).toBe('ir')
    expect(c?.firma).toBeUndefined()
    expect(c?.grado).toBe('orientacion')
    console.log(`  «andá al río» → ${String(c?.porque)}`)
  })

  it('«traé un palo» se entiende y NO tiene camino', () => {
    // El otro medido: 6 de los 7 `holding(tag:X)` dan `gap`. La criatura sólo
    // sabe conseguir carne. Que esto salga `sin-camino` y no `entendida` es la
    // diferencia entre avisar y mandar a alguien a un viaje que no termina.
    //
    // Sale `fibroso` y no `vegetal`, que es lo que uno escribiría a ojo: `tagDe`
    // elige el tag MÁS ESPECÍFICO contándolo del catálogo, y `fibroso` cubre
    // menos sustancias que `vegetal`. Lo escribo con el número al lado porque la
    // primera versión de este test afirmaba `vegetal` copiándolo de un informe
    // en vez de mirarlo salir.
    const c = leer('traé un palo', OPC).clausulas[0]
    expect(c?.firma).toBe('holding(tag:fibroso)')
    expect(c?.grado).toBe('sin-camino')
    console.log(`  «traé un palo» → ${String(c?.porque)}`)
  })

  it('y «pescá algo» sí lo tiene', () => {
    const c = leer('pescá algo', OPC).clausulas[0]
    expect(c?.firma).toBe('holding(tag:carnoso)')
    expect(c?.grado).toBe('entendida')
  })
})

describe('lo que YA ESTÁ se dice, no se persigue en silencio', () => {
  // ─── DE DÓNDE SALE ESTE GRADO ────────────────────────────────────────────
  //
  // De medir por qué «fabricá una trampa para peces» no hacía nada. La orden
  // llegaba bien y la mente la DESCARTABA, con razón: `Predicado` es
  // existencial, así que `catch>0` quiere decir «que haya algo que atrape a la
  // vista» y no «que vos hagas uno». Medido sobre la escena canónica en el
  // tick 40, `catch>0` y `reach>=2` ya están cumplidas.
  //
  // Descartar una meta cumplida es CORRECTO —perseguir lo que ya tenés te deja
  // parado, y `tomarMeta` lo dice en su comentario—. Lo que estaba mal es que
  // nadie lo decía: desde afuera se ve exactamente igual que «no me hace caso».
  const yaEsta = (f: string): boolean => f === 'catch>0'
  const CON_MUNDO = { ...OPC, yaEstaCumplida: yaEsta }

  it('la misma frase cambia de grado según el mundo, y sólo por eso', () => {
    const sin = leer('fabricá una trampa para peces', OPC).clausulas[0]
    const con = leer('fabricá una trampa para peces', CON_MUNDO).clausulas[0]
    expect(sin?.grado).toBe('entendida')
    expect(con?.grado).toBe('ya-esta')
    // La firma NO cambia: lo que cambió es el mundo, no la lectura.
    expect(con?.firma).toBe(sin?.firma)
  })

  it('y el acuse lo dice en vez de prometer', () => {
    const l = leer('fabricá una trampa para peces', CON_MUNDO)
    expect(l.acuse).toContain('ya está')
    // El control: la misma frase sin el mundo puesto promete.
    expect(leer('fabricá una trampa para peces', OPC).acuse).toBe('dale, voy')
  })

  it('no se convierte en objetivo, y el aviso no se disculpa', () => {
    const p = objetivosDe(leer('fabricá una trampa para peces', CON_MUNDO))
    expect(p.nodos.length).toBe(0)
    expect(p.descartes[0]?.porque).toContain('ya está')
  })

  it('y lo que NO está cumplido sigue yendo', () => {
    // El control de que el portón no se comió todo: con el mismo gancho puesto,
    // una meta que no está cumplida sale `entendida` y llega a nodo.
    const l = leer('hacé fuego', CON_MUNDO)
    expect(l.clausulas[0]?.grado).toBe('entendida')
    expect(objetivosDe(l).nodos.length).toBe(1)
  })
})
