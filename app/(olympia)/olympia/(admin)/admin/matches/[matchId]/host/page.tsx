import { notFound } from 'next/navigation'
import { perfTime } from './server/perf'
import { fetchHostData } from './server/fetch-host-data'
import { OlympiaHostConsoleView } from './components/OlympiaHostConsoleView'

// KEEP force-dynamic: Host controls real-time game flow (send questions, manage timers)
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type HostPageParams = { matchId: string }
type HostPageSearchParams = { preview?: string | string[]; kdSeat?: string | string[]; vdSeat?: string | string[] }

export default async function OlympiaHostConsolePage({
  params,
  searchParams,
}: {
  params: HostPageParams | Promise<HostPageParams>
  searchParams?: HostPageSearchParams | Promise<HostPageSearchParams>
}) {
  const { matchId } = await perfTime('[perf][host] await params', () => Promise.resolve(params))
  const resolvedSearchParams = await perfTime('[perf][host] await searchParams', async () => {
    const sp: HostPageSearchParams = searchParams ? await Promise.resolve(searchParams) : {}
    return sp
  })
  const previewParam = Array.isArray(resolvedSearchParams.preview)
    ? resolvedSearchParams.preview[0]
    : resolvedSearchParams.preview

  const kdSeatParamRaw = Array.isArray(resolvedSearchParams.kdSeat)
    ? resolvedSearchParams.kdSeat[0]
    : resolvedSearchParams.kdSeat
  const kdSeat = (() => {
    if (!kdSeatParamRaw) return null
    const n = Number.parseInt(String(kdSeatParamRaw), 10)
    return Number.isFinite(n) ? n : null
  })()

  const vdSeatParamRaw = Array.isArray(resolvedSearchParams.vdSeat)
    ? resolvedSearchParams.vdSeat[0]
    : resolvedSearchParams.vdSeat
  const vdSeat = (() => {
    if (!vdSeatParamRaw) return null
    const n = Number.parseInt(String(vdSeatParamRaw), 10)
    return Number.isFinite(n) ? n : null
  })()

  let data
  try {
    data = await perfTime(`[perf][host] fetchHostData ${matchId}`, () => fetchHostData(matchId))
  } catch (error) {
    console.error('[host] fetchHostData error for matchId:', matchId, error)
    notFound()
  }

  if (!data) {
    console.error('[host] No data found for matchId:', matchId)
    notFound()
  }

  return <OlympiaHostConsoleView data={data} previewParam={previewParam} kdSeat={kdSeat} vdSeat={vdSeat} />
}
