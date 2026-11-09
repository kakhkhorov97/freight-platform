import { resolve } from "node:path";
import { ApolloDriver } from "@nestjs/apollo";
import type { ApolloDriverConfig } from "@nestjs/apollo";
import { GraphQLModule } from "@nestjs/graphql";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnvironment } from "./config/environment";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      // npm workspace commands run in apps/api, so locate the root file explicitly.
      envFilePath: resolve(__dirname, "../../../.env"),
      validate: validateEnvironment,
    }),
    DatabaseModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      graphiql: false,
      includeStacktraceInErrorResponses: false,
    }),
    UsersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
