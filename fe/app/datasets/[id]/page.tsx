"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DatasetDetails } from "@/components/DatasetDetails";
import { DatasetPreview } from "@/components/DatasetPreview";
import { ColumnStats } from "@/components/ColumnStats";

export default function DatasetDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const datasetId = params.id as string;

  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);

  const handleColumnClick = (columnName: string) => {
    setSelectedColumn(columnName);
    setStatsDialogOpen(true);
  };

  const handleProceedToEDA = () => {
    // Navigate to EDA page (Phase 2)
    router.push(`/datasets/${datasetId}/eda`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/datasets")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="font-display text-3xl font-bold">Dataset Details</h2>
            <p className="text-muted-foreground">
              Explore your data and prepare for analysis
            </p>
          </div>
        </div>
        <Button
          onClick={handleProceedToEDA}
          size="lg"
          className="gap-2"
        >
          <TrendingUp className="h-4 w-4" />
          Proceed to EDA
        </Button>
      </div>

      <DatasetDetails datasetId={datasetId} onProceedToEDA={handleProceedToEDA} />

      <Separator className="my-8" />

      <DatasetPreview datasetId={datasetId} onColumnClick={handleColumnClick} />

      {selectedColumn && (
        <ColumnStats
          datasetId={datasetId}
          columnName={selectedColumn}
          open={statsDialogOpen}
          onClose={() => {
            setStatsDialogOpen(false);
            setSelectedColumn(null);
          }}
        />
      )}
    </div>
  );
}
