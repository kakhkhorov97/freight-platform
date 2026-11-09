import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTrucks1794226404025 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "trucks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "driver_id" uuid NOT NULL,
        "plate_number" text NOT NULL,
        "capacity_kg" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trucks_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_trucks_driver_id" FOREIGN KEY ("driver_id") REFERENCES "users" ("id") ON DELETE RESTRICT,
        CONSTRAINT "UQ_trucks_plate_number" UNIQUE ("plate_number"),
        CONSTRAINT "CHK_trucks_plate_number" CHECK ("plate_number" = upper("plate_number") AND "plate_number" ~ '^[^[:space:]]+$'),
        CONSTRAINT "CHK_trucks_capacity_kg" CHECK ("capacity_kg" > 0)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_trucks_driver_id" ON "trucks" ("driver_id")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "trucks"');
  }
}
