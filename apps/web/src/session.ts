import { graphql } from "./graphql";

export interface Session {
  token: string;
  expiresAt: string;
}

export type RegisterRole = "Driver" | "Shipper";

const STORAGE_KEY = "freight.session";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (
      typeof parsed.token !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      Date.parse(parsed.expiresAt) <= Date.now()
    ) {
      clearSession();
      return null;
    }
    return { token: parsed.token, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function saveSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage can be unavailable (private mode); the session lasts until reload.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

export async function login(email: string, password: string): Promise<Session> {
  const data = await graphql<{ login: Session }>(
    `
      mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password) {
          token
          expiresAt
        }
      }
    `,
    { email, password },
  );
  saveSession(data.login);
  return data.login;
}

export async function register(
  email: string,
  password: string,
  displayName: string,
  role: RegisterRole,
): Promise<void> {
  await graphql(
    `
      mutation Register(
        $email: String!
        $password: String!
        $displayName: String!
        $role: UserRole!
      ) {
        register(
          email: $email
          password: $password
          displayName: $displayName
          role: $role
        ) {
          id
        }
      }
    `,
    { email, password, displayName, role },
  );
}

/** Revokes the server session; the local copy is cleared even if that fails. */
export async function logout(session: Session): Promise<void> {
  try {
    await graphql(
      `
        mutation Logout {
          logout
        }
      `,
      {},
      session.token,
    );
  } finally {
    clearSession();
  }
}
