import { Header } from "./Header";
import { PhoneMockup } from "./PhoneMockup";
import { ContactForm } from "./ContactForm";
import { FAQ } from "./FAQ";
import {
  IconSmartphone,
  IconMoon,
  IconCalculator,
  IconFace,
  IconStore,
  IconShield,
  IconDownload,
  IconCloud,
  IconCheck,
  IconX,
  IconTriangle,
  IconClock,
} from "./icons";

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      {eyebrow && (
        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-blue-600">{eyebrow}</p>
      )}
      <h2 className="text-2xl font-bold text-[#1e3a5f] sm:text-3xl lg:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{description}</p>}
    </div>
  );
}

const problems = [
  "タイムカードの集計に時間がかかる",
  "打刻忘れや打刻ミスが多い",
  "22時以降の深夜手当計算が面倒",
  "店舗ごとに従業員を管理しにくい",
  "給与計算をExcelで毎月手作業している",
  "社員コードや従業員情報の管理がバラバラ",
  "不正打刻が心配",
];

const solutions = [
  { icon: IconFace, title: "顔認証で本人確認", desc: "なりすまし打刻を防ぎ、安心して運用できます。" },
  { icon: IconSmartphone, title: "スマホで出勤・退勤打刻", desc: "紙のタイムカード不要。現場ですぐに打刻できます。" },
  { icon: IconStore, title: "店舗別に従業員を管理", desc: "複数店舗のアルバイト勤怠管理をまとめて見渡せます。" },
  { icon: IconShield, title: "社員コードの重複チェック", desc: "従業員情報の入力ミスを未然に防ぎます。" },
  { icon: IconCalculator, title: "時給登録で給与を自動計算", desc: "給与計算の自動化で、月末の手作業をなくします。" },
  { icon: IconMoon, title: "22時以降は深夜給1.25倍", desc: "深夜手当の自動計算に対応。飲食店の夜営業に最適です。" },
  { icon: IconClock, title: "30分単位の給与計算", desc: "細かい勤務時間も正確に集計できます。" },
  { icon: IconShield, title: "管理者のみ打刻修正可能", desc: "権限管理で不正や誤操作を防ぎます。" },
  { icon: IconDownload, title: "月末給与CSV出力", desc: "給与ソフト連携もスムーズに。" },
  { icon: IconCloud, title: "自動バックアップ機能", desc: "大切な勤怠データを安全に保管します。" },
];

const featureCards = [
  {
    icon: IconFace,
    title: "顔認証打刻",
    desc: "本人確認を行いながら、スマホで簡単に出勤・退勤を記録できます。",
  },
  {
    icon: IconCalculator,
    title: "給与自動計算",
    desc: "時給・勤務時間・深夜手当をもとに、月末給与を自動で集計します。",
  },
  {
    icon: IconStore,
    title: "店舗別管理",
    desc: "複数店舗の従業員を店舗ごとに整理して管理できます。",
  },
  {
    icon: IconShield,
    title: "管理者権限",
    desc: "打刻修正や給与確認は管理者のみが操作可能。不正やミスを防ぎます。",
  },
  {
    icon: IconDownload,
    title: "CSV出力",
    desc: "月末給与データをCSVで出力し、給与ソフト連携にも対応できます。",
  },
  {
    icon: IconCloud,
    title: "自動バックアップ",
    desc: "大切な勤怠データを安全に保存し、万が一のデータ消失リスクを軽減します。",
  },
];

const benefits = [
  { stat: "80%", label: "月末作業時間を大幅削減", desc: "集計・計算の手作業が不要に" },
  { stat: "0件", label: "手入力ミスを防止", desc: "自動集計でヒューマンエラーを減らす" },
  { stat: "顔認証", label: "不正打刻の抑止", desc: "本人確認で安心の勤怠管理" },
  { stat: "自動", label: "給与計算のストレス軽減", desc: "毎月の月末がぐっとラクに" },
  { stat: "店舗別", label: "見やすい管理画面", desc: "店舗勤怠管理が一目でわかる" },
  { stat: "ラクに", label: "経営者・店長の負担軽減", desc: "現場と経営の両方にメリット" },
];

const useCases = [
  { emoji: "🥩", name: "焼肉店", desc: "繁忙期のアルバイト多数でも、打刻と集計をスムーズに" },
  { emoji: "🍶", name: "居酒屋", desc: "深夜手当の自動計算で、22時以降の勤務も正確に" },
  { emoji: "☕", name: "カフェ", desc: "シフト管理と合わせて、パート・アルバイトの勤怠を整理" },
  { emoji: "🍜", name: "ラーメン店", desc: "短時間勤務の集計も30分単位で正確に" },
  { emoji: "💇", name: "美容室", desc: "スタッフごとの時給設定で給与計算がラクに" },
  { emoji: "💅", name: "サロン", desc: "複数スタッフの店舗勤怠管理をスマホで完結" },
  { emoji: "🛍️", name: "小売店", desc: "曜日・時間帯がバラバラな勤務も自動集計" },
  { emoji: "🏢", name: "複数店舗展開", desc: "店舗ごとに従業員を分けて一元管理" },
];

