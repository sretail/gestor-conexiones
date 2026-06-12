
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "./supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, ExternalLink, Search, Server, Shield, KeyRound, Globe2, Building2, Download, Upload, LogOut, Copy, Check, Mail } from "lucide-react";

const CONNECTION_TYPES = ["VPN", "SAP", "OSS", "Fiori"];
const FIORI_ENVIRONMENTS = ["DES", "QA", "PRD"];
const CLIENTS_TABLE = "connection_clients";
const CRYPTO_FUNCTION = "crypto-config";

const emptyForms = {
  VPN: { vpnName: "", user: "", password: "" },
  SAP: {
    description: "",
    systemId: "",
    instanceNumber: "",
    saprouter: "",
    applicationServer: "",
    sapCredentials: [{ id: crypto.randomUUID(), user: "", password: "" }],
  },
  OSS: { user: "", password: "" },
  Fiori: { environment: "DES", url: "" },
};

const inputClass = "h-10 w-full rounded-xl border-slate-700 bg-slate-950/70 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-500";
const cardClass = "rounded-3xl border border-white/10 bg-slate-900/75 text-slate-100 shadow-2xl shadow-slate-950/40 backdrop-blur";
const iconButtonClass = "h-9 w-9 shrink-0 rounded-xl border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800";

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

function isEncryptedValue(value) {
  return Boolean(value && typeof value === "object" && value.__encrypted);
}

