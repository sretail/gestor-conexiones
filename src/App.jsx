
import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "./supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, ExternalLink, Search, Server, Shield, KeyRound, Globe2, Building2, LogOut, Copy, Check, Eye, EyeOff, FileDown, Share2, Mail, Link2, FileText, FileSpreadsheet, FileImage, FileArchive, File, Presentation } from "lucide-react";

const CONNECTION_TYPES = ["VPN", "SAP", "OSS", "Fiori", "Enlaces"];
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
  Enlaces: { links: [{ id: crypto.randomUUID(), description: "", url: "" }] },
};

const inputClass = "h-10 w-full rounded-xl border-[#dce2ea] bg-white text-[#182b56] placeholder:text-[#8b98aa] focus-visible:ring-[#67aef7]";
const cardClass = "rounded-3xl border border-[#edf1f6] bg-white/95 text-[#182b56] shadow-xl shadow-[#243e87]/10 backdrop-blur";
const iconButtonClass = "h-9 w-9 shrink-0 rounded-xl border-[#dce2ea] bg-white text-[#243e87] hover:bg-[#f4f9ff]";

const sortClientsByName = (clientList = []) =>
  [...clientList].sort((a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || ""), "es", {
      sensitivity: "base",
      numeric: true,
    })
  );

function typeIcon(type) {
  const className = "h-4 w-4 shrink-0";
  if (type === "VPN") return <Shield className={className} />;
  if (type === "SAP") return <Server className={className} />;
  if (type === "OSS") return <KeyRound className={className} />;
  if (type === "Enlaces") return <Link2 className={className} />;
  return <Globe2 className={className} />;
}

function typeBadgeClass(type) {
  if (type === "VPN") return "border-emerald-500/30 bg-emerald-50 text-emerald-700";
  if (type === "SAP") return "border-[#67aef7]/60 bg-[#eaf4ff] text-[#243e87]";
  if (type === "OSS") return "border-amber-500/30 bg-amber-50 text-amber-700";
  if (type === "Enlaces") return "border-[#243e87]/20 bg-[#eef3ff] text-[#243e87]";
  return "border-violet-500/30 bg-violet-50 text-violet-700";
}

function linkIconForUrl(url) {
  const className = "h-4 w-4 shrink-0";
  const cleanUrl = String(url || "").split("?")[0].split("#")[0].toLowerCase();

  if (cleanUrl.includes("/:w:/") || /\.(doc|docx|rtf)$/.test(cleanUrl)) return <FileText className={`${className} text-blue-700`} />;
  if (cleanUrl.includes("/:x:/") || /\.(xls|xlsx|csv)$/.test(cleanUrl)) return <FileSpreadsheet className={`${className} text-emerald-700`} />;
  if (cleanUrl.includes("/:p:/") || /\.(ppt|pptx)$/.test(cleanUrl)) return <Presentation className={`${className} text-orange-700`} />;
  if (/\.pdf$/.test(cleanUrl)) return <FileText className={`${className} text-red-700`} />;
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(cleanUrl)) return <FileImage className={`${className} text-purple-700`} />;
  if (/\.(zip|rar|7z)$/.test(cleanUrl)) return <FileArchive className={`${className} text-amber-700`} />;

  return <File className={`${className} text-[#243e87]`} />;
}

function isEncryptedValue(value) {
  return Boolean(value && typeof value === "object" && value.__encrypted);
}

function maskPassword(value) {
  if (!value) return "—";
  if (isEncryptedValue(value)) return "••••••••";
  return "•".repeat(Math.min(String(value).length, 10));
}

function displayPassword(value, showPasswords) {
  if (!showPasswords) return maskPassword(value);
  if (!value) return "—";
  if (isEncryptedValue(value)) return maskPassword(value);
  return String(value);
}

