import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusChip } from "@/components/tables/status-chip";
import { CreateMcpClientDialog } from "@/components/forms/create-mcp-client-dialog";
import { McpConnectionGuide } from "@/components/forms/mcp-connection-guide";
import { RevokeMcpClientButton } from "@/components/forms/revoke-mcp-client-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { listMcpClients } from "@/server/services/mcp-client.service";

// Fixed production domain, not derived from the request host — the key is
// meant to point AI agents at the real deployment regardless of where this
// settings page happens to be viewed from (e.g. localhost during dev).
const MCP_ENDPOINT = "https://ocean-finance-zeta.vercel.app/api/mcp";

export default async function SettingsMcpPage() {
  const clients = await listMcpClients();

  return (
    <div>
      <PageHeader
        title="MCP / API Key"
        description="Quản lý API key cấp cho Claude Code / AI agent — quyền tương đương Admin."
        action={<CreateMcpClientDialog />}
      />

      <McpConnectionGuide endpoint={MCP_ENDPOINT} />

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {clients.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="Chưa có MCP client nào"
            description="Tạo API key mới để kết nối Claude Code hoặc AI agent khác với hệ thống."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-ice hover:bg-surface-ice">
                <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tên</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Trạng thái</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Lần dùng gần nhất</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ngày tạo</TableHead>
                <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client, index) => (
                <TableRow key={client.id} className="border-border-subtle">
                  <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                  <TableCell className="font-medium text-on-surface">{client.name}</TableCell>
                  <TableCell>
                    <StatusChip status={client.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-data-tabular text-data-tabular text-on-surface-variant">
                    {client.lastUsedAt ? formatDateTime(client.lastUsedAt) : "Chưa dùng"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-data-tabular text-data-tabular text-on-surface-variant">
                    {formatDateTime(client.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {client.status === "ACTIVE" ? (
                        <RevokeMcpClientButton clientId={client.id} clientName={client.name} />
                      ) : (
                        <span className="font-body-md text-body-md text-on-surface-variant">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
