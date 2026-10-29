import vinext from "vinext";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  // Keep AWS runtimeConfig and its dependencies on the same web/Workers path.
  environments: {
    rsc: { resolve: { mainFields: ["browser", "module", "main"] } },
    ssr: { resolve: { mainFields: ["browser", "module", "main"] } },
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      inspectorPort: false,
    }),
  ],
});
