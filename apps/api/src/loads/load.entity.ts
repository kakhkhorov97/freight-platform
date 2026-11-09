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
import { User } from "../users/user.entity";

@Entity("loads")
@Index("IDX_loads_shipper_id", ["shipperId"])
@Check("CHK_loads_time_window", '"pickup_window_end" > "pickup_window_start"')
@Check("CHK_loads_weight_kg", '"weight_kg" > 0')
export class Load {
  @PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "PK_loads_id" })
  id!: string;

  @Column({ name: "shipper_id", type: "uuid" })
  shipperId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({
    name: "shipper_id",
    foreignKeyConstraintName: "FK_loads_shipper_id",
  })
  shipper!: User;

  @Column({ type: "geography", spatialFeatureType: "Point", srid: 4326 })
  pickup!: Point;

  @Column({ type: "geography", spatialFeatureType: "Point", srid: 4326 })
  delivery!: Point;

  @Column({ name: "pickup_window_start", type: "timestamptz" })
  pickupWindowStart!: Date;

  @Column({ name: "pickup_window_end", type: "timestamptz" })
  pickupWindowEnd!: Date;

  @Column({ name: "weight_kg", type: "integer" })
  weightKg!: number;

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
