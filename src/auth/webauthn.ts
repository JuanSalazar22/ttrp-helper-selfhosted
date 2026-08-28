import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

/** Thin wrapper so AuthProvider doesn't import @simplewebauthn/browser directly —
 *  keeps the WebAuthn-specific shapes in one place. Web only: the browser's
 *  navigator.credentials API is what backs this; native has no equivalent yet. */
export async function createPasskey(options: any) {
  return startRegistration({ optionsJSON: options });
}

export async function getPasskey(options: any) {
  return startAuthentication({ optionsJSON: options });
}
