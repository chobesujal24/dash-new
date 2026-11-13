export type KnownProviderKey =
  | "openai"
  | "gemini"
  | "deepseek"
  | "nvidia"
  | "claude"
  | "anthropic"
  | "groq"
  | "ollama"
  | "openrouter"
  | "mistral"
  | "perplexity"
  | "together"
  | "fireworks"
  | "cohere"
  | "xai"
  | "huggingface"
  | "cerebras"
  | "siliconcloud"
  | "moonshot"
  | "qwen"
  | "zhipu"
  | "minimax"
  | "internlm"
  | "lmstudio"
  | "vllm";

export type ProviderIdentity = {
  /** Known embedded SVG key, or null when using dynamic remote logo resolution. */
  key: KnownProviderKey | null;
  /** Human-readable provider brand name inferred from the URL, name, or model. */
  brandName: string | null;
  /** Suggested uppercase environment variable for the API key. */
  suggestedKeyName: string | null;
  /** Suggested default model identifier for quick fill. */
  suggestedModel: string | null;
  /** Root domain extracted from baseURL (e.g. "openai.com", "replicate.com"). */
  rootDomain: string | null;
  /** Brand slug extracted from the domain (e.g. "replicate", "sambanova"). */
  brandSlug: string | null;
  /** Ordered list of live internet logo URLs to try when not matched or as fallback. */
  remoteLogoUrls: string[];
  /** Whether the identity was matched from a known AI provider signature. */
  isKnown: boolean;
};

type ProviderRule = {
  key: KnownProviderKey;
  brandName: string;
  suggestedKeyName: string;
  suggestedModel: string;
  hostPattern?: RegExp;
  textPattern?: RegExp;
};

