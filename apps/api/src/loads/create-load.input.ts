import { Field, InputType, Int } from "@nestjs/graphql";
import { GeoPointInput } from "../graphql/geo-point";

@InputType()
export class CreateLoadInput {
  @Field(() => GeoPointInput)
  pickup!: GeoPointInput;

  @Field(() => GeoPointInput)
  delivery!: GeoPointInput;

  @Field(() => String)
  pickupWindowStart!: string;

  @Field(() => String)
  pickupWindowEnd!: string;

  @Field(() => Int)
  weightKg!: number;
}
