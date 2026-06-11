
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, ExternalLink, Search, Server, Shield, KeyRound, Globe2, Building2, Download, Upload } from "lucide-react";

const STORAGE_KEY = "gestor_conexiones_clients_v1";

const CONNECTION_TYPES = ["VPN", "SAP", "OSS", "Fiori"];
const FIORI_ENVIRONMENTS = ["DES", "QA", "PRD"];

const emptyForms = {
  VPN: { vpnName: "", user: "", password: "" },
  SAP: { description: "", systemId: "", instanceNumber: "", saprouter: "", applicationServer: "" },
  OSS: { user: "", password: "" },
  Fiori: { environment: "DES", url: "" },
};

const initialClients = [
  {
    id: crypto.randomUUID(),
    name: "Cliente Demo",
    configs: [
      {
        id: crypto.randomUUID(),
        type: "SAP",
        description: "Sistema desarrollo SAP",
        systemId: "S4D",
        instanceNumber: "00",
        saprouter: "/H/router.example.com/S/3299/H/",
        applicationServer: "s4d.example.local",
      },
      {
        id: crypto.randomUUID(),
        type: "Fiori",
        environment: "DES",
        url: "https://fiori.example.com",
      },
    ],
  },
];

const inputClass = "h-10 w-full rounded-xl border-slate-700 bg-slate-950/70 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-500";
const cardClass = "rounded-3xl border border-white/10 bg-slate-900/75 text-slate-100 shadow-2xl shadow-slate-950/40 backdrop-blur";
const secondaryButtonClass = "rounded-2xl border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800";

function typeIcon(type) {
  const className = "h-4 w-4 shrink-0";
  if (type === "VPN") return <Shield className={className} />;
  if (type === "SAP") return <Server className={className} />;
  if (type === "OSS") return <KeyRound className={className} />;
  return <Globe2 className={className} />;
}

function typeBadgeClass(type) {
  if (type === "VPN") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (type === "SAP") return "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";
  if (type === "OSS") return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  return "border-violet-400/30 bg-violet-400/10 text-violet-300";
}

function maskPassword(value) {
  if (!value) return "—";
  return "•".repeat(Math.min(String(value).length, 10));
}

function sanitizeFileName(value) {
  return String(value || "export")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "export";
}

async function saveJsonFile(fileName, data) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });

  if (window.showSaveFilePicker) {
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: "Archivo JSON",
          accept: { "application/json": [".json"] },
        },
      ],
    });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ensureConfig(config) {
  return {
    id: config?.id || crypto.randomUUID(),
    type: CONNECTION_TYPES.includes(config?.type) ? config.type : "VPN",
    ...config,
  };
}

function ensureClient(client) {
  return {
    id: client?.id || crypto.randomUUID(),
    name: client?.name || "Cliente importado",
    configs: Array.isArray(client?.configs) ? client.configs.map(ensureConfig) : [],
  };
}

function loadClientsFromLocalStorage() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialClients;

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) return initialClients;

    return parsed.map(ensureClient);
  } catch {
    return initialClients;
  }
}

function validateConfig(type, form) {
  const errors = [];

  if (type === "SAP") {
    if (!form.description?.trim()) errors.push("La descripción es obligatoria.");
    if (!form.systemId?.trim()) errors.push("El ID de sistema es obligatorio.");
    if (!form.instanceNumber?.trim()) errors.push("El número de instancia es obligatorio.");
    if (!form.applicationServer?.trim()) errors.push("El servidor de aplicación es obligatorio.");
  }

  if (type === "Fiori") {
    if (!form.environment?.trim()) errors.push("El entorno es obligatorio.");
    if (!form.url?.trim()) errors.push("La URL es obligatoria.");
    try {
      if (form.url?.trim()) new URL(form.url);
    } catch {
      errors.push("La URL no tiene un formato válido. Ejemplo: https://servidor/fiori");
    }
  }

  return errors;
}