const RULES: ProviderRule[] = [
  {
    key: "gemini",
    brandName: "Google Gemini",
    suggestedKeyName: "GEMINI_API_KEY",
    suggestedModel: "gemini-2.5-flash",
    hostPattern: /generativelanguage\.googleapis\.com|aiplatform\.googleapis\.com|vertexai|gemini\.google/i,
    textPattern: /\b(gemini|gemma|google ai|vertex)\b/i,
  },
  {
    key: "openai",
    brandName: "OpenAI",
    suggestedKeyName: "OPENAI_API_KEY",
    suggestedModel: "gpt-4o",
    hostPattern: /(^|\.)openai\.com|openai\.azure\.com/i,
    textPattern: /\b(openai|gpt-4|gpt-3\.5|gpt-4o|o1-|o3-)\b/i,
  },
  {
    key: "deepseek",
    brandName: "DeepSeek",
    suggestedKeyName: "DEEPSEEK_API_KEY",
    suggestedModel: "deepseek-chat",
    hostPattern: /(^|\.)deepseek\.com/i,
    textPattern: /deepseek/i,
  },
  {
    key: "nvidia",
    brandName: "NVIDIA NIM",
    suggestedKeyName: "NVIDIA_API_KEY",
    suggestedModel: "nvidia/llama-3.1-nemotron-70b-instruct",
    hostPattern: /(^|\.)nvidia\.com|nvcf\.nvidia/i,
    textPattern: /\b(nvidia|nemotron|nim)\b/i,
  },
  {
    key: "claude",
    brandName: "Anthropic Claude",
    suggestedKeyName: "ANTHROPIC_API_KEY",
    suggestedModel: "claude-3-7-sonnet-latest",
    hostPattern: /(^|\.)anthropic\.com|claude\.ai/i,
    textPattern: /\b(anthropic|claude)\b/i,
  },
  {
    key: "groq",
    brandName: "Groq",
    suggestedKeyName: "GROQ_API_KEY",
    suggestedModel: "llama-3.3-70b-versatile",
    hostPattern: /(^|\.)groq\.com/i,
    textPattern: /\bgroq\b/i,
  },
  {
    key: "openrouter",
    brandName: "OpenRouter",
    suggestedKeyName: "OPENROUTER_API_KEY",
    suggestedModel: "anthropic/claude-3.7-sonnet",
    hostPattern: /(^|\.)openrouter\.ai/i,
    textPattern: /openrouter/i,
  },
  {
    key: "xai",
    brandName: "xAI Grok",
    suggestedKeyName: "XAI_API_KEY",
    suggestedModel: "grok-3",
    hostPattern: /(^|\.)x\.ai/i,
    textPattern: /\b(xai|x\.ai|grok)\b/i,
  },
  {
    key: "mistral",
    brandName: "Mistral AI",
    suggestedKeyName: "MISTRAL_API_KEY",
    suggestedModel: "mistral-large-latest",
    hostPattern: /(^|\.)mistral\.ai/i,
    textPattern: /\b(mistral|codestral|pixtral|ministral)\b/i,
  },
  {
    key: "perplexity",
    brandName: "Perplexity",
    suggestedKeyName: "PERPLEXITY_API_KEY",
    suggestedModel: "sonar-pro",
    hostPattern: /(^|\.)perplexity\.ai/i,
    textPattern: /\b(perplexity|sonar)\b/i,
  },
  {
    key: "together",
    brandName: "Together AI",
    suggestedKeyName: "TOGETHER_API_KEY",
    suggestedModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    hostPattern: /(^|\.)together\.(xyz|ai)/i,
    textPattern: /\btogether\b/i,
  },
  {
    key: "fireworks",
    brandName: "Fireworks AI",
    suggestedKeyName: "FIREWORKS_API_KEY",
    suggestedModel: "accounts/fireworks/models/deepseek-v3",
    hostPattern: /(^|\.)fireworks\.ai/i,
    textPattern: /\bfireworks\b/i,
  },
  {
    key: "cohere",
    brandName: "Cohere",
    suggestedKeyName: "COHERE_API_KEY",
    suggestedModel: "command-r-plus",
    hostPattern: /(^|\.)cohere\.(ai|com)/i,
    textPattern: /\b(cohere|command-r)\b/i,
  },
  {
    key: "cerebras",
    brandName: "Cerebras",
    suggestedKeyName: "CEREBRAS_API_KEY",
    suggestedModel: "llama-3.3-70b",
    hostPattern: /(^|\.)cerebras\.ai/i,
    textPattern: /\bcerebras\b/i,
  },
  {
    key: "huggingface",
    brandName: "Hugging Face",
    suggestedKeyName: "HF_TOKEN",
    suggestedModel: "Qwen/Qwen2.5-72B-Instruct",
    hostPattern: /(^|\.)huggingface\.co|\.hf\.space/i,
    textPattern: /\b(huggingface|hugging face)\b/i,
  },
  {
    key: "siliconcloud",
    brandName: "SiliconFlow",
    suggestedKeyName: "SILICONFLOW_API_KEY",
    suggestedModel: "deepseek-ai/DeepSeek-V3",
    hostPattern: /(^|\.)siliconflow\.(cn|com)|siliconcloud/i,
    textPattern: /\b(siliconflow|siliconcloud)\b/i,
  },
  {
    key: "moonshot",
    brandName: "Moonshot Kimi",
    suggestedKeyName: "MOONSHOT_API_KEY",
    suggestedModel: "moonshot-v1-auto",
    hostPattern: /(^|\.)moonshot\.(cn|ai)|kimi\.ai/i,
    textPattern: /\b(moonshot|kimi)\b/i,
  },
  {
    key: "qwen",
    brandName: "Alibaba Qwen",
    suggestedKeyName: "DASHSCOPE_API_KEY",
    suggestedModel: "qwen-max",
    hostPattern: /dashscope.*aliyuncs\.com|(^|\.)qwen\.ai/i,
    textPattern: /\b(qwen|dashscope|tongyi)\b/i,
  },
  {
    key: "zhipu",
    brandName: "Zhipu GLM",
    suggestedKeyName: "ZHIPU_API_KEY",
    suggestedModel: "glm-4-plus",
    hostPattern: /bigmodel\.cn|chatglm\.cn|zhipuai/i,
    textPattern: /\b(zhipu|chatglm|glm-4)\b/i,
  },
  {
    key: "minimax",
    brandName: "MiniMax",
    suggestedKeyName: "MINIMAX_API_KEY",
    suggestedModel: "MiniMax-Text-01",
    hostPattern: /minimax\.chat|minimaxi\.com/i,
    textPattern: /\bminimax\b/i,
  },
  {
    key: "internlm",
    brandName: "Intern AI",
    suggestedKeyName: "INTERN_API_KEY",
    suggestedModel: "internvl3.5-latest",
    hostPattern: /intern-ai\.org\.cn|internlm/i,
    textPattern: /\b(intern-ai|internlm|internvl|intern ai)\b/i,
  },
  {
    key: "ollama",
    brandName: "Ollama",
    suggestedKeyName: "OLLAMA_API_KEY",
    suggestedModel: "llama3.3",
    hostPattern: /:11434\b|(^|\.)ollama\.(com|ai)/i,
    textPattern: /\bollama\b/i,
  },
  {
    key: "lmstudio",
    brandName: "LM Studio",
    suggestedKeyName: "LMSTUDIO_API_KEY",
    suggestedModel: "local-model",
    hostPattern: /:1234\b|lmstudio\.ai/i,
    textPattern: /\b(lmstudio|lm studio)\b/i,
  },
  {
    key: "vllm",
    brandName: "Local vLLM",
    suggestedKeyName: "LOCAL_CRITIC_KEY",
    suggestedModel: "eni-critic-7b-q8",
    hostPattern: /^(127\.0\.0\.1|localhost|0\.0\.0\.0|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/i,
    textPattern: /\b(vllm|local critic|eni-critic)\b/i,
  },
];

const API_SUBDOMAIN_PREFIXES = new Set([
  "api",
  "chat",
  "integrate",
  "inference",
  "router",
  "open",
  "platform",
  "gateway",
  "llm",
  "models",
  "ai",
  "cloud",
  "console",
  "v1",
  "www",
]);

const MULTI_PART_TLDS = new Set([
  "co.uk",
  "org.uk",
  "org.cn",
  "com.cn",
  "net.cn",
  "co.jp",
  "com.au",
  "com.br",
  "com.sg",
]);

const isIpOrLocal = (hostname: string) =>
  hostname === "localhost" ||
  /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
  hostname.endsWith(".local") ||
  hostname.includes(":");

export function parseEndpointHost(rawUrl?: string): {
  hostWithPort: string;
  hostname: string;
  rootDomain: string | null;
  brandSlug: string | null;
} {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) return { hostWithPort: "", hostname: "", rootDomain: null, brandSlug: null };

  let candidate = trimmed;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    const hostWithPort = parsed.port ? `${hostname}:${parsed.port}` : hostname;
    if (!hostname || isIpOrLocal(hostname) || !hostname.includes(".")) {
      return { hostWithPort, hostname, rootDomain: null, brandSlug: null };
    }

    const parts = hostname.split(".").filter(Boolean);
    const filtered = [...parts];
    while (filtered.length > 2 && API_SUBDOMAIN_PREFIXES.has(filtered[0])) {
      filtered.shift();
    }

    const lastTwo = parts.slice(-2).join(".");
    const rootParts = MULTI_PART_TLDS.has(lastTwo) && parts.length >= 3 ? parts.slice(-3) : filtered.slice(-2);
    const rootDomain = rootParts.join(".");
    const rawSlug = rootParts[0] ?? filtered[0] ?? "";
    const brandSlug = rawSlug.replace(/[^a-z0-9]/g, "") || null;

    return { hostWithPort, hostname, rootDomain, brandSlug };
  } catch {
    return { hostWithPort: "", hostname: "", rootDomain: null, brandSlug: null };
  }
}

