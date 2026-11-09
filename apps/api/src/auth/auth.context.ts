import {
  createParamDecorator,
  ForbiddenException,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import type { UserRole } from "../users/user.entity";
import type { Principal } from "./auth.service";

export interface AuthRequest {
  headers: { authorization?: string };
  ip?: string;
  principal?: Principal;
}

export const PUBLIC_AUTH = Symbol("public-auth");
export const PublicAuth = () => SetMetadata(PUBLIC_AUTH, true);

export const CurrentUser = createParamDecorator((_, context): Principal => {
  const { req } = GqlExecutionContext.create(context).getContext<{
    req: AuthRequest;
  }>();
  if (!req.principal)
    throw new UnauthorizedException("A valid session is required");
  return req.principal;
});

export function requireRole(principal: Principal, role: UserRole): void {
  if (principal.role !== role) {
    throw new ForbiddenException(`This operation requires the ${role} role`);
  }
}
