import Image from "next/image";

interface ClientHeroProps {
  imageSrc?: string;
  imageAlt?: string;
  height?: number;
}

export function ClientHero({
  imageSrc = "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1920&q=80",
  imageAlt = "EduSync Banner",
  height = 400,
}: ClientHeroProps) {
  return (
    <section
      className="relative w-full overflow-hidden border-b"
      style={{ height: `${height}px` }}
    >
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        className="object-cover"
        priority
      />
    </section>
  );
}
