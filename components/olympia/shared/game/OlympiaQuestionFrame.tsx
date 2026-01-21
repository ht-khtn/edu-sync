'use client';

import React from 'react';
import { motion } from 'framer-motion';

type Props = {
    children: React.ReactNode;
    open?: boolean;
    playIntro?: boolean;
    scoreboard?: Array<{ id?: string; name?: string; total?: number; seat?: number }>;
};

export default function OlympiaQuestionFrame({ children, open = true, scoreboard }: Props) {
    const arrowTransition = { duration: 1.3, ease: 'easeOut' } as const;
    const frameTransition = { duration: 0.9, ease: 'easeOut' } as const;
    const contentTransition = { duration: 0.8, ease: 'easeOut' } as const;

    const leftVariant = {
        initial: { x: '100vw', scale: 0.6, opacity: 0 },
        animate: { x: 0, scale: 1, opacity: 1, transition: arrowTransition },
    } as const;

    const rightVariant = {
        initial: { x: '-100vw', scale: 0.6, opacity: 0 },
        animate: { x: 0, scale: 1, opacity: 1, transition: arrowTransition },
    } as const;

    const frameVariant = {
        initial: { scaleX: 0 },
        animate: { scaleX: 1, transition: { ...frameTransition, delay: 1.3 } },
    } as const;

    const contentVariant = {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0, transition: { ...contentTransition, delay: 2.2 } },
    } as const;

    return (
        <div className="fixed inset-0 flex items-center justify-center z-[1000] pointer-events-none" aria-hidden={!open}>
            <div className="w-[92vw] h-[85vh] flex items-center justify-center pointer-events-auto relative">

                {/* Left Chevrons - Đưa ra ngoài frame để không bị clip-path cắt mất */}
                <motion.div
                    className="absolute left-[-20px] top-1/2 -translate-y-1/2 flex items-center z-[1001] pointer-events-none"
                    initial="initial"
                    animate={open ? 'animate' : 'initial'}
                    variants={leftVariant}
                >
                    <svg className="w-40 h-20" viewBox="0 0 120 56" style={{ filter: 'drop-shadow(0 0 16px rgba(6, 182, 212, 0.7))' }}>
                        <path d="M 0 28 L 30 0 L 120 0 L 90 28 L 120 56 L 30 56 Z" fill="#06b6d4" />
                    </svg>
                    <svg className="w-32 h-16 -ml-12" viewBox="0 0 96 48">
                        <path d="M 0 24 L 25 0 L 96 0 L 71 24 L 96 48 L 25 48 Z" fill="#0f172a" />
                    </svg>
                </motion.div>

                {/* Main Frame */}
                <motion.div
                    className="w-full h-full relative overflow-hidden"
                    style={{
                        transformOrigin: 'center',
                        background: 'linear-gradient(90deg, #041022 0%, #071738 40%, #04223a 100%)',
                        clipPath: 'polygon(40px 0%, calc(100% - 40px) 0%, 100% 50%, calc(100% - 40px) 100%, 40px 100%, 0% 50%)',
                        border: '2px solid rgba(70, 120, 170, 0.5)' // Lưu ý: border có thể không hiện rõ với clip-path, dùng shadow thay thế nếu cần
                    }}
                    initial="initial"
                    animate={open ? 'animate' : 'initial'}
                    variants={frameVariant}
                >
                    {/* Scoreboard Overlay */}
                    <div className="absolute top-0 left-0 right-0 h-[10%] grid grid-cols-4 border-b border-white/20 text-white font-bold text-lg">
                        {(() => {
                            const seats: Array<{ id?: string; name?: string; total?: number } | null> = [null, null, null, null]
                            if (scoreboard && scoreboard.length > 0) {
                                for (const p of scoreboard) {
                                    const s = typeof p.seat === 'number' ? p.seat : undefined
                                    if (s && s >= 1 && s <= 4) seats[s - 1] = p
                                }
                            }
                            return seats.map((p, i) => {
                                const name = p && p.name ? (() => {
                                    const parts = p.name.trim().split(/\s+/)
                                    return parts.slice(-2).join(' ')
                                })() : '—'
                                const total = p && typeof p.total === 'number' ? p.total : 0
                                return (
                                    <div
                                        key={p?.id ?? i}
                                        className={
                                            'flex justify-between items-center px-8 ' +
                                            (i === 0 ? 'bg-gradient-to-r from-blue-900 via-pink-600 to-red-600' : 'border-l border-white/10')
                                        }
                                    >
                                        <span>{`${i + 1}. ${name}`}</span>
                                        <span>{total}</span>
                                    </div>
                                )
                            })
                        })()}
                    </div>

                    {/* Question Content */}
                    <div className="flex items-center justify-center h-full w-full">
                        <motion.div
                            className="text-center text-white text-5xl font-sans font-medium leading-snug max-w-4xl px-20 pointer-events-auto"
                            style={{ textShadow: '0 4px 15px rgba(0,0,0,0.8)' }}
                            initial="initial"
                            animate={open ? 'animate' : 'initial'}
                            variants={contentVariant}
                        >
                            {children}
                        </motion.div>
                    </div>
                </motion.div>

                {/* Right Chevrons */}
                <motion.div
                    className="absolute right-[-20px] top-1/2 -translate-y-1/2 flex items-center z-[1001] pointer-events-none rotate-180"
                    initial="initial"
                    animate={open ? 'animate' : 'initial'}
                    variants={rightVariant}
                >
                    <svg className="w-40 h-20" viewBox="0 0 120 56" style={{ filter: 'drop-shadow(0 0 16px rgba(6, 182, 212, 0.7))' }}>
                        <path d="M 0 28 L 30 0 L 120 0 L 90 28 L 120 56 L 30 56 Z" fill="#06b6d4" />
                    </svg>
                    <svg className="w-32 h-16 -ml-12" viewBox="0 0 96 48">
                        <path d="M 0 24 L 25 0 L 96 0 L 71 24 L 96 48 L 25 48 Z" fill="#0f172a" />
                    </svg>
                </motion.div>
            </div>
        </div>
    );
}
