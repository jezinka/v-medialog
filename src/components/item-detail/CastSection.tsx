import type { CachedPerson } from "./types";

export default function CastSection({ actors, onOpenPerson }: {
  actors: CachedPerson[];
  onOpenPerson?: (personId: number) => void;
}) {
  if (actors.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Obsada</h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {actors.map((a) => (
          <button
            key={a.personId}
            onClick={() => onOpenPerson?.(a.personId)}
            className="shrink-0 w-20 text-center group"
            title={a.name}
          >
            {a.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.photoUrl}
                alt={a.name}
                className="w-14 h-14 rounded-full object-cover mx-auto mb-1 border border-gray-200 group-hover:border-blue-400 transition-colors"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-200 group-hover:bg-blue-100 flex items-center justify-center text-lg text-gray-500 mx-auto mb-1 transition-colors">
                {a.name[0]}
              </div>
            )}
            <p className="text-[10px] font-medium text-gray-700 group-hover:text-blue-600 leading-tight line-clamp-2 transition-colors">
              {a.name}
            </p>
            {a.characterName && (
              <p className="text-[9px] text-gray-400 leading-tight line-clamp-2 mt-0.5">
                {a.characterName}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
