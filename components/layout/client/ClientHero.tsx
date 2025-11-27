import Image from "next/image";

interface ClientHeroProps {
  imageSrc?: string;
  imageAlt?: string;
  height?: number;
}

export function ClientHero({
  imageSrc = "/MIN09166.JPG",
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
