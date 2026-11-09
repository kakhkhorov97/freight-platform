import { BadRequestException } from "@nestjs/common";
import { ArgsType, Field, Int } from "@nestjs/graphql";

@ArgsType()
export class PaginationArgs {
  @Field(() => Int, { defaultValue: 20 })
  limit!: number;

  @Field(() => Int, { defaultValue: 0 })
  offset!: number;
}

export function validatePagination({ limit, offset }: PaginationArgs): void {
  if (limit < 1 || limit > 100 || offset < 0) {
    throw new BadRequestException(
      "limit must be 1–100 and offset must be nonnegative",
    );
  }
}
