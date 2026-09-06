// Shared helpers for the O-Level Results pages (ResultList / ResultCreate /
// ResultUpdate / ResultView). O-Level here means Form 1 - Form 4
// (secondary, level 1-4) — Form 5/6 (A-Level) results live in their own
// "A-Level Results" pages with their own combination-based division logic.

// Points for each grade (NECTA O-Level style: A is the best = lowest points).
export const GRADE_POINTS = { A: 1, B: 2, C: 3, D: 4, F: 5 };

// A class counts as O-Level when it's a secondary class at Form 1-4.
export function isOLevelClass(schoolClass) {
  if (!schoolClass) return false;
  const level = Number(schoolClass.level);
  return schoolClass.education_level === 'secondary' && level >= 1 && level <= 4;
}

// Only keep O-Level (Form 1-4) classes out of a full class list.
export function filterOLevelClasses(classes) {
  return (classes || []).filter(isOLevelClass);
}

// Division from the total points of the best 7 subjects sat (O-Level rule).
export function computeDivision(totalPoints, subjectCount) {
  if (!subjectCount) return null;
  if (totalPoints <= 17) return 'I';
  if (totalPoints <= 21) return 'II';
  if (totalPoints <= 25) return 'III';
  if (totalPoints <= 33) return 'IV';
  return '0';
}

// Best 7 subjects (lowest points = strongest grades) among those graded.
export function computeBest7Division(gradedResults) {
  const best7 = [...gradedResults]
    .sort((a, b) => (GRADE_POINTS[a.grade] || 0) - (GRADE_POINTS[b.grade] || 0))
    .slice(0, 7);
  const totalPoints = best7.reduce((sum, r) => sum + (GRADE_POINTS[r.grade] || 0), 0);
  return { totalPoints, subjectCount: best7.length, division: computeDivision(totalPoints, best7.length) };
}

// Remarks are derived automatically from the grade — never typed manually.
export function autoRemark(grade) {
  switch ((grade || '').toString().toUpperCase()) {
    case 'A':
      return 'Excellent';
    case 'B':
      return 'Very Good';
    case 'C':
      return 'Good';
    case 'D':
      return 'Satisfactory';
    case 'F':
      return 'Fail';
    default:
      return '—';
  }
}

export function studentFullName(s) {
  if (!s) return '';
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
}
