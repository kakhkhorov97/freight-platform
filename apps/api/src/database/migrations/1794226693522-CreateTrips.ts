import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTrips1794226693522 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "trips" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "truck_id" uuid NOT NULL,
        "origin" geography(Point, 4326) NOT NULL,
        "destination" geography(Point, 4326) NOT NULL,
        "departure_at" timestamptz NOT NULL,
        "latest_arrival_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trips_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_trips_truck_id" FOREIGN KEY ("truck_id") REFERENCES "trucks" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_trips_time_window" CHECK ("latest_arrival_at" > "departure_at")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_trips_truck_id" ON "trips" ("truck_id")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "trips"');
  }
}
