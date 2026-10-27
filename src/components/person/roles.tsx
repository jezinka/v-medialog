export const ROLE_BADGE: Record<string, string> = {
  actor: "bg-blue-100 text-blue-700",
  director: "bg-purple-100 text-purple-700",
  creator: "bg-indigo-100 text-indigo-700",
  author: "bg-green-100 text-green-700",
};

export const ROLE_NAME: Record<string, string> = {
  actor: "Aktor",
  director: "Reżyser",
  creator: "Twórca",
  author: "Autor",
};

/** A person's initials in place of a missing photo; `className` sets the text size and weight. */
export function Initials({ name, className }: { name: string; className: string }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : parts[0]?.[0] ?? "?";
  return (
    <div className={`w-full h-full flex items-center justify-center bg-gray-200 text-gray-600 select-none ${className}`}>
      {initials.toUpperCase()}
    </div>
  );
}
