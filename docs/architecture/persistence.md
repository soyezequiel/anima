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

## Fase 8 — backend + Nostr

Principios ya fijados (verificar prácticas actuales del ecosistema antes de
implementar):

- La clave privada **nunca** llega al backend; firma con extensión del
  navegador (NIP-07) o firmante remoto equivalente.
- El backend identifica por clave pública; solicitudes sensibles autenticadas
  por desafío firmado verificable.
- Las credenciales de proveedores de IA no se almacenan sin consentimiento
  explícito.
- Las skills se guardan en el backend pero **jamás se ejecutan allí**.
- SQLite en desarrollo, esquema pensado para migrar a PostgreSQL.

Entidades a almacenar: usuario (pubkey), mascotas, generaciones, apariencia,
estado de mundo, snapshots, memorias consolidadas, hipótesis, objetivos,
skills y versiones, resultados de pruebas, regresiones, informes de muerte,
relación con el usuario.

Nostr no debe bloquear el núcleo: el modo invitado local es suficiente para
demostrar todo el aprendizaje.
