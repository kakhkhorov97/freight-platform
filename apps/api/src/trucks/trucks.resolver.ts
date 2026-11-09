import { ParseUUIDPipe } from "@nestjs/common";
import { Args, ID, Int, Mutation, Query, Resolver } from "@nestjs/graphql";
import { CurrentUser, requireRole } from "../auth/auth.context";
import type { Principal } from "../auth/auth.service";
import { UserRole } from "../users/user.entity";
import { PaginationArgs, validatePagination } from "../graphql/pagination.args";
import { TruckModel } from "./truck.model";
import { TrucksService } from "./trucks.service";

@Resolver(() => TruckModel)
export class TrucksResolver {
  constructor(private readonly service: TrucksService) {}

  @Mutation(() => TruckModel)
  createTruck(
    @CurrentUser() principal: Principal,
    @Args("plateNumber", { type: () => String }) plateNumber: string,
    @Args("capacityKg", { type: () => Int }) capacityKg: number,
  ): Promise<TruckModel> {
    requireRole(principal, UserRole.Driver);
    return this.service.create(principal.id, plateNumber, capacityKg);
  }

  @Query(() => [TruckModel])
  trucks(
    @Args() page: PaginationArgs,
    @CurrentUser() principal: Principal,
  ): Promise<TruckModel[]> {
    validatePagination(page);
    return this.service.list(page.limit, page.offset, principal);
  }

  @Query(() => TruckModel, { nullable: true })
  truck(
    @Args("id", { type: () => ID }, ParseUUIDPipe) id: string,
    @CurrentUser() principal: Principal,
  ): Promise<TruckModel | null> {
    return this.service.findById(id, principal);
  }
}
