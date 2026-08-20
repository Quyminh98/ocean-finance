import { notFound } from "next/navigation";
import { History, Megaphone, Receipt, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageStatusChipList } from "@/components/tables/page-status-chip-list";
import { PageTypeChip } from "@/components/tables/page-type-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditPageDialog } from "@/components/forms/edit-page-dialog";
import { TransferPageDialog } from "@/components/forms/transfer-page-dialog";
import { AssignEmployeeDialog } from "@/components/forms/assign-employee-dialog";
import { CreateRevenueDialog } from "@/components/forms/create-revenue-dialog";
import { EditRevenueDialog } from "@/components/forms/edit-revenue-dialog";
import { DeleteRevenueButton } from "@/components/forms/delete-revenue-button";
import { CreateAdExpenseDialog } from "@/components/forms/create-ad-expense-dialog";
import { EditAdExpenseDialog } from "@/components/forms/edit-ad-expense-dialog";
import { DeleteAdExpenseButton } from "@/components/forms/delete-ad-expense-button";
import { formatVnd, REVENUE_TEXT_CLASS, EXPENSE_TEXT_CLASS } from "@/lib/money";
import { cn } from "@/lib/utils";
import { formatDate, formatMonth } from "@/lib/dates";
import { getPageDetail, listPageOptions } from "@/server/services/page.service";
import { getAssignmentHistory } from "@/server/services/assignment.service";
import { listActiveEmployeeOptions } from "@/server/services/employee.service";
import { listRevenue } from "@/server/services/revenue.service";
import { listAdExpenses } from "@/server/services/ads.service";
import { listAdminOptions } from "@/server/services/user-account.service";
import { listPageStatusOptions } from "@/server/services/page-status-option.service";

