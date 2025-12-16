export { cn } from '@/utils/cn'

// Vietnamese given-name (last word) sorting utilities
const viCollator = new Intl.Collator('vi', { sensitivity: 'base', numeric: true })

function normalizeName(name: string | undefined | null): string {
	return String(name ?? '').trim().replace(/\s+/g, ' ')
}

export function givenNameKey(fullName: string): string {
	const n = normalizeName(fullName)
	if (!n) return ''
	const parts = n.split(' ')
	return parts[parts.length - 1] || ''
}

export function compareByGivenName(aName: string, bName: string): number {
	const aKey = givenNameKey(aName)
	const bKey = givenNameKey(bName)
	const primary = viCollator.compare(aKey, bKey)
	if (primary !== 0) return primary
	// Tie-break by full name for deterministic order
	return viCollator.compare(normalizeName(aName), normalizeName(bName))
}

export function sortByGivenName<T>(items: T[], getName: (item: T) => string): T[] {
	return [...items].sort((a, b) => compareByGivenName(getName(a), getName(b)))
}
