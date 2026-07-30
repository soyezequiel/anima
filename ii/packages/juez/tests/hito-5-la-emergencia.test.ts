// ═══ EL CRITERIO DE EMERGENCIA, CORRIDO ═════════════════════════════════════
//
// El documento de arquitectura (`docs/architecture/remake-anima-ii.md:~1462`) pide
// esto y no otra cosa:
//
//   «se define ANTES una lista de 10 secuencias objetivo que nadie implementó. En
//    20 partidas con semillas distintas tienen que aparecer al menos 4 de las 10,
//    registradas por UN DETECTOR AUTOMÁTICO DE SECUENCIAS, no por observación.»
//
// La lista está cerrada en `ii/docs/hito-5-las-diez-secuencias.md` y tiene NUEVE
// entradas; el detector es `@anima/juez`, escrito sin ver la mente. Este archivo
// es la corrida: veinte partidas, una criatura con su `Mente`, un mundo decretado
// por el dios, y el juez escuchando tick a tick.
//
// ─── Y EL UMBRAL, QUE ESTABA ABIERTO Y LO DECIDIÓ EL USUARIO ────────────────
//
// El texto pide «4 de las 10» y la lista tiene NUEVE, así que el 4 podía leerse
// como número absoluto (4 de 9, o sea 44%) o como proporción (40% → 3,6 → 3 o 4).
// El traspaso lo dejó anotado como abierto justamente para que no lo ajustara
// nadie por su cuenta. **Decidido: 4 de 9, el absoluto.** Es la lectura más
// exigente de las dos y no le baja el piso al criterio de corte por haber perdido
// una entrada de la lista.
//
// ═══ LO QUE ESTE ARNÉS DECÍA ANTES, Y POR QUÉ ESTABA MAL ════════════════════
//
// Va primero y no en una nota al pie, porque es la vara con la que hay que leer
// todo lo de abajo. La corrida anterior de este mismo archivo publicó esto:
//
//   «(A) EL MUNDO NO MATERIALIZA NADA DE LO QUE EL DIOS SIEMBRA … (E) NO PUEDE
//    HABER FUEGO … el encendible más liviano que existió en las veinte partidas
//    pesa 1,0000 kg contra un techo de 0,7132 … el bloque (4) contesta lo mismo en
//    las nueve: EL MUNDO.»
//
// **Nueve filas de nueve diciendo EL MUNDO, y la mitad era del arnés.** El
// «1,0000 kg» salía en las VEINTE semillas, al cuarto decimal. Veinte semillas
// distintas dando el mismo número no es un sorteo: era esta línea, que este mismo
// archivo escribía a mano tres renglones más arriba de donde medía —
//
//     { body: cuerpo('vara', 'madera', 1), at: { x: p.x + 3, y: p.y } }
//
// — y con ella una liana de 0,2 kg, y nada más. O sea que el arnés armaba una
// escena de tres cuerpos, la medía, y publicaba el resultado como una propiedad
// del mundo. Es la cuarta vez en este proyecto que una conclusión sale de medir el
// catálogo o el arnés en vez del mundo; la anterior dio por muerta la propagación
// del fuego, que sí existe, y la de antes contó despegues y las llamó pescados.
//
// LO QUE EL DIOS DECRETA DE VERDAD, medido en `lo-que-el-mundo-si-siembra.test.ts`
// sobre los mismos 9 chunks de arranque y las mismas veinte semillas de §10:
//
//   semillas con al menos una vara encendible ... 13 de 20
//   la más liviana de las veinte ............... 0,0610 kg  (el techo es 0,7132)
//
// La conclusión de la corrida anterior era correcta SOBRE ESA ESCENA y falsa sobre
// el mundo.
//
// ═══ Y LA PREMISA DE LA CORRECCIÓN TAMBIÉN HABÍA QUE MEDIRLA — Y YA SE REPARÓ ═
//
// El encargo del tramo I decía que los cuerpos sueltos del dios «ya se
// materializan solos» y que alcanzaba con sacar la escena a mano. **No se
// materializaban.** Medido antes de escribir una línea, con una criatura sola en la
// orilla de `20260728n` y cinco ticks de `Partida`: el dios decretó 90 sueltas en
// los 3×3 chunks de alrededor y lo único que apareció fueron tres bancos de peces.
// Cero. Así que el arnés las sembró él mismo y lo dijo con todas las letras: era un
// rodeo, y la reparación era del motor.
//
// **La reparación se hizo en el tramo K** (`world/src/step.ts`,
// `materializarLoDecretado` → `abrirChunk`, y `perceive/src/bucle.ts` copiando de
// la sombra los dos prefijos del dios y no sólo `pozo:`). El arnés dejó de sembrar:
// lo único que sigue plantado a mano es el cuerpo de la criatura, y **todo lo demás
// lo pone el mundo**. Medido en el bloque (1), que pasó de `it.fails` a verde:
//
//     el dios decretó en los 3×3 del arranque ......... 2280
//     `abrirChunk` materializó en el primer paso ...... 2277  (se perdieron 3, el 0,13%)
//     y a lo largo de la partida ...................... 3021  (el chunk se abre cuando alguien llega)
//
// Contra el 4,5% que descartaba la regla vieja del arnés: treinta y cuatro veces
// menos materia perdida, y ya no en una isla de 3×3 rodeada de vacío.
//
// ═══ EL VEREDICTO, ARRIBA Y CON LOS NÚMEROS DE ESTA CORRIDA ═════════════════
//
//   APARECIERON 0 DE 9. El criterio no se cumple, y el número crudo se publica sin
//   tocar un umbral: el criterio pide 4 y §10 ya resolvió antes de correr que con
//   nueve entradas el 4 absoluto y el 40% proporcional caen en el mismo número.
//
//   PERO EL CERO CAMBIÓ DE SIGNIFICADO, y ése es el resultado de estos dos tramos:
//
//   ─── (A) TRES DE LAS NUEVE FILAS MIDEN A LA MENTE, Y LAS SEIS RESTANTES ───
//
//   Con la escena a mano, los NUEVE contra-detectores daban `false` en las veinte
//   partidas: el mundo no le ponía NINGUNO de los nueve problemas delante y las
//   nueve filas contestaban EL MUNDO. Con el mundo que el motor materializa, tres
//   se encienden:
//
//     no-frotar-lo-que-no-alcanza-a-encender   situación en  9/20   → LA MENTE
//     la-vara-mas-liviana-que-igual-cocina     situación en  9/20   → LA MENTE
//     ponerle-punta-al-aparejo                 situación en  8/20   → LA MENTE
//
//   O sea: el mundo SÍ le puso esos tres problemas delante, en ocho o nueve de las
//   veinte partidas, y la criatura no los resolvió ni una vez. Ese cero mide a la
//   mente. Las otras seis siguen sin medirse, y §10 sigue diciendo que con más de
//   tres no-medidas sobre nueve el resultado NO ES INTERPRETABLE.
//
//   ─── EL ASTERISCO QUE ESTA COLUMNA NECESITA, Y ES CARO ────────────────────
//
//   **La columna `situación` se movió tres veces en tres tramos sin que cambiara
//   una sola línea del juez**: 7/20-7/20-5/20 con el arnés sembrando, 8/20-8/20-5/20
//   con la tabla de cocción por montaje, 6/20-6/20-4/20 con el mundo materializando
//   el decreto, y 9/20-9/20-8/20 con el cerrojo del «mientras tanto» de la escalera
//   (`mind/src/escalera.ts`, `mientrasTantoYaHecho`). Es una columna que dice «el
//   mundo puso el problema delante», y sin embargo depende de POR DÓNDE CAMINÓ LA
//   CRIATURA: los contra-detectores se evalúan a Chebyshev ≤ 3 de donde ella está.
//
//   Lo último la subió porque el cerrojo la sacó de un bucle: sin él la criatura
//   gastaba el 98% de sus ticks re-pidiendo el mismo `ir` a un cuerpo que ya tenía
//   al lado, y con él camina —`explorar` pasó de 5 despegues en las veinte a 8250—.
//   Un mundo más recorrido es un mundo que ofrece más situaciones.
//
//   Lo que eso obliga a decir, y va acá y no en una nota al pie: **estos números son
//   de una corrida contra un árbol de trabajo que otro tramo estaba tocando**, y se
//   publican con la huella de lo que se midió (`git hash-object`):
//
//     mind/src/escalera.ts   0935e9268ffc568f52b06d780952c9f280de5d02
//     mind/src/mente.ts      ced6c8657e17f478a36b3b23c098808d1fb52b28
//     world/src/step.ts      eb27705f71e6c6f2a0f90a2020316fd2c99def1c
//     perceive/src/bucle.ts  e5625db562cfe20534fb1e02a1c1cad90dc8fed1
//
//   La primera corrida de este tramo salió con la escalera vieja y publicó
//   6/20-6/20-4/20; se volvió a correr entera. **Una corrida del criterio de corte
//   contra un árbol que se está editando es una corrida que hay que fechar**, y esa
//   es la regla que este párrafo deja escrita.
//
//   ─── (A bis) Y LAS SEIS QUE DICEN «EL MUNDO» NO LO MERECEN, MEDIDO ────────
//
//   Es el hallazgo de este tramo y está en `tests/las-seis-que-dicen-el-mundo
//   .test.ts`, en verde. La casilla EL MUNDO de `causaDe` quiere decir «el mundo
//   nunca puso el problema delante». Sobre el mundo que ahora existe eso es falso
//   en las seis:
//
//     · CINCO cuelgan de que haya fuego, y el control del azar con la fogata
//       regalada —las MISMAS veinte semillas y el MISMO decreto— las enciende:
//       `fuegoYDosPermeabilidades` 20/20, `dosCombustiblesEnIntervalo` 20/20,
//       `parrillaOfrecida` 6/20, `algoSeCocino` 5/20, `loteAlAlcance` 5/20. Su cero
//       no es del mundo: es de los CERO FUEGOS en veinte partidas.
//     · LA SEXTA, `fardoPosible`, es la única que no necesita fuego, y el barrido
//       de las 46.080 celdas de los 3×3 materializados dice que **el mundo ofrecía
//       la cadena en 5 de las 20 partidas, desde 32 celdas, y la más cercana estaba
//       a 5 celdas del arranque** contra un alcance de 3. Dice «la criatura no fue»,
//       no «el mundo no la tiene».
//
//   Nada de esto mueve el cero del criterio: siguen siendo 0 de 9. Lo que mueve es
//   QUÉ SE PUEDE CONCLUIR de ese cero, que es lo que dos tramos vinieron a arreglar.
//
//   ─── (B) SÍ HAY CON QUÉ ENCENDER, Y NO ERA UN PROBLEMA DE LA FÍSICA ───────
//
//   Partidas con algún cuerpo encendible: **20 de 20**. Con uno POR DEBAJO del
//   techo de la fricción: **19 de 20**. El más liviano de las veinte partidas pesa
//   **0,0570 kg** contra los 1,0000 que publicaba el arnés viejo — un factor 17,5.
//   Y las que no tienen NO SE DESCARTAN: se corren igual y la columna se publica,
//   porque filtrarlas sería armar el banco para que dé bien.
//
//   (Y hay que decir por qué 19/20 acá y 13/20 en `lo-que-el-mundo-si-siembra`: no
//   son las mismas veinte semillas. Aquéllas son las de §10; éstas son las que de
//   verdad se juegan, con los trece reemplazos que §10 manda hacer cuando una
//   semilla no tiene orilla. Dos poblaciones distintas, dos números, los dos
//   medidos.)
//
//   ─── (C) EL AZAR SE VOLVIÓ A CORRER, Y BAJÓ DE TRES A UNA Y DE UNA A CERO ─
//
//   Si el arnés cambia de mundo y el control no, la resta entre los dos no mide
//   nada. Así que el control del dado corre sobre **las mismas veinte semillas, el
//   mismo decreto y la misma orilla**, con las dos concesiones de siempre
//   declaradas (fogata regalada, tanque de 40.000). Sobre el mundo que el motor
//   materializa firma **0 de 9**: ni una.
//
//   Firmaba 3 sobre su escena inventada, 1 con el arnés sembrando el decreto, y 0
//   ahora. La que se cayó en este tramo es `el-leno-mas-grande-que-todavia-cocina`,
//   que antes disparaba en 8/20 y ahora **dispara en 0/20 con la situación en
//   20/20**: el mundo le sigue poniendo dos combustibles de masas distintas al lado
//   de la fogata regalada en las veinte, y el dado ya no acierta a quemar el más
//   grande de los dos. No es que el control se debilitó —las concesiones son las
//   mismas y van a su favor—: es que con más de cien cuerpos alrededor en vez de
//   diez, un dado que elige cuerpo uniformemente acierta mucho menos seguido. **Un
//   control que se vuelve más flojo cuando el mundo se vuelve más rico es una
//   propiedad del control y hay que decirla**, porque el piso de cuatro pasa a haber
//   que cruzarlo sobre las NUEVE y eso hace el criterio más duro, no más fácil.
//
//   Y el control es lo ÚNICO de este archivo que no depende de la mente: los dos
//   dados corrieron idénticos en las dos corridas de este tramo —con la escalera
//   vieja y con la nueva—, renglón por renglón. Eso es lo que lo hace un
//   denominador y no otra medición más.
//
//   Y hay que decir lo que el control NO dice, porque la comparación fácil sería
//   falsa: el dado sin fuego vive 18.743 ticks de promedio con un tanque de 1000, y
//   la mente se muere entre el 77 y el 6.198 — pero con un tanque de **310**. Con el
//   tanque igualado en 1000 la mente llega al **66,2%** del presupuesto (bloque 3,
//   las VEINTE partidas, medido con `ANIMA_BANCO=1` al cerrar el tramo L), así que
//   **no es que el dado sobreviva mejor**: el dado se queda quieto y la mente
//   camina.
//
//   ─── (D) LA CRIATURA SIGUE SIN COMER, Y AHORA SE SABE MEJOR POR QUÉ ───────
//
//   Cero bocados en las veinte, con el mundo narrando cero `comio`. El mejor bocado
//   que ofreció algún cuerpo con calorías en cualquier tick vale **−0,0305 de
//   stamina**, y es una COTA SUPERIOR. Con el veneno cobrado (ADR II-0013) lo que
//   hay tirado en la orilla no paga, y rechazarlo es lo que corresponde. Lo que
//   cambió respecto de la corrida anterior es que ahora hay 2.280 cosas sueltas
//   decretadas alrededor y el número sigue siendo negativo: ya no se puede
//   explicar por la pobreza de la escena.
//
//   ─── (E) LA MUERTE TEMPRANA **SÍ** ES PARTE DE LA CAUSA, Y ESTO DECÍA LO ──
//   ─── CONTRARIO ──────────────────────────────────────────────────────────
//
//   Con el tanque canónico se muere en el **18,2%** del presupuesto y el juez dice
//   0 de 9. Con el tanque lleno la criatura llega al **66,2%** y el juez dice
//   **2 de 9**: `no-frotar-lo-que-no-alcanza-a-encender` **4/20** (primera vez en
//   el tick 45) y `comerla-en-el-pico-de-calorias` **4/20** (tick 181). Y la
//   corrida deja de ser no interpretable: **3 sin medir** en vez de 6.
//
//   Este bloque decía «multiplicar por cuatro el tiempo vivido no movió una sola
//   fila», y eso era cierto **sobre las TRES partidas de la muestra corta**. Sobre
//   las veinte es falso, y lo dice la salida del propio arnés desde siempre —«⇒ el
//   tiempo vivido SÍ mueve la aguja»—: nadie la había leído porque nadie había
//   corrido este archivo con `ANIMA_BANCO=1`. Verificado al cerrar el tramo L en
//   DOS corridas, la del árbol de HEAD y la del tramo L, **renglón por renglón
//   idénticas**: no es un efecto de la poda, es lo que siempre midió.
//
//   Lo que esto cambia, y no es poco: con el fuego encendido la mente **sí** produce
//   dos de las nueve secuencias que nadie implementó. Lo que la mata en la corrida
//   canónica es el tanque de 310, o sea la ARITMÉTICA de la cocción — la misma que
//   ya es el punto 1 de lo que está abierto. Las dos filas que aparecen son
//   justamente las dos que necesitan un fuego prendido para existir.
//
//   ─── Y EL 81,0% QUE ESTO DECÍA ERA DE TRES PARTIDAS, NO DE VEINTE ─────────
//
//   Corregido al cerrar el tramo L, con `ANIMA_BANCO=1` puesto: el control sobre
//   las VEINTE vive 264.776 de 400.000 ticks = **66,194%**, y sobre el árbol de
//   antes de la poda 261.352 = 65,338%. El 81,0% publicado salía de las TRES
//   partidas de la muestra corta y viajó a este encabezado y al traspaso como si
//   fuera el del banco. De ese 81,0% salía además el `> 0,9` que este bloque
//   afirmaba, y que **nunca pasó con `ANIMA_BANCO=1`** (ver el bloque 3).
//   → **REGLA: un porcentaje de la muestra corta no se cita como el del banco, y
//     una aserción detrás de un `env` hay que correrla con el `env` puesto.**
//
//   ─── (F) Y EL MUNDO SOBRE EL QUE SE MIDIÓ **YA NO** ES LEGAL, Y AHORA MUCHO ─
//
//   **31.833 estados ilegales en 7 de las 20 partidas**, sobre 72.965 ticks
//   auditados con `revisarEstado`, contra los 12 en 1 de la corrida del tramo J. Es
//   el **43,6% de los ticks sobre los que se midió el criterio**, y no se suaviza:
//   va acá arriba, en la salida del bloque de auditoría, y con su `it.fails`.
//
//   ─── Y EL TRAMO L SE LLEVÓ UNA DE LAS DOS CLASES ENTERA ──────────────────
//
//   Los números de arriba son los del tramo L; los del K bis eran **47.091 en 10 de
//   20 sobre 81.932 ticks** con DOS clases. Con la poda de `@anima/plan` quedó UNA:
//   `inventario-inconsistente`, en 7 partidas (20260728, 20260729, 20260730,
//   20260752, 20260772, 20260792 y 20260747). **`solidos-solapados` no encabeza
//   ninguna**, y no porque se haya arreglado nada del pozo: la criatura deja de
//   perder ticks en un `ir` ya dado, camina antes, y las dos partidas que lo
//   encabezaban (20260768 y 20260769) mueren ahora por otro lado. El agujero del
//   pozo sigue abierto y su `it.fails` sigue pinándolo en un tick sin escena.
//
//   Lo que sigue abajo describe la corrida del K bis, y se deja porque el mecanismo
//   de las dos clases no cambió. La cuenta va por PARTIDA
//   y no por clase, porque el informe publica la primera violación de cada partida
//   y no el histograma —contar por clase pediría cambiar lo que el arnés guarda, y
//   un número que no se midió no se escribe—:
//
//     OCHO partidas (SIETE en el tramo L) encabezadas por `inventario-inconsistente` «ana/ana-cuerpo: se
//     lleva a sí misma», desde un tick temprano (20260752 arranca en el 40) y hasta
//     el final: 5924, 3708, 6069, 6026, 3789, 4693, 4434 y 9 ticks. Es el agujero de
//     `juntar` de siempre, y lo que cambió no es el agujero: es que ahora se pisa
//     todo el tiempo. Con el cerrojo del «mientras tanto» la escalera dejó de
//     repetir un `ir` y pasó a `juntar` **8.195 veces** en las veinte — y `juntar`
//     acepta el cuerpo de la propia criatura como candidato.
//
//     DOS partidas encabezadas por `solidos-solapados`: «pozo:3:-6 y suelta:3:-6:14»
//     (20260768, 81 ticks) y «pozo:-6:0 y suelta:-6:0:6» (20260769, 12.358 ticks
//     sobre 6.198 de partida, o sea DOS por tick: ahí conviven las dos clases).
//
//   **EL AGUJERO DEL POZO DEJÓ DE SER HIPOTÉTICO Y AHORA SE DISPARA SOLO.** Es el
//   mismo que el `it.fails` de más abajo tiene pinado desde el tramo I:
//   `materializarLoDecretado` pone el banco de peces con `ponerCuerpo` y sin
//   preguntarle a `estorbo`. Lo que cambió es quién le pone algo debajo: antes era
//   la `vara` que el arnés dejaba a tres celdas, y con el arnés fuera el bloque daba
//   cero y su comentario decía que el decreto «no siembra sobre agua». **Eso era
//   falso y ahora está medido**: en 2 de las 20 semillas el decreto pone una suelta
//   en la celda del pozo, `abrirChunk` la materializa donde el dios dijo —el pozo
//   todavía no está— y un tick después el pozo se le sienta encima.
//
//   El orden «las sueltas ANTES del pozo» de `materializarLoDecretado` está elegido
//   a propósito y con su porqué escrito (que la suelta no se corra de la celda que
//   el dios le dio), y este número es su precio: la suelta no se corre, y el
//   solapamiento lo pone el pozo. Las dos mitades del intercambio están ahora
//   medidas y ninguna se escondió.
//
//   Lo de `juntar` es el mismo agujero de siempre y no es del planificador: la
//   innata filtra por `!enLaMano`, `heldBy === undefined` y `portable >= 1`
//   (`skills/src/innatas/juntar.ts:60`) y **el cuerpo de la propia criatura pasa los
//   tres**. El mundo tampoco la frena: `intencionTomar` chequea cinco cosas y
//   ninguna es «no te levantes a vos misma». Reproducido en UN tick y sin escena, en
//   el `it.fails` de abajo. Lo que cambió es la FRECUENCIA, y eso lo trajo un
//   arreglo de la mente: un agujero que se pisaba en una partida de veinte ahora se
//   pisa en ocho. **Un arreglo correcto río arriba puede multiplicar por mil un
//   agujero río abajo**, y por eso el arnés de invariantes tiene que correr en el
//   banco del criterio y no sólo en su propio test.
//
//   Y lo que eso le hace al resto del informe, dicho y no escondido: **el 0 de 9 de
//   esta corrida está medido sobre veinte partidas de las cuales DIEZ tuvieron
//   estados ilegales, y sobre el 57,5% de los ticks**. Ninguna de las nueve firmas
//   depende de un inventario ni de que dos sólidos compartan celda —el pozo y la
//   suelta siguen siendo dos cuerpos con sus cualidades— así que no hay motivo para
//   pensar que mueva una fila, pero eso es un argumento y no una medición, y va
//   escrito como argumento. Con este porcentaje el argumento ya no alcanza: el
//   número que hace falta es «el criterio corrido sobre un mundo legal», y ése no
//   existe hasta que se cierre `juntar`.
//
//   ─── (G) LO QUE SÍ CAMBIÓ DE FONDO: **LA MENTE FROTA, Y NO PRENDE** ────────
//
//   No está en ninguna de las nueve filas: la tabla de vuelos tiene **tres
//   `frotar`**, en tres partidas distintas. La cadena del fuego dejó de ser
//   inalcanzable para el planificador. Y sigue habiendo **CERO fuegos**: ninguna de
//   las tres fricciones encendió nada.
//
//   MEDIDO PARTIDA POR PARTIDA, con las veinte corridas de nuevo contando `frotar` por
//   semilla, y sale una correspondencia exacta:
//
//     20260768  frotó en el tick 51  →  murió en el 80
//     20260739  frotó en el tick 55  →  murió en el 82
//     20260788  frotó en el tick 58  →  murió en el 81
//     las otras diecisiete: cero frotares, murieron entre el 3.719 y el 6.198
//
//   **Las tres que frotan son exactamente las tres que se mueren antes del tick
//   100**, y se mueren entre 23 y 29 ticks después de frotar. Frotar les vació el
//   tanque de 310 de una sentada. Ninguna otra partida se muere antes del 3.719: la
//   separación entre los dos grupos es de un factor 45.
//
//   POR QUÉ, MEDIDO CON `stepWorld` Y NO DESPEJADO (una criatura, dos varas de
//   madera, `apply(friccion)` hasta que prende o hasta que el tanque se vacía):
//
//     tanque   yesca más grande que PRENDE      qué pasa con la que no
//        310            0,2216 kg  (66,61 P)    0,3507 kg topa en 196,11 °C y muere
//       1000            0,7132 kg (214,39 P)    prende todo el rango
//
//   Y la yesca MÁS CHICA que la tabla de cocción acepta —la punta de abajo de la
//   ventana del contacto, 105,4167 de potencia— pesa **0,3507 kg**. O sea que con el
//   tanque canónico de 310 hay un factor **1,58×** entre lo que la cocina pide y lo
//   que el aliento paga: la criatura frota lo que el plan le dice, gasta los 310
//   enteros, la vara queda a 196 °C de los 300 que necesita, y se muere.
//
//   La cuenta del planificador es correcta y su techo también, y ahí está el detalle:
//   `TECHO_DE_YESCA` vale 0,9 y su propio comentario dice de dónde sale — «con el
//   techo de `stamina` del catálogo (**1000**), la eficiencia 0,35 y el salto de 385
//   grados, el techo exacto es 0,909091». El mismo comentario ya avisaba que «el
//   tanque nunca está lleno cuando hay hambre» y redondeaba para abajo por eso; lo que
//   no se puede arreglar redondeando es un factor tres. Con el tanque de la corrida
//   canónica el techo sería 310 × 0,35 / 285 = 0,3807 de `heatCapacity`, o sea 0,2239
//   kg de madera — y medido: 0,2216 prende y 0,2500 ya no.
//
//   O sea que lo que falta es que la yesca se elija contra el aliento QUE HAY y no
//   contra el tanque lleno. Es un hallazgo para el planificador y para la mente, no
//   para el juez, y por eso acá sólo queda medido.
//
//   ─── (H) Y LA PREGUNTA DE ESTE TRAMO: ¿LA PARRILLA SE VOLVIÓ OBLIGATORIA? ──
//
//   **NO. Medido, y da lo contrario de lo que este tramo esperaba.** El camino
//   principal no pasa por la parrilla: pasa por el CONTACTO. Corrido en
//   `plan/tests/la-cocina.test.ts`, el plan sin fuego a la vista termina en **un
//   solo** `poner(lo-que-hice sobre rama)` —el pescado directamente sobre la brasa—
//   y no en dos.
//
//   Las dos ventanas de la tabla nueva, leídas de `GEOMETRIAS_DE_LA_COCCION`, contra
//   los 204,1667 de potencia que el detector 9 pide para que el contacto arruine la
//   pieza (`temperaturaDeEquilibrio(P, 0, 'contacto') >= ignitionPoint` del pescado,
//   que son 260 °C):
//
//     fila       potencia              masa de madera        ¿la puede encender?
//     contacto  [105,42 ; 170,83)     [0,3507 ; 0,5683)     sí con 1000, NO con 310
//     parrilla  [253,00 ; 410,00)     [0,8417 ; 1,3639)     NO: la yesca pide
//                                                           heatCapacity 1,3466 y el
//                                                           techo de frotar es 0,9
//
//   De donde salen las dos mitades de la respuesta, y son distintas:
//
//   1· **La parrilla NO es lo único que cocina, y la fila que la usa es la única que
//      la criatura no puede encender.** La ventana del contacto entera —hasta 146,43
//      de potencia con la yesca más grande que el plan pide, o sea 190,71 °C en
//      contacto— queda **por debajo** de los 260 del pescado. Con el fuego que el
//      plan enciende, apoyar la comida encima no la arruina: la cocina. Así que el
//      contra-detector `parrillaOfrecida` **no se enciende nunca por el camino
//      principal**, y la fila 9 no pasa a medir «que el camino principal funciona».
//
//   2· **PERO cuando el fuego lo trae el mundo y es grande, el planificador la hace
//      solo.** Con una fogata regalada de `emitsPower` 300 —adentro de [253 ; 410) y
//      arriba de los 204,17— el plan sale `poner(piedra sobre fogata)` +
//      `poner(lo-que-hice sobre piedra)`: los pasos 2 y 3 de la entrada 9 del
//      documento, en orden, compilados. En ese régimen la fila 9 deja de medir
//      emergencia.
//
//   O sea que la 9 se partió en CUATRO regímenes por potencia del fuego, y los tres
//   umbrales están medidos con `temperaturaDeEquilibrio` y el `ignitionPoint` del
//   pescado (260 °C), no despejados a mano:
//
//     < 204,17         el contacto todavía cocina → no hay nada que elegir y la
//                      situación no existe (`parrillaOfrecida` da false).
//     [204,17 ; 253)   situación SÍ · la parrilla cocina · el planificador NO tiene
//                      fila → **mide a la mente de verdad**. Y es justo donde cae el
//                      techo de lo que la fricción enciende con el tanque lleno
//                      (0,7132 kg → 214,39).
//     [253 ; 410)      situación SÍ · la parrilla cocina · el planificador la resuelve
//                      por construcción → **NO mide emergencia**. Son 0,84 a 1,36 kg
//                      de madera ardiendo: fuego que la criatura no puede encender
//                      frotando, o sea regalado o de cadena (la entrada 7).
//     [410 ; 490)      situación SÍ · la parrilla cocina · ninguna fila de la tabla →
//                      mide a la mente.
//     >= 490           la parrilla TAMBIÉN pasa los 260 EN RÉGIMEN, así que ningún
//                      montaje deja la pieza cocinándose donde la dejaron: sólo cocina
//                      de paso, mientras sube. La 9 podría disparar en tránsito, y por
//                      eso este renglón dice «en régimen» y no «no se puede».
//
//   Y el control del dado toca justamente ese último renglón: su fogata regalada es
//   de 2,5 kg —751,5 de potencia— y firma `parrillaOfrecida` en 6 de 20 partidas con
//   `apareció` 0/20. Lo que eso NO prueba es de quién es ese cero: con esa potencia
//   la parrilla queda en 390,75 °C, así que ni la parrilla sirve, y además es un dado.
//   Se publica porque muestra que **el contra-detector 9 es alcanzable en cuanto hay
//   un fuego** —6/20 contra 0/20 acá—, y eso ya dice que el 0/20 de la mente es un
//   cero de «no hubo fuego» y no de «el mundo no lo ofrece».
//
//   En esta corrida de la MENTE el régimen del medio no se tocó ni una vez:
//   `parrillaOfrecida` da 0/20 porque **no hubo un solo fuego**, así que la fila 9
//   sigue siendo NO MEDIDA y nada de esto la movió todavía. Pero va escrito ahora y
//   no cuando pase, porque el día que la criatura encienda algo de 0,84 kg —que es la
//   entrada 7, el fardo— la 9 se dispara sin que nadie haya aprendido nada.
//
//   Y CON QUÉ REGLA SE DISCUTE, que es lo que hace que esto no sea una opinión: §1
//   REGLA 3 no dice sólo «nadie la implementó», dice además —y es el filo que le
//   agregó la tanda dos— **«tampoco vale si la mente que se va a construir la tiene
//   escrita en su diseño»**, con el ejemplo de una fila de la tabla D0. La fila de la
//   parrilla es literalmente una fila de una tabla del planificador. Y el «ángulo de
//   decisión» que §4 le puso a la entrada 9 es, palabra por palabra, **«elegir el
//   montaje, no el lugar»**: exactamente lo que `GEOMETRIAS_DE_LA_COCCION` barre.
//
//   El matiz que juega para el otro lado y hay que decirlo igual: **nadie escribió
//   «parrilla» en esa tabla**. Sale de barrer los tres `MONTAJES` del motor por tres
//   distancias y quedarse con las que se pueden armar; el descarte de las siete que
//   no entran está en `GEOMETRIAS_DESCARTADAS` con su motivo. O sea que la técnica
//   emergió, pero emergió en el planificador y no en la criatura — y el criterio del
//   Hito 5 mide a la criatura.
//
//   **LO QUE HAY QUE DECIDIR, Y NO SE DECIDE ACÁ.** Tres opciones, con su precio:
//
//     (i)  dejarla como está y publicar la advertencia. Barato y honesto, pero el
//          primer disparo de la 9 va a ser indistinguible de una emergencia y alguien
//          lo va a contar como cuarta fila.
//     (ii) sacarla de las nueve y bajar la lista a ocho, como se sacaron las de §5.
//          El encabezado de `src/secuencias.ts` dice que la lista está CERRADA y que
//          si se pudiera ajustar después de ver qué hace la criatura mediría al que la
//          ajustó — pero acá lo que cambió no es lo que hace la criatura: es que el
//          planificador aprendió a hacerla. Igual mueve el denominador del criterio y
//          eso lo decide el usuario.
//     (iii) partir la fila en dos por régimen: «la hizo con un fuego que la tabla
//          resuelve» (no cuenta) y «la hizo con un fuego de [204,17 ; 253) o de
//          >= 410» (cuenta). Es lo que mide de verdad y es un detector nuevo —el
//          contra-detector ya tiene la potencia del fuego a mano—, pero es cambiarle
//          el detector a una entrada de la lista cerrada, que §5 ya hizo una vez
//          (✗3) y con fundamento escrito.
//
//   No se aplicó ninguna. El umbral tampoco se tocó: con K = 0 la disyuntiva sigue
//   siendo académica.
//
// ═══ QUÉ SE PUBLICA, QUE ES LO QUE §10 MANDA ════════════════════════════════
//
// Las nueve filas con sus tres cifras (apareció en N/20 · la situación existió en
// M/20 · no medida en 20−M), el tick de la primera aparición de cada una, la lista
// de semillas con sus reemplazos, el tanque de arranque, `PHYSICS_VERSION` y el
// hash de cada partida. Lo que §10 pide y esta corrida NO puede publicar —la masa
// del cuerpo elegido en cada disparo de las entradas 2 y 8, y si el fuego de cada
// disparo era de vara sola o de cadena— no se publica porque **no hubo un solo
// disparo ni un solo fuego**, y eso está dicho en la salida en vez de omitido.
//
// ═══ EL UMBRAL: NO SE TOCA ACÁ ══════════════════════════════════════════════
//
// El criterio publicado es «al menos 4», y §10 del documento ya resolvió cómo se
// lee con nueve entradas en vez de diez: el 4 absoluto y el 40% proporcional
// (3,6 → 4) caen en el mismo número, así que no hay nada que elegir. Este archivo
// **no ajusta nada**: reporta el número crudo —aparecieron K de 9— y deja la
// discusión escrita. Con K = 0 la disyuntiva es académica de todos modos.
//
// ═══ CÓMO SE MIDE ACÁ ═══════════════════════════════════════════════════════
//
// Todo lo de este archivo es DETERMINISTA: no se mide un milisegundo que decida
// nada, así que el `ANIMA_BANCO` de abajo no está por flakiness sino por COSTO —el
// control con el tanque lleno son 400.000 ticks de mundo con una mente encima—.
// Se imprime siempre y se afirma sólo midiendo en serio, con una corrida corta que
// sí afirma siempre, que es el patrón que `world/tests/banco-el-tick.test.ts:165`
// dejó escrito. Lo que NO se gatilla es el banco del criterio: es el criterio de
// corte del proyecto, y un criterio que sólo corre si alguien se acuerda de
// exportar una variable de entorno no es un criterio.
//
// Y lo que no se cumple no se ablanda: va en `it.fails` con la salida medida al
// lado, que es el idioma con el que este repositorio ya dejó abiertos el techo del
// tick, los diez huecos de `admit()` y el criterio (2) del Hito 5.

