import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type RipsValidateResponse } from "@/lib/api";

export function RipsPage() {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [validation, setValidation] = useState<RipsValidateResponse | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  const { data: exports, isLoading } = useQuery({
    queryKey: ["rips"],
    queryFn: () => api.rips.list(20),
  });

  const validateMutation = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      api.rips.validate({ year, month }),
    onSuccess: (data) => {
      setValidation(data);
      setShowValidation(true);
    },
  });

  const generateMutation = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      api.rips.generate({ year, month }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rips"] });
      setShowValidation(false);
      setValidation(null);
    },
  });

  const handleValidate = () => {
    validateMutation.mutate({ year, month });
  };

  const handleGenerate = () => {
    generateMutation.mutate({ year, month });
  };

  const handleDownload = async (id: string, _period: string) => {
    const { blob, filename } = await api.rips.download(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(value);

  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString("es-CO") : "-";

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      generated: "bg-green-100 text-green-800",
      submitted: "bg-blue-100 text-blue-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">RIPS</h1>
        <p className="text-muted-foreground mt-1">
          Exportación de	RIPS para EPS/aseguradoras (Res. 2275/2023)
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Generar Exportación</CardTitle>
            <CardDescription>
              Seleccione el período para validar y generar el archivo RIPS
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>Año</Label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  min={2020}
                  max={2030}
                />
              </div>
              <div className="flex-1">
                <Label>Mes</Label>
                <Input
                  type="number"
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  min={1}
                  max={12}
                />
              </div>
              <Button
                variant="outline"
                onClick={handleValidate}
                disabled={validateMutation.isPending}
              >
                {validateMutation.isPending ? "Validando..." : "Validar"}
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || (showValidation && !validation?.valid)}
                title={showValidation && validation && !validation.valid ? "Corrija los errores antes de generar" : ""}
              >
                {generateMutation.isPending ? "Generando..." : "Generar"}
              </Button>
            </div>

            {validateMutation.isError && (
              <p className="mt-4 text-sm text-red-600">
                Error: {(validateMutation.error as Error).message}
              </p>
            )}

            {generateMutation.isError && (
              <p className="mt-4 text-sm text-red-600">
                Error: {(generateMutation.error as Error).message}
              </p>
            )}

            {generateMutation.isSuccess && (
              <p className="mt-4 text-sm text-green-600">
                {generateMutation.data.message}
              </p>
            )}

            {showValidation && validation && (
              <div className="mt-4 p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">
                    {validation.valid ? (
                      <span className="text-green-600">✓ Validación exitosa</span>
                    ) : (
                      <span className="text-red-600">✕ Errores de validación</span>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {validation.sessions_count} sesiones
                  </span>
                </div>

                {validation.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-red-600">Errores:</p>
                    <div className="max-h-48 overflow-y-auto border rounded">
                      <table className="w-full text-sm">
                        <thead className="bg-red-50 sticky top-0">
                          <tr>
                            <th className="text-left px-2 py-1">Campo</th>
                            <th className="text-left px-2 py-1">Mensaje</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validation.errors.map((err, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="px-2 py-1 font-mono text-xs">{err.field}</td>
                              <td className="px-2 py-1">{err.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {validation.warnings.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-yellow-600">Advertencias:</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground">
                      {validation.warnings.map((warn, idx) => (
                        <li key={idx}>{warn.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial de Exportaciones</CardTitle>
            <CardDescription>Últimas exportaciones generadas</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : exports && exports.length > 0 ? (
              <div className="space-y-3">
                {exports.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {String(exp.period_month).padStart(2, "0")}/{exp.period_year}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {exp.sessions_count} sesiones • {formatCurrency(exp.total_value_cop)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(exp.generated_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(exp.status)}
                      {exp.status === "generated" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(exp.id, `${exp.period_year}${String(exp.period_month).padStart(2, "0")}`)}
                        >
                          Descargar ZIP
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                No hay exportaciones generadas.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
