/**
 * EL LINT DE LAS CONSTANTES FÍSICAS — Hito 8, del caso de aceptación.
 *
 *   > **prohibido copiar constantes físicas dentro de las skills** — un literal
 *   > de calibración adentro de una habilidad es un sello que `physicsVersion`
 *   > no puede invalidar
 *
 * ─── LA MEDICIÓN LO REDEFINIÓ ENTERO ────────────────────────────────────────
 *
 * Tal como está escrito no se puede implementar. Medido: `@anima/physics` exporta
 * **18 constantes con valor numérico**, y de los 27 borradores del corpus,
 * cuántos contienen cada valor como literal:
 *
 *   MAX_ASSEMBLY_DEPTH        3        26 de 27
 *   MIN_ENVELOPE_SAMPLES      2        24
 *   MAX_EFFICIENCY            1        23
 *   ENVELOPE_SLACK / H_PERDIDA  0.5    13
 *   ...
 *   HUMEDAD_QUE_APAGA         0.45      4
 *   OXIGENO_QUE_HACE_CENIZA   0.35      4
 *   DIGESTIBILIDAD_TECHO      0.95      1
 *   T_AMBIENTE                15        0
 *   CALOR_POR_COMBUSTIBLE     20000     0
 *
 * **Un lint que marque «el valor de una constante física» rechaza 26 de 27
 * borradores**, porque `1`, `2`, `3` y `0.5` son números y no constantes.
 *
 * ─── Pero la cola es oro, y ahí están las copias de verdad ──────────────────
 *
 *   t1/encender-solo-cuando-va-a-prender.ts:53
 *     const HUMEDAD_QUE_APAGA = 0.45 // ley 11, doc:374   ← con NOMBRE Y TODO
 *   t2 (×3)  ctx.q(b, 'moisture') < 0.45                  ← el valor pelado
 *   t3       const OXI_UMBRAL = 0.35                      ← copia renombrada
 *   t4       const puedoCorrer = aliento > 0.35           ← FALSO POSITIVO
 *
 * Siete copias reales y un falso positivo. O sea: **el `0.45` sólo es una
 * constante física cuando está al lado de `moisture`.** El valor solo no alcanza.
 *
 * ─── Entonces el lint son DOS reglas, y la primera no puede fallar ──────────
 *
 *   1. **el NOMBRE** — un `const HUMEDAD_QUE_APAGA = …` adentro de una
 *      habilidad. Cero falsos positivos posibles: nadie escribe ese nombre por
 *      casualidad.
 *   2. **el valor JUNTO A la cualidad que calibra** — `0.45` en una línea que
 *      lee `moisture`. Es lo que separa las tres copias de t2 del `aliento >
 *      0.35` de t4.
 *
 * La segunda necesita saber qué cualidad calibra cada constante, y eso **no
 * existe como dato en la física**. Va declarado acá, corto, y con un guardián:
 * el test verifica que cada nombre de la tabla siga existiendo en
 * `@anima/physics`. Una tabla que queda vieja en silencio es exactamente lo que
 * el guardián del sello (Hito 7) existe para atajar.
 */

/**
 * QUÉ CUALIDAD CALIBRA CADA CONSTANTE, y por qué son sólo éstas.
 *
 * Son las que el corpus mostró copiadas. Las otras trece no entran por una razón
 * medida y no por olvido: **sus valores son números comunes**. Meter
 * `MAX_ASSEMBLY_DEPTH = 3` en esta tabla haría que el lint marque el 96% del
 * corpus, y un lint que marca todo no lo lee nadie.
 *
 * El día que una de las trece aparezca copiada de verdad, entra. La regla para
 * decidirlo está escrita: **entra la que el corpus muestre copiada, no la que
 * parezca peligrosa.**
 */
export const CALIBRACIONES: readonly { readonly nombre: string; readonly valor: number; readonly cualidad: string }[] = [
  { nombre: 'HUMEDAD_QUE_APAGA', valor: 0.45, cualidad: 'moisture' },
  { nombre: 'OXIGENO_QUE_HACE_CENIZA', valor: 0.35, cualidad: 'oxygen' },
  { nombre: 'DIGESTIBILIDAD_TECHO', valor: 0.95, cualidad: 'digestibility' },
  { nombre: 'T_AMBIENTE', valor: 15, cualidad: 'temperature' },
  { nombre: 'CALOR_POR_COMBUSTIBLE', valor: 20000, cualidad: 'fuelEnergy' },
  { nombre: 'CARBONIZADO_QUE_TRANSMUTA', valor: 0.8, cualidad: 'charred' },
]

export type Motivo =
  /** Re-declaró la constante con su nombre. La que no puede ser un falso positivo. */
  | 'el-nombre'
  /** Puso el valor al lado de la cualidad que calibra. */
  | 'el-valor-y-la-cualidad'

export interface Hallazgo {
  readonly motivo: Motivo
  readonly constante: string
  readonly linea: number
  /** La línea entera, para poder leerla en el informe sin abrir el archivo. */
  readonly texto: string
}

/** `0.45` sí, `10.45` no, `x.45` no. Un número que no es parte de otro. */
function tieneElValor(linea: string, valor: number): boolean {
  const v = String(valor).replace('.', '\\.')
  return new RegExp(`(?<![\\w.])${v}(?![\\w.])`).test(linea)
}

/**
 * LO QUE ESTE CÓDIGO COPIÓ DE LA FÍSICA.
 *
 * Vacío quiere decir limpio. Se mira **línea por línea** y no sobre el fuente
 * entero, por la regla 2 de este archivo: un `0.45` en la línea 3 y un
 * `moisture` en la línea 40 no son una copia, son dos cosas que pasaban por ahí.
 */
export function loQueCopio(codigo: string): readonly Hallazgo[] {
  const out: Hallazgo[] = []
  const lineas = codigo.split('\n')

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]
    if (l === undefined) continue
    // ─── LOS COMENTARIOS NO SON CÓDIGO ────────────────────────────────────
    // Medido en el corpus: un borrador tiene la línea `// a mano su compuerta
    // con el literal HUMEDAD_QUE_APAGA`, que es alguien EXPLICANDO el problema y
    // no cometiéndolo. Es la misma regla que el guardián de la regla 2 ya usa:
    // *«explicar por qué algo está prohibido no es la infracción»*.
    const t = l.trimStart()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
    for (const c of CALIBRACIONES) {
      // ─── Regla 1: el nombre ────────────────────────────────────────────
      if (new RegExp(`\\b${c.nombre}\\b`).test(l)) {
        out.push({ motivo: 'el-nombre', constante: c.nombre, linea: i + 1, texto: l.trim() })
        continue
      }
      // ─── Regla 2: el valor JUNTO A su cualidad ─────────────────────────
      if (tieneElValor(l, c.valor) && new RegExp(`['"\`]${c.cualidad}['"\`]`).test(l)) {
        out.push({ motivo: 'el-valor-y-la-cualidad', constante: c.nombre, linea: i + 1, texto: l.trim() })
      }
    }
  }
  return out
}

/**
 * EL MENSAJE PARA EL MODELO, en castellano llano.
 *
 * Va al encargo de la vuelta siguiente, igual que los cargos del juez. Dice QUÉ
 * hizo mal y QUÉ hacer en su lugar, porque «no copies constantes» sin la
 * alternativa deja al modelo sin salida: la calibración la necesita para decidir.
 */
export function comoSeArregla(h: Hallazgo): string {
  const c = CALIBRACIONES.find((x) => x.nombre === h.constante)
  return h.motivo === 'el-nombre'
    ? `línea ${String(h.linea)}: copiaste ${h.constante}, que es una constante de la física. Preguntale al mundo en vez de escribir el número.`
    : `línea ${String(h.linea)}: ${String(c?.valor ?? '')} al lado de «${c?.cualidad ?? ''}» es ${h.constante} copiada. El día que la física cambie, tu habilidad se queda con el número viejo y nadie se entera.`
}
