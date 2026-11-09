import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Match } from "./match.entity";
import { MatchesResolver } from "./matches.resolver";
import { MatchesService } from "./matches.service";

@Module({
  imports: [TypeOrmModule.forFeature([Match])],
  providers: [MatchesResolver, MatchesService],
})
export class MatchesModule {}
