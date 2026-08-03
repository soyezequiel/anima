// ─── EL REPORTE: TODO LO QUE HACE FALTA PARA DEBUGGEAR SIN HABER ESTADO ─────
//
// Alguien juega, algo no anda —la criatura se queda quieta, el pedido no avanza,
// la pestaña tira un error— y del otro lado hay que averiguar por qué SIN el
// navegador donde pasó. Este archivo arma el archivo que cierra ese hueco.
//
// ─── LA DECISIÓN QUE ORDENA TODO LO DEMÁS: DOS LECTORES, UN ARCHIVO ─────────
//
// Lo lee una persona y lo lee una máquina, y quieren cosas opuestas. La persona
// quiere las diez líneas que dicen qué pasó; la máquina quiere el mundo entero
// para poder correrlo. Un archivo que sólo tenga el resumen no deja reproducir
// nada; uno que sólo tenga el volcado obliga a leer medio megabyte de JSON para
// enterarse de que la criatura tenía hambre.
//
// Van los dos, en ese orden: **el resumen arriba, el volcado abajo**. Quien lo
// abre ve el diagnóstico; quien lo necesita entero baja hasta el bloque. Y por
// eso es Markdown y no JSON: el orden y los títulos son parte de lo que este
// archivo aporta, y un JSON no tiene arriba ni abajo.
//
// ─── Y EL ORDEN DE LAS SECCIONES NO ES DECORATIVO ──────────────────────────
//
// Primero lo que se rompió, después dónde está la partida, después qué estaba
// intentando hacer, y al final lo que sabe y de qué hablaron. Es el orden en que
// se descarta: un error no atrapado explica el síntoma solo, y recién cuando no
// hay ninguno tiene sentido preguntarse qué estaba pensando la criatura.
//
// ─── LO QUE ESTE ARCHIVO NO HACE ───────────────────────────────────────────
//
// No toca el DOM, no lee `window` y no baja nada. Recibe datos y devuelve texto,
// así que se prueba entero sin abrir un navegador — que es la misma división que
// `lo-senalado.ts` y `con-quien.ts` ya tienen en esta app. Juntar los datos y
// disparar la descarga son de `main.ts`, y son tres líneas cada uno.

import type { LoJuntado, Rotura } from './lo-que-se-rompio.js'

/** La versión del FORMATO del reporte, no del juego. Sube si cambian las secciones. */
export const VERSION_DEL_REPORTE = 1

/** Un par de los que van en las tablas de dos columnas. */
export type Par = readonly [clave: string, valor: string]

/**
 * Las filas de una tabla, salteando lo que esta partida no tiene.
 *
 * Se cae lo que no existe (`undefined`) y también lo que existe VACÍO —la nota
 * del enlace cuando no hay nada que aclarar—, y lo segundo no es cosmética: una
 * fila con la celda derecha en blanco se lee como un dato que se perdió en el
 * camino, y manda a alguien a averiguar por qué el reporte no lo trajo. Una fila
 * que no está no promete nada.
 */
export function pares(...filas: readonly (Par | undefined)[]): readonly Par[] {
  return filas.filter((f): f is Par => f !== undefined && f[1] !== '')
}

/** Una línea de la charla, aplanada para el reporte. */
export interface LineaDeCharla {
  readonly turno: number
  readonly clase: string
  readonly texto: string
}