function normalizePdfValue(value) {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

function buildPdfRowsForConfig(config, showPasswords) {
  if (config.type === "VPN") {
    return [
      ["VPN", normalizePdfValue(config.vpnName)],
      ["Usuario", normalizePdfValue(config.user)],
      ["Password", displayPassword(config.password, showPasswords)],
    ];
  }

  if (config.type === "SAP") {
    const rows = [
      ["Descripción", normalizePdfValue(config.description)],
      ["ID Sistema", normalizePdfValue(config.systemId)],
      ["Instancia", normalizePdfValue(config.instanceNumber)],
      ["Servidor", normalizePdfValue(config.applicationServer)],
      ["Saprouter", normalizePdfValue(config.saprouter)],
    ];

    if (Array.isArray(config.sapCredentials) && config.sapCredentials.length > 0) {
      config.sapCredentials.forEach((credential, index) => {
        rows.push([`Usuario SAP ${index + 1}`, normalizePdfValue(credential.user)]);
        rows.push([`Password SAP ${index + 1}`, displayPassword(credential.password, showPasswords)]);
      });
    } else {
      rows.push(["Usuarios SAP", "—"]);
    }

    return rows;
  }

  if (config.type === "OSS") {
    return [
      ["Usuario", normalizePdfValue(config.user)],
      ["Password", displayPassword(config.password, showPasswords)],
    ];
  }

  if (config.type === "Fiori") {
    return [
      ["Entorno", normalizePdfValue(config.environment)],
      ["URL", normalizePdfValue(config.url)],
    ];
  }

  if (config.type === "Enlaces") {
    const links = Array.isArray(config.links) ? config.links : [];
    if (!links.length) return [["Enlaces", "—"]];
    return links.flatMap((link, index) => [
      [`Descripción enlace ${index + 1}`, normalizePdfValue(link.description)],
      [`URL enlace ${index + 1}`, normalizePdfValue(link.url)],
    ]);
  }

  return [["Datos", JSON.stringify(config, null, 2)]];
}

function buildChangeNotificationRows(config) {
  return buildPdfRowsForConfig(config, false).map(([label, value]) => `${label}: ${normalizePdfValue(value)}`);
}

function getConfigTitle(config) {
  if (config.type === "SAP") return config.description || "Sistema SAP";
  if (config.type === "VPN") return config.vpnName || "VPN sin nombre";
  if (config.type === "Fiori") return `Fiori ${config.environment || ""}`.trim();
  if (config.type === "Enlaces") return "Enlaces";
  return config.type || "Configuración";
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
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#62718a] transition hover:bg-[#eaf4ff] hover:text-[#243e87] disabled:cursor-not-allowed disabled:opacity-30"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
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

  if (normalized.type === "Enlaces") {
    normalized.links = Array.isArray(normalized.links)
      ? normalized.links.map((link) => ({
          id: link?.id || crypto.randomUUID(),
          description: link?.description || "",
          url: link?.url || "",
        }))
      : [];
  }

  return normalized;
}

function mapDbClient(row) {
  return {
    id: row.id,
    name: row.name,
    userId: row.user_id || null,
    isShared: Boolean(row.is_shared),
    sharedByEmail: row.shared_by_email || "",
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

  if (type === "Enlaces") {
    const links = Array.isArray(form.links) ? form.links : [];
    if (links.length === 0) errors.push("Debes informar al menos un enlace.");

    links.forEach((link, index) => {
      if (!link.description?.trim()) errors.push(`La descripción del enlace ${index + 1} es obligatoria.`);
      if (!link.url?.trim()) {
        errors.push(`La URL del enlace ${index + 1} es obligatoria.`);
        return;
      }

      try {
        new URL(link.url.trim());
      } catch {
        errors.push(`La URL del enlace ${index + 1} no tiene un formato válido. Ejemplo: https://servidor/documento.docx`);
      }
    });
  }

  return errors;
}

function Field({ label, children }) {
  return (
    <div className="min-w-0 space-y-2">
      <Label className="text-sm font-medium text-[#243e87]">{label}</Label>
      {children}
    </div>
  );
}

function ConfigForm({ type, form, setForm }) {
  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const sapCredentials = Array.isArray(form.sapCredentials) ? form.sapCredentials : [];
  const links = Array.isArray(form.links) ? form.links : [];

  const addLink = () => {
    setForm((prev) => ({
      ...prev,
      links: [...(Array.isArray(prev.links) ? prev.links : []), { id: crypto.randomUUID(), description: "", url: "" }],
    }));
  };

  const updateLink = (linkId, field, value) => {
    setForm((prev) => ({
      ...prev,
      links: (Array.isArray(prev.links) ? prev.links : []).map((link) =>
        link.id === linkId ? { ...link, [field]: value } : link
      ),
    }));
  };

  const deleteLink = (linkId) => {
    setForm((prev) => {
      const nextLinks = (Array.isArray(prev.links) ? prev.links : []).filter((link) => link.id !== linkId);
      return {
        ...prev,
        links: nextLinks.length ? nextLinks : [{ id: crypto.randomUUID(), description: "", url: "" }],
      };
    });
  };

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
          <div className="rounded-2xl border border-[#edf1f6] bg-[#f8fafd] p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#182b56]">Usuarios SAP</h3>
                <p className="text-xs text-[#62718a]">Añade una o varias parejas usuario/password para este sistema SAP.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addSapCredential} className="rounded-xl border-[#67aef7]/60 bg-white text-[#243e87] hover:bg-[#2d4a9a]/10 hover:text-[#243e87]">
                <Plus className="mr-2 h-4 w-4" /> Añadir usuario
              </Button>
            </div>

            {sapCredentials.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#67aef7]/40 p-4 text-sm text-[#62718a]">No hay usuarios SAP añadidos.</div>
            ) : (
              <div className="space-y-3">
                {sapCredentials.map((credential, index) => (
                  <div key={credential.id} className="grid grid-cols-1 gap-3 rounded-xl border border-[#edf1f6] bg-white p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                    <Field label={`Usuario ${index + 1}`}><Input value={credential.user || ""} onChange={(e) => updateSapCredential(credential.id, "user", e.target.value)} placeholder="usuario SAP" className={inputClass} /></Field>
                    <Field label="Password"><Input type="password" value={credential.password || ""} onChange={(e) => updateSapCredential(credential.id, "password", e.target.value)} placeholder="••••••••" className={inputClass} /></Field>
                    <Button type="button" variant="outline" size="sm" onClick={() => deleteSapCredential(credential.id)} className="rounded-xl border-red-400/40 bg-white text-red-300 hover:bg-red-500/10 hover:text-red-200">
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

  if (type === "Enlaces") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#edf1f6] bg-[#f8fafd] p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#182b56]">Enlaces</h3>
              <p className="text-xs text-[#62718a]">Añade una o varias URLs con descripción. La descripción será el texto visible de cada enlace.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLink} className="rounded-xl border-[#67aef7]/60 bg-white text-[#243e87] hover:bg-[#eaf4ff] hover:text-[#243e87]">
              <Plus className="mr-2 h-4 w-4" /> Añadir enlace
            </Button>
          </div>

          <div className="space-y-3">
            {links.map((link, index) => (
              <div key={link.id} className="grid grid-cols-1 gap-3 rounded-xl border border-[#edf1f6] bg-white p-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)_auto] md:items-end">
                <Field label={`Descripción ${index + 1}`}>
                  <Input value={link.description || ""} onChange={(e) => updateLink(link.id, "description", e.target.value)} placeholder="Ej. Manual de usuario" className={inputClass} />
                </Field>
                <Field label="URL completa">
                  <Input value={link.url || ""} onChange={(e) => updateLink(link.id, "url", e.target.value)} placeholder="https://servidor/ruta/documento.docx" className={inputClass} />
                </Field>
                <Button type="button" variant="outline" size="sm" onClick={() => deleteLink(link.id)} className="rounded-xl border-red-400/40 bg-white text-red-600 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="mr-2 h-4 w-4" /> Borrar
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
      <Field label="Entorno *">
        <Select value={form.environment} onValueChange={(value) => update("environment", value)}>
          <SelectTrigger className="h-10 rounded-xl border-[#dce2ea] bg-white text-[#182b56] focus:ring-[#67aef7]"><SelectValue /></SelectTrigger>
          <SelectContent className="border-[#dce2ea] bg-white text-[#182b56]">
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
      <span className="font-semibold text-[#182b56]">{label}: </span>
      <span className="break-words text-[#344767]">{displayValue}</span>
      <CopyButton value={copyValue ?? value} />
    </div>
  );
}

function ConfigDetails({ config, showPasswords = false }) {
  if (config.type === "VPN") {
    return (
      <div className="grid min-w-0 gap-x-8 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
        <DetailItem label="VPN" value={config.vpnName} />
        <DetailItem label="Usuario" value={config.user} />
        <DetailItem label="Password" value={displayPassword(config.password, showPasswords)} copyValue={config.password} />
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
          <span className="font-semibold text-[#182b56]">Usuarios SAP: </span>
          {Array.isArray(config.sapCredentials) && config.sapCredentials.length > 0 ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {config.sapCredentials.map((credential, index) => (
                <div key={credential.id || index} className="rounded-xl border border-[#edf1f6] bg-[#f8fafd] p-3 text-sm">
                  <div className="flex min-w-0 items-center gap-1"><span className="font-semibold text-[#182b56]">Usuario:</span><span className="min-w-0 break-words text-[#344767]">{credential.user || "—"}</span><CopyButton value={credential.user} /></div>
                  <div className="flex min-w-0 items-center gap-1"><span className="font-semibold text-[#182b56]">Password:</span><span className="min-w-0 break-words text-[#344767]">{displayPassword(credential.password, showPasswords)}</span><CopyButton value={credential.password} /></div>
                </div>
              ))}
            </div>
          ) : <span className="text-[#344767]">—</span>}
        </div>
      </div>
    );
  }

  if (config.type === "OSS") {
    return (
      <div className="grid min-w-0 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <DetailItem label="Usuario" value={config.user} />
        <DetailItem label="Password" value={displayPassword(config.password, showPasswords)} copyValue={config.password} />
      </div>
    );
  }

  if (config.type === "Enlaces") {
    const links = Array.isArray(config.links) ? config.links : [];

    return (
      <div className="grid min-w-0 gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
        {links.length === 0 ? (
          <span className="text-[#62718a]">No hay enlaces informados.</span>
        ) : (
          links.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
              className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-[#edf1f6] bg-[#f8fafd] px-3 py-2 text-left text-[#243e87] transition hover:border-[#67aef7] hover:bg-[#eaf4ff] hover:shadow-sm"
              title={link.url}
            >
              {linkIconForUrl(link.url)}
              <span className="min-w-0 truncate font-semibold">{link.description || link.url}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#62718a]" />
            </button>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-8 gap-y-2 text-sm text-[#344767]">
      <span className="inline-flex items-center gap-1"><b className="text-[#182b56]">Entorno:</b> {config.environment}<CopyButton value={config.environment} /></span>
      <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg px-2 py-1 text-[#243e87] hover:bg-[#2d4a9a]/10">
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
  const [resetLoading, setResetLoading] = useState(false);

  const login = async () => {
    setAuthError("");
    setAuthMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setAuthError(error.message);
    }
  };

  const register = async () => {
    setAuthError("");
    setAuthMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthMessage("Usuario creado. Revisa tu email si Supabase pide confirmación.");
    }
  };

  const resetPassword = async () => {
    setAuthError("");
    setAuthMessage("");

    if (!email.trim()) {
      setAuthError("Introduce tu email para poder recuperar la contraseña.");
      return;
    }

    setResetLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });

    setResetLoading(false);

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthMessage("Te hemos enviado un email para restablecer tu contraseña.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#243e87] px-4 text-[#182b56]">
      <div className="flex w-full max-w-xl flex-col items-center gap-5">
        <img src="/seidor-logo.png" alt="SEIDOR" className="h-16 w-auto object-contain" />

        <div className="w-full rounded-3xl border border-white/20 bg-white p-6 shadow-2xl shadow-black/20">
          <h1 className="mb-2 text-2xl font-bold text-[#243e87]">
            SAP Connectivity Manager
          </h1>

          <p className="mb-6 text-sm text-[#62718a]">
            Inicia sesión para acceder a la aplicación.
          </p>

          <div className="space-y-4">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@dominio.com"
              className={inputClass}
            />
          </Field>

          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className={inputClass}
              onKeyDown={(e) => {
                if (e.key === "Enter") login();
              }}
            />
          </Field>

          {authError && (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              {authError}
            </div>
          )}

          {authMessage && (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              {authMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              onClick={login}
              disabled={loading}
              className="w-full rounded-xl bg-[#243e87] text-white hover:bg-[#2d4a9a]"
            >
              {loading ? "Validando..." : "Entrar"}
            </Button>

            <Button
              variant="outline"
              onClick={register}
              disabled={loading}
              className="w-full rounded-xl border-[#dce2ea] bg-white text-[#243e87] hover:bg-[#f4f9ff]"
            >
              Registrarse
            </Button>
          </div>

          <button
            type="button"
            onClick={resetPassword}
            disabled={resetLoading}
            className="w-full text-center text-sm text-[#243e87] transition hover:text-[#2d4a9a] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resetLoading ? "Enviando email..." : "¿Has olvidado tu contraseña?"}
          </button>
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
  const [appInfo, setAppInfo] = useState("");
  const [appInfoKey, setAppInfoKey] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState({ open: false });
  const [clientInfo, setClientInfo] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
const [passwordRecovery, setPasswordRecovery] = useState(false);
const [newPassword, setNewPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
const [recoveryError, setRecoveryError] = useState("");
const [recoveryMessage, setRecoveryMessage] = useState("");
const [recoveryLoading, setRecoveryLoading] = useState(false);

  const showAppInfo = (message) => {
    setAppInfo(message);
    setAppInfoKey(Date.now());
  };

  const openConfirmDialog = ({ title, message, confirmLabel = "Confirmar", onConfirm }) => {
    setConfirmDialog({ open: true, title, message, confirmLabel, onConfirm });
  };

  const closeConfirmDialog = () => setConfirmDialog({ open: false });

  const handleConfirmDialog = async () => {
    const onConfirm = confirmDialog.onConfirm;
    closeConfirmDialog();
    if (typeof onConfirm === "function") await onConfirm();
  };

  useEffect(() => {
    if (!appInfo) return undefined;
    const timeoutId = window.setTimeout(() => setAppInfo(""), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [appInfo, appInfoKey]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);

      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
      }

      if (!nextSession) {
        setClients([]);
        setSelectedClientId(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const updateRecoveredPassword = async (e) => {
    e?.preventDefault?.();

    setRecoveryError("");
    setRecoveryMessage("");

    const trimmedNewPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (!trimmedNewPassword) {
      setRecoveryError("Introduce la nueva contraseña.");
      return;
    }

    if (trimmedNewPassword.length < 6) {
      setRecoveryError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (!trimmedConfirmPassword) {
      setRecoveryError("Confirma la nueva contraseña.");
      return;
    }

    if (trimmedNewPassword !== trimmedConfirmPassword) {
      setRecoveryError("Las contraseñas no coinciden.");
      return;
    }

    setRecoveryLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: trimmedNewPassword,
    });

    setRecoveryLoading(false);

    if (error) {
      setRecoveryError(error.message);
      return;
    }

    setRecoveryMessage("Contraseña actualizada correctamente.");
    setNewPassword("");
    setConfirmPassword("");

    window.setTimeout(() => {
      setPasswordRecovery(false);
      setRecoveryMessage("");
    }, 1200);
  };

  const loadClients = async () => {
    if (!session?.user?.id) return;
    setDataLoading(true);
    setAppError("");

    try {
      const { data, error } = await supabase
        .from(CLIENTS_TABLE)
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const loadedClients = await Promise.all(
        (data || []).map(async (row) => {
          const client = mapDbClient(row);
          return { ...client, configs: await decryptConfigs(client.configs) };
        })
      );

      const sortedClients = sortClientsByName(loadedClients);
      setClients(sortedClients);
      setSelectedClientId((current) => sortedClients.some((client) => client.id === current) ? current : sortedClients[0]?.id || null);
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

  useEffect(() => {
    setShowPasswords(false);
  }, [selectedClientId]);

  const selectedClientHasPasswords = Boolean(
    selectedClient?.configs?.some((config) => ["VPN", "SAP", "OSS"].includes(config.type))
  );

  const isClientOwner = (client) => !client?.userId || client.userId === session?.user?.id;
  const selectedClientIsEditable = Boolean(selectedClient && isClientOwner(selectedClient));
  const selectedClientIsSharedByOtherUser = Boolean(selectedClient?.isShared && !isClientOwner(selectedClient));

  const clientCardClass = (client) => {
    const selected = selectedClientId === client.id;
    const sharedByCurrentUser = client.isShared && isClientOwner(client);
    const sharedByOtherUser = client.isShared && !isClientOwner(client);

    if (sharedByCurrentUser) {
      return `flex min-w-0 items-center justify-between rounded-2xl border p-3 transition ${selected ? "border-emerald-500/70 bg-emerald-100 shadow-sm" : "border-emerald-400/50 bg-emerald-50 hover:border-emerald-500/70 hover:bg-emerald-100 hover:shadow-sm"}`;
    }

    if (sharedByOtherUser) {
      return `flex min-w-0 items-center justify-between rounded-2xl border p-3 transition ${selected ? "border-amber-500/70 bg-amber-100 shadow-sm" : "border-amber-400/50 bg-amber-50 hover:border-amber-500/70 hover:bg-amber-100 hover:shadow-sm"}`;
    }

    return `flex min-w-0 items-center justify-between rounded-2xl border p-3 transition ${selected ? "border-[#67aef7]/70 bg-[#dbeafe] shadow-sm" : "border-[#edf1f6] bg-[#f8fafd] hover:border-[#67aef7]/60 hover:bg-[#dbeafe] hover:shadow-sm"}`;
  };

  const filteredClients = useMemo(() => {
    const term = clientName.trim().toLowerCase();
    const matchingClients = !term
      ? clients
      : clients.filter((client) => client.name.toLowerCase().includes(term));

    return sortClientsByName(matchingClients);
  }, [clients, clientName]);

  const filteredConfigs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (selectedClient?.configs || [])
      .filter((config) => {
        const matchesType = activeType === "Todos" || config.type === activeType;
        const searchable = JSON.stringify(config).toLowerCase();
        return matchesType && (!term || searchable.includes(term));
      })
      .sort((a, b) => {
        if (a.type === "Enlaces" && b.type !== "Enlaces") return -1;
        if (a.type !== "Enlaces" && b.type === "Enlaces") return 1;
        return 0;
      });
  }, [selectedClient, activeType, search]);

  const insertClient = async (client) => {
    const encryptedConfigs = await encryptConfigs(client.configs);
    const { data, error } = await supabase
      .from(CLIENTS_TABLE)
      .insert({
        name: client.name,
        configs: encryptedConfigs,
        user_id: session?.user?.id,
        is_shared: false,
        shared_by_email: "",
      })
      .select("*")
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
      .select("*")
      .single();

    if (error) throw error;
    return { ...mapDbClient(data), configs };
  };

  const addClient = async () => {
    const name = clientName.trim();
    if (!name) return;

    setAppError("");
    setAppInfo("");
    setClientInfo("");

    const normalizedName = name.toLowerCase().replace(/\s+/g, " ");
    const alreadyExists = clients.some((client) => client.name.trim().toLowerCase().replace(/\s+/g, " ") === normalizedName);

    if (alreadyExists) {
      setClientInfo(`Ya existe un cliente con el nombre "${name}". No se ha creado de nuevo.`);
      return;
    }

    try {
      const newClient = await insertClient({ name, configs: [] });
      setClients((prev) => sortClientsByName([...prev, newClient]));
      setSelectedClientId(newClient.id);
      setClientName("");
      showAppInfo(`El cliente "${newClient.name}" se ha creado correctamente.`);
    } catch (error) {
      setAppError(error.message);
    }
  };

  const deleteClient = async (clientId) => {
    setAppError("");
    setAppInfo("");
    const clientToDelete = clients.find((client) => client.id === clientId);
    if (clientToDelete && !isClientOwner(clientToDelete)) {
      setAppError("No puedes borrar un cliente compartido por otro usuario.");
      return;
    }

    openConfirmDialog({
      title: "Borrar cliente",
      message: `¿Seguro que quieres borrar el cliente "${clientToDelete?.name || "seleccionado"}" y todas sus configuraciones? Esta acción no se puede deshacer.`,
      confirmLabel: "Borrar cliente",
      onConfirm: async () => {
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
        showAppInfo(`El cliente "${clientToDelete?.name || "seleccionado"}" se ha borrado correctamente.`);
      },
    });
  };

  const toggleClientSharing = async (client) => {
    if (!client || !isClientOwner(client)) return;

    setAppError("");
    setAppInfo("");
    const nextSharedValue = !client.isShared;

    const { error } = await supabase
      .from(CLIENTS_TABLE)
      .update({
        is_shared: nextSharedValue,
        shared_by_email: nextSharedValue ? session?.user?.email || "" : "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", client.id);

    if (error) {
      setAppError(error.message);
      return;
    }

    setClients((prev) =>
      sortClientsByName(
        prev.map((item) =>
          item.id === client.id
            ? {
                ...item,
                isShared: nextSharedValue,
                sharedByEmail: nextSharedValue ? session?.user?.email || "" : "",
              }
            : item
        )
      )
    );
    showAppInfo(
      nextSharedValue
        ? `Las configuraciones de "${client.name}" se han compartido con todos los usuarios de la app.`
        : `Las configuraciones de "${client.name}" han dejado de estar compartidas.`
    );
  };

const openCreateDialog = () => {
    setEditingConfig(null);
    setSelectedType("VPN");
    setForm(emptyForms.VPN);
    setErrors([]);
    setDialogOpen(true);
  };

  const notifyConfigChange = (config) => {
    if (!selectedClient || !selectedClientIsSharedByOtherUser) return;

    const recipient = selectedClient.sharedByEmail || "";
    const configTitle = getConfigTitle(config);
    const subject = `Solicitud de cambio - Cliente ${selectedClient.name} - ${config.type}`;
    const bodyLines = [
      "Hola,",
      "",
      "Quiero notificar un cambio sobre la siguiente configuración compartida:",
      "",
      `Cliente: ${selectedClient.name}`,
      `Tipo de conexión: ${config.type}`,
      `Configuración: ${configTitle}`,
      "",
      "Datos actuales de la conexión:",
      "----------------------------------------",
      ...buildChangeNotificationRows(config),
      "",
      "Cambio solicitado:",
      "----------------------------------------",
      "Campo a modificar:",
      "Valor actual:",
      "Nuevo valor propuesto:",
      "Motivo del cambio:",
      "Prioridad:",
      "Observaciones adicionales:",
      "",
      "Gracias.",
    ];

    window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
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
    if (!selectedClient || !selectedClientIsEditable) return;

    setAppError("");
    setAppInfo("");
    const wasEditingConfig = Boolean(editingConfig);

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
      showAppInfo(
        wasEditingConfig
          ? `La configuración de "${selectedClient.name}" se ha modificado correctamente.`
          : `Se ha creado una nueva configuración para "${selectedClient.name}".`
      );
    } catch (error) {
      setErrors([error.message]);
    }
  };

  const deleteConfig = async (configId) => {
    if (!selectedClient || !selectedClientIsEditable) return;
    setAppError("");
    setAppInfo("");

    const configToDelete = selectedClient.configs.find((config) => config.id === configId);
    const configName = getConfigTitle(configToDelete || {});

    openConfirmDialog({
      title: "Borrar configuración",
      message: `¿Seguro que quieres borrar la configuración "${configName}" del cliente "${selectedClient.name}"? Esta acción no se puede deshacer.`,
      confirmLabel: "Borrar configuración",
      onConfirm: async () => {
        try {
          const nextConfigs = selectedClient.configs.filter((config) => config.id !== configId);
          const updatedClient = await updateClientConfigs(selectedClient.id, nextConfigs);
          setClients((prev) => prev.map((client) => client.id === updatedClient.id ? updatedClient : client));
        } catch (error) {
          setAppError(error.message);
        }
      },
    });
  };

  const downloadClientPdf = async () => {
    if (!selectedClient) return;

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      let y = 16;

      const colors = {
        primary: [36, 62, 135],
        primaryLight: [103, 174, 247],
        background: [244, 246, 249],
        card: [255, 255, 255],
        cardSoft: [248, 250, 253],
        border: [237, 241, 246],
        text: [24, 43, 86],
        muted: [98, 113, 138],
        white: [255, 255, 255],
      };

      const sanitizePdfFileName = (value) =>
        String(value || "cliente")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9áéíóúñü_-]+/gi, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "") || "cliente";

      const ensureSpace = (requiredHeight = 20) => {
        if (y + requiredHeight <= pageHeight - margin) return;
        pdf.addPage();
        y = 16;
      };

      const drawHeader = () => {
        pdf.setFillColor(...colors.primary);
        pdf.roundedRect(margin, y, contentWidth, 24, 4, 4, "F");
        pdf.setTextColor(...colors.white);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(15);
        pdf.text("SAP Connectivity Manager", margin + 6, y + 9);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.text("Exportación de configuraciones del cliente", margin + 6, y + 16);
        y += 32;
      };

      const drawClientSummary = () => {
        pdf.setFillColor(...colors.card);
        pdf.setDrawColor(...colors.border);
        pdf.roundedRect(margin, y, contentWidth, 24, 4, 4, "FD");
        pdf.setTextColor(...colors.primary);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text(`Cliente: ${selectedClient.name || "—"}`, margin + 5, y + 8);
        pdf.setTextColor(...colors.muted);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        const exportedAt = new Date().toLocaleString("es-ES");
        pdf.text(`Configuraciones: ${selectedClient.configs?.length || 0}`, margin + 5, y + 15);
        pdf.text(`Generado: ${exportedAt}`, margin + 74, y + 15);
        pdf.text(`Passwords: ${showPasswords ? "visibles" : "ocultas"}`, margin + 5, y + 21);
        y += 32;
      };

      const drawBadge = (type, x, badgeY) => {
        pdf.setFillColor(234, 244, 255);
        pdf.setDrawColor(103, 174, 247);
        pdf.roundedRect(x, badgeY, 28, 7, 2, 2, "FD");
        pdf.setTextColor(...colors.primary);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.text(type || "—", x + 3, badgeY + 4.8);
      };

      const writeWrappedText = (text, x, textY, maxWidth, options = {}) => {
        const fontSize = options.fontSize || 8.5;
        const lineHeight = options.lineHeight || 4.2;
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(normalizePdfValue(text), maxWidth);
        lines.forEach((line) => {
          pdf.text(line, x, textY);
          textY += lineHeight;
        });
        return { nextY: textY, lines: lines.length };
      };

      const drawConfigCard = (config, index) => {
        const rows = buildPdfRowsForConfig(config, showPasswords);
        const rowHeights = rows.map(([_label, value]) => {
          const valueLines = pdf.splitTextToSize(normalizePdfValue(value), contentWidth - 46);
          return Math.max(8, valueLines.length * 4.2 + 3);
        });
        const cardHeight = 18 + rowHeights.reduce((sum, height) => sum + height, 0) + 7;
        ensureSpace(cardHeight + 6);

        const cardY = y;
        pdf.setFillColor(...colors.card);
        pdf.setDrawColor(...colors.border);
        pdf.roundedRect(margin, cardY, contentWidth, cardHeight, 4, 4, "FD");

        pdf.setTextColor(...colors.text);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        const title =
          config.type === "SAP" ? config.description || "Sistema SAP" :
          config.type === "VPN" ? config.vpnName || "VPN sin nombre" :
          config.type === "Fiori" ? `Fiori ${config.environment || ""}`.trim() :
          config.type === "Enlaces" ? "Enlaces" :
          config.type || "Configuración";
        pdf.text(`${index + 1}. ${title}`, margin + 5, y + 8);
        drawBadge(config.type, pageWidth - margin - 34, y + 3.2);
        y += 17;

        rows.forEach(([label, value], rowIndex) => {
          const rowHeight = rowHeights[rowIndex];
          if (rowIndex % 2 === 0) {
            pdf.setFillColor(...colors.cardSoft);
            pdf.roundedRect(margin + 4, y - 4, contentWidth - 8, rowHeight, 2, 2, "F");
          }

          pdf.setTextColor(...colors.primary);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.5);
          pdf.text(`${label}:`, margin + 7, y + 1);

          pdf.setTextColor(...colors.text);
          pdf.setFont("helvetica", "normal");
          writeWrappedText(value, margin + 44, y + 1, contentWidth - 50, { fontSize: 8.5 });
          y += rowHeight;
        });

        y = cardY + cardHeight + 6;
      };

      drawHeader();
      drawClientSummary();

      if (!selectedClient.configs || selectedClient.configs.length === 0) {
        pdf.setTextColor(...colors.muted);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text("No hay configuraciones registradas para este cliente.", margin, y);
      } else {
        const orderedConfigs = [...selectedClient.configs].sort((a, b) => {
          if (a.type === "Enlaces" && b.type !== "Enlaces") return -1;
          if (a.type !== "Enlaces" && b.type === "Enlaces") return 1;
          return 0;
        });
        orderedConfigs.forEach((config, index) => drawConfigCard(config, index));
      }

      const totalPages = pdf.internal.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        pdf.setPage(pageNumber);
        pdf.setTextColor(...colors.muted);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin - 24, pageHeight - 8);
      }

      pdf.save(`configuraciones-${sanitizePdfFileName(selectedClient.name)}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      setAppError("No se ha podido generar el PDF. Revisa que tengas instalada la dependencia jspdf.");
    }
  };


if (passwordRecovery) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-4 text-[#182b56]">
      <div className="w-full max-w-md rounded-3xl border border-[#edf1f6] bg-white p-6 shadow-2xl shadow-[#243e87]/10">
        <h1 className="mb-2 text-2xl font-bold text-[#243e87]">
          Nueva contraseña
        </h1>

        <p className="mb-6 text-sm text-[#62718a]">
          Introduce tu nueva contraseña para completar la recuperación.
        </p>

        <Field label="Nueva contraseña">
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nueva contraseña"
            className={inputClass}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateRecoveredPassword();
            }}
          />
        </Field>
        <div className="mt-4">
          <Field label="Confirmar contraseña">
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la nueva contraseña"
              className={inputClass}
              onKeyDown={(e) => {
                if (e.key === "Enter") updateRecoveredPassword();
              }}
            />
          </Field>
        </div>

        {recoveryError && (
          <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            {recoveryError}
          </div>
        )}

        {recoveryMessage && (
          <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            {recoveryMessage}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            onClick={updateRecoveredPassword}
            disabled={recoveryLoading}
            className="w-full rounded-xl bg-[#243e87] text-white hover:bg-[#2d4a9a]"
          >
            {recoveryLoading ? "Guardando..." : "Actualizar"}
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setPasswordRecovery(false);
              setNewPassword("");
              setConfirmPassword("");
              setRecoveryError("");
              setRecoveryMessage("");
            }}
            className="w-full rounded-xl border-[#dce2ea] bg-white text-[#243e87] hover:bg-[#f4f9ff]"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}



  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] text-[#182b56]">Cargando sesión...</div>;
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#f4f6f9] px-0 py-0 text-[#182b56]">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex w-full max-w-none flex-col gap-4">
        <header className="flex w-full flex-col gap-4 bg-[#243e87] px-5 py-3 shadow-lg shadow-[#243e87]/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <img src="/seidor-logo.png" alt="SEIDOR" className="h-8 w-auto object-contain" />
            <div className="hidden h-8 w-px bg-white/25 sm:block" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-wide text-white sm:text-xl">SAP Connectivity Manager</h1>
              <p className="mt-0.5 text-xs text-white/70 sm:text-sm">Gestión segura y centralizada de conexiones técnicas</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap justify-center gap-2 sm:w-auto sm:justify-end">
            {selectedClientIsEditable && <Button onClick={openCreateDialog} className="h-9 rounded-xl bg-[#67aef7] px-3 text-sm text-[#182b56] shadow-lg shadow-[#1d326f]/20 hover:bg-[#8cc4fb]"><Plus className="mr-2 h-4 w-4" /> Nueva configuración</Button>}
            <Button variant="outline" size="icon" title="Salir" aria-label="Salir" onClick={() => supabase.auth.signOut()} className={iconButtonClass}><LogOut className="h-4 w-4" /></Button>
          </div>
        </header>

        {appError && <div className="mx-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200 sm:mx-4 md:mx-5">{appError}</div>}
        <AnimatePresence>
          {appInfo && (
            <motion.div
              key={appInfoKey}
              initial={{ opacity: 0, x: 48, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 48, y: 10, scale: 0.96 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-md overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl shadow-emerald-950/20"
            >
              <div className="flex items-start gap-3 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 p-4 pr-5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                  <Check className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-emerald-800">Acción realizada correctamente</div>
                  <div className="mt-0.5 text-sm leading-relaxed text-[#344767]">{appInfo}</div>
                </div>
              </div>
              <motion.div initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: 4.5, ease: "linear" }} className="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600" />
            </motion.div>
          )}
        </AnimatePresence>
        <main className="grid w-full grid-cols-1 gap-4 px-3 py-4 sm:px-4 md:px-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Card className={`${cardClass} min-w-0`}>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg text-[#243e87]"><Building2 className="h-5 w-5" /> Clientes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex min-w-0 gap-2">
                <Input value={clientName} onChange={(e) => { setClientName(e.target.value); setClientInfo(""); }} placeholder="Buscar o crear cliente" onKeyDown={(e) => e.key === "Enter" && addClient()} className={inputClass} />
                <Button onClick={addClient} className="shrink-0 rounded-xl bg-[#243e87] text-white hover:bg-[#2d4a9a]"><Plus className="h-4 w-4" /></Button>
              </div>
              {clientInfo && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">{clientInfo}</div>}

              {dataLoading ? (
                <div className="rounded-2xl border border-[#edf1f6] bg-[#f8fafd] p-4 text-sm text-[#62718a]">Cargando clientes...</div>
              ) : (
                <div className="space-y-2">
                  {filteredClients.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#67aef7]/40 bg-[#f8fafd] p-4 text-sm text-[#62718a]">No hay clientes que coincidan con la búsqueda.</div>
                  ) : filteredClients.map((client) => (
                    <div key={client.id} className={clientCardClass(client)}>
                      <button className="min-w-0 flex-1 text-left" onClick={() => setSelectedClientId(client.id)}>
                        <div className="truncate font-semibold text-[#182b56]">{client.name}</div>
                        <div className="mt-1 min-w-0 space-y-0.5">
                          <div className="text-xs text-[#62718a]">{client.configs.length} configuraciones</div>
                          {client.isShared && !isClientOwner(client) && (
                            <div className="min-w-0 truncate text-right text-xs italic text-[#8b98aa]">
                              Compartido por {client.sharedByEmail || "otro usuario"}
                            </div>
                          )}
                          {client.isShared && isClientOwner(client) && (
                            <div className="text-right text-xs font-medium text-emerald-700">Compartido</div>
                          )}
                        </div>
                      </button>
                      {isClientOwner(client) && (
                        <Button variant="ghost" size="icon" title={client.isShared ? "Dejar de compartir" : "Compartir cliente"} aria-label={client.isShared ? "Dejar de compartir cliente" : "Compartir cliente"} onClick={() => toggleClientSharing(client)} className={`shrink-0 rounded-xl ${client.isShared ? "text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800" : "text-[#62718a] hover:bg-[#eaf4ff] hover:text-[#243e87]"}`}>
                          <Share2 className="h-4 w-4" />
                        </Button>
                      )}
                      {isClientOwner(client) && (
                        <Button variant="ghost" size="icon" onClick={() => deleteClient(client.id)} className="shrink-0 rounded-xl text-[#62718a] hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></Button>
                      )}
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
                  <CardTitle className="min-w-0 break-words text-lg text-[#243e87] sm:text-xl">Configuraciones de {selectedClient?.name || "—"}</CardTitle>
                </div>
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end xl:max-w-xl">
                  {selectedClientHasPasswords && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPasswords((previousValue) => !previousValue)}
                      className="rounded-xl border-[#67aef7]/60 bg-white text-[#243e87] hover:bg-[#eaf4ff] hover:text-[#243e87]"
                    >
                      {showPasswords ? (
                        <>
                          <EyeOff className="mr-2 h-4 w-4" /> Ocultar passwords
                        </>
                      ) : (
                        <>
                          <Eye className="mr-2 h-4 w-4" /> Mostrar passwords
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadClientPdf}
                    disabled={!selectedClient}
                    className="rounded-xl border-[#67aef7]/60 bg-white text-[#243e87] hover:bg-[#eaf4ff] hover:text-[#243e87] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileDown className="mr-2 h-4 w-4" /> Descargar PDF
                  </Button>
                  <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#67aef7]" />
                    <Input className={`${inputClass} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar configuración..." />
                  </div>
                </div>
              </div>
              <Tabs value={activeType} onValueChange={setActiveType} className="w-full">
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-[#f8fafd] p-1">
                  {["Todos", ...CONNECTION_TYPES].map((type) => (
                    <TabsTrigger key={type} value={type} className="min-w-fit rounded-xl px-3 text-[#344767] transition hover:bg-[#dbeafe] hover:text-[#243e87] hover:shadow-sm data-[state=active]:bg-[#243e87] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:hover:bg-[#2d4a9a] data-[state=active]:hover:text-white">
                      {type !== "Todos" && <span className="mr-2">{typeIcon(type)}</span>}{type}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {!selectedClient ? (
                <div className="rounded-2xl border border-dashed border-[#67aef7]/40 bg-[#f8fafd] p-8 text-center text-[#62718a] sm:p-10">Crea un cliente para empezar.</div>
              ) : filteredConfigs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#67aef7]/40 bg-[#f8fafd] p-8 text-center text-[#62718a] sm:p-10">No hay configuraciones para mostrar. Crea una nueva configuración para este cliente.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredConfigs.map((config) => (
                    <motion.div key={config.id} layout className="min-w-0 rounded-2xl border border-[#edf1f6] bg-white p-4 shadow-sm transition hover:border-[#67aef7]/60 hover:bg-[#f8fafd] hover:shadow-lg hover:shadow-[#243e87]/10">
                      <div className="mb-4 flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <Badge className={`gap-1 rounded-xl border ${typeBadgeClass(config.type)}`} variant="outline">{typeIcon(config.type)} {config.type}</Badge>
                          {config.type === "SAP" && <span className="break-words text-lg font-semibold text-[#182b56]">{config.description}</span>}
                          {config.type === "VPN" && <span className="break-words text-lg font-semibold text-[#182b56]">{config.vpnName || "VPN sin nombre"}</span>}
                          {config.type === "OSS" && <span className="text-lg font-semibold text-[#182b56]">OSS</span>}
                          {config.type === "Fiori" && <span className="text-lg font-semibold text-[#182b56]">Fiori {config.environment}</span>}
                          {config.type === "Enlaces" && <span className="text-lg font-semibold text-[#182b56]">Enlaces</span>}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {selectedClientIsSharedByOtherUser && (
                            <Button variant="outline" size="sm" onClick={() => notifyConfigChange(config)} className="rounded-xl border-red-400/60 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800">
                              <Mail className="mr-2 h-4 w-4" /> Notificar cambio
                            </Button>
                          )}
                          {selectedClientIsEditable && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => openEditDialog(config)} className="rounded-xl border-[#67aef7]/60 bg-white text-[#243e87] hover:bg-[#2d4a9a]/10 hover:text-[#243e87]"><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
                              <Button variant="outline" size="sm" onClick={() => deleteConfig(config.id)} className="rounded-xl border-red-400/40 bg-white text-red-300 hover:bg-red-500/10 hover:text-red-200"><Trash2 className="mr-2 h-4 w-4" /> Borrar</Button>
                            </>
                          )}
                        </div>
                      </div>
                      <ConfigDetails config={config} showPasswords={showPasswords} />
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        <footer className="pb-4 text-center text-xs text-[#8b98aa]">Desarrollado por Alfredo Pradas. Todos los derechos reservados.</footer>
      </motion.div>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && closeConfirmDialog()}>
        <DialogContent className="max-w-md rounded-3xl border-[#edf1f6] bg-white p-0 text-[#182b56] shadow-2xl shadow-slate-950/20">
          <div className="overflow-hidden rounded-3xl">
            <div className="bg-[#243e87] px-6 py-4 text-white">
              <DialogTitle className="text-lg font-semibold">{confirmDialog.title || "Confirmar acción"}</DialogTitle>
              <p className="mt-1 text-sm text-white/75">Revisa la acción antes de continuar.</p>
            </div>
            <div className="space-y-5 p-6">
              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
                  <Trash2 className="h-5 w-5" />
                </div>
                <p className="text-sm leading-relaxed text-[#344767]">{confirmDialog.message}</p>
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={closeConfirmDialog} className="rounded-xl border-[#dce2ea] bg-white text-[#243e87] hover:bg-[#f4f9ff]">Cancelar</Button>
                <Button onClick={handleConfirmDialog} className="rounded-xl bg-red-600 text-white hover:bg-red-700">{confirmDialog.confirmLabel || "Confirmar"}</Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl border-[#edf1f6] bg-white text-[#182b56] shadow-2xl shadow-slate-950">
          <DialogHeader><DialogTitle className="text-[#243e87]">{editingConfig ? "Modificar configuración" : "Crear configuración"}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <Field label="Tipo de conexión">
              <Select value={selectedType} onValueChange={onTypeChange} disabled={Boolean(editingConfig)}>
                <SelectTrigger className="h-10 rounded-xl border-[#dce2ea] bg-white text-[#182b56] focus:ring-[#67aef7]"><SelectValue /></SelectTrigger>
                <SelectContent className="border-[#dce2ea] bg-white text-[#182b56]">{CONNECTION_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <ConfigForm type={selectedType} form={form} setForm={setForm} />
            {errors.length > 0 && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200"><ul className="list-inside list-disc">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl border-[#dce2ea] bg-white text-[#243e87] hover:bg-[#f4f9ff]">Cancelar</Button>
            <Button onClick={saveConfig} className="rounded-xl bg-[#243e87] text-white hover:bg-[#2d4a9a]">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
