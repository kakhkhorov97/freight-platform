import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Truck } from "./truck.entity";
import { TrucksResolver } from "./trucks.resolver";
import { TrucksService } from "./trucks.service";

@Module({
  imports: [TypeOrmModule.forFeature([Truck])],
  providers: [TrucksResolver, TrucksService],
})
export class TrucksModule {}
