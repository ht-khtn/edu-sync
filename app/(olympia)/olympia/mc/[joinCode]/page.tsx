import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type PageProps = {
    params: Promise<{
        joinCode: string
    }>
}

export default async function OlympiaMcJoinCodeRedirectPage({ params }: PageProps) {
    const resolvedParams = await params
    const joinCode = (resolvedParams.joinCode ?? '').trim().toUpperCase()
    redirect(`/olympia/client/mc/${joinCode}`)
}
