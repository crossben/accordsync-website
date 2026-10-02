import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose';
import type { AuthConfig, Claims } from './define';

export class AuthError extends Error {
  override readonly name = 'AuthError';
}

export type Verifier = (authorization: string | undefined) => Promise<Claims>;

/** Verifies `Authorization: Bearer <jwt>` against the app's JWKS (or a dev secret). */
export function createVerifier(auth: AuthConfig): Verifier {
  const key: Uint8Array | JWTVerifyGetKey =
    'jwksUrl' in auth
      ? createRemoteJWKSet(new URL(auth.jwksUrl))
      : new TextEncoder().encode(auth.hs256Secret);
  const options = {
    ...(auth.issuer ? { issuer: auth.issuer } : {}),
    ...(auth.audience ? { audience: auth.audience } : {}),
    ...('hs256Secret' in auth ? { algorithms: ['HS256'] } : {}),
  };
  return async (authorization) => {
    const token = /^Bearer (.+)$/.exec(authorization ?? '')?.[1];
    if (!token) throw new AuthError('missing bearer token');
    let payload: Record<string, unknown>;
    try {
      // jose's overloads differ only in the key type; both branches are valid.
      payload = (
        typeof key === 'function'
          ? await jwtVerify(token, key, options)
          : await jwtVerify(token, key, options)
      ).payload;
    } catch (e) {
      throw new AuthError(`invalid token: ${(e as Error).message}`);
    }
    if (typeof payload.sub !== 'string' || payload.sub === '') {
      throw new AuthError('token has no "sub" claim');
    }
    return payload as Claims;
  };
}
