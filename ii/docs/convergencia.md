# Convergencia conversacional — C0, C1, C2 y C3 (a medias)

El tramo lo fija [`docs/product/convergencia-conversacional.md`](../../docs/product/convergencia-conversacional.md).
Acá va lo implementado, con el mapa `contrato existente → cambio mínimo` que ese
documento pide escribir antes de tocar nada.

> **Lo que NO se hizo, dicho antes que nada:** aplicar la respuesta del proveedor,
> scheduler de prioridad e interrupción, fragua, juez y creación de objetos. Son
> C4–C6. **Y del C3 falta la mitad**, medida y escrita en la sección 8.

**La decisión que ordena los tres hitos, y se tomó una sola vez:** el
`ConversationLog` durable es el único almacén, y **todo lo demás es una vista de
él** — la memoria de la charla (C1) y los recuerdos con su procedencia (C2). El
repo ya había tomado esa decisión dos veces: `perceive/src/lugares.ts` rechazó
`ctx.remember(...)` para no abrir *«una tercera sede de estado que sobrevive a un
guardado»*, y el catálogo de una partida sale de la crónica y no de una variable.

---

## 1 · El recorrido real, y dónde está cortado

Esto no es el diagrama del documento de producto: es lo que hoy corre, medido
leyendo el árbol.

```text
#charla submit  ──►  Ordenes.decir(texto)          apps/juego/src/ordenes.ts
                        │
                        ├─ #registro.push({de:'vos'})      ← lista privada de la app
                        ├─ leer(texto, {phys, lexico, sabeElCatalogo, yaEstaCumplida})
                        │        └─ SIN `memoria`, SIN ventana, SIN consulta
                        ├─ #registro.push({de:'ella', acuse})
                        └─ encargoDe(l) → EncargoEnCurso            (efímero, no se guarda)

cuadro (rAF)   ──►  Ordenes.antesDelTick(tick)
                        ├─ #registro.push({de:'ella', 'voy por «X» (1 de 2)'})   ← progreso
                        ├─ #registro.push({de:'ella', 'listo'})                  ← fin
                        └─ new Mente({drive})     →  vivir(partida, mentes, 1)  →  mundo

cuadro (rAF)   ──►  charla()  →  pinta `#registro` desde `ordenes.registro`
cada 300 cuadros ►  guardar(baul, state, creencias, 'ana')   → { mundo, creencias }
```

**Los tres adaptadores que existen, están probados y no los llama nadie.**
Ninguno hay que escribirlo; hay que enchufarlos:

| pieza | dónde | consumidores en producción |
|---|---|---|
| `CanalDeHabla` — el canal de habla con `acuse · aviso · progreso · listo` | `lang/src/habla.ts` | **0** |
| `MemoriaDeLaCharla` — lo último nombrado/usado, que `leer()` ya sabe recibir | `lang/src/referencias.ts` | **0** |
| `consultaDe()` / `revisar()` — el hueco del proveedor, sin `await` adentro | `lang/src/consulta.ts` | **0** |

Y las tres brechas que eso deja, que son exactamente las de C1:

1. **el historial no es durable.** `Guardado` tiene `mundo` y `creencias`; la
   charla vive en un array privado de `Ordenes` y se muere con la pestaña;
2. **hay dos rutas de salida.** `CanalDeHabla` distingue cuatro clases con tick;
   la app usa un `{de:'vos'|'ella'}` propio donde el progreso queda guardado
   **como si el personaje lo hubiera dicho**, que es justo lo que el documento
   prohíbe;
3. **el turno anterior no llega al lector.** `leer()` acepta `memoria` y la app no
   se la pasa, así que «comé eso» sale por `orientacion` **siempre**, incluso
   cuando la criatura acaba de agarrar algo.

---

## 2 · Contrato existente → cambio mínimo

| contrato existente | se conserva | cambio mínimo de C1 |
|---|---|---|
| `CanalDeHabla` / `Dicho {tick, clase, texto}` | las cuatro clases, la cota de 100, «nada del tick lo toca» | clase `entrada` (el turno del cuidador), `turno` como identidad estable, `sobre?: BodyId`, `volcar()`/`cargar()` y `ventana(n)`. Es el `AgentOutput` del documento y también el `ConversationLog` |
| `Ordenes.#registro: Dicho[]` con `de:'vos'\|'ella'` | nada | **se borra**. Es la ruta paralela; la abstracción nueva tiene que eliminar una, no sumar otra |
| `MemoriaDeLaCharla` + `OpcionesDeLectura.memoria` | ids y nada más, cota de dos | `memoriaDe(ventana)`: la memoria se **deriva del log** en cada lectura, en vez de vivir suelta. Eso es lo que hace que el historial durable alimente la decisión y no sólo la pantalla |
| `Guardado {version, tick, mundo, creencias, quien}` | las tres ranuras y su puerta `loQueNoAguanta` | `charla: readonly Dicho[]`, versión **2** y migración desde la 1 (un guardado viejo entra con la charla vacía, no se rechaza) |
| `guardar(d, state, creencias, quien, ranura?)` | la firma vieja sigue compilando | 5º parámetro pasa a `{ranura?, charla?}`. Ningún llamador pasaba `ranura` |
| `consultaDe(l, lex, firmas)` | el paquete DESCRIBE, no llama | primer consumidor: `Ordenes` arma la consulta y se la pasa a un `preguntar` opcional **sin esperarla**. Aplicar la respuesta con `revisar()` es C4 y NO se hace |
| `EncargoEnCurso` | efímero, se reconstruye | no se toca. El encargo durable es C3 |
| `index.html` / `charla()` | el registro se repinta sólo cuando crece | una clase CSS por `ClaseDeDicho` y `data-turno` por línea: el progreso deja de verse como habla del personaje |

