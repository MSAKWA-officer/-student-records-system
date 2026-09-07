import { useEffect, useRef, useState } from 'react';

// A searchable "combobox" for picking an EXISTING school-wide subject while
// registering a subject to a class: type to filter by name/code, click a
// result to select it. If nothing matches, keep typing and submitting the
// form will create that as a brand-new subject instead (handled by the
// parent form) — this box only helps you find and reuse one that already
// exists, so you don't accidentally create a duplicate like a second
// "Mathematics".
export default function SubjectPickerSelect({
  subjects,
  value,
  query,
  onQueryChange,
  onSelect,
  placeholder = 'Search existing subjects by name or code, or type a new subject name...',
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? subjects.filter(
        (s) => s.name.toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q)
      )
    : subjects;

  const levelLabels = { primary: 'Primary', secondary: 'Secondary', both: 'Both' };
  const exactMatch = subjects.some((s) => s.name.trim().toLowerCase() === q);

  function pick(subject) {
    onSelect(subject);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-black">
              No existing subject matches — submitting will create a new subject.
            </p>
          )}
          {filtered.map((s) => (
            <button
              type="button"
              key={s.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                String(s.id) === String(value) ? 'bg-blue-50 font-medium text-blue-700' : 'text-black'
              }`}
            >
              {s.name}
              {s.code ? <span className="text-black"> · {s.code}</span> : null}
              {s.education_level ? (
                <span className="block text-xs text-black">
                  {levelLabels[s.education_level] || s.education_level}
                </span>
              ) : null}
            </button>
          ))}
          {q && !exactMatch && (
            <div className="border-t border-slate-100 px-3 py-2 text-xs text-black">
              Keep "{query}" and save to create it as a new subject.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
