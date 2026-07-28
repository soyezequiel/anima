# II-0013 — El veneno se cobra al tragar

**Estado:** aceptado · **Decide:** el usuario, con la salida a la vista · **Fecha:** 2026-07-28

## El problema

`grep toxicity ii/packages/world/src` devuelve **cero**.

La cualidad existe en el catálogo, la ley 6 de descomposición la **sube**, la ley 5
de cocción la **baja**, `ctx.eat` documenta en su comentario «cuánto enferma
(`toxicity`)» — y el mundo no la cobra en ningún lado. Comer veneno es hoy
exactamente igual de bueno que comer pescado fresco de las mismas calorías.

No es un descubrimiento: está declarado como hueco desde el Hito 4, con estas
palabras, en `skills/src/innatas/comer.ts`:

> `toxicity` NO LA COBRA NADIE. […] La API DOCUMENTA una consecuencia que el
> mundo no implementa, que es el peor tipo de hueco: no hay error de compilación
> ni de ejecución, la habilidad hace lo correcto y el mundo no la premia.

Lo que cambió es que el hueco pasó a estar **en el camino crítico del criterio de
corte del proyecto**. Medido en `mind/tests/hito-5-el-criterio.test.ts`: la
criatura pesca 199 veces y se muere de hambre en el tick 6194 de 20.000,
necesitando 83 pescados. No come ninguno, por dos causas encadenadas — la mente
no tiene por dónde emitir `comer`, y el pescado crudo tiene `toxicity` 0,25
contra la tolerancia 0,20 que `comer` se autoimpone.

Esa tolerancia es **prudencia sin respaldo**: la habilidad se cuida de algo que
el mundo no castiga. Subirla a 0,3 hace que la criatura sobreviva hoy mismo y que
el Hito 5 pase — explotando un hueco que el propio proyecto tiene documentado, y
dejando decorativos el gradiente de comida del catálogo y la ley 5 entera.

## La decisión

**Comer descuenta `stamina` en proporción a `toxicity × masa`, en el mismo lugar
donde ya se acreditan las calorías** (`intencionComer`, en `world/src/step.ts`).

Se cobra **por separado y no neteado** contra lo acreditado. Un solo número que
mezcle «lo que la comida dio» con «lo que el veneno costó» esconde las dos
mitades, y la crónica del mundo dejaría de poder contar por qué la criatura comió
y adelgazó. Van dos anotaciones y dos eventos.

**No hace falta una ley nueva.** Se descartó la ley 13 de intoxicación —la
toxicidad ingerida acumulándose como cualidad del cuerpo y drenando con el
tiempo— porque exige una cualidad nueva en un catálogo que es cerrado a propósito
y una ley más entre las doce, y porque no compra nada que el criterio necesite
hoy. Queda nombrada para el Hito 12+, donde «comer poco de algo malo» contra «un
atracón» sea una decisión que valga la pena distinguir.

## Por qué el catálogo ya sabía la respuesta

El umbral de corte de cada comida —el `K` con el que comerla cruda da exactamente
cero— es `nutrition × digestibility / toxicity`, y **nadie lo escribió**: cae de
tres números que se calibraron por separado.

| sustancia | nutrition | digest. | toxicity | cal/kg | **K de corte** |
|---|---:|---:|---:|---:|---:|
| grasa | 22,0 | 0,70 | 0,05 | 15,40 | **308,00** |
| médula | 18,0 | 0,55 | 0,05 | 9,90 | **198,00** |
| huevo | 11,0 | 0,50 | 0,10 | 5,50 | **55,00** |
| pescado | 8,0 | 0,38 | 0,25 | 3,04 | 12,16 |
| carne | 9,0 | 0,35 | 0,30 | 3,15 | 10,50 |
| savia | 4,0 | 0,65 | 0,25 | 2,60 | 10,40 |
| grano | 13,0 | 0,15 | 0,20 | 1,95 | 9,75 |
| tubérculo | 7,0 | 0,18 | 0,35 | 1,26 | 3,60 |
| molusco | 6,0 | 0,22 | 0,45 | 1,32 | 2,93 |
| hoja | 2,0 | 0,25 | 0,30 | 0,50 | 1,67 |
| hongo | 3,0 | 0,30 | 0,55 | 0,90 | 1,64 |
| raíz dura | 5,0 | 0,12 | 0,40 | 0,60 | 1,50 |

