import { ParseUUIDPipe } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { CurrentUser, requireRole } from "../auth/auth.context";
import type { Principal } from "../auth/auth.service";
import { UserRole } from "../users/user.entity";
import { PaginationArgs, validatePagination } from "../graphql/pagination.args";
import { CreateTripInput } from "./create-trip.input";
import { TripModel } from "./trip.model";
import { TripsService } from "./trips.service";

@Resolver(() => TripModel)
export class TripsResolver {
  constructor(private readonly service: TripsService) {}

  @Mutation(() => TripModel)
  createTrip(
    @Args("truckId", { type: () => ID }, ParseUUIDPipe) truckId: string,
    @Args("input") input: CreateTripInput,
    @CurrentUser() principal: Principal,
  ): Promise<TripModel> {
    requireRole(principal, UserRole.Driver);
    return this.service.create(truckId, principal.id, input);
  }

  @Query(() => [TripModel])
  trips(@Args() page: PaginationArgs): Promise<TripModel[]> {
    validatePagination(page);
    return this.service.list(page.limit, page.offset);
  }

  @Query(() => TripModel, { nullable: true })
  trip(
    @Args("id", { type: () => ID }, ParseUUIDPipe) id: string,
  ): Promise<TripModel | null> {
    return this.service.findById(id);
  }
}
