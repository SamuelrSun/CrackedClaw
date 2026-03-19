/**
 * Dataset parser — robust CSV parsing and column detection.
 */

export interface DatasetRow {
  [key: string]: string;
}

export interface ParsedDataset {
  columns: string[];
  rows: DatasetRow[];
  row_count: number;
}

/**
 * Parse CSV text into a structured dataset.
 * Handles:
 * - Quoted fields (commas inside quotes)
 * - Newlines inside quoted fields
 * - CRLF and LF line endings
 * - Leading/trailing whitespace trimming
 * - First row as column headers
 */
export function parseCSV(csvText: string): ParsedDataset {
  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records = parseCSVRecords(text);

  if (records.length === 0) {
    return { columns: [], rows: [], row_count: 0 };
  }

  // First record is the header row
  const columns = records[0].map((h) => h.trim()).filter(Boolean);
  const rows: DatasetRow[] = [];

  for (let i = 1; i < records.length; i++) {
    const record = records[i];
    // Skip entirely empty rows
    if (record.every((v) => !v.trim())) continue;

    const row: DatasetRow = {};
    for (let j = 0; j < columns.length; j++) {
      row[columns[j]] = (record[j] ?? '').trim();
    }
    rows.push(row);
  }

  return { columns, rows, row_count: rows.length };
}

/**
 * Low-level CSV record parser. Returns array of records (each record is array of fields).
 */
function parseCSVRecords(text: string): string[][] {
  const records: string[][] = [];
  let pos = 0;
  const len = text.length;

  while (pos < len) {
    const record = parseRecord();
    records.push(record);
  }

  return records;

  function parseRecord(): string[] {
    const fields: string[] = [];
    while (pos < len) {
      fields.push(parseField());
      if (pos < len && text[pos] === ',') {
        pos++; // skip comma, continue record
      } else {
        // end of record: newline or EOF
        if (pos < len && text[pos] === '\n') {
          pos++;
        }
        break;
      }
    }
    return fields;
  }

  function parseField(): string {
    if (pos < len && text[pos] === '"') {
      return parseQuotedField();
    }
    return parseUnquotedField();
  }

  function parseQuotedField(): string {
    pos++; // skip opening quote
    let value = '';
    while (pos < len) {
      if (text[pos] === '"') {
        pos++;
        if (pos < len && text[pos] === '"') {
          // Escaped quote
          value += '"';
          pos++;
        } else {
          // End of quoted field
          break;
        }
      } else {
        value += text[pos];
        pos++;
      }
    }
    return value;
  }

  function parseUnquotedField(): string {
    let value = '';
    while (pos < len && text[pos] !== ',' && text[pos] !== '\n') {
      value += text[pos];
      pos++;
    }
    return value;
  }
}

/**
 * Try to detect which column contains LinkedIn profile URLs.
 */
export function detectLinkedInColumn(
  columns: string[],
  sampleRows: DatasetRow[]
): string | null {
  // Check column name first
  const linkedInNamePatterns = /linkedin|li_url|profile_url|linkedin_url/i;
  for (const col of columns) {
    if (linkedInNamePatterns.test(col)) return col;
  }

  // Check values
  for (const col of columns) {
    const hasLinkedIn = sampleRows.some((row) =>
      (row[col] || '').toLowerCase().includes('linkedin.com')
    );
    if (hasLinkedIn) return col;
  }

  return null;
}

/**
 * Try to detect name columns (first name, last name, full name).
 */
export function detectNameColumns(
  columns: string[],
  _sampleRows: DatasetRow[]
): { first?: string; last?: string; full?: string } {
  const result: { first?: string; last?: string; full?: string } = {};

  for (const col of columns) {
    const lower = col.toLowerCase();
    if (/^first.?name$|^fname$|^first$/.test(lower)) {
      result.first = col;
    } else if (/^last.?name$|^lname$|^last$|^surname$/.test(lower)) {
      result.last = col;
    } else if (/^(full.?)?name$|^display.?name$/.test(lower)) {
      result.full = col;
    }
  }

  return result;
}

/**
 * Extract Google Sheet ID from a URL.
 * Handles various Google Sheets URL formats.
 */
export function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Convert a Google Sheet URL to a CSV export URL.
 */
export function toCSVExportUrl(sheetUrl: string): string | null {
  const id = extractSheetId(sheetUrl);
  if (!id) return null;
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
}

/**
 * Compute a statistical summary of the dataset for the analysis engine.
 * Returns column stats + diverse sample rows.
 */
export interface ColumnStats {
  column: string;
  unique_count: number;
  null_count: number;
  null_rate: number;
  top_values: Array<{ value: string; count: number }>;
}

export interface DatasetSummary {
  row_count: number;
  column_count: number;
  columns: ColumnStats[];
  sample_rows: DatasetRow[];
}

export function summarizeDataset(dataset: ParsedDataset): DatasetSummary {
  const { columns, rows, row_count } = dataset;

  const columnStats: ColumnStats[] = columns.map((col) => {
    const valueCounts: Record<string, number> = {};
    let nullCount = 0;

    for (const row of rows) {
      const val = (row[col] ?? '').trim();
      if (!val) {
        nullCount++;
      } else {
        valueCounts[val] = (valueCounts[val] ?? 0) + 1;
      }
    }

    // Sort by count desc, take top 10
    const topValues = Object.entries(valueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({ value, count }));

    return {
      column: col,
      unique_count: Object.keys(valueCounts).length,
      null_count: nullCount,
      null_rate: row_count > 0 ? nullCount / row_count : 0,
      top_values: topValues,
    };
  });

  // Pick diverse sample rows (every Nth row)
  const sampleSize = Math.min(10, row_count);
  const sampleRows: DatasetRow[] = [];
  if (row_count > 0) {
    const step = Math.max(1, Math.floor(row_count / sampleSize));
    for (let i = 0; i < row_count && sampleRows.length < sampleSize; i += step) {
      sampleRows.push(rows[i]);
    }
  }

  return {
    row_count,
    column_count: columns.length,
    columns: columnStats,
    sample_rows: sampleRows,
  };
}
