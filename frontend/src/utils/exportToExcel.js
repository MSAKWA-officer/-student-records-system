import * as XLSX from 'xlsx';

/**
 * Exports an array of plain objects to an .xlsx file and triggers a download.
 * @param {Array<Object>} rows - e.g. [{ 'Admission No.': '001', 'Student': 'Asha', 'Status': 'Present' }]
 * @param {string} filename - e.g. 'Form-1-Attendance-2026-08-23'
 * @param {string} sheetName - optional sheet name
 */
export function exportToExcel(rows, filename, sheetName = 'Sheet1') {
  if (!rows || rows.length === 0) {
    alert('There is no data to export.');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}