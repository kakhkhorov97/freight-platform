import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuthentication1794229591603 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "email" varchar(254),
        ADD COLUMN "password_hash" text,
        ADD CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        ADD CONSTRAINT "CHK_users_credentials_pair" CHECK (("email" IS NULL) = ("password_hash" IS NULL))
    `);
    await queryRunner.query(`
      CREATE TABLE "auth_sessions" (
        "token_hash" char(64) NOT NULL,
        "user_id" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL,
        CONSTRAINT "PK_auth_sessions_token_hash" PRIMARY KEY ("token_hash"),
        CONSTRAINT "FK_auth_sessions_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_sessions_user_id" ON "auth_sessions" ("user_id")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "auth_sessions"');
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP CONSTRAINT "CHK_users_credentials_pair",
        DROP CONSTRAINT "UQ_users_email",
        DROP COLUMN "password_hash",
        DROP COLUMN "email"
    `);
  }
}
