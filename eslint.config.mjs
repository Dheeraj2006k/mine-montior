import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "tools/insar-importer/.venv/**",
    "tools/insar-importer/.pytest_cache/**",
    "tools/insar-importer/**/__pycache__/**",
    // Vendored, unmodified maplibre-gl worker build output (copied
    // verbatim from node_modules/maplibre-gl/dist/ - see the comment in
    // src/components/map/mine-map.tsx) - not app source, never edited.
    "public/maplibre-worker/**",
  ]),
]);

export default eslintConfig;
