import { Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GqlExecutionContext } from "@nestjs/graphql";
import type { GqlContextType } from "@nestjs/graphql";
import { PUBLIC_AUTH } from "./auth.context";
import type { AuthRequest } from "./auth.context";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      context.getType<GqlContextType>() !== "graphql" ||
      this.reflector.get<boolean>(PUBLIC_AUTH, context.getHandler())
    )
      return true;
    const { req } = GqlExecutionContext.create(context).getContext<{
      req: AuthRequest;
    }>();
    req.principal = await this.auth.authenticate(req.headers.authorization);
    return true;
  }
}
