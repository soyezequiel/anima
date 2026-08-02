# Cómo actualizar el tablero

Este archivo es el procedimiento completo. **Si lo seguís entero, no hace falta
leer ningún otro documento del proyecto** — ni `continuar-aca.md`, ni la
arquitectura, ni los ADRs. Están escritos para diseñar; esto está escrito para
actualizar un tablero, que es otra cosa y mucho más chica.

Está pensado para que lo corra cualquier modelo, incluido uno chico. Por eso casi
no hay decisiones: las que había se movieron adentro del código.

---

## Lo primero, y es la regla que sostiene todo lo demás

**Un número sin exit code al lado es una cita, no una medición.**

Cuando pongas un número en el tablero tenés dos opciones y ninguna más:

- **lo corriste vos** → va como está, y lo anotás en `verificacion.comandos`;
- **lo leíste en un documento o en un mensaje de commit** → va con la frase
  «citado de X» en su `nota`.

Nunca copies un número de `continuar-aca.md` como si lo hubieras medido. Ese
documento arrastró cinco conteos viejos durante dos tramos sin que nadie lo
notara, y está escrito ahí mismo.

---

## Los cuatro pasos

### 1 · Mirar si el árbol se movió

```bash
git log --oneline -8 && git status --porcelain
```

Buscá commits que no estén reflejados en `estado.json`. El mensaje de commit de
este repo dice qué punto del criterio movió y suele traer los números ya
corridos — leelo entero, es la fuente más barata que hay.

Si hay archivos sin commitear, **no los cuentes como hechos**. Van a la fila
«sin commitear» de `salud`, y nada más.

### 2 · Medir lo que se puede medir barato

Estos cuatro son rápidos y sostienen casi toda la fila de salud:

```bash
pnpm ii:typecheck
```

```bash
grep -rcE "^\s*it\.fails\(" ii/packages --include=*.test.ts | awk -F: '{s+=$2} END {print s}'
```

```bash
ls ii/docs/decisions/*.md | wc -l
```

```bash
git log origin/anima-2..HEAD --oneline | wc -l
```

La suite entera (`pnpm ii:test`) tarda unos 5 minutos: corrantela en segundo
plano y seguí con lo demás mientras. **Ojo con tres trampas ya mordidas:**

- vitest escribe códigos de color entre `Tests` y el número, así que un
  `grep "Tests +[0-9]+"` no matchea nada. Va con `FORCE_COLOR=0 NO_COLOR=1`;
- si el comando termina en `| tail -60`, el conteo por paquete se pierde y sólo
  queda el último. Y `$?` después de un pipe es el del `tail`, no el de `pnpm`;
- si hay un paquete roto (algo sin commitear, por ejemplo), `pnpm ii:test` FRENA
  ahí y no corre los paquetes que vienen después (`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`).
  Un cuadro parcial se puede leer como «todo lo demás está verde» cuando en
  realidad no se corrió. Para ver el resto: `pnpm --no-bail --filter "./ii/**" run test`.

El banco caro (`ANIMA_BANCO=1 pnpm --filter @anima/emergencia test`, unos 311 s) **no
hace falta** para actualizar el tablero. Si no lo corrés, decilo en
`verificacion.sinCorrer`.

### 3 · Editar `estado.json`

Es el único archivo que se toca. Las reglas están abajo.

### 4 · Construir y publicar

```bash
node ii/docs/tablero/construir.mjs
```

Si el portón se queja, arreglá y volvé a correr: **no escribe ningún archivo
hasta que pase**. Cuando pase, publicá `tablero.fragmento.html` con la
herramienta Artifact, **pasando la URL que está en `estado.json` como
`artifactUrl`**.

> **Sin esa URL, publicar mina un link nuevo y el usuario termina con dos
> tableros y ninguno completo.** Es el único paso irreversible del
> procedimiento.

---

## Las reglas de `estado.json`

### El porcentaje no se escribe: se deriva

