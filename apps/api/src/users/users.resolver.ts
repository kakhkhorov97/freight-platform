import { ParseUUIDPipe } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { PaginationArgs, validatePagination } from "../graphql/pagination.args";
import { UserRole } from "./user.entity";
import { UserModel } from "./user.model";
import { UsersService } from "./users.service";

@Resolver(() => UserModel)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [UserModel])
  users(@Args() page: PaginationArgs): Promise<UserModel[]> {
    validatePagination(page);
    return this.usersService.list(page.limit, page.offset);
  }

  @Mutation(() => UserModel)
  createUser(
    @Args("displayName", { type: () => String }) displayName: string,
    @Args("role", { type: () => UserRole }) role: UserRole,
  ): Promise<UserModel> {
    return this.usersService.create(displayName, role);
  }

  @Query(() => UserModel, { nullable: true })
  user(
    @Args("id", { type: () => ID }, ParseUUIDPipe) id: string,
  ): Promise<UserModel | null> {
    return this.usersService.findById(id);
  }
}
