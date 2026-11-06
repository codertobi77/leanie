import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  preview: {
    realtime: true,
  },
  auth: true,
  dataApi: true,
  functions: {
    hello: { name: "Hello World", source: "./hello.ts" },
    council: { name: "Lean Council", source: "./neon/leanie-council.ts", env: { NVIDIA_NIM_API_KEY: process.env.NVIDIA_NIM_API_KEY!, NVIDIA_NIM_BASE_URL: process.env.NVIDIA_NIM_BASE_URL ?? "https://integrate.api.nvidia.com/v1", LEANIE_GLM_MODEL: process.env.LEANIE_GLM_MODEL ?? "z-ai/glm-5.3-flash", LEANIE_DEEPSEEK_MODEL: process.env.LEANIE_DEEPSEEK_MODEL ?? "deepseek-ai/deepseek-v4.1-flash", LEANIE_KIMI_MODEL: process.env.LEANIE_KIMI_MODEL ?? "moonshotai/kimi-k2.6", LEANIE_ARBITER_MODEL: process.env.LEANIE_ARBITER_MODEL ?? "z-ai/glm-5.3-flash", DATABASE_URL: process.env.DATABASE_URL!, LEANIE_PRICE_PROMPT_PER_1M: process.env.LEANIE_PRICE_PROMPT_PER_1M ?? "0.2", LEANIE_PRICE_COMPLETION_PER_1M: process.env.LEANIE_PRICE_COMPLETION_PER_1M ?? "0.6" } },
    storage: { name: "Lean Storage", source: "./neon/leanie-storage.ts" },
    share: { name: "Lean Share", source: "./neon/leanie-share.ts", env: { DATABASE_URL: process.env.DATABASE_URL! } },
    metrics: { name: "Lean Metrics", source: "./neon/leanie-metrics.ts", env: { DATABASE_URL: process.env.DATABASE_URL! } },
  },
  buckets: {
    // "private" is the default; use "public_read" for anonymous reads
    assets: { access: "private" },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
