import { ParseUUIDPipe } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { PaginationArgs, validatePagination } from "../graphql/pagination.args";
import { CreateLoadInput } from "./create-load.input";
import { LoadModel } from "./load.model";
import { LoadsService } from "./loads.service";

@Resolver(() => LoadModel)
export class LoadsResolver {
  constructor(private readonly service: LoadsService) {}

  @Mutation(() => LoadModel)
  createLoad(
    @Args("shipperId", { type: () => ID }, ParseUUIDPipe) shipperId: string,
    @Args("input") input: CreateLoadInput,
  ): Promise<LoadModel> {
    return this.service.create(shipperId, input);
  }

  @Query(() => [LoadModel])
  loads(@Args() page: PaginationArgs): Promise<LoadModel[]> {
    validatePagination(page);
    return this.service.list(page.limit, page.offset);
  }

  @Query(() => LoadModel, { nullable: true })
  load(
    @Args("id", { type: () => ID }, ParseUUIDPipe) id: string,
  ): Promise<LoadModel | null> {
    return this.service.findById(id);
  }
}
