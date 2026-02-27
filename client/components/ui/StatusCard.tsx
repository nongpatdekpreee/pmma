// components/ui/StatusCard.tsx
interface StatusCardProps {
  title: string;
  value: string;
  color: string;
}

export function StatusCard({ title, value, color }: StatusCardProps) {
  return (
    <div className={`${color} p-4 rounded-[2rem] shadow-lg`}>
      <p className="text-sm font-medium text-white-500 mb-2">{title}</p>
      <h2 className="text-4xl font-black  tracking-tight">{value}</h2>
    </div>
  );
}