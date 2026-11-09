import { ParseUUIDPipe } from "@nestjs/common";
import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { CurrentUser } from "../auth/auth.context";
import type { Principal } from "../auth/auth.service";
import { PaginationArgs, validatePagination } from "../graphql/pagination.args";
import { MatchModel } from "./match.model";
import { MatchesService } from "./matches.service";

@Resolver(() => MatchModel)
export class MatchesResolver {
  constructor(private readonly service: MatchesService) {}

  @Query(() => [MatchModel])
  matches(
    @Args() page: PaginationArgs,
    @CurrentUser() principal: Principal,
  ): Promise<MatchModel[]> {
    validatePagination(page);
    return this.service.list(page.limit, page.offset, principal);
  }

  @Query(() => MatchModel, { nullable: true })
  match(
    @Args("id", { type: () => ID }, ParseUUIDPipe) id: string,
    @CurrentUser() principal: Principal,
  ): Promise<MatchModel | null> {
    return this.service.findById(id, principal);
  }
}
