import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// IPs IPv4 desta máquina na rede local (Wi-Fi/cabo) — lidos a cada subida do servidor, porque o
// DHCP muda o endereço entre um dia e outro. Sem isso, o dev server bloqueia os recursos de
// desenvolvimento quando a tela é aberta de outro aparelho (ex.: celular) pelo IP da máquina.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net && net.family === "IPv4" && !net.internal)
  .map((net) => net!.address);

// Só existe no ambiente local (.env): quando definido, o próprio frontend repassa /api/v1 para a
// API, e o navegador nunca precisa alcançar a porta do backend diretamente — é o que permite abrir
// o sistema pelo celular sem expor a API nem liberar CORS pro IP da máquina. Em produção a variável
// não existe, então nenhuma rewrite é criada e o frontend continua chamando NEXT_PUBLIC_API_URL.
const apiProxyTarget = process.env.API_PROXY_TARGET;

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
  allowedDevOrigins: lanAddresses,
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [{ source: "/api/v1/:path*", destination: `${apiProxyTarget}/api/v1/:path*` }];
  },
};

export default nextConfig;