import { describe, expect, it } from 'vitest'

import {
  buildSeedPhysics,
  cumpleRol,
  EXTRACCION,
  HZ_DE_REFERENCIA,
  PHYSICS_VERSION,
  qualityOf,
} from '@anima/physics'
import type { Body } from '@anima/physics'
import {
  COSTO_POR_TOXICIDAD_Y_KILO,
  crearDios,
  decretoDe,
  describir,
  hashWorldState,
  mapaDeCuerpos,
  revisarEstado,
  STAMINA_POR_CALORIA,
  stepWorld,
  take,
} from '@anima/world'
import type { Placement, Violacion } from '@anima/world'
import { Partida } from '@anima/perceive'
import { Creencias, Mente } from '@anima/mind'

import { Detector, potenciaSiArdiera, resumir, ROL_A_DE_FRICCION, SECUENCIAS, TECHO_DE_LA_FRICCION } from '../src/index.js'
import type { FilaDelBanco, NombreDeSecuencia, Situaciones, Veredicto } from '../src/index.js'
import { ruidoDelAzar, tablaDelControl, correrElControl } from './azar.js'
// LA REPRODUCCIÓN MÍNIMA del agujero de `juntar` va sobre el mundito de `banco.ts`
// —dos cuerpos y un tick— y no sobre la escena decretada: un agujero que necesita
// una semilla afortunada para verse se pierde en cuanto la escena cambia, y este
// archivo ya perdió uno así. Los nombres se aliasan porque `el-mundo-decretado.ts`
// tiene su propio `cuerpo`/`criatura`/`actor` con otra firma.
import { actor as actorDeBanco, criatura as criaturaDeBanco, EN, enElPiso, mundo } from './banco.js'
import {
  cuerpo,
  escenaDe,
  firmaDeSueltas,
  laOrilla,
  PARTIDAS,
  RADIO_EN_CHUNKS,
  respirar,
  SEMILLA_BASE,
  SEMILLA_DE_REEMPLAZO,
  semillasQueSeJuegan,
} from './el-mundo-decretado.js'

