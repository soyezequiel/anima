# II-0024 — El piso del chat no es «sin LLM», es «sin espera»

**Estado:** aceptado · **Decide:** el usuario, antes de arrancar el Hito 6 ·
**Fecha:** 2026-07-31

Es la primera decisión de este remake que **afloja** un criterio escrito, así que
lo primero es decir qué se aflojó y qué se apretó a cambio.

## El problema

El Hito 6 se llamaba **«el chat, sin LLM»** y su criterio pedía **≥80% de 200
frases resueltas sin red**. La pregunta que lo abrió fue directa: *¿qué pasa si
hacemos que no haya un modo de chat sin LLM?*

Contestarla obligó a separar dos cosas que el título tenía pegadas:

| lo que el hito quiere de verdad | cómo lo estaba consiguiendo |
|---|---|
| que el cuerpo se mueva **antes de que termines de leer tu propia frase** | prohibiendo el modelo en todo el camino |
| que el juego ande con la red caída | lo mismo |
| que el CI corra 200 frases sin gastar plata | lo mismo |
| que un journal se pueda repetir | lo mismo |

**Prohibir el modelo garantiza las cuatro, y garantiza de más.** Es una sola
palanca para cuatro problemas distintos, y el precio lo paga el único que no
tiene otra solución: el léxico. Cada paráfrasis que la criatura no entiende hay
que escribirla a mano.

## La medición que decide, y ya estaba en el documento

No hizo falta medir nada nuevo. La tabla de latencia del **caso frío** —cuando la
habilidad no existe y hay que escribirla— ya dice esto:

| etapa | p95 |
|---|---|
| 1-5 · normalizar, `readFast`, resolver, grafo | ~12 ms |
| 7 · emitir el prefijo `nearest`, todo `reversible` | 2 ms — **el cuerpo ya se mueve** |
| 8 · habla: *«voy juntando lo que veo mientras pienso cómo se hace»* | 0 ms |
| **movimiento visible** | **~80 ms** |
| 10 · TTFT con cache caliente | **900 ms** |

**La arquitectura del caso frío ya es exactamente la que hace falta**: se contesta
y se arranca con lo local, y el modelo llega después, tarde, y no bloquea. Lo
único que el Hito 6 hacía distinto era prohibir que existiera una etapa 10.

## La decisión

### 1 · La puerta del hito pasa a ser un invariante de camino

En vez de *≥80% resueltas sin red*, el hito cierra cuando **el proveedor no está
en el camino del acuse ni del primer movimiento**, y eso se afirma con dos
corridas del mismo corpus:

- **proveedor apagado** — las 200 frases dan acuse y primer movimiento, ninguna
  devuelve «nada»;
- **proveedor colgado** —responde a los 30 s, o nunca— **el mismo p95**.

La segunda es la que hace el trabajo. Un porcentaje de comprensión se puede subir
haciendo trampa de mil formas; un p95 que no se mueve cuando el proveedor tarda
treinta segundos sólo se consigue de una: no esperándolo.

### 2 · La cobertura sin red deja de ser puerta y pasa a ser línea base

El `80%` se eligió **antes de tener el corpus**. Hoy nadie sabe si es exigente o
regalado, y un número así o frena el hito por nada o lo deja pasar sin mérito.

Pasa a regirse por la regla que la sección de latencia ya fija para todo lo demás
—*presupuestos, no mediciones*—: la primera corrida fija la línea base y **el
build falla si baja**. La cobertura sigue importando y sigue midiéndose; deja de
ser una cifra inventada.

### 3 · El modelo entra por la confianza, no por defecto

`readFast` **ya devuelve confianza** —está en la descripción del hito desde que se
escribió— así que la puerta ya existe. La consulta se dispara cuando la lectura
local queda por debajo del umbral, y lo hace **después** del acuse y del primer
gesto, nunca antes.

Y hereda la regla de especulación que ya está escrita: se especula sólo con
`reversible`, y **el último paso irreversible espera la confirmación del carril
lento**. O sea que entender mal y arrancar no rompe nada que no se pueda deshacer.

## Lo que NO se rompe, aunque parezca

