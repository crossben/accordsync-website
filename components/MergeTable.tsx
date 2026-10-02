import type { Content } from "@/content/types";
import { strategies } from "@/content/facts";

/**
 * The merge-rules table (website.md section 5.4): one row per strategy — name, use
 * for, rule, a tiny before/after example. Rendered from facts.ts while
 * app/docs/merge-rules.md does not exist yet (features.mergeRulesFromAppDocs);
 * each row carries the facts tier, so a strategy only loses its badge when its
 * laws are proven in app/.
 */
export default function MergeTable({ content }: { content: Content["merges"] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[46rem] border-collapse bg-surface text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th scope="col" className="px-4 py-3 font-semibold">
              {content.table.columns.strategy}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {content.table.columns.useFor}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {content.table.columns.rule}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {content.table.columns.example}
            </th>
          </tr>
        </thead>
        <tbody>
          {strategies.map(({ id, tier }) => {
            const row = content.table.rows[id];
            return (
              <tr key={id} className="border-b border-line last:border-b-0 align-top">
                <th scope="row" className="px-4 py-4 text-left">
                  <code className="font-mono text-accent">{id}</code>
                  {tier === "designed" ? (
                    <span className="sr-only"> ({content.planned.label})</span>
                  ) : null}
                </th>
                <td className="px-4 py-4 text-muted">{row.useFor}</td>
                <td className="max-w-[16rem] px-4 py-4 text-muted">{row.rule}</td>
                <td className="px-4 py-4 font-mono text-xs leading-relaxed">
                  <span className="text-muted">{row.before}</span>
                  <span aria-hidden="true" className="mx-1.5 text-accent">
                    →
                  </span>
                  <span>{row.after}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