**Lo que se agrega de dependencias:** `@anima/store` pasa a depender de
`@anima/lang` (hoy: `mind`, `physics`, `world`). No hay ciclo — `lang` no importa
`store`.

---

## 3 · Los predicados observables

Ninguno es un selector de UI, y los cinco valen igual en el fixture de vitest y
en el navegador.

| # | predicado | dónde se afirma |
|---|---|---|
| 1 | tres turnos, guardado, **recarga** y un cuarto turno dejan el log en orden y con `turno` estrictamente creciente | fixture + Playwright |
| 2 | ninguna línea aparece dos veces: `turno` es único en todo el log y el DOM tiene un nodo por línea | fixture + Playwright |
| 3 | el cuarto turno se lee **con la ventana de los tres anteriores**: «comé eso» resuelve un `Ref` por id que salió del log restaurado, y con el log vacío **no** resuelve | fixture (control positivo y negativo) |
| 4 | el progreso no se guarda como habla: `clase` lo distingue y sobrevive al guardado | fixture + Playwright |
| 5 | el mundo avanza con una consulta al proveedor **pendiente para siempre**, y el estado del mundo es idéntico al de la corrida sin proveedor | fixture |

**Lo que estos predicados NO afirman, y conviene decirlo:** que la referencia
resuelta llegue al objetivo. No llega — `objetivosDe` no copia `referencia` al
`GoalNode`, y hacerlo es C3 (`Commission` + ligaduras). Lo que C1 prueba es que
el contexto previo **llega al lector** y cambia la lectura; que cambie el plan es
del tramo siguiente.

---

## 4 · La línea base de C0

C0 pide capturar métricas iniciales antes de tocar nada. Se miden en el fixture
`ii/apps/juego/tests/la-charla-sobrevive.test.ts`, que las imprime siempre:

| métrica | antes de C1 | después de C1 |
|---|---|---|
| turnos usados como contexto | **0** | **8** (el tope de la ventana) |
| líneas del log que sobreviven una recarga | **0 de 9** | **9 de 9** |
| identidad de turno | no existía | `turno` único y creciente |
| ticks hasta el acuse | 0 (ya se cumplía) | 0 |
| referencias resueltas por lo dicho antes | **0** | **1 de 1** en el caso medido |
| recuerdos recuperados | fuera de alcance (C2) | fuera de alcance (C2) |
| pausas/reanudaciones | fuera de alcance (C5) | fuera de alcance (C5) |

Las nueve líneas son las de los tres turnos del fixture: seis de entrada y acuse,
más el progreso que la criatura narra al agarrar algo.

Las dos últimas filas se dejan escritas en cero **a propósito**: son de C2 y C5, y
un cero medido es distinto de una columna que no existe.

---

## 5 · El rojo del C0, tal como salió

Antes de escribir una línea de solución, el fixture corrió y dio **6 de 6 en
rojo**, con dos causas y ninguna es un selector:

```
× (1) tres turnos, una recarga y un cuarto: ORDEN e IDENTIDAD
  → o.despuesDelTick is not a function
× (5) EL TICK NO ESPERA AL PROVEEDOR
  → Cannot read properties of undefined (reading 'at')     // `o.charla`
```

Las dos dicen lo mismo: **`Ordenes` no publicaba un log**, así que no había orden,
ni identidad, ni clase, ni contexto que restaurar. Es la brecha funcional que C1
cierra, y no una API que faltaba nombrar.

---

## 6 · Dónde queda cada cosa

