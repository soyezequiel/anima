# Convergencia conversacional — C0 a C6

El tramo lo fija [`docs/product/convergencia-conversacional.md`](../../docs/product/convergencia-conversacional.md).
Acá va lo implementado, con el mapa `contrato existente → cambio mínimo` que ese
documento pide escribir antes de tocar nada.

> **Lo que NO se hizo, dicho antes que nada:** la creación de objetos nuevos, que
> es el trabajo posterior y tiene su propia puerta de salida. De C0 a C6, cada
> hito tiene su sección con lo que quedó abierto y por qué — y en todos los casos
> es un hueco medido, no una lista de deseos.

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
| pausas/reanudaciones | fuera de alcance (C5) | **0 de 400 ticks** con hambre 0,92 y un pescado a los pies — ver la sección 9 |

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
| `ii/packages/lang/src/encargo.ts` | el encargo como grafo guardable, con orden, señalados y revisiones |
| `ii/packages/plan/src/predicado.ts` | la cantidad (`cuantos`) y el lugar (`cerca`), con su `implica` y su `cumple` |
| `ii/packages/plan/src/regresion.ts` | los dos casos base: agarrar lo que ya hay, y dejarlo donde va |
| `ii/apps/juego/tests/dos-troncos.test.ts` | el encargo de tres partes con recarga en el medio |
| `ii/apps/juego/tests/junto-al-fuego.test.ts` | el lugar, de la frase al plan |

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

### C3-C · la cantidad entra al lenguaje de objetivos

**«Juntá dos troncos» pedía uno.** `cumple` contesta la forma `sostiene` con un
`some` sobre la mano —es existencial— así que el dos se perdía en silencio y el
pedido quedaba cumplido con el primero.

Entró como un campo, `Predicado.sostiene.cuantos`, y se escribe donde uno lo
escribiría: `holding(tag:fibroso,count>=2)`. Cuatro decisiones, cada una con su
porqué en el código:

- **sólo mínimos.** `count<=1` es un TOPE, o sea una restricción, y una
  restricción no es un objetivo: `objetivosDe` ya rechaza las prohibiciones
  porque `GoalNode` no tiene signo y el planificador iría a cumplirlas;
- **una sola escritura canónica.** `count>1` se lee y se escribe `count>=2`, y el
  uno no se escribe: `holding(tag:x)` y `holding(tag:x,count>=1)` piden lo mismo;
- **`count` vive adentro de la mano.** Suelto no quiere decir nada — `count>=2` no
  dice de qué dos habla;
- **y la cuenta ordena el índice.** Es la línea que hace que esto sirva: sin ella
  el esquema que promete agarrar UNO cubriría un pedido de DOS, y la criatura
  diría «dale, voy» sobre algo que no sabe hacer.

**El hallazgo, y es el que vale:** el planificador **no sabe contar y no hizo
falta enseñarle**. `plan()` sabe conseguir uno, la mente replanifica mientras la
meta siga sin cumplirse, y juntar dos sale de repetir lo que ya sabía. La cuenta
vive en el OBJETIVO y no en el plan. Medido de punta a punta: la criatura junta
dos, la meta se prueba contra el mundo, y el encargo cierra ahí — con el control
de que sin número cierra con uno.

### C3-D y C3-E · la corrección multi-turno, y la referencia llegando al plan

**Medido antes de tocar nada:** «no ése, el otro» resolvía a **ése**.
`referenciaDe` devolvía la primera clase que encontraba barriendo la frase, y el
demostrativo va antes que «el otro» — o sea que **la corrección apuntaba a lo que
se estaba rechazando**. Ahora manda la más específica, y se separan dos cosas que
eran una: la CLASE de la cláusula (que puede ser `discursiva`) y a qué CUERPO
apunta, porque «hacé lo que te pedí con el otro» necesita las dos.

**Y la corrección revisa en vez de no hacer nada.** Antes, esa frase salía
`no-entendida`, se descartaba, y el cuidador veía «no te entendí» mientras la
criatura seguía igual — lo peor de los dos mundos, porque parece que entendió que
no. Ahora: mismo encargo, mismo id, mismo grafo, mismo lo cumplido, y el nodo
pendiente pasa a apuntar a otro cuerpo, **con traza** (`Revision`: qué nodo, a qué
cuerpo, de qué turno) que sobrevive la recarga.

La regla no necesita entender la negación: *una cláusula que señala un cuerpo, no
pide meta propia, y llega con un encargo abierto, es una corrección de ese
encargo*.

**El último eslabón: la referencia llega al planificador.** `Drive.meta` es una
firma EXISTENCIAL, así que «traé el otro tronco» y «traé un tronco» llegaban
idénticos y ganaba el más cercano. Ahora `GoalNode.sobre` y `Drive.sobre` llevan
CUÁL, y `agarrarLoQueYaHay` lo prefiere.

Es una **preferencia y no un filtro**, y la diferencia está escrita: si el
señalado ya no está —lo consumió una ley, se lo llevó el agua— el plan sigue con
el que sirva. Una referencia vieja no puede dejar a la criatura sin nada que
hacer.

Y el `sobre` sólo viaja si la meta en curso ES la del drive: si el hambre le ganó
al pedido, arrastrar el cuerpo señalado a una meta propia la mandaría a comerse el
tronco que le señalaron.

### El hueco que destapó, y cómo se cerró

**La charla sólo sabía nombrar lo que la criatura AGARRÓ.** La memoria se deriva
del log, y las únicas líneas con cuerpo eran los `progreso` de lo que levantó. Un
cuidador que dice «no ése, el otro tronco» está señalando uno del **piso**, y de
ésos el log no sabía nada. Medido: a los 20 ticks los dos cuerpos nombrados eran
los dos que había levantado, y uno ya lo había consumido `unir`.

**Se cerró nombrando a dónde VA**, que es la regla más barata que lo resuelve:
una línea por destino y no una por cuerpo a la vista. Lo que el cuidador corrige
es la decisión, no el paisaje — y el destino de un `ir` es justo lo que está por
hacer mal.

### C3-F · la ligadura diferida, con ejecutor

«Asá **el pescado**» señala algo de otra especie que «el otro tronco»: el
rendimiento de un nodo hermano, que **cuando la frase se dice todavía no
existe**. Estaba cortado en el último tramo:

```
objetivosDe ata el nodo ....... binds: {slot:'comida', from:'g0'}   ✔
el encargo lo guarda .......... bindeaSlot: 'comida'                ✔
alguien lo ejecuta ............ NADIE
```

`Mente.#rindes` resuelve un `{k:'rinde'}` DENTRO de un plan y se vacía en cada
plan nuevo, así que una ligadura entre nodos del ENCARGO —que son planes
distintos, separados por ticks— no tenía dónde vivir.

**La reparación no inventa un canal: reusa el `sobre` de la corrección.** Cuando
un nodo se da por cumplido se anota **con qué** (`Cumplido.rindio`), y el nodo
que liga lo recibe como cuerpo señalado. De ahí en adelante es el mismo camino.

Tres decisiones, con su porqué:

- **sólo la mano y sólo `sostiene`.** Un `emitsPower>0` cumplido por una fogata
  que ya estaba prendida no *rindió* nada, y decir que sí ataría el nodo
  siguiente a un cuerpo que la criatura nunca tocó;
- **la corrección gana sobre la ligadura.** Si te corrigieron, te corrigieron:
  lo último que dijo una persona pesa más que lo que dedujo el grafo;
- **la ligadura sólo se sigue si el nodo la DECLARA.** Arrastrar el rendimiento
  anterior a un nodo que no lo pidió sería inventar una atadura que nadie midió,
  que es lo que `objetivosDe` se niega a hacer con su tabla de pares ligables.

Y el señalado pesa en los DOS lugares donde se elige un cuerpo: al agarrar
(`agarrarLoQueYaHay`) y al repartir roles. «Asá el pescado» no se resuelve
agarrando nada —ya está en la mano— sino eligiéndolo para el rol `comida`.

### C3-G · el lugar, que era lo único que quedaba

La conclusión había llegado tres veces desde lugares distintos —midiendo la frase
del criterio, midiendo la corrección y midiendo la ligadura— y las tres
terminaban en lo mismo: `Predicado` tenía tres formas y NINGUNA relacionaba dos
cuerpos, así que «dejá uno junto al fuego» era la mitad de la frase que se
descartaba con su porqué.

**La cuarta forma.** `{ k: 'cerca'; tag: string; de: Predicado }`, que se lee
«algo con este tag, soltado, a un paso de algo que cumpla `de`». Tres decisiones
adentro, y las tres se pueden discutir:

- **el ancla es un predicado y no un cuerpo.** `cerca(tag:fibroso,emitsPower>0)`
  dice «junto a algo que dé calor» y no «junto al cuerpo 47». Cuesta lo mismo de
  evaluar y sobrevive a que el fuego se apague y se prenda otro, que es lo que
  pasa en una partida de verdad. Un id adentro de una firma sería un objetivo que
  caduca sin que nadie lo toque.
- **tenerlo en la mano NO cuenta.** Es la mitad que se olvida: sin esa exclusión
  la meta se cumple caminando hasta la fogata con el palo en la mano, y el
  cuidador ve «ya está» sin que nada se haya soltado. `cumple` filtra por
  `holding` antes de mirar distancias, y tiene su bloque de test.
- **«a un paso» es distancia de Chebyshev ≤ 1**, o sea las ocho celdas de
  alrededor y la propia. En una grilla, «al lado» en diagonal es al lado.

**Y el planificador aprendió a alcanzarlo.** Era la parte cara y la razón por la
que esto no había entrado antes: `regresion.ts` sabía agarrar cosas y no sabía
soltarlas en ningún lado. El caso base nuevo, `dejarloDonde`, emite dos pasos —
`ir` hasta el ancla con tolerancia 1, y `poner` lo que tiene en la mano. Se
enchufa al lado del que ya estaba: `agarrarLoQueYaHay(...) ?? dejarloDonde(...)`,
y el `sobre` del nodo —el señalado de C3-D— entra a los dos por el mismo
parámetro, así que «dejá EL OTRO junto al fuego» sale sin código nuevo.

Sin fuego a la vista la respuesta honesta sigue siendo `gap` con la firma
adentro: no hay de qué estar cerca, y el aviso se lo dice al cuidador.

**Lo que se midió y salió de costado: «junto» se lee como «junco».** El
emparejamiento difuso del lenguaje acepta una edición de tolerancia —deliberado,
para que «construi una ahoguera» llegue— y esas dos palabras se distinguen por
una letra. En la frase entera no hace daño: «dejá EL PALO junto al fuego» trae
las dos sustancias y gana la primera. El daño es cuando la frase viene sin
objeto, que es justo cuando habría que preguntar qué dejar. Quedó como `it.fails`
en `junto-al-fuego.test.ts` con la reparación anotada —que «junto a» sea
vocabulario de la relación y gane por más larga, para lo cual `Denota` necesita
una forma que hoy no tiene— porque taparlo con una lista de palabras excluidas es
justo la lista que este paquete existe para no tener.

Con esto **el C3 cierra**: el encargo se guarda, tiene orden entre las partes,
conserva la identidad de lo señalado, se corrige a mitad de camino, liga el
rendimiento de un nodo al siguiente y ya sabe decir dónde.

---

## 9 · C5 — prioridad, interrupción y continuidad

### La medición que ordena el hito, hecha antes de escribir una línea

Se le pidió «juntá dos troncos y hacé fuego», y en el tick 8 —con el encargo a
mitad de camino— se le puso el hambre en 0,92 y **un pescado a los pies**:

```
t8   meta=emitsPower>0  por=D2  vuela=ir
t15  meta=emitsPower>0  por=D2  vuela=sostener
t18  meta=emitsPower>0  por=D2  vuela=frotar
…    y 382 ticks más frotando dos palos, con el pescado ahí.
```

**La orden del cuidador no se interrumpía nunca.** Y no era un olvido: eran dos
cosas, las dos escritas a propósito y ninguna pensada para esto.

1. **`Ordenes` mandaba `peso: 1`.** `Drive.peso` está documentado como «cuánto
   vale contra lo que la criatura elegiría sola, en [0,1]», así que 1 quería
   decir, literalmente, «lo que te pido vale más que cualquier cosa que te pase».
   Eso no es obediencia, es sordera;
2. **D1 devuelve `seguir` mientras haya algo volando.** Es la regla que evita que
   la criatura tiemble entre dos ideas, y funciona: mientras `frotar` esté en
   vuelo la escalera **ni siquiera baja a D3**, que es el peldaño donde el hambre
   podría ganar. El único que corta algo en vuelo es D0, y D0 es sólo para lo que
   quema.

O sea que el hito no era «agregarle un scheduler a la mente»: era que **la
escalera no puede interrumpirse a sí misma**, y que el peso de una orden estaba
puesto en el máximo sin que nadie lo hubiera decidido.

