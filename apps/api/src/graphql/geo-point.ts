import { BadRequestException } from "@nestjs/common";
import { Field, Float, InputType, ObjectType } from "@nestjs/graphql";
import type { Point } from "typeorm";

@InputType()
export class GeoPointInput {
  @Field(() => Float)
  longitude!: number;

  @Field(() => Float)
  latitude!: number;
}

@ObjectType()
export class GeoPoint {
  @Field(() => [Float])
  coordinates!: number[];
}

export function toGeoPoint({ longitude, latitude }: GeoPointInput): Point {
  if (
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90
  ) {
    throw new BadRequestException(
      "Longitude must be between -180 and 180, and latitude between -90 and 90",
    );
  }
  return { type: "Point", coordinates: [longitude, latitude] };
}
