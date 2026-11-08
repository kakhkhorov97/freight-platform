import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsers1794148266735 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."user_role" AS ENUM ('driver', 'shipper', 'admin')
    `);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "display_name" varchar(100) NOT NULL,
        "role" "public"."user_role" NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_users_display_name_nonempty" CHECK (length(trim("display_name")) > 0)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "users"');
    await queryRunner.query('DROP TYPE "public"."user_role"');
  }
}
