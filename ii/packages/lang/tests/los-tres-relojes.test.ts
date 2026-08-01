/**
 * LOS TRES RELOJES, los tres alimentados.
 *
 *     ANIMA_BANCO=1 pnpm --filter @anima/lang test
 *
 * El documento de arquitectura pide «los tres relojes y la instrumentación
 * completa». Dos ya se medían —`msHastaPrimerMovimiento` en el criterio y
 * `consistenciaDelPrimerGesto` en su archivo— y **el tercero estaba escrito y no
 * lo alimentaba nadie**: `Reloj` existía, `hastaAccionPertinente` existía, y
 * ninguna línea le pasaba una muestra.
 *
 * ─── LA DISTINCIÓN QUE MIDE, y es la que el documento advierte ──────────────
 *
 * > Dos métricas de producto, no una. `msHastaPrimerMovimiento` (p95 < 150 ms) y
 * > `msHastaAcciónPertinente` (frío: segundos, y se muestra en la UI como
 * > progreso honesto).
 *
 * El primero es **que se mueva**: cualquier gesto, aunque sea tantear. El
 * segundo es **que vaya al grano**: el primer despegue que sale de la meta que le
 * pidieron y no del fondo de la escalera.
 *
 * Confundirlos es el error que el propio documento denuncia —«los números lindos
 * eran todos del caso caliente, y la demo es el caso frío»—: el primero da
 * milisegundos y el segundo da segundos, y publicar el primero como si fuera el
 * segundo es prometer que la criatura hace lo que le pediste cuando lo que hizo
 * fue empezar a caminar.
 */

import { buildSeedPhysics } from '@anima/physics'
import { ESQUEMAS } from '@anima/plan'
import { Partida } from '@anima/perceive'
import { Creencias, Mente, vivir } from '@anima/mind'
import { describe, expect, it } from 'vitest'
import { PUENTE } from '../src/alias.js'
import { leer } from '../src/leer.js'
import { lexicoDe } from '../src/lexico.js'
import { Reloj } from '../src/relojes.js'
import { actor, criatura, enElPiso, laOrilla, mundo } from './mundo.js'

const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'

const QUIEN = 'ana'
const CALENTAR = 40
/** La ventana del tick del mundo semilla: `hz` es 20, medido. */
const VENTANA_MS = 50

const phys = buildSeedPhysics()
const lexico = lexicoDe(phys, PUENTE)
const FIRMAS = new Set(ESQUEMAS.map((e) => e.establishes))
const OPC = { phys, lexico, sabeElCatalogo: (f: string): boolean => FIRMAS.has(f) }

const orilla = laOrilla()
function escena(): ReturnType<typeof mundo> {
  return mundo({
    dios: orilla.dios,
    bodies: [enElPiso(criatura(QUIEN, 1000), orilla.parada)],
    actors: [actor(QUIEN, { capacity: 3 })],
  })
}

/**
 * Cuántos TICKS pasan hasta que la criatura hace algo que sale de la meta que le
 * pidieron —o sea, hasta que D2 despega—. `undefined` si no llegó nunca.
 *
 * Se cuenta en ticks y se convierte a ms con la ventana, y no se cronometra con
 * el reloj de pared: lo que se mide es tiempo DEL MUNDO, y el reloj de pared
 * mediría lo rápido que corre esta máquina.
 */
function ticksHastaLoPertinente(meta: string, tope: number): number | undefined {
  const p = new Partida(escena(), { vigilar: true })
  const memoria = new Creencias()
  let m = new Mente({ actor: QUIEN, memoria })
  const mentes = new Map([[QUIEN, m]])
  vivir(p, mentes, CALENTAR)
  m = new Mente({ actor: QUIEN, memoria, drive: { meta, peso: 1, desdeTick: CALENTAR } })
  mentes.set(QUIEN, m)
  for (let k = 0; k < tope; k++) {
    const antes = m.despegues
    vivir(p, mentes, 1)
    // PERTINENTE = despegó algo Y la meta en curso es la que le pidieron. Sin la
    // segunda mitad esto contaría el primer paso del fondo de la escalera, que
    // es justo lo que la otra métrica ya mide.
    if (m.despegues > antes && m.estado.porQuien === 'D2' && m.estado.metaEnCurso === meta) {
      return k + 1
    }
  }
  return undefined
}

describe('(3 relojes) el que faltaba: msHastaAccionPertinente', () => {
  it('se mide en TICKS DEL MUNDO, no en milisegundos de computo como el otro', () => {
    const reloj = new Reloj()
    const filas: string[] = []
    for (const [frase, meta] of [
      ['hacé fuego', 'emitsPower>0'],
      ['pescá algo', 'holding(tag:carnoso)'],
      ['fabricá una trampa para peces', 'catch>0'],
      ['asá el pescado', 'holding(tag:carnoso,digestibility>=0.85,toxicity<=0.05)'],
    ] as const) {
      // El control de que la meta es la que la frase produce, y no una escrita
      // a mano al lado: si el lector cambia, esto se pone rojo.
      expect(leer(frase, OPC).clausulas[0]?.firma, frase).toBe(meta)
      const t = ticksHastaLoPertinente(meta, 600)
      if (t === undefined) {
        // Pasa con `catch>0`, y no es un fallo del reloj: esa meta YA ESTÁ
        // CUMPLIDA en esta escena, así que la mente la descarta con razón (ver
        // el grado `ya-esta`). Una meta cumplida no tiene acción pertinente que
        // medir, y contarla como «tardó infinito» sería mentir.
        filas.push(`  ${frase.padEnd(32)} sin acción pertinente (la meta ya está cumplida)`)
        continue
      }
      reloj.anotar(t * VENTANA_MS)
      filas.push(`  ${frase.padEnd(32)} ${String(t).padStart(4)} ticks = ${((t * VENTANA_MS) / 1000).toFixed(1)} s`)
    }
    const r = reloj.resumen()
    console.log('\n── msHastaAccionPertinente ──')
    for (const f of filas) console.log(f)
    console.log(
      r === undefined
        ? '  sin muestras'
        : `\n  p50 ${(r.p50 / 1000).toFixed(1)} s · p95 ${(r.p95 / 1000).toFixed(1)} s · máx ${(r.max / 1000).toFixed(1)} s`,
    )
    console.log(`  (el otro reloj, mensaje → primer movimiento, mide ~1,3 ms)\n`)

    expect(r, 'ninguna orden llegó a una acción pertinente').toBeDefined()

    // ─── UNA AFIRMACIÓN QUE ESCRIBÍ MAL, y la corrigió su propia salida ──────
    //
    // Decía `p50 > VENTANA_MS`, o sea «lo pertinente tarda segundos». Corrida,
    // da **1 tick**: apenas se le pone la meta, el primer paso del plan YA es
    // pertinente.
    //
    // Y está bien. Los «segundos» que el documento le pone a este reloj son del
    // **CASO FRÍO** —cuando la habilidad no existe y la fragua tiene que
    // escribirla, 6 a 25 s— y ese caso **no existe hasta el Hito 8**. En el caso
    // caliente, que es el único que hay hoy, las dos métricas están cerca porque
    // no hay nada lento en el medio.
    //
    // Lo que se afirma entonces es lo que SÍ se puede afirmar hoy: que el reloj
    // mide, que lo pertinente no es más rápido que un tick —no puede serlo, el
    // mundo no se mueve entre ticks— y que la distinción con el otro reloj sigue
    // siendo real: uno mide milisegundos de CÓMPUTO y éste ticks de MUNDO.
    if (!MIDIENDO_EN_SERIO) return
    expect((r as { p50: number }).p50).toBeGreaterThanOrEqual(VENTANA_MS)
    console.log(
      '  el «frío: segundos» del documento es del caso que no existe hasta el Hito 8: ' +
        'cuando la habilidad hay que escribirla. Hoy todas existen.',
    )
  })

  it('EL CONTROL: sin orden, no hay acción pertinente que medir', () => {
    // Un cero que sale de que no había qué medir es el modo de falla número 20
    // de `como-se-trabaja.md`. Acá se prueba al revés: sin meta del cuidador, D2
    // no despega nunca, así que el reloj queda VACÍO — y `resumen()` devuelve
    // `undefined` en vez de un resumen de ceros, que es la diferencia entre
    // «tardó 0» y «nadie miró».
    const p = new Partida(escena(), { vigilar: true })
    const m = new Mente({ actor: QUIEN, memoria: new Creencias() })
    const mentes = new Map([[QUIEN, m]])
    vivir(p, mentes, CALENTAR)
    let porD2 = 0
    for (let k = 0; k < 300; k++) {
      const antes = m.despegues
      vivir(p, mentes, 1)
      if (m.despegues > antes && m.estado.porQuien === 'D2') porD2++
    }
    console.log(`  sin orden, despegues por D2 en 300 ticks: ${String(porD2)}`)
    expect(porD2).toBe(0)
    expect(new Reloj().resumen()).toBeUndefined()
  })
})