/** Ver el encabezado: acá el gatillo es el COSTO y no la varianza. */
const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'

/** §10: 20.000 ticks a 20 Hz = 1000 s de mundo, la ventana con la que está medida la economía. */
const TICKS = 20_000

/**
 * EL TANQUE DE ARRANQUE, publicado como §3 exige («el tanque de arranque decide
 * si el criterio se puede medir»).
 *
 * 310 y no 1000, y el motivo es de la mente y no del juez: con el tanque lleno
 * `energia` vale 0,0025 y D3 no elige comida, así que la criatura ni siquiera va
 * al río (`mind/tests/hito-5-el-criterio.test.ts`, la escena del documento). 310
 * es el número con el que la cadena de la caña sale sola, o sea el único con el
 * que el Hito 5 tiene una corrida canónica. El otro se corre igual, como control.
 */
const TANQUE = 310

/** El control de §3: el tanque entero. Es el que separa «no llega» de «no vivió». */
const TANQUE_LLENO = 1000

/** Cuántas partidas del control se corren cuando NO se está midiendo en serio. */
const PARTIDAS_CORTAS = 3

/**
 * Y los TICKS del muestreo, que es donde estaba el costo de verdad.
 *
 * Acortar de 20 partidas a 3 sin tocar los ticks dejaba 60.000 ticks: medido,
 * el archivo seguía tardando 592 s. El costo no está en cuántas partidas hay
 * sino en cuántos ticks se corren, y por eso las dos cosas se acortan juntas.
 *
 * 2.000 ticks son 100 segundos de mundo: alcanza para que la cadena de la caña
 * ocurra entera —el pescado entra a la mano en el tick 109— y para que los
 * detectores tengan de dónde disparar. Lo que NO alcanza es para el veredicto,
 * y por eso el veredicto sale de `ANIMA_BANCO=1`.
 */
const TICKS_CORTOS = 2_000

// ─── El arnés: la escena la decreta el dios, y acá sólo se corre ─────────────
//
// LO QUE ESTE BLOQUE TENÍA ANTES, y por qué se fue: armaba a mano la orilla, la
// criatura, una `vara` de madera de 1 kg a tres celdas y un `matorral` de liana de
// 0,2 kg a dos y media. Ochenta líneas de escena inventada, y la corrida entera
// medía esa escena. De ahí salió el «encendible vara 1.0000 kg» de las veinte
// semillas — ver el encabezado.
//
// Ahora la escena vive en `el-mundo-decretado.ts`, la comparten el banco y su
// control, y **todo lo que hay en el piso sale de `decretoDe`**. Lo único que este
// arnés sigue plantando es el cuerpo de la criatura, con su porqué escrito allá.

// ─── La corrida de una partida ───────────────────────────────────────────────

interface Corrida {
  readonly semilla: bigint
  readonly cx: number
  readonly cy: number
  readonly parada: Placement
  /** Ticks que avanzó el mundo. Se CORTA en la muerte: ver el encabezado del bucle. */
  readonly ticks: number
  /** El tick en que la criatura se fue de `state.actors`, o `-1` si llegó viva. */
  readonly murioEn: number
  readonly alientoFinal: number
  readonly veredicto: Veredicto
  /** Los nueve contra-detectores de ESTA partida, para poder decir CUÁL faltó. */
  readonly situaciones: Situaciones
  /** Qué habilidades despegaron y cuántas veces. El denominador de todo diagnóstico. */
  readonly vuelos: ReadonlyMap<string, number>
  /**
   * CUERPOS QUE NACIERON DE UN PROCESO, y cuántos de ellos tenían calorías.
   *
   * ─── POR QUÉ ESTA COLUMNA REEMPLAZA A «pescas», y no es un detalle ─────────
   *
   * La corrida anterior publicaba `pescas` contando DESPEGUES de
   * `aplicar(extraccion)`, y el proyecto entero leyó ese número como pescados:
   * «pescó 199 y le faltaban 83» (`mind/tests/hito-5-el-criterio.test.ts`).
   * Medido acá, en la misma semilla: 198 extracciones COMPLETAS y **dos cuerpos
   * comestibles nacidos en toda la partida**. Un despegue no es un proceso
   * completo y un proceso completo no es una pieza: el que rinde es el dado del
   * mundo contra el `catch` del aparejo, y el pozo tiene `capacity: 1`.
   */
  readonly nacidos: number
  readonly comestibles: number
  /** Procesos `extraccion` COMPLETOS. Ni despegues ni piezas: lo del medio. */
  readonly extraccionesCompletas: number
  /** Lo que el MUNDO narró de comer, que es la única verdad sobre bocados. */
  readonly comio: number
  readonly enveneno: number
  /**
   * EL MEJOR BOCADO QUE EL MUNDO OFRECIÓ ALGUNA VEZ, en stamina neta.
   *
   * `calories · STAMINA_POR_CALORIA − toxicity · masa · COSTO_POR_TOXICIDAD_Y_KILO`,
   * o sea las dos mitades de `intencionComer` (ADR II-0013) con las dos constantes
   * IMPORTADAS del motor y no copiadas. Se calcula sobre todo cuerpo con calorías
   * que no sea una criatura, en todos los ticks.
   *
   * Es una COTA SUPERIOR y a propósito: la mente topa lo acreditado contra lo que
   * todavía entra en el tanque y acá no se topa nada. Si hasta la cota es
   * negativa, no hubo un solo bocado que valiera la pena en toda la partida.
   */
  readonly mejorNeto: number | undefined
  /**
   * EL CUERPO ENCENDIBLE MÁS LIVIANO QUE EXISTIÓ, en cualquier tick.
   *
   * «Encendible» es la misma pregunta que hace el juez para los detectores 1 y 2:
   * cumple el rol `a` de `friccion` Y entregaría potencia si ardiera. Es el número
   * que decide si en esta partida podía haber fuego, porque frotar se paga del
   * tanque y el techo medido es `TECHO_DE_LA_FRICCION`.
   */
  readonly encendible: { readonly id: string; readonly masa: number } | undefined
  /** Cuántas cosas sueltas decretó el dios en los 3×3 chunks alrededor de la parada. */
  readonly sueltasDecretadas: number
  /**
   * Cuántas de esas pudo sembrar el arnés. La diferencia son las que el decreto
   * puso en una celda ya ocupada, que la ley 8 no admite: ver `escenaDe`.
   */
  readonly sueltasSembradas: number
  /** Y cuántos cuerpos puso el mundo por su cuenta: ni sembrados, ni pozo, ni nacidos. */
  readonly cuerposDelMundo: number
  /**
   * LA FIRMA DEL MUNDO que le tocó a esta partida: dónde está la orilla y qué
   * sembró el dios en los 3×3 chunks de alrededor. Es lo que hace verificable la
   * premisa del banco —«veinte partidas con semillas distintas»— sin creerle a la
   * semilla: dos semillas distintas con la misma firma son una partida repetida.
   */
  readonly firma: string
  readonly hash: string
  /**
   * LOS ESTADOS ILEGALES QUE EL ARNÉS VIO EN ESTA PARTIDA.
   *
   * Es la otra mitad de que un cero signifique algo. Un «0 de 9 secuencias» sobre
   * un mundo que nadie auditó no distingue «no emergió nada» de «el mundo estaba
   * roto y nadie miró»: hasta este tramo, `revisarEstado` no lo llamaba una sola
   * línea de `ii/` fuera de su propio test.
   */
  readonly violaciones: readonly { readonly tick: number; readonly v: Violacion }[]
}

/**
 * UNA PARTIDA. El bucle es el de producción con UNA diferencia declarada.
 *
 * `vivir(p, mentes, 1)` es lo que corre en `@anima/mind`, y adentro hace
 * `m.pensar(p)` y después `p.avanzar(1)`. Acá se llama a `p.tick()` en vez de a
 * `p.avanzar(1)` por una sola razón: **`avanzar` se come los `SimEvent`** —los
 * devuelve `tick()` y `avanzar` los descarta (`perceive/src/bucle.ts:420-451`)— y
 * el juez come `{ state, events }` por tick. Sin reloj de pared las dos son la
 * MISMA función: `avanzar` sin `#reloj` es `for (…) this.tick()`, y ese `if` está
 * en la primera línea del bucle. Lo que se pierde es la contabilidad de
 * `ticksPerdidos`, que es del criterio (4) y no de éste.
 *
 * **SE CORTA EN LA MUERTE**, y es lo que el informe necesita para separar «la
 * mente no llega» de «no vivió lo suficiente»: seguir corriendo un mundo sin
 * criatura agrega ticks al denominador y ni una decisión al numerador.
 */
function correrPartida(semilla: bigint, tanque: number, tope: number): Corrida | undefined {
  const o = laOrilla(semilla)
  if (o === undefined) return undefined

  // `vigilar: true`: las cinco preguntas que un estado contesta solo, corridas
  // sobre cada uno de los 20.000 ticks. Hasta este tramo el arnés de invariantes
  // no lo llamaba una sola línea de `ii/` fuera de su propio test, y el adversario
  // del veneno midió un estado ilegal —un actor sin cuerpo— que atravesaba una
  // corrida entera sin que nada se pusiera rojo. Un cero de secuencias emergentes
  // sobre un mundo que nadie está auditando vale menos que un cero auditado.
  const escena = escenaDe(o, tanque)
  const p = new Partida(escena.state, { vigilar: true })
  const m = new Mente({ actor: 'ana', memoria: new Creencias() })
  const d = new Detector()
  // El contrato de alimentación del detector: la primera muestra es el estado
  // INICIAL con la lista de eventos vacía.
  d.observar({ state: p.state, events: [] })

  const vuelos = new Map<string, number>()
  const nacidos = new Set<string>()
  const vistos = new Set<string>()
  let comestibles = 0
  let extraccionesCompletas = 0
  let comio = 0
  let enveneno = 0
  let mejorNeto: number | undefined
  let encendible: { readonly id: string; readonly masa: number } | undefined
  /** Los `Body` que el recorrido del diagnóstico ya interrogó. Ver el bucle. */
  const yaMirados = new Set<Body>()
  const rolA = ROL_A_DE_FRICCION()
  let murioEn = -1
  let aliento = tanque
  let t = 0
  for (; t < tope; t++) {
    const antes = m.despegues
    if (p.state.actors.has('ana')) m.pensar(p)
    if (m.despegues > antes) {
      const n = m.ultimoDespegue ?? '?'
      vuelos.set(n, (vuelos.get(n) ?? 0) + 1)
    }
    const eventos = p.tick()
    const w = p.state
    d.observar({ state: w, events: eventos })
    for (const e of eventos) {
      if (e.k === 'nacio') {
        nacidos.add(e.id)
        const b = w.bodies.get(e.id)
        if (b !== undefined && qualityOf(b.body, 'calories', w.phys) > 0) comestibles += 1
      }
      if (e.k === 'proceso' && e.process === EXTRACCION.id && e.completo) extraccionesCompletas += 1
      if (e.k === 'comio') comio += 1
      if (e.k === 'enveneno') enveneno += 1
    }
    // ─── EL RECORRIDO DEL DIAGNÓSTICO, y por qué es por tick ────────────────
    //
    // Las dos preguntas —«¿hubo alguna vez un bocado que valiera la pena?» y
    // «¿hubo alguna vez algo lo bastante liviano como para poder encenderlo?»—
    // son sobre TODA la partida y no sobre el estado final: el cuerpo que las
    // contesta puede haber existido treinta ticks. Mirar sólo el final diría que
    // no hubo vara justo porque la vara se gastó en la caña.
    //
    // ─── Y POR QUÉ SE SALTEA EL CUERPO QUE YA SE MIRÓ ───────────────────────
    //
    // Antes de este tramo el mundo tenía tres cuerpos y esto era gratis. Ahora
    // tiene entre 26 y 152 —los que el dios decretó—, y mirarlos todos en cada uno
    // de los 20.000 ticks era la mitad de lo que costaba el banco.
    //
    // El salteo es EXACTO y no una aproximación, y el porqué es del mundo: los
    // `WorldState` son inmutables por copia, así que el objeto `Body` de un cuerpo
    // que no cambió es EL MISMO objeto tick a tick. Y las cuatro preguntas de acá
    // abajo —masa, calorías, toxicidad, y si cumple el rol `a` con potencia— son
    // funciones puras de `(Body, Physics)`, con la `Physics` fija en la partida.
    // O sea que preguntarle de nuevo al mismo objeto da lo mismo por construcción.
    // Un cuerpo que se calienta, se parte o se ata es OTRO objeto y se vuelve a
    // mirar.
    const cuerpoDeAna = w.actors.get('ana')?.body
    for (const [id, b] of w.bodies) {
      if (id === cuerpoDeAna || yaMirados.has(b.body)) continue
      yaMirados.add(b.body)
      const masa = qualityOf(b.body, 'mass', w.phys)
      const cal = qualityOf(b.body, 'calories', w.phys)
      if (cal > 0) {
        const neto = cal * STAMINA_POR_CALORIA - qualityOf(b.body, 'toxicity', w.phys) * masa * COSTO_POR_TOXICIDAD_Y_KILO
        if (mejorNeto === undefined || neto > mejorNeto) mejorNeto = neto
      }
      if (encendible !== undefined && masa >= encendible.masa) continue
      if (!cumpleRol(b.body, rolA, w.phys) || potenciaSiArdiera(b.body, w.phys) <= 0) continue
      encendible = { id, masa }
    }
    for (const id of w.bodies.keys()) vistos.add(id)
    const cuerpo = w.bodies.get('ana-cuerpo')
    if (w.actors.has('ana')) {
      if (cuerpo !== undefined) aliento = qualityOf(cuerpo.body, 'stamina', w.phys)
    } else {
      murioEn = t
      break
    }
  }

  // CUERPOS QUE PUSO EL MUNDO POR SU CUENTA. Todo lo que se vio alguna vez, menos
  // lo que el ARNÉS plantó —hoy sólo la criatura—, menos los bancos de peces
  // —que `stepWorld` materializa desde el Hito 3— menos los que nacieron de un
  // proceso. Lo que queda es lo que el mundo trajo solo.
  //
  // **DABA CERO Y AHORA NO**, y ése es el tramo K entero: `stepWorld` materializa
  // las `sueltas` del decreto igual que materializa el pozo
  // (`world/src/step.ts`, `abrirChunk`). Los `suelta:cx:cy:n` NO se descuentan a
  // propósito: son exactamente lo que esta columna existe para contar.
  let cuerposDelMundo = 0
  for (const id of vistos) {
    if (escena.plantados.has(id) || id.startsWith('pozo:') || nacidos.has(id)) continue
    cuerposDelMundo += 1
  }

  let firma = `${String(o.cx)}:${String(o.cy)}|${String(o.pozo.x)},${String(o.pozo.y)}|${String(o.parada.x)},${String(o.parada.y)}`
  const cx = Math.floor(o.parada.x / 16)
  const cy = Math.floor(o.parada.y / 16)
  for (let dx = -RADIO_EN_CHUNKS; dx <= RADIO_EN_CHUNKS; dx++) {
    for (let dy = -RADIO_EN_CHUNKS; dy <= RADIO_EN_CHUNKS; dy++) {
      firma += `#${firmaDeSueltas(decretoDe(o.dios, o.phys, cx + dx, cy + dy).chunk.sueltas)}`
    }
  }

  return {
    semilla,
    cx: o.cx,
    cy: o.cy,
    parada: o.parada,
    ticks: t,
    murioEn,
    alientoFinal: aliento,
    veredicto: d.veredicto(),
    situaciones: { ...d.cronica.situaciones },
    vuelos,
    nacidos: nacidos.size,
    comestibles,
    extraccionesCompletas,
    comio,
    enveneno,
    mejorNeto,
    encendible,
    sueltasDecretadas: escena.decretadas,
    sueltasSembradas: escena.sembradas,
    cuerposDelMundo,
    firma,
    hash: hashWorldState(p.state),
    violaciones: p.informe.violaciones,
  }
}

