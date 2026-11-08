import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum UserRole {
  Driver = "driver",
  Shipper = "shipper",
  Admin = "admin",
}

@Entity("users")
@Check("CHK_users_display_name_nonempty", 'length(trim("display_name")) > 0')
export class User {
  @PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "PK_users_id" })
  id!: string;

  @Column({ name: "display_name", type: "varchar", length: 100 })
  displayName!: string;

  @Column({ type: "enum", enum: UserRole, enumName: "user_role" })
  role!: UserRole;

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
