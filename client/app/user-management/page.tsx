'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { InlineCatLoader } from '@/components/ui/CatLoader';

/** User Management ถูกยุบเข้าหน้า Employee แล้ว */
export default function UserManagementRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/employee');
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <InlineCatLoader label="Redirecting to Employee…" />
    </div>
  );
}