**El determinismo y el replay.** La crónica pliega **intenciones**, y una
intención ya parseada es dato: lo que se registra es el objetivo que salió de la
lectura, no el texto crudo. Repetir una partida no vuelve a consultar a nadie.

**El criterio del proveedor apagado del Hito 5.** Ése barre los `src/` de los
nueve paquetes buscando `import(` dinámico y no tiene nada que ver con esto: el
modelo vive en `@anima/llm` y se le habla por el borde, igual que en el Hito 8.

**El CI.** Corre con el proveedor apagado, que ahora además es **una de las dos
corridas obligatorias del corpus**. Antes era la única forma de correr; ahora es
media prueba.

## Lo que sí se paga

1. **Costo por mensaje.** El chat es lo que más se usa, y el presupuesto económico
   por sesión del Hito 8 estaba pensado para la fragua, que se usa poco. Hay que
   rehacer ese número contando el chat.
2. **La calidad se parte en dos.** Con red entiende más que sin red, y eso hay que
   poder mostrarlo sin que parezca un bug.
3. **Una tentación nueva.** Con el modelo disponible, la salida barata para cada
   frase que no se entiende es mandarla al modelo en vez de arreglar el léxico. La
   línea base de cobertura existe justamente para que eso se vea.

## Lo que NO se ahorra, y conviene decirlo fuerte

**La tabla de alias de composición sigue habiendo que escribirla.** El aviso
honesto del hito —*«pescar existe como verbo el día que existe el proceso
`extraccion`» es falso*— no cambia ni un poco. El modelo ayuda con la paráfrasis
y la ambigüedad del castellano; no sabe que en **este** mundo *pescar* es extraer
fauna de un cuerpo de agua con un aparejo, porque eso no está en ningún corpus:
está en la física que escribimos nosotros.

Quien crea que esta decisión le ahorra ese trabajo va a llegar al Hito 6 con la
misma deuda y menos semanas.

## La alternativa que se descartó

**Dejar el criterio como estaba.** Se descarta porque el `80%` no defiende lo que
parece defender: se puede cumplir con un chat que tarda dos segundos en contestar,
y se puede incumplir con uno instantáneo que entiende el 79%. Estaba midiendo la
variable equivocada.

**Lo contrario —chat sólo con LLM—** se descarta por el número de arriba: 900 ms
de TTFT contra 150 ms de presupuesto. No es un ajuste, es un orden de magnitud, y
convierte «le hablás y hace» en «le hablás y piensa».

## Enlaces

- [`../../../docs/architecture/remake-anima-ii.md`](../../../docs/architecture/remake-anima-ii.md) — el Hito 6 y las dos tablas de latencia
- [ADR II-0019](II-0019-el-gate-5-6-no-reabre-el-hito-5.md) — el criterio del proveedor apagado, que este ADR no toca

---

## Enmienda · 2026-07-31, el mismo día

**Este ADR se aplicó a medias y hay que decirlo acá, no en otro archivo.**

La decisión de arriba reescribió el `≥80% resueltas sin red` y **dejó intacto el
«corpus de 200 frases»**. Los dos números venían del mismo lugar y sólo uno se
revisó.

**De dónde salía el 200.** De un mundo donde el léxico escrito a mano era el
**único** lector. Sin modelo, la única forma de saber si el sistema entiende
castellano es **enumerar**: doscientos casos con su lectura esperada, y si pasan
180 se declara que entiende. El tamaño del corpus ERA la medida de la cobertura.

Con el modelo permitido eso deja de tener sentido, y por la misma razón por la
que el `80%` la perdió: el corpus dejó de ser un examen de vocabulario. Lo que
tiene que probar ahora es otra cosa, y es más chica en una dimensión y más grande
en otra.

### Lo que el corpus tiene que probar ahora

| antes | ahora |
|---|---|
| **200 frases** con su lectura esperada | **las frases reales que haya**, todas citadas con archivo de origen |
| ≥80% resueltas sin red | la cobertura sin red es **línea base** (ya estaba en § 2) |
| — | **una tercera corrida: proveedor que SÍ contesta**, y la cobertura tiene que SUBIR |

La fila nueva es la que faltaba, y su ausencia dejaba un agujero grande:

> **Los cinco puntos del criterio se cumplen igual con el proveedor
> desconectado.** El punto 2 —«colgado da el mismo p95»— es trivialmente verde si
> el proveedor no existe.

