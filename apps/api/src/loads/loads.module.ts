import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Load } from "./load.entity";
import { LoadsResolver } from "./loads.resolver";
import { LoadsService } from "./loads.service";

@Module({
  imports: [TypeOrmModule.forFeature([Load])],
  providers: [LoadsResolver, LoadsService],
})
export class LoadsModule {}
