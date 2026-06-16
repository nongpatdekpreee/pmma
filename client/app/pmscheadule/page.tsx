import DashboardHeader from "../../components/ui/Header";
import { SidebarLayout } from "@/components/sidebar/SidebarLayout";
import { CONTRACT_ROWS } from "../../data/dashboard.mock";
import { ContractTable } from "@/components/ui/ContractTable";
import Link from "next/link";
import DateTime from "@/components/ui/DateTime";
import { Users, UserCheck, Monitor } from "lucide-react";
import { LucideIcon } from "lucide-react";

export type SummaryCard = {
  label: string;
  value: string;
  growth?: string;
  icon?: LucideIcon;
};
export const SUMMARY_CARDS: SummaryCard[] = [
  { label: "Total PM", value: "1000", icon: Users },
  { label: "Total Ready", value: "500", icon: UserCheck, growth: "+16% this month" },
  { label: "Total Done", value: "189", icon: Monitor },
];

export default function Page() {
  return (
    <SidebarLayout>
      <DashboardHeader />

        <main className="mx-auto w-full max-w-6xl px-8 py-6">
          {/* ฝั่งซ้าย: Dashboard & Maintenance */}
          <div className="flex-[2] space-y-6">
            <div className="flex items-center justify-between">
              <Link href="/" className="page-heading">
                Dashboard
              </Link>
              <div>
                <DateTime />
              </div>
            </div>

            <section className="mb-8 grid gap-6 md:grid-cols-3">
              {SUMMARY_CARDS.map((card) => {
                const Icon = card.icon;

                return (
                  <article
                    key={card.label}
                    className="flex flex-col items-center justify-between rounded-2xl bg-card border border-border px-6 py-5 shadow-md text-center"
                  >
                    {/* ซ้าย: icon + text */}
                    <div className="flex items-center gap-4">
                      {/* ICON */}
                      {Icon && (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-500">
                          <Icon className="h-7 w-7 text-blue-900" />
                        </div>
                      )}

                      {/* TEXT */}
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {card.label}
                        </p>
                        <div className="text-3xl font-semibold text-foreground">
                          {card.value}
                        </div>
                      </div>
                    </div>

                    {/* growth */}
                    {card.growth && (
                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-600">
                        {card.growth}
                      </span>
                    )}
                  </article>
                );
              })}
            </section>

            <ContractTable rows={CONTRACT_ROWS} />
          </div>
        </main>
    </SidebarLayout>
  );
}