export default async function PageDetailPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const page = await getPageDetail(pageId);
  if (!page) notFound();

  const [history, activeEmployees, pageOptions, revenue, adExpenses, adminOptions, statusOptions] = await Promise.all([
    getAssignmentHistory(pageId),
    listActiveEmployeeOptions(),
    listPageOptions(),
    listRevenue({ pageId, pageSize: 100 }),
    listAdExpenses({ pageId, pageSize: 100 }),
    listAdminOptions(),
    listPageStatusOptions(),
  ]);
  const candidateEmployees = activeEmployees.filter((employee) => employee.employeeId !== page.currentEmployee?.employeeId);
  const statusPickerOptions = statusOptions.map((option) => ({ optionId: option.optionId, label: option.label, color: option.color }));

  return (
    <div>
      <PageHeader
        title={page.name}
        description={page.facebookUrl}
        backHref="/admin/pages"
        action={
          <div className="flex items-center gap-stack-sm">
            <PageTypeChip pageType={page.pageType} />
            <PageStatusChipList statuses={page.currentStatuses} />
            <EditPageDialog
              pageId={page.pageId}
              defaultValues={{
                name: page.name,
                facebookUrl: page.facebookUrl,
                statusIds: page.currentStatuses.map((status) => status.statusId),
                notes: page.notes ?? "",
              }}
              statusOptions={statusPickerOptions}
            />
            {page.currentEmployee ? (
              <TransferPageDialog
                pageId={page.pageId}
                currentEmployeeName={page.currentEmployee.name}
                candidateEmployees={candidateEmployees}
              />
            ) : (
              <AssignEmployeeDialog pageId={page.pageId} candidateEmployees={candidateEmployees} />
            )}
          </div>
        }
      />

      <div className="mb-gutter grid grid-cols-2 gap-4 md:grid-cols-5">
        <SummaryStat label="Nhân viên phụ trách" value={page.currentEmployee?.name ?? "Chưa gán"} />
        <SummaryStat label="Giá mua" value={formatVnd(page.purchasePrice)} tone={EXPENSE_TEXT_CLASS} />
        <SummaryStat label="Người chi mua Page" value={page.purchasePaidByAdminName ?? "—"} />
        <SummaryStat label="Tháng mua" value={formatMonth(page.purchaseMonth.toISOString().slice(0, 7))} />
        <SummaryStat label="Ngày tạo" value={formatDate(page.createdAt)} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="revenue">Doanh thu</TabsTrigger>
          <TabsTrigger value="ads">Ads</TabsTrigger>
          <TabsTrigger value="assignment">Lịch sử gán</TabsTrigger>
          <TabsTrigger value="audit">Lịch sử thao tác</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-stack-md">
          {page.notes ? (
            <div className="rounded-lg border border-border-subtle bg-surface-container-lowest p-card-padding">
              <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">Ghi chú</p>
              <p className="mt-stack-sm font-body-md text-body-md text-on-surface">{page.notes}</p>
            </div>
          ) : (
            <EmptyState
              icon={Receipt}
              title="Chưa có số liệu kỳ này"
              description="Doanh thu, Ads và lifetime totals của Page sẽ hiển thị tại đây."
            />
          )}
        </TabsContent>
        <TabsContent value="revenue" className="pt-stack-md">
          <div className="mb-stack-md flex justify-end">
            <CreateRevenueDialog pageOptions={pageOptions} fixedPageId={pageId} />
          </div>
          {revenue.items.length === 0 ? (
            <EmptyState icon={Receipt} title="Chưa có doanh thu" description="Doanh thu ghi nhận cho Page này sẽ hiển thị tại đây." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-ice hover:bg-surface-ice">
                    <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Nhân viên</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tháng</TableHead>
                    <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Số tiền</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ghi chú</TableHead>
                    <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenue.items.map((row, index) => (
                    <TableRow key={row.revenueId} className="border-border-subtle">
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                      <TableCell className="text-on-surface-variant">{row.employeeName}</TableCell>
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{formatMonth(row.revenueMonth.toISOString().slice(0, 7))}</TableCell>
                      <TableCell className={`text-right font-data-tabular text-data-tabular ${REVENUE_TEXT_CLASS}`}>{formatVnd(row.amount)}</TableCell>
                      <TableCell className="text-on-surface-variant">{row.note ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-stack-sm">
                          <EditRevenueDialog
                            revenueId={row.revenueId}
                            pageOptions={pageOptions}
                            defaultValues={{
                              pageId: row.pageId,
                              revenueMonth: row.revenueMonth.toISOString().slice(0, 7),
                              amount: row.amount.toString(),
                              note: row.note ?? "",
                            }}
                          />
                          <DeleteRevenueButton revenueId={row.revenueId} pageId={pageId} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="ads" className="pt-stack-md">
          <div className="mb-stack-md flex justify-end">
            <CreateAdExpenseDialog pageOptions={pageOptions} adminOptions={adminOptions} fixedPageId={pageId} />
          </div>
          {adExpenses.items.length === 0 ? (
            <EmptyState icon={Megaphone} title="Chưa có Ads" description="Chi phí Ads ghi nhận cho Page này sẽ hiển thị tại đây." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-ice hover:bg-surface-ice">
                    <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Nhân viên</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tháng</TableHead>
                    <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Số tiền</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Người chi</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ghi chú</TableHead>
                    <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adExpenses.items.map((row, index) => (
                    <TableRow key={row.adExpenseId} className="border-border-subtle">
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                      <TableCell className="text-on-surface-variant">{row.employeeName}</TableCell>
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{formatMonth(row.expenseMonth.toISOString().slice(0, 7))}</TableCell>
                      <TableCell className={`text-right font-data-tabular text-data-tabular ${EXPENSE_TEXT_CLASS}`}>{formatVnd(row.amount)}</TableCell>
                      <TableCell className="font-medium text-on-surface">{row.paidByAdminName}</TableCell>
                      <TableCell className="text-on-surface-variant">{row.note ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-stack-sm">
                          <EditAdExpenseDialog
                            adExpenseId={row.adExpenseId}
                            pageOptions={pageOptions}
                            adminOptions={adminOptions}
                            defaultValues={{
                              pageId: row.pageId,
                              expenseMonth: row.expenseMonth.toISOString().slice(0, 7),
                              amount: row.amount.toString(),
                              note: row.note ?? "",
                              paidByAdminId: row.paidByAdminId,
                            }}
                          />
                          <DeleteAdExpenseButton adExpenseId={row.adExpenseId} pageId={pageId} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="assignment" className="pt-stack-md">
          {history.length === 0 ? (
            <EmptyState icon={History} title="Chưa có lịch sử gán" description="Lịch sử PageAssignment (nhân viên phụ trách theo thời gian) sẽ hiển thị tại đây." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-ice hover:bg-surface-ice">
                    <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Nhân viên</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Từ ngày</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Đến ngày</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((entry, index) => (
                    <TableRow key={entry.id} className="border-border-subtle">
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                      <TableCell className="font-medium text-on-surface">{entry.employeeName}</TableCell>
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{formatDate(entry.startedAt)}</TableCell>
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">
                        {entry.endedAt ? formatDate(entry.endedAt) : "Hiện tại"}
                      </TableCell>
                      <TableCell className="text-on-surface-variant">{entry.note ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="audit" className="pt-stack-md">
          <EmptyState icon={ScrollText} title="Chưa có lịch sử thao tác" description="Audit Log liên quan tới Page này sẽ hiển thị tại đây." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-container-lowest p-card-padding">
      <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">{label}</p>
      <p className={cn("mt-stack-sm font-headline-sm text-headline-sm", tone ?? "text-on-surface")}>{value}</p>
    </div>
  );
}
