'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, Medal, Award } from "lucide-react";

type ClassData = {
  class_id: string;
  class_name: string;
  grade: string;
  total_violation_score: number;
};

type ClassDataWithRank = ClassData & {
  final_points: number;
  rank: number;
};

type GradeGroup = {
  grade: string;
  classes: ClassDataWithRank[];
};

interface LeaderboardClientProps {
  initialData: ClassData[];
}

export default function LeaderboardClient({ initialData }: LeaderboardClientProps) {
  const [basePoints, setBasePoints] = useState<number>(500);

  // Calculate final points and ranking
  const processedData = useMemo(() => {
    const classesWithPoints = initialData.map((cls) => ({
      ...cls,
      final_points: basePoints - cls.total_violation_score,
    }));

    // Sort by final points descending to assign ranks
    const sorted = [...classesWithPoints].sort(
      (a, b) => b.final_points - a.final_points
    );

    // Assign ranks (handling ties)
    const dataWithRanks: ClassDataWithRank[] = [];
    let currentRank = 1;
    let prevPoints: number | null = null;

    sorted.forEach((cls, index) => {
      if (prevPoints !== null && cls.final_points !== prevPoints) {
        currentRank = index + 1;
      }
      dataWithRanks.push({ ...cls, rank: currentRank });
      prevPoints = cls.final_points;
    });

    return dataWithRanks;
  }, [initialData, basePoints]);

  // Group by grade
  const groupedByGrade: GradeGroup[] = useMemo(() => {
    const gradeMap = new Map<string, ClassDataWithRank[]>();

    for (const cls of processedData) {
      if (!gradeMap.has(cls.grade)) {
        gradeMap.set(cls.grade, []);
      }
      gradeMap.get(cls.grade)!.push(cls);
    }

    // Sort each grade's classes by rank
    const result: GradeGroup[] = [];
    for (const [grade, classes] of gradeMap) {
      classes.sort((a, b) => a.rank - b.rank);
      result.push({ grade, classes });
    }

    // Sort grades naturally (10, 11, 12)
    result.sort((a, b) => {
      const gradeA = parseInt(a.grade) || 999;
      const gradeB = parseInt(b.grade) || 999;
      if (isNaN(gradeA)) return a.grade.localeCompare(b.grade);
      return gradeA - gradeB;
    });

    return result;
  }, [processedData]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-amber-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-700" />;
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Base Points Control */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-sm">
              <Label htmlFor="basePoints" className="text-sm font-medium mb-2 block">
                Điểm cơ sở
              </Label>
              <Input
                id="basePoints"
                type="number"
                value={basePoints}
                onChange={(e) => setBasePoints(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Điểm = Điểm cơ sở - Tổng vi phạm
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard by Grade */}
      <div className="space-y-4">
        {groupedByGrade.map((gradeGroup) => (
          <Card key={gradeGroup.grade} className="shadow-sm">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-lg font-semibold">Khối {gradeGroup.grade}</CardTitle>
              <CardDescription>
                {gradeGroup.classes.length} lớp
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-20 font-semibold">#</TableHead>
                    <TableHead className="font-semibold">Lớp</TableHead>
                    <TableHead className="text-right font-semibold">Vi phạm</TableHead>
                    <TableHead className="text-right font-semibold">Điểm</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gradeGroup.classes.map((cls) => {
                    const rank = cls.rank;
                    return (
                      <TableRow
                        key={cls.class_id}
                        className={
                          rank <= 3 ? "bg-accent/5 hover:bg-accent/10" : "hover:bg-muted/30"
                        }
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getRankIcon(rank)}
                            <span>{rank}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{cls.class_name}</TableCell>
                        <TableCell className="text-right text-destructive">
                          -{Math.abs(cls.total_violation_score)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-lg">
                          {cls.final_points}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

        {!groupedByGrade.length && (
          <Card className="shadow-sm">
            <CardContent className="h-24 flex items-center justify-center text-muted-foreground">
              Chưa có dữ liệu.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
