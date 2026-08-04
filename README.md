# Ánima

🏆 **Ganadora de la Hackatón #05 de [La Crypta](https://www.lacrypta.dev/hackathons/ai-agents)
— AI Agents (Bots & Automation), julio de 2026.**

Una criatura que tiene hambre, no sabe pescar, y escribe el código que le falta.

No es una metáfora. Cuando lo que sabe hacer no alcanza para lo que necesita,
redacta el contrato de una habilidad nueva, la implementa, y **un evaluador que
no es ella** la corre en mundos aislados y decide si entra a su biblioteca o se
archiva como regresión. Las que sobreviven quedan, y las vuelve a usar sin
consultar a nadie. El bucle completo, tal como queda registrado en una partida:

```
energía baja -> hipótesis -> objetivo -> intento directo -> fallo ->
prohibición de repetir -> contrato de habilidad -> candidata v1 -> pruebas
automáticas -> v1 rechazada (queda como regresión) -> candidata v2 ->
v2 promovida a estable -> ejecución en el mundo real -> alimento alcanzado ->
energía recuperada -> conocimiento consolidado y explicable
```

Nada de esa línea es un guion: cada flecha es un paso que la partida decidió y
que podés abrir en la interfaz para ver por qué.

## Probala ahora

| | |
|---|---|
| **Ánima I** — la que anda entera | <https://anima.naranja.fit> |
| **Ánima II** — el remake, con física de materia | <https://anima.naranja.fit/v2/> |

Sin instalar nada y sin cuenta. Las dos corren en una laptop en una casa,
detrás de un túnel.

> **El mundo anda sin ningún modelo.** La física, la criatura, el hambre, el
> fuego: nada de eso depende de una IA. Lo que un modelo agrega es que te
> entienda cuando le escribís, que dibuje lo que falta y que aprenda a hacer lo
> que no sabe.
>
> Para eso hace falta una cuenta, y **no ponemos la nuestra**: en ⚙ ajustes
> enchufás tu propia API compatible con OpenAI —la de OpenAI, OpenRouter, Groq,
> o un modelo corriendo en tu máquina— y la llave se queda en tu navegador, sin
> pasar por nuestro servidor. Sin eso, la mascota piensa con el modelo simulado
> y se juega igual.

### Qué mirar en 60 segundos

**En Ánima I**, escribile `traé un tronco` y abrí la pestaña **Pensamiento**.
Vas a ver la cadena entera: qué percibió, qué se propuso, qué intentó, qué
falló. Si algo no lo sabe hacer, mirá **Habilidades**: ahí aparecen las
versiones candidatas con sus pruebas, cuál se rechazó y por qué.

**En Ánima II**, tocá `hacé fuego`. Nadie programó cómo se hace fuego: hay
materia con propiedades y leyes fijas, y encender sale de frotar — barato en lo
liviano y seco, carísimo en lo pesado, que es de donde salió sola la idea de
yesca. El mapa se dibuja con sprites que pidió otra partida: el depósito es
compartido, así que lo que dibuje tu visita le queda a quien entre después.

## Por qué no es un chatbot con un juego encima

**El mundo decide, no el modelo.** La física es determinista y está cerrada: el
modelo propone acciones y habilidades, y el motor dice qué pasa. Si la habilidad
que escribió no sirve, no sirve — no hay forma de que se convenza a sí misma de
que anduvo. En Ánima II eso se verifica por hash: las mismas 20 semillas dan los
mismos seis hashes después de tocar la mente, y cuando una cambió, un guardián
la cazó y hubo que justificar por qué.

**El que propone no es el que aprueba.** El generador escribe la habilidad; un
juez independiente la mide contra criterios escritos **antes**, en escenarios
reproducibles. La última corrida contra un modelo real fueron 19 candidatas
clasificadas una por una —la mayoría limpias, algunas reparadas, una rota— por
US$ 0,80 en total. Los rechazos quedan guardados como regresiones, que es lo que
evita que la próxima versión repita el error.

**Funciona sin modelo.** No es un detalle de robustez: era el criterio de corte
del remake. Si la mente no resolvía el hambre sin llamar a nadie, el proyecto se
paraba. Resuelve. El modelo entra donde de verdad hace falta —una frase que no
entiende, una capacidad que no tiene— y el resto del tiempo la criatura piensa
sola, gratis y determinista.

