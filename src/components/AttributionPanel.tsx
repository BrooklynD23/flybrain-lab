import type { Attribution } from "../contracts/manifest.ts";

export interface AttributionPanelProps {
  /** `manifest.attribution` — every data source, licence and citation. */
  attribution: Attribution[];
}

/**
 * Collapsible data-source credits. Native <details>; every entry shows its
 * name, licence, link and citation (RESEARCH-03 via the manifest).
 */
export function AttributionPanel({ attribution }: AttributionPanelProps) {
  return (
    <details>
      <summary>Data sources and licences — Non-commercial demo</summary>
      <ul>
        {attribution.map((entry) => (
          <li key={entry.name}>
            <a href={entry.url} target="_blank" rel="noreferrer">
              {entry.name}
            </a>{" "}
            <span>({entry.licence})</span>
            <p>{entry.citation}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
