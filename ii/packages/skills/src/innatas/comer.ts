// INNATA 4/15 · «comer» — el bucle central del juego.

import type { BodyView, Ctx, Intent, Outcome, StepResult } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'
import { alAlcance, distancia, enLaMano, porCercania } from './comun.js'

export const CONTRATO_COMER: Contrato = {
  nombre: 'comer',
  establece: [{ sujeto: 'yo', q: 'stamina', op: '>', v: 0 }],
  precondiciones: [
    // Las DOS de verdad, leídas del mundo (`world/src/step.ts:1015`), y las dos
    // se pueden escribir con lo que la superficie da. No hay una tercera.
    { sujeto: 'el-objetivo', q: 'calories', op: '>', v: 0 },
    { sujeto: 'yo', q: 'permits', op: '==', v: 2 }, // irreversible: `eat` lo es
  ],
  cuesta: { segundos: 0, commitment: 'irreversible' },
  huecos: [
    'LA VISTA CONGELADA: `ctx.self` y `ctx.clock` son PROPIEDADES y no métodos. Un generador recibe `ctx` una sola vez; si el ejecutor no muta ese objeto en su lugar, la habilidad nunca ve lo que acaba de hacer. `see()` y `q()` no tienen el problema porque son métodos. La API no dice cuál de las dos lecturas vale, y con la equivocada esta habilidad se rompe. Medido: corriendo las quince, cinco fallaron a la vez por esto. Y `src/ejecutor.ts` llegó a lo mismo por el otro lado y lo dejó escrito como contrato EN PROSA sobre `WorldCtx` —el mundo refresca el objeto en su lugar—, o sea que la lectura correcta existe y vive en un comentario que el modelo no lee: `skill-api.d.ts`, que ES el prompt, no la menciona',
    'EL VENENO SE COBRA Y NO SE PUEDE PRESUPUESTAR. Hasta el ADR II-0013 este hueco decía que `grep toxicity` sobre `@anima/world/src` devolvía CERO y que comer veneno era igual de bueno que comer pescado fresco. YA NO: el mundo descuenta `toxicity · masa · COSTO_POR_TOXICIDAD_Y_KILO` de `stamina` al tragar, con su evento `enveneno` (medido: 12,5000 por 2 kg de pescado crudo). Lo que queda vivo del hueco es la otra mitad, y es la misma del hueco 4: `STAMINA_POR_CALORIA` y `COSTO_POR_TOXICIDAD_Y_KILO` viven en `@anima/world` y la superficie no publica ninguna de las dos, así que desde acá se pueden COMPARAR bocados por `toxicity` pero no calcular el NETO —`calories · S − toxicity · masa · K`—, que es el único número con el que se decide si conviene tragar. Quien sí lo calcula es `mordidaDe` de `@anima/mind`, importando las dos constantes: código de la casa haciendo algo que el código del modelo no puede hacer',
    'no hay `can()` para las primitivas: `eat` es el único acto `irreversible` cotidiano y no tiene ensayo en seco. `nada-que-comer` y `no-esta-a-mano` se pueden anticipar leyendo `calories` y la distancia; que haya que reconstruirlos a mano es reimplementar el juez del mundo del lado del código generado',
    'no hay `hunger`, y eso es CORRECTO y está bien dicho en la API: la física no tiene esa cualidad y lo que duele es la `stamina`. Lo que falta es la otra mitad: no hay techo publicado de `stamina`, así que «estoy llena» no se puede escribir y comer no tiene condición de parada',
    'no se puede saber cuánto va a rendir: `STAMINA_POR_CALORIA` (=1 hoy) es una constante de `@anima/world` que la superficie no publica. `calories` sí se lee, así que se puede COMPARAR entre bocados, que es lo que hace falta para elegir — pero no PRESUPUESTAR, que es lo que hace falta para decidir si conviene caminar veinte celdas',
  ],
}

