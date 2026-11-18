interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { message: string; extensions?: { code?: unknown } }[];
}

export class GraphQLRequestError extends Error {
  constructor(
    message: string,
    /** The GraphQL error code, such as `UNAUTHENTICATED`, when the API sent one. */
    readonly code?: string,
  ) {
    super(message);
  }
}

/** True when the API rejected the session token (expired, revoked, or missing). */
export function isUnauthenticated(error: unknown): boolean {
  return (
    error instanceof GraphQLRequestError && error.code === "UNAUTHENTICATED"
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof GraphQLRequestError
    ? error.message
    : "Something went wrong. Please try again.";
}

/** Sends one operation to the API through the dev-server proxy. */
export async function graphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch("/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new GraphQLRequestError("Cannot reach the API. Is it running?");
  }

  let body: GraphQLResponse<T>;
  try {
    body = (await response.json()) as GraphQLResponse<T>;
  } catch {
    throw new GraphQLRequestError(
      `The API returned an unreadable response (HTTP ${response.status}).`,
    );
  }

  const firstError = body.errors?.[0];
  if (firstError) {
    const code = firstError.extensions?.code;
    throw new GraphQLRequestError(
      firstError.message,
      typeof code === "string" ? code : undefined,
    );
  }
  if (!response.ok || body.data == null) {
    throw new GraphQLRequestError(`Request failed (HTTP ${response.status}).`);
  }
  return body.data;
}