Los tres grupos se separan solos: **grasa, médula y huevo** se comen crudos con
cualquier `K` razonable; **pescado, carne, savia y grano** piden fuego a partir de
`K ≈ 12`; y **todo lo demás es veneno crudo** ya con `K ≈ 4`.

Que los tres seguros crudos sean exactamente lo que un recolector sin fuego
comería —grasa, médula, huevos— es la clase de resultado que el proyecto busca:
una escalera de alimentación que **nadie diseñó**, que sale del cruce de números
que se calibraron para otra cosa.

## La ventana, y por qué esta vez sí hay una

**Cualquier `K` entre 15 y 55** deja crudas las tres seguras y manda todo lo demás
al fuego. Son **3,7×** de ventana.

Se dice explícitamente porque el ADR II-0009 se equivocó justo acá: escribió
«comer crudo negativo y cocinar positivo» mientras calibraba una constante, y esa
promesa resultó un **conjunto vacío** —hacía falta 0,495/s para que cocinar
alcanzara y 0,766/s para que crudo no alcanzara, y los bordes se cruzaban—. La
lección quedó escrita: *cuando un criterio falla, volvé al texto que lo pidió y no
al documento intermedio que lo reformuló.* Acá la ventana se midió **antes** de
elegir el número, y se escribe con sus dos bordes para que se pueda verificar que
no está vacía.

**El valor exacto de `K` se calibra midiendo, no acá.** Lo que este ADR fija es el
criterio que tiene que cumplir, y son tres, los tres verificables:

1. grasa, médula y huevo dan **neto positivo** crudos;
2. pescado y carne dan **neto negativo** crudos;
3. pescado y carne **cocidos** dan neto positivo, y por un margen que pague el
   precio de encender el fuego (medido: 282,17 de `stamina` para una vara de
   0,2 kg, `perceive/tests/ataque-a-la-costura.test.ts`).

Si los tres no se pueden cumplir a la vez, **no se afloja ninguno**: se mide, se
presenta la salida y decide el usuario. Es lo que se hizo cuatro veces en este
proyecto.

## Lo que esto arrastra, dicho entero

- **La mente tiene que aprender a cocinar**, y hoy no sabe: sus metas son
  `holding(tag:X)` y ninguna habla de la cualidad de lo que tiene en la mano. Es
  el tramo que sigue, y es lo que vuelve **carga útil** a la cadena del fuego que
  ya está medida y anda (`world/tests/el-fuego-no-se-propaga.test.ts`).
- **`oracle/tests/presupuesto.test.ts` modela `ingresoCrudo`** como si comer crudo
  funcionara. Toda la cuenta económica —las 100 partidas, la afortunada, la común
  y el carroñero del riesgo 4— hay que rehacerla con el veneno cobrado. Se espera
  que el criterio del riesgo 4 se **refuerce**: el carroñero come lo que hay
  tirado, y lo que hay tirado es justo lo de `K` bajo.
- **Se mueven los hashes** de toda partida donde alguien coma.
- **La tolerancia de `comer` deja de ser prudencia sin respaldo.** El `0,2` por
  omisión pasa a defender de algo real, y el parámetro `toxicidadTolerada` pasa a
  significar lo que su nombre dice: una criatura desesperada puede elegir
  envenenarse, y ahora paga.

## Lo que NO cambia

`admit()` no tiene nada nuevo que juzgar: el cobro es del mundo, no de un proceso.
Y la ley 5 sigue siendo la única que baja `toxicity` — este ADR no toca la física,
toca el **arbitraje** del acto de comer, que es donde ya viven la conversión de
`nutrition` a `stamina` y su evento `convierte`.
