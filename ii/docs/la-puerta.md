# La puerta

`admit()` es lo único que separa a Ánima de un chatbot que se inventa la realidad.

Un proceso propuesto —por el modelo, por el oráculo o por quien sea— no entra a la
física porque suene bien. Entra porque la aritmética cierra. La puerta es la
frontera: de un lado hay texto, del otro hay mundo.

Vive en [`packages/physics/src/admit.ts`](../packages/physics/src/admit.ts), tiene
unas 2.700 líneas y contesta un `Verdict`: `ok`, una lista de **razones** (cada una
cierra la puerta por su cuenta) y una lista de **reparos** (cosas raras que no la
cierran). Corre las cinco reglas **enteras** y devuelve todas las razones juntas, a
propósito: el consumidor del veredicto es la fragua, que tiene que corregir, y un
rechazo por vez la obligaría a N viajes al modelo para arreglar N errores que ya se
conocían en el primero. Y cada razón dice **el número**: «fuera de envolvente» no le
sirve a nadie; «fuelEnergy 5000 contra 45 para `organico`» se puede corregir.

---

## Las cinco reglas, y el ataque que motivó cada una

### Regla 1 — conservación

Nada sale de la nada, y las entradas que cuentan son **solo las consumidas**.

Que una entrada se consuma **no lo escribe quien propone**: se deriva de si la salida
hereda masa de la entrada (`transmute`, `join`, `split`, `drawFromStock`). Ésa era la
bomba de materia de una línea: con un campo `consume: false`, una entrada intacta
contaba como aporte y la masa se duplicaba en bucle.

| Ataque | Qué lo cierra |
|---|---|
| «engordar el tronco»: mover 9 de nutrición de un trocito de 0.1 a un tronco de 100 multiplica la comida por 57 | la conservación compara la magnitud **extensiva** (`q · masa`); sin cota de masa se rechaza por indecidible (`magnitud-intensiva`) |
| «trasvasar la masa»: al origen le alcanzaba garantizar «mayor que cero» para que le sacaran quinientos | `transfer` mira **cantidad**, no presencia |
| «dos bocas comen la misma miga» y «el doble gasto»: cada efecto cerraba clavado, la suma no | **presupuesto acumulado**: lo que entra una vez ya no paga N veces |
| «la piedra-batería por consumo»: escribirle `stamina > 100` al rol de una piedra y comérsela | `entraDe` pasa por `respalda`, que sabe que una piedra no tiene aliento |
| «el río paga dos veces»: el stock pagaba el pescado **y además** 800 de nutrición·masa | los roles de `drawFromStock` salen del presupuesto: lo que el dios da, lo da una vez |
| «el techo no es invariante»: `mass <= 1` en el rol y 100 de masa por la puerta de al lado | `techoEfectivo` = lo que el rol acota **más** lo que el propio proceso le mete |
| «la miga que no pesa» y «pan de masa cero»: `mass <= 0` apagaba la comparación en vez de hacerla imposible | un cuerpo de masa cero no es un cuerpo → `rol-irrealizable` |
| **«comer» no se podía escribir** (falso rechazo) | `esConversionAdmisible`: un `poweredBy` sobre otra cuenta conservada es una conversión, y la regla 1 le pasa el caso a la regla 2 |

La conversión merece su párrafo porque es la única regla que **abre** en vez de
cerrar. Convertir la nutrición de un bocado en aliento es el bucle central del juego y
ninguna ley lo hace —`leyes.ts` no toca `stamina`—, así que tiene que ser un
`Process`. Pero `nutrition` y `stamina` son las dos conservadas y la regla 1 solo
sabía sumar la misma cuenta: «sale 20, entra 0», porque un pescado no garantiza
aliento. Ahora se admite con cuatro condiciones: lo que sube **no es materia**
(`stamina` es la única conservada que ninguna sustancia declara), lo que paga es otra
conservada con eficiencia ≤ 1, el cuerpo que paga está respaldado, y el proceso lo
**consume** — no se convierte lo que no se destruye.

### Regla 2 — nada sube gratis

Bajar es libre. Subir declara de qué cuenta conservada drena y con qué eficiencia ≤ 1.
Sin esto, frotar dos piedras produce calor infinito y el hambre deja de doler en el
tick 300.

