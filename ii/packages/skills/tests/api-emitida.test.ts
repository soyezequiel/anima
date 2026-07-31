import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { baseRoleName, SEED_PROCESSES } from '@anima/physics'
import { describe, expect, it } from 'vitest'
import { done, fail, SEED_PROCESS_IDS, SEED_ROLE_NAMES, type RolesOf, type SeedProcessId } from '../src/tipos.js'

/**
 * EL TEST QUE HACE IMPOSIBLE QUE LA REFERENCIA VUELVA A DIVERGIR.
 *
 * `src/skill-api.d.ts` es el archivo que ve el modelo, y hasta el Hito 4 estaba
 * escrito A MANO. Ahora se emite de `src/tipos.ts` y `src/ctx.ts`, y este archivo
 * es lo que impide que alguien lo edite a mano «un ratito»: si lo commiteado no
 * es exactamente lo que sale de `tsc --declaration`, el build se pone rojo.
 *
 * Sin esto, la emisión sería una costumbre y no una garantía — y una costumbre es
 * exactamente lo que falló en Ánima I, donde `DSL_REFERENCE` se mantenía a mano,
 * divergió del código, y nadie se enteró hasta que el modelo no pudo colocar un
 * bloque.
 *
 * Los otros tres tests atacan las TRES listas que no se pueden derivar en tipos y
 * que por eso están escritas: los cuatro procesos aplicables, sus roles, y que el
 * catálogo de cualidades no se haya vuelto a copiar adentro del `.d.ts`.
 */

const PKG = resolve(__dirname, '..')
const EMISOR = join(PKG, 'banco', 'emitir-skill-api.mjs')
const COMMITEADO = join(PKG, 'src', 'skill-api.d.ts')

/** Saltos de línea normalizados: en Windows `tsc` emite CRLF y git puede tocarlo. */
function normalizar(s: string): string {
  return s.replace(/\r\n/g, '\n')
}

function emitir(): string {
  const r = spawnSync(process.execPath, [EMISOR, '--stdout'], { cwd: PKG, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`el emisor falló:\n${(r.stdout ?? '') + (r.stderr ?? '')}`)
  return normalizar(r.stdout)
}

/**
 * Cuánto espera el ARNÉS antes de dar por colgado un bloque que lanza el emisor.
 *
 * Los tres bloques de este archivo hacen `spawnSync` de un proceso que compila:
 * no miden tiempo, pero lo consumen. Los 5 s de vitest alcanzan con la suite en
 * serie y no alcanzan con los ocho paquetes en paralelo —medido: 20,9 s, 24,7 s
 * y 9,8 s—. El timeout es la paciencia del andamio y no una afirmación: acá no
 * hay ninguna sobre el reloj.
 */
const TOPE_DE_PACIENCIA = 120_000

describe('el .d.ts se emite, no se transcribe', () => {
  it('lo commiteado es exactamente lo emitido', () => {
    const emitido = emitir()
    const commiteado = normalizar(readFileSync(COMMITEADO, 'utf8'))
    // La comparación es del texto entero a propósito: comparar «los tipos que
    // exporta» dejaría pasar una firma cambiada, que es justamente la clase de
    // divergencia que hizo que el modelo no pudiera colocar bloques.
    expect(
      commiteado,
      'src/skill-api.d.ts quedó viejo. Corré: pnpm --filter @anima/skills emitir-api',
    ).toBe(emitido)
  }, TOPE_DE_PACIENCIA)

  it('el emitido no tiene ninguna referencia relativa colgada', () => {
    // La costura de `tipos.d.ts` + `ctx.d.ts` borra los imports internos. Si
    // quedara uno, el archivo que ES el prompt tendría un import roto.
    expect(emitir()).not.toMatch(/from '\.[^']*'/)
  }, TOPE_DE_PACIENCIA)

  it('el emitido no vuelve a escribir el catálogo de cualidades', () => {
    // El catálogo se re-exporta de `@anima/physics`. Si alguien lo copia acá, la
    // lista vuelve a ser mantenida a mano y volvemos al punto de partida. Estas
    // dos cadenas sólo pueden aparecer si alguien escribió la unión a mano.
    const texto = emitir()
    expect(texto).not.toContain("'ignitionPoint'")
    expect(texto).not.toContain("'heatCapacity'")
    expect(texto).toContain("from '@anima/physics'")
    expect(texto).toContain("from '@anima/world'")
  }, TOPE_DE_PACIENCIA)
})

describe('las tres listas que no se pueden derivar en tipos', () => {
  it('los cuatro procesos aplicables son los del catálogo, y en su orden', () => {
    // `Process.id` es `string`, así que de él no sale un literal de tipo y
    // `SeedProcessId` hay que escribirla. Lo que no hace falta es que diverja.
    expect(SEED_PROCESS_IDS).toEqual(SEED_PROCESSES.map((p) => p.id))
  })

  it('los roles de cada proceso son los del catálogo, con sus opcionales', () => {
    for (const p of SEED_PROCESSES) {
      const declarados = SEED_ROLE_NAMES[p.id as SeedProcessId] as readonly string[]
      expect(declarados, `roles de ${p.id}`).toEqual(p.roles.map((r) => r.name))
    }
  })

  it('`b` de union es el único rol opcional, y por eso existe la caña', () => {
    // Sin rol opcional no hay punta libre, sin punta libre no hay `catch`, y sin
    // `catch` la caña no califica para `extraccion`. Pescar sería imposible.
    const opcionales = SEED_PROCESSES.flatMap((p) =>
      p.roles.filter((r) => r.name.endsWith('?')).map((r) => `${p.id}.${baseRoleName(r.name)}`),
    )
    expect(opcionales).toEqual(['union.b'])
  })
})

// ─── La misma verificación, pero en tipos ───────────────────────────────────
//
// El test de arriba compara CADENAS: que `SEED_ROLE_NAMES` diga lo mismo que el
// catálogo. Falta el otro lado, que es que `RolesOf` diga lo mismo que
// `SEED_ROLE_NAMES` — y eso no es un valor, es un tipo, así que lo verifica
// `tsc` y no vitest. Si alguien le agrega un rol a `RolesOf` y se olvida de la
// lista (o al revés), estas cuatro constantes dejan de compilar.

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type SinInterrogante<S extends string> = S extends `${infer N}?` ? N : S
type Declarados<P extends SeedProcessId> = SinInterrogante<(typeof SEED_ROLE_NAMES)[P][number]>

const rolesDeFriccion: Eq<keyof RolesOf<'friccion'>, Declarados<'friccion'>> = true
const rolesDeUnion: Eq<keyof RolesOf<'union'>, Declarados<'union'>> = true
const rolesDeDeshilachar: Eq<keyof RolesOf<'deshilachar'>, Declarados<'deshilachar'>> = true
const rolesDeExtraccion: Eq<keyof RolesOf<'extraccion'>, Declarados<'extraccion'>> = true

describe('`RolesOf` declara los mismos roles que la lista', () => {
  it('lo verifica tsc, no vitest', () => {
    expect([rolesDeFriccion, rolesDeUnion, rolesDeDeshilachar, rolesDeExtraccion]).toEqual([
      true,
      true,
      true,
      true,
    ])
  })
})

describe('done y fail son código real, no `declare function`', () => {
  it('done sin cuerpo no deja la clave puesta en undefined', () => {
    // `exactOptionalPropertyTypes` distingue «ausente» de «presente y undefined»,
    // y un `got: undefined` explícito viajaría hasta el guardado como clave.
    expect(Object.hasOwn(done(), 'got')).toBe(false)
  })

  it('fail lleva el porqué', () => {
    expect(fail('no encontré agua')).toEqual({ ok: false, why: 'no encontré agua' })
  })
})
