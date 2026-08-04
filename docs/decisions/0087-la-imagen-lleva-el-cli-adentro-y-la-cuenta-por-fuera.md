# ADR 0087 — La imagen lleva el CLI adentro y la cuenta por fuera

Fecha: 2026-08-03 · Estado: **parcialmente reemplazada por
[0089](0089-la-canilla-se-cierra-y-cada-uno-trae-su-modelo.md)**

> **Lo que sigue en pie:** empaquetar el CLI adentro de la imagen, sembrar la
> sesión por un montaje de solo lectura y copiarla al `CODEX_HOME` del volumen.
>
> **Lo que se fue:** la cuenta compartida. `ANIMA_CODEX_SHARED`, el envoltorio
> `createManagedBridge` y el default que encendía la mente real sin pedirla no
> existen más. Este documento resolvió bien el problema que tenía adelante —que
> un visitante no dejara sin sesión a los demás— y por eso no vio el que tenía
> al lado: que igual le gastaba la cuota al dueño. El 0089 lo cuenta entero.

## Contexto

Ánima I corría solo en la máquina de quien la desarrolla: `pnpm dev:full`
levanta dos procesos —Vite en 5173 y la API en 8787— y el proxy de Vite es el
que hace que el cliente pueda pedir `/api/...` a un servidor que declara sus
rutas en la raíz. Para dejarla andando en otra máquina hacía falta clonar el
repo, instalar pnpm, instalar el CLI de Codex y levantar los dos procesos a
mano.

Empaquetarla tiene una complicación que no tienen las apps web comunes: **el
puente de IA no habla con ninguna API de OpenAI**. Lanza el binario `codex`
como subproceso (`codex app-server` por JSON-RPC, con caída a `codex exec`).
La mente real no es una clave en un `.env`: es un CLI en el `PATH` y una
sesión de ChatGPT que ese CLI administra en su `CODEX_HOME`. Una imagen sin el
CLI adentro arranca perfecto y no puede pensar.

Y hay una tensión que no se resuelve sola: esa sesión son credenciales. El
CLI las refresca sola cada tanto —escribe `auth.json`— y `/ai/logout` desde la
web las borra. Si el contenedor trabajara directo sobre el `~/.codex` de la
máquina, cualquiera que entre a la web podría dejar sin sesión de Codex a la
máquina entera.

## Decisión

### Un solo proceso: la API sirve también la web

En lugar de reproducir el par Vite + API con un nginx que proxee, la API sirve
`apps/web/dist` cuando se le pasa `staticDir`. Un origen, un puerto, cero CORS.

El cliente no cambia: `API_BASE` sigue siendo `/api` y el servidor declara ese
prefijo **alias de la raíz** (`stripApiPrefix`, montado como `rewriteUrl`).
Va como `rewriteUrl` y no como hook `onRequest` porque tiene que ocurrir antes
del router — un hook corre cuando la ruta ya se eligió, o ya se falló.

Se descartó la alternativa de que el cliente supiera en qué modo está (una
`VITE_API_BASE` distinta al construir): habría metido una variante de build y
un camino que solo se ejercita en producción. El alias vale en los dos modos y
tiene prueba.

El registro de los archivos estáticos va **al final** de `buildServer`, porque
monta un comodín `/*`: las rutas declaradas arriba tienen que seguir ganándole.

### El CLI se hornea; la cuenta, no

La imagen instala `@openai/codex` con la versión fijada por `ARG`
(0.144.5 hoy, contra la que está verificado el puente y cuyo protocolo de
app-server es experimental). Eso es infraestructura y es reproducible.

La sesión entra en ejecución y por dos saltos:

1. el `~/.codex` de la máquina se monta **de solo lectura** en `/semilla/codex`;
2. el entrypoint copia de ahí `auth.json` y `config.toml` —solo eso, nada de
   historial ni logs— al `CODEX_HOME` del volumen, la primera vez nada más.

El contenedor vive de su copia. Un refresco de token o un `logout` desde la web
tocan la copia y jamás las credenciales de la máquina. El precio es que la
copia envejece: cuando el token se vence, se borra el volumen y se vuelve a
sembrar. Es el precio correcto — recuperarse de eso es un comando, y
recuperarse de un `logout` ajeno sobre el `~/.codex` real es volver a
autenticar la máquina.

