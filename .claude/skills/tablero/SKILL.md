---
name: tablero
description: Actualiza el tablero de avance de Ánima II (ii/docs/tablero/). Usala cuando el usuario pida actualizar el tablero, el dashboard o el estado del proyecto, o cuando pregunte cómo viene Ánima II. Mide el árbol, edita estado.json, regenera el HTML y republica el Artifact en su URL fija.
---

# Actualizar el tablero de Ánima II

## Antes que nada

Leé **`ii/docs/tablero/COMO-ACTUALIZAR.md`** entero. Es el procedimiento
completo y manda sobre lo que sigue acá. Este archivo es sólo el recordatorio de
los pasos y de las cosas que se olvidan.

**No hace falta leer `continuar-aca.md`, la arquitectura ni los ADRs.** Están
escritos para diseñar el proyecto, no para actualizar un tablero, y son miles de
líneas. Los mensajes de commit alcanzan y traen los números ya corridos.

## Los pasos

1. **`git log --oneline -8` y `git status --porcelain`.** Buscá qué se movió
   desde la última actualización (el campo `actualizado` de `estado.json` dice
   cuándo fue). Leé los mensajes de commit enteros: dicen qué punto del criterio
   movieron y suelen traer los números medidos.
2. **Medí lo barato** (typecheck, conteo de `it.fails`, ADRs, commits sin
   pushear). Los comandos exactos están en el runbook.
3. **Lanzá `pnpm ii:test` en segundo plano** y seguí. Tarda ~5 minutos. Si no
   llega a tiempo, poné «verde / exit 0» sólo si lo viste; si no, citá el último
   commit y decilo.
4. **Editá `ii/docs/tablero/estado.json`.** Es el único archivo que se toca.
   Actualizá `actualizado`, `ahora`, `salud`, `verificacion` y los criterios que
   se hayan movido.
5. **`node ii/docs/tablero/construir.mjs`.** Si el portón se queja, arreglá y
   volvé a correr. No escribe nada hasta que pase.
6. **Publicá** `ii/docs/tablero/tablero.fragmento.html` con la herramienta
   Artifact, pasando como `url` el valor de `artifactUrl` que está en
   `estado.json`, y `favicon: "🧭"`.

## Las cuatro cosas que se olvidan

- **La URL.** Publicar sin pasar `artifactUrl` mina un link nuevo y el usuario
  termina con dos tableros. Es el único paso irreversible.
- **El porcentaje no se escribe.** Se deriva de los criterios. Si una etapa tiene
  `puntos`, ponerle `avance` es un error y el portón lo rechaza por nombre.
- **Gana el repo.** Si un documento del proyecto dice «van 8 de 12 cumpliendo»,
  el tablero muestra 8 de 12. Si creés que el doc cuenta mal, decíselo al usuario
  en el chat en vez de arreglarlo por tu cuenta.
- **Citar no es medir.** Un número que leíste en un documento lleva «citado de X»
  en su `nota`. Uno que corriste va en `verificacion.comandos` con su exit code.

## Al terminar

Contale al usuario, en castellano rioplatense y en pocas líneas: **qué cambió
desde la última vez**, qué número se movió y por qué, y qué corriste vos contra
qué citaste. Pasale el link.
