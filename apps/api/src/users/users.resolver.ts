import { ForbiddenException, ParseUUIDPipe } from "@nestjs/common";
import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { CurrentUser, requireRole } from "../auth/auth.context";
import type { Principal } from "../auth/auth.service";
import { PaginationArgs, validatePagination } from "../graphql/pagination.args";
import { UserRole } from "./user.entity";
import { UserModel } from "./user.model";
import { UsersService } from "./users.service";

@Resolver(() => UserModel)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [UserModel])
  users(
    @Args() page: PaginationArgs,
    @CurrentUser() principal: Principal,
  ): Promise<UserModel[]> {
    requireRole(principal, UserRole.Admin);
    validatePagination(page);
    return this.usersService.list(page.limit, page.offset);
  }

  @Query(() => UserModel, { nullable: true })
  user(
    @Args("id", { type: () => ID }, ParseUUIDPipe) id: string,
    @CurrentUser() principal: Principal,
  ): Promise<UserModel | null> {
    if (
      principal.role !== UserRole.Admin &&
      principal.id !== id.toLowerCase()
    ) {
      throw new ForbiddenException("You can only read your own user profile");
    }
    return this.usersService.findById(id);
  }
}
