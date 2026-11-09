import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { Point } from "typeorm";
import { Truck } from "../trucks/truck.entity";

@Entity("trips")
@Index("IDX_trips_truck_id", ["truckId"])
@Check("CHK_trips_time_window", '"latest_arrival_at" > "departure_at"')
export class Trip {
  @PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "PK_trips_id" })
  id!: string;

  @Column({ name: "truck_id", type: "uuid" })
  truckId!: string;

  @ManyToOne(() => Truck, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({
    name: "truck_id",
    foreignKeyConstraintName: "FK_trips_truck_id",
  })
  truck!: Truck;

  @Column({ type: "geography", spatialFeatureType: "Point", srid: 4326 })
  origin!: Point;

  @Column({ type: "geography", spatialFeatureType: "Point", srid: 4326 })
  destination!: Point;

  @Column({ name: "departure_at", type: "timestamptz" })
  departureAt!: Date;

  @Column({ name: "latest_arrival_at", type: "timestamptz" })
  latestArrivalAt!: Date;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamptz",
    default: () => "now()",
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamptz",
    default: () => "now()",
  })
  updatedAt!: Date;
}
