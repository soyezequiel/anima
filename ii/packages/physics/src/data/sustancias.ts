// ─── Las treinta sustancias semilla ──────────────────────────────────────────
//
// Esto NO es una tabla de recetas ni un vocabulario de objetos: es el punto de
// partida del mundo. Nada de acá dice qué se puede hacer con qué. Cada fila dice
// nada más de qué está hecha una cosa, y las doce leyes se encargan del resto
// leyendo tags y cualidades. Si mañana el oráculo agrega la trigésima primera,
// arde, se pudre y se cocina sin que nadie toque este archivo.
//
// LOS DOCE PRIMEROS NÚMEROS NO SON OPINIÓN: están medidos en el barrido térmico
// del Hito 0 (`ii/docs/hito-0-barrido-termico.md`). `denaturesAt`, `pyrolysisAt`
// y `toughness` de carne, pescado, molusco, huevo, tuberculo, raiz-dura, grano,
// hongo, hoja, savia, cuero y medula son exactamente los que dieron 12/12
// sustancias con ventana de cocción y 5 óptimos distintos. Tocarlos sin volver a
// correr `pnpm ii:banco` rompe en silencio la única tensión que hace que
// cocinar valga la pena aprenderlo: comer antes o comer mejor.
// El test `sustancias.test.ts` los clava contra una copia literal, para que
// romperlos cueste una línea roja y no un mes.
//
// POR QUÉ `ignitionPoint === pyrolysisAt` EN LO COCINABLE
// La ley 5 se corta en `T >= ignitionPoint` y el barrido juzga «se quema» con
// `T >= pyrolysisAt`. Si los dos números difirieran, la ventana medida no sería
// la ventana simulada. En lo que no se come (madera, hueso, corteza) sí difieren,
// que es lo físico: la pirólisis empieza antes de que haya llama.

import type { Substance, SubstanceId } from '../substance.js'

/** Toda semilla viene del mismo lado; se repite tanto que conviene una constante. */
const SEMILLA = { by: 'semilla' } as const

/**
 * El techo térmico de lo que no arde. No es «infinito»: es un número real y
 * alto, porque un mundo donde algo no tiene techo es un mundo donde una ley
 * puede dividir por cero. 900 °C está cómodamente arriba del máximo alcanzable
 * por la fuente más brava del barrido (hoguera en contacto, 735 °C).
 */
const NO_ARDE = 900

