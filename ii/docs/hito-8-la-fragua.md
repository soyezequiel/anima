# Hito 8 — La fragua, la escalera y el carril de mejora

**Qué es, en una frase:** que la criatura **escriba una habilidad que no tenía**,
con el mundo corriendo y sin perder un tick.

Es el primero donde el modelo produce **código que se ejecuta**. Hasta acá
proponía lecturas (Hito 6) y nada más.

---

## 0 · Las mediciones que se hicieron ANTES de escribir el criterio

### M1 · De la fragua no existe NADA — cero líneas

```
grep -rn "BlueprintCandidate|BuildSkill|UseSkill|Candidata" ii/packages/*/src
→ sólo menciones en comentarios de @anima/judge, ninguna definición
```

Es el hito más grande del plan (4-5 semanas) y arranca en blanco. Lo que **sí**
está y es suyo: el juez (Hito 7), que es quien dice si lo forjado sirve.

### M2 · LA PUERTA LOCAL ES ~140× MÁS BARATA QUE UN VIAJE, y ya estaba medido

El banco del Hito 0 (`skills/banco/typecheck.mjs`) se corrió de nuevo hoy:

| | medido | presupuesto |
|---|---|---|
| typecheck con **ranura fija** (`LanguageService`, la candidata siempre en el mismo path) | p50 **47 ms** · p95 **87 ms** | 90 / 250 ✔ |
| el mismo tibio **mal llamado** (`createProgram` por candidata) | +319 ms por candidata (2,9×) | — |
| **reparar y rechazar localmente** | **168 ms** | — |
| **un viaje al modelo** | **6 a 25 s** | — |

**Eso manda sobre toda la arquitectura**, y el banco lo dice con todas las
letras: *«el typecheck local es viable como puerta antes del viaje al modelo»*.
Y la segunda fila importa igual: **la forma de llamar a la API ES el
presupuesto** — el mismo trabajo, mal pedido, cuesta 10×.

### M3 · El cliente del proveedor YA ESTÁ ESCRITO, y fuera de `src/` a propósito

`lang/demo/proveedor.ts` habla con Claude, Codex y OpenAI. Vive en `demo/` porque
la **regla 2** prohíbe `await` en los `src/`. Este hito le da casa.

**Lo que migra a `@anima/llm` es el CLIENTE, no la frontera.** El patrón del Hito
6 —el paquete DESCRIBE la consulta y el llamador, que sí puede esperar, la
manda— es el mismo que necesita la fragua, y no se rehace.

### M4 · «HTTP con streaming» dejó de ser preferencia y es un número

El puente del Hito 6 mide **14 s y US$ 0,0158 por frase** con el CLI, de los
cuales **~10 s son arranque de proceso**: la sonda directa dio 4 s. El camino
HTTP no compra estilo, compra diez segundos.

### M5 · `ticksPerdidos` existe y tiene su definición escrita

`perceive/src/bucle.ts`, con el encabezado que dice por qué —*«un contador sin
definición no mide nada»*—. El criterio de este hito pide `ticksPerdidos === 0`
durante todo el episodio y **no hay que inventar el contador**.

---

## 1 · El criterio, punto por punto

Los del documento de arquitectura, con cómo se afirma cada uno.

| | qué se afirma | cómo se mide |
|---|---|---|
| **1** | dado el gap «conseguir alimento de un cuerpo de agua», **al menos una de dos candidatas compila sin reparación** | K=2 por viaje, con el typecheck de ranura fija |
| **2** | y **al menos una compila con reparación** | las reparaciones deterministas, sin volver al modelo |
| **3** | **matar la conexión a mitad de un parche** no deja el mundo inconsistente | `AbortController` + aplicación en frontera de tick |
| **4** | el episodio completo **no supera N consultas** | test de presupuesto en CI |
| **5** | **`ticksPerdidos === 0`** durante todo el episodio | el contador que ya existe |
| **6** | una habilidad **degradada a propósito** entra en la cola, se re-forja en el fondo y la ganadora **reemplaza sin perder un tick** | el carril de mejora |
| **7** | una candidata **peor no reemplaza nada** y queda archivada como regresión | el duelo contra la titular, en sus propios mundos |
| **8** | con la **cuota agotada**, la cola **no dispara ni una consulta** | el presupuesto como puerta, no como aviso |

**Y el juez del Hito 7 es quien contesta el 6 y el 7.** No hay que escribir un
segundo criterio de «mejor»: `juzgar()` ya da cuatro cargos y un grado, el banco
sale del contrato y el duelo es comparar dos dictámenes sobre **los mismos
mundos**.

### Lo que el caso de aceptación suma

La fragua deja de producir un archivo y produce **un paquete**:

```
BlueprintCandidate + BuildSkillCandidate + UseSkillCandidate
  + dependencias + capacidades publicadas
```

