import Link from "next/link";
import { Database, FlaskConical, FolderOpen } from "lucide-react";
import { AutoMLWorkflow } from "@/components/AutoMLWorkflow";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-3">
                <Database className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-4xl font-bold tracking-tight">
                  AutoML Platform
                </h1>
                <p className="text-muted-foreground">
                  End-to-end machine learning workflow automation
                </p>
              </div>
            </div>
            {/* Navigation Links */}
            <nav className="flex items-center gap-4">
              <Link
                href="/datasets"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <FolderOpen className="h-4 w-4" />
                Datasets
              </Link>
              <Link
                href="/experiments"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <FlaskConical className="h-4 w-4" />
                Experiments
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Workflow */}
        <main>
          <AutoMLWorkflow />
        </main>
      </div>
    </div>
  );
}