const comparisonRows = [
  { label: "打刻の簡単さ", paper: "bad", excel: "warn", app: "good", paperText: "手書き・集計が手間", excelText: "PCが必要", appText: "スマホで即打刻" },
  { label: "集計作業", paper: "bad", excel: "warn", app: "good", paperText: "月末に数時間", excelText: "関数・転記が必要", appText: "自動集計" },
  { label: "深夜手当計算", paper: "bad", excel: "warn", app: "good", paperText: "手計算でミスしやすい", excelText: "設定が複雑", appText: "1.25倍を自動計算" },
  { label: "打刻ミス防止", paper: "bad", excel: "bad", app: "good", paperText: "なりすましのリスク", excelText: "入力ミスあり", appText: "顔認証で本人確認" },
  { label: "店舗別管理", paper: "bad", excel: "warn", app: "good", paperText: "ファイルが分散", excelText: "シート分けが必要", appText: "店舗ごとに整理" },
  { label: "給与CSV出力", paper: "bad", excel: "warn", app: "good", paperText: "手入力が必要", excelText: "整形が手間", appText: "ワンクリック出力" },
  { label: "データ保存", paper: "bad", excel: "warn", app: "good", paperText: "紛失・破損のリスク", excelText: "PC依存", appText: "自動バックアップ" },
];

