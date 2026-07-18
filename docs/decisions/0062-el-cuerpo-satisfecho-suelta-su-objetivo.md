# ADR 0062 — El cuerpo satisfecho suelta su objetivo

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

Con el modo creativo encendido (ADR 0061) y el cuerpo al máximo, el cuidador
seguía viendo que «necesita energía y calor»:

> estoy en modo creativo y aun así detecto que necesita energía y calor, eso
> está mal, solo debe sentir eso si lo necesita

Dos causas distintas, y solo una era del modo creativo.

### 1. El relleno llegaba tarde

`topUpVitals` corría alrededor de `stepWorld`, pero la percepción con la que
piensa el tick se arma **antes**, al principio del paso. Y un mundo recién
creado arranca con la energía baja a propósito. Resultado: el primer tick del
modo creativo la encontraba con el cuerpo a medias, nacía el objetivo del
cuerpo, y recién después se rellenaba.

### 2. Un objetivo del cuerpo no se cerraba nunca solo

Este es más viejo y más grande que el modo creativo.

`processEnergySignal` y `processColdSignal` empiezan con una guarda: si la
fracción está por encima del umbral, **return**. O sea, con el cuerpo lleno no
nace un objetivo nuevo — pero al que ya estaba abierto nadie lo cierra.

Un objetivo del cuerpo solo se cerraba si lo resolvía **ella**, al terminar con
éxito la actividad. Si el cuidador la alimentaba, si el sol la entibiaba, o si
el modo creativo le llenaba el cuerpo, «recuperar energía» seguía abierto para
siempre: compitiendo en la fila de prioridades y apareciendo en pantalla por un
hambre que ya no tenía.

Sentir hambre sin tener hambre no es un objetivo: es un fantasma.

## Decisión

**1. El relleno del modo creativo va al principio del paso**, antes de que se
arme la percepción con la que va a pensar.

**2. Los objetivos del cuerpo se cierran cuando la necesidad desaparece**,
la haya resuelto quien la haya resuelto (`closeSatisfiedNeeds`).

Dos guardas, y las dos importan:

- **Histéresis.** Se da por satisfecha en `0.6`, cómodamente por encima del
  `0.35` que la enciende. Con los dos en el mismo número, un cuerpo oscilando
  alrededor de la línea abriría y cerraría el objetivo cada tick.

- **No se corta una actividad en curso.** Si está trabajando para ese objetivo
  ahora mismo, se la deja terminar. El final de la actividad es donde ella
  **aprende** —comparar lo que esperaba con lo que pasó, y quedarse con
  «consumir alimento recupera energía»—. Cerrar el objetivo a mitad porque el
  cuerpo ya se llenó le robaría justo la lección que fue a buscar: comer y no
  entender por qué se siente mejor.

## Consecuencias

- Alimentarla a mano ahora cierra su hambre, como debe ser. Antes el objetivo
  quedaba abierto y la seguía empujando.
- El cierre queda registrado con su motivo (`el cuerpo dejó de pedirlo`), que
  lo distingue de haberlo logrado ella.
- El objetivo puede tardar unos ticks en cerrarse si había una actividad en
  vuelo: se cierra apenas esa actividad termina. Es el precio de no robarle la
  lección, y es el correcto.

## Nota de método

La primera versión SÍ cortaba la actividad en curso, y rompió cinco pruebas de
golpe —entre ellas la historia completa del MVP, que dejó de aprender
«consumir alimento recupera energía»—. Las pruebas señalaron exactamente el
daño: cortar la actividad justo cuando la energía cruzaba el umbral era cortarla
un instante antes de que entendiera por qué había comido.
