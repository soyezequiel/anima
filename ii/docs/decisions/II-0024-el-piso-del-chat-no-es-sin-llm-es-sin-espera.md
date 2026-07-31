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
