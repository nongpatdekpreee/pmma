import { ContractStatus } from "../interfaces/dashboard";

export default function StatusBadge({ status }: { status: ContractStatus }) {
  const map = {
    Done: "bg-green-100 text-green-700",
    "In Progress": "bg-yellow-100 text-yellow-700",
    "Not Started": "bg-red-100 text-red-700",
    Scheduled: "bg-indigo-100 text-indigo-700",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs ${map[status]}`}>
      {status}
    </span>
  );
}