| Ataque | Qué lo cierra |
|---|---|
| «espejo térmico», «encender por decreto», «la piedra que irradia»: la regla abría con `if (e.k !== 'drive') continue`, o sea que miraba **un tercio** de los efectos | `reglaAcoplesYTransferencias` |
| «el recargador de aliento»: un rol que pide `stamina >= 50` y un `drive` hacia 50 se leía como «esto baja» | `pisoEfectivo`: el umbral del rol solo vale como piso si el proceso no se lo lleva él mismo |
| «el hielo que calienta» y «filo por decreto»: con `inverse`, cumplir el control de «solo baja» era la condición de subir al máximo — y la cadena `inverse` no aparecía **ni una vez** en el archivo | `techoQueEscribeElAcople` compara contra el **espejo** del piso de lo seguido |
| «mojar la brasa»: mover 200 grados de pedernal (cp 0.75) a agua (cp 4.2) multiplica la energía por casi cinco | el calor específico entra en la cuenta, y **solo cuando se puede afirmar** (ver abajo) |
| «el sifón de calor»: sin `completion`, un `transfer` corre `perTick × ∞` | `transferencia-eterna`, para toda cualidad y no solo para las conservadas |
| «frotar la montaña»: calentar un peñasco de 5000 costaba lo mismo que un guijarro | `masaQuePaga`, que ahora cobra por el **techo** — la cota del peor caso |
| «piedra-batería sin pin»: borrar un test del rol apagaba la defensa | un cuerpo solo puede pagar su propio cambio con lo que la materia trae adentro |
| **«apagar la brasa»** (falso rechazo): llevarla de 300 a 20 se leía como subirla 120 | `pisoParaDireccion`: el piso no se **tira**, se **baja** por lo que el proceso se lleva |

### Regla 3 — envolventes por tag

Algo `organico` no puede tener el poder calorífico del plutonio. Y las envolventes
**no se escriben a mano**: se derivan del catálogo de sustancias, que es el único
lugar donde ese número ya vive. Hacen falta al menos dos muestras: con una sola no hay
envolvente, hay una anécdota, y rechazar contra una anécdota es escribir la tabla a
mano con otro nombre.

### Regla 4 — cierre dimensional, cotas, no-dominancia, realizabilidad

La más ancha, y la que ataja el modo de falla **silencioso**: un proceso que `admit`
deja pasar, que nunca encuentra entradas, y que deja a Ánima tanteando sin que nadie
sepa por qué.

| Ataque | Qué lo cierra |
|---|---|
| «el charlatán»: cero efectos, cero rendimientos, promete alcance 16 y 1999 °C | `reglaPromesas` |
| «darle agarre a la piedra», «inventar calorías»: escribir una cualidad **derivada** | `cualidad-derivada` sobre los cuatro `k` |
| «frotar barato»: la misma técnica con la eficiencia subida a mano | la no-dominancia, «la última puerta del almuerzo gratis» |
| «frotar renombrado» y «pescar a mano»: renombrar **un** rol apagaba esa puerta entera | los roles se cruzan por lo que **piden** cuando los nombres no coinciden |
| «frotar espaciado»: `'temperature >= 400'` con espacios no era `'temperature>=400'` | la regla 4 usa el mismo parser que la regla 5 |
| «frotar con peaje»: 1e-9 de nutrición sobre un rol que no la garantiza compraba 11 de stamina | un drenaje que el rol no respalda no es un costo — lo decía el propio reparo `drenaje-sin-respaldo` |
| «me declaro semilla»: la regla cruzaba dos campos autodeclarados del mismo objeto | `trust: 'estable'` se cruza contra lo único que quien propone no escribe: si la física ya lo tiene sellado |
| «charlatán unicode»: `reach≥16` borraba las promesas de la vista | el parser lee `≥` y `≤` |
| «compuerta estricta»: `q >= 400 && q < 400` daba `lo === hi` y no contaba como contradicción | `cotasEstrictasDeRol` no colapsa `>` en `>=` |
| «friccion + U+200B»: copias exactas ilimitadas, cada una con su nodo en el grafo | una copia exacta es el caso **degenerado** de la dominancia, no una excepción |
| «radio de nada»: `5e-324` pasaba el `<= 0` | el radio se mide en el punto fijo del mundo (`FIXED_SCALE = 1000`): lo que redondea a cero **es** cero |

### Regla 5 — ciclos rentables

Acá hay un hallazgo y cambia lo que esta regla puede honestamente prometer.

