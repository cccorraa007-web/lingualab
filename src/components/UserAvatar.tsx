import Image from "next/image";

export default function UserAvatar({
  name,
  url,
  size = 32,
}: {
  name: string;
  url: string;
  size?: number;
}) {
  if (url) {
    return (
      <Image
        src={url}
        alt={name || "头像"}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-orange-600 text-sm font-semibold text-white"
    >
      {name ? name.charAt(0).toUpperCase() : "?"}
    </div>
  );
}
