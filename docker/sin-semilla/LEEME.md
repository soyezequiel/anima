Esta carpeta está vacía a propósito.

Es lo que el `docker-compose.yml` monta en `/semilla/codex` cuando **no** le
apuntás `ANIMA_CODEX_SEED` a tu `~/.codex`. Así el contenedor arranca sin
ninguna credencial adentro: no es que no las use — es que no las tiene.

Con la canilla cerrada (ADR 0089) ése es el caso normal. Quien quiera mente real
trae su propia API OpenAI-compatible y la llama desde su navegador, sin pasar
por el servidor.

Si querés volver al modo «mi cuenta, en mi máquina, para mí», poné las dos cosas
en el `.env`:

    ANIMA_CLI_LOCAL=1
    ANIMA_CODEX_SEED=C:/Users/TU_USUARIO/.codex