**Y el mundo sabe más de lo que le contaron.** Al medir el vocabulario real de
la física contra la lista escrita a mano aparecieron 30 sustancias contra 6:
**24 estaban escondidas**, entre ellas el pescado y el junco, que son
justamente las dos piezas de la caña de pescar. Ninguna estaba inventada por el
modelo; salían todas de combinar materia con materia.

## Las dos Ánimas

**Ánima I** (`apps/`, `packages/`) es la completa: fases 0–9, mundo 2D con
Phaser, chat, panel de habilidades, experimentos, muerte con informe de legado y
una sucesora que hereda el conocimiento como testimonio verificable. Identidad
Nostr opcional para sincronizar el progreso, con la clave privada siempre fuera
del servidor.

**Ánima II** (`ii/`) es el rehacer, y no es un refactor: no importa una sola
línea de Ánima I — la única excepción, escrita como regla, es el backend, que se
comparte. Cambia la premisa: en vez de un catálogo de cosas que existen, hay
**materia con propiedades y leyes fijas**, y los objetos emergen de combinarla.
El fuego no se propagaba hasta que alguien ató dos cortezas, y ese fue el día
que se entendió que medir el catálogo no es medir el mundo.

Sus etapas están casi todas cerradas; quedan abiertas la fragua y la física que
se abre. El estado real se publica criterio por criterio en
[su tablero](ii/docs/tablero/) — incluidas las etapas **cerradas con rojo**: las
que se dieron por terminadas con un criterio que no cumple y la causa medida al
lado. Y hay 65 `it.fails` anotados: huecos conocidos, escritos como pruebas que
fallan a propósito, en vez de silencio.

## Lo que podés verificar sin creernos nada

```bash
pnpm test        # Ánima I
pnpm ii:test     # Ánima II
pnpm typecheck && pnpm ii:typecheck
```

| | |
|---|---|
| pruebas | **4576** en verde: 1062 de Ánima I y 3514 de Ánima II |
| typechecks | limpios en los dos árboles (`pnpm typecheck`, `pnpm ii:typecheck`) |
| decisiones registradas | **112 ADRs** (88 + 24), cada uno con el porqué y lo que se descartó |
| huecos declarados | 65 `it.fails` — lo que falta está escrito, no tapado |

Los ADRs no son ceremonia: son el lugar donde está por qué se eligió cada cosa
**y qué alternativa se tiró**. Si algo del diseño parece raro, es probable que
haya un ADR explicando contra qué se decidió.

> Nombre provisional. Los identificadores técnicos no dependen de la marca.

## Ánima I en detalle

**Fases 0–9 completadas**: la historia completa de aprendizaje funciona
headless (hito 1) y en el navegador (React + Phaser, chat, panel de
habilidades, experimentos, modo desarrollador, E2E con Playwright). La sesión
se autoguarda y sobrevive recargas; al morir, la mascota deja un informe de
legado y su sucesora hereda el conocimiento como testimonio verificable.
Con identidad Nostr (BAL desde el launcher o extensión NIP-07) el progreso se
sincroniza con el backend (`apps/api`, Fastify + SQLite): la clave privada
nunca sale del firmante y el servidor solo acepta desafíos firmados. El modo
invitado local sigue completo y sin cuentas.

Como mente real (opcional), el usuario puede conectar su **cuenta de Codex
(ChatGPT)** desde la propia interfaz («🧠 Conectar Codex»): la API local
orquesta el CLI de Codex (`codex login` / `codex exec` en sandbox de solo
lectura) y las credenciales nunca tocan Ánima. Verificado de punta a punta
con una cuenta real: el modelo propuso una habilidad, el evaluador rechazó
sus versiones débiles con regresiones, y su versión corregida fue promovida
y reutilizada sin nuevas consultas. Sin Codex, el mock determinista sigue
siendo la base: cero claves, cero costos.

## Requisitos

- Node.js >= 22
- pnpm >= 10
- CLI de Codex reciente en el `PATH` (solo para usar la cuenta de Codex)

## Inicio rápido

