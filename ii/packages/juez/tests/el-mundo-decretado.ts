// ─── EL MUNDO DECRETADO: la escena sobre la que se mide el Hito 5 ────────────
//
// No es un test: es la ESCENA que comparten el banco del criterio
// (`hito-5-la-emergencia.test.ts`) y su control (`azar.ts`). Vive aparte por una
// razón que la tanda anterior pagó cara: **si el arnés cambia de mundo y el
// control no, la comparación entre la mente y el dado deja de valer**. Con la
// escena en un archivo y el control en otro, esa divergencia es una edición que
// alguien se olvida de hacer; acá es imposible.
//
// ═══ POR QUÉ ESTE ARCHIVO EXISTE, Y ES LA CORRECCIÓN DE UN NÚMERO ═══════════
//
// El arnés del criterio ponía la escena A MANO —una vara de madera de 1 kg a tres
// celdas, un matorral de liana de 0,2 kg a dos y media— y después MEDÍA esa
// escena y sacaba conclusiones sobre el mundo. Publicó ésta:
//
//     encendible vara 1.0000 kg     ← en las VEINTE semillas, al cuarto decimal
//
// y de ahí «no puede haber fuego: el encendible más liviano pesa 1,0000 kg contra
// un techo de 0,7132». Veinte semillas distintas dando el mismo número al cuarto
// decimal no es un sorteo: era la línea del arnés, medida veinte veces.
//
// Lo que el dios decreta de verdad, medido en `lo-que-el-mundo-si-siembra.test.ts`
// sobre los mismos 9 chunks de arranque y las mismas veinte semillas:
//
//     semillas con al menos una vara encendible ... 13 de 20
//     la más liviana de las veinte ............... 0,0610 kg   (el techo es 0,7132)
//
// O sea: la conclusión era correcta SOBRE ESA ESCENA y falsa sobre el mundo.
//
// ═══ Y LA PREMISA DEL ENCARGO TAMBIÉN ERA FALSA, MEDIDA ═════════════════════
//
// El encargo de este tramo decía «los cuerpos sueltos que el dios siembra ya se
// materializan solos: lo que hay que sacar es la escena a mano». **No se
// materializan.** Medido acá antes de escribir una línea, con la escena vacía —una
// criatura sola en la orilla de `20260728n`, cinco ticks de `Partida`—:
//
//     el dios decretó en los 3×3 chunks de alrededor .......... 90 sueltas
//     el mundo materializó ................................... 0
//     lo único que trajo: pozo:-5:-2, pozo:-5:-3, pozo:-6:-2
//
// Es lo mismo que el bloque (1) del banco tiene en rojo desde la tanda anterior:
// `grep -rn "sueltas" world/src` devuelve UN renglón y es un comentario, y el paso
// en sombra de `Partida` (`conLoQueElDiosPone`) copia de la sombra únicamente lo
// que empieza con `pozo:`. Sacar la escena a mano y no poner nada en su lugar
// habría dejado a la criatura en un mundo con tres bancos de peces y NADA MÁS: el
// cero de las nueve secuencias se habría mantenido y habría medido todavía menos.
//
// ═══ QUÉ HACE ESTE ARCHIVO, ENTONCES ════════════════════════════════════════
//
// **Siembra lo que el dios decretó**, y nada más que eso. Sustancia, masa y celda
// de cada cuerpo salen de `decretoDe(...).chunk.sueltas`, o sea de la semilla; el
// arnés no elige QUÉ hay ni CUÁNTO pesa ni DÓNDE está. Los 3×3 chunks son la misma
// vecindad con la que el mundo materializa los pozos (`NUEVE` en
// `materializarPozos`), no un radio elegido acá.
//
// Es un RODEO DEL ARNÉS y no una reparación, exactamente como `nuevaFisica()` lo
// es de la caché sin semilla: la reparación es del motor —que `stepWorld`
// materialice `chunk.sueltas` como ya materializa `pozo`— y queda en rojo en el
// bloque (1) del banco, que sigue contando cuántos cuerpos pone el mundo POR SU
// CUENTA y sigue dando cero.
//
// ═══ QUÉ SEMILLAS SE JUEGAN, DICHO SIN EUFEMISMO ════════════════════════════
//
// Acá decía «no se descarta ninguna semilla: trece de las veinte tienen con qué
// encender y siete no; las siete se corren igual». Las dos mitades son ciertas por
// separado y JUNTAS MIENTEN, porque no hablan de la misma población. Lo que pasa
// de verdad, y lo publica el propio banco en su salida:
//
//     de las 20 semillas de §10, sólo 7 tienen orilla en 13×13 chunks;
//     las otras 13 SE DESCARTAN y se reemplazan en orden desde 20260748.
//
// O sea: trece de las veinte de §10 no se corren. Y la definición de «no resoluble»
// que habilita el reemplazo —no tener orilla— la eligió este tramo y no §10, así
// que va dicha y no supuesta: sin una celda seca pegada a un pozo la criatura no
// tiene dónde pararse a pescar, y una partida así no mide la mente sino el terreno.
//
// El «13 de 20 tienen con qué encender» está medido sobre las de §10
// (`lo-que-el-mundo-si-siembra.test.ts`). Sobre las que SE JUEGAN el número es
// otro y lo publica `columnaDelEncendible`: 20 de 20 tienen encendible y 19 de 20
// lo tienen por debajo del techo de la fricción. Las dos poblaciones van juntas en
// el mismo renglón —§10: 13/20 · jugadas: 20/20— porque es la única forma de que
// la comparación con la corrida anterior signifique algo.
//
// Lo que la Regla 5 del documento castiga —fabricar el mundo que uno quiere
// medir— sigue sin pasar, y ésa es la diferencia que importa: el reemplazo NO mira
// si la semilla es buena para la mente. Mira si tiene orilla, se publica cuántas
// se reemplazaron, y las que entran se corren enteras con la columna a la vista.

