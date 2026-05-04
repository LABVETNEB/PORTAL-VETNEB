import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El frontend se ejecuta como aplicación separada del backend Fastify
  // Para producción, configurar NEXT_PUBLIC_API_URL apuntando al backend
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
