"use client";

import { useState, useEffect, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Database,
  Search,
  Trash2,
  Eye,
  ArrowUpDown,
  Loader2,
  AlertCircle,
  FileSpreadsheet
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { datasetsApi } from "@/lib/api/datasets";
import { handleApiError } from "@/lib/api/errorHandler";
import type { DatasetListItem } from "@/types/dataset";

interface DatasetListProps {
  onSelectDataset?: (datasetId: string) => void;
  onDeleteDataset?: (datasetId: string) => void;
  refreshTrigger?: number;
}

type SortField = "name" | "uploaded_at" | "rows" | "columns";
type SortOrder = "asc" | "desc";

export function DatasetList({ onSelectDataset, onDeleteDataset, refreshTrigger }: DatasetListProps) {
  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("uploaded_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [datasetToDelete, setDatasetToDelete] = useState<DatasetListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await datasetsApi.list();
      setDatasets(response.datasets);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, [refreshTrigger]);

  const filteredAndSortedDatasets = useMemo(() => {
    let filtered = datasets;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((dataset) =>
        dataset.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "uploaded_at":
          comparison = new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
          break;
        case "rows":
          comparison = a.rows - b.rows;
          break;
        case "columns":
          comparison = a.columns - b.columns;
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [datasets, searchQuery, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleDeleteClick = (dataset: DatasetListItem) => {
    setDatasetToDelete(dataset);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!datasetToDelete) return;

    setDeleting(true);
    try {
      await datasetsApi.delete(datasetToDelete.dataset_id);
      setDatasets((prev) => prev.filter((d) => d.dataset_id !== datasetToDelete.dataset_id));
      setDeleteDialogOpen(false);
      setDatasetToDelete(null);
      onDeleteDataset?.(datasetToDelete.dataset_id);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="font-display text-2xl">Datasets</CardTitle>
              <CardDescription>
                Manage your uploaded datasets
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono">
              {datasets.length} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search datasets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Datasets Table */}
          {filteredAndSortedDatasets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <div className="rounded-full bg-muted p-3">
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 font-semibold">
                {searchQuery ? "No datasets found" : "No datasets yet"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Upload your first dataset to get started"}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("name")}
                        className="flex items-center gap-1 font-semibold"
                      >
                        Name
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("rows")}
                        className="flex items-center gap-1 font-semibold ml-auto"
                      >
                        Rows
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("columns")}
                        className="flex items-center gap-1 font-semibold ml-auto"
                      >
                        Columns
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("uploaded_at")}
                        className="flex items-center gap-1 font-semibold"
                      >
                        Uploaded
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedDatasets.map((dataset, index) => (
                    <TableRow
                      key={dataset.dataset_id}
                      className="cursor-pointer transition-colors hover:bg-accent/50"
                      style={{
                        animationDelay: `${index * 50}ms`,
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="rounded-md bg-primary/10 p-2">
                            <Database className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">{dataset.name}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {dataset.rows.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {dataset.columns}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(dataset.uploaded_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {dataset.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onSelectDataset?.(dataset.dataset_id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(dataset);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Dataset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{datasetToDelete?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