/**
 * LAS VEINTE, con la política de reemplazo de §10 escrita y no improvisada: «si
 * alguna resulta no resoluble se reemplaza en orden por `20260728n + 20 + j` y el
 * reemplazo se anota». Acá «no resoluble» es lo único que puede serlo desde
 * afuera: que la semilla no tenga una sola orilla en 13×13 chunks.
 */
interface Banco {
  readonly corridas: readonly Corrida[]
  readonly reemplazos: readonly string[]
}

async function correrElBanco(tanque: number, cuantas: number, tope = TICKS): Promise<Banco> {
  // La lista de semillas NO se calcula acá: sale de `semillasQueSeJuegan`, que la
  // comparten este banco y el control del azar. Ver allá el porqué — si cada
  // archivo arma la suya, la mente y el dado se miden en mundos distintos.
  const { semillas, reemplazos } = semillasQueSeJuegan(cuantas)
  const corridas: Corrida[] = []
  for (const semilla of semillas) {
    // Un respiro entre partida y partida, para que el canal del worker no se
    // caiga por los 60 s de birpc. No cambia una sola medición: ver `respirar`.
    await respirar()
    const c = correrPartida(semilla, tanque, tope)
    // `semillasQueSeJuegan` ya garantizó que cada una tiene orilla, así que un
    // `undefined` acá es un mundo que dejó de ser el mismo entre dos llamadas —o
    // sea un determinismo roto— y no un caso de §10 que haya que reemplazar.
    if (c === undefined) throw new Error(`la semilla ${String(semilla)} tenía orilla y ahora no`)
    corridas.push(c)
  }
  return { corridas, reemplazos }
}

// ─── Memoización, para no correr el mismo banco dos veces ────────────────────

// Se memoriza LA PROMESA y no el resultado: así dos tests que pidan el banco a la
// vez lo corren una sola vez, y el `await` de cada uno espera al mismo trabajo.
let elCanonico: Promise<Banco> | undefined
function canonico(): Promise<Banco> {
  // ─── LA CORRIDA CANÓNICA TAMBIÉN SE GATEA, y hasta hoy no lo hacía ─────────
  //
  // El control ya se acortaba sin `ANIMA_BANCO=1` y la canónica no, así que la
  // suite normal pagaba **20 partidas × 20.000 ticks** en cada corrida. Medido
  // paquete por paquete: `@anima/mind` tarda 101 s, `@anima/world` 81, y este
  // paquete solo se comía más que los siete restantes juntos.
  //
  // No es aflojar el criterio: el veredicto del Hito 5 sale de la corrida con
  // `ANIMA_BANCO=1`, que es la que el documento pide y la única que se cita. Lo
  // que corre en la suite normal es una MUESTRA, y el informe la etiqueta como
  // tal (ver el `«sin ANIMA_BANCO=1»` del cuadro). Es el mismo patrón que
  // `world/tests/banco-el-tick.test.ts` ya tenía decidido: se imprime siempre, se
  // afirma sólo midiendo en serio.
  elCanonico ??= MIDIENDO_EN_SERIO
    ? correrElBanco(TANQUE, PARTIDAS)
    : correrElBanco(TANQUE, PARTIDAS_CORTAS, TICKS_CORTOS)
  return elCanonico
}

let elControl: Promise<Banco> | undefined
function control(): Promise<Banco> {
  elControl ??= MIDIENDO_EN_SERIO
    ? correrElBanco(TANQUE_LLENO, PARTIDAS)
    : correrElBanco(TANQUE_LLENO, PARTIDAS_CORTAS, TICKS_CORTOS)
  return elControl
}

// ─── El informe ──────────────────────────────────────────────────────────────

const dos = (x: number): string => x.toFixed(2)

/** El tick de la PRIMERA aparición de cada secuencia sobre todas las partidas. */
function primerasApariciones(b: Banco): ReadonlyMap<NombreDeSecuencia, number> {
  const out = new Map<NombreDeSecuencia, number>()
  for (const c of b.corridas) {
    for (const f of c.veredicto.filas) {
      if (!f.aparecio || f.tick === undefined) continue
      const y = out.get(f.nombre)
      if (y === undefined || f.tick < y) out.set(f.nombre, f.tick)
    }
  }
  return out
}

/**
 * LA TABLA CRUDA. Las tres cifras de §10 por secuencia, más el tick de la primera
 * aparición y la evidencia del primer disparo si lo hubo.
 */
function tablaDelBanco(b: Banco, titulo: string, ruidoMedido: readonly NombreDeSecuencia[]): string {
  const r = resumir(b.corridas.map((c) => c.veredicto))
  const primeras = primerasApariciones(b)
  const ruido = new Set(ruidoMedido)
  const n = b.corridas.length
  const lineas: string[] = [
    ``,
    `═══ ${titulo} ═══`,
    ``,
    `  ${'secuencia'.padEnd(38)} apareció  situación  no medida  azar  cuenta  1ª vez`,
    `  ${'─'.repeat(38)} ────────  ─────────  ─────────  ────  ──────  ──────`,
  ]
  for (const f of r.filas) {
    const t = primeras.get(f.nombre)
    lineas.push(
      `  ${f.nombre.padEnd(38)} ${`${String(f.aparecioEn)}/${String(n)}`.padStart(8)}  ` +
        `${`${String(f.situacionEn)}/${String(n)}`.padStart(9)}  ` +
        `${`${String(f.noMedidaEn)}/${String(n)}`.padStart(9)}  ` +
        `${(ruido.has(f.nombre) ? 'SÍ' : '·').padStart(4)}  ` +
        `${(f.cuenta && !ruido.has(f.nombre) ? 'SÍ' : 'no').padStart(6)}  ` +
        `${(t === undefined ? '—' : `t=${String(t)}`).padStart(6)}`,
    )
  }
  const cuentanDeVerdad = r.filas.filter((f) => f.cuenta && !ruido.has(f.nombre)).length
  lineas.push(
    ``,
    `  APARECIERON ${String(cuentanDeVerdad)} DE ${String(r.filas.length - ruido.size)} ` +
      `(§10.2: cuenta la que apareció en ≥ 2 de las ${String(n)} con situación, y que el azar NO firma)`,
    `  el azar firma ${String(ruido.size)} de ${String(r.filas.length)}: ${[...ruido].join(', ')}`,
    `  el crudo, sin descontar el ruido: ${String(r.cuantasCuentan)} de ${String(r.filas.length)}`,
    `  sin medir: ${String(r.filas.filter((f) => f.situacionEn === 0).length)} de ${String(r.filas.length)} ` +
      `→ ${r.interpretable ? 'interpretable' : 'NO INTERPRETABLE (§10: más de tres sin medir sobre nueve)'}`,
    `  contradicciones (disparó y el contra-detector negó la situación): ` +
      `${String(r.filas.reduce((a, f) => a + f.contradictorioEn, 0))}`,
  )
  // §10, «qué se publica pase lo que pase»: la masa del cuerpo elegido en cada
  // disparo de las entradas 2 y 8, y si el fuego era de vara sola o de cadena. Si
  // no hubo disparos se dice que no hubo, en vez de omitir la fila.
  const evidencias: string[] = []
  for (const c of b.corridas) {
    for (const f of c.veredicto.filas) {
      if (f.evidencia !== undefined) evidencias.push(`  ${String(c.semilla)} · ${f.nombre}: ${f.evidencia}`)
    }
  }
  lineas.push(
    ``,
    `  evidencia de los disparos (§10 pide la masa elegida y si el fuego era de vara o de cadena):`,
    evidencias.length === 0 ? `    NO HUBO UN SOLO DISPARO, ni un solo fuego en ninguna partida.` : evidencias.join('\n'),
    ``,
  )
  return lineas.join('\n')
}

/** El presupuesto: cuánto de los 20.000 ticks se usó de verdad. */
function tablaDelPresupuesto(b: Banco, titulo: string): string {
  const lineas: string[] = [``, `═══ ${titulo} ═══`, ``]
  let vividos = 0
  let muertas = 0
  for (const c of b.corridas) {
    if (c.murioEn >= 0) muertas += 1
    vividos += c.ticks
    // TRES COLUMNAS DONDE ANTES HABÍA UNA, y las tres dicen cosas distintas:
    // cuántas veces despegó la habilidad, cuántas veces el proceso llegó a
    // completarse, y cuántos cuerpos comestibles nacieron de verdad. La corrida
    // anterior publicaba sólo la primera con el nombre «pescas», y el proyecto la
    // leyó como pescados.
    const despegues = c.vuelos.get(`aplicar(${EXTRACCION.id})`) ?? 0
    // `comer` Y `tragar`: la mente bautiza `tragar(x)` al bocado que decide sola
    // (`mind/src/mente.ts`, la conducta `tragar`) y `comer` al que sale de un
    // plan. Contar sólo el prefijo `comer` daba cero aunque la criatura comiera.
    const bocados = [...c.vuelos]
      .filter(([k]) => k.startsWith('comer') || k.startsWith('tragar'))
      .reduce((a, [, v]) => a + v, 0)
    lineas.push(
      `  ${String(c.semilla)} · ${c.murioEn < 0 ? 'viva' : `murió t=${String(c.murioEn)}`} ` +
        `(${((c.ticks * 100) / TICKS).toFixed(1)}%) · aliento ${dos(c.alientoFinal)} · ` +
        `extraccion ${String(despegues)} despegues → ${String(c.extraccionesCompletas)} completas → ` +
        `${String(c.comestibles)} comestibles de ${String(c.nacidos)} nacidos · ` +
        `bocados ${String(bocados)} (el mundo narró comio ${String(c.comio)} · enveneno ${String(c.enveneno)}) · ` +
        `mejor neto ${c.mejorNeto === undefined ? 'no hubo comida' : dos(c.mejorNeto)} · ` +
        `sembradas ${String(c.sueltasSembradas)}/${String(c.sueltasDecretadas)} · ` +
        `encendible ${c.encendible === undefined ? 'NINGUNO' : `${c.encendible.id} ${c.encendible.masa.toFixed(4)} kg`} · ` +
        `hash ${c.hash.slice(0, 8)}`,
    )
  }
  const presupuesto = b.corridas.length * TICKS
  lineas.push(``, columnaDelEncendible(b), ``)
  lineas.push(
    `  ${String(muertas)} de ${String(b.corridas.length)} partidas terminaron con la criatura muerta`,
    `  presupuesto usado: ${String(vividos)} de ${String(presupuesto)} ticks ` +
      `(${((vividos * 100) / presupuesto).toFixed(1)}%)`,
    ``,
  )
  return lineas.join('\n')
}

/**
 * LA COLUMNA DE «¿HAY CON QUÉ ENCENDER?», que es la que este tramo vino a corregir.
 *
 * `lo-que-el-mundo-si-siembra.test.ts` mide sobre el DECRETO que 13 de las 20
 * semillas de §10 tienen al menos una vara por debajo del techo de la fricción y 7
 * no. Esta columna mide lo mismo sobre las partidas que de verdad se jugaron —que
 * no son las mismas semillas, porque §10 reemplaza las que no tienen orilla— y con
 * el cuerpo que existió EN CUALQUIER TICK, o sea contando también lo que la
 * criatura armó.
 *
 * **Las que no tienen no se descartan.** Filtrarlas sería armar el banco para que
 * dé bien; se corren, y el numerador se publica al lado del denominador.
 */
function columnaDelEncendible(b: Banco): string {
  let conEncendible = 0
  let bajoElTecho = 0
  let masLiviana = Number.POSITIVE_INFINITY
  for (const c of b.corridas) {
    if (c.encendible === undefined) continue
    conEncendible += 1
    if (c.encendible.masa <= TECHO_DE_LA_FRICCION) bajoElTecho += 1
    if (c.encendible.masa < masLiviana) masLiviana = c.encendible.masa
  }
  const n = b.corridas.length
  return (
    `  ¿HAY CON QUÉ ENCENDER? · partidas con algún cuerpo encendible: ${String(conEncendible)}/${String(n)} · ` +
    `con uno POR DEBAJO del techo de ${String(TECHO_DE_LA_FRICCION)} kg: ${String(bajoElTecho)}/${String(n)}\n` +
    `  el más liviano de todas las partidas: ` +
    `${masLiviana === Number.POSITIVE_INFINITY ? '—' : `${masLiviana.toFixed(4)} kg`} ` +
    `(el arnés viejo, con su escena a mano, decía 1,0000 kg en las veinte)\n` +
    // ─── LAS DOS POBLACIONES EN EL MISMO RENGLÓN, Y NO EN DOS ARCHIVOS ───────
    //
    // El «13 de 20» que este tramo publica como corrección está medido sobre las
    // VEINTE SEMILLAS DE §10 (`lo-que-el-mundo-si-siembra.test.ts`), y las que se
    // juegan acá no son ésas: §10 reemplaza las que no tienen orilla, y son trece.
    // Comparar el número de arriba con el «13 de 20» sin decirlo es comparar dos
    // poblaciones distintas, así que se dicen las dos juntas.
    `  (poblaciones: las 20 de §10 dan 13/20 con encendible sobre el DECRETO; ` +
    `las ${String(n)} que se juegan acá dan ${String(conEncendible)}/${String(n)} — no son las mismas semillas)`
  )
}

/** Qué despegó, sumado sobre todas las partidas. El diagnóstico de la mente. */
function tablaDeVuelos(b: Banco): string {
  const total = new Map<string, number>()
  for (const c of b.corridas) for (const [k, v] of c.vuelos) total.set(k, (total.get(k) ?? 0) + v)
  const orden = [...total].sort((a, x) => x[1] - a[1])
  return (
    `  habilidades que despegaron en las ${String(b.corridas.length)} partidas:\n` +
    (orden.length === 0 ? '    (ninguna)' : orden.map(([k, v]) => `    ${k.padEnd(24)} ×${String(v)}`).join('\n'))
  )
}

// ═══ (0) ANTES DE CORRER: ¿SON VEINTE MUNDOS O ES UNO? ══════════════════════

describe('(0) las veinte semillas, antes de correr una sola partida', () => {
  it.fails('LA CACHÉ DEL DECRETO NO LLEVA LA SEMILLA: dos dioses con una `Physics` son un mundo', async () => {
    // POR QUÉ FALLA, Y POR QUÉ NO SE BORRA: `decretoDe` arma su clave con
    // `${cx}:${cy}` y busca en un `WeakMap` indexado por el objeto `Physics`
    // (`world/src/dios.ts:305-317`). La semilla vive en `EstadoDelDios`, que es el
    // PRIMER argumento, y no entra en la clave ni en el `WeakMap`. Así que la
    // segunda pregunta devuelve la respuesta de la primera — y no una copia
    // equivalente: EL MISMO OBJETO.
    //
    // MEDIDO, y es lo que imprime este test: con dos `Physics` distintas las dos
    // semillas dan dos mundos, y con una sola `Physics` dan uno.
    //
    // POR QUÉ IMPORTA MÁS QUE UN BUG DE CACHÉ: «20 partidas con semillas
    // distintas» es media frase del criterio de corte del proyecto. Todo el
    // repositorio construye la física una vez por módulo (`const PHYS =
    // buildSeedPhysics()` arriba de cada arnés), así que el banco obvio —una
    // `Physics`, veinte dioses— mide **la misma partida veinte veces** y nadie se
    // entera: la salida es idéntica renglón por renglón, que es exactamente lo que
    // uno esperaría de un mundo determinista.
    //
    // Este arnés lo esquiva con una `Physics` por partida (`nuevaFisica`). Eso es
    // un rodeo y no una reparación: la reparación es del motor —meter la semilla
    // en la clave— y por eso queda acá en rojo.
    const compartida = buildSeedPhysics()
    const a = decretoDe(crearDios(SEMILLA_BASE), compartida, 7, 7)
    const b = decretoDe(crearDios(SEMILLA_BASE + 1n), compartida, 7, 7)

    const pA = buildSeedPhysics()
    const pB = buildSeedPhysics()
    const separadas = [
      decretoDe(crearDios(SEMILLA_BASE), pA, 7, 7),
      decretoDe(crearDios(SEMILLA_BASE + 1n), pB, 7, 7),
    ].map((d) => firmaDeSueltas(d.chunk.sueltas))

    console.log(
      `\n─── LA CACHÉ DEL DECRETO, MEDIDA ───\n` +
        `  con UNA \`Physics\` compartida, chunk 7:7:\n` +
        `    semilla ${String(SEMILLA_BASE)}      ${firmaDeSueltas(a.chunk.sueltas).slice(0, 90)}\n` +
        `    semilla ${String(SEMILLA_BASE + 1n)}      ${firmaDeSueltas(b.chunk.sueltas).slice(0, 90)}\n` +
        `    ¿es el mismo objeto?  ${String(a === b)}\n` +
        `  con una \`Physics\` POR SEMILLA, el mismo chunk 7:7:\n` +
        `    semilla ${String(SEMILLA_BASE)}      ${(separadas[0] ?? '').slice(0, 90)}\n` +
        `    semilla ${String(SEMILLA_BASE + 1n)}      ${(separadas[1] ?? '').slice(0, 90)}\n`,
    )
    // Lo que SÍ vale hoy, y se afirma acá aunque el test esté en rojo: con una
    // física por partida las semillas se separan. Es la premisa del rodeo.
    expect(separadas[0]).not.toBe(separadas[1])
    // Y esto es lo que tendría que valer y no vale.
    expect(
      firmaDeSueltas(a.chunk.sueltas),
      'dos semillas distintas decretaron el mismo chunk',
    ).not.toBe(firmaDeSueltas(b.chunk.sueltas))
  })

  it('DE LAS VEINTE SEMILLAS DE §10, sólo siete tienen orilla: el resto se reemplaza', async () => {
    // §10 fijó las semillas `20260728n + k` y dejó escrita la política: «si alguna
    // resulta no resoluble se reemplaza en orden por `20260728n + 20 + j` y el
    // reemplazo se anota». Acá se publica cuáles y por qué.
    //
    // «No resoluble» acá es lo único que puede serlo desde afuera, y es específico
    // de la escena canónica: **la semilla no tiene una sola orilla en 13×13
    // chunks**, o sea que no hay dónde poner «con hambre y un río a la vista». No
    // es un juicio sobre el mundo: es que la escena del criterio (1) del Hito 5
    // necesita un pozo con una celda seca al lado, y `world/tests/hito-5-la-pesca`
    // ya tenía medido que el 88,8% de los chunks de `agua-dulce` está enteramente
    // inundado.
    //
    // Y hay que decir de dónde sale que sean TRECE de veinte: la lista de §10 se
    // fijó sin correrla, y el agujero (B) —la caché sin semilla— hacía que
    // cualquier barrido de las veinte con una sola `Physics` encontrara orilla en
    // las veinte, todas la misma. O sea que el 13/20 no es mala suerte: es el
    // primer número que alguien mide sobre esas semillas.
    const filas: string[] = []
    let conOrilla = 0
    for (let k = 0; k < PARTIDAS; k++) {
      const semilla = SEMILLA_BASE + BigInt(k)
      const o = laOrilla(semilla)
      if (o === undefined) {
        filas.push(`  ${String(semilla)} · SIN ORILLA en 13×13 chunks → se reemplaza (§10)`)
        continue
      }
      conOrilla += 1
      filas.push(
        `  ${String(semilla)} · chunk ${String(o.cx).padStart(3)}:${String(o.cy).padStart(3)} · ` +
          `pozo ${String(o.pozo.x)},${String(o.pozo.y)} · parada ${String(o.parada.x)},${String(o.parada.y)}`,
      )
    }
    console.log(
      `\n─── LAS VEINTE SEMILLAS DE §10, UNA POR UNA ───\n${filas.join('\n')}\n` +
        `  ${String(conOrilla)} de ${String(PARTIDAS)} tienen orilla; ` +
        `las otras ${String(PARTIDAS - conOrilla)} se reemplazan en orden desde ${String(SEMILLA_DE_REEMPLAZO)}\n`,
    )
    expect(conOrilla).toBeGreaterThan(0)
    expect(conOrilla).toBeLessThanOrEqual(PARTIDAS)
  }, 300_000)

  it('y las veinte partidas que SE JUGARON son veinte mundos distintos', async () => {
    // La premisa del banco, verificada sobre las semillas que de verdad se
    // corrieron —las de §10 más los reemplazos— y no sobre las que se pensaban
    // correr. Si esto fuera falso, la tabla de más abajo sería una partida
    // repetida veinte veces y el criterio no diría nada.
    //
    // La firma no es la semilla: es DÓNDE quedó la orilla y QUÉ sembró el dios en
    // los 3×3 chunks de alrededor. Comparar semillas no probaría nada —son
    // distintas por construcción— y es exactamente el error que el agujero (B)
    // deja pasar.
    const b = await canonico()
    const firmas = new Set(b.corridas.map((c) => c.firma))
    console.log(
      `\n─── LAS VEINTE QUE SE JUGARON ───\n` +
        b.corridas
          .map(
            (c) =>
              `  ${String(c.semilla)} · chunk ${String(c.cx).padStart(3)}:${String(c.cy).padStart(3)} · ` +
              `parada ${String(c.parada.x)},${String(c.parada.y)} · ` +
              `${String(c.sueltasDecretadas)} sueltas decretadas alrededor`,
          )
          .join('\n') +
        `\n  firmas distintas: ${String(firmas.size)} de ${String(b.corridas.length)}\n`,
    )
    // Ídem: las firmas son una por partida corrida.
    expect(firmas.size).toBe(MIDIENDO_EN_SERIO ? PARTIDAS : PARTIDAS_CORTAS)
  }, 600_000)
})

// ═══ (1) EL MUNDO NO LE PONE EL PROBLEMA DELANTE ════════════════════════════

describe('(1) lo que el dios siembra y lo que el mundo materializa', () => {
  it('CERRADO · EL MUNDO MATERIALIZA LO QUE EL DIOS SIEMBRA, y ya no lo siembra el arnés', async () => {
    // ─── LO QUE ESTE TEST MEDÍA, Y POR QUÉ ESTUVO EN ROJO TRES TRAMOS ────────
    //
    // `decretoDe(...).chunk.sueltas` trae lo que el dios sembró en cada chunk
    // —junco, piedra, hueso, hoja, grano, raíz, tubérculo alrededor de esta
    // orilla— y **`@anima/world` no lo leía en ningún lado**: `grep -rn "sueltas"
    // world/src` devolvía UN renglón y era un comentario. Lo único que `stepWorld`
    // materializaba del decreto era el banco de peces, y `conLoQueElDiosPone` de la
    // capa de percepción copiaba de la sombra únicamente lo que empieza con
    // `pozo:`.
    //
    // MEDIDO ENTONCES: una criatura sola en la orilla de `20260728n`, cinco ticks
    // de `Partida`, sin una línea de escena. El dios decretó 90 sueltas en los 3×3
    // chunks y lo único que apareció fueron `pozo:-5:-2`, `pozo:-5:-3` y
    // `pozo:-6:-2`. **Cero.** El arnés lo rodeaba sembrando el decreto él mismo, y
    // este test quedaba en rojo diciendo que el rodeo no era la reparación.
    //
    // ─── LA REPARACIÓN, Y QUÉ SE MIDE AHORA ─────────────────────────────────
    //
    // `world/src/step.ts` materializa `chunk.sueltas` igual que materializa el pozo
    // (`materializarLoDecretado` → `abrirChunk`), una vez por chunk, anotado en
    // `EstadoDelDios.sembrados` para que lo quemado no reaparezca; y
    // `perceive/src/bucle.ts` copia de la sombra los DOS prefijos del dios. El
    // arnés dejó de sembrar (`el-mundo-decretado.ts`), así que `plantados` es hoy
    // el cuerpo de la criatura y nada más, y **esta columna cuenta lo que el mundo
    // trajo solo**.
    //
    // Y hay una diferencia de FORMA que no es cosmética, y por eso el test cambia
    // de nombre en vez de ablandarse: antes, el mundo materializado era una ISLA de
    // 3×3 chunks alrededor de la celda de arranque, porque el arnés sembraba una
    // vez y ahí terminaba. Ahora el chunk se abre cuando alguien llega, así que
    // `cuerposDelMundo` cuenta también lo que apareció mientras la criatura
    // caminaba — que es exactamente el hallazgo del bloque (5) de
    // `ataque-al-tramo-i`, cerrado.
    const b = await canonico()
    const filas = b.corridas.map(
      (c) =>
        `  ${String(c.semilla)} · el dios decretó ${String(c.sueltasDecretadas).padStart(3)} sueltas en los 3×3 del arranque · ` +
        `el mundo materializó ${String(c.sueltasSembradas).padStart(3)} en el primer paso · ` +
        `y ${String(c.cuerposDelMundo).padStart(4)} en toda la partida`,
    )
    const decretadas = b.corridas.reduce((a, c) => a + c.sueltasDecretadas, 0)
    const enElPrimerPaso = b.corridas.reduce((a, c) => a + c.sueltasSembradas, 0)
    const materializadas = b.corridas.reduce((a, c) => a + c.cuerposDelMundo, 0)
    console.log(
      `\n─── LO QUE EL DIOS SIEMBRA Y LO QUE EL MUNDO TRAE ───\n${filas.join('\n')}\n` +
        `  TOTAL: ${String(decretadas)} decretadas en los 3×3 del arranque · ` +
        `${String(enElPrimerPaso)} materializadas en el primer paso ` +
        `(se perdieron ${String(decretadas - enElPrimerPaso)}, el ${(((decretadas - enElPrimerPaso) * 100) / Math.max(1, decretadas)).toFixed(2)}%, ` +
        `contra el 4,5% que descartaba la regla vieja del arnés) · ` +
        `${String(materializadas)} vistas en toda la partida (el mundo sigue a la criatura)\n`,
    )
    expect(decretadas).toBeGreaterThan(0)
    // ─── EL CRITERIO DE ESTE TRAMO, CON SU RESIDUO MEDIDO ───────────────────
    //
    // El mundo trae lo que el dios decretó y lo trae CASI entero. MEDIDO sobre las
    // veinte partidas: **2280 decretadas, 2277 materializadas — se perdieron 3, el
    // 0,13%**. Contra la regla vieja del arnés, que descartaba la segunda de cada
    // celda repetida y perdía **103, el 4,5%**: treinta y cuatro veces menos.
    //
    // Las tres que faltan son el residuo declarado de `abrirChunk`: cuando la celda
    // decretada está ocupada, la suelta se corre a la primera celda libre pegada, y
    // si los NUEVE rumbos están tomados no entra. Hace falta un racimo muy denso
    // para eso —el decreto sortea celda con reposición y hay semillas que ponen 46
    // sueltas en un puñado de celdas—. Se afirma el residuo y no el cero: taparlo
    // con un `toBe` que no se cumple sería peor, y aflojarlo a «alguna entra» sería
    // dejar de mirar si mañana se pierden doscientas.
    expect(decretadas - enElPrimerPaso).toBeLessThan(decretadas * 0.01)
    // Y trae MÁS que eso a lo largo de la partida, porque el chunk se abre cuando
    // alguien llega: la isla de 3×3 se terminó.
    expect(materializadas).toBeGreaterThanOrEqual(enElPrimerPaso)
  }, 600_000)

  it('CUÁNTAS SITUACIONES PUSO EL MUNDO DELANTE, que es lo que decide si el número se puede leer', async () => {
    // La Regla 4, hecha aserción. No se afirma que las secuencias no aparecieron
    // —eso sería leer un cero que nadie pudo mover— sino CUÁNTAS situaciones el
    // mundo puso delante, que es un hecho del mundo y no de la mente. Con la
    // escena a mano eran cero de nueve y el resultado no era interpretable; con el
    // mundo decretado, lo que salga sale. Lo que se afirma es que el juez midió las
    // nueve, y el número de no-medidas se publica al lado sin ablandarlo.
    const b = await canonico()
    const r = resumir(b.corridas.map((c) => c.veredicto))
    const conSituacion = r.filas.filter((f) => f.situacionEn > 0).map((f) => f.nombre)
    const sinMedir = r.filas.filter((f) => f.situacionEn === 0).length
    console.log(
      `\n  contra-detectores que dieron verdadero en alguna de las ${String(b.corridas.length)} partidas: ` +
        `${conSituacion.length === 0 ? 'NINGUNO' : conSituacion.join(', ')}\n` +
        `  sin medir: ${String(sinMedir)} de ${String(r.filas.length)} ` +
        `→ ${r.interpretable ? 'INTERPRETABLE' : 'NO INTERPRETABLE (§10: más de tres sin medir sobre nueve)'}\n`,
    )
    expect(r.filas.length).toBe(SECUENCIAS.length)
    expect(sinMedir).toBeLessThanOrEqual(SECUENCIAS.length)
  }, 600_000)
})

// ═══ (2) EL BANCO DEL CRITERIO: VEINTE PARTIDAS ═════════════════════════════

