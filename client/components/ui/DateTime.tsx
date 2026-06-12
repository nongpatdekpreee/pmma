"use client";

type DateRangeLabelProps = {
  days?: number; // ย้อนหลังกี่วัน (default = 15)
};

export default function DateTime({ days = 15 }: DateRangeLabelProps) {
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - days);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-xl shadow-sm text-sm text-muted-foreground font-medium cursor-pointer">
      <span>
        {formatDate(startDate)} - {formatDate(today)}
      </span>
    </div>
  );
}