function humanizeSlug(slug: string): string {
  if (!slug) return "";
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function buildRemoteLogoUrls(rootDomain: string | null, brandSlug: string | null): string[] {
  const urls: string[] = [];
  if (brandSlug && brandSlug.length >= 2) {
    urls.push(`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/${brandSlug}-color.svg`);
    urls.push(`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/${brandSlug}.svg`);
    urls.push(`https://cdn.simpleicons.org/${brandSlug}`);
  }
  if (rootDomain) {
    urls.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(rootDomain)}&sz=64`);
    urls.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(rootDomain)}.ico`);
  }
  return urls;
}

/**
 * Resolves the AI provider identity, embedded SVG logo key, suggested defaults,
 * and live internet fallback logo URLs from a baseURL, display name, and model.
 */
export function resolveProviderIdentity(input: {
  baseURL?: string;
  name?: string;
  model?: string;
}): ProviderIdentity {
  const rawUrl = (input.baseURL ?? "").trim();
  const rawName = (input.name ?? "").trim();
  const rawModel = (input.model ?? "").trim();
  const { hostWithPort, rootDomain, brandSlug } = parseEndpointHost(rawUrl);

  // 1. Direct URL / host match (excluding generic local IP rule until specific local ports are checked)
  if (hostWithPort || rawUrl) {
    for (const rule of RULES) {
      if (rule.key === "vllm") continue;
      if (rule.hostPattern && (rule.hostPattern.test(hostWithPort) || rule.hostPattern.test(rawUrl))) {
        return {
          key: rule.key,
          brandName: rule.brandName,
          suggestedKeyName: rule.suggestedKeyName,
          suggestedModel: rule.suggestedModel,
          rootDomain,
          brandSlug,
          remoteLogoUrls: buildRemoteLogoUrls(rootDomain, rule.key),
          isKnown: true,
        };
      }
    }
  }

  // 2. Name or model match (handles relay/proxy URLs like api.river.ai serving DeepSeek)
  const combinedText = `${rawName} ${rawModel}`.trim();
  if (combinedText) {
    for (const rule of RULES) {
      if (rule.textPattern && rule.textPattern.test(combinedText)) {
        return {
          key: rule.key,
          brandName: rule.brandName,
          suggestedKeyName: rule.suggestedKeyName,
          suggestedModel: rule.suggestedModel,
          rootDomain,
          brandSlug,
          remoteLogoUrls: buildRemoteLogoUrls(rootDomain, rule.key),
          isKnown: true,
        };
      }
    }
  }

  // 3. Localhost / LAN IP fallback (vLLM / local inference server)
  const vllmRule = RULES.find((r) => r.key === "vllm")!;
  if (hostWithPort && vllmRule.hostPattern?.test(hostWithPort)) {
    return {
      key: "vllm",
      brandName: vllmRule.brandName,
      suggestedKeyName: vllmRule.suggestedKeyName,
      suggestedModel: vllmRule.suggestedModel,
      rootDomain: null,
      brandSlug: "vllm",
      remoteLogoUrls: [],
      isKnown: true,
    };
  }

  // 4. Dynamic internet domain inference for any custom provider URL
  if (rootDomain && brandSlug) {
    const inferredBrand = humanizeSlug(brandSlug);
    const inferredKey = `${brandSlug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_API_KEY`;
    return {
      key: null,
      brandName: inferredBrand,
      suggestedKeyName: /^[A-Z][A-Z0-9_]{1,63}$/.test(inferredKey) ? inferredKey : null,
      suggestedModel: null,
      rootDomain,
      brandSlug,
      remoteLogoUrls: buildRemoteLogoUrls(rootDomain, brandSlug),
      isKnown: false,
    };
  }

  return {
    key: null,
    brandName: null,
    suggestedKeyName: null,
    suggestedModel: null,
    rootDomain: null,
    brandSlug: null,
    remoteLogoUrls: [],
    isKnown: false,
  };
}