/**
 * CONTRATO
 *   establece   `stamina` sube en `calories · STAMINA_POR_CALORIA`; el bocado
 *               deja de existir
 *   precondiciones  `calories > 0`, estar al alcance (en la mano o Chebyshev ≤ 1),
 *                   y `self.permits === 'irreversible'`
 *   cuesta      un tick, e IRREVERSIBLE: el bocado se destruye
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LO QUE EL LENTE DE EXCESO DE CELO PIDIÓ VERIFICAR, VERIFICADO: **SÍ SE PUEDE.**
 *
 * Y se puede COMPLETO, sin cablear un solo número. La precondición real del
 * mundo es `calories > 0` (más `nutrition · mass > 0`, que es lo mismo salvo
 * que `digestibility` sea cero), y `calories` es cualidad DERIVADA del
 * catálogo: `ctx.q(b, 'calories')` la contesta. La otra es estar al alcance, y
 * la métrica está verificada contra `aMano()`. No hay ninguna cota de rol que
 * adivinar.
 *
 * IMPORTANTE, PORQUE ESTUVE A PUNTO DE ESCRIBIR LO CONTRARIO: la primera
 * versión de este archivo cableó `nutrition ≥ 5`, `digestibility ≥ 0.5` y
 * `mass ∈ [0.2, 2]`, sacados del `Process` llamado `comer` de
 * `physics/tests/ataque2-exceso-de-celo.test.ts:752`. **Ese proceso no
 * gobierna nada**: es el proceso de PRUEBA con el que el adversario demostró
 * que `admit()` ya acepta una conversión entre dos conservadas. El comer real
 * es la primitiva `eat` de `stepWorld`, y no pasa por `admit()` ni tiene roles.
 * Cablear esos cuatro números habría hecho que la criatura rechazara comida
 * perfectamente comestible por una regla que no existe. Queda escrito porque
 * es el error que el modelo va a cometer: la física tiene DOS cosas llamadas
 * «comer» y sólo una manda.
 *
 * La reparación de la física está y funciona (`esConversionAdmisible`,
 * `admit.ts:1561`) y es la que habilita que alguna vez `comer` sea un proceso
 * de verdad. Del lado de la superficie, `ctx.eat` alcanza hoy.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * POR QUÉ ELIGE POR `calories` Y NO POR `nutrition`: `nutrition` es INTENSIVA
 * —por unidad de masa— y `calories` es la derivada que ya multiplica por masa y
 * por digestibilidad; es además, literalmente, lo que el mundo acredita.
 * Elegir por `nutrition` haría preferir una miga concentrada antes que un
 * pescado entero.
 */