import {
  buildSeedPhysics,
  FRICCION,
  HZ_DE_REFERENCIA,
  qualityOf,
  T_AMBIENTE,
  tagsDe,
  UNION,
  unfx,
} from '@anima/physics'
import type { Body, FormId, Physics, Process, QualityVector } from '@anima/physics'
import { crearDios, decretoDe, keyOfCell, mapaDeActores, mapaDeCuerpos } from '@anima/world'
import type { Actor, EstadoDelDios, Placement, WorldBody, WorldState } from '@anima/world'

import { rolDe } from '../src/index.js'

/** §10: `20260728n + k` para `k = 0..19`, fijadas ANTES de correr y escritas en el documento. */
export const SEMILLA_BASE = 20260728n

/** §10: veinte partidas. No es un largo elegido acá. */
export const PARTIDAS = 20

/** §10: el reemplazo en orden si una semilla resulta no resoluble. */
export const SEMILLA_DE_REEMPLAZO = SEMILLA_BASE + 20n

/**
 * EL RADIO EN CHUNKS de lo que se siembra alrededor de la criatura.
 *
 * 1, o sea 3×3, y no es un número de este archivo: es la vecindad `NUEVE` con la
 * que `materializarPozos` decide hasta dónde llega el dios alrededor de un actor
 * (`world/src/step.ts`). Sembrar más lejos sería regalarle mundo a la criatura;
 * sembrar menos, quitárselo.
 */
export const RADIO_EN_CHUNKS = 1

/** El lado del chunk. Es el del mundo, y `celdaDecretada` lo usa igual. */
const CELDAS_DE_LADO = 16

/**
 * UNA `Physics` POR PARTIDA, y no es una optimización al revés: es el rodeo del
 * agujero de la caché del decreto.
 *
 * `decretoDe` memoiza por `(Physics, "cx:cy")` sin la semilla, así que veinte
 * dioses distintos que compartan el objeto `Physics` decretan un solo mundo. Está
 * medido en el bloque (0) del banco, y el hueco queda marcado en rojo ahí: esto es
 * un rodeo del arnés, no una reparación.
 */
export function nuevaFisica(): Physics {
  return buildSeedPhysics()
}

/**
 * Un cuerpo cualquiera, A TEMPERATURA AMBIENTE. Lo de la temperatura no es adorno:
 * un cuerpo sin `temperature` escrita nace a 0 °C, y sobre una mente eso importa
 * el doble —`necesidades` mide el frío del CUERPO y D5 la manda a juntar leña
 * antes de mirar nada más—. Es un artefacto del armado, no del mundo.
 */
