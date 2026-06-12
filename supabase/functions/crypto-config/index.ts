const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function arrayBufferToBase64(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

function isEncryptedValue(value: unknown) {
  return Boolean(
    value &&
      typeof value === "object" &&
      "__encrypted" in value &&
      (value as Record<string, unknown>).__encrypted === true
  );
}

async function getServerCryptoKey() {
  const secret = Deno.env.get("SERVER_CRYPTO_SECRET");

  if (!secret) {
    throw new Error("SERVER_CRYPTO_SECRET no está configurado.");
  }

  const hash = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(secret)
  );

  return crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptText(plainText: unknown) {
  if (!plainText) return "";

  if (isEncryptedValue(plainText)) {
    return plainText;
  }

  const key = await getServerCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    textEncoder.encode(String(plainText))
  );

  return {
    __encrypted: true,
    alg: "AES-GCM",
    mode: "server",
    iv: arrayBufferToBase64(iv.buffer),
    data: arrayBufferToBase64(encrypted),
  };
}

async function decryptText(value: unknown) {
  if (!value) return "";

  if (typeof value === "string") {
    return value;
  }

  if (!isEncryptedValue(value)) {
    return "";
  }

  const encryptedValue = value as {
    iv: string;
    data: string;
  };

  const key = await getServerCryptoKey();
  const iv = new Uint8Array(base64ToArrayBuffer(encryptedValue.iv));
  const encryptedData = base64ToArrayBuffer(encryptedValue.data);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encryptedData
  );

  return textDecoder.decode(decrypted);
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

async function encryptConfigs(configs: any[]) {
  return Promise.all((configs || []).map((config) => encryptConfig(config)));
}

async function decryptConfigs(configs: any[]) {
  return Promise.all((configs || []).map((config) => decryptConfig(config)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método no permitido." }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const body = await req.json();
    const { action, configs } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Falta action." }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (action === "encryptConfigs") {
      const encryptedConfigs = await encryptConfigs(configs || []);

      return new Response(
        JSON.stringify({ configs: encryptedConfigs }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (action === "decryptConfigs") {
      const decryptedConfigs = await decryptConfigs(configs || []);

      return new Response(
        JSON.stringify({ configs: decryptedConfigs }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Action no soportada." }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Error desconocido.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});