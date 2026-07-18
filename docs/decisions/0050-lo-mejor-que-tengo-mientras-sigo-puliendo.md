# ADR 0050 — Lo mejor que tengo mientras sigo puliendo

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

El evaluador exige **100% de éxito** para promover una habilidad a estable
(`successThreshold: 1`). Una sola falla en cuarenta mundos de práctica y la
versión se rechaza, se archiva y deja de existir a efectos prácticos: no se
puede ejecutar ni una vez.

La regla tiene una buena razón detrás. Una habilidad estable se ejecuta después
**sin pensar** —es el atajo que evita consultar al modelo por cada tick—, así
que una poco confiable no es una molestia: es una trampa silenciosa que falla
cuando nadie está mirando.

Pero en una partida observada se vio el costo del absoluto:

```
«conseguir calor» v2 logró 95% · corrigiendo (intento 3 de 8)
```

Cada intento tarda ~1:13 con el proveedor real. Mientras pulía del 95% al 100%,
el frío —lo que esa misma habilidad resuelve— le seguía bajando. **La generación
anterior murió congelada en el tick 1417 justo después de alcanzar por fin
`conseguir-calor v3 stable`.** Llegó a la perfección tarde, teniendo desde hacía
rato un programa que funcionaba 19 de cada 20 veces.

El problema no es el umbral. Es que **la vara no sabe que el cuerpo se está
muriendo**, y que "no es perfecta" se estaba tratando como "no sirve".

## Decisión

1. **Aparece el estado `provisional`.** Una versión rechazada que igual funciona
   se guarda como lo mejor que tiene, en vez de archivarse.

2. **No se toca la vara de lo estable.** `successThreshold` sigue en 100%. Una
   provisional NO es estable, no aparece en `findStable`, y el ciclo de
   desarrollo **sigue corrigiéndola**: encontrar una provisional no da el
   problema por resuelto ni detiene la práctica.

3. **Se usa solo si no hay nada mejor.** `findUsable` devuelve la estable y, si
   no hay, la mejor provisional. El orden no es negociable.

4. **Tres condiciones para quedar provisional**, y la tercera es la importante:
   - que de verdad se haya medido (sin casos concluyentes no sabemos nada);
   - que funcione en la mayoría de los mundos (`provisionalThreshold: 0.6`), no
     apenas en alguno;
   - que **no viole invariantes del mundo**. Eso no se negocia por urgencia:
     una habilidad que rompe reglas no es "imperfecta", es inadmisible, y
     usarla porque hay apuro sería exactamente el atajo que un evaluador
     independiente existe para impedir.

5. **Lo mejor es lo mejor MEDIDO, no lo último intentado.** Una v2 que empeoró
   no destrona a la v1 que iba mejor. Sin esto, seguir puliendo podía dejarla
   peor armada que antes de empezar.

6. **Se dice.** El evento `skill.provisional` y una tarjeta ámbar en el chat —
   «La uso aunque no esté probada»— dejan claro que está corriendo algo con
   reservas. Usar en silencio lo que falla 1 de cada 20 veces sería vender por
   probado lo que no lo está.

7. **Solo para sus propios motivos.** Hambre y frío usan `findUsable`: ahí
   quedarse quieta es morirse. Un pedido del cuidador sigue exigiendo estable —
   no hay urgencia que lo justifique, y ella puede decir que todavía no le sale
   bien.

## Consecuencias

- Deja de poder morirse con la solución en la mano. El caso que lo motivó —95%
  descartado mientras se congelaba— ahora se usa.
- El ciclo de ocho intentos deja de ser tiempo muerto: desde la primera versión
  razonable ya tiene con qué defenderse mientras el resto de los intentos
  corren.
- Contrapartida aceptada: puede ejecutar una habilidad que falle 1 de cada 20
  veces. Ese fallo no se pierde — el caso queda como regresión y la próxima
  versión tendrá que superarlo.
- Las regresiones se siguen registrando igual que antes: quedar provisional no
  perdona ningún fallo, solo evita tirar el programa.
- Queda pendiente (fuera de este ADR): que el número de intentos se ajuste a la
  urgencia. Hoy son ocho, tarde o temprano; con el cuerpo en rojo quizá deberían
  ser menos, o correr más espaciados.
