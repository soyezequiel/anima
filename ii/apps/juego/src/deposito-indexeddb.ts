// ─── EL DEPÓSITO DE VERDAD: IndexedDB ───────────────────────────────────────
//
// El punto 9 de la vertical del Hito 12B —«cerrar y reabrir sin perder la
// sesión»— y la única pieza que `@anima/store` dejó escrita como pendiente:
//
// > la de IndexedDB es un adaptador de veinte líneas que vive donde hay un
// > navegador
//
// Vive acá y no en `packages/store` por la razón que ese paquete da entera: en
// node no existe `indexedDB`, y **un paquete cuya única implementación no se
// puede correr en la suite es un paquete que nadie prueba**. Del lado de `store`
// quedó una interfaz de cuatro métodos y un `enMemoria()` que la suite ejercita;
// acá está la otra implementación, en la app que sí tiene navegador.
//
// ─── LA DECISIÓN QUE NO ES OBVIA: GUARDA TEXTO, NO OBJETOS ────────────────
//
// IndexedDB no guarda por JSON: usa el **clon estructurado**, que sabe copiar un
// `Map`, un `Set` y un `Date`. O sea que si acá se guardara el objeto vivo, este
// depósito aguantaría cosas que `enMemoria()` —que serializa con
// `JSON.stringify`— convierte en `{}` sin decir nada.
//
// Eso sería lo peor de los dos mundos: **un guardado que anda en el navegador y
// se rompe en la suite**, o al revés, y en los dos casos el error aparece lejos
// del lugar donde se cometió. Guardando texto, los dos depósitos tienen
// exactamente el mismo contrato y `loQueNoAguanta` sigue siendo la única verdad
// sobre qué se puede guardar.
//
// La contra, dicha: se paga un `stringify`/`parse` que el clon estructurado haría
// solo. Medido sobre un guardado real del juego, ese costo es de microsegundos y
// pasa FUERA del tick, que es lo único que la regla 2 protege.

import type { Deposito } from '@anima/store'

const NOMBRE_POR_OMISION = 'anima-ii'
const ALMACEN = 'partidas'

/** Sin `localeCompare`: el orden no puede depender del idioma del sistema. */
function comparaTexto(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1
}

/**
 * Una petición de IndexedDB como promesa.
 *
 * `IDBRequest` es de las últimas APIs del navegador con callbacks, así que esto
 * es puro andamiaje. Va en una función y no repetido cuatro veces porque el
 * `onerror` es fácil de olvidar, y olvidarlo deja una promesa colgada para
 * siempre: el juego no fallaría, se quedaría esperando.
 */
function comoPromesa<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    r.onsuccess = () => {
      resolve(r.result)
    }
    r.onerror = () => {
      reject(r.error ?? new Error('IndexedDB falló sin decir por qué'))
    }
  })
}

/**
 * EL DEPÓSITO. La conexión se abre UNA vez y se reusa.
 *
 * Abrir por operación sería más corto de escribir y está mal por dos razones: es
 * lento —abrir una base es del orden de milisegundos, y esto se llama cada vez
 * que se guarda— y sobre todo, dos aperturas simultáneas con distinta versión se
 * bloquean entre sí. Con una sola conexión viva eso no puede pasar.
 */
export function depositoIndexedDB(nombre = NOMBRE_POR_OMISION): Deposito {
  let conexion: Promise<IDBDatabase> | undefined

  const abrir = (): Promise<IDBDatabase> => {
    conexion ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(nombre, 1)
      // El único momento en que se puede crear el almacén. Si esto no corre, las
      // transacciones de abajo fallan con `NotFoundError`.
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(ALMACEN)) req.result.createObjectStore(ALMACEN)
      }
      req.onsuccess = () => {
        resolve(req.result)
      }
      req.onerror = () => {
        reject(req.error ?? new Error('no se pudo abrir IndexedDB'))
      }
    })
    return conexion
  }

  const almacen = async (modo: IDBTransactionMode): Promise<IDBObjectStore> => {
    const db = await abrir()
    return db.transaction(ALMACEN, modo).objectStore(ALMACEN)
  }

  return {
    async poner(clave, valor) {
      // Texto y no el objeto: ver el encabezado. `JSON.stringify` de algo que no
      // aguanta el viaje devuelve `{}` en silencio, y para eso está
      // `loQueNoAguanta` del lado de `@anima/store`.
      await comoPromesa((await almacen('readwrite')).put(JSON.stringify(valor), clave))
    },
    async leer(clave) {
      const s = await comoPromesa<unknown>((await almacen('readonly')).get(clave))
      // `get` de una clave que no está devuelve `undefined`, no lanza. Es el
      // mismo contrato que `enMemoria`: no estar es una respuesta.
      return typeof s === 'string' ? (JSON.parse(s) as unknown) : undefined
    },
    async claves() {
      const ks = await comoPromesa((await almacen('readonly')).getAllKeys())
      // Se ordena acá aunque IndexedDB ya devuelva en orden de clave: el orden
      // que ese motor usa es el suyo, y el contrato dice «orden estable» — el
      // mismo que `enMemoria`. Depender del de abajo sería que dos depósitos con
      // lo mismo adentro puedan listar distinto.
      return ks.map((k) => String(k)).sort(comparaTexto)
    },
    async borrar(clave) {
      await comoPromesa((await almacen('readwrite')).delete(clave))
    },
  }
}
