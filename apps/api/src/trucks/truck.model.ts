import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
  Int,
} from "@nestjs/graphql";

@ObjectType("Truck")
export class TruckModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  driverId!: string;

  @Field(() => String)
  plateNumber!: string;

  @Field(() => Int)
  capacityKg!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}