export function cuerpo(
  id: string,
  substance: string,
  mass: number,
  state: QualityVector = {},
  form: FormId = 'vara',
): Body {
  return {
    id,
    form,
    parts: [{ substance, mass, q: {} }],
    joints: [],
    state: { temperature: T_AMBIENTE, ...state },
  }
}

export function criatura(id: string, stamina: number): Body {
  return cuerpo(`${id}-cuerpo`, 'carne', 2, { stamina }, 'bloque')
}

export function actor(id: string): Actor {
  // `irreversible` y no `reversible`: `comer` mira `ctx.self.permits` antes de
  // gastar un turno. Una criatura del Hito 5 no está en cuarentena.
  return { id, body: `${id}-cuerpo`, holding: [], capacity: 3, permits: 'irreversible' }
}

// ─── La forma de lo que está tirado ──────────────────────────────────────────

/** El umbral que un rol del catálogo le pide a una cualidad. Se LEE, no se copia. */
function umbralDelRol(p: Process, rol: string, q: string): number {
  for (const t of rolDe(p, rol).where) if (t.q === q) return t.v
  throw new Error(`el rol ${rol} de ${p.id} ya no pide ${q}`)
}

/**
 * QUÉ FORMA TIENE TIRADA UNA SUSTANCIA, y es la única cosa que el decreto NO dice.
 *
 * `Suelta` trae sustancia, celda y masa; no trae forma. Y sin forma no hay
 * geometría: `reach` es `esbeltez(forma) × masa`, así que la misma rama hecha vara
 * o hecha bloque alcanza o no alcanza. O sea que ACÁ el arnés sí decide algo, y por
 * eso está escrito con nombre propio en vez de escondido en un `map`.
 *
 * ─── De dónde sale la regla, y por qué no es una invención de este archivo ──
 *
 * Es la MISMA que usa el dios para juzgar si un chunk es jugable: `formaDeLoSuelto`
 * de `@anima/oracle` (`resolubilidad.ts`), que corre adentro de `decretarChunk`
 * antes de sembrar la garantía. Se reconstruye acá y no se importa porque
 * `@anima/juez` no depende de `@anima/oracle` —el juez depende del motor y del
 * mundo, y agregarle una dependencia pide un `pnpm install` que este tramo no
 * hace—.
 *
 * **Los dos umbrales no se copian: se LEEN DEL CATÁLOGO.** El 0,8 de la
 * flexibilidad es el que pide el rol `binder` de `union` y el 0,5 de la rigidez es
 * el que pide el rol `a` de `friccion`, que son exactamente los dos números con
 * los que `bioma.ts` decide qué siembra cada bioma (`FLEXIBILIDAD_DE_ATADURA`,
 * `RIGIDEZ_DE_VARA`). Si mañana el catálogo mueve uno, esto se entera solo — que
 * es la Regla 1 del juez aplicada a un archivo de `tests/`.
 *
 * MEDIDO, y no supuesto: sobre las **30 sustancias** del catálogo semilla esta
 * función y `formaDeLoSuelto` dan la misma forma en las 30. La comparación se
 * corrió importando el oráculo por camino relativo, que es algo que un test de
 * este paquete no puede dejar escrito sin romper el grafo de dependencias.
 *
 * Y lo mineral va a `bloque` aunque sea rigidísimo, igual que allá: adivinar de
 * más —llamarle vara a un canto rodado— le REGALA alcance a la criatura, y ésa es
 * la dirección en la que un arnés no se puede equivocar.
 */
export function formaDeLoSuelto(substance: string, phys: Physics): FormId {
  const uno: Body = { id: 'x', form: 'bloque', parts: [{ substance, mass: 1, q: {} }], joints: [], state: {} }
  if (qualityOf(uno, 'flexibility', phys) >= umbralDelRol(UNION, 'binder', 'flexibility')) return 'hebra'
  if (tagsDe(uno, phys).includes('mineral')) return 'bloque'
  if (qualityOf(uno, 'rigidity', phys) >= umbralDelRol(FRICCION, 'a', 'rigidity')) return 'vara'
  return 'bloque'
}

// ─── La orilla ───────────────────────────────────────────────────────────────

export interface Orilla {
  readonly dios: EstadoDelDios
  readonly phys: Physics
  readonly cx: number
  readonly cy: number
  /** La celda mojada donde el dios puso el banco. */
  readonly pozo: Placement
  /** Una celda SECA pegada al pozo: desde acá se pesca. */
  readonly parada: Placement
}

/**
 * Una orilla de verdad de la semilla, BUSCADA y no inventada.
 *
 * Barre chunks en orden canónico hasta encontrar uno con pozo y una celda seca
 * pegada. `undefined` —y no una excepción— cuando la semilla no tiene ninguna en
 * 13×13 chunks, porque §10 tiene escrito qué hacer con eso: se reemplaza en orden
 * y el reemplazo se anota.
 */
export function laOrilla(semilla: bigint): Orilla | undefined {
  const phys = nuevaFisica()
  const dios = crearDios(semilla)
  for (let cx = -6; cx <= 6; cx++) {
    for (let cy = -6; cy <= 6; cy++) {
      const dec = decretoDe(dios, phys, cx, cy)
      if (dec.pozo === undefined) continue
      const p = dec.pozo.at
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const parada = { x: p.x + dx, y: p.y + dy }
        const vecino = decretoDe(dios, phys, Math.floor(parada.x / 16), Math.floor(parada.y / 16))
        const i = (((parada.y % 16) + 16) % 16) * 16 + (((parada.x % 16) + 16) % 16)
        if ((vecino.celdas[i] as { wet: number }).wet < 0.9) {
          return { dios, phys, cx, cy, pozo: p, parada }
        }
      }
    }
  }
  return undefined
}

// ─── La escena ───────────────────────────────────────────────────────────────

export interface Escena {
  readonly state: WorldState
  /**
   * LO QUE EL ARNÉS PUSO, por id: el cuerpo de la criatura y las sueltas del
   * decreto. Es el denominador de «cuántos cuerpos puso el mundo por su cuenta»,
   * y por eso sale como dato y no como una lista escrita a mano en otro archivo.
   */
  readonly plantados: ReadonlySet<string>
  /** Cuántas sueltas decretó el dios en los 3×3 chunks de alrededor. */
  readonly decretadas: number
  /**
   * Cuántas se pudieron sembrar. La diferencia con `decretadas` es la ley 8: el
   * decreto puede poner DOS cosas en la misma celda —sortea celda seca con
   * reposición— y el mundo no admite dos sólidos sueltos en una. Ver `escenaDe`.
   */
  readonly sembradas: number
}

/**
 * LA ESCENA: la criatura, y lo que el dios sembró alrededor.
 *
 * ─── Lo único que queda plantado a mano, y por qué ──────────────────────────
 *
 * **El cuerpo de la criatura, y nada más.** El decreto no decreta criaturas: dice
 * qué hay tirado en el piso. Alguien tiene que poner a la criatura en algún lado,
 * y se la pone en la `parada` —la celda seca pegada al pozo— porque la escena del
 * Hito 5 es «con hambre y un río a la vista» y ésa es la celda desde la que se
 * pesca. El tanque que trae se publica (§3).
 *
 * No decide ninguna secuencia: las nueve piden materia —dos candidatos de
 * fricción, dos permeabilidades, algo con filo, corteza y atadura, algo sólido
 * para la parrilla— y la criatura es de `carne`, que el juez saca a mano de todo
 * conjunto de candidatos (`cuerposDeActores`, Regla 6).
 *
 * ─── Y la ley 8, que decide cuántas sueltas entran ──────────────────────────
 *
 * `scatter` sortea la celda de cada suelta CON REPOSICIÓN, así que el decreto pone
 * dos cosas en la misma celda con toda naturalidad. El mundo no admite dos sólidos
 * sueltos en una celda: `drop` busca la primera celda libre alrededor
 * (`celdaLibreCerca`) y `revisarEspacio` lo cuenta como `solidos-solapados`.
 *
 * MEDIDO sobre las veinte partidas que se juegan: el dios decretó 2280 sueltas y
 * entraron 2177, o sea que la ley 8 se comió **103**. Por semilla va de 0 a 20 —la
 * peor es `20260769n`, que decreta 46 en un puñado de celdas y deja 26—. En una de
 * las veinte la celda repetida es la de la criatura.
 *
 * Así que se siembra **la primera de cada celda en el orden canónico del decreto**
 * y la segunda no entra. Es la dirección segura —se pierde materia, no se
 * inventa— y se publica: `decretadas` contra `sembradas`. Apilarlas con
 * `supportedBy` habría sido legal y habría sido peor: una pila que ninguna
 * intención pidió es una relación espacial fabricada por el arnés, y la ley 12 la
 * lee.
 */
export function escenaDe(o: Orilla, stamina: number): Escena {
  const cuerpos: WorldBody[] = [{ body: criatura('ana', stamina), at: o.parada }]
  // `keyOfCell` del mundo y no una clave propia: es la forma canónica del paquete
  // y es la misma con la que `estorbo` indexa la celda al decidir si algo estorba.
  const ocupadas = new Set<number>([keyOfCell(o.parada)])
  const acx = Math.floor(o.parada.x / CELDAS_DE_LADO)
  const acy = Math.floor(o.parada.y / CELDAS_DE_LADO)
  let decretadas = 0
  let n = 0
  // Orden canónico: los nueve chunks por `dx` y después por `dy`, y adentro de
  // cada uno las sueltas en el orden en que el dios las sorteó. Nada de este
  // recorrido depende del estado, así que dos corridas gemelas siembran igual.
  for (let dx = -RADIO_EN_CHUNKS; dx <= RADIO_EN_CHUNKS; dx++) {
    for (let dy = -RADIO_EN_CHUNKS; dy <= RADIO_EN_CHUNKS; dy++) {
      const cx = acx + dx
      const cy = acy + dy
      for (const s of decretoDe(o.dios, o.phys, cx, cy).chunk.sueltas) {
        decretadas += 1
        const at = {
          x: cx * CELDAS_DE_LADO + (s.i % CELDAS_DE_LADO),
          y: cy * CELDAS_DE_LADO + Math.floor(s.i / CELDAS_DE_LADO),
        }
        if (ocupadas.has(keyOfCell(at))) continue
        ocupadas.add(keyOfCell(at))
        // `unfx` y no una división por mil: es la única puerta declarada entre la
        // escala `Fixed` del dios y los reales del mundo (ADR II-0006).
        // ─── LA FORMA: LA QUE EL DIOS ELIGIÓ, Y SÓLO SI NO ELIGIÓ SE INFIERE ──
        //
        // `Suelta.form` viene puesto en lo que `ensureSolvable` sembró para
        // GARANTIZAR el chunk —ahí la forma es la razón de la siembra, no un
        // detalle— y viene `undefined` en lo que dejó `scatter`, donde el dios no
        // eligió ninguna. Antes acá se inferían las dos, y el arnés le cambiaba la
        // forma a 1 de cada 66 garantizadas (cota inferior). Ahora la única que se
        // infiere es la que nadie decidió, que es lo que `formaDeLoSuelto` dice de
        // sí misma.
        cuerpos.push({
          body: cuerpo(
            `suelta-${String(n)}`,
            s.substance,
            unfx(s.masa),
            {},
            s.form ?? formaDeLoSuelto(s.substance, o.phys),
          ),
          at,
        })
        n += 1
      }
    }
  }
  const state: WorldState = {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: o.phys,
    bodies: mapaDeCuerpos(cuerpos),
    actors: mapaDeActores([actor('ana')]),
    cells: new Map(),
    nextId: 1,
    dios: o.dios,
  }
  return {
    state,
    plantados: new Set(cuerpos.map((c) => c.body.id)),
    decretadas,
    sembradas: n,
  }
}

/**
 * LA PRIMERA CELDA LIBRE PEGADA A UNA, en un orden fijo y sin mirar el estado.
 *
 * Existe para el control del azar, que tiene que poder dejar la fogata regalada al
 * lado de la criatura sin caer encima de una suelta del decreto. El orden de los
 * ocho rumbos está escrito acá y es fijo: dos corridas gemelas ponen la fogata en
 * la misma celda. Es la misma forma que `celdaLibreCerca` del mundo, con la
 * diferencia de que acá se pregunta por CUALQUIER cuerpo y no sólo por los
 * sólidos: al arnés le alcanza con no pisar nada.
 */
export function celdaLibrePegada(state: WorldState, desde: Placement): Placement | undefined {
  const ocupadas = new Set<number>()
  for (const c of state.bodies.values()) ocupadas.add(keyOfCell(c.at))
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const at = { x: desde.x + dx, y: desde.y + dy }
    if (!ocupadas.has(keyOfCell(at))) return at
  }
  return undefined
}

