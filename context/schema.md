# Data Schema — Finance & Revenue Dashboard

Nguồn: `context/spec.md`. Đây là schema mức high-level (entity, field, kiểu dữ liệu, quan hệ, enum, ràng buộc) — chưa phải migration SQL chi tiết.

---

## Schema

### User

Tài khoản đăng nhập, giữ role và trạng thái.

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| name | string | ✅ | |
| email | string | ✅ | unique, case-insensitive |
| password_hash | string | ✅ | Argon2/bcrypt |
| role | enum `ADMIN\|USER` | ✅ | |
| status | enum `ACTIVE\|INACTIVE` | ✅ | default `ACTIVE` |
| created_at | timestamptz | ✅ | |
| updated_at | timestamptz | ✅ | |

Không có `deleted_at`. Vô hiệu hoá tài khoản dùng `status = INACTIVE` để giữ lịch sử liên kết (assignment, revenue snapshot...).

---

### EmployeeProfile

Hồ sơ nhân viên, tách khỏi `User` để mở rộng field nghiệp vụ sau này mà không đụng bảng auth.

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| user_id | UUID | ✅ | FK → User, unique (1-1), chỉ áp dụng cho `role = USER` |
| created_at | timestamptz | ✅ | |
| updated_at | timestamptz | ✅ | |

---

### SalaryHistory

Lịch sử mức lương theo thời gian — tránh phải tạo transaction lương mỗi tháng.

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| employee_id | UUID | ✅ | FK → EmployeeProfile |
| monthly_salary | BIGINT | ✅ | VND, >= 0 |
| effective_from | DATE | ✅ | |
| effective_to | DATE | ❌ | null = đang hiệu lực |
| created_by_admin_id | UUID | ✅ | FK → User — Admin **tạo** bản ghi |
| paid_by_admin_id | UUID | ✅ | FK → User — Admin **thực sự chi tiền** (xem Changelog) |
| created_at | timestamptz | ✅ | |
| updated_at | timestamptz | ✅ | |

**Ràng buộc:** các khoảng `[effective_from, effective_to)` của cùng một employee không được overlap; tối đa một record có `effective_to = null` tại một thời điểm.

---

### Page

Đơn vị trung tâm — Facebook Page nơi doanh thu/ads phát sinh.

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| name | string | ✅ | |
| facebook_url | string | ✅ | validate URL format |
| page_type | enum `SYSTEM\|BKT` | ✅ | default `BKT` (xem Changelog 2026-08-18). `SYSTEM` = Page hệ thống, không có giá mua (`purchase_price` luôn 0, `paid_by_admin_id` luôn null, không bao giờ có `PagePurchaseExpense`) — User có thể tự tạo + tự gán cho chính mình. `BKT` = flow trả phí hiện có, chỉ Admin tạo được |
| purchase_price | BIGINT | ✅ | VND, default 0, >= 0 |
| purchase_month | DATE | ✅ | luôn chuẩn hoá về ngày 1 của tháng (xem Changelog) |
| paid_by_admin_id | UUID | ❌ | FK → User — Admin **được chọn làm người chi** cho khoản mua; bắt buộc ở tầng service khi `purchase_price > 0` (bất kể đã gán nhân viên hay chưa), null khi `purchase_price = 0`. Dùng lại nguyên khi tạo `PagePurchaseExpense` sau này (xem Changelog) |
| notes | text | ❌ | |
| created_by_admin_id | UUID | ✅ | FK → User |
| created_at | timestamptz | ✅ | |
| updated_at | timestamptz | ✅ | |
| deleted_at | timestamptz | ❌ | soft delete |

`current_employee_id` **không** lưu trực tiếp trên Page (không cache) — luôn resolve từ `PageAssignment` đang active. Ở quy mô ~100 Page, query resolve là đủ rẻ; tránh rủi ro lệch dữ liệu giữa cache và source of truth.

Page **không** lưu trạng thái trực tiếp — xem `PageStatusAssignment` ngay dưới (many-to-many, user request 2026-08-18 "chọn nhiều trạng thái được", xem Changelog).

---

### PageStatusOption

Danh sách "loại trạng thái Page" do Admin quản lý tập trung (user request 2026-08-18, xem Changelog) — Cài đặt → "Loại trạng thái Page". Page tham chiếu qua bảng nối `PageStatusAssignment` (nhiều-nhiều), không tự nhập text/màu mỗi lần.

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| label | string | ✅ | max 30 ký tự |
| color | enum `GRAY\|GREEN\|BLUE\|AMBER\|RED\|ORANGE\|PURPLE\|PINK` | ✅ | preset swatch, không phải hex tự do |
| created_at | timestamptz | ✅ | |
| updated_at | timestamptz | ✅ | |

**Không soft-delete** — xoá qua UI là hard delete thật (entity đầu tiên trong hệ thống có hành vi này, xem Changelog). Xoá một option chỉ xoá đúng dòng `PageStatusAssignment` gắn với nó (`ON DELETE CASCADE`) — Page đang có nhiều trạng thái chỉ mất đúng trạng thái đó, các trạng thái khác giữ nguyên; nếu đó là trạng thái cuối cùng, Page rơi về "chưa đặt" (0 dòng assignment).

---

### PageStatusAssignment

Bảng nối nhiều-nhiều giữa `Page` và `PageStatusOption` (user request 2026-08-18 — một Page có thể mang nhiều "tag" trạng thái cùng lúc, thay vì chỉ một). Dùng bảng tường minh (không phải implicit M2M của Prisma) để có UUID PK + `created_at` thật, nhất quán với mọi table khác trong schema này (xem Conventions).

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| page_id | UUID | ✅ | FK → Page, `ON DELETE CASCADE` |
| status_option_id | UUID | ✅ | FK → PageStatusOption, `ON DELETE CASCADE` |
| created_at | timestamptz | ✅ | |

**Ràng buộc:** unique `(page_id, status_option_id)` — một Page không gán trùng cùng một loại trạng thái hai lần. Không có `updated_at` (chỉ tạo/xoá dòng, không sửa tại chỗ — đổi trạng thái nghĩa là xoá dòng cũ + tạo dòng mới, xử lý ở `updatePage()`).

---

### PageAssignment

Lịch sử gán Page cho nhân viên — **source of truth duy nhất** cho quyền sở hữu Page theo thời gian.

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| page_id | UUID | ✅ | FK → Page |
| employee_id | UUID | ✅ | FK → EmployeeProfile |
| started_at | DATE | ✅ | |
| ended_at | DATE | ❌ | null = đang active |
| assigned_by_admin_id | UUID | ✅ | FK → User |
| note | text | ❌ | |
| created_at | timestamptz | ✅ | |

**Ràng buộc:**
- Không overlap hai assignment cùng `page_id`.
- `ended_at > started_at` khi có giá trị.
- Tối đa một assignment active (`ended_at IS NULL`) mỗi Page — enforce bằng partial unique index `(page_id) WHERE ended_at IS NULL`.
- Một Page có thể **tạm thời hoặc lâu dài có 0 assignment** (chưa từng được gán nhân viên) — trạng thái hợp lệ, không phải lỗi dữ liệu (xem Changelog Phase 4). `resolvePageOwner`/Revenue/AdExpense vẫn reject rõ ràng nếu không có assignment hợp lệ tại ngày cần resolve.

---

### Revenue

Doanh thu theo Page, snapshot owner tại thời điểm phát sinh. Tính **theo tháng** (user request 2026-08-18, xem Changelog) — cùng cơ chế với AdExpense.

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| page_id | UUID | ✅ | FK → Page |
| employee_id_snapshot | UUID | ✅ | FK → EmployeeProfile |
| assignment_id_snapshot | UUID | ✅ | FK → PageAssignment |
| revenue_month | DATE | ✅ | luôn chuẩn hoá về ngày 1 của tháng (vd `2026-08-01`) |
| amount | BIGINT | ✅ | VND, >= 0 |
| note | text | ❌ | |
| created_by_admin_id | UUID | ✅ | FK → User |
| created_at | timestamptz | ✅ | |
| updated_at | timestamptz | ✅ | |
| deleted_at | timestamptz | ❌ | soft delete |

**Ràng buộc:** tối đa **một record đang hoạt động** (`deleted_at IS NULL`) cho mỗi cặp `(page_id, revenue_month)` — partial unique index `revenues_page_month_unique`. Nhập lại cho Page + tháng đã có sẽ **ghi đè số tiền/ghi chú** của record đó (log `AuditLog action=UPDATE`), không tạo thêm dòng thứ hai — giống hệt AdExpense.

Khi update `page_id` hoặc `revenue_month`, backend resolve lại `employee_id_snapshot`/`assignment_id_snapshot` qua `resolvePageOwner(pageId, monthStart)` — vì `revenue_month` luôn là ngày 1, owner được chốt theo **nhân viên phụ trách vào đầu tháng đó**, dù Page có transfer giữa tháng hay không.

---

### AdExpense

Chi phí Ads theo Page, cùng cơ chế snapshot như Revenue — nhưng tính **theo tháng**, không theo ngày (xem Changelog Phase 6).

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| page_id | UUID | ✅ | FK → Page |
| employee_id_snapshot | UUID | ✅ | FK → EmployeeProfile |
| assignment_id_snapshot | UUID | ✅ | FK → PageAssignment |
| expense_month | DATE | ✅ | luôn chuẩn hoá về ngày 1 của tháng (vd `2026-02-01`) |
| amount | BIGINT | ✅ | VND, >= 0 |
| note | text | ❌ | |
| created_by_admin_id | UUID | ✅ | FK → User — Admin **tạo** bản ghi |
| paid_by_admin_id | UUID | ✅ | FK → User — Admin **thực sự chi tiền** (có thể khác `created_by_admin_id`, xem Changelog) |
| created_at | timestamptz | ✅ | |
| updated_at | timestamptz | ✅ | |
| deleted_at | timestamptz | ❌ | soft delete |

Ràng buộc: tối đa **một record đang hoạt động** (`deleted_at IS NULL`) cho mỗi cặp `(page_id, expense_month)` — partial unique index `ad_expenses_page_month_unique`, khai báo bằng `@@unique(..., where: raw("deleted_at IS NULL"))` (preview feature `partialIndexes`) trong `prisma/schema.prisma`, cùng cơ chế với `salary_history_one_active_per_employee`/`page_assignment_one_active_per_page` (xem Changelog). `employee_id_snapshot`/`assignment_id_snapshot` resolve qua `resolvePageOwner(pageId, expense_month)` — vì `expense_month` luôn là ngày 1, owner được chốt theo **nhân viên phụ trách vào đầu tháng đó**, dù Page có transfer giữa tháng hay không.

---

### PagePurchaseExpense

Chi phí mua Page, tạo **đúng một lần** (nếu `purchase_price > 0`) — cùng lúc với **PageAssignment đầu tiên** của Page đó, dù thời điểm đó là lúc tạo Page (nếu Admin gán nhân viên ngay) hay muộn hơn (nếu tạo Page chưa gán ai, gán sau qua action Assign Employee — xem Changelog Phase 4). Snapshot vĩnh viễn cho nhân viên nhận Page đầu tiên đó — không đổi theo transfer sau này.

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| page_id | UUID | ✅ | FK → Page, unique |
| employee_id_snapshot | UUID | ✅ | FK → EmployeeProfile |
| assignment_id_snapshot | UUID | ✅ | FK → PageAssignment (assignment đầu tiên) |
| purchase_month | DATE | ✅ | luôn chuẩn hoá về ngày 1 của tháng, snapshot từ `Page.purchase_month` (xem Changelog) |
| amount | BIGINT | ✅ | VND, >= 0 |
| created_by_admin_id | UUID | ✅ | FK → User — Admin **tạo** bản ghi |
| paid_by_admin_id | UUID | ✅ | FK → User — Admin **thực sự chi tiền** (xem Changelog) |
| created_at | timestamptz | ✅ | |
| updated_at | timestamptz | ✅ | |
| deleted_at | timestamptz | ❌ | soft delete |

---

### AdminExpense

Chi phí chung không gắn Page/nhân viên cụ thể (tool, server, văn phòng...). **Không còn danh mục hoá** — field `category_id` (FK → `ExpenseCategory`) đã bị gỡ bỏ cùng toàn bộ entity `ExpenseCategory` (xem Changelog "Bỏ hẳn tính năng Expense Categories").

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| expense_date | DATE | ✅ | |
| amount | BIGINT | ✅ | VND, >= 0 |
| description | string | ✅ | nội dung chính |
| note | text | ❌ | ghi chú thêm |
| created_by_admin_id | UUID | ✅ | FK → User — Admin **tạo** bản ghi |
| paid_by_admin_id | UUID | ✅ | FK → User — Admin **thực sự chi tiền** (xem Changelog) |
| created_at | timestamptz | ✅ | |
| updated_at | timestamptz | ✅ | |
| deleted_at | timestamptz | ❌ | soft delete |

---

### AdminReceipt

Tiền Admin **thực tế** đã nhận — tách biệt với doanh thu Page.

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| receipt_month | DATE | ✅ | luôn chuẩn hoá về ngày 1 của tháng (xem Changelog); **không** có unique constraint theo tháng — nhiều khoản nhận/tháng vẫn được phép (spec §9) |
| amount | BIGINT | ✅ | VND, >= 0 |
| source | string | ✅ | nguồn/mô tả khoản nhận |
| note | text | ❌ | |
| created_by_admin_id | UUID | ✅ | FK → User — Admin **nhập liệu** (xem Changelog) |
| received_by_admin_id | UUID | ✅ | FK → User — Admin **thực sự nhận tiền** (có thể khác `created_by_admin_id`, xem Changelog) |
| created_at | timestamptz | ✅ | |
| updated_at | timestamptz | ✅ | |
| deleted_at | timestamptz | ❌ | soft delete |

