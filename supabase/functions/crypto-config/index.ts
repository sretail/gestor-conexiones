const encoder = new TextEncoder();
const decoder = new TextDecoder();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

function isEncryptedValue(value: unknown) {
  return Boolean(
    value &&
      typeof value === "object" &&
      "__encrypted" in value &&
      (value as any).__encrypted
  );
}

function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = "";

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

async function getCryptoKey() {
  const secret = Deno.env.get("SERVER_CRYPTO_SECRET");

  if (!secret) {
    throw new Error("SERVER_CRYPTO_SECRET no está configurado en Supabase Secrets.");
  }

  const secretBytes = encoder.encode(secret.padEnd(32, "0").slice(0, 32));

  return crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptText(value: unknown) {
  if (!value) return "";
  if (isEncryptedValue(value)) return value;

  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainText = encoder.encode(String(value));

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    plainText
  );

  return {
    __encrypted: true,
    alg: "AES-GCM",
    mode: "server",
    iv: uint8ArrayToBase64(iv),
    data: uint8ArrayToBase64(new Uint8Array(encryptedBuffer)),
  };
}

async function decryptText(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (!isEncryptedValue(value)) return "";

  const encryptedValue = value as {
    iv: string;
    data: string;
  };

  const key = await getCryptoKey();
  const iv = base64ToUint8Array(encryptedValue.iv);
  const encryptedData = base64ToUint8Array(encryptedValue.data);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encryptedData
  );

  return decoder.decode(decryptedBuffer);
}

async function encryptConfig(config: any) {
  if (!config) return config;

  if (config.type === "VPN" || config.type === "OSS") {
    return {
      ...config,
      password: await encryptText(config.password),
    };
  }

  if (config.type === "SAP") {
    return {
      ...config,
      sapCredentials: Array.isArray(config.sapCredentials)
        ? await Promise.all(
            config.sapCredentials.map(async (credential: any) => ({
              ...credential,
              password: await encryptText(credential.password),
            }))
          )
        : [],
    };
  }

  return config;
}

async function decryptConfig(config: any) {
  if (!config) return config;

  if (config.type === "VPN" || config.type === "OSS") {
    return {
      ...config,
      password: await decryptText(config.password),
    };
  }

  if (config.type === "SAP") {
    return {
      ...config,
      sapCredentials: Array.isArray(config.sapCredentials)
        ? await Promise.all(
            config.sapCredentials.map(async (credential: any) => ({
              ...credential,
              password: await decryptText(credential.password),
            }))
          )
        : [],
    };
  }

  return config;
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return jsonResponse({ ok: true });
    }

    if (req.method !== "POST") {
      return jsonResponse(
        {
          error: "Método no permitido. Usa POST.",
        },
        405
      );
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return jsonResponse(
        {
          error: "Body JSON inválido o vacío.",
        },
        400
      );
    }

    const { action, configs } = body;

    if (!action) {
      return jsonResponse(
        {
          error: "Falta el parámetro action.",
        },
        400
      );
    }

    if (!Array.isArray(configs)) {
      return jsonResponse(
        {
          error: "El parámetro configs debe ser un array.",
        },
        400
      );
    }

    console.log("crypto-config action:", action);
    console.log("configs recibidas:", configs.length);

    if (action === "encryptConfigs") {
      const encryptedConfigs = await Promise.all(
        configs.map((config: any) => encryptConfig(config))
      );

      return jsonResponse({
        configs: encryptedConfigs,
      });
    }

    if (action === "decryptConfigs") {
      const decryptedConfigs = await Promise.all(
        configs.map((config: any) => decryptConfig(config))
      );

      return jsonResponse({
        configs: decryptedConfigs,
      });
    }

    return jsonResponse(
      {
        error: `Action no soportada: ${action}`,
      },
      400
    );
  } catch (error) {
    console.error("Error en crypto-config:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido en crypto-config.",
      },
      500
    );
  }
});