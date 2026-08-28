// The web build's nginx proxies /api/* to the api container (same origin,
// required for WebAuthn), so a relative path works for any self-hoster's
// domain with zero build-time configuration. Override for local dev when
// running `expo start --web` against an api container on a different port.
export const apiConfig = {
  url: process.env.EXPO_PUBLIC_API_URL || '/api',
};