export const SUSTANCIAS_SEMILLA: readonly Substance[] = [
  // ══ LOS DOCE DEL BARRIDO TÉRMICO ═══════════════════════════════════════════
  // Todos alimentan, todos tienen `denaturesAt`, y en todos la digestibilidad
  // cruda es baja: cocinar es la técnica que la sube, no un adorno.

  {
    id: 'carne',
    lexeme: { nombre: 'carne', genero: 'f', sinonimos: ['presa', 'trozo de carne'] },
    tags: ['organico', 'carnoso'],
    // toxicity alta en crudo: comer sin cocinar SIEMPRE se puede, y siempre
    // enferma. `eat` nunca fue un permiso; lo que varía es cuánto rinde.
    perUnitMass: {
      nutrition: 9,
      digestibility: 0.35,
      toxicity: 0.3,
      moisture: 0.72,
      fuelEnergy: 2,
      denaturesAt: 63,
      pyrolysisAt: 280,
      ignitionPoint: 280,
      toughness: 0.3,
      decay: 0.05,
      rigidity: 0.05,
      flexibility: 0.35,
      tensile: 0.2,
      cohesion: 0.45,
      permeability: 0.3,
      charred: 0,
    },
    specificHeat: 3.5,
    provenance: SEMILLA,
  },

  {
    id: 'pescado',
    lexeme: { nombre: 'pescado', genero: 'm', sinonimos: ['pez'] },
    tags: ['organico', 'carnoso'],
    // decay más alto que la carne: el pescado guardado se pudre primero, y por
    // eso ahumarlo o comerlo ya es una decisión y no un trámite.
    perUnitMass: {
      nutrition: 8,
      digestibility: 0.38,
      toxicity: 0.25,
      moisture: 0.76,
      fuelEnergy: 2,
      denaturesAt: 55,
      pyrolysisAt: 260,
      ignitionPoint: 260,
      toughness: 0.18,
      decay: 0.08,
      rigidity: 0.04,
      flexibility: 0.4,
      tensile: 0.18,
      cohesion: 0.4,
      permeability: 0.32,
      charred: 0,
    },
    specificHeat: 3.4,
    provenance: SEMILLA,
  },

  {
    id: 'molusco',
    lexeme: { nombre: 'molusco', genero: 'm', sinonimos: ['caracol', 'almeja'] },
    tags: ['organico', 'carnoso'],
    // toughness 0.55 con denaturesAt bajísimo: se cocina a fuego flojo pero
    // tarda. Es el caso donde apurarse quema sin ablandar.
    perUnitMass: {
      nutrition: 6,
      digestibility: 0.22,
      toxicity: 0.45,
      moisture: 0.8,
      fuelEnergy: 1.5,
      denaturesAt: 48,
      pyrolysisAt: 240,
      ignitionPoint: 240,
      toughness: 0.55,
      decay: 0.1,
      rigidity: 0.06,
      flexibility: 0.25,
      tensile: 0.22,
      cohesion: 0.5,
      permeability: 0.25,
      charred: 0,
    },
    specificHeat: 3.6,
    provenance: SEMILLA,
  },

  {
    id: 'huevo',
    lexeme: { nombre: 'huevo', genero: 'm', sinonimos: [] },
    tags: ['organico', 'carnoso'],
    // toughness 0.05: se cocina casi al instante en cualquier sitio que sirva.
    // Es la sustancia perdonadora, la que se puede aprender sin morirse.
    perUnitMass: {
      nutrition: 11,
      digestibility: 0.5,
      toxicity: 0.1,
      moisture: 0.74,
      fuelEnergy: 2.5,
      denaturesAt: 62,
      pyrolysisAt: 220,
      ignitionPoint: 220,
      toughness: 0.05,
      decay: 0.04,
      rigidity: 0.02,
      flexibility: 0.1,
      tensile: 0.05,
      cohesion: 0.2,
      permeability: 0.4,
      charred: 0,
    },
    specificHeat: 3.2,
    provenance: SEMILLA,
  },

  {
    id: 'tuberculo',
    lexeme: { nombre: 'tubérculo', genero: 'm', sinonimos: ['papa', 'raíz gorda'] },
    tags: ['organico', 'vegetal'],
    // digestibility 0.18 en crudo: el almidón crudo casi no rinde. Acá cocinar
    // no mejora la comida, la CREA — de 0.18 a 0.9 es multiplicar por cinco.
    perUnitMass: {
      nutrition: 7,
      digestibility: 0.18,
      toxicity: 0.35,
      moisture: 0.68,
      fuelEnergy: 3,
      denaturesAt: 75,
      pyrolysisAt: 300,
      ignitionPoint: 300,
      toughness: 0.7,
      decay: 0.02,
      rigidity: 0.3,
      flexibility: 0.1,
      tensile: 0.15,
      cohesion: 0.55,
      permeability: 0.2,
      charred: 0,
    },
    specificHeat: 3,
    provenance: SEMILLA,
  },

  {
    id: 'raiz-dura',
    lexeme: { nombre: 'raíz dura', genero: 'f', sinonimos: ['raíz leñosa'] },
    tags: ['organico', 'vegetal', 'fibroso'],
    // La única del barrido cuyo óptimo son las brasas en contacto: pide calor
    // bruto porque `denaturesAt` 88 no se alcanza de otra forma sin eternizarse.
    perUnitMass: {
      nutrition: 5,
      digestibility: 0.12,
      toxicity: 0.4,
      moisture: 0.55,
      fuelEnergy: 6,
      denaturesAt: 88,
      pyrolysisAt: 310,
      ignitionPoint: 310,
      toughness: 0.9,
      decay: 0.01,
      rigidity: 0.45,
      flexibility: 0.25,
      tensile: 0.45,
      cohesion: 0.6,
      permeability: 0.15,
      charred: 0,
    },
    specificHeat: 2.6,
    provenance: SEMILLA,
  },

  {
    id: 'grano',
    lexeme: { nombre: 'grano', genero: 'm', sinonimos: ['semilla', 'simiente'] },
    tags: ['organico', 'vegetal'],
    // cohesion 0.1 y moisture 0.12: no se sostiene solo y casi no se pudre. Es
    // lo único que se puede guardar de una estación a la otra.
    perUnitMass: {
      nutrition: 13,
      digestibility: 0.15,
      toxicity: 0.2,
      moisture: 0.12,
      fuelEnergy: 7,
      denaturesAt: 92,
      pyrolysisAt: 290,
      ignitionPoint: 290,
      toughness: 0.8,
      decay: 0.005,
      rigidity: 0.35,
      flexibility: 0.05,
      tensile: 0.1,
      cohesion: 0.1,
      permeability: 0.55,
      charred: 0,
    },
    specificHeat: 1.9,
    provenance: SEMILLA,
  },

  {
    id: 'hongo',
    lexeme: { nombre: 'hongo', genero: 'm', sinonimos: ['seta'] },
    tags: ['organico'],
    // El más venenoso en crudo y el que menos alimenta: cocinarlo es casi todo
    // ganancia de salud, no de calorías. Su óptimo es el piso, no la parrilla.
    perUnitMass: {
      nutrition: 3,
      digestibility: 0.3,
      toxicity: 0.55,
      moisture: 0.88,
      fuelEnergy: 1,
      denaturesAt: 45,
      pyrolysisAt: 200,
      ignitionPoint: 200,
      toughness: 0.2,
      decay: 0.12,
      rigidity: 0.08,
      flexibility: 0.3,
      tensile: 0.1,
      cohesion: 0.35,
      permeability: 0.45,
      charred: 0,
    },
    specificHeat: 3.7,
    provenance: SEMILLA,
  },

  {
    id: 'hoja',
    lexeme: { nombre: 'hoja', genero: 'f', sinonimos: ['hoja verde', 'follaje'] },
    tags: ['organico', 'vegetal'],
    // Verde y viva: alimenta poco pero alimenta, y con moisture 0.8 no prende.
    // La hoja SECA es otra sustancia, no ésta con menos agua (ver `hoja-seca`).
    perUnitMass: {
      nutrition: 2,
      digestibility: 0.25,
      toxicity: 0.3,
      moisture: 0.8,
      fuelEnergy: 2,
      denaturesAt: 40,
      pyrolysisAt: 180,
      ignitionPoint: 180,
      toughness: 0.08,
      decay: 0.14,
      rigidity: 0.03,
      flexibility: 0.75,
      tensile: 0.12,
      cohesion: 0.25,
      permeability: 0.6,
      charred: 0,
    },
    specificHeat: 3.3,
    provenance: SEMILLA,
  },

  {
    id: 'savia',
    lexeme: { nombre: 'savia', genero: 'f', sinonimos: ['resina', 'jugo'] },
    tags: ['organico', 'vegetal', 'liquido'],
    // cohesion 0.75 en un líquido: pega. Es el único adhesivo de la semilla, y
    // por eso la unión no depende solo de atar con fibra.
    perUnitMass: {
      nutrition: 4,
      digestibility: 0.65,
      toxicity: 0.25,
      moisture: 0.85,
      fuelEnergy: 3,
      denaturesAt: 70,
      pyrolysisAt: 190,
      ignitionPoint: 190,
      toughness: 0.02,
      decay: 0.1,
      rigidity: 0,
      flexibility: 1,
      tensile: 0.02,
      cohesion: 0.75,
      permeability: 0.9,
      charred: 0,
    },
    specificHeat: 3.9,
    provenance: SEMILLA,
  },

  {
    id: 'cuero',
    lexeme: { nombre: 'cuero', genero: 'm', sinonimos: ['pellejo curtido'] },
    tags: ['organico', 'fibroso'],
    // El caso extremo del barrido: apurarse cuesta 10% de las calorías. Y con
    // tensile 0.80 es también material de atadura — comerse el cuero es gastar
    // una herramienta, que es exactamente el tipo de decisión que buscamos.
    perUnitMass: {
      nutrition: 3,
      digestibility: 0.08,
      toxicity: 0.1,
      moisture: 0.2,
      fuelEnergy: 6,
      denaturesAt: 58,
      pyrolysisAt: 250,
      ignitionPoint: 250,
      toughness: 0.95,
      decay: 0.01,
      rigidity: 0.25,
      flexibility: 0.65,
      tensile: 0.8,
      cohesion: 0.7,
      permeability: 0.08,
      charred: 0,
    },
    specificHeat: 2.4,
    provenance: SEMILLA,
  },

  {
    id: 'medula',
    lexeme: { nombre: 'médula', genero: 'f', sinonimos: ['tuétano'] },
    tags: ['organico', 'carnoso'],
    // Lo más nutritivo de la semilla después de la grasa, y está DENTRO del
    // hueso: para comerla hay que romperlo. La recompensa la pone la geometría,
    // no un permiso.
    perUnitMass: {
      nutrition: 18,
      digestibility: 0.55,
      toxicity: 0.05,
      moisture: 0.4,
      fuelEnergy: 12,
      denaturesAt: 52,
      pyrolysisAt: 230,
      ignitionPoint: 230,
      toughness: 0.25,
      decay: 0.09,
      rigidity: 0.05,
      flexibility: 0.3,
      tensile: 0.1,
      cohesion: 0.4,
      permeability: 0.35,
      charred: 0,
    },
    specificHeat: 2.8,
    provenance: SEMILLA,
  },

  // ══ LO LEÑOSO ══════════════════════════════════════════════════════════════
  // Nada de acá tiene `nutrition` ni `denaturesAt`. No es una prohibición: es
  // que no hay nada que desnaturalizar y `calories = nutrition × mass ×
  // digestibility` da cero por más que se cocine. Ánima PUEDE hacer pescado
  // asado; NO PUEDE inventar madera nutritiva, y no porque una lista lo impida.

  {
    id: 'madera',
    lexeme: { nombre: 'madera', genero: 'f', sinonimos: ['leña', 'palo', 'rama'] },
    tags: ['organico', 'vegetal', 'fibroso'],
    // Los números del documento de arquitectura, tal cual. rigidity 0.70 pasa el
    // umbral 0.5 de la fricción: con dos varas de esto se hace el primer fuego.
    perUnitMass: {
      fuelEnergy: 18,
      ignitionPoint: 300,
      pyrolysisAt: 280,
      moisture: 0.25,
      rigidity: 0.7,
      flexibility: 0.2,
      nutrition: 0,
      toughness: 0.6,
      tensile: 0.55,
      cohesion: 0.65,
      digestibility: 0.02,
      toxicity: 0.05,
      decay: 0.01,
      permeability: 0.12,
      charred: 0,
    },
    specificHeat: 1.7,
    provenance: SEMILLA,
  },

  {
    id: 'madera-verde',
    lexeme: { nombre: 'madera verde', genero: 'f', sinonimos: ['leña verde', 'vara verde'] },
    tags: ['organico', 'vegetal', 'fibroso'],
    // La razón de que exista: moisture 0.62 está por ARRIBA del 0.45 con el que
    // la ley 3 deja prender. No arde hasta secarse, y secarla es una técnica.
    // Mientras tanto flexibility 0.55 la hace el material del arco y del aro:
    // lo que no sirve de leña sirve de estructura.
    perUnitMass: {
      fuelEnergy: 15,
      ignitionPoint: 300,
      pyrolysisAt: 280,
      moisture: 0.62,
      rigidity: 0.45,
      flexibility: 0.55,
      nutrition: 0,
      toughness: 0.75,
      tensile: 0.6,
      cohesion: 0.68,
      digestibility: 0.02,
      toxicity: 0.05,
      decay: 0.03,
      permeability: 0.22,
      charred: 0,
    },
    specificHeat: 2.3,
    provenance: SEMILLA,
  },

  {
    id: 'madera-dura',
    lexeme: { nombre: 'madera dura', genero: 'f', sinonimos: ['leño', 'tronco', 'madera densa'] },
    tags: ['organico', 'vegetal', 'fibroso'],
    // rigidity 0.88 y toughness 0.85: la mejor para frotar y la peor para
    // deshilachar. La misma cualidad que la hace buena herramienta la hace cara
    // de trabajar, y esa es la tensión que queremos en un material.
    perUnitMass: {
      fuelEnergy: 21,
      ignitionPoint: 340,
      pyrolysisAt: 320,
      moisture: 0.18,
      rigidity: 0.88,
      flexibility: 0.08,
      nutrition: 0,
      toughness: 0.85,
      tensile: 0.7,
      cohesion: 0.8,
      sharpness: 0.15,
      digestibility: 0.01,
      toxicity: 0.05,
      decay: 0.005,
      permeability: 0.06,
      charred: 0,
    },
    specificHeat: 1.6,
    provenance: SEMILLA,
  },

  {
    id: 'corteza',
    lexeme: { nombre: 'corteza', genero: 'f', sinonimos: ['cáscara de árbol'] },
    tags: ['organico', 'vegetal', 'fibroso'],
    // Fibrosa Y con ignitionPoint bajo: se deshilacha para atar o se usa de
    // yesca. Que un mismo material sirva para dos cosas incompatibles es lo que
    // hace que guardar sea una decisión.
    perUnitMass: {
      fuelEnergy: 16,
      ignitionPoint: 250,
      pyrolysisAt: 240,
      moisture: 0.3,
      rigidity: 0.3,
      flexibility: 0.7,
      nutrition: 0,
      toughness: 0.55,
      tensile: 0.5,
      cohesion: 0.55,
      digestibility: 0.02,
      toxicity: 0.1,
      decay: 0.02,
      permeability: 0.18,
      charred: 0,
    },
    specificHeat: 1.9,
    provenance: SEMILLA,
  },

  {
    id: 'liana',
    lexeme: { nombre: 'liana', genero: 'f', sinonimos: ['bejuco', 'enredadera'] },
    tags: ['organico', 'vegetal', 'fibroso'],
    // flexibility 0.90 y tensile 0.72 sin deshilacharla: la única atadura que se
    // usa tal como se encuentra. Es la rampa de entrada a `union`.
    perUnitMass: {
      fuelEnergy: 14,
      ignitionPoint: 290,
      pyrolysisAt: 270,
      moisture: 0.45,
      rigidity: 0.15,
      flexibility: 0.9,
      nutrition: 0,
      toughness: 0.7,
      tensile: 0.72,
      cohesion: 0.62,
      digestibility: 0.01,
      toxicity: 0.15,
      decay: 0.02,
      permeability: 0.25,
      charred: 0,
    },
    specificHeat: 2.2,
    provenance: SEMILLA,
  },

  {
    id: 'junco',
    lexeme: { nombre: 'junco', genero: 'm', sinonimos: ['caña delgada', 'paja'] },
    tags: ['organico', 'vegetal', 'fibroso'],
    // toughness 0.35 es lo más blando de lo fibroso: se teje barato. Tejido en
    // malla, permeability 0.35 lo vuelve el techo pobre — ocluye algo, no todo.
    perUnitMass: {
      fuelEnergy: 15,
      ignitionPoint: 260,
      pyrolysisAt: 245,
      moisture: 0.5,
      rigidity: 0.35,
      flexibility: 0.8,
      nutrition: 0,
      toughness: 0.35,
      tensile: 0.42,
      cohesion: 0.4,
      digestibility: 0.02,
      toxicity: 0.05,
      decay: 0.04,
      permeability: 0.35,
      charred: 0,
    },
    specificHeat: 2.5,
    provenance: SEMILLA,
  },

  {
    id: 'raiz',
    lexeme: { nombre: 'raíz', genero: 'f', sinonimos: ['raicilla', 'raíz fibrosa'] },
    tags: ['organico', 'vegetal', 'fibroso'],
    // OJO: NO es `raiz-dura`. Aquella es el tubérculo leñoso que se come; ésta
    // es la raíz de anclaje, que no alimenta y se deshilacha en hebra larga.
    // Dos sustancias con nombre parecido y comportamiento opuesto: la diferencia
    // la hace `nutrition`, no el nombre.
    perUnitMass: {
      fuelEnergy: 13,
      ignitionPoint: 300,
      pyrolysisAt: 285,
      moisture: 0.48,
      rigidity: 0.4,
      flexibility: 0.6,
      nutrition: 0,
      toughness: 0.72,
      tensile: 0.58,
      cohesion: 0.58,
      digestibility: 0.01,
      toxicity: 0.2,
      decay: 0.02,
      permeability: 0.2,
      charred: 0,
    },
    specificHeat: 2.4,
    provenance: SEMILLA,
  },

  {
    id: 'hoja-seca',
    lexeme: { nombre: 'hoja seca', genero: 'f', sinonimos: ['hojarasca', 'yesca'] },
    tags: ['organico', 'vegetal'],
    // La yesca, y por eso el ignitionPoint más bajo de las treinta (180) con la
    // humedad más baja de lo vegetal (0.06). Sin algo así, la fricción llega a
    // 375 °C y no prende nada: el primer fuego de la partida sería imposible.
    // No es `hoja` con menos agua — es hojarasca caída, ya sin nutrientes.
    perUnitMass: {
      fuelEnergy: 17,
      ignitionPoint: 180,
      pyrolysisAt: 170,
      moisture: 0.06,
      rigidity: 0.05,
      flexibility: 0.15,
      nutrition: 0,
      toughness: 0.05,
      tensile: 0.04,
      cohesion: 0.05,
      digestibility: 0.02,
      toxicity: 0.05,
      decay: 0.03,
      permeability: 0.75,
      charred: 0,
    },
    specificHeat: 1.5,
    provenance: SEMILLA,
  },

  // ══ LO ANIMAL QUE NO ES CARNE ══════════════════════════════════════════════

  {
    id: 'hueso',
    lexeme: { nombre: 'hueso', genero: 'm', sinonimos: ['esquirla'] },
    tags: ['organico', 'mineral'],
    // Los dos tags a la vez, y de ahí sale todo: `organico` lo deja carbonizarse
    // (ignitionPoint 500, alcanzable solo en contacto con brasas), `mineral` lo
    // hace rígido. sharpness 0.30 sin filo trabajado: astillado ya corta.
    // nutrition 0 a propósito — lo que alimenta es la `medula` de adentro.
    perUnitMass: {
      nutrition: 0,
      fuelEnergy: 4,
      ignitionPoint: 500,
      pyrolysisAt: 480,
      moisture: 0.15,
      rigidity: 0.92,
      flexibility: 0.05,
      tensile: 0.55,
      cohesion: 0.88,
      toughness: 0.8,
      sharpness: 0.3,
      digestibility: 0.01,
      toxicity: 0.02,
      decay: 0.002,
      permeability: 0.05,
      charred: 0,
    },
    specificHeat: 1.3,
    provenance: SEMILLA,
  },

  {
    id: 'pluma',
    lexeme: { nombre: 'pluma', genero: 'f', sinonimos: ['plumón'] },
    tags: ['organico', 'fibroso'],
    // Casi nada de masa y casi nada de todo, salvo flexibility. Está para que
    // el abrigo tenga un material propio y no sea cuero o nada.
    perUnitMass: {
      nutrition: 0,
      fuelEnergy: 11,
      ignitionPoint: 230,
      pyrolysisAt: 220,
      moisture: 0.1,
      rigidity: 0.2,
      flexibility: 0.85,
      tensile: 0.3,
      cohesion: 0.15,
      toughness: 0.3,
      digestibility: 0.005,
      toxicity: 0.02,
      decay: 0.01,
      permeability: 0.55,
      charred: 0,
    },
    specificHeat: 1.6,
    provenance: SEMILLA,
  },

  {
    id: 'tendon',
    lexeme: { nombre: 'tendón', genero: 'm', sinonimos: ['nervio', 'ligamento'] },
    tags: ['organico', 'fibroso'],
    // tensile 0.95: la mejor atadura del mundo semilla. Y alimenta un poco, con
    // toughness 0.98, la más alta de las treinta — o sea que comerlo exige
    // cocinarlo eternamente. Elegir entre atar y comer es el punto.
    //
    // flexibility 0.82 y no 0.72, que era lo que decía antes. No es una perilla:
    // 0.80 es a la vez el umbral del rol `binder` de `union` y el `STRAND_FLEXIBILITY`
    // de `body.ts`, o sea la línea entre «hebra que cuelga» y «cosa que sostiene».
    // Con 0.72 la mejor atadura de la semilla no podía atar nada y ningún ensamble
    // de hueso tenía `catch` — o sea que el ejemplo (c) del documento de
    // arquitectura, «un hueso con un tendón», era imposible. Un tendón es más
    // flexible que una liana pelada; el número viejo se contradecía con su propio
    // comentario.
    perUnitMass: {
      nutrition: 2,
      digestibility: 0.05,
      toxicity: 0.05,
      moisture: 0.35,
      fuelEnergy: 5,
      denaturesAt: 68,
      pyrolysisAt: 240,
      ignitionPoint: 240,
      toughness: 0.98,
      rigidity: 0.1,
      flexibility: 0.82,
      tensile: 0.95,
      cohesion: 0.75,
      decay: 0.02,
      permeability: 0.06,
      charred: 0,
    },
    specificHeat: 2.7,
    provenance: SEMILLA,
  },

  {
    id: 'grasa',
    lexeme: { nombre: 'grasa', genero: 'f', sinonimos: ['sebo', 'unto'] },
    tags: ['organico', 'carnoso'],
    // Lo único que es comida Y combustible de primera: nutrition 22 y
    // fuelEnergy 30, más que la madera. Quemarla para tener luz es quemarse la
    // cena, y esa es una decisión que nadie tuvo que escribir como regla.
    perUnitMass: {
      nutrition: 22,
      digestibility: 0.7,
      toxicity: 0.05,
      moisture: 0.1,
      fuelEnergy: 30,
      denaturesAt: 45,
      pyrolysisAt: 300,
      ignitionPoint: 300,
      toughness: 0.1,
      rigidity: 0.1,
      flexibility: 0.6,
      tensile: 0.05,
      cohesion: 0.55,
      decay: 0.06,
      permeability: 0.1,
      charred: 0,
    },
    specificHeat: 2,
    provenance: SEMILLA,
  },

  {
    id: 'piel',
    lexeme: { nombre: 'piel', genero: 'f', sinonimos: ['pellejo', 'cuero crudo'] },
    tags: ['organico', 'fibroso'],
    // La piel cruda es el cuero antes de secarse: mismo tensile menos 0.25, y
    // decay 0.11 contra 0.01. O sea que se pudre once veces más rápido. Curtir
    // no es una receta: es dejar de perderla, y la ley 6 lo cobra sola.
    perUnitMass: {
      nutrition: 2,
      digestibility: 0.1,
      toxicity: 0.15,
      moisture: 0.55,
      fuelEnergy: 5,
      denaturesAt: 56,
      pyrolysisAt: 245,
      ignitionPoint: 245,
      toughness: 0.8,
      rigidity: 0.1,
      flexibility: 0.85,
      tensile: 0.55,
      cohesion: 0.6,
      decay: 0.11,
      permeability: 0.25,
      charred: 0,
    },
    specificHeat: 3,
    provenance: SEMILLA,
  },

  // ══ LO MINERAL ═════════════════════════════════════════════════════════════
  // Ni `nutrition`, ni `denaturesAt`, ni `fuelEnergy`. La ley 4 se corta en
  // `tags.includes('organico')`, así que ni transmutan ni arden.

  {
    id: 'piedra',
    lexeme: { nombre: 'piedra', genero: 'f', sinonimos: ['canto', 'roca'] },
    tags: ['mineral'],
    // rigidity 0.95 pasa el umbral de la fricción: frotar dos piedras es legal.
    // Que además no produzca energía infinita lo garantiza `admit()`, no esta
    // fila: `drive` de temperatura sin `poweredBy` no entra al mundo.
    perUnitMass: {
      nutrition: 0,
      fuelEnergy: 0,
      moisture: 0.02,
      ignitionPoint: NO_ARDE,
      pyrolysisAt: NO_ARDE,
      rigidity: 0.95,
      flexibility: 0.01,
      tensile: 0.15,
      cohesion: 0.9,
      toughness: 0.7,
      sharpness: 0.05,
      digestibility: 0,
      toxicity: 0,
      decay: 0,
      permeability: 0.02,
      charred: 0,
    },
    specificHeat: 0.8,
    provenance: SEMILLA,
  },

  {
    id: 'pedernal',
    lexeme: { nombre: 'pedernal', genero: 'm', sinonimos: ['sílex', 'piedra de filo'] },
    tags: ['mineral'],
    // rigidity 0.98 con toughness 0.35: rígido y FRÁGIL a la vez, que es la
    // combinación que hace que se lasque en filo. sharpness 0.85 es el máximo de
    // la semilla, y es lo único con lo que se puede cortar de entrada.
    perUnitMass: {
      nutrition: 0,
      fuelEnergy: 0,
      moisture: 0.01,
      ignitionPoint: NO_ARDE,
      pyrolysisAt: NO_ARDE,
      rigidity: 0.98,
      flexibility: 0.005,
      tensile: 0.1,
      cohesion: 0.85,
      toughness: 0.35,
      sharpness: 0.85,
      digestibility: 0,
      toxicity: 0,
      decay: 0,
      permeability: 0.01,
      charred: 0,
    },
    specificHeat: 0.75,
    provenance: SEMILLA,
  },

  {
    id: 'arcilla',
    lexeme: { nombre: 'arcilla', genero: 'f', sinonimos: ['barro', 'greda'] },
    tags: ['mineral'],
    // permeability 0.05, la segunda más baja: es la tapa. Con esto la ley 12
    // baja el oxígeno de la celda y la fogata tapada da carbón en vez de ceniza.
    // Que sea plástica (flexibility 0.45 con moisture 0.35) hace que tapar sea
    // moldear y no encontrar una losa del tamaño justo.
    perUnitMass: {
      nutrition: 0,
      fuelEnergy: 0,
      moisture: 0.35,
      ignitionPoint: NO_ARDE,
      pyrolysisAt: NO_ARDE,
      rigidity: 0.2,
      flexibility: 0.45,
      tensile: 0.08,
      cohesion: 0.72,
      toughness: 0.25,
      sharpness: 0,
      digestibility: 0,
      toxicity: 0.05,
      decay: 0,
      permeability: 0.05,
      charred: 0,
    },
    specificHeat: 1.4,
    provenance: SEMILLA,
  },

  // ══ EL AGUA Y EL CARBÓN ════════════════════════════════════════════════════

  {
    id: 'agua',
    lexeme: { nombre: 'agua', genero: 'f', sinonimos: ['líquido'] },
    tags: ['liquido'],
    // specificHeat 4.2, más del doble que la madera: es el lastre térmico del
    // mundo. Y moisture 1 con permeability 1 es lo que hace que la ley 11 tenga
    // de dónde mojar. Una fogata en la orilla no se apaga sola por decreto: se
    // apaga porque esto le sube la humedad al combustible.
    perUnitMass: {
      nutrition: 0,
      fuelEnergy: 0,
      moisture: 1,
      ignitionPoint: NO_ARDE,
      pyrolysisAt: NO_ARDE,
      rigidity: 0,
      flexibility: 1,
      tensile: 0,
      cohesion: 0.15,
      toughness: 0,
      sharpness: 0,
      digestibility: 0.95,
      toxicity: 0,
      decay: 0,
      permeability: 1,
      charred: 0,
    },
    specificHeat: 4.2,
    provenance: SEMILLA,
  },

  {
    id: 'carbon',
    lexeme: { nombre: 'carbón', genero: 'm', sinonimos: ['brasa', 'tizón'] },
    tags: ['carbonoso'],
    // NO lleva el tag `organico`, y es deliberado: la ley 4 se aplica sobre
    // `organico`, así que el carbón recién hecho NO vuelve a transmutar. Ése era
    // el bug del ejemplo (a) de una de las propuestas, donde el carbón nacía
    // adentro del fuego y se convertía en ceniza solo.
    // charred 1 porque ya está pirolizado; fuelEnergy 32 —el más alto— porque el
    // premio de tapar la fogata tiene que ser visible en la aritmética.
    perUnitMass: {
      nutrition: 0,
      fuelEnergy: 32,
      ignitionPoint: 420,
      pyrolysisAt: NO_ARDE,
      moisture: 0.03,
      rigidity: 0.35,
      flexibility: 0.02,
      tensile: 0.05,
      cohesion: 0.3,
      toughness: 0.2,
      sharpness: 0.1,
      digestibility: 0.01,
      toxicity: 0.1,
      decay: 0,
      permeability: 0.4,
      charred: 1,
    },
    specificHeat: 0.9,
    provenance: SEMILLA,
  },
]

/** Índice por id. La `Physics` lo consume tal cual en su campo `substances`. */
export const SUSTANCIAS_POR_ID: ReadonlyMap<SubstanceId, Substance> = new Map(
  SUSTANCIAS_SEMILLA.map((s) => [s.id, s]),
)