---

### EmployeeReceipt

Tiền nhân viên **thực tế** đã nhận (user request 2026-08-18) — thuần bản ghi để xem, **không** cộng vào Employee Cost/Revenue (`getEmployeeFinancials`) hay bất kỳ công thức tài chính nào khác trong hệ thống.

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| employee_id | UUID | ✅ | FK → EmployeeProfile |
| receipt_month | DATE | ✅ | luôn chuẩn hoá về ngày 1 của tháng |
| amount | BIGINT | ✅ | VND, >= 0 |
| note | text | ❌ | |
| created_by_admin_id | UUID | ✅ | FK → User — Admin nhập liệu |
| created_at | timestamptz | ✅ | |
| updated_at | timestamptz | ✅ | |
| deleted_at | timestamptz | ❌ | soft delete |

**Ràng buộc:** tối đa **một record đang hoạt động** (`deleted_at IS NULL`) cho mỗi cặp `(employee_id, receipt_month)` — partial unique index `employee_receipts_employee_month_unique`, cùng cơ chế upsert-ghi-đè như `Revenue`/`AdExpense` (nhập lại cho cùng nhân viên + tháng sẽ ghi đè số tiền/ghi chú, không tạo thêm dòng). Không có "Người chi" riêng — chỉ `created_by_admin_id` (khác các bảng chi phí/nhận tiền khác trong hệ thống vốn tách `created_by`/`paid_by`/`received_by`, theo yêu cầu user "đơn giản, chỉ amount + note").

---

### EmployeeProfitSettlement

**Thêm mới ngày 2026-08-19** ("Lợi nhuận nhân viên" — user request: nhân viên có lợi nhuận dương (Doanh thu − Chi phí, tất cả thời gian) có thể được "chốt về 0" bằng cách ghi nhận số lợi nhuận đó như một khoản chi phí riêng cho nhân viên đó, xác nhận qua `AskUserQuestion`).

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| employee_id | UUID | ✅ | FK → EmployeeProfile |
| amount | BIGINT | ✅ | VND, >= 0 — luôn tự tính = lợi nhuận đang chạy tại thời điểm chốt, không nhập tay |
| note | text | ❌ | |
| created_by_admin_id | UUID | ✅ | FK → User — Admin bấm "Chốt về 0" |
| created_at | timestamptz | ✅ | |
| deleted_at | timestamptz | ❌ | soft delete (chưa có UI undo ở phase này, để dành schema sẵn) |

**Không có `updated_at`** — số tiền luôn tự tính tại thời điểm tạo, không có form sửa tay (khác mọi entity chi phí khác trong hệ thống).

**Công thức "Lợi nhuận nhân viên đang chạy" (đã đổi — xem Changelog 2026-08-19 "đảo ngược" phía dưới):**

`Employee Profit (running) = Employee Revenue (all-time) − Employee Cost (all-time)`, trong đó `Employee Cost = AdsCost + PagePurchaseCost + SalaryCost + ProfitSettlementCost` (`ProfitSettlementCost = Σ EmployeeProfitSettlement.amount, deleted_at IS NULL`).

Không có MCP tool cho entity này (quyết định có chủ đích 2026-08-19 — AI agent không nên tự quyết định chốt lợi nhuận nhân viên).

**Cập nhật ngày 2026-08-19, sau đó cùng ngày (user request "gộp lợi nhuận nv với quản lý nhân viên"):** trang riêng `/admin/profit-settlements` (route + nav "Lợi nhuận NV") đã **xoá hẳn** — cột "Lợi nhuận" + nút "Chốt về 0" chuyển thẳng vào Employee List (`/admin/employees`, `context/spec.md` §14.1), cho mọi nhân viên (không chỉ người có lợi nhuận dương như trang cũ, nút chỉ *hiện* khi > 0). Service layer lúc này: xoá `listEmployeesWithPositiveProfit`/`ListPositiveProfitParams`/`ListPositiveProfitResult`/`PROFIT_SETTLEMENT_PAGE_SIZE_OPTIONS`/`EmployeeProfitRow`; thêm `getSettledTotalsForEmployees(employeeIds[])` để trang tự tính `currentProfit = revenue − totalCost − settledTotal`.

**Cập nhật lần 2, cùng ngày 2026-08-19 (user request "chi phí nhân viên thêm một số tiền đã chốt... với loại là chốt lợi nhuận") — ĐẢO NGƯỢC quyết định cô lập ban đầu ở trên:** `EmployeeProfitSettlement.amount` giờ là **thành phần thứ 4 thật sự của `Employee Cost`** (mục 10.2), không còn "thuần bút toán nội bộ" nữa. `getEmployeeFinancials()` (`employee.service.ts`) tự query `employeeProfitSettlement.aggregate` song song với 3 query cost khác, trả thêm field `profitSettlementCost`, và `totalCost = adsCost + pagePurchaseCost + salaryCost + profitSettlementCost`. Hệ quả: `getSettledTotalsForEmployees` không còn cần thiết (đã xoá cùng `computeEmployeeProfit`/`EmployeeProfitBalance`) — `EmployeesPage` tính thẳng `currentProfit = employee.revenue − employee.totalCost` vì `totalCost` đã tự bao gồm mọi settlement trước đó. `profit-settlement.service.ts` rút gọn còn `listProfitSettlements(employeeId)` (feed bảng "Chi tiết chi phí") và `settleEmployeeProfit()` (không đổi logic tính `currentProfit`, chỉ đổi effect: giờ ghi xong thì `totalCost` tăng ngay theo, tự nét về 0 ở lần đọc tiếp theo — không cần trừ tay). **Vẫn giữ nguyên** ràng buộc còn lại: **không** cộng vào `Total Expenses`/`Profit` **hệ thống** (mục 10.3/10.5, `getSystemFinancials()` không đổi, hoàn toàn độc lập) — chỉ đảo phần Employee-Cost-level, không đảo phần system-wide. Row "Bù chi phí" trong bảng "Chi tiết chi phí" (Admin Employee Detail + User Costs): không có Page (`pageId/pageName: null`), không có "Người chi" (hiện `"—"` — số tiền do hệ thống tự tính tại thời điểm chốt, không phải Admin chọn chi cho ai). User Dashboard's "Cơ cấu chi phí" donut thêm lát thứ 4 màu `#027A48` (tái dùng màu "Tài nguyên" của Admin Dashboard) để tổng luôn khớp tổng lát, tránh lặp lại bug "1.000.000 ở đâu". Test: `profit-settlement-service.test.ts` viết lại hoàn toàn cho API mới; `employee-financials.test.ts` thêm field `profitSettlementCost` vào assertion `toEqual`.

---

### AuditLog

Nhật ký cho mọi thao tác ghi dữ liệu, từ Web lẫn MCP. **Không append-only vô hạn** — giới hạn cứng **5.000 dòng** (xem Changelog 2026-08-19), dòng cũ nhất bị hard-delete thật khi vượt.

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| actor_type | enum `USER\|MCP` | ✅ | |
| actor_user_id | UUID | ❌ | FK → User, có khi `actor_type = USER` |
| mcp_client_id | UUID | ❌ | FK → McpClient, có khi `actor_type = MCP` |
| action | string | ✅ | vd `CREATE`, `UPDATE`, `DELETE`, `TRANSFER` |
| entity_type | string | ✅ | vd `REVENUE`, `PAGE` |
| entity_id | UUID | ✅ | |
| before_json | jsonb | ❌ | |
| after_json | jsonb | ❌ | |
| ip_address | string | ❌ | |
| user_agent | string | ❌ | |
| request_id | string | ✅ | |
| created_at | timestamptz | ✅ | |

Không có `updated_at`/`deleted_at` — không sửa qua ứng dụng, nhưng **có** bị xoá thật (hard delete, không phải soft delete) khi vượt giới hạn 5.000 dòng, khác 100% với 6 entity tài chính có `deleted_at` ở trên.

---

### McpClient

API key cấp cho AI agent (Claude Code), quyền tương đương Admin.

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| id | UUID | ✅ | PK |
| name | string | ✅ | |
| api_key_hash | string | ✅ | không lưu plaintext |
| status | enum `ACTIVE\|REVOKED` | ✅ | default `ACTIVE` |
| permissions_json | jsonb | ✅ | V1: `{"scope":"ADMIN_FULL"}` |
| created_by_admin_id | UUID | ✅ | FK → User |
| last_used_at | timestamptz | ❌ | |
| created_at | timestamptz | ✅ | |
| revoked_at | timestamptz | ❌ | |

---

## Quan hệ giữa các Entity

```
User (role=USER) 1───1 EmployeeProfile
EmployeeProfile  1───N SalaryHistory
EmployeeProfile  1───N PageAssignment
Page             1───N PageAssignment        (N có thể = 0 — xem Changelog Phase 4)
Page             1───1 PagePurchaseExpense   (optional — chỉ khi purchase_price > 0 VÀ Page đã từng được gán nhân viên)
Page             1───N Revenue
Page             1───N AdExpense
PageAssignment   1───N Revenue              (qua assignment_id_snapshot)
PageAssignment   1───N AdExpense            (qua assignment_id_snapshot)
PageAssignment   1───1 PagePurchaseExpense  (qua assignment_id_snapshot, assignment đầu tiên)
EmployeeProfile  1───N EmployeeReceipt
EmployeeProfile  1───N EmployeeProfitSettlement
User (Admin)     1───N { Page, PageAssignment, SalaryHistory, Revenue, AdExpense,
                          PagePurchaseExpense, AdminExpense, AdminReceipt, EmployeeReceipt,
                          EmployeeProfitSettlement, McpClient }
                          (qua created_by_admin_id / assigned_by_admin_id)
User / McpClient 1───N AuditLog             (qua actor_user_id / mcp_client_id)
```

Điểm mấu chốt: **PageAssignment là nguồn sự thật duy nhất** cho "Page thuộc ai tại thời điểm nào". Revenue/AdExpense/PagePurchaseExpense chỉ *snapshot* lại kết quả resolve tại thời điểm tạo — chúng không tự cập nhật khi PageAssignment thay đổi sau này.

---

## Enum / Status

| Enum | Giá trị | Dùng ở |
|---|---|---|
| Role | `ADMIN`, `USER` | User |
| UserStatus | `ACTIVE`, `INACTIVE` | User |
| PageStatusColor | `GRAY`, `GREEN`, `BLUE`, `AMBER`, `RED`, `ORANGE`, `PURPLE`, `PINK` | PageStatusOption (`color`, preset swatch — Page tham chiếu qua bảng nối `PageStatusAssignment` (nhiều-nhiều), không tự lưu color, xem Changelog) |
| AuditActorType | `USER`, `MCP` | AuditLog |
| McpClientStatus | `ACTIVE`, `REVOKED` | McpClient |

---

## Ràng buộc dữ liệu quan trọng

1. **Tiền tệ:** mọi field tiền dùng `BIGINT` (VND nguyên, không thập phân), không dùng floating point.
2. **PageAssignment không overlap:** tối đa một assignment active/Page, `ended_at > started_at`.
3. **SalaryHistory không overlap:** tối đa một record active/employee.
4. **Owner resolution bắt buộc:** Revenue/AdExpense luôn resolve qua `resolvePageOwner(pageId, date)`; nếu Page không có assignment hợp lệ tại ngày đó → reject, không cho tạo record "mồ côi".
5. **Snapshot bất biến theo thời gian:** khi PageAssignment thay đổi (transfer), các Revenue/AdExpense/PagePurchaseExpense đã tạo trước đó **không** được cập nhật lại owner.
6. **PagePurchaseExpense chỉ tạo một lần/Page**, trong cùng database transaction với: tạo **PageAssignment đầu tiên** của Page đó + ghi AuditLog. Transaction này có thể là transaction tạo Page (nếu gán nhân viên ngay lúc tạo) hoặc một transaction riêng, muộn hơn, khi Page được gán nhân viên lần đầu (nếu tạo Page chưa gán ai — xem Changelog Phase 4). Không tự tạo lại nếu Page đã từng có Purchase Expense (chỉ đúng một lần, bất kể transfer bao nhiêu lần sau đó).
7. **Soft delete** áp dụng cho dữ liệu tài chính: Page, Revenue, AdExpense, PagePurchaseExpense, AdminExpense, AdminReceipt, EmployeeReceipt, EmployeeProfitSettlement. AuditLog append-only (không xoá). User/EmployeeProfile/PageAssignment/SalaryHistory không soft-delete (dùng `status`/`effective_to` thay thế).
8. **Email unique, case-insensitive.**
9. **Facebook URL** phải đúng định dạng URL (không cần gọi Facebook API để verify).
10. **Timezone:** DB lưu UTC; nghiệp vụ tính theo tháng/hiển thị convert sang `Asia/Ho_Chi_Minh`.
11. **API key** của McpClient chỉ lưu hash, không bao giờ lưu plaintext.
12. **Transfer Page** yêu cầu nhân viên mới có `status = ACTIVE`.
13. ~~ExpenseCategory hệ thống không được sửa qua `updateExpenseCategory`~~ — **gỡ bỏ** cùng toàn bộ entity `ExpenseCategory` (xem Changelog "Bỏ hẳn tính năng Expense Categories"), không còn áp dụng.
14. **`deleted_at` có thể được set lại về `NULL` (Restore)** — trước Phase 9, mọi soft-delete trong hệ thống là một chiều (chỉ set `deleted_at`, không có action nào clear lại). `AdminExpense.deleted_at` là field đầu tiên có action `restoreAdminExpense` ghi `NULL` trở lại. Không có CHECK constraint DB nào ngăn việc này ở các entity tài chính khác (Revenue/AdExpense/PagePurchaseExpense/AdminReceipt/Page) — chỉ là chưa có action Service Layer nào làm vậy, không phải giới hạn ở tầng schema.

