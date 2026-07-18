# ADR 0048 — El cuerpo en rojo le gana a la palabra

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

Se la observó juntando troncos para el cuidador **con el calor en 6 de 50**, a
minutos de morir congelada. No fue un problema de prioridades: están bien
puestas y el frío puntúa más que un encargo (0.95 + urgencia contra 1.0 + 0.8).
El problema era que **nunca llegaban a compararse**. En `think`:

```js
if (this.activity) return this.continueActivity(perception);  // ← primero
const goal = this.goals.selectActive();                       // ← nunca llega
```

Quien agarraba el turno se lo quedaba hasta terminar. Un encargo largo —caminar
media grilla a buscar un tronco— bloqueaba la re-elección de objetivo durante
decenas de ticks, y el cuerpo no tenía forma de recuperar el turno.

El orden no era un descuido: continuar la actividad antes de re-planificar es lo
que evita rehacer el programa a cada tick y duplicar pasos. Lo que faltaba era
una excepción, no dar vuelta la regla.

## Decisión

1. **Una necesidad crítica del cuerpo interrumpe la actividad en curso.** Antes
   de continuar lo que está haciendo, si alguna señal del cuerpo está bajo
   `CRITICAL_NEED_FRACTION` (20% del máximo) y existe un objetivo activo de
   `internal-signal`, la actividad se suelta y el turno vuelve a la elección
   normal de objetivos.

2. **Solo lo CRÍTICO, no cualquier bajón.** El umbral de interrupción (20%) es
   más bajo que el de alerta (35%) a propósito. Entre uno y otro ella atiende el
   problema pero termina lo que empezó; recién en rojo el cuerpo pasa por encima
   de la palabra. Interrumpir en cada bajón la dejaría sin terminar nada, y una
   obra a medias repetida es peor que una obra tarde.

3. **El cuerpo no se interrumpe a sí mismo.** Solo se sueltan actividades de
   `purpose: 'user-request'`. Comer y abrigarse SON la urgencia: soltar justo la
   actividad que la va a salvar sería el peor resultado posible.

4. **El encargo interrumpido se suspende, no se pierde**, con la misma
   maquinaria del ADR 0046: queda con motivo *"lo dejé a medias por una urgencia
   del cuerpo"* y vuelve solo cuando el cuerpo sale del rojo. El cuidador no
   tiene que volver a pedirlo.

5. **Lo dice.** `"Dejo esto un momento: recuperar calor y no puedo seguir así."`
   Abandonar en silencio se lee como que se distrajo o como un bug; decirlo lo
   vuelve una decisión legible.

## Consecuencias

- Deja de poder morirse cumpliendo una orden. El caso que lo motivó —juntar
  troncos a 6 de 50 de calor— ahora suelta el encargo y atiende el frío.
- Un encargo puede tardar mucho más de lo que el cuidador espera si el cuerpo la
  interrumpe varias veces. Es deliberado: sigue siendo mejor que un encargo
  cumplido por una mascota muerta.
- El objetivo interrumpido revive por una vía nueva ("pasó la urgencia del
  cuerpo") que se suma a las del ADR 0046. Todas terminan en el mismo lugar:
  ningún trabajo empezado se pierde por callarse.
- Riesgo conocido: si el cuerpo oscila alrededor del 20%, el encargo puede
  suspenderse y reanudarse repetidas veces. No se vio en la práctica —salir del
  rojo implica haber resuelto algo— y el costo de cada ciclo es un mensaje, no
  trabajo perdido: el programa de la obra ya es reanudable.
- `CRITICAL_NEED_FRACTION` mira hambre y frío. Cualquier señal nueva del cuerpo
  que quiera este trato tiene que sumarse a `bodyInTheRed`, en un solo lugar.
