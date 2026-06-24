import { Database } from "lucide-react";

export default function DatasetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <Database className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-4xl font-bold tracking-tight">
                AutoML Platform
              </h1>
              <p className="text-muted-foreground">
                Dataset Management & Machine Learning Workflows
              </p>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
