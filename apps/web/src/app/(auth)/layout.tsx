import Image from "next/image";
import { getTenantSlug } from "@/lib/tenant";
import { ImageCarousel } from "@/components/auth/image-carousel";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenantSlug = await getTenantSlug();

  return (
    <div className="grid lg:grid-cols-2" style={{ minHeight: "100dvh" }}>
      {/* Left - Form */}
      <div className="relative flex items-center justify-center border-r border-border p-8">
        {/* Logo top-left */}
        <div className="absolute left-8 top-8 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[0.3rem] bg-primary">
            <Image
              src="/images/bus-logo.png"
              alt="Scomap"
              width={20}
              height={20}
            />
          </div>
          <span className="text-lg font-semibold text-foreground">Scomap</span>
          {tenantSlug && (
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              — {tenantSlug}
            </span>
          )}
        </div>

        {/* Card */}
        <div className="w-full max-w-[440px]">
          <div className="rounded-[0.3rem] border border-border bg-card p-8 shadow-sm">
            {children}
          </div>
        </div>
      </div>

      {/* Right - Images + Quote */}
      <div className="relative hidden lg:flex lg:flex-col lg:items-center lg:justify-end">
        <ImageCarousel />
        <blockquote className="relative z-10 mb-12 max-w-md px-8 text-center">
          <p className="text-lg italic text-white/90">
            &laquo; Chaque trajet compte. Derrière chaque circuit, il y a des enfants qui comptent sur nous pour arriver à l&apos;heure, en sécurité. &raquo;
          </p>
        </blockquote>
      </div>
    </div>
  );
}
