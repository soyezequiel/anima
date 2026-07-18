# ADR 0067 — El tope de abrirse paso, y decir lo que no se puede

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

El cuidador avisa que no puede hacer la **cocina**. Al mirar su partida
apareció, primero, una regresión mía del ADR 0066:

> «No encuentro **una fogón de cocina o una encimera** de este lado. Voy a
> abrirme paso por un muro.» — repetido, agujereando el mapa.

Un fogón y una encimera **se fabrican**; no aparecen tiradas detrás de una
pared. Abrirse paso para buscarlas es destruir el mundo persiguiendo algo que
no está en ninguna parte. El ADR 0066 pasaba `missingKinds` —los bloques del
plano— cuando lo que podría estar del otro lado es la materia **base**.

Y debajo, la causa real de la cocina:

```
tabla-de-ramas = 2x rama + 1x fibra
encimera       = 2x tabla-de-ramas
fogón          = 1x tabla-de-ramas + 1x pedernal   →  la cocina son 7 tablas = 14 ramas

qué deja cada cosa al romperse en ese mundo:
  árbol → tronco    arbusto → fibra    roca → piedra
  pino  → tronco    veta    → mineral  refugio → tronco
```

**Nada da ramas.** Las tres iniciales se gastaron y la cocina quedó imposible
para siempre. El cuidador leía «me faltan 3 encimeras» y no tenía forma de
saber que el problema no era de tiempo.

## Decisión

**1. Se busca la materia base, no los bloques del plano.** Lo que podría estar
del otro lado de una pared es una rama, no una encimera. Se aplica la misma
expansión que ya usaba la suspensión (ADR 0057).

**2. Las aperturas tienen tope: tres por encargo.** Abrirse paso sirve para
alcanzar territorio nuevo; si tras varias la materia sigue sin aparecer, el
problema no era el camino.

El tope hacía falta y `isForbidden` no alcanzaba: eso cuenta **fracasos**, y
cada apertura salía bien. Lo que había que limitar eran los **éxitos inútiles**
— un caso que el mecanismo de prohibición no contempla.

**3. Cuando no ve NINGUNA vía para esa materia, lo dice.** Ninguna receta la
produce, nada de lo que ve la deja al romperse, no la recuerda y no la tiene
delante:

> «No veo de dónde sacar una rama: ninguna receta lo hace y nada de lo que veo
> lo deja al romperse. Lo dejo a medias y sigo apenas consiga lo que falta.»

Dos cuidados en esa frase:

- **Se agrega al aviso, no lo reemplaza.** La promesa de retomar sigue siendo
  cierta y es lo que el cuidador necesita oír para poder ayudarla.
- **Va en primera persona** —«no veo de dónde sacar»— porque es un juicio sobre
  lo que ella sabe, no sobre el mundo: puede haber un arbusto del otro lado del
  mapa que todavía no vio.

## Lo que se probó y se descartó

La primera versión **cortaba el reintento** cuando la materia parecía
inalcanzable. Rompió seis pruebas de golpe, y con razón: en los mundos de
prueba la madera **aparece después** —porque el cuidador la trae, porque algo
se rompe— y un mundo pelado hoy no es un mundo pelado para siempre.

«No veo de dónde sacarlo» es un juicio sobre lo que sabe, y lo que sabe cambia.
Sirve para **contarlo**, no para dejar de mirar. Volver a mirar cada dos minutos
es barato; declararlo imposible y dejar de mirar, no.

## Nota de método

La regresión del ADR 0066 la encontré leyendo el chat de la partida real, no
las pruebas: mis tres tests de aquel ADR seguían en verde porque probaban el
caso de la madera, donde la materia base *sí* puede estar detrás de la pared.

Y una trampa propia en las pruebas nuevas: usé el `makeAgent` del bloque de
arriba, que guiona la interpretación de una **choza**. Mis tres casos de cocina
construían otra cosa y pasaban sin probar nada. La interpretación guionada tiene
que ser la del encargo bajo prueba — el diagnóstico salió de imprimir lo que la
mascota decía de verdad, en vez de suponerlo.
