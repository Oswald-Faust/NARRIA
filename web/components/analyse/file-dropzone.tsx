"use client";

import { useRef, useState } from "react";
import { UploadCloud, Loader2, AlertTriangle, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileDropzoneResult {
  text: string;
  title: string;
  author: string;
  sourceFilename: string;
  sourceFormat: string;
  wordCount: number;
  warnings: string[];
}

interface FileDropzoneProps {
  onExtracted: (result: FileDropzoneResult) => void;
  className?: string;
}

const ACCEPT = ".txt,.docx,.pdf,.odt,.epub";

export function FileDropzone({ onExtracted, className }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<string | null>(null);

  async function upload(file: File) {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/extract-file", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'extraction du fichier.");
        return;
      }
      setLastFile(file.name);
      onExtracted(data);
    } catch {
      setError("Erreur réseau lors de l'envoi du fichier.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-2 px-4 py-6 text-center transition-colors",
        dragOver && "border-soft-pink bg-surface",
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void upload(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-soft-purple" />
      ) : lastFile && !error ? (
        <FileCheck2 className="h-6 w-6 text-emerald-400" />
      ) : (
        <UploadCloud className="h-6 w-6 text-muted" />
      )}
      <p className="text-sm text-foreground">
        {lastFile && !error ? (
          <>Fichier importé : <span className="font-semibold">{lastFile}</span></>
        ) : (
          <>
            Glissez-déposez un fichier ou{" "}
            <button
              type="button"
              className="font-semibold text-soft-pink underline"
              onClick={() => inputRef.current?.click()}
            >
              parcourez vos fichiers
            </button>
          </>
        )}
      </p>
      <p className="text-xs text-muted">TXT, DOCX, PDF, ODT, EPUB — 25 Mo max</p>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
    </div>
  );
}
