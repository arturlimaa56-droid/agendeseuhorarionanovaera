import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nova Era Barbearia — Agende seu horário" },
      { name: "description", content: "Agende seu corte ou barba com Biel e Nicolas na Nova Era Barbearia." },
      { property: "og:title", content: "Nova Era Barbearia — Agende seu horário" },
      { property: "og:description", content: "Agende seu corte ou barba com Biel e Nicolas na Nova Era Barbearia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/nova-era.html"
      title="Nova Era Barbearia"
      className="fixed inset-0 h-full w-full border-0 bg-background"
    />
  );
}
