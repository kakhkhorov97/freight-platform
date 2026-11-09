import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLoads1794226693523 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "loads" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "shipper_id" uuid NOT NULL,
        "pickup" geography(Point, 4326) NOT NULL,
        "delivery" geography(Point, 4326) NOT NULL,
        "pickup_window_start" timestamptz NOT NULL,
        "pickup_window_end" timestamptz NOT NULL,
        "weight_kg" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loads_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_loads_shipper_id" FOREIGN KEY ("shipper_id") REFERENCES "users" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_loads_time_window" CHECK ("pickup_window_end" > "pickup_window_start"),
        CONSTRAINT "CHK_loads_weight_kg" CHECK ("weight_kg" > 0)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_loads_shipper_id" ON "loads" ("shipper_id")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "loads"');
  }
}
