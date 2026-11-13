import { resolve } from "node:path";
import { ApolloDriver } from "@nestjs/apollo";
import type { ApolloDriverConfig } from "@nestjs/apollo";
import { GraphQLModule } from "@nestjs/graphql";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { validateEnvironment } from "./config/environment";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { LoadsModule } from "./loads/loads.module";
import { MatchesModule } from "./matches/matches.module";
import { RoutingModule } from "./routing/routing.module";
import { TripsModule } from "./trips/trips.module";
import { TrucksModule } from "./trucks/trucks.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      // npm workspace commands run in apps/api, so locate the root file explicitly.
      envFilePath: resolve(__dirname, "../../../.env"),
      validate: validateEnvironment,
    }),
    DatabaseModule,
    RoutingModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      graphiql: false,
      includeStacktraceInErrorResponses: false,
    }),
    AuthModule,
    UsersModule,
    TrucksModule,
    TripsModule,
    LoadsModule,
    MatchesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
