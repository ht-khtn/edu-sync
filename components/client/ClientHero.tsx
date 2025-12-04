import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface ClientHeroProps {
  imageSrc?: string;
  imageAlt?: string;
  height?: number;
  children?: ReactNode;
  className?: string;
  overlay?: boolean;
}

export function ClientHero({
  imageSrc = "https://fbxrlpiigoviphaxmstd.supabase.co/storage/v1/object/public/public-bucket/edusync-banner.jpg",
  imageAlt = "EduSync Banner",
  height = 600,
  children,
  className,
  overlay = true,
}: ClientHeroProps) {
  return (
    <section
      className={cn("relative w-full overflow-hidden border-b", className)}
      style={{ height: `${height}px` }}
    >
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        className="object-cover"
        priority
      />

      {overlay && (
        <div className="absolute inset-0 bg-linear-to-r from-black/60 to-black/30" />
      )}

      {children && (
        <div className="relative h-full flex items-center justify-center px-6">
          {children}
        </div>
      )}
    </section>
  );
}
