# Finance & Revenue Dashboard — Product & Technical Specification

## 1. Mục tiêu sản phẩm

Xây dựng một web dashboard nội bộ để quản lý:

- Nhân viên.
- Facebook Page.
- Doanh thu theo Page.
- Chi phí theo Page.
- Chi phí theo nhân viên.
- Chi phí chung của Admin.
- Tổng tiền Admin thực tế đã nhận.
- Tổng chi phí và lợi nhuận toàn hệ thống.
- Lịch sử gán Page cho nhân viên.
- Lịch sử thao tác của Admin và AI/MCP.
- MCP Server để Claude Code hoặc AI agent có thể đọc và thực hiện CRUD với quyền tương đương Admin.

Quy mô dự kiến:

- 2 Admin.
- Khoảng 8 nhân viên.
- Khoảng 100 Facebook Page.
- Khoảng 1.000 giao dịch/tháng.
- Dùng nội bộ, ưu tiên đơn giản, rõ ràng, nhanh và dễ mở rộng.

Tiền tệ mặc định: **VND**.

---

# 2. Vai trò và phân quyền

Hệ thống chỉ có 2 role:

## 2.1 Admin

Admin có toàn quyền:

- Xem toàn bộ dữ liệu.
- Xem toàn bộ nhân viên.
- Thêm/sửa/xóa nhân viên.
- Xem toàn bộ Page.
- Thêm/sửa/xóa Page.
- Gán/chuyển Page giữa các nhân viên.
- Thêm/sửa/xóa doanh thu.
- Thêm/sửa/xóa Ads.
- Quản lý lương nhân viên.
- Quản lý chi phí chung.
- Quản lý tiền Admin đã nhận.
- Quản lý tiền nhân viên đã nhận (mục để xem, không cộng vào Employee Cost/Revenue — xem mục 20a).
- Xem Dashboard tổng.
- Xem Audit Log.
- Quản lý tài khoản User.
- Quản lý MCP/API key.

Hai Admin **quản lý chung toàn bộ nhân viên và dữ liệu**, không chia dữ liệu theo Admin.

## 2.2 User

User chỉ được:

- Đăng nhập.
- Xem Dashboard cá nhân.
- Xem thông tin cá nhân.
- Xem các Page hiện đang phụ trách.
- Xem lịch sử Page từng phụ trách.
- Xem doanh thu của bản thân.
- Xem chi phí được tính cho bản thân.
- Xem Ads của các Page được tính cho bản thân.
- Xem lương hiện hành của bản thân nếu Admin cho phép hiển thị.

User **không được**:

- Thêm dữ liệu.
- Sửa dữ liệu.
- Xóa dữ liệu.
- Xem dữ liệu của User khác.
- Xem Admin Cashflow.
- Xem tổng tài chính toàn công ty.
- Sử dụng MCP Admin.

---

# 3. Nguyên tắc nghiệp vụ quan trọng

## 3.1 Page là đơn vị trung tâm

Doanh thu và Ads được nhập theo Page.

Mỗi Page tại một thời điểm chỉ có tối đa một nhân viên phụ trách.

Hệ thống phải có **lịch sử gán Page theo thời gian**.

Ví dụ:

- 01/01/2026 → 15/05/2026: Page A thuộc User A.
- Từ 16/05/2026: Page A thuộc User B.

Dữ liệu phát sinh trong khoảng thời gian Page thuộc User A vẫn phải được tính cho User A.

Khi Page chuyển sang User B, dữ liệu lịch sử **không được cập nhật ngược** sang User B.

---

# 4. Quy tắc ghi nhận doanh thu

> **Cập nhật (theo yêu cầu user 2026-08-18, xác nhận qua `AskUserQuestion`):** Doanh thu tính **theo tháng**, không theo ngày cụ thể như mô tả gốc bên dưới — cùng cơ chế đã áp dụng cho Ads (mục 6). `context/schema.md` (entity Revenue + Changelog) và migration `20260818070000_revenue_monthly` đã đồng bộ theo thay đổi này.

## 4.1 Cách nhập

Admin nhập doanh thu theo:

- Page.
- Tháng ghi nhận (không phải ngày cụ thể — Admin chọn tháng qua input kiểu `month`, vd `2026-08`).
- Số tiền.
- Ghi chú tùy chọn.

Không cần nhập nhân viên thủ công.

> **Cập nhật:** Mỗi Page chỉ có **đúng một record Doanh thu đang hoạt động cho mỗi tháng** (ràng buộc DB: unique `(page_id, revenue_month)` khi `deleted_at IS NULL`). Nhập lại cho Page + tháng đã có sẽ **ghi đè số tiền/ghi chú** của record đó (log `AuditLog action=UPDATE`), không tạo thêm dòng thứ hai — giống hệt Ads.

Backend phải tự xác định nhân viên phụ trách Page tại **ngày 1 của tháng ghi nhận** (không phải ngày Admin nhập).

> **Cập nhật:** Nếu Page bị chuyển giao (transfer) **giữa tháng**, toàn bộ doanh thu của tháng đó vẫn tính cho nhân viên phụ trách **vào đầu tháng** (ngày 1) — không tách theo ngày transfer, không chặn việc nhập doanh thu cho tháng có transfer.

## 4.2 Snapshot ownership

Mỗi record doanh thu phải lưu:

- `page_id`
- `employee_id_snapshot`
- `assignment_id_snapshot`
- `revenue_month` (đã cập nhật từ `revenue_date` — xem đầu mục này)
- `amount`

`employee_id_snapshot` là nhân viên đang phụ trách Page tại thời điểm doanh thu phát sinh.

Sau khi record đã tạo, nếu Page đổi nhân viên thì record cũ **không thay đổi owner**.

## 4.3 Ví dụ

Page A:

- Tháng 01 thuộc Nguyễn Văn A.
- Tháng 02 chuyển cho Trần Văn B.

Doanh thu tháng 01 = 20.000.000 VND.

Doanh thu tháng 02 = 30.000.000 VND.

Kết quả:

- Nguyễn Văn A: +20.000.000 doanh thu.
- Trần Văn B: +30.000.000 doanh thu.

---

# 5. Quy tắc chi phí mua Page

Khi Admin tạo Page có `purchase_price > 0` và gán Page cho một User:

Hệ thống phải tạo một record chi phí Page Purchase.

Chi phí này được tính cho **nhân viên nhận Page tại thời điểm mua/gán ban đầu**.

Record phải lưu snapshot:

- Page.
- Nhân viên.
- Tháng mua.
- Giá mua.

Sau này nếu Page đổi sang nhân viên khác:

- Không chuyển chi phí mua Page sang người mới.
- Không tạo lại chi phí mua Page.
- Chi phí ban đầu vẫn thuộc người nhận Page ban đầu.

Ví dụ:

- Page A mua 5.000.000 VND.
- Ban đầu gán User A.
- Sau 2 tháng chuyển User B.

Kết quả:

- User A vẫn có chi phí Page Purchase = 5.000.000 VND.
- User B không bị tính 5.000.000 VND đó.

---

# 6. Quy tắc Ads

> **Cập nhật (Phase 6, xác nhận với user 2026-08-17):** Ads tính **theo tháng**, không theo ngày cụ thể như mô tả gốc bên dưới — xem 3 đoạn "Cập nhật" chèn trong mục này. `context/schema.md` (entity AdExpense + Changelog Phase 6) và migration `20260817140000_ads_expense_monthly` đã đồng bộ theo thay đổi này.

Ads được nhập **theo Page**, không nhập trực tiếp theo nhân viên.

Một Ads record gồm:

- Page.
- Tháng (không phải ngày cụ thể — Admin chọn tháng qua input kiểu `month`, vd `2026-02`).
- Số tiền.
- Ghi chú.

> **Cập nhật:** Mỗi Page chỉ có **đúng một record Ads đang hoạt động cho mỗi tháng** (ràng buộc DB: unique `(page_id, expense_month)` khi `deleted_at IS NULL`). Nhập lại cho Page + tháng đã có sẽ **ghi đè số tiền/ghi chú** của record đó (log `AuditLog action=UPDATE`), không tạo thêm dòng thứ hai.

Backend tự xác định nhân viên đang quản lý Page tại **ngày 1 của tháng phát sinh Ads** (không phải ngày Admin nhập).

> **Cập nhật:** Nếu Page bị chuyển giao (transfer) **giữa tháng**, toàn bộ chi phí Ads của tháng đó vẫn tính cho nhân viên phụ trách **vào đầu tháng** (ngày 1) — không tách theo ngày transfer, không chặn việc nhập Ads cho tháng có transfer.

Ads record phải lưu:

- `page_id`
- `employee_id_snapshot`
- `assignment_id_snapshot`
- `expense_month` (đã cập nhật từ `expense_date` — xem đầu mục này)
- `amount`

Nếu Page đổi nhân viên sau đó, Ads cũ vẫn thuộc nhân viên cũ.

---

# 7. Lương nhân viên

Lương là một chi phí cố định của nhân viên.

Admin nhập mức lương, không cần tạo một transaction lương thủ công mỗi tháng.

Đề xuất triển khai bằng **Salary History** thay vì chỉ một field duy nhất để giữ đúng lịch sử.

Ví dụ:

- Từ 01/01/2026: 10.000.000 VND/tháng.
- Từ 01/07/2026: 12.000.000 VND/tháng.

Dashboard tháng 06 dùng 10.000.000.

Dashboard tháng 07 dùng 12.000.000.

Admin chỉ cần sửa mức lương và ngày hiệu lực khi thay đổi.

Hệ thống tự tính lương tháng dựa trên mức lương có hiệu lực trong tháng.

Không cần tạo một row expense lương mới mỗi tháng.

---

# 8. Chi phí chung của Admin

Các chi phí không gắn với nhân viên/Page được quản lý trong Admin Expense.

Ví dụ:

- Tài nguyên.
- Tool.
- Server.
- Proxy.
- Account chung.
- Văn phòng.
- Chi phí khác.

Record gồm:

- Ngày.
- Danh mục.
- Số tiền.
- Admin nhập.
- Nội dung.
- Ghi chú.

Các khoản này tính vào `Total Expenses` của hệ thống nhưng không tính vào chi phí của một nhân viên cụ thể.

---

# 9. Tổng tiền Admin đã nhận

Đây là dữ liệu **tách riêng** với doanh thu Page.

Ví dụ:

- Tổng doanh thu Page tháng 08: 300.000.000 VND.
- Tiền thực tế Admin đã nhận: 250.000.000 VND.

Hai số này không được đồng nhất.

Admin Receipt gồm:

- Tháng nhận (`receipt_month` — đổi từ theo-ngày sang theo-tháng 2026-08-18 theo yêu cầu user, mirror Revenue/Ads; **không** giới hạn 1 khoản/tháng).
- Số tiền.
- Nguồn / mô tả.
- Admin nhập (`created_by_admin_id` — Admin đang gõ form).
- Admin nhận (`received_by_admin_id` — chọn 1 trong các Admin, có thể khác Admin nhập; thêm 2026-08-18 theo yêu cầu user).
- Ghi chú.

Có thể có nhiều khoản nhận trong một tháng.

---

# 10. Công thức tài chính

## 10.1 Doanh thu nhân viên

`Employee Revenue = Tổng Revenue records có employee_id_snapshot = employee`

## 10.2 Chi phí nhân viên

`Employee Cost = Page Purchase + Ads + Salary + Profit Settlement` (thành phần thứ 4 thêm 2026-08-19, xem Changelog ngay dưới)

Lợi nhuận nhân viên đang chạy = `Employee Revenue − Employee Cost` (dùng chung 1 công thức, không còn khái niệm "settled total" trừ riêng — xem Changelog).

**Cập nhật ngày 2026-08-19 (thêm "Lợi nhuận nhân viên", xác nhận qua `AskUserQuestion`):** ban đầu (khi mới thêm entity `EmployeeProfitSettlement`) settlement là **thuần bút toán nội bộ**, không cộng vào `Employee Cost` — công thức khi đó là `Employee Revenue − Employee Cost − Σ EmployeeProfitSettlement`, phục vụ riêng trang `/admin/profit-settlements`.

**Cập nhật lần 2, cùng ngày 2026-08-19 (ĐẢO NGƯỢC quyết định cô lập ở trên — user request "chi phí nhân viên thêm một số tiền đã chốt và đây, không có ngừoi chi, với loại là chốt lợi nhuận"):** `EmployeeProfitSettlement.amount` giờ **là** một thành phần thật của `Employee Cost` (công thức ở trên) — không còn trừ riêng ở tầng "lợi nhuận đang chạy" nữa, vì `totalCost` (`getEmployeeFinancials()`) đã tự bao gồm nó. Hệ quả: dòng "Bù chi phí" xuất hiện trong bảng "Chi tiết chi phí" của Employee Detail (mục 14.3) và `/user/costs` (mục 12), không có Page, không có "Người chi" (hiện `"—"` — số tiền hệ thống tự tính tại thời điểm chốt). **Vẫn giữ nguyên**: **không** cộng vào `Total Expenses`/`Profit` **hệ thống** (mục 10.3/10.5) — chỉ đảo phần Employee-Cost-level. Chi tiết đầy đủ: `context/schema.md` entity `EmployeeProfitSettlement`.

**Cập nhật (Phase 7, xác nhận với user 2026-08-17):** Salary không phải transaction mà chỉ là một rate (`SalaryHistory.monthly_salary` theo `effective_from`/`effective_to`), nên công thức trên có 2 chế độ tính tuỳ có lọc theo tháng hay không (hàm trung tâm `getEmployeeFinancials(employeeId, monthKey?)` trong `employee.service.ts`):

- **Có `monthKey` (theo tháng cụ thể)** — Ads/Page Purchase/Revenue chỉ tính record trong tháng đó; Salary = mức lương đang active vào **ngày 1 của tháng đó** (cùng convention "day-1 owner" đã dùng cho AdExpense — mục 6).
- **Không có `monthKey` (all-time — Employee List khi bỏ trống filter tháng, Employee Detail Summary/Costs, `/user/costs`, các field "Tổng..." ở `/user/dashboard`, và từ 2026-08-18 cả Dashboard chính khi chọn chế độ "Tất cả" — mục 11.1)** — Salary tính **cộng dồn theo lịch sử** (accrued): `Σ (monthly_salary × số tháng hiệu lực)` qua từng giai đoạn `SalaryHistory` của nhân viên đó; giai đoạn đang active (`effective_to = null`) cộng dồn tới hết tháng hiện tại. Đây là lựa chọn thay cho phương án đơn giản hơn "chỉ dùng mức lương hiện tại" — chọn accrued vì phản ánh đúng hơn tổng chi phí nhân viên đã phát sinh từ trước tới nay. Hàm `accruedSalaryCost()` triển khai công thức này được **export** từ `employee.service.ts` để `dashboard.service.ts` tái dùng cho tổng lương all-time toàn hệ thống (sum theo từng nhân viên rồi cộng dồn) — tránh viết lại cùng công thức ở 2 nơi.

## 10.3 Tổng chi phí hệ thống

`Total Expenses = Page Purchase + Ads + Salary + Admin Expenses`

## 10.4 Tổng tiền Admin đã nhận

`Total Received = Tổng Admin Receipts`

## 10.5 Lợi nhuận hệ thống

`Profit = Total Received - Total Expenses`

Lưu ý:

`Page Revenue` và `Admin Received` là hai số khác nhau.

**Cập nhật (Phase 11, đã implement — mục 10.3–10.5):** hàm trung tâm `getSystemFinancials(monthKey)` (`dashboard.service.ts`) tính cả 3 công thức trên trong một lần gọi, luôn scope theo một tháng cụ thể (không có chế độ all-time như Employee Cost ở mục 10.2 — xem mục 11.1). Salary trong `Total Expenses` ở đây là **tổng lương toàn hệ thống** (mọi nhân viên cộng lại), khác `Employee Cost` ở mục 10.2 vốn tính riêng cho một nhân viên — chi tiết cơ chế tính ở mục 37 "Salary".

---

# 11. Dashboard chính cho Admin

Phong cách giao diện: **tối giản kiểu Stripe**.

## 11.1 KPI Cards

Hiển thị:

1. Tổng tiền Admin đã nhận.
2. Tổng chi phí.
3. Tổng lợi nhuận.
4. Tổng lương.
5. Tổng Ads.
6. Tổng doanh thu Page.

Mỗi KPI áp dụng theo bộ lọc tháng đang chọn.

**Cập nhật (Phase 11, đã implement):** `server/services/dashboard.service.ts` — `getSystemFinancials(monthKey)` tính cả 6 KPI cùng lúc theo công thức mục 10.3–10.5. Khác `MonthFilter` dùng ở Employee/Revenue/Ads List (mục 13/14.1, bỏ trống = all-time), Dashboard **luôn có một tháng đang chọn**, không có trạng thái "không lọc" — diễn giải trực tiếp từ "Mỗi KPI áp dụng theo bộ lọc tháng đang chọn" ở trên. Component `DashboardMonthPicker` (không phải `MonthFilter`, không có nút "Xoá lọc") mặc định `currentMonthKey()` khi URL không có `?month=` hoặc giá trị không hợp lệ. Card "Tổng tiền Admin đã nhận" có thêm dòng phụ hiển thị Tổng doanh thu Page cùng tháng, để dễ đối chiếu 2 con số tách biệt (mục 9).

**Cập nhật ngày 2026-08-18 (theo yêu cầu user "muốn báo cáo all"): thêm chế độ all-time cho Dashboard — đảo lại quyết định "luôn có một tháng đang chọn, không có trạng thái không lọc" ở đoạn ngay trên.** `getSystemFinancials(monthKey?)` giờ nhận `monthKey` optional — bỏ trống = tổng tất cả thời gian, không range theo tháng nào. Với `Total Received`/`Total Page Revenue`/`Ads`/`Page Purchase`/`Admin Expenses` chỉ đơn giản bỏ điều kiện lọc tháng khi aggregate. Riêng **Salary** ở chế độ all-time đổi hẳn công thức — không còn "lấy rate mới nhất tại 1 tháng" (`systemSalaryCostForMonth`) mà chuyển sang **luỹ kế theo lịch sử** (`systemSalaryCostAllTime`, hàm mới trong `dashboard.service.ts`), tái dùng nguyên `accruedSalaryCost()` đã có sẵn ở `employee.service.ts` cho chế độ all-time của `getEmployeeFinancials` (mục 10.2) — hàm này được **export** ra khỏi `employee.service.ts` (trước đó là hàm nội bộ) để dùng chung, tránh duplicate business logic (CLAUDE.md "Service Layer dùng chung"), sum theo từng nhân viên rồi cộng dồn toàn hệ thống. `getDashboardEmployeeRows(monthKey?)` cũng đổi `monthKey` thành optional, chỉ việc truyền thẳng `undefined` xuống `getEmployeeFinancials()` (all-time mode của hàm đó đã có sẵn từ Phase 7, không cần sửa gì thêm). `getAdminSpendingBreakdown(monthKey?)` (mục 11.1 "Cập nhật bổ sung sau Phase 13") **không cần sửa** — đã hỗ trợ `monthKey` optional/all-time từ trước. **UI:** `DashboardMonthPicker` thêm nút "Tất cả" (chuyển sang all-time, set `?month=all` — sentinel riêng, phân biệt với việc bỏ hẳn `?month` trên URL vẫn mặc định về tháng hiện tại như cũ) và nút "Chọn tháng" khi đang ở chế độ all-time (quay lại `currentMonthKey()`). Tiêu đề trang đổi `Kỳ báo cáo ${month ? formatMonth(month) : "Tất cả thời gian"}`. Biểu đồ (`getSystemMonthlySeries`, mục 11.2) và Lịch sử thao tác (`getRecentActivity`, mục 11.4) **không đổi** — vốn đã độc lập với bộ lọc tháng của KPI Cards từ Phase 11. Xem `context/plan.md`.

**Cập nhật ngày 2026-08-19 (theo yêu cầu user "bỏ setting theo dõi từng tháng đi, luôn theo dõi all"): bỏ hẳn month-picker/chế độ theo-tháng khỏi Dashboard — đảo lại toàn bộ mục Changelog ngay trên, giờ chỉ còn duy nhất all-time.** `AdminDashboardPage` bỏ hẳn `searchParams`/`?month=` — gọi thẳng `getSystemFinancials()`/`getAdminSpendingBreakdown()` không tham số (luôn all-time, không còn nhánh theo tháng nào ở tầng UI). Xoá hẳn component `DashboardMonthPicker` (không còn nơi nào dùng). Tiêu đề trang cố định `"Kỳ báo cáo Tất cả thời gian"`, không còn động theo filter. **Không đổi** `getSystemFinancials(monthKey?)`/`getAdminSpendingBreakdown(monthKey?)` ở tầng service — `monthKey` vẫn optional (dùng nội bộ bởi `getSystemMonthlySeries` cho biểu đồ 6 tháng, mục 11.2), chỉ tầng UI Dashboard chính không truyền tham số đó nữa.

**Cập nhật ngày 2026-08-19, sau đó cùng ngày (user request "thêm cho tôi filter theo tháng nữa"): thêm lại month filter — đảo ngược mục Changelog ngay trên, nhưng KHÔNG khôi phục `DashboardMonthPicker` cũ.** Lần này tái dùng thẳng component `MonthFilter` chuẩn (đã dùng ở Employees/Revenue/Ads — bỏ trống = all-time, có nút "Xoá lọc"), thay vì bespoke component cũ từng bắt buộc luôn chọn 1 tháng. `AdminDashboardPage` nhận lại `searchParams.month`, truyền thẳng vào `getSystemFinancials(params.month)`/`getAdminSpendingBreakdown(params.month)` (2 hàm service không đổi gì — `monthKey` vẫn optional từ trước, chỉ tầng UI Dashboard gọi lại với tham số). Tiêu đề trang lại động theo filter: `Kỳ báo cáo ${params.month ? formatMonth(params.month) : "Tất cả thời gian"}`. Biểu đồ 6 tháng (`getSystemMonthlySeries`, mục 11.2) và Lịch sử thao tác (`getRecentActivity`, mục 11.4) vẫn độc lập với filter này như mọi khi. Xem `context/plan.md`.

**Cập nhật (bổ sung sau Phase 13, theo yêu cầu user): quy tắc màu chữ cho mọi số tiền trong toàn app — chi phí = đỏ, doanh thu/tiền nhận = xanh, lợi nhuận = xanh nếu ≥0 / đỏ nếu âm (theo dấu thực tế).** Áp dụng cho cả 6 KPI Card ở đây (`tone="revenue"|"expense"|"profit"` trên `KpiCard`) lẫn mọi bảng/số tiền khác trong app (mục 40 "UI Style" có chi tiết đầy đủ + helper `lib/money.ts`).

