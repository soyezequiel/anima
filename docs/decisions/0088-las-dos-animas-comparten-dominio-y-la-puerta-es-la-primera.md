# ADR 0088 — Las dos Ánimas comparten dominio, y la puerta es la primera

Fecha: 2026-08-03 · Estado: aceptada

## Contexto

Ánima I quedó publicada en `anima.naranja.fit` (ADR 0087). Ánima II vive en el
mismo repositorio, en `ii/`, y se pidió que se llegue a ella por `/v2` del mismo
dominio.

Ánima II no es «otra página»: son dos procesos. El juego (`ii/apps/juego`,
Vite) y **el depósito** (`ii/apps/sprites`), que guarda los dibujos compartidos
entre partidas. Y el depósito no es un detalle de contenido — por ahí sale
*todo* lo que Ánima II le pide a un modelo: los dibujos, las respuestas del
chat cuando la criatura no entiende una frase, y la forja de habilidades cuando
no sabe hacer algo. El juego no le habla a ningún modelo; le habla al depósito.

Eso deja dos problemas que no existían con una sola versión.

**El juego asumía que el mundo era localhost.** `DONDE_EL_DEPOSITO` estaba
clavado en `http://localhost:5190`, que es cierto en desarrollo y falso apenas
hay un dominio: ahí `localhost` es el del visitante, y cada uno le pediría los
dibujos a su propia computadora.

**Y asumía que era la raíz.** Un bundle de Vite pide sus assets a rutas
absolutas derivadas de `base`. Servido en `/v2/` sin cambiar nada, el juego
pide `/assets/index-xxx.js` — y se lo contesta Ánima I.

## Decisión

### La puerta es Ánima I, y las dos opciones son opcionales

`buildServer` acepta `v2Dir` (el juego construido) y `v2Deposito` (la raíz del
depósito). Con las dos, el mismo proceso sirve `/v2/` y publica el depósito en
`/v2/deposito`; sin ellas se comporta exactamente como antes de que Ánima II
existiera.

Se evaluó meter un nginx o un Caddy adelante como repartidor. Se descartó
porque este servidor **ya era la puerta expuesta**: agregar un proxy delante era
una pieza más, con su imagen y su configuración, para un trabajo que el que ya
está podía hacer con dos plugins. El costo aceptado es que Ánima I sabe que
Ánima II existe; se acota a dos variables de entorno y a un `if`.

El orden importa y está escrito en el código: el depósito se registra **antes**
que el estático, porque si no `/v2/deposito/...` se resuelve como un archivo que
el dist del juego no tiene.

`/v2` sin barra redirige a `/v2/` con una ruta explícita. El `redirect` de
`@fastify/static` cubre los directorios de adentro, no el prefijo mismo — sin
la barra, las rutas relativas del juego caen un nivel más arriba, o sea en
Ánima I.

### El depósito tiene imagen propia

No entra en la de Ánima I aunque comparta el CLI de Codex: es otro proceso, con
otro ciclo de vida y otro volumen (los dibujos no son la base de Ánima I). No
publica puerto — la única forma de llegarle es por la puerta.

Su imagen **no** usa `pnpm deploy`, que sí funciona para la API de Ánima I. El
depósito corre TypeScript crudo con `vite-node`, y el deploy lo aplana en un
directorio suelto donde su `tsconfig.json` queda apuntando a un
`extends: "../../tsconfig.base.json"` que ya no existe. En Ánima II la
estructura del workspace no es decorado: es parte de lo que el proceso necesita
para arrancar. Por eso viaja el árbol con su forma, instalado con
`--filter @anima/sprites...`.

### Lo que el juego toma del entorno de construcción

`ANIMA_BASE` y `VITE_DEPOSITO`, con defaults que son exactamente lo de antes
(`/` y `http://localhost:5190`): en desarrollo no cambió nada. El `index.html`
usa `%BASE_URL%` para las fuentes por lo mismo — estaban en rutas absolutas, y
en `/v2/` volvían 404. En ese archivo eso no es un detalle estético: la familia
tipográfica es el canal que distingue quién habla.

Los tipos de `import.meta.env` se declaran a mano en `src/entorno.d.ts` en vez
de traer `vite/client`, porque el tsconfig de Ánima II declara `"types": []` a
propósito.

## Consecuencias

- `anima.naranja.fit` sirve Ánima I; `anima.naranja.fit/v2/` sirve Ánima II. Un
  dominio, un túnel, un puerto.
- **El depósito quedó abierto a internet, y eso es una decisión tomada, no un
  olvido.** Su propio `servidor.ts` ya lo advertía: no autentica, no modera y no
  borra, y «primero gana» significa que una clave dibujada no se pisa nunca.
  Expuesto, es contenido permanente de desconocidos en el mundo compartido de
  todos, y cada visitante que escriba algo que la criatura no entiende gasta la
  cuota del anfitrión. Lo que falta para cerrarlo sigue siendo lo que ese
  comentario pedía: saber quién lo mandó, y una forma de sacar uno.
- El `.dockerignore` excluye `apps/api/data/` por ruta exacta y no `**/data/`:
  ese patrón se comía `ii/packages/physics/src/data/`, que es la tabla de
  sustancias, y el build de Ánima II moría sin poder resolverla.
- `*.sh eol=lf` en `.gitattributes`. Un entrypoint guardado con CRLF hace que el
  contenedor muera con «no such file or directory» señalando un archivo que
  existe: el shebang pasa a ser `#!/bin/sh\r` y el kernel busca un intérprete
  llamado `sh\r`.
