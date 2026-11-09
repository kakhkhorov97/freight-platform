import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { User } from "../users/user.entity";

@Entity("auth_sessions")
@Index("IDX_auth_sessions_user_id", ["userId"])
export class AuthSession {
  @PrimaryColumn("char", {
    name: "token_hash",
    length: 64,
    primaryKeyConstraintName: "PK_auth_sessions_token_hash",
  })
  tokenHash!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({
    name: "user_id",
    foreignKeyConstraintName: "FK_auth_sessions_user_id",
  })
  user!: User;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;
}
