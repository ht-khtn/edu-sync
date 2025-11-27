export type ParsedRow = {
  student_code?: string | null;
  student_id?: string | null;
  points?: number | null;
  reason?: string | null;
  timestamp?: string | null;
  // UI helpers
  _invalid?: boolean;
  _invalid_msg?: string;
};

// Very small CSV parser (basic) - supports comma and quoted fields
export function parseCSV(text: string): ParsedRow[] {
  if (!text) return [];
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  // ensure at least points + (student_code or student_id)
  const hasStudentField = header.includes("student_code") || header.includes("student_id");
  if (!hasStudentField) throw new Error("CSV phải có trường student_code hoặc student_id");
  if (!header.includes("points")) throw new Error("CSV phải có trường points");

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const obj: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      const key = header[j];
      const val = cols[j] ?? "";
      obj[key] = val;
    }
    const parsed: ParsedRow = {
      student_code: obj["student_code"] || null,
      student_id: obj["student_id"] || null,
      points: obj["points"] !== undefined && obj["points"] !== "" ? Number(obj["points"]) : null,
      reason: obj["reason"] || null,
      timestamp: obj["timestamp"] || null,
    };

    // basic validation
    if ((parsed.student_code === null || parsed.student_code === "") && (parsed.student_id === null || parsed.student_id === "")) {
      parsed._invalid = true;
      parsed._invalid_msg = "Không có student_code hoặc student_id";
    } else if (parsed.points === null || Number.isNaN(parsed.points)) {
      parsed._invalid = true;
      parsed._invalid_msg = "points không hợp lệ";
    }

    rows.push(parsed);
  }
  return rows;
}

function splitCSVLine(line: string): string[] {
  const res: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      res.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  res.push(cur);
  return res;
}
