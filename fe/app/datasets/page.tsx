"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatasetList } from "@/components/DatasetList";

export default function DatasetsPage() {
  const router = useRouter();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSelectDataset = (datasetId: string) => {
    router.push(`/datasets/${datasetId}`);
  };

  const handleDeleteDataset = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold">Your Datasets</h2>
          <p className="text-muted-foreground">
            View and manage all your uploaded datasets
          </p>
        </div>
        <Button
          onClick={() => router.push("/datasets/upload")}
          size="lg"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Upload Dataset
        </Button>
      </div>

      <DatasetList
        onSelectDataset={handleSelectDataset}
        onDeleteDataset={handleDeleteDataset}
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
}
