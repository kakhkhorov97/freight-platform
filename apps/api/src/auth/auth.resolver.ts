import {
  Args,
  Context,
  Field,
  GraphQLISODateTime,
  Mutation,
  ObjectType,
  Resolver,
} from "@nestjs/graphql";
import { UserRole } from "../users/user.entity";
import { UserModel } from "../users/user.model";
import { CurrentUser, PublicAuth } from "./auth.context";
import type { AuthRequest } from "./auth.context";
import { AuthService } from "./auth.service";
import type { Principal } from "./auth.service";

@ObjectType()
class LoginSession {
  @Field()
  token!: string;

  @Field(() => GraphQLISODateTime)
  expiresAt!: Date;
}

@Resolver()
export class AuthResolver {
  constructor(private readonly auth: AuthService) {}

  @PublicAuth()
  @Mutation(() => UserModel)
  register(
    @Context("req") req: AuthRequest,
    @Args("email") email: string,
    @Args("password") password: string,
    @Args("displayName") displayName: string,
    @Args("role", { type: () => UserRole }) role: UserRole,
  ): Promise<UserModel> {
    return this.auth.register(
      req.ip ?? "unknown",
      email,
      password,
      displayName,
      role,
    );
  }

  @PublicAuth()
  @Mutation(() => LoginSession)
  login(
    @Context("req") req: AuthRequest,
    @Args("email") email: string,
    @Args("password") password: string,
  ): Promise<LoginSession> {
    return this.auth.login(req.ip ?? "unknown", email, password);
  }

  @Mutation(() => Boolean)
  logout(@CurrentUser() principal: Principal): Promise<boolean> {
    return this.auth.logout(principal);
  }
}
