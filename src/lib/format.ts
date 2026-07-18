export function formatDate(dateOnly: string) {
  return new Date(`${dateOnly}T00:00:00.000Z`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatInstant(value: string, timeZone = "Asia/Kolkata") {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export function routeName(value: { sourceCode: string; destinationCode: string }) {
  return `${value.sourceCode} to ${value.destinationCode}`;
}
