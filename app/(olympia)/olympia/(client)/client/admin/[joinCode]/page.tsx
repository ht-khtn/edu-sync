import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type PageProps = {
    params: Promise<{
        joinCode: string
    }>
}

export default async function OlympiaClientAdminRedirectPage({ params }: PageProps) {
    const resolvedParams = await params
    const joinCode = (resolvedParams.joinCode ?? '').trim().toUpperCase()
    if (!joinCode) notFound()
    redirect(`/olympia/client/mc/${joinCode}`)
}
