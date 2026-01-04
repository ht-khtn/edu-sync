'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

type RoundQuestionJoin = {
    image_url?: string | null
    audio_url?: string | null
}

type RoundQuestionForPreload = {
    id: string
    questions?: RoundQuestionJoin | RoundQuestionJoin[] | null
    question_set_items?: RoundQuestionJoin | RoundQuestionJoin[] | null
}

function pickJoin<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null
    return Array.isArray(value) ? value[0] ?? null : value
}

function extractAssetUrls(questions: RoundQuestionForPreload[]): { images: string[]; audios: string[] } {
    const imgSet = new Set<string>()
    const audioSet = new Set<string>()

    for (const rq of questions) {
        const qsi = pickJoin(rq.question_set_items)
        const q = pickJoin(rq.questions)
        const imageUrl = (qsi?.image_url ?? q?.image_url ?? null)?.trim() || null
        const audioUrl = (qsi?.audio_url ?? q?.audio_url ?? null)?.trim() || null

        if (imageUrl) imgSet.add(imageUrl)
        if (audioUrl) audioSet.add(audioUrl)
    }

    return { images: Array.from(imgSet), audios: Array.from(audioSet) }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
    return new Promise((resolve) => {
        const t = setTimeout(() => resolve(null), ms)
        promise
            .then((v) => {
                clearTimeout(t)
                resolve(v)
            })
            .catch(() => {
                clearTimeout(t)
                resolve(null)
            })
    })
}

async function preloadImages(urls: string[], onProgress: () => void): Promise<void> {
    const concurrency = 6
    let idx = 0

    const runOne = async (url: string) => {
        const p = new Promise<void>((resolve) => {
            const img = new Image()
            img.onload = () => resolve()
            img.onerror = () => resolve()
            img.src = url
        })
        await withTimeout(p, 7000)
        onProgress()
    }

    const workers = Array.from({ length: Math.min(concurrency, urls.length) }).map(async () => {
        while (idx < urls.length) {
            const cur = idx
            idx += 1
            const url = urls[cur]
            if (!url) continue
            await runOne(url)
        }
    })

    await Promise.all(workers)
}

async function preloadAudios(urls: string[], onProgress: () => void): Promise<void> {
    const concurrency = 4
    let idx = 0

    const runOne = async (url: string) => {
        const p = new Promise<void>((resolve) => {
            try {
                const audio = new Audio()
                audio.preload = 'auto'
                audio.oncanplaythrough = () => resolve()
                audio.onerror = () => resolve()
                audio.src = url
                audio.load()
            } catch {
                resolve()
            }
        })
        await withTimeout(p, 7000)
        onProgress()
    }

    const workers = Array.from({ length: Math.min(concurrency, urls.length) }).map(async () => {
        while (idx < urls.length) {
            const cur = idx
            idx += 1
            const url = urls[cur]
            if (!url) continue
            await runOne(url)
        }
    })

    await Promise.all(workers)
}

export function OlympiaQuestionsPreloadOverlay(props: { roundQuestions: RoundQuestionForPreload[] }) {
    const { roundQuestions } = props
    const assets = useMemo(() => extractAssetUrls(roundQuestions), [roundQuestions])
    const total = assets.images.length + assets.audios.length

    const [isPreloading, setIsPreloading] = useState(true)
    const [done, setDone] = useState(0)

    useEffect(() => {
        let cancelled = false

        const bump = () => {
            if (cancelled) return
            setDone((v) => v + 1)
        }

        const run = async () => {
            setIsPreloading(true)
            setDone(0)

            if (total === 0) {
                await Promise.resolve()
                if (!cancelled) setIsPreloading(false)
                return
            }

            await Promise.all([
                preloadImages(assets.images, bump),
                preloadAudios(assets.audios, bump),
            ])

            if (!cancelled) setIsPreloading(false)
        }

        void run()

        return () => {
            cancelled = true
        }
    }, [assets.audios, assets.images, total])

    if (!isPreloading) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="rounded-lg border bg-background p-6 w-[min(520px,calc(100%-2rem))]">
                <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <div>
                        <p className="text-sm font-semibold">Đang tải dữ liệu câu hỏi…</p>
                        <p className="text-xs text-muted-foreground">Vui lòng chờ, không thể huỷ.</p>
                    </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">Tiến độ: {Math.min(done, total)}/{total}</div>
            </div>
        </div>
    )
}
