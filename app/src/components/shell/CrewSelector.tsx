const CREW = ["C001", "C002", "C003", "C004", "GUEST"]; // IDs only, never names (docs/schemas.md)

// Text options; the selected crew ID in inverse video.
export function CrewSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <span role="radiogroup" aria-label="crew" className="whitespace-pre">
      <span className="text-dim">crew: </span>
      {CREW.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={id === value}
          onClick={() => onChange(id)}
          className={`px-1 ${id === value ? "bg-fg text-bg" : "hover:text-ok"}`}
        >
          {id}
        </button>
      ))}
    </span>
  );
}