function Field({ label, children }) {
  return (
    <div className="min-w-0 space-y-2">
      <Label className="text-sm font-medium text-slate-300">{label}</Label>
      {children}
    </div>
  );
}

function ConfigForm({ type, form, setForm }) {
  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  if (type === "VPN") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Nombre VPN"><Input value={form.vpnName} onChange={(e) => update("vpnName", e.target.value)} placeholder="VPN cliente" className={inputClass} /></Field>
        <Field label="Usuario"><Input value={form.user} onChange={(e) => update("user", e.target.value)} placeholder="usuario" className={inputClass} /></Field>
        <Field label="Password"><Input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="••••••••" className={inputClass} /></Field>
      </div>
    );
  }

  if (type === "SAP") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Descripción *"><Input value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Sistema productivo" className={inputClass} /></Field>
        <Field label="ID Sistema *"><Input value={form.systemId} onChange={(e) => update("systemId", e.target.value.toUpperCase())} placeholder="PRD" maxLength={3} className={inputClass} /></Field>
        <Field label="Número de instancia *"><Input value={form.instanceNumber} onChange={(e) => update("instanceNumber", e.target.value)} placeholder="00" className={inputClass} /></Field>
        <Field label="Servidor de aplicación *"><Input value={form.applicationServer} onChange={(e) => update("applicationServer", e.target.value)} placeholder="sapprd.empresa.local" className={inputClass} /></Field>
        <div className="sm:col-span-2"><Field label="String de saprouter"><Input value={form.saprouter} onChange={(e) => update("saprouter", e.target.value)} placeholder="/H/router/S/3299/H/servidor" className={inputClass} /></Field></div>
      </div>
    );
  }

  if (type === "OSS") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Usuario"><Input value={form.user} onChange={(e) => update("user", e.target.value)} placeholder="S-user" className={inputClass} /></Field>
        <Field label="Password"><Input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="••••••••" className={inputClass} /></Field>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
      <Field label="Entorno *">
        <Select value={form.environment} onValueChange={(value) => update("environment", value)}>
          <SelectTrigger className="h-10 rounded-xl border-slate-700 bg-slate-950/70 text-slate-100 focus:ring-cyan-500"><SelectValue /></SelectTrigger>
          <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
            {FIORI_ENVIRONMENTS.map((env) => <SelectItem key={env} value={env}>{env}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="URL *"><Input value={form.url} onChange={(e) => update("url", e.target.value)} placeholder="https://servidor/sap/bc/ui2/flp" className={inputClass} /></Field>
    </div>
  );
}

function DetailItem({ label, value, wide = false }) {
  return (
    <div className={`min-w-0 ${wide ? "md:col-span-2 xl:col-span-3" : ""}`}>
      <span className="font-semibold text-slate-100">{label}: </span>
      <span className="break-words text-slate-300">{value || "—"}</span>
    </div>
  );
}