export interface DatosDelReporte {
  /** La hora de PARED en que se pidió el reporte. Del navegador, no del mundo. */
  readonly cuando: string
  /** Navegador, ventana, y con qué se está corriendo esto. */
  readonly maquina: readonly Par[]
  /** Semilla, frecuencia, versiones. Lo que hay que igualar para reproducir. */
  readonly conQue: readonly Par[]
  /** Tick, velocidad, cuadro, guardado. Dónde está la partida ahora. */
  readonly donde: readonly Par[]
  readonly roturas: LoJuntado
  /** Lo que `stepWorld` lanzó, con su tick. Sale de `Partida.informe.fallas`. */
  readonly fallasDelTick: readonly string[]
  /**
   * Los estados ilegales que el arnés vio — o `undefined` si NO SE MIRÓ.
   *
   * La distinción es de `Informe.vigilada` y acá se conserva a propósito: una
   * lista vacía y un `undefined` son «no hubo» y «nadie se fijó», y confundirlos
   * es cómo alguien tacha los invariantes de la lista de sospechosos sin haberlos
   * revisado nunca.
   */
  readonly violaciones: readonly string[] | undefined
  /** Dónde está, cómo viene de aliento, qué lleva, qué está haciendo. */
  readonly criatura: readonly Par[]
  /** Qué meta persigue, de quién es, y qué pasos le faltan. */
  readonly mente: { readonly persigue: string; readonly pasos: readonly string[]; readonly nota: string }
  /**
   * CÓMO LEYÓ LA ÚLTIMA FRASE, cláusula por cláusula.
   *
   * Es la sección que separa los dos bugs que desde afuera se ven idénticos:
   * «le pedí algo y no lo hizo» puede ser que no lo entendió —y entonces el
   * problema está en `@anima/lang`— o que lo entendió bien y no supo cómo —y
   * entonces está en el planificador o en el catálogo. Sin la lectura, las dos
   * hipótesis cuestan lo mismo y hay que probar las dos.
   */
  readonly lectura: { readonly crudo: string; readonly confianza: string; readonly clausulas: readonly string[] } | undefined
  /** Con quién habla, cuántas consultas salieron y qué pasó con ellas. */
  readonly enlace: readonly Par[]
  readonly charla: readonly LineaDeCharla[]
  /** Lo que la criatura recuerda, ya escrito con su procedencia. */
  readonly recuerdos: readonly string[]
  /** Lo que sabe hacer: metas del catálogo y obras aprendidas. */
  readonly catalogo: readonly string[]
  /**
   * LA PARTIDA ENTERA, tal como se guarda en el navegador (`comoSeGuarda`).
   *
   * Es lo único de todo el archivo con lo que se puede volver a correr el mundo,
   * y por eso va aunque pese: sin esto el reporte cuenta un problema y no deja
   * reproducirlo, que es la mitad más barata y la menos útil.
   */
  readonly guardado: unknown
}

// ─── Los ladrillos ───────────────────────────────────────────────────────────
//
// Todo el archivo se escribe con tres, y los tres se defienden solos de lo que
// más rompe un Markdown armado a mano: un valor con un salto de línea adentro
// —un stack, un mensaje de error de varias líneas— parte la tabla al medio y
// desde ahí abajo el archivo se lee como texto suelto. Los saltos se aplanan una
// sola vez, acá, en vez de en cada uno de los quince lugares que llaman.

function unaLinea(v: string): string {
  return v.replace(/\s*\n\s*/g, ' ⏎ ')
}

function tabla(pares: readonly Par[]): string {
  if (pares.length === 0) return '_(nada)_\n'
  const filas = pares.map(([k, v]) => `| ${unaLinea(k)} | ${unaLinea(v)} |`)
  return ['| | |', '| --- | --- |', ...filas].join('\n') + '\n'
}

function lista(items: readonly string[], siNoHay: string): string {
  if (items.length === 0) return `_${siNoHay}_\n`
  return items.map((x) => `- ${unaLinea(x)}`).join('\n') + '\n'
}

/**
 * Una rotura escrita entera, con el stack en un bloque aparte.
 *
 * El stack NO se aplana: es lo único del reporte donde los saltos de línea son
 * el contenido. Por eso va en un bloque de código y no en la lista.
 */
function laRotura(r: Rotura, i: number): string {
  const donde = r.tick === undefined ? 'antes del primer tick' : `tick ${String(r.tick)}`
  const cabeza = `**${String(i + 1)}. ${r.de}** · ${donde} · ${String(r.desdeQueAbrio)} ms desde que abrió\n\n${unaLinea(r.texto)}\n`
  return r.stack === undefined ? cabeza : `${cabeza}\n\`\`\`\n${r.stack}\n\`\`\`\n`
}

/**
 * EL VOLCADO, Y LA RED QUE LO ENVUELVE.
 *
 * `JSON.stringify` puede lanzar —un ciclo, un `bigint`— y si lo hace acá se
 * lleva puesto el reporte entero: el jugador aprieta el botón, no baja nada, y
 * el error del que quería informar se pierde junto con el que lo tapó. Así que
 * la falla se ESCRIBE EN EL REPORTE y el resto del archivo sale igual.
 *
 * Hoy no debería lanzar nunca: `EstadoDelDios` documenta que su semilla va en
 * texto porque «una ranura tiene que sobrevivir a `JSON.stringify`», y hay un
 * test del Hito 5 que lo ataca. Esta red existe para el día que alguien meta un
 * `Map` o una fecha en una ranura nueva — y ese día el reporte lo va a decir con
 * todas las letras en vez de dejar de existir.
 *
 * Sin indentación: son cientos de kilobytes de un dato que ninguna persona lee a
 * ojo, y sangrarlo lo duplica. Quien lo necesite legible tiene un `JSON.parse`.
 */
function volcado(v: unknown): { readonly texto: string; readonly pesoKB: number | undefined } {
  try {
    const texto = JSON.stringify(v)
    if (texto === undefined) return { texto: 'null', pesoKB: 0 }
    return { texto, pesoKB: Math.round(texto.length / 1024) }
  } catch (e) {
    return {
      texto: `NO SE PUDO VOLCAR: ${e instanceof Error ? e.message : String(e)}`,
      pesoKB: undefined,
    }
  }
}

/**
 * EL ARCHIVO ENTERO.
 *
 * La cabecera le habla a quien lo abre —humano o máquina— y dice tres cosas que
 * el resto del archivo no puede decir de sí mismo: qué es esto, qué NO está
 * adentro, y cómo se vuelve a correr el mundo que trae. La tercera es la que
 * convierte al volcado en algo utilizable: un JSON sin la línea que dice con qué
 * función se carga obliga a leer el código del guardado para adivinarlo.
 */
export function reporteEnMarkdown(d: DatosDelReporte): string {
  const v = volcado(d.guardado)
  const partes: string[] = []
  const p = (s: string): void => {
    partes.push(s)
  }

  p(`# Reporte de una partida de Ánima II\n`)
  p(
    `_Generado por el juego el ${d.cuando} · formato v${String(VERSION_DEL_REPORTE)}._\n\n` +
      `Esto es el estado de UNA partida corriendo en un navegador, volcado para que se\n` +
      `pueda debuggear desde afuera. El código vive en \`ii/\` de este repo.\n\n` +
      // Lo que falta se dice SIEMPRE y no sólo cuando falta algo: quien lee un
      // reporte no sabe qué no está mirando, y una ausencia no anunciada se lee
      // como un cero. La cuenta de roturas NO va acá —arranca en cero y la frase
      // quedaría diciendo «las últimas 0»—; va en su propia sección, que es donde
      // significa algo.
      `**Lo que NO está acá:** los sprites del depósito (se piden a un backend aparte y\n` +
      `no cambian el mundo), la actividad en vuelo de la habilidad —que a propósito no\n` +
      `se serializa nunca, ver el encabezado de \`packages/store/src/guardar.ts\`— y las\n` +
      `roturas más viejas que las últimas doscientas, que es lo que el vigía retiene.\n\n` +
      `**Para volver a correr el mundo que trae:** el bloque JSON del final es un\n` +
      `\`Guardado\` de \`@anima/store\`, el mismo que el juego escribe en IndexedDB.\n` +
      `\`comoSeRestaura(guardado)\` devuelve \`{ state, creencias, charla, encargo }\`, y con\n` +
      `\`new Partida(state)\` de \`@anima/perceive\` arranca desde ahí. La semilla y la\n` +
      `versión de física de la sección «Con qué corrió» **tienen que coincidir** o el\n` +
      `mundo restaurado es coherente y distinto.\n`,
  )

  // ─── 1. Lo que se rompió ──────────────────────────────────────────────────
  //
  // Primero, y sin importar que casi siempre esté vacío: cuando NO está vacío,
  // es lo único que hay que leer.
  p(`\n## 1. Qué se rompió\n`)
  if (d.roturas.tiradas > 0) {
    p(
      `\n> Se anotaron ${String(d.roturas.roturas.length)} roturas y se tiraron ${String(d.roturas.tiradas)} más viejas por el tope del buffer.\n` +
        `> Que se haya llenado ya es un dato: algo estaba fallando en bucle.\n`,
    )
  }
  if (d.roturas.roturas.length === 0) {
    p(`\n_Ninguna. Ni excepciones, ni promesas rechazadas, ni \`console.error\`._\n`)
  } else {
    p('\n' + d.roturas.roturas.map(laRotura).join('\n'))
  }

  p(`\n### Lo que lanzó el tick\n\n${lista(d.fallasDelTick, 'nada: ningún `stepWorld` lanzó')}`)

  p(`\n### Invariantes del mundo\n`)
  p(
    d.violaciones === undefined
      ? `\n_**No se miró.** La partida corre sin el arnés de invariantes (\`vigilar\`), así que\n` +
          `esto no es «no hubo violaciones»: es que nadie se fijó. No se puede descartar al\n` +
          `mundo como sospechoso con este reporte._\n`
      : '\n' + lista(d.violaciones, 'ninguna: el arnés corrió y no vio estados ilegales'),
  )

  // ─── 2. Dónde está la partida ─────────────────────────────────────────────
  p(`\n## 2. Dónde está la partida\n\n${tabla(d.donde)}`)
  p(`\n### Con qué corrió\n\n${tabla(d.conQue)}`)
  p(`\n### En qué máquina\n\n${tabla(d.maquina)}`)

  // ─── 3. La criatura ───────────────────────────────────────────────────────
  p(`\n## 3. La criatura\n\n${tabla(d.criatura)}`)

  // ─── 4. Qué estaba intentando hacer ───────────────────────────────────────
  p(`\n## 4. Qué estaba intentando hacer\n`)
  p(`\n**Persigue:** ${unaLinea(d.mente.persigue)}\n`)
  p(`\n${lista(d.mente.pasos, d.mente.nota === '' ? 'sin pasos que listar' : d.mente.nota)}`)

  p(`\n### Cómo entendió lo último que le dijiste\n`)
  p(
    d.lectura === undefined
      ? `\n_No leyó ninguna frase en esta sesión._\n`
      : `\n**«${unaLinea(d.lectura.crudo)}»** · confianza ${d.lectura.confianza}\n\n` +
          lista(d.lectura.clausulas, 'la leyó y no sacó ninguna cláusula: no entendió nada de la frase'),
  )

  // ─── 5. Qué se le pidió ───────────────────────────────────────────────────
  //
  // La charla entera y no las últimas N: son unas pocas líneas por partida, y la
  // orden que explica el estado raro suele ser la de hace diez turnos.
  p(`\n## 5. De qué hablaron\n`)
  p(
    '\n' +
      lista(
        d.charla.map((l) => `\`#${String(l.turno)}\` **${l.clase}** — ${l.texto}`),
        'nadie dijo nada: la partida corrió sin una sola orden',
      ),
  )

  // ─── 6. Qué sabe ──────────────────────────────────────────────────────────
  p(`\n## 6. Qué sabe\n`)
  p(`\n### Lo que recuerda\n\n${lista(d.recuerdos, 'nada todavía')}`)
  p(`\n### Lo que sabe hacer\n\n${lista(d.catalogo, 'vacío')}`)
  p(`\n### Con quién está hablando\n\n${tabla(d.enlace)}`)

  // ─── 7. El mundo, en crudo ────────────────────────────────────────────────
  p(`\n## 7. El mundo, en crudo\n`)
  p(
    v.pesoKB === undefined
      ? `\n> **El volcado falló.** Todo lo de arriba sigue valiendo; lo que no se puede es\n` +
          `> reproducir la partida desde este archivo.\n\n\`\`\`\n${v.texto}\n\`\`\`\n`
      : `\n_${String(v.pesoKB)} KB. Es un \`Guardado\` de \`@anima/store\` — ver la cabecera para cargarlo._\n\n` +
          `\`\`\`json\n${v.texto}\n\`\`\`\n`,
  )

  return partes.join('')
}

/**
 * El nombre del archivo que se baja.
 *
 * Lleva el TICK y no sólo la hora, y es lo que hace que dos reportes de la misma
 * sesión se puedan ordenar por lo que le pasó al mundo en vez de por lo que
 * tardó la persona en apretar el botón. La hora va igual, sin los dos puntos:
 * Windows no los acepta en un nombre de archivo y el navegador los reemplaza en
 * silencio por algo distinto en cada sistema.
 */
export function nombreDelArchivo(tick: number, cuando: string): string {
  const limpio = cuando.replace(/[:.]/g, '-').replace(/[^\w-]/g, '_')
  return `anima-ii-tick-${String(tick)}-${limpio}.md`
}
