"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatasetUpload } from "@/components/DatasetUpload";
import type { Dataset } from "@/types/dataset";

export default function UploadPage() {
  const router = useRouter();

  const handleUploadSuccess = (dataset: Dataset) => {
    // Navigate to dataset details after successful upload
    setTimeout(() => {
      router.push(`/datasets/${dataset.dataset_id}`);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/datasets")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="font-display text-3xl font-bold">Upload Dataset</h2>
          <p className="text-muted-foreground">
            Begin your machine learning workflow by uploading a CSV file
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        <DatasetUpload onUploadSuccess={handleUploadSuccess} />
      </div>
    </div>
  );
}
