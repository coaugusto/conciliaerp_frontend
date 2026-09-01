import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera um runtime mínimo para containers (Coolify/Docker), sem node_modules
  // completo e sem precisar iniciar o servidor de desenvolvimento.
  output: "standalone",
  // Mantém a observação do Turbopack estritamente no frontend, mesmo quando
  // existe um repositório Git ou lockfiles em diretórios ancestrais.
  // process.cwd() em vez de __dirname: __dirname não existe quando o Next
  // carrega este arquivo como módulo ES (ex.: fallback sem o binário nativo
  // do SWC), e process.cwd() é equivalente aqui — next sempre roda a partir
  // desta pasta.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
