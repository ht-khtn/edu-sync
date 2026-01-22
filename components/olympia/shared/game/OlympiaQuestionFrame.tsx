'use client';

import React from 'react';
import { motion } from 'framer-motion';

type Props = {
    children: React.ReactNode;
    open?: boolean;
    playIntro?: boolean;
    scoreboard?: Array<{ id?: string; name?: string; total?: number; seat?: number }>;
    currentSeat?: number | null;
};

export default function OlympiaQuestionFrame({ children, open = true, scoreboard, currentSeat }: Props) {
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
        animate: { scaleX: 1, transition: { ...frameTransition, delay: 0.4 } },
    } as const;

    const contentVariant = {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0, transition: { ...contentTransition, delay: 2.2 } },
    } as const;

    return (
        <div className="fixed inset-0 flex items-center justify-center z-10 pointer-events-none" aria-hidden={!open}>
            <div className="w-[92vw] h-[85vh] flex items-center justify-center pointer-events-auto relative">

                {/* Left Chevrons: outer cyan then inner dark, adjacent (no overlap), inner edge touches frame edge */}
                <motion.div
                    className="absolute left-0 top-0 h-full w-[112px] flex items-center justify-end z-20 pointer-events-none"
                    initial="initial"
                    animate={open ? 'animate' : 'initial'}
                    variants={leftVariant}
                >
                    {/* Use a single path for matching shapes */}
                    {/* outer cyan (left) */}
                    <svg className="h-full w-[56px] flex-shrink-0" viewBox="0 0 120 56" preserveAspectRatio="none" style={{ filter: 'drop-shadow(0 0 16px rgba(6, 182, 212, 0.7))', marginRight: '-15px' }}>
                        <path d="M 0 28 L 40 0 L 120 0 L 100 28 L 120 56 L 40 56 Z" fill="#06b6d4" />
                    </svg>
                    {/* inner dark (left) sits flush to frame edge */}
                    <svg className="h-full w-[56px] flex-shrink-0 mr-5" viewBox="0 0 120 56" preserveAspectRatio="none" style={{ marginRight: '50px' }}>
                        <path d="M 0 28 L 40 0 L 120 0 L 100 28 L 120 56 L 40 56 Z" fill="#0f172a" />
                    </svg>
                </motion.div>

                {/* Main Frame */}
                <motion.div
                    className="w-full h-full relative overflow-hidden pl-[56px] pr-[56px]"
                    style={{
                        transformOrigin: 'center',
                        background: 'linear-gradient(90deg, #041022 0%, #071738 40%, #04223a 100%)',
                        clipPath: 'polygon(56px 0%, calc(100% - 56px) 0%, 100% 50%, calc(100% - 56px) 100%, 56px 100%, 0% 50%)',
                        border: '2px solid rgba(70, 120, 170, 0.5)'
                    }}
                    initial="initial"
                    animate={open ? 'animate' : 'initial'}
                    variants={frameVariant}
                >
                    {/* Scoreboard Overlay */}
                    <div className="absolute top-0 left-0 right-0 h-[10%] grid grid-cols-4 border-b border-white/20 text-white font-bold text-base pl-[56px] pr-[56px]">
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
                                const shouldShowGradient = currentSeat === i + 1
                                return (
                                    <div
                                        key={p?.id ?? i}
                                        className={
                                            'flex justify-between items-center px-4 min-w-0 ' +
                                            (shouldShowGradient ? 'bg-gradient-to-r from-blue-900 via-pink-600 to-red-600' : 'border-l border-white/10')
                                        }
                                    >
                                        <span className="truncate">{`${i + 1}. ${name}`}</span>
                                        <span className="ml-4">{total}</span>
                                    </div>
                                )
                            })
                        })()}
                    </div>

                    {/* Question Content */}
                    <div className="flex items-center justify-center h-full w-full">
                        <motion.div
                            className="text-center text-white text-5xl font-sans font-medium leading-snug max-w-6xl px-12 pointer-events-auto"
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
                    className="absolute right-0 top-0 h-full w-[112px] flex items-center justify-start z-20 pointer-events-none"
                    initial="initial"
                    animate={open ? 'animate' : 'initial'}
                    variants={rightVariant}
                >
                    {/* inner dark (right) mirrored to sit flush to frame edge */}
                    <svg className="h-full w-[56px] flex-shrink-0" viewBox="0 0 120 56" preserveAspectRatio="none" style={{ transform: 'scaleX(-1)', marginLeft: '50px' }}>
                        <path d="M 0 28 L 40 0 L 120 0 L 100 28 L 120 56 L 40 56 Z" fill="#0f172a" />
                    </svg>
                    {/* outer cyan (right) mirrored */}
                    <svg className="h-full w-[56px] flex-shrink-0" viewBox="0 0 120 56" preserveAspectRatio="none" style={{ filter: 'drop-shadow(0 0 16px rgba(6, 182, 212, 0.7))', transform: 'scaleX(-1)', marginLeft: '-15px' }}>
                        <path d="M 0 28 L 40 0 L 120 0 L 100 28 L 120 56 L 40 56 Z" fill="#06b6d4" />
                    </svg>
                </motion.div>
            </div>
        </div>
    );
}
