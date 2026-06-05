export function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[280px]" aria-hidden>
      <div className="absolute -inset-4 rounded-[3rem] bg-blue-500/20 blur-2xl" />
      <div className="relative rounded-[2.5rem] border-[6px] border-slate-800 bg-slate-800 p-2 shadow-2xl shadow-slate-900/30">
        <div className="absolute left-1/2 top-3 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
        <div className="overflow-hidden rounded-[2rem] bg-gradient-to-b from-slate-50 to-white">
          <div className="bg-[#1e3a5f] px-4 pb-3 pt-10 text-white">
            <p className="text-xs text-blue-200">勤怠管理アプリ</p>
            <p className="mt-1 text-lg font-bold">本日の打刻</p>
            <p className="text-sm text-blue-100">2026年6月6日（金）</p>
          </div>
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">顔認証 確認済み</p>
                <p className="text-xs text-slate-500">田中 花子さん</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-emerald-500 p-4 text-center text-white shadow-lg shadow-emerald-500/30">
                <p className="text-xs opacity-90">出勤</p>
                <p className="mt-1 text-2xl font-bold">09:58</p>
              </div>
              <div className="rounded-2xl bg-slate-100 p-4 text-center text-slate-400">
                <p className="text-xs">退勤</p>
                <p className="mt-1 text-2xl font-bold">--:--</p>
              </div>
            </div>
            <div className="rounded-xl bg-blue-50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">今月の勤務</span>
                <span className="font-bold text-[#1e3a5f]">86.5h</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-600">深夜手当</span>
                <span className="font-bold text-blue-600">12.0h</span>
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-3 text-center">
              <p className="text-xs font-medium text-blue-700">月末給与は自動集計</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
