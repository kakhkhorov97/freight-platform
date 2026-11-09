import { BadRequestException, ParseUUIDPipe } from "@nestjs/common";
import { Args, ID, Int, Query, Resolver } from "@nestjs/graphql";
import { UserModel } from "./user.model";
import { UsersService } from "./users.service";

@Resolver(() => UserModel)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [UserModel])
  users(
    @Args("limit", { type: () => Int, defaultValue: 20 }) limit: number,
    @Args("offset", { type: () => Int, defaultValue: 0 }) offset: number,
  ): Promise<UserModel[]> {
    if (limit < 1 || limit > 100 || offset < 0) {
      throw new BadRequestException(
        "limit must be 1–100 and offset must be nonnegative",
      );
    }
    return this.usersService.list(limit, offset);
  }

  @Query(() => UserModel, { nullable: true })
  user(
    @Args("id", { type: () => ID }, ParseUUIDPipe) id: string,
  ): Promise<UserModel | null> {
    return this.usersService.findById(id);
  }
}