### Dónde vive la reparación, y por qué no adentro de la mente

Afuera, en `Ordenes`, por la misma razón por la que el encargo vive afuera desde
el C3: **la mente recibe UNA meta y no un grafo**, así que el único que puede
decir «esto es la segunda de dos partes de algo que te pidieron, y lo vamos a
dejar para después» es el de afuera. Se decide en la frontera del tick —el mismo
lugar donde el C4 aplica lo que llegó del proveedor— y se ejecuta con la
operación que ese archivo ya hacía en cada orden nueva: **soltar el drive y
reconstruir la mente**. No se inventó un punto seguro: se usó el que había.

### El número, dicho sin maquillaje

`PESO_DEL_ENCARGO = 0,8`, y la pausa dispara cuando una necesidad le gana. Las
dos puntas del rango explican el lugar:

- **abajo**, la escalera sólo toma una orden si `peso > 1 − peso`, o sea arriba
  de 0,5. Debajo de eso el pedido directamente no se escucha;
- **arriba**, `energia` llega a 0,8 con el tanque en **106 de 1000** —la curva es
  `((tanque − aliento)/tanque)²` y está escrita en `necesidades.ts`— o sea hambre
  de morirse.

Lo que este número dice es «te hago caso salvo que me esté muriendo». Se mueve el
día que alguien lo juegue y le parezca otra cosa; lo que no se puede es no
elegirlo, porque 1 también era una elección, sólo que sin decirlo.

### La vuelta no es simétrica, y ahí está el número de la escalera

Se pausa apenas duele y se vuelve recién `PERMANENCIA_EN_TICKS` después de que
dejó de doler. No es prudencia: una necesidad que oscila alrededor del umbral
pausaría y reanudaría un tick sí y otro también, y el cuidador leería ocho «tengo
hambre» seguidos. Es la **misma** histéresis que la escalera aplica entre
peldaños y el mismo número, leído de allá — dos anti-oscilaciones con dos
constantes distintas serían dos ideas de cuánto dura una idea.

### La otra mitad: «pará eso … después seguí»

Medido con un encargo abierto, antes de tocar nada:

```
«pará»      → verbo=parar   grado=orientacion   acuse=«no te entendí del todo»
«olvidate»  → verbo=parar   grado=orientacion   acuse=«no te entendí del todo»
«seguí»     → verbo=—       grado=no-entendida  acuse=«no te entendí»
```

O sea: **el verbo ya venía leído y no lo escuchaba nadie.** `alias.ts` tiene la
fila de `parar` desde el Hito 6, con un comentario que dice «es el único verbo
que no pide nada: cancela», y `componer` lo mandaba al cajón de los que no llevan
a un estado del mundo. Es la misma forma que tenía «no ése, el otro» antes del
C3: una frase leída que se perdía.

Dos decisiones de producto salieron de ahí:

- **«pará» pausa y no cancela.** Las dos lecturas son legítimas en castellano y
  hay que elegir; se elige la reversible. Si el cuidador quería cancelar, lo
  vuelve a decir; al revés se pierde el encargo y no hay cómo traerlo. Por eso
  `cancelar` se separó en su propio verbo, con sus propias palabras;
- **«seguí» con hambre de morirse no obedece, y lo dice.** Va contra la regla del
  C3 —lo último que dijo una persona gana siempre— a propósito: esa regla vale
  para lo que el cuidador SABE (cuál tronco quiso decir) y no para lo que el
  cuerpo de la criatura tiene. La alternativa está medida: reanudar la deja lista
  para que el scheduler la vuelva a pausar al tick siguiente, o sea un «tengo
  hambre» por tick para siempre.

**Y una trampa que encontró un test de otro hito:** «para» sin acento también es
preposición. El spec del C4 usa «dale para el agua» como frase floja, y con el
control recién puesto esa frase pausaba el encargo — `clave()` saca los acentos, y
hace bien. La regla que lo separa es lo que estos tres verbos son y ya estaba
escrito: **los que no piden nada**. Si la frase nombra una cosa, «para» está
uniendo dos partes de una oración.

### Y una pregunta que apareció sola: de quién es una pausa

