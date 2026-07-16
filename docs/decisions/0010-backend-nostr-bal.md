# ADR 0010 — Backend con identidad Nostr: BAL + NIP-07, desafío firmado y KV por usuario

Fecha: 2026-07-16 · Estado: aceptada

## Firmantes: BAL primero, NIP-07 como login normal, invitado como base

Por indicación del proyecto, la integración Nostr usa
[`nostr-bal-browser-sdk`](https://github.com/soyezequiel/herramientas-nostr)
(Bunker Auto Login): un firmante NIP-46 provisto por el launcher a través de
un SharedWorker propio del origen, sin exponer ni persistir claves privadas.
Se siguió su contrato de integración al pie de la letra: captura de
`lnOrigin` antes de limpiar la URL (borrando solo esa clave), `gameId`
`anima` con permisos mínimos (`get_public_key`, `sign_event:22242`), pubkey
obtenida una sola vez, comparación con el sujeto verificado de la sesión
guardada antes de mutar estado, y `logout({ forgetLauncher: true })` solo en
el logout explícito.

Cuando no hay contexto de launcher, el login "normal" es NIP-07
(`window.nostr`, extensión del navegador) con el mismo flujo de desafío. El
modo invitado (persistencia local) sigue siendo la base: la app funciona
completa sin identidad ni servidor.

## Autenticación: prueba de control de clave, nunca una pubkey suelta

Flujo del contrato BAL (estilo NIP-42):

1. `POST /auth/challenge` → desafío aleatorio (32 bytes) de un solo uso,
   TTL 120 s.
2. El cliente firma un evento `kind 22242` con el tag `["challenge", ...]`.
3. `POST /auth/verify` valida kind, desafío existente/no usado/no vencido,
   frescura del `created_at`, y la firma con `verifyEvent` de `nostr-tools`;
   consume el desafío y deriva la pubkey **del evento verificado**.
4. Emite un token de sesión opaco (30 días) ligado a esa pubkey; el cliente
   guarda `{token, pubkey, method}` y verifica el sujeto contra `/me` en cada
   arranque antes de reutilizarlo.

La clave privada jamás llega al backend; el token no la contiene ni deriva.
Se consideró NIP-98 (HTTP Auth por petición) y se descartó por ahora: el
contrato BAL prescribe desafío+token y firmar cada petición multiplicaría
los viajes al firmante remoto.

## Almacenamiento: KV por usuario que espeja KeyValueStore

`node:sqlite` (embebido, sin dependencias nativas) con tablas users,
challenges, tokens y user_data(pubkey, key, value). La API
(`GET/PUT/DELETE /data/:key`) espeja la interfaz `KeyValueStore` del
cliente, así `RemoteKeyValueStore` es un adaptador trivial y **todo** lo de
la Fase 7 (guardado, legados, sucesión) funciona contra la nube sin cambios.
Las tablas estructuradas (mascotas, skills consultables) llegarán cuando
exista una consulta que las necesite; el esquema migra a PostgreSQL sin
cambiar la API. Las skills almacenadas son datos: el servidor no las
interpreta ni ejecuta.

En el primer login, el progreso de invitado se copia a la nube una sola vez
(si la cuenta remota está vacía).

## Gotchas de navegador encontrados

- `fetch` no puede guardarse desligado (`Illegal invocation`): el default de
  `RemoteKeyValueStore` lo envuelve en una arrow function.
- Fastify responde 400 a un `DELETE` con `content-type: application/json` y
  cuerpo vacío: el content-type solo se envía en `PUT`.