export function* comer(
  ctx: Ctx,
  args: { bocado?: BodyView; toxicidadTolerada?: number },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('comer')

  // La cuarentena, VISIBLE desde adentro. Una habilidad `provisional` entra con
  // `permits: 'reversible'` y `eat` es `irreversible`: el mundo la rechazaría
  // con `sin-permiso`. Poder mirarlo antes es lo que permite elegir el camino
  // barato en vez de chocar, y es una de las cosas que la API ganó.
  if (ctx.self.permits !== 'irreversible') {
    return fail('todavía no tengo permiso para hacer algo irreversible')
  }

  // `toxicity` DEFIENDE DE ALGO REAL desde el ADR II-0013: el mundo cobra
  // `toxicity · masa · COSTO_POR_TOXICIDAD_Y_KILO` de `stamina` al tragar, por
  // separado de lo que las calorías acreditan (ver hueco 1, reescrito). Sigue
  // siendo un parámetro y no una constante porque el umbral que conviene depende
  // de cuánto lugar quede en el tanque —lo acreditado se topa contra el techo y
  // el veneno se cobra entero—, y esa cuenta necesita las dos constantes de
  // `@anima/world` que la superficie no publica.
  const veneno = args.toxicidadTolerada ?? 0.2
  // ─── Y LO PRIMERO QUE SE DESCARTA ES UNO MISMO ────────────────────────────
  //
  // `SelfView extends BodyView` a propósito —para que la criatura pueda pasarse
  // a sí misma como rol de un proceso, que es el paso 1 de encender el primer
  // fuego—, así que `ctx.see()` DEVUELVE el propio cuerpo. Y lo devuelve con más
  // calorías que la comida de al lado: medido, 6,30 de la carne propia contra
  // 4,56 del pescado. Como acá se ordena por calorías descendentes y la mano se
  // mira antes que la vista, el propio cuerpo no competía con la comida: le
  // ganaba por los dos lados. Lo único que separaba a la criatura de comerse sola
  // era el choque de dos números que nadie coordinó (carne cruda 0,30 contra el
  // 0,2 de acá), y `toxicidadTolerada` es una perilla legítima que lo borra.
  //
  // El filtro va acá y no en `Proyeccion.aLaVista`: sacarse de `see()` rompería
  // el rol de proceso. El mundo tiene su propia guarda (`es-uno-mismo`) y hacen
  // falta las dos — ésta la escribe el modelo, aquélla no se negocia.
  const soyYo = (b: BodyView): boolean => b.id === ctx.self.id
  const comestible = (b: BodyView): boolean =>
    !soyYo(b) && ctx.q(b, 'calories') > 0 && ctx.q(b, 'toxicity') <= veneno

  let bocado = args.bocado
  if (bocado && soyYo(bocado)) return fail('ése soy yo')
  if (bocado && !comestible(bocado)) return fail(`${bocado.name} no alimenta`)

  if (!bocado) {
    // Primero lo que ya tengo en la mano: no cuesta caminar, y comer lo que se
    // lleva encima es lo que evita cargarlo hasta que se pudra.
    const enMano = ctx.self.holding.filter(comestible)
    const aLaVista = ctx.see([{ q: 'calories', op: '>', v: 0 }]).filter((b) => comestible(b) && b.heldBy === undefined)
    // El más calórico; entre empates de calorías, el más cercano.
    bocado = porCercania(enMano.length > 0 ? enMano : aLaVista, ctx.self.at).sort(
      (p, q) => ctx.q(q, 'calories') - ctx.q(p, 'calories'),
    )[0]
  }

  if (!bocado) return fail('no hay nada que alimente a la vista')

  // El mundo pide `aMano`: en la mano O Chebyshev ≤ 1. NO hace falta levantarlo,
  // y no levantarlo ahorra un tick y evita `manos-llenas`. Que la precondición
  // sea ésa y no «tenerlo» sólo se sabe leyendo `stepWorld`; la superficie no
  // lo dice, y `hacerle-lugar` es lo que haría cualquiera por las dudas.
  if (!alAlcance(ctx.self, bocado)) {
    const irA = yield ctx.goTo(bocado, { within: 1 })
    if (irA.status !== 'arrived') return fail('no llegué al bocado')
  }

  const intento = ctx.eat(bocado)
  // `Intent.commitment` es público y el mundo lo RECALCULA: si esto dejara de
  // ser irreversible, la cuarentena de arriba estaría de más y hay que enterarse.
  if (intento.commitment !== 'irreversible') ctx.say('comer dejó de ser irreversible')

  const r = yield intento
  if (r.status === 'done') return done()
  if (r.por === 'nada-que-comer') return fail('parecía comida y no alimenta')
  if (r.por === 'no-esta-a-mano') return fail('se me fue de las manos')
  return fail(`el mundo no me dejó comer: ${r.status}`)
}

/**
 * Lo que rinde un bocado DESCONTANDO ir a buscarlo, en unidades de caloría.
 *
 * Es comparable entre bocados y NO es stamina: `STAMINA_POR_CALORIA` vive en
 * `@anima/world` y la superficie no la publica (hueco 4). Y el descuento por
 * distancia es una invención de este archivo por la misma razón: `COSTO_PASO`
 * tampoco se publica, así que «caminar veinte celdas por ese pescado» no se
 * puede decidir con datos. El `0` de abajo es esa ignorancia, escrita.
 */
export function rinde(ctx: Ctx, b: BodyView, costoPorCelda = 0): number {
  const lejos = enLaMano(ctx.self, b) ? 0 : distancia(ctx.self.at, b.at)
  return ctx.q(b, 'calories') - lejos * costoPorCelda
}
