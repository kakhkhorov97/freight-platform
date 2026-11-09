import { Field, InputType } from "@nestjs/graphql";
import { GeoPointInput } from "../graphql/geo-point";

@InputType()
export class CreateTripInput {
  @Field(() => GeoPointInput)
  origin!: GeoPointInput;

  @Field(() => GeoPointInput)
  destination!: GeoPointInput;

  @Field(() => String)
  departureAt!: string;

  @Field(() => String)
  latestArrivalAt!: string;
}