---

## Conventions

- **UUID cho tất cả primary key.**
- **Xoá thật (hard delete) không được dùng cho dữ liệu tài chính** — mọi entity tài chính (Revenue, AdExpense, PagePurchaseExpense, AdminExpense, AdminReceipt, EmployeeReceipt, Page) dùng soft delete qua `deleted_at`. Các entity còn lại (User, EmployeeProfile, PageAssignment, SalaryHistory, McpClient, AuditLog) không hỗ trợ delete qua UI — vô hiệu hoá bằng `status`/`effective_to`/kết thúc `ended_at` thay vì xoá record. **Ngoại lệ (2026-08-18):** `PageStatusOption` — không phải dữ liệu tài chính, thuần metadata hiển thị — có hard delete thật qua UI (đầu tiên trong hệ thống), xác nhận qua `AskUserQuestion`; xoá một option chỉ cascade xoá đúng dòng `PageStatusAssignment` gắn với nó (`ON DELETE CASCADE`), Page giữ nguyên các trạng thái khác nếu có.
- **Timestamps:** mọi table đều có `created_at`; các table cho phép sửa có thêm `updated_at`. Ngoại lệ: `AuditLog`, `PageAssignment`, `PageStatusAssignment` chỉ có `created_at` (không sửa sau khi tạo — đổi trạng thái là xoá dòng cũ + tạo dòng mới, không update tại chỗ).
- **Tiền:** luôn `BIGINT`, đơn vị VND nguyên (vd `10.000.000 VND → 10000000`), không dùng floating point.
- **Ngày nghiệp vụ** (`revenue_month`, `expense_date`, `expense_month`, `purchase_month`, `effective_from/to`, `started_at`/`ended_at`): kiểu `DATE`, không có giờ/phút; `revenue_month`/`expense_month`/`purchase_month` luôn chuẩn hoá về ngày 1 của tháng (xem Changelog). **Timestamp hệ thống** (`created_at`, `updated_at`, `deleted_at`, `last_used_at`, `revoked_at`): kiểu `timestamptz`, lưu UTC.
- **Snapshot pattern:** Revenue, AdExpense, PagePurchaseExpense đều lưu `employee_id_snapshot` + `assignment_id_snapshot` tại thời điểm tạo; đây là bất biến, không đồng bộ lại khi PageAssignment sau đó thay đổi.

---

## Open Questions

1. **EmployeeProfile** hiện chỉ có `user_id` + timestamps, không có field nghiệp vụ riêng nào khác. Giữ tách bảng theo spec để dễ mở rộng field sau này (chức danh, phòng ban...); có thể gộp thẳng vào `User` nếu về sau xác nhận không cần mở rộng.
2. **`current_employee_id` cache trên Page**: quyết định V1 là không cache, luôn resolve qua `PageAssignment`. Cần revisit nếu sau này scale lên nhiều Page hơn đáng kể (spec dự kiến ~100 Page nên hiện tại chưa cần).
3. **`assignment_id_snapshot` trên PagePurchaseExpense**: spec mục 25 gốc không liệt kê field này, nhưng đã thêm vào để nhất quán với Revenue/AdExpense và dễ truy vết. Xác nhận lại nếu muốn giữ tối giản đúng bản gốc.
4. **`deleted_at` trên PagePurchaseExpense**: spec mục 28 (danh sách soft-delete) không liệt kê entity này dù mục 25 có field `deleted_at`. Coi đây là bổ sung hợp lý cho nhất quán dữ liệu tài chính — cần xác nhận không phải chủ ý loại trừ.
5. ~~**PageStatus** hiện chỉ có `ACTIVE`/`ARCHIVED`...~~ **Đã giải quyết** (user request 2026-08-18): `Page.status` đổi thành free-text tuỳ ý, không còn giới hạn 2 giá trị — xem Changelog.

---

## Changelog

<!-- Sẽ cập nhật trong quá trình code -->

- **Phase 2 (Authentication + RBAC): không có thay đổi schema.** Toàn bộ session/login/logout/rate-limit/audit chỉ dùng field đã có sẵn từ Phase 1 (`User.password_hash/role/status`, `AuditLog.*`) — không thêm/đổi field hay entity nào trong `prisma/schema.prisma`, không có migration mới ngoài `20260816172220_init`. Ghi lại ở đây để xác nhận đã rà soát, không phải bỏ sót.
- **Phase 3 (Employee Management + Salary History): không có thay đổi schema.** `EmployeeProfile`/`SalaryHistory` đã được tạo sẵn từ migration `20260816172220_init` (Phase 1) đúng theo định nghĩa ở trên, kể cả partial unique index `salary_history_one_active_per_employee`. Phase 3 chỉ viết Service Layer (`employee.service.ts`, `salary.service.ts`) và UI dùng lại các field có sẵn — không thêm/đổi field/entity, không có migration mới.
- **Cập nhật sau Phase 3 (theo yêu cầu user): bỏ "Salary"/"Salary effective date" khỏi field bắt buộc khi tạo Employee — vẫn không có thay đổi schema.** `SalaryHistory.employee_id` đã là quan hệ 1-N tuỳ chọn từ phía `EmployeeProfile` (một employee có thể có 0 record `SalaryHistory`) ngay từ định nghĩa gốc ở trên — không có ràng buộc DB nào ("NOT NULL", check constraint...) buộc phải có ít nhất 1 record `SalaryHistory` khi tạo `EmployeeProfile`. Việc "nhân viên mới không có `SalaryHistory` cho tới khi Admin đổi lương lần đầu" chỉ là thay đổi ở tầng business flow (`server/services/employee.service.ts` không còn tự tạo record trong transaction `createEmployee`) — schema.md/prisma/schema.prisma không cần sửa. Xem `context/spec.md` §14.2 và `context/plan.md` Phase 3.
- **Phase 4 (Page Management + Assignment + Purchase Expense): không có thay đổi schema.** `Page`/`PageAssignment`/`PagePurchaseExpense` đã được tạo sẵn từ migration `20260816172220_init` (Phase 1) đúng theo định nghĩa ở trên, kể cả 2 partial unique index (`page_assignment_one_active_per_page`, và unique `page_id`/`assignment_id_snapshot` trên `PagePurchaseExpense`). Phase 4 chỉ viết Service Layer (`page.service.ts`, `assignment.service.ts`) và UI dùng lại các field/relation có sẵn — không thêm/đổi field/entity, không có migration mới.
- **Cập nhật sau Phase 4 (theo yêu cầu user): bỏ "Assign Employee" khỏi field bắt buộc khi tạo Page — vẫn không có thay đổi schema, nhưng có cập nhật 3 chỗ *mô tả ràng buộc*.** Quan hệ `Page 1─N PageAssignment` trong schema gốc chưa bao giờ ép buộc N ≥ 1 (không có ràng buộc DB nào yêu cầu Page phải có assignment); việc "mọi Page luôn có ít nhất 1 assignment ngay sau khi tạo" trước đây chỉ là hệ quả của business rule "Assign Employee bắt buộc lúc tạo" (spec §15.2 cũ), không phải ràng buộc dữ liệu. Sau khi field này thành tuỳ chọn (`server/services/page.service.ts` — `createPage` không còn luôn tạo `PageAssignment`/`PagePurchaseExpense`; action mới `assignEmployee` trong `assignment.service.ts` tạo bù cả hai khi Page được gán nhân viên lần đầu, bất kể lúc nào), đã **sửa lại phần mô tả** (không đổi field/type) ở 3 chỗ trong file này để phản ánh đúng thực tế: (1) mô tả entity `PagePurchaseExpense`, (2) `Ràng buộc dữ liệu quan trọng` #6, (3) sơ đồ `Quan hệ giữa các Entity` + thêm 1 bullet ràng buộc mới cho `PageAssignment` (Page có thể có 0 assignment). Bất biến cốt lõi — PagePurchaseExpense chỉ tạo đúng 1 lần/Page, luôn cùng transaction với PageAssignment đầu tiên, không đổi theo transfer — vẫn giữ nguyên. Xem `context/spec.md` §15.2/§15.3/§15.4a và `context/plan.md` Phase 4.
- **Phase 5 (Revenue Management): không có thay đổi schema.** `Revenue` đã được tạo sẵn từ migration `20260816172220_init` (Phase 1) đúng theo định nghĩa ở trên — đủ cả `employee_id_snapshot`/`assignment_id_snapshot`/`deleted_at` cần cho snapshot pattern và soft delete. Phase 5 chỉ viết Service Layer (`revenue.service.ts`, dùng lại `resolvePageOwner` có sẵn từ Phase 4) và UI (List/Create/Edit/Delete, filter month/employee/page) — không thêm/đổi field/entity, không có migration mới. Filter theo Page ở URL dùng tên param `pageId` (không phải `page`, tránh đụng độ với param phân trang) — đây là quy ước ở tầng route/query-param, không liên quan schema DB.
- **Cập nhật sau Phase 5 (theo yêu cầu user): thêm nút Sửa/Xoá trực tiếp trên `/admin/pages` — vẫn không có thay đổi schema.** `Page.deleted_at` đã có sẵn trong định nghĩa entity `Page` ở trên (và trong migration `20260816172220_init`) ngay từ Phase 1, nhưng trước đó **chưa có hàm service nào set giá trị này** — Phase 4 chỉ dùng `status = ARCHIVED` (một field khác, không phải soft delete) cho hành vi "ẩn"/"lưu trữ" Page. Việc thêm `softDeletePage()` (`page.service.ts`) chỉ đơn thuần *bắt đầu sử dụng* field `deleted_at` đã tồn tại sẵn, đúng với mục "Ràng buộc dữ liệu quan trọng" #7 (Page nằm trong danh sách soft-delete) và "Conventions" (hard delete không dùng cho dữ liệu tài chính) — không thêm/đổi field/entity/enum nào, không có migration mới. Xem `context/spec.md` §15.5 (mục mới) và `context/plan.md` Phase 4 "Cập nhật sau khi hoàn thành (trong lúc làm Phase 5)".
- **Cập nhật sau Phase 6 (theo yêu cầu user, xác nhận qua `AskUserQuestion` ngày 2026-08-17): AdExpense đổi từ theo-ngày sang theo-tháng — CÓ thay đổi schema thật.** Phase 6 ban đầu implement `AdExpense.expense_date DATE` (theo ngày, giống Revenue) đúng bản gốc spec §6/schema §AdExpense. User phản hồi "Chi phí ads là tính theo tháng" và xác nhận (2 câu hỏi qua `AskUserQuestion`): (1) mỗi Page chỉ có **đúng 1 record AdExpense đang hoạt động / tháng** — tạo lần 2 cho cùng Page+tháng sẽ **ghi đè số tiền** của record đang có, không cộng dồn thành nhiều dòng; (2) nếu Page transfer **giữa tháng**, chi phí Ads cả tháng đó tính cho **nhân viên phụ trách đầu tháng** (ngày 1), không tách theo tuần/theo ngày transfer. Đã thực hiện: đổi field `expense_date DATE` → `expense_month DATE` (luôn chuẩn hoá về ngày 1 của tháng) qua migration `20260817140000_ads_expense_monthly` (viết tay `migration.sql` + `prisma migrate resolve --applied`, không dùng `prisma migrate dev` bình thường vì shadow DB của `prisma dev` bị lỗi state cũ — xem chi tiết trong migration); thêm partial unique index `ad_expenses_page_month_unique` trên `(page_id, expense_month) WHERE deleted_at IS NULL`. `resolvePageOwner` không đổi logic — chỉ luôn được gọi với ngày-1-của-tháng thay vì ngày cụ thể, tự động thoả mãn rule "owner đầu tháng". Đã cập nhật định nghĩa entity `AdExpense` ở trên + `context/spec.md` §6. `Revenue` **không đổi** — vẫn theo ngày như cũ, chỉ `AdExpense` áp dụng rule mới này. Xem `context/plan.md` Phase 6 "Cập nhật sau khi hoàn thành".
- **Cập nhật sau Phase 6, phát hiện khi rà soát đối chiếu `spec.md`/`schema.md` với mã nguồn (2026-08-17): bổ sung khai báo `@@unique` cho `ad_expenses_page_month_unique` vào `prisma/schema.prisma` — sửa lỗi tài liệu hoá, không đổi hành vi DB.** Lý do: khi tạo migration `20260817140000_ads_expense_monthly` (mục Changelog ngay trên), partial unique index được tạo bằng `migration.sql` viết tay + `prisma migrate resolve --applied` (do shadow DB của `prisma dev` lỗi state cũ, không dùng được `prisma migrate dev` để tự sinh diff) — nhưng khi đó **quên bổ sung khai báo tương ứng** vào model `AdExpense` trong `prisma/schema.prisma`, khiến file schema Prisma không còn khớp với constraint thật đã có trên DB, và khác kiểu với 2 partial unique index tương tự (`salary_history_one_active_per_employee`, `page_assignment_one_active_per_page`) — cả hai đều khai báo ngay trong schema bằng cú pháp `@@unique(..., where: raw(...))` (preview feature `partialIndexes`, đã bật sẵn trong `generator client`), không chỉ nằm trong migration SQL. Đã thêm `@@unique([pageId, expenseMonth], map: "ad_expenses_page_month_unique", where: raw("deleted_at IS NULL"))` vào model `AdExpense` cho nhất quán. **Không có migration mới** — DB không đổi (constraint đã tồn tại từ trước), chỉ `prisma/schema.prisma` được sửa để mô tả đúng thực tế; xác nhận không lệch bằng `npx prisma validate` (pass) và `npx prisma migrate status` (vẫn báo "up to date", không phát sinh drift). Đã chạy lại toàn bộ `tsc --noEmit`/`lint`/`npm run test` (46/46 pass)/`npm run build` sau khi sửa, đều sạch.
- **Phase 7 (Employee/Page Detail wiring + User self-service Dashboard): không có thay đổi schema.** Toàn bộ việc "wire" ở phase này chỉ là **đọc/tổng hợp** dữ liệu đã tồn tại sẵn qua các field đã có trong schema — không có field/entity/enum/migration nào mới:
  - `getEmployeeFinancials()`/`getEmployeeMonthlySeries()` (mới, `employee.service.ts`) — tổng hợp `Revenue.amount` (theo `employee_id_snapshot`), `AdExpense.amount` (theo `employee_id_snapshot`/`expense_month`), `PagePurchaseExpense.amount` (theo `employee_id_snapshot`), và cộng dồn `SalaryHistory.monthly_salary` theo từng khoảng `[effective_from, effective_to)` — toàn bộ field này đã có sẵn từ Phase 1/6, chỉ là **cách tính mới ở tầng ứng dụng** (công thức "cộng dồn theo lịch sử" cho Salary khi không lọc theo tháng — đã xác nhận với user qua `AskUserQuestion`, xem `context/spec.md` §10.2), không đụng tới DB.
  - `getEmployeeAssignmentHistory()` (mới, `assignment.service.ts`) — chỉ là một query `PageAssignment` lọc theo `employee_id` (thay vì `page_id` như `getAssignmentHistory()` có sẵn từ Phase 4), dùng đúng field đã có.
  - Cột "Thao tác" mới ở `/admin/employees` (Edit + Deactivate) chỉ gọi lại `updateEmployee()`/`deactivateEmployee()` đã có từ Phase 3, ghi đè `User.status` — field đã tồn tại, không có action "Xoá thật" nào được thêm cho `User`/`EmployeeProfile` (hai entity này vẫn đúng theo "Conventions" ở trên: không hỗ trợ hard delete qua UI).
  - Việc xoá dữ liệu nhân viên test cũ (theo yêu cầu user, để tiện test lại) được thực hiện qua **script chạy tay một lần** (xoá đúng thứ tự phụ thuộc khoá ngoại: AuditLog → Revenue/AdExpense/PagePurchaseExpense → PageAssignment → SalaryHistory → EmployeeProfile → User), không phải tính năng ứng dụng, không đổi schema. Xác nhận không lệch bằng `npx prisma validate` (pass) và `npx prisma migrate status` (vẫn "up to date" sau Phase 7, không phát sinh drift). Xem `context/plan.md` Phase 7 và `context/spec.md` §10.2/§14.1/§14.3.