**Cập nhật (bổ sung sau Phase 13): thêm bảng "Chi phí theo người chi" dưới bảng nhân viên (mục 11.3)** — `getAdminSpendingBreakdown(monthKey?)` (`dashboard.service.ts`) sum `AdExpense`/`PagePurchaseExpense`/`AdminExpense.amount` group theo `paid_by_admin_id`, theo cùng bộ lọc tháng với KPI Cards. Cột: Admin, Ads, Mua Page, Chi phí chung, Tổng đã chi (toàn bộ tô màu đỏ — đều là chi phí). **Không gồm Lương** — dù `SalaryHistory` cũng có `paid_by_admin_id` (xem mục 14.3), lương là một rate luỹ kế theo thời gian chứ không phải transaction rời rạc như 3 loại kia nên chưa đưa vào tổng hợp này. Đây là tầng hiển thị của field `paid_by_admin_id` mới thêm vào `AdExpense`/`PagePurchaseExpense`/`AdminExpense` — xem `context/schema.md` Changelog và mục 35 "Service Layer".

**Cập nhật ngày 2026-08-18 (theo yêu cầu user "phần chi phí theo người chi thêm mục tiền đã nhận"): thêm cột "Tiền đã nhận" vào bảng này, đổi tên bảng thành "Chi phí & Tiền đã nhận theo Admin".** `AdminSpendingRow` thêm field `receivedAmount: bigint` — sum `AdminReceipt.amount` group theo `received_by_admin_id` (field thêm ngày 2026-08-18, xem `context/schema.md` Changelog), cùng bộ lọc tháng/all-time với 3 loại chi phí kia. Cột mới đặt ngay sau "Admin", tô màu xanh (`REVENUE_TEXT_CLASS`) để phân biệt trực quan với 4 cột chi phí còn lại (đỏ) — nhất quán quy tắc màu chữ tiền tệ toàn app (mục 40). **Không netting** — `receivedAmount` là field độc lập, `total`/"Tổng đã chi" giữ nguyên nghĩa "tổng chi phí" như trước, không trừ đi tiền đã nhận (khác với `Profit` ở KPI Card, vốn đã là hiệu số Received − Expenses ở cấp hệ thống, mục 10.5). Xem `context/schema.md` Changelog.

**Cập nhật tiếp ngay sau đó cùng ngày (theo yêu cầu user "bỏ phần ads, mua page, tài nguyên ở bảng này đi, thay vào đó là cột lợi nhuận"): bỏ 3 cột Ads/Mua Page/Tài nguyên khỏi bảng, thay bằng cột "Lợi nhuận".** `AdminSpendingRow` thêm field `profit: bigint = receivedAmount - total` (per-Admin net, khác `Profit` ở KPI Card vốn là hiệu số ở cấp hệ thống — mục 10.5). Bảng "Chi phí & Tiền đã nhận theo Admin" giờ chỉ còn 4 cột: Admin, Tiền đã nhận (xanh), Tổng đã chi (đỏ), Lợi nhuận (`profitTextClass()` — xanh nếu ≥0, đỏ nếu âm, cùng rule màu tiền toàn app đã dùng cho KPI Card "Tổng lợi nhuận" và Employee Detail — mục 40). **3 field breakdown `adsCost`/`pagePurchaseCost`/`adminExpenseCost` vẫn giữ nguyên trên `AdminSpendingRow`** (không xoá khỏi service) — chỉ bớt hiển thị ở UI Dashboard, vì `total` vẫn cần cộng từ 3 field này, và Settings — User Accounts "Tổng đã chi" (mục 33) vẫn đọc `row.total` trực tiếp, không đụng tới 3 field breakdown nên không ảnh hưởng.

**Cập nhật tiếp ngay sau đó cùng ngày (theo yêu cầu user "Check lại xem admin đã chi lương mà không cộng vào tổng chi"): thêm Salary vào `total`/"Tổng đã chi" — đảo lại quyết định "Không gồm Lương" đã ghi ở mục Changelog "bổ sung sau Phase 13" phía trên (2026-08-17).** User phát hiện đúng: `SalaryHistory` đã có `paid_by_admin_id` từ trước (mục 6/19) nhưng `getAdminSpendingBreakdown` chưa từng cộng Salary vào `total` của Admin đã trả — khiến "Tổng đã chi" hiển thị thấp hơn thực tế mà Admin đó đã chi (vd Admin duy nhất trong hệ thống trả cả Ads/Mua Page/Tài nguyên/Lương nhưng "Tổng đã chi" lại nhỏ hơn hẳn "Tổng chi phí" hệ thống — đúng ra phải bằng nhau nếu chỉ có 1 Admin). Đã thêm field `salaryCost: bigint` vào `AdminSpendingRow`, cộng vào `total = adsCost + pagePurchaseCost + adminExpenseCost + salaryCost`. Cách tính salary theo `paid_by_admin_id` **khác** cách tính 3 loại chi phí kia (vốn chỉ cần `groupBy` đơn giản) — phải tôn trọng đúng 2 chế độ đã có ở `getSystemFinancials`/`getEmployeeFinancials` (mục 10.2/11.1): **(a) theo tháng cụ thể** — với mỗi nhân viên chỉ tính rate SalaryHistory mới nhất đang overlap tháng đó (đúng dedup rule đã có ở `systemSalaryCostForMonth`), rồi gán số tiền của đúng dòng đó cho `paid_by_admin_id` của **chính dòng đó** (nhân viên có thể đổi Admin trả lương giữa các lần đổi lương, dòng mới nhất thắng); **(b) all-time** — mỗi giai đoạn SalaryHistory tự đóng góp accrued cost của riêng nó (không cần dedup theo nhân viên vì các giai đoạn không chồng lấn thời gian), gán cho `paid_by_admin_id` của giai đoạn đó rồi cộng dồn theo Admin. Để tránh viết lại công thức accrual, đã tách `accruedSalaryCost()` (`employee.service.ts`) thành 2 hàm: `accruedRowCost(row)` (accrued cho **một** giai đoạn — logic tính tháng gốc) **export mới**, và `accruedSalaryCost(histories)` giờ chỉ là `Σ accruedRowCost` — hành vi không đổi, chỉ tách nhỏ để `dashboard.service.ts` tái dùng đúng 1 chỗ tính toán duy nhất cho cả tổng theo nhân viên (đã có) lẫn tổng theo Admin (mới). 2 hàm mới trong `dashboard.service.ts`: `salaryCostByAdminForMonth(range)` và `salaryCostByAdminAllTime()`, trả `Map<adminId, bigint>`, chạy song song (`Promise.all`) cùng 3 groupBy kia. **Hệ quả:** Settings — User Accounts "Tổng đã chi" (mục 33, đọc `row.total` trực tiếp) giờ cũng tự động gồm Salary — đúng ý nghĩa "tổng mọi thứ Admin này đã tự bỏ tiền ra", nhất quán với 3 loại kia thay vì âm thầm thiếu 1 loại.

**Cập nhật ngày 2026-08-18 (theo yêu cầu user "còn 1000000 chi phí là ở đâu", sau khi phát hiện `Tổng chi phí` không khớp tổng 3 KPI Card lẻ đang hiện): thêm KPI Card thứ 7 "Tổng chi phí mua Page".** Nguyên nhân: `Tổng chi phí = Ads + Lương + Chi phí mua Page + Tài nguyên` (mục 10.3) nhưng trước đó chỉ có card riêng cho Ads/Lương — Chi phí mua Page và Tài nguyên bị cộng vào tổng mà không có card nào hiện riêng, gây chênh lệch nhìn thấy được (vd 1.000.000 ₫ tiền mua Page tháng đó). Đã thêm card `financials.pagePurchaseCost` vào mảng `kpis` (7 card, không đổi service — field đã có sẵn từ `getSystemFinancials`).

**Cập nhật tiếp ngay sau đó cùng ngày (theo yêu cầu user "hiển thị biểu đồ tròn để visualization tổng ads, lương và chi phí mua page, hiển thị sao cho nó là tập con của tổng chi phí"): thay 3 KPI Card lẻ (Lương/Ads/Chi phí mua Page) bằng một donut chart "Cơ cấu chi phí" — CÓ đổi UI, không đổi schema/service.** 3 card lẻ nhìn ngang hàng với "Tổng chi phí" không truyền tải được quan hệ tập con/tập hợp — donut giải quyết trực tiếp: các lát Ads/Lương/Chi phí mua Page (+ "Khác" cho Tài nguyên, chỉ hiện khi > 0) cộng đúng bằng `Tổng chi phí` hiển thị ngay giữa vòng tròn, cùng legend liệt kê số tiền + % mỗi loại. Component mới `ExpenseBreakdownChart` (`src/components/dashboard/expense-breakdown-chart.tsx`, Recharts `PieChart`/`Pie` với `innerRadius` cho hiệu ứng donut). **Màu sắc:** `Finance Blue`/`Warning Orange`/`Amber` (token có sẵn) — bộ 3 màu duy nhất từ token hiện có vượt qua kiểm tra CVD all-pairs của dataviz skill (`node scripts/validate_palette.js "#0061ff,#c2410c,#ca8a04" --pairs all`, chạy trước khi code — CLAUDE.md "Luôn dùng Context7"-tinh thần tương tự cho design tooling), cố tình **không dùng** Success Green/Error Red dù cũng là token hợp lệ — 2 màu đó đã mang nghĩa cố định "doanh thu/chi phí" toàn app (`lib/money.ts`) nên dùng lại ở đây (chỉ là 1-trong-nhiều-loại-chi-phí, không phải dấu +/-) sẽ gây hiểu nhầm. "Khác" (Tài nguyên) dùng xám trung tính, không phải hue thứ 4 — donut là dạng biểu đồ all-pairs, bộ 3 màu đã validate đúng khớp 3 lát chính, quá 3 phải fold vào "Khác" thay vì thêm hue chưa validate. Ghi lại token combo này vào `.stitch/DESIGN.md` mục "Colors" ("Categorical Chart Triplet") để tái dùng cho biểu đồ phân loại 3 series tiếp theo, không tự chọn lại từ đầu. Xem `context/plan.md` Phase 11 "Cập nhật bổ sung".

## 11.2 Biểu đồ

### Monthly Revenue Chart

Hiển thị doanh thu từng tháng.

Có thể hiển thị:

- Page Revenue.
- Admin Received.
- Total Expenses.
- Profit.

Ưu tiên Line Chart hoặc Area Chart đơn giản.

**Cập nhật (Phase 11, đã implement):** `getSystemMonthlySeries(monthsBack=6)` — biểu đồ luôn là **6 tháng gần nhất tính đến tháng hiện tại**, độc lập hoàn toàn với bộ lọc tháng của KPI Cards (mục 11.1) — cùng nguyên tắc trailing-window đã dùng ở Employee Detail Monthly Chart (mục 14.3, `getEmployeeMonthlySeries`). "Có thể hiển thị: ..." implement bằng **legend dùng làm toggle** (`SystemFinancialsChart`, click vào chip để ẩn/hiện từng series) thay vì thêm control riêng — mặc định hiện Page Revenue + Total Expenses, ẩn Admin Received + Profit. Component tách riêng khỏi `MonthlyRevenueChart` (mục 14.3/12) vì component đó đã cố định shape 2-series (revenue/expenses) cho Employee Detail và `/user/dashboard`.

**Cập nhật ngày 2026-08-19 (theo yêu cầu user "biểu đồ với cơ cấu chi phí chia thành 3/5 và 2/5 đi"): hàng đầu tiên của Admin Dashboard ("Biểu đồ Doanh thu & Chi phí" + "Cơ cấu chi phí") đổi tỷ lệ từ 2/3–1/3 sang **3/5–2/5** — CÓ đổi UI, không đổi data/component.** `lg:grid-cols-3` + `lg:col-span-2` → `lg:grid-cols-5` + `lg:col-span-3` (biểu đồ đường)/`lg:col-span-2` (donut). **Chỉ áp dụng cho hàng biểu đồ đầu tiên của Admin Dashboard** — không đổi hàng "Chi phí & Tiền đã nhận theo Admin"/"Lịch sử thao tác" (vẫn 2/3–1/3, mục 11.4), không đổi `/user/dashboard`'s hàng "Doanh thu theo tháng"/"Cơ cấu chi phí" (mục 12, vẫn 2/3–1/3 — user không yêu cầu, 2 trang từ nay layout lệch nhau, câu "giống layout hàng biểu đồ của Admin Dashboard" ở mục 12 không còn đúng).

## 11.3 Bảng nhân viên

Columns:

- Tên.
- Email.
- Số Page đang quản lý.
- Doanh thu kỳ được chọn.
- Ads.
- Chi phí mua Page.
- Lương.
- Tổng chi phí.

Không hiển thị profit nhân viên.

Click row → Employee Detail.

**Cập nhật (Phase 11, đã implement):** `getDashboardEmployeeRows(monthKey)` — thêm cột **Trạng thái** ngoài danh sách cột gốc ở trên (nhất quán với Employee List, mục 14.1). Toàn bộ nhân viên (không phân trang, quy mô ~8 người — CLAUDE.md "ưu tiên đơn giản"), tái dùng `getEmployeeFinancials` per-row qua `Promise.all` giống `listEmployees` (mục 14.1). "Click row" thực tế là link trên tên nhân viên (không phải toàn bộ hàng), cùng convention đã dùng ở Employee List.

**Cập nhật ngày 2026-08-18 (theo yêu cầu user "không cần danh sách nhân viên"): đã xoá hẳn bảng này khỏi Dashboard chính.** Toàn bộ mục 11.3 ở trên giờ chỉ còn giá trị lịch sử — Dashboard đã đủ dữ liệu nhân viên ở trang Employee List riêng (mục 14.1) nên bảng lặp này không còn cần thiết. Đã xoá `getDashboardEmployeeRows()`/`DashboardEmployeeRow` khỏi `dashboard.service.ts` (không còn nơi nào khác dùng — xoá hẳn thay vì giữ dead code, CLAUDE.md "không giữ code không dùng"), xoá phần JSX + `employeeRows` khỏi `admin/dashboard/page.tsx`, xoá 3 test tương ứng trong `dashboard-service.test.ts`.

## 11.4 Recent Activity

Hiển thị:

- Revenue mới.
- Ads mới.
- Page mới.
- Page chuyển User.
- Admin Expense mới.
- Admin Receipt mới.

**Cập nhật (Phase 11, đã implement):** `getRecentActivity(limit=10)` — union trực tiếp `createdAt DESC` của 5 bảng (Revenue/AdExpense/Page/AdminExpense/AdminReceipt), merge + sort lại trong code. Riêng **"Page chuyển"** đọc từ `AuditLog` (`entityType=Page, action=TRANSFER`) thay vì `PageAssignment` trực tiếp — đây là tín hiệu duy nhất phân biệt sạch một lần transfer với lần gán nhân viên đầu tiên cho Page (`PageAssignment` không có field nào tự phân biệt 2 trường hợp, mục 15.4/15.4a); tên Page/nhân viên mới được resolve qua 2 query batch nhỏ sau khi lấy danh sách audit log.

**Cập nhật ngày 2026-08-19 (theo yêu cầu user "Lịch sử thao tác tách riêng thành 1 tab ở dưới bảng điều khiển"): tách khỏi Admin Dashboard, thành route riêng `/admin/activity` — CÓ đổi UI/route, không đổi schema/service.** Nav sidebar thêm mục "Lịch sử thao tác" ngay dưới "Bảng điều khiển" (mục 38, icon `Activity`). Trang mới `src/app/admin/activity/page.tsx` dùng lại nguyên `getRecentActivity`/component `RecentActivity` đã có — chỉ tăng `limit` từ 10 lên 30 (có cả trang riêng để hiện, không còn bó trong 1 card cạnh biểu đồ). `/admin/dashboard` bỏ hẳn card "Lịch sử thao tác" và fetch `getRecentActivity`; biểu đồ "Doanh thu & Chi phí" (mục 11.2) giờ chiếm full width một mình (trước đó chia 2/3 với card Recent Activity).

**Cập nhật ngày 2026-08-19, ngay sau đó cùng ngày (theo yêu cầu user "bỏ tab lịch sử thao tác đi, phần lịch sử thao tác ở bảng điều khiển thì phân trang"): đảo lại quyết định ngay trên — bỏ hẳn route `/admin/activity` + mục nav sidebar, gộp lại vào Admin Dashboard nhưng lần này CÓ phân trang thật (khác bản gốc trước đây chỉ cắt `limit` cứng).** `src/app/admin/activity/page.tsx` xoá hẳn (không phải archive); nav sidebar mất mục "Lịch sử thao tác" (mục 38 cập nhật theo). `getRecentActivity()` (`dashboard.service.ts`) đổi signature từ `(limit=10)` sang `(params: {page?, pageSize?}) => {items, total, page, pageSize}` — mặc định `pageSize=5`, tuỳ chọn `[5,10,20]` (`RECENT_ACTIVITY_PAGE_SIZE_OPTIONS`). Vì đây là union 6 nguồn (5 bảng + `AuditLog` cho transfer) không có sort key chung ở tầng DB, không thể `OFFSET`/`LIMIT` một query duy nhất — mỗi nguồn được query lấy `take: page*pageSize` dòng mới nhất (đủ để đảm bảo đúng kết quả toàn cục, kỹ thuật "top-K mỗi nguồn"), merge + sort lại trong code rồi cắt đúng cửa sổ trang cần; `total` là tổng `count()` riêng từng nguồn cộng lại. `/admin/dashboard`: card "Lịch sử thao tác" quay lại, đặt cùng hàng với "Chi phí & Tiền đã nhận theo Admin" (mục 11.1) theo tỷ lệ 2/3–1/3 (2/3 cho bảng Admin, 1/3 cho card này) — không còn cùng hàng với biểu đồ "Doanh thu & Chi phí" (mục 11.2) như thiết kế gốc nữa. Component `Pagination` dùng chung với mọi list page khác (mục 42), URL-sync qua `?page=&pageSize=` — Dashboard không có bộ lọc/phân trang nào khác nên không xung đột tên param. Xem `context/plan.md` Phase 16.1.

---

# 12. Dashboard User

User chỉ thấy dữ liệu cá nhân.

Hiển thị:

- Tên.
- Email.
- Tổng Page đang quản lý.
- Doanh thu kỳ hiện tại.
- Tổng Ads.
- Chi phí Page Purchase.
- Lương.
- Tổng chi phí.
- Biểu đồ doanh thu theo tháng.
- Danh sách Page.
- Lịch sử Page từng phụ trách.

Không hiển thị:

- Admin Received.
- Profit công ty.
- Chi phí chung.
- Dữ liệu nhân viên khác.

**Cập nhật (Phase 7, đã implement `/user/dashboard`):** field wording ở trên phân biệt 2 loại số — "Doanh thu **kỳ hiện tại**" scoped theo tháng hiện tại (`getEmployeeFinancials(employeeId, currentMonthKey())`), còn "**Tổng** Ads"/"**Tổng** chi phí mua Page"/"**Tổng** chi phí" là all-time/luỹ kế (`getEmployeeFinancials(employeeId)` không tham số — xem công thức Salary accrued ở mục 10.2). `employeeId` luôn tự resolve từ session (`requireUser()` + `getEmployeeDetailByUserId`), không nhận từ query param. "Danh sách Page" và "Lịch sử Page từng phụ trách" dùng chung một bảng (`getEmployeeAssignmentHistory`) — xem mục 14.3.

