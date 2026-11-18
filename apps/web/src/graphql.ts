interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { message: string }[];
}

export class GraphQLRequestError extends Error {}

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
    throw new GraphQLRequestError(firstError.message);
  }
  if (!response.ok || body.data == null) {
    throw new GraphQLRequestError(`Request failed (HTTP ${response.status}).`);
  }
  return body.data;
}
