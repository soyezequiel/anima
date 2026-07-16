# Persistencia

## Fase 7 — local (implementada)

`@anima/persistence` provee:

- `KeyValueStore` asíncrono con `WebStorageKeyValueStore` (localStorage) y
  `MemoryKeyValueStore` (pruebas). Ver ADR 0009.
- `SessionSaveData` versionado: snapshot del mundo, skills, regresiones,
  estado del agente (memoria, objetivos, progreso, eventos), identidad y UI.
  `captureSession` / `applySessionSave` hacen el round-trip; la sesión web
  autoguarda cada 40 ticks, al pausar, al completar la historia y al morir.
- `LegacyReport` (informe de muerte): identidad, causa con certeza, estado
  previo, objetivo activo, últimas acciones, skills usadas, conocimientos,
  hipótesis abiertas, recomendaciones, advertencias, proyectos inconclusos,
  mensajes y artefactos de skills estables.
- Sucesión: `successorIdentity` (generación+1, `ancestorId`) y
  `testimonyFromLegacy` → `agent.adoptLegacy`. La sucesora lee el informe
  como **testimonio, no memoria propia**: el conocimiento entra como
  hipótesis "según X, ..." que puede confirmar o descartar, y cada skill
  heredada se re-evalúa en mundos aislados antes de promoverse.

## Fase 8 — backend + Nostr (implementada)

`apps/api` (Fastify + `node:sqlite`) identifica usuarios por su clave pública
Nostr. Ver ADR 0010.

- Firmantes: **BAL** (`nostr-bal-browser-sdk`, NIP-46 vía launcher) cuando hay
  contexto `lnOrigin`; **NIP-07** (`window.nostr`) como login normal; modo
  invitado local como base — la app completa funciona sin identidad.
- Autenticación por prueba de control de clave: desafío aleatorio de un solo
  uso firmado como evento `kind 22242`, verificado con `nostr-tools`
  (kind, desafío, frescura, firma); la pubkey se deriva del evento
  verificado. La clave privada nunca llega al backend.
- Datos: KV por usuario (`/data/:key`) que espeja `KeyValueStore`, de modo
  que `RemoteKeyValueStore` reutiliza intactos el guardado, los legados y la
  sucesión de la Fase 7. Migración invitado→nube en el primer login.
- Las skills guardadas son datos: el servidor no las interpreta ni ejecuta.
- El esquema SQLite está pensado para migrar a PostgreSQL sin cambiar la API.