describe('(2) veinte partidas con semillas distintas, cortadas en la muerte', () => {
  // ─── EL AZAR, EN TRES TESTS Y NO EN UNO ────────────────────────────────────
  //
  // Los dos controles son 20 × 20.000 ticks cada uno sobre el mundo decretado, y
  // juntos en un solo `it` pasaban de los cinco minutos: vitest le corta el canal
  // al worker («Timeout calling onTaskUpdate») y la corrida entera termina con un
  // error que no es de ninguna medición. Van separados, y el tercero sólo imprime
  // porque `correrElControl` memoiza. No se acortó ni una partida.

  it('EL AZAR SIN FUEGO, sobre las mismas veinte semillas que juega la mente', async () => {
    const sin = await correrElControl('EL AZAR SIN FUEGO', false, 1000)
    console.log(`\n${tablaDelControl(sin)}\n`)
    expect(sin.filas.length).toBe(SECUENCIAS.length)
  }, 900_000)

  it('EL AZAR CON EL FUEGO REGALADO, la concesión que va a favor del dado', async () => {
    const con = await correrElControl('EL AZAR CON EL FUEGO REGALADO', true, 40_000)
    console.log(`\n${tablaDelControl(con)}\n`)
    expect(con.filas.length).toBe(SECUENCIAS.length)
  }, 900_000)

  it('EL RUIDO DEL AZAR, publicado al lado del de la mente', async () => {
    // ─── POR QUÉ ESTE NÚMERO VA ACÁ Y NO SÓLO EN EL ARCHIVO DEL ADVERSARIO ────
    //
    // Porque es el denominador. Una criatura que elige la FORMA del acto y los
    // CUERPOS con el dado del mundo —y que no consulta una sola cualidad, que es
    // exactamente la hipótesis nula de las nueve— firma unas cuantas de las nueve
    // sobre 20 semillas y 20.000 ticks. Ninguna de ésas puede contar para el piso
    // de cuatro: una firma que produce un dado no distingue una mente de un dado.
    //
    // Y EL CONTROL SE VOLVIÓ A CORRER EN ESTE TRAMO, sobre el mundo decretado y
    // con las mismas veinte semillas que juega la mente. Antes corría sobre una
    // escena propia —diez sueltas de una tabla escrita a mano y cuatro peces
    // regalados— y el banco de la mente sobre otra: dos mundos distintos y una
    // resta entre ellos. Ver el encabezado de `tests/azar.ts`.
    //
    // Está medido y no estimado, con `dadoDe(crearDios(semilla))` y sin un solo
    // `Math.random`.
    const sin = await correrElControl('EL AZAR SIN FUEGO', false, 1000)
    const con = await correrElControl('EL AZAR CON EL FUEGO REGALADO', true, 40_000)
    const ruido = await ruidoDelAzar()
    console.log(
      `\n═══ EL RUIDO DEL AZAR, EL DENOMINADOR DEL CRITERIO ═══\n` +
        `${tablaDelControl(sin)}\n\n${tablaDelControl(con)}\n\n` +
        `  ══ EL AZAR FIRMA ${String(ruido.length)} DE ${String(SECUENCIAS.length)} ══ ${ruido.join(' · ')}\n` +
        `  ⇒ el piso de cuatro hay que cruzarlo sobre las ${String(SECUENCIAS.length - ruido.length)} que quedan\n`,
    )
    // Se afirma que el control corrió y midió las nueve, no cuánto dio: el número
    // es un hallazgo y va en la salida, no en un umbral.
    expect(sin.filas.length).toBe(SECUENCIAS.length)
    expect(con.filas.length).toBe(SECUENCIAS.length)
    expect(ruido.length).toBeLessThanOrEqual(SECUENCIAS.length)
  }, 900_000)

  it('LA TABLA CRUDA, que es lo que este archivo existe para publicar', async () => {
    const b = await canonico()
    const ruido = await ruidoDelAzar()
    console.log(
      `\n═══ EL BANCO ═══\n` +
        `  ${String(b.corridas.length)} partidas · tope ${String(TICKS)} ticks (${String(TICKS / HZ_DE_REFERENCIA)} s de mundo)\n` +
        `  tanque de arranque: ${String(TANQUE)} de 1000 · capacity 3 · PHYSICS_VERSION ${String(PHYSICS_VERSION)}\n` +
        `  semillas: ${b.corridas.map((c) => String(c.semilla)).join(' ')}\n` +
        `  reemplazos de §10 (${String(b.reemplazos.length)}):\n` +
        (b.reemplazos.length === 0 ? '    ninguno\n' : `${b.reemplazos.join('\n')}\n`) +
        tablaDelPresupuesto(b, 'EL PRESUPUESTO: CUÁNTO DE LOS 20.000 TICKS SE USÓ') +
        tablaDeVuelos(b) +
        '\n' +
        tablaDelBanco(b, 'LAS NUEVE SECUENCIAS, PARTIDA POR PARTIDA', ruido),
    )
    // Lo que se afirma siempre acá es lo ESTRUCTURAL: que el banco corrió lo que
    // dijo que iba a correr. Los números del veredicto van abajo, cada uno con su
    // aserción y su color.
      // Se exige LO QUE SE CORRIÓ y no un 20 clavado: sin `ANIMA_BANCO=1` esto
      // es una muestra de 3, y afirmar 20 sobre una muestra de 3 sería exigir
      // algo que nadie midió. El veredicto del criterio sigue saliendo de la
      // corrida en serio, que es la única que se cita.
    const cuantas = MIDIENDO_EN_SERIO ? PARTIDAS : PARTIDAS_CORTAS
    expect(b.corridas.length).toBe(cuantas)
    expect(new Set(b.corridas.map((c) => c.semilla)).size).toBe(cuantas)
    for (const c of b.corridas) expect(c.veredicto.filas.length).toBe(SECUENCIAS.length)
  }, 600_000)

  it.fails('EL CRITERIO DE CORTE: al menos 4 de las 9 — aparecieron 0', async () => {
    // EL NÚMERO CRUDO, que es lo único que este archivo decide: **aparecieron 0 de
    // 9**. El umbral no se toca acá y no hace falta tocarlo: §10 del documento ya
    // dejó escrito, antes de correr, que con nueve entradas el 4 absoluto del
    // criterio publicado y el 40% proporcional (3,6 → 4) caen en el mismo número.
    //
    // Y hay que leerlo con la fila de al lado: quedan SEIS no-medidas sobre nueve
    // —eran nueve con la escena a mano— y §10 dice que con más de tres el resultado
    // no es interpretable. Lo que sí es interpretable son las TRES que se movieron:
    // el mundo puso esos problemas delante en 8 y 9 de las 20 partidas —9/20, 9/20
    // y 8/20, vueltas a medir en este tramo— y la criatura no los resolvió una sola
    // vez. Ese pedazo del cero mide a la mente, y
    // es lo que el bloque (4) contesta fila por fila.
    const b = await canonico()
    const r = resumir(b.corridas.map((c) => c.veredicto))
    console.log(
      `\n─── EL CRITERIO ───\n` +
        `  aparecieron ${String(r.cuantasCuentan)} de ${String(r.filas.length)} · ` +
        `el criterio publicado pide 4 · sin medir ${String(r.filas.filter((f) => f.situacionEn === 0).length)}\n`,
    )
    expect(r.cuantasCuentan, `aparecieron ${String(r.cuantasCuentan)} de ${String(r.filas.length)}`).toBeGreaterThanOrEqual(4)
  }, 600_000)

  it('LA AUDITORÍA CORRIÓ SOBRE CADA TICK DE CADA PARTIDA — y esta vez encontró algo', async () => {
    // ─── POR QUÉ ESTO ES PARTE DEL CRITERIO Y NO UNA HIGIENE ────────────────
    //
    // Este archivo publica un cero. Un cero vale lo que valga el mundo sobre el
    // que se midió, y hasta este tramo ese mundo NO SE AUDITABA: `grep
    // exigirInvariantes ii/` devolvía dos archivos —el que lo define y su propio
    // test— y ninguna corrida real de `ii/` lo llamaba. El adversario del veneno
    // midió un estado ilegal que atravesaba una corrida entera en silencio: una
    // criatura que se comía a sí misma quedaba de actor SIN CUERPO, con
    // `inventario-inconsistente` en cada uno de los 500 ticks siguientes.
    //
    // Ahora `correrPartida` construye la `Partida` con `vigilar: true` y las cinco
    // preguntas que un estado contesta solo corren sobre cada tick de cada una de
    // las veinte. Si la lista sale vacía, el cero de secuencias es un cero sobre un
    // mundo legal. Si sale con algo, el cero no significaba nada — y hay que
    // saberlo ANTES de discutir umbrales.
    //
    // La sexta pregunta, la conservación, sigue sin poder encenderse acá: los tres
    // caminos por los que el dios materializa materia no emiten ningún evento que
    // `acreditado()` sepa leer, y su `it.fails` está en
    // `perceive/tests/ataque-a-la-costura.test.ts`. Lo que se afirma es lo que se
    // midió, ni una palabra más.
    const b = await canonico()
    const total = b.corridas.reduce((a, c) => a + c.violaciones.length, 0)
    const conAlguna = b.corridas.filter((c) => c.violaciones.length > 0)
    const clases = new Set(b.corridas.flatMap((c) => c.violaciones.map((x) => x.v.k)))
    console.log(
      `\n─── EL ARNÉS, SOBRE LAS VEINTE ───\n` +
        `  ${String(b.corridas.reduce((a, c) => a + c.ticks, 0))} ticks auditados con \`revisarEstado\` (orden · espacio · referencias · inventarios · rangos)\n` +
        `  estados ilegales: ${String(total)} en ${String(conAlguna.length)} de ${String(b.corridas.length)} partidas · clases: ${[...clases].join(', ') || '(ninguna)'}\n` +
        (conAlguna.length === 0
          ? '  ninguna partida los tuvo\n'
          : conAlguna
              .map(
                (c) =>
                  `  semilla ${String(c.semilla)} (${String(c.violaciones.length)}): ticks ` +
                  `${c.violaciones.map((x) => String(x.tick)).join(',')} — ${describir(c.violaciones[0]?.v as Violacion)}\n`,
              )
              .join('')),
    )
    // ─── LO QUE SE AFIRMA ACÁ, Y POR QUÉ LA ASPIRACIÓN SE MUDÓ ABAJO ─────────
    //
    // Acá vivía `expect([...clases]).toEqual([])` en verde, con esta nota: «CERO, Y
    // SE AFIRMA CERO. La corrida anterior tenía cuatro —`solidos-solapados` entre
    // `pozo:-5:-2` y la `vara` que el arnés dejaba a tres celdas— y esa aserción
    // decía “a lo sumo una partida, y de esa clase”. Ya no hace falta aflojarla».
    //
    // **Y desde entonces no dejó de empeorar: 12 violaciones en 1 de las 20 en el
    // tramo J, 6.306 en 3 al materializarse el decreto, 47.091 en 10 —el 57,5% de
    // los ticks auditados— con el cerrojo de la escalera, y 31.833 en 7 —el 43,6%—
    // con la poda del tramo L encima.** Las subidas tienen causa medida y ninguna es
    // del juez: la primera es el pozo sentándose encima de una suelta que ahora
    // existe, la segunda es `juntar` disparando miles de veces donde antes disparaba
    // 7 (8.195 en el K bis, 5.314 en el L). La baja del tramo L tampoco arregla nada:
    // la criatura vive menos ticks en las partidas que encabezaba
    // `solidos-solapados`. La aspiración NO se aflojó y NO
    // se le puso un «a lo sumo una partida» —que es exactamente el movimiento que la
    // nota de arriba celebraba haber podido deshacer—: el mismo `toEqual([])` se mudó
    // al `it.fails` de abajo, donde está el porqué medido. Y acá queda lo
    // ESTRUCTURAL, que es lo que este test tiene que garantizar siempre: que la
    // auditoría corrió sobre cada tick de cada partida, o sea que un cero de
    // violaciones significaría algo el día que vuelva a haberlo.
    //
    // `revisarEstado` corre en `Partida` con `vigilar: true`, una vez por tick. Si el
    // arnés se apagara —o si `informe` dejara de acumular— esto se pone rojo sin
    // depender de que alguna semilla tenga la suerte de romper algo.
    const ticks = b.corridas.reduce((a, c) => a + c.ticks, 0)
    expect(ticks).toBeGreaterThan(0)
    for (const c of b.corridas) expect(c.ticks).toBeGreaterThan(0)
    // Y que el informe sea legible: cada violación viaja con el tick en que se vio.
    for (const c of b.corridas) for (const x of c.violaciones) expect(x.tick).toBeGreaterThanOrEqual(0)
    // La cuenta se publica arriba; el número exacto es un hallazgo y no un umbral.
    expect(total).toBe(conAlguna.reduce((a, c) => a + c.violaciones.length, 0))
    expect(clases.size).toBeLessThanOrEqual(total)
  }, 600_000)

  it.fails('Y ESE MUNDO **NO** ERA LEGAL: `juntar` levanta el cuerpo de la propia criatura', async () => {
    // ─── EL AGUJERO QUE ESTA CORRIDA PISÓ, EN SU FORMA MÍNIMA ───────────────
    //
    // La corrida canónica de este archivo mide **estados ilegales de la clase
    // `inventario-inconsistente` · «ana/ana-cuerpo: se lleva a sí misma» en SIETE de
    // las 20 partidas** (eran OCHO en el K bis), y en la mayoría desde un tick
    // temprano hasta la muerte (20260752 arranca en el 36). Cuando el tramo J lo
    // encontró eran 12 ticks en 1 sola partida: lo que lo multiplicó fue un arreglo
    // de la escalera —el cerrojo del «mientras tanto», y después la poda del tramo
    // L— que sacó a la criatura de un bucle de `ir` y la puso a `juntar` miles de
    // veces en las veinte (8.195 en el K bis, 5.314 en el L).
    //
    // QUIÉN LO PIDE, medido tick por tick cuando eran doce: en el 6180 despega
    // `juntar×1` y en el 6181 el estado tiene `holding: ["w000000001","ana-cuerpo"]`.
    // La innata filtra los candidatos por `!enLaMano`, `heldBy === undefined` y
    // `portable >= 1` (`skills/src/innatas/juntar.ts:60`) y el cuerpo de la propia
    // criatura **pasa los tres**: no lo tiene en la mano, nadie lo sostiene, y su
    // `portable` vale 1,0000.
    //
    // QUIÉN LO DEJA: `intencionTomar` (`world/src/step.ts:1861`) chequea cinco cosas
    // —que el cuerpo exista, que nadie lo tenga, que esté a mano, que sea portable y
    // que quepan las manos— y ninguna es «no te levantes a vos misma». Este test es
    // la reproducción mínima: UN tick, dos cuerpos —la criatura y nada más—, un
    // `take` de su propio cuerpo. El mundo lo ACEPTA (evento `tomo`, `holding` con
    // `ana-cuerpo` adentro) y `revisarEstado` del mismo estado contesta la violación.
    // O sea que el motor produce un estado que su propio arnés declara ilegal, y no
    // hace falta ninguna semilla afortunada para verlo.
    //
    // POR QUÉ NO SE ARREGLA ACÁ: el juez no toca `src` de nadie, y menos el de dos
    // paquetes. Y la reparación tiene dos lugares posibles y no son equivalentes —el
    // filtro de `juntar` arregla esta habilidad, y la guarda de `intencionTomar`
    // arregla las quince y las que escriba el modelo—. La segunda es la que
    // corresponde por el ADR II-0001 (el modelo escribe habilidades, y una habilidad
    // mal escrita no tiene que poder ensuciar el estado), pero mueve el motor y por
    // lo tanto pide su decisión.
    const w = mundo({
      bodies: [enElPiso(criaturaDeBanco('ana', TANQUE), EN(0, 0))],
      actors: [actorDeBanco('ana', { holding: [] })],
    })
    const r = stepWorld(w, [take({ by: 'ana', seq: 1 }, 'ana-cuerpo')])
    const v = revisarEstado(r.state)
    console.log(
      `\n─── LA CRIATURA SE LEVANTA A SÍ MISMA, EN UN TICK ───\n` +
        `  portable de su cuerpo: ${qualityOf(w.bodies.get('ana-cuerpo')?.body as Body, 'portable', w.phys).toFixed(4)}\n` +
        `  eventos: ${r.events.map((e) => e.k).join(', ')}\n` +
        `  holding después: ${(r.state.actors.get('ana')?.holding ?? []).join(', ') || '(vacío)'}\n` +
        `  violaciones: ${String(v.length)}${v.length === 0 ? '' : ` — ${describir(v[0] as Violacion)}`}\n`,
    )
    // Y esto es lo que tendría que valer y no vale. Es la MISMA aserción que estaba
    // arriba en verde, con el mismo `toEqual([])`, movida y no aflojada.
    expect(v.map((x) => x.k)).toEqual([])
  }, 120_000)

  it('CERRADO · el banco ya no se materializa encima: al que está parado ahí lo corre', async () => {
    // ─── POR QUÉ ESTE TEST EXISTE Y NO SE BORRÓ CON LA ESCENA VIEJA ─────────
    //
    // El arnés de invariantes encontró esto la primera vez que alguien lo encendió:
    // `materializarLoDecretado` (`world/src/step.ts`) hace `ponerCuerpo` en
    // `pozo.at` sin preguntarle a `estorbo`, que es el guardián de la ley 8 que sí
    // aplican `goTo`, `put` y `drop`. La `vara` que el arnés viejo dejaba a tres
    // celdas caía justo ahí en UNA de las veinte semillas, y el solapamiento duraba
    // hasta que la criatura levantaba la vara —`revisarEspacio` no mira lo que está
    // en una mano—, o sea que ni siquiera se arreglaba: se escondía.
    //
    // ─── Y LA NOTA QUE ESTE BLOQUE TENÍA ACÁ ERA FALSA, MEDIDA ──────────────
    //
    // Decía: «con el mundo decretado el banco de arriba da cero, y ese cero podría
    // leerse como “se arregló”; no se arregló, dejó de dispararse porque el decreto
    // no siembra sobre agua y el pozo está en el agua». **El decreto SÍ siembra en la
    // celda del pozo**, y desde que el motor materializa las sueltas se ve: la
    // corrida canónica mide `solidos-solapados` entre un pozo y una suelta en 2 de
    // las 20 semillas —«pozo:3:-6 y suelta:3:-6:14 en (63,-89)» y «pozo:-6:0 y
    // suelta:-6:0:6 en (-93,0)»—, desde el tick 1 y por el resto de la partida.
    //
    // Así que el agujero volvió a ser el del banco y no sólo el de este `it.fails`.
    // La reproducción mínima se queda igual —un cuerpo puesto a mano en la celda del
    // pozo, UN tick— porque sigue valiendo lo de siempre: un hallazgo que necesita
    // una semilla afortunada se pierde en cuanto la escena cambia, y este archivo ya
    // perdió uno así.
    //
    // Y el orden de `materializarLoDecretado` —las sueltas ANTES del pozo— no es el
    // culpable ni la cura: está elegido para que la suelta no se corra de la celda
    // que el dios le dio, y su precio es exactamente esto. Invertirlo cambiaría de
    // víctima, no de problema.
    //
    // ─── CÓMO SE CERRÓ, Y NO POR NINGUNA DE LAS DOS QUE ESTABAN ESCRITAS ────
    //
    // Acá decía: «la reparación no es un `if`, es una decisión — o el banco no se
    // materializa (y la comida del mundo depende de dónde alguien dejó un palo), o
    // se corre de celda (y entonces la posición de todo pozo depende del estado, o
    // sea que el decreto deja de ser una función pura de la semilla y se mueven
    // todos los hashes)». Las dos eran malas y las dos eran innecesarias, porque
    // había una tercera: **el banco se queda donde el decreto dijo y se corre EL QUE
    // ESTABA** (ADR II-0014, `hacerLugar` en `world/src/step.ts`).
    //
    // Con eso el pozo sigue siendo función pura de la semilla —su celda no se movió
    // ni un lugar— y el invariante deja de romperse. La otra mitad del mismo
    // hallazgo, la de las sueltas que caían en la celda del banco, se cerró sin
    // tocar el banco: `abrirChunk` arranca reservándole su celda, así que ninguna
    // suelta la elige. El barrido de veinte semillas del paquete `world` pasó de
    // 2/20 a 0/20 (`world/tests/ataque-a-las-sueltas.test.ts`, bloque 3).
    //
    // Lo que cuesta, dicho acá porque es donde se ve: **una criatura no puede
    // quedarse parada encima del banco de peces**, el mundo la corre una celda.
    // Pescar sigue andando —`aMano` es Chebyshev ≤ 1— y el único test que se movió
    // por eso es una escena de arnés que era ilegal desde siempre.
    //
    // La reproducción mínima se queda igual: un cuerpo puesto a mano en la celda del
    // pozo y UN tick. Lo que cambió es que ahora tiene que dar CERO.
    const o = laOrilla(SEMILLA_BASE)
    expect(o).not.toBe(undefined)
    if (o === undefined) return
    const escena = escenaDe(o, TANQUE)
    // UN cuerpo más, y en la única celda que importa: la del banco de peces. No es
    // la escena del criterio —esto no mide ninguna secuencia—: es la reproducción
    // mínima del agujero.
    const bodies = new Map(escena.state.bodies)
    bodies.set('estorbo', { body: cuerpo('estorbo', 'piedra', 1), at: o.pozo })
    const p = new Partida({ ...escena.state, bodies: mapaDeCuerpos([...bodies.values()]) }, { vigilar: true })
    p.tick()
    const v = p.informe.violaciones
    const corrido = p.state.bodies.get('estorbo')
    console.log(
      `\n─── EL BANCO DE PECES, Y EL QUE ESTABA PARADO AHÍ ───\n` +
        `  celda del pozo: ${String(o.pozo.x)},${String(o.pozo.y)} · violaciones en un tick: ${String(v.length)}` +
        `${v.length === 0 ? '' : ` — ${describir(v[0]?.v as Violacion)}`}\n` +
        `  el estorbo terminó en ${JSON.stringify(corrido?.at)}\n`,
    )
    expect(v.length, `el mundo puso el banco encima y nadie lo frenó`).toBe(0)
    // Y no se perdió: se corrió. Un invariante que se arregla borrando el cuerpo que
    // molesta no está arreglado.
    expect(corrido).toBeDefined()
    expect(corrido?.at).not.toEqual(o.pozo)
  }, 120_000)

  it('CUÁNTO DEL PRESUPUESTO SE USÓ, que es la mitad de la pregunta', async () => {
    // La otra mitad —«¿cuántas no aparecieron porque la criatura se murió antes de
    // poder intentarlas?»— la contesta el control del bloque (3). Acá va el
    // denominador: cuánto vivió de verdad cada partida.
    const b = await canonico()
    const vividos = b.corridas.reduce((a, c) => a + c.ticks, 0)
    const presupuesto = b.corridas.length * TICKS
    const muertas = b.corridas.filter((c) => c.murioEn >= 0).length
    const ticksDeMuerte = b.corridas.filter((c) => c.murioEn >= 0).map((c) => c.murioEn)
    const menor = ticksDeMuerte.length === 0 ? -1 : Math.min(...ticksDeMuerte)
    const mayor = ticksDeMuerte.length === 0 ? -1 : Math.max(...ticksDeMuerte)
    console.log(
      `\n─── EL PRESUPUESTO ───\n` +
        `  ${String(muertas)}/${String(b.corridas.length)} partidas terminaron en muerte, ` +
        `entre el tick ${String(menor)} y el ${String(mayor)}\n` +
        `  ${String(vividos)} de ${String(presupuesto)} ticks vividos = ` +
        `${((vividos * 100) / presupuesto).toFixed(1)}% del presupuesto del criterio\n`,
    )
    // Se afirma que el banco midió el presupuesto, no cuánto dio: el número exacto
    // depende de la mente y esto es el juez.
    expect(vividos).toBeGreaterThan(0)
    expect(vividos).toBeLessThanOrEqual(presupuesto)
  }, 600_000)
})

