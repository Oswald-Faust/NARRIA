import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Rendu Markdown stylé pour les messages de l'assistant — titres, listes,
 * gras, code et tableaux alignés sur la charte NARR'IA.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-sm leading-7 text-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (props) => <p className="leading-7" {...props} />,
          ul: (props) => <ul className="ml-1 list-disc space-y-1.5 pl-4" {...props} />,
          ol: (props) => <ol className="ml-1 list-decimal space-y-1.5 pl-4 marker:font-semibold marker:text-soft-purple" {...props} />,
          li: (props) => <li className="pl-1" {...props} />,
          h1: (props) => <h3 className="mt-2 font-heading text-base font-bold text-foreground" {...props} />,
          h2: (props) => <h3 className="mt-2 font-heading text-base font-bold text-foreground" {...props} />,
          h3: (props) => <h4 className="mt-2 font-heading text-sm font-bold text-foreground" {...props} />,
          a: (props) => <a className="font-medium text-soft-pink underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />,
          code: (props) => (
            <code className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] text-soft-purple" {...props} />
          ),
          pre: (props) => (
            <pre className="overflow-x-auto rounded-xl border border-border bg-surface-2 p-3 font-mono text-[13px]" {...props} />
          ),
          blockquote: (props) => (
            <blockquote className="border-l-2 border-soft-purple/50 pl-3 text-muted" {...props} />
          ),
          table: (props) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13px]" {...props} />
            </div>
          ),
          th: (props) => <th className="border border-border bg-surface-2 px-3 py-1.5 font-semibold" {...props} />,
          td: (props) => <td className="border border-border px-3 py-1.5" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
