import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { Load } from "../loads/load.entity";
import { Trip } from "../trips/trip.entity";

@Entity("matches")
@Unique("UQ_matches_trip_load", ["tripId", "loadId"])
@Index("IDX_matches_load_id", ["loadId"])
export class Match {
  @PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "PK_matches_id" })
  id!: string;

  @Column({ name: "trip_id", type: "uuid" })
  tripId!: string;

  @ManyToOne(() => Trip, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({
    name: "trip_id",
    foreignKeyConstraintName: "FK_matches_trip_id",
  })
  trip!: Trip;

  @Column({ name: "load_id", type: "uuid" })
  loadId!: string;

  @ManyToOne(() => Load, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({
    name: "load_id",
    foreignKeyConstraintName: "FK_matches_load_id",
  })
  load!: Load;

  @Column({ name: "driver_confirmed_at", type: "timestamptz", nullable: true })
  driverConfirmedAt: Date | null = null;

  @Column({ name: "shipper_confirmed_at", type: "timestamptz", nullable: true })
  shipperConfirmedAt: Date | null = null;

  get isFinal(): boolean {
    return this.driverConfirmedAt !== null && this.shipperConfirmedAt !== null;
  }

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
