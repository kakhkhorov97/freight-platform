import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMatches1794227399278 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "matches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "trip_id" uuid NOT NULL,
        "load_id" uuid NOT NULL,
        "driver_confirmed_at" timestamptz,
        "shipper_confirmed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_matches_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_matches_trip_id" FOREIGN KEY ("trip_id") REFERENCES "trips" ("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_matches_load_id" FOREIGN KEY ("load_id") REFERENCES "loads" ("id") ON DELETE RESTRICT,
        CONSTRAINT "UQ_matches_trip_load" UNIQUE ("trip_id", "load_id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_matches_load_id" ON "matches" ("load_id")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "matches"');
  }
}
