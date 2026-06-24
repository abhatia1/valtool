"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { datasetsApi } from "@/lib/api/datasets";
import { handleApiError } from "@/lib/api/errorHandler";
import type { Dataset } from "@/types/dataset";

interface DatasetUploadProps {
  onUploadSuccess?: (dataset: Dataset) => void;
}

export function DatasetUpload({ onUploadSuccess }: DatasetUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Dataset | null>(null);

  const validateFile = (file: File): string | null => {
    if (!file.name.endsWith('.csv')) {
      return 'Only CSV files are allowed';
    }
    if (file.size > 100 * 1024 * 1024) {
      return 'File size must be less than 100MB';
    }
    return null;
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validationError = validateFile(droppedFile);
      if (validationError) {
        setError(validationError);
        return;
      }
      setFile(droppedFile);
      if (!name) {
        setName(droppedFile.name.replace('.csv', ''));
      }
    }
  }, [name]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        return;
      }
      setFile(selectedFile);
      if (!name) {
        setName(selectedFile.name.replace('.csv', ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !name.trim()) {
      setError('Please select a file and provide a dataset name');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 200);

    try {
      const dataset = await datasetsApi.upload(file, name.trim(), description.trim() || undefined);
      setProgress(100);

      // Immediately proceed to next stage
      setTimeout(() => {
        setFile(null);
        setName("");
        setDescription("");
        setProgress(0);
        onUploadSuccess?.(dataset);
      }, 500);
    } catch (err) {
      setError(handleApiError(err));
      setProgress(0);
    } finally {
      clearInterval(progressInterval);
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setName("");
    setDescription("");
    setError(null);
    setSuccess(null);
    setProgress(0);
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

        .upload-container {
          font-family: 'IBM Plex Sans', sans-serif;
        }

        .upload-title {
          font-family: 'Outfit', sans-serif;
          font-weight: 600;
          letter-spacing: -0.02em;
        }

        .upload-dropzone {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .upload-dropzone:hover {
          border-color: rgba(37, 99, 235, 0.4);
          background: rgba(37, 99, 235, 0.02);
        }

        .upload-dropzone.active {
          border-color: rgba(37, 99, 235, 0.6);
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.05), rgba(245, 158, 11, 0.05));
          transform: scale(1.01);
        }

        .upload-icon-pulse {
          animation: iconPulse 2s ease-in-out infinite;
        }

        @keyframes iconPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
        }
      `}</style>

      <Card className="upload-container border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-6">
          <CardTitle className="upload-title text-2xl text-slate-900">Upload Dataset</CardTitle>
          <CardDescription className="text-slate-600 font-light">
            Upload a CSV file to begin your machine learning workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Drag and Drop Area */}
          <div
            className={`upload-dropzone relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 ${
              dragActive ? 'active' : ''
            } ${file ? 'border-gold-400/40 bg-gold-50/20' : 'border-slate-300'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled={uploading}
            />

            {file ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gold-400 to-gold-500 blur-xl opacity-30" />
                  <div className="relative rounded-full bg-gradient-to-br from-gold-500 to-gold-600 p-4">
                    <FileText className="h-8 w-8 text-white" strokeWidth={2} />
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-lg">{file.name}</p>
                  <p className="text-sm text-slate-500 font-mono mt-1">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  disabled={uploading}
                  className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                  Remove File
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative upload-icon-pulse">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 blur-xl opacity-20" />
                  <div className="relative rounded-full bg-gradient-to-br from-blue-500 to-blue-600 p-4">
                    <Upload className="h-8 w-8 text-white" strokeWidth={2} />
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-lg">Drop your CSV file here</p>
                  <p className="text-sm text-slate-500 mt-1 font-light">
                    or click to browse • max 100MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-slate-700 uppercase tracking-wide">
                Dataset Name <span className="text-blue-600">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Customer Churn Data"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={uploading}
                maxLength={255}
                className="border-slate-300 focus:border-blue-500 focus:ring-blue-500/20 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-slate-700 uppercase tracking-wide">
                Description <span className="text-slate-400 normal-case">(Optional)</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Brief description of your dataset..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={uploading}
                maxLength={1000}
                rows={3}
                className="border-slate-300 focus:border-blue-500 focus:ring-blue-500/20 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-3 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-gold-50/30 border border-blue-200/40">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">Uploading dataset...</span>
                <span className="font-mono font-semibold text-blue-700">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-slate-200" />
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="border-red-300 bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!file || !name.trim() || uploading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-5 w-5" />
                Upload Dataset
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
