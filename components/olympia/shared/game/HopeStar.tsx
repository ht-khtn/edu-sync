'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

type Point = { x: number; y: number }

type StarTriangle = {
    points: [Point, Point, Point]
    isHighlight: boolean
}

type HopeStarProps = {
    className?: string
}

const CENTER: Point = { x: 50, y: 50 }
const OUTER_RADIUS = 48
const INNER_RADIUS = 22
const HIGHLIGHT = '#FACC15'
const SHADOW = '#CA8A04'
const LIGHT_DIR = { x: -0.7, y: -0.7 }

const degToRad = (deg: number): number => (deg * Math.PI) / 180

const isHighlightTriangle = (triangle: [Point, Point, Point]): boolean => {
    const centroid = {
        x: (triangle[0].x + triangle[1].x + triangle[2].x) / 3,
        y: (triangle[0].y + triangle[1].y + triangle[2].y) / 3,
    }
    const dx = centroid.x - CENTER.x
    const dy = centroid.y - CENTER.y
    const brightness = dx * LIGHT_DIR.x + dy * LIGHT_DIR.y
    return brightness > 0
}

const STAR_TRIANGLES: StarTriangle[] = (() => {
    const outerPoints: Point[] = []
    const innerPoints: Point[] = []

    for (let i = 0; i < 5; i += 1) {
        const outerAngle = -90 + i * 72
        const innerAngle = outerAngle + 36
        outerPoints.push({
            x: CENTER.x + OUTER_RADIUS * Math.cos(degToRad(outerAngle)),
            y: CENTER.y + OUTER_RADIUS * Math.sin(degToRad(outerAngle)),
        })
        innerPoints.push({
            x: CENTER.x + INNER_RADIUS * Math.cos(degToRad(innerAngle)),
            y: CENTER.y + INNER_RADIUS * Math.sin(degToRad(innerAngle)),
        })
    }

    const triangles: StarTriangle[] = []
    for (let i = 0; i < 5; i += 1) {
        const outer = outerPoints[i]
        const innerLeft = innerPoints[(i + 4) % 5]
        const innerRight = innerPoints[i]

        const leftTri: [Point, Point, Point] = [CENTER, outer, innerLeft]
        const rightTri: [Point, Point, Point] = [CENTER, outer, innerRight]

        triangles.push({
            points: leftTri,
            isHighlight: isHighlightTriangle(leftTri),
        })
        triangles.push({
            points: rightTri,
            isHighlight: isHighlightTriangle(rightTri),
        })
    }

    return triangles
})()

const formatPoints = (points: [Point, Point, Point]): string =>
    points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')

export function HopeStar({ className }: HopeStarProps) {
    return (
        <motion.div
            className={cn('pointer-events-none select-none', className)}
            initial={{ opacity: 0, scale: 2.2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
        >
            <svg
                viewBox="0 0 100 100"
                className="h-full w-full"
                role="img"
                aria-label="Ngôi sao hy vọng"
            >
                {STAR_TRIANGLES.map((triangle, index) => (
                    <polygon
                        key={`hope-star-${index}`}
                        points={formatPoints(triangle.points)}
                        fill={triangle.isHighlight ? HIGHLIGHT : SHADOW}
                    />
                ))}
            </svg>
        </motion.div>
    )
}
