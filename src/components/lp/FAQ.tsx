"use client";

import { useState } from "react";
import { IconChevron } from "./icons";

const faqs = [
  {
    q: "スマホだけで使えますか？",
    a: "はい。従業員はスマホから簡単に出勤・退勤できます。店舗にタブレットを置いて打刻する運用にも対応しています。",
  },
  {
    q: "深夜手当には対応していますか？",
    a: "はい。22時以降の勤務は1.25倍で自動計算できます。飲食店の夜営業にもそのまま使えます。",
  },
  {
    q: "複数店舗でも使えますか？",
    a: "はい。店舗ごとに従業員を分けて管理できます。焼肉店・居酒屋など複数店舗展開の経営者にもおすすめです。",
  },
  {
    q: "打刻ミスは修正できますか？",
    a: "はい。管理者のみ修正できる仕様にできます。現場のミスや打刻忘れにも柔軟に対応できます。",
  },
  {
    q: "給与ソフトと連携できますか？",
    a: "CSV出力に対応しているため、給与ソフトへの連携がしやすくなります。月末の給与計算の手作業を大幅に減らせます。",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {faqs.map((faq, i) => {
        const open = openIndex === i;
        return (
          <div key={faq.q} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left lg:py-2"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
            >
              <span className="text-sm font-semibold text-[#1e3a5f]">Q. {faq.q}</span>
              <IconChevron className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="border-t border-slate-100 px-4 py-2.5 text-xs leading-relaxed text-slate-600 lg:text-sm">
                A. {faq.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