No hay campo `avance` en las etapas que tienen criterios. El generador lo calcula
así, y no hay forma de pisarlo:

| estado del criterio | vale |
|---|---|
| `si` — cumple | 1 |
| `rojo` — no cumple, aceptado con causa medida | 1 |
| `medio` — a medias | 0,5 |
| `no` — falta | 0 |

Se promedia sobre los criterios de la etapa, y cada etapa pesa lo que dicen sus
`semanas`.

**Por qué `rojo` vale uno.** Un rojo aceptado no es trabajo pendiente: es un
número que no cumple y que el usuario decidió cerrar igual, con la causa medida
al lado. Descontarle avance haría que un hito cerrado por decisión parezca a
medio hacer para siempre. Lo que el rojo comunica va en el chip de la etapa
(`cerrado-con-rojo`) y en el texto del criterio.

**Las etapas con `semanas: null` quedan afuera de la cuenta.** No es un descuido:
el plan de arquitectura dice, con esas palabras, que *no se calcula un total
nuevo sin base*. Los Hitos 12 a 16 no tienen estimación —el 14 pide un spike— y
darles un peso inventado haría que el porcentaje deje de significar algo.

### Los estados, y son los únicos que existen

```
etapa   hecho | cerrado-con-rojo | en-curso | pendiente | sin-estimar
punto   si | medio | no | rojo
```

Cualquier otra cosa la rechaza el portón por nombre.

### Cómo se cuenta «cumple», cuando el repo y vos no coinciden

**Gana el repo.** Si `gate-5-6-objetos-emergentes.md` dice «van 8 de 12
cumpliendo», el tablero tiene que mostrar 8 de 12, aunque a vos uno de esos ocho
te parezca a medias. Un tablero que discute con el traspaso genera exactamente el
problema de «¿cuál de los dos números es el bueno?» que este proyecto ya se comió
tres veces.

Si de verdad creés que el doc cuenta mal, **decíselo al usuario en el chat**; no
lo arregles por tu cuenta en el tablero.

### Qué va en cada campo

| campo | qué es |
|---|---|
| `ahora` | dónde está parado el proyecto HOY. Es lo segundo que se lee: reescribilo cada vez, no lo dejes viejo |
| `ahora.proximosPasos` | lo que sigue, en orden. Sacá lo que ya se hizo |
| `salud` | seis datos como mucho. Si agregás uno, sacá otro |
| `verificacion` | qué corriste y con qué exit code. `ok: false` pinta el borde de rojo |
| `etapas[].enUnaFrase` | en castellano llano, sin nombres de paquete. Es lo que se lee de reojo |
| `etapas[].nota` | el porqué, no el qué. Lo que alguien no adivinaría mirando los criterios |
| `decisionesQueEsperan` | sólo lo que está trabado esperando al usuario. Si nadie espera nada, sacá la entrada |
| `deudasAbiertas` | lo que muerde más adelante. Máximo cinco: es una lista para leer, no un inventario |

---

## Qué NO hacer

- **No edites `tablero.html` ni `tablero.fragmento.html`.** Se regeneran enteros
  y la próxima corrida pisa lo que hayas escrito.
- **No agregues etapas nuevas** salvo que el plan de arquitectura las tenga. El
  tablero refleja el plan; no es donde se decide el plan.
- **No infles el porcentaje** metiendo los hitos sin estimar en la cuenta.
- **No borres un rojo aceptado porque «ya está viejo».** Aceptar un número no es
  dejar de vigilarlo, y sus guardas siguen corriendo.

---

## Los archivos

| archivo | qué es |
|---|---|
| `estado.json` | **la única fuente de la verdad.** Lo único que se edita a mano |
| `construir.mjs` | portón + generador. Lee el JSON, escribe los dos HTML |
| `tablero.html` | la página completa, se abre local en el navegador |
| `tablero.fragmento.html` | lo mismo sin `<html>`/`<head>`, para publicar como Artifact |
| `COMO-ACTUALIZAR.md` | este archivo |
