import { LeaderboardPageContent } from '@/components/admin/leaderboard/LeaderboardComponents'

// ISR: Cache for 1 minute, leaderboard updates regularly
export const revalidate = 60;

export default function LeaderboardPage() {
  return <LeaderboardPageContent />;
}