Se descartó mapear el puerto 1455 para que `codex login` funcione desde la web:
resuelve un problema que esta instancia no tiene (nadie va a conectar cuentas
distintas) a cambio de un puerto abierto y un flujo de autorización que hay que
completar en un navegador que puede no estar en la misma máquina.

### Una cuenta para todos, y es una decisión explícita

`ANIMA_CODEX_SHARED=1` hace que la fábrica de puentes ignore la pubkey y
devuelva siempre el puente del `CODEX_HOME` del proceso. Sin el flag vale lo de
siempre: cada identidad Nostr conecta su propia cuenta y el invitado usa el
`~/.codex` de la máquina.

El flag es explícito y no el default porque cambia quién paga: con él, la cuota
de una cuenta la gasta cualquiera que abra la página. Es lo que se quiere en una
instancia personal en la red de casa, y es exactamente lo que no se quiere en
cualquier otro lado.

### Una sesión prestada se usa, pero no se entrega

El puente compartido va envuelto en `createManagedBridge`: consultar y leer
límites siguen abiertos, `login` y `logout` no. El servidor las rechaza con
**403** antes de llegar al puente —la petición está bien formada, lo que falta
es permiso— y el envoltorio vuelve a decir que no por si alguien lo llama
directo.

Sin eso, el modo compartido tenía un botón en la interfaz que le sacaba la
mente a todos los demás, y recuperarla exigía volver a la máquina anfitriona a
resembrar. El estado expone `managed: true` para que la interfaz no ofrezca lo
que el servidor va a rechazar: esconde el botón de desconectar y, si la sesión
prestada no está activa, dice a quién hay que avisarle en vez de mandar al
visitante a pelear con una autorización que no le toca.

### Y una sesión prestada viene encendida

Sin nada elegido manda el mock, que es determinista y no cuesta: es lo correcto
cuando cada uno conecta su propia cuenta, porque nadie debería gastar sin
haberlo pedido. Con la sesión prestada (`managed`) el default se da vuelta y el
juego arranca pensando con Codex — la cuenta ya está puesta, es una sola, y
pedirle al visitante que la encienda es un clic que no decide nada: el que
decidió fue el anfitrión, al prestarla.

Para que eso no atropelle a quien la apaga, hubo que separar dos estados que
eran uno solo: apagar Codex borraba la clave de elección, o sea que «lo apagué»
y «nunca elegí» se leían igual, y con el default nuevo la mente real habría
vuelto sola en la siguiente recarga. Ahora apagarla a mano **se guarda**
(`storeAiChoice('mock')`) y solo se olvida (`forgetAiChoice`) cuando la sesión
se cayó sola — que no fue decisión de nadie, y cuando vuelva conviene que la
mente vuelva con ella.

### `ANIMA_HOST`, con el loopback como default

Fuera del contenedor el servidor sigue atado a `127.0.0.1`: es la API personal
de una máquina. Dentro, ese loopback la dejaría incomunicada. El host se
declara por entorno y el default es el conservador.

## Consecuencias

- Deployar es `docker compose up -d` con un `.env` de una variable, o un
  `docker load` de la imagen exportada. No hace falta pnpm, ni Node, ni el CLI
  de Codex instalados en la máquina destino — solo el `auth.json` a sembrar.
- El único estado vive en `/datos`: la base SQLite, los `CODEX_HOME` por pubkey
  y la copia de la sesión. Un volumen, un backup.
- Con `ANIMA_CODEX_SHARED=1` la cuota es de quien hospeda y la gasta cualquiera
  que abra la página. Eso no lo tapa el candado de la sesión: si la instancia se
  abre a gente que no es de confianza, lo que falta es un límite de consultas
  por visitante.
- La instancia está pensada para convivir con otros proyectos en la misma
  máquina: nombre de proyecto propio (`anima`), puerto e interfaz configurables
  (`ANIMA_PORT`, `ANIMA_BIND`), red y volumen sin compartir, y un techo de
  memoria para que no le pelee los recursos a lo demás.
- La imagen final no lleva el workspace: la web viaja construida y el servidor
  con sus dependencias planas (`pnpm deploy --legacy`). `ii/` queda afuera del
  contexto de build salvo sus `package.json`, que el lockfile exige presentes.
