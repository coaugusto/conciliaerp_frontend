import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera um runtime mínimo para containers (Coolify/Docker), sem node_modules
  // completo e sem precisar iniciar o servidor de desenvolvimento.
  output: "standalone",
  // Mantém a observação do Turbopack estritamente no frontend, mesmo quando
  // existe um repositório Git ou lockfiles em diretórios ancestrais.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
