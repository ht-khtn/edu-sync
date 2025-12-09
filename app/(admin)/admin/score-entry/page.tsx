import { notFound } from 'next/navigation'

// ISR: Cache for 1 minute, score entry form data updates regularly
export const revalidate = 60;

export default function ScoreEntryPage() {
  notFound()
}