function CompareCell({
  level,
  text,
  highlight,
}: {
  level: "good" | "warn" | "bad";
  text: string;
  highlight?: boolean;
}) {
  const icon =
    level === "good" ? (
      <IconCheck className="h-4 w-4 shrink-0 text-emerald-500" />
    ) : level === "warn" ? (
      <IconTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
    ) : (
      <IconX className="h-4 w-4 shrink-0 text-red-400" />
    );

  return (
    <div className="flex items-center justify-center gap-1.5">
      {icon}
      <span className={`text-xs leading-tight ${highlight ? "font-medium text-blue-700" : "text-slate-500"}`}>
        {text}
      </span>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="scroll-smooth bg-white text-slate-800">
      <Header />

      {/* 1. Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1e3a5f] via-[#1a3356] to-[#0f2744] text-white">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -right-20 top-20 h-96 w-96 rounded-full bg-blue-500 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-80 w-80 rounded-full bg-blue-400 blur-3xl" />
        </div>
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <p className="mb-4 inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-blue-100 backdrop-blur">
              飲食店・小規模店舗向け 勤怠管理アプリ
            </p>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              もう、月末の
              <br />
              <span className="text-orange-400">給与計算</span>で悩まない。
            </h1>
            <p className="mt-6 text-base leading-relaxed text-blue-100 sm:text-lg">
              スマホで打刻。自動で集計。店舗の勤怠管理をもっとラクに。
              <br className="hidden sm:block" />
              紙のタイムカード・Excel管理から卒業しませんか？
            </p>
            <div className="mt-8">
              <a
                href="#contact"
                className="inline-block rounded-full bg-orange-500 px-8 py-4 text-center text-base font-bold text-white shadow-xl shadow-orange-500/30 transition-colors hover:bg-orange-600"
              >
                無料で相談する
              </a>
            </div>
            <ul className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { icon: IconSmartphone, text: "スマホで簡単打刻" },
                { icon: IconMoon, text: "深夜手当も自動計算" },
                { icon: IconCalculator, text: "月末給与を自動集計" },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
                  <item.icon className="h-5 w-5 shrink-0 text-orange-400" />
                  <span className="text-sm font-semibold">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center lg:justify-end">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* 2. Problems */}
      <section id="problems" className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Problem"
            title="こんなお悩み、ありませんか？"
            description="飲食店や小規模店舗の経営者・店長の方から、よく聞くお悩みです。"
          />
          <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
            <ul className="space-y-4">
              {problems.map((problem) => (
                <li key={problem} className="flex items-start gap-4">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-slate-300 bg-slate-50">
                    <IconCheck className="h-4 w-4 text-slate-400" />
                  </span>
                  <span className="text-base font-medium text-slate-700">{problem}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-center text-sm text-slate-500">
              1つでも当てはまったら、このタイムカードアプリがお役に立てます。
            </p>
          </div>
        </div>
      </section>

      {/* 3. Solutions */}
      <section id="solutions" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Solution"
            title="このアプリで解決できます"
            description="現場の悩みに寄り添った機能で、アルバイト勤怠管理の負担をぐっと減らします。"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {solutions.map((item) => (
              <div
                key={item.title}
                className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#1e3a5f]">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Features */}
      <section id="features" className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Features"
            title="主な機能"
            description="顔認証勤怠から給与計算の自動化まで。店舗運営に必要な機能をひとつに。"
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1e3a5f] text-white">
                  <card.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-[#1e3a5f]">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Benefits */}
      <section id="benefits" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Benefits"
            title="導入メリット"
            description="数字と効果でわかる。毎月の勤怠・給与管理が、こんなに変わります。"
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b) => (
              <div
                key={b.label}
                className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6"
              >
                <p className="text-3xl font-bold text-blue-600">{b.stat}</p>
                <h3 className="mt-2 font-bold text-[#1e3a5f]">{b.label}</h3>
                <p className="mt-1 text-sm text-slate-600">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Use Cases */}
      <section id="use-cases" className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Use Cases"
            title="こんな店舗で使われています"
            description="飲食店勤怠管理はもちろん、美容室・サロン・小売店など幅広い業種に対応。"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {useCases.map((uc) => (
              <div key={uc.name} className="rounded-2xl bg-white p-5 shadow-sm">
                <span className="text-3xl" role="img" aria-hidden>
                  {uc.emoji}
                </span>
                <h3 className="mt-3 font-bold text-[#1e3a5f]">{uc.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Steps */}
      <section id="steps" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="How it works"
            title="使い方は、たったの3ステップ"
            description="難しい設定は不要。すぐに始められるシンプルな流れです。"
          />
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { step: "01", title: "従業員を登録", desc: "店舗・時給・社員コードを登録するだけ。重複チェックで入力ミスも防げます。" },
              { step: "02", title: "スマホで出勤・退勤", desc: "従業員はスマホから顔認証で打刻。現場の負担は最小限です。" },
              { step: "03", title: "月末に給与を自動集計", desc: "深夜手当も含めて自動計算。CSV出力で給与ソフトへスムーズに連携。" },
            ].map((s, i) => (
              <div key={s.step} className="relative text-center">
                {i < 2 && (
                  <div className="absolute right-0 top-10 hidden h-0.5 w-full translate-x-1/2 bg-blue-200 md:block" aria-hidden />
                )}
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#1e3a5f] text-2xl font-bold text-white shadow-lg">
                  {s.step}
                </div>
                <h3 className="mt-6 text-lg font-bold text-[#1e3a5f]">STEP {i + 1}：{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Comparison */}
      <section id="comparison" className="bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Comparison"
            title="紙・Excel・アプリ、どれがラク？"
            description="飲食店の勤怠管理に求められることを、わかりやすく比較しました。"
          />
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[520px] text-xs lg:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="w-[28%] px-3 py-2.5 text-left text-xs font-semibold text-slate-600 lg:px-4 lg:py-3">比較項目</th>
                  <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 lg:px-3 lg:py-3">紙</th>
                  <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 lg:px-3 lg:py-3">Excel</th>
                  <th className="px-2 py-2.5 text-center text-xs font-bold text-[#1e3a5f] lg:px-3 lg:py-3">アプリ</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-700 lg:px-4 lg:py-3 lg:text-sm">{row.label}</td>
                    <td className="px-2 py-2.5 lg:px-3 lg:py-3">
                      <CompareCell level={row.paper as "good" | "warn" | "bad"} text={row.paperText} />
                    </td>
                    <td className="px-2 py-2.5 lg:px-3 lg:py-3">
                      <CompareCell level={row.excel as "good" | "warn" | "bad"} text={row.excelText} />
                    </td>
                    <td className="bg-blue-50/50 px-2 py-2.5 lg:px-3 lg:py-3">
                      <CompareCell level={row.app as "good" | "warn" | "bad"} text={row.appText} highlight />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 9. FAQ */}
      <section id="faq" className="py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title="よくある質問" description="導入前によくいただくご質問にお答えします。" />
          <FAQ />
        </div>
      </section>

      {/* 10. Final CTA + Contact */}
      <section id="contact" className="bg-gradient-to-br from-[#1e3a5f] via-[#1a3356] to-[#0f2744] py-20 text-white sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
                毎月の給与計算を、
                <br />
                もっとラクに。
              </h2>
              <p className="mt-4 text-base leading-relaxed text-blue-100 sm:text-lg">
                紙のタイムカード管理から、スマホ勤怠管理へ。
                <br />
                まずは無料で導入相談してみませんか？
              </p>
              <div className="mt-8">
                <a
                  href="#contact-form"
                  className="inline-block rounded-full bg-orange-500 px-8 py-4 text-center font-bold shadow-xl shadow-orange-500/30 transition-colors hover:bg-orange-600"
                >
                  無料で相談する
                </a>
              </div>
              <p className="mt-6 text-sm text-blue-200">
                導入について問い合わせる · お電話でのご相談も承ります
              </p>
            </div>
            <div id="contact-form" className="rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
              <h3 className="mb-6 text-xl font-bold text-[#1e3a5f]">お問い合わせフォーム</h3>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-slate-500">© 2026 勤怠管理アプリ. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
