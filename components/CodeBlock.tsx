import { highlight } from "@/lib/shiki";
import CopyButton from "@/components/CopyButton";

/** A highlighted code block with a copy button (highlighted at build time; no highlighter ships). */
export default async function CodeBlock({
  code,
  lang,
  labels,
}: {
  code: string;
  lang: string;
  labels: { copy: string; copied: string };
}) {
  const html = await highlight(code, lang);
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex justify-end px-3 pt-2">
        <CopyButton text={code} label={labels.copy} copiedLabel={labels.copied} />
      </div>
      <div
        className="overflow-x-auto px-4 pb-4 pt-1 text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
