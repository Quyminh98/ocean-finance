import { IdCard, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateViaDialog } from "@/components/forms/create-via-dialog";
import { EditViaDialog } from "@/components/forms/edit-via-dialog";
import { DeleteViaButton } from "@/components/forms/delete-via-button";
import { formatDate } from "@/lib/dates";
import { requireUser } from "@/server/auth/rbac";
import { listViasByHolder } from "@/server/services/via.service";
import { listPageOptions } from "@/server/services/page.service";

export default async function UserViasPage() {
  const user = await requireUser();
  const [vias, pageOptions] = await Promise.all([listViasByHolder(user.id), listPageOptions()]);

  return (
    <div>
      <PageHeader
        title="Via của tôi"
        description="Via bạn tự tạo — chỉ bạn xem/xoá được."
        action={<CreateViaDialog pageOptions={pageOptions} />}
      />

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {vias.length === 0 ? (
          <EmptyState icon={IdCard} title="Chưa có via" description="Bấm “Thêm via” để tạo via đầu tiên." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-ice hover:bg-surface-ice">
                <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tên via</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Link</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Page</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ngày tạo</TableHead>
                <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vias.map((via, index) => (
                <TableRow key={via.viaId} className="border-border-subtle">
                  <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                  <TableCell className="font-medium text-on-surface">{via.name}</TableCell>
                  <TableCell>
                    <a
                      href={via.facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-on-surface-variant hover:text-finance-blue"
                    >
                      <ExternalLink className="size-3.5" strokeWidth={2} />
                      Mở link
                    </a>
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {via.pages.length === 0 ? "—" : via.pages.map((page) => page.name).join(", ")}
                  </TableCell>
                  <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{formatDate(via.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-stack-sm">
                      <EditViaDialog
                        viaId={via.viaId}
                        defaultValues={{ name: via.name, facebookUrl: via.facebookUrl, pageIds: via.pages.map((page) => page.pageId) }}
                        pageOptions={pageOptions}
                      />
                      <DeleteViaButton viaId={via.viaId} name={via.name} />
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
