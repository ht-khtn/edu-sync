import { describe, it, expect } from 'vitest'
import { parseCSV } from '../lib/csv'

describe('parseCSV', () => {
  it('parses header and rows correctly', () => {
    const csv = `student_code,points,reason\nS001,5,Good job\nS002,-2,Absent`;
    const rows = parseCSV(csv);
    expect(rows.length).toBe(2);
    expect(rows[0].student_code).toBe('S001');
    expect(rows[0].points).toBe(5);
    expect(rows[1].student_code).toBe('S002');
    expect(rows[1].points).toBe(-2);
  })

  it('throws when missing student identifier', () => {
    const csv = `points,reason\n5,NoId`;
    expect(() => parseCSV(csv)).toThrow();
  })
})
