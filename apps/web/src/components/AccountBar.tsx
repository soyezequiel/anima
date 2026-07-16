import { useState } from 'react';
import type { CloudAccount } from '../auth/cloud.js';
import { loginWithSigner, logoutCloud, nip07Signer } from '../auth/cloud.js';

/**
 * Identidad Nostr en la cabecera. Con launcher (BAL) la conexión es
 * automática al cargar; este control cubre el login "normal" con una
 * extensión NIP-07 y el logout explícito.
 */
export function AccountBar({ account }: { account: CloudAccount | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (account) {
    return (
      <div className="account-bar">
        <span className="account-chip" data-testid="account-chip" title={account.pubkey}>
          ☁ {account.pubkey.slice(0, 8)}… ({account.method})
        </span>
        <button
          data-testid="logout-button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void logoutCloud(account).then(() => window.location.reload());
          }}
        >
          Salir
        </button>
      </div>
    );
  }

  return (
    <div className="account-bar">
      {error && <span className="account-error">{error}</span>}
      <button
        data-testid="login-nostr"
        disabled={busy}
        title="Conecta tu identidad Nostr con una extensión NIP-07; tu progreso se sincroniza con el servidor"
        onClick={() => {
          const signer = nip07Signer();
          if (!signer) {
            setError('No hay extensión Nostr (NIP-07) disponible.');
            return;
          }
          setBusy(true);
          setError(null);
          loginWithSigner(signer, 'nip07')
            .then(() => window.location.reload())
            .catch(() => {
              setError('No se pudo iniciar sesión.');
              setBusy(false);
            });
        }}
      >
        ⚡ Conectar Nostr
      </button>
    </div>
  );
}
