"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

function CopyableCode({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-stack-sm rounded-lg border border-border-subtle bg-surface-container px-3 py-2",
        className,
      )}
    >
      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-data-tabular text-data-tabular text-on-surface">
        {code}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="flex shrink-0 items-center gap-1 rounded-md border border-border-subtle bg-surface-container-lowest px-2 py-1 font-label-caps text-label-caps text-on-surface-variant transition-colors hover:bg-surface-ice"
      >
        {copied ? <Check className="size-3.5" strokeWidth={2} /> : <Copy className="size-3.5" strokeWidth={2} />}
        {copied ? "Đã sao chép" : "Sao chép"}
      </button>
    </div>
  );
}

export function McpConnectionGuide({ endpoint }: { endpoint: string }) {
  const cliCommand = `claude mcp add --transport http ocean-finance ${endpoint} \\\n  --header "Authorization: Bearer <API_KEY_CỦA_BẠN>"`;

  const mcpJson = `{
  "mcpServers": {
    "ocean-finance": {
      "type": "http",
      "url": "${endpoint}",
      "headers": {
        "Authorization": "Bearer <API_KEY_CỦA_BẠN>"
      }
    }
  }
}`;

  return (
    <div className="mb-stack-md space-y-stack-md rounded-lg border border-border-subtle bg-surface-container-lowest p-4">
      <div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Hướng dẫn kết nối</h2>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
          Tạo API key ở trên, sau đó gắn vào Claude Code (hoặc AI agent hỗ trợ MCP qua HTTP) bằng một trong hai cách
          dưới đây. Key chỉ hiện một lần lúc tạo — dán đè vào chỗ <code className="font-data-tabular text-data-tabular">&lt;API_KEY_CỦA_BẠN&gt;</code>.
        </p>
      </div>

      <div>
        <p className="mb-1 font-label-caps text-label-caps text-on-surface-variant">Endpoint</p>
        <CopyableCode code={endpoint} />
      </div>

      <div>
        <p className="mb-1 font-label-caps text-label-caps text-on-surface-variant">Cách 1 — Claude Code CLI</p>
        <CopyableCode code={cliCommand} />
      </div>

      <div>
        <p className="mb-1 font-label-caps text-label-caps text-on-surface-variant">
          Cách 2 — file cấu hình <code className="font-data-tabular text-data-tabular">.mcp.json</code> (project) hoặc{" "}
          <code className="font-data-tabular text-data-tabular">claude_desktop_config.json</code> (Claude Desktop, cùng cấu trúc)
        </p>
        <CopyableCode code={mcpJson} />
      </div>

      <p className="font-body-md text-body-md text-on-surface-variant">
        Key được cấp quyền tương đương Admin — mọi thao tác (kể cả chỉ đọc) đều được ghi vào Audit Log với{" "}
        <code className="font-data-tabular text-data-tabular">actor_type=MCP</code>. Thu hồi key ngay ở bảng dưới nếu
        nghi ngờ bị lộ.
      </p>
    </div>
  );
}