```bash
pnpm install
pnpm dev           # interfaz web en http://localhost:5173
pnpm demo          # el hito 1 en la terminal (semilla 5 por defecto)
pnpm demo 42       # otra semilla (cambia posiciones de herramientas)
pnpm test          # suite unitaria y de integración (125 pruebas actualmente)
pnpm test:e2e      # historia completa vía UI con Playwright (requiere
                   #   `pnpm exec playwright install chromium` una vez)
pnpm typecheck
pnpm lint
```

Parámetros útiles de la web: `?seed=42&speed=8` (semilla y velocidad),
`&autostart=0` (arranca en pausa), `&fresh=1` (ignora el guardado).

Para sincronizar con el backend: `pnpm --filter @anima/api start` (puerto
8787; el dev server de Vite proxya `/api`) y conecta tu identidad Nostr con
el botón «⚡ Conectar Nostr» (extensión NIP-07) o abriendo el juego desde el
launcher (BAL). Sin backend ni identidad, todo funciona en modo invitado.

No se necesita ninguna clave de API. Por defecto todo corre con
`MockModelProvider`, un proveedor determinista que simula un generador
imperfecto. La cuenta de Codex es opcional y el proyecto continúa funcionando
si el CLI no está instalado o la sesión deja de estar disponible.

## Probar la aplicación

### Modo local

```bash
pnpm install
pnpm dev
```

Abre <http://localhost:5173>. Este modo no necesita backend, cuenta ni clave:
el progreso se guarda en `localStorage` y la mascota usa el proveedor simulado.

### Backend, Nostr y sincronización

Con un solo comando (web + API en paralelo):

```bash
pnpm dev:full
```

O en dos terminales:

```bash
pnpm --filter @anima/api start
pnpm dev
```

Abre la web y pulsa «⚡ Conectar Nostr». La extensión NIP-07 firma un desafío
de un solo uso y el progreso pasa a sincronizarse con el backend. También se
admite BAL cuando la aplicación se abre desde un launcher compatible.

### Cuenta de Codex como proveedor de IA

1. Instala una versión reciente del CLI con
   `npm install --global @openai/codex` y comprueba que `codex --version`
   funciona desde la terminal.
2. Inicia la API y la web con los dos comandos anteriores.
3. Pulsa «🧠 Conectar Codex» en la interfaz.
4. Completa la autorización de ChatGPT en la pestaña que se abre.
5. Comprueba que el indicador cambia de «🤖 simulado» a «🧠 codex».

También puedes comprobar la sesión activa con `codex login status`. El botón
de la interfaz inicia el mismo flujo web de `codex login`.

La API solo orquesta `codex login` y ejecuciones efímeras de `codex exec` en
un directorio temporal con sandbox de solo lectura. Las credenciales siguen
gestionadas por el CLI en el equipo del usuario y no se guardan en Ánima. Para
volver al proveedor determinista, pulsa «usar simulado»; «Desconectar Codex»
(en ⚙ ajustes, o «cerrar sesión de Codex» junto al chip en modo simulado)
cierra además la sesión de Codex en el servidor.

El panel ⚙ ajustes muestra los **límites de uso** de la cuenta conectada
(plan, porcentaje consumido de cada ventana y hora de reinicio). Se consultan
al abrir el panel mediante el protocolo del `codex app-server` (el mismo que
usa la extensión oficial) y no consumen cuota del modelo.

La cuenta de Codex es **por identidad**: si iniciaste sesión con tu identidad
Nostr, tu autorización de Codex queda en un `CODEX_HOME` propio
(`data/codex/<pubkey>`), de modo que cada usuario conecta su propia cuenta.
Sin identidad (modo invitado) se usa la sesión clásica de `~/.codex` de la
máquina. Solo puede haber una autorización de Codex en curso a la vez (el
callback local usa un puerto fijo); si otra cuenta está autorizando, vuelve a
intentarlo en unos segundos.

No todos los modelos aceptan todos los niveles de razonamiento (p. ej. los
premium rechazan `minimal`): si el backend rechaza el nivel elegido, Ánima
reintenta automáticamente con el nivel propio del modelo y recuerda la
combinación para no repetir el intento fallido.