function maskPassword(value) {
  if (!value) return "—";
  if (isEncryptedValue(value)) return "••••••••";
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

async function invokeCryptoFunction(action, configs) {
  const { data, error } = await supabase.functions.invoke(CRYPTO_FUNCTION, {
    body: {
      action,
      configs: configs || [],
    },
  });

  if (error) {
    throw new Error(error.message || "Error llamando a la Edge Function de cifrado.");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.configs || [];
}

async function encryptConfigs(configs) {
  return invokeCryptoFunction("encryptConfigs", configs);
}

async function decryptConfigs(configs) {
  return invokeCryptoFunction("decryptConfigs", configs);
}

async function encryptClientsForExport(clients) {
  return Promise.all(
    (clients || []).map(async (client) => ({
      ...client,
      configs: await encryptConfigs(client.configs),
    }))
  );
}

function CopyButton({ value, label = "Copiar" }) {
  const [copied, setCopied] = useState(false);
  const copyValue = value === undefined || value === null || isEncryptedValue(value) ? "" : String(value);

  const copyToClipboard = async () => {
    if (!copyValue) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={!copyValue}
      onClick={copyToClipboard}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-cyan-400/10 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

async function saveJsonFile(fileName, data) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });

  if (window.showSaveFilePicker) {
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [{ description: "Archivo JSON", accept: { "application/json": [".json"] } }],
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
  const normalized = {
    id: config?.id || crypto.randomUUID(),
    type: CONNECTION_TYPES.includes(config?.type) ? config.type : "VPN",
    ...config,
  };

  if (normalized.type === "SAP") {
    normalized.sapCredentials = Array.isArray(normalized.sapCredentials)
      ? normalized.sapCredentials.map((credential) => ({
          id: credential?.id || crypto.randomUUID(),
          user: credential?.user || "",
          password: credential?.password || "",
        }))
      : [];
  }

  return normalized;
}

function ensureClient(client) {
  return {
    id: client?.id || crypto.randomUUID(),
    name: client?.name || "Cliente importado",
    configs: Array.isArray(client?.configs) ? client.configs.map(ensureConfig) : [],
  };
}

function mapDbClient(row) {
  return {
    id: row.id,
    name: row.name,
    configs: Array.isArray(row.configs) ? row.configs.map(ensureConfig) : [],
  };
}

function validateConfig(type, form) {
  const errors = [];

  if (type === "SAP") {
    if (!form.description?.trim()) errors.push("La descripción es obligatoria.");
    if (!form.systemId?.trim()) errors.push("El ID de sistema es obligatorio.");
    if (!form.instanceNumber?.trim()) errors.push("El número de instancia es obligatorio.");
    if (!form.applicationServer?.trim()) errors.push("El servidor de aplicación es obligatorio.");

    const sapCredentials = Array.isArray(form.sapCredentials) ? form.sapCredentials : [];
    sapCredentials.forEach((credential, index) => {
      const hasUser = credential.user?.trim();
      const hasPassword = credential.password?.trim();
      if (hasUser && !hasPassword) errors.push(`El password SAP ${index + 1} es obligatorio si informas usuario.`);
      if (!hasUser && hasPassword) errors.push(`El usuario SAP ${index + 1} es obligatorio si informas password.`);
    });
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

function formatPasswordForEmail(value) {
  return value ? maskPassword(value) : "—";
}

function formatClientForEmail(client) {
  if (!client) return "";

  const lines = [];
  lines.push("SAP CONNECTIVITY MANAGER");
  lines.push("==============================================");
  lines.push("");
  lines.push(`Cliente: ${client.name}`);
  lines.push("");
  lines.push("Configuraciones del cliente");
  lines.push("----------------------------------------------");

  if (!client.configs || client.configs.length === 0) {
    lines.push("");
    lines.push("No hay configuraciones registradas para este cliente.");
  }

  (client.configs || []).forEach((config, index) => {
    lines.push("");
    lines.push(`CONFIGURACIÓN ${index + 1}`);
    lines.push("──────────────────────────────────────────────");
    lines.push(`Tipo: ${config.type || "—"}`);

    if (config.type === "VPN") {
      lines.push(`Nombre VPN: ${config.vpnName || "—"}`);
      lines.push(`Usuario: ${config.user || "—"}`);
      lines.push(`Password: ${formatPasswordForEmail(config.password)}`);
    }

    if (config.type === "SAP") {
      lines.push(`Descripción: ${config.description || "—"}`);
      lines.push(`ID Sistema: ${config.systemId || "—"}`);
      lines.push(`Número de instancia: ${config.instanceNumber || "—"}`);
      lines.push(`Servidor de aplicación: ${config.applicationServer || "—"}`);
      lines.push(`Saprouter: ${config.saprouter || "—"}`);
      lines.push("");
      lines.push("Usuarios SAP:");

      if (Array.isArray(config.sapCredentials) && config.sapCredentials.length > 0) {
        config.sapCredentials.forEach((credential, credIndex) => {
          lines.push(`  ${credIndex + 1}. Usuario: ${credential.user || "—"}`);
          lines.push(`     Password: ${formatPasswordForEmail(credential.password)}`);
        });
      } else {
        lines.push("  —");
      }
    }

    if (config.type === "OSS") {
      lines.push(`Usuario: ${config.user || "—"}`);
      lines.push(`Password: ${formatPasswordForEmail(config.password)}`);
    }

    if (config.type === "Fiori") {
      lines.push(`Entorno: ${config.environment || "—"}`);
      lines.push(`URL: ${config.url || "—"}`);
    }

    lines.push("──────────────────────────────────────────────");
  });

  lines.push("");
  lines.push("Saludos,");
  lines.push("Alfredo Pradas");
  return lines.join("\n");
}

function shareClientByEmail(client) {
  if (!client) return;
  const subject = `Configuraciones de conexión - ${client.name}`;
  const body = formatClientForEmail(client);
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
  const sapCredentials = Array.isArray(form.sapCredentials) ? form.sapCredentials : [];

  const addSapCredential = () => {
    setForm((prev) => ({
      ...prev,
      sapCredentials: [...(Array.isArray(prev.sapCredentials) ? prev.sapCredentials : []), { id: crypto.randomUUID(), user: "", password: "" }],
    }));
  };

  const updateSapCredential = (credentialId, field, value) => {
    setForm((prev) => ({
      ...prev,
      sapCredentials: (Array.isArray(prev.sapCredentials) ? prev.sapCredentials : []).map((credential) =>
        credential.id === credentialId ? { ...credential, [field]: value } : credential
      ),
    }));
  };

  const deleteSapCredential = (credentialId) => {
    setForm((prev) => ({
      ...prev,
      sapCredentials: (Array.isArray(prev.sapCredentials) ? prev.sapCredentials : []).filter((credential) => credential.id !== credentialId),
    }));
  };

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

        <div className="sm:col-span-2">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Usuarios SAP</h3>
                <p className="text-xs text-slate-400">Añade una o varias parejas usuario/password para este sistema SAP.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addSapCredential} className="rounded-xl border-cyan-400/40 bg-transparent text-cyan-300 hover:bg-cyan-400/10 hover:text-cyan-200">
                <Plus className="mr-2 h-4 w-4" /> Añadir usuario
              </Button>
            </div>

            {sapCredentials.length === 0 ? (
              <div className="rounded-xl border border-dashed border-cyan-400/30 p-4 text-sm text-slate-400">No hay usuarios SAP añadidos.</div>
            ) : (
              <div className="space-y-3">
                {sapCredentials.map((credential, index) => (
                  <div key={credential.id} className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                    <Field label={`Usuario ${index + 1}`}><Input value={credential.user || ""} onChange={(e) => updateSapCredential(credential.id, "user", e.target.value)} placeholder="usuario SAP" className={inputClass} /></Field>
                    <Field label="Password"><Input type="password" value={credential.password || ""} onChange={(e) => updateSapCredential(credential.id, "password", e.target.value)} placeholder="••••••••" className={inputClass} /></Field>
                    <Button type="button" variant="outline" size="sm" onClick={() => deleteSapCredential(credential.id)} className="rounded-xl border-red-400/40 bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-200">
                      <Trash2 className="mr-2 h-4 w-4" /> Borrar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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

function DetailItem({ label, value, wide = false, copyValue }) {
  const displayValue = value || "—";
  return (
    <div className={`min-w-0 ${wide ? "md:col-span-2 xl:col-span-3" : ""}`}>
      <span className="font-semibold text-slate-100">{label}: </span>
      <span className="break-words text-slate-300">{displayValue}</span>
      <CopyButton value={copyValue ?? value} />
    </div>
  );
}

function ConfigDetails({ config }) {
  if (config.type === "VPN") {
    return (
      <div className="grid min-w-0 gap-x-8 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
        <DetailItem label="VPN" value={config.vpnName} />
        <DetailItem label="Usuario" value={config.user} />
        <DetailItem label="Password" value={maskPassword(config.password)} copyValue={config.password} />
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
        <div className="md:col-span-2 xl:col-span-3">
          <span className="font-semibold text-slate-100">Usuarios SAP: </span>
          {Array.isArray(config.sapCredentials) && config.sapCredentials.length > 0 ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {config.sapCredentials.map((credential, index) => (
                <div key={credential.id || index} className="rounded-xl border border-white/10 bg-slate-900/50 p-3 text-sm">
                  <div className="flex min-w-0 items-center gap-1"><span className="font-semibold text-slate-100">Usuario:</span><span className="min-w-0 break-words text-slate-300">{credential.user || "—"}</span><CopyButton value={credential.user} /></div>
                  <div className="flex min-w-0 items-center gap-1"><span className="font-semibold text-slate-100">Password:</span><span className="min-w-0 break-words text-slate-300">{maskPassword(credential.password)}</span><CopyButton value={credential.password} /></div>
                </div>
              ))}
            </div>
          ) : <span className="text-slate-300">—</span>}
        </div>
      </div>
    );
  }

  if (config.type === "OSS") {
    return (
      <div className="grid min-w-0 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <DetailItem label="Usuario" value={config.user} />
        <DetailItem label="Password" value={maskPassword(config.password)} copyValue={config.password} />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-8 gap-y-2 text-sm text-slate-300">
      <span className="inline-flex items-center gap-1"><b className="text-slate-100">Entorno:</b> {config.environment}<CopyButton value={config.environment} /></span>
      <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg px-2 py-1 text-cyan-300 hover:bg-cyan-400/10">
        <button className="min-w-0" onClick={() => window.open(config.url, "_blank", "noopener,noreferrer")}><span className="break-all">{config.url}</span></button>
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        <CopyButton value={config.url} />
      </span>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setAuthError("");
    setAuthMessage("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setAuthError(error.message);
  };

  const register = async () => {
    setAuthError("");
    setAuthMessage("");
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) setAuthError(error.message);
    else setAuthMessage("Usuario creado. Revisa tu email si Supabase pide confirmación.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 px-4 text-slate-100">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/50">
        <h1 className="mb-2 bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-2xl font-bold text-transparent">SAP Connectivity Manager</h1>
        <p className="mb-6 text-sm text-slate-400">Inicia sesión para acceder a la aplicación.</p>
        <div className="space-y-4">
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@dominio.com" className={inputClass} /></Field>
          <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className={inputClass} onKeyDown={(e) => { if (e.key === "Enter") login(); }} /></Field>
          {authError && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{authError}</div>}
          {authMessage && <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{authMessage}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button onClick={login} disabled={loading} className="w-full rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400">{loading ? "Validando..." : "Entrar"}</Button>
            <Button variant="outline" onClick={register} disabled={loading} className="w-full rounded-xl border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800">Registrarse</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConnectionManagerApp() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [clientName, setClientName] = useState("");
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState("Todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [selectedType, setSelectedType] = useState("VPN");
  const [form, setForm] = useState(emptyForms.VPN);
  const [errors, setErrors] = useState([]);
  const [appError, setAppError] = useState("");
  const [exportInfo, setExportInfo] = useState("");

  const importAllInputRef = useRef(null);
  const importClientInputRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
      if (!nextSession) {
        setClients([]);
        setSelectedClientId(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadClients = async () => {
    if (!session?.user?.id) return;
    setDataLoading(true);
    setAppError("");

    try {
      const { data, error } = await supabase
        .from(CLIENTS_TABLE)
        .select("id,name,configs,created_at,updated_at")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const loadedClients = await Promise.all(
        (data || []).map(async (row) => {
          const client = mapDbClient(row);
          return { ...client, configs: await decryptConfigs(client.configs) };
        })
      );

      setClients(loadedClients);
      setSelectedClientId((current) => loadedClients.some((client) => client.id === current) ? current : loadedClients[0]?.id || null);
    } catch (error) {
      setAppError(error.message);
      setClients([]);
      setSelectedClientId(null);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      loadClients();
    }
  }, [session?.user?.id]);

  const selectedClient = clients.find((client) => client.id === selectedClientId) || clients[0];

  const filteredConfigs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (selectedClient?.configs || []).filter((config) => {
      const matchesType = activeType === "Todos" || config.type === activeType;
      const searchable = JSON.stringify(config).toLowerCase();
      return matchesType && (!term || searchable.includes(term));
    });
  }, [selectedClient, activeType, search]);

  const insertClient = async (client) => {
    const encryptedConfigs = await encryptConfigs(client.configs);
    const { data, error } = await supabase
      .from(CLIENTS_TABLE)
      .insert({ name: client.name, configs: encryptedConfigs })
      .select("id,name,configs")
      .single();

    if (error) throw error;
    return { ...mapDbClient(data), configs: client.configs };
  };

  const updateClientConfigs = async (clientId, configs) => {
    const encryptedConfigs = await encryptConfigs(configs);
    const { data, error } = await supabase
      .from(CLIENTS_TABLE)
      .update({ configs: encryptedConfigs, updated_at: new Date().toISOString() })
      .eq("id", clientId)
      .select("id,name,configs")
      .single();

    if (error) throw error;
    return { ...mapDbClient(data), configs };
  };

  const addClient = async () => {
    const name = clientName.trim();
    if (!name) return;
    setAppError("");

    try {
      const newClient = await insertClient({ name, configs: [] });
      setClients((prev) => [...prev, newClient]);
      setSelectedClientId(newClient.id);
      setClientName("");
    } catch (error) {
      setAppError(error.message);
    }
  };

  const deleteClient = async (clientId) => {
    setAppError("");
    const { error } = await supabase.from(CLIENTS_TABLE).delete().eq("id", clientId);
    if (error) {
      setAppError(error.message);
      return;
    }
    setClients((prev) => {
      const next = prev.filter((client) => client.id !== clientId);
      if (selectedClientId === clientId) setSelectedClientId(next[0]?.id || null);
      return next;
    });
  };

  const exportAll = async () => {
    setAppError("");
    setExportInfo("");
    try {
      const encryptedClients = await encryptClientsForExport(clients);
      await saveJsonFile(`conexiones-cifradas-todas-${new Date().toISOString().slice(0, 10)}.json`, {
        version: 2,
        encrypted: true,
        scope: "all",
        exportedAt: new Date().toISOString(),
        clients: encryptedClients,
      });
      setExportInfo("Exportación cifrada completada correctamente.");
    } catch (error) {
      if (error?.name !== "AbortError") setAppError("No se ha podido exportar el archivo JSON cifrado.");
    }
  };

  const exportSelectedClient = async () => {
    if (!selectedClient) return;
    setAppError("");
    setExportInfo("");
    try {
      const encryptedConfigs = await encryptConfigs(selectedClient.configs);
      await saveJsonFile(`conexiones-cifradas-${sanitizeFileName(selectedClient.name)}-${new Date().toISOString().slice(0, 10)}.json`, {
        version: 2,
        encrypted: true,
        scope: "client",
        exportedAt: new Date().toISOString(),
        client: { ...selectedClient, configs: encryptedConfigs },
      });
      setExportInfo("Exportación cifrada del cliente completada correctamente.");
    } catch (error) {
      if (error?.name !== "AbortError") setAppError("No se ha podido exportar el archivo JSON cifrado del cliente.");
    }
  };

  const readJsonFile = (file, onSuccess) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        onSuccess(parsed);
        setAppError("");
        setExportInfo("");
      } catch {
        setAppError("No se ha podido importar el JSON. Revisa que el archivo tenga formato JSON válido.");
      }
    };
    reader.onerror = () => setAppError("No se ha podido leer el archivo seleccionado.");
    reader.readAsText(file, "UTF-8");
  };

  const importAll = (file) => {
    readJsonFile(file, async (data) => {
      const importedClients = Array.isArray(data?.clients) ? data.clients : Array.isArray(data) ? data : [];
      if (!importedClients.length) {
        setAppError("El JSON no contiene una lista de clientes válida.");
        return;
      }

      try {
        const normalizedClients = await Promise.all(
          importedClients.map(async (client) => {
            const normalizedClient = ensureClient(client);
            return { name: normalizedClient.name, configs: await encryptConfigs(normalizedClient.configs) };
          })
        );

        const { error: deleteError } = await supabase.from(CLIENTS_TABLE).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (deleteError) throw deleteError;

        const { data: inserted, error: insertError } = await supabase
          .from(CLIENTS_TABLE)
          .insert(normalizedClients)
          .select("id,name,configs,created_at");

        if (insertError) throw insertError;

        const loadedClients = await Promise.all(
          (inserted || []).map(async (row) => {
            const client = mapDbClient(row);
            return { ...client, configs: await decryptConfigs(client.configs) };
          })
        );

        setClients(loadedClients);
        setSelectedClientId(loadedClients[0]?.id || null);
        setActiveType("Todos");
        setSearch("");
      } catch (error) {
        setAppError(error.message);
      }
    });
  };

  const importSelectedClient = (file) => {
    readJsonFile(file, async (data) => {
      if (!selectedClient) return;
      const importedConfigs = Array.isArray(data?.client?.configs) ? data.client.configs : Array.isArray(data?.configs) ? data.configs : [];
      if (!importedConfigs.length && !Array.isArray(data?.client?.configs) && !Array.isArray(data?.configs)) {
        setAppError("El JSON no contiene configuraciones válidas para un cliente.");
        return;
      }

      try {
        const normalizedConfigs = ensureClient({ configs: importedConfigs }).configs;
        const decryptedOrPlainConfigs = await decryptConfigs(normalizedConfigs);
        const updatedClient = await updateClientConfigs(selectedClient.id, decryptedOrPlainConfigs);
        setClients((prev) => prev.map((client) => client.id === updatedClient.id ? updatedClient : client));
        setActiveType("Todos");
        setSearch("");
      } catch (error) {
        setAppError(error.message);
      }
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

  const saveConfig = async () => {
    if (!selectedClient) return;

    const validationErrors = validateConfig(selectedType, form);
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    try {
      const nextConfigs = editingConfig
        ? selectedClient.configs.map((config) => config.id === editingConfig.id ? { id: config.id, type: selectedType, ...form } : config)
        : [...selectedClient.configs, { id: crypto.randomUUID(), type: selectedType, ...form }];

      const updatedClient = await updateClientConfigs(selectedClient.id, nextConfigs);
      setClients((prev) => prev.map((client) => client.id === updatedClient.id ? updatedClient : client));
      setDialogOpen(false);
    } catch (error) {
      setErrors([error.message]);
    }
  };

  const deleteConfig = async (configId) => {
    if (!selectedClient) return;
    try {
      const nextConfigs = selectedClient.configs.filter((config) => config.id !== configId);
      const updatedClient = await updateClientConfigs(selectedClient.id, nextConfigs);
      setClients((prev) => prev.map((client) => client.id === updatedClient.id ? updatedClient : client));
    } catch (error) {
      setAppError(error.message);
    }
  };

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">Cargando sesión...</div>;
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 px-1 py-3 text-slate-100 sm:px-2 md:px-3">
      <input ref={importAllInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { importAll(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={importClientInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { importSelectedClient(e.target.files?.[0]); e.target.value = ""; }} />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex w-full max-w-none flex-col gap-4">
        <header className="grid w-full grid-cols-1 gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-cyan-950/30 backdrop-blur sm:p-5 xl:grid-cols-[1fr_auto_1fr] xl:items-center">
          <div className="hidden xl:block" />
          <div className="min-w-0 text-center">
            <h1 className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-2xl font-semibold tracking-wide text-transparent sm:text-3xl">SAP Connectivity Manager</h1>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">Gestión segura y centralizada de conexiones técnicas</p>
          </div>
          <div className="flex w-full flex-wrap justify-center gap-2 xl:justify-end">
            <Button variant="outline" size="icon" title="Exportar todo cifrado" aria-label="Exportar todo cifrado" onClick={exportAll} className={iconButtonClass}><Download className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" title="Importar todo" aria-label="Importar todo" onClick={() => importAllInputRef.current?.click()} className={iconButtonClass}><Upload className="h-4 w-4" /></Button>
            <Button onClick={openCreateDialog} className="h-9 rounded-xl bg-cyan-500 px-3 text-sm text-slate-950 shadow-lg shadow-cyan-950/30 hover:bg-cyan-400" disabled={!selectedClient}><Plus className="mr-2 h-4 w-4" /> Nueva configuración</Button>
            <Button variant="outline" size="icon" title="Salir" aria-label="Salir" onClick={() => supabase.auth.signOut()} className={iconButtonClass}><LogOut className="h-4 w-4" /></Button>
          </div>
        </header>

        {appError && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{appError}</div>}
        {exportInfo && <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{exportInfo}</div>}

        <main className="grid w-full grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Card className={`${cardClass} min-w-0`}>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg text-cyan-200"><Building2 className="h-5 w-5" /> Clientes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex min-w-0 gap-2">
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nombre cliente" onKeyDown={(e) => e.key === "Enter" && addClient()} className={inputClass} />
                <Button onClick={addClient} className="shrink-0 rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Plus className="h-4 w-4" /></Button>
              </div>
              {dataLoading ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">Cargando clientes...</div>
              ) : (
                <div className="space-y-2">
                  {clients.map((client) => (
                    <div key={client.id} className={`flex min-w-0 items-center justify-between rounded-2xl border p-3 transition ${selectedClientId === client.id ? "border-cyan-400/40 bg-cyan-400/10 shadow-sm" : "border-white/10 bg-slate-950/40 hover:bg-slate-800/70"}`}>
                      <button className="min-w-0 flex-1 text-left" onClick={() => setSelectedClientId(client.id)}>
                        <div className="truncate font-semibold text-slate-100">{client.name}</div>
                        <div className="text-xs text-slate-400">{client.configs.length} configuraciones</div>
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => deleteClient(client.id)} className="shrink-0 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={`${cardClass} min-w-0`}>
            <CardHeader className="space-y-4 pb-3">
              <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <CardTitle className="min-w-0 break-words text-lg text-cyan-200 sm:text-xl">Configuraciones de {selectedClient?.name || "—"}</CardTitle>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="icon" title="Exportar cliente cifrado" aria-label="Exportar cliente cifrado" onClick={exportSelectedClient} className={iconButtonClass} disabled={!selectedClient}><Download className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" title="Importar cliente" aria-label="Importar cliente" onClick={() => importClientInputRef.current?.click()} className={iconButtonClass} disabled={!selectedClient}><Upload className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" title="Compartir cliente por email" aria-label="Compartir cliente por email" onClick={() => shareClientByEmail(selectedClient)} className={iconButtonClass} disabled={!selectedClient}><Mail className="h-4 w-4" /></Button>
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
                    <TabsTrigger key={type} value={type} className="min-w-fit rounded-xl px-3 text-slate-300 transition hover:bg-slate-800 hover:text-cyan-200 data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 data-[state=active]:hover:bg-cyan-400 data-[state=active]:hover:text-slate-950">
                      {type !== "Todos" && <span className="mr-2">{typeIcon(type)}</span>}{type}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {!selectedClient ? (
                <div className="rounded-2xl border border-dashed border-cyan-400/30 bg-slate-950/40 p-8 text-center text-slate-400 sm:p-10">Crea un cliente para empezar.</div>
              ) : filteredConfigs.length === 0 ? (
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

        <footer className="pb-4 text-center text-xs text-slate-500">Desarrollado por Alfredo Pradas. Todos los derechos reservados.</footer>
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
