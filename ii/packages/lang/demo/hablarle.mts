/**
 * HABLARLE A LA CRIATURA — el Hito 6, a mano, en la terminal.
 *
 *     pnpm --filter @anima/lang hablarle
 *     pnpm --filter @anima/lang hablarle "hacé fuego"
 *
 * Es un DEMO, no un test: no afirma nada y no corre en CI. Existe para poder
 * escribir una frase y ver si la criatura hace caso, que es la única forma de
 * saber si el hito significa algo.
 *
 * ─── Lo que este archivo prueba, y lo que NO ────────────────────────────────
 *
 * Prueba el camino entero contra un mundo de verdad: se lee la frase, sale el
 * acuse **en el acto**, se convierte en una meta y se le inyecta a una `Mente`
 * que ya venía viviendo. Después corren los ticks y se ve qué hace.
 *
 * **Lo que todavía no hay es una sola cosa y conviene decirla:** el único canal
 * externo a la mente es `MenteOptions.drive`, que lleva **una** firma de
 * predicado. Alcanza para una orden de una cláusula —«hacé fuego»— y **no**
 * para «hacé fuego y después pescá»: el orden parcial y las ligaduras que
 * `objetivosDe` sabe producir no tienen por dónde entrar. Cuando la frase tiene
 * varias cláusulas, este demo manda la primera y lo dice.
 *
 * ─── Por qué importa de `mind/tests/` ───────────────────────────────────────
 *
 * La regla del repo es no importar los `tests/` de otro paquete, y vale para los
 * tests: uno que depende del de al lado se rompe cuando el de al lado se
 * reordena. Esto no es un test. El constructor de mundos de verdad —con dios,
 * con orilla y con pozo— vive ahí, y copiar doscientas líneas para un demo sería
 * peor: la copia se quedaría vieja sin que nadie se entere.
 */

import { createInterface } from 'node:readline'
import { buildSeedPhysics, qualityOf } from '@anima/physics'
import { ESQUEMAS, catalogoDe } from '@anima/plan'
import { Partida } from '@anima/perceive'
import { Creencias, Mente, vivir } from '@anima/mind'
import type { Drive } from '@anima/mind'
import { PUENTE } from '../src/alias.js'
import { consultaDe } from '../src/consulta.js'
import { faltaDe } from '../src/falta.js'
import { leer } from '../src/leer.js'
import { lexicoDe } from '../src/lexico.js'
import { objetivosDe } from '../src/objetivos.js'
import { revisar } from '../src/consulta.js'
import { costoDeLaUltima, fraseDeLaLinea, preguntarle, transporteElegido } from './proveedor.js'
import { actor, criatura, enElPiso, laOrilla, mundo } from '../../mind/tests/mundo.js'

const QUIEN = 'ana'
/** Ticks que corre el mundo antes de la primera frase, para que se asiente. */
const CALENTAR = 40
/** Ticks que corre después de cada orden. A 20 Hz son 15 segundos del mundo. */
const DESPUES = 300
/** El bloque tecnico de abajo. `--simple` lo apaga; por omision esta puesto. */
const DETALLE = !process.argv.includes('--simple')

const phys = buildSeedPhysics()
const lexico = lexicoDe(phys, PUENTE)
const catalogo = catalogoDe(ESQUEMAS)
const ESTABLECIBLES = new Set(ESQUEMAS.map((e) => e.establishes))
const FIRMAS = [...ESTABLECIBLES]
const OPC = { phys, lexico, sabeElCatalogo: (f: string): boolean => ESTABLECIBLES.has(f) }

const orilla = laOrilla()
// La escena canónica del Hito 5: la criatura parada en la orilla, con el tanque
// de arranque del criterio. Está escrita acá y no importada porque el que la
// arma —`conRegalo`— vive en `mind/tests/el-criterio.ts`, que es el arnés del
// criterio y no un constructor de mundos.
const partida = new Partida(
  mundo({
    dios: orilla.dios,
    bodies: [enElPiso(criatura(QUIEN, 310), orilla.parada)],
    actors: [actor(QUIEN, { capacity: 3 })],
  }),
  { vigilar: true },
)
let memoria = new Creencias()
let mente = new Mente({ actor: QUIEN, memoria })
const mentes = new Map([[QUIEN, mente]])
let tick = 0

/**
 * Donde esta parada, y con cuanto aliento.
 *
 * La clave es `ana-cuerpo` y no `ana`: el ACTOR y su CUERPO son dos cosas, y el
 * cuerpo lleva el sufijo. La primera version buscaba `ana` y la criatura salia
 * «ya no esta» siempre — un fantasma de mi display, no del mundo.
 */
function donde(): string {
  const a = partida.state.bodies.get(`${QUIEN}-cuerpo`)
  if (a === undefined) return 'ya no está (se murió)'
  // `Placement` es `{x, y}` y nada mas: no es una union con variantes. Escribi
  // un `at.k === 'cell'` de memoria y salio `(undefined)` — el tipo se lee, no
  // se recuerda.
  const en = `${String(a.at.x)},${String(a.at.y)}`
  const st = qualityOf(a.body, 'stamina', partida.state.phys)
  return `en (${en}) con ${st.toFixed(0)} de aliento`
}

function enLaMano(): string {
  const s = partida.state.actors.get(QUIEN)
  const n = s === undefined ? 0 : s.holding.length
  return n === 0 ? 'con las manos vacías' : `con ${String(n)} cosa${n > 1 ? 's' : ''} en la mano`
}

interface Hecho {
  readonly t: number
  readonly nombre: string
}

function correr(n: number): readonly Hecho[] {
  const hechos: Hecho[] = []
  for (let k = 0; k < n; k++) {
    const antes = mente.despegues
    vivir(partida, mentes, 1)
    tick++
    if (mente.despegues > antes) hechos.push({ t: tick, nombre: mente.ultimoDespegue ?? '?' })
  }
  return hechos
}

// ─── DECIRLO EN CASTELLANO ──────────────────────────────────────────────────
//
// Todo lo que este archivo imprimia estaba en el idioma de adentro: firmas de
// predicado, ids de cuerpo, coordenadas, nombres de habilidad. Sirve para
// depurar y no para leer, y este demo existe para que alguien lea.

/**
 * Una firma dicha en castellano, **sacada del puente al reves**.
 *
 * `alias.ts` mapea «fuego» -> `emitsPower>0`. Darlo vuelta da `emitsPower>0` ->
 * «fuego», y sale gratis: es la misma tabla leida en el otro sentido, asi que no
 * hay una segunda lista que se pueda desincronizar de la primera.
 *
 * Lo que el puente no nombra se dice como viene. Es feo a proposito: que se vea
 * la firma cruda es la senal de que a esa meta le falta una palabra humana.
 */
function enCastellano(firma: string): string {
  for (const a of PUENTE) {
    if (a.denota.k === 'meta' && a.denota.firma === firma) return a.dice[0] ?? firma
  }
  return firma
}

/**
 * Que hizo, dicho como se lo contarias a alguien.
 *
 * Los nombres de habilidad son del motor —`aplicar(extraccion)`, `unir`,
 * `deshilachar`— y no significan nada afuera. Esta tabla vive en el demo y no en
 * `src/` porque es NARRACION: el dia que exista la UI del Hito 12 la va a querer
 * mas rica (con el sujeto adentro, con genero), y una tabla compartida entre un
 * demo de terminal y una pantalla termina sirviendo mal a las dos.
 */
const EN_CRIOLLO: Readonly<Record<string, string>> = {
  ir: 'camino hasta ahi',
  sostener: 'agarro algo',
  juntar: 'junto algo del piso',
  unir: 'ato dos cosas',
  deshilachar: 'saco una hebra',
  frotar: 'froto para hacer fuego',
  aplicar: 'uso lo que tenia',
  poner: 'apoyo algo',
  esperar: 'espero',
  explorar: 'anduvo mirando',
  guarecerse: 'se guarecio',
  comer: 'comio',
  tragar: 'comio',
  construir: 'armo algo',
  usar: 'dejo algo funcionando',
}

function enCriollo(habilidad: string): string {
  const base = habilidad.split('(')[0] ?? habilidad
  return EN_CRIOLLO[base] ?? base
}

/** Lo que hizo, en orden, sin repetir dos veces seguidas lo mismo. */
function contar(hechos: readonly Hecho[]): readonly string[] {
  const out: string[] = []
  let ultimo = ''
  let veces = 0
  const cerrar = (): void => {
    if (ultimo === '') return
    out.push(veces > 1 ? `${ultimo} (${String(veces)} veces)` : ultimo)
  }
  for (const h of hechos) {
    const dicho = enCriollo(h.nombre)
    if (dicho === ultimo) {
      veces++
      continue
    }
    cerrar()
    ultimo = dicho
    veces = 1
  }
  cerrar()
  return out
}

/**
 * UNA FRASE, DE PUNTA A PUNTA — en dos partes que no se mezclan.
 *
 * ─── Por que dos partes ─────────────────────────────────────────────────────
 *
 * La primera version imprimia todo junto: coordenadas, ids de cuerpo, firmas de
 * predicado, milisegundos, dolares, numeros de tick y un contador por habilidad,
 * intercalados con lo que la criatura decia. Sirve para depurar y no se puede
 * leer, y lo peor es que tampoco se depura bien — lo tecnico queda escondido
 * entre la narracion.
 *
 * Asi que van separadas y en este orden:
 *
 *   ARRIBA   lo que pasa, en castellano. Sin firmas, sin ids, sin coordenadas.
 *            Se lee de un vistazo y contesta «que le dije y que hizo».
 *
 *   ABAJO    EL DETALLE, detras de una linea. Todo lo que se fue de arriba, y
 *            mas: los grados de cada clausula, la firma cruda, la llave de
 *            cache, los ticks exactos, el costo. Es lo que uno mira cuando algo
 *            no salio como esperaba.
 *
 * `--simple` apaga la de abajo. Nada se pierde: se elige.
 */
async function decirle(frase: string): Promise<void> {
  const t0 = Number(process.hrtime.bigint()) / 1e6
  const l = leer(frase, OPC)
  const acuseMs = Number(process.hrtime.bigint()) / 1e6 - t0
  const tickDelMensaje = tick

  // ── LO QUE CONTESTA, primero y solo. Todo lo demas es explicacion.
  console.log(`\n  ${l.acuse}`)

  // El carril lento: DESPUES del acuse y ANTES de inyectar.
  let revisada = l
  let msDelModelo: number | undefined
  const consulta = consultaDe(l, lexico, FIRMAS)
  const quien = transporteElegido()
  if (consulta !== undefined) {
    const t1 = Number(process.hrtime.bigint()) / 1e6
    const r = await preguntarle(consulta)
    msDelModelo = Number(process.hrtime.bigint()) / 1e6 - t1
    const seg = (msDelModelo / 1000).toFixed(0)
    if (r === undefined) {
      console.log(`  le pregunte a ${quien} y no supo.  (${seg} s)`)
    } else {
      revisada = revisar(l, r, lexico, {
        ofrecidas: consulta.firmas,
        sabeElCatalogo: OPC.sabeElCatalogo,
      })
      const f = revisada.clausulas.find((c) => c.leidaPor === 'modelo')?.firma
      console.log(
        f === undefined
          ? `  le pregunte a ${quien} y lo que dijo no me servia.  (${seg} s)`
          : `  le pregunte a ${quien}: queres ${enCastellano(f)}.  (${seg} s)`,
      )
    }
  }

  const primera = revisada.clausulas.find((c) => c.firma !== undefined && c.polaridad === 'afirma')

  if (primera?.firma === undefined) {
    const hechos = correr(60)
    const q = contar(hechos)
    console.log(`  mientras tanto ${q.length === 0 ? 'sigue con lo suyo' : q.join(', ')}.`)
    detalle(frase, l, revisada, consulta, acuseMs, msDelModelo, hechos, tickDelMensaje, undefined)
    return
  }

  if (primera.leidaPor === 'local') console.log(`  entendi: ${enCastellano(primera.firma)}.`)
  if (primera.grado === 'sin-camino') {
    console.log(`  ${faltaDe(primera.firma, phys, catalogo).enVozAlta}.`)
  }
  if (revisada.clausulas.length > 1) {
    console.log('  (me pediste varias cosas y por ahora solo puedo con la primera)')
  }

  const drive: Drive = { meta: primera.firma, peso: 1, desdeTick: tick }
  mente = new Mente({ actor: QUIEN, memoria, drive })
  mentes.set(QUIEN, mente)

  const hechos = correr(DESPUES)
  const que = contar(hechos)
  console.log('')
  if (que.length === 0) console.log('  no encontro por donde arrancar.')
  else {
    for (const q of que.slice(0, 6)) console.log(`  · ${q}`)
    if (que.length > 6) console.log(`  · y ${String(que.length - 6)} cosas mas`)
  }

  detalle(frase, l, revisada, consulta, acuseMs, msDelModelo, hechos, tickDelMensaje, primera.firma)
}

/**
 * EL DETALLE — todo lo que la parte de arriba dejo afuera, y algo mas.
 *
 * Lo que esta aca no es «lo mismo con mas decimales»: son las cosas que sirven
 * cuando algo salio distinto de lo esperado. El grado de cada clausula dice si
 * el problema fue leer o fue el mundo; la llave dice si la cache aplicaria; los
 * ticks exactos dicen si la criatura arranco enseguida o tardo.
 */
function detalle(
  frase: string,
  local: ReturnType<typeof leer>,
  final: ReturnType<typeof leer>,
  consulta: ReturnType<typeof consultaDe>,
  acuseMs: number,
  msDelModelo: number | undefined,
  hechos: readonly Hecho[],
  desdeTick: number,
  meta: string | undefined,
): void {
  if (!DETALLE) return
  const R = (n: number): string => n.toFixed(2)
  console.log('\n  ── detalle ────────────────────────────────────────────────')
  console.log(`     frase        «${frase}»`)
  console.log(`     acuse        ${R(acuseMs)} ms`)
  console.log(`     confianza    ${local.confianza.toFixed(2)}`)
  console.log(`     clausulas    ${String(local.clausulas.length)}`)
  for (const [i, c] of final.clausulas.entries()) {
    const antes = local.clausulas[i]
    const cambio = antes !== undefined && antes.grado !== c.grado ? `  (era ${antes.grado})` : ''
    console.log(
      `       [${String(i)}] ${c.grado.padEnd(13)} ${c.leidaPor.padEnd(6)} ${c.firma ?? '—'}${cambio}`,
    )
    console.log(`             ${c.porque}`)
  }
  if (consulta === undefined) console.log('     consulta     no hizo falta')
  else {
    console.log(`     consulta     ${String(consulta.clausulas.length)} clausula(s) · llave ${consulta.llave}`)
    console.log(`                  ${String(consulta.firmas.length)} firmas ofrecidas · ${String(consulta.vocabulario.length)} palabras de vocabulario`)
    const c = costoDeLaUltima()
    console.log(
      `     modelo       ${transporteElegido()} · ${msDelModelo === undefined ? 'no se llamo' : `${R(msDelModelo)} ms`}` +
        (c === undefined ? '' : ` · ${c.modelo} · US$ ${c.usd.toFixed(4)}`),
    )
  }
  const p = objetivosDe(final)
  console.log(`     objetivos    ${String(p.nodos.length)} nodo(s) · ${String(p.descartes.length)} descarte(s)`)
  for (const d of p.descartes) console.log(`       descarta «${d.crudo}»: ${d.porque}`)
  if (meta !== undefined) {
    const f = faltaDe(meta, phys, catalogo)
    console.log(`     meta         ${meta}`)
    console.log(`     alcanzable   ${OPC.sabeElCatalogo(meta) ? 'si' : `no · falta ${f.clase}`}`)
  }
  console.log(`     mundo        tick ${String(desdeTick)} → ${String(tick)} · ${donde()} · ${enLaMano()}`)
  console.log(`     despegues    ${String(hechos.length)}`)
  for (const h of hechos.slice(0, 12)) console.log(`       ${String(h.t).padStart(6)}  ${h.nombre}`)
  if (hechos.length > 12) console.log(`       ... y ${String(hechos.length - 12)} mas`)
  console.log('  ───────────────────────────────────────────────────────────')
}


// ─── El bucle ───────────────────────────────────────────────────────────────

console.log('')
console.log('  Le hablas a la criatura y hace. `salir` para terminar.')
correr(CALENTAR)
console.log(`  (vive en la orilla · lee con ${transporteElegido()}${DETALLE ? '' : ' · sin detalle'})`)
const deLaLinea = fraseDeLaLinea()
if (deLaLinea !== '') {
  await decirle(deLaLinea)
  console.log('')
} else {
  console.log('\nEscribile algo. `salir` para terminar.\n')
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' })
  rl.prompt()
  rl.on('line', (linea) => {
    const t = linea.trim()
    if (t === 'salir' || t === 'chau') {
      rl.close()
      return
    }
    if (t !== '') {
      void decirle(t).then(() => {
        console.log('')
        rl.prompt()
      })
      return
    }
    console.log('')
    rl.prompt()
  })
  rl.on('close', () => {
    console.log('\n  chau.\n')
    process.exit(0)
  })
}
