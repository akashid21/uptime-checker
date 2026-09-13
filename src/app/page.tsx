import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Command,
  Gauge,
  HeartPulse,
  Menu,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "UptimeBoard — Know before your customers do",
  description:
    "Simple, dependable website and API monitoring for independent developers and small teams. Get alerted when your service needs you.",
  alternates: { canonical: "/" },
};

const reliability = [
  100, 100, 100, 99.98, 100, 100, 100, 100, 100, 100, 99.99, 100, 100, 100, 100,
  100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="landing-page overflow-hidden bg-[#080b14] text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_55%_38%_at_50%_-8%,rgba(99,102,241,.23),transparent_70%),radial-gradient(ellipse_35%_25%_at_88%_30%,rgba(16,185,129,.08),transparent_70%)]" />
      <Nav />
      <section className="relative px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(148,163,184,.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,.055)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_75%_55%_at_50%_20%,black,transparent)]" />
        <div className="mx-auto max-w-7xl text-center">
          <div className="landing-reveal inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/[.08] px-3 py-1.5 text-xs font-medium text-indigo-200 shadow-[0_0_30px_rgba(99,102,241,.1)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Monitoring made refreshingly simple
          </div>
          <h1 className="landing-reveal landing-reveal-1 mx-auto mt-7 max-w-4xl text-balance text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
            Know your service is down{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-emerald-300 bg-clip-text text-transparent">
              before your customers do.
            </span>
          </h1>
          <p className="landing-reveal landing-reveal-2 mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-slate-400 sm:text-lg">
            UptimeBoard watches your websites and APIs around the clock, turns
            outages into clear signals, and gives you the calm to focus on
            building.
          </p>
          <div className="landing-reveal landing-reveal-3 mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-[#080b14]"
            >
              Start monitoring for free{" "}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/60 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              See how it works <ChevronRight className="h-4 w-4" />
            </a>
          </div>
          <p className="landing-reveal landing-reveal-3 mt-4 text-xs text-slate-500">
            Free forever: 2 projects · 5 monitors per project · no card required
          </p>
          <div className="landing-reveal landing-reveal-4 relative mx-auto mt-14 max-w-5xl text-left sm:mt-20">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-indigo-500/15 blur-3xl" />
            <DashboardPreview />
          </div>
        </div>
      </section>
      <section
        aria-label="Benefits"
        className="border-y border-slate-800/70 bg-slate-950/30 px-5 py-5 sm:px-8"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-slate-800/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <TrustItem
            icon={<Zap />}
            title="Set up in minutes"
            text="Add a URL. We handle the watching."
          />
          <TrustItem
            icon={<BellRing />}
            title="Clear, calm alerts"
            text="Confirmed downtime, never noisy guesses."
          />
          <TrustItem
            icon={<ShieldCheck />}
            title="Built for confidence"
            text="Your history makes reliability visible."
          />
        </div>
      </section>
      <section
        id="features"
        className="scroll-mt-20 px-5 py-24 sm:px-8 sm:py-32"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-xl">
            <Eyebrow>Everything you need, nothing you don&apos;t</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-white sm:text-5xl">
              A better relationship with uptime.
            </h2>
            <p className="mt-5 leading-7 text-slate-400">
              Purpose-built for people who ship products—not teams who want
              another complicated operations console.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <Feature
              icon={<HeartPulse />}
              title="Watch every critical path"
              text="Monitor websites and APIs in one focused view. Group related services into projects that make sense to you."
            />
            <Feature
              icon={<BellRing />}
              title="Act on real incidents"
              text="Smart retries help filter momentary network hiccups, so alerts mean it’s time to look—not just another notification."
            />
            <Feature
              icon={<Gauge />}
              title="Turn data into reassurance"
              text="Clean uptime history, incident context, and response-time signals let you understand your reliability at a glance."
            />
            <Feature
              icon={<CheckCircle2 />}
              title="Email alerts that matter"
              text="Get notified when a confirmed incident starts and when your service recovers—without an email for every check."
            />
            <Feature
              icon={<Clock3 />}
              title="Keep the story, not the clutter"
              text="Daily reliability rollups preserve the history you care about without drowning you in raw check data."
            />
            <Feature
              icon={<Sparkles />}
              title="Designed for daily use"
              text="A considered interface that respects your attention—fast to scan on a laptop, tablet, or phone."
            />
          </div>
        </div>
      </section>
      <section
        id="how-it-works"
        className="scroll-mt-20 border-y border-slate-800/80 bg-slate-950/40 px-5 py-24 sm:px-8 sm:py-32"
      >
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <Eyebrow>From unknown to in control</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-white sm:text-5xl">
              Monitoring that gets out of your way.
            </h2>
          </div>
          <div className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            <div className="absolute left-[16%] right-[16%] top-7 hidden h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent md:block" />
            <Step
              number="01"
              title="Add what matters"
              text="Create a project and enter the website or API endpoint your customers rely on."
            />
            <Step
              number="02"
              title="We keep watch"
              text="UptimeBoard checks continuously and confirms an issue before calling it an outage."
            />
            <Step
              number="03"
              title="Respond with context"
              text="Receive a useful alert, see the incident timeline, and know when service recovers."
            />
          </div>
        </div>
      </section>
      <section className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/15 via-slate-900 to-emerald-500/[.08] px-6 py-16 text-center sm:px-16 sm:py-20">
          <div className="absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-400/20 blur-3xl" />
          <Activity className="relative mx-auto h-8 w-8 text-emerald-300" />
          <h2 className="relative mx-auto mt-6 max-w-2xl text-3xl font-semibold tracking-[-.04em] text-white sm:text-5xl">
            The next outage shouldn&apos;t be a customer support ticket.
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl text-slate-400">
            Put a thoughtful early-warning system between your work and the
            people who depend on it.
          </p>
          <Link
            href="/signup"
            className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-white"
          >
            Create your free account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
      <footer className="border-t border-slate-800/80 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 sm:flex-row sm:items-center">
          <Brand />
          <p className="max-w-2xl text-center text-xs leading-5 text-slate-500 sm:text-right">
            Built to keep you ahead of downtime. Feedback?{' '}
            <a href="mailto:uptimeboard.alerts@gmail.com?subject=UptimeBoard%20feedback" aria-label="Email UptimeBoard feedback" className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 font-medium text-slate-300 transition hover:border-indigo-400/50 hover:bg-slate-800 hover:text-white">
              Send feedback
            </a>{' '}—I&apos;m listening.
          </p>
        </div>
      </footer>
    </main>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/60 bg-[#080b14]/75 px-5 py-4 backdrop-blur-xl sm:px-8">
      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <Brand />
        <div className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
          <a href="#features" className="transition hover:text-white">
            Features
          </a>
          <a href="#how-it-works" className="transition hover:text-white">
            How it works
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:text-white sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-indigo-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
          >
            Start free
          </Link>
        </div>
      </nav>
    </header>
  );
}
function Brand() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-white"
    >
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-400/30 bg-indigo-400/10">
        <Activity className="h-4 w-4 text-emerald-300" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <span>
        Uptime<span className="text-indigo-300">Board</span>
      </span>
    </Link>
  );
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[.16em] text-indigo-300">
      {children}
    </p>
  );
}
function TrustItem({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center justify-center gap-3 px-5 py-3 text-center sm:justify-start">
      <span className="text-emerald-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <div>
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{text}</p>
      </div>
    </div>
  );
}
function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="group rounded-2xl border border-slate-800 bg-slate-900/30 p-6 transition duration-300 hover:-translate-y-1 hover:border-indigo-400/30 hover:bg-slate-900/60">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/15 bg-indigo-400/[.08] text-indigo-300 transition group-hover:scale-105 group-hover:text-emerald-300 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </div>
      <h3 className="mt-5 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </article>
  );
}
function Step({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="relative text-center">
      <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-400/30 bg-[#101528] text-sm font-semibold text-indigo-200 shadow-[0_0_24px_rgba(99,102,241,.18)]">
        {number}
      </div>
      <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-400">
        {text}
      </p>
    </div>
  );
}
function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0c1120] shadow-2xl shadow-black/40">
      <div className="flex h-12 items-center gap-2 border-b border-slate-800 px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <div className="ml-3 h-5 w-48 rounded-md bg-slate-800/70" />
      </div>
      <div className="grid min-h-[390px] grid-cols-[58px_1fr] sm:grid-cols-[170px_1fr]">
        <aside className="border-r border-slate-800 bg-slate-950/40 p-3">
          <div className="hidden items-center gap-2 px-2 py-2 text-xs font-medium text-white sm:flex">
            <Command className="h-3.5 w-3.5 text-indigo-300" />
            Overview
          </div>
          {["Monitors", "Incidents", "Settings"].map((item, i) => (
            <div
              key={item}
              className={`mt-2 hidden rounded-md px-2 py-2 text-xs sm:block ${i === 0 ? "text-slate-400" : "text-slate-600"}`}
            >
              {item}
            </div>
          ))}
          <div className="sm:hidden">
            <Menu className="mx-auto h-4 w-4 text-slate-400" />
          </div>
        </aside>
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white sm:text-base">
                  Overview
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  All systems operational
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                A live view of your monitored services.
              </p>
            </div>
            <span className="rounded-lg bg-indigo-500 px-2.5 py-1.5 text-[10px] font-medium text-white">
              + Add monitor
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Metric label="Active monitors" value="4" tone="indigo" />
            <Metric label="Down right now" value="0" tone="emerald" />
            <Metric label="30-day uptime" value="99.99%" tone="emerald" />
            <Metric label="Projects" value="2" tone="indigo" />
          </div>
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/35 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-white">
                  30-day reliability
                </p>
                <p className="mt-1 text-[9px] text-slate-500">
                  Every day at a glance
                </p>
              </div>
              <span className="text-[9px] text-emerald-400">● Healthy</span>
            </div>
            <div className="mt-4 grid grid-cols-10 gap-1.5 sm:grid-cols-[repeat(15,minmax(0,1fr))]">
              {reliability.map((value, i) => (
                <span
                  key={i}
                  title={`${value}% uptime`}
                  className={`aspect-square rounded-sm ${value < 100 ? "bg-emerald-400/70" : "bg-emerald-400"}`}
                />
              ))}
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/35 p-3">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-medium text-white">Production API</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Operational
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-[96%] rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "indigo" | "emerald";
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-2.5">
      <p className="text-[9px] text-slate-500">{label}</p>
      <p
        className={`mt-1 text-sm font-semibold ${tone === "emerald" ? "text-emerald-300" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}
