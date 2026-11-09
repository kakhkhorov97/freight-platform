import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Trip } from "./trip.entity";
import { TripsResolver } from "./trips.resolver";
import { TripsService } from "./trips.service";

@Module({
  imports: [TypeOrmModule.forFeature([Trip])],
  providers: [TripsResolver, TripsService],
})
export class TripsModule {}