// ═══ (3) EL CONTROL: ¿ES LA MUERTE O ES LA MENTE? ═══════════════════════════

describe('(3) el control con el tanque lleno', () => {
  it('con 1000 de aliento la criatura vive 3,6× más — y el juez dice lo mismo', async () => {
    // LA PREGUNTA QUE ESTE BLOQUE CONTESTA, y sin ella el cero de arriba no
    // significa nada: ¿las secuencias no aparecieron porque la mente no llega, o
    // porque la criatura no vivió lo suficiente para intentarlas?
    //
    // Se corre el mismo banco con el tanque entero. Si el cero se moviera, la
    // respuesta sería «no vivió»; si no se mueve, la muerte temprana no es lo que
    // manda. **No se mueve.**
    //
    // COSTO: son 20 × 20.000 ticks de mundo con una mente encima. Se corren las
    // veinte sólo con `ANIMA_BANCO=1`; sin él se corren tres y se dice cuántas.
    // Ver el encabezado: acá el gatillo es el costo y no la varianza.
    //
    // ═══ ESTE BLOQUE ESTABA ROJO CON `ANIMA_BANCO=1`, Y NADIE LO HABÍA CORRIDO ══
    //
    // Decía «vive casi los 20.000» y afirmaba `vividos / presupuesto > 0,9`. **Con
    // las veinte partidas eso nunca fue cierto.** Medido al cerrar el tramo L, y
    // las dos mediciones son mías, sobre las mismas veinte semillas:
    //
    //     árbol de HEAD (antes del tramo L) ... 261.352 / 400.000 = 65,338%
    //     árbol del tramo L ................... 264.776 / 400.000 = 66,194%
    //
    // O sea que el `> 0,9` fallaba de antes y **no es una regresión de la poda**;
    // la poda lo movió a favor por 0,86 puntos. Lo que hacía invisible el rojo es
    // que la aserción vive detrás de `if (!MIDIENDO_EN_SERIO) return`, y la suite
    // normal corre TRES partidas, no veinte.
    //
    // Y de dónde salió el 0,9: de un 81,0% que el traspaso publicaba como «el
    // control llega al 81,0% del presupuesto». **Ese 81,0% es de TRES partidas**
    // —las tres cortas— y se leyó como si fuera de las veinte.
    // → **REGLA: un porcentaje medido sobre la muestra corta no se cita como si
    //   fuera el del banco entero, y una aserción detrás de un `env` hay que
    //   correrla con el `env` puesto antes de escribirla.**
    //
    // ═══ Y AL CORRERLO SE DIO VUELTA LA CONCLUSIÓN DEL BLOQUE ════════════════
    //
    // El título decía «vive casi los 20.000» y el comentario decía «multiplicar por
    // cuatro el tiempo vivido no movió una sola fila». **Lo segundo es falso sobre
    // las veinte partidas: el control cuenta 2 DE 9 contra 0 de la canónica**, y la
    // corrida deja de ser no interpretable. Ver (E) en el encabezado del archivo.
    // Y no lo trajo el tramo L: las dos corridas —HEAD y tramo L— dan esta tabla
    // renglón por renglón idéntica.
    //
    // LO QUE SE AFIRMA AHORA es el MECANISMO que el bloque necesita de verdad, y no
    // un umbral inventado: que el control vive MUCHO más que la corrida canónica
    // —o sea que estirar el tiempo vivido fue un experimento real— y que el juez se
    // movió en la dirección que tiene que moverse. El número exacto es un hallazgo
    // del criterio y no un umbral de este arnés, que es exactamente lo que ya dice
    // el bloque de la auditoría tres más arriba.
    const b = await control()
    const canon = await canonico()
    const ruido = await ruidoDelAzar()
    console.log(
      `\n═══ EL CONTROL, TANQUE ${String(TANQUE_LLENO)} ═══\n` +
        `  ${String(b.corridas.length)} partidas` +
        `${MIDIENDO_EN_SERIO ? ' (midiendo en serio)' : ` de ${String(PARTIDAS)} — sin ANIMA_BANCO=1`}\n` +
        tablaDelPresupuesto(b, 'EL PRESUPUESTO DEL CONTROL') +
        tablaDeVuelos(b) +
        '\n' +
        tablaDelBanco(b, 'LAS NUEVE, CON EL TANQUE LLENO', ruido),
    )

    const vividos = b.corridas.reduce((a, c) => a + c.ticks, 0)
    const presupuesto = b.corridas.length * TICKS
    const r = resumir(b.corridas.map((c) => c.veredicto))
    console.log(
      `\n─── LA SEPARACIÓN ───\n` +
        `  con tanque ${String(TANQUE)}:  ${((canon.corridas.reduce((a, c) => a + c.ticks, 0) * 100) / (PARTIDAS * TICKS)).toFixed(1)}% del presupuesto · ` +
        `${String(resumir(canon.corridas.map((c) => c.veredicto)).cuantasCuentan)} de 9\n` +
        `  con tanque ${String(TANQUE_LLENO)}: ${((vividos * 100) / presupuesto).toFixed(1)}% del presupuesto · ` +
        `${String(r.cuantasCuentan)} de 9\n` +
        `  ⇒ ${r.cuantasCuentan === resumir(canon.corridas.map((c) => c.veredicto)).cuantasCuentan ? 'estirar el tiempo vivido no movió una sola fila: NO es la muerte' : 'el tiempo vivido SÍ mueve la aguja'}\n`,
    )

    // La corrida corta que sí afirma siempre: el control corrió y el juez lo
    // juzgó. Es lo que garantiza que el bloque no se rompa en silencio.
    expect(b.corridas.length).toBeGreaterThanOrEqual(PARTIDAS_CORTAS)
    for (const c of b.corridas) expect(c.veredicto.filas.length).toBe(SECUENCIAS.length)

    // Y lo caro se afirma sólo midiendo en serio.
    if (!MIDIENDO_EN_SERIO) return
    expect(b.corridas.length).toBe(PARTIDAS)
    // (1) EL EXPERIMENTO OCURRIÓ: el control vive al menos TRES VECES lo que la
    //     corrida canónica. Medido: 66,194% contra 18,241%, o sea 3,63×. Sin esta
    //     separación, cualquier cosa que se diga sobre «la muerte» no tendría con
    //     qué sostenerse.
    const vividosCanon = canon.corridas.reduce((a, c) => a + c.ticks, 0)
    const presupuestoCanon = canon.corridas.length * TICKS
    expect(
      vividos / presupuesto / (vividosCanon / presupuestoCanon),
      `el control vivió ${((vividos * 100) / presupuesto).toFixed(3)}% contra ${((vividosCanon * 100) / presupuestoCanon).toFixed(3)}% de la canónica`,
    ).toBeGreaterThan(3)
    // (2) Y EL TIEMPO VIVIDO **SÍ** MUEVE LA AGUJA, que es lo contrario de lo que
    //     este bloque decía. Ver el encabezado, (E): con el tanque lleno cuentan
    //     DOS de las nueve —`no-frotar-lo-que-no-alcanza-a-encender` 4/20 y
    //     `comerla-en-el-pico-de-calorias` 4/20— contra CERO de la canónica, y la
    //     corrida pasa de «no interpretable» (6 sin medir) a interpretable (3).
    //
    //     No se afirma «dos»: el número exacto es un hallazgo del criterio y no un
    //     umbral de este arnés, igual que en el bloque de la auditoría. Lo que se
    //     afirma es la DIRECCIÓN, que es la que sostiene el diagnóstico del bloque
    //     (4): darle tiempo no puede quitarle secuencias a la mente, y si algún día
    //     se las quitara habría un defecto de monotonía que hay que mirar.
    const cuentanCanon = resumir(canon.corridas.map((c) => c.veredicto)).cuantasCuentan
    expect(
      r.cuantasCuentan,
      `control ${String(r.cuantasCuentan)} de 9 contra canónica ${String(cuentanCanon)} de 9`,
    ).toBeGreaterThanOrEqual(cuentanCanon)
  }, 900_000)
})

// ═══ (4) EL DIAGNÓSTICO: DE CUÁL DE LAS TRES CAUSAS ES CADA CERO ════════════
//
// Un cero por secuencia no dice nada solo. Puede ser una de tres cosas, y las
// tres se separan con datos que ya están medidos y sin opinar sobre ninguna:
//
//   EL MUNDO   el contra-detector dio `false` en las veinte, y también en el
//              control con el tanque lleno —que vive 4× más—. El mundo nunca
//              puso el problema delante, y no fue por falta de tiempo.
//   LA MUERTE  el contra-detector dio `false` en las veinte y SÍ dio `true` en
//              alguna del control. Lo que faltó fue vida, no mundo.
//   LA MENTE   el contra-detector dio `true` en alguna partida y la firma no
//              salió igual. Es el único caso en el que el cero mide a la mente.
//
// El control con el tanque lleno es lo que hace que «EL MUNDO» y «LA MUERTE» no
// sean la misma casilla, y por eso este bloque lo consume aunque sea caro.
//
// ═══ Y «EL MUNDO» ESTÁ MAL NOMBRADA, MEDIDO Y NO OPINADO ═══════════════════
//
// La casilla dice «el mundo nunca puso el problema delante». Sobre el mundo que el
// motor materializa desde el tramo K, eso es FALSO en las seis filas que hoy caen
// ahí, y está medido en `tests/las-seis-que-dicen-el-mundo.test.ts`:
//
//   · cinco cuelgan de que haya fuego, y el control del azar con la fogata regalada
//     —mismas veinte semillas, mismo decreto— las enciende: 20/20, 20/20, 6/20,
//     5/20 y 5/20. Su cero es de los CERO FUEGOS, no del mundo;
//   · la sexta, `fardoPosible`, es la única que no necesita fuego, y el barrido de
//     las 46.080 celdas de los 3×3 materializados dice que el mundo ofrecía la
//     cadena en 5 de las 20 partidas, desde 32 celdas, la más cercana a 5 del
//     arranque contra un alcance de 3. Su cero es «la criatura no fue».
//
// LA CASILLA **NO SE RENOMBRÓ NI SE MOVIÓ NINGUNA FILA**, y es a propósito: `causaDe`
// es la regla con la que este banco viene clasificando desde el tramo H, cambiarla
// después de ver el resultado es exactamente lo que §10 prohíbe, y el cero del
// criterio no se mueve en ninguno de los dos casos. Lo que corresponde es publicar la
// medición al lado —que es lo que hace la línea de más abajo— y dejar la decisión de
// partir la casilla en dos («no hubo fuego» / «no caminó hasta ahí») para el usuario.

