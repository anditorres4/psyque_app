import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAiConfig } from "@/hooks/useAiConfig";
import { AI_PROVIDERS, AIProvider } from "@/lib/ai";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export function AiSettings() {
  const { config, loading, error, fetchConfig, updateConfig, validateConfig } = useAiConfig();
  const [provider, setProvider] = useState<AIProvider | "">("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (config?.provider) {
      setProvider(config.provider);
      setModel(config.model || "");
    }
  }, [config]);

  const handleProviderChange = (value: string) => {
    const newProvider = value as AIProvider;
    setProvider(newProvider);
    setModel(AI_PROVIDERS[newProvider]?.models[0] || "");
  };

  const handleSave = async () => {
    if (!provider || !model || !apiKey) {
      setSaveError("Por favor completa todos los campos");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const result = await updateConfig(provider, model, apiKey);
      if (result.valid) {
        setSaveSuccess(true);
        setApiKey("");
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(result.message);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    setSaveError(null);
    try {
      await validateConfig();
      alert("Configuración válida");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al validar");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de IA</CardTitle>
        <CardDescription>
          Configura el proveedor de IA para usar las funcionalidades de Psyque IA.
          Necesitas una API key del proveedor seleccionado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !config && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando configuración...
          </div>
        )}

        {!loading && (
          <>
            <div className="space-y-2">
              <Label htmlFor="provider">Proveedor</Label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Selecciona un proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AI_PROVIDERS).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {provider && (
              <div className="space-y-2">
                <Label htmlFor="model">Modelo</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Selecciona un modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_PROVIDERS[provider]?.models.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Ingresa tu API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Tu API key se guarda de forma segura. No la compartas con nadie.
              </p>
            </div>

            {saveError && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Configuración guardada correctamente
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving || !provider || !model || !apiKey}
                className="bg-[#1E3A5F] hover:bg-[#162d4a]"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Configuración
              </Button>
              {config?.provider && (
                <Button variant="outline" onClick={handleValidate} disabled={loading}>
                  Validar
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}