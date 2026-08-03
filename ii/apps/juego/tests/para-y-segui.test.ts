// ─── C5 · «PARÁ ESO … DESPUÉS SEGUÍ», DESDE LA CHARLA ──────────────────────
//
// ─── LA MEDICIÓN, y es la misma forma que la de «no ése, el otro» ──────────
//
// Con un encargo abierto, esto es lo que pasaba con cada frase:
//
//     «pará»       → verbo=parar   grado=orientacion  acuse=«no te entendí del todo»
//     «pará eso»   → verbo=parar   grado=orientacion  acuse=«no te entendí del todo»
//     «olvidate»   → verbo=parar   grado=orientacion  acuse=«no te entendí del todo»
//     «seguí»      → verbo=—       grado=no-entendida acuse=«no te entendí»
//
// O sea: **el verbo ya estaba leído y no lo escuchaba nadie**. `alias.ts` tiene
// la fila de `parar` desde el Hito 6, con un comentario que dice «es el único
// verbo que no pide nada: cancela» — y `componer` lo mandaba al mismo cajón que
// `ir` y `esperar`, el de los que no llevan a un estado del mundo. Es verdad que
// no lleva a ninguno: lleva a un cambio de estado DEL ENCARGO, que es una cosa
// que hasta el C5 no existía.
//
// El cuidador veía «no te entendí del todo» y la criatura seguía haciendo lo
// mismo, que es lo peor de los dos mundos: parece que entendió que no.
//
// ─── LAS DOS DECISIONES DE PRODUCTO, dichas ────────────────────────────────
//
// **(1) «pará» PAUSA y no cancela.** En castellano las dos lecturas son
// legítimas —«pará» y «basta» no quieren decir lo mismo— y hay que elegir. Se
// elige la reversible: si el cuidador quería cancelar y le pausaron, lo dice otra
// vez y listo; al revés se pierde el encargo entero y no hay cómo recuperarlo.
// Por eso `cancelar` se separó en su propio verbo, con sus propias palabras.
//
// **(2) «seguí» con hambre de morirse NO obedece, y lo dice.** Va contra la
// regla que el C3 usa para las correcciones —lo último que dijo una persona gana
// siempre— y es a propósito: esa regla vale para lo que el cuidador SABE (cuál
// tronco quiso decir) y no para lo que el cuerpo de la criatura tiene. La
// alternativa medida es peor: reanudar y volver a pausar al tick siguiente,
// escribiéndole «tengo hambre» una vez por tick para siempre.
//
// ─── Y LO QUE NO ENTRA, con su porqué ──────────────────────────────────────
//
// De la frase entera del criterio —«pará eso y vení acá; después seguí»— la
// parte del medio no se puede: **«acá» no tiene cuerpo**. El cuidador no es un
// actor de este mundo, así que no hay a qué caminar. Se lee `verbo=ir` y se
// descarta, que es lo correcto: inventarle una posición sería mandarla a un lugar
// que nadie eligió. Queda anotado al final del archivo.

import { describe, expect, it } from 'vitest'
import { Partida } from '@anima/perceive'
import { vivir } from '@anima/mind'

import { Ordenes } from '../src/ordenes.js'
import { PHYS, arrancar } from '../src/mundo.js'

const QUIEN = 'ana'
const SEMILLA = 20260727n
const PEDIDO = 'juntá dos troncos y hacé fuego'

interface Sesion {
  readonly p: Partida
  readonly o: Ordenes
}

function nueva(): Sesion {
  const { state } = arrancar(SEMILLA)
  const p = new Partida(state)
  return { p, o: new Ordenes(p, QUIEN, PHYS) }
}

function correr(s: Sesion, n: number): void {
  for (let k = 0; k < n; k++) {
    s.o.antesDelTick(s.p.state.tick)
    vivir(s.p, s.o.mentes, 1)
    s.o.despuesDelTick()
  }
}

function aliento(p: Partida, cuanto: number): void {
  const c = p.state.bodies.get('ana-cuerpo')
  if (c === undefined) throw new Error('no está el cuerpo de la criatura')
  c.body = { ...c.body, state: { ...c.body.state, stamina: cuanto } }
}

/** Un encargo andando, con lo primero ya hecho. */
function andando(): Sesion {
  const s = nueva()
  s.o.decir(PEDIDO)
  correr(s, 8)
  return s
}

describe('C5 · pausar y seguir desde la charla', () => {
  it('(1) «PARÁ ESO» PAUSA EL ENCARGO, y lo acusa como lo que es', () => {
    const s = andando()
    expect(s.o.encargo?.estado).toBe('activo')
    s.o.decir('pará eso')
    expect(s.o.encargo?.estado).toBe('pausado')
    expect(s.o.charla.at(-1)?.texto, 'contestó «no te entendí»').not.toContain('no te entendí')
  })

  it('(2) Y SUELTA LO QUE ESTABA HACIENDO: no es un rótulo', () => {
    const s = andando()
    s.o.decir('pará eso')
    correr(s, 3)
    expect(s.o.metaEnCurso).toBeUndefined()
    expect(s.o.encargo?.estado).toBe('pausado')
  })

  it('(2b) Y LA MENTE LO CONFIRMA, que es la única que no es juez y parte', () => {
    /*
     * ─── POR QUÉ ESTE BLOQUE EXISTE ─────────────────────────────────────────
     *
     * El bloque de arriba mide `Ordenes.metaEnCurso`, que es `#ultimaPuesta`, o
     * sea LA CONTABILIDAD DE QUIEN PAUSA. Que diga `undefined` prueba que
     * `Ordenes` se anotó que soltó el drive, no que la criatura lo haya soltado.
     *
     * Es el mismo error que este tramo ya pagó una vez, midiendo el corte del
     * proveedor con el reloj del que espera en vez de con el proceso: **un
     * instrumento que vive adentro del sistema que mide no puede desmentirlo.**
     *

     * ─── Y NO ES REDUNDANTE, mutando el mecanismo ────────────────────────────
     *
     * Se le sacó a `#soltarElDrive` la reconstrucción de la mente —o sea: la
     * pausa deja de soltar nada y se vuelve un rótulo— y esto es lo que pasó:
     *
     *     (2)  Y SUELTA LO QUE ESTABA HACIENDO      ✓ VERDE
     *     (3)  MIENTRAS ESTÁ PAUSADO…               ✓ VERDE
     *     (2b) Y LA MENTE LO CONFIRMA               × rojo
     *
     * Los dos que miran `Ordenes` pasan con el mecanismo roto, porque
     * `#ultimaPuesta` se sigue poniendo en `undefined`. Ése es exactamente el
     * agujero que este bloque tapa.
     */

    const s = andando()
    const de = (): string | undefined => s.o.mentes.get(QUIEN)?.estado.metaEnCurso
    correr(s, 2)
    const perseguia = de()
    expect(perseguia, 'la precondición: la mente no había tomado ninguna meta').toBeDefined()

    s.o.decir('pará eso')
    correr(s, 3)
    expect(de(), 'la escalera sigue con la meta del cuidador puesta').not.toBe(perseguia)
  })

  it('(3) LA PAUSA A MANO NO SE LEVANTA SOLA, ni con el mundo en calma', () => {
    // El scheduler del hambre reanuda las pausas QUE ÉL HIZO. Si levantara ésta,
    // «pará» duraría ocho ticks y el cuidador no tendría cómo pararla de verdad.
    const s = andando()
    s.o.decir('pará eso')
    correr(s, 40)
    expect(s.o.encargo?.estado).toBe('pausado')
  })

  it('(4) «SEGUÍ» LA RETOMA, y sigue por donde iba', () => {
    const s = andando()
    s.o.decir('pará eso')
    const hechos = s.o.encargo?.hechos.length ?? 0
    correr(s, 5)
    s.o.decir('seguí')
    expect(s.o.encargo?.estado).toBe('activo')
    correr(s, 3)
    expect(s.o.encargo?.hechos.length, 'repitió lo que ya estaba hecho').toBe(hechos)
    expect(s.o.metaEnCurso, 'no volvió a ponerse ninguna meta').toBeDefined()
  })

  it('(5) LAS TRES TRANSICIONES QUEDAN, con quién las pidió', () => {
    const s = andando()
    s.o.decir('pará eso')
    correr(s, 2)
    s.o.decir('seguí')
    const t = s.o.encargo?.transiciones ?? []
    expect(t.length).toBe(2)
    expect(t[0]?.a).toBe('pausado')
    expect(t[0]?.porque, 'no dice que la pediste vos').toContain('me lo pediste')
    // Y `quien` aparte del motivo, que es lo que la recarga lee para saber de
    // quién era la pausa sin tener que interpretar una frase escrita para vos.
    expect(t[0]?.quien).toBe('vos')
    expect(t[1]?.a).toBe('activo')
    expect(t[1]?.quien).toBe('vos')
  })

  it('(6) «OLVIDATE» CANCELA, y eso no vuelve', () => {
    const s = andando()
    s.o.decir('olvidate')
    expect(s.o.encargo, 'el encargo cancelado sigue en curso').toBeUndefined()
    correr(s, 10)
    expect(s.o.metaEnCurso).toBeUndefined()
  })

  it('(7) «SEGUÍ» CON HAMBRE DE MORIRSE NO OBEDECE, y lo dice', () => {
    const s = andando()
    aliento(s.p, 60)
    correr(s, 2)
    expect(s.o.encargo?.estado, 'no llegó a pausarse por hambre').toBe('pausado')
    s.o.decir('seguí')
    expect(s.o.encargo?.estado, 'obedeció y se va a volver a pausar en un tick').toBe('pausado')
    expect(s.o.charla.at(-1)?.texto).toContain('hambre')
  })

  it('(8) EL CONTROL: sin encargo abierto, «pará» no inventa uno', () => {
    const s = nueva()
    s.o.decir('pará eso')
    expect(s.o.encargo).toBeUndefined()
    s.o.decir('seguí')
    expect(s.o.encargo).toBeUndefined()
  })

  it('(9) «PARA» SIN ACENTO ES PREPOSICIÓN, y no para nada', () => {
    // Lo encontró el test del C4, que usa «dale para el agua» como frase floja:
    // con el control recién puesto, esa frase pausaba el encargo. `clave()` saca
    // los acentos —y hace bien, nadie los escribe en un chat— así que «para» y
    // «pará» son la misma palabra para el léxico.
    //
    // La regla que lo separa es lo que estos tres verbos SON: los que no piden
    // nada. Si la frase nombra una cosa, «para» está uniendo dos partes de una
    // oración.
    const s = andando()
    s.o.decir('dale para el agua')
    expect(s.o.encargo?.estado, 'una preposición paró el encargo').toBe('activo')
  })

  it('(10) Y EL OTRO CONTROL: «pará» no se come una orden de verdad', () => {
    // Que el control se lea antes que el encargo no puede convertir cualquier
    // frase en un control. Es el mismo cuidado que el C3 puso con la corrección.
    const s = nueva()
    s.o.decir('juntá un tronco')
    expect(s.o.encargo?.nodos.length).toBe(1)
  })
})

/**
 * LO QUE FALTA: «VENÍ ACÁ». El cuidador no tiene cuerpo en este mundo.
 *
 * `mundo.ts` monta UN actor —la criatura— y tres cuerpos. «Acá» no denota nada, y
 * un objetivo de posición necesita una posición. No se arregla en el lenguaje:
 * se arregla el día que el cuidador sea algo que el mundo pueda ver, que es una
 * decisión de producto bastante más grande que este hito.
 */
describe('C5 · el hueco medido', () => {
  it.fails('«vení acá» debería llevarla a algún lado', () => {
    const s = andando()
    s.o.decir('vení acá')
    expect(s.o.ultimaLectura?.clausulas[0]?.firma).toBeDefined()
  })
})
