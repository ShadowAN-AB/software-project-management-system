import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={`prose-sm max-w-none text-zinc-700 dark:text-zinc-300 leading-relaxed
        [&_p]:my-1.5
        [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-zinc-900 [&_h1]:dark:text-zinc-100 [&_h1]:tracking-tight [&_h1]:mt-4 [&_h1]:mb-2
        [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_h2]:dark:text-zinc-100 [&_h2]:tracking-tight [&_h2]:mt-3 [&_h2]:mb-1.5
        [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-zinc-900 [&_h3]:dark:text-zinc-100 [&_h3]:mt-3 [&_h3]:mb-1
        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ul]:space-y-0.5
        [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_ol]:space-y-0.5
        [&_li]:my-0
        [&_a]:text-zinc-900 [&_a]:dark:text-zinc-100 [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-zinc-400 hover:[&_a]:decoration-zinc-700
        [&_code]:bg-zinc-100 [&_code]:dark:bg-zinc-800 [&_code]:text-zinc-800 [&_code]:dark:text-zinc-200 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.85em] [&_code]:font-mono
        [&_pre]:bg-zinc-100 [&_pre]:dark:bg-zinc-800 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0
        [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:dark:border-zinc-600 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-zinc-500 [&_blockquote]:dark:text-zinc-400 [&_blockquote]:my-2
        [&_strong]:font-semibold [&_strong]:text-zinc-900 [&_strong]:dark:text-zinc-100
        [&_hr]:border-zinc-200 [&_hr]:dark:border-zinc-700 [&_hr]:my-3
        [&_table]:my-2 [&_table]:border-collapse [&_th]:border [&_th]:border-zinc-200 [&_th]:dark:border-zinc-700 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium [&_th]:bg-zinc-50 [&_th]:dark:bg-zinc-900 [&_td]:border [&_td]:border-zinc-200 [&_td]:dark:border-zinc-700 [&_td]:px-2 [&_td]:py-1
        ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
