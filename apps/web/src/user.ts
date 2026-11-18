import { graphql } from "./graphql";

export type UserRole = "Driver" | "Shipper" | "Admin";

export interface CurrentUser {
  id: string;
  displayName: string;
  role: UserRole;
}

export async function fetchMe(token: string): Promise<CurrentUser> {
  const data = await graphql<{ me: CurrentUser }>(
    `
      query Me {
        me {
          id
          displayName
          role
        }
      }
    `,
    {},
    token,
  );
  return data.me;
}