| archivo | qué es |
|---|---|
| `ii/packages/lang/src/habla.ts` | el canal, con `entrada`, `turno`, `sobre`, `meta`, `cargar` y `ventana` |
| `ii/packages/lang/src/referencias.ts` | `memoriaDe(ventana)` y las dos referencias nuevas: `otra` y `discursiva` |
| `ii/packages/lang/src/recuerdos.ts` | los recuerdos como vista del log, y el retrieval con su tope |
| `ii/packages/store/src/guardar.ts` | la cuarta ranura, la versión 2 y la migración desde la 1 |
| `ii/apps/juego/src/ordenes.ts` | el cableado: un solo canal, contexto previo, borde del proveedor |
| `ii/apps/juego/tests/la-charla-sobrevive.test.ts` | los cinco predicados de C1, con recarga de verdad |
| `ii/apps/juego/tests/lo-que-te-pedi.test.ts` | los seis de C2 |
| `ii/packages/lang/tests/los-recuerdos.test.ts` | el contrato de la destilación y del retrieval |
| `ii/apps/juego/e2e/la-charla-vuelve.spec.ts` | los mismos, sobre una pestaña que se recarga |
| `ii/packages/store/tests/la-charla-se-guarda.test.ts` | el viaje por JSON y la migración |

---

## 7 · C2 — memoria episódica conversacional y retrieval

### Qué se agregó, y qué NO

| lo que el documento pide | cómo quedó |
|---|---|
| destilar episodios con procedencia | `recuerdosDe(log)`: una **vista** del log, siete clases, cada una con `turnos`, `procedencia`, `confianza` y el tick como vigencia |
| política explícita de promoción | una `entrada` **sin meta** es un `dicho`; `hecho` sale sólo de lo que la criatura hizo. Una frase del cuidador no llega a `hecho` ni por accidente |
| recuperar por turno + encargo + entidades | `recuperar(log, {texto, entidades})`, léxico y determinista, con `TOPE_DE_TURNOS = 3` |
| topes medidos | el fixture imprime cuántas líneas miró y cuántas devolvió. **Los dos topes son decisiones, no mediciones**, y está escrito en el código |
| el mismo contexto en diálogo e interpretación | `leer()` recibe `memoria` y `loQuePidio`; la `Consulta` al proveedor sale de esa misma lectura |
| el mismo contexto en la síntesis de capacidad | **no**: la fragua no está enchufada a la app. Es C6 |

### Las dos referencias nuevas, y por qué son de especies distintas

- **`otra`** — «traé el otro». Señala un cuerpo **por descarte**, y por eso obligó
  a que `MemoriaDeLaCharla` guarde una lista corta en vez de dos casilleros: para
  descartar hacen falta dos, y con `usar` pisando a `nombrar` los dos casilleros
  terminaban en el mismo cuerpo.
- **`discursiva`** — «lo que te pedí». **No señala un cuerpo: señala un turno.**
  No se resuelve con un `Ref` sino con el historial, y por eso `leer()` recibe
  `loQuePidio()` en vez de un resolutor más.

### Los predicados de C2, medidos

| # | predicado | resultado |
|---|---|---|
| 1 | charla irrelevante + recarga + «hacé lo que te pedí» recupera la misma firma y llega a la mente | ✔ |
| 2 | con el mismo mundo y **sin log**, la misma frase no recupera nada | ✔ (control negativo) |
| 3 | «el otro» resuelve a un cuerpo **distinto** que «eso» | ✔ |
| 4 | cada recuerdo cita sus turnos y su procedencia, y esos turnos existen en el log | ✔ |
| 5 | una afirmación del cuidador no cambia el `hashWorldState` ni se anota como `hecho` | ✔ |
| 6 | el retrieval devuelve 3 de 68 líneas y encuentra el turno que importa | ✔ |

**El control más fino del 5**, que no es el obvio: leer una frase **con el mundo
quieto** no puede mover el hash. `yaEstaCumplida` arma un `Contexto` con el dado
de la partida adentro, así que si preguntar consumiera azar, hablar movería la
partida sin un solo tick — y ningún test de obediencia lo vería.

### Lo que se decidió no hacer, con su razón

- **`preferencia` y `ensenanza` no son clases de recuerdo.** Hoy no hay forma
  determinista de distinguir «me gusta el pescado» de «hay un pescado acá», y un
  clasificador que se equivoca convierte una charla en una creencia falsa. Las dos
  entran como `dicho`, con su texto entero.
- **No se toca `Creencias`.** Una afirmación del cuidador podría sembrar un prior
  con `por: 'cuidador'`, y eso es una decisión de producto que el criterio de C2
  no pide: lo que pide es que no altere el mundo y que no se presente como
  observación. Las dos cosas se cumplen sin abrir esa puerta.
- **No hay embeddings.** El documento los deja como mejora posterior; el piso es
  la coincidencia léxica determinista, y está.

---

## 8 · C3 — el encargo durable, y la mitad que no se puede todavía

