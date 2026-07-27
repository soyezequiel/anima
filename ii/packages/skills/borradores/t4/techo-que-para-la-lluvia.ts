// TANDA 4 · «Sabe hacerse un techo y saber que la tapa»
// ESCRITOR — habilidad escrita entera, no sonda. El árbitro es `tsc`.
//
// Fuente del veredicto que se pone a prueba: el crítico dijo NECESITA_LEY con
// cinco errores ('raining', 'sheltered' y 'covers' fuera de QualityId; `place`
// fuera de Ctx; 'cavar' fuera de ProcessId) y con este razonamiento: el corazón
// de refugiarse es la OCLUSIÓN, y ninguna de las once leyes calcula que una
// cosa tape a otra.
//
// ─── LO QUE ENCONTRÓ EL COMPILADOR ─────────────────────────────────────────
//
// Confirma los cinco, y agrega tres hallazgos que la sonda no tenía. Los tres
// son peores que los cinco, porque los cinco los ataja el compilador y estos no:
//
// HALLAZGO A — el ensamble de profundidad 3 COMPILA sin una queja.
//   `MAX_ASSEMBLY_DEPTH = 2` es una constante de @anima/physics/body.ts; no
//   está en la superficie que ve el código generado. Encadenar
//   `apply('union', …)` sobre el cuerpo que salió de otro `apply('union', …)`
//   —postes + travesaño + cubierta— pasa tipos, y pasa `admit()`, y va a pasar
//   el smoke con las precondiciones ya satisfechas. La cota que decide si el
//   refugio es construible es invisible en el único lugar donde se la podría
//   respetar. Ver `armarLaCubierta` abajo: tres uniones anidadas, cero errores.
//
// HALLAZGO B — `apply()` no valida roles. `roles: Record<string, BodyView>`
//   acepta CUALQUIER nombre de rol. `ctx.apply('union', { techo: x, mundo: y })`
//   compila. El vocabulario cerrado cierra sobre `ProcessId` y se abre entero
//   un carácter después. La mitad de la promesa del árbitro mecánico —«si una
//   capacidad necesita algo que no existe, es error de tipos»— no vale para
//   roles, que es donde vive el significado del proceso.
//
// HALLAZGO C — `recall()` devuelve coordenadas sin contenido (HUECO 6:
//   `PlaceMemory` es `{ at }`). O sea que «no lo sale a rescatar cuando llueve»
//   —la conducta falsable de esta capacidad— exige estar parada ahí para saber
//   qué hay debajo del techo. Recordar dónde guardó la fibra no le dice que la
//   fibra siga estando.
//
// Y la observación que vuelve al veredicto: lo único de toda la capacidad que
// se puede escribir bien es la FALSACIÓN. `ctx.q(fibra, 'moisture')` compila,
// así que la criatura puede medir que su techo NO tapa. Puede descubrir que
// falló; no puede construir el que funcione. Veredicto sostenido: NECESITA_LEY.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

/** Chebyshev sobre la grilla. Puro, entero, sin `Math`. */
function lejos(a: Cell, b: Cell): number {
  const dx = a.x > b.x ? a.x - b.x : b.x - a.x
  const dy = a.y > b.y ? a.y - b.y : b.y - a.y
  return dx > dy ? dx : dy
}

