import { version } from "@/content/facts";

/** The status line with the version and the release date, written the way each language writes dates. */
export function statusLine(template: string, lang: "en" | "fr"): string {
  const date = new Date(`${version.date}T00:00:00Z`).toLocaleDateString(
    lang === "fr" ? "fr-FR" : "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  );
  return template.replace("{version}", version.number).replace("{date}", date);
}