/**
 * LAS SEMILLAS QUE DE VERDAD SE JUEGAN, con la política de reemplazo de §10.
 *
 * «Si alguna resulta no resoluble se reemplaza en orden por `20260728n + 20 + j` y
 * el reemplazo se anota». Acá «no resoluble» es lo único que puede serlo desde
 * afuera: que la semilla no tenga una sola orilla en 13×13 chunks.
 *
 * ─── Por qué vive acá y no en el banco ──────────────────────────────────────
 *
 * Porque el banco y su control tienen que jugar **los mismos veinte mundos**. Con
 * la lista calculada en cada archivo, alcanza con que uno cambie el barrido para
 * que la mente y el dado se midan en mundos distintos y la comparación deje de
 * valer sin que nada se ponga rojo. Y se memoiza porque `laOrilla` barre 169
 * chunks por semilla: calcularla tres veces es medio minuto tirado.
 *
 * `j` NO se reinicia entre ranuras: «se reemplaza EN ORDEN» quiere decir que la
 * segunda ranura que falla toma la siguiente semilla libre, no la misma que tomó
 * la primera. Si se reiniciara, dos ranuras jugarían el mismo mundo y la premisa
 * de las veinte semillas distintas se caería sin que nada lo dijera.
 */
export interface Ranuras {
  readonly semillas: readonly bigint[]
  readonly reemplazos: readonly string[]
}

const RANURAS = new Map<number, Ranuras>()

export function semillasQueSeJuegan(cuantas: number): Ranuras {
  const memo = RANURAS.get(cuantas)
  if (memo !== undefined) return memo
  const semillas: bigint[] = []
  const reemplazos: string[] = []
  let j = 0
  for (let k = 0; k < cuantas; k++) {
    const original = SEMILLA_BASE + BigInt(k)
    if (laOrilla(original) !== undefined) {
      semillas.push(original)
      continue
    }
    const intentadas: bigint[] = []
    let elegida: bigint | undefined
    while (elegida === undefined) {
      const reemplazo = SEMILLA_DE_REEMPLAZO + BigInt(j)
      j += 1
      intentadas.push(reemplazo)
      if (laOrilla(reemplazo) !== undefined) elegida = reemplazo
    }
    semillas.push(elegida)
    const fallidas = intentadas.slice(0, -1)
    reemplazos.push(
      `  ranura ${String(k)}: ${String(original)} sin orilla` +
        (fallidas.length === 0 ? '' : ` · también ${fallidas.map(String).join(', ')}`) +
        ` → juega ${String(elegida)}`,
    )
  }
  const r: Ranuras = { semillas, reemplazos }
  RANURAS.set(cuantas, r)
  return r
}

/**
 * UN RESPIRO ENTRE PARTIDA Y PARTIDA, y no es una pausa de cortesía.
 *
 * El worker de vitest le habla al proceso principal por un canal con **timeout de
 * 60 s** (`DEFAULT_TIMEOUT` de birpc, no configurable desde la config de vitest).
 * Un `it` que bloquea el bucle de eventos más que eso no puede procesar la
 * respuesta de `onTaskUpdate`, y la corrida entera termina con un
 * «[vitest-worker]: Timeout calling "onTaskUpdate"» que no es de ninguna medición
 * — medido acá: con el mundo decretado los bancos pasaron de 16 s a 193 s y el
 * error apareció aunque los dieciséis tests pasaran.
 *
 * Así que los bucles que corren veinte partidas ceden el hilo entre una y otra.
 * Una partida sola es a lo sumo unos treinta segundos, que entra cómoda. **No
 * cambia una sola medición**: cada partida es determinista y no comparte estado
 * con la siguiente, y lo único que ocurre en el respiro es que el worker manda su
 * informe.
 */
export function respirar(): Promise<void> {
  return new Promise((listo) => {
    setTimeout(listo, 0)
  })
}

/** La firma de lo que el dios sembró en un chunk. Sin `toLocaleString` ni orden de sistema. */
export function firmaDeSueltas(
  sueltas: readonly { readonly substance: string; readonly i: number; readonly masa: number }[],
): string {
  return sueltas.map((s) => `${s.substance}@${String(s.i)}:${String(s.masa)}`).join(',')
}
