import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { OsrmClient } from "./osrm-client";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: OsrmClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OsrmClient(config.get<string>("OSRM_BASE_URL")),
    },
  ],
  exports: [OsrmClient],
})
export class RoutingModule {}
