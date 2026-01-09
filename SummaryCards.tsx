import { SummaryCard } from "../interfaces/dashboard";

type Props = {
  cards: SummaryCard[];
};

export default function SummaryCards({ cards }: Props) {
  return (
    <section className="mb-8 grid gap-6 md:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.label}
          className="flex items-center justify-between rounded-2xl bg-white px-6 py-5 shadow-md"
        >
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              {card.label}
            </p>
            <div className="text-3xl font-semibold text-gray-900">
              {card.value}
            </div>
          </div>

          {card.growth && (
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-600">
              {card.growth}
            </span>
          )}
        </article>
      ))}
    </section>
  );
}