- **Phase 8 (Expense Categories): không có thay đổi schema.** `ExpenseCategory` đã được tạo sẵn đầy đủ (kể cả `description`) từ migration `20260816172220_init` (Phase 1) đúng theo định nghĩa ở trên — Phase 8 chỉ viết Service Layer (`expense-category.service.ts`) + UI + mở rộng `prisma/seed.ts` để `upsert` 5 row dữ liệu (`PAGE_PURCHASE`/`ADS`/`SALARY`/`RESOURCE`/`OTHER`) theo `slug`, không thêm/đổi field/entity/enum, không có migration mới (`npx prisma migrate status` vẫn báo "up to date", `npx prisma validate` pass, vẫn đúng 2 migration `20260816172220_init` + `20260817140000_ads_expense_monthly`). Có 2 chỗ **sửa mô tả** (không đổi field/type) để phản ánh đúng business rule mới phát sinh khi implement, ghi lại ở đây vì đây là ràng buộc dữ liệu quan trọng dù không thuộc DDL: (1) mô tả entity `ExpenseCategory` — làm rõ "không hard-delete" áp dụng cho `PAGE_PURCHASE`/`ADS`/`SALARY` mở rộng thành "không sửa được qua bất kỳ field nào" (rename/re-scope/archive), chặt hơn cách đọc "chỉ chặn xoá" ban đầu; (2) thêm bullet #13 vào `Ràng buộc dữ liệu quan trọng` ghi rõ đây là ràng buộc **tầng Service Layer** (`updateExpenseCategory` reject nếu `is_system=true`), không phải CHECK constraint — DB vẫn cho phép UPDATE trực tiếp qua SQL/Prisma Studio nếu bypass service layer. Xem `context/plan.md` Phase 8 và `context/spec.md` §21.
- **Phase 9 (Admin Expenses): không có thay đổi schema.** `AdminExpense` đã được tạo sẵn đầy đủ (đúng 10 field ở trên, kể cả `deleted_at`) từ migration `20260816172220_init` (Phase 1) — Phase 9 chỉ viết Service Layer (`admin-expense.service.ts`) + UI, dùng lại toàn bộ field/relation có sẵn (`category_id` → `ExpenseCategory`, `created_by_admin_id` → `User`) — không thêm/đổi field/entity/enum, không có migration mới (`npx prisma migrate status` vẫn báo "up to date", vẫn đúng 2 migration như Phase 6-8). Có 1 điểm **sửa mô tả** (không đổi DDL) đáng ghi lại vì là hành vi mới lần đầu xuất hiện trong hệ thống: `restoreAdminExpense()` là action **đầu tiên** ghi `deleted_at = NULL` trở lại sau khi đã soft-delete (mọi soft-delete trước đó — Page/Revenue/AdExpense — chỉ set một chiều, không có action Restore nào dùng tới). Không cần migration vì `deleted_at` vốn đã nullable từ đầu, action mới này chỉ là UPDATE bình thường trong phạm vi kiểu dữ liệu đã khai báo. Đã thêm bullet #14 vào `Ràng buộc dữ liệu quan trọng` ghi rõ điều này để tránh hiểu nhầm "soft delete là bất biến một chiều" khi đọc riêng phần entity `AdminExpense`. Category dropdown ở Create/Edit Admin Expense **không lọc theo `scope`** (dùng thẳng `listActiveExpenseCategoryOptions()` không ràng buộc gì thêm ở tầng schema) — không phải giới hạn DB, chỉ là UI cho phép chọn rộng hơn dự kiến ban đầu của spec §21 ("RESOURCE có thể dùng cho Admin Expense"). Xem `context/plan.md` Phase 9 và `context/spec.md` §19/§28/§29.
- **Phase 10 (Admin Receipts): không có thay đổi schema.** `AdminReceipt` đã được tạo sẵn đầy đủ (đúng 9 field ở trên: `id`/`receipt_date`/`amount`/`source`/`note`/`created_by_admin_id`/`created_at`/`updated_at`/`deleted_at`) từ migration `20260816172220_init` (Phase 1) — Phase 10 chỉ viết Service Layer (`receipt.service.ts`) + Server Actions + UI (`/admin/receipts`), dùng lại toàn bộ field/relation có sẵn (`created_by_admin_id` → `User`), không thêm/đổi field/entity/enum, không có migration mới (`npx prisma migrate status` vẫn báo "up to date", `npx prisma validate` pass, vẫn đúng 2 migration như Phase 6-9). Khác Phase 9 (Admin Expense), Phase 10 **có chủ đích không thêm action Restore** — bám đúng scope đã duyệt trong `context/plan.md` (chỉ Create/Edit/Soft delete cho Admin Receipt) — nên không phát sinh thêm ghi chú nào vào bullet #14 (`Ràng buộc dữ liệu quan trọng`, vốn đã liệt kê `AdminReceipt` trong nhóm entity "chưa có action Service Layer nào set lại `deleted_at = NULL`" từ trước). Xem `context/plan.md` Phase 10 và `context/spec.md` §20/§28/§35.
- **Phase 11 (Admin Dashboard — KPI + Charts + Recent Activity): không có thay đổi schema.** Toàn bộ phase này là một **tầng đọc/tổng hợp thuần tuý** (`server/services/dashboard.service.ts`) trên dữ liệu đã tồn tại sẵn — không thêm/đổi field/entity/enum nào, không có migration mới (`npx prisma migrate status` vẫn báo "up to date", `npx prisma validate` pass, vẫn đúng 2 migration như Phase 6-10):
  - `getSystemFinancials(monthKey)` — `Prisma.aggregate` trên `AdminReceipt.amount`/`Revenue.amount`/`AdExpense.amount`/`PagePurchaseExpense.amount`/`AdminExpense.amount` (đều lọc `deleted_at IS NULL` + khoảng ngày/tháng tương ứng, đúng field đã có từ Phase 1/6) cộng với tổng lương hệ thống — quét thẳng `SalaryHistory` đang active vào ngày 1 của tháng (`effective_from <= ngày 1 AND (effective_to IS NULL OR effective_to > ngày 1)`) và cộng dồn `monthly_salary` **không group theo `employee_id`** — an toàn vì partial unique index `salary_history_one_active_per_employee` (đã có từ Phase 1) đảm bảo tối đa 1 record active/nhân viên, nên tổng phẳng toàn bộ record active = đúng tổng hệ thống.
  - `getDashboardEmployeeRows(monthKey)` — tái dùng nguyên `getEmployeeFinancials()` (Phase 7) theo từng nhân viên qua `Promise.all`, cùng cơ chế đã dùng ở `listEmployees()` (Phase 3/7).
  - `getSystemMonthlySeries(monthsBack=6)` — gọi lặp `getSystemFinancials()` cho 6 tháng gần nhất, cùng pattern trailing-window với `getEmployeeMonthlySeries()` (Phase 7).
  - `getRecentActivity(limit=10)` — union `createdAt DESC` trực tiếp trên `Revenue`/`AdExpense`/`Page`/`AdminExpense`/`AdminReceipt` (field `created_at` đã có sẵn ở mọi entity từ Phase 1); riêng sự kiện "Page chuyển" đọc từ `AuditLog` (`entity_type='Page', action='TRANSFER'`, đã ghi từ Phase 4) vì đây là tín hiệu duy nhất phân biệt một lần transfer với lần gán nhân viên đầu tiên — bản thân `PageAssignment` (định nghĩa entity ở trên) không có field nào tự phân biệt 2 trường hợp này, nên không thể union trực tiếp từ bảng đó như 5 loại sự kiện còn lại.
  - Không có field/bảng mới nào cần cho việc này vì mọi con số Dashboard đều là **suy ra được (derived)** từ dữ liệu snapshot đã có — đúng tinh thần CLAUDE.md "không tối ưu hoá sớm" (không thêm bảng tổng hợp/cache riêng cho Dashboard ở quy mô ~1.000 giao dịch/tháng hiện tại). Xem `context/plan.md` Phase 11 và `context/spec.md` §10.3–10.5/§11/§37.
- **Phase 12 (Audit Log — UI xem/search): không có thay đổi schema.** `AuditLog` đã được tạo sẵn đầy đủ đúng 12 field ở định nghĩa entity phía trên (kể cả `actor_type`/`actor_user_id`/`mcp_client_id`/`before_json`/`after_json`) từ migration `20260816172220_init` (Phase 1) — Phase 12 chỉ viết một service **đọc thuần tuý** (`audit.service.ts`: `listAuditLogs()`, `listAuditFilterOptions()`) + UI (`/admin/settings/audit`), không ghi gì mới vào `AuditLog` (việc ghi vẫn qua `logAction()` có từ Phase 2, không đổi). Không thêm/đổi field/entity/enum nào, không có migration mới (`npx prisma migrate status` vẫn báo "up to date", `npx prisma validate` pass, vẫn đúng 2 migration như Phase 6-11). Hai quyết định implementation đáng ghi lại vì bám sát trực tiếp định nghĩa field ở trên, không phải tự suy diễn thêm:
  - **Search theo `entity_id` dùng exact match (`equals`), không phải `ILIKE`/`contains`** — vì `entity_id` đã khai báo kiểu `UUID` (`@db.Uuid` trong `prisma/schema.prisma`) ở định nghĩa entity `AuditLog` phía trên, không phải text/string; Postgres không đảm bảo `ILIKE` hoạt động đúng trên cột UUID qua Prisma, nên ô tìm kiếm chỉ chấp nhận dán nguyên UUID để tra đúng 1 record.
  - **Actor hiển thị `—` khi `actor_user_id` trỏ tới một `User` đã bị hard-delete** (dữ liệu rác từ script dọn tay ở phase trước, không phải bug Phase 12) — đúng thiết kế `AuditLog` append-only đã ghi ở trên ("Không có `updated_at`/`deleted_at`... không sửa/xoá qua ứng dụng"): quan hệ `actorUser` trong Prisma **không có `onDelete: Cascade`**, nên record audit vẫn tồn tại nguyên vẹn dù actor bị xoá — `audit.service.ts` chỉ cần xử lý `actorUser` có thể `null` khi join, không cần đổi ràng buộc DB nào. Xem `context/plan.md` Phase 12 và `context/spec.md` §29/§35/§41/§50.
- **Bổ sung sau Phase 13 (theo yêu cầu user, xác nhận qua `AskUserQuestion` ngày 2026-08-17): thêm field `paid_by_admin_id` — CÓ thay đổi schema thật.** User yêu cầu mỗi mục chi phí phải có "người chi" (Admin thực sự bỏ tiền ra), xác nhận rõ đây là field **khác** với `created_by_admin_id` (Admin chỉ nhập liệu) và áp dụng cho **cả 3 bảng chi phí**: `AdExpense`, `PagePurchaseExpense`, `AdminExpense`. Đã thêm `paid_by_admin_id UUID NOT NULL` (FK → User, cùng convention `ON DELETE RESTRICT ON UPDATE CASCADE` như `created_by_admin_id`) vào cả 3 bảng qua migration `20260817220000_add_paid_by_admin_id` — viết tay `migration.sql` (thêm cột nullable → backfill từ `created_by_admin_id` cho record đã có → `SET NOT NULL` → thêm FK constraint) + `prisma migrate resolve --applied`, cùng lý do và cách làm như migration `20260817140000_ads_expense_monthly` ở trên (shadow DB của `prisma dev` bị lỗi state cũ, không dùng được `prisma migrate dev` để tự sinh diff). Đã xác nhận backfill đúng cho record `AdminExpense` duy nhất có sẵn trong DB dev lúc đó (2 bảng còn lại đang rỗng). Đã cập nhật định nghĩa cả 3 entity ở trên + `context/spec.md`. `AdminReceipt`/`Revenue`/`SalaryHistory` **không đổi** — user chỉ yêu cầu cho "mục chi phí", không áp dụng cho tiền nhận hay lương (lương vốn không phải transaction thủ công, xem §59). Xem `context/plan.md` Phase 9 "Cập nhật bổ sung".
- **Tiếp tục bổ sung ngay sau đó cùng ngày (2026-08-17): mở rộng `paid_by_admin_id` sang cả `SalaryHistory` — đảo lại quyết định "SalaryHistory không đổi" ở mục ngay trên.** User yêu cầu thêm rõ ràng field "Người chi" cho Lương, chọn 1 trong các Admin — nhất quán với 3 bảng chi phí ở trên. Đã thêm `paid_by_admin_id UUID NOT NULL` vào `SalaryHistory` (định nghĩa entity đã cập nhật ở mục "SalaryHistory" phía trên) qua migration `20260817231500_add_salary_paid_by_admin_id` — cùng cách làm (nullable → backfill từ `created_by_admin_id` cho 1 record có sẵn → `SET NOT NULL` → FK). **Không đổi** cách tính lương — vẫn là rate cố định nhập một lần (`setEmployeeSalary`), field mới chỉ ghi nhận Admin nào là người chi trả cho mức lương đó tại thời điểm thiết lập/đổi lương, không biến thành transaction hàng tháng. Xem `context/plan.md` Phase 3 "Cập nhật bổ sung".
- **Bổ sung ngày 2026-08-18 (theo yêu cầu user, xác nhận qua `AskUserQuestion`): Page purchase đổi từ theo-ngày sang theo-tháng — CÓ thay đổi schema thật, đổi tên cột.** User yêu cầu "không cần ngày mua, chỉ cần tháng mua". Xác nhận áp dụng đúng cách đã làm cho AdExpense ở Phase 6 (đổi tên field cho rõ nghĩa, không chỉ truncate giá trị mà giữ tên "date"): đổi `purchase_date DATE` → `purchase_month DATE` (luôn chuẩn hoá về ngày 1 của tháng) trên **cả 2 bảng** `Page` và `PagePurchaseExpense` (PagePurchaseExpense snapshot nguyên giá trị từ Page, cùng field mới). Migration `20260818010000_page_purchase_monthly` — `ALTER TABLE ... RENAME COLUMN` (giữ nguyên dữ liệu, không mất) + `UPDATE ... SET purchase_month = date_trunc('month', purchase_month)::date` để chuẩn hoá record cũ về ngày 1 (dev DB lúc đó chỉ có 1 Page test, ngày 17 → chuẩn hoá về ngày 1 đúng như kỳ vọng) + `prisma migrate resolve --applied` (cùng lý do shadow DB lỗi như các migration viết tay trước đó). Hệ quả liên đới: `assignment.startedAt`/`PageAssignment` đầu tiên của Page (khi gán nhân viên ngay lúc tạo) giờ cũng bắt đầu từ ngày 1 của `purchase_month` thay vì ngày cụ thể trước đây — chấp nhận được vì đây là hệ quả tự nhiên của việc Page giờ chỉ có thông tin ở mức tháng. `PagePurchaseExpense`/`AdExpense` lookup theo tháng ở `employee.service.ts`/`dashboard.service.ts` đổi từ filter khoảng `[gte,lt)` sang so khớp chính xác `purchase_month: monthStart` (đơn giản hơn, đúng vì giá trị luôn là ngày 1). **Không đổi** `PageAssignment.startedAt`/`ended_at`, `Revenue.revenue_date`, `AdminExpense.expense_date`, `AdminReceipt.receipt_date` — vẫn theo ngày như cũ, chỉ purchase Page/PagePurchaseExpense áp dụng rule tháng này. Đã cập nhật định nghĩa 2 entity ở trên + `context/spec.md`. Xem `context/plan.md` Phase 4 "Cập nhật bổ sung".
- **Tiếp tục bổ sung ngay sau đó cùng ngày (2026-08-18, xác nhận qua `AskUserQuestion`): thêm `paid_by_admin_id` lên chính `Page` — CÓ thay đổi schema thật.** User phát hiện: field "Người chi" trên form Tạo Page chỉ hiện khi vừa nhập giá mua vừa gán nhân viên ngay (vì trước đó `PagePurchaseExpense` — nơi duy nhất lưu `paid_by_admin_id` — chỉ được tạo khi có cả hai điều kiện). User muốn được hỏi "Người chi" ngay khi có giá mua, kể cả chưa gán nhân viên. Xác nhận hướng: lưu `paid_by_admin_id` **ngay trên `Page`** (nullable — chỉ có giá trị khi `purchase_price > 0`), dùng lại giá trị này khi `assignEmployee()` sau này tạo `PagePurchaseExpense` deferred, thay vì hỏi lại. Migration `20260818020000_add_page_paid_by_admin_id` — thêm cột nullable + FK (không cần backfill, dev DB rỗng lúc đó). **Hệ quả kiến trúc:** `AssignEmployeeInput`/`AssignEmployeeSchema` **bỏ hẳn** field `paidByAdminId` (không còn hỏi ở bước Gán nhân viên nữa) — `assignEmployee()` đọc `page.paidByAdminId` đã có sẵn, chỉ còn 1 guard phòng thủ (`if willCreatePurchaseExpense && !page.paidByAdminId`) cho trường hợp lý thuyết không nên xảy ra vì `createPage()` đã bắt buộc field này ngay từ đầu khi `purchase_price > 0`. `getPageDetail()`'s `purchasePaidByAdminName` giờ ưu tiên đọc từ `PagePurchaseExpense.paidByAdmin` (nếu đã tồn tại), fallback về `Page.paidByAdmin` (trường hợp deferred, chưa gán nhân viên) — nên UI luôn hiển thị đúng người chi ngay từ lúc tạo Page, không đợi tới khi gán nhân viên. Xem `context/plan.md` Phase 4 "Cập nhật bổ sung" (mục tiếp theo).
- **Bổ sung ngày 2026-08-18 (theo yêu cầu user, xác nhận qua `AskUserQuestion`): `Page.status` đổi từ enum `ACTIVE|ARCHIVED` sang free-text + màu preset — CÓ thay đổi schema thật.** User muốn tự đặt nhãn trạng thái tuỳ ý cho Page thay vì chỉ chọn "Hoạt động"/"Lưu trữ" cố định. Rà soát trước khi làm (theo CLAUDE.md — hỏi lại trước khi đổi schema) xác nhận `status` **không có business rule nào** đọc giá trị này ở `page.service.ts` (chỉ hiển thị/lưu trữ thuần), nên đổi kiểu an toàn về mặt nghiệp vụ. 3 câu hỏi xác nhận qua `AskUserQuestion`: (1) màu chọn qua **preset có sẵn** (không phải color picker tự do — CLAUDE.md "không tự đặt màu ngoài DESIGN.md"), (2) phạm vi **chỉ Page** — `User.status`/`McpClient.status` giữ nguyên enum vì có business rule thật (deactivate/revoke), (3) data cũ **giữ nguyên text + gán màu mặc định** (`ACTIVE` → `"Hoạt động"` + `GREEN`, `ARCHIVED` → `"Lưu trữ"` + `GRAY`), Admin sửa lại tuỳ ý sau. Đã thực hiện: đổi `status PageStatus` → `status String` (free-text, max 30 ký tự, default `"Hoạt động"`) + thêm cột mới `status_color PageStatusColor` (enum mới 5 giá trị `GRAY|GREEN|BLUE|AMBER|RED`, default `GREEN`) trên `Page`; xoá hẳn enum `PageStatus` (không còn dùng ở đâu). Migration `20260818030000_page_status_free_text` — viết tay `migration.sql` (thêm `status_color`, backfill từ giá trị `status` enum cũ, convert `status` sang `TEXT` bằng `CASE` dịch `ACTIVE`/`ARCHIVED` sang label tiếng Việt, xoá `TYPE PageStatus`) + `prisma migrate resolve --applied` (cùng lý do shadow DB `prisma dev` lỗi state cũ như các migration viết tay trước đó — xem `20260817140000_ads_expense_monthly`). 5 màu preset (`PAGE_STATUS_COLOR_OPTIONS` trong `src/lib/page-status-colors.ts`) chỉ dùng token đã có sẵn trong `globals.css`/DESIGN.md (`success-green`, `finance-blue`, `secondary-container`, `error-container`, `surface-container` — một số dùng dạng tint qua opacity Tailwind, ví dụ `bg-success-green/10`, không phải hex mới). `CreatePageInput.statusColor` để **optional** (default `"GREEN"` ở service layer) dù Zod schema/UI bắt buộc chọn — vì hàng chục test hiện có (`tests/unit/*.test.ts`, `tests/integration/*.test.ts`) gọi `createPage()` trực tiếp với chỉ `status`, không phải sửa lại toàn bộ chỉ vì thêm 1 field cosmetic; `UpdatePageInput.statusColor` vẫn bắt buộc (ít call site hơn, đã cập nhật `tests/unit/page-service.test.ts`). Component mới `PageStatusChip`/`PageStatusFields` **tách riêng** khỏi `StatusChip`/dropdown enum dùng chung cho User/ExpenseCategory (không đụng tới các entity đó). Xem `context/spec.md` §15.3 và `context/plan.md`.
- **Tiếp tục bổ sung ngay sau đó cùng ngày (2026-08-18, theo yêu cầu user "thêm màu cam và 2 màu nữa bạn tự chọn"): mở rộng `PageStatusColor` từ 5 lên 8 preset.** Không còn token phù hợp sẵn có trong `globals.css`/DESIGN.md cho Cam/Tím/Hồng (khác 5 preset đầu, vốn tái dùng nguyên token có sẵn) — vì user chủ động giao quyền chọn màu, đã thêm 3 token mới **`--color-warning-orange` (`#C2410C`), `--color-violet-tag` (`#7C3AED`), `--color-rose-tag` (`#BE185D`)** vào `@theme` trong `src/app/globals.css`, cùng độ bão hoà với `finance-blue`/`success-green`/`error-red` để nhất quán hệ thống, và ghi chú lại trong `.stitch/DESIGN.md` mục "Colors" (bullet "Tag Accents") + frontmatter `colors:` — tuân thủ CLAUDE.md "không tự đặt màu ngoài DESIGN.md" bằng cách **thêm token vào chính DESIGN.md** thay vì dùng hex rời trong component. 3 giá trị enum mới `ORANGE`/`PURPLE`/`PINK` thêm qua migration `20260818040000_page_status_color_more_presets` (`ALTER TYPE ... ADD VALUE`, không đổi cột/không backfill). Cập nhật `PAGE_STATUS_COLORS` (Zod, `page.schema.ts`) và `PAGE_STATUS_COLOR_OPTIONS` (`src/lib/page-status-colors.ts`, nhãn "Cam"/"Tím"/"Hồng") theo cùng pattern 5 preset trước.
- **Bổ sung ngày 2026-08-18 (theo yêu cầu user "muốn edit và lưu các loại 1 lần để page chỉ việc chọn thôi", xác nhận qua `AskUserQuestion`): `Page.status`/`status_color` (free-text + màu mỗi lần, 2 mục Changelog ngay trên) đổi thành entity picklist `PageStatusOption` — CÓ thay đổi schema thật, thêm entity mới.** User muốn định nghĩa sẵn một tập "loại trạng thái" (tên + màu) rồi mỗi Page chỉ chọn từ danh sách đó, thay vì gõ text + chọn màu lại từ đầu mỗi lần sửa Page — giống hệt mô hình `ExpenseCategory` (danh mục quản lý tập trung dưới Cài đặt, tham chiếu qua FK) hơn là free-text trực tiếp trên Page. 2 câu hỏi xác nhận qua `AskUserQuestion`: (1) **data cũ:** reset về bộ mặc định nhỏ (2 loại seed: "Hoạt động"/GREEN, "Lưu trữ"/GRAY), Admin tự gán lại cho từng Page sau — **không** cố dedupe mọi giá trị free-text cũ (có thể đã đa dạng, vd "Đang review") thành option riêng; (2) **xoá loại đang dùng:** cho phép xoá thật kể cả đang có Page tham chiếu, Page đó rơi về trạng thái rỗng/"chưa đặt" — khác hẳn nguyên tắc "không hard-delete" áp dụng cho phần lớn entity khác trong hệ thống (đã cập nhật bullet "Xoá thật (hard delete)..." trong `Conventions` ở trên để ghi rõ ngoại lệ này). Đã thực hiện: xoá cột `Page.status`/`Page.status_color`, thêm bảng mới `page_status_options` (`id`/`label`/`color PageStatusColor`/`created_at`/`updated_at` — dùng lại nguyên enum `PageStatusColor` đã có, không tạo enum mới) + cột `Page.status_id UUID?` (`@relation(..., onDelete: SetNull, onUpdate: Cascade)`). Migration `20260818050000_page_status_options` — viết tay `migration.sql` (`CREATE TABLE page_status_options` + `INSERT` 2 row seed với UUID cố định để migration deterministic + `ALTER TABLE pages ADD COLUMN status_id` + `UPDATE pages SET status_id = CASE status WHEN 'Lưu trữ' THEN <id-B>::UUID ELSE <id-A>::UUID END` (map đúng 2 giá trị đã seed, còn lại — free-text tuỳ ý trước đó — rơi về mặc định "Hoạt động" đúng như đã xác nhận) + `ADD CONSTRAINT ... FOREIGN KEY ... ON DELETE SET NULL ON UPDATE CASCADE` + `DROP COLUMN status`/`DROP COLUMN status_color`) + `prisma migrate resolve --applied` (cùng lý do shadow DB `prisma dev` lỗi state cũ như mọi migration viết tay trước đó). **Service layer mới** `page-status-option.service.ts` (`listPageStatusOptions`/`listPageStatusOptionsWithUsage` — kèm `pageCount` qua `_count.pages` để cảnh báo trước khi Xoá/`createPageStatusOption`/`updatePageStatusOption`/`deletePageStatusOption` — action **đầu tiên trong hệ thống dùng `prisma.$model.delete()` thật**, không phải `deletedAt`/`isActive`) + validator `page-status-option.schema.ts` (di chuyển `PAGE_STATUS_COLORS`/`PageStatusColorValue` từ `page.schema.ts` sang đây — giờ là nơi sở hữu chính, `page.schema.ts` chỉ còn giữ `statusIdSchema = z.uuid()`). `page.service.ts`: `PageListItem`/`PageDetail` đổi field `status`/`statusColor` thành `currentStatus: { statusId, label, color } | null` (join qua `include: { statusOption: true }`), `null` khi Page chưa từng chọn hoặc option đã bị xoá; `CreatePageInput.statusId`/`UpdatePageInput.statusId` validate tồn tại (`prisma.pageStatusOption.findUnique`) trước khi ghi, giống pattern `paidByAdminId` validate với `User`. **UI mới:** trang `/admin/settings/page-status-options` (bảng label + `PageStatusChip` preview + cột "Đang dùng" + Sửa/Xoá, cùng layout `expense-categories`), thêm entry sidebar "Loại trạng thái Page" dưới nhóm "Cài đặt" (`nav-config.ts`, icon `Palette`) và nhãn Audit Log `PageStatusOption: "Loại trạng thái Page"` (`audit-labels.ts`). Component cũ `PageStatusFields` (input text + color select trực tiếp trên Page form) đổi vai trò thành `PageStatusOptionFields` (dùng cho Create/Edit dialog của `PageStatusOption`, field đổi tên `status`/`statusColor` → `label`/`color`); Create/Edit Page form giờ dùng component mới `PageStatusPicker` (một `<Select>` duy nhất liệt kê `PageStatusOption` hiện có, hiện dot màu + label, không còn ô nhập text/chọn màu riêng). `PageStatusChip` đổi prop từ `{status, color}` rời sang một object `status: {label, color} | null`, hiện chip "Chưa đặt" (tông xám trung tính) khi `null`. Xem `context/spec.md` §15.3 và `context/plan.md`.
- **Bổ sung ngày 2026-08-18 (theo yêu cầu user "Đổi ngày ghi nhận thành tháng ghi nhận", xác nhận qua `AskUserQuestion`): `Revenue.revenue_date` đổi từ theo-ngày sang theo-tháng — CÓ thay đổi schema thật, đổi tên cột.** Cùng ngày, mục Changelog "Page purchase đổi từ theo-ngày sang theo-tháng" (2 mục phía trên) từng ghi rõ **"Không đổi ... `Revenue.revenue_date` ... — vẫn theo ngày như cũ"** — mục này đảo lại quyết định đó theo yêu cầu tiếp theo của user. Xác nhận qua `AskUserQuestion`: mỗi Page chỉ có **đúng 1 record Revenue đang hoạt động/tháng** — nhập lại cho Page + tháng đã có sẽ **ghi đè** số tiền/ghi chú, không cộng dồn thành nhiều dòng — đúng y hệt cơ chế `AdExpense` (Phase 6), khác với cân nhắc ban đầu là "vẫn cho nhiều dòng/tháng". Đã thực hiện đúng pattern AdExpense: đổi `revenue_date DATE` → `revenue_month DATE` (luôn chuẩn hoá về ngày 1 của tháng) + thêm partial unique index `revenues_page_month_unique` trên `(page_id, revenue_month) WHERE deleted_at IS NULL`. Migration `20260818070000_revenue_monthly` — `ALTER TABLE ... RENAME COLUMN` + `UPDATE ... SET revenue_month = date_trunc('month', revenue_month)::date` (dev DB rỗng lúc đó — 0 dòng Revenue — nên không có rủi ro trùng `(page_id, revenue_month)` khi tạo unique index) + `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL` + `prisma migrate resolve --applied` (cùng lý do shadow DB `prisma dev` lỗi state cũ như mọi migration viết tay trước đó). `resolvePageOwner` không đổi logic — chỉ luôn được gọi với ngày-1-của-tháng (`input.revenueMonth`) thay vì ngày cụ thể, tự động thoả mãn rule "owner đầu tháng" khi Page transfer giữa tháng. Service layer (`revenue.service.ts`, viết lại theo khuôn `ads.service.ts`): `createRevenue()` giờ là upsert thật — tìm record active cùng `(pageId, revenueMonth)` trong transaction, có thì `UPDATE` (audit action `UPDATE`, trả `wasUpdate: true`), không thì `CREATE` (`wasUpdate: false`); `updateRevenue()` **reject** (không tự động ghi đè) nếu dời record sang một `(pageId, revenueMonth)` đã có record active khác — action riêng biệt `MONTH_CONFLICT`, đúng bất đối xứng create-vs-update đã có sẵn ở AdExpense (create thì overwrite êm, update thì báo lỗi yêu cầu sửa dòng đang có thay vì tạo trùng). `listRevenue()` filter theo tháng đổi từ range `[gte,lt)` cục bộ (hàm `monthRange()` viết tay trong chính file này, trùng lặp logic với `@/lib/month`) sang so khớp chính xác `revenueMonth: monthStart` dùng `parseMonthKey` tái sử dụng từ `@/lib/month` (dọn luôn phần trùng lặp, không giữ nguyên kiểu duplicate mà `ads.service.ts` đang có). `dashboard.service.ts`/`employee.service.ts`: aggregate Revenue theo tháng đổi từ `revenueDate: { gte, lt }` sang `revenueMonth: monthStart` (so khớp chính xác), nhất quán với cách AdExpense/PagePurchaseExpense đã làm trong 2 hàm này từ trước. UI: `create-revenue-dialog.tsx`/`edit-revenue-dialog.tsx` đổi `<Input type="date">` → `<Input type="month">`, field `revenueDate` → `revenueMonth`, default value dùng `currentMonthKey()` (thay `todayIso()` cũ, vốn không qua timezone Asia/Ho_Chi_Minh); mọi nơi hiển thị (List Doanh thu, Page Detail tab Doanh thu, Employee Detail tab Doanh thu, User Dashboard "Doanh thu của tôi") đổi cột "Ngày" → "Tháng", `formatDate()` → `formatMonth()`. Xem `context/spec.md` §4/§17 và `context/plan.md` Phase 5 "Cập nhật bổ sung".
- **Bổ sung ngày 2026-08-18 (theo yêu cầu user "Trạng thái có thể chọn nhiều trạng thái được"): `Page.status_id` (FK đơn, nullable) đổi thành quan hệ nhiều-nhiều qua bảng nối mới `PageStatusAssignment` — CÓ thay đổi schema thật, thêm entity mới.** Một Page giờ có thể mang nhiều "tag" trạng thái cùng lúc (vd vừa "Hoạt động" vừa "Cần review"), thay vì đúng một trạng thái như thiết kế 2 mục Changelog ngay trên. Dùng bảng nối tường minh `PageStatusAssignment` (`id`/`page_id`/`status_option_id`/`created_at`, unique `(page_id, status_option_id)`) thay vì implicit many-to-many của Prisma — lý do: mọi table khác trong schema này đều có UUID PK + `created_at` thật (xem Conventions), một bảng nối ẩn (không id/timestamp riêng) sẽ phá vỡ tính nhất quán đó và khó audit/query trực tiếp. Migration `20260818060000_page_status_multi` — viết tay `migration.sql` (`CREATE TABLE page_status_assignments` + unique index + 2 FK `ON DELETE CASCADE ON UPDATE CASCADE` + backfill `INSERT ... SELECT` từ mọi Page đang có `status_id NOT NULL` sang đúng 1 dòng tương ứng trong bảng nối mới, dùng `gen_random_uuid()` — xác nhận Postgres 17.5 của môi trường dev có sẵn hàm này, không cần bật extension — + `DROP CONSTRAINT`/`DROP COLUMN status_id`) + `prisma migrate resolve --applied` (cùng lý do shadow DB `prisma dev` lỗi state cũ như mọi migration viết tay trước đó). **Đổi FK cascade từ trước:** `PageStatusOption` xoá giờ dùng `ON DELETE CASCADE` trên `PageStatusAssignment` (không còn `ON DELETE SET NULL` trực tiếp trên `Page` như thiết kế 1-1 cũ) — hệ quả đúng như mong đợi: xoá 1 option chỉ mất đúng dòng gán đó, Page vẫn giữ các trạng thái khác nếu có, chỉ khi đó là dòng cuối cùng thì Page mới về "chưa đặt" (0 dòng). Service layer: `page.service.ts` — `PageListItem`/`PageDetail.currentStatus: PageStatusInfo | null` đổi thành `currentStatuses: PageStatusInfo[]` (join qua `include: { statusAssignments: { include: { statusOption: true } } }`); `CreatePageInput.statusId?`/`UpdatePageInput.statusId?` đổi thành `statusIds?: string[]` — `createPage()` tạo hàng loạt dòng `PageStatusAssignment` trong cùng transaction, `updatePage()` đồng bộ theo kiểu "xoá hết rồi tạo lại" (`deleteMany` + `createMany` trong 1 `$transaction`, đơn giản hơn diff increment/decrement ở quy mô nhỏ này — CLAUDE.md "ưu tiên đơn giản"), cả hai đều validate mọi id trong mảng tồn tại trước khi ghi (giống pattern `paidByAdminId` validate với `User`). Zod (`page.schema.ts`): field đổi tên `statusId`/`statusIdSchema` → `statusIds`/`statusIdsInputSchema` (`z.array(z.uuid())`, client-side không dùng `.default()` — tránh lệch kiểu input/output giữa `zodResolver` và `useForm<T>` mà `.default()` gây ra, cùng lý do tách `notesInputSchema`/`notesSchema` đã có sẵn trong file; server-side `statusIdsSchema` mới coi field bị thiếu hẳn = mảng rỗng, phòng trường hợp caller khác (MCP) không gửi field này). UI: `PageStatusPicker` chuyển sang chế độ `multiple` có sẵn của Base UI `Select` (xác nhận qua Context7 trước khi dùng, đúng CLAUDE.md "Luôn dùng Context7 MCP") — `value`/`onValueChange` giờ là mảng, item được chọn hiện dấu tick qua `Select.ItemIndicator` (đã có sẵn trong `src/components/ui/select.tsx`, không cần sửa file đó), popup giữ mở khi chọn nhiều liên tiếp (hành vi mặc định của Base UI multi-select). Chip hiển thị: component mới `PageStatusChipList` (bọc nhiều `PageStatusChip`, wrap dòng, fallback "Chưa đặt" khi mảng rỗng) dùng ở Page List/Detail; `PageStatusChip` gốc giữ nguyên (vẫn dùng để preview 1 màu tại `/admin/settings/page-status-options`). Xem `context/spec.md` §15.3 và `context/plan.md`.
- **Bổ sung ngày 2026-08-18 (theo yêu cầu user "Khoản admin nhận phải chọn được 1 trong các admin nhận"): thêm field `received_by_admin_id` lên `AdminReceipt` — CÓ thay đổi schema thật, đảo lại loại trừ đã ghi ở mục Changelog `paid_by_admin_id` phía trên (2026-08-17: "`AdminReceipt`/`Revenue`/`SalaryHistory` không đổi").** User muốn khi ghi nhận khoản Admin đã nhận, chọn rõ **Admin nào thực sự nhận tiền**, tách biệt khỏi Admin nào đang gõ form — đúng bản chất phân biệt `created_by_admin_id` (nhập liệu) vs "người thực hiện hành động" đã áp dụng cho 3 bảng chi phí + `SalaryHistory` (paid_by), giờ áp dụng tương tự cho chiều nhận tiền. Đã thêm `received_by_admin_id UUID NOT NULL` (FK → User, cùng convention `ON DELETE RESTRICT ON UPDATE CASCADE` như `created_by_admin_id`/`paid_by_admin_id`) vào `AdminReceipt` qua migration `20260818080000_add_received_by_admin_id` — viết tay `migration.sql` (thêm cột nullable → backfill từ `created_by_admin_id` → `SET NOT NULL` → thêm FK constraint) + `prisma migrate resolve --applied`, cùng lý do và cách làm như mọi migration viết tay trước đó (shadow DB `prisma dev` lỗi state cũ). Dev DB có 0 dòng `admin_receipts` tại thời điểm migrate — backfill không có rủi ro dữ liệu. **Không đổi** `Revenue`/`SalaryHistory` — chỉ `AdminReceipt` nằm trong scope yêu cầu lần này. Service layer (`receipt.service.ts`): `createAdminReceipt`/`updateAdminReceipt` nhận thêm `receivedByAdminId`, validate tồn tại + `role === 'ADMIN'` trước khi ghi (lỗi `INVALID_RECEIVER`, giống pattern `INVALID_PAYER` của `ads.service.ts`); `listAdminReceipts` join thêm `receivedByAdmin.name`. Validator (`admin-receipt.schema.ts`): thêm `receivedByAdminIdSchema = z.uuid({ error: "Vui lòng chọn admin nhận." })` vào cả `CreateAdminReceiptSchema`/`CreateAdminReceiptClientSchema` (Update tái dùng Create). UI: `create-admin-receipt-dialog.tsx`/`edit-admin-receipt-dialog.tsx` thêm field Select "Admin nhận" (nhận thêm prop `adminOptions`, mirror đúng pattern "Người chi" trong `create-admin-expense-dialog.tsx`); trang `/admin/receipts` thêm cột bảng "Admin nhận" cạnh cột "Admin nhập" đã có (cùng cách 2 cột `AdExpense` list hiển thị cả "Người chi" và "Admin nhập"), truyền `adminOptions` (đã fetch sẵn cho bộ lọc) xuống cả 2 dialog thay vì fetch lại. Xem `context/spec.md` §9/§20/§28 và `context/plan.md` Phase 10 "Cập nhật bổ sung".
- **Tiếp tục bổ sung ngay sau đó cùng ngày (2026-08-18, theo yêu cầu user "Thay vì để ngày nhận, chọn tháng nhận là được"): `AdminReceipt.receipt_date` đổi từ theo-ngày sang theo-tháng — CÓ thay đổi schema thật, đổi tên cột.** Cùng mẫu đã áp dụng cho `Revenue.revenue_date` (mục Changelog phía trên) và Page purchase — đổi `receipt_date DATE` → `receipt_month DATE` (luôn chuẩn hoá về ngày 1 của tháng). **Khác Revenue/AdExpense:** `AdminReceipt` không có `page_id` và **không thêm unique constraint theo tháng** — nhiều khoản nhận trong cùng một tháng vẫn được phép như trước (spec §9 "Có thể có nhiều khoản nhận trong một tháng"), đây chỉ là đổi độ chính xác lưu trữ (ngày → tháng), không đổi rule nghiệp vụ upsert/overwrite như Revenue/Ads. Migration `20260818090000_admin_receipt_monthly` — `ALTER TABLE ... RENAME COLUMN` + `UPDATE ... SET receipt_month = date_trunc('month', receipt_month)::date` để chuẩn hoá dòng cũ (dev DB có đúng 1 dòng, đã soft-delete, ngày 18 → chuẩn hoá về ngày 1 đúng như kỳ vọng, không có unique index nào để va chạm) + `prisma migrate resolve --applied` (cùng lý do shadow DB `prisma dev` lỗi state cũ như mọi migration viết tay trước đó). Service layer (`receipt.service.ts`): xoá hẳn hàm `monthRange()` cục bộ trùng lặp, đổi sang dùng `parseMonthKey` từ `@/lib/month` + so khớp chính xác `receiptMonth: monthFilter` (thay filter khoảng `[gte,lt)` cũ) — cùng cách dọn dẹp đã làm cho `revenue.service.ts`; `dashboard.service.ts`'s `getSystemFinancials` cũng đổi aggregate `AdminReceipt` từ `receiptDate: {gte,lt}` sang `receiptMonth: monthStart` khớp chính xác, nhất quán với Revenue/AdExpense/PagePurchaseExpense trong cùng hàm. UI: `create-admin-receipt-dialog.tsx`/`edit-admin-receipt-dialog.tsx` đổi `<Input type="date">` → `<Input type="month">`, field `receiptDate` → `receiptMonth`, default value đổi từ `todayIso()` sang `currentMonthKey()` (như Revenue); trang `/admin/receipts` đổi cột "Ngày nhận" → "Tháng nhận", `formatDate()` → `formatMonth()`. Bộ lọc `AdminReceiptFilters` (`<Input type="month">`) không đổi — đã lọc theo tháng từ trước, chỉ tầng service bên dưới đổi cách khớp. Xem `context/spec.md` §9 và `context/plan.md` Phase 10 "Cập nhật bổ sung".
- **Bổ sung ngày 2026-08-18 (theo yêu cầu user "thêm field là page hệ thống hoặc page bkt, page hệ thống thì không cần giá mua, và ở màn user, user có quyền tự thêm page hệ thống vào account do mình quản lý"): thêm `Page.page_type` (enum `SYSTEM|BKT`, default `BKT`) — CÓ thay đổi schema thật, thêm enum mới.** 3 câu hỏi xác nhận qua `AskUserQuestion`: (1) Page hệ thống (`SYSTEM`) tự động **gán ngay cho chính User tạo** (PageAssignment tạo cùng transaction, không qua bước "chưa gán" chờ Admin); (2) Page BKT vẫn **chỉ Admin tạo được** — User không tự tạo Page BKT; (3) tên field/nhãn đúng như đề xuất (`page_type`, nhãn "Page hệ thống"/"Page BKT"). Migration `20260818100000_add_page_type` — lần này **`prisma migrate dev` áp trực tiếp lên shadow DB thất bại như mọi lần trước** (`type "Role" already exists` — shadow DB `prisma dev` vẫn giữ lỗi state cũ đã ghi nhận nhiều lần ở các mục Changelog phía trên), nên viết tay `migration.sql` (`CREATE TYPE "PageType" AS ENUM ('SYSTEM', 'BKT')` + `ALTER TABLE pages ADD COLUMN page_type "PageType" NOT NULL DEFAULT 'BKT'`, default `BKT` giữ nguyên hành vi mọi Page cũ) + `prisma migrate resolve --applied`. **Lưu ý quy trình phát hiện lần này:** `prisma migrate resolve --applied` chỉ đánh dấu migration đã áp dụng trong bảng lịch sử — **không tự chạy SQL thật** lên database; phải chạy thêm `npx prisma db execute --file migration.sql` để thực sự tạo enum/cột trước khi `resolve`, nếu không DB sẽ lệch với migration history (đã tự phát hiện qua test suite báo lỗi `column page_type of relation pages does not exist` ngay sau khi resolve, sửa bằng cách execute lại file SQL) — ghi lại rõ ràng ở đây vì các mục Changelog viết tay trước đó không nêu rõ bước `db execute` này, dễ lặp lại lỗi tương tự cho migration viết tay sau này. Business rule: `SYSTEM` = không có giá mua (`purchase_price` luôn `0`, `paid_by_admin_id` luôn `null`, không bao giờ tạo `PagePurchaseExpense`) + User có thể tự tạo và tự gán cho chính mình qua `createSystemPageForSelf()` (`page.service.ts`, mới) — tạo `Page` + `PageAssignment` đầu tiên (employee = chính User đó) trong 1 transaction, `purchaseMonth`/`startedAt` = tháng hiện tại (không hỏi), ghi Audit Log với `actorUserId` = chính User đó (không phải Admin — `created_by_admin_id`/`assigned_by_admin_id` là FK→User thuần, không ràng buộc `role=ADMIN` ở tầng DB, nên hợp lệ khi lưu id của User tự thao tác). `BKT` = flow trả phí hiện có (không đổi), chỉ Admin tạo qua `/admin/pages/new` (form thêm Select "Loại Page" — chọn `SYSTEM` ẩn hẳn Giá mua/Người chi, ép về 0). `createPage()` (Admin flow) reject (`SYSTEM_PAGE_NO_PRICE`) nếu `pageType=SYSTEM` mà `purchasePrice > 0`; `CreatePageInput.pageType` để **optional** (default `BKT` ở service layer) — cùng lý do/pattern đã áp dụng cho `statusColor` trước đó (mục Changelog "Page.status đổi từ enum..." ở trên): hàng chục test hiện có gọi `createPage()` trực tiếp, không phải sửa lại toàn bộ chỉ vì thêm 1 field. UI mới: `PageTypeChip` (`src/components/tables/page-type-chip.tsx`, cùng ngôn ngữ hiển thị `RoleChip`) ở `/admin/pages`, `/admin/pages/[pageId]`, `/user/pages`; route mới `/user/pages/new` + `CreateSystemPageForm` (chỉ Tên/Facebook URL/Trạng thái/Ghi chú, không có Giá mua/Tháng mua/Người chi/chọn nhân viên) + Server Action `createSystemPageForSelfAction`. Xem `context/spec.md` §15.2/§12 (mục "/user/pages") và `context/plan.md` Phase 4.
- **Bổ sung ngày 2026-08-18 (theo yêu cầu user, sau khi được hỏi "Danh mục chi phí này có cần thiết không, không thì bỏ đi" + xác nhận qua `AskUserQuestion` — chọn "Bỏ hẳn Danh mục chi phí" thay vì chỉ xoá 3 danh mục HỆ THỐNG): bỏ hẳn tính năng Expense Categories — CÓ thay đổi schema thật, xoá entity + enum.** Trước khi làm, đã audit lại thực tế usage (không chỉ đọc mô tả): xác nhận 3 danh mục HỆ THỐNG (`PAGE_PURCHASE`/`ADS`/`SALARY`) **không hề có FK thật** tới `PagePurchaseExpense`/`AdExpense`/`SalaryHistory` (3 bảng đó không có `category_id`, hoàn toàn tách biệt) — chỉ là placeholder không sửa/xoá được nhưng **vẫn chọn được** cho một `AdminExpense` thật qua dropdown (do Phase 9 "không lọc theo scope"), gây rủi ro dữ liệu gán nhầm nhãn (một khoản Chi phí chung mang nhãn "Lương nhân viên"). User xác nhận không cần cả 2 danh mục thật ("Khác"/"Tài nguyên") lẫn 3 danh mục hệ thống — bỏ hẳn field `category_id` trên `AdminExpense` luôn, Chi phí chung không còn phân loại. Đã xoá hẳn: enum `ExpenseCategoryScope`, model `ExpenseCategory`, field `AdminExpense.categoryId`/relation `category`. Migration `20260818110000_drop_expense_categories` — viết tay `migration.sql` (`DROP CONSTRAINT admin_expenses_category_id_fkey` + `ALTER TABLE admin_expenses DROP COLUMN category_id` + `DROP TABLE expense_categories` + `DROP TYPE "ExpenseCategoryScope"`) + `npx prisma db execute --file migration.sql` (chạy SQL thật trước — đúng bài học đã ghi ở mục Changelog `page_type` ngay trên, `resolve --applied` không tự chạy SQL) + `prisma migrate resolve --applied`. Dev DB tại thời điểm migrate: 0 dòng `AdminExpense` active (user đã tự xoá hết Chi phí chung trước khi yêu cầu việc này) — không có rủi ro mất dữ liệu thật, không cần backfill/migrate dữ liệu nào. **Xoá hẳn** (không phải archive): `src/server/services/expense-category.service.ts`, `src/server/actions/expense-category.actions.ts`, `src/server/validators/expense-category.schema.ts`, `src/app/admin/settings/expense-categories/` (route), `src/components/forms/{create,edit}-expense-category-dialog.tsx`, `tests/unit/expense-category-service.test.ts`, seeding `EXPENSE_CATEGORIES` trong `prisma/seed.ts`. **Sửa surgical** (bỏ mọi tham chiếu `categoryId`/`category`): `admin-expense.service.ts` (list/create/update/audit JSON), `admin-expense.schema.ts`, `admin-expense.actions.ts`, `/admin/expenses/page.tsx` (bỏ cột "Danh mục" + filter), `create-admin-expense-dialog.tsx`/`edit-admin-expense-dialog.tsx` (bỏ hẳn field Select "Danh mục"), `admin-expense-filters.tsx` (chỉ còn Tháng + Admin), `dashboard.service.ts` (Recent Activity message đổi từ `category.name` sang `description`), `nav-config.ts` (bỏ mục "Danh mục chi phí" khỏi sidebar Cài đặt). **Giữ nguyên** `audit-labels.ts`'s `ExpenseCategory: "Danh mục chi phí"` — `AuditLog` append-only, các bản ghi CREATE/UPDATE `ExpenseCategory` lịch sử (nếu có) vẫn cần nhãn tiếng Việt dễ đọc dù entity đã không còn tồn tại. Test: xoá `expense-category-service.test.ts` nguyên file; sửa `admin-expense-service.test.ts` (bỏ fixture `expenseCategory`, đổi test "rejects an unknown category" thành "rejects an invalid payer" vì validation category không còn tồn tại để test) và `dashboard-service.test.ts` (bỏ lookup category trong setup) — **119/119 test pass** (từ 125, trừ 6: xoá nguyên `expense-category-service.test.ts`). `tsc`/`lint`/`npm run build` đều sạch, route `/admin/settings/expense-categories` không còn trong danh sách route build (25 route, từ 26). Xem `context/spec.md` §19/§21 (đã gỡ) và `context/plan.md` Phase 8 (đánh dấu đã gỡ bỏ).
- **Bổ sung ngày 2026-08-18 (theo yêu cầu user "thêm mục tiền nhân viên đã nhận, mỗi tháng chỉ có 1 khoản, không cộng vào table của nhân viên mà là một mục để xem thôi", xác nhận qua `AskUserQuestion`): thêm entity mới `EmployeeReceipt` — CÓ thay đổi schema thật.** 3 câu hỏi xác nhận: (1) tối đa **một record/nhân viên/tháng** — cùng cơ chế upsert-ghi-đè như `Revenue`/`AdExpense` (không phải một con số tổng hệ thống); (2) hiển thị ở **trang riêng dưới "Tài chính"** liệt kê mọi nhân viên (không phải tab trong Employee Detail); (3) field **chỉ amount + note**, không có "Người chi" riêng tách khỏi "Admin nhập" (khác mọi bảng chi phí/nhận tiền khác trong hệ thống — quyết định có chủ đích để đơn giản, theo đúng yêu cầu user). Migration `20260818120000_add_employee_receipt` — viết tay `migration.sql` (`CREATE TABLE employee_receipts` + partial unique index `employee_receipts_employee_month_unique` `(employee_id, receipt_month) WHERE deleted_at IS NULL` + 2 FK `ON DELETE RESTRICT ON UPDATE CASCADE`) + `npx prisma db execute --file migration.sql` (chạy SQL thật trước khi resolve — đúng bài học đã ghi ở 2 mục Changelog `page_type`/expense-categories phía trên) + `prisma migrate resolve --applied`. **Ràng buộc quan trọng nhất của tính năng này:** `EmployeeReceipt` **không được** cộng vào `getEmployeeFinancials`/`getEmployeeMonthlySeries` (mục 10.1/10.2) hay bất kỳ công thức Total Expenses/Profit nào khác — service layer mới `employee-receipt.service.ts` không join/import gì từ `employee.service.ts`/`dashboard.service.ts`, và có test riêng xác nhận tạo `EmployeeReceipt` không làm thay đổi `getEmployeeFinancials()` trước/sau. Service layer: `listEmployeeReceipts`, `createEmployeeReceipt` (upsert theo `(employeeId, receiptMonth)`, mirror `createRevenue`), `updateEmployeeReceipt` (reject `MONTH_CONFLICT` nếu dời sang cặp đã có record active khác, mirror `updateRevenue`), `softDeleteEmployeeReceipt`. Validator `employee-receipt.schema.ts`, Server Actions `employee-receipt.actions.ts`. UI mới: route `/admin/employee-receipts` (bảng Nhân viên/Tháng/Số tiền/Admin nhập/Ghi chú/Thao tác, Create/Edit dialog dùng `<Select>` chọn nhân viên — quy mô nhỏ ~8 nhân viên, không cần Combobox tìm kiếm như Page), filter Tháng + Nhân viên (`EmployeeReceiptFilters`, cùng pattern `AdminExpenseFilters`), nav item "Tiền nhân viên đã nhận" dưới nhóm "Tài chính" (`nav-config.ts`, icon `PiggyBank`), nhãn Audit Log `EmployeeReceipt: "Tiền nhân viên đã nhận"` (`audit-labels.ts`). Test: file mới `tests/unit/employee-receipt-service.test.ts` (9 test — create/upsert-overwrite/reject unknown employee/isolation khỏi Employee Cost/update/reject month conflict/soft delete/reject double-delete/filter) — **128/128 test pass** (từ 119). `tsc`/`lint`/`npm run build` đều sạch, route `/admin/employee-receipts` build ra `ƒ` (dynamic). Xem `context/spec.md` §20a (mới) và `context/plan.md`.
- **Bổ sung ngày 2026-08-19 (theo yêu cầu user, sau khi tự kiểm thử Phase 15/16 qua MCP Inspector thấy `AuditLog` đã lên 11.042 dòng — chấp nhận đánh đổi mất lịch sử): `AuditLog` đổi từ append-only vô hạn sang giới hạn cứng 5.000 dòng, hard-delete dòng cũ nhất khi vượt — KHÔNG đổi schema (không thêm/bớt cột), chỉ đổi hành vi ghi.** Nguyên nhân phát sinh: mỗi lần gọi MCP tool (kể cả tool read-only như `get_dashboard`/`list_pages`, kể cả gọi thất bại) đều ghi 1 dòng `AuditLog` (spec §29, Phase 15) — khi test dồn dập qua Inspector/Claude Code, bảng phình rất nhanh so với tốc độ giao dịch tài chính thật (~1.000/tháng). Đã cảnh báo user đây là đảo ngược rule "AuditLog append-only, không sửa/xoá" (CLAUDE.md, ghi từ đầu dự án) — lý do rule đó tồn tại là để truy vết được hành vi AI/Admin khi có sự cố, đặc biệt vì MCP có quyền Admin Full; user xác nhận **chấp nhận đánh đổi**, ưu tiên đơn giản (không cần cơ chế archive riêng) hơn giữ lịch sử vô hạn. **Đã cân nhắc nhưng không chọn:** archive sang bảng/nơi lưu trữ khác trước khi xoá (an toàn hơn, giữ được lịch sử) — user chủ động chọn xoá thật, không archive, để đơn giản nhất có thể (đúng tinh thần CLAUDE.md "ưu tiên đơn giản"). Implementation: `src/server/audit/log-action.ts` — hằng số `AUDIT_LOG_MAX_ROWS = 5000`; hàm mới `trimAuditLog(maxRows = AUDIT_LOG_MAX_ROWS)` — đếm tổng số dòng, nếu vượt thì `deleteMany` đúng số dòng dư, sắp theo `created_at` tăng dần (cũ nhất trước) — hard delete thật (`prisma.auditLog.deleteMany`), không phải set `deleted_at` (bảng này vốn không có cột đó). `logAction()` gọi `trimAuditLog()` sau mỗi lần `create()` — chạy đồng bộ ngay trong request đang ghi log đó, không phải cron/background job riêng (đơn giản nhất ở quy mô nội bộ hiện tại; nếu sau này thấy nặng có thể tách ra cron, nhưng chưa cần). Vì bảng luôn được trim về ≤5.000 dòng ngay sau mỗi lần ghi, `COUNT(*)` mỗi lần gọi luôn rẻ (không bao giờ quét bảng lớn hơn 5.001 dòng). Test: `tests/unit/log-action.test.ts` (mới) — gọi trực tiếp `trimAuditLog(maxRows nhỏ)` trên fixture tự tạo (không cần tạo thật 5.000 dòng), xác nhận giữ đúng N dòng mới nhất, xoá đúng dòng cũ nhất, no-op khi chưa vượt giới hạn. Đã cập nhật `CLAUDE.md` (mục "Core Business Rules") và định nghĩa entity `AuditLog` ở trên — đây là **ngoại lệ duy nhất** cho rule "không hard delete", không áp dụng cho 6 entity tài chính (Page/Revenue/AdExpense/PagePurchaseExpense/AdminExpense/AdminReceipt) vẫn dùng soft delete như cũ.
- **Bổ sung ngày 2026-08-19 (theo yêu cầu user "muốn tách lợi nhuận của nhân viên đó... thêm mục coi như là chi phí của nhân viên sao cho điều chỉnh lợi nhuận về mức 0", xác nhận qua 2 vòng `AskUserQuestion`): thêm entity mới `EmployeeProfitSettlement` — CÓ thay đổi schema thật, đảo ngược quyết định spec §10.2 gốc ("Không cần tính lợi nhuận riêng của từng nhân viên").** 2 câu hỏi xác nhận: (1) số tiền "chốt" **luôn tự tính** bằng lợi nhuận đang chạy tại thời điểm bấm, Admin không gõ tay — tránh sai lệch với số liệu thật; (2) khoản này **không** cộng vào Total Expenses/Profit hệ thống (mục 10.3/10.5) — thuần bút toán nội bộ cho riêng tính năng này, cùng nguyên tắc cô lập đã áp dụng cho `EmployeeReceipt` (mục Changelog 2026-08-18 phía trên). Migration `20260819103136_add_employee_profit_settlement` — lần này `prisma migrate dev` chạy trực tiếp thành công (không cần viết tay `migration.sql` như nhiều migration trước — môi trường DB lúc này là Neon thật, không phải `prisma dev` local có shadow DB lỗi state cũ). Công thức: `Employee Profit (running) = Employee Revenue (all-time) − Employee Cost (all-time) − Σ EmployeeProfitSettlement.amount (deleted_at IS NULL)` — đọc `getEmployeeFinancials()` có sẵn từ Phase 7, không tạo query trùng lặp. Service layer mới `profit-settlement.service.ts`: `computeEmployeeProfit()`, `listEmployeesWithPositiveProfit()` (lọc in-memory theo `currentProfit > 0`, quy mô nhỏ ~8 nhân viên nên chấp nhận được), `settleEmployeeProfit()` (reject `NO_POSITIVE_PROFIT` nếu lợi nhuận ≤ 0, ghi Audit `action=SETTLE`). Route mới `/admin/profit-settlements` (nav "Lợi nhuận NV", nhóm Tài chính) — bảng chỉ hiện nhân viên có lợi nhuận dương, nút "Chốt về 0" (dùng `ConfirmDialog` chung) tự tính sẵn số tiền, không có form nhập tay. **Không có UI sửa/undo** cho `EmployeeProfitSettlement` ở phase này (dù có `deleted_at` sẵn trong schema theo đúng "Conventions" #7 — để dành, chưa được yêu cầu) — không có `updated_at` vì số tiền không bao giờ sửa tay. **Không có MCP tool** cho entity này (quyết định có chủ đích, xác nhận cùng lúc — AI agent không nên tự quyết định chốt lợi nhuận nhân viên). Test: file mới `tests/unit/profit-settlement-service.test.ts` (9 test — compute balance đúng công thức/lọc đúng danh sách dương/search/settle ghi đúng audit+netting về 0/reject settle 2 lần liên tiếp/reject nhân viên không có lợi nhuận dương/không đụng `getEmployeeFinancials`/vòng lợi nhuận mới sau khi đã chốt trước đó tính độc lập đúng) — **176/176 test pass** (từ 167). `tsc`/`lint`/`npm run build` đều sạch, đã kiểm thử tay qua browser thật (tạo Page+Revenue giả lập lợi nhuận dương, bấm "Chốt về 0", xác nhận nhân viên biến mất khỏi danh sách, dọn sạch dữ liệu test sau đó). Xem `context/spec.md` §10.2 (ghi chú bổ sung) và §38 (nav item mới).
- **Cập nhật ngày 2026-08-19, sau khi gộp "Lợi nhuận nhân viên" vào Employee List (mục Changelog ngay trên) — ĐẢO NGƯỢC quyết định cô lập "thuần bút toán nội bộ" (theo yêu cầu user "chi phí nhân viên thêm một số tiền đã chốt và đây, không có ngừoi chi, với loại là chốt lợi nhuận"): `EmployeeProfitSettlement.amount` giờ là thành phần thứ 4 thật sự của `Employee Cost` (mục 10.2) — KHÔNG đổi schema (không thêm/bớt field), chỉ đổi công thức tính ở service layer.** `getEmployeeFinancials()` (`employee.service.ts`) thêm field trả về `profitSettlementCost` (Σ `EmployeeProfitSettlement.amount` active, cùng `monthKey` scoping như 3 field cost khác), `totalCost = adsCost + pagePurchaseCost + salaryCost + profitSettlementCost`. Hệ quả dây chuyền: mọi nơi đọc `totalCost`/`Lợi nhuận` (Employee Detail, Employee List, User Costs, User Dashboard) tự động chính xác mà không cần sửa logic riêng — trước đó các trang này có 2 khái niệm "Lợi nhuận" lệch nhau (`totalCost` không trừ settlement vs. `computeEmployeeProfit` có trừ), user phát hiện qua Employee Detail's Chi phí tab không hiện khoản đã chốt. Xoá hẳn khỏi `profit-settlement.service.ts`: `computeEmployeeProfit`, `EmployeeProfitBalance`, `EmployeeProfitRow`, `getSettledTotalsForEmployees`, `listEmployeesWithPositiveProfit` (không còn cần thiết — `EmployeesPage` giờ tính thẳng `currentProfit = employee.revenue − employee.totalCost`). Giữ lại/thêm mới: `settleEmployeeProfit()` (không đổi logic tính số tiền chốt, chỉ đổi effect: ghi xong thì `totalCost` tăng ngay, running profit tự nét về 0 ở lần đọc tiếp theo), `listProfitSettlements(employeeId)` (mới — feed dòng "Bù chi phí" vào bảng "Chi tiết chi phí" của Employee Detail + User Costs, `pageId/pageName: null`, `paidByAdminName: "—"` vì không có "Người chi" — số tiền hệ thống tự tính, không phải Admin chọn chi cho ai). **Vẫn giữ nguyên** phần còn lại của quyết định cô lập ban đầu: **không** cộng vào `Total Expenses`/`Profit` **hệ thống** (mục 10.3/10.5) — `getSystemFinancials()`/`getAdminSpendingBreakdown()`/`getSystemMonthlySeries()` (`dashboard.service.ts`) hoàn toàn độc lập, không đọc `EmployeeProfitSettlement` — chỉ đảo phần Employee-Cost-level, không đảo phần system-wide. UI: Employee Detail's Chi phí tab thêm KPI card thứ 4 "Bù chi phí" (`sm:grid-cols-3`→`sm:grid-cols-4`); User Costs tương tự (5 card: Ads/Mua Page/Lương/Bù chi phí/Tổng chi phí); User Dashboard's "Cơ cấu chi phí" donut thêm lát thứ 4 màu `#027A48` (tái dùng màu "Tài nguyên" của Admin Dashboard) — bắt buộc phải thêm để `total` (dùng `allTimeFinancials.totalCost`) tiếp tục khớp đúng tổng các lát, tránh lặp lại đúng bug "1.000.000 ở đâu" đã sửa trước đó cho Admin Dashboard. Test: `tests/unit/profit-settlement-service.test.ts` viết lại hoàn toàn (bỏ test cho hàm đã xoá, thêm test xác nhận settlement làm tăng `totalCost`/nét running profit về 0); `tests/unit/employee-financials.test.ts` thêm `profitSettlementCost: 0n` vào assertion `toEqual` all-zero. `tsc`/`lint`/`npm run build` đều sạch, kiểm thử tay qua browser thật (tạo Employee/Page/Revenue giả lập lợi nhuận dương, bấm "Chốt về 0" trên Employee Detail, xác nhận: Lợi nhuận→0, Tổng chi phí tăng đúng bằng số đã chốt, dòng "Bù chi phí" xuất hiện trong Chi tiết chi phí với Page="—"/Người chi="—", đồng bộ trên cả Employee List/User Costs/User Dashboard donut — total luôn khớp tổng lát), dọn sạch dữ liệu + audit log test sau đó. Xem `context/spec.md` §10.2/§14.3/§12 và `CLAUDE.md` (Core Business Rules — công thức Employee Cost).
