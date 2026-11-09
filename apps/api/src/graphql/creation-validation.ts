import { BadRequestException } from "@nestjs/common";

export function validatePositiveKg(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new BadRequestException(
      `${field} must be a positive integer in kilograms`,
    );
  }
}

function parseTimestamp(value: string): Date {
  const pattern =
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u;
  if (!pattern.test(value)) {
    throw new BadRequestException("Use an ISO 8601 timestamp with a timezone");
  }

  const date = new Date(value);
  const day = value.slice(0, 10);
  const midnight = new Date(day + "T00:00:00Z");
  if (
    !Number.isFinite(date.getTime()) ||
    !Number.isFinite(midnight.getTime()) ||
    midnight.toISOString().slice(0, 10) !== day
  ) {
    throw new BadRequestException(
      "The timestamp must be a valid calendar date",
    );
  }
  return date;
}

export function parseTimeWindow(startValue: string, endValue: string) {
  const start = parseTimestamp(startValue);
  const end = parseTimestamp(endValue);
  if (end <= start) {
    throw new BadRequestException("The time window must end after it starts");
  }
  return { start, end };
}
