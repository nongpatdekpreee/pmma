export default function DashboardHeader() {
  return (
    <header
      className="app-shell-header flex w-full min-w-0 shrink-0 items-center justify-end overflow-x-clip pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 sm:pt-6 sm:pb-5 lg:pt-7 lg:pb-5"
    >
      {/* สำรองที่ว่างซ้ายบนมือถือ ไม่ให้เนื้อหาทับปุ่มเมนู (md+ มี sidebar แล้ว) */}
      <div className="flex w-full min-w-0 max-w-full items-center justify-end gap-3 pl-14 pr-4 sm:gap-4 sm:px-6 md:pl-6 lg:px-8 xl:px-10 2xl:px-12">
        {/* Reserved for future header actions — keep layout shell only */}
      </div>
    </header>
  );
}
