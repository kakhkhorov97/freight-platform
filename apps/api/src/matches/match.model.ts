import { Field, GraphQLISODateTime, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("Match")
export class MatchModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  tripId!: string;

  @Field(() => ID)
  loadId!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  driverConfirmedAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  shipperConfirmedAt!: Date | null;

  @Field(() => Boolean)
  isFinal!: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}