### La medición que ordena todo esto, hecha antes de escribir una línea

La frase del criterio —«juntá dos troncos, dejá uno junto al fuego y guardá el
otro»— se corrió por `leer` / `objetivosDe` / `interpretar` **antes** de diseñar
nada. Lo que salió:

| parte | qué pasa hoy |
|---|---|
| la frase entera | se leía como **UNA sola cláusula**, y pedía `emitsPower>0` |
| «juntá dos troncos» | sale `holding(tag:fibroso)`. **El dos se pierde entero** |
| «dejá uno junto al fuego» | sale por `orientacion` y se descarta: «soltar no lleva a un estado del mundo que yo sepa nombrar» |
| «guardá el otro» | `no-entendida`: `guardar` no está en el léxico |

Y el barrido del vocabulario de objetivo:

```
count>=2 ......................... NO      holding(tag:fibroso) ..... sí
holding(tag:fibroso,count>=2) .... NO      emitsPower>0 ............. sí
distance<=1 ...................... NO
at.x>=8 .......................... NO
wet>=0.9 ......................... NO
```

**Dos de las tres partes piden vocabulario que no existe: cantidad y lugar.**
`Predicado` tiene tres formas —`cualidad`, `geometria` y `sostiene`— y ninguna
cuenta ni ubica. Portarlo es el ADR 0083 de Ánima I, es una decisión de alcance,
y **no se tomó acá**.

### Lo que sí se hizo

**C3-A · la coma corta cuando la sigue un verbo.** El defecto de arriba no era
sólo que se perdieran cláusulas: adentro del trozo pegado, el atajo de la meta de
`componer` encontró el «fuego» de la segunda mitad y se lo dio al `juntar` de la
primera. **La segunda mitad le robó la meta a la primera**, que es peor que
perder una cláusula — es el defecto del ADR 0078 entrando por otra puerta.

No cortar por coma era una decisión escrita, con su contraejemplo: «traé leña,
agua y piedras» no son tres pedidos. La regla que distingue los dos casos usa el
léxico, que ya sabe qué es un verbo, y el contraejemplo **se comporta idéntico a
antes** — afirmado con las dos formas, con y sin coma.

**C3-B · el encargo durable.** `EncargoEnCurso` era un cursor con un índice
adentro. Ahora es un grafo con identidad, y se guarda en la quinta ranura:

| campo | qué es |
|---|---|
| `id` | derivado del turno que lo creó — no sorteado: `Math.random` está prohibido en `src/` |
| `turnos` | de qué turnos del log salió. La misma procedencia que los recuerdos del C2 |
| `texto` | lo que el cuidador escribió |
| `nodos` | el grafo: `id`, `meta`, `after` (orden parcial) y `bindeaSlot` |
| `hechos` | qué nodo probó el mundo **y en qué tick lo probó por primera vez** |
| `estado` | `activo`, `cumplido` o `cancelado` |

Lo que **no** está y es de C5: `priority` e `interruptibility`. Y `blocker`
necesita el bloqueo estructurado que hoy no produce nadie.

### Los predicados de C3, medidos

| # | predicado | |
|---|---|---|
| 1 | un pedido de dos partes deja un grafo con identidad, `after` y procedencia | ✔ |
| 2 | una parte cumplida queda anotada **con el tick** en que se cumplió | ✔ |
| 3 | la recarga en el medio devuelve el encargo y persigue la **segunda** parte | ✔ |
| 4 | y no repite la primera **aunque el mundo ya no la cumpla** | ✔ |
| 5 | sin guardar el encargo, la recarga lo pierde | ✔ control negativo |
| 6 | se cierra sólo cuando el mundo prueba las partes, y ahí dice «listo» | ✔ |
| 7 | la actividad en vuelo no viaja: el guardado tiene siete claves y ninguna es el plan | ✔ |

El 4 es el que separa **acordarse** de **volver a mirar**: si lo hecho se
dedujera del mundo, soltar el palo haría empezar de cero. Lo que se afirma es que
se cumplió una vez, con su tick — que es lo que el ADR 0083 porta cuando dice que
`sequence` compara «el tick en que cada objetivo se cumplió por primera vez».

### Lo que queda abierto del C3, con su nombre

1. **cantidad y lugar como condiciones de objetivo** (ADR 0083). Sin eso, la
   frase literal del criterio no se puede cumplir y no hay forma de disimularlo;
2. **el ejecutor de la ligadura diferida.** `bindeaSlot` se guarda y nadie lo
   usa: `Mente` no sabe recibir un `binds`, está medido en el encabezado de
   `encargo.ts`, y vale siete pasos de plan cuando existe;
3. **la corrección multi-turno** —«no ése, el otro tronco»— que el documento pide
   que revise la ligadura del nodo pendiente sin crear otro encargo.