function ConfigDetails({ config }) {
  if (config.type === "VPN") {
    return (
      <div className="grid min-w-0 gap-x-8 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
        <DetailItem label="VPN" value={config.vpnName} />
        <DetailItem label="Usuario" value={config.user} />
        <DetailItem label="Password" value={maskPassword(config.password)} />
      </div>
    );
  }

  if (config.type === "SAP") {
    return (
      <div className="grid min-w-0 gap-x-8 gap-y-2 text-sm md:grid-cols-2 xl:grid-cols-3">
        <DetailItem label="Descripción" value={config.description} />
        <DetailItem label="ID Sistema" value={config.systemId} />
        <DetailItem label="Instancia" value={config.instanceNumber} />
        <DetailItem label="Servidor" value={config.applicationServer} />
        <DetailItem label="Saprouter" value={config.saprouter} wide />
      </div>
    );
  }

  if (config.type === "OSS") {
    return (
      <div className="grid min-w-0 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <DetailItem label="Usuario" value={config.user} />
        <DetailItem label="Password" value={maskPassword(config.password)} />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-8 gap-y-2 text-sm text-slate-300">
      <span><b className="text-slate-100">Entorno:</b> {config.environment}</span>
      <button className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg px-2 py-1 text-cyan-300 hover:bg-cyan-400/10" onClick={() => window.open(config.url, "_blank", "noopener,noreferrer")}>
        <span className="break-all">{config.url}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" />
      </button>
    </div>
  );
}

export default function ConnectionManagerApp() {
  const [clients, setClients] = useState(loadClientsFromLocalStorage);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [clientName, setClientName] = useState("");
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState("Todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [selectedType, setSelectedType] = useState("VPN");
  const [form, setForm] = useState(emptyForms.VPN);
  const [errors, setErrors] = useState([]);
  const [importError, setImportError] = useState("");
  const [exportInfo, setExportInfo] = useState("");

  const importAllInputRef = useRef(null);
  const importClientInputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    } catch {
      setImportError("No se han podido guardar los datos en localStorage.");
    }
  }, [clients]);

  useEffect(() => {
    if (!clients.length) return;
    const exists = clients.some((client) => client.id === selectedClientId);
    if (!selectedClientId || !exists) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  const selectedClient = clients.find((client) => client.id === selectedClientId) || clients[0];

  const filteredConfigs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (selectedClient?.configs || []).filter((config) => {
      const matchesType = activeType === "Todos" || config.type === activeType;
      const searchable = JSON.stringify(config).toLowerCase();
      return matchesType && (!term || searchable.includes(term));
    });
  }, [selectedClient, activeType, search]);

  const addClient = () => {
    const name = clientName.trim();
    if (!name) return;
    const newClient = { id: crypto.randomUUID(), name, configs: [] };
    setClients((prev) => [...prev, newClient]);
    setSelectedClientId(newClient.id);
    setClientName("");
  };

  const deleteClient = (clientId) => {
    setClients((prev) => {
      const next = prev.filter((client) => client.id !== clientId);
      if (selectedClientId === clientId && next[0]) setSelectedClientId(next[0].id);
      return next;
    });
  };

  const exportAll = async () => {
    setImportError("");
    setExportInfo("");
    try {
      await saveJsonFile(`conexiones-todas-${new Date().toISOString().slice(0, 10)}.json`, {
        version: 1,
        scope: "all",
        exportedAt: new Date().toISOString(),
        clients,
      });
      setExportInfo("Exportación completada correctamente.");
    } catch (error) {
      if (error?.name !== "AbortError") setImportError("No se ha podido exportar el archivo JSON.");
    }
  };

  const exportSelectedClient = async () => {
    if (!selectedClient) return;
    setImportError("");
    setExportInfo("");
    try {
      await saveJsonFile(`conexiones-${sanitizeFileName(selectedClient.name)}-${new Date().toISOString().slice(0, 10)}.json`, {
        version: 1,
        scope: "client",
        exportedAt: new Date().toISOString(),
        client: selectedClient,
      });
      setExportInfo("Exportación del cliente completada correctamente.");
    } catch (error) {
      if (error?.name !== "AbortError") setImportError("No se ha podido exportar el archivo JSON del cliente.");
    }
  };

  const readJsonFile = (file, onSuccess) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        onSuccess(parsed);
        setImportError("");
        setExportInfo("");
      } catch {
        setImportError("No se ha podido importar el JSON. Revisa que el archivo tenga formato JSON válido.");
      }
    };
    reader.onerror = () => setImportError("No se ha podido leer el archivo seleccionado.");
    reader.readAsText(file, "UTF-8");
  };

  const importAll = (file) => {
    readJsonFile(file, (data) => {
      const importedClients = Array.isArray(data?.clients) ? data.clients : Array.isArray(data) ? data : [];
      if (!importedClients.length) {
        setImportError("El JSON no contiene una lista de clientes válida.");
        return;
      }
      const normalizedClients = importedClients.map(ensureClient);
      setClients(normalizedClients);
      setSelectedClientId(normalizedClients[0].id);
      setActiveType("Todos");
      setSearch("");
    });
  };

  const importSelectedClient = (file) => {
    readJsonFile(file, (data) => {
      const importedConfigs = Array.isArray(data?.client?.configs) ? data.client.configs : Array.isArray(data?.configs) ? data.configs : [];
      if (!importedConfigs.length && !Array.isArray(data?.client?.configs) && !Array.isArray(data?.configs)) {
        setImportError("El JSON no contiene configuraciones válidas para un cliente.");
        return;
      }
      const normalizedConfigs = importedConfigs.map(ensureConfig);
      setClients((prev) => prev.map((client) => client.id === selectedClientId ? { ...client, configs: normalizedConfigs } : client));
      setActiveType("Todos");
      setSearch("");
    });
  };

  const openCreateDialog = () => {
    setEditingConfig(null);
    setSelectedType("VPN");
    setForm(emptyForms.VPN);
    setErrors([]);
    setDialogOpen(true);
  };

  const openEditDialog = (config) => {
    setEditingConfig(config);
    setSelectedType(config.type);
    const { id, type, ...values } = config;
    setForm({ ...emptyForms[type], ...values });
    setErrors([]);
    setDialogOpen(true);
  };

  const onTypeChange = (type) => {
    setSelectedType(type);
    setForm(emptyForms[type]);
    setErrors([]);
  };

  const saveConfig = () => {
    const validationErrors = validateConfig(selectedType, form);
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    setClients((prev) => prev.map((client) => {
      if (client.id !== selectedClientId) return client;
      if (editingConfig) {
        return { ...client, configs: client.configs.map((config) => config.id === editingConfig.id ? { id: config.id, type: selectedType, ...form } : config) };
      }
      return { ...client, configs: [...client.configs, { id: crypto.randomUUID(), type: selectedType, ...form }] };
    }));

    setDialogOpen(false);
  };

  const deleteConfig = (configId) => {
    setClients((prev) => prev.map((client) => client.id === selectedClientId ? { ...client, configs: client.configs.filter((config) => config.id !== configId) } : client));
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 px-3 py-4 text-slate-100 sm:px-5 md:px-8">
      <input ref={importAllInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { importAll(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={importClientInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { importSelectedClient(e.target.files?.[0]); e.target.value = ""; }} />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex w-full flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-cyan-950/30 backdrop-blur sm:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h1 className="break-words bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">Gestor de conexiones a máquinas</h1>
            <p className="mt-2 text-sm text-slate-400 sm:text-base">CRUD de clientes y configuraciones VPN, SAP, OSS y Fiori. Guardado local automático activado.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto xl:justify-end">
            <Button variant="outline" onClick={exportAll} className={`${secondaryButtonClass} w-full sm:w-auto`}><Download className="mr-2 h-4 w-4" /> Exportar todo</Button>
            <Button variant="outline" onClick={() => importAllInputRef.current?.click()} className={`${secondaryButtonClass} w-full sm:w-auto`}><Upload className="mr-2 h-4 w-4" /> Importar todo</Button>
            <Button onClick={openCreateDialog} className="w-full rounded-2xl bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-950/30 hover:bg-cyan-400 sm:w-auto" disabled={!selectedClient}><Plus className="mr-2 h-4 w-4" /> Nueva configuración</Button>
          </div>
        </header>

        {importError && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{importError}</div>}
        {exportInfo && <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{exportInfo}</div>}

        <main className="grid w-full grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className={`${cardClass} min-w-0`}>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg text-cyan-200"><Building2 className="h-5 w-5" /> Clientes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex min-w-0 gap-2">
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nombre cliente" onKeyDown={(e) => e.key === "Enter" && addClient()} className={inputClass} />
                <Button onClick={addClient} className="shrink-0 rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2">
                {clients.map((client) => (
                  <div key={client.id} className={`flex min-w-0 items-center justify-between rounded-2xl border p-3 transition ${selectedClientId === client.id ? "border-cyan-400/40 bg-cyan-400/10 shadow-sm" : "border-white/10 bg-slate-950/40 hover:bg-slate-800/70"}`}>
                    <button className="min-w-0 flex-1 text-left" onClick={() => setSelectedClientId(client.id)}>
                      <div className="truncate font-semibold text-slate-100">{client.name}</div>
                      <div className="text-xs text-slate-400">{client.configs.length} configuraciones</div>
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => deleteClient(client.id)} disabled={clients.length === 1} className="shrink-0 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className={`${cardClass} min-w-0`}>
            <CardHeader className="space-y-4 pb-3">
              <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <CardTitle className="min-w-0 break-words text-lg text-cyan-200 sm:text-xl">Configuraciones de {selectedClient?.name}</CardTitle>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" size="sm" onClick={exportSelectedClient} className={`${secondaryButtonClass} w-full sm:w-auto`} disabled={!selectedClient}><Download className="mr-2 h-4 w-4" /> Exportar cliente</Button>
                    <Button variant="outline" size="sm" onClick={() => importClientInputRef.current?.click()} className={`${secondaryButtonClass} w-full sm:w-auto`} disabled={!selectedClient}><Upload className="mr-2 h-4 w-4" /> Importar cliente</Button>
                  </div>
                </div>
                <div className="relative w-full xl:max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-cyan-400" />
                  <Input className={`${inputClass} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar configuración..." />
                </div>
              </div>
              <Tabs value={activeType} onValueChange={setActiveType} className="w-full">
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-slate-950/60 p-1">
                  {["Todos", ...CONNECTION_TYPES].map((type) => (
                    <TabsTrigger key={type} value={type} className="min-w-fit rounded-xl px-3 text-slate-300 data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950">
                      {type !== "Todos" && <span className="mr-2">{typeIcon(type)}</span>}{type}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {filteredConfigs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-cyan-400/30 bg-slate-950/40 p-8 text-center text-slate-400 sm:p-10">No hay configuraciones para mostrar. Crea una nueva configuración para este cliente.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredConfigs.map((config) => (
                    <motion.div key={config.id} layout className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/50 p-4 shadow-sm transition hover:border-cyan-400/40 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-cyan-950/30">
                      <div className="mb-4 flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <Badge className={`gap-1 rounded-xl border ${typeBadgeClass(config.type)}`} variant="outline">{typeIcon(config.type)} {config.type}</Badge>
                          {config.type === "SAP" && <span className="break-words text-lg font-semibold text-slate-100">{config.description}</span>}
                          {config.type === "VPN" && <span className="break-words text-lg font-semibold text-slate-100">{config.vpnName || "VPN sin nombre"}</span>}
                          {config.type === "OSS" && <span className="text-lg font-semibold text-slate-100">OSS</span>}
                          {config.type === "Fiori" && <span className="text-lg font-semibold text-slate-100">Fiori {config.environment}</span>}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(config)} className="rounded-xl border-cyan-400/40 bg-transparent text-cyan-300 hover:bg-cyan-400/10 hover:text-cyan-200"><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
                          <Button variant="outline" size="sm" onClick={() => deleteConfig(config.id)} className="rounded-xl border-red-400/40 bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-200"><Trash2 className="mr-2 h-4 w-4" /> Borrar</Button>
                        </div>
                      </div>
                      <ConfigDetails config={config} />
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </motion.div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl border-white/10 bg-slate-900 text-slate-100 shadow-2xl shadow-slate-950">
          <DialogHeader><DialogTitle className="text-cyan-200">{editingConfig ? "Modificar configuración" : "Crear configuración"}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <Field label="Tipo de conexión">
              <Select value={selectedType} onValueChange={onTypeChange} disabled={Boolean(editingConfig)}>
                <SelectTrigger className="h-10 rounded-xl border-slate-700 bg-slate-950/70 text-slate-100 focus:ring-cyan-500"><SelectValue /></SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">{CONNECTION_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <ConfigForm type={selectedType} form={form} setForm={setForm} />
            {errors.length > 0 && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200"><ul className="list-inside list-disc">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800">Cancelar</Button>
            <Button onClick={saveConfig} className="rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
