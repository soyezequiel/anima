// ─── EL DEPÓSITO: DÓNDE SE GUARDA, Y POR QUÉ ES UNA INTERFAZ ────────────────
//
// El plan del Hito 10 pide *«journal append-only con snapshots por delta en
// IndexedDB **fuera del tick**»*. Las dos mitades de esa frase deciden todo lo
// que hay en este archivo.
//
// ─── «FUERA DEL TICK» ES LO QUE HACE LEGAL EL `await` ACÁ ───────────────────
//
// Este es **el primer paquete de `ii/` donde `await` no está prohibido**, y hay
// que decir por qué no es una excepción de conveniencia. La regla 2 —«el tick no
// tiene un solo `await`»— protege al TICK: una espera adentro del tick hace que
// la partida dependa de cuánto tardó el disco, y con eso el replay muere.
//
// Guardar no pasa por el tick. Es la misma frontera del ADR II-0024 que el Hito
// 6 y el tramo H del Hito 8 ya usaron: **el paquete de adentro describe, el de
// afuera espera**. Acá estamos del lado de afuera.
//
// Lo que este paquete SÍ mantiene de la regla 2 es todo lo demás, y con su
// guardián propio: nada de `Math.random`, nada de `Date.now`, nada de `Intl`. Un
// guardado que se estampara con el reloj del sistema haría que dos guardados de
// la misma partida no fueran el mismo dato, y comparar dos saves es la mitad de
// «el mismo journal produce el mismo mundo». Quien quiera una fecha, la pasa.
//
// ─── Y POR QUÉ IndexedDB NO ESTÁ ACÁ ADENTRO ───────────────────────────────
//
// Porque IndexedDB no existe en node, y un paquete cuya única implementación no
// se puede correr en la suite es un paquete que nadie prueba. La forma es la
// misma que `ApiTS` en la fragua: **la dependencia entra por parámetro**. Acá el
// depósito es una interfaz de cuatro métodos, `enMemoria()` es la
// implementación que la suite usa, y la de IndexedDB es un adaptador de veinte
// líneas que vive donde hay un navegador.
//
// Lo que se gana no es sólo poder testear: es que **toda la lógica de qué se
// guarda y cómo se restaura es independiente de dónde se guarda**, y eso es lo
// único que este hito tiene que probar.

/**
 * DÓNDE SE GUARDA. Cuatro métodos, y ninguno sabe qué es lo que guarda.
 *
 * Las claves son texto y los valores son **datos planos** — lo que sobrevive a un
 * `JSON.stringify`/`parse` y nada más. Es la misma regla que `world/src/chunk.ts`
 * ya declara: *«lo que no aguanta el viaje por JSON no sirve para el journal ni
 * para IndexedDB»*. `esPlano` de este paquete la hace verificable.
 */
export interface Deposito {
  poner(clave: string, valor: unknown): Promise<void>
  /** `undefined` cuando no está. No lanza: no estar es una respuesta. */
  leer(clave: string): Promise<unknown>
  /** Todas las claves, en orden estable. Sin esto no se puede listar lo guardado. */
  claves(): Promise<readonly string[]>
  borrar(clave: string): Promise<void>
}

/**
 * UN DEPÓSITO EN MEMORIA, y guarda una COPIA por JSON.
 *
 * La copia no es prolijidad: sin ella este depósito guardaría una referencia al
 * objeto vivo, y entonces mutar el mundo después de guardar cambiaría el
 * guardado. Un save que se mueve solo es peor que no tener save, porque el test
 * que lo compare va a dar verde siempre.
 *
 * Y de paso hace que la suite corra contra la misma restricción que IndexedDB:
 * lo que no aguanta el viaje por JSON explota acá, en node, y no en el navegador
 * de un usuario.
 */
export function enMemoria(): Deposito {
  const m = new Map<string, string>()
  return {
    poner(clave, valor) {
      m.set(clave, JSON.stringify(valor))
      return Promise.resolve()
    },
    leer(clave) {
      const s = m.get(clave)
      return Promise.resolve(s === undefined ? undefined : (JSON.parse(s) as unknown))
    },
    claves() {
      // Ordenadas, y no en orden de inserción: dos depósitos con lo mismo
      // adentro tienen que listar lo mismo, o comparar dos saves compararía en
      // qué orden se escribieron.
      return Promise.resolve([...m.keys()].sort(comparaTexto))
    },
    borrar(clave) {
      m.delete(clave)
      return Promise.resolve()
    },
  }
}

/** Sin `localeCompare`: el orden no puede depender del idioma del sistema. */
function comparaTexto(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1
}

/**
 * ¿ESTO AGUANTA EL VIAJE? Devuelve el camino del primer valor que no, o `''`.
 *
 * Existe porque el modo de falla es CALLADO: `JSON.stringify` no lanza con un
 * `Map`, con un `Set` ni con una función — devuelve `{}`, `{}` y nada. O sea que
 * guardar un `WorldState` crudo «funciona», y lo que se recupera es un mundo sin
 * cuerpos. Por eso `worldSlots` existe del otro lado.
 *
 * Devuelve el CAMINO y no un booleano porque el mensaje es todo el valor: saber
 * que algo no aguanta no sirve; saber que es `bodies` sí.
 */
export function loQueNoAguanta(v: unknown, camino = ''): string {
  if (v === null) return ''
  const t = typeof v
  if (t === 'function' || t === 'symbol' || t === 'bigint') return `${camino} es ${t}`
  if (t === 'number') return Number.isFinite(v as number) ? '' : `${camino} es ${String(v)}`
  if (t !== 'object') return ''
  if (v instanceof Map) return `${camino} es un Map`
  if (v instanceof Set) return `${camino} es un Set`
  if (v instanceof Date) return `${camino} es un Date`
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = loQueNoAguanta(v[i], `${camino}[${String(i)}]`)
      if (r !== '') return r
    }
    return ''
  }
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const r = loQueNoAguanta(x, camino === '' ? k : `${camino}.${k}`)
    if (r !== '') return r
  }
  return ''
}
