import DashboardHeader from "../components/dashboard/Header";
import Sidebar from "../components/dashboard/Sidebar";
import SummaryCards from "@/components/dashboard/SummaryCards";
import ContractTable from "@/components/dashboard/ContractTable";

import { SUMMARY_CARDS, CONTRACT_ROWS } from "@/components/data/dashboard.mock";

export default function Page() {
  return (
    <div className="min-h-screen bg-white">
      <div className="flex">
        <Sidebar />

        <div className="flex min-h-screen flex-1 flex-col">
          <DashboardHeader />

          <main className="mx-auto w-full max-w-6xl px-8 py-6">
            <h1 className="mb-6 text-2xl font-semibold text-gray-900">
              Dashboard
            </h1>

            <SummaryCards cards={SUMMARY_CARDS} />

            <ContractTable rows={CONTRACT_ROWS} />
          </main>
        </div>
      </div>
    </div>
  );
}
