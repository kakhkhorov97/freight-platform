import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { createDatabaseOptions } from "./database-options";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createDatabaseOptions({
          POSTGRES_HOST: config.get<unknown>("POSTGRES_HOST"),
          POSTGRES_PORT: config.get<unknown>("POSTGRES_PORT"),
          POSTGRES_DB: config.get<unknown>("POSTGRES_DB"),
          POSTGRES_USER: config.get<unknown>("POSTGRES_USER"),
          POSTGRES_PASSWORD: config.get<unknown>("POSTGRES_PASSWORD"),
        }),
    }),
  ],
})
export class DatabaseModule {}