**Cập nhật ngày 2026-08-18 (theo yêu cầu user "hiển thị table page như trang admin, nhưng chỉ có thể edit được trạng thái thôi"): `/user/pages` đổi hẳn từ bảng lịch sử phụ trách sang bảng giống `/admin/pages` (mục 15.1), scoped theo nhân viên đang đăng nhập — CÓ đổi UI/service, không đổi schema.** Xác nhận qua `AskUserQuestion`: **bỏ hẳn** phần lịch sử (cột "Từ ngày"/"Đến ngày", `getEmployeeAssignmentHistory`) — trang giờ chỉ liệt kê Page nhân viên đang **hiện tại** phụ trách, không còn xem được Page đã từng phụ trách trước đây qua route này (khác User Dashboard, mục 12 phía trên — hai nơi từng dùng chung 1 bảng lịch sử, giờ tách riêng: `/user/pages` đổi hẳn, User Dashboard's "Page hiện tại"/"Lịch sử" chưa đổi). Cột giống `/admin/pages`: Tên Page, Link (mở tab mới), Giá mua, Tháng mua, Trạng thái (`PageStatusChipList`), Thao tác — bỏ cột "Nhân viên phụ trách" (luôn là chính nhân viên đó, thừa thông tin) và bỏ hẳn nút Xoá (User không có quyền xoá Page). **Cột Thao tác chỉ có "Sửa trạng thái"** — dialog mới `EditPageStatusDialog` chỉ có field Trạng thái (tái dùng nguyên `PageStatusPicker`), không cho sửa Tên/URL/Ghi chú (vẫn Admin-only qua `EditPageDialog`/`updatePageAction`). Service layer mới: `listPagesByEmployee(employeeId)` (`page.service.ts`) — mirror `listPages` nhưng filter `assignments: { some: { employeeId, endedAt: null } } }`, không phân trang (quy mô nhỏ/nhân viên); `updatePageStatusByEmployee(pageId, employeeId, input, actorUserId, meta)` — **RBAC boundary nằm ở tầng Service**: reject với `PageError` code `FORBIDDEN` nếu nhân viên không có `PageAssignment` đang active trên đúng Page đó (không tin `employeeId` client gửi lên — luôn resolve từ session qua Server Action `updatePageStatusAction`, giống pattern `requireUser()` + `getEmployeeDetailByUserId` đã dùng cho `/user/pages` cũ). Validator mới `UpdatePageStatusSchema`/`UpdatePageStatusClientSchema` (`page.schema.ts`) tái dùng `statusIdsSchema`/`statusIdsInputSchema` đã export sẵn (trước đó là biến nội bộ). Xem `context/plan.md`.

**Cập nhật tiếp ngay sau đó cùng ngày (theo yêu cầu user "Cả mục doanh thu và chi phí của user, tôi cần bảng theo dõi như bên admin"): `/user/revenue` thêm Search; `/user/costs` thêm hẳn bảng "Chi tiết chi phí" (trước đó chỉ có 4 KPI Card, không có bảng nào) — CÓ đổi UI, không đổi schema, không đổi quyền ghi (2 trang này vẫn read-only cho User).** `/user/revenue`: thêm `SearchInput` ("Tìm theo tên Page hoặc ghi chú...") cạnh `MonthFilter` đã có — `listRevenue()` đã sẵn hỗ trợ `search` cùng lúc với `employeeId` nên chỉ cần truyền `params.q` qua, không đổi service. **Không thêm cột Thao tác (Sửa/Xoá)** — khác `/user/pages` (mục vừa trên, User được sửa Trạng thái), Revenue vẫn hoàn toàn Admin-managed (nhân viên phụ trách tự resolve, không cho chọn thủ công — mục 17), "bảng theo dõi" ở đây hiểu là tra cứu/tìm kiếm phong phú hơn, không phải thêm quyền chỉnh sửa. `/user/costs`: trước đó chỉ có 4 `KpiCard` (Ads/Mua Page/Lương/Tổng chi phí), không có bảng chi tiết nào — giờ thêm nguyên bảng "Chi tiết chi phí" **y hệt** bảng đã xây cho tab "Chi phí" ở Admin Employee Detail (mục 14.3, user request "phân chi phí thêm bảng chi tiết"/"gộp bảng vào"/"lương cũng thêm vào phần chi tiết chi phí") — cùng `CostDetailRow` shape, cùng logic merge Ads + Mua Page (`listPagePurchaseExpensesByEmployee`) + Lương (`getSalaryHistory`, mỗi giai đoạn 1 dòng, không phải luỹ kế) rồi sort theo `sortDate` giảm dần, cùng cột (Page/Loại/Tháng/Số tiền/Người chi/Ghi chú). Khác bản Admin: bỏ cột Link (`/admin/pages/[id]` không truy cập được từ User), Page hiển thị plain text; Ads fetch `pageSize: 100` (không cắt 20 dòng + link "Xem toàn bộ" như Admin, vì User không có route `/user/ads` riêng để trỏ tới — quy mô nhỏ/nhân viên nên 100 luôn đủ). Cột "Người chi" (`paidByAdminName`) **vẫn hiển thị cho User** — đã cân nhắc theo CLAUDE.md "User chỉ xem dữ liệu của chính mình" nhưng đây là danh tính Admin gắn trên chính chi phí của nhân viên đó (không phải "Admin Received"/"Profit công ty"/"dữ liệu nhân viên khác" — 3 thứ bị cấm rõ ràng), nên không vi phạm.

**Cập nhật ngày 2026-08-18 (theo yêu cầu user "user có quyền tự thêm page hệ thống vào account do mình quản lý"): `/user/pages` thêm nút "Thêm Page hệ thống" → route mới `/user/pages/new` — CÓ đổi quyền ghi cho User lần đầu tiên trên entity `Page` (trước đó User chỉ sửa được Trạng thái, mục ngay trên).** Xác nhận qua `AskUserQuestion` (cùng 3 câu hỏi với mục 15.2 ở trên): chỉ tạo được **Page hệ thống** (`pageType=SYSTEM`, không có giá mua/Người chi — Page BKT vẫn Admin-only); Page tạo ra **tự động gán ngay cho chính User đó** trong cùng transaction (không qua bước chờ Admin duyệt/gán như flow Admin tạo Page không chọn Assign Employee). Form chỉ có Tên Page/Facebook URL/Trạng thái/Ghi chú — không có Giá mua/Tháng mua/Người chi/chọn nhân viên (luôn là chính mình). Service layer mới `createSystemPageForSelf(input, employeeId, userId, meta)` (`page.service.ts`) — tạo Page (`pageType=SYSTEM`, `purchasePrice=0`, `purchaseMonth`=tháng hiện tại, không hỏi) + `PageAssignment` đầu tiên (employee=chính mình, `startedAt`=tháng hiện tại) trong 1 transaction, không bao giờ tạo `PagePurchaseExpense`; ghi Audit Log `CREATE Page` với `actorUserId` = chính User đó (không phải Admin) — `created_by_admin_id`/`assigned_by_admin_id` là FK→User thuần (không ràng buộc `role=ADMIN` ở tầng DB, xem `context/schema.md`), nên lưu thẳng id của User tự thao tác, không cần một Admin "đứng tên hộ". `employeeId`/`userId` luôn resolve từ session qua `requireUser()` + `getEmployeeDetailByUserId` (không tin tham số client), cùng pattern RBAC đã dùng cho `updatePageStatusAction`. Action mới `createSystemPageForSelfAction` (`page.actions.ts`), validator mới `CreateSystemPageSelfSchema`/`CreateSystemPageSelfClientSchema` (`page.schema.ts`). UI: `/admin/pages`, `/admin/pages/[pageId]`, `/user/pages` đều thêm chip `PageTypeChip` ("Hệ thống"/"BKT") để phân biệt trực quan 2 loại.

**Cập nhật tiếp ngay sau đó cùng ngày (theo yêu cầu user "cũng có filter như thế" — sau khi thêm filter cho `/admin/pages`, mục 15.1): `/user/pages` thêm Search + 2 filter (Loại Page/Trạng thái) — không có filter "Nhân viên phụ trách" vì trang này đã scoped theo chính người đăng nhập.** `listPagesByEmployee()` (`page.service.ts`) nhận thêm tham số filter thứ 2 (optional, không phá vỡ lời gọi cũ), mirror đúng 3 điều kiện `search`/`pageType`/`statusId` đã thêm ở `listPages()`. UI dùng lại nguyên `PageFilters` — component này đổi `employeeOptions` thành optional để tái dùng được cho cả 2 trang (Admin truyền đủ 3 dropdown, User chỉ truyền `statusOptions` nên chỉ hiện 2 dropdown).

**Cập nhật ngày 2026-08-18 (theo yêu cầu user "Vì sao khi tôi sửa lương, lại hiển thị 2 loại lương, chỉ hiển thị lương mới nhất thôi, và để 1 tháng thay vì từ tháng này đến tháng kia"): dòng "Lương" trong bảng "Chi tiết chi phí" (cả Admin Employee Detail lẫn `/user/costs`) đổi từ hiện MỌI giai đoạn `SalaryHistory` sang chỉ hiện ĐÚNG MỘT dòng — mức lương đang hiệu lực — CÓ đảo lại quyết định đã ghi ở mục ngay trên ("mỗi giai đoạn 1 dòng, không phải luỹ kế").** Nguyên nhân user thấy 2 dòng: `SetSalaryDialog` (Đổi lương) không sửa đè `SalaryHistory` hiện có — nó tạo record mới + đóng `effective_to` của record cũ (đúng thiết kế append-only ở mục 44), nên "Chi tiết chi phí" (trước đó liệt kê toàn bộ lịch sử) hiện cả 2: dòng cũ vừa đóng (label `Tháng 08/2026 – Tháng 08/2026` khi đổi lương trong cùng tháng) và dòng mới đang hiệu lực (`Tháng 08/2026 – hiện tại`). Không đổi `SalaryHistory`/schema — vẫn giữ append-only đầy đủ lịch sử trong DB (dùng cho `accruedSalaryCost`/`Lương (luỹ kế)` ở KPI card, mục 10.2, **không đổi**), chỉ đổi tầng hiển thị của riêng bảng "Chi tiết chi phí": lọc còn đúng 1 record `effectiveTo === null` (không hiện giai đoạn đã đóng), label tháng đổi từ range `formatSalaryPeriod()` (đã xoá hàm này) sang một tháng duy nhất `formatMonth(effectiveFrom)`. Sửa ở cả 2 nơi (không có service dùng chung — logic merge row nằm inline ở từng page): `src/app/admin/employees/[employeeId]/page.tsx` và `src/app/user/costs/page.tsx`. Xem `context/schema.md` — không có thay đổi schema cho mục này.

**Cập nhật ngày 2026-08-19 (đồng bộ theo mã nguồn thật, gộp nhiều yêu cầu user trong cùng phiên — xem `context/plan.md` Phase 16.1): `/user/dashboard` hiện tại khác đáng kể so với mô tả "Hiển thị" gốc ở đầu mục 12 — mục đó giờ chỉ còn giá trị lịch sử.** Thực tế hiện có:
- **Không còn** "Danh sách Page"/"Lịch sử Page từng phụ trách" trên Dashboard — hai mục này đã thuộc hẳn về `/user/pages` riêng từ lâu (mục 12 "Cập nhật ngày 2026-08-18... /user/pages đổi hẳn..." ở trên), câu "dùng chung một bảng `getEmployeeAssignmentHistory`" ở đoạn "Cập nhật (Phase 7)" phía trên không còn đúng — Dashboard hiện không fetch/hiển thị Page nào cả.
- **KPI Card** rút còn 3 (thay vì 6 ở bản gốc): "Page đang quản lý", "Doanh thu hiện tại" (theo tháng, không đổi), và **"Lợi nhuận"** mới (thay cho card "Lương" gốc không còn đứng riêng) — 4 card gốc "Tổng Ads"/"Chi phí Page Purchase"/"Lương"/"Tổng chi phí" bị bỏ hẳn (user request "bỏ những tab đã được dùng ở biểu đồ đi") vì trùng dữ liệu với donut mới ngay dưới.
- **Thêm donut "Cơ cấu chi phí"** (user request "cũng làm biểu đồ tròn giống admin") — tái dùng nguyên `ExpenseBreakdownChart`/bảng màu đã validate ở mục 11.1, chỉ còn 3 lát Ads/Lương/Mua Page (không có "Khác"/Tài nguyên — đó là chi phí hệ thống do Admin quản lý, không gắn một nhân viên cụ thể). Đặt cùng hàng với "Doanh thu theo tháng" theo tỷ lệ 2/3–1/3 (giữ nguyên tỷ lệ này — khác Admin Dashboard đã đổi sang 3/5–2/5 cho hàng tương tự, xem mục 11.2 Changelog 2026-08-19, không áp dụng cho trang này vì user không yêu cầu).
- **"Lợi nhuận"** = `revenue - totalCost`, tính **all-time** (`getEmployeeFinancials(employeeId)` không tham số) — **không** theo tháng hiện tại như "Doanh thu hiện tại" cạnh nó. Ban đầu implement theo tháng hiện tại cho đồng bộ với "Doanh thu hiện tại", nhưng user phát hiện lệch số với "Lợi nhuận" bên Admin Employee Detail (mục 14.3, cũng tính all-time) — nguyên nhân 2 công thức Salary khác nhau theo scope tháng (`salaryForMonth`, chỉ 1 mức lương tại tháng đó) vs all-time (`accruedSalaryCost`, cộng dồn mọi giai đoạn lương) cho ra số khác nhau nếu nhân viên từng đổi lương (mục 10.2). Đã đổi lại sang all-time để 2 trang luôn khớp số cho cùng một nhân viên. `tone="profit"` (mục 40) — âm đỏ, ≥0 xanh.
- Biểu đồ đường "Doanh thu & Chi phí" (mục 11.2, `SystemFinancialsChart`) — line "Admin đã nhận" đổi màu từ nâu (`#715b34`) sang vàng, dùng token `amber-tag` (`#CA8A04`) có sẵn trong `.stitch/DESIGN.md`.
- Thêm tab điều hướng mới **"Tiền đã nhận"** (`/user/employee-receipts`, mục 39) — xem mục 20a.

**Cập nhật ngày 2026-08-19 (theo yêu cầu user "chi phí nhân viên thêm một số tiền đã chốt và đây, không có ngừoi chi, với loại là chốt lợi nhuận" — xem mục 10.2 Changelog "đảo ngược lần 2"): `EmployeeProfitSettlement` trở thành một thành phần thật của `Employee Cost`, ảnh hưởng cả `/user/costs` lẫn `/user/dashboard`.** `/user/costs`: 4 `KpiCard` (Ads/Mua Page/Lương/Tổng chi phí) mô tả ở mục "Cập nhật tiếp ngay sau đó cùng ngày" (2026-08-18) phía trên giờ thành **5 card** — thêm "Bù chi phí" (`financials.profitSettlementCost`) trước "Tổng chi phí"; bảng "Chi tiết chi phí" thêm dòng loại "Bù chi phí" cho mỗi `EmployeeProfitSettlement` active (`listProfitSettlements`), Page = `"—"`, Người chi = `"—"`. `/user/dashboard`: donut "Cơ cấu chi phí" ở gạch đầu dòng phía trên ("chỉ còn 3 lát Ads/Lương/Mua Page") không còn đúng — thêm **lát thứ 4 "Bù chi phí"**, màu `#027A48` (tái dùng màu "Tài nguyên" của Admin Dashboard). Bắt buộc thêm lát này vì `total` truyền vào `ExpenseBreakdownChart` dùng `allTimeFinancials.totalCost` (đã bao gồm `profitSettlementCost`) — thiếu lát thứ 4 sẽ tái diễn đúng bug "tổng không khớp tổng lát" đã sửa cho Admin Dashboard (mục 11.1). "Lợi nhuận" KPI Card (gạch đầu dòng ngay trên) tự động đúng, không cần sửa riêng.

---

# 13. Bộ lọc

Các màn hình tài chính hỗ trợ:

- Theo tháng.
- Theo nhân viên.
- Theo Page.
- Theo loại chi.
- Theo Admin đã nhập.

Không yêu cầu Export Excel/CSV ở phiên bản đầu.

URL nên đồng bộ filter.

Ví dụ:

`/admin/revenue?month=2026-08&employee=123&pageId=456`

**Lưu ý kỹ thuật (đã xác nhận khi implement Phase 5):** param filter theo Page dùng tên `pageId`, không phải `page` — `page` đã là tên param chuẩn cho **số trang phân trang** dùng xuyên suốt mọi list screen (xem mục 42), nếu dùng lại `page` cho Page filter sẽ đụng độ trực tiếp với phân trang trên cùng URL.

---

# 14. Employee Management

## 14.1 Employee List

Columns:

- Name.
- Email.
- Current salary.
- Active Pages.
- Revenue (all-time).
- Total Cost (all-time).
- Profit (all-time, thêm 2026-08-19 — xem bên dưới).
- Status.
- Actions (Edit, Deactivate — mở trực tiếp từ list, không bắt buộc vào Employee Detail; Deactivate chỉ hiện khi `status = ACTIVE`; "Chốt về 0" — thêm 2026-08-19, chỉ hiện khi Profit > 0).

**Cập nhật (Phase 7, đã implement):** ban đầu "Revenue/Total Cost theo filter" — filter tháng tuỳ chọn qua `?month=YYYY-MM` (component `MonthFilter`), bỏ trống = all-time.

**Cập nhật ngày 2026-08-19 (theo yêu cầu user "bỏ filter theo tháng đi, luôn hiển thị all time"): bỏ hẳn `MonthFilter` khỏi trang này — đảo lại đoạn ngay trên, giờ Revenue/Total Cost luôn là tổng **all-time**, không còn cách chọn tháng nào ở Web UI.** `EmployeesPage` bỏ hẳn `month` khỏi `searchParams`, gọi `listEmployees({ search, page, pageSize })` không truyền `month`. **Không đổi** service layer — `listEmployees({ month? })` (`employee.service.ts`) vẫn nhận `month` optional, chỉ Web UI Employee List không còn truyền tham số đó; MCP tool `list_employees` (mục 32) vẫn giữ filter `month` riêng, không bị ảnh hưởng. Không có nút "Xoá" thật cho nhân viên — `User`/`EmployeeProfile` không có field soft-delete và bị nhiều bảng khác tham chiếu (`Revenue`/`AdExpense`/`PagePurchaseExpense`/`PageAssignment`/`SalaryHistory`), nên hành động tương đương đúng nghiệp vụ là **Deactivate**, không phải Delete (khác Page List ở mục 15.1, vốn có `deleted_at` thật).

**Cập nhật ngày 2026-08-19, sau đó cùng ngày (user request "gộp lợi nhuận nv với quản lý nhân viên"): gộp thẳng trang `/admin/profit-settlements` (từng thêm cùng ngày, xem mục 10.2/38) vào đây — xoá hẳn route/nav item riêng.** Thêm cột **Profit** = `Revenue − Total Cost − Σ EmployeeProfitSettlement` (đúng công thức "Lợi nhuận đang chạy" ở mục 10.2, tự đúng vì Revenue/Total Cost ở trang này đã luôn all-time từ bản cập nhật ngay trên) và nút **"Chốt về 0"** (`SettleProfitButton`, dùng `ConfirmDialog` chung) ở cột Thao tác — chỉ hiện khi Profit > 0, cho **mọi** nhân viên trong danh sách (khác trang cũ chỉ liệt kê người có lợi nhuận dương). `EmployeesPage` gọi thêm `getSettledTotalsForEmployees(employeeIds)` (`profit-settlement.service.ts`, hàm mới — batch 1 query thay vì N) song song với `listEmployees()`, tính `currentProfit` ngay ở tầng page, không đụng `EmployeeListItem`/`listEmployees()`. Chi tiết: `context/schema.md` entity `EmployeeProfitSettlement`.

**Cập nhật lần 2, cùng ngày 2026-08-19 (đảo ngược một phần đoạn ngay trên — xem mục 10.2 Changelog "đảo ngược lần 2"):** công thức cột **Profit** rút gọn về `Revenue − Total Cost` (bỏ hẳn phần trừ `Σ EmployeeProfitSettlement` riêng) — vì `Total Cost` (`employee.totalCost`, từ `listEmployees()`) giờ đã **tự bao gồm** mọi settlement trước đó (`profitSettlementCost`, mục 10.2). `getSettledTotalsForEmployees` không còn cần thiết, đã xoá khỏi `profit-settlement.service.ts` — `EmployeesPage` tính thẳng `currentProfit = employee.revenue - employee.totalCost`, không gọi thêm query nào ngoài `listEmployees()`.

## 14.2 Create Employee

Fields:

- Name.
- Email.
- Password tạm (đã implement: sinh ngẫu nhiên qua `randomBytes(12).toString("base64url")`, hiện đúng một lần trên UI ngay sau khi tạo — không có luồng invitation qua email, chưa implement và không nằm trong kế hoạch hiện tại).
- Status.

Không nhập Salary/Salary effective date lúc tạo — nhân viên mới không có `SalaryHistory` nào cho đến khi Admin thiết lập lần đầu qua action **Change salary** (mục 44) trên Employee Detail. "Current Salary" hiển thị 0 VND cho tới lúc đó.

## 14.3 Employee Detail

Sections:

### Summary

- Name.
- Email.
- Current Salary.
- Total Revenue.
- Total Cost.
- Active Pages count.

### Revenue

Danh sách doanh thu được snapshot cho nhân viên.

### Costs

Chia thành:

- Ads.
- Page Purchase.
- Salary.
- Profit Settlement (thêm 2026-08-19 — xem Changelog cuối mục này và mục 10.2).

### Pages

- Page hiện tại.
- Page từng quản lý.
- Ngày bắt đầu.
- Ngày kết thúc.

### Monthly Chart

- Revenue.
- Ads.
- Total Cost.

**Cập nhật (Phase 7, đã implement):**
- Summary "Total Revenue"/"Total Cost" là all-time (không lọc theo tháng, khác Employee List — mục 14.1) — dùng `getEmployeeFinancials(employeeId)`, Salary tính accrued theo mục 10.2.
- Layout thật dùng `Tabs` (Doanh thu / Chi phí / Page / Biểu đồ theo tháng) thay vì hiển thị cả 4 section cùng lúc dạng grid — cùng pattern `Tabs` đã dùng ở Page Detail (mục 16).
- Tab "Doanh thu" hiện tối đa 20 dòng gần nhất + link "Xem toàn bộ" trỏ sang `/admin/revenue?employee=...` nếu còn nhiều hơn.
- Tab "Page" và `/user/pages` (mục 12) dùng chung một hàm/bảng UI — `getEmployeeAssignmentHistory(employeeId)` (`assignment.service.ts`), vì "Page hiện tại + lịch sử" ở đây và "Danh sách Page + Lịch sử Page từng phụ trách" ở User Dashboard hoá ra là cùng một dữ liệu.
- Monthly Chart lấy 6 tháng gần nhất (tính cả tháng hiện tại) qua `getEmployeeMonthlySeries(employeeId, monthsBack=6)`, mỗi tháng tính theo chế độ "có `monthKey`" ở mục 10.2. Trục Y hiển thị theo đơn vị triệu VND (`${value}M`), cùng convention `MonthlyRevenueChart` đã dùng ở Admin Dashboard (mock, mục 11.2).

**Cập nhật ngày 2026-08-19 (theo yêu cầu user "hiển thị table giống page bên nhân viên" — xem `context/plan.md` Phase 16.1): tab "Page" đổi hẳn nguồn dữ liệu, không còn dùng chung với `/user/pages` như ghi ở gạch đầu dòng ngay trên (câu đó không còn đúng).** Tab này giờ dùng `listPagesByEmployee(employeeId)` (`page.service.ts`) — đúng hàm/bảng mà `/user/pages` (mục 12) đang dùng — thay cho `getEmployeeAssignmentHistory`. Cột đổi từ "Page/Từ ngày/Đến ngày/Ghi chú" (mục "Pages" ở trên, giờ chỉ còn giá trị lịch sử) sang **Tên Page/Loại/Link/Giá mua/Tháng mua/Trạng thái** — Page **đang** phụ trách (không còn xem được lịch sử Page cũ qua tab này), Tên Page dẫn sang `/admin/pages/[pageId]` thay vì có cột Thao tác riêng (Admin quản lý đầy đủ ở đó). `getEmployeeAssignmentHistory` vẫn còn trong `assignment.service.ts` (có unit test riêng), chỉ không còn UI nào gọi tới.

**Cập nhật (bổ sung sau Phase 13, theo yêu cầu user): dialog "Đổi lương" (`SetSalaryDialog`, dùng chung với `/admin/salary` — mục 38) có thêm field bắt buộc "Người chi"** — chọn 1 trong các Admin, lưu vào `SalaryHistory.paid_by_admin_id` (xem `context/schema.md` Changelog), ghi vào audit `CHANGE_SALARY` before/after. Không đổi cơ chế tính lương (vẫn accrued theo mục 10.2).

**Cập nhật ngày 2026-08-19 (theo yêu cầu user "khi click vào chốt về 0, chi phí nhân viên thêm một số tiền đã chốt và đây, không có ngừoi chi, với loại là chốt lợi nhuận" — xem mục 10.2 Changelog "đảo ngược lần 2"):** tab "Chi phí" thêm KPI card thứ 4 "Bù chi phí" (grid `sm:grid-cols-3`→`sm:grid-cols-4`, giá trị = `financials.profitSettlementCost`), và bảng "Chi tiết chi phí" thêm dòng loại **"Bù chi phí"** cho mỗi `EmployeeProfitSettlement` active (`listProfitSettlements(employeeId)`) — cột Page = `"—"` (không gắn Page nào), cột Người chi = `"—"` (số tiền hệ thống tự tính tại thời điểm chốt, không phải Admin chọn chi cho ai, khác 3 loại còn lại luôn có payer thật). Nút "Chốt về 0" (`SettleProfitButton`) chuyển từ chỉ có ở Employee List (mục 14.1) sang **có thêm ở cả top action row của trang này**, cùng điều kiện hiện `profit > 0`. "Lợi nhuận" ở Summary tự động đúng (không cần sửa) vì `financials.totalCost` giờ đã bao gồm `profitSettlementCost`.

---

# 15. Page Management

## 15.1 Page List

Fields:

- Page name.
- Facebook URL.
- Current employee.
- Purchase price.
- Purchase month.
- Current status.
- Created at.
- Notes.
- Actions (Edit, Delete — mở trực tiếp từ list, không bắt buộc vào Page Detail).

**Cập nhật ngày 2026-08-18 (theo yêu cầu user "filter theo tên page, loại, trạng thái và nhân viên phụ trách"): thêm 3 dropdown filter (Loại Page/Trạng thái/Nhân viên phụ trách) cạnh Search theo tên đã có sẵn, URL-synced (`?pageType=&statusId=&employeeId=`, xem mục 13).** Không đổi schema — `listPages()` (`page.service.ts`) thêm 3 param lọc tương ứng, kết hợp AND với nhau và với `search`. Nhân viên phụ trách filter dùng **toàn bộ** danh sách nhân viên (`listEmployeeOptions()`, không chỉ `ACTIVE`) để vẫn khớp đúng trường hợp owner hiện tại của một Page đã bị deactivate sau khi gán.

## 15.2 Create Page

Fields bắt buộc:

- Page Name.
- Facebook URL.
- Purchase Price.
- Purchase Date.

Optional:

- Assign Employee.
- Status.
- Notes.

Assign Employee **không bắt buộc** lúc tạo (đổi so với bản gốc, theo yêu cầu user) — Admin có thể tạo Page trước, gán người phụ trách sau qua action **Assign Employee** (mục 15.4a).

**Cập nhật (theo yêu cầu user, xác nhận qua `AskUserQuestion` ngày 2026-08-18): thêm "Người chi" (Paid By Admin) làm field bắt buộc khi `purchase_price > 0`, bất kể đã chọn Assign Employee hay chưa** — chọn 1 trong các Admin đang có trong hệ thống. Giá trị này lưu ngay trên `Page` (`paid_by_admin_id`, xem `context/schema.md`), dùng lại nguyên khi Page Purchase Expense thực sự được tạo (dù tạo ngay lúc này hay dời lại tới lần Assign Employee đầu tiên) — Admin **không bị hỏi lại** "Người chi" ở bước Assign Employee (mục 15.4a).

Transaction:

1. Tạo Page (kèm `paid_by_admin_id` nếu `purchase_price > 0`).
2. Nếu có chọn Assign Employee → tạo Page Assignment đầu tiên, và nếu `purchase_price > 0` → tạo Page Purchase Expense snapshot cho employee đó (dùng `paid_by_admin_id` vừa nhập). Nếu **không** chọn Assign Employee → bỏ qua cả 2 bước này (Page tạo ra chưa có ai phụ trách, chưa có Page Purchase Expense — cả hai được tạo bù sau, cùng lúc, ở lần Assign Employee đầu tiên, tái dùng `paid_by_admin_id` đã lưu trên Page).
3. Ghi Audit Log.

Toàn bộ phải chạy trong một database transaction.

**Cập nhật ngày 2026-08-18 (theo yêu cầu user "thêm field là page hệ thống hoặc page bkt, page hệ thống thì không cần giá mua"): thêm field `page_type` (`SYSTEM | BKT`) — CÓ thay đổi schema thật, xem `context/schema.md` Changelog.** Xác nhận qua `AskUserQuestion`: (1) **Page hệ thống** (`SYSTEM`) không có giá mua — `purchase_price` luôn `0`, không hỏi "Người chi", không bao giờ tạo `PagePurchaseExpense`; (2) **Page BKT** (`BKT`, mặc định) giữ nguyên y hệt flow trả phí đã có ở trên (Purchase Price/Purchase Date/Người chi khi có giá); (3) chỉ **Admin** tạo được Page BKT qua `/admin/pages/new` (form thêm Select "Loại Page", chọn `SYSTEM` sẽ ẩn hẳn 2 field Giá mua/Người chi, ép về 0); Page hệ thống còn tạo được qua đường User self-service riêng (mục 12 "Cập nhật... User tự thêm Page hệ thống" ngay dưới). Service layer: `createPage()` reject (`SYSTEM_PAGE_NO_PRICE`) nếu `pageType=SYSTEM` mà `purchasePrice > 0`; `pageType` optional ở tầng service (default `BKT`) — cùng lý do đã áp dụng cho `statusColor` trước đó (hàng chục test gọi `createPage()` trực tiếp, không sửa lại toàn bộ chỉ vì thêm 1 field).

## 15.3 Edit Page

Có thể sửa:

- Tên.
- URL.
- Status.
- Notes.

Không sửa trực tiếp current employee bằng field.

Muốn đổi employee phải dùng action `Transfer Page` (Page đã có người phụ trách) hoặc `Assign Employee` (Page chưa có ai phụ trách).

**Cập nhật (theo yêu cầu user 2026-08-18): Status không còn là lựa chọn cố định `ACTIVE`/`ARCHIVED`.** Ban đầu đổi thành free-text tuỳ ý + màu preset nhập riêng cho từng Page, rồi thành picklist quản lý tập trung chọn **đúng một** loại (2 bước lược sử ở đây trước đó) — sau đó **cùng ngày, theo yêu cầu tiếp theo của user** ("Trạng thái có thể chọn nhiều trạng thái được"), đổi tiếp thành **chọn nhiều đồng thời**: Admin định nghĩa trước một danh sách "loại trạng thái" (tên + màu) tại Cài đặt → "Loại trạng thái Page" (`/admin/settings/page-status-options`, CRUD giống hệt "Danh mục chi phí" — Thêm/Sửa/**Xoá**), Edit Page giờ là một multi-select — có thể gắn nhiều tag trạng thái cùng lúc cho một Page (vd vừa "Hoạt động" vừa "Cần review"), không giới hạn chọn 1. Màu vẫn giới hạn preset (8 lựa chọn: `Xám`/`Xanh lá`/`Xanh dương`/`Vàng`/`Đỏ`/`Cam`/`Tím`/`Hồng`, xem `context/schema.md` enum `PageStatusColor`), không phải color picker tự do (đúng CLAUDE.md — không tự đặt màu ngoài `.stitch/DESIGN.md`). Quan hệ Page ↔ loại trạng thái vẫn thuần hiển thị, không có business rule nào đọc giá trị này (khác với `deleted_at` — xem §15.5 ngay dưới, vẫn tách biệt hoàn toàn). Xoá một loại đang được (một hoặc nhiều) Page dùng **được phép** (khác nguyên tắc "không hard-delete" áp dụng cho hầu hết entity khác) — mỗi Page liên quan chỉ mất đúng tag đó, các tag khác giữ nguyên, chỉ khi đó là tag cuối cùng thì Page mới về "Chưa đặt"; không chặn thao tác xoá, xác nhận qua `AskUserQuestion`. Page có sẵn trước đây được migrate mỗi Page giữ nguyên đúng 1 tag đang có (từ thiết kế chọn-1 trước đó, seed sẵn `Hoạt động`/xanh lá hoặc `Lưu trữ`/xám), Admin gắn thêm tag khác nếu cần.

## 15.4 Transfer Page

Dùng khi Page **đã có** nhân viên đang phụ trách (có assignment active) và muốn đổi sang người khác.

Inputs:

- Page.
- New Employee.
- Effective Date.
- Note.

Backend:

1. Tìm assignment đang active — bắt buộc phải tồn tại, nếu không thì reject (dùng `Assign Employee` thay vì Transfer).
2. Set `ended_at`.
3. Tạo assignment mới.
4. Không sửa revenue cũ.
5. Không sửa Ads cũ.
6. Không sửa Page Purchase cũ.
7. Audit log.

Không được có 2 assignment overlap cùng thời điểm cho cùng Page.

## 15.4a Assign Employee (lần đầu)

Dùng khi Page **chưa** có ai phụ trách (không có assignment active nào — vì tạo Page không chọn Assign Employee, hoặc do lỗi dữ liệu). Khác `Transfer Page` ở chỗ không cần đóng assignment cũ.

Inputs:

- Page.
- Employee.
- Effective Date.
- Note.

Backend:

1. Reject nếu Page đã có assignment active (dùng `Transfer Page` thay vì action này).
2. Employee mới phải `status = ACTIVE`.
3. Tạo Page Assignment mới với `started_at = Effective Date`.
4. Nếu Page có `purchase_price > 0` **và chưa từng có** Page Purchase Expense nào → tạo Page Purchase Expense snapshot cho employee này ngay trong cùng transaction (`purchase_month` giữ nguyên theo Page, không phải Effective Date; `paid_by_admin_id` cũng lấy nguyên từ Page — **không hỏi lại** Admin ở bước này, xem Cập nhật ở mục 15.2).
5. Audit log.

## 15.5 Xoá Page (Delete)

Soft delete — set `deleted_at`, không hard delete (đúng mục 28).

Khác với đổi nhãn `status` (mục 15.3 "Edit Page", free-text kể từ 2026-08-18 — vd đặt thành "Lưu trữ"): đổi nhãn `status` vẫn là Page hợp lệ, hiển thị trong list và có thể sửa lại; **Xoá** ẩn hẳn Page khỏi mọi list mặc định. Hai khái niệm tách biệt vì `status`/`status_color` và `deleted_at` là các field riêng trên `Page` (mục 25).

Backend:

1. Set `deleted_at = now()`.
2. Audit log action `DELETE`.
3. **Không cascade** — `PageAssignment`/`Revenue`/`AdExpense`/`PagePurchaseExpense` đã gắn với Page vẫn giữ nguyên trong DB (đúng nguyên tắc snapshot, mục 3.1/4.2/5), chỉ Page không còn hiện ra khi Admin duyệt danh sách.

Có thể thực hiện trực tiếp từ Page List (nút Xoá trên mỗi dòng) hoặc từ Page Detail, dùng chung `ConfirmDialog` với các action xoá khác trong hệ thống (mục 40).

---

# 16. Page Detail

Header:

- Page name.
- URL.
- Current employee.
- Purchase price.
- Purchase month.
- Status.

Tabs:

1. Overview.
2. Revenue.
3. Ads.
4. Assignment History.
5. Audit History.

Overview:

- Revenue kỳ chọn.
- Ads kỳ chọn.
- Lifetime Revenue.
- Lifetime Ads.
- Current employee.

**Cập nhật (bổ sung sau Phase 13, theo yêu cầu user):**
- Header thêm summary stat **"Người chi mua Page"** — đọc từ `PagePurchaseExpense.paidByAdmin` nếu đã tồn tại, fallback về `Page.paidByAdmin` nếu Page có giá mua nhưng chưa gán nhân viên (chưa tạo `PagePurchaseExpense`, xem mục 15.2). Hiện `—` nếu `purchase_price = 0`.
- Thêm nút **"← Quay lại"** ở đầu trang, dẫn về `/admin/pages` — implement qua prop `backHref` dùng chung trên component `PageHeader` (`components/shared/page-header.tsx`), có thể tái dùng cho các trang Detail khác.

---

# 17. Revenue Management

Route:

`/admin/revenue`

Functions:

- List.
- Create.
- Edit.
- Delete/soft delete.
- Filter.
- Search.

Create fields:

- Page.
- Date.
- Amount.
- Note.

Employee không được chọn thủ công.

Backend resolve owner theo Page Assignment.

Nếu tại ngày nhập Revenue Page không có employee assignment hợp lệ:

- Reject.
- Hiển thị lỗi rõ ràng.
- Không cho tạo revenue không có owner.

**Cập nhật ngày 2026-08-18 (theo yêu cầu user "tôi cần pop up to hơn và khi add page cần ô search"): dialog Create/Edit Revenue rộng hơn + Page field đổi từ dropdown thường sang ô search.** `DialogContent` thêm `className="sm:max-w-lg"` (512px, thay default `sm:max-w-sm` 384px của `components/ui/dialog.tsx` — chỉ áp dụng cho 2 dialog Revenue + 2 dialog Ads ở mục 18, không đổi default chung vì các dialog khác không được yêu cầu). Field "Page" đổi từ `Select`/`SelectContent`/`SelectItem` sang component mới `components/ui/combobox.tsx` — gõ để lọc theo tên Page, cần thiết khi số Page tăng lên nhiều (spec ghi nhận ~100 Page, mục "Project Overview" CLAUDE.md) khiến dropdown liệt kê hết trở nên khó dùng. Xem mục 18 để biết chi tiết component `Combobox`.

Route:

`/admin/ads`

Fields (đã cập nhật theo §6 — tính theo tháng, không theo ngày):

- Page.
- Tháng (input kiểu `month`, vd `2026-02`) — không phải ngày cụ thể.
- Amount.
- Note.

Employee tự resolve dựa trên assignment của Page tại **ngày 1 của tháng** Ads (§6).

Mỗi Page tối đa **một record Ads đang hoạt động/tháng** — tạo lại cho Page + tháng đã có sẽ ghi đè amount/note của record đó thay vì tạo dòng thứ hai (§6).

Không cho phép Admin override owner trực tiếp.

List đã implement: List + Create + Edit + Soft delete + Filter (month/employee/page) + Search (Page name / ghi chú) + Pagination + URL sync, cùng pattern với `/admin/revenue` (mục 17), dùng chung component `FinanceFilters`.

**Cập nhật ngày 2026-08-18 (theo yêu cầu user "tôi cần pop up to hơn và khi add page cần ô search trong trường hợp có quá nhiều page rồi"): dialog Create/Edit Ads rộng hơn (`sm:max-w-lg`) + Page field đổi sang ô search, cùng thay đổi như Revenue (mục 17) — component mới dùng chung `components/ui/combobox.tsx`.** Wrap `@base-ui/react/combobox` (đã xác nhận có sẵn trong `node_modules/@base-ui/react`, tra cứu API qua Context7 trước khi dùng theo đúng CLAUDE.md — `Combobox.Root`/`InputGroup`/`Input`/`Trigger`/`Clear`/`Portal`/`Positioner`/`Popup`/`Empty`/`List`/`Item`/`ItemIndicator`) thành component `Combobox` với API đơn giản hoá `{ options: {value,label}[], value: string, onValueChange: (v: string) => void }` — giữ nguyên interface giống `Select` hiện có (`value`/`onValueChange` kiểu string) để cắm thẳng vào `Controller` của React Hook Form đang dùng ở mọi form, không phải đổi Zod schema nào. Bên trong tự map `value` (pageId string) ↔ item object `{value, label}` mà Base UI Combobox yêu cầu (dùng `isItemEqualToValue`/tự động nhận diện shape `{value,label}` cho `itemToStringLabel`/`itemToStringValue`, không cần khai báo tay). Filter theo tên là tính năng có sẵn của `Combobox.Root` (client-side, dựa trên `Intl.Collator`), không cần code thêm. Chỉ áp dụng cho field **Page** ở 4 dialog (Create/Edit × Revenue/Ads) — field "Người chi"/"Admin nhận" vẫn dùng `Select` thường vì danh sách Admin chỉ ~2 người, không cần search. Component `Combobox` đặt cạnh `Select` trong `components/ui/` để tái dùng cho các trường hợp tương tự sau này (vd Employee picker nếu số nhân viên tăng).

---

# 19. Admin Expenses

Route:

`/admin/expenses`

CRUD:

- Create.
- Edit.
- Soft delete.
- Restore nếu cần.

Fields:

- Date.
- Amount.
- Description.
- Note.

**Cập nhật (Phase 9, đã implement):**
- **`server/services/admin-expense.service.ts`** — `listAdminExpenses`, `createAdminExpense`, `updateAdminExpense`, `softDeleteAdminExpense`, `restoreAdminExpense`. Mirror cấu trúc `revenue.service.ts` (mục 17), cộng thêm Restore. (`listAdminOptions` khai báo ban đầu ở đây, sau đó chuyển sang `user-account.service.ts` — xem mục 35 "Bổ sung sau Phase 13".)
- **Restore — action đầu tiên trong hệ thống có UI thật** (Revenue/Ads/Page mới chỉ có soft delete, chưa có Restore UI — xem mục 28). Vì Restore chỉ có ý nghĩa khi nhìn thấy được bản ghi đã xoá, `listAdminExpenses` nhận thêm param `deleted?: boolean` (mặc định `false`); UI thêm nút toggle "Xem đã xoá" / "Xem đang hoạt động" (`?deleted=1`, giữ nguyên filter khác qua URL). Ở view "đã xoá": ẩn nút "Thêm chi phí", mỗi dòng chỉ có nút "Khôi phục" (không có Sửa/Xoá).
- **Không có Search (`q`)** cho `/admin/expenses` — đúng theo mục 41 (chỉ Employees/Pages/Revenue/Ads có search). Filter dùng component riêng `AdminExpenseFilters` (Month/Admin đã nhập) — không tái dùng `FinanceFilters` (mục 17/18) vì bộ filter khác hẳn (không có Employee/Page).
- List đã implement đầy đủ: Create + Edit + Soft delete + Restore + Filter (month/createdByAdminId) + Pagination + URL sync.

**Cập nhật ngày 2026-08-18 (theo yêu cầu user "Danh mục chi phí này có cần thiết không, không thì bỏ đi", xác nhận qua `AskUserQuestion` — chọn bỏ hẳn thay vì chỉ xoá 3 category HỆ THỐNG): bỏ hẳn field Category khỏi Admin Expense — CÓ đổi schema, xem `context/schema.md` Changelog và mục 21 (đã gỡ) ngay dưới.** `AdminExpense` không còn `category_id`; toàn bộ tính năng Expense Categories (entity, settings page, dropdown) đã bị xoá.

---

# 20. Admin Receipts

Route:

`/admin/receipts`

CRUD:

- Create.
- Edit.
- Soft delete.

Fields:

- Date.
- Amount.
- Source.
- Note.

Dùng để tính KPI:

`Total Admin Received`.

**Cập nhật (Phase 10, đã implement):**
- **`server/services/receipt.service.ts`** — `listAdminReceipts`, `createAdminReceipt`, `updateAdminReceipt`, `softDeleteAdminReceipt`. Mirror cấu trúc `admin-expense.service.ts` (mục 19) nhưng **không có Restore** — spec/plan chỉ duyệt CRUD "Create/Edit/Soft delete" cho Admin Receipts, khác Admin Expense (Phase 9) vốn có Restore ngoài scope ban đầu.
- **Không có Search** — Filter chỉ gồm Month + "Admin đã nhập", dùng component riêng `AdminReceiptFilters` (không tái dùng `AdminExpenseFilters` — 2 component vẫn tách riêng dù nay có cùng shape, vì mỗi bên có route/URL-sync riêng).
- **`listAdminOptions()` tái dùng nguyên xi từ `admin-expense.service.ts`** — hàm này vốn tổng quát (mọi `User role=ADMIN`, không có logic riêng cho Admin Expense), dùng chung cho dropdown "Admin đã nhập" ở cả 2 màn hình, tránh duplicate logic.
- **Route `/admin/receipts` và nav sidebar ("Tiền đã nhận") đã có sẵn từ Phase 1** (placeholder empty-state) — Phase 10 chỉ thay nội dung từ tĩnh sang dynamic thật, không đổi `nav-config.ts`.
- Comment tường minh trong `receipt.service.ts` xác nhận `Total Received` không bao giờ join/sum với `prisma.revenue` — bảo đảm mục 9/10.4/60 khi Phase 11 (Admin Dashboard KPI) đọc lại 2 con số này.
- List đã implement đầy đủ: Create + Edit + Soft delete + Filter (month/createdByAdminId) + Pagination + URL sync.

**Cập nhật ngày 2026-08-18 (theo yêu cầu user "Khoản admin nhận phải chọn được 1 trong các admin nhận"):** thêm field bắt buộc `received_by_admin_id` — Admin thực sự nhận tiền, chọn qua Select trong dialog Create/Edit ("Admin nhận"), tách biệt với `created_by_admin_id` ("Admin nhập" — Admin đang thao tác form). Mirror đúng pattern `paid_by_admin_id` đã áp dụng cho `AdExpense`/`PagePurchaseExpense`/`AdminExpense`/`SalaryHistory` (mục 6/19 và migration `20260817220000_add_paid_by_admin_id`) — validate người được chọn tồn tại và có `role = ADMIN` trước khi ghi (lỗi `INVALID_RECEIVER`). Bảng list `/admin/receipts` giờ có 2 cột admin riêng biệt: "Admin nhận" và "Admin nhập". Xem `context/schema.md` Changelog 2026-08-18 (mục `received_by_admin_id`).

**Cập nhật tiếp ngay sau đó cùng ngày (theo yêu cầu user "Thay vì để ngày nhận, chọn tháng nhận là được"):** `receipt_date` đổi thành `receipt_month` — dialog Create/Edit đổi `<Input type="date">` → `<Input type="month">` (field "Tháng nhận"), mirror đúng cách Revenue đã đổi ở mục 4/17. **Khác Revenue/Ads:** không thêm unique constraint theo tháng — `AdminReceipt` không gắn với Page nên vẫn cho phép nhiều khoản nhận trong cùng một tháng như trước, chỉ đổi độ chính xác lưu (ngày → tháng), không đổi rule upsert/overwrite. Bảng list đổi cột "Ngày nhận" → "Tháng nhận". Bộ lọc `AdminReceiptFilters` không đổi (đã lọc theo tháng từ trước). Xem `context/schema.md` Changelog 2026-08-18 (mục `receipt_month`).

---

# 20a. Employee Receipts (Tiền nhân viên đã nhận)

**Thêm mới ngày 2026-08-18** (theo yêu cầu user "thêm mục tiền nhân viên đã nhận, mỗi tháng chỉ có 1 khoản, không cộng vào table của nhân viên mà là một mục để xem thôi", xác nhận qua `AskUserQuestion`).

Route:

`/admin/employee-receipts`

CRUD:

- Create.
- Edit.
- Soft delete.

Fields:

- Employee.
- Month.
- Amount.
- Note.

Không có "Người chi" riêng — chỉ `created_by_admin_id` (Admin nhập), khác mọi bảng chi phí/nhận tiền khác trong hệ thống (quyết định có chủ đích, theo yêu cầu user "đơn giản, chỉ amount + note").

**Ràng buộc quan trọng nhất:** đây thuần là bản ghi để xem — **không** cộng vào `Employee Cost`/`Employee Revenue` (mục 10.1/10.2), không hiện trong "Chi tiết chi phí" của Employee Detail hay `/user/costs`, và không ảnh hưởng `Total Expenses`/`Profit` hệ thống (mục 10.3/10.5). Service layer (`employee-receipt.service.ts`) không join/import gì từ `employee.service.ts`/`dashboard.service.ts` — cố tình giữ tách biệt hoàn toàn.

Tối đa **một record đang hoạt động/nhân viên/tháng** — nhập lại cho cùng nhân viên + tháng sẽ **ghi đè** số tiền/ghi chú, không tạo thêm dòng (đúng y hệt cơ chế Revenue/AdExpense — user xác nhận "mỗi tháng chỉ có 1 khoản").

Hiển thị ở **trang riêng dưới nhóm "Tài chính"**, liệt kê mọi nhân viên (không phải tab trong Employee Detail — đã xác nhận qua `AskUserQuestion`, khác các số liệu Revenue/Cost đã có sẵn trên Employee Detail).

Chi tiết implementation đầy đủ (migration, service, test): `context/schema.md` Changelog "thêm entity mới `EmployeeReceipt`" và `context/plan.md`.

---

# 21. Expense Categories — ĐÃ GỠ BỎ (2026-08-18)

**Đã gỡ bỏ hoàn toàn ngày 2026-08-18** (theo yêu cầu user, sau khi được hỏi "Danh mục chi phí này có cần thiết không, không thì bỏ đi", xác nhận qua `AskUserQuestion`). Lý do: audit lại thực tế usage cho thấy 3 category HỆ THỐNG (`PAGE_PURCHASE`/`ADS`/`SALARY`) không hề có FK thật tới `PagePurchaseExpense`/`AdExpense`/`SalaryHistory` — chỉ là placeholder có thể vô tình gán nhầm cho một `AdminExpense` thật (gây dữ liệu gây hiểu nhầm). User xác nhận không cần tính năng này nữa (kể cả `RESOURCE`/`OTHER`), chọn bỏ hẳn thay vì chỉ xoá 3 category hệ thống. Route `/admin/settings/expense-categories`, entity `ExpenseCategory`, field `AdminExpense.category_id`, và toàn bộ Service Layer/UI liên quan đã bị xoá. Chi tiết đầy đủ: `context/schema.md` Changelog "Bỏ hẳn tính năng Expense Categories" và `context/plan.md` Phase 8. Mô tả gốc của tính năng này (route, fields, seed, ràng buộc system category) không còn được giữ lại ở đây — xem lịch sử `context/plan.md` Phase 8 nếu cần tra cứu lại thiết kế cũ.

---

# 22. Authentication

Đã triển khai từ Phase 2 (chi tiết implementation xem mục 23 "Tech Stack > Authentication"):

- Email + Password.
- Session-based authentication — JWT (HS256, ký bằng `jose`) trong cookie; không dùng session lưu DB.
- HttpOnly Cookie, `SameSite=lax`, `Secure` chỉ bật khi `NODE_ENV=production` (tắt ở dev để không chặn `http://localhost`).
- Password hash bằng `bcryptjs` (một trong hai lựa chọn Argon2/bcrypt nêu trên — chọn bcrypt vì pure JS, không cần build native binding, an toàn hơn khi deploy Vercel serverless).
- Rate limit login: in-memory, 5 lần/5 phút theo email (xem mục 47 — trade-off chấp nhận được ở quy mô nội bộ, không chia sẻ giữa nhiều serverless instance).
- CSRF protection: dùng cơ chế built-in của Next.js Server Actions (tự động kiểm tra `Origin` header khớp host khi POST) — không cần middleware CSRF riêng.
- **Logout tất cả session khi đổi password: chưa khả thi với kiến trúc hiện tại.** Session là JWT stateless (không có server-side session store/danh sách token để revoke), nên không thể vô hiệu hoá một session cụ thể trước khi JWT tự hết hạn (7 ngày). Tính năng "đổi password" chưa được triển khai; nếu làm, cần bổ sung cơ chế versioning (vd field `session_version` trên `User`, nhúng vào JWT payload, tăng version khi đổi password để các JWT cũ tự invalid) — **đây là thay đổi schema, phải hỏi lại user trước khi thêm.**

Không cần social login trong V1.

---

# 23. Tech Stack

## Frontend

- Next.js 16 (App Router, Turbopack), React 19, TypeScript.
- Tailwind CSS v4 — cấu hình CSS-first: toàn bộ token map từ `.stitch/DESIGN.md` sống trong `src/app/globals.css` (khối `@theme`), **không có** `tailwind.config.ts` (Tailwind v4 không cần file config JS/TS riêng).
  - **Container Queries** (native Tailwind v4, không cần plugin) — dùng cho component cần layout phản ứng theo độ rộng thật của khối cha (ví dụ `ExpenseBreakdownChart`: donut+legend xếp ngang chỉ khi container đủ rộng, không phải theo viewport breakpoint) — quan trọng khi component được nhúng vào cột có tỷ lệ co giãn khác nhau tuỳ trang (2/3–1/3 ở một nơi, 3/5–2/5 ở nơi khác).
  - `cn()` (`clsx` + `tailwind-merge`, `src/lib/utils.ts`) dùng `extendTailwindMerge` (không phải `twMerge` mặc định) — khai báo rõ 7 token font-size tuỳ biến của DESIGN.md (`headline-lg/md/sm`, `body-lg/md`, `label-caps`, `data-tabular`) vào `extend.theme.text`, vì `tailwind-merge` mặc định không tự nhận diện các token `--text-*` ngoài thang đo gốc của Tailwind — thiếu khai báo này khiến nó xếp nhầm class kích thước chữ và class màu chữ tuỳ biến (`text-error-red`...) vào cùng một nhóm xung đột, âm thầm xoá nhầm class khi cả hai xuất hiện trong cùng lệnh `cn()` (bug thật đã gặp, xem `context/plan.md` Phase 17.1). Màu tuỳ biến (`--color-*`) không cần khai báo — `tailwind-merge` tự nhận diện namespace đó.
- shadcn/ui, preset "Nova" — dựng trên `@base-ui/react` (không phải Radix). Hệ quả: composition polymorphic dùng prop `render={<Component .../>}` thay vì `asChild`.
- lucide-react (icon).
- Recharts.
- React Hook Form (+ `@hookform/resolvers/zod`) — dùng cho mọi form nhiều field (Create/Edit Employee, Page, Revenue, Ads...). Ngoại lệ: **Login** (2 field) dùng `useActionState` + Server Action thuần, không qua RHF — đủ đơn giản để validate server-side qua Zod là đủ.
- Zod.

## Backend

- Next.js Server Actions và/hoặc Route Handlers.
- Service Layer riêng cho business logic.
- Zod validation.
- PostgreSQL.

## ORM

- Prisma ORM 7.x.
- Generator `prisma-client` (ESM), output tại `src/generated/prisma` (không dùng `prisma-client-js` mặc định cũ; thư mục này gitignore, luôn chạy `npx prisma generate` sau khi đổi schema).
- Prisma 7 không còn đọc `datasource.url` trong `schema.prisma` — connection string được truyền qua driver adapter `@prisma/adapter-pg` khi khởi tạo `PrismaClient` (xem `src/lib/db.ts`), còn `prisma.config.ts` (đọc `DATABASE_URL` từ `.env`) phụ trách Prisma CLI (`migrate`, `studio`...).
- Preview feature `partialIndexes` bật trong `generator client` — dùng cho 2 ràng buộc "tối đa một record active" (`PageAssignment` theo `page_id` where `ended_at IS NULL`, `SalaryHistory` theo `employee_id` where `effective_to IS NULL`) bằng `@@unique(..., where: raw(...))` thay vì migration SQL thủ công.
- **`tsconfig.json` `target: "ES2020"`** (không phải mặc định `ES2017` của `create-next-app`) — bắt buộc để type-check literal BigInt (`10_000_000n`), dùng khắp nơi cho tiền VND (mục 26). Next.js build (SWC) không bị ảnh hưởng bởi setting này, chỉ `tsc --noEmit` cần.

## Testing

- **Vitest** (`vitest run`, script `npm run test`) — chưa có trong bản đề xuất gốc, thêm từ Phase 3 vì project chưa có test runner nào trước đó.
- Test chạy như **integration test thật** — gọi thẳng Service Layer, query DB thật qua Prisma, **không mock Prisma Client**.
- **Cập nhật (Phase 17.1, 2026-08-19): DB cho test đổi từ `npx prisma dev` (Postgres local ephemeral) sang Neon thật** — cùng lần đổi `DATABASE_URL` sang Neon cho mọi môi trường (xem "Database" bên dưới). `vitest.config.mts` vẫn giữ `test.fileParallelism: false` — lý do gốc ("nhiều file test chạy song song làm hỏng wire protocol của Postgres proxy ephemeral") không còn áp dụng y hệt với Neon, nhưng setting này chưa được đánh giá lại/gỡ bỏ (rủi ro thấp khi giữ nguyên, không phải bottleneck ở quy mô test suite hiện tại — 173 test/23 file chạy ~4 phút).
- Mỗi file test tự tạo fixture riêng (Admin/Employee/Page test với email `*@example.test`) và tự dọn dẹp (`afterAll` hard-delete) — không đụng 2 Admin thật đang có dữ liệu (`minhquyqt29@gmail.com`/`joyadbreaks@gmail.com`).
- `dotenv` nạp `.env` cho vitest (không tự động như Next.js dev server).

## Authentication

- **Không dùng Auth.js** — session auth tự viết, tối giản, đã triển khai đầy đủ ở Phase 2:
  - `jose` — ký/verify JWT (HS256) cho session cookie; chạy được cả trong `proxy.ts` (route guard) lẫn Server Components/Actions vì không phụ thuộc `next/headers`.
  - `bcryptjs` — hash password.
  - `server-only` — chặn nhầm import code chỉ-chạy-server (session, RBAC) vào client bundle.
  - Session payload tối giản, chỉ `{userId, role}` — không nhét PII (tên/email), đúng khuyến nghị chính thức của Next.js docs cho stateless session.
  - Route guard: `src/proxy.ts` — Next.js 16 đã deprecate/đổi tên file convention `middleware.ts` → `proxy.ts` (cùng chức năng). Đây là optimistic check: chỉ decode JWT từ cookie, không query DB.
  - RBAC "thật" (secure check, có query DB xác nhận `status=ACTIVE`, dùng React `cache()` để memo theo request) nằm ở `src/server/auth/rbac.ts` (`requireAdmin`/`requireUser`/`getCurrentUser`), gọi trong `AdminLayout`/`UserLayout` — pattern Data Access Layer (DAL) theo khuyến nghị Next.js, giúp bắt được trường hợp tài khoản bị deactivate sau khi JWT đã phát hành.

## MCP API Key

- Đã triển khai từ Phase 14 (quản lý vòng đời key qua `/admin/settings/mcp`; xác thực request MCP thực tế đã triển khai từ Phase 15, xem mục 31):
  - Key sinh bằng `node:crypto` `randomBytes(32)` → base64url, tiền tố `mcp_` (nhận diện nhanh nếu rò rỉ, cùng phong cách token Stripe/GitHub).
  - **Hash bằng SHA-256 (`createHash("sha256")`), không dùng `bcryptjs` như password.** Lý do: key đã là dữ liệu ngẫu nhiên entropy cao (không phải do người chọn/tái dùng như password), nên không cần thuật toán chậm có salt để chống brute-force — chỉ cần hash quyết định (deterministic) để Phase 15 tra cứu trực tiếp `WHERE api_key_hash = sha256(key)`, thay vì phải fetch toàn bộ client `ACTIVE` rồi `bcrypt.compare` từng cái.
  - `permissions_json` lưu literal `{"scope":"ADMIN_FULL"}` (V1 chỉ có một quyền, mục 31).
  - Plaintext key chỉ hiển thị đúng một lần trong modal ngay sau khi tạo — không lưu lại, không xem lại được sau đó (kể cả reload trang).

## MCP Server (đã triển khai từ Phase 15 — chi tiết đầy đủ xem plan.md Phase 15)

- SDK: `@modelcontextprotocol/server` + `@modelcontextprotocol/core` **v2.0.0** — tách ra từ package monolithic `@modelcontextprotocol/sdk` (v1.x, dừng ở 1.30.0). Tra Context7 tại thời điểm implement xác nhận v2 là bản ổn định (không phải alpha/beta), không dùng package cũ.
- Transport: Next.js Route Handler `src/app/api/mcp/route.ts` (`createMcpHandler`, web-standard `fetch`, chế độ stateless mặc định — không session store, phù hợp serverless/Vercel). Claude Code kết nối qua HTTP transport, không phải `stdio`.
- `src/mcp/auth.ts`, `src/mcp/server.ts`, `src/mcp/tool-runner.ts`, `src/mcp/rate-limit.ts`.

## Database

- PostgreSQL.
- Hosting: **Neon** — đã chọn dứt điểm ở Phase 17.1 (2026-08-19), dùng chung 1 project Neon cho mọi môi trường (dev/test/production), không còn phân biệt "Supabase hoặc Neon" như bản đề xuất gốc.
- `DATABASE_URL` dùng endpoint **pooled** (`-pooler` trong hostname, qua PgBouncer) — bắt buộc cho môi trường serverless (Vercel) để tránh vượt giới hạn connection khi nhiều function instance cùng mở kết nối; `sslmode=verify-full` (không phải `require` — tường minh mức bảo mật, không phụ thuộc default có thể đổi ở major version `pg` sau này).
- **Không còn `npx prisma dev`** (Postgres local ephemeral) trong workflow thực tế — cả dev lẫn test đều trỏ thẳng `DATABASE_URL` vào Neon nói trên. Bản đề xuất gốc coi đây là lựa chọn tạm thời trước khi có Supabase/Neon; thực tế đã bỏ hẳn ephemeral local ngay từ Phase 17.1 vì trạng thái shadow DB của `prisma dev` liên tục lỗi khi viết migration tay (nhiều lần phải fallback `db execute` + `migrate resolve --applied`, xem `context/schema.md` Changelog).

## Deployment

- **Vercel** — Web App và MCP Server chạy chung **một** Next.js app, cùng một lần deploy (không tách service Node riêng như bản đề xuất gốc từng cân nhắc). MCP phục vụ qua Route Handler `src/app/api/mcp/route.ts` (`runtime = "nodejs"`, `dynamic = "force-dynamic"`, chế độ stateless — không session store, đúng chuẩn serverless: các request liên tiếp có thể rơi vào instance khác nhau).
- **Yêu cầu bắt buộc trước khi build lần đầu:** `package.json` phải có `"postinstall": "prisma generate"` — `prisma/schema.prisma` khai `output` tuỳ biến (`src/generated/prisma`, xem "ORM" bên trên), thư mục này gitignore nên một checkout mới (Vercel hoặc máy khác) thiếu hẳn Prisma Client nếu không tự generate lại sau `npm install`. Prisma 7 không tự làm việc này qua postinstall của chính `@prisma/client`/`prisma` (khác vài bản cũ) — phải khai rõ trong `package.json` của project.
- Environment Variables cần khai trên Vercel: chỉ `DATABASE_URL` + `AUTH_SECRET` (xem mục 49) — không cần chạy `prisma migrate deploy` tự động trong build command (khuyến nghị chạy tay từ máy dev khi đổi schema, tránh migrate nhầm mỗi lần push).

## Storage

V1 chưa cần file upload.

Có thể thêm Supabase Storage sau này.

---

# 24. Kiến trúc ứng dụng

Đề xuất:

```text
Browser
   |
Next.js Web App
   |
Auth / RBAC
   |
Application Service Layer
   |
Domain Services
   |
Prisma
   |
PostgreSQL
```

MCP:

```text
Claude Code
   |
MCP Server
   |
MCP Authentication
   |
Application Service Layer
   |
Same Domain Services
   |
Prisma
   |
PostgreSQL
```

**Không duplicate business logic giữa Web và MCP.**

Web và MCP phải gọi chung Service Layer.

---

# 25. Database Model đề xuất

**Đây là bản phác thảo ở mức business.** Định nghĩa chi tiết, chính xác từng field/type/constraint/enum đã implement (Prisma schema thật) nằm ở [`context/schema.md`](schema.md) — khi hai file lệch nhau, `schema.md` là nguồn đúng cho việc code, còn phần dưới đây giữ nguyên để mô tả ý định nghiệp vụ.

## User

```text
id
name
email
password_hash
role: ADMIN | USER
status: ACTIVE | INACTIVE
created_at
updated_at
deleted_at
```

Một User role USER tương ứng một employee profile.

---

## EmployeeProfile

```text
id
user_id
created_at
updated_at
```

---

## SalaryHistory

```text
id
employee_id
monthly_salary
effective_from
effective_to nullable
created_by_admin_id
created_at
updated_at
```

Constraint:

- Salary period của một employee không overlap.
- Chỉ một salary active tại một thời điểm.

---

## Page

```text
id
name
facebook_url
purchase_price
purchase_month
status
notes
created_by_admin_id
created_at
updated_at
deleted_at
```

Không lưu `employee_id` trực tiếp làm source of truth.

Current owner được xác định từ `PageAssignment`.

Có thể cache `current_employee_id` nếu cần performance, nhưng assignment history vẫn là source of truth.

---

## PageAssignment

```text
id
page_id
employee_id
started_at
ended_at nullable
assigned_by_admin_id
note
created_at
```

Constraint:

- Không overlap assignment cho cùng Page.
- `ended_at > started_at`.
- Tối đa một active assignment/page.

---

## Revenue

```text
id
page_id
employee_id_snapshot
assignment_id_snapshot
revenue_month      -- đổi từ revenue_date, DATE luôn chuẩn hoá về ngày 1 tháng (xem §4, user request 2026-08-18)
amount
note
created_by_admin_id
created_at
updated_at
deleted_at
```

`amount` dùng decimal/integer VND, không dùng floating point. Tối đa một record active cho mỗi cặp `(page_id, revenue_month)`.

---

## AdExpense

```text
id
page_id
employee_id_snapshot
assignment_id_snapshot
expense_month      -- đổi từ expense_date, DATE luôn chuẩn hoá về ngày 1 tháng (xem §6, Phase 6)
amount
note
created_by_admin_id
created_at
updated_at
deleted_at
```

Tối đa một record active cho mỗi cặp `(page_id, expense_month)`.

---

## PagePurchaseExpense

```text
id
page_id
employee_id_snapshot
assignment_id_snapshot   -- không có trong bản phác thảo gốc, đã thêm khi implement (Phase 4) để nhất quán với Revenue/AdExpense và dễ truy vết — xem schema.md
purchase_month
amount
created_by_admin_id
created_at
updated_at
deleted_at
```

Mỗi Page tối đa một PagePurchaseExpense active — ràng buộc DB thật: `page_id` unique và `assignment_id_snapshot` unique.

---

## AdminExpense

```text
id
expense_date
amount
description
note
created_by_admin_id
created_at
updated_at
deleted_at
```

---

## AdminReceipt

```text
id
receipt_month             -- luôn ngày 1 của tháng, không unique theo tháng (nhiều khoản/tháng vẫn được phép)
amount
source
note
created_by_admin_id       -- Admin nhập liệu
received_by_admin_id      -- Admin thực sự nhận tiền (có thể khác created_by_admin_id, thêm 2026-08-18)
created_at
updated_at
deleted_at
```

---

## AuditLog

```text
id
actor_type: USER | MCP
actor_user_id nullable
mcp_client_id nullable
action
entity_type
entity_id
before_json nullable
after_json nullable
ip_address nullable
user_agent nullable
request_id
created_at
```

Audit Log không cho sửa qua UI thông thường (không có action edit).

**Cập nhật 2026-08-19 (user request, xem `context/schema.md` Changelog):** Audit Log **không còn append-only vô hạn** — giới hạn cứng **5.000 dòng**, dòng cũ nhất bị hard-delete thật ngay sau mỗi lần ghi mới khi vượt giới hạn (`trimAuditLog()`, `server/audit/log-action.ts`). Đây là ngoại lệ có chủ đích, đánh đổi lấy đơn giản thay vì giữ lịch sử vô hạn — khác hẳn 6 entity tài chính (Page/Revenue/AdExpense/PagePurchaseExpense/AdminExpense/AdminReceipt) vẫn soft-delete, không hard delete.

---

## McpClient

```text
id
name
api_key_hash
status
permissions_json
created_by_admin_id
last_used_at
created_at
revoked_at
```

Không lưu API key plaintext — chỉ `api_key_hash` (SHA-256, xem mục 23 "Tech Stack > MCP API Key").

Chỉ hiển thị key một lần khi tạo.

---

# 26. Tiền tệ và kiểu dữ liệu

Currency chỉ dùng VND.

Khuyến nghị lưu tiền bằng:

`BIGINT`

Ví dụ:

`10.000.000 VND → 10000000`

Không sử dụng JavaScript floating point cho phép tính tiền.

Format UI:

`10.000.000 ₫`

---

# 27. Timezone

Timezone business cố định: **`Asia/Ho_Chi_Minh`** (đã implement từ Phase 1, `src/lib/dates.ts`).

Database lưu timestamp UTC (`timestamptz`).

Khi hiển thị/filter tháng thì convert theo timezone business — `formatDate`/`formatMonth`/`currentMonthKey` trong `src/lib/dates.ts` đều dùng `Intl.DateTimeFormat` với `timeZone: "Asia/Ho_Chi_Minh"`.

---

# 28. Soft Delete

Các dữ liệu tài chính không nên hard delete.

Sử dụng `deleted_at`.

Áp dụng cho:

- Revenue.
- Ads.
- Admin Expenses.
- Admin Receipts.
- Page.

Delete action:

- Mark deleted.
- Audit log.
- Không xuất hiện trong report mặc định.

Có thể restore bởi Admin.

**Cập nhật (Phase 9, đã implement):** Restore UI thực tế mới chỉ có ở **Admin Expenses** (`restoreAdminExpense`, mục 19) — Revenue/Ads/Page/**Admin Receipt** (mục 17/18/15.5/**20**) hiện chỉ có soft delete, **chưa** có action/nút Restore trên UI, dù chính sách "có thể restore" ở trên áp dụng chung cho mọi entity tài chính. Nếu cần Restore cho các entity còn lại, tái dùng pattern đã có ở Admin Expense (`deleted?: boolean` param trên hàm list + toggle view + `ConfirmDialog` non-destructive).

**Cập nhật (Phase 10, đã implement):** Admin Receipt (mục 20) triển khai **có chủ đích không có Restore** — khác quyết định mở rộng ở Admin Expense (Phase 9) — để bám đúng scope đã duyệt trong `context/plan.md` (chỉ Create/Edit/Soft delete).

---

# 29. Audit Log

Các action cần log:

- Login / Logout.
- Create employee.
- Edit employee.
- Deactivate employee.
- Change salary.
- Create page.
- Edit page.
- Assign employee (lần đầu — mục 15.4a).
- Transfer page.
- Delete page (mục 15.5).
- Create/update/delete revenue.
- Create/update/delete Ads.
- Create/update/delete/restore Admin Expense (Restore — mục 19, mới từ Phase 9).
- Create/update/delete Admin Receipt.
- Category changes.
- User role/status changes.
- MCP actions.

Ví dụ:

```text
Admin Nguyễn A
UPDATE Revenue
Entity: revenue_123
Before: 20.000.000
After: 25.000.000
Time: 2026-08-16 15:32
```

**Cập nhật (đã implement từ Phase 2, bổ sung dần qua các phase):** `AuditLog.action` là **free-form string**, không phải enum DB — toàn bộ giá trị đã dùng trong code tính đến hiện tại: `CREATE`/`UPDATE`/`DELETE` (mọi domain), `LOGIN`/`LOGOUT` (mục 22), `TRANSFER` (Transfer Page, mục 15.4), `RESTORE` (Admin Expense, mục 19/28, Phase 9), `ASSIGN` (Assign Employee lần đầu, mục 15.4a), `CHANGE_SALARY` (Change salary, mục 14.3/44), `DEACTIVATE`/`ACTIVATE` (Employee — mục 14.3; User account role/status — bổ sung sau Phase 13, mục 13 nhóm này gộp chung field `entity_type="User"`, phân biệt Employee vs User qua `entity_id` trỏ tới `EmployeeProfile.id` hay `User.id` tương ứng), `REVOKE` (McpClient — Phase 14, mục 31; dùng riêng thay vì tái dùng `DEACTIVATE` vì đúng thuật ngữ nghiệp vụ "thu hồi" key, khác "vô hiệu hoá" tài khoản), `READ` (mọi MCP tool read-only — Phase 15, mục 30-32; ghi cho **mọi** lần gọi kể cả thất bại, `entity_id` = id thật khi tool có 1 entity cụ thể, ngược lại = `requestId` của chính lần gọi đó).

**Cập nhật (Phase 12, đã implement — UI xem/search, chỉ đọc):**
- **`server/services/audit.service.ts`** — `listAuditLogs()` (filter kết hợp `entityType`/`action`/`actorUserId`/`entityId`/khoảng ngày `dateFrom`–`dateTo`, pagination 20/50/100) và `listAuditFilterOptions()` (danh sách giá trị filter cho `entityType`/`action`/actor lấy **live từ dữ liệu thật** qua `findMany({distinct:[...]})`, không hardcode enum — filter dropdown tự khớp khi domain khác thêm action/entity_type mới ở phase sau, không cần sửa code).
- **`/admin/settings/audit`**: List (Thời gian/Người thực hiện/Hành động/Đối tượng/Entity ID) + Filter (entity_type, action, actor, khoảng ngày) + Search theo `entity_id` + Pagination + dialog xem chi tiết before/after — không có action edit/delete/restore nào trên UI (đúng "append-only").
- **Search theo `entity_id` dùng exact match (`equals`), không phải `ILIKE`/`contains`** — khác `q` search ở mục 41 (Employee/Page/Revenue/Ads đều search theo cột text bằng `ILIKE`) — vì `entity_id` là cột `@db.Uuid` trong Postgres (`context/schema.md`), không phải text, nên tra cứu đúng nghĩa là dán nguyên UUID để xem lại 1 record cụ thể, không phải gõ từng phần.
- **Hiển thị rõ `actor_type`** qua chip riêng (`USER`/`MCP`, tông màu Finance Blue cho `MCP`) — actor name/email join từ `User` khi `actor_type=USER`, từ `McpClient.name` khi `actor_type=MCP`. Nếu `actor_user_id` trỏ tới một `User` đã bị hard-delete (VD dữ liệu test dọn tay ở phase trước, mục 51) thì hiện `—` thay vì lỗi — `AuditLog` không cascade khi actor bị xoá, đúng tinh thần append-only.
- **Không có `server/actions/audit.actions.ts` hay `server/validators/audit.schema.ts`** (khác bộ 3 service/action/validator ở mục 35) — vì phase này chỉ đọc, không có mutation nào cần RBAC-wrap qua Server Action hay validate Zod trước khi ghi DB.
- **`lib/audit-labels.ts`** bổ sung ở Phase 15: nhãn `READ` ("Đọc dữ liệu (MCP)", tone `neutral`) và 2 `entity_type` mới không map vào entity nghiệp vụ có sẵn nào — `Dashboard` ("Bảng điều khiển", cho `get_dashboard`) và `AuditLog` ("Nhật ký", cho `search_audit_logs`).

---

# 30. MCP Server

## 30.1 Mục tiêu

Cho phép Claude Code hoặc AI agent truy cập dữ liệu dashboard và thực hiện CRUD với quyền tương đương Admin.

MCP không kết nối trực tiếp database bằng raw SQL từ AI.

AI gọi các MCP tools được định nghĩa rõ ràng.

MCP tools sử dụng cùng Service Layer với Web App.

---

# 31. MCP Authentication

**Quản lý vòng đời key (tạo/xem list/revoke qua `/admin/settings/mcp`) đã triển khai từ Phase 14** — chi tiết implementation xem mục 23 "Tech Stack > MCP API Key". **Xác thực request MCP thực tế đã triển khai từ Phase 15** (`src/mcp/auth.ts`) — parse header `Authorization: Bearer mcp_...`, `authenticateMcpClient()` so hash + reject nếu không tồn tại hoặc `status != ACTIVE`, cập nhật `last_used_at` khi hợp lệ; chi tiết đầy đủ xem mục 23 "Tech Stack > MCP Server" và plan.md Phase 15.

Mỗi AI client có API key riêng.

Header/transport credential phải được xác thực trước khi chạy tool.

Mỗi key:

- Có tên.
- Có status.
- Có quyền.
- Có last_used_at.
- Có thể revoke.

V1 cấp quyền:

`ADMIN_FULL`

MCP có quyền tương đương Admin.

Tuy nhiên mọi action vẫn phải:

- Validate input.
- Đi qua business rules.
- Ghi Audit Log.
- Không bypass Page Assignment history.
- Không bypass snapshot rules.

---

# 32. MCP Tools đề xuất

**Cập nhật (Phase 15, đã implement — 10 tool read-only, không phải 9 như ghi nhận ban đầu):** `get_dashboard`, `list_employees`, `get_employee_detail`, `list_pages`, `get_page_detail`, `list_revenue`, `list_ads`, `list_admin_expenses`, `list_admin_receipts`, `search_audit_logs` (`src/mcp/server.ts`) — mỗi tool chỉ parse input qua Zod rồi gọi thẳng service Web đã có (`server/services/*`), không có business logic mới. **`list_expense_categories` đã bỏ hẳn khỏi danh sách** — entity `ExpenseCategory` đã gỡ bỏ toàn bộ ở Phase 8 (mục 21), tool này không còn gì để gọi.

**Cập nhật (Phase 16, đã implement — 21 tool write, cùng file `src/mcp/server.ts`):** toàn bộ tool `create/update/delete/transfer/assign_employee/deactivate_employee` liệt kê bên dưới đã implement, qua đúng Service Layer dùng chung với Web (`createEmployee`, `createPage`, `createRevenue`...), đầy đủ validate/business rules/audit — chi tiết implementation, quyết định thiết kế (attribution `created_by_admin_id`/`assigned_by_admin_id` cho MCP write) và kết quả kiểm thử xem `context/plan.md` Phase 16. **2 điểm khác danh sách gốc bên dưới:** (1) **bỏ hẳn `archive_page`** — `Page.status` không còn enum `ACTIVE|ARCHIVED` từ Phase 4 (đổi thành multi-tag `PageStatusOption`, xem `schema.md` Changelog), không còn gì để "archive"; `delete_page` (soft delete, mục 15.5) là hành động ẩn Page duy nhất còn lại. (2) **bỏ hẳn `create_expense_category`/`update_expense_category`/`archive_expense_category`** — entity `ExpenseCategory` đã gỡ bỏ toàn bộ ở Phase 8, cùng lý do đã bỏ `list_expense_categories` ở Phase 15. Input `create_revenue`/`update_revenue` dùng tên field `revenueMonth` ("YYYY-MM") thay vì `date` liệt kê ở mục "Inputs" bên dưới — tên cũ còn sót lại từ trước khi Revenue đổi sang tính theo tháng (Phase 5), không phản ánh đúng field `revenue_month` thật trong schema.

**Cập nhật ngày 2026-08-20 (rà soát đồng bộ MCP tool ↔ tính năng thật, theo yêu cầu user):** phát hiện `EmployeeReceipt` (mục 20a) và `PageStatusOption` (mục 15.3) — cả hai đã có full CRUD ở Web từ Phase 13.1/13.2 (trước cả Phase 15/16) — **chưa từng có MCP tool nào**, khác `EmployeeProfitSettlement` (mục 10.2) vốn có ghi chú "không MCP tool (quyết định có chủ đích)" trong `plan.md`. Không tìm thấy ghi chú loại trừ tương đương cho 2 entity này → xác nhận là thiếu sót khi Phase 16 chỉ bám đúng danh sách entity gốc của mục này, không rà lại entity mới phát sinh. Đã bổ sung 8 tool mới, cùng file `src/mcp/server.ts`, cùng pattern Service Layer/`runMcpTool`/`confirm` với mọi tool trên:
- `list_employee_receipts`, `create_employee_receipt`, `update_employee_receipt`, `delete_employee_receipt` (soft delete, cần `confirm:true`).
- `list_page_status_options`, `create_page_status_option`, `update_page_status_option`, `delete_page_status_option` (**hard delete** — khác mọi tool delete khác, đúng bản chất `PageStatusOption` là metadata hiển thị thuần tuý chứ không phải dữ liệu tài chính, xem `schema.md`; vẫn cần `confirm:true` vì không thể hoàn tác).

**Cập nhật tiếp ngay sau đó cùng ngày 2026-08-20 (user quan sát thực tế qua Claude Code: 1 lệnh "thêm lương nhân viên Minh Đức, admin Quý chi" khiến agent gọi tool 6 lần):** nguyên nhân — `set_employee_salary` cần `paidByAdminId` dạng UUID nhưng không có tool nào cho phép tra UUID Admin theo tên (khác `list_employees`/`list_pages` đã hỗ trợ `search` theo tên từ trước), agent phải dò qua các tool khác có chứa tên Admin (`list_admin_expenses`, `list_admin_receipts`...) để tự khớp. Đã thêm tool mới **`list_admins`** (read-only, không tham số, trả `{adminId, name}[]` — tái dùng thẳng `listAdminOptions()` đã có sẵn ở `user-account.service.ts`, dùng chung cho mọi dropdown "Người chi"/"Admin đã nhập" trên Web) để giải quyết đúng gốc vấn đề — không cần dò qua tool khác nữa.

**Tổng hiện tại: 40 tool** (13 read + 27 write) — đã đối chiếu trực tiếp với `registerTool()` trong `src/mcp/server.ts` (2026-08-20) để đảm bảo con số này không lệch code thật. Test tích hợp mới trong `tests/integration/mcp-server.test.ts` (round-trip create/update/delete + list cho `EmployeeReceipt`/`PageStatusOption`, `delete_page_status_option` có thêm assertion reject khi thiếu `confirm`, `list_admins` tìm đúng fixture Admin) — 30/30 test MCP pass.

## Dashboard

### `get_dashboard`

Input:

```json
{
  "month": "2026-08"
}
```

Output:

- totalRevenue
- totalReceived
- totalExpenses
- profit
- totalSalary
- totalAds

---

## Employees

### `list_employees`

Filters:

- search
- status
- month

### `get_employee_detail`

Input:

- employeeId
- month

### `create_employee`

### `update_employee`

### `set_employee_salary`

### `deactivate_employee`

---

## Pages

### `list_pages`

### `get_page_detail`

### `create_page`

Inputs:

- name
- facebookUrl
- purchasePrice
- purchaseMonth (đổi tên từ `purchaseDate` — chỉ lưu tháng, xem `context/schema.md` Changelog)
- paidByAdminId (bắt buộc nếu `purchasePrice > 0` — mục 16/35/36)
- employeeId
- notes

### `update_page`

### `transfer_page`

Inputs:

- pageId
- newEmployeeId
- effectiveDate
- note

### `assign_employee`

Inputs:

- pageId
- employeeId
- effectiveDate
- note

Dùng khi Page chưa có ai phụ trách (mục 15.4a) — khác `transfer_page` ở chỗ không cần assignment active để đóng lại.

### `delete_page`

Soft delete (mục 15.5) — nằm trong nhóm destructive action, yêu cầu `confirm: true` (mục 33).

---

## Revenue

### `list_revenue`

### `create_revenue`

Inputs:

- pageId
- date
- amount
- note

Employee automatically resolved.

### `update_revenue`

Khi đổi `pageId` hoặc `date`, backend phải resolve lại employee snapshot.

### `delete_revenue`

Soft delete.

---

## Ads

### `list_ads`

### `create_ad_expense`

### `update_ad_expense`

### `delete_ad_expense`

Owner luôn auto-resolve từ Page Assignment.

---

## Admin Expenses

### `list_admin_expenses`

### `create_admin_expense`

### `update_admin_expense`

### `delete_admin_expense`

---

## Admin Receipts

### `list_admin_receipts`

### `create_admin_receipt`

### `update_admin_receipt`

### `delete_admin_receipt`

---

## Audit

### `search_audit_logs`

Read-only.

---

# 33. MCP destructive action safety

MCP có quyền Admin Full, nhưng destructive operation nên yêu cầu:

```json
{
  "confirm": true
}
```

Áp dụng:

- delete revenue
- delete Ads
- delete Admin Expense
- delete Admin Receipt
- delete Page
- archive Page
- deactivate Employee

Đây không phải hạn chế quyền Admin; mục đích là tránh AI gọi nhầm destructive tool.

Mọi delete vẫn là soft delete.

---

# 34. MCP output rules

MCP response chuẩn:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "PAGE_HAS_NO_ASSIGNMENT",
    "message": "Page has no assigned employee on 2026-08-10."
  },
  "meta": {
    "requestId": "..."
  }
}
```

---

# 35. Service Layer

Business logic không đặt trực tiếp trong React components.

Ví dụ (`server/services/`, đã tồn tại tính đến Phase 13 + các bổ sung sau đó; phần còn lại là kế hoạch cho các phase sau):

```text
server/services/
  employee.service.ts          ✅
  salary.service.ts            ✅
  page.service.ts              ✅
  page-status-option.service.ts ✅ (mục 15.3 — picklist "Loại trạng thái Page")
  assignment.service.ts        ✅
  revenue.service.ts           ✅
  ads.service.ts               ✅
  admin-expense.service.ts     ✅
  receipt.service.ts           ✅
  employee-receipt.service.ts  ✅ (mục 20a — "Tiền nhân viên đã nhận", thuần bản ghi để xem)
  dashboard.service.ts         ✅
  audit.service.ts             ✅
  user-account.service.ts      ✅
  mcp-client.service.ts        ✅ (Phase 14 — mục 30-31, xem "Phase 14 (service mới)" bên dưới)
```

Mỗi service đi kèm 1 file `server/actions/<domain>.actions.ts` (Server Action mỏng, xem dưới) và 1 file `server/validators/<domain>.schema.ts` (Zod) — đã có đủ bộ 3 cho `employee`, `page`, `page-status-option`, `revenue`, `ads`, `admin-expense`, `admin-receipt`, `employee-receipt` (file schema/action đặt tên `admin-receipt.*`, khác tên service `receipt.service.ts` — giữ nguyên tên service theo đúng plan gốc mục "Việc cần làm" Phase 10). **Ngoại lệ:** `dashboard.service.ts` (Phase 11) và `audit.service.ts` (Phase 12) **không** có file action/validator đi kèm — cả hai chỉ đọc (không có mutation nào), Server Component gọi thẳng service, không cần RBAC-wrap qua Server Action hay Zod validate trước khi ghi DB. `user-account.service.ts` (Phase 13) có `user-account.actions.ts` (RBAC-wrap `setUserAccountStatusAction`) nhưng **không** có `user-account.schema.ts` riêng — input chỉ gồm `userId` (UUID từ URL/route param, không phải form tự do) và `nextStatus` (giá trị `UserStatus` enum literal do UI cố định, không phải text nhập tay), nên type TypeScript đã đủ chặt, không cần thêm lớp Zod.

**Phase 7 (không tạo service mới, chỉ mở rộng service đã có):**
- `employee.service.ts` — thêm `getEmployeeFinancials(employeeId, monthKey?)` và `getEmployeeMonthlySeries(employeeId, monthsBack)` (công thức Employee Revenue/Cost — mục 10.1/10.2).
- `assignment.service.ts` — thêm `getEmployeeAssignmentHistory(employeeId)` (mirror của `getAssignmentHistory(pageId)` đã có, theo chiều nhân viên — mục 14.3).
- `lib/month.ts` (mới, không phải service) — `parseMonthKey`/`monthDateRange`/`shiftMonthKey` dùng chung cho mọi tính toán theo tháng ở Phase 7. Không refactor lại logic tháng tương tự đã có sẵn (riêng lẻ) trong `revenue.service.ts`/`ads.service.ts` từ Phase 5/6 — chấp nhận trùng lặp nhỏ để tránh động vào code đã test kỹ ngoài phạm vi Phase 7.

**Phase 8 (service mới, ĐÃ GỠ BỎ 2026-08-18):**
- ~~`expense-category.service.ts` — `listExpenseCategories`, `listActiveExpenseCategoryOptions`, `createExpenseCategory`, `updateExpenseCategory`~~ — xoá cùng toàn bộ tính năng Expense Categories, xem mục 21 và `context/schema.md` Changelog.

**Phase 9 (service mới):**
- `admin-expense.service.ts` — `listAdminExpenses` (filter month/createdByAdminId + `deleted` toggle), `createAdminExpense`, `updateAdminExpense`, `softDeleteAdminExpense`, `restoreAdminExpense` (action Restore đầu tiên trong codebase, xem mục 19/28), `listAdminOptions` (danh sách `User role=ADMIN` cho dropdown filter "Admin đã nhập" — mục 13).

**Phase 10 (service mới):**
- `receipt.service.ts` — `listAdminReceipts` (filter month/createdByAdminId, không có `deleted` toggle vì không có Restore — mục 20/28), `createAdminReceipt`, `updateAdminReceipt`, `softDeleteAdminReceipt`. Không tạo hàm `listAdminOptions` riêng — tái dùng thẳng bản đã có ở `admin-expense.service.ts`.

**Phase 11 (service mới):**
- `dashboard.service.ts` — `getSystemFinancials(monthKey)` (KPI Cards, mục 11.1/10.3–10.5), `getSystemMonthlySeries(monthsBack=6)` (Monthly Chart, mục 11.2), `getDashboardEmployeeRows(monthKey)` (Bảng nhân viên, mục 11.3, tái dùng `getEmployeeFinancials` per-row), `getRecentActivity(limit=10)` (mục 11.4).

**Phase 12 (service mới):**
- `audit.service.ts` — `listAuditLogs()` và `listAuditFilterOptions()` (chi tiết mục 29). Chỉ đọc, không có hàm ghi nào — ghi log vẫn qua `logAction()` (`server/audit/log-action.ts`) như trước, xem ghi chú bên dưới.

**Phase 13 (service mới):**
- `user-account.service.ts` — `listUserAccounts(params)` (search theo tên/email + filter role Admin/User, dùng cho `/admin/settings/users` — mục 13/33), `setUserAccountStatus(userId, status, adminId, meta)` (toggle Active/Inactive hai chiều, chặn deactivate Admin ACTIVE cuối cùng — mục 33).

**Phase 14 (service mới):**
- `mcp-client.service.ts` — `listMcpClients()` (sort `createdAt desc`, không phân trang/filter — quy mô vài AI client, khác các list "phát sinh nhiều" khác), `createMcpClient(name, adminId, meta)` (sinh key `mcp_` + hash SHA-256, xem mục 23 "Tech Stack > MCP API Key", trả plaintext đúng 1 lần), `revokeMcpClient(clientId, adminId, meta)` (set `status=REVOKED` + `revoked_at`, reject nếu đã revoked/không tồn tại). Có đủ bộ 3 file chuẩn (`mcp-client.actions.ts`, `mcp-client.schema.ts`) dù chỉ 1 field `name` — khác `user-account.service.ts` (Phase 13, bỏ qua file schema vì input đã là enum/UUID chặt kiểu sẵn), vì `name` ở đây là text tự do nhập tay nên vẫn cần Zod validate.

**Bổ sung sau Phase 13 (không tạo Phase mới, mở rộng service đã có để phục vụ tính năng "Người chi"/màu tiền — xem Changelog `context/schema.md` và Phase 9 "Cập nhật bổ sung" trong `context/plan.md` để biết bối cảnh đầy đủ):**
- `listAdminOptions()` — chuyển từ `admin-expense.service.ts` sang `user-account.service.ts` (dùng chung bởi nhiều domain: Admin Expense, Ads, Page, Salary — không còn hợp lý nằm trong 1 service riêng lẻ).
- `dashboard.service.ts` — thêm `getAdminSpendingBreakdown(monthKey?)`: tổng `AdExpense`/`PagePurchaseExpense`/`AdminExpense.amount` group theo `paid_by_admin_id` (bảng "Chi phí theo người chi" — mục 11.1). *(Đã sửa lại ở Phase 13.1 — xem block ngay dưới: giờ **có gồm Lương**.)*
- `salary.service.ts` — thêm `listEmployeeSalaries()` (danh sách lương hiện tại của mọi nhân viên, dùng cho `/admin/salary` — mục 14.3); `setEmployeeSalary()` nay bắt buộc validate `paidByAdminId`.
- `ads.service.ts`, `page.service.ts`, `assignment.service.ts`, `admin-expense.service.ts` — threading field `paid_by_admin_id` (bắt buộc, validate là 1 `User role=ADMIN` tồn tại) xuyên suốt create/update; `page.service.ts` lưu `paid_by_admin_id` trực tiếp trên `Page` tại thời điểm tạo (nếu `purchase_price > 0`), `assignment.service.ts` đọc lại giá trị này khi tạo `PagePurchaseExpense` lúc assign nhân viên đầu tiên thay vì hỏi lại (mục 16/36).

**Bổ sung Phase 13.1 (session 2026-08-18 — xem `context/plan.md`, tóm tắt đầy đủ ở các mục 4/9/11/12/15/17/20 phía trên; đây chỉ liệt kê thay đổi ở tầng Service Layer để bộ liệt kê function ở trên không bị lệch với mã nguồn):**
- `page-status-option.service.ts` (mới) — `listPageStatusOptions`/`listPageStatusOptionsWithUsage`/`createPageStatusOption`/`updatePageStatusOption`/`deletePageStatusOption` (mục 15.3) — action Xoá đầu tiên trong hệ thống dùng hard delete thật (`prisma.pageStatusOption.delete()`), không phải soft-delete/deactivate như mọi entity khác.
- `page.service.ts` — thêm `listPagesByEmployee(employeeId)` (mirror `listPages`, scoped 1 nhân viên, dùng cho `/user/pages` — mục 12) và `updatePageStatusByEmployee(pageId, employeeId, input, actorUserId, meta)` (RBAC boundary ở tầng service: reject nếu nhân viên không có `PageAssignment` active trên đúng Page đó).
- `dashboard.service.ts` — `getSystemFinancials(monthKey?)` và `getAdminSpendingBreakdown(monthKey?)` đổi `monthKey` thành **optional**, bỏ trống = chế độ "Tất cả thời gian" (mục 11.1); `getAdminSpendingBreakdown` giờ **có gồm Lương** trong `total` (field mới `salaryCost`, gán theo `paid_by_admin_id` của SalaryHistory — đảo lại quyết định "Không gồm Lương" ghi ở block ngay trên) và thêm `receivedAmount`/`profit` (group `AdminReceipt` theo `received_by_admin_id`). **Đã xoá hẳn** `getDashboardEmployeeRows(monthKey)` — bảng "Danh sách nhân viên" trên Admin Dashboard bị bỏ (mục 11.3 nay chỉ còn giá trị lịch sử, xem `context/plan.md` Phase 13.1).
- `employee.service.ts` — tách `accruedSalaryCost(histories)` (tổng luỹ kế 1 nhân viên) thành 2 hàm: `accruedRowCost(row)` (accrued cho **một** giai đoạn SalaryHistory, **export mới**) + `accruedSalaryCost` giờ chỉ là `Σ accruedRowCost`; export để `dashboard.service.ts` tái dùng đúng 1 công thức cho cả tổng lương all-time hệ thống lẫn tổng lương all-time theo Admin, tránh viết lại 2 lần.
- `receipt.service.ts` — `createAdminReceipt`/`updateAdminReceipt` nhận thêm `receivedByAdminId` (bắt buộc, validate `role=ADMIN`, lỗi `INVALID_RECEIVER`); field `receiptDate` đổi thành `receiptMonth` (theo tháng, không có unique constraint theo tháng — khác Revenue/Ads, `AdminReceipt` vẫn cho nhiều dòng/tháng).
- `revenue.service.ts` — `createRevenue()` là upsert thật (ghi đè nếu đã có record active cùng Page+tháng, trả thêm `wasUpdate`), `updateRevenue()` reject nếu dời sang Page+tháng đã có record khác (`MONTH_CONFLICT`) — cùng khuôn `ads.service.ts` đã có từ trước, field `revenueDate` đổi thành `revenueMonth`.
- `salary.service.ts` — `setEmployeeSalary()` không nhận `effectiveFrom` từ client nữa (luôn là ngày hôm nay, resolve ở `employee.actions.ts`); sửa cùng ngày trong 1 tháng thì `UPDATE` đè lên record đang active thay vì đóng+tạo mới (tránh SalaryHistory rỗng khoảng thời gian).

Cả:

- Web route (Server Component).
- Server Action.
- API/Route Handler.
- MCP tool.

đều gọi service — không duplicate business logic.

**Lớp thực tế giữa UI và Service (khác bản đề xuất gốc):** `server/actions/*.actions.ts` (VD `employee.actions.ts`, `page.actions.ts`, `revenue.actions.ts`) — Server Action mỏng: `requireAdmin()` (RBAC) → parse input qua Zod schema server-side → gọi service → `revalidatePath`. Tách riêng khỏi `server/services/` để service layer không phụ thuộc `next/headers`/RBAC, tái dùng được thẳng từ MCP tools (Phase 15+) mà không kéo theo Next.js request-scope.

**Ghi audit log không phải một `.service.ts` riêng** — là một helper dùng chung `server/audit/log-action.ts` (hàm `logAction()`), được gọi trực tiếp từ cuối mỗi hàm service sau khi mutation thành công (không đặt `server-only` để MCP tools cũng dùng lại được). **Đọc/search audit log thì có** — `audit.service.ts` (Phase 12, mục 29) — hai hướng ghi/đọc tách file vì bản chất khác nhau (helper side-effect gọi từ nơi khác vs. service có state/nhiều hàm query thật).

---

# 36. Domain rule: resolve Page owner

Central function:

```text
resolvePageOwner(pageId, occurredAt)
```

Algorithm:

1. Find PageAssignment:
   - page_id = pageId
   - started_at <= occurredAt
   - ended_at is null OR ended_at > occurredAt
2. Nếu không có → error.
3. Nếu nhiều hơn một → data integrity error.
4. Return employee + assignment.

Hàm này bắt buộc dùng khi tạo/sửa:

- Revenue.
- Ads.

**Chữ ký thật đã implement:** `resolvePageOwner(pageId, occurredAt, client = prisma)` — tham số `client` thứ ba (tuỳ chọn, kiểu `Prisma.TransactionClient | typeof prisma`) cho phép gọi hàm này **bên trong** một `prisma.$transaction(...)` đang mở. `createRevenue`/`updateRevenue`/`createAdExpense`/`updateAdExpense` đều resolve-rồi-ghi trong cùng transaction (xem mục 44) để tránh race condition nếu có Transfer Page xảy ra đồng thời.

---

# 37. Reporting queries

## Employee Revenue

Group Revenue by:

- employee_id_snapshot
- revenue_month (đã là mốc tháng sẵn — không cần hàm `month()`, xem §4, user request 2026-08-18)

## Employee Ads

Group AdExpense by:

- employee_id_snapshot
- expense_month (đã là mốc tháng sẵn — không cần hàm `month()`, xem §6 Phase 6)

## Page Purchase

Group PagePurchaseExpense by:

- employee_id_snapshot
- purchase_month (đã là mức tháng, không cần bọc thêm month())

## Salary

Tính salary dựa trên SalaryHistory active trong tháng.

**Cập nhật (Phase 7, đã implement — chi tiết đầy đủ ở mục 10.2):** áp dụng khi tính theo một tháng cụ thể (Salary = mức active vào ngày 1 tháng đó). Khi tính all-time/không lọc theo tháng (Employee List bỏ trống filter, Employee Detail Summary, `/user/costs`, `/user/dashboard`), Salary dùng công thức **cộng dồn theo lịch sử** thay vì "active trong tháng" của một tháng đơn lẻ — xem mục 10.2.

**Cập nhật (Phase 11, đã implement — Tổng lương hệ thống, khác Salary theo từng nhân viên ở trên):** `dashboard.service.ts` tính Tổng lương hệ thống (mục 10.3/11.1) bằng cách quét thẳng **toàn bộ** `SalaryHistory` đang active vào ngày 1 của tháng và cộng dồn trực tiếp — **không** cần lặp/group theo `employee_id` như Employee List (mục 14.1) hay Bảng nhân viên trên Dashboard (mục 11.3), vì tối đa một record active/nhân viên tại một thời điểm (partial unique index `salary_history_one_active_per_employee`, xem `context/schema.md`) nên tổng phẳng toàn bộ record active đang có = đúng tổng hệ thống.

## Total Expenses

Sum:

- Ads.
- Page Purchase.
- Salary.
- Admin Expense.

## Profit

`AdminReceipt - Total Expenses`

**Cập nhật (Phase 11, đã implement):** `getSystemFinancials(monthKey)` (`dashboard.service.ts`) tính đủ cả "Total Expenses" và "Profit" ở trên cho Admin Dashboard (mục 11.1) — dùng thẳng 2 công thức này, không viết lại. `Total Received`/`Total Page Revenue` (mục 9/10.4) vẫn giữ nguyên tách biệt, không join/sum chung (đã ghi chú từ `receipt.service.ts`, mục 20).

---

# 38. Admin Navigation

Sidebar (`src/lib/nav-config.ts`, nhãn tiếng Việt thật đã implement):

```text
Bảng điều khiển                       /admin/dashboard

Nhân sự
  Nhân viên                           /admin/employees
  Admin                                /admin/admins

Page
  Tất cả Page                         /admin/pages

Tài chính
  Doanh thu                           /admin/revenue
  Ads                                 /admin/ads
  Lương                               /admin/salary
  Tài nguyên                          /admin/expenses
  Tiền đã nhận                        /admin/receipts
  Tiền nhân viên đã nhận              /admin/employee-receipts

Cài đặt
  Loại trạng thái Page                /admin/settings/page-status-options
  Tài khoản                           /admin/settings/users
  MCP / API                           /admin/settings/mcp
  Audit Log                           /admin/settings/audit
  Hồ sơ                               /admin/profile
```

**Cập nhật (bổ sung sau Phase 13, đã xác nhận với user 2026-08-17):** thêm mục **Salary** (`/admin/salary`) vào nhóm Finance — trang xem/đổi lương tập trung cho toàn bộ nhân viên (thay vì chỉ vào được qua từng Employee Detail như mục 14.3 "Change salary"). Không đổi cơ chế tính đã chốt ở mục 59 ("Admin nhập salary cố định một lần... không cần tạo transaction salary mỗi tháng") — trang này tái dùng nguyên `SalaryHistory`/`setEmployeeSalary()`/audit `CHANGE_SALARY` đã có từ Phase 3, chỉ thêm UI liệt kê + tìm kiếm nhân viên theo tên/email và mở dialog "Đổi lương" ngay từ danh sách.

**Cập nhật ngày 2026-08-18 (đồng bộ theo mã nguồn thật):** 2 thay đổi tích luỹ trong phiên "Phase 13.1" (xem `context/plan.md`) không còn khớp với bản liệt kê Sidebar ở trên trước khi sửa: (1) thêm mục **"Loại trạng thái Page"** (`/admin/settings/page-status-options`, icon `Palette`) vào nhóm Cài đặt — quản lý picklist `PageStatusOption` dùng chung cho mọi Page (mục 15.3); (2) đổi nhãn **"Admin Expenses" → "Tài nguyên"** (href `/admin/expenses` giữ nguyên, chỉ đổi tên hiển thị — không đổi entity `AdminExpense`/route). "Admin Receipts" hiển thị thật là **"Tiền đã nhận"**.

**Cập nhật ngày 2026-08-19 (bỏ mục "Lịch sử thao tác" khỏi Sidebar — xem `context/plan.md` Phase 16.1):** mục "Lịch sử thao tác" (`/admin/activity`, icon `Activity`) từng thêm vào Sidebar ngày 2026-08-19 (mục 11.4) đã **bỏ hẳn cùng ngày** theo yêu cầu tiếp theo của user — tính năng gộp lại vào `/admin/dashboard` dạng card có phân trang (mục 11.4), không còn route/nav item riêng. Bản liệt kê Sidebar ở trên đã cập nhật, không còn dòng này.

**Cập nhật ngày 2026-08-19 (thêm "Lợi nhuận NV" — user request "tách lợi nhuận của nhân viên đó... thêm mục coi như là chi phí của nhân viên sao cho điều chỉnh lợi nhuận về mức 0", xác nhận qua `AskUserQuestion`):** thêm mục **"Lợi nhuận NV"** (`/admin/profit-settlements`, icon `TrendingUp`) vào cuối nhóm Tài chính. Trang chỉ liệt kê nhân viên đang có "Lợi nhuận đang chạy" dương (mục 10.2 cập nhật) kèm nút "Chốt về 0" — tự tính số tiền, không nhập tay.

**Cập nhật ngày 2026-08-19, sau đó cùng ngày (user request "gộp lợi nhuận nv với quản lý nhân viên", chọn phương án "thêm cột Lợi nhuận + nút Chốt ngay trong Employee List"): bỏ hẳn route/nav item riêng ở trên — đảo lại mục Changelog ngay trên.** `/admin/profit-settlements` xoá hẳn (không còn nav item "Lợi nhuận NV"); cột "Lợi nhuận" + nút "Chốt về 0" (chỉ hiện khi > 0) chuyển thẳng vào Employee List (mục 14.1) — cho **mọi** nhân viên, không chỉ người có lợi nhuận dương như trang cũ. Chi tiết đầy đủ: `context/schema.md` entity `EmployeeProfitSettlement`, mục 14.1.

**Cập nhật ngày 2026-08-19 (thêm "Hồ sơ" — Phase 17 polish, sau khi user nhận thấy Admin không có trang xem thông tin cá nhân như User đã có ở mục 39):** thêm mục **"Hồ sơ"** (`/admin/profile`, icon `User`) vào cuối nhóm Cài đặt. Trang hiển thị: Họ tên, Email, Ngày tạo tài khoản, và tổng hợp tài chính tất cả-thời-gian của chính Admin đó (Tiền đã nhận/Tổng đã chi/Lợi nhuận) — tái dùng nguyên `getAdminSpendingBreakdown()` đã có sẵn từ Admin Dashboard (mục 11.4 "Chi phí & Tiền đã nhận theo Admin"), lọc ra đúng dòng của Admin đang đăng nhập, không tạo query mới. RBAC qua `requireAdmin()` như mọi route `/admin/*` khác, luôn resolve theo session của chính người xem — không nhận `adminId` từ client.

**Cập nhật ngày 2026-08-20 (thêm mục "Admin" — user request "thêm cho tôi tab admin giống tab nhân viên, cũng click detail admin xem admin đã chi và nhận như nào"):** thêm mục **"Admin"** (`/admin/admins`, icon `ShieldCheck`) vào nhóm Nhân sự, ngay dưới "Nhân viên". `AdminsPage` (List) liệt kê mọi Admin (Tên/Tiền đã nhận/Tổng đã chi/Lợi nhuận, all-time, không phân trang/filter — quy mô cố định 2 Admin, cùng tiền lệ đơn giản hoá đã áp dụng cho `McpClient`/`PageStatusOption` list) — click tên vào `/admin/admins/[adminId]` (Detail), hiển thị 3 card tổng (Tiền đã nhận/Tổng đã chi/Lợi nhuận) + 4 card breakdown theo loại chi phí (Ads/Mua Page/Chi phí chung/Lương). **100% tái dùng `getAdminSpendingBreakdown()`** đã có sẵn (không viết query mới) — cùng nguồn dữ liệu đã dùng cho bảng "Chi phí & Tiền đã nhận theo Admin" ở Admin Dashboard (mục 11.1) và `/admin/profile` (mục ngay trên, vốn chỉ xem được chính mình). Khác `/admin/profile`: Detail này cho xem **bất kỳ** Admin nào (không giới hạn theo session), nên có thêm breakdown 4 loại chi phí mà Profile không hiển thị. Component `SummaryStat` (trước đây định nghĩa cục bộ trong `admin/employees/[employeeId]/page.tsx`) được tách ra `components/shared/summary-stat.tsx` để dùng chung giữa Employee Detail và Admin Detail, tránh trùng lặp.

**Cập nhật tiếp ngay sau đó cùng ngày (user request "tôi cần bảng giống nhân viên thay vì tổng lại"): bỏ 4 card breakdown theo loại, thay bằng 2 bảng chi tiết từng dòng giao dịch — đúng bản chất "giống Employee Detail" hơn (bảng "Chi tiết chi phí" ở đó vốn liệt kê từng dòng, không phải tổng theo loại).** Vấn đề: `getAdminSpendingBreakdown()` chỉ trả **tổng** theo 4 loại (Ads/Mua Page/Chi phí chung/Lương), không có dòng giao dịch riêng lẻ — 4 service list function liên quan (`listAdExpenses`, `listAdminExpenses`, `listAdminReceipts`) trước đó chỉ filter theo `createdByAdminId`/`employeeId`, không có filter theo **`paidByAdminId`**/**`receivedByAdminId`** (người thực chi/thực nhận — khác người nhập record). Đã thêm: (1) filter `paidByAdminId` vào `ListAdExpenseParams`/`listAdExpenses` (`ads.service.ts`) và `ListAdminExpensesParams`/`listAdminExpenses` (`admin-expense.service.ts`); (2) filter `receivedByAdminId` vào `ListAdminReceiptsParams`/`listAdminReceipts` (`receipt.service.ts`); (3) hàm mới `listPagePurchaseExpensesByAdmin(adminId)` (`page.service.ts`, mirror `listPagePurchaseExpensesByEmployee`) — `PagePurchaseExpense` không có filter sẵn nào theo admin; (4) hàm mới `listActiveSalariesByAdmin(adminId)` (`salary.service.ts`) — trả mọi `SalaryHistory` đang hiệu lực (`effectiveTo=null`) mà Admin này trả, cùng convention "chỉ hiện giai đoạn đang hiệu lực" đã dùng cho Employee Detail/`/user/costs`. `AdminDetailPage` merge 4 nguồn (Ads/Mua Page/Lương/Chi phí chung) thành bảng "Chi tiết đã chi" (cột Loại/Nội dung — Page hoặc nhân viên hoặc mô tả tuỳ loại/Tháng/Số tiền/Ghi chú, sort theo ngày giảm dần, giống hệt cấu trúc `costDetailRows` của Employee Detail) + bảng "Chi tiết đã nhận" riêng từ `listAdminReceipts` (cột Tháng/Số tiền/Nguồn/Ghi chú). 3 card tổng (Tiền đã nhận/Tổng đã chi/Lợi nhuận) ở đầu trang **giữ nguyên** — chỉ phần breakdown theo loại đổi từ card sang bảng.

---

# 39. User Navigation

Sidebar (`src/lib/nav-config.ts`, nhãn tiếng Việt thật đã implement):

```text
Bảng điều khiển                       /user/dashboard
Page của tôi                          /user/pages
Doanh thu                             /user/revenue
Chi phí                               /user/costs
Tiền đã nhận                          /user/employee-receipts
Hồ sơ                                 /user/profile
```

**Cập nhật ngày 2026-08-19 (đồng bộ theo mã nguồn thật):** bản liệt kê gốc dùng nhãn tiếng Anh placeholder ("Dashboard"/"My Pages"/...) và không ghi href — thay bằng nhãn tiếng Việt thật + href đúng theo `nav-config.ts`, cùng format với §38 Admin Navigation.

**Cập nhật ngày 2026-08-19, ngay sau đó cùng ngày (theo yêu cầu user "chuyển tab sang sidebar trái giống admin" — xem `context/plan.md` Phase 16.1): 2 thay đổi thật.** (1) **Đổi component điều hướng** — trước đó là top navbar ngang (`UserNavbar`/`UserNavItem`, đã xoá hẳn) dù đề mục này gọi là "Sidebar"; giờ **thật sự là sidebar trái** (`UserSidebar` + `UserTopbar`, `src/components/layout/`), dùng lại đúng `SidebarNavItem` mà Admin Sidebar (mục 38) đang dùng — nên "Sidebar" ở đầu mục này giờ mới đúng nghĩa đen. Nút "Đăng xuất" ở đáy `UserSidebar` gọi thẳng `logoutAction()` (`SidebarLogoutButton` mới) — khác nút tương đương bên Admin Sidebar hiện chưa có `onClick` (bug tồn tại từ trước, ngoài phạm vi sửa lần này). (2) **Thêm mục "Tiền đã nhận"** (`/user/employee-receipts`, icon `PiggyBank`) — xem `EmployeeReceiptListItem` mục 20a, trang read-only xem khoản `EmployeeReceipt` của chính mình.

---

# 40. UI Style

Phong cách Stripe:

- Background sáng.
- Sidebar đơn giản.
- Border nhẹ.
- Không dùng quá nhiều màu.
- KPI typography lớn.
- Chart đơn giản.
- Bảng dễ scan.
- Khoảng trắng rộng.
- Responsive desktop-first.
- Loading skeleton.
- Empty state rõ ràng.
- Confirmation modal cho delete/transfer.

Dark Mode không bắt buộc V1.

---

# 41. Search

Search theo từng list screen (không phải global search bar dùng chung), debounce 300ms, URL-sync qua param `q`:

- Employee name / email (`/admin/employees`).
- Page name / Facebook URL (`/admin/pages`).
- Revenue: Page name / ghi chú (`/admin/revenue`).
- Ads: Page name / ghi chú (`/admin/ads`).

Không cần full-text search engine riêng với quy mô hiện tại.

PostgreSQL `ILIKE` là đủ.

**Cập nhật (Phase 12, đã implement):** `/admin/settings/audit` cũng có ô search, cùng component `SearchInput` (`paramKey="entityId"`, debounce 300ms, URL-sync qua `q`→`entityId`) — nhưng match theo **exact equality**, không phải `ILIKE`, vì tìm theo `entity_id` (cột `@db.Uuid`, không phải text) chứ không phải theo tên/ghi chú như 4 màn hình trên.

**Cập nhật (Phase 13, đã implement):** `/admin/settings/users` (nhân viên/tên tài khoản/email, `listUserAccounts`) và `/admin/salary` (tên/email nhân viên, `listEmployeeSalaries`) cũng có `SearchInput` chuẩn `ILIKE` như nhóm 4 màn hình đầu tiên.

---

# 42. Pagination

Server-side pagination.

Default:

`20 rows/page`

Options:

- 20
- 50
- 100

Áp dụng:

- Employees.
- Pages.
- Revenue.
- Ads.
- Expenses.
- Receipts.
- Audit.
- Salary (`/admin/salary`, Phase 3/14.3).
- Settings — Users (`/admin/settings/users`, Phase 13).
- Employee Receipts (`/admin/employee-receipts` và `/user/employee-receipts`, mục 20a/39).

**Cập nhật ngày 2026-08-19 (đồng bộ theo mã nguồn thật, xem `context/plan.md` Phase 16.1): "Lịch sử thao tác" trên Admin Dashboard (mục 11.4) cũng có phân trang server-side, nhưng KHÔNG dùng default/options ở trên** — mặc định **5 dòng/trang**, tuỳ chọn `[5, 10, 20]` (không phải 20/50/100) — vì đây là 1 card hẹp (1/3 chiều rộng) trong Dashboard, không phải trang list riêng như các mục kể trên.

**Cập nhật ngày 2026-08-19 (theo yêu cầu user "tất cả bảng thêm cột số thứ tự"): mọi `<Table>` trong hệ thống (25 bảng/19 trang, cả Admin lẫn User — kể cả bảng không phân trang) đều có thêm cột **STT** làm cột đầu tiên.** Bảng có phân trang: STT tính theo vị trí **toàn cục**, `(page-1)×pageSize + index + 1` (không reset về 1 mỗi khi sang trang). Bảng không phân trang (vd các tab trong Employee/Page Detail): STT = `index + 1` đơn giản. Không phải yêu cầu kỹ thuật ảnh hưởng service layer — thuần UI, không đổi API/props các hàm `list*()` đã có.

---

# 43. Validation

## Amount

- Integer.
- >= 0.
- VND.

Không cho NaN/floating precision.

## Facebook URL

Validate URL format.

Không bắt buộc gọi Facebook API.

## Email

Unique.

Case-insensitive.

## Date

Không cho record financial thiếu ngày.

## Assignment

Không overlap.

## Page transfer

New employee phải ACTIVE.

---

# 44. Transactions

Các operation sau bắt buộc database transaction:

## Create Page

- Page.
- Assignment.
- Purchase expense.
- Audit.

## Transfer Page

- Close old assignment.
- Create new assignment.
- Audit.

## Change salary

- Close salary old.
- Create salary new.
- Audit.

## Create/Update Revenue (đã implement, không có trong bản đề xuất gốc)

- Resolve owner (`resolvePageOwner`) và ghi record trong **cùng một** `prisma.$transaction` — tránh race condition nếu Transfer Page xảy ra giữa lúc resolve và lúc ghi.
- Audit (ngoài transaction, sau khi commit thành công).

## Create/Update AdExpense (đã implement, không có trong bản đề xuất gốc)

- Resolve owner tại **ngày 1 của tháng** + kiểm tra record active đã tồn tại cho `(page_id, expense_month)` chưa + ghi (update nếu đã tồn tại, insert nếu chưa) — tất cả trong cùng một `prisma.$transaction`.
- Audit: `CREATE` nếu record mới, `UPDATE` nếu ghi đè record đã tồn tại cho cùng Page + tháng (§6).

---

# 45. Concurrency

Khi Transfer Page:

- Lock/check active assignment.
- Không cho hai Admin transfer cùng Page tạo overlap.

Sử dụng database transaction và unique/data constraints phù hợp.

---

# 46. API/Internal actions

Không nhất thiết cần public REST API trong V1.

Có thể dùng:

- Server Actions cho form CRUD.
- Route Handlers cho MCP/API integrations.

Nếu tạo API:

```text
/api/admin/employees
/api/admin/pages
/api/admin/revenue
/api/admin/ads
/api/admin/expenses
/api/admin/receipts
/api/admin/dashboard
```

Tất cả route admin phải enforce role server-side.

Không dựa vào hide button ở frontend.

---

# 47. Security

Bắt buộc:

- Password hashing.
- Secure session.
- RBAC server-side.
- Zod input validation.
- Parameterized queries qua Prisma.
- Rate limiting login.
- Rate limiting MCP.
- API key hashing.
- Audit logs.
- Soft delete financial data.
- Secrets trong environment variables.
- Không expose DB credentials frontend.
- Không expose MCP secret frontend.

---

# 48. MCP security

Claude Code có Admin Full nên cần:

- API key riêng.
- Key có thể revoke.
- Không dùng tài khoản/password của Admin người dùng.
- Audit actor phải ghi `MCP`.
- Mỗi tool call có `requestId`.
- Rate limit.
- Input schema nghiêm ngặt.
- Không có MCP tool `execute_sql`.
- Không có MCP tool `run_raw_query`.
- Không cho AI bypass Service Layer.

---

# 49. Environment Variables

**Cập nhật (rà soát 2026-08-19, đối chiếu trực tiếp `process.env.*` trong `src/`):** chỉ 2 biến sau thật sự được code đọc lúc runtime. Đây là danh sách bắt buộc phải khai trên Vercel/mọi môi trường (xem mục 23 "Deployment"):

```env
DATABASE_URL=
AUTH_SECRET=
```

Thêm cho môi trường dev (chỉ dùng bởi `prisma/seed.ts`, có fallback mặc định nếu để trống — không dùng cho production):

```env
SEED_ADMIN1_EMAIL=
SEED_ADMIN1_PASSWORD=
SEED_ADMIN2_EMAIL=
SEED_ADMIN2_PASSWORD=
```

**`APP_URL`/`MCP_MASTER_SECRET` đã bỏ khỏi danh sách** — đây là leftover từ thiết kế MCP ban đầu (trước khi chốt phương án xác thực per-client API key ở Phase 14/15, xem mục 31), không còn được bất kỳ code nào đọc. Nếu `.env.example` cục bộ vẫn còn 2 dòng này, có thể xoá an toàn.

Không commit `.env`.

Tạo `.env.example`.

---

# 50. Suggested Project Structure

Cấu trúc thực tế tính đến Phase 16.1 (khác bản đề xuất gốc ở vài điểm, giải thích bên dưới):

```text
src/
  app/
    (auth)/
      login/page.tsx
    api/
      mcp/route.ts           ✅ Phase 15 — Route Handler duy nhất phục vụ MCP server thật (`createMcpHandler`, stateless), export GET/POST/DELETE cùng trỏ vào 1 hàm xác thực + rate-limit + forward
    admin/
      layout.tsx
      dashboard/               (page.tsx + loading.tsx — skeleton riêng, Phase 11; month filter chuẩn `MonthFilter`, bỏ trống = all-time, mục 11.1; card "Lịch sử thao tác" có phân trang thật, mục 11.4 — từng tách route riêng `activity/` cùng ngày rồi gộp lại)
      employees/               (list, [employeeId]/, new/)
      pages/                   (list, [pageId]/, new/)
      revenue/
      ads/
      expenses/                ✅ Phase 9 — UI hiển thị "Tài nguyên" (đổi tên hiển thị Phase 13.1, route/entity AdminExpense giữ nguyên)
      receipts/                ✅ Phase 10
      employee-receipts/       ✅ (mục 20a — "Tiền nhân viên đã nhận", thêm 2026-08-18)
      salary/                  ✅ (mục 14.3 — danh sách lương hiện tại mọi nhân viên, Set Salary dialog)
      settings/
        page-status-options/   ✅ Phase 13.1 (mục 15.3 — picklist "Loại trạng thái Page")
        users/                 ✅ Phase 13
        mcp/                   ✅ Phase 14 (mục 30-31 — list/create/revoke McpClient qua UI; MCP server thật chạy tại `app/api/mcp/route.ts`, xem bên dưới)
        audit/                 ✅ Phase 12
    user/
      layout.tsx               ✅ dùng `UserSidebar`+`UserTopbar` (sidebar trái, mục 39 — đổi từ top navbar `UserNavbar` đã xoá, 2026-08-19)
      dashboard/                ✅ 2026-08-19 — 3 KPI Card (Page/Doanh thu hiện tại/Lợi nhuận all-time) + biểu đồ đường + donut "Cơ cấu chi phí" (mục 12)
      pages/                   ✅ Phase 13.1 — bảng giống `/admin/pages` (Page hiện tại + Sửa trạng thái), không còn bảng lịch sử
      revenue/                 ✅ Phase 13.1 — thêm Search
      costs/                   ✅ Phase 13.1 — thêm bảng "Chi tiết chi phí" (trước đó chỉ có KPI Card)
      employee-receipts/       ✅ (mục 20a/39, thêm 2026-08-19) — xem read-only `EmployeeReceipt` của chính mình
      profile/

  components/
    ui/                        shadcn/ui primitives (Button, Dialog, Select, Table, Tabs...) + combobox.tsx ✅ Phase 13.1 (wrap `@base-ui/react/combobox`, single-select có search, API tương thích `Select` để cắm thẳng vào Controller có sẵn)
    dashboard/                 KPI card (prop `tone="revenue"|"expense"|"profit"|"neutral"` cho màu số — mục 40), system-financials-chart.tsx (biểu đồ đường 6 tháng — line "Admin đã nhận" màu vàng `amber-tag` từ 2026-08-19), expense-breakdown-chart.tsx ✅ (mục 11.1 — donut "Cơ cấu chi phí", thêm 2026-08-18, tái dùng cho `/user/dashboard` từ 2026-08-19; Admin 4 lát Ads/Lương/Mua Page/Tài nguyên, User 4 lát Ads/Lương/Mua Page/Bù chi phí — 2 bộ nhãn khác nhau, cùng 1 component; layout donut+legend dùng Container Query `@xl:flex-row` (mục 23 "Frontend") thay vì viewport breakpoint, sửa 2026-08-19 sau khi tràn card ở tỷ lệ cột 2/5), recent-activity.tsx (Admin Dashboard, có phân trang thật từ 2026-08-19 — mục 11.4)
    layout/                    Sidebar, Topbar (Admin), UserSidebar, UserTopbar, sidebar-logout-button.tsx ✅ (User, 2026-08-19 — thay `user-navbar.tsx` đã xoá), nav item
    shared/                    EmptyState, LoadingSkeleton, PageHeader (prop `backHref?` — nút "← Quay lại" trên Detail page, mục 16), ConfirmDialog
    tables/                    Pagination, SearchInput, StatusChip, FinanceFilters (month/employee/page), MonthFilter (chỉ tháng — Phase 7, mục 14.1/12), AdminExpenseFilters (month/category/admin — Phase 9, mục 19), AdminReceiptFilters (month/admin — Phase 10, mục 20), AuditFilters (entity_type/action/actor/khoảng ngày — Phase 12, mục 29), audit-badges.tsx (AuditActionChip/AuditActorTypeChip — Phase 12), audit-detail-dialog.tsx (dialog before/after diff — Phase 12), role-filter.tsx/role-chip.tsx (filter + badge Admin/User — Phase 13, mục 33), page-status-chip.tsx/page-status-chip-list.tsx (mục 15.3, Phase 13.1 — chip 1 màu / danh sách nhiều chip)
    forms/                     1 file/action — Create*Form/Dialog, Edit*Dialog, Delete*Button, Restore*Button (mới từ Phase 9, mục 19/28) — Admin Receipt (Phase 10) chỉ có Create/Edit/Delete, không có Restore; user-status-toggle.tsx (toggle Active/Inactive — Phase 13, mục 33); assign-employee-dialog.tsx chỉ còn Nhân viên/Ngày hiệu lực/Ghi chú — "Người chi" đã chuyển lên `create-page-form.tsx` (nhập 1 lần lúc tạo Page, không hỏi lại khi assign — mục 16/36); page-status-picker.tsx (Select multi-select cho form Create/Edit Page, mục 15.3), page-status-option-fields.tsx + create/edit-page-status-option-dialog.tsx + delete-page-status-option-button.tsx (CRUD picklist, Phase 13.1), edit-page-status-dialog.tsx (User-role, chỉ sửa Trạng thái — Phase 13.1, mục 12); create-mcp-client-dialog.tsx (Dialog tạo key + panel hiện plaintext một lần, không phải route riêng — Phase 14, mục 31), revoke-mcp-client-button.tsx (tái dùng `ConfirmDialog`, cùng pattern `delete-page-button.tsx` — Phase 14)

  server/
    auth/                      jwt.ts, session.ts, password.ts, rbac.ts, rate-limit.ts, actions.ts (login/logout)
    services/                  business logic thuần — xem mục 35
    actions/                   Server Actions mỏng (RBAC + Zod + gọi service) — xem mục 35, KHÔNG có trong bản đề xuất gốc
    validators/                Zod schema, tách client-safe schema và server `.transform()` schema
    audit/                     log-action.ts (helper ghi log, không phải service riêng) — xem mục 35; đọc/search log là `services/audit.service.ts` (Phase 12)

  lib/
    db.ts                      Prisma Client singleton (driver adapter @prisma/adapter-pg)
    money.ts                   formatVnd(); REVENUE_TEXT_CLASS/EXPENSE_TEXT_CLASS/profitTextClass() — màu đỏ/xanh theo mục 40
    dates.ts                   formatDate/formatMonth/currentMonthKey/formatRelativeTime (Phase 11)/formatDateTime (Phase 12, "dd/mm/yyyy HH:mm") (Asia/Ho_Chi_Minh)
    month.ts                   parseMonthKey/monthDateRange/shiftMonthKey (Phase 7, mục 35) — riêng biệt với logic tháng nội bộ của revenue.service.ts/ads.service.ts
    audit-labels.ts            nhãn tiếng Việt + tone màu cho AuditLog.action/entity_type free-form string (Phase 12, mục 29) — fallback về chuỗi gốc nếu gặp giá trị chưa liệt kê; action `REVOKE` (tone `error`) thêm ở Phase 14 cho McpClient — entity `McpClient` đã có nhãn sẵn từ trước, chưa dùng tới cho đến phase này
    nav-config.ts              Admin/User sidebar nav items
    page-status-colors.ts      preset màu picklist "Loại trạng thái Page" (mục 15.3, Phase 13.1) — chỉ dùng token đã có trong `globals.css`/DESIGN.md, không hex rời
    utils.ts                   `cn()` (clsx + `extendTailwindMerge`, không phải `twMerge` mặc định — chi tiết + lý do mục 23 "Frontend") — dùng trong mọi component `components/ui/*`

  generated/prisma/            Prisma Client output (generator "prisma-client", ESM) — gitignored, chạy `npx prisma generate` sau khi đổi schema

  proxy.ts                     route guard — Next.js 16 đổi tên "middleware.ts" → "proxy.ts" (cùng chức năng)

  mcp/                         ✅ Phase 15-16 (mục 30-32) — cấu trúc thực tế khác bản đề xuất gốc: 1 file `server.ts` đăng ký cả 31 tool (10 read + 21 write, mục 32) (không tách `tools/*.ts` theo domain — cùng lý do không có `server/repositories/`, quy mô ~vài chục tool không cần thêm lớp thư mục)
    server.ts                  buildMcpServer(mcpClientId) — factory per-request, registerTool() cho từng tool, gọi thẳng server/services/* có sẵn
    auth.ts                    verifyMcpRequest() — parse Bearer token, so hash qua mcp-client.service.ts, reject 401 nếu thiếu/sai/REVOKED
    tool-runner.ts             runMcpTool() — bọc mọi tool: response envelope (mục 34), ghi AuditLog actor_type=MCP (mục 29), map lỗi sang {code,message}
    rate-limit.ts              isMcpRateLimited() — in-memory sliding-window, cùng kiểu server/auth/rate-limit.ts (mục 48 "Rate limit")

prisma/
  schema.prisma
  migrations/
  seed.ts

tests/
  unit/                        service layer, đặt tên `<domain>-service.test.ts`
  integration/                 flow nhiều bước, đặt tên `<domain>-flow.test.ts`
```

**Khác biệt so với bản đề xuất gốc:**

- **`server/actions/`** — lớp mới không có trong bản gốc, tách Server Action (RBAC + validate + revalidate) khỏi Service Layer thuần, để service tái dùng được từ MCP mà không kéo theo `next/headers`/request-scope.
- **Không có `server/repositories/`** — Prisma được gọi trực tiếp trong Service Layer, không có lớp repository trung gian (quy mô dự án không cần thêm abstraction này).
- **Không có `server/permissions/`** — RBAC gộp vào `server/auth/rbac.ts` (`requireAdmin`/`requireUser`/`getCurrentUser`), không tách file riêng.
- **`server/audit/`** (ghi log, `logAction()`) tách khỏi `services/audit.service.ts` (đọc/search log, Phase 12) — ghi là 1 helper function dùng chung gọi từ cuối mọi mutation, đọc là service query thật có nhiều hàm, hai bản chất khác nhau nên không gộp chung 1 file.
- **`src/proxy.ts`** thay vì `middleware.ts` — đổi tên bắt buộc theo Next.js 16.
- **`src/generated/prisma/`** — thư mục output của Prisma Client (generator `prisma-client` kiểu mới, ESM), không có trong bản đề xuất gốc vì lúc đó chưa chọn generator.
- **`tests/`** — thư mục mới, dùng Vitest (xem mục 23 "Testing").
- **`components/ui/combobox.tsx`** (Phase 13.1) — không có trong bộ shadcn/ui gốc, tự viết wrap `@base-ui/react/combobox` vì cần Page picker có search khi số Page tăng lên (mục 17/18); API cố tình thu hẹp về `value`/`onValueChange: string` giống `Select` sẵn có, không lộ item object `{value,label}` gốc của Base UI ra ngoài, để không phải sửa lại `Controller`/Zod schema ở nơi gọi.
- **`server/services/page-status-option.service.ts`** (Phase 13.1) — service riêng cho picklist "Loại trạng thái Page" (mục 15.3), tách khỏi `page.service.ts` vì đây là CRUD một entity độc lập (`PageStatusOption`), không phải logic của chính `Page`.
- **`app/api/mcp/route.ts`** (Phase 15) — MCP server chạy như Next.js Route Handler (SDK `createMcpHandler`, web-standard `fetch`, chế độ stateless), không phải process `stdio` riêng như cách hiểu "MCP server" mặc định — phù hợp deploy serverless/Vercel (mục 23 "Tech Stack > MCP Server"/"Deployment" — deploy thật cùng một lần với Web App, đã xác nhận ở Phase 17.1). `src/mcp/` không tách `tools/*.ts` theo domain như bản đề xuất gốc (mục 50 gốc) — 1 file `server.ts` đăng ký cả 31 tool là đủ ở quy mô hiện tại, thêm `tool-runner.ts` (chưa có trong bản gốc) làm nơi dùng chung duy nhất cho response envelope + audit log của mọi tool call.

---

# 51. Seed Data

Development seed — mục tiêu đầy đủ:

- 2 Admin.
- 8 User.
- 20 demo Pages.
- Salary History.
- Page Assignments.
- Revenue.
- Ads.
- Admin Expenses.
- Admin Receipts.

**Hiện trạng (`prisma/seed.ts`):** 2 Admin (`upsert` theo email, đọc từ `SEED_ADMIN1/2_EMAIL/PASSWORD`, có fallback dev mặc định — mục 49). Seed ExpenseCategory (5 category, Phase 8) đã bị gỡ cùng toàn bộ tính năng (2026-08-18, xem mục 21). 8 User demo, 20 Page demo, Salary History, Assignments, Revenue, Ads, Admin Expenses/Receipts mẫu **chưa được seed tự động** — dữ liệu test hiện tại được từng phase tự tạo/dọn dẹp thủ công qua test fixture (`tests/`) hoặc thao tác tay qua UI, không phải qua `prisma db seed`. Sẽ bổ sung seed đầy đủ nếu cần dữ liệu demo cố định (chưa có trong kế hoạch `context/plan.md` hiện tại).

Không dùng seed production.

---

# 52. Testing

## Unit Tests

Quan trọng nhất:

- `resolvePageOwner`.
- Revenue snapshot.
- Ads snapshot.
- Page transfer.
- Salary effective date.
- Profit formula.
- Total Expenses formula.

## Integration Tests

### Case 1 — Page transfer

1. Page thuộc Employee A.
2. Revenue 10M.
3. Ads 2M.
4. Transfer sang B.
5. Revenue mới 20M.
6. Ads mới 3M.

Expected:

A:

- Revenue 10M.
- Ads 2M.

B:

- Revenue 20M.
- Ads 3M.

### Case 2 — Purchase price

1. Page mua 5M.
2. Gán A.
3. Transfer B.

Expected:

- A vẫn có Page Purchase Cost 5M.
- B có 0 Page Purchase Cost.

### Case 3 — Salary

Salary:

- Jan-Jun = 10M.
- Jul onward = 12M.

Expected:

- June report = 10M.
- July report = 12M.

---

# 53. Audit test

Khi MCP sửa revenue:

Audit phải ghi:

```text
actor_type = MCP
action = UPDATE
entity_type = REVENUE
entity_id = ...
before_json = ...
after_json = ...
```

---

# 54. Acceptance Criteria — Authentication

- Admin login được.
- User login được.
- User không mở được `/admin/*`.
- User không gọi được admin endpoints.
- Inactive user không login được.
- Logout hoạt động đúng.

---

# 55. Acceptance Criteria — Employees

- Admin CRUD employee.
- User chỉ xem bản thân.
- Email unique.
- Salary history hoạt động.
- Deactivate employee không xóa lịch sử.

---

# 56. Acceptance Criteria — Pages

- Admin tạo Page và gán employee.
- Purchase price tự ghi cost cho employee ban đầu.
- Transfer Page không thay đổi dữ liệu lịch sử.
- Assignment không overlap.
- User chỉ thấy Page thuộc/lịch sử của mình.

---

# 57. Acceptance Criteria — Revenue

- Admin nhập Revenue theo Page.
- Employee tự resolve.
- Revenue cũ giữ employee snapshot sau transfer.
- User chỉ thấy Revenue của mình.
- Filter theo month/page/employee hoạt động.

---

# 58. Acceptance Criteria — Ads

- Admin nhập Ads theo Page, theo tháng (§6, §18).
- Employee tự resolve theo owner vào ngày 1 của tháng.
- Ads cũ giữ employee snapshot kể cả khi Page transfer giữa tháng.
- Mỗi Page tối đa 1 record Ads active/tháng — nhập lại ghi đè, không tạo trùng.
- Filter hoạt động.
- Ads được cộng vào Employee Cost và Total Expenses.

---

# 59. Acceptance Criteria — Salary

- Admin nhập salary cố định một lần.
- Salary tự được tính cho report tháng.
- Không cần tạo transaction salary mỗi tháng.
- Khi đổi salary, tháng cũ không thay đổi.

---

# 60. Acceptance Criteria — Admin Finance

- Admin nhập Admin Receipt.
- Admin nhập Admin Expense.
- Total Received tính đúng.
- Total Expenses tính đúng.
- Profit = Total Received - Total Expenses.
- Page Revenue không bị nhầm với Admin Received.

---

# 61. Acceptance Criteria — MCP

Claude Code có thể:

- ✅ Query dashboard (Phase 15).
- ✅ Query employees (Phase 15).
- ✅ Query pages (Phase 15).
- ✅ Create/update employees, set salary, deactivate (Phase 16).
- ✅ Create/update pages, assign/transfer, delete (Phase 16 — `archive_page` bỏ hẳn, xem mục 32).
- ✅ Transfer Page (Phase 16).
- ✅ Create/update/delete revenue (Phase 16).
- ✅ Create/update/delete Ads (Phase 16).
- ✅ Create/update/delete Admin Expenses (Phase 16).
- ✅ Create/update/delete Admin Receipts (Phase 16).
- ✅ Query audit logs (Phase 15).

MCP:

- ✅ Không có raw SQL.
- ✅ Đi qua Service Layer.
- ✅ Ghi Audit (mọi tool call, kể cả read/thất bại — mục 29; write tool ghi đúng 1 dòng/lần sửa thành công với before/after thật, spec §53 — xem plan.md Phase 16).
- ✅ Enforce business rules (Phase 16 — không bypass Page Assignment/snapshot rules, kiểm chứng qua `transfer_page`/`assign_employee` MCP giữ nguyên snapshot cũ, `create_revenue`/`create_ad_expense` MCP vẫn qua `resolvePageOwner`).
- ✅ Soft delete (Phase 16 — mọi `delete_*` tool set `deleted_at`, không hard delete).
- Require confirmation cho destructive actions — chưa áp dụng (Phase 16).

---

# 62. V1 Scope

V1 bao gồm:

- Login.
- Admin/User RBAC.
- Employee management.
- Salary history.
- Page management.
- Page assignment history.
- Page purchase cost.
- Revenue.
- Ads.
- Admin expenses.
- Admin receipts.
- Dashboard.
- Employee detail.
- Page detail.
- Expense categories.
- Audit logs.
- MCP Full Admin.
- Responsive desktop UI.

---

# 63. Out of Scope V1

Chưa cần:

- Facebook Graph API.
- Tự động lấy revenue từ Meta.
- Excel import.
- Excel export.
- Multi-currency.
- Mobile app native.
- Approval workflow.
- Payroll calculation phức tạp.
- Tax.
- Accounting double-entry.
- Notification.
- File attachment/invoice.
- Super Admin.
- Team/department hierarchy.

---

# 64. Future Extensions

Có thể thêm sau:

- Facebook API integration.
- Auto-sync Page metrics.
- Revenue import.
- Invoice attachment.
- Telegram/Slack notification.
- Budget theo Page.
- Ads ROI.
- Employee performance metrics.
- Permission chi tiết hơn.
- AI natural-language finance assistant.
- Scheduled reports.
- Multi-company workspace.

---

# 65. Thứ tự triển khai đề xuất

**Cập nhật:** đây là đề xuất ban đầu ở mức phác thảo (6 nhóm, 30 mục), giữ nguyên bên dưới để tham khảo. **[`context/plan.md`](plan.md) là nguồn đúng cho thứ tự triển khai thật** — chia nhỏ thành 17 phase độc lập, test được, có "Điểm dừng" xin xác nhận user sau mỗi phase (**Setup → Auth/RBAC → Employee → Page/Assignment → Revenue → Ads → Employee/Page Detail + User Dashboard → Expense Categories → Admin Expenses → Admin Receipts → Admin Dashboard → Audit Log → Settings Users → Settings MCP — đã xong tính đến Phase 14** → MCP Read Tools → MCP Write Tools → Polish, xem checklist trạng thái đầy đủ ở đầu `context/plan.md`), khác cách nhóm 6-phase dưới đây. Khi 2 file lệch nhau về thứ tự/phạm vi từng phase, `plan.md` thắng — mục dưới đây chỉ còn giá trị mô tả ý định ban đầu.

## Phase 1 — Foundation

1. Next.js project.
2. PostgreSQL.
3. Prisma.
4. Auth.
5. RBAC.
6. Layout Admin/User.

## Phase 2 — Core data

7. Employee.
8. Salary History.
9. Page.
10. Assignment History.
11. Page Purchase.

## Phase 3 — Finance

12. Revenue.
13. Ads.
14. Admin Expense.
15. Admin Receipt.
16. Categories.

## Phase 4 — Reporting

17. Dashboard.
18. Employee Detail.
19. Page Detail.
20. Filtering.

## Phase 5 — Audit & MCP

21. Audit Service.
22. MCP authentication.
23. MCP read tools.
24. MCP write tools.
25. MCP destructive safety.

## Phase 6 — QA

26. Tests.
27. Seed.
28. Security review.
29. Performance check.
30. Production deploy.

---

# 66. Definition of Done

V1 được coi là hoàn thành khi:

- Hai Admin có thể cùng quản lý toàn bộ dữ liệu.
- User chỉ xem được dữ liệu của chính mình.
- Revenue/Ads tự xác định đúng owner dựa trên Page Assignment tại ngày phát sinh.
- Transfer Page không làm thay đổi lịch sử.
- Page Purchase cost luôn giữ nguyên employee ban đầu.
- Salary không cần nhập lại mỗi tháng nhưng report tháng vẫn tính đúng.
- Dashboard hiển thị đúng Revenue, Received, Expenses và Profit.
- Tất cả financial mutation có Audit Log.
- MCP Claude Code có thể CRUD tương đương Admin nhưng không bypass business rules.
- MCP không được cung cấp raw SQL access.
- Các bài test nghiệp vụ quan trọng đều pass.