export function* techoQueParaLaLluvia(
  ctx: Ctx,
  args: { fibra: BodyView; cubierta: BodyView },
): Generator<Intent, Outcome, StepResult> {
  // ── 1. ¿Dónde guardo mis cosas? ──────────────────────────────────────────
  ctx.phase('elegir-el-lugar')

  // Esto compila: `recall` filtra por cualidades, así que «el lugar donde
  // tengo leña» es expresable.
  const despensa = ctx.recall([{ q: 'fuelEnergy', op: '>', v: 0 }])[0]
  const sitio: Cell = despensa ? despensa.at : ctx.self.at

  // HUECO 6 — pero el recuerdo es una coordenada pelada. Para decidir si vale
  // la pena taparlo necesito saber QUÉ hay ahí, y el recuerdo no lo dice.
  const queHabia = despensa?.what

  // ── 2. ¿Llueve? ──────────────────────────────────────────────────────────
  ctx.phase('mirar-el-cielo')

  // ✗ ERROR — no hay lluvia en el mundo. 'wet' existe (mal declarada: HUECO 1)
  //   como cualidad de lo mojado, pero no hay fenómeno que moje desde arriba
  //   ni forma de preguntar por el clima. La lluvia aparece UNA vez en todo el
  //   documento: como parámetro adversario del banco del juez. No es mundo.
  const llueve = ctx.see([{ q: 'raining', op: '>', v: 0 }]).length > 0
  if (llueve) ctx.say('me parece que se viene agua')

  // ── 3. Juntar postes ─────────────────────────────────────────────────────
  ctx.phase('juntar-postes')

  const varas = ctx.see([
    { q: 'rigidity', op: '>=', v: 0.6 },
    { q: 'portable', op: '>=', v: 1 },
  ])
  if (varas.length < 2) return fail('no hay con qué pararlo')

  const a = varas[0]
  const b = varas[1]
  if (!a || !b) return fail('no hay con qué pararlo') // HALLAZGO 1 del borrador 00

  for (const v of [a, b]) {
    const r = yield ctx.take(v)
    if (r.status !== 'done') return fail('no pude levantar la vara')
  }

  // ── 4. Plantarlos ────────────────────────────────────────────────────────
  ctx.phase('plantar')

  // No hay cuerpo «suelo»: lo más parecido es lo que tiene piso.
  const suelo = ctx.see([{ q: 'footing', op: '>', v: 0 }])[0]
  if (!suelo) return fail('no hay suelo')

  // ✗ ERROR — 'cavar' no es ProcessId. Sin cavar no hay poste plantado, y
  //   tampoco existe la otra forma obvia de refugio, que es el hoyo. Los
  //   procesos invocables son cuatro y ninguno mueve tierra.
  yield ctx.apply('cavar', { ground: suelo, tool: a })

  // ── 5. Armar la cubierta ─────────────────────────────────────────────────
  const cubierta = yield* armarLaCubierta(ctx, a, b, args.fibra, args.cubierta)
  if (!cubierta) return fail('no me salió la cubierta')

  // ── 6. Colocarla ─────────────────────────────────────────────────────────
  ctx.phase('colocar')

  // ✗ ERROR — `place` no está en Ctx, y `Blueprint` no está en ningún lado.
  //   `put` coloca UN cuerpo en UNA celda; una obra son varios cuerpos con
  //   posiciones relativas entre sí. El ADR 0032 lo resolvió en Ánima I y no
  //   está portado.
  yield ctx.place({ blueprint: 'refugio', at: sitio, sobre: [a, b] })

  // …y esto sí compila, y es el sustituto que va a escribir el modelo:
  const apoyo = yield ctx.put(cubierta, sitio, { onTopOf: a })
  if (apoyo.status !== 'done') return fail('no se apoyó')

  // ── 7. Saber que tapa ────────────────────────────────────────────────────
  ctx.phase('verificar')

  // ✗ ERROR — 'covers' no es cualidad: nada expresa «este cuerpo tapa a aquél».
  const tapa = ctx.q(cubierta, 'covers')

  // ✗ ERROR — 'sheltered' tampoco: no hay forma de preguntar si una cosa está
  //   cubierta. Y el delator está en el motor: la ley 4 usa `w.oxygenAt(b.at)`
  //   con el comentario «baja si está tapado». La oclusión YA se asume, sin ley
  //   que la defina y sin cualidad que la exprese.
  const debajo = ctx.see([{ q: 'sheltered', op: '>=', v: 0.8 }])
  if (debajo.length === 0) ctx.say('creo que no tapa nada')

  // ── 8. Comportarse como si funcionara ────────────────────────────────────
  // Acá está lo único de la capacidad que se puede escribir bien: la
  // FALSACIÓN. `moisture` es cualidad con ley, así que dejar la fibra abajo y
  // medirla después COMPILA. La criatura puede demostrar que su techo no
  // sirve. Lo que no puede es construir uno que sirva.
  ctx.phase('confiar')

  const deja = yield ctx.put(args.fibra, sitio)
  if (deja.status !== 'done') return fail('no pude dejar la fibra')

  const secoAntes = ctx.q(args.fibra, 'moisture')
  ctx.memory.set('humedadAlGuardar', secoAntes)
  ctx.memory.set('techo', cubierta.id)
  ctx.memory.set('bajoTecho', sitio)

  // No la sale a rescatar: se aleja y espera.
  const lejano: Cell = { x: sitio.x + 6, y: sitio.y }
  const irse = yield ctx.goTo(lejano)
  if (irse.status !== 'arrived') return fail('no me pude alejar')

  for (let i = 0; i < 200; i++) {
    const esperar = yield ctx.explore({ until: () => false, maxTicks: 1 })
    if (esperar.status === 'rejected') break
  }

  const irVer = yield ctx.goTo(sitio, { within: 1 })
  if (irVer.status !== 'arrived') return fail('no volví')

  const mojadoDespues = ctx.q(args.fibra, 'moisture')
  const guardado = ctx.memory.get<number>('humedadAlGuardar') ?? secoAntes
  if (mojadoDespues > guardado + 0.2) {
    ctx.say('lo tapé y se mojó igual')
    return fail('el techo no tapa: la humedad subió abajo de él')
  }

  if (lejos(ctx.self.at, sitio) > 1) return fail('no llegué a mi propio techo')
  return done(cubierta)
}

