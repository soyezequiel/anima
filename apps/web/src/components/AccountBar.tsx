import { useEffect, useRef, useState } from 'react';
import type { CloudAccount } from '../auth/cloud.js';
import { loginWithSigner, logoutCloud, nip07Signer } from '../auth/cloud.js';
import type { NostrProfile } from '../auth/profile.js';
import {
  fetchProfile,
  forgetCachedProfile,
  npubOf,
  readCachedProfile,
  shortNpub,
} from '../auth/profile.js';
import { useDismissablePanel } from './useDismissablePanel.js';

/**
 * Identidad Nostr en la cabecera. Con launcher (BAL) la conexión es
 * automática al cargar; este control cubre el login "normal" con una
 * extensión NIP-07 y el logout explícito.
 */
export function AccountBar({ account }: { account: CloudAccount | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pubkey = account?.pubkey ?? null;
  const [profile, setProfile] = useState<NostrProfile | null>(() =>
    pubkey ? readCachedProfile(pubkey) : null,
  );
  const [avatarBroken, setAvatarBroken] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  useDismissablePanel(menuRef);

  // El perfil vive en los relés, no en el servidor de Ánima: se busca en
  // segundo plano y el chip se conforma con la npub hasta que llega.
  useEffect(() => {
    if (!pubkey) return;
    let alive = true;
    void fetchProfile(pubkey).then((found) => {
      if (!alive || !found) return;
      setProfile(found);
      setAvatarBroken(false);
    });
    return () => {
      alive = false;
    };
  }, [pubkey]);

  if (account) {
    const picture = avatarBroken ? null : profile?.picture;
    return (
      <div className="account-bar">
        <details className="account-menu" ref={menuRef}>
          <summary
            className={`account-chip${picture ? ' with-avatar' : ''}`}
            data-testid="account-chip"
            aria-label="Tu cuenta"
          >
            {picture ? (
              <img
                className="account-avatar"
                src={picture}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <span aria-hidden="true">☁</span>
            )}
            <span className="account-name">{profile?.name ?? shortNpub(account.pubkey)}</span>
          </summary>
          <div className="account-menu-panel">
            {/* La npub entera y de una pieza: es la identidad, y copiarla es
                lo único que se puede querer hacer con ella. */}
            <small className="account-npub" data-testid="account-npub">
              {npubOf(account.pubkey)}
            </small>
            <button
              data-testid="logout-button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                forgetCachedProfile();
                void logoutCloud(account).then(() => window.location.reload());
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="account-bar">
      {error && <span className="account-error">{error}</span>}
      <button
        data-testid="login-nostr"
        disabled={busy}
        title="Iniciá sesión con tu identidad Nostr (extensión NIP-07); tu progreso se sincroniza con el servidor"
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
        ⚡ Iniciar sesión
      </button>
    </div>
  );
}