type Causa = 'EL MUNDO' | 'LA MUERTE' | 'LA MENTE'

/**
 * QUÉ CONTRA-DETECTORES PIDE CADA SECUENCIA.
 *
 * Es una transcripción del campo `situacion` de cada entrada de `src/secuencias
 * .ts`, y una transcripción es exactamente la clase de cosa que este repositorio
 * ya vio salir mal (§ la Regla 1 del juez). Por eso no se le cree: el test de más
 * abajo verifica, partida por partida y fila por fila, que la conjunción de estas
 * claves da lo mismo que el `situacion` que el detector calculó. Si mañana alguien
 * le cambia un `&&` a un contra-detector, esto se pone rojo.
 */
const LO_QUE_PIDE: readonly (readonly [NombreDeSecuencia, readonly (keyof Situaciones)[]])[] = [
  ['no-frotar-lo-que-no-alcanza-a-encender', ['dosCandidatosDeFriccion', 'candidatoDeFriccionPesado']],
  ['la-vara-mas-liviana-que-igual-cocina', ['dosCandidatosDeFriccion']],
  ['taparlo-con-lo-que-respira', ['fuegoYDosPermeabilidades']],
  ['ponerle-punta-al-aparejo', ['filoALaVista']],
  ['comerla-en-el-pico-de-calorias', ['algoSeCocino']],
  ['cocinar-el-lote-en-un-solo-fuego', ['loteAlAlcance']],
  ['el-fardo-de-corteza', ['fardoPosible']],
  ['el-leno-mas-grande-que-todavia-cocina', ['dosCombustiblesEnIntervalo']],
  ['la-piedra-primero-y-la-comida-encima', ['parrillaOfrecida']],
]

function pideDe(n: NombreDeSecuencia): readonly (keyof Situaciones)[] {
  for (const [nombre, claves] of LO_QUE_PIDE) if (nombre === n) return claves
  throw new Error(`la secuencia ${n} no está en LO_QUE_PIDE`)
}

function causaDe(canon: FilaDelBanco, ctrl: FilaDelBanco | undefined): Causa {
  if (canon.situacionEn > 0) return 'LA MENTE'
  return ctrl !== undefined && ctrl.situacionEn > 0 ? 'LA MUERTE' : 'EL MUNDO'
}

/** En cuántas partidas cada contra-detector suelto dio verdadero. */
function cuentaDeClaves(b: Banco): ReadonlyMap<keyof Situaciones, number> {
  const out = new Map<keyof Situaciones, number>()
  for (const c of b.corridas) {
    for (const k of Object.keys(c.situaciones) as (keyof Situaciones)[]) {
      if (c.situaciones[k]) out.set(k, (out.get(k) ?? 0) + 1)
    }
  }
  return out
}

describe('(4) el diagnóstico, secuencia por secuencia', () => {
  it('DE CUÁL DE LAS TRES CAUSAS ES CADA CERO, con la evidencia al lado', async () => {
    const b = await canonico()
    const k = await control()
    const rc = resumir(b.corridas.map((x) => x.veredicto))
    const rk = resumir(k.corridas.map((x) => x.veredicto))
    const claves = cuentaDeClaves(b)
    const n = b.corridas.length

    const lineas: string[] = [
      ``,
      `═══ DE CUÁL DE LAS TRES CAUSAS ES CADA CERO ═══`,
      ``,
      `  ${'secuencia'.padEnd(38)} apar. situ.  causa      qué contra-detector faltó (en cuántas de ${String(n)} dio verdadero)`,
      `  ${'─'.repeat(38)} ───── ─────  ─────────  ${'─'.repeat(60)}`,
    ]
    for (const f of rc.filas) {
      const ctrl = rk.filas.find((x) => x.nombre === f.nombre)
      const causa = causaDe(f, ctrl)
      const detalle = pideDe(f.nombre)
        .map((c) => `${c} ${String(claves.get(c) ?? 0)}/${String(n)}`)
        .join(' ∧ ')
      lineas.push(
        `  ${f.nombre.padEnd(38)} ${`${String(f.aparecioEn)}/${String(n)}`.padStart(5)} ` +
          `${`${String(f.situacionEn)}/${String(n)}`.padStart(5)}  ${causa.padEnd(9)}  ${detalle}`,
      )
    }

    // ─── LOS TRES NÚMEROS DEL MUNDO QUE ACOMPAÑAN A LAS NUEVE FILAS ─────────
    //
    // No son adornos del informe: son el «con evidencia» de cada causa. Los tres
    // se PUBLICAN, no se interpretan en el título: la corrida anterior los tituló
    // «NO PUEDE HABER FUEGO» sobre una escena que el arnés había plantado, y ese
    // título era lo único falso de las tres líneas.
    let masLiviano: { readonly id: string; readonly masa: number } | undefined
    let sinEncendible = 0
    let mejorNeto: number | undefined
    let netosPositivos = 0
    let comestibles = 0
    let comio = 0
    for (const c of b.corridas) {
      if (c.encendible === undefined) sinEncendible += 1
      else if (masLiviano === undefined || c.encendible.masa < masLiviano.masa) masLiviano = c.encendible
      if (c.mejorNeto !== undefined) {
        if (mejorNeto === undefined || c.mejorNeto > mejorNeto) mejorNeto = c.mejorNeto
        if (c.mejorNeto > 0) netosPositivos += 1
      }
      comestibles += c.comestibles
      comio += c.comio
    }
    const decretadas = b.corridas.reduce((a, c) => a + c.sueltasDecretadas, 0)
    const sembradas = b.corridas.reduce((a, c) => a + c.sueltasSembradas, 0)
    const materializadas = b.corridas.reduce((a, c) => a + c.cuerposDelMundo, 0)

    lineas.push(
      ``,
      `  ── LOS TRES NÚMEROS DEL MUNDO QUE VAN AL LADO DE LAS NUEVE FILAS ──`,
      ``,
      `  1· ¿HABÍA CON QUÉ ENCENDER? El cuerpo encendible —rol \`a\` de fricción Y que entregaría`,
      `     potencia si ardiera— más liviano que existió en las ${String(n)} partidas es ` +
        `${masLiviano === undefined ? 'NINGUNO' : `«${masLiviano.id}» de ${masLiviano.masa.toFixed(4)} kg`},`,
      `     contra un techo medido de ${String(TECHO_DE_LA_FRICCION)} kg (§2.2: 0,7132 no prende, 0,80 sí, con el tanque LLENO).`,
      `     Partidas sin ningún encendible: ${String(sinEncendible)}/${String(n)}, y no se descarta ninguna. Siete de las nueve cuelgan del fuego.`,
      ``,
      `  2· ¿HABÍA UN BOCADO QUE VALIERA LA PENA? El mejor neto que ofreció un cuerpo con calorías,`,
      `     en cualquier tick de cualquier partida, es ${mejorNeto === undefined ? 'no hubo comida' : mejorNeto.toFixed(4)} de stamina` +
        ` — y es una COTA SUPERIOR.`,
      `     Partidas con algún bocado de neto positivo: ${String(netosPositivos)}/${String(n)}. Cuerpos comestibles nacidos en total: ${String(comestibles)}.`,
      `     El mundo narró ${String(comio)} \`comio\`. La mente SÍ sabe emitir el bocado —la conducta \`tragar\` está en`,
      `     \`mind/src\` y este banco la cuenta—, así que un cero de bocados es una decisión y no una carencia.`,
      ``,
      `  3· ¿CUÁNTA MATERIA HUBO, Y QUIÉN LA PUSO? El dios decretó ${String(decretadas)} cosas sueltas alrededor,`,
      `     el mundo materializó ${String(sembradas)} en el primer paso (la ley 8 corre a la que cae en celda ocupada, y`,
      `     descarta sólo si los nueve rumbos están tomados) y ${String(materializadas)} a lo largo de la partida. De ahí salen`,
      `     las dos filas que ni siquiera necesitan fuego: \`dosCandidatosDeFriccion\` ` +
        `${String(claves.get('dosCandidatosDeFriccion') ?? 0)}/${String(n)} y \`filoALaVista\` ${String(claves.get('filoALaVista') ?? 0)}/${String(n)}.`,
      ``,
      `  4· Y LA CASILLA «EL MUNDO» NO QUIERE DECIR LO QUE SU NOMBRE DICE. Medido en`,
      `     \`tests/las-seis-que-dicen-el-mundo.test.ts\`: cinco de esas seis se encienden en cuanto hay`,
      `     un fuego —el control del azar con la fogata regalada, sobre estas mismas veinte semillas,`,
      `     las pone en 20/20, 20/20, 6/20, 5/20 y 5/20— y la sexta, \`fardoPosible\`, la ofrecía el mundo`,
      `     en 5 de las 20 partidas desde 32 celdas, la más cercana a 5 del arranque con un alcance de 3.`,
      `     Ninguna fila se movió de casilla por esto: ver el encabezado del bloque (4).`,
      ``,
    )
    console.log(lineas.join('\n'))

    // ─── LO QUE SE AFIRMA: que la transcripción no miente ───────────────────
    //
    // El `LO_QUE_PIDE` de arriba es una copia de los `situacion` de `secuencias
    // .ts`, y una copia que nadie verifica es la Regla 1 otra vez. Acá se verifica
    // contra el detector, en las veinte partidas y en las nueve filas.
    for (const c of b.corridas) {
      for (const f of c.veredicto.filas) {
        const esperado = pideDe(f.nombre).every((x) => c.situaciones[x])
        expect(
          f.situacion,
          `${String(c.semilla)} · ${f.nombre}: LO_QUE_PIDE dice ${String(esperado)} y el detector dice ${String(f.situacion)}`,
        ).toBe(esperado)
      }
    }
    expect(rc.filas.length).toBe(SECUENCIAS.length)
  }, 900_000)
})

// ═══ EL CUADRO ══════════════════════════════════════════════════════════════

describe('el criterio de emergencia, con los números de esta corrida', () => {
  it('el cuadro', async () => {
    const c = await canonico()
    const k = await control()
    const ruido = await ruidoDelAzar()
    const rc = resumir(c.corridas.map((x) => x.veredicto))
    const rk = resumir(k.corridas.map((x) => x.veredicto))
    const usado = c.corridas.reduce((a, x) => a + x.ticks, 0)
    const usadoK = k.corridas.reduce((a, x) => a + x.ticks, 0)
    const decretadas = c.corridas.reduce((a, x) => a + x.sueltasDecretadas, 0)
    const sembradasTotales = c.corridas.reduce((a, x) => a + x.sueltasSembradas, 0)
    const materializadas = c.corridas.reduce((a, x) => a + x.cuerposDelMundo, 0)
    const comestiblesTotales = c.corridas.reduce((a, x) => a + x.comestibles, 0)
    let masMagro: { readonly id: string; readonly masa: number } | undefined
    let mejorBocado: number | undefined
    let bajoElTecho = 0
    for (const x of c.corridas) {
      if (x.encendible !== undefined && (masMagro === undefined || x.encendible.masa < masMagro.masa)) {
        masMagro = x.encendible
      }
      if (x.encendible !== undefined && x.encendible.masa <= TECHO_DE_LA_FRICCION) bajoElTecho += 1
      if (x.mejorNeto !== undefined && (mejorBocado === undefined || x.mejorNeto > mejorBocado)) {
        mejorBocado = x.mejorNeto
      }
    }
    // DE QUIÉN ES CADA CERO, contado y no narrado. Es la misma `causaDe` del
    // bloque (4), y va acá porque es lo que cambió de fondo entre las dos
    // corridas: con la escena a mano las nueve filas decían EL MUNDO.
    const porCausa = new Map<Causa, number>()
    for (const f of rc.filas) {
      const causa = causaDe(f, rk.filas.find((x) => x.nombre === f.nombre))
      porCausa.set(causa, (porCausa.get(causa) ?? 0) + 1)
    }
    console.log(
      [
        '',
        '════ EL CRITERIO DE EMERGENCIA, MEDIDO ════════════════════════════════════',
        '',
        `  el criterio ............... AL MENOS 4 DE LAS ${String(SECUENCIAS.length)} — decidido por el usuario`,
        `                              (el texto pide «4 de las 10» y la lista cerrada tiene ${String(SECUENCIAS.length)};`,
        `                              se mantiene el 4 ABSOLUTO sobre la lista real, que es lo más exigente)`,
        `  APARECIERON ............... ${String(rc.cuantasCuentan)} de ${String(SECUENCIAS.length)}`,
        `  RUIDO DEL AZAR ............ ${String(ruido.length)} de ${String(SECUENCIAS.length)} las firma un bicho que elige con el dado:`,
        `                              ${ruido.join(', ')}`,
        `                              ⇒ el piso de cuatro hay que cruzarlo sobre las ${String(SECUENCIAS.length - ruido.length)} que quedan`,
        `  SIN MEDIR ................. ${String(rc.filas.filter((f) => f.situacionEn === 0).length)} de ${String(SECUENCIAS.length)}` +
          `  →  ${rc.interpretable ? 'interpretable' : 'EL RESULTADO NO ES INTERPRETABLE (§10)'}`,
        '',
        `  (A) quién puso la materia . EL MUNDO, y ya no el arnés (tramo K): el dios decretó ${String(decretadas)} cosas`,
        `                              sueltas en los 3×3 del arranque, \`abrirChunk\` puso ${String(sembradasTotales)} en el primer`,
        `                              paso y ${String(materializadas)} en toda la partida — el chunk se abre cuando alguien llega`,
        `  (B) las semillas .......... ${String(PARTIDAS)} mundos distintos SÓLO porque el arnés arma una \`Physics\` por`,
        `                              partida; \`decretoDe\` no lleva la semilla en la clave de su caché`,
        `  (C) el hambre ............. tanque ${String(TANQUE)}:  ${((usado * 100) / (c.corridas.length * TICKS)).toFixed(1)}% del presupuesto · ${String(rc.cuantasCuentan)} de ${String(SECUENCIAS.length)}`,
        `                              tanque ${String(TANQUE_LLENO)}: ${((usadoK * 100) / (k.corridas.length * TICKS)).toFixed(1)}% del presupuesto · ${String(rk.cuantasCuentan)} de ${String(SECUENCIAS.length)}`,
        `                              ⇒ ${rc.cuantasCuentan === rk.cuantasCuentan ? 'la muerte temprana NO es lo que decide el cero' : 'el tiempo vivido SÍ mueve la aguja'}`,
        `  (D) las semillas de §10 .... ${String(c.reemplazos.length)} de ${String(PARTIDAS)} no tienen orilla en 13×13 chunks`,
        `                              y se reemplazaron en orden desde ${String(SEMILLA_DE_REEMPLAZO)}, como §10 manda`,
        `  (E) ¿había con qué encender? el encendible más liviano de las ${String(PARTIDAS)} partidas pesa ` +
          `${masMagro === undefined ? '—' : `${masMagro.masa.toFixed(4)} kg («${masMagro.id}»)`} contra un techo de ${String(TECHO_DE_LA_FRICCION)}`,
        `                              partidas con alguno por debajo del techo: ${String(bajoElTecho)} de ${String(PARTIDAS)}, y ninguna se descartó`,
        `                              y el mejor bocado que ofreció el mundo vale ` +
          `${mejorBocado === undefined ? 'no hubo comida' : `${mejorBocado.toFixed(4)} de stamina`} sobre ${String(comestiblesTotales)} cuerpos comestibles`,
        `  (F) de quién es cada cero . ${String(porCausa.get('LA MENTE') ?? 0)} filas son LA MENTE · ` +
          `${String(porCausa.get('LA MUERTE') ?? 0)} LA MUERTE · ${String(porCausa.get('EL MUNDO') ?? 0)} EL MUNDO (bloque 4)`,
        '',
        `  semillas jugadas .......... ${c.corridas.map((x) => String(x.semilla)).join(' ')}`,
        `  tanque publicado (§3) ..... ${String(TANQUE)} · control ${String(TANQUE_LLENO)}`,
        `  PHYSICS_VERSION ........... ${String(PHYSICS_VERSION)}`,
        `  hashes .................... ${c.corridas.map((x) => x.hash.slice(0, 6)).join(' ')}`,
        '',
        '═══════════════════════════════════════════════════════════════════════════',
        '',
      ].join('\n'),
    )
    expect(rc.filas.length).toBe(SECUENCIAS.length)
  }, 900_000)
})
