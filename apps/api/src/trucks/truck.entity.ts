import {
  Check,
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
import { User } from "../users/user.entity";

@Entity("trucks")
@Unique("UQ_trucks_plate_number", ["plateNumber"])
@Index("IDX_trucks_driver_id", ["driverId"])
@Check(
  "CHK_trucks_plate_number",
  `"plate_number" = upper("plate_number") AND "plate_number" ~ '^[^[:space:]]+$'`,
)
@Check("CHK_trucks_capacity_kg", '"capacity_kg" > 0')
export class Truck {
  @PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "PK_trucks_id" })
  id!: string;

  @Column({ name: "driver_id", type: "uuid" })
  driverId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({
    name: "driver_id",
    foreignKeyConstraintName: "FK_trucks_driver_id",
  })
  driver!: User;

  @Column({ name: "plate_number", type: "text" })
  plateNumber!: string;

  @Column({ name: "capacity_kg", type: "integer" })
  capacityKg!: number;

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
