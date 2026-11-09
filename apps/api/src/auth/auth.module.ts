import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../users/user.entity";
import { AuthGuard } from "./auth.guard";
import { AuthResolver } from "./auth.resolver";
import { AuthService } from "./auth.service";
import { AuthSession } from "./session.entity";

@Module({
  imports: [TypeOrmModule.forFeature([User, AuthSession])],
  providers: [
    AuthService,
    AuthResolver,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
