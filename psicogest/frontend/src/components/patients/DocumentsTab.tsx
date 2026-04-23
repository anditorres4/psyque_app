import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments, useUploadDocument, useDeleteDocument } from "@/hooks/useDocuments";
import { ClinicalDocument } from "@/lib/api";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const DOCUMENT_TYPES = [
  { value: "consentimiento", label: "Consentimiento informado" },
  { value: "evaluacion", label: "Evaluación psicológica" },
  { value: "informe", label: "Informe clínico" },
  { value: "otro", label: "Otro documento" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentRow({
  doc,
  onDelete,
}: {
  doc: ClinicalDocument;
  onDelete: (id: string) => void;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/v1/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (response.redirected) {
        window.location.href = response.url;
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div>
        <p className="text-sm font-medium text-[#1E3A5F]">{doc.filename}</p>
        <p className="text-xs text-muted-foreground">
          {DOCUMENT_TYPES.find((t) => t.value === doc.document_type)?.label ?? doc.document_type} · {formatFileSize(doc.file_size)} ·{" "}
          {new Date(doc.created_at).toLocaleDateString("es-CO")}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? "Descargando..." : "Descargar"}
        </Button>
        <button
          type="button"
          onClick={() => onDelete(doc.id)}
          className="text-red-400 hover:text-red-600 text-xs px-2"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

export function DocumentsTab({ patientId }: { patientId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("consentimiento");
  const [description, setDescription] = useState("");

  const { data: documents, isLoading, isError } = useDocuments(patientId);
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();

  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (selectedFile.size > MAX_FILE_SIZE) {
      setUploadError("El archivo excede el tamaño máximo de 10 MB.");
      return;
    }
    setUploadError(null);
    try {
      await uploadMutation.mutateAsync({
        patientId,
        file: selectedFile,
        documentType,
        description: description || undefined,
      });
      setSelectedFile(null);
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadError("Error al subir el documento. Intenta de nuevo.");
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("¿Eliminar este documento?")) return;
    try {
      await deleteMutation.mutateAsync({ documentId: docId, patientId });
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Adjunte consentimientos, evaluaciones e informes clínicos.
      </p>

      <div className="border rounded-lg p-4 space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => { setSelectedFile(e.target.files?.[0] || null); setUploadError(null); }}
          className="block w-full text-sm"
        />
        {selectedFile && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {selectedFile.name} — {formatFileSize(selectedFile.size)}
            </p>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Descripción (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
            {uploadError && (
              <p className="text-xs text-red-500">{uploadError}</p>
            )}
            <Button
              size="sm"
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Subiendo..." : "Subir documento"}
            </Button>
          </div>
        )}
      </div>

      {isLoading && <Skeleton className="h-20" />}

      {isError && !isLoading && <ErrorState message="Error al cargar documentos." />}

      {!isLoading && !isError && documents && documents.length === 0 && (
        <EmptyState
          title="Sin documentos"
          description="Adjunta consentimientos, evaluaciones e informes clínicos."
          icon="📎"
        />
      )}

      {!isLoading && documents && documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}