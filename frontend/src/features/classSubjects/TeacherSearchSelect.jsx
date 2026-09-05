import { useEffect, useRef, useState } from 'react';

// A searchable "combobox" for picking a Teacher: type to filter the list by
// name/staff number, click a result to select it. Used anywhere a Teacher
// needs to be assigned (New Subject Allocation, Change Teacher).
export default function TeacherSearchSelect({ teachers, value, onChange, allowUnassigned = true }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const selectedTeacher = teachers.find((t) => String(t.id) === String(value));

  // Keep the visible text in sync with the selected teacher (e.g. when the
  // value is set from outside, or on first load while editing).
  useEffect(() => {
    setQuery(selectedTeacher ? selectedTeacher.full_name : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, teachers.length]);

  // Close the dropdown when clicking outside of it.
  useEffect(() => {
    function handleClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(selectedTeacher ? selectedTeacher.full_name : '');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeacher]);

  const filtered = teachers.filter((t) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      t.full_name.toLowerCase().includes(q) ||
      (t.staff_number || '').toLowerCase().includes(q)
    );
  });

  function selectTeacher(teacher) {
    onChange(teacher ? String(teacher.id) : '');
    setQuery(teacher ? teacher.full_name : '');
    setOpen(false);
  }

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
        placeholder="Search teacher by name or staff number..."
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {allowUnassigned && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectTeacher(null)}
              className="block w-full px-3 py-2 text-left text-sm text-black hover:bg-blue-50"
            >
              -- Not assigned yet --
            </button>
          )}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-black">No teachers match your search.</p>
          )}
          {filtered.map((t) => (
            <button
              type="button"
              key={t.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectTeacher(t)}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                String(t.id) === String(value) ? 'bg-blue-50 font-medium text-blue-700' : 'text-black'
              }`}
            >
              {t.full_name}
              {t.staff_number ? <span className="text-black"> · {t.staff_number}</span> : null}
              {t.subjectsExpertise?.length ? (
                <span className="block text-xs text-black">
                  Teaches: {t.subjectsExpertise.map((s) => s.name).join(', ')}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
