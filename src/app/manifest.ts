import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Presupuesto Felo",
    short_name: "Presupuesto",

    description:
      "Control mensual y quincenal de gastos, pagos y compromisos fijos.",

    start_url: "/",
    scope: "/",

    display: "standalone",
    orientation: "portrait",

    background_color: "#f8fafc",
    theme_color: "#0f172a",

    lang: "es-US",

    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}