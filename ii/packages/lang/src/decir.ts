// ─── DECIR UNA META EN CASTELLANO, CUANDO LA TABLA NO ALCANZA ───────────────
//
// `alias.ts` traduce metas con una tabla —«fuego» ↔ `emitsPower>0`— y leída al
// revés da el nombre humano de una firma. Es exacta, barata y no se puede
// desincronizar, así que sigue siendo el primer intento.
//
// ─── EL AGUJERO QUE ESTE ARCHIVO TAPA, VISTO EN PANTALLA ───────────────────
//
// El panel del juego llegó a mostrar esto, tal cual:
//
//     holding(tag:carnoso,toxicity<0.0528) (suya)
//
// Y no se arregla agregando una fila a la tabla: **el `0,0528` no lo escribió
// nadie**. Sale de `mordidaDe` en `@anima/mind` —es cuánto veneno le conviene
// tragar, y depende de lo vacío que esté el tanque, así que una criatura llena
// rechaza lo que una flaca acepta—. Cambia a cada tick. Una tabla necesitaría
// una fila por número posible.
//
// Lo que sí se puede es **leer el predicado y componer la frase con sus partes**,
// que es lo que hay acá. Las partes son enumeraciones CERRADAS de la física —7
// tags, 29 cualidades— así que darles una palabra a cada una es traducir un
// catálogo, no adivinar.
//
// ─── LA DECISIÓN: EL NÚMERO NO SE DICE ─────────────────────────────────────
//
// `toxicity<0.0528` se dice «poco venenoso» y no «con toxicidad menor a 0,0528».
// Esto es lo que el jugador lee de reojo mientras mira el mapa, y el número no le
// dice nada que la palabra no diga: lo que quiere saber es qué está buscando la
// criatura, no el umbral exacto con el que lo evalúa. Quien necesite el número
// tiene la firma cruda, que sigue existiendo.

import type { Predicado } from '@anima/plan'

/**
 * CÓMO SE DICE UN TAG. Los siete de `substance.ts`, y ni uno más.
 *
 * La enumeración es cerrada, así que esta tabla no se puede quedar corta sin que
 * alguien toque la física — y si eso pasa, el que falte sale con su id, que es la
 * misma señal que usa el puente: verlo crudo quiere decir que le falta palabra.
 */
export const PALABRA_DE_TAG: Readonly<Record<string, string>> = {
  organico: 'orgánico',
  vegetal: 'vegetal',
  mineral: 'mineral',
  fibroso: 'fibroso',
  carnoso: 'carnoso',
  carbonoso: 'quemado',
  liquido: 'líquido',
}

/**
 * CÓMO SE DICE UNA CUALIDAD, en sus dos direcciones.
 *
 * Dos palabras y no una porque el comparador cambia el sentido entero:
 * `toxicity>0.5` es «venenoso» y `toxicity<0.05` es «poco venenoso», y una sola
 * palabra con el signo pegado —«toxicidad baja»— se lee como una etiqueta de
 * planilla, que es exactamente de lo que este hito trata de salir.
 *
 * Están las que aparecen en metas de verdad. Una cualidad sin fila sale con su id
 * y el comparador, que es feo y es la señal.
 */
interface DosLados {
  readonly alto: string
  readonly bajo: string
}

const PALABRA_DE_CUALIDAD: Readonly<Record<string, DosLados>> = {
  toxicity: { alto: 'venenoso', bajo: 'poco venenoso' },
  digestibility: { alto: 'digerible', bajo: 'duro de digerir' },
  nutrition: { alto: 'alimenticio', bajo: 'flojo de alimento' },
  temperature: { alto: 'caliente', bajo: 'frío' },
  moisture: { alto: 'mojado', bajo: 'seco' },
  decay: { alto: 'podrido', bajo: 'fresco' },
  rigidity: { alto: 'duro', bajo: 'blando' },
  flexibility: { alto: 'flexible', bajo: 'tieso' },
  tensile: { alto: 'resistente', bajo: 'quebradizo' },
  sharpness: { alto: 'filoso', bajo: 'romo' },
  toughness: { alto: 'tenaz', bajo: 'frágil' },
  cohesion: { alto: 'compacto', bajo: 'suelto' },
  charred: { alto: 'carbonizado', bajo: 'sin quemar' },
  mass: { alto: 'pesado', bajo: 'liviano' },
  stamina: { alto: 'con aliento', bajo: 'sin aliento' },
  emitsPower: { alto: 'que da calor', bajo: 'sin calor' },
  ignitionPoint: { alto: 'difícil de prender', bajo: 'fácil de prender' },
}

/**
 * CÓMO SE DICE UNA GEOMETRÍA. Se derivan de la forma, no de la materia.
 *
 * ─── Y SE BUSCA EN LAS DOS TABLAS, PORQUE LA FRONTERA NO ES LA QUE PARECE ──
 *
 * Uno esperaría que `catch>0` se interprete como geometría —lo es— y `interpretar`
 * lo devuelve como CUALIDAD, porque `catch` también está en el catálogo cerrado
 * como cualidad derivada. Se descubrió con un test que esperaba «que atrape» y
 * recibió `catch>`.
 *
 * Así que `unaCondicion` mira las dos tablas en vez de elegir una por el tipo del
 * predicado: dónde vive un nombre es cosa de la física, y esto sólo traduce.
 */
const PALABRA_DE_GEOMETRIA: Readonly<Record<string, DosLados>> = {
  catch: { alto: 'que atrape', bajo: 'que no atrape' },
  reach: { alto: 'que llegue lejos', bajo: 'de poco alcance' },
  freeStrandEnds: { alto: 'con una punta suelta', bajo: 'sin puntas sueltas' },
  parts: { alto: 'de varias piezas', bajo: 'de una pieza' },
  joints: { alto: 'atado', bajo: 'sin atar' },
}

/** ¿El comparador apunta para arriba? Decide cuál de las dos palabras va. */
function esAlto(op: string): boolean {
  return op === '>' || op === '>='
}

function unaCondicion(nombre: string, op: string): string {
  const dos = PALABRA_DE_CUALIDAD[nombre] ?? PALABRA_DE_GEOMETRIA[nombre]
  // Sin palabra, sale como viene. Es la misma regla que el puente: lo que se ve
  // crudo en pantalla es lo que le falta una palabra, y se ve para que se note.
  if (dos === undefined) return `${nombre}${op}`
  return esAlto(op) ? dos.alto : dos.bajo
}

/**
 * UNA META EN CASTELLANO, ARMADA POR PARTES.
 *
 * Sale una frase corta y sin números: «algo carnoso y poco venenoso». Se lee
 * de reojo, que es como se lee un panel mientras pasa el mundo.
 */
export function enPalabras(p: Predicado): string {
  switch (p.k) {
    case 'sostiene': {
      const tag = PALABRA_DE_TAG[p.tag] ?? p.tag
      const condiciones = (p.tests ?? []).map((t) => unaCondicion(t.q, t.op))
      // «tener» y no «sostener»: el predicado se llama `sostiene` porque mira
      // `holding`, pero nadie dice «sostengo un pescado».
      const cosa = condiciones.length === 0 ? `algo ${tag}` : `algo ${tag} y ${condiciones.join(' y ')}`
      return `tener ${cosa}`
    }
    case 'cualidad':
      return unaCondicion(p.test.q, p.test.op)
    case 'geometria':
      return unaCondicion(p.f, p.op)
  }
}