Variables opcionales del backend: `ANIMA_CODEX_MODEL` fija el modelo,
`ANIMA_CODEX_EFFORT` cambia el esfuerzo de razonamiento (por defecto, `low`)
y `ANIMA_CODEX_DIR` mueve la raíz de los `CODEX_HOME` por usuario (por
defecto, `data/codex`).

### Verificación automatizada

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm exec playwright install chromium  # solo la primera vez
pnpm test:e2e
```

Playwright levanta automáticamente la web y una API con base de datos en
memoria. Los E2E del proveedor Codex prueban el contrato usando un puente
controlado; no consumen la cuenta real del usuario.

## Dejarla andando en otra máquina (Docker)

La imagen empaqueta un solo proceso: la web ya construida y la API salen por el
mismo puerto, y el **CLI de Codex viaja adentro** — el puente de IA no llama a
ninguna API de OpenAI, lanza `codex` como subproceso. Ver
[ADR 0087](docs/decisions/0087-la-imagen-lleva-el-cli-adentro-y-la-cuenta-por-fuera.md).

La cuenta **no** se hornea en la imagen. Entra al arrancar: montás el `~/.codex`
de la máquina de solo lectura y el contenedor copia `auth.json` a su propio
volumen. Trabaja siempre sobre esa copia, así que ni un `logout` desde la web
puede tocar tus credenciales reales.

```bash
cp .env.example .env   # y apuntá ANIMA_CODEX_SEED a tu carpeta ~/.codex
docker compose up -d --build
```

Queda en `http://localhost:8787` y, desde otros dispositivos de la red, en
`http://IP-DE-LA-MAQUINA:8787`.

### Llevarla a una laptop sin construirla ahí

```bash
docker save anima:1 | gzip > anima-1.tar.gz
```

En la laptop: `docker load -i anima-1.tar.gz` y después

```bash
docker run -d --name anima -p 8787:8787 -v anima-datos:/datos --restart unless-stopped anima:1
```

La laptop **no** necesita Node, ni pnpm, ni el CLI de Codex, ni ninguna cuenta:
así levantada, Ánima no presta nada y cada visitante trae su propio modelo.

### Con qué piensa la mascota

Tres opciones, y la diferencia que importa entre ellas es **de quién es la
cuenta**:

| opción | quién paga | qué hace falta |
| --- | --- | --- |
| **simulado** (de fábrica) | nadie | nada |
| **tu propia API** | el que juega | URL, llave y modelo en ⚙ ajustes |
| **Codex / Claude de la máquina** | quien hospeda | `ANIMA_CLI_LOCAL=1` |

**Tu propia API** es cualquier servidor que hable el dialecto de OpenAI: la API
de OpenAI, OpenRouter, Groq, o un Ollama corriendo en tu propia máquina. Se
carga en ⚙ ajustes, hay un botón **Probar** que manda una consulta mínima antes
de encenderla, y **la llave nunca pasa por el servidor de Ánima**: vive en el
`localStorage` de tu navegador y viaja directo al proveedor. Como la configurás
una vez y las dos Ánimas comparten dominio, sirve también para la de `/v2`.

Requisito del proveedor: tiene que mandar cabeceras CORS (permitir que una
página de otro dominio le hable). Los cuatro de arriba las mandan; uno que no,
va a fallar como si estuviera caído.

### Lo que hay que saber antes de abrirla a la red

- **De fábrica no se presta ninguna cuenta.** `ANIMA_CLI_LOCAL` viene en 0: no
  se construye ningún puente hacia los CLI de la máquina y `/api/ai/*` contesta
  503 diciendo que traigas tu propia API. Ni siquiera se monta tu `~/.codex`.
- **`ANIMA_CLI_LOCAL=1` es lo contrario y hay que decirlo entero:** el CLI corre
  del lado del servidor, así que el que paga sos vos y el que decide es
  cualquiera con la URL — tenga identidad Nostr o no, y con Codex igual que con
  Claude. Es para cuando Ánima corre en tu máquina y para vos. Va junto con
  `ANIMA_CODEX_SEED` apuntando a la carpeta que dejó `codex login`; una sin la
  otra no sirve. Ver el [ADR 0089](docs/decisions/0089-la-canilla-se-cierra-y-cada-uno-trae-su-modelo.md).
