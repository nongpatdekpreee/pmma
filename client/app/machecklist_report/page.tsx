'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MAChecklistReportRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/pmchecklist_report?tab=ma');
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <p className="text-slate-500">กำลังเปลี่ยนไปหน้า Report...</p>
    </div>
  );
}
