// Tanda 1 — `volver-en-vez-de-re-explorar`.
//
// RECONSTRUIDO POR LA AUDITORÍA DE COMPLETITUD. El informe lo declara la
// ÚNICA capacidad SALE_YA de las veinte, y no había archivo: `volver-…`,
// `secar-fibra-mojada` y `forjar-el-aparejo-que-falta` no existen en
// `borradores/`. El único número positivo del veredicto (1 de 20) no tenía
// evidencia. Esta es la reconstrucción literal de la fila 1 del informe:
// «recall → goTo(p.at) → verificar con see() → contabilizar el fallo en
// ctx.memory».
//
// ─── RESULTADO 1: sí, compila limpio. La fila acierta en tipos. ─────────────
//
// ─── RESULTADO 2: y aun así NO pasa su propia prueba de aceptación. ─────────
//
// T1.3 le pone dos controles y con esta superficie falla los dos:
//
//   Control A — «mover el recurso entre episodios → tiene que re-explorar, no
//   plantarse». `recall` filtra por cualidad de CELDA ('wet'), no por el
//   cuerpo. Si el pozo sigue mojado y el pez se fue, `see()` devuelve el agua
//   igual y la habilidad devuelve `done`. No re-explora: se planta.
//
//   Control B — «agotar el stock sin cambiar la celda mojada → tiene que
//   desistir, no pescar en un pozo vacío». Idéntico: nada distingue «no hay»
//   de «no sé». Lo único que lo distinguiría es `q(agua,'stock')`, y la
//   prueba T2.4 del mismo informe declara que leer 'stock' es TRAMPA y hace
//   fallar el test. O sea: el informe pide desistir por una lectura que él
//   mismo prohíbe, en dos pruebas separadas que nunca se cruzaron.
//
// Y el `PlaceMemory` sin `atTick` (HUECO 6) hace que el contador de fallos de
// abajo no pueda caducar el recuerdo: cuenta fracasos y no puede olvidar.
//
// Casillero corregido: FALTA_API, no SALE_YA. Sale la caminata, no la
// capacidad. Con esto el reparto queda 0 de 20 saliendo hoy.

import type { Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

export function* volverEnVezDeReExplorar(
  ctx: Ctx,
  _args: Record<string, never>,
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('recordar')

  const sitios = ctx.recall([{ q: 'wet', op: '>=', v: 0.9 }])
  const p = sitios[0]
  if (!p) return fail('no me acuerdo de ningún pozo')

  ctx.phase('volver')
  const ir = yield ctx.goTo(p.at, { within: 1 })
  if (ir.status !== 'arrived') return fail('no llegué a lo que recordaba')

  ctx.phase('verificar')
  const agua = ctx.see([{ q: 'wet', op: '>=', v: 0.9 }])[0]
  if (!agua) {
    // Contabilizar el fallo: lo único que la superficie permite hacer con un
    // recuerdo desmentido. No hay forma de borrar el recuerdo ni de fecharlo.
    const fallos = ctx.memory.get<number>('recuerdos-fallados') ?? 0
    ctx.memory.set('recuerdos-fallados', fallos + 1)
    return fail('el recuerdo mintió')
  }

  // Acá devuelve `done` tanto si el pozo tiene peces como si se agotó: la
  // superficie no tiene con qué distinguirlo. Ver RESULTADO 2.
  return done(agua)
}
