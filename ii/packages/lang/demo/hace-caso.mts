/**
 * ¿HACE CASO? — el control que una lista de actividades no puede dar.
 *
 *     pnpm --filter @anima/lang hace-caso
 *
 * `hablarle.mts` muestra qué hizo la criatura después de una orden, y eso NO
 * alcanza para saber si la orden llegó: una criatura viva hace cosas todo el
 * tiempo. La única forma de saberlo es correr **la misma escena desde el mismo
 * tick sin la orden** y comparar.
 *
 * Es el modo de falla número 20 de `ii/docs/como-se-trabaja.md` —«un control que
 * da cero hay que probarlo primero contra el caso positivo»— dado vuelta: acá el
 * riesgo es el contrario, ver movimiento y creer que es obediencia.
 */

import { Partida } from '@anima/perceive'
import { Creencias, Mente, vivir } from '@anima/mind'
import { actor, criatura, enElPiso, laOrilla, mundo } from '../../mind/tests/mundo.js'

const QUIEN = 'ana'
const CALENTAR = 40
const DESPUES = 300

const orilla = laOrilla()
const escena = (): ReturnType<typeof mundo> =>
  mundo({
    dios: orilla.dios,
    bodies: [enElPiso(criatura(QUIEN, 310), orilla.parada)],
    actors: [actor(QUIEN, { capacity: 3 })],
  })

/** Qué hace la criatura en `DESPUES` ticks, con esta orden o sin ninguna. */
function corrida(meta?: string): string {
  const p = new Partida(escena(), { vigilar: true })
  const memoria = new Creencias()
  let m = new Mente({ actor: QUIEN, memoria })
  const mentes = new Map([[QUIEN, m]])
  vivir(p, mentes, CALENTAR)
  if (meta !== undefined) {
    m = new Mente({ actor: QUIEN, memoria, drive: { meta, peso: 1, desdeTick: CALENTAR } })
    mentes.set(QUIEN, m)
  }
  const cuenta = new Map<string, number>()
  for (let k = 0; k < DESPUES; k++) {
    const antes = m.despegues
    vivir(p, mentes, 1)
    if (m.despegues > antes) {
      const n = (m.ultimoDespegue ?? '?').split('(')[0] ?? '?'
      cuenta.set(n, (cuenta.get(n) ?? 0) + 1)
    }
  }
  return [...cuenta.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([n, v]) => `${n}×${String(v)}`)
    .join(' ')
}

const ORDENES: readonly (readonly [frase: string, meta: string])[] = [
  ['hacé fuego', 'emitsPower>0'],
  ['fabricá una trampa para peces', 'catch>0'],
  ['traé un palo', 'holding(tag:fibroso)'],
  ['pescá algo', 'holding(tag:carnoso)'],
  ['asá el pescado', 'holding(tag:carnoso,digestibility>=0.85,toxicity<=0.05)'],
]

console.log('\n══ ¿HACE CASO? ═════════════════════════════════════════════')
const sin = corrida()
console.log(`  (SIN ORDEN)                     ${sin}\n`)
for (const [frase, meta] of ORDENES) {
  const con = corrida(meta)
  const veredicto = con === sin ? 'NO HIZO NADA DISTINTO' : 'cambió'
  console.log(`  «${frase}»`)
  console.log(`     → ${meta}`)
  console.log(`     ${veredicto}: ${con}\n`)
}
console.log('════════════════════════════════════════════════════════════\n')
