import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ClinicalDocument } from "@/lib/api";

export function useDocuments(patientId: string) {
  return useQuery({
    queryKey: ["documents", patientId],
    queryFn: () => api.documents.listByPatient(patientId),
    enabled: !!patientId,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      patientId,
      file,
      documentType,
      description,
    }: {
      patientId: string;
      file: File;
      documentType: string;
      description?: string;
    }) => api.documents.upload(patientId, file, documentType, description),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["documents", variables.patientId] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, patientId }: { documentId: string; patientId: string }) =>
      api.documents.delete(documentId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["documents", variables.patientId] });
    },
  });
}