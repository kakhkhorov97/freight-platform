import { Field, GraphQLISODateTime, ID, ObjectType } from "@nestjs/graphql";

import { GeoPoint } from "../graphql/geo-point";

@ObjectType("Trip")
export class TripModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  truckId!: string;

  @Field(() => GeoPoint)
  origin!: GeoPoint;

  @Field(() => GeoPoint)
  destination!: GeoPoint;

  @Field(() => GraphQLISODateTime)
  departureAt!: Date;

  @Field(() => GraphQLISODateTime)
  latestArrivalAt!: Date;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}