Después de las reglas 1 y 2, ningún proceso admitido puede subir una cualidad
conservada, así que el saldo declarado de todo proceso admitido es ≤ 0 y la suma de
cualquier ciclo también. **Salvo por una cosa**: `drawFromStock`, que es el agujero
del dios. Entonces todo ciclo rentable o pasa por un aporte —y ahí el saldo depende
del stock y de la tasa de reposición del bioma, que son estado del mundo y no del
grafo— o no es rentable. Rechazar el primero mataría a `extraccion`, que es pescar,
que es la única forma de comer. Por eso: un ciclo **con aporte** se advierte; uno
**sin aporte** con saldo positivo se rechaza, y es un canario — bajo las reglas 1 y 2
no debería existir nunca.

La regla es **correcta pero incompleta**: si rechaza, el ciclo rinde de verdad en
algún estado del mundo; si no rechaza, puede haber estados en los que rinda igual.
Detectar eso último pide simular, y simular no es lo que hace una puerta.

| Ataque | Qué lo cierra |
|---|---|
| «borrar el `establishes` borra la arista»: quien propone elegía si su proceso se dejaba mirar | el grafo se arma con lo que el proceso **hace** — los `drive`… |
| «el lazo invisible»: …y eso dejaba fuera a `transfer` y `couple`, o sea que un proceso que solo transfiere no tenía ninguna arista de salida | `promesasEfectivas` lee las tres formas de mover el mundo |
| **«panificar»** (falso rechazo): consumir 2000 de nutrición·masa para escribir 1500 se rechazaba por «ciclo rentable» | `saldoDeclarado` resta lo que el proceso consume para acreditar, una vez y no una por efecto; y `habilita` ignora los tests que **todo** cuerpo cumple (`stamina >= 0` no lo habilita nadie) |

---

## El conteo

| | huecos | cerrados | abiertos |
|---|---:|---:|---:|
| Primera vuelta · 3 adversarios, 62 procesos | 39 | 33 | 6 |
| Segunda vuelta · 4 adversarios, 70 procesos | 33 | **30** | 3 |
| **Total** | **72** | **63** | **9** |

En tests: los 33 hallazgos de la segunda vuelta estaban marcados con **34** `it.fails`
—«compuerta estricta» y «rol estricto» son el mismo hallazgo con dos pruebas—, y **31**
pasaron a `it()` normal sin que se les tocara ni una línea del cuerpo. Lo único que
cambió es que ahora pasan.

Se agregó **un** `it.fails` nuevo, y a propósito: la piedra-batería quedó cerrada solo
por la mitad, y la mitad que sigue abierta merece una prueba que grite el día que
alguien la cierre, no un comentario.

498 tests en verde, typecheck limpio, lint limpio.

**Y los cuatro procesos semilla —`friccion`, `union`, `deshilachar`, `extraccion`—
siguen entrando sin una sola razón en contra.** Ésa es la otra mitad del trabajo y
está clavada con tests en cuatro archivos distintos.

---

## Lo que sigue abierto, y qué haría falta

Nueve, y ninguno está tapado con un test débil: cada uno tiene su `it.fails` con el
motivo escrito arriba.

**Los tres de la segunda vuelta**, los tres falsos rechazos que no se pudieron cerrar
sin una decisión de diseño:

1. **`secar-ingenuo`** — un `drive` de humedad hacia 0.05 sobre un rol que no declara
   de dónde baja. La puerta contesta `sube-gratis`, y **tiene razón**: un `drive`
   empuja desde donde esté, y un cuerpo seco a 0 sí se moja hasta 0.05. Se reparó el
   **mensaje**, que ahora dice cómo se corrige. Cerrarlo del todo pide o que
   `Effect.drive` gane una dirección declarada, o que la puerta aprenda que las
   cualidades con `relaxesTo: ambient` se mueven gratis en los dos sentidos dentro del
   rango del ambiente — que es estado del mundo. **ADR.**
2. **`aguzar-la-estaca`** — la regla 3 topa el filo de la madera en 0.45, que es su
   valor **crudo**. Afilar es precisamente la técnica cuyo sentido es pasar el filo que
   la materia trae de fábrica.
3. **`desmenuzar-el-asado`** — la realizabilidad pregunta si existe una **sustancia**
   con `digestibility >= 0.8`, no si puede existir un **cuerpo** así. Consecuencia: la
   escalera de técnicas tiene un solo escalón, porque nada puede pedir lo que el
   proceso de al lado fabrica.

   Los dos últimos son **la misma raíz**: la puerta no tiene noción de *estado
   alcanzable*. Las dos salidas son grandes y las dos son un ADR — o la envolvente de
   una cualidad que alguna técnica mueve deja de ser el techo del material crudo (pero
   «qué mueve una técnica» hoy no está declarado, y derivarlo de los procesos ya
   admitidos haría que el veredicto dependa del orden en que entraron, que es justo lo
   que una puerta determinista no puede hacer), o `Substance` gana un techo
   **trabajado** por cualidad además del crudo.

**Medio abierto, y anotado con su propio `it.fails`:** la piedra-batería vuelve si la
batería vive en **otro rol** (`stamina >= 100`, sin pinchar la materia). La puerta no
sabe que dos roles los puede llenar el mismo cuerpo ni cuál rol es la criatura.
Cerrarlo pide que `Process` diga cuál es el rol de la criatura, o que `admit` reciba
con qué se va a llenar cada rol. **ADR.**

**Los seis de la primera vuelta**, que siguen igual y siguen anotados en
`tests/ataque-materia.test.ts`: dos son de `body.ts` y de `fixed.ts` y no de la puerta;
uno pide una constante de calibración que no existe (cuánta stamina vale un punto de
digestibilidad); uno es «bajar es libre», que está defendido y tiene su propio test
verde; y dos piden una envolvente **conjunta** —una correlación entre pares de
cualidades derivada del catálogo—, que es una regla 3 nueva.

**Y una decisión que hay que tomar explícitamente:** `Effect.couple` no tiene campo
`poweredBy` en `process.ts`, y por eso un acople que puede subir se rechaza siempre. El
día que haga falta un acople que suba, el campo se le agrega al **tipo** en vez de
dejar la puerta abierta.

---

## La tensión, que es de lo que se trata todo esto

> Una puerta que rechaza todo es trivialmente segura y completamente inútil.

Las dos formas de equivocarse **no son simétricas**, y no lo son en la dirección que
uno esperaría de un juez. Dejar pasar de más se endereza después: la puerta se
endurece, el proceso vuelve a juzgarse, el mundo aguanta un rato con una técnica
demasiado barata. No dejar construir **mata el juego**, y lo mata en silencio: la
criatura ejecuta un no-op, la fragua vuelve al modelo con un rechazo que no se puede
corregir, y nadie ve nunca la línea roja porque no hay ninguna.

Esta segunda vuelta lo confirmó con seis casos, y el más caro fue el más obvio en
retrospectiva: **`comer` no se podía escribir**. Todas las reglas funcionaban. La
aritmética era correcta. Y la criatura pescaba y no comía, porque nadie había mirado
el bucle central del juego a través de la puerta que lo tenía que dejar pasar.

Tres cosas quedaron aprendidas, y valen para la próxima regla que alguien escriba acá:

**1. Un rechazo tiene que ser corregible.** «Sube moisture hacia 0.05» manda a la
fragua a buscar un `poweredBy` que no necesita. «Poné un `moisture >= x` en el rol» le
dice qué escribir. La misma decisión, dos costos completamente distintos.

**2. Rechazar por indecidible es honesto solo cuando hay una corrección.** «Poné un
`mass <= x` en el rol» es una instrucción; «la puerta no puede saber de qué está hecho
esto» no lo es. Cuando no hay corrección, la respuesta correcta suele ser un **reparo**
—que se ve, se registra y no cierra nada— y no una razón.

**3. Una cota conservadora de más en cada eslabón se multiplica.** El calor específico
es el ejemplo vivo: la cuenta ya usaba el peor caso de las dos masas (el techo del
destino contra el piso del origen); agregarle el peor caso de los dos calores
específicos cerraba el ataque **y rechazaba `asar`**, que es cocinar. La reparación que
quedó cobra la diferencia **solo cuando se puede afirmar**: cuando los dos roles dicen
de qué están hechos y los dos conjuntos de candidatas están separados, o sea cuando lo
más liviano térmicamente que puede llenar el destino sigue siendo más pesado que lo más
pesado que puede llenar el origen. Si se solapan, existe un mundo donde no hay
diferencia que cobrar, y cobrarla sería inventar un número. Medido contra el catálogo:
el fuego tiene cp ∈ [0.9, 2.8] y la comida cp ∈ [1.9, 3.9] — se solapan, y `asar` pasa;
la brasa mineral (cp ∈ [0.75, 0.8]) contra el agua (cp ∈ [3.9, 4.2]) no se solapa, y la
bomba de calor cae.

Cada regla de `admit.ts` lleva escrito arriba el ataque que la motivó. No es
decoración: dentro de seis meses alguien la va a querer sacar por molesta, y va a
necesitar saber exactamente qué entra si la saca.
