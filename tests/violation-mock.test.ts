import { describe, it, expect } from 'vitest'
import { submitViolationMock } from '@/lib/violations'

describe('violations mock', () => {
  it('submitViolationMock echoes fields and stamps id/time', () => {
    const draft = {
      student_id: 'user-1',
      criteria_id: 'criteria-1',
      points: -2,
      reason: 'test',
      evidence_url: 'https://example.com'
    }
    const rec = submitViolationMock(draft)
    expect(rec.id).toBeTruthy()
    expect(rec.created_at).toBeTruthy()
    expect(rec.student_id).toEqual(draft.student_id)
    expect(rec.criteria_id).toEqual(draft.criteria_id)
    expect(rec.points).toEqual(draft.points)
    expect(rec.reason).toEqual('test')
  })
})
