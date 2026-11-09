import { ParseUUIDPipe } from "@nestjs/common";
import { Args, ID, Int, Mutation, Query, Resolver } from "@nestjs/graphql";
import { PaginationArgs, validatePagination } from "../graphql/pagination.args";
import { TruckModel } from "./truck.model";
import { TrucksService } from "./trucks.service";

@Resolver(() => TruckModel)
export class TrucksResolver {
  constructor(private readonly service: TrucksService) {}

  @Mutation(() => TruckModel)
  createTruck(
    @Args("driverId", { type: () => ID }, ParseUUIDPipe) driverId: string,
    @Args("plateNumber", { type: () => String }) plateNumber: string,
    @Args("capacityKg", { type: () => Int }) capacityKg: number,
  ): Promise<TruckModel> {
    return this.service.create(driverId, plateNumber, capacityKg);
  }

  @Query(() => [TruckModel])
  trucks(@Args() page: PaginationArgs): Promise<TruckModel[]> {
    validatePagination(page);
    return this.service.list(page.limit, page.offset);
  }

  @Query(() => TruckModel, { nullable: true })
  truck(
    @Args("id", { type: () => ID }, ParseUUIDPipe) id: string,
  ): Promise<TruckModel | null> {
    return this.service.findById(id);
  }
}
