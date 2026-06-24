"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { SummaryStatistics } from "@/types/eda";
import { isNumericStats } from "@/types/eda";
import { BarChart3 } from "lucide-react";

interface Props {
  stats: SummaryStatistics;
}

export function SummaryStatisticsTable({ stats }: Props) {
  const columns = Object.keys(stats);

  return (
    <Card className="eda-card border border-slate-200">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-transparent pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-50">
            <BarChart3 className="h-5 w-5 text-cyan-600" />
          </div>
          <div>
            <CardTitle className="text-2xl eda-heading">Summary Statistics</CardTitle>
            <p className="text-sm text-slate-600 eda-mono mt-1">
              {columns.length} columns analyzed
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="font-semibold text-slate-900 eda-mono">
                    Column
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900 eda-mono">
                    Type
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900 eda-mono text-right">
                    Count
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900 eda-mono text-right">
                    Missing
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900 eda-mono text-right">
                    Mean/Mode
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900 eda-mono text-right">
                    Std/Unique
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900 eda-mono text-right">
                    Min
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900 eda-mono text-right">
                    Max
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {columns.map((column) => {
                  const stat = stats[column];
                  const isNumeric = isNumericStats(stat);

                  return (
                    <TableRow
                      key={column}
                      className="hover:bg-cyan-50/30 transition-colors"
                    >
                      <TableCell className="font-medium text-slate-900 eda-mono">
                        {column}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isNumeric ? "default" : "secondary"}
                          className={
                            isNumeric
                              ? "bg-cyan-100 text-cyan-700 hover:bg-cyan-200 eda-mono text-xs"
                              : "bg-purple-100 text-purple-700 hover:bg-purple-200 eda-mono text-xs"
                          }
                        >
                          {isNumeric ? "Numeric" : "Categorical"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right eda-mono text-slate-700">
                        {stat.count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {stat.null_count > 0 ? (
                          <div className="flex items-center justify-end gap-2">
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700 border-amber-200 eda-mono text-xs"
                            >
                              {stat.null_count.toLocaleString()} (
                              {stat.null_percentage.toFixed(1)}%)
                            </Badge>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 eda-mono text-xs"
                          >
                            None
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right eda-mono text-slate-700">
                        {isNumeric
                          ? stat.mean.toFixed(2)
                          : stat.top_value.length > 20
                          ? stat.top_value.substring(0, 20) + "..."
                          : stat.top_value}
                      </TableCell>
                      <TableCell className="text-right eda-mono text-slate-700">
                        {isNumeric
                          ? stat.std.toFixed(2)
                          : stat.unique_values.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right eda-mono text-slate-700">
                        {isNumeric ? stat.min.toFixed(2) : "-"}
                      </TableCell>
                      <TableCell className="text-right eda-mono text-slate-700">
                        {isNumeric ? stat.max.toFixed(2) : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