/**
 * Postes + travesaño + cubierta.
 *
 * HALLAZGO A: esto es profundidad 3 de ensamble y NO DA UN SOLO ERROR.
 * `MAX_ASSEMBLY_DEPTH = 2` vive en @anima/physics/body.ts y no llega a la
 * superficie del código generado. El compilador no puede saber que el último
 * `union` es ilegal, y el apéndice admite que la cota no está verificada en
 * ningún test. La capacidad más cara de la escalera se rompe contra una
 * constante que nada revisa.
 *
 * HALLAZGO B: los nombres de rol son `Record<string, BodyView>`. Acá abajo
 * inventé 'binder', 'a', 'b', 'techo' y 'mundo' y todos compilan igual. El
 * significado del proceso vive en los roles, y los roles no están tipados.
 */
function* armarLaCubierta(
  ctx: Ctx,
  posteA: BodyView,
  posteB: BodyView,
  fibra: BodyView,
  malla: BodyView,
): Generator<Intent, BodyView | undefined, StepResult> {
  ctx.phase('armar-la-cubierta')

  const puede = ctx.can('union', { binder: fibra, a: posteA, b: posteB })
  if (!puede.ok) return undefined

  // profundidad 1
  const u1 = yield ctx.apply('union', { binder: fibra, a: posteA, b: posteB })
  const travesano = u1.got[0]
  if (!travesano) return undefined

  // profundidad 2
  const u2 = yield ctx.apply('union', { binder: fibra, a: travesano, b: malla })
  const media = u2.got[0]
  if (!media) return undefined

  // profundidad 3 — ilegal en el motor, invisible para el compilador.
  // Y de paso: roles inventados, cero quejas.
  const u3 = yield ctx.apply('union', { techo: media, mundo: malla, binder: fibra })
  return u3.got[0] ?? media
}

// ─── SALIDA LITERAL DE tsc ──────────────────────────────────────────────────
// pnpm exec tsc -p ii/packages/skills/tsconfig.t4.json
//
// ii/packages/skills/borradores/t4/techo-que-para-la-lluvia.ts(66,30): error TS2339: Property 'what' does not exist on type 'PlaceMemory'.
// ii/packages/skills/borradores/t4/techo-que-para-la-lluvia.ts(75,29): error TS2322: Type '"raining"' is not assignable to type 'QualityId'.
// ii/packages/skills/borradores/t4/techo-que-para-la-lluvia.ts(106,19): error TS2345: Argument of type '"cavar"' is not assignable to parameter of type 'ProcessId'.
// ii/packages/skills/borradores/t4/techo-que-para-la-lluvia.ts(119,13): error TS2339: Property 'place' does not exist on type 'Ctx'.
// ii/packages/skills/borradores/t4/techo-que-para-la-lluvia.ts(129,32): error TS2345: Argument of type '"covers"' is not assignable to parameter of type 'QualityId'.
// ii/packages/skills/borradores/t4/techo-que-para-la-lluvia.ts(135,29): error TS2322: Type '"sheltered"' is not assignable to type 'QualityId'.
//
// Seis errores: los cinco del crítico más `PlaceMemory.what` (HALLAZGO C).
// Y CERO errores en `armarLaCubierta` (HALLAZGOS A y B) y cero en la fase de
// falsación. Lo que el compilador NO dijo es el resultado más importante de
// este archivo: la obra de profundidad 3 con roles inventados es, para el
// arnés, código impecable.
