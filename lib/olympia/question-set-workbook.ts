import ExcelJS from "exceljs";

export type ParsedQuestionSetItem = {
  code: string;
  category: string | null;
  question_text: string;
  answer_text: string;
  note: string | null;
  submitted_by: string | null;
  source: string | null;
  image_url: string | null;
  audio_url: string | null;
  order_index: number;
};

function isProbablyUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:");
}

export function normalizeAssetBasename(raw: string): string {
  const value = raw.trim();
  if (!value) return "";

  // Nếu là URL thì không coi là asset local
  if (isProbablyUrl(value)) return "";

  // Loại các placeholder thường gặp
  const upper = value.toUpperCase();
  if (upper === "TBD" || upper === "..." || upper === "-") return "";

  // Lấy basename cuối cùng nếu có đường dẫn
  const withoutQuery = value.split("?")[0] ?? value;
  const parts = withoutQuery.split(/[/\\]/g);
  const base = (parts[parts.length - 1] ?? "").trim();
  return base;
}

/**
 * Parses code format to extract round/question info.
 * Supports formats: KD{i}-{n}, DKA-{n}, VCNV-{n}, VCNV-OTT, CNV, TT{n}, VD-{s}.{n}, CHP-{i}
 * Returns normalized code (uppercase) and metadata.
 */
function parseQuestionCode(rawCode: string): {
  normalizedCode: string;
  isTT: boolean;
  ttNumber?: number;
} {
  const normalized = rawCode.toUpperCase().trim();

  const ttMatch = normalized.match(/^TT(\d+)$/);
  if (ttMatch) {
    return {
      normalizedCode: normalized,
      isTT: true,
      ttNumber: parseInt(ttMatch[1]!, 10),
    };
  }

  return { normalizedCode: normalized, isTT: false };
}

export async function parseQuestionSetWorkbook(buffer: ArrayBuffer | Uint8Array | Buffer) {
  const workbook = new ExcelJS.Workbook();

  // ExcelJS hỗ trợ ArrayBuffer trong browser và Buffer trong Node.
  const loadInput =
    buffer instanceof ArrayBuffer ? buffer : buffer instanceof Uint8Array ? buffer.buffer : buffer;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(loadInput as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("File không có sheet hợp lệ.");
  }

  const items: ParsedQuestionSetItem[] = [];
  const codeSet = new Set<string>();
  let skipped = 0;

  // First pass: collect all rows (9 cột theo mẫu)
  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const cells = Array.from({ length: 9 }, (_, index) => row.getCell(index + 1));
    const values = cells.map((cell) =>
      typeof cell.text === "string" ? cell.text.trim() : String(cell.text || "").trim()
    );
    rows.push(values);
  });

  // Second pass: process rows with TT merge handling
  let i = 0;
  while (i < rows.length) {
    const values = rows[i]!;
    const [
      rawCode,
      rawCategory,
      rawQuestion,
      rawAnswer,
      rawNote,
      rawSender,
      rawSource,
      rawImage,
      rawAudio,
    ] = values;

    const isEmptyRow = values.every((value) => !value || value.length === 0);
    if (isEmptyRow) {
      i += 1;
      continue;
    }

    if (!rawCode || !rawQuestion || !rawAnswer) {
      skipped += 1;
      i += 1;
      continue;
    }

    const codeInfo = parseQuestionCode(rawCode);
    const normalizedCode = codeInfo.normalizedCode;

    if (normalizedCode.length < 3 || normalizedCode.length > 32) {
      skipped += 1;
      i += 1;
      continue;
    }

    if (codeSet.has(normalizedCode)) {
      skipped += 1;
      i += 1;
      continue;
    }

    let mergedQuestion = rawQuestion;
    let mergedAnswer = rawAnswer;
    let mergedNote = rawNote;
    let mergedImage = rawImage;
    let mergedAudio = rawAudio;

    if (codeInfo.isTT) {
      let j = i + 1;
      while (j < rows.length) {
        const nextValues = rows[j]!;
        const nextRawCode = nextValues[0]?.trim() || "";
        const nextRawQuestion = nextValues[2]?.trim() || "";
        const nextRawAnswer = nextValues[3]?.trim() || "";

        const nextCodeInfo = parseQuestionCode(nextRawCode);
        const isContinuation =
          nextRawCode === "" ||
          (codeInfo.isTT && nextCodeInfo.isTT && nextCodeInfo.ttNumber === codeInfo.ttNumber);

        if (!isContinuation || (!nextRawQuestion && !nextRawAnswer)) {
          break;
        }

        if (nextRawQuestion) mergedQuestion = mergedQuestion + "\n" + nextRawQuestion;
        if (nextRawAnswer) mergedAnswer = mergedAnswer + "\n" + nextRawAnswer;
        if (nextValues[4]?.trim()) mergedNote = (mergedNote || "") + "\n" + nextValues[4].trim();
        if (nextValues[7]?.trim()) mergedImage = mergedImage || nextValues[7].trim();
        if (nextValues[8]?.trim()) mergedAudio = mergedAudio || nextValues[8].trim();

        j += 1;
      }

      i = j;
    } else {
      i += 1;
    }

    codeSet.add(normalizedCode);
    items.push({
      code: normalizedCode,
      category: rawCategory?.length ? rawCategory : null,
      question_text: mergedQuestion,
      answer_text: mergedAnswer,
      note: mergedNote?.length ? mergedNote : null,
      submitted_by: rawSender?.length ? rawSender : null,
      source: rawSource?.length ? rawSource : null,
      image_url: mergedImage?.length ? mergedImage : null,
      audio_url: mergedAudio?.length ? mergedAudio : null,
      order_index: items.length,
    });
  }

  return { items, skipped };
}

export function extractRequiredAssetBasenames(items: ParsedQuestionSetItem[]): string[] {
  const required = new Set<string>();
  for (const item of items) {
    const img = item.image_url ? normalizeAssetBasename(item.image_url) : "";
    const aud = item.audio_url ? normalizeAssetBasename(item.audio_url) : "";
    if (img) required.add(img);
    if (aud) required.add(aud);
  }
  return Array.from(required);
}
