import type { EnrichedDestination } from '../../mocks/destinations';
import ReasonBlock from './ReasonBlock';

interface DestinationCardProps {
  rank: number;
  destination: EnrichedDestination;
  reason: string;
}

export default function DestinationCard({
  rank,
  destination,
  reason,
}: DestinationCardProps) {
  return (
    <article className="bg-white rounded-2xl shadow-card overflow-hidden border border-cream-dark">
      <div className="relative bg-mystic px-5 pt-5 pb-4">
        <div className="absolute top-3 left-3 inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-bold shadow-soft">
          {rank}
        </div>

        <div className="flex items-center justify-center text-6xl mb-2 select-none" aria-hidden="true">
          {destination.emoji}
        </div>

        <div className="text-center">
          <p className="text-xs font-medium text-primary/80">
            {destination.region}
          </p>
          <h3 className="mt-0.5 text-xl font-extrabold text-gray-900 tracking-tight">
            {destination.name}
          </h3>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3.5">
        <p className="text-sm text-gray-700 leading-relaxed">
          {destination.description}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {destination.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-cream-dark text-primary"
            >
              #{tag}
            </span>
          ))}
        </div>

        <div>
          <h4 className="text-xs font-bold text-gray-500 mb-1.5 tracking-wide">
            추천 활동
          </h4>
          <ul className="space-y-1">
            {destination.activities.slice(0, 3).map((activity) => (
              <li
                key={activity}
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <span className="mt-1 inline-block w-1 h-1 rounded-full bg-gold shrink-0" aria-hidden="true" />
                <span>{activity}</span>
              </li>
            ))}
          </ul>
        </div>

        <ReasonBlock>{reason}</ReasonBlock>
      </div>
    </article>
  );
}
