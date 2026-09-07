import { useEffect, useRef, useState } from 'react';

// A searchable "combobox" for picking a Subject: type to filter the list by
// name or code, click a result to select it. Mirrors TeacherSearchSelect so
// the "Register Subject to Class" form gets the same search-then-pick feel
// for both fields, instead of a long plain <select>.
export default function SubjectSearchSelect({
  subjects,
  value,
  onChange,
  placeholder = 'Search subject by name or code...',
  emptyMessage = 'No subjects match your search.',
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const selectedSubject = subjects.find((s) => String(s.id) === String(value));

  // Keep the visible text in sync with the selected subject (e.g. when the
  // value is set from outside, or the subject list reloads).
  useEffect(() => {
    setQuery(selectedSubject ? selectedSubject.name : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, subjects.length]);

  // Close the dropdown when clicking outside of it.
  useEffect(() => {
    function handleClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(selectedSubject ? selectedSubject.name : '');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject]);

  const filtered = subjects.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q)
    );
  });

  function selectSubject(subject) {
    onChange(subject ? String(subject.id) : '');
    setQuery(subject ? subject.name : '');
    setOpen(false);
  }

  const levelLabels = { primary: 'Primary', secondary: 'Secondary', both: 'Both' };

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-black">{emptyMessage}</p>
          )}
          {filtered.map((s) => (
            <button
              type="button"
              key={s.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSubject(s)}
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
        </div>
      )}
    </div>
  );
}