Con **cuarentena**, **reparaciones limitadas**, **máximo de consultas**,
**aplicación en frontera de tick**, **digest base esperado** y **rechazo si el
catálogo cambió**.

Y un lint más: **prohibido copiar constantes físicas dentro de las skills** — un
literal de calibración adentro de una habilidad es un sello que
`physicsVersion` no puede invalidar.

> **Ese lint tiene su hermano ya construido.** El guardián del sello (Hito 7,
> tramo B) sella los 591 números de la física y dice cuál se movió. Un literal
> copiado adentro de una skill es exactamente lo que ese guardián **no** puede
> ver, y por eso el lint va aparte.

---

## 2 · La decisión, tomada por el usuario antes de escribir código

### D1 · SIN LÍMITE, pero con contador

**Decidido, en dos pasos y el segundo dio vuelta al primero.**

Primero fueron **cuotas separadas** —un tanque para cada carril— y después el
usuario sacó los tanques: *«no quiero que tengan tanques, quiero que sea
ilimitado»*. **La criatura aprende todo lo que quiera.**

Antes de borrar nada se preguntó **qué protegía el límite**, que es la regla del
ADR II-0024. El plan lo dice con todas las letras:

> si no se diseña temprano, **la factura decide la arquitectura por vos**

Y hay un dato duro: **nadie sabe todavía cuánto sale un episodio de la fragua**.
El contador es cómo se averigua; sin él se averigua por el resumen de la tarjeta.

Así que se separaron dos cosas que parecían una: **el TOPE se fue, la MEDICIÓN
se quedó.** El techo existe **apagado**, y sólo lo enciende quien corre el test
de CI —«el episodio completo no supera N consultas»—, que es un guardián de
regresión: si un cambio lleva un episodio de 8 llamadas a 400, tiene que verse en
un test.

**`Infinity` y no `undefined`**, y no es un detalle de estilo: la aritmética es
la misma con techo y sin techo, así que **el camino que usa el juego es el mismo
que prueba CI** y no pueden divergir.

#### Y siguen siendo dos carriles, aunque ya no compitan

Ya no es para que uno no mate de hambre al otro —sin tope no hay hambre—. Es
porque **«gastamos 3000 milésimas» no dice nada y «la fragua gastó 2800 y el chat
200» sí**. Los dos consumidores tienen costos por operación muy distintos, y
sumarlos esconde justamente al que se fue de escala.

---

### Lo que la decisión de cuotas separadas decía, y se conserva porque explica el camino

Se descartaron las dos prioridades —«la fragua manda» y «el chat manda»— y las
dos tenían un argumento real:

- **la fragua manda:** el chat sabe degradarse (entiende 9% en vez de 30% y sigue
  contestando, que es el piso del ADR II-0024) y la fragua sin cuota **no hace
  nada**;
- **el chat manda:** protege lo que el usuario siente en el momento.

Cuotas separadas compra **predictibilidad** a cambio de plata ociosa cuando un
carril no usa la suya, y saca del medio el caso que más asusta: que un chat
activo deje a la criatura sin aprender nunca.

#### Y EL REPARTO NO SE ELIGE A DEDO

Es la regla que este repo ya pagó tres veces —el `80%`, el `200` y el `110` del
Hito 6—: **un número puesto antes de medir defiende otra cosa de la que parece**.

Así que el reparto entra como **parámetro con default documentado**, y lo que el
criterio afirma no es el número sino el invariante:

> **ningún carril pasa de lo suyo, y con su tanque en cero no dispara ni una
> consulta.**

Eso es verificable con cualquier reparto. La primera corrida de verdad fija la
línea base, igual que la cobertura del chat: *presupuestos, no mediciones*.

---

### Lo que la decisión reemplaza

*(el planteo original, que se conserva porque explica de dónde salió)*

### D1 · El presupuesto tiene DOS consumidores y la política de descarte no está decidida

Está anotado desde la tercera enmienda del [ADR II-0024](decisions/II-0024-el-piso-del-chat-no-es-sin-llm-es-sin-espera.md)
y es lo primero que este hito tiene que escribir.

El presupuesto por sesión se pensó **para la fragua**, que se usa poco. Desde el
Hito 6 el chat también consulta, se usa mucho más y **tiene otra urgencia**:

| | tarda | ¿puede esperar? |
|---|---|---|
| la fragua | 6-25 s (caso frío) | **sí** — la criatura sigue con lo que sabe |
| el chat | tiene que no hacer esperar | **no** — es el punto 2 del Hito 6 |

Con qué prioridad se descarta cuando los dos compiten por la misma cuota es una
decisión de producto, no una de implementación.

---

## 3 · Los tramos

*(se escriben cuando D1 esté decidida)*