Salió de un test que parecía de otra cosa. Después de una recarga, la sesión
nueva **no sabe de quién era la pausa que se encontró puesta**, y la regla del
hito es que el que pausa sea el que reanuda. Se podía leer del motivo, que dice
«hambre» o «me lo pediste» — o sea decidir conducta mirando una frase escrita
para un humano, que el día que alguien la reescriba mejor deja a la criatura
reanudando sola las pausas del cuidador.

Así que `Transicion` lleva `quien: 'vos' | 'ella'`, con las mismas dos palabras
que ya usa la charla.

### Los predicados de C5, medidos

| # | qué se afirma | dónde |
|---|---|---|
| 1 | con el hambre arriba de 0,8 el encargo pasa a `pausado` | `el-hambre-interrumpe` (1) |
| 2 | la pausa se dice por el canal, con su motivo | (2) |
| 3 | y la mente suelta la meta del cuidador: no es un rótulo | (3) |
| 4 | al pasársele retoma sola y no repite lo hecho | (4) |
| 5 | las dos transiciones quedan con tick, motivo y quién | (5) |
| 6 | y sobreviven la recarga: vuelve pausado y retoma igual | (6) |
| 7 | mientras tanto **come**, que es para lo que se pausó | (7) |
| 8 | sin hambre no se pausa nunca | (8) |
| 9 | «pará eso» pausa desde la charla y lo acusa | `para-y-segui` (1)(2) |
| 10 | la pausa a mano no se levanta sola | (3) |
| 11 | «seguí» retoma sin repetir | (4) |
| 12 | «olvidate» cancela y no vuelve | (6) |
| 13 | «seguí» con hambre de morirse se niega, y lo dice | (7) |
| 14 | «dale para el agua» no para nada | (9) |

### Lo que queda abierto del C5 (ver también la sección 10)

**«Vení acá».** De la frase entera del criterio, la parte del medio no se puede:
el cuidador **no tiene cuerpo en este mundo**. `mundo.ts` monta un actor —la
criatura— y tres cuerpos; «acá» no denota nada y un objetivo de posición necesita
una posición. Se lee `verbo=ir` y se descarta, que es lo correcto: inventarle una
posición sería mandarla a un lugar que nadie eligió. Queda como `it.fails` en
`para-y-segui.test.ts`.

---

## 10 · C6 — fragua, juez y overlay en el recorrido real

### La medición, y es la misma forma de las tres anteriores

Antes de escribir una línea se contaron los consumidores de cada pieza:

- **`@anima/forge` y `@anima/judge`** — CERO en producción. El único
  `package.json` que los declara es el de `@anima/mind`, y ni siquiera los
  importa: `PedidoALaFragua` está escrito estructuralmente para no depender;
- **`MenteOptions.costura`** — CERO llamadores. `escalera.ts` la llama cuando
  `plan()` contesta `gap`, y nadie se la pasaba, así que **el gancho no podía
  dispararse ni una vez**;
- **`Sujeto`** —lo que el juez juzga— se construye SÓLO adentro de los tests del
  propio juez. La cadena fragua → juez no existe en ninguna parte;
- **`Registro.instalar`** —el que publica una habilidad juzgada al catálogo—
  tampoco tiene un llamador de producción.

Los dos puertos están enteros, probados, y no se tocan. Es el mismo verde por
omisión que el propio `PedidoALaFragua` denuncia en su comentario —«la fragua no
se despierta ni una vez» era cierto porque no había por dónde despertarla— sólo
que un piso más arriba.

### Lo que apareció al abrir la costura, y no lo esperaba nadie

Con `costura` enchufada, en 600 ticks y con **cualquier** orden —y también **sin
ninguna orden, viviendo sola**— la mente pide siempre exactamente lo mismo:

```
gap  = emitsPower<410&emitsPower>=253
meta = holding(tag:carnoso,toxicity<0.0528)
por  = ningún esquema conocido establece «emitsPower>=253»
```

Traducido: **quiere cocinar**. Tiene hambre, la carne cruda es venenosa, cocinar
la destoxifica, y para cocinar necesita un fuego DE ESTA FUERZA — y el catálogo
sabe hacer «un fuego», no «un fuego de tanto». Es literalmente la frase del
criterio del hito: componer de forma nueva recursos que ya existen. No hubo que
inventar un caso de prueba: la criatura lo pide sola desde el tick 90.

### Dónde vive cada cosa, y qué NO se importó

