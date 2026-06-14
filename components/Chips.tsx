"use client";

/** Barra de chips de filtro (controlada). */
export function Chips({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.id}
          className={`chip${value === o.id ? " on" : ""}`}
          onClick={() => onChange(o.id)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