O sea que el criterio, tal como quedó escrito arriba, **mide que el modelo no
estorbe y no mide que sirva**. Es un piso correcto y no es un hito.

### Y la consecuencia sobre el corpus, dicha con el número

Se fue a buscar las 200 y **el criterio original era falso en su premisa**: decía
que salen «del historial de chat del repo actual, que existe», y el historial
tiene **nueve** mensajes, cuatro de los cuales son briefings de un desarrollador.
Lo que sí es verdad, y nadie lo había escrito, es que **los tests de Ánima I son
el corpus**: ~187 frases distintas de cuidador.

**Ninguna se inventa, ni con modelo ni sin él.** Un corpus generado por un modelo
mide el lector contra frases que inventó otro modelo, que es peor que medirlo
contra los tests —esos al menos los escribió una persona— y es exactamente el
vicio que la medición ya encontró: las 128 frases de los tests están en
castellano perfecto y el único usuario de verdad escribió «construi una
ahoguera».

**El modelo entra en el PRODUCTO, no en el dato de prueba.** Es la misma frontera
que el ADR II-0001 traza para las habilidades: el modelo propone, el código local
dispone.

### Y por dónde entra, que era lo que faltaba construir

El § 3 de arriba dice que el modelo entra por la confianza y que la puerta «ya
existe». Existía como NÚMERO y no como HUECO: `readFast` devuelve confianza y no
había forma de enchufarle nada. Eso se construye en el mismo tramo que esta
enmienda, con la única forma que respeta las tres restricciones a la vez —el
acuse sincrónico, la regla 2 sin `await` en `src/`, y el proveedor fuera del
camino—:

**`leer()` devuelve la lectura y, si la confianza es baja, una `Consulta`.** Lo
que pasa con esa consulta es del llamador, que sí puede esperar. Cuando la
respuesta vuelve, `revisar(lectura, respuesta)` produce una lectura nueva.

Es la misma solución que `perceive/src/bucle.ts` usa para el reloj de pared: **la
frontera con el mundo asincrónico es el llamador, no el paquete.**

---

## Segunda enmienda · 2026-07-31, el mismo día

**El corpus se cierra, y la razón es la misma que las otras dos veces.**

La primera enmienda sacó el «200» y lo reemplazó, sin querer, por «las ~187 que
hay en el repo». El usuario lo vio: *«¿para qué hacen falta 110 frases más si ya
tenemos LLM?»*

**No hacen falta.** Y el error es de forma, no de número: al sacar el 200 no
volví a preguntar **para qué sirve el corpus**, así que puse otra cifra en su
lugar. Eso es el mismo pensamiento con otro traje.

### Para qué sirve el corpus, ahora que lo escribí

| antes | ahora |
|---|---|
| probar cobertura de comprensión | eso lo hace el modelo |
| — | **que ninguna entrada deje al lector en blanco** (punto 1) |
| — | **que las tres corridas de p95 comparen lo mismo** (puntos 2 y 3) |

Para las dos que quedan, **la cantidad no importa**. Lo que importa es que estén
las FORMAS, y sumar veinte «traé X» a las 25 que ya hay no prueba nada nuevo.

### Lo único que se agregó, y por qué ésas

Las **formas flacas**: el corpus tenía 2 condicionales y 3 negativas de 77, y son
justamente las difíciles — `Predicado` no tiene dónde poner una condición ni una
prohibición, así que son las que se rompen y las que menos muestra tenían.

Quedó en **82 frases**: condicional 2 → 5, negativa 3 → 4, temporal 4 → 5. Todas
sacadas de barrer el repo con esas formas, ninguna inventada.

**Y la compuesta queda flaca igual, con dos.** No se completó: el repo no tiene
más órdenes compuestas de verdad, y una inventada mediría contra un usuario que
no existe. Está anotado en vez de disimulado.

### La regla que deja, y vale más que el corpus

> Cuando saques un número de un criterio, **volvé a preguntar para qué estaba** —
> no lo reemplaces por otro número.

Pasó tres veces seguidas con el mismo criterio: el `80%`, el `200`, y el `110`.
Las tres veces la corrección la hizo el usuario preguntando lo mismo.
