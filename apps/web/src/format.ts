// The database stores UTC; the UI shows Tashkent local time.
const tashkentDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Asia/Tashkent",
});

const kilograms = new Intl.NumberFormat("en-GB", {
  style: "unit",
  unit: "kilogram",
  maximumFractionDigits: 0,
});

export function formatDate(iso: string): string {
  return tashkentDate.format(new Date(iso));
}

export function formatKg(value: number): string {
  return kilograms.format(value);
}
