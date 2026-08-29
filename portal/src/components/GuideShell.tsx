import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Sidebar } from "./Sidebar";

export function GuideShell({
 children,
 network = "testnet",
 tip = "-",
}: {
 children: ReactNode;
 network?: string;
 tip?: string;
}) {
 return (
  <div className="app-shell guide-app-shell">
   <Sidebar network={network} tip={tip} />
   <main className="content guide-content">{children}</main>
  </div>
 );
}

export function GuideHeader({
 eyebrow = "CCC Guides",
 title,
 description,
 docsHref,
}: {
 eyebrow?: string;
 title: string;
 description: string;
 docsHref?: string;
}) {
 return (
  <header className="guide-header">
   <div>
    <span className="guide-eyebrow">{eyebrow}</span>
    <h1>{title}</h1>
    <p>{description}</p>
   </div>
   {docsHref && (
    <a className="btn secondary guide-docs-link" href={docsHref} target="_blank" rel="noreferrer">
     Official docs <ExternalLink size={16} />
    </a>
   )}
  </header>
 );
}

export function GuideSection({
 title,
 children,
 description,
}: {
 title: string;
 children: ReactNode;
 description?: string;
}) {
 return (
  <section className="guide-card">
   <h2>{title}</h2>
   {description && <p className="guide-muted">{description}</p>}
   {children}
  </section>
 );
}

export function StepList({ items }: { items: string[] }) {
 return (
  <ol className="guide-steps">
   {items.map((item, index) => (
    <li key={item}>
     <span>{index + 1}</span>
     <p>{item}</p>
    </li>
   ))}
  </ol>
 );
}

export function CodeBlock({ code }: { code: string }) {
 return <pre className="guide-code"><code>{code}</code></pre>;
}

export function ResultBox({ title = "Result", value }: { title?: string; value?: string }) {
 if (!value) return null;
 return (
  <div className="guide-result">
   <strong>{title}</strong>
   <code>{value}</code>
  </div>
 );
}