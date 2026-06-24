"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  FileCode,
  Package,
  X,
  Loader2,
  ArrowRight,
  Trash2,
  Container,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { BenchmarkingAPI } from "@/lib/api/benchmarking";
import type { ExternalModel, ModelSource } from "@/types/benchmarking";

interface ExternalModelUploadProps {
  taskType: "classification" | "regression";
  onUploadComplete: (model: ExternalModel) => void;
  onError: (error: string) => void;
  existingModels?: ExternalModel[];
  onSkipToSelection?: () => void;
}

export function ExternalModelUpload({
  taskType,
  onUploadComplete,
  onError,
  existingModels = [],
  onSkipToSelection,
}: ExternalModelUploadProps) {
  const [uploadMode, setUploadMode] = useState<ModelSource>("native");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Docker mode state
  const [dockerfile, setDockerfile] = useState<File | null>(null);
  const [requirements, setRequirements] = useState<File | null>(null);
  const [dockerModelFiles, setDockerModelFiles] = useState<File[]>([]);

  // Native mode state
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [preprocessorFile, setPreprocessorFile] = useState<File | null>(null);
  const [labelEncoderFile, setLabelEncoderFile] = useState<File | null>(null);
  const [targetScalerFile, setTargetScalerFile] = useState<File | null>(null);

  const validateDockerFiles = useCallback((): string | null => {
    if (!name.trim()) return "Model name is required";
    if (!dockerfile) return "Dockerfile is required";
    if (dockerModelFiles.length === 0) return "At least one model file is required";

    const allowedExtensions = [".pkl", ".joblib", ".h5", ".pt", ".onnx", ".json", ".bin", ".weights"];
    for (const file of dockerModelFiles) {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return `Invalid file type: ${file.name}. Allowed: ${allowedExtensions.join(", ")}`;
      }
    }

    return null;
  }, [name, dockerfile, dockerModelFiles]);

  const validateNativeFiles = useCallback((): string | null => {
    if (!name.trim()) return "Model name is required";
    if (!modelFile) return "Model file (.pkl or .joblib) is required";

    const allowedExtensions = [".pkl", ".joblib", ".pickle"];
    const ext = modelFile.name.substring(modelFile.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return `Invalid model file type. Allowed: ${allowedExtensions.join(", ")}`;
    }

    return null;
  }, [name, modelFile]);

  const handleDockerUpload = useCallback(async () => {
    const validationError = validateDockerFiles();
    if (validationError) {
      onError(validationError);
      return;
    }

    setLoading(true);

    try {
      const model = await BenchmarkingAPI.uploadExternalModel(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          task_type: taskType,
        },
        dockerfile!,
        requirements,
        dockerModelFiles
      );

      // Trigger build
      await BenchmarkingAPI.buildContainer(model.model_id);

      onUploadComplete(model);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to upload model";
      onError(message);
    } finally {
      setLoading(false);
    }
  }, [
    name,
    description,
    taskType,
    dockerfile,
    requirements,
    dockerModelFiles,
    validateDockerFiles,
    onUploadComplete,
    onError,
  ]);

  const handleNativeUpload = useCallback(async () => {
    const validationError = validateNativeFiles();
    if (validationError) {
      onError(validationError);
      return;
    }

    setLoading(true);

    try {
      const model = await BenchmarkingAPI.uploadNativeModel(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          task_type: taskType,
        },
        modelFile!,
        preprocessorFile || undefined,
        taskType === "classification" ? labelEncoderFile || undefined : undefined,
        taskType === "regression" ? targetScalerFile || undefined : undefined
      );

      // Native models are immediately ready - no build needed
      onUploadComplete(model);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to upload native model";
      onError(message);
    } finally {
      setLoading(false);
    }
  }, [
    name,
    description,
    taskType,
    modelFile,
    preprocessorFile,
    labelEncoderFile,
    targetScalerFile,
    validateNativeFiles,
    onUploadComplete,
    onError,
  ]);

  const handleDockerfileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name === "Dockerfile" || file.name.endsWith(".dockerfile"))) {
      setDockerfile(file);
    }
  }, []);

  const handleRequirementsDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name === "requirements.txt") {
      setRequirements(file);
    }
  }, []);

  const handleModelFilesDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setDockerModelFiles((prev) => [...prev, ...files]);
  }, []);

  const handleNativeFileDrop = useCallback(
    (e: React.DragEvent, setter: (file: File | null) => void) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) {
        setter(file);
      }
    },
    []
  );

  const removeDockerModelFile = useCallback((index: number) => {
    setDockerModelFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const readyModels = existingModels.filter((m) => m.status === "ready");

  const renderFileDropZone = (
    file: File | null,
    setFile: (f: File | null) => void,
    label: string,
    required: boolean,
    accept: string,
    description: string,
    onDrop?: (e: React.DragEvent) => void
  ) => (
    <div className="space-y-2">
      <Label>
        {label} {required && "*"}
      </Label>
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          file
            ? "border-emerald-500 bg-emerald-50"
            : "border-slate-300 hover:border-slate-400"
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop || ((e) => handleNativeFileDrop(e, setFile))}
      >
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-sm text-emerald-700 truncate max-w-[150px]">
              {file.name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFile(null)}
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <Package className="h-8 w-8 mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-600">{description}</p>
            <label className="cursor-pointer">
              <span className="text-xs text-emerald-600 hover:underline">
                Browse files
              </span>
              <input
                type="file"
                className="hidden"
                accept={accept}
                onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                disabled={loading}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Existing Models Banner */}
      {readyModels.length > 0 && onSkipToSelection && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-900">
                  {readyModels.length} external model{readyModels.length > 1 ? "s" : ""} ready
                </p>
                <p className="text-sm text-blue-700">
                  You can proceed to model selection or upload more models
                </p>
              </div>
              <Button variant="outline" onClick={onSkipToSelection}>
                Skip to Selection
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upload External Model</CardTitle>
          <CardDescription>
            Upload your own model to compare against platform-trained models.
            Choose between a native scikit-learn model or a Docker container.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Mode Selector */}
          <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as ModelSource)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="native" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Native Model
                <Badge variant="secondary" className="ml-1 text-xs">
                  Recommended
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="docker" className="flex items-center gap-2">
                <Container className="h-4 w-4" />
                Docker Container
              </TabsTrigger>
            </TabsList>

            {/* Model Info - Common for both modes */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="model-name">Model Name *</Label>
                <Input
                  id="model-name"
                  placeholder="e.g., XGBoost Production v2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model-desc">Description (optional)</Label>
                <Input
                  id="model-desc"
                  placeholder="e.g., Tuned with custom features"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Native Model Upload */}
            <TabsContent value="native" className="space-y-6 mt-6">
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-emerald-800">
                      Instant Setup - No Build Required
                    </p>
                    <p className="text-sm text-emerald-700 mt-1">
                      Upload scikit-learn compatible pickle files directly. Your model
                      will be ready for benchmarking immediately.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderFileDropZone(
                  modelFile,
                  setModelFile,
                  "Model File",
                  true,
                  ".pkl,.joblib,.pickle",
                  "Drop .pkl or .joblib"
                )}
                {renderFileDropZone(
                  preprocessorFile,
                  setPreprocessorFile,
                  "Preprocessor",
                  false,
                  ".pkl,.joblib,.pickle",
                  "Optional preprocessor"
                )}
              </div>

              {taskType === "classification" && (
                <div className="grid grid-cols-2 gap-4">
                  {renderFileDropZone(
                    labelEncoderFile,
                    setLabelEncoderFile,
                    "Label Encoder",
                    false,
                    ".pkl,.joblib,.pickle",
                    "Optional label encoder"
                  )}
                  <div /> {/* Empty cell for alignment */}
                </div>
              )}

              {taskType === "regression" && (
                <div className="grid grid-cols-2 gap-4">
                  {renderFileDropZone(
                    targetScalerFile,
                    setTargetScalerFile,
                    "Target Scaler",
                    false,
                    ".pkl,.joblib,.pickle",
                    "Optional target scaler"
                  )}
                  <div /> {/* Empty cell for alignment */}
                </div>
              )}

              <div className="bg-slate-50 rounded-lg p-4 text-sm">
                <p className="font-medium text-slate-700 mb-2">
                  Native Model Requirements
                </p>
                <ul className="list-disc list-inside text-slate-600 space-y-1">
                  <li>Model must have a <code className="bg-slate-200 px-1 rounded">predict()</code> method</li>
                  <li>Preprocessor should have a <code className="bg-slate-200 px-1 rounded">transform()</code> method</li>
                  <li>Compatible with scikit-learn, XGBoost, LightGBM pipelines</li>
                  <li>Files trained on the same Python/sklearn version work best</li>
                </ul>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleNativeUpload}
                  disabled={loading || !name.trim() || !modelFile}
                  size="lg"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-5 w-5 mr-2" />
                  )}
                  Upload Model
                </Button>
              </div>
            </TabsContent>

            {/* Docker Model Upload */}
            <TabsContent value="docker" className="space-y-6 mt-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-start gap-3">
                  <Container className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800">
                      Full Container Isolation
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      For models requiring custom environments, dependencies, or
                      non-Python runtimes. Requires Docker build time.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Dockerfile */}
                <div className="space-y-2">
                  <Label>Dockerfile *</Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                      dockerfile
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-300 hover:border-slate-400"
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDockerfileDrop}
                  >
                    {dockerfile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileCode className="h-5 w-5 text-emerald-600" />
                        <span className="text-sm text-emerald-700">{dockerfile.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDockerfile(null)}
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <FileCode className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                        <p className="text-sm text-slate-600">Drop Dockerfile here</p>
                        <label className="cursor-pointer">
                          <span className="text-xs text-emerald-600 hover:underline">
                            or browse
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) =>
                              e.target.files?.[0] && setDockerfile(e.target.files[0])
                            }
                            disabled={loading}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>

                {/* Requirements */}
                <div className="space-y-2">
                  <Label>requirements.txt</Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                      requirements
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-300 hover:border-slate-400"
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleRequirementsDrop}
                  >
                    {requirements ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileCode className="h-5 w-5 text-emerald-600" />
                        <span className="text-sm text-emerald-700">{requirements.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRequirements(null)}
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <FileCode className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                        <p className="text-sm text-slate-600">Drop requirements.txt</p>
                        <label className="cursor-pointer">
                          <span className="text-xs text-emerald-600 hover:underline">
                            or browse
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept=".txt"
                            onChange={(e) =>
                              e.target.files?.[0] && setRequirements(e.target.files[0])
                            }
                            disabled={loading}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>

                {/* Model Files */}
                <div className="space-y-2">
                  <Label>Model Files *</Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                      dockerModelFiles.length > 0
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-300 hover:border-slate-400"
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleModelFilesDrop}
                  >
                    {dockerModelFiles.length > 0 ? (
                      <div className="space-y-2">
                        {dockerModelFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm bg-white rounded px-2 py-1"
                          >
                            <span className="text-slate-700 truncate">{file.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeDockerModelFile(idx)}
                              disabled={loading}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <label className="cursor-pointer">
                          <span className="text-xs text-emerald-600 hover:underline">
                            + Add more
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            multiple
                            onChange={(e) =>
                              e.target.files &&
                              setDockerModelFiles((prev) => [
                                ...prev,
                                ...Array.from(e.target.files!),
                              ])
                            }
                            disabled={loading}
                          />
                        </label>
                      </div>
                    ) : (
                      <>
                        <Package className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                        <p className="text-sm text-slate-600">Drop model files</p>
                        <p className="text-xs text-slate-400">.pkl, .joblib, .h5, .pt</p>
                        <label className="cursor-pointer">
                          <span className="text-xs text-emerald-600 hover:underline">
                            or browse
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            multiple
                            onChange={(e) =>
                              e.target.files &&
                              setDockerModelFiles(Array.from(e.target.files))
                            }
                            disabled={loading}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 text-sm">
                <p className="font-medium text-slate-700 mb-2">
                  Dockerfile Requirements
                </p>
                <ul className="list-disc list-inside text-slate-600 space-y-1">
                  <li>Expose a POST /predict endpoint that accepts JSON input</li>
                  <li>Input format: {`{"features": [[...], [...]]}`}</li>
                  <li>Output format: {`{"predictions": [...]}`}</li>
                  <li>Container must respond on port 8080</li>
                </ul>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleDockerUpload}
                  disabled={loading || !name.trim() || !dockerfile || dockerModelFiles.length === 0}
                  size="lg"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-5 w-5 mr-2" />
                  )}
                  Upload & Build
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