`apps/juego` **no depende de la fragua ni del juez**, y es deliberado: esos dos
arrastran el modelo, el presupuesto y un compilador de TypeScript, y una pestaña
de navegador no necesita nada de eso para jugar. Lo que hay es un PUERTO
(`OpcionesDeOrdenes.fragua`) que recibe el hueco y devuelve lo forjado **ya
juzgado**. Es la misma decisión que `@anima/forge` tomó con `CargoDelJuez` y que
`@anima/mind` tomó con `PedidoALaFragua`, y por el mismo motivo.

Y el que decide si se usa **no es el puerto**: es el grado del juez, leído por el
portón del juego. Un puerto que decidiera solo sería la UI promoviendo
habilidades, que es lo que el hito prohíbe con todas las letras.

### El portón de la materia: por qué mira palabras y no estructura

La tentación es `interpretar(gap)` y mirar el `Predicado`. No sirve, y se ve con
el hueco de verdad: `emitsPower<410&emitsPower>=253` es una CONJUNCIÓN, y
`Predicado` tiene cuatro formas y ninguna es «y». Un portón apoyado en eso diría
que no a todo, que desde afuera se ve igual de bien que decir que sí a todo.

Lo que se mira son **las palabras**: toda firma nombra cualidades, tags,
sustancias o palabras de su propia gramática, y las cuatro listas son cerradas
(29 cualidades, 7 tags, las sustancias de la partida, y `holding`/`tag`/`count`/
`cerca`). Una palabra que no está en ninguna es materia o física que este mundo
no tiene.

Lo que este portón **no** promete es que lo que pase sea forjable. Promete que lo
que no pasa es imposible, que es la mitad que el hito pide: nada se crea por
accidente.

### Los portones de la promoción son DOS, porque son dos preguntas

1. **¿el juez la promueve?** `Grado` tiene cuatro valores y sólo `promueve`
   habilita. Los otros tres no son «casi»: son que no, y se dicen;
2. **¿trae con qué publicarse?** Es el techo del catálogo, medido y ajeno:
   `ConstructionSchema` tiene tres formas —proceso, ley, obra— y ninguna es «una
   habilidad que establece X». Una candidata con plano se publica; una suelta se
   instala, se vuela, cambia el mundo, y el planificador no la puede elegir. Está
   escrito en `Instalada.capacidad` de `@anima/forge` y contado por `sinPublicar`.

Promovida y sin poder publicarse es un resultado legítimo, y callarlo lo haría
ver como un fracaso del juez. Se dice distinto porque es distinto.

### Los predicados de C6, medidos

| # | qué se afirma | dónde |
|---|---|---|
| 1 | la mente pide forjar, con hueco, meta y porqué | `la-fragua-se-despierta` (1) |
| 2 | el mismo hueco no se pide dos veces | (2) |
| 3 | y se lo dice al cuidador por el canal común | (3) |
| 4 | un hueco de materia que este mundo no tiene no sale a pedir nada | (4) |
| 5 | y no toca catálogo, ni recetas, ni física | (5) |
| 6 | con la fragua colgada para siempre, el mundo avanza igual | (6) |
| 7 | el juez rechaza → no se publica, y se dice | (7) |
| 8 | el juez promueve → entra al catálogo **y llega a la mente** | (8) |
| 9 | promovida sin plano → se dice, y no se publica | (9) |
| 10 | sin fragua enchufada, nada de esto pasa | (10) |

### Lo que queda abierto del C6

**La fragua de verdad no está enchufada en la app.** El puerto está y el test lo
usa con una fragua guionada y determinista, que es lo que el documento pide para
el modo scripted. Enchufar la de verdad pide tres cosas que no son de este hito:
un `ApiTS` en el navegador para la puerta, un presupuesto con credencial, y
montar código generado en la pestaña del jugador. Las tres son decisiones de
producto, no de cableado.

**Y el `Registro` de `@anima/forge` sigue sin llamador.** El juego re-arma su
overlay con `conOverlay` desde el core, que es la misma línea que `Registro`
explica y paga el mismo precio (guardar la lista aparte). El día que la fragua de
verdad entre, el `Registro` es el que tiene que llevar las dos mitades —la
habilidad montada y la capacidad publicada— y ahí su invariante empieza a valer.

**Lo aprendido no se guarda todavía.** `Guardado` tiene cinco ranuras y ninguna
es el catálogo de la partida. Una habilidad promovida se pierde al recargar.
