# ADR 0011 — Proveedor real de IA: cuenta de Codex (ChatGPT) vía CLI local

Fecha: 2026-07-16 · Estado: aceptada

## Arquitectura

El usuario conecta su **cuenta de Codex (ChatGPT)** desde el frontend; no hay
claves de API en ningún lado. La cadena es:

```
CodexModelProvider (navegador, transporte inyectable)
  -> POST /ai/complete (API local)
    -> codex exec (CLI local, sandbox read-only, efímero, cwd temporal vacío)
      -> cuenta ChatGPT del usuario (credenciales en ~/.codex, gestionadas
         por el propio CLI: nunca pasan por Ánima)
```

- `GET /ai/status`: instalado / con sesión (cache 15 s).
- `POST /ai/login`: lanza `codex login`, captura la URL de auth.openai.com de
  stdout y la devuelve; el frontend la abre y sondea el estado. El callback
  OAuth va a localhost:1455 (del CLI), no a Ánima.
- `POST /ai/complete`: prompt por stdin, `--output-last-message`,
  `--output-schema`, `-c model_reasoning_effort=low` (ANIMA_CODEX_EFFORT lo
  cambia; ANIMA_CODEX_MODEL fija el modelo).
- El mock determinista sigue siendo el default; el selector vive en la UI y
  se degrada solo si la sesión de Codex desaparece. La app entera funciona
  sin Codex instalado.

Nada del modelo se ejecuta sin pasar por `validateSkillProgram` y por el
evaluador determinista — el mismo contrato que el mock.

## Decisiones que dejó la verificación con la cuenta real

1. **El programa viaja como string (`programJson`)**: el validador de
   esquemas de salida de OpenAI exige tipar cada arreglo anidado
   (`array schema missing items`) y la DSL es recursiva. El sobre JSON se
   valida con `--output-schema`; el programa se parsea y valida en cliente.
2. **Propuestas inválidas no consumen intentos**: no costaron simulación; el
   error de validación vuelve al modelo como observación
   (`programa-invalido: ...`), con tope de 3 reintentos. En la corrida real
   esto fue decisivo: una propuesta con profundidad 8 fue rechazada, el
   modelo respondió "reduje la profundidad eliminando la repetición exterior"
   y su siguiente versión pasó con 100% y fue promovida.
3. **Reactivación por comida NUEVA**: reactivar un objetivo suspendido porque
   "hay comida visible" entraba en bucle cuando esa comida era la misma
   inalcanzable de la suspensión. Ahora exige un comestible que no estaba a
   la vista al suspender (p. ej., lo que produce el árbol).
4. **Pausa automática tras 3 errores seguidos del proveedor**: sin esto, un
   fallo persistente relanzaba `codex exec` en cada tick.
5. **CLI mínimo**: los modelos de cuentas ChatGPT actuales exigen un CLI
   reciente (`gpt-5.6-sol` falló con 0.130.0; funcionó tras actualizar a
   0.144.5). El estado y los errores del puente se muestran en la UI.

## Limitación conocida (post-MVP)

La evidencia de consumo se acredita a la hipótesis interpretada aunque su
texto no hable de comer: en una corrida real la hipótesis "descansar o dormir
recupera energía" terminó confirmada por evidencia de comidas. Corregirlo
requiere atribución semántica de evidencia (o hipótesis estructuradas por
acción), registrado como trabajo futuro.
