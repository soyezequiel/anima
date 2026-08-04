# 0089 — La canilla se cierra, y cada uno trae su modelo

**Estado:** aceptada
**Reemplaza:** [0087](0087-la-imagen-lleva-el-cli-adentro-y-la-cuenta-por-fuera.md), en la parte de la cuenta compartida

## El problema, dicho corto

Las dos Ánimas están publicadas detrás de un túnel, y **cualquiera con la URL
gasta la cuenta de ChatGPT del dueño**. No hacía falta ni pedirlo: la mente real
venía encendida.

## Lo que costó ver, y es la mitad del ADR

El modo compartido (`ANIMA_CODEX_SHARED=1`) era visible: lo declaraba el
compose, tenía su ADR y hasta una advertencia en el README. Apagarlo parecía
todo el trabajo.

No lo era. Había **cuatro bocas** y tres no estaban anotadas en ningún lado:

| dónde | quién pagaba |
| --- | --- |
| Ánima I, `ANIMA_CODEX_SHARED=1` | el dueño, a propósito |
| Ánima I, visitante **sin identidad** | el dueño, sin que nadie lo hubiera decidido |
| Ánima I, puente de **Claude** | el dueño, sin flag ni mención |
| Ánima II, el **depósito** | el dueño, en las tres rutas que salen a un modelo |

La segunda es la que enseña. La fábrica de puentes repartía un `CODEX_HOME` por
pubkey —cada usuario, su cuenta— y para el invitado sin identidad caía al
`~/.codex` de la máquina. Leído de a una línea es razonable; leído desde
afuera, era **la canilla más abierta de las cuatro**, porque no pedía nada.

La tercera es la misma historia con otro nombre: `createClaudeBridge()` es la
suscripción personal de la máquina, para todos, sin identidad y sin flag.

> Un candado sobre el botón de desconectar no es un control de gasto. Lo que el
> puente compartido cuidaba era la sesión, no la plata, y las dos se veían
> iguales desde la interfaz.

## La decisión

### 1. Los puentes CLI existen solo si el dueño los enciende

Una sola variable, `ANIMA_CLI_LOCAL`, y viene en **0**. Sin ella no se
construye ningún puente —ni Codex por pubkey, ni Codex invitado, ni Claude— y
`/ai/*` contesta **503** con la salida escrita adentro del error.

El default cerrado es la decisión. El razonamiento es de una línea: **el CLI
corre del lado del servidor**, así que la cuenta es siempre la de quien
hospeda, la pida un anónimo o una pubkey verificada. En una laptop eso era el
dueño usando lo suyo; publicado, es otra cosa.

`ANIMA_CODEX_SHARED` y `createManagedBridge` se van completos. No alcanzaba con
apagar el modo compartido: el modo «cada uno la suya» tenía la fuga por abajo.

En el compose, con la canilla cerrada **ni se monta el `~/.codex`**: va una
carpeta vacía del repo. No es que el contenedor no use las credenciales — es
que no las tiene.

### 2. El estado dice cuál de los dos «no» es

`/ai/status` sigue contestando 200 (la web lo consulta en cada arranque; un 503
ahí pintaría de rojo una consola para decir algo que no es una falla) y suma un
campo: `available: false`.

Existe porque `installed: false` tapaba dos hechos que la interfaz tiene que
separar: «no tenés el CLI, instalalo» manda a hacer algo que sirve, y «esta
instancia no presta cuentas» manda a hacer algo que no va a cambiar nada. Sin
el campo, la web tendría que adivinarlo leyendo el texto del `detail` — una
cuerda que se corta el día que alguien mejora una frase.

### 3. El reemplazo: tu propia API, llamada desde tu navegador

Cualquier servidor que hable el dialecto de OpenAI (`POST /chat/completions`):
la API de OpenAI, OpenRouter, Groq, un Ollama en la máquina del que juega. Tres
campos —URL, llave, modelo— guardados en su `localStorage`.

**La llama el navegador, directo.** Descartamos que la llave viajara al backend
para que él hiciera el pedido: no guardarla no alcanza, basta con tocarla —
queda en la memoria del proceso, en un log que se escape, en un volcado. Yendo
directo no existe en ninguna máquina nuestra.

El precio es que el proveedor tiene que mandar cabeceras CORS. Los cuatro de
arriba las mandan; uno que no, falla como si estuviera caído, y el error lo
nombra porque el navegador no distingue las dos cosas.

En Ánima I el enchufe fue chico y eso dice algo bueno del diseño previo:
`CodexModelProvider` ya era agnóstico del transporte, así que esto es **un
transporte más**, con los prompts, el parseo y la validación intactos.

### 4. Ánima II: el sobre en dos tiempos

El depósito hacía el viaje al modelo porque el navegador no puede hacer
`spawn`. Con la cuenta del jugador eso se da vuelta, pero **no** se convierte al
depósito en un proxy abierto. El encargo se parte:

    POST /sobre          «quiero X»   →  {ticket, prompt}
    (el navegador lleva el prompt a SU modelo)
    POST /sobre/:ticket  {texto}      →  lo mismo que devolvía la ruta vieja

Lo que no se movió es lo que importa: **el prompt lo sigue armando el servidor y
lo que vuelve lo sigue validando el servidor**. Un `POST /preguntar {prompt}`
habría sido más corto y habría tirado las dos cosas — el depósito guardaría lo
que el navegador diga que es un sprite, y el `.d.ts` entero de la fragua tendría
que viajar al cliente para volver.

El sobre vive en memoria, se consume al contestarlo, vence a los diez minutos y
tiene tope de 500. Que el ticket sea de un solo uso es lo que evita que un
encargo se convierta en una autorización abierta a intentar.

Las tres rutas de un solo tiro se quedan: un depósito **con** cuenta propia no
tiene por qué hacer dos viajes de red donde alcanza uno. Los dos caminos
comparten lo caro — armar el prompt y revisar lo que volvió son las mismas
funciones.

### 5. Sin nada configurado, el simulado

Y sin cartel de error. El `mock` es determinista y gratis; la mascota vive,
dibuja procedural y lee con su léxico. Lo que hay es una invitación en ajustes.

Se fue con esto el default que daba vuelta: con la cuenta prestada, la mente
real venía encendida. Era el gesto correcto mientras la cuenta la ponía el
anfitrión a propósito. **Cuando el que paga es siempre él y el que decide es
cualquiera, el default tiene que ser no gastar.**

## Lo que compartimos entre las dos Ánimas, y su precio

Las dos leen los mismos `localStorage`: `anima:ai:choice` y
`anima:ai:openai-settings`. Configurás la API una vez en el ⚙ de Ánima I y anda
en las dos, que es lo que espera cualquiera que entró por la puerta y bajó al
`/v2` — comparten dominio por [0088](0088-las-dos-animas-comparten-dominio-y-la-puerta-es-la-primera.md).

El precio es un acoplamiento por dos strings entre dos apps que no se importan
entre sí. Está acotado y escrito en los dos lados. Si algún día se separan los
dominios, deja de andar solo y Ánima II necesita su propia pantalla de ajustes.

Y una regla que sí se respeta: tener una llave guardada **no** es querer
gastarla. Ánima II mira además que la mente esté encendida en Ánima I; alguien
que volvió al simulado no empieza a pagar por bajar al `/v2`.

## Consecuencias

- **Nadie gasta la cuenta del dueño desde la web.** Ni con identidad, ni sin
  ella, ni en Ánima II.
- El que quiere mente real pone su llave, y esa llave no toca nuestro servidor.
- En la máquina del dueño no se pierde nada: `ANIMA_CLI_LOCAL=1` devuelve todo
  lo de antes, con el `.env` apuntando a su `~/.codex`.
- Ánima II gana un camino de dos viajes de red donde antes había uno. Para un
  dibujo que ya está en el baúl sigue siendo uno solo: «primero gana» corre
  antes de que nadie gaste.
- El esquema de las salidas estructuradas se poda antes de mandarlo (`minItems`,
  `maxItems` y `minimum` no los admite el modo estricto de OpenAI). Se pierde
  una cota que el modelo igual tiene escrita en el prompt.
- Sigue sin haber control de gasto para el que trae su propia llave: es su
  cuenta y su decisión, pero nada en Ánima le dice cuánto lleva gastado. Es lo
  primero que va a pedir alguien que la use en serio.
