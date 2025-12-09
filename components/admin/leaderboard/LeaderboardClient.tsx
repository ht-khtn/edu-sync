'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

  // Group by grade and calculate final points + per-grade ranking
  const groupedByGrade: GradeGroup[] = useMemo(() => {
    // First, group all classes by grade
    const gradeMap = new Map<string, ClassData[]>();
    for (const cls of initialData) {
      if (!gradeMap.has(cls.grade)) {
        gradeMap.set(cls.grade, []);
      }
      gradeMap.get(cls.grade)!.push(cls);
    }

    // For each grade, calculate points and assign per-grade ranks
    const result: GradeGroup[] = [];
    for (const [grade, classesInGrade] of gradeMap) {
      // Calculate final points for all classes in this grade
      const classesWithPoints = classesInGrade.map((cls) => ({
        ...cls,
        final_points: basePoints - cls.total_violation_score,
      }));

      // Sort by final points descending within this grade
      const sorted = [...classesWithPoints].sort(
        (a, b) => b.final_points - a.final_points
      );

      // Assign ranks within this grade only (handling ties)
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

      result.push({ grade, classes: dataWithRanks });
    }

    // Sort grades naturally (10, 11, 12)
    result.sort((a, b) => {
      const gradeA = parseInt(a.grade) || 999;
      const gradeB = parseInt(b.grade) || 999;
      if (isNaN(gradeA)) return a.grade.localeCompare(b.grade);
      return gradeA - gradeB;
    });

    return result;
  }, [initialData, basePoints]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-amber-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-700" />;
    return null;
  };

  // Get the default tab (first grade with classes)
  const defaultTab = groupedByGrade.length > 0 ? groupedByGrade[0].grade : undefined;

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

      {/* Leaderboard with Grade Tabs */}
      {groupedByGrade.length > 0 ? (
        <Tabs defaultValue={defaultTab} className="w-full space-y-4">
          <TabsList className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground w-full sm:w-auto">
            {groupedByGrade.map((gradeGroup) => (
              <TabsTrigger
                key={gradeGroup.grade}
                value={gradeGroup.grade}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Khối {gradeGroup.grade}
              </TabsTrigger>
            ))}
          </TabsList>

          {groupedByGrade.map((gradeGroup) => (
            <TabsContent
              key={gradeGroup.grade}
              value={gradeGroup.grade}
              className="mt-0"
            >
              <Card className="shadow-sm">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-lg font-semibold">Khối {gradeGroup.grade}</CardTitle>
                  <CardDescription>
                    {gradeGroup.classes.length} lớp - Xếp hạng riêng khối
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
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="h-24 flex items-center justify-center text-muted-foreground">
            Chưa có dữ liệu.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
