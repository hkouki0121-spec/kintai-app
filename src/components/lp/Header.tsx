"use client";

import { useState } from "react";
import Link from "next/link";
import { IconMenu, IconX } from "./icons";

const navItems = [
  { href: "#problems", label: "お悩み" },
  { href: "#features", label: "機能" },
  { href: "#benefits", label: "メリット" },
  { href: "#steps", label: "使い方" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "お問い合わせ" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/lp" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e3a5f] text-sm font-bold text-white">
            勤
          </div>
          <span className="text-base font-bold text-[#1e3a5f] sm:text-lg">勤怠管理アプリ</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="メインナビゲーション">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
            >
              {item.label}
            </a>
          ))}
          <a
            href="#contact"
            className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-colors hover:bg-orange-600"
          >
            無料で相談する
          </a>
        </nav>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 md:hidden"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="メニューを開く"
        >
          {open ? <IconX /> : <IconMenu />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-slate-100 bg-white px-4 py-4 md:hidden" aria-label="モバイルナビゲーション">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li className="pt-2">
              <a
                href="#contact"
                className="block rounded-full bg-orange-500 px-4 py-3 text-center text-sm font-bold text-white"
                onClick={() => setOpen(false)}
              >
                無料で相談する
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
