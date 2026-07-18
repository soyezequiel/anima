# ADR 0034 — Obras por tandas y soltar a conciencia

Fecha: 2026-07-17 · Estado: aceptada · Releva el "juntar todo primero" del ADR 0032; se apoya en los ADR 0008, 0020 y 0031

## Contexto

Dos corridas reales, un mismo tope: las manos.

**La fogata que no se recogía.** El cuidador pidió «fabrica una fogata». Ánima
tenía un pedernal **justo al lado** —lo veía, lo decía— y sin embargo respondió
«no pude completar eso: me falta 1 pedernal y no veo más por acá». No era la
vista: era que llevaba las manos llenas de sobras (una rama, un martillo,
troncos de más) y `resolvePickup` rechazaba en silencio por `inventory-full`.
Ese fallo mudo se aplastaba en el `no-candidates` de siempre, y el mensaje
culpaba a la vista de un problema de capacidad. El cuidador salía a buscar un
pedernal que la mascota tenía pegado al codo.

**La casa que no entraba en los brazos.** El ADR 0032 dejó las obras atadas a la
capacidad del inventario: se juntaban ENTERAS antes de colocarse, así que una
casa de más bloques de los que la mascota carga (6) era inconstruible, y la
puerta la rechazaba. El propio ADR 0032 lo anotó como su límite y nombró la
salida: «juntar-y-colocar por tandas volviendo a un ancla». Eso es este ADR.

## Decisión

### 1. Soltar a conciencia para hacer lugar (`makeRoom`)

Una operación nueva de la DSL, `makeRoom { keep }`. Solo actúa con el inventario
lleno; entonces suelta al suelo la cosa **menos útil que no sirva para la tarea
en curso** —lo que no esté en `keep`, prefiriendo lo que no es herramienta y, si
no queda otra, la herramienta más débil—. Nunca suelta la materia de la receta o
del plano (esos son los `keep`, acumulados al bajar por el árbol del ADR 0031).
Lo soltado queda en el piso, recuperable.

Al juntar para craftear o construir, `makeRoom` va antes de cada recogida. Así
las manos llenas de sobras dejan de ser un «no puedo»: suelta lo que le estorba
y junta igual. Solo es un «no puedo» honesto cuando todo lo que carga es material
que va a necesitar — capacidad, no recurso (ADR 0008), y se dice con esas
palabras en vez de fingir ceguera.

### 2. La obra se levanta por tandas, volviendo a un ancla

El programa de una obra deja de juntar todo primero. Ahora:

1. **Recuerda el ancla** (`markAnchor`): la celda donde arranca es el centro de
   la casa. Las colocaciones son relativas a ella, así que el ancla no se mueve.
2. **Por tandas de a lo sumo `capacity` bloques**: junta los bloques de la tanda
   en un solo viaje (los recoge o los fabrica, soltando sobras si hace falta),
   **vuelve al ancla** (`moveToward` con `stopAtDistance: 0`), y coloca cada
   celda que todavía no tenga su bloque.

Volver al ancla es la pieza que faltaba: buscar material mueve a la mascota, y
`place` cuelga los bloques relativos a donde está parada — sin regresar, la casa
quedaba desparramada. La DSL sabía perseguir entidades (un pedernal, un árbol),
no volver a una coordenada; el ancla es esa coordenada, guardada en una variable
y perseguida como si fuera una cosa que no se puede esconder.

Una casa de 8 con 6 manos son dos tandas, no un imposible. El único límite de
tamaño que queda es el footprint (3×3 → 8 bloques): lo grande de verdad —caminar
entre bloque y bloque, footprints mayores— sigue siendo el eje siguiente.

### 3. Idempotencia: retomar sin repetir (`blockAt`)

Una condición nueva, `blockAt { dx, dy, kind? }`: ¿ya hay un bloque (de ese tipo)
en la celda del offset? Cada colocación se saltea si su celda ya está hecha. Así
la mascota puede irse a comer a mitad de la obra y, al volver, seguir desde donde
estaba en vez de rehacer lo puesto. Se evalúa parada en el ancla, por eso el
programa vuelve antes de preguntar.

### 4. Lo colocado deja de ser materia suelta

Al `place`, el bloque pierde su componente `portable`: pasa a ser parte de la
obra, no algo que se levante (es lo que el ADR 0032 ya quería con «la casa no se
recoge»). Sin esto, al construir en tandas la mascota recogía su propia pared
recién puesta —el bloque suelto más cercano— y la obra nunca crecía. En
consecuencia, el juntado de obras busca solo material `portable`: lo suelto, no
lo ya construido.

### Lo que se cae: el límite de capacidad en la puerta del plano

`validateBlueprint` ya no recibe ni juzga la capacidad del inventario. Una obra
más grande que las manos dejó de ser inconstruible, así que rechazarla sería
mentir. El motivo de rechazo por capacidad, el presupuesto de bloques en el
prompt del modelo y el mensaje «no me entra en los brazos» del ADR 0032 se
retiran con él.

## Consecuencias

- La fogata con un pedernal al lado se construye aunque la mascota venga cargada:
  suelta una sobra y lo junta. Y cuando de verdad no puede (todo lo que lleva es
  material necesario), lo dice como capacidad, no como ceguera.
- Casas de hasta 8 bloques, aunque no entren de una en las manos.
- Obras retomables: una casa a medias se termina, no se reinicia.
- Sigue en pie el límite honesto: el footprint es 3×3. Caminar mientras
  construye —el castillo de veinte celdas— es el eje siguiente, y ahora tiene
  media escalera puesta (volver a una coordenada ya existe).
