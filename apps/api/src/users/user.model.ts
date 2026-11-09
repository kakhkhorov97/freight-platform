import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";
import { UserRole } from "./user.entity";

registerEnumType(UserRole, { name: "UserRole" });

@ObjectType("User")
export class UserModel {
  @Field(() => ID)
  id!: string;

  @Field()
  displayName!: string;

  @Field(() => UserRole)
  role!: UserRole;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}