- Con el flag encendido, el `config.toml` de tu máquina igual no viaja (trae
  MCPs, skills y rutas que dentro del contenedor no existen). El modelo se elige
  con `ANIMA_CODEX_MODEL`; sin él manda el «Automático» de la cuenta.
- Todo el estado vive en el volumen `/datos`: base SQLite, la copia de la sesión
  y los CODEX_HOME por pubkey. Un volumen, un backup.

### Exponerla en internet (Cloudflare Tunnel)

`docker-compose.tunnel.yml` agrega un `cloudflared` y cierra el puerto de la
máquina: con el túnel puesto, esa sería una segunda puerta sin nada que la
mire. El túnel es **saliente**, así que no hay que abrir nada en el router ni
tener IP pública.

Se crea una vez en el panel de Cloudflare (Zero Trust → Networks → Tunnels →
Create a tunnel → Docker), se pega el `TUNNEL_TOKEN` en el `.env`, y en ese
mismo panel se mapea el hostname público al servicio:

```
anima.naranja.fit  →  http://anima:8787
```

`anima` es el nombre del servicio del compose: cloudflared lo resuelve por la
red interna, sin pasar por la máquina.

```bash
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d
```

Ojo con lo que esto implica: la instancia queda accesible desde cualquier lado.
Con la canilla cerrada —el default— eso no te cuesta plata: el que quiera mente
real trae su llave. Si en cambio encendés `ANIMA_CLI_LOCAL=1` en algo publicado,
**cualquiera que tenga la URL gasta tu cuota**, y las dos salidas son Cloudflare
Access (solo entran los mails que listes) o una regla de rate limiting sobre
`/api/ai/*`.

### Convivir con otros proyectos

El compose usa nombre de proyecto propio (`anima`), así que sus recursos son
siempre `anima_*` y no pisan los de nadie. Si el 8787 ya está ocupado en esa
máquina, `ANIMA_PORT` lo cambia; `ANIMA_BIND=127.0.0.1` la deja invisible desde
la red. El contenedor tiene un techo de 1,5 GB de memoria para que no le pelee
los recursos a lo demás que corra ahí.

## Estructura

```
apps/
  web/                interfaz (Vite + React + Phaser + Playwright E2E)
  api/                backend (Fastify + SQLite, identidad Nostr por desafío firmado)
  demo/               CLI del hito 1 y herramienta de diagnóstico
packages/
  persistence/        guardado local, informes de legado, sucesión y linaje
  shared/             utilidades: RNG con semilla, hashing estable, eventos
  sim-core/           motor headless determinista (entidades, sistemas, snapshots)
  skill-runtime/      DSL declarativa de habilidades + intérprete con límites
  skill-evaluator/    evaluación aislada, métricas, regresiones, promoción
  memory/             memoria de trabajo/episódica/semántica/hipótesis
  model-providers/    interfaz neutral (Mock, Scripted, Codex y fallback vacío)
  agent-core/         percepción, objetivos, progreso, ciclo de creación de skills
  test-scenarios/     mundos reproducibles para pruebas y evaluación
docs/
  product/            visión y alcance del MVP
  architecture/       arquitectura por subsistema
  decisions/          registros de decisiones (ADRs)
```

## Principios que no se rompen

1. **El mundo decide qué es posible**: la IA elige acciones; las consecuencias
   las determina el motor determinista.
2. **La mascota no modifica el núcleo**: la automodificación ocurre solo vía
   habilidades validadas y versionadas en una DSL cerrada.
3. **Las habilidades son verificables**: contrato, criterios, pruebas
   reproducibles, historial de versiones y regresiones.
4. **La IA no corre en cada frame**: solo en momentos cognitivos (señal nueva,
   creación de habilidad, reflexión, conversación).
5. **Funciona sin API real**: proveedores intercambiables; el mock es
   completamente determinista.
6. **El ciclo de habilidades está cerrado**: el generador propone, el evaluador
   independiente decide.

Ver [docs/architecture/overview.md](docs/architecture/overview.md) para el
detalle y [docs/decisions/](docs/decisions/) para las decisiones registradas.
