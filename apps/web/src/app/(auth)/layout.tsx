import Link from "next/link";
import { getTenantSlug } from "@/lib/tenant";

const quotes = [
  {
    text: "Chaque trajet compte. Derrière chaque circuit, il y a des enfants qui comptent sur nous.",
    author: "Proverbe du transport scolaire",
  },
  {
    text: "La sécurité des enfants n'est pas une option, c'est une mission.",
    author: "Proverbe du transport scolaire",
  },
  {
    text: "Un bon circuit, c'est celui que les parents ne remarquent pas : ponctuel, sûr, invisible.",
    author: "Proverbe du transport scolaire",
  },
  {
    text: "Organiser le transport scolaire, c'est orchestrer la confiance de centaines de familles.",
    author: "Proverbe du transport scolaire",
  },
  {
    text: "La ponctualité est la politesse des bus scolaires.",
    author: "Proverbe du transport scolaire",
  },
];

function QuoteDisplay() {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const quoteIndex = dayOfYear % quotes.length;
  const quote = quotes[quoteIndex];

  return (
    <blockquote className="max-w-lg space-y-4">
      <p className="text-xl font-medium leading-relaxed">
        &laquo; {quote.text} &raquo;
      </p>
      <footer className="text-muted-foreground">
        — {quote.author}
      </footer>
    </blockquote>
  );
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenantSlug = await getTenantSlug();

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left column - Form */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
              S
            </div>
            Scomap
            {tenantSlug && (
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                — {tenantSlug}
              </span>
            )}
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            {children}
          </div>
        </div>
      </div>

      {/* Right column - Quote */}
      <div className="bg-muted relative hidden lg:flex flex-col items-center justify-center p-10">
        <QuoteDisplay />
      </div>
    </div>
  );
}
