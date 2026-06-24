"use client";

import { useState, useEffect } from "react";
import { Eye, AlertCircle, Loader2, Minus, Hash, Type, Calendar, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { datasetsApi } from "@/lib/api/datasets";
import { handleApiError } from "@/lib/api/errorHandler";
import type { DatasetPreview as DatasetPreviewType, ColumnType } from "@/types/dataset";

interface DatasetPreviewProps {
  datasetId: string;
  nRows?: number;
  onColumnClick?: (columnName: string) => void;
}

const columnTypeConfig: Record<ColumnType, { icon: typeof Hash; color: string }> = {
  numeric: { icon: Hash, color: "text-chart-1" },
  categorical: { icon: Type, color: "text-chart-2" },
  datetime: { icon: Calendar, color: "text-chart-3" },
  text: { icon: FileText, color: "text-chart-4" },
};

export function DatasetPreview({ datasetId, nRows = 10, onColumnClick }: DatasetPreviewProps) {
  const [preview, setPreview] = useState<DatasetPreviewType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreview = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await datasetsApi.preview(datasetId, nRows);
        setPreview(data);
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [datasetId, nRows]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error || !preview) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || "Failed to load preview"}</AlertDescription>
      </Alert>
    );
  }

  const columns = Object.keys(preview.preview_data[0] || {});

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="font-display text-2xl">Data Preview</CardTitle>
            <CardDescription>
              First {preview.preview_data.length} rows of {preview.rows.toLocaleString()} total
            </CardDescription>
          </div>
          <Badge variant="secondary" className="font-mono">
            <Eye className="mr-1 h-3 w-3" />
            {preview.preview_data.length} rows
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="min-w-max rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12 font-mono text-xs text-muted-foreground">
                    #
                  </TableHead>
                  {columns.map((column) => {
                    const columnInfo = preview.column_info[column];
                    const config = columnTypeConfig[columnInfo.type];
                    const Icon = config.icon;
                    const hasMissing = columnInfo.missing > 0;

                    return (
                      <TableHead
                        key={column}
                        className="cursor-pointer transition-colors hover:bg-accent"
                        onClick={() => onColumnClick?.(column)}
                      >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2">
                                <Icon className={`h-4 w-4 ${config.color}`} />
                                <span className="font-semibold">{column}</span>
                                {hasMissing && (
                                  <Badge variant="destructive" className="ml-1 h-5 px-1 text-xs">
                                    {columnInfo.missing}
                                  </Badge>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1 text-xs">
                                <p className="font-semibold">{columnInfo.type}</p>
                                {hasMissing && (
                                  <p className="text-destructive">
                                    {columnInfo.missing} missing values
                                  </p>
                                )}
                                <p className="text-muted-foreground">Click for detailed stats</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.preview_data.map((row, index) => (
                  <TableRow key={index} className="hover:bg-accent/50">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    {columns.map((column) => {
                      const value = row[column];
                      const isMissing = value === null || value === undefined || value === "";
                      const columnType = preview.column_info[column].type;

                      return (
                        <TableCell
                          key={`${index}-${column}`}
                          className={`${
                            columnType === "numeric" ? "font-mono" : ""
                          } ${isMissing ? "text-muted-foreground italic" : ""}`}
                        >
                          {isMissing ? (
                            <div className="flex items-center gap-1">
                              <Minus className="h-3 w-3" />
                              <span className="text-xs">null</span>
                            </div>
                          ) : typeof value === "number" ? (
                            value.toLocaleString()
                          ) : (
                            String(value)
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
