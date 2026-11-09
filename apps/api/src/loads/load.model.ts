import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
} from "@nestjs/graphql";
import { GeoPoint } from "../graphql/geo-point";

@ObjectType("Load")
export class LoadModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  shipperId!: string;

  @Field(() => GeoPoint)
  pickup!: GeoPoint;

  @Field(() => GeoPoint)
  delivery!: GeoPoint;

  @Field(() => GraphQLISODateTime)
  pickupWindowStart!: Date;

  @Field(() => GraphQLISODateTime)
  pickupWindowEnd!: Date;

  @Field(() => Int)
  weightKg!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}
