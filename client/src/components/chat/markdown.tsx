import type { ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Model replies are markdown (bold, lists, tables). react-markdown builds React
// elements and does not render raw HTML, so model/user text can't inject markup.
const components: Components = {
  table: (props) => <Table>{props.children}</Table>,
  thead: (props) => <TableHeader>{props.children}</TableHeader>,
  tbody: (props) => <TableBody>{props.children}</TableBody>,
  tr: (props) => <TableRow>{props.children}</TableRow>,
  th: (props: ComponentProps<"th">) => <TableHead>{props.children}</TableHead>,
  td: (props: ComponentProps<"td">) => <TableCell>{props.children}</TableCell>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="underline underline-offset-2"
    >
      {children}
    </a>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-2 break-words [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_pre]:overflow-x-auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
