# Implementation Plan — Finance & Revenue Dashboard

Nguồn: [context/spec.md](spec.md), [context/schema.md](schema.md), [.stitch/DESIGN.md](../.stitch/DESIGN.md), [CLAUDE.md](../CLAUDE.md).

Quy tắc chia giai đoạn: mỗi phase chỉ làm **một** nhóm tính năng, test độc lập được, không phụ thuộc phase *sau*, ước tính 2–3 giờ implement. Core trước, nice-to-have sau. **Không tự chuyển sang phase tiếp theo** khi chưa qua được "Điểm dừng" của phase hiện tại.

## Trạng thái các giai đoạn

- [x] Phase 1: Setup + Shell UI
- [x] Phase 2: Authentication + RBAC
- [x] Phase 3: Employee Management (CRUD + Salary History)
- [x] Phase 4: Page Management + Assignment + Purchase Expense
- [x] Phase 5: Revenue Management
- [x] Phase 6: Ads Management
- [x] Phase 7: Employee/Page Detail wiring + User self-service Dashboard
- [x] Phase 8: Expense Categories (❌ ĐÃ GỠ BỎ 2026-08-18 — xem phase section bên dưới)
- [x] Phase 9: Admin Expenses
- [x] Phase 10: Admin Receipts
- [x] Phase 11: Admin Dashboard (KPI + Charts + Recent Activity)
- [x] Phase 12: Audit Log
- [x] Phase 13: Settings — User Accounts
- [x] Phase 13.1: Tinh chỉnh UX/UI & sửa lỗi nghiệp vụ theo phản hồi user (session 2026-08-18)
- [x] Phase 13.2: Page hệ thống, Tiền nhân viên đã nhận, gỡ Expense Categories, Dashboard "Cơ cấu chi phí" (session 2026-08-18 → 2026-08-19)
- [x] Phase 14: Settings — MCP / API Key Management
- [x] Phase 15: MCP Server — Auth + Read Tools
- [x] Phase 16: MCP Server — Write Tools + Destructive Safety
- [x] Phase 16.1: Audit Log cap 5.000 dòng, Dashboard/Sidebar UX cho cả Admin & User, đồng bộ công thức Lợi nhuận (session 2026-08-19)
- [x] Phase 17: Polish (responsive, animation, edge cases)
- [x] Phase 17.1: Rebrand, nhạc nền, Hồ sơ Admin, Lợi nhuận nhân viên, month filter Dashboard (session 2026-08-19 tiếp theo)
- [x] Phase 17.2: Bảo mật + Deploy prep + Đồng bộ MCP tool (session 2026-08-20)

> Cập nhật `[ ]` → `[x]` ngay trong mục checklist trên **và** trong tiêu đề phase tương ứng bên dưới khi phase đó hoàn thành và đã qua điểm dừng.

---

## Ghi chú chung (áp dụng mọi phase)

- **Stitch project:** `14032540476461860166`. Đã kiểm tra `list_screens` hiện có sẵn **4 screen** thiết kế:
  | Title trong Stitch | Dùng cho |
  |---|---|
  | "Bảng điều khiển Admin" | Phase 1 (shell), Phase 11 (Admin Dashboard) |
  | "Quản lý Nhân sự" | Phase 1 (shell), Phase 3 (Employee List/Detail) |
  | "Quản lý Trang (Pages)" | Phase 1 (shell), Phase 4 (Page List/Detail) |
  | "Quản lý Doanh thu" | Phase 1 (shell), Phase 5 (Revenue) |

  Mọi screen khác (Login, Ads, Admin Expenses, Admin Receipts, Expense Categories, Settings Users, Settings MCP, Audit Log, User Dashboard, Transfer Page modal, Employee/Page Detail tabs con) **chưa có sẵn trong Stitch** — quy trình bắt buộc theo `CLAUDE.md`: `list_screens` → nếu không có screen phù hợp thì dùng design system đã upload (`.stitch/DESIGN.md`) để generate screen mới bám token (tương đương `extract_design_context → generate_screen_from_context` mà đề bài mô tả), sau đó đối chiếu lại với `.stitch/DESIGN.md` trước khi implement. Không tự bịa màu/spacing ngoài DESIGN.md.
- **Mỗi phase khi làm CRUD/mutation thực sự (từ Phase 2 trở đi) đều phải:** validate Zod ở service layer, ghi `AuditLog` (action tương ứng theo spec §29), RBAC server-side (không dựa vào ẩn UI), soft delete cho entity tài chính. Đây là yêu cầu cross-cutting, không tách thành phase riêng — Phase 12 chỉ là phase build **UI xem** Audit Log, việc *ghi* log phải làm ngay từ phase tạo ra action đó.
- **Filter/Search/Pagination** (spec §13, §41, §42) là yêu cầu cross-cutting cho từng list screen — làm ngay trong phase tạo ra list đó (Revenue, Ads, Expenses, Receipts, Employees, Pages, Audit), không tách phase riêng.
- **Không tự đổi schema.** Nếu phát sinh nhu cầu thay đổi field/entity ngoài `context/schema.md`, dừng lại, hỏi user — xem mục "Ghi chú thay đổi schema (nếu cần)" ở cuối file.
- **Không tự đổi design token** ngoài `.stitch/DESIGN.md`.
- Lệnh chạy local dùng chung mọi phase (giả định `package.json` scripts chuẩn Next.js + Prisma):
  ```bash
  npm run dev              # http://localhost:3000
  npx prisma migrate dev   # áp schema mới
  npx prisma db seed       # seed dữ liệu dev
  npm run lint
  npm run test             # unit/integration tests
  ```

---

## Phase 1: Setup + Shell UI ✅ (đã hoàn thành, đã kiểm thử)

**Ghi chú thực hiện (khác với mô tả gốc bên dưới):**
- **Design token đặt trong `src/app/globals.css` (`@theme`), không phải `tailwind.config.ts`** — dự án dùng Tailwind v4 (CSS-first config, không có file JS/TS config). Toàn bộ giá trị vẫn map 1:1 từ `.stitch/DESIGN.md`, chỉ khác vị trí file.
- **DB dev dùng `npx prisma dev`** (Postgres local ephemeral, không cần Docker) để chạy thử migration — connection string trong `.env` sẽ đổi khi user trỏ sang Supabase/Neon thật cho các phase sau.
- shadcn/ui preset "Nova" dùng `@base-ui/react` (không phải Radix) → polymorphic link dùng prop `render={<Link .../>}` thay vì `asChild`.
- Bản dựng ban đầu bị lỗi RSC "Functions cannot be passed to Client Components" do truyền thẳng icon component (lucide-react) làm prop vào `SidebarNavItem`/`UserNavItem` (client component) — đã sửa bằng cách render icon ở phía server rồi truyền xuống dưới dạng `ReactNode`.
- Trang `/`, `/admin/*`, `/user/*` đều public tạm thời (chưa có Auth) đúng như plan; đã build production + lint + typecheck sạch, cả 22 route trả 200.
- Trang Login **chưa** tạo (thuộc Phase 2 theo plan).

**Mục tiêu:** Khung sườn Next.js chạy được, layout Admin/User đúng design system, điều hướng đầy đủ, chưa có dữ liệu thật (mock data).

**Việc cần làm:**
1. Khởi tạo Next.js (App Router) + TypeScript + Tailwind CSS + ESLint/Prettier.
2. Cài `shadcn/ui`, `lucide-react`, `recharts`, `react-hook-form`, `zod`.
3. Map font: Space Grotesk (headline), Inter (body), JetBrains Mono (data-tabular) + toàn bộ color token, spacing, radius từ `.stitch/DESIGN.md` vào `tailwind.config.ts` (không hard-code hex ngoài file này).
4. Khởi tạo Prisma (`prisma/schema.prisma`) theo đúng **toàn bộ** entity/field/enum/constraint trong `context/schema.md` (User, EmployeeProfile, SalaryHistory, Page, PageAssignment, Revenue, AdExpense, PagePurchaseExpense, ExpenseCategory, AdminExpense, AdminReceipt, AuditLog, McpClient). Chạy migration đầu tiên trên DB dev (Supabase/Neon Postgres).
5. Gọi `list_screens` trên Stitch project, `fetch_screen_code` + `fetch_screen_image` cho "Bảng điều khiển Admin" để lấy layout Sidebar/Topbar tham chiếu.
6. Map screens → routes theo Admin Navigation (spec §38) và User Navigation (spec §39):
   - Admin: `/admin/dashboard`, `/admin/employees`, `/admin/pages`, `/admin/revenue`, `/admin/ads`, `/admin/expenses`, `/admin/receipts`, `/admin/settings/expense-categories`, `/admin/settings/users`, `/admin/settings/mcp`, `/admin/settings/audit`.
   - User: `/user/dashboard`, `/user/pages`, `/user/revenue`, `/user/costs`, `/user/profile`.
7. Implement `RootLayout`, `AdminLayout` (sidebar tối màu `#17141F`, active link viền trái Finance Blue, theo mục "Sidebar" DESIGN.md), `UserLayout` (nav rút gọn).
8. Empty state components dùng chung (bảng rỗng, card rỗng) theo phong cách "Empty state rõ ràng" (spec §40).
9. Mock data tĩnh (JSON/TS const) cho KPI card, bảng nhân viên, bảng Page, danh sách Revenue để render toàn bộ trang rỗng/mẫu — **chưa** kết nối service layer thật.
10. Loading skeleton component dùng chung.

**Màn hình Stitch dùng:** "Bảng điều khiển Admin" (layout tổng), "Quản lý Nhân sự", "Quản lý Trang (Pages)", "Quản lý Doanh thu" (tham chiếu bố cục Clean Table chung cho mọi list page).

**Test / chạy local:**
- `npm run dev` → mở tất cả route Admin + User, xác nhận sidebar/topbar đúng token màu, font đúng 3 tầng (Space Grotesk/Inter/JetBrains Mono).
- Xác nhận empty state hiển thị đúng khi mock data rỗng.
- `npx prisma migrate dev` chạy sạch, `npx prisma studio` xem đúng toàn bộ bảng theo schema.md.
- Resize desktop 1280–1920px kiểm tra grid 12 cột + margin 32px/gutter 24px không vỡ.

**Điểm dừng:** Dừng lại xin xác nhận từ user trước khi sang Phase 2. Không có Auth thật ở phase này — mọi route đang mở public tạm thời để review UI.

---

## Phase 2: Authentication + RBAC ✅ (đã hoàn thành, đã kiểm thử)

**Ghi chú thực hiện (khác với mô tả gốc bên dưới):**
- **Route guard dùng `src/proxy.ts`, không phải `middleware.ts`.** Next.js 16 đã deprecate file convention `middleware` và đổi tên thành `proxy` (cùng chức năng, chỉ đổi tên file/export). Đã đọc `node_modules/next/dist/docs/.../proxy.md` trước khi code theo đúng quy tắc CLAUDE.md.
- **Session:** JWT ký bằng HS256 qua `jose` (khuyến nghị chính thức của Next.js docs cho stateless session), cookie `HttpOnly` + `SameSite=lax` + `Secure` (chỉ bật ở production để không chặn `http://localhost` khi dev). Payload JWT chỉ chứa `{userId, role}` — không nhét PII (đúng khuyến nghị "Session Management" của Next.js). Hết hạn sau 7 ngày, không có refresh/sliding session (ngoài phạm vi acceptance criteria).
- **Password hashing:** `bcryptjs` (pure JS, không cần build native binding — an toàn hơn khi deploy Vercel serverless) thay vì `argon2` native. Đáp ứng đúng yêu cầu "Argon2/bcrypt" trong CLAUDE.md.
- **Kiến trúc auth tách 2 lớp:** `src/server/auth/jwt.ts` (pure, không đụng `next/headers`/`server-only`, dùng được cả trong `proxy.ts` lẫn Server Components) và `src/server/auth/session.ts` (wrap cookie I/O qua `next/headers`, có `server-only` guard). `proxy.ts` chỉ decode JWT từ cookie (optimistic check, không query DB) — RBAC "thật" (secure check) nằm ở `src/server/auth/rbac.ts` (`requireAdmin`/`requireUser`/`getCurrentUser`, có query DB xác nhận `status=ACTIVE`, dùng React `cache()` để memo theo request) và được gọi trong `AdminLayout`/`UserLayout` — đúng pattern DAL (Data Access Layer) mà Next.js docs khuyến nghị, phòng trường hợp tài khoản bị deactivate sau khi JWT đã phát hành.
- **`src/server/audit/log-action.ts`** là helper ghi `AuditLog` dùng chung cho mọi phase sau (không đặt `server-only` để MCP tools ở Phase 15+ cũng dùng lại được).
- **Rate limit login:** in-memory (Map theo email, 5 lần/5 phút) — đã note rõ trong code là không share giữa nhiều instance serverless, chấp nhận trade-off này theo đúng scope "nội bộ" của plan.
- **Seed 2 Admin:** `prisma/seed.ts` chạy qua `npx prisma db seed` (đã cấu hình `migrations.seed: "tsx prisma/seed.ts"` trong `prisma.config.ts`, cài thêm `tsx` làm dev dependency vì Prisma 7 không còn built-in seed runner). Email/password đọc từ env (`SEED_ADMIN1_EMAIL`...), có fallback dev mặc định.
- **Trang Login** generate mới qua Stitch MCP (`generate_screen_from_text` bám design system `Precision Ledger`, project `14032540476461860166`) tại `src/app/(auth)/login/page.tsx` + `src/components/forms/login-form.tsx` — dùng React Hook Form pattern chuẩn Next.js (`useActionState` + Server Action `loginAction`), không dùng `react-hook-form` vì chỉ 2 field đơn giản, validate server-side qua Zod là đủ.
- **Logout** wire qua `LogoutMenuItem` (client component, gọi trực tiếp Server Action `logoutAction` từ `onClick` — pattern được Next.js hỗ trợ chính thức) trong cả `Topbar` (Admin) và `UserNavbar` (User, trước đây chưa có dropdown menu, đã bổ sung).

**Mục tiêu:** Đăng nhập được bằng email/password, RBAC chặn đúng theo role, chưa cần Employee CRUD UI.

**Việc cần làm:**
1. Auth.js (hoặc session auth tương thích Next.js) — email + password, HttpOnly Secure Cookie, hash Argon2/bcrypt.
2. Middleware/route guard: `/admin/*` chỉ `role=ADMIN`; user `INACTIVE` không login được; RBAC enforce ở server (route handler/server action), không dựa vào ẩn UI.
3. Trang Login (chưa có sẵn trong Stitch → generate screen mới bám `.stitch/DESIGN.md`, phong cách form tối giản, input viền `border-subtle`, nút Primary đen).
4. Logout, xoá session.
5. Rate limit login cơ bản (in-memory hoặc middleware đơn giản, phù hợp quy mô nội bộ).
6. Seed 2 Admin (email/password tạm) qua `prisma/seed.ts`.
7. Audit log action `LOGIN`.

**Màn hình Stitch dùng:** Không có sẵn — tạo mới từ design system (`.stitch/DESIGN.md`), đối chiếu lại màu/typography sau khi generate.

**Test / chạy local:**
- `npx prisma db seed` → tạo 2 Admin.
- `npm run dev` → login bằng Admin seed thành công, vào được `/admin/dashboard`.
- Tạo thử 1 User `INACTIVE` trực tiếp qua Prisma Studio → xác nhận login bị chặn với thông báo rõ ràng.
- Gọi thử route `/admin/employees` bằng session User (khi Phase 3 chưa xong vẫn test được bằng cách seed 1 user role=USER) → phải bị chặn 403/redirect, không chỉ ẩn UI.
- Logout → cookie bị xoá, truy cập lại `/admin/*` redirect về login.

**Kết quả kiểm thử thực tế (không có trình duyệt trong môi trường này, test qua `curl` mô phỏng đúng wire protocol của Next.js Server Actions — multipart form action cho `loginAction`, header `Next-Action` cho `logoutAction`):**
- ✅ `npx prisma db seed` → tạo đúng 2 Admin (`admin1@financehub.local`, `admin2@financehub.local`).
- ✅ Login sai mật khẩu → lỗi chung chung "Email hoặc mật khẩu không chính xác." (không lộ email có tồn tại hay không), không set cookie.
- ✅ Login đúng → `303` redirect `/admin/dashboard`, `Set-Cookie: session=...; HttpOnly; SameSite=lax`, AuditLog ghi `action=LOGIN, actor_type=USER` đúng `requestId`.
- ✅ Seed thử 1 User `INACTIVE` → login bị chặn với thông báo riêng ("Tài khoản đã bị vô hiệu hoá..."), không set cookie (đã xoá user test sau khi verify).
- ✅ Seed thử 1 User `ACTIVE` (role=USER) → login thành công, redirect `/user/dashboard`; dùng session đó gọi `/admin/employees` → `307` redirect về `/user/dashboard` (chặn đúng, không phải chỉ ẩn UI); gọi `/user/dashboard` → `200`.
- ✅ Rate limit: 5 lần sai liên tiếp → vẫn báo lỗi sai thông tin; lần thứ 6 → chuyển sang thông báo "thử quá nhiều lần".
- ✅ Logout → `Set-Cookie: session=; Expires=1970...` (xoá cookie), AuditLog ghi `action=LOGOUT`; gọi lại `/admin/dashboard` bằng cookie cũ → `307` redirect `/login`.
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production) đều sạch — toàn bộ route Admin/User chuyển từ static (Phase 1) sang dynamic (`ƒ`) do phải resolve session mỗi request; `proxy.ts` được Next.js nhận diện đúng là "Proxy (Middleware)" trong build output.

**Điểm dừng:** ✅ User đã tự kiểm thử và xác nhận hoàn thành — sẵn sàng sang Phase 3.

---

## Phase 3: Employee Management (CRUD + Salary History) ✅ (đã hoàn thành, đã kiểm thử)

**Cập nhật sau khi hoàn thành (bổ sung sau Phase 13) — trang "Lương" tập trung, đã xác nhận với user 2026-08-17:**
- User yêu cầu một mục "Lương đã chi" trong nhóm Tài chính — làm rõ lại (spec §59 đã chốt "không cần tạo transaction salary mỗi tháng") thì đúng ý là muốn **xem/đổi lương tập trung cho mọi nhân viên ở một trang riêng**, không phải tạo giao dịch chi lương thủ công hàng tháng (giữ nguyên cơ chế `SalaryHistory` đã có).
- Thêm `listEmployeeSalaries()` vào `salary.service.ts` (search theo tên/email + pagination 20/50/100, cùng pattern `listEmployees`) và trang `/admin/salary` (`src/app/admin/salary/page.tsx`) — bảng Tên/Email/Lương hiện tại/Hiệu lực từ/Trạng thái/Thao tác, tái dùng nguyên `SetSalaryDialog` đã có từ Phase 3 (component dùng chung với Employee Detail, không viết lại). Không có service/action/audit mới — 100% tái dùng `setEmployeeSalary()` + audit `CHANGE_SALARY` đã có.
- Thêm nav item "Lương" vào nhóm "Tài chính" (`src/lib/nav-config.ts`, icon `Banknote`) và cập nhật `context/spec.md` §38 Admin Navigation cho khớp.
- Test: `tsc`/`lint`/`npm run test` (95/95, không cần test case mới vì không có service/logic mới) + `npm run build` sạch, route `/admin/salary` build thành `ƒ` (dynamic, được `requireAdmin()` ở `AdminLayout` bảo vệ tự động như mọi route `/admin/*` khác). Kiểm thử tay qua browser thật: tạo nhân viên mới → vào `/admin/salary` → search đúng theo tên → "Đổi lương" ngay từ danh sách (15.000.000 ₫, hiệu lực 01/01/2026) → verify Employee Detail hiển thị đúng "Lương hiện tại" khớp ngay lập tức. Dọn sạch dữ liệu test sau khi verify.

**Cập nhật bổ sung (cùng ngày 2026-08-17, ngay sau khi làm trang "Lương") — thêm `paid_by_admin_id` cho `SalaryHistory` + sửa lại câu mô tả trang Lương:**
- User phản hồi câu mô tả cũ ("tự động tính vào chi phí mỗi tháng") gây hiểu nhầm, và yêu cầu thêm field "Người chi" cho Lương giống 3 bảng chi phí (Ads/Mua Page/Chi phí chung) đã làm ngay trước đó — nhất quán trong toàn hệ thống.
- **Schema (CÓ thay đổi thật):** thêm `paid_by_admin_id UUID NOT NULL` (FK → User) vào `SalaryHistory` qua migration `20260817231500_add_salary_paid_by_admin_id` (cùng cách làm: nullable → backfill từ `created_by_admin_id` → `SET NOT NULL` → FK constraint) — xem `context/schema.md` Changelog.
- `salary.service.ts`: `setEmployeeSalary()` nhận thêm `paidByAdminId` (bắt buộc, validate `role=ADMIN`), ghi vào audit `CHANGE_SALARY` before/after; `listEmployeeSalaries()`/`getSalaryHistory()` trả thêm `paidByAdminId`/`currentPaidByAdminName`.
- `SetSalaryDialog` (dùng chung Employee Detail + `/admin/salary`) thêm Select "Người chi" — nhận `adminOptions` prop mới, cả 2 nơi gọi đều cập nhật fetch `listAdminOptions()`.
- Sửa mô tả trang `/admin/salary`: "Mức lương cố định của từng nhân viên — nhập một lần, tự động tính vào chi phí mỗi tháng" → "Nhập mức lương hiện tại của từng nhân viên — một con số cố định, không phải giao dịch phát sinh hàng tháng" — chỉ đổi câu chữ, **không đổi cơ chế tính** (vẫn accrued formula đã chốt ở spec §10.2/§59).
- Test: thêm assertion `paidByAdminId` vào `salary-history-flow.test.ts` + 1 test mới reject khi `paidByAdminId` không phải Admin; sửa toàn bộ test cũ gọi `setEmployeeSalary`/`prisma.salaryHistory.create` trực tiếp để thêm field bắt buộc mới (không đổi assertion nào khác) — **102/102 pass**. `tsc`/`lint`/`build` sạch. Kiểm thử tay qua browser thật: tạo nhân viên → `/admin/salary` → "Đổi lương" chọn "Người chi = Admin 2" → list hiện đúng cột "Người chi" → verify không lỗi console.
- ⚠️ Phát hiện & tự sửa trong lúc test: một tiến trình `next dev` cũ (PID còn sống từ vòng kiểm thử trước đó trong cùng phiên, `kill` trước đó không dừng hẳn) vẫn giữ port 3000 và phục vụ **Prisma Client cũ** (trước khi `prisma generate` cho migration này chạy) → gây lỗi 500 `Unknown field paidByAdmin` dù code/migration đều đúng. Đã `kill -9` tiến trình cũ, khởi động lại dev server sạch → hết lỗi. Không phải bug của thay đổi này, chỉ là quy trình dọn dev server giữa các vòng kiểm thử chưa triệt để.

**Cập nhật sau khi hoàn thành (trong lúc làm Phase 4) — lệch có chủ đích so với spec §14.2, đã xác nhận với user:**
- **Create Employee bỏ 2 field "Salary"/"Salary effective date"** (spec §14.2 gốc liệt kê đây là field bắt buộc lúc tạo). Theo yêu cầu user, nhân viên mới tạo **không có `SalaryHistory` nào** — "Lương hiện tại" hiển thị 0 ₫ cho tới khi Admin vào Employee Detail bấm "Đổi lương" để thiết lập lần đầu (dùng lại nguyên `setEmployeeSalary` đã có, vốn đã xử lý đúng trường hợp `current = null`). Đã cập nhật đồng bộ: `context/spec.md` §14.2, `CreateEmployeeSchema`/`CreateEmployeeClientSchema`, `createEmployee()` (không còn tạo `SalaryHistory` trong transaction), `CreateEmployeeForm` (bỏ 2 field khỏi UI, thêm dòng gợi ý "chưa có mức lương... bấm Đổi lương"), và toàn bộ test liên quan (`employee-service`, `salary-effective-date`, `salary-history-flow`, cùng 3 file test Phase 4 dùng `createEmployee` làm fixture) — 21/21 test vẫn pass sau khi sửa.

**Ghi chú thực hiện (khác với mô tả gốc bên dưới):**
- **Server Actions không dùng `useActionState` cho form nhiều field.** Login (Phase 2) dùng `useActionState` vì chỉ 2 field đơn giản. Ở đây, form Create/Edit/Set Salary dùng **React Hook Form + `zodResolver`** (đúng CLAUDE.md "Forms: React Hook Form + Zod") kết hợp `useTransition` gọi thẳng Server Action và tự quản lý state kết quả — không dùng `useActionState` vì 2 lý do phát sinh khi code: (1) dialog Edit/Set Salary cần tự đóng khi thành công, mà `setState` trong `useEffect` theo `state` từ `useActionState` bị ESLint rule `react-hooks/set-state-in-effect` (React 19 mới) chặn; (2) gọi `formAction()` từ trong `handleSubmit` của RHF (không phải qua `<form action>` gốc) khiến React cảnh báo "async function with useActionState was called outside of a transition". Gọi trực tiếp Server Action trong `startTransition` giải quyết cả hai, đơn giản hơn và nhất quán giữa 3 form.
- **Validate 2 lớp cho field tiền (VND):** Zod schema chung có 2 biến thể — `moneyInputSchema` (string digit-only, dùng client-side qua RHF) và bản server `.transform()` sang `BigInt`. BigInt không được serialize qua ranh giới Server Action một cách an toàn nên client luôn gửi string, server tự parse lại và ghi DB — đúng yêu cầu CLAUDE.md "Validate Zod... trước mọi lần ghi DB (client-side lẫn server-side)".
- **`tsconfig.json` `target` đổi từ `ES2017` → `ES2020`** — bắt buộc vì cú pháp literal `10_000_000n` (BigInt, dùng khắp nơi cho tiền VND theo CLAUDE.md) chỉ hợp lệ với `tsconfig` target ES2020 trở lên khi type-check (`tsc --noEmit`); Next.js build (SWC) không bị ảnh hưởng. Đây là thay đổi cấu hình cross-cutting, không phải riêng Phase 3 — mọi phase sau (Revenue, Ads, Page Purchase...) đều cần literal BigInt nên sửa một lần ở đây.
- **Test runner:** dự án chưa có test runner nào (Phase 1/2 không cần). Đã thêm `vitest` (+ `dotenv` để nạp `.env` cho file test) và script `npm run test`. Test chạy trực tiếp trên DB dev thật (`npx prisma dev`, không mock Prisma) — đúng tinh thần "integration test" mà spec §52 mô tả (vd `resolvePageOwner` ở Phase 4 cũng sẽ cần query DB thật). **Quan trọng:** phải set `test.fileParallelism: false` trong `vitest.config.mts` — chạy nhiều file test song song cùng lúc làm hỏng wire protocol của Postgres proxy ephemeral (`prisma dev`), gây lỗi `portal "" does not exist` / tham số bind sai chỗ (đã tự phát hiện và tái tạo lỗi này, fix bằng cách tắt parallelism). Mỗi file test tự tạo 1 Admin fixture (email `test-admin-*@example.test`) và dọn dẹp (`afterAll` hard-delete) toàn bộ User/EmployeeProfile/SalaryHistory nó tạo ra — không đụng 2 Admin seed thật.
- **`server/actions/employee.actions.ts`** (mới, chưa có trong project structure gốc — thư mục `server/actions/` để tách Server Action khỏi Service Layer thuần, giữ `server/services/` không phụ thuộc `next/headers`/RBAC, tái dùng được từ MCP tools ở Phase 15+ mà không kéo theo Next.js request-scope).
- **Component dùng chung mới tạo (chưa có từ Phase 1):** `components/tables/pagination.tsx`, `components/tables/search-input.tsx` (URL-sync qua `useSearchParams`, debounce 300ms), `components/shared/confirm-dialog.tsx` (modal xác nhận dùng chung cho Deactivate — theo đúng DESIGN.md "Confirmation modal cho mọi delete/transfer", sẽ tái dùng ở Phase 4 Transfer Page/Phase 5-6 Delete).
- **Tạm thời (temp) password khi tạo Employee:** sinh ngẫu nhiên bằng `randomBytes(12).toString("base64url")`, hash bằng `hashPassword` (bcryptjs) có sẵn từ Phase 2, hiển thị **đúng một lần** trên UI ngay sau khi tạo (không redirect ngay, giữ nguyên trang với panel "Đã tạo nhân viên thành công" + nút copy) — cùng pattern sẽ dùng lại cho MCP API key ở Phase 14.
- **Active Pages / Revenue / Total Cost trong Employee List & Detail:** `activePages` query thật qua `pageAssignments` (where `ended_at IS NULL`) — tự động đúng 0 ở phase này vì chưa có Page/Assignment (Phase 4), không cần hardcode. `revenue`/`totalCost` **hardcode `0n`** đúng như plan gốc — công thức thật (`Employee Revenue`, `Employee Cost = PagePurchase + Ads + Salary`) chỉ implement ở Phase 7 sau khi Page/Revenue/Ads/PagePurchase tồn tại.
- **Không có route `/admin/employees/[id]/edit` riêng** — Edit/Set Salary/Deactivate đều là modal (Dialog) trên chính trang Detail, tránh nhân đôi form ở 2 nơi (List + Detail). List chỉ có Link "Xem chi tiết" (click tên) qua Detail.
- **Bỏ hẳn form UI của `mockEmployees`/`mockUserProfile` khỏi 2 trang đã wire** (`/admin/employees*`, `/user/profile`) — `src/lib/mock-data.ts` vẫn giữ nguyên các export khác (`mockDashboardKpis`, `mockUserPages`...) vì Dashboard/Pages/Revenue/Costs UI chưa tới phase wire (Phase 7/11).

**Mục tiêu:** Admin CRUD nhân viên, quản lý lương theo `SalaryHistory`, độc lập với Page/Revenue (chưa tồn tại).

**Việc cần làm:**
1. `server/services/employee.service.ts`, `server/services/salary.service.ts`.
2. Create Employee: tạo `User(role=USER)` + `EmployeeProfile` trong transaction (spec §14.2).
3. Edit Employee, Deactivate Employee (set `status=INACTIVE`, không xoá lịch sử).
4. Set Employee Salary: tạo `SalaryHistory` mới, đóng `effective_to` của record đang active — trong transaction (spec §44).
5. Employee List page (`/admin/employees`): columns Name, Email, Current salary, Active Pages (sẽ = 0 ở phase này), Revenue/Total Cost theo filter (sẽ = 0), Status, Actions. Filter theo tháng + search (ILIKE name/email), pagination 20/50/100.
6. Employee Detail page (`/admin/employees/[id]`) — chỉ wire section **Summary** (Name, Email, Current Salary, Active Pages count = 0). Section Revenue/Costs/Pages/Monthly Chart để **empty state** (sẽ wire ở Phase 7).
7. Zod schema validate: email unique case-insensitive, salary >= 0 integer, effective date bắt buộc.
8. Audit log: `CREATE/UPDATE Employee`, `Change salary`, `Deactivate employee`.
9. User self-view: `/user/profile` hiển thị đúng thông tin bản thân (đọc qua session, không qua Admin list).

**Màn hình Stitch dùng:** "Quản lý Nhân sự" (List + Detail Summary).

**Test / chạy local:**
- Tạo employee mới → login được với password tạm, `EmployeeProfile` được tạo đúng 1-1.
- Đổi lương với `effective_from` mới → record cũ tự đóng `effective_to`, không overlap (unit test cho `SalaryHistory`).
- Deactivate employee → không login được (Phase 2 guard), nhưng vẫn hiện trong Employee List với status `INACTIVE`, dữ liệu không mất.
- Email trùng (case-insensitive) → bị reject rõ ràng.
- `npm run test` cho service layer salary/employee.

**Kết quả kiểm thử thực tế:**
- ✅ `npm run test` (vitest, DB dev thật) — 8/8 test pass (`tests/unit/employee-service.test.ts`, `tests/unit/salary-effective-date.test.ts`, `tests/integration/salary-history-flow.test.ts`): create atomically tạo `User+EmployeeProfile+SalaryHistory` + audit `CREATE`; email trùng (kể cả khác hoa/thường) bị reject, không tạo record dở dang; đổi lương đóng đúng `effective_to` của record cũ, giữ interval không overlap; ngày hiệu lực mới ≤ ngày hiện tại bị reject; constraint DB (partial unique index `salary_history_one_active_per_employee`) tự chặn 2 record active nếu cố tình bypass service layer; deactivate set `INACTIVE`, không đụng salary history, idempotent (gọi 2 lần không tạo audit log trùng); toàn bộ flow tạo → đổi lương 2 lần → deactivate vẫn giữ đúng 3 record `SalaryHistory` và list vẫn thấy employee với lương mới nhất.
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production) đều sạch.
- ✅ Kiểm thử UI qua trình duyệt thật (Playwright headless, không có sẵn `chromium-cli`/browser trong môi trường này nên dùng Playwright trực tiếp — đề xuất chạy `/run-skill-generator` nếu muốn có sẵn script này cho các phase sau): login Admin → `/admin/employees` (empty state đúng khi chưa có nhân viên) → Tạo nhân viên mới (form RHF validate client-side, submit) → hiển thị panel "Đã tạo nhân viên thành công" kèm mật khẩu tạm + nút copy (không redirect, đúng yêu cầu "hiện đúng một lần") → vào Detail page, Summary card đúng (lương/Page đang quản lý=0) → Chỉnh sửa tên qua dialog → tên cập nhật ngay, dialog tự đóng → Đổi lương (ngày hiệu lực sau) qua dialog → card "Lương hiện tại" cập nhật → Vô hiệu hoá qua confirm dialog → status chip đổi "NGỪNG HOẠT ĐỘNG", nút Vô hiệu hoá biến mất (đã INACTIVE) → quay lại List, nhân viên vẫn hiển thị với status INACTIVE (không bị xoá khỏi list) → search theo tên → URL sync `?q=...&page=1`, lọc đúng kết quả.
- ⚠️ Phát hiện & tự sửa trong lúc test: (1) chạy `vitest` với nhiều file test song song làm hỏng wire protocol của `prisma dev` proxy → đã tắt `fileParallelism`; (2) dữ liệu rác từ lần chạy test hỏng đó (User mồ côi không có `EmployeeProfile`) từng gây React warning "duplicate key" trên Employee List → đã dọn sạch, không phải bug ở code Phase 3; (3) `useActionState` gọi ngoài transition (khi kết hợp với RHF `handleSubmit`) → refactor 3 form Create/Edit/Set Salary sang `useTransition` gọi thẳng Server Action (xem "Ghi chú thực hiện" ở trên).
- ⚠️ Warning **có từ trước** (Phase 1, không phải lỗi Phase 3): Base UI cảnh báo `nativeButton` khi dùng `<Button render={<Link .../>}>` (pattern đã có sẵn ở `admin/pages/page.tsx` từ Phase 1) — không chặn chức năng, để dành rà soát ở Phase 17 Polish.
- ℹ️ **Đổi scope so với plan gốc:** Employee List **không có filter theo tháng** ở phase này (mục 5 "Việc cần làm" liệt kê) — vì Revenue/Total Cost đều hardcode `0` (chưa có Page/Revenue), filter tháng chưa có dữ liệu nào để lọc nên sẽ là UI không có tác dụng; chỉ implement Search (ILIKE) + Pagination (20/50/100, URL-sync). Filter tháng sẽ thêm ở Phase 7 cùng lúc với công thức Revenue/Cost thật.

**Điểm dừng:** ✅ Đã implement + tự kiểm thử (unit/integration test + browser thật) — dừng lại xin xác nhận từ user trước khi sang Phase 4.

---

## Phase 4: Page Management + Assignment + Purchase Expense ✅ (đã hoàn thành, đã kiểm thử)

**Cập nhật bổ sung sau (2026-08-17):** `PagePurchaseExpense` có thêm field `paid_by_admin_id` (bắt buộc khi có `PagePurchaseExpense` được tạo) — chi tiết đầy đủ ghi ở Phase 9 "Cập nhật bổ sung lớn" (vì đây là thay đổi cross-cutting cả 3 bảng chi phí, ghi tập trung một chỗ).

**Cập nhật bổ sung (2026-08-18) — Page purchase đổi từ theo-ngày sang theo-tháng, theo yêu cầu user, xác nhận qua `AskUserQuestion`:**
- User: "không cần ngày mua, chỉ cần tháng mua". Xác nhận áp dụng đúng cách đã làm cho AdExpense ở Phase 6 — đổi tên field `purchase_date` → `purchase_month` (không chỉ truncate giá trị mà giữ tên gây hiểu nhầm), cả trên `Page` lẫn `PagePurchaseExpense`. Chi tiết migration/backfill đầy đủ ở `context/schema.md` Changelog.
- **Service layer:** `page.service.ts` (`CreatePageInput`/`PageListItem`/`PageDetail`), `assignment.service.ts` (`assignEmployee` snapshot từ `page.purchaseMonth`), `page.actions.ts` (parse "YYYY-MM" qua `parseMonthKey` từ `lib/month.ts`, thêm `monthKeyToDate()` helper báo lỗi rõ nếu tháng không hợp lệ — cùng pattern `ads.actions.ts`). `employee.service.ts`/`dashboard.service.ts` đổi lookup `PagePurchaseExpense` theo tháng từ filter khoảng `[gte,lt)` sang so khớp chính xác `purchaseMonth: monthStart` (đơn giản và đúng hơn, vì giá trị luôn là ngày 1).
- **UI:** `create-page-form.tsx` đổi field "Ngày mua" (`<Input type="date">`) → "Tháng mua" (`<Input type="month">`, default `currentMonthKey()`); `/admin/pages` list đổi cột "Ngày mua" → "Tháng mua" (`formatMonth`); Page Detail summary stat "Ngày mua" → "Tháng mua". `AssignEmployeeDialog`/`TransferPageDialog` **không đổi** — "Ngày hiệu lực" (`effectiveDate`) là khái niệm khác (ngày PageAssignment bắt đầu hiệu lực), vẫn theo ngày như cũ, không nằm trong yêu cầu này.
- **Hệ quả liên đới đã cân nhắc:** khi Page được tạo kèm gán nhân viên ngay, `PageAssignment.startedAt` (và do đó cả `PagePurchaseExpense.assignmentIdSnapshot`) giờ luôn bắt đầu từ ngày 1 của `purchaseMonth` thay vì ngày cụ thể trước đây — chấp nhận được, là hệ quả tự nhiên khi Page chỉ còn thông tin ở mức tháng, không phải bug.
- **Test:** rename `purchaseDate` → `purchaseMonth` ở toàn bộ test fixture gọi `createPage()`/`assignEmployee()`/`prisma.page.create` trực tiếp (12 file, ~40 chỗ, script Python thay thế cơ học theo key, không đổi giá trị ngày cụ thể vì không assertion nào phụ thuộc chính xác ngày-trong-tháng ngoài 1 chỗ đã sẵn là ngày 1) — **102/102 test vẫn pass, không cần sửa assertion nào**. `tsc`/`lint`/`npm run build` sạch.
- ⚠️ Dọn dẹp phụ: phát hiện 1 Page rác còn sót từ phiên test trước ("List Action Test EDITED...", `purchase_date` = ngày 17 không phải ngày 1) — đã xoá sạch (cùng `PagePurchaseExpense`/`PageAssignment`/`AuditLog` liên quan) sau khi xác nhận migration backfill hoạt động đúng trên chính record đó (17/08 → 01/08).

**Cập nhật bổ sung (2026-08-18, ngay sau đó cùng ngày) — "Người chi" chuyển lên lưu trên `Page`, hỏi ngay lúc tạo bất kể đã gán nhân viên hay chưa, theo yêu cầu user, xác nhận qua `AskUserQuestion`:**
- User phát hiện: field "Người chi" (làm ở Phase 9 "Cập nhật bổ sung lớn") chỉ hiện trên form Tạo Page khi **vừa** nhập giá mua **vừa** gán nhân viên ngay — vì trước đó chỉ `PagePurchaseExpense` mới có `paid_by_admin_id`, mà entity này chỉ được tạo khi có cả hai điều kiện. Xác nhận hướng: thêm `paid_by_admin_id` (nullable) **ngay trên `Page`**, hỏi bất cứ khi nào `purchase_price > 0` (không quan tâm đã gán nhân viên hay chưa), dùng lại giá trị này khi `assignEmployee()` sau này mới thực sự tạo `PagePurchaseExpense` deferred — không hỏi lại lần 2.
- **Schema (CÓ thay đổi thật):** `paid_by_admin_id UUID` nullable + FK trên `Page`, migration `20260818020000_add_page_paid_by_admin_id` (không cần backfill, dev DB rỗng lúc đó). Chi tiết đầy đủ ở `context/schema.md` Changelog.
- **`page.service.ts`:** điều kiện `needsPayer` đổi từ `assignEmployeeId && purchasePrice>0` → chỉ còn `purchasePrice>0`; `createPage()` luôn lưu `paidByAdminId` lên `Page` khi cần, dùng lại y nguyên nếu `willCreatePurchaseExpense` (không hỏi validate 2 lần). `getPageDetail()`'s `purchasePaidByAdminName` ưu tiên đọc từ `PagePurchaseExpense.paidByAdmin` (đã tồn tại), fallback về `Page.paidByAdmin` (trường hợp deferred, chưa gán ai) — UI luôn hiện đúng người chi ngay từ lúc tạo Page.
- **`assignment.service.ts` (`assignEmployee`):** **bỏ hẳn** tham số `paidByAdminId` khỏi `AssignEmployeeInput` — đọc thẳng `page.paidByAdminId` đã có sẵn khi tạo `PagePurchaseExpense` deferred; chỉ còn 1 guard phòng thủ (`willCreatePurchaseExpense && !page.paidByAdminId` → reject) cho trường hợp lý thuyết không nên xảy ra vì `createPage()` đã bắt buộc field này từ đầu.
- **Validators:** `AssignEmployeeSchema`/`AssignEmployeeClientSchema` bỏ hẳn field `paidByAdminId` (không còn ở luồng Gán nhân viên nữa).
- **UI:** `create-page-form.tsx` bỏ điều kiện theo `assignEmployeeId` khỏi `needsPayer` (chỉ còn theo `purchasePrice`) — field "Người chi" giờ hiện ngay khi có giá mua, bất kể đã chọn nhân viên hay chưa. `assign-employee-dialog.tsx` **bỏ hẳn** field "Người chi" + prop `adminOptions`/`needsPayer` (dialog đơn giản lại, chỉ còn Nhân viên/Ngày hiệu lực/Ghi chú); Page Detail bỏ 2 prop đó khỏi lời gọi `AssignEmployeeDialog` (vẫn giữ `listAdminOptions()` fetch vì Ads tab trên cùng trang còn dùng).
- **Test:** `assign-employee.test.ts` — sửa test "tạo Page chưa gán nhân viên" để truyền `paidByAdminId` khi `purchasePrice>0` + assert `Page.paidByAdminId` lưu đúng; thêm test mới "reject tạo Page có giá mua mà thiếu người chi, kể cả chưa gán ai"; xoá test cũ "reject deferred assignment thiếu paidByAdminId" (không còn reachable ở tầng `assignEmployee` nữa, đã có test tương đương ở tầng `createPage`); test "assigns the employee... snapshots PagePurchaseExpense" sửa lại truyền `paidByAdminId` vào `createPage()` thay vì vào `assignEmployee()`. ⚠️ Phát hiện thêm khi sửa: 2 test `orphanCount` cũ ở `page-service.test.ts` (và 1 chỗ mới tự thêm) filter nhầm theo `name` thay vì `facebookUrl` — assertion `toBe(0)` luôn đúng một cách vô nghĩa vì `name` không bao giờ chứa chuỗi đang tìm (bug có từ Phase 4 gốc, không phải do thay đổi lần này) — đã sửa cả 3 chỗ sang filter đúng theo `facebookUrl`. **102/102 test pass** (số lượng giữ nguyên: xoá 1, thêm 1). `tsc`/`lint`/`npm run build` sạch.
- ✅ Kiểm thử tay qua browser thật: nhập giá mua chưa gán nhân viên → field "Người chi" hiện ngay → chọn Admin 2, tạo Page → Page Detail hiện đúng "Người chi mua Page: Admin 2" **trước khi** gán nhân viên (đọc từ fallback `Page.paidByAdmin`) → mở dialog "Gán nhân viên" → xác nhận **không còn** field "Người chi" → gán nhân viên xong → verify lại DB trực tiếp: `PagePurchaseExpense.paidByAdminId` khớp chính xác `Page.paidByAdminId` khớp chính xác id của Admin 2 (không phải trùng hợp hiển thị). Không có console error.

**Cập nhật sau khi hoàn thành (trong lúc làm Phase 5) — bổ sung theo yêu cầu user, không có trong mô tả gốc:**
- **Thêm nút Sửa/Xoá ngay trên `/admin/pages`** (trước đây List chỉ có link "Xem chi tiết", Edit/Transfer chỉ nằm trong Page Detail). Cột "Thao tác" mới: nút **Chỉnh sửa** mở lại đúng `EditPageDialog` đã có sẵn; nút **Xoá** là action **mới hoàn toàn**.
- **`softDeletePage()`** (`page.service.ts`) — soft delete thật (set `deleted_at`, ghi `AuditLog action=DELETE`), khác với đổi `status=ARCHIVED` (vẫn hiển thị, chỉ đổi trạng thái nghiệp vụ). Hai khái niệm tách biệt vì schema Page có cả `status` lẫn `deleted_at`. Xoá không cascade — `PageAssignment`/`Revenue`/`AdExpense`/`PagePurchaseExpense` gắn với Page vẫn giữ nguyên trong DB (đúng nguyên tắc snapshot, không hard delete dữ liệu tài chính).
- `deletePageAction` (`page.actions.ts`) + `DeletePageButton` (dùng lại `ConfirmDialog` có sẵn từ Phase 3) theo đúng pattern đã dùng cho `DeleteRevenueButton` ở Phase 5.
- `PageListItem` bổ sung field `notes` (trước đây list không trả về, cần để prefill đúng khi mở Edit dialog từ list).
- Test: thêm 2 test cho `softDeletePage` vào `tests/unit/page-service.test.ts` (ẩn khỏi `listPages`, không đụng assignment/purchase expense cũ, ghi audit log; reject khi xoá Page đã xoá hoặc không tồn tại) — tổng test toàn repo từ 34 lên **36/36 pass**. Đã kiểm thử tay qua trình duyệt thật: sửa/xoá 1 Page test từ list, xác nhận không ảnh hưởng dữ liệu Page khác.

**Cập nhật sau khi hoàn thành — lệch có chủ đích so với spec §15.2, đã xác nhận với user:**
- **Create Page bỏ "Assign Employee" khỏi field bắt buộc** (spec §15.2 gốc liệt kê đây là field bắt buộc). Page giờ có thể tạo mà chưa gán ai phụ trách (`currentEmployee = null`, hiển thị "Chưa gán" — UI đã sẵn có fallback này từ đầu). Nếu `purchase_price > 0` mà không gán nhân viên lúc tạo, `PagePurchaseExpense` **chưa** tạo ngay — bù lại tự động khi Page được gán nhân viên lần đầu (giữ đúng tinh thần "ai nhận Page đầu tiên thì chịu chi phí mua", chỉ nới lỏng thời điểm).
- **Action mới `assignEmployee`** (`assignment.service.ts`) cho Page chưa có ai phụ trách — khác `transferPage` ở chỗ không cần đóng assignment cũ (vì không có), và tự tạo `PagePurchaseExpense` bù nếu Page có `purchase_price > 0` và chưa từng có purchase expense nào. UI: `AssignEmployeeDialog` (nút "Gán nhân viên") thay cho `TransferPageDialog` (nút "Chuyển giao") khi `page.currentEmployee === null` trên Page Detail — tách UI theo đúng 2 luồng nghiệp vụ khác nhau (spec §15.4 vs §15.4a mới thêm).
- **Sentinel `NO_EMPLOYEE_SENTINEL = "unassigned"`** trong `page.schema.ts` cho `<Select>` "Gán nhân viên phụ trách" ở Create Page — Base UI Select cần item value xác định, không dùng `""` để biểu diễn "chưa chọn" được (đã dùng cho luồng khác: field optional với default `""` thì Select tự hiện placeholder đúng). Server-side schema transform sentinel này về `undefined`.
- **Bug phát hiện khi test (đã sửa, không phải do sentinel):** Base UI's `<Select.Value>` mặc định hiển thị **giá trị thô** (value) thay vì label của `<SelectItem>` tương ứng, với bất kỳ field nào có default value khác rỗng ngay từ đầu — do label chỉ được "đăng ký" sau khi user mở dropdown ít nhất 1 lần (đã tra Context7 docs `@base-ui/react` xác nhận: "By default, the `<Select.Value>` component renders the raw value of the selected item"). Phát hiện được vì field mới "Gán nhân viên" hiện literal `unassigned` thay vì "Chưa gán — gán sau" lúc mới load form. Đã sửa cho 3 chỗ vừa đụng tới hôm nay bằng cách truyền `children` dạng hàm format vào `SelectValue` (`{(value) => label[value] ?? value}`): `CreatePageForm` (status + assignEmployeeId), `EditPageDialog` (status). **Chưa sửa** `CreateEmployeeForm`/`EditEmployeeDialog` (status select, cùng lỗi, có từ Phase 3) — vì ngoài phạm vi Phase 4, để dành rà soát ở Phase 17 Polish cùng các warning UI khác đã ghi nhận (`nativeButton`).

**Ghi chú thực hiện (khác với mô tả gốc bên dưới):**
- **Tách 2 service như plan:** `page.service.ts` (CRUD Page: `listPages`, `getPageDetail`, `createPage`, `updatePage`, class lỗi `PageError`) và `assignment.service.ts` (`resolvePageOwner`, `transferPage`, `getAssignmentHistory`). `resolvePageOwner` nhận thêm tham số `client` tuỳ chọn (`typeof prisma | Prisma.TransactionClient`, dùng type `Prisma.TransactionClient` từ `@/generated/prisma/client`) để Phase 5/6 (Revenue/AdExpense) có thể resolve-rồi-ghi trong cùng transaction khi cần — chưa dùng ở Phase 4 vì `createPage` tạo assignment đầu tiên trực tiếp, không cần resolve.
- **"Current employee" cho List/Detail dùng query trực tiếp** (`pageAssignment where endedAt: null`, include qua Prisma) thay vì gọi `resolvePageOwner(pageId, today)` — tránh N+1 query khi list ~100 Page, và đây vốn là cùng nguồn dữ liệu (`endedAt IS NULL`) nên không lệch kết quả. `resolvePageOwner` đúng nghĩa "as of a date" chỉ dùng khi cần resolve tại một ngày cụ thể (Revenue/AdExpense ở Phase 5/6).
- **Refactor nhỏ, không đổi hành vi:** tách `moneyInputSchema`/`moneySchema`/`dateSchema` từ `employee.schema.ts` sang `server/validators/common.schema.ts` dùng chung với `page.schema.ts` (tránh copy-paste — cả hai domain đều cần validate tiền VND + ngày `YYYY-MM-DD`). Test Phase 3 (`employee-service`, `salary-effective-date`, `salary-history-flow`) chạy lại vẫn pass, xác nhận không phá vỡ hành vi cũ.
- **Zod schema client vs server tách riêng** đúng pattern Phase 3: client giữ `notes`/`purchasePrice` dạng string chưa transform (để khớp type input/output của RHF `zodResolver`, tránh lỗi type mismatch khi có `.transform()`), server-side schema mới `.transform()` (money → `BigInt`, notes rỗng → `undefined` → `null` khi ghi DB).
- **`listActiveEmployeeOptions()` mới thêm vào `employee.service.ts`** (không phải file mới) — danh sách nhân viên `ACTIVE` dạng `{employeeId, name}` cho 2 dropdown "Gán nhân viên" (Create Page) và "Nhân viên mới" (Transfer Page). Đây là query đọc đơn giản, không phải business logic mới, nên thêm vào service đã có thay vì tạo service riêng.
- **Ràng buộc bổ sung ngoài spec (đã cân nhắc, không hỏi lại vì rủi ro thấp và nhất quán với rule Transfer):** `createPage` cũng reject nếu nhân viên được gán ban đầu có `status != ACTIVE` — spec §43 chỉ nói rõ ràng buộc này cho Transfer, nhưng để Page không thể "sinh ra" đã gán cho nhân viên ngừng hoạt động (tình huống vô lý hơn cả transfer), áp dụng cùng rule cho nhất quán. Nếu user muốn bỏ ràng buộc này, dễ dàng gỡ trong `page.service.ts`.
- **Không có nút "Archive" riêng** — Archive Page thực hiện qua field `status` trong dialog Edit Page (đúng spec §15.3 "Có thể sửa: Status"), không phải action riêng biệt. `archive_page` MCP tool (Phase 16) sẽ gọi thẳng `updatePage` với `status=ARCHIVED`.
- **Trang `/admin/pages/new` không có "success panel" như Create Employee** (Page không có secret cần hiện 1 lần) — submit thành công thì `router.push` thẳng sang `/admin/pages/[pageId]`.
- **Component mới:** `components/forms/create-page-form.tsx`, `components/forms/edit-page-dialog.tsx`, `components/forms/transfer-page-dialog.tsx` (Transfer Page modal — chưa có trong Stitch, tự viết bám `.stitch/DESIGN.md`: input focus viền 2px Finance Blue có sẵn từ token `focus-visible:ring-3` của `Input`/`Select`, dùng lại `Dialog`/`Field` đã có từ Phase 3). Tab "Ghi chú" trong `notes` chưa có component `Textarea` dùng chung trong `components/ui/` — dùng `<textarea>` thuần cùng class Tailwind với `Input` (chưa tạo `ui/textarea.tsx` vì chỉ 2 chỗ dùng, cân nhắc tách khi Phase 5+ cần thêm).

**Mục tiêu:** CRUD Page, lịch sử `PageAssignment`, transfer Page, tự động tạo `PagePurchaseExpense`. Đây là phase quan trọng nhất về business rule — cần test kỹ trước khi qua phase Revenue/Ads.

**Việc cần làm:**
1. `server/services/page.service.ts`, `server/services/assignment.service.ts`.
2. Implement **`resolvePageOwner(pageId, occurredAt)`** (spec §36) — hàm trung tâm, có unit test riêng (đây là ưu tiên #1 theo spec §52).
3. Create Page: transaction gồm Page + PageAssignment đầu tiên + (nếu `purchase_price > 0`) PagePurchaseExpense snapshot cho employee đầu tiên + Audit log (spec §15.2, schema.md mục "Ràng buộc dữ liệu quan trọng" #6).
4. Edit Page: chỉ sửa name/URL/status/notes — **không** sửa employee trực tiếp qua field.
5. Transfer Page action: đóng assignment active (`ended_at`), tạo assignment mới, validate employee mới `status=ACTIVE`, không overlap (partial unique index), audit log — không đụng Revenue/Ads/PagePurchaseExpense cũ.
6. Page List (`/admin/pages`): Page name, Facebook URL, current employee (resolve qua assignment), purchase price/date, status, created_at, notes. Filter + search (ILIKE name/URL) + pagination.
7. Page Detail (`/admin/pages/[id]`) — tab **Overview** + **Assignment History** wire thật. Tab Revenue/Ads để empty state (wire Phase 5/6).
8. Transfer Page modal/form riêng (chưa có trong Stitch → generate mới bám DESIGN.md, dùng "Active State: viền 2px Finance Blue" cho input đang focus, confirmation modal theo spec §40).
9. Validate Facebook URL format (Zod `.url()`), purchase_price >= 0 integer.

**Màn hình Stitch dùng:** "Quản lý Trang (Pages)" (List + Detail Overview/Assignment tabs). Modal Transfer Page: generate mới từ design system.

**Test / chạy local:**
- Unit test `resolvePageOwner`: có assignment hợp lệ → trả đúng employee; không có assignment tại ngày đó → throw lỗi rõ ràng; nhiều assignment overlap (giả lập lỗi data) → throw data integrity error.
- Tạo Page với `purchase_price=5.000.000`, gán Employee A → verify `PagePurchaseExpense` tạo đúng 1 record snapshot Employee A.
- Transfer Page A → Employee B, `effective_date` = hôm nay → verify: assignment cũ có `ended_at`, assignment mới `started_at` đúng, không overlap; `PagePurchaseExpense` **vẫn** thuộc Employee A (spec §52 Integration Test Case 2).
- Thử transfer sang employee `INACTIVE` → bị reject.
- Thử tạo assignment overlap thủ công qua Prisma Studio → xác nhận constraint chặn (partial unique index).

**Kết quả kiểm thử thực tế:**
- ✅ `npm run test` (vitest, DB dev thật) — **21/21 test pass** trên 6 file (8 test cũ Phase 3 + 13 test mới): `tests/unit/resolve-page-owner.test.ts` (5 test: resolve đúng owner tại 1 ngày; resolve đúng owner lịch sử sau khi đã transfer — không bị lệch sang owner mới; reject rõ ràng khi không có assignment hợp lệ tại ngày đó với `code=NO_ASSIGNMENT`; throw `code=DATA_INTEGRITY_ERROR` khi giả lập 2 assignment cùng hợp lệ một lúc — bypass service layer để tạo data lỗi; DB tự chặn 2 assignment active cùng lúc qua partial unique index), `tests/unit/page-service.test.ts` (4 test: `createPage` tạo đúng Page+Assignment+PagePurchaseExpense snapshot trong 1 transaction kèm audit `CREATE`; không tạo `PagePurchaseExpense` khi `purchasePrice=0`; reject gán Page cho nhân viên `INACTIVE`, không để lại record mồ côi; `updatePage` chỉ sửa name/URL/status/notes, không đụng employee đang gán), `tests/integration/page-transfer-flow.test.ts` (4 test, đúng spec §52 Case 2: transfer xong thì `PagePurchaseExpense` vẫn snapshot Employee A dù Page đã sang Employee B; reject transfer sang nhân viên `INACTIVE`, assignment active không bị đụng vào khi request bị reject; reject `effectiveDate` <= ngày bắt đầu assignment hiện tại; sau transfer chỉ còn đúng 1 assignment active và đúng employee mới — không overlap ở DB).
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production) đều sạch — 22 route (thêm `/admin/pages`, `/admin/pages/[pageId]`, `/admin/pages/new` từ mock sang dynamic thật).
- ✅ Kiểm thử UI qua trình duyệt thật (Playwright headless, cài tạm trong scratchpad vì project chưa có `@playwright/test` như devDependency): login Admin → tạo 2 nhân viên test (A, B) qua `/admin/employees/new` → vào `/admin/pages/new`, xác nhận dropdown "Gán nhân viên" hiện đúng nhân viên `ACTIVE` vừa tạo → tạo Page với `purchase_price=5.000.000`, gán Employee A → redirect đúng sang Page Detail, Overview hiện đúng Employee A + giá mua → quay lại List, search theo tên → hiện đúng Page với Employee A → mở dialog Transfer, xác nhận **Employee A (chủ hiện tại) bị loại khỏi danh sách "Nhân viên mới"** (tránh transfer sang chính mình) → transfer sang Employee B, `effectiveDate=2026-05-16` → Page Detail cập nhật đúng Employee B là chủ hiện tại → tab "Lịch sử gán" hiện đúng 2 dòng (A kết thúc 16/05/2026, B "Hiện tại") → Edit Page (đổi tên + status=Lưu trữ) → cập nhật đúng, **employee đang gán (B) không đổi** sau Edit. Verify trực tiếp qua DB sau toàn bộ flow: `PagePurchaseExpense.employeeIdSnapshot` **vẫn là Employee A** (không bị transfer theo), 2 `PageAssignment` không overlap (A: 05/01–16/05/2026, B: 16/05/2026–hiện tại), `AuditLog` ghi đúng thứ tự `CREATE → TRANSFER → UPDATE`. Đã dọn sạch toàn bộ dữ liệu test (2 employee, 1 page, audit log liên quan) sau khi verify xong.
- ⚠️ Warning **có từ trước** (Phase 1, không phải lỗi Phase 4): cùng warning Base UI `nativeButton` đã ghi nhận ở Phase 3 — xuất hiện thêm ở `CreatePageForm`/Page List do dùng lại pattern `<Button render={<Link .../>}>`, để dành rà soát chung ở Phase 17 Polish.

**Điểm dừng:** ✅ Đã implement + tự kiểm thử (unit/integration test + browser thật + verify DB trực tiếp) — `resolvePageOwner` và Transfer Page đã pass hết test case liệt kê ở trên, bao gồm cả spec §52 Case 2 (Page Purchase Cost không theo Page khi transfer). Dừng lại xin xác nhận từ user trước khi sang Phase 5.

**Cập nhật bổ sung (2026-08-18, sau khi các phase khác đã hoàn thành) — thêm `page_type` (SYSTEM/BKT) + User self-service tạo Page hệ thống, theo yêu cầu user, xác nhận qua `AskUserQuestion`:**
- 3 câu hỏi xác nhận: (1) Page hệ thống tự động gán ngay cho chính User tạo (không qua bước chờ Admin); (2) Page BKT vẫn chỉ Admin tạo được; (3) tên field/nhãn `page_type: SYSTEM|BKT`. Chi tiết schema/business rule đầy đủ ở `context/schema.md` Changelog và `context/spec.md` §15.2/§12.
- **Migration `20260818100000_add_page_type`** — cùng kiểu viết tay `migration.sql` + `prisma migrate resolve --applied` như mọi migration trước, nhưng lần này phát hiện thêm một bước hay bị bỏ sót: `resolve --applied` chỉ đánh dấu lịch sử, không tự chạy SQL — phải `npx prisma db execute --file migration.sql` trước để DB thực sự có cột/enum mới (test suite báo lỗi `column page_type ... does not exist` ngay sau khi resolve mới lộ ra thiếu bước này).
- **Service layer:** `page.service.ts` — `createPage()` thêm validate `SYSTEM_PAGE_NO_PRICE`, `pageType` optional (default `BKT`, không phá vỡ test cũ); hàm mới `createSystemPageForSelf(input, employeeId, userId, meta)` tạo Page+PageAssignment tự-gán trong 1 transaction, không bao giờ tạo `PagePurchaseExpense`. `page.actions.ts` thêm `createSystemPageForSelfAction` (RBAC: `requireUser()` + `getEmployeeDetailByUserId`, không tin tham số client). `page.schema.ts` thêm `pageType`/`PAGE_TYPES` vào `CreatePageSchema` + schema mới `CreateSystemPageSelfSchema`.
- **UI:** `create-page-form.tsx` (Admin) thêm Select "Loại Page", ẩn Giá mua/Người chi + ép `purchasePrice="0"` khi chọn SYSTEM. Component mới `PageTypeChip` (`src/components/tables/page-type-chip.tsx`, cùng ngôn ngữ `RoleChip`) hiển thị ở `/admin/pages`, `/admin/pages/[pageId]`, `/user/pages`. Route mới `/user/pages/new` + form mới `CreateSystemPageForm` (chỉ Tên/Facebook URL/Trạng thái/Ghi chú) + nút "Thêm Page hệ thống" trên `/user/pages`.
- **Test:** thêm 3 test vào `tests/unit/page-service.test.ts` — `createPage` reject `SYSTEM` + `purchasePrice>0`; `createPage` default `pageType=BKT` khi omit; `createSystemPageForSelf` tạo đúng Page (SYSTEM/giá 0/không payer) + PageAssignment tự-gán + không tạo `PagePurchaseExpense` + có audit `CREATE`. **123/123 test pass** (từ 120 lên 123). `tsc`/`lint`/`npm run build` đều sạch, route mới `/user/pages/new` build ra `ƒ` (dynamic, bảo vệ tự động qua `requireUser()` ở `UserLayout`).
- ⚠️ Không kiểm thử được qua trình duyệt thật trong môi trường lần này (không có Playwright cài sẵn, không phục hồi được ở phiên này) — đã verify bằng: unit/integration test trực tiếp trên DB dev thật (không mock), `npm run build` sạch cho cả 2 route mới, và curl xác nhận `/admin/pages/new`/`/user/pages/new` redirect đúng `307 → /login` khi chưa đăng nhập (RBAC guard hoạt động). Đề nghị user tự kiểm thử qua browser thật trước khi coi phần này là "đã kiểm thử" đầy đủ như các phase khác.

**Cập nhật bổ sung (2026-08-18, ngay sau đó cùng ngày) — thêm bộ lọc Loại/Trạng thái/Nhân viên phụ trách cho `/admin/pages`, theo yêu cầu user, không đổi schema:**
- User: "Tôi cần filter theo tên page, loại, trạng thái và nhân viên phụ trách" — lọc theo tên đã có sẵn (`SearchInput`), bổ sung 3 dropdown còn lại, URL-synced cùng pattern `FinanceFilters`/`AuditFilters` đã dùng ở Revenue/Ads/Audit Log.
- **Service layer:** `page.service.ts` — `ListPagesParams` thêm `pageType?`/`statusId?`/`employeeId?`; `listPages()` where-clause thêm `pageType` (match trực tiếp enum), `statusAssignments: { some: { statusOptionId } }` (Page có thể mang nhiều trạng thái cùng lúc), `assignments: { some: { employeeId, endedAt: null } }` (cùng pattern đã dùng ở `listPagesByEmployee`) — 3 điều kiện độc lập, kết hợp được đồng thời (AND).
- **UI:** component mới `PageFilters` (`src/components/tables/page-filters.tsx`) — 3 `<Select>` (Loại Page dùng `PAGE_TYPES` tĩnh từ `page.schema.ts`, Trạng thái từ `listPageStatusOptions()` đã fetch sẵn cho `EditPageDialog`, Nhân viên phụ trách từ `listEmployeeOptions()` mới thêm vào `Promise.all` — dùng **toàn bộ** nhân viên chứ không chỉ `ACTIVE`, để filter vẫn khớp đúng cả khi owner hiện tại của một Page đã bị deactivate sau khi gán, nhất quán với cách Revenue/Ads filter chọn nguồn dữ liệu). `admin/pages/page.tsx`: `PagesSearchParams` thêm `pageType?`/`statusId?`/`employeeId?`, `EmptyState` đổi sang `hasActiveFilter` (gồm cả 3 filter mới, không chỉ `q`).
- **Test:** thêm 1 test vào `tests/unit/page-service.test.ts` — tạo 1 Page hệ thống + 1 Page BKT (2 nhân viên/2 trạng thái khác nhau), verify lọc theo từng field độc lập đúng kết quả, và kết hợp 2 filter cùng lúc loại trừ đúng cả 2 Page. **124/124 test pass** (từ 123 lên 124). `tsc`/`lint`/`npm run build` đều sạch.

**Cập nhật bổ sung (2026-08-18, ngay sau đó cùng ngày) — thêm cùng bộ filter cho `/user/pages`, theo yêu cầu user ("cũng có filter như thế"), không đổi schema:**
- Khác `/admin/pages`: **không có** filter "Nhân viên phụ trách" — `/user/pages` vốn đã scoped theo chính nhân viên đăng nhập, filter đó vô nghĩa ở đây. Chỉ thêm Search (tên/URL) + Loại Page + Trạng thái.
- **Service layer:** `page.service.ts` — `listPagesByEmployee(employeeId, params?)` thêm tham số thứ 2 mới `ListPagesByEmployeeParams` (`search?`/`pageType?`/`statusId?`), where-clause mirror y hệt 3 điều kiện đã thêm ở `listPages()` (search bằng `OR` name/facebookUrl insensitive, `pageType` match trực tiếp, `statusId` qua `statusAssignments.some`), cộng thêm vào điều kiện `assignments.some({employeeId, endedAt:null})` sẵn có — tham số optional nên **không phá vỡ** lời gọi cũ không truyền filter (`assignEmployeeAction`/test cũ).
- **UI:** `PageFilters` (`page-filters.tsx`) đổi `employeeOptions` thành **optional** — bỏ qua thì không render dropdown "Nhân viên phụ trách", tái dùng đúng 1 component cho cả `/admin/pages` (3 dropdown) và `/user/pages` (2 dropdown) thay vì viết component riêng. `user/pages/page.tsx` thêm `searchParams` prop (`q`/`pageType`/`statusId`), render `SearchInput` + `PageFilters` (không truyền `employeeOptions`), `EmptyState` đổi sang `hasActiveFilter`.
- **Test:** thêm 1 test vào `describe("listPagesByEmployee"...)` — tạo 1 Page hệ thống + 1 Page BKT cùng 1 nhân viên (khác tên/loại/trạng thái), verify search/pageType/statusId lọc đúng độc lập. **125/125 test pass** (từ 124 lên 125). `tsc`/`lint`/`npm run build` đều sạch.

---

## Phase 5: Revenue Management ✅ (đã hoàn thành, đã kiểm thử)

**Ghi chú thực hiện (khác với mô tả gốc bên dưới):**
- **Query param cho filter Page đổi tên thành `pageId`, không phải `page`** như ví dụ nguyên văn ở spec §13 (`?month=2026-08&employee=123&page=456`). Lý do: `page` đã là tên param cho **số trang phân trang** dùng xuyên suốt mọi list screen từ Phase 3 (`components/tables/pagination.tsx`), nếu dùng lại `page` cho Page filter sẽ đụng độ trực tiếp (chọn Page sẽ ghi đè số trang và ngược lại). URL thực tế: `/admin/revenue?month=2026-08&employee=...&pageId=...`.
- **`components/tables/finance-filters.tsx`** — component filter Month/Employee/Page dùng chung, đặt tên tổng quát (không phải `revenue-filters`) vì Phase 6 (Ads) dùng lại nguyên xi theo đúng yêu cầu "Filter (month/employee/page)" giống hệt spec §18. Áp dụng ngay từ đầu pattern "children formatter cho `SelectValue`" (đã phát hiện ở Phase 4) để tránh bug Base UI hiện raw value thay vì label khi default value khác rỗng (`ALL_SENTINEL`).
- **Create/Edit Revenue dùng Dialog, không phải route riêng** (khác Page ở Phase 4 vốn có `/admin/pages/new` full-page) — vì Revenue chỉ có 4 field đơn giản (Page/Date/Amount/Note), cùng pattern với `SetSalaryDialog` (Phase 3). `CreateRevenueDialog` nhận thêm prop `fixedPageId` tuỳ chọn để tái dùng y nguyên component khi tạo Revenue trực tiếp từ tab "Doanh thu" trên Page Detail (Select bị khoá, đã chọn sẵn Page hiện tại).
- **`listEmployeeOptions()` (employee.service.ts) và `listPageOptions()` (page.service.ts)** — hai hàm query đọc mới cho dropdown filter, khác `listActiveEmployeeOptions()` đã có (Phase 4) ở chỗ **không lọc theo status/deletedAt** cho employee (Revenue có thể snapshot một nhân viên đã bị deactivate sau đó, filter vẫn phải cho chọn được) — `listPageOptions()` vẫn lọc `deletedAt: null` vì Revenue luôn gắn Page còn tồn tại.
- **Soft delete dùng lại `ConfirmDialog`** (Phase 3) qua `DeleteRevenueButton` — không có action "Restore" ở phase này (spec §17 chỉ liệt kê "Delete/soft delete", Restore chỉ xuất hiện rõ ràng ở spec cho Admin Expense — Phase 9).
- **Test:** `tests/unit/revenue-service.test.ts` (9 test: snapshot đúng owner khi tạo; reject rõ ràng khi Page không có assignment hợp lệ tại ngày đó, không tạo record mồ côi; reject khi Page không tồn tại; update Page/ngày → resolve lại snapshot đúng; soft delete set `deletedAt`, ẩn khỏi `listRevenue` mặc định nhưng vẫn còn trong DB; audit log ghi đủ CREATE/UPDATE/DELETE; filter theo month/employee/page đúng) + `tests/integration/revenue-transfer-flow.test.ts` (2 test, đúng spec §52 Case 1: Revenue 10M trước transfer vẫn thuộc A, Revenue 20M sau transfer thuộc B, tổng theo từng nhân viên tách biệt đúng; reject Revenue có ngày trước khi Page có assignment đầu tiên).

**Mục tiêu:** CRUD Revenue theo Page, owner tự resolve qua `resolvePageOwner`, snapshot bất biến khi transfer.

**Việc cần làm:**
1. `server/services/revenue.service.ts` — dùng lại `resolvePageOwner` từ Phase 4, không viết lại logic.
2. Create/Update/Delete (soft) Revenue: Page, date, amount, note — không cho chọn employee thủ công. Update `page_id`/`revenue_date` → resolve lại snapshot.
3. Reject rõ ràng nếu Page không có assignment hợp lệ tại `revenue_date` (không tạo record mồ côi).
4. `/admin/revenue`: List + Create + Edit + Soft delete + Filter (month/employee/page) + Search + Pagination, URL sync filter (`?month=2026-08&employee=...&page=...`).
5. Wire tab **Revenue** trong Page Detail (Phase 4) bằng dữ liệu thật.
6. Audit log CREATE/UPDATE/DELETE Revenue (spec §53 mẫu before/after json).

**Màn hình Stitch dùng:** "Quản lý Doanh thu" (List + Create/Edit form).

**Test / chạy local:**
- Tạo Revenue cho Page đang thuộc Employee A → `employee_id_snapshot` = A đúng.
- Integration test theo spec §52 Case 1: Page A thuộc Employee A, Revenue 10tr → transfer sang B → Revenue mới 20tr → A vẫn có 10tr, B có 20tr (Revenue cũ không đổi owner).
- Tạo Revenue cho Page chưa có assignment (Page mới tạo `purchase_price=0` nhưng cố tình xoá assignment thủ công để test) → bị reject với lỗi rõ ràng, không tạo record.
- Soft delete Revenue → biến mất khỏi list mặc định, còn trong DB (`deleted_at` set).
- Filter URL: `/admin/revenue?month=2026-08&employee=...` load đúng dữ liệu khớp query param.

**Kết quả kiểm thử thực tế:**
- ✅ `npm run test` (vitest, DB dev thật) — **34/34 test pass** trên 9 file (21 test cũ Phase 3/4 + 13 test mới): xem chi tiết ở "Ghi chú thực hiện" phía trên.
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production) đều sạch — 23 route (`/admin/revenue` chuyển từ mock sang dynamic thật).
- ✅ Kiểm thử UI qua trình duyệt thật (Playwright headless, cài tạm trong scratchpad như Phase 4): login Admin → tạo 2 nhân viên test (A, B) → tạo Page backdated `purchaseDate=2026-01-01`, gán Employee A → vào tab "Doanh thu" trên Page Detail, tạo Revenue 10.000.000 ngày 2026-01-10 → hiển thị đúng ngay trong tab → Chuyển giao Page sang Employee B (hiệu lực 2026-02-01) → tạo tiếp Revenue 20.000.000 ngày 2026-02-15 → **tab Doanh thu hiện đúng cả 2 dòng, đúng tên nhân viên tương ứng (A cho 10tr, B cho 20tr) — snapshot không bị ghi đè theo owner mới, đúng spec §52 Case 1** → sang `/admin/revenue`, list hiện đúng cả 2 dòng → filter `?month=2026-01` chỉ còn dòng 10tr (đúng) → tạo Page mới **không gán ai** → thử tạo Revenue cho Page này → bị reject đúng thông báo "Page chưa có nhân viên phụ trách hợp lệ tại ngày này — không thể tạo record.", không tạo record mồ côi (verify soft delete cũng qua nhánh này — dialog giữ nguyên, không đóng khi lỗi) → quay lại Page ban đầu, xoá (soft delete) dòng Revenue 20tr qua `ConfirmDialog` → dòng 20tr biến mất khỏi tab, dòng 10tr vẫn còn nguyên (verify trực tiếp: `deletedAt` được set, không hard delete). Đã dọn sạch toàn bộ dữ liệu test (nhân viên, Page, Revenue, Audit Log liên quan) sau khi verify xong bằng script cleanup riêng.
- ⚠️ Phát hiện trong lúc test (không phải bug code): điều hướng client-side (`router.push`) sang route `/admin/pages/[pageId]` lần đầu trong session Playwright đôi khi cần thêm một `reload()` để Tabs (Base UI) hydrate kịp trước khi thao tác — đặc thù môi trường dev Turbopack + HMR, không ảnh hưởng người dùng thật (đã xác nhận qua nhiều lần test lặp lại, không phải race condition trong code ứng dụng).

**Điểm dừng:** ✅ Đã implement + tự kiểm thử (unit/integration test + browser thật + verify DB trực tiếp) — reject "Page chưa có assignment hợp lệ" và snapshot bất biến khi transfer (spec §52 Case 1) đã pass hết test case liệt kê ở trên. Dừng lại xin xác nhận từ user trước khi sang Phase 6.

---

## Phase 6: Ads Management ✅ (đã hoàn thành, đã kiểm thử)

**Cập nhật bổ sung sau (2026-08-17):** `AdExpense` có thêm field `paid_by_admin_id` (bắt buộc, chọn ở Create/Edit) — chi tiết đầy đủ ghi ở Phase 9 "Cập nhật bổ sung lớn".

**Cập nhật sau khi hoàn thành (theo yêu cầu user, xác nhận qua `AskUserQuestion` ngày 2026-08-17) — lệch có chủ đích so với spec §6 gốc, ĐÃ đổi schema thật:**
- User phản hồi "Chi phí ads là tính theo tháng" sau khi Phase 6 đã xong bản đầu (theo ngày, giống Revenue). Xác nhận qua 2 câu hỏi: (1) mỗi Page chỉ có **đúng 1 record AdExpense đang hoạt động/tháng** — nhập lại cho cùng Page+tháng sẽ **ghi đè số tiền/ghi chú**, không cộng dồn nhiều dòng; (2) nếu Page transfer **giữa tháng**, chi phí Ads cả tháng tính cho **nhân viên phụ trách đầu tháng** (ngày 1), không tách theo ngày transfer.
- **Đổi field `expense_date DATE` → `expense_month DATE`** (luôn chuẩn hoá về ngày 1 của tháng) trong `prisma/schema.prisma`, qua migration `20260817140000_ads_expense_monthly` — viết tay `migration.sql` (`ALTER TABLE ... RENAME COLUMN` + `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL`) và áp dụng bằng `prisma db execute` + `prisma migrate resolve --applied` thay vì `prisma migrate dev` bình thường, vì shadow database của `npx prisma dev` bị kẹt state cũ (`type "Role" already exists`) từ trước đó — không liên quan gì tới thay đổi lần này, chỉ là quirk môi trường dev ephemeral, xác nhận `ad_expenses` không có row nào trước khi migrate (an toàn, không mất dữ liệu).
- **`server/services/ads.service.ts`:** `createAdExpense` giờ có hành vi **upsert theo `(pageId, expenseMonth)`** — nếu đã có record active cho Page+tháng đó, cập nhật thẳng amount/note/snapshot (ghi `AuditLog action=UPDATE`) thay vì tạo dòng mới; trả thêm field `wasUpdate: boolean`. `updateAdExpense` (Edit theo ID) reject rõ ràng nếu đổi Page/tháng dẫn tới đụng một record active khác đã tồn tại (`AdExpenseError code=MONTH_CONFLICT`) — tránh vi phạm unique constraint bằng lỗi Postgres thô. `resolvePageOwner` không đổi logic gì — chỉ luôn nhận vào ngày-1-của-tháng (`expenseMonth`) thay vì ngày cụ thể, tự động thoả mãn rule "owner đầu tháng" mà không cần code riêng.
- **Validator mới `monthInputSchema`** (`server/validators/common.schema.ts`, regex `YYYY-MM`) dùng chung — khác `dateSchema` (`YYYY-MM-DD`) vẫn giữ nguyên cho Revenue.
- **UI:** input `type="date"` → `type="month"` trong `CreateAdExpenseDialog`/`EditAdExpenseDialog` (field đổi tên `expenseDate` → `expenseMonth`, label "Ngày chi"/"Ngày ghi nhận" → "Tháng chi"); cột "Ngày" → "Tháng" trong `/admin/ads` và tab Ads của Page Detail, hiển thị qua `formatMonth()` (đã có sẵn từ `lib/dates.ts`, dùng cho `FinanceFilters`). Thêm dòng ghi chú trong dialog Create: "Mỗi Page chỉ có một dòng chi phí Ads cho mỗi tháng — nhập lại cho tháng đã có sẽ cập nhật số tiền của tháng đó."
- **Đã đồng bộ tài liệu:** `context/spec.md` §6 (chèn 3 đoạn "Cập nhật" tại chỗ, giữ nguyên mô tả gốc bên dưới để đối chiếu) + appendix field-dump AdExpense (~dòng 1029) + Reporting Queries §37; `context/schema.md` entity AdExpense + Changelog Phase 6 (mục mới). `Revenue` **không đổi** — chỉ `AdExpense` áp dụng rule theo-tháng này.
- **Test:** viết lại toàn bộ `tests/unit/ads-service.test.ts` (8 test, thêm mới: ghi đè khi tạo trùng Page+tháng, reject conflict khi Edit đụng tháng đã có record khác, tái tạo record sau khi record cũ đã soft-delete) và `tests/integration/ads-transfer-flow.test.ts` (2 test, viết lại kịch bản: Page transfer **giữa tháng 1** — AdExpense tháng 1 vẫn snapshot đúng nhân viên cũ dù đã transfer trước khi tạo record, AdExpense tháng 2 snapshot đúng nhân viên mới vì họ đã phụ trách từ ngày 1 tháng 2) — tổng test toàn repo **46/46 pass**.

**Ghi chú thực hiện (khác với mô tả gốc bên dưới) — áp dụng cho bản implement ban đầu, một số chi tiết đã lệch theo cập nhật ở trên:**
- **Copy gần như 1:1 cấu trúc Revenue (Phase 5), đổi tên field theo AdExpense** — `server/services/ads.service.ts` (`listAdExpenses`, `createAdExpense`, `updateAdExpense`, `softDeleteAdExpense`, class lỗi `AdExpenseError`), `server/validators/ads.schema.ts`, `server/actions/ads.actions.ts` đều mirror 1:1 `revenue.service.ts`/`revenue.schema.ts`/`revenue.actions.ts`, chỉ khác `revenueDate` → `expenseDate`, `Revenue` → `AdExpense`. Không viết lại `resolvePageOwner` — dùng lại nguyên từ `assignment.service.ts` (Phase 4), resolve-rồi-ghi trong cùng transaction giống Revenue để tránh race condition với transfer đồng thời.
- **`components/tables/finance-filters.tsx` dùng lại y nguyên, không sửa gì** — component này đã được thiết kế tổng quát từ Phase 5 chính vì mục đích tái dùng cho Ads (đã ghi chú sẵn trong code từ Phase 5: "Reused by Revenue (Phase 5) and Ads (Phase 6)").
- **Component UI mới:** `components/forms/create-ad-expense-dialog.tsx`, `components/forms/edit-ad-expense-dialog.tsx`, `components/forms/delete-ad-expense-button.tsx` — copy nguyên pattern Dialog + RHF + `useTransition` từ Revenue (không dùng route riêng vì chỉ 4 field đơn giản, cùng lý do đã áp dụng cho Revenue). `CreateAdExpenseDialog` cũng có prop `fixedPageId` để tái dùng khi tạo từ tab Ads trên Page Detail.
- **`/admin/ads`** wire thật thay full trang mock/empty-state cũ, cùng bố cục Clean Table với `/admin/revenue` (Page, Nhân viên, Ngày, Số tiền, Ghi chú, Thao tác) — không generate screen Stitch mới vì `.stitch/DESIGN.md` + bố cục "Quản lý Doanh thu" đã đủ tham chiếu, không lệch token nào cần đối chiếu thêm.
- **Tab Ads trong Page Detail** (`/admin/pages/[pageId]`) wire thật — cùng cấu trúc với tab Doanh thu đã có, thêm `listAdExpenses({ pageId, pageSize: 100 })` vào `Promise.all` chung của trang.
- **Test:** `tests/unit/ads-service.test.ts` (10 test, mirror `revenue-service.test.ts`: snapshot đúng owner khi tạo; reject rõ ràng khi Page không có assignment hợp lệ tại ngày đó (không tạo record mồ côi); reject khi Page không tồn tại; update Page/ngày → resolve lại snapshot đúng; soft delete set `deletedAt`, ẩn khỏi `listAdExpenses` mặc định nhưng vẫn còn trong DB; audit log ghi đủ CREATE/UPDATE/DELETE; filter theo month/employee/page đúng) + `tests/integration/ads-transfer-flow.test.ts` (2 test, đúng spec §52 Case 1 phần Ads: AdExpense 2M trước transfer vẫn thuộc A, AdExpense 3M sau transfer thuộc B, tổng theo từng nhân viên tách biệt đúng; reject AdExpense có ngày trước khi Page có assignment đầu tiên).
- **Employee Cost formula (`Employee Cost = Page Purchase + Ads + Salary`) chưa có UI tổng hợp** ở phase này — đúng theo mô tả gốc "kiểm tra thủ công bằng query", UI tổng hợp thật sự sẽ implement ở Phase 7 (Employee Detail wiring) cùng lúc với Revenue.

**Mục tiêu:** CRUD AdExpense theo Page — cùng pattern với Revenue (copy cấu trúc, không viết lại `resolvePageOwner`).

**Việc cần làm:**
1. `server/services/ads.service.ts` (dùng chung `resolvePageOwner`).
2. Create/Update/Delete (soft) AdExpense: Page, date, amount, note. Tháng suy ra từ `expense_date`, không cần Admin chọn riêng.
3. Employee **không** override được owner trực tiếp.
4. `/admin/ads`: List + Create + Edit + Soft delete + Filter (month/employee/page) + Search + Pagination + URL sync.
5. Wire tab **Ads** trong Page Detail bằng dữ liệu thật.
6. Audit log CREATE/UPDATE/DELETE AdExpense.

**Màn hình Stitch dùng:** Không có sẵn — tái sử dụng bố cục "Quản lý Doanh thu" (Clean Table + form) làm tham chiếu, generate screen "Quản lý Ads" mới bám cùng token/spacing.

**Test / chạy local:**
- Tương tự Phase 5: tạo Ads cho Page thuộc A, transfer sang B, tạo Ads mới → verify snapshot cũ/mới đúng (spec §52 Case 1 phần Ads: A giữ 2M, B có 3M).
- Ads cộng đúng vào Employee Cost formula (`Employee Cost = Page Purchase + Ads + Salary`) — kiểm tra thủ công bằng query, chưa cần UI tổng hợp (Phase 7/11 mới hiển thị).

**Kết quả kiểm thử thực tế (bản đầu, theo ngày — SIÊU SEDE bởi bản kiểm thử theo tháng ngay bên dưới, giữ lại để tham khảo lịch sử):**
- ✅ `npm run test` — 44/44 pass. ✅ `tsc`/`lint`/`build` sạch. ✅ Browser thật: snapshot A/B tách đúng khi transfer, reject Page không có owner, soft delete hoạt động đúng. (Chi tiết đầy đủ đã được thay bằng bản dưới sau khi đổi sang theo-tháng — xem "Cập nhật sau khi hoàn thành" ở đầu Phase 6.)

**Kết quả kiểm thử thực tế (bản theo tháng, sau khi áp dụng "Cập nhật sau khi hoàn thành"):**
- ✅ `npm run test` (vitest, DB dev thật) — **46/46 test pass** trên 11 file: `tests/unit/ads-service.test.ts` (8 test) + `tests/integration/ads-transfer-flow.test.ts` (2 test) viết lại hoàn toàn cho semantics theo-tháng, xem danh sách chi tiết ở "Cập nhật sau khi hoàn thành" đầu Phase 6.
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production) đều sạch — 23 route.
- ✅ Migration `20260817140000_ads_expense_monthly` áp dụng thành công lên DB dev (`ad_expenses` trống 0 row trước khi migrate, xác nhận an toàn không mất dữ liệu); `npx prisma migrate status` báo "up to date" sau khi `migrate resolve --applied`.
- ✅ Kiểm thử UI qua trình duyệt thật (Playwright headless, scratchpad) — kịch bản trọng tâm là **tie-break "owner đầu tháng"**: login Admin → tạo 2 nhân viên A, B → tạo Page ngày 01/01/2026, gán A → **Chuyển giao Page sang B ngay giữa tháng 1 (hiệu lực 15/01/2026)** → vào tab Ads, xác nhận input là `type="month"` (không phải `type="date"`) → tạo chi phí Ads cho **Tháng 01/2026** (2.000.000) → **hiện đúng tên Employee A** dù B đã là chủ từ ngày 15 — đúng rule "owner đầu tháng" vừa xác nhận với user → tạo tiếp chi phí Ads cho **Tháng 02/2026** (3.000.000) → hiện đúng tên Employee B (B đã là chủ từ đầu tháng 2) → **nhập lại chi phí Ads cho Tháng 01/2026 lần 2** (5.000.000) → xác nhận chỉ còn **đúng 1 dòng** "Tháng 01/2026" với số tiền đã ghi đè thành 5.000.000 (không tạo dòng thứ 2) → verify trực tiếp qua DB: đúng 2 row `ad_expenses` (2026-01-01 = 5.000.000, 2026-02-01 = 3.000.000, cả 2 `deletedAt=null`) → tạo Page mới không gán ai, thử tạo Ads cho Page đó → bị reject đúng thông báo không có nhân viên phụ trách → filter `/admin/ads?month=2026-02` chỉ hiện dòng tháng 2, không lộ dòng tháng 1. Đã dọn sạch toàn bộ dữ liệu test sau khi verify xong (bao gồm cả 1 lần dọn dữ liệu rác từ dev server cũ bị treo ở cổng 3000 với Prisma Client chưa regenerate — xem ghi chú migration).

**Điểm dừng:** ✅ Đã implement + tự kiểm thử lại hoàn toàn theo semantics theo-tháng (unit/integration test + browser thật + verify DB trực tiếp + verify migration) sau khi user xác nhận qua `AskUserQuestion`. Dừng lại xin xác nhận từ user trước khi sang Phase 7.

---

## Phase 7: Employee/Page Detail wiring + User self-service Dashboard ✅ (đã hoàn thành, đã kiểm thử)

**Cập nhật sau khi hoàn thành (theo yêu cầu user, ngoài mô tả gốc):**
- **Thêm cột "Thao tác" vào `/admin/employees`** (trước đây List chỉ có link "Xem chi tiết" qua tên) — nút **Chỉnh sửa** mở `EditEmployeeDialog` sẵn có (Phase 3); nút **Vô hiệu hoá** (không phải "Xoá") tái dùng `DeactivateEmployeeButton` sẵn có, chỉ hiện khi nhân viên đang `ACTIVE` — dùng "Vô hiệu hoá" thay vì "Xoá" vì `User`/`EmployeeProfile` không có field soft-delete trong schema (khác `Page`), và bị nhiều bảng khác tham chiếu (`Revenue`/`AdExpense`/`PagePurchaseExpense`/`PageAssignment`/`SalaryHistory`) nên hard-delete qua UI không phù hợp.
- **Xoá cứng (hard delete) dữ liệu test cũ theo yêu cầu user** để tiện test lại từ đầu — thực hiện qua script một lần (không phải tính năng trong app), xoá đúng thứ tự phụ thuộc khoá ngoại (AuditLog → Revenue/AdExpense/PagePurchaseExpense → PageAssignment → SalaryHistory → EmployeeProfile → User, kèm Page liên quan). Không thêm route/nút "xoá thật" nào vào UI — vẫn giữ đúng nguyên tắc CLAUDE.md không hard-delete dữ liệu tài chính qua app.

**Quyết định xác nhận với user trước khi implement (qua `AskUserQuestion`, 2026-08-17):** Salary không phải transaction (chỉ là rate trong `SalaryHistory` theo `effective_from`/`effective_to`). Khi tính "Tổng chi phí" KHÔNG lọc theo tháng (Employee List khi bỏ trống filter tháng, Employee Detail Summary, `/user/costs`, `/user/dashboard`'s "Tổng..." fields) — chọn phương án **cộng dồn theo lịch sử** (accrued): `Σ (monthly_salary × số tháng hiệu lực)` qua từng giai đoạn `SalaryHistory`, thay vì chỉ dùng mức lương hiện tại. Giai đoạn đang active (`effective_to = null`) cộng dồn tới hết tháng hiện tại.

**Ghi chú thực hiện (khác với mô tả gốc bên dưới):**
- **`getEmployeeFinancials(employeeId, monthKey?)`** (mới, `employee.service.ts`) là hàm trung tâm cho công thức spec §10.1–10.2 (`Employee Cost = Page Purchase + Ads + Salary`) — dùng chung cho Employee List, Employee Detail, `/user/dashboard`, `/user/costs`. Bỏ trống `monthKey` → mọi thành phần là tổng all-time (dùng `prisma.aggregate` cho Revenue/Ads/PagePurchase, cộng dồn lịch sử cho Salary — xem quyết định ở trên); truyền `monthKey` (`"YYYY-MM"`) → mọi thành phần chỉ tính trong tháng đó, Salary = mức lương active vào ngày 1 tháng đó (tái dùng đúng convention "day-1 owner" đã có từ Phase 6 Ads). Vì quy mô nhỏ (~8 nhân viên), Employee List gọi hàm này cho từng dòng qua `Promise.all` thay vì viết riêng một đường aggregation batched — đúng tinh thần CLAUDE.md "ưu tiên đơn giản, không tối ưu hoá sớm".
- **`getEmployeeMonthlySeries(employeeId, monthsBack=6)`** (mới, `employee.service.ts`) — 6 tháng gần nhất (tính cả tháng hiện tại), mỗi tháng gọi lại `getEmployeeFinancials(employeeId, monthKey)` — dùng cho Monthly Chart ở cả Employee Detail và `/user/dashboard`.
- **`getEmployeeAssignmentHistory(employeeId)`** (mới, `assignment.service.ts`) — mirror của `getAssignmentHistory(pageId)` đã có (Phase 4) nhưng theo chiều nhân viên thay vì Page. Dùng chung một bảng UI (Page, Từ ngày, Đến ngày) cho cả Employee Detail tab "Page" **và** `/user/pages` — spec §14.3 "Pages" (Page hiện tại + lịch sử) và spec §12 "Danh sách Page + Lịch sử Page từng phụ trách" hoá ra là cùng một dữ liệu, không cần 2 query/2 UI riêng.
- **`src/lib/month.ts`** (mới) — `parseMonthKey`/`monthDateRange`/`shiftMonthKey` dùng chung cho mọi tính toán theo tháng ở Phase 7. Không refactor lại `revenue.service.ts`/`ads.service.ts` (vốn đã có phiên bản riêng của cùng logic từ Phase 5/6) để tránh động vào code đã test kỹ ngoài phạm vi phase này — chấp nhận trùng lặp nhỏ.
- **Employee Detail đổi từ layout "grid EmptyState" sang `Tabs`** (Doanh thu / Chi phí / Page / Biểu đồ theo tháng) — theo đúng pattern `Tabs` đã dùng ở Page Detail (Phase 4), nhất quán UI giữa 2 trang Detail.
- **Employee List** thêm filter tháng (`MonthFilter`, component mới — bản rút gọn của `FinanceFilters` chỉ có 1 input, tái dùng cho cả `/user/revenue`) qua `?month=`, bỏ trống = tổng all-time (nhất quán với hành vi filter tháng đã có ở Revenue/Ads từ Phase 5/6: bỏ trống = không giới hạn).
- **`/user/pages`** đổi từ hiển thị 1 Page hiện tại (dữ liệu mock cũ, dạng `MockPage`) sang bảng lịch sử đầy đủ (dùng `getEmployeeAssignmentHistory`) — đúng sát nghĩa spec §12 hơn ("Lịch sử Page từng phụ trách", không chỉ Page hiện tại).
- **`/user/dashboard`** tách rõ 2 loại số theo đúng field wording của spec §12: "Doanh thu kỳ hiện tại" = `getEmployeeFinancials(employeeId, currentMonthKey())`.revenue (scoped theo tháng hiện tại); "Tổng Ads"/"Chi phí mua Page"/"Tổng chi phí" = `getEmployeeFinancials(employeeId)` không tham số (all-time) — khớp chính xác với tên field cũ trong mock data Phase 1 (`periodRevenue` vs `totalAds`/`totalCost`), xác nhận thiết kế ban đầu đã đúng ý định này.
- **Xoá `mockUserProfile`/`mockUserPages`/`mockUserRevenue`** khỏi `src/lib/mock-data.ts` (không còn nơi nào dùng sau khi wire xong `/user/*`) — các export khác (`mockDashboardKpis`, `mockMonthlyChart`, `mockRecentActivity`) vẫn giữ nguyên, dành cho Phase 11 (Admin Dashboard).
- **RBAC:** mọi trang `/user/*` mới (dashboard/pages/revenue/costs) đều gọi `requireUser()` + `getEmployeeDetailByUserId(user.id)` để tự resolve `employeeId` từ session — không có trang nào nhận `employeeId` từ query param/client, giữ đúng pattern đã có sẵn từ `/user/profile` (Phase 3).

**Mục tiêu:** Giờ đã có đủ Revenue + Ads + Page Purchase + Salary, wire lại các phần tổng hợp còn "empty state" ở Phase 3/4, và dựng toàn bộ trải nghiệm User (chỉ xem dữ liệu của chính mình).

**Việc cần làm:**
1. `server/services/employee.service.ts` bổ sung hàm tổng hợp: `Employee Revenue`, `Employee Cost = PagePurchase + Ads + Salary` (spec §10.1–10.2).
2. Wire Employee Detail: Summary (Total Revenue/Cost/Active Pages thật), section Revenue (list snapshot), Costs (chia Ads/Page Purchase/Salary), Pages (hiện tại + lịch sử với ngày bắt đầu/kết thúc), Monthly Chart (Revenue/Ads/Total Cost theo Recharts).
3. `/user/dashboard`: Tên, Email, Tổng Page đang quản lý, Doanh thu kỳ hiện tại, Tổng Ads, Chi phí Page Purchase, Lương, Tổng chi phí, biểu đồ doanh thu theo tháng (spec §12) — **không** hiển thị Admin Received/Profit/chi phí chung/dữ liệu nhân viên khác.
4. `/user/pages`: Page hiện tại + lịch sử từng phụ trách.
5. `/user/revenue`, `/user/costs`: dữ liệu snapshot của chính user (RBAC: query luôn filter theo `session.employeeId`, không nhận `employeeId` từ client).
6. RBAC test rõ: mọi endpoint User-side phải tự lấy `employeeId` từ session, không tin tham số query cho phép xem người khác.

**Màn hình Stitch dùng:** "Quản lý Nhân sự" (Detail — tái dùng bố cục cho cả Employee Detail Admin và User Dashboard, vì spec yêu cầu cấu trúc tương tự nhưng phạm vi hẹp hơn). User Dashboard: generate mới bám DESIGN.md nếu bố cục không khớp đủ (nav rút gọn, không sidebar Admin đầy đủ).

**Test / chạy local:**
- Xem Employee Detail của 1 employee có Page/Revenue/Ads/Salary đã seed từ các phase trước → số liệu Summary/Costs khớp tính tay.
- Login bằng tài khoản User → `/user/dashboard` chỉ thấy dữ liệu chính mình, thử sửa URL param employeeId khác (nếu có) → phải bị chặn hoặc tự bỏ qua param, không lộ dữ liệu người khác.
- User cố truy cập `/admin/employees/[id-nguoi-khac]` → chặn 403 (đã có từ Phase 2 nhưng verify lại end-to-end).

**Kết quả kiểm thử thực tế:**
- ✅ `npm run test` (vitest, DB dev thật) — **52/52 test pass** trên 12 file (46 test cũ Phase 3-6 + 6 test mới `tests/unit/employee-financials.test.ts`): all-time sums đúng cho Revenue/Ads/PagePurchase; Salary cộng dồn đúng qua nhiều giai đoạn `SalaryHistory` (giai đoạn đóng 3 tháng × 10M + giai đoạn đang mở 3 tháng × 15M = 75M, khớp tính tay); scoped theo tháng hiện tại/tháng quá khứ chỉ tính đúng dữ liệu tháng đó, Salary = mức active ngày 1 tháng đó; tháng trước khi có dữ liệu trả về toàn 0 không lỗi; `getEmployeeMonthlySeries` trả đúng 6 tháng, tháng cuối khớp với `getEmployeeFinancials` gọi trực tiếp; `getEmployeeAssignmentHistory` trả đúng Page đang gán. Test dùng mốc tháng tương đối (`shiftMonthKey` từ `currentMonthKey()`) thay vì hardcode, tránh phụ thuộc vào đồng hồ hệ thống lúc chạy test.
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production) đều sạch — 23 route (`/admin/employees/[employeeId]`, cả 4 route `/user/*` chuyển từ mock sang dynamic thật).
- ✅ Kiểm thử UI qua trình duyệt thật (Playwright headless, cài trong scratchpad, 31 assertion tự động — kịch bản đầy đủ 1 vòng đời): login Admin → tạo nhân viên mới, capture mật khẩu tạm hiện đúng 1 lần → Đổi lương 12.000.000 hiệu lực từ 3 tháng trước (tạo giai đoạn `SalaryHistory` đang active duy nhất) → tạo Page 5.000.000, gán ngay cho nhân viên, ngày mua lùi 1 tháng → tab Doanh thu trên Page Detail: thêm Revenue 20.000.000 tháng hiện tại → tab Ads: thêm chi phí Ads 3.000.000 tháng hiện tại → vào Employee Detail: Summary hiện đúng Tổng doanh thu 20.000.000; tab Chi phí hiện đúng Ads 3.000.000, Page Purchase 5.000.000, **Lương luỹ kế 48.000.000 (= 12.000.000 × 4 tháng, khớp tính tay cho giai đoạn bắt đầu 3 tháng trước tới hết tháng hiện tại)**; tab Page liệt kê đúng Page vừa gán với nhãn "Hiện tại"; tab Biểu đồ render được SVG (Recharts) → Employee List: hiển thị đúng nhân viên cả khi không filter lẫn khi filter `?month=<tháng hiện tại>` (URL sync đúng) → **Logout Admin, login bằng chính tài khoản nhân viên vừa tạo (dùng mật khẩu tạm đã capture)** → redirect đúng `/user/dashboard`, hiện đúng tên, "Doanh thu kỳ hiện tại" = 20.000.000 (scoped theo tháng, khác với all-time), Lương = 12.000.000, **không hiện "Lợi nhuận"/dữ liệu công ty** (đúng spec §12 "Không hiển thị Admin Received/Profit công ty/Chi phí chung") → `/user/pages` hiện đúng Page với "Hiện tại" → `/user/revenue` hiện đúng dòng Revenue 20.000.000 → `/user/costs` hiện đúng Ads 3.000.000 + Page Purchase 5.000.000 → **RBAC**: tài khoản User cố truy cập `/admin/employees` → bị redirect ra khỏi route đó (không chỉ ẩn UI); logout hẳn (xoá cookie) rồi truy cập `/user/dashboard` và `/admin/dashboard` → cả hai đều redirect `/login`. Toàn bộ 31/31 assertion pass. Đã dọn sạch dữ liệu test (nhân viên, Page, Revenue, Ads, Audit Log liên quan tới `phase7-emp-*`/`Phase7 Page *`) qua script cleanup riêng, verify lại còn 0 record.

**Điểm dừng:** ✅ Đã implement + tự kiểm thử (unit test cho công thức tài chính + browser thật full vòng đời Admin→User + verify RBAC cả 2 chiều role-based và unauthenticated) — **user đã tự kiểm thử cục bộ và xác nhận hoàn thành** — sẵn sàng sang Phase 8.

**Cập nhật bổ sung (2026-08-18, rất lâu sau khi các phase khác đã hoàn thành) — dòng "Lương" trong "Chi tiết chi phí" đổi từ hiện mọi giai đoạn `SalaryHistory` sang chỉ hiện đúng 1 dòng (lương đang hiệu lực), theo yêu cầu user:**
- User phát hiện: đổi lương (SetSalaryDialog) không sửa đè `SalaryHistory` — nó tạo record mới + đóng `effective_to` record cũ (đúng thiết kế append-only), nên bảng "Chi tiết chi phí" (vốn liệt kê toàn bộ lịch sử — quyết định có chủ đích từ Phase 7, xem `context/spec.md` mục §12 changelog) hiện cả dòng cũ vừa đóng lẫn dòng mới, gây khó hiểu ("2 loại lương"). User yêu cầu: chỉ hiện lương mới nhất, và hiện 1 tháng thay vì range "từ tháng này đến tháng kia".
- **Không đổi schema** — `SalaryHistory` vẫn append-only đầy đủ lịch sử (vẫn cần cho `accruedSalaryCost`/"Lương (luỹ kế)" ở KPI card, mục 10.2, hoàn toàn không đổi). Chỉ đổi tầng hiển thị của bảng "Chi tiết chi phí": lọc còn đúng record `effectiveTo === null`, label tháng đổi từ `formatSalaryPeriod()` (hàm đã xoá) sang `formatMonth(effectiveFrom)` — một tháng duy nhất, không còn dấu gạch ngang/"hiện tại".
- Sửa ở 2 nơi (không có service/component dùng chung — logic merge row nằm inline mỗi page, xem ghi chú Phase 7 gốc "chưa refactor thành shared function"): `src/app/admin/employees/[employeeId]/page.tsx` (tab "Chi phí") và `src/app/user/costs/page.tsx`.
- Test: không cần test mới (thuần logic hiển thị ở page component, không có service/business logic nào thay đổi) — `tsc`/`lint`/`npm run test` (128/128, không đổi số lượng)/`npm run build` đều sạch.
- ⚠️ Phát hiện phụ trong lúc debug: dev server `next dev` chạy hơn 1 tiếng trước khi implement Phase "Tiền nhân viên đã nhận" (turn trước) đã serve Prisma Client cũ (thiếu `employeeReceipt`), gây lỗi runtime `Cannot read properties of undefined (reading 'count')` — đã `kill -9` + khởi động lại sạch, cùng nguyên nhân đã ghi nhận ở Phase 3. Không liên quan tới thay đổi lần này (là edit page component thuần, Turbopack hot-reload bình thường, không cần restart).

---

## Phase 8: Expense Categories ✅ (đã hoàn thành, đã kiểm thử)

**Ghi chú thực hiện (khác với mô tả gốc bên dưới):**
- **Model `ExpenseCategory` đã có sẵn trong `prisma/schema.prisma` từ Phase 1** (cùng lúc toàn bộ schema được khởi tạo) — phase này không cần migration mới, chỉ thêm service/action/UI + seed data.
- **Archive không phải action riêng — dùng lại đúng pattern "Edit Page's status field" từ Phase 4:** `updateExpenseCategory` nhận cả `isActive` cùng name/slug/description/scope trong 1 form Edit, không có nút "Archive" tách biệt. Lý do: đây đã là tiền lệ có sẵn trong codebase (Page's `status` ACTIVE/ARCHIVED cũng sửa qua Edit dialog, không có action riêng) — dùng lại nhất quán thay vì tạo thêm 1 kiểu action mới cho cùng một khái niệm.
- **System category (`is_system=true`) bị chặn *toàn bộ* update, không chỉ riêng archive:** `updateExpenseCategory` reject thẳng (`code=SYSTEM_CATEGORY`) nếu `category.isSystem`, trước khi chạm tới bất kỳ field nào — diễn giải chặt hơn 1 trong 2 phương án plan gốc đưa ra ("chỉ cho phép archive... hoặc chặn hẳn action delete") theo hướng an toàn nhất: không chỉ chặn archive mà chặn luôn rename/re-scope, vì các category này đại diện khái niệm cố định (Page Purchase/Ads/Salary) mà phần còn lại của hệ thống ngầm định tên/slug không đổi. UI phản ánh đúng: hàng system trong bảng không có nút "Chỉnh sửa" (chỉ hiện `—`), chỉ có tag "HỆ THỐNG".
- **Không có pagination/search cho `/admin/settings/expense-categories`** — khác với "cross-cutting requirement" ghi ở đầu file cho mọi list screen. Lý do: quy mô cố định rất nhỏ (5 seed + custom category hiếm khi vượt quá vài chục), không có giá trị thực tế, đúng tinh thần CLAUDE.md "ưu tiên đơn giản, không tối ưu hoá sớm". `listExpenseCategories()` trả về toàn bộ, sort `isSystem desc, name asc` (3 system lên đầu).
- **Scope cho 3 category seed system** (spec §21 không nêu rõ): `PAGE_PURCHASE`→`PAGE`, `ADS`→`PAGE`, `SALARY`→`EMPLOYEE` — suy luận từ đúng cấp độ record mà mỗi khái niệm gắn vào (`PagePurchaseExpense`/`AdExpense` đều snapshot theo Page, `SalaryHistory` theo Employee). `RESOURCE`/`OTHER` → `ADMIN` (đúng spec "RESOURCE có thể dùng cho Admin Expense").
- **Scope `SYSTEM` không phải option chọn được khi Admin tự tạo category mới** (`CreateExpenseCategorySchema`/`UpdateExpenseCategorySchema` chỉ enum `ADMIN|EMPLOYEE|PAGE`) — tránh Admin tạo ra category tự xưng "hệ thống" giả trong khi field `is_system` thật (bảo vệ khỏi hard-delete/update) chỉ do seed script set, không expose qua UI/action nào.
- **`listActiveExpenseCategoryOptions()`** thêm sẵn vào service (không dùng ở UI Phase 8, dành cho dropdown AdminExpense — Phase 9) — cùng tinh thần các hàm `list*Options()` đã thêm preemptively ở Phase 4/5 (`listActiveEmployeeOptions`, `listPageOptions`).
- **`prisma/seed.ts`** mở rộng thêm bước seed `ExpenseCategory` qua `upsert` theo `slug` (idempotent, chạy lại không tạo trùng) — cùng file, cùng lệnh `npx prisma db seed` như 2 Admin.

**Mục tiêu:** CRUD danh mục chi phí, seed system category — cần xong trước Admin Expense (Phase 9) vì có FK `category_id`.

**Việc cần làm:**
1. `server/services/expense-category.service.ts`.
2. Seed cố định `is_system=true`: `PAGE_PURCHASE`, `ADS`, `SALARY`; seed thêm `RESOURCE`, `OTHER` (`is_system=false` theo schema.md, dùng cho Admin Expense).
3. Create/Update category (name, slug, description, scope, is_active). **Không hard-delete** category `is_system=true` — chỉ cho phép archive (`is_active=false`) với category không phải system, hoặc chặn hẳn action delete trên system category.
4. `/admin/settings/expense-categories`: List + Create + Edit + Archive.
5. Audit log category changes.

**Màn hình Stitch dùng:** Không có sẵn — generate mới (form + table đơn giản, bám Clean Table/Data Card token). Đã viết tay bám `.stitch/DESIGN.md` (Clean Table, Status Chips, Dialog pattern có sẵn từ Phase 4/5) — không gọi `generate_screen_from_text` vì bố cục List+Create/Edit Dialog đã có đủ tiền lệ y hệt từ `/admin/pages` và `CreateRevenueDialog`/`EditPageDialog`.

**Test / chạy local:**
- Verify 5 category seed đúng: 3 system (`PAGE_PURCHASE`,`ADS`,`SALARY`) + `RESOURCE`,`OTHER`.
- Thử xoá `PAGE_PURCHASE` → bị chặn.
- Tạo category mới scope `ADMIN` → xuất hiện trong dropdown ở Phase 9.

**Kết quả kiểm thử thực tế:**
- ✅ `npm run test` (vitest, DB dev thật) — **58/58 test pass** trên 13 file (52 test cũ Phase 3-7 + 6 test mới `tests/unit/expense-category-service.test.ts`): seed đúng 3 system (`PAGE_PURCHASE`/`ADS`/`SALARY`) + `RESOURCE`/`OTHER` không system; create category mới ghi đúng `isSystem=false`, audit `CREATE`; slug trùng (kể cả khác hoa/thường) bị reject, không tạo record mồ côi; update đổi được name/slug/scope/description/isActive cùng lúc, ghi audit `UPDATE` với before/after; **update (kể cả archive) trên category `PAGE_PURCHASE` bị reject hoàn toàn**, dữ liệu không đổi (đúng spec §21); rename sang slug đã tồn tại (của category khác) bị reject.
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production) đều sạch — 23 route (`/admin/settings/expense-categories` chuyển từ empty-state tĩnh sang dynamic thật).
- ✅ `npx prisma db seed` chạy lại (idempotent) → in đúng 5 dòng "Seeded expense category: ..." không tạo trùng (verify qua `upsert` theo `slug`).
- ✅ Kiểm thử UI qua trình duyệt thật (Playwright headless, tái sử dụng browser cache có sẵn từ phase trước, 16 assertion tự động): login Admin → `/admin/settings/expense-categories` hiện đúng 5 category seed, đúng 3 hàng có tag "HỆ THỐNG"; hàng system không có nút "Chỉnh sửa" (chỉ `—`), hàng non-system có nút "Chỉnh sửa" → Tạo category mới (scope mặc định Admin, Active mặc định Hoạt động) → xuất hiện ngay trong list, có nút Chỉnh sửa, không có tag "Hệ thống" → Sửa: đổi tên + đổi Trạng thái sang "Lưu trữ" qua dialog Edit → list cập nhật đúng tên mới, chip đổi "LƯU TRỮ" → Tạo thử category với slug trùng category vừa tạo → dialog hiện lỗi "Slug đã được sử dụng.", dialog không đóng (không tạo record). Đối chiếu ảnh chụp màn hình với `.stitch/DESIGN.md`: Clean Table (header tint `surface-ice`, không viền dọc), Status Chip đúng tông (`Hoạt động` xanh nhạt / `Lưu trữ` xám), Dialog trắng viền `border-subtle`, không lệch token nào. Đã dọn sạch category test (`TEST_UI_*`) sau khi verify xong, `npm run test` chạy lại vẫn 58/58 pass.

**Điểm dừng:** ✅ Đã implement + tự kiểm thử (unit test cho service layer + browser thật + verify seed idempotent) — **user đã tự kiểm thử cục bộ và xác nhận hoàn thành** — sẵn sàng sang Phase 9.

**❌ ĐÃ GỠ BỎ HOÀN TOÀN (2026-08-18) — theo yêu cầu user, xác nhận qua `AskUserQuestion`:**
User hỏi "Danh mục chi phí này có cần thiết không, không thì bỏ đi" khi xem trang `/admin/settings/expense-categories`. Trước khi trả lời, đã audit lại usage thật (không chỉ đọc mô tả cũ): xác nhận 3 category HỆ THỐNG (`PAGE_PURCHASE`/`ADS`/`SALARY`) **không có FK thật** tới `PagePurchaseExpense`/`AdExpense`/`SalaryHistory` — 3 bảng đó hoàn toàn tách biệt, không có `category_id` — nên 3 category này chỉ là placeholder không sửa/xoá được, nhưng **vẫn chọn được** cho một `AdminExpense` thật (dropdown không lọc theo scope, xem Phase 9 bên dưới), dễ gây dữ liệu gán nhầm nhãn. Đưa ra 2 lựa chọn qua `AskUserQuestion` (chỉ xoá 3 category hệ thống, hay bỏ hẳn cả tính năng) — user chọn **bỏ hẳn**, xác nhận thêm "Tôi đã xoá chi phí chung rồi nên tất cả không còn quan trọng nữa" (dev DB lúc đó 0 dòng `AdminExpense` active — không rủi ro mất dữ liệu thật).

Đã xoá: enum `ExpenseCategoryScope`, model `ExpenseCategory`, field `AdminExpense.category_id`/relation — migration `20260818110000_drop_expense_categories`. Xoá hẳn file: `expense-category.service.ts`, `expense-category.actions.ts`, `expense-category.schema.ts`, route `/admin/settings/expense-categories`, `create-expense-category-dialog.tsx`/`edit-expense-category-dialog.tsx`, `tests/unit/expense-category-service.test.ts`, seed `EXPENSE_CATEGORIES`. Sửa surgical mọi nơi tham chiếu `categoryId`: `admin-expense.service.ts`/`.schema.ts`/`.actions.ts`, `/admin/expenses/page.tsx`, `create-admin-expense-dialog.tsx`/`edit-admin-expense-dialog.tsx`, `admin-expense-filters.tsx` (chỉ còn Tháng + Admin), `dashboard.service.ts` (Recent Activity message đổi sang `description`), `nav-config.ts` (bỏ mục sidebar). Giữ nguyên `audit-labels.ts`'s nhãn `ExpenseCategory` — `AuditLog` append-only, bản ghi lịch sử vẫn cần hiển thị tiếng Việt dễ đọc. Chi tiết đầy đủ: `context/schema.md` Changelog "Bỏ hẳn tính năng Expense Categories" và `context/spec.md` §19/§21.

Test: xoá nguyên `expense-category-service.test.ts`; sửa `admin-expense-service.test.ts` (bỏ fixture category, đổi test "rejects an unknown category" → "rejects an invalid payer") và `dashboard-service.test.ts` (bỏ lookup category ở setup) — **119/119 test pass** (từ 125). `tsc`/`lint`/`npm run build` đều sạch, route `/admin/settings/expense-categories` không còn trong danh sách build (25 route, từ 26).

---

## Phase 9: Admin Expenses ✅ (đã hoàn thành, đã kiểm thử)

**Cập nhật bổ sung lớn (theo yêu cầu user, xác nhận qua `AskUserQuestion` ngày 2026-08-17): thêm field `paid_by_admin_id` — cross-cutting cả 3 bảng chi phí + Dashboard + Settings Users.**

User yêu cầu mỗi mục chi phí phải có "người chi" (Admin thực sự bỏ tiền ra), xác nhận rõ đây là field **khác** `created_by_admin_id` (chỉ là Admin nhập liệu), áp dụng cho **cả 3 bảng**: `AdExpense` (Phase 6), `PagePurchaseExpense` (Phase 4), `AdminExpense` (Phase 9 — đây), và tổng "Admin đã chi" hiển thị ở **cả** Admin Dashboard (Phase 11) lẫn Settings → Tài khoản (Phase 13). Toàn bộ thay đổi ghi tập trung ở đây vì đây là phase "trung tâm" của khái niệm chi phí do Admin trực tiếp bỏ ra; các phase khác chỉ có 1 dòng trỏ về mục này.

- **Schema (CÓ thay đổi thật):** thêm `paid_by_admin_id UUID NOT NULL` (FK → User) vào cả 3 bảng qua migration `20260817220000_add_paid_by_admin_id` (viết tay + backfill từ `created_by_admin_id` cho dữ liệu cũ + `prisma migrate resolve --applied`, cùng lý do/cách làm migration `ads_expense_monthly` ở Phase 6 — xem `context/schema.md` Changelog để biết chi tiết đầy đủ).
- **`listAdminOptions()` chuyển từ `admin-expense.service.ts` sang `user-account.service.ts`** (đổi chỗ, không đổi hành vi) — vì giờ được dùng bởi 3 domain (Ads/Page/AdminExpense), không còn là thứ riêng của AdminExpense. Mọi import site cập nhật theo (`admin/ads`, `admin/expenses`, `admin/receipts`, `admin/pages/*`).
- **`ads.service.ts`/`admin-expense.service.ts`:** `paidByAdminId` **bắt buộc** ở cả Create lẫn Update — validate phải là `User.role=ADMIN`, ghi vào `beforeJson`/`afterJson` của audit.
- **`page.service.ts` (`createPage`) / `assignment.service.ts` (`assignEmployee`):** `paidByAdminId` **tuỳ chọn ở type**, nhưng bắt buộc ở tầng service **khi thực sự sẽ tạo `PagePurchaseExpense`** (`purchasePrice > 0` và có gán nhân viên) — validate trước khi mở transaction nên reject sạch, không tạo Page/assignment mồ côi. UI tương ứng (`create-page-form.tsx`, `assign-employee-dialog.tsx`) chỉ **hiện field khi cần** (RHF `useWatch` theo dõi `purchasePrice`/nhân viên đã chọn cho Create Page; prop `needsPayer={page.purchasePrice > 0n}` truyền từ Page Detail cho Assign Employee).
- **`getAdminSpendingBreakdown(monthKey?)` (mới, `dashboard.service.ts`)** — sum `AdExpense`/`PagePurchaseExpense`/`AdminExpense.amount` group theo `paid_by_admin_id`, tách biệt hoàn toàn với `getSystemFinancials()` (vốn không quan tâm ai chi). `monthKey` bỏ trống = all-time (dùng cho Settings Users "Tổng đã chi"), có = theo tháng (dùng cho Dashboard, cùng filter tháng với KPI card).
- **UI mới:** cột "Người chi" trên `/admin/ads` + `/admin/expenses` + Page Detail tab Ads; summary stat "Người chi mua Page" trên Page Detail (đọc qua `getPageDetail()` mở rộng, `null` nếu Page chưa có `PagePurchaseExpense`); bảng "Chi phí theo người chi" mới trên Admin Dashboard (dưới bảng "Danh sách nhân viên"); cột "Tổng đã chi" mới trên `/admin/settings/users` (chỉ hiện số cho role=ADMIN, role=USER hiện `—`).
- **Test:** thêm test case cho guard "thiếu người chi" ở `page-service.test.ts`/`assign-employee.test.ts` (reject sạch, không tạo record mồ côi) + 4 test mới cho `getAdminSpendingBreakdown` trong `dashboard-service.test.ts` (đúng theo tháng, all-time, tháng trước không dính, liệt kê cả Admin chưa chi đồng nào). Toàn bộ test cũ có gọi `createAdExpense`/`createAdminExpense`/`createPage` (purchasePrice>0)/`assignEmployee` (purchasePrice>0) đều cập nhật thêm `paidByAdminId` — không đổi assertion nào khác, chỉ thêm field bắt buộc mới.
- ✅ `npm run test` — 101/101 pass (18 file). `tsc --noEmit`/`lint`/`npm run build` sạch. Kiểm thử tay qua browser thật: tạo Page có giá mua + gán nhân viên → field "Người chi" hiện đúng lúc cần, submit thiếu bị chặn với thông báo rõ, chọn xong tạo thành công → Page Detail hiện đúng "Người chi mua Page" → tạo Ads/Admin Expense với 2 Admin khác nhau → Dashboard (theo tháng) và Settings Users (all-time) đều cộng đúng, tách đúng theo từng Admin, không trộn lẫn.
- ⚠️ Phát hiện khi test: chi phí Ads cho Page vừa gán nhân viên **giữa tháng** không tạo được cho **tháng đó** (lỗi "Page chưa có nhân viên phụ trách hợp lệ tại ngày này") — đây là hành vi **đúng, có từ trước** (Phase 6, `resolvePageOwner` yêu cầu owner hợp lệ vào ngày 1 của tháng), không phải bug của thay đổi này; test lại với tháng sau thì thành công bình thường.

**Ghi chú thực hiện (khác với mô tả gốc bên dưới):**
- **`server/services/admin-expense.service.ts`** mirrors `revenue.service.ts` (Phase 5) — `listAdminExpenses`, `createAdminExpense`, `updateAdminExpense`, `softDeleteAdminExpense`, class lỗi `AdminExpenseError` — cộng thêm `restoreAdminExpense` (mới hoàn toàn, xem bên dưới) và `listAdminOptions()` (danh sách `User` `role=ADMIN`, dùng cho dropdown filter "Admin đã nhập" — spec §13). Category dropdown dùng thẳng `listActiveExpenseCategoryOptions()` đã có sẵn từ Phase 8, không lọc theo `scope` — Admin có thể chọn bất kỳ category active nào (kể cả 3 category system `PAGE_PURCHASE`/`ADS`/`SALARY`), vì spec/schema không đặt ràng buộc `scope=ADMIN` lên `AdminExpense.category_id`, và việc này không gây double-count trong công thức `Total Expenses` (mỗi thành phần công thức cộng từ đúng 1 bảng riêng, không lọc theo category).
- **Restore — action đầu tiên trong codebase có tính năng này** (Revenue/Ads/Page chỉ có soft delete, không có Restore, đã ghi chú rõ ở Phase 5/6). `restoreAdminExpense(id, adminId, meta)` clear `deletedAt`, ghi `AuditLog action="RESTORE"` (action string tự do, không phải enum — theo đúng field `action: String` trong `AuditLog`). Vì Restore chỉ có ý nghĩa khi nhìn thấy được bản ghi đã xoá, `listAdminExpenses` nhận thêm param `deleted?: boolean` (mặc định `false` = chỉ hiện active) — UI thêm nút toggle "Xem đã xoá" / "Xem đang hoạt động" (`Link` URL-sync qua `?deleted=1`, giữ nguyên filter khác). Ở view "đã xoá": ẩn nút "Thêm chi phí", mỗi dòng chỉ có nút "Khôi phục" (không có Sửa/Xoá).
- **Không có Search (`q`)** cho `/admin/expenses` — khác Revenue/Ads (có search Page name/note). Spec §41 liệt kê rõ 4 màn hình có search (Employees/Pages/Revenue/Ads), không có Admin Expenses; plan gốc mục "Việc cần làm" cũng chỉ liệt kê "Filter (month/category/admin nhập) + Pagination", không có Search. Filter dùng component mới `AdminExpenseFilters` (không tái dùng `FinanceFilters` vì bộ filter khác hẳn — Month/Category/Admin thay vì Month/Employee/Page).
- **`ConfirmDialog` tái dùng cho cả Xoá lẫn Khôi phục** — `RestoreAdminExpenseButton` truyền `destructive={false}` (trước giờ `ConfirmDialog` luôn dùng ở chế độ destructive mặc định, đây là lần đầu dùng non-destructive).
- **Component mới:** `components/tables/admin-expense-filters.tsx`, `components/forms/create-admin-expense-dialog.tsx`, `components/forms/edit-admin-expense-dialog.tsx`, `components/forms/delete-admin-expense-button.tsx`, `components/forms/restore-admin-expense-button.tsx` — cùng pattern Dialog + RHF + `useTransition` đã dùng từ Revenue/Ads (không có `fixedPageId`-style prop vì AdminExpense không gắn Page).
- **Test:** `tests/unit/admin-expense-service.test.ts` (9 test): snapshot CREATE/UPDATE/DELETE/RESTORE đúng + audit log đủ; reject category không tồn tại (create lẫn update); reject update/restore trên record sai trạng thái (đã xoá / chưa xoá); **verify tường minh AdminExpense không cộng vào Employee Cost** (tạo `AdminExpense` 50 triệu, so `getEmployeeFinancials()` trước/sau — `totalCost`/`adsCost`/`pagePurchaseCost`/`salaryCost` không đổi, đúng spec §8/§10.2/§10.3); filter theo `month` và `createdByAdminId` đúng; `listAdminOptions()` trả đúng user `role=ADMIN`.

**Mục tiêu:** CRUD chi phí chung của Admin, không gắn Page/nhân viên cụ thể.

**Việc cần làm:**
1. `server/services/admin-expense.service.ts`.
2. Create/Update/Soft delete/Restore AdminExpense: date, category (từ Phase 8), amount, description, note.
3. `/admin/expenses`: List + Create + Edit + Soft delete + Restore + Filter (month/category/admin nhập) + Pagination.
4. Audit log CREATE/UPDATE/DELETE AdminExpense.
5. Đảm bảo AdminExpense **không** cộng vào Employee Cost, chỉ cộng vào `Total Expenses` hệ thống (spec §8, §10.3) — verify ở service layer.

**Màn hình Stitch dùng:** Không có sẵn — generate mới, tái dùng bố cục Clean Table từ "Quản lý Doanh thu" làm tham chiếu.

**Test / chạy local:**
- Tạo Admin Expense category `RESOURCE` → xuất hiện đúng trong list, không xuất hiện trong Employee Cost của bất kỳ nhân viên nào.
- Soft delete → Restore → dữ liệu quay lại đúng, audit log ghi cả 2 action.

**Kết quả kiểm thử thực tế:**
- ✅ `npm run test` (vitest, DB dev thật) — **67/67 test pass** trên 14 file (58 test cũ Phase 3-8 + 9 test mới `tests/unit/admin-expense-service.test.ts`): create ghi đúng record + audit `CREATE`; reject category không tồn tại (create lẫn update), không tạo record mồ côi; update ghi đúng before/after audit `UPDATE`, reject khi sửa record đã xoá; soft delete ẩn khỏi list mặc định nhưng vẫn còn trong DB, audit `DELETE`; restore xoá `deletedAt`, xuất hiện lại đúng ở list mặc định và biến mất khỏi view "đã xoá", audit `RESTORE`, reject restore trên record chưa xoá; **tạo `AdminExpense` 50.000.000 rồi so `getEmployeeFinancials()` của 1 nhân viên bất kỳ trước/sau — `totalCost`/`adsCost`/`pagePurchaseCost`/`salaryCost` giữ nguyên không đổi, xác nhận tường minh AdminExpense không lẫn vào Employee Cost (spec §8, §10.2/§10.3)**; filter đúng theo `month` và `createdByAdminId` (2 Admin khác nhau, đúng người đúng bản ghi).
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production) đều sạch — 23 route (`/admin/expenses` chuyển từ empty-state tĩnh sang dynamic thật).
- ✅ Kiểm thử UI qua trình duyệt thật (Playwright headless, cài tạm trong scratchpad như các phase trước, 14 assertion tự động): login Admin → `/admin/expenses` hiện đúng tiêu đề → Tạo chi phí #1 (2.000.000, tháng 3/2026) → hiện đúng trong list, số tiền format đúng VND → Tạo chi phí #2 (500.000, tháng 4/2026) → filter `?month=2026-03` chỉ còn chi phí #1, ẩn đúng chi phí #2 → Sửa chi phí #1 (đổi số tiền → 9.999.999) → cập nhật đúng ngay trong list → Xoá (soft delete) chi phí #2 → biến mất khỏi list đang hoạt động → bấm "Xem đã xoá" (`?deleted=1`) → chi phí #2 xuất hiện lại, dòng chỉ có nút "Khôi phục" (không có Sửa/Xoá, không có nút "Thêm chi phí" ở header) → Khôi phục → biến mất khỏi view "đã xoá" → quay lại "Xem đang hoạt động" → chi phí #2 xuất hiện lại đúng. Verify trực tiếp qua DB: audit trail đúng thứ tự `CREATE → CREATE → UPDATE → DELETE → RESTORE`. Đối chiếu screenshot với `.stitch/DESIGN.md`: Clean Table (header tint `surface-ice`, không viền dọc), số tiền JetBrains Mono căn phải, đúng token — không lệch. Đã dọn sạch toàn bộ dữ liệu test (2 admin expense + audit log liên quan) sau khi verify xong.
- ⚠️ Warning **có từ trước** (Phase 1, không phải lỗi Phase 9): cùng warning Base UI `nativeButton` đã ghi nhận từ Phase 3/4 — xuất hiện ở nút toggle "Xem đã xoá" (`<Button render={<Link .../>}>`), để dành rà soát chung ở Phase 17 Polish.

**Điểm dừng:** ✅ Đã implement + tự kiểm thử (unit test cho service layer, bao gồm verify tường minh tách biệt Employee Cost + browser thật full vòng đời Create/Edit/Delete/Restore + verify audit trail trực tiếp qua DB) — **user đã tự kiểm thử cục bộ và xác nhận hoàn thành** — sẵn sàng sang Phase 10.

---

## Phase 10: Admin Receipts ✅ (đã hoàn thành, đã kiểm thử)

**Ghi chú thực hiện (khác với mô tả gốc bên dưới):**
- **Không có Restore** cho `AdminReceipt` — khác `AdminExpense` (Phase 9), vốn có `restoreAdminExpense` như một bổ sung ngoài spec. Spec §20 chỉ liệt kê CRUD "Create/Edit/Soft delete" cho Admin Receipts, plan gốc mục "Việc cần làm" cũng chỉ nêu 3 action này — không mở rộng thêm Restore ở phase này để bám sát đúng scope đã duyệt.
- **Không có Search, không filter theo category** — Admin Receipt không có field category (khác Admin Expense có FK `category_id`). Filter chỉ gồm Month + "Admin đã nhập" (`AdminReceiptFilters`, component mới tách riêng khỏi `AdminExpenseFilters` vì bộ filter khác — không tái dùng để tránh field category thừa không áp dụng được).
- **`listAdminOptions()` tái dùng nguyên xi từ `admin-expense.service.ts`** (không tạo bản sao) — hàm này vốn đã tổng quát (mọi `User` `role=ADMIN`, không có logic riêng cho Admin Expense), dùng chung cho dropdown "Admin đã nhập" ở cả 2 màn hình đúng tinh thần CLAUDE.md tránh duplicate logic.
- **Comment tách biệt `Total Received`/`Total Page Revenue`** đặt ở đầu `receipt.service.ts` (spec §9/§10.4/§60) — service này không bao giờ join/sum với `prisma.revenue`; ghi rõ để Phase 11 (Admin Dashboard KPI) không vô tình gộp 2 số khi viết aggregation.
- **Component mới:** `components/tables/admin-receipt-filters.tsx`, `components/forms/create-admin-receipt-dialog.tsx`, `components/forms/edit-admin-receipt-dialog.tsx`, `components/forms/delete-admin-receipt-button.tsx` — cùng pattern Dialog + RHF + `useTransition` đã dùng từ Admin Expense (Phase 9), không có `Select` danh mục (receipt chỉ có field text `source`).
- **Route `/admin/receipts` và nav sidebar ("Tiền đã nhận") đã có sẵn từ Phase 1** (placeholder empty-state) — phase này chỉ thay nội dung `page.tsx` từ tĩnh sang dynamic thật, không cần đổi `nav-config.ts`.
- **Test:** `tests/unit/admin-receipt-service.test.ts` (7 test) — mirror cấu trúc `admin-expense-service.test.ts` (bỏ phần Restore, đổi category → source), cộng thêm 1 test riêng verify tường minh tách biệt `Total Received` vs `Total Page Revenue` cùng tháng (tạo Revenue 300.000.000 và AdminReceipt 250.000.000 cùng tháng 08/2026, so 2 tổng qua `prisma.revenue.aggregate`/`prisma.adminReceipt.aggregate`, xác nhận khác nhau và độc lập).

**Mục tiêu:** CRUD tiền Admin thực nhận — tách biệt hoàn toàn với Page Revenue.

**Việc cần làm:**
1. `server/services/receipt.service.ts`.
2. Create/Update/Soft delete AdminReceipt: receipt_date, amount, source, note.
3. `/admin/receipts`: List + Create + Edit + Soft delete + Filter (month/admin nhập) + Pagination.
4. Audit log CREATE/UPDATE/DELETE AdminReceipt.
5. Verify rõ trong code/comment (nếu cần) rằng `Total Received` **không** được tính lẫn với `Total Page Revenue` ở bất kỳ đâu (spec §9, §60).

**Màn hình Stitch dùng:** Không có sẵn — generate mới, tái dùng bố cục Clean Table.

**Test / chạy local:**
- Tạo nhiều Admin Receipt trong 1 tháng → `Total Received` (query thủ công/qua Prisma Studio) = tổng đúng, khác với tổng Page Revenue tháng đó (dữ liệu seed từ Phase 5 phải khác số để phân biệt rõ 2 số).

**Kết quả kiểm thử thực tế:**
- ✅ `npm run test` (vitest, DB dev thật) — **74/74 test pass** trên 15 file (67 test cũ Phase 3-9 + 7 test mới `tests/unit/admin-receipt-service.test.ts`): create ghi đúng record + audit `CREATE`; update ghi đúng before/after audit `UPDATE`, reject khi sửa record đã xoá; soft delete ẩn khỏi list mặc định nhưng vẫn còn trong DB, audit `DELETE`, reject xoá 2 lần; filter đúng theo `month` và `createdByAdminId` (2 Admin khác nhau); **tạo Revenue 300.000.000 (qua Page/Employee fixture) và AdminReceipt 250.000.000 cùng tháng 08/2026, verify tường minh 2 tổng độc lập và khác nhau qua Prisma aggregate trực tiếp trên `revenue`/`admin_receipts`** (spec §9, §10.4, §60).
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production) đều sạch — 23 route giữ nguyên (`/admin/receipts` chuyển từ empty-state tĩnh sang dynamic thật, không thêm route mới vì đã có sẵn từ Phase 1).
- ✅ Kiểm thử UI qua trình duyệt thật (Playwright headless, cài tạm trong scratchpad như các phase trước): login Admin → `/admin/receipts` → Tạo khoản nhận #1 (250.000.000, 05/03/2026, nguồn "Chuyển khoản đối tác A") → hiện đúng trong list, số tiền format đúng VND (`250.000.000 ₫`) → Tạo khoản nhận #2 (5.000.000, 01/04/2026, nguồn "Chuyển khoản đối tác B") → filter `?month=2026-03` chỉ còn khoản #1, ẩn đúng khoản #2 → Sửa khoản #1 (đổi số tiền → 999.999.999) → cập nhật đúng ngay trong list → Xoá (soft delete, qua `ConfirmDialog`) khoản #2 → biến mất khỏi list (verify qua screenshot trước/sau: trước xoá có 2 dòng, sau xoá chỉ còn 1 dòng đúng khoản #1) — không có nút "Khôi phục" nào xuất hiện (đúng scope, không có Restore ở phase này). Đối chiếu screenshot với `.stitch/DESIGN.md`: Clean Table (header tint `surface-ice`, không viền dọc), số tiền JetBrains Mono căn phải, Status/Button đúng token — không lệch. Đã dọn sạch toàn bộ dữ liệu test (2 admin receipt + audit log liên quan) qua script trực tiếp sau khi verify xong, `npm run test` chạy lại vẫn 74/74 pass.

**Điểm dừng:** ✅ Đã implement + tự kiểm thử (unit test cho service layer, bao gồm verify tường minh tách biệt Total Received vs Total Page Revenue + browser thật full vòng đời Create/Edit/Delete + verify screenshot trực tiếp) — **user đã tự kiểm thử cục bộ và xác nhận hoàn thành** — sẵn sàng sang Phase 11.

**Cập nhật bổ sung (2026-08-18, sau khi các phase khác đã hoàn thành) — thêm entity mới `EmployeeReceipt` ("Tiền nhân viên đã nhận"), theo yêu cầu user, xác nhận qua `AskUserQuestion`:**
- User: "thêm mục tiền nhân viên đã nhận, mỗi tháng chỉ có 1 khoản, không cộng vào table của nhân viên mà là một mục để xem thôi". 3 câu hỏi xác nhận: (1) 1 record/nhân viên/tháng (upsert-ghi-đè, giống Revenue/AdExpense) — không phải một số tổng hệ thống; (2) trang riêng dưới "Tài chính" liệt kê mọi nhân viên — không phải tab trong Employee Detail; (3) chỉ `amount`/`note`, không có "Người chi" tách riêng khỏi "Admin nhập" (khác mọi bảng chi phí/nhận tiền khác trong hệ thống — đơn giản hoá có chủ đích theo yêu cầu user).
- **Migration `20260818120000_add_employee_receipt`** — viết tay `migration.sql` (`CREATE TABLE employee_receipts` + partial unique index `employee_receipts_employee_month_unique` `(employee_id, receipt_month) WHERE deleted_at IS NULL` + FK) + `npx prisma db execute --file migration.sql` (chạy SQL thật trước) + `prisma migrate resolve --applied` — đúng quy trình 2 bước đã rút kinh nghiệm từ migration `page_type`.
- **Service layer mới `employee-receipt.service.ts`** — `listEmployeeReceipts`, `createEmployeeReceipt` (upsert theo `(employeeId, receiptMonth)`, mirror `createRevenue`), `updateEmployeeReceipt` (reject `MONTH_CONFLICT` nếu dời sang cặp đã có record active khác), `softDeleteEmployeeReceipt`. **Ràng buộc quan trọng nhất:** cố tình **không** import/join gì từ `employee.service.ts` hay `dashboard.service.ts` — đảm bảo không bao giờ vô tình cộng vào `getEmployeeFinancials`/Total Expenses/Profit, đúng yêu cầu "chỉ để xem". Validator `employee-receipt.schema.ts`, Server Actions `employee-receipt.actions.ts` (`createEmployeeReceiptAction`/`updateEmployeeReceiptAction`/`deleteEmployeeReceiptAction`, RBAC `requireAdmin()`).
- **UI mới:** route `/admin/employee-receipts` (bảng Nhân viên/Tháng/Số tiền/Admin nhập/Ghi chú/Thao tác + Pagination + URL sync); `CreateEmployeeReceiptDialog`/`EditEmployeeReceiptDialog` (chọn nhân viên qua `<Select>` — quy mô nhỏ ~8 nhân viên, không cần `Combobox` tìm kiếm như Page); `DeleteEmployeeReceiptButton` (soft delete qua `ConfirmDialog`); `EmployeeReceiptFilters` (Tháng + Nhân viên, cùng pattern `AdminExpenseFilters`, dùng `listEmployeeOptions()` — toàn bộ nhân viên kể cả đã nghỉ, để filter vẫn khớp dữ liệu lịch sử). Nav: thêm "Tiền nhân viên đã nhận" dưới nhóm "Tài chính" (`nav-config.ts`, icon `PiggyBank`). Audit label mới `EmployeeReceipt: "Tiền nhân viên đã nhận"` (`audit-labels.ts`).
- **Test:** file mới `tests/unit/employee-receipt-service.test.ts` (9 test) — create + audit CREATE; tạo lại cùng nhân viên+tháng ghi đè thay vì tạo dòng mới (`wasUpdate: true`, đúng 1 record trong DB); reject nhân viên không tồn tại, không tạo record mồ côi; **test riêng xác nhận tạo `EmployeeReceipt` không làm thay đổi bất kỳ field nào của `getEmployeeFinancials()` trước/sau** (đây là bài test quan trọng nhất, verify trực tiếp yêu cầu "không cộng vào table của nhân viên"); update ghi đúng before/after audit; reject dời sang `(employeeId, month)` đã có record active khác; soft delete ẩn khỏi list mặc định + audit DELETE; reject xoá 2 lần; filter đúng theo tháng và theo nhân viên. **128/128 test pass** (từ 119, +9). `tsc`/`lint`/`npm run build` đều sạch, route `/admin/employee-receipts` build ra `ƒ` (dynamic, bảo vệ tự động qua `requireAdmin()` ở `AdminLayout`).
- ⚠️ Không kiểm thử qua trình duyệt thật trong môi trường lần này (không có Playwright cài sẵn) — đã verify bằng unit/integration test trực tiếp trên DB dev thật (không mock) + `npm run build` sạch. Đề nghị user tự kiểm thử qua browser thật trước khi coi phần này "đã kiểm thử" đầy đủ như các phase khác.

---

## Phase 11: Admin Dashboard (KPI + Charts + Recent Activity) ✅ (đã hoàn thành, đã kiểm thử)

**Cập nhật bổ sung sau (2026-08-17):** thêm bảng "Chi phí theo người chi" (`getAdminSpendingBreakdown()`, theo tháng) dưới bảng "Danh sách nhân viên" — chi tiết đầy đủ ghi ở Phase 9 "Cập nhật bổ sung lớn".

**Cập nhật bổ sung sau (2026-08-17) — quy tắc màu tiền tệ toàn app, theo yêu cầu user: chi phí = đỏ, doanh thu/lợi nhuận = xanh.** DESIGN.md đã định nghĩa sẵn 2 token `success-green`/`error-red` (mục "Semantic Colors": "Success/Error colors strictly reserved for financial trends") nhưng trước đó chưa áp dụng cho số tiền trong KPI Card/bảng — mọi số tiền đều dùng màu trung tính `text-on-surface`. User yêu cầu áp dụng nhất quán: **chi phí** (Ads, Mua Page, Lương, Chi phí chung, Tổng chi phí, Tổng đã chi) → đỏ; **doanh thu/tiền nhận** (Doanh thu Page, Tổng tiền Admin đã nhận, Admin Receipt) → xanh; **lợi nhuận** → xanh nếu ≥0, đỏ nếu âm (theo dấu thực tế, không cố định).
- **`lib/money.ts`** — thêm `REVENUE_TEXT_CLASS`/`EXPENSE_TEXT_CLASS` (hằng số class Tailwind) + `profitTextClass(amount)` (trả về theo dấu).
- **`KpiCard`** (`components/dashboard/kpi-card.tsx`) — thêm prop `tone?: "revenue" | "expense" | "profit" | "neutral"` (mặc định `neutral`, giữ hành vi cũ nếu không truyền).
- Áp dụng `tone`/class màu cho **toàn bộ** nơi hiển thị tiền trong app — không chỉ Admin Dashboard: 6 KPI Card Admin Dashboard, bảng "Danh sách nhân viên" + "Chi phí theo người chi" (Phase 11), Employee List + Employee Detail (Summary/Costs/Revenue tab — Phase 3/7), trang Lương (Phase 3 bổ sung), Revenue/Ads/Admin Expenses/Admin Receipts list (Phase 5/6/9), Page List + Page Detail (Giá mua/Revenue tab/Ads tab — Phase 4), Settings — Tài khoản "Tổng đã chi" (Phase 9 bổ sung/13), và toàn bộ `/user/dashboard`, `/user/costs`, `/user/revenue`, `/user/profile` (Phase 7). 2 `SummaryStat`/`ProfileRow` local component (Employee Detail, Page Detail, User Profile) được thêm prop `tone?: string` tương ứng.
- Không đổi công thức/số liệu nào — chỉ thêm màu chữ dựa trên ý nghĩa đã có sẵn của từng cột/field, không có thay đổi schema hay service layer.
- Test: `tsc`/`lint`/`npm run test` (102/102, không cần test case mới vì thuần UI, không đổi logic) + `npm run build` sạch. Verify qua browser thật bằng cách đọc `getComputedStyle(...).color` trực tiếp (không chỉ nhìn screenshot, vì màu chữ nhỏ khó phân biệt qua ảnh nén) trên toàn bộ Admin Dashboard (6 KPI + 2 bảng), Employee List, Salary, Admin Expenses, Settings Users — xác nhận đúng `rgb(2,122,72)` (success-green) cho doanh thu/lợi nhuận dương và `rgb(217,45,32)` (error-red) cho chi phí/lợi nhuận âm ở mọi vị trí kiểm tra, không có console error.

**Ghi chú thực hiện (khác với mô tả gốc bên dưới):**
- **`server/services/dashboard.service.ts`** (mới) — 4 hàm trung tâm: `getSystemFinancials(monthKey)` (công thức spec §10.3–10.5, KPI Cards), `getSystemMonthlySeries(monthsBack=6)` (Monthly Chart, độc lập với filter tháng của KPI — luôn là 6 tháng gần nhất tính đến tháng hiện tại, cùng pattern trailing-window đã có ở `getEmployeeMonthlySeries` Phase 7), `getDashboardEmployeeRows(monthKey)` (Bảng nhân viên spec §11.3, tái dùng `getEmployeeFinancials` per-row qua `Promise.all` — cùng tradeoff "ưu tiên đơn giản" đã dùng ở `listEmployees`), `getRecentActivity(limit=10)` (spec §11.4).
- **Tổng lương hệ thống không lặp qua từng nhân viên** — `systemSalaryCostForMonth` quét thẳng toàn bộ `SalaryHistory` đang active vào ngày 1 của tháng (cùng convention "day-1 owner" đã dùng cho AdExpense/Employee Salary từ Phase 6/7) và cộng dồn trực tiếp, không cần group theo `employeeId` — vì tối đa 1 record active/nhân viên tại một thời điểm (constraint DB), nên tổng phẳng toàn bộ record active = đúng tổng hệ thống, không cần N query như Employee List.
- **Dashboard luôn có 1 tháng đang chọn, không có trạng thái "không lọc" (all-time)** — khác hẳn `MonthFilter` dùng ở Employee/Revenue/Ads List (bỏ trống = all-time). Diễn giải trực tiếp từ spec §11.1 "Mỗi KPI áp dụng theo bộ lọc tháng đang chọn" (ngụ ý luôn có 1 tháng "đang chọn"), khớp với mock UI Phase 1 vốn có nút "Tháng này" thay vì ô filter có thể xoá. Component mới `DashboardMonthPicker` (không tái dùng `MonthFilter` vì không có nút "Xoá lọc") — mặc định `currentMonthKey()` khi URL không có `?month=` hoặc giá trị không hợp lệ.
- **Component chart mới `SystemFinancialsChart`, không sửa `MonthlyRevenueChart` đã có** — phát hiện khi code rằng `MonthlyRevenueChart` (Phase 7) đã được Employee Detail và `/user/dashboard` dùng chung với shape 2-series cố định (`{month,revenue,expenses}`). Đổi shape của nó sang 4-series sẽ phá 2 trang đó (xác nhận qua `tsc --noEmit` báo lỗi type ngay khi thử), nên tạo component riêng cho Admin Dashboard thay vì sửa component dùng chung. `SystemFinancialsChart` hiện 4 series (Page Revenue/Admin Received/Total Expenses/Profit, đúng spec §11.2) với **legend dùng làm toggle** (click để ẩn/hiện từng series, mặc định ẩn Admin Received + Profit) — đáp ứng đúng nghĩa "Có thể hiển thị: ..." mà không cần thêm UI control riêng.
- **Recent Activity là union trực tiếp 6 nguồn bảng** (Revenue/AdExpense/Page/AdminExpense/AdminReceipt theo `createdAt DESC`, merge + sort lại trong code) **trừ "Page chuyển"** — riêng loại này đọc từ `AuditLog` (`entityType=Page, action=TRANSFER`) vì đây là tín hiệu duy nhất phân biệt sạch một lần transfer với lần gán nhân viên đầu tiên cho Page (không có field nào trên `PageAssignment` tự phân biệt 2 trường hợp này); tên Page/nhân viên mới được resolve qua 2 query batch nhỏ (`entityId`/`afterJson.employeeId`) sau khi lấy danh sách audit log.
- **`formatRelativeTime`** (mới, `lib/dates.ts`) — nhãn tương đối tiếng Việt ("5 phút trước", "Hôm qua"...), fallback `formatDate` sau 7 ngày.
- **Xoá hẳn `src/lib/mock-data.ts`** — đây là nơi tiêu thụ cuối cùng (`mockDashboardKpis`/`mockMonthlyChart`/`mockRecentActivity`/`mockEmployees`), không còn chỗ nào trong code tham chiếu tới sau khi wire xong (đã `grep` xác nhận trước khi xoá).
- **`KpiCard.value`** nới kiểu từ `number` sang `number | bigint` (giữ nguyên hành vi `formatVnd`, vốn đã hỗ trợ `bigint` từ đầu) — các trường tài chính trả về từ `dashboard.service.ts` đều là `bigint` (đúng CLAUDE.md "Tiền: BIGINT... không dùng floating point"), không ép về `number` ở tầng UI ngoại trừ khi truyền vào Recharts (chart cần `number`, chuyển đổi ngay tại `page.tsx` khi build `chartData`).

**Mục tiêu:** Trang tổng hợp toàn bộ dữ liệu đã có từ Phase 3–10 thành Dashboard Admin theo đúng công thức spec §10.

**Việc cần làm:**
1. `server/services/dashboard.service.ts` implement đúng công thức:
   - `Employee Revenue`, `Employee Cost = PagePurchase + Ads + Salary`.
   - `Total Expenses = PagePurchase + Ads + Salary + AdminExpenses`.
   - `Total Received = Σ AdminReceipts`.
   - `Profit = Total Received - Total Expenses`.
2. KPI Cards (6 số theo spec §11.1): Total Admin Received, Total Expenses, Total Profit, Total Salary, Total Ads, Total Page Revenue — filter theo tháng.
3. Monthly Revenue Chart (Recharts Line/Area, stroke 2px, fill gradient 5% opacity theo DESIGN.md) — toggle Page Revenue/Admin Received/Total Expenses/Profit.
4. Bảng nhân viên (columns theo spec §11.3, **không** hiển thị profit nhân viên) — click row → Employee Detail (Phase 7).
5. Recent Activity feed: Revenue mới, Ads mới, Page mới, Page chuyển User, Admin Expense mới, Admin Receipt mới (đọc từ AuditLog hoặc union query trực tiếp các bảng theo `created_at` DESC).
6. `/admin/dashboard` là route mặc định sau login Admin.

**Màn hình Stitch dùng:** "Bảng điều khiển Admin" (đã fetch code/image ở Phase 1, implement đầy đủ ở đây).

**Test / chạy local:**
- Với dữ liệu đã seed/tạo từ Phase 3–10, verify 6 KPI khớp tính tay theo công thức §10.
- Đổi filter tháng → toàn bộ KPI/chart/bảng nhân viên cập nhật đúng theo tháng đó.
- Unit test formula: `Profit = Total Received - Total Expenses` (spec §52 mục Unit Tests).

**Kết quả kiểm thử thực tế:**
- ✅ `npm run test` (vitest, DB dev thật) — **83/83 test pass** trên 16 file (74 test cũ Phase 3-10 + 9 test mới `tests/unit/dashboard-service.test.ts`). Vì `getSystemFinancials`/`getDashboardEmployeeRows` tổng hợp **toàn hệ thống** (khác các test trước đó vốn scope theo 1 `employeeId`/`adminId` nên miễn nhiễm với dữ liệu người khác), test dùng **pattern before/after delta** (chụp `getSystemFinancials(TEST_MONTH)` trước khi tạo fixture, tạo Revenue/AdExpense/PagePurchase(qua `createPage`)/AdminExpense/AdminReceipt/SalaryHistory cho 1 tháng cách hiện tại 20 tháng, rồi so **hiệu số** sau/trước) thay vì so tuyệt đối — không phụ thuộc vào dữ liệu có sẵn/dữ liệu thao tác tay khác đang tồn tại trong DB dev tại thời điểm chạy: `Total Expenses = PagePurchase + Ads + Salary + AdminExpenses` đúng hiệu số từng thành phần; `Total Received` độc lập hoàn toàn với `Total Page Revenue` (khác nhau, không lẫn); `Profit = Total Received - Total Expenses` đúng cả về hiệu số lẫn quan hệ nội tại (`after.profit === after.totalReceived - after.totalExpenses`); tháng liền trước `TEST_MONTH` không bị "rò" bất kỳ thành phần nào (Salary/PagePurchase/Revenue/Ads đều bắt đầu đúng ngày 1 `TEST_MONTH`, verify qua delta = 0 ở tháng trước đó). `getDashboardEmployeeRows` verify đúng dòng nhân viên theo tháng lọc, và sau khi `transferPage` sang nhân viên 2 thì `activePages` của nhân viên 1 về 0, nhân viên 2 lên 1 (đúng snapshot ownership, không lộn xộn). `getSystemMonthlySeries` trả đúng 6 tháng, tháng cuối khớp với gọi trực tiếp `getSystemFinancials(currentMonthKey())`. `getRecentActivity` verify đủ 6 loại sự kiện (Revenue/Ads/Page mới/Page chuyển/AdminExpense/AdminReceipt mới) xuất hiện đúng nội dung (tên Page, tên nhân viên, số tiền format VND) và mảng kết quả sắp xếp giảm dần theo thời gian; `limit` hoạt động đúng.
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production) đều sạch — 23 route giữ nguyên (`/admin/dashboard` chuyển từ mock data Phase 1 sang dynamic thật).
- ✅ Kiểm thử qua HTTP trực tiếp trên dev server thật (không có sẵn browser/Playwright trong môi trường này ở lượt chạy này — mint session JWT trực tiếp bằng `signSession` (tái dùng `src/server/auth/jwt.ts`, cùng secret `AUTH_SECRET`) qua script tạm `tmp-mint-session.ts`, set cookie `session=...` rồi gọi `curl` như trình duyệt thật, đã xoá script tạm sau khi xong): `GET /admin/dashboard` với session Admin thật → `200`, HTML đầy đủ (không "Application error", không `NaN`); parse RSC flight payload trong response xác nhận **dữ liệu thật khớp công thức nội tại ngay trên dev DB đang có** — `Tổng chi phí = 1.000.000 ₫`, `Tổng lợi nhuận = -1.000.000 ₫` (đúng `0 (Received) - 1.000.000 (Expenses)`, số âm format đúng dấu trừ trước `₫`, không lỗi); `Tổng lương/Tổng Ads/Tổng doanh thu Page = 0 ₫` (không có transaction nào trong tháng hiện tại ở dev DB, đúng thực tế vì các phase trước đã dọn sạch dữ liệu test sau khi verify); "Tổng tiền Admin đã nhận" hiện đúng hint phụ `"Từ 0 ₫ Doanh thu Page"`; cả 9 cột bảng nhân viên (Tên/Email/Số Page/Doanh thu kỳ/Ads/Mua Page/Lương/Tổng chi phí/Trạng thái) render đúng thứ tự, empty state **không** hiện (dev DB đang có nhân viên thật từ phase trước) — đúng nhánh có dữ liệu.
- ✅ **User đã tự kiểm thử cục bộ trên trình duyệt thật** theo hướng dẫn (login Admin seed, đổi tháng qua `DashboardMonthPicker`, toggle legend trên `SystemFinancialsChart`, tạo dữ liệu mẫu Employee/Page/Revenue/Ads/AdminExpense/AdminReceipt để verify KPI/bảng nhân viên/Recent Activity cập nhật đúng) — khép lại hạn chế đã ghi ở lượt tự kiểm thử trước đó (môi trường agent không có sẵn browser để tự bấm thử 2 tương tác client-side này).

**Điểm dừng:** ✅ Đã implement + kiểm thử đầy đủ (unit test formula hệ thống theo pattern before/after delta + HTTP thật với dev DB thật + **user đã tự kiểm thử cục bộ trên trình duyệt và xác nhận hoàn thành**, bao gồm cả phần tương tác client-side) — sẵn sàng sang Phase 12.

**Cập nhật bổ sung (2026-08-18, rất lâu sau khi các phase khác đã hoàn thành) — thêm card "Tổng chi phí mua Page" rồi thay 3 card lẻ (Lương/Ads/Mua Page) bằng donut chart "Cơ cấu chi phí", theo 2 yêu cầu liên tiếp của user:**
- **Yêu cầu 1** ("còn 1000000 chi phí là ở đâu"): user phát hiện `Tổng chi phí` không khớp tổng các card lẻ đang hiện — nguyên nhân là `pagePurchaseCost`/`adminExpenseCost` (2 trong 4 thành phần công thức mục 10.3) chưa có card riêng. Đã điều tra bằng script tạm truy vấn trực tiếp DB dev (`PagePurchaseExpense`/`AdminExpense` tháng đó) xác nhận đúng khoản 1.000.000 ₫ là mua Page "Haha" — thêm card `financials.pagePurchaseCost` ("Tổng chi phí mua Page") vào `kpis`.
- **Yêu cầu 2** ("hiển thị biểu đồ tròn ... hiển thị sao cho nó là tập con của tổng chi phí"): thay hẳn 3 card lẻ (Lương/Ads/Mua Page) bằng 1 donut chart mới `ExpenseBreakdownChart` (`src/components/dashboard/expense-breakdown-chart.tsx`) — Recharts `PieChart`/`Pie` với `innerRadius`, tổng ở giữa vòng tròn = đúng `Tổng chi phí` (bao gồm cả "Khác"/Tài nguyên khi > 0, tránh lặp lại đúng lỗi "1.000.000 ở đâu" vừa sửa nếu chỉ vẽ 3/4 thành phần). **Trước khi code**, đã dùng skill `dataviz` (bắt buộc theo system prompt trước khi tạo bất kỳ chart nào): chọn form "part-to-whole, ≤6 lát" → donut hợp lệ theo `anti-patterns.md` dù không phải mặc định khuyến nghị (stacked bar) — vì user yêu cầu tường minh "biểu đồ tròn" 2 lần; chạy `scripts/validate_palette.js` với nhiều tổ hợp token DESIGN.md có sẵn cho tới khi tìm được bộ 3 màu pass cả 5 kiểm tra CVD/contrast ở chế độ `--pairs all` (donut là dạng all-pairs, mọi lát đều có thể cạnh nhau) — chốt `Finance Blue`/`Warning Orange`/`Amber` (`#0061ff,#c2410c,#ca8a04`), cố tình loại Success Green/Error Red dù cũng pass vì 2 màu đó đã mang nghĩa cố định doanh thu/chi phí toàn app (`lib/money.ts`), dùng lại ở đây sẽ gây hiểu nhầm "dấu +/-" thay vì "loại chi phí nào". Ghi lại tổ hợp màu này vào `.stitch/DESIGN.md` ("Categorical Chart Triplet") để tái dùng, không tự chọn lại từ đầu cho biểu đồ phân loại tiếp theo.
- Không đổi schema/service — `getSystemFinancials()` đã trả đủ 4 field (`adsCost`/`salaryCost`/`pagePurchaseCost`/`adminExpenseCost`) từ Phase 11 gốc, chỉ là chưa từng hiển thị hết. Test: không cần test mới (thuần UI/component hiển thị, không có business logic/service nào thay đổi) — `tsc`/`lint`/`npm run test` (128/128, không đổi số lượng)/`npm run build` đều sạch.
- Loạt sửa nhỏ tiếp theo cùng ngày cho donut `ExpenseBreakdownChart` — tất cả chỉ UI/component, không service/schema: card chiếm nửa width (`lg:w-1/2`) rồi đổi hẳn thành layout 1 hàng `lg:grid-cols-3` (KPI xếp dọc `lg:col-span-2` bên trái, donut 1/3 bên phải, theo yêu cầu tiếp theo của user); legend co từ `w-full` (giãn hết card, đẩy số tiền ra sát mép) xuống `md:w-72` (khớp nội dung); slice separator đổi 2 lần — `paddingAngle` (độ) → `stroke` pixel trắng → bỏ hẳn cả hai, vì ở tỷ lệ quá lệch (Ads 0.2% ≈ dưới 1° cung) bất kỳ separator nào (độ hay pixel) đều rộng hơn chính slice và xoá mất nó — bài học: separator cho pie/donut phải tính theo slice nhỏ nhất, không phải theo "trông đẹp" ở slice to; Tooltip đổi nền tối → nền trắng viền đen bo góc (+ `isAnimationActive={false}` vì hiệu ứng fade-in mặc định của Recharts làm nền trông "trong suốt" ngay lúc chụp màn hình); màu "Khác/Tài nguyên" đổi từ xám trung tính sang xanh lá theo yêu cầu tường minh của user — ghi đè lý do tránh xanh lá đã nêu ở bản gốc component (xanh lá đã mang nghĩa "doanh thu" toàn app), re-validate CVD lại với cả 4 màu trước khi áp dụng; nhãn 2 slice rút gọn "Chi phí mua Page"→"Page", "Khác (Tài nguyên)"→"Tài nguyên"; card "Tổng chi phí" (KPI phẳng) bị xoá hẳn vì trùng với số đã hiện giữa donut.
- **Tách "Lịch sử thao tác" thành route riêng** (theo yêu cầu user "tách riêng thành 1 tab ở dưới bảng điều khiển"): route mới `/admin/activity` (`src/app/admin/activity/page.tsx`), nav sidebar thêm mục ngay dưới "Bảng điều khiển" (icon `Activity`, mới import vào `nav-config.ts`). Dùng lại nguyên `getRecentActivity()`/`RecentActivity` component đã có từ Phase 11 gốc — chỉ tăng `limit` 10→30. `/admin/dashboard` bỏ hẳn card này + fetch tương ứng, biểu đồ "Doanh thu & Chi phí" giờ full width một mình. Không đổi schema/service. `tsc`/`lint`/`npm run test` (128/128)/`npm run build` đều sạch — route `/admin/activity` mới xuất hiện trong danh sách build (27 route, từ 26).
- **Layout Dashboard đổi tiếp 2 lần cùng ngày theo yêu cầu user:** (1) "Biểu đồ Doanh thu & Chi phí" chuyển vào cùng hàng với "Cơ cấu chi phí" (`lg:col-span-2` + `lg:col-span-1`, giống layout cũ từng dùng cho biểu đồ + Lịch sử thao tác trước khi tách phase trên), 3 KPI Card quay lại xếp ngang (`grid-cols-3`) thay vì xếp dọc. (2) Ngay sau đó: **bỏ hẳn month-picker** (theo yêu cầu "bỏ setting theo dõi từng tháng đi, luôn theo dõi all") — đảo lại toàn bộ tính năng "chế độ all-time cho Dashboard" thêm ngày 2026-08-18 (mục Changelog liền trên trong `context/spec.md` §11.1), giờ **chỉ còn all-time**, không còn cách nào chọn theo tháng nữa. `AdminDashboardPage` bỏ hẳn `searchParams`, gọi `getSystemFinancials()`/`getAdminSpendingBreakdown()` không tham số; xoá hẳn file `dashboard-month-picker.tsx` (không còn nơi nào import). Tiêu đề trang cố định `"Kỳ báo cáo Tất cả thời gian"`. Không đổi service — `getSystemFinancials(monthKey?)` vẫn nhận `monthKey` optional, chỉ không còn ai truyền nó từ UI Dashboard chính (biểu đồ 6-tháng `getSystemMonthlySeries` vẫn tự gọi nội bộ theo từng tháng). `tsc`/`lint`/`npm run test` (128/128)/`npm run build` đều sạch.

---

## Phase 12: Audit Log ✅ (đã hoàn thành, đã kiểm thử)

**Ghi chú thực hiện (khác với mô tả gốc bên dưới):**
- **`src/lib/audit-labels.ts`** (mới) — nhãn tiếng Việt + tone màu cho `action`/`entity_type` free-form string (spec §29 "Cập nhật... action là free-form string"). Map chỉ liệt kê các giá trị đã biết (`CREATE/UPDATE/DELETE/RESTORE/TRANSFER/ASSIGN/CHANGE_SALARY/DEACTIVATE/LOGIN/LOGOUT` và 10 `entity_type` đã xuất hiện từ Phase 2–11), fallback về đúng chuỗi gốc nếu gặp giá trị lạ (không rơi mất dữ liệu khi Phase 13+ thêm action mới như "User role/status changes").
- **`listAuditFilterOptions()`** (`audit.service.ts`) build danh sách filter (entity_type/action/actor) bằng `findMany({distinct: [...]})` **đọc trực tiếp từ dữ liệu thật** thay vì hardcode enum — filter dropdown tự động khớp với action/entity_type đang thực sự tồn tại trong DB, không cần sửa code khi Phase 13/14 (User role change, MCP client create/revoke) thêm action mới.
- **`entityId` filter dùng exact match (`equals`), không phải `contains`/`ILIKE`** — `entity_id` là cột `@db.Uuid` trong Postgres (schema.md), không phải text; ILIKE trên cột UUID không đảm bảo hoạt động đúng qua Prisma. Ô tìm kiếm trong UI dùng lại `SearchInput` có sẵn (đổi `paramKey="entityId"`), phù hợp use case chính là dán nguyên `entity_id` để tra cứu 1 record cụ thể.
- **Date range filter (`dateFrom`/`dateTo`, input `type=date`) là filter mới** — chưa có pattern sẵn trong `finance-filters.tsx`/`admin-expense-filters.tsx` (các phase trước chỉ lọc theo 1 tháng). Áp dụng đúng convention "UTC day boundary" đã dùng ở `admin-expense.service.ts` (`monthRange`) — `dateTo` tự dịch thành mốc đầu ngày hôm sau (`lt`, exclusive) để bao trọn cả ngày `dateTo`.
- **`AuditActionChip`/`AuditActorTypeChip`** (`components/tables/audit-badges.tsx`) — component riêng, **không** tái dùng `StatusChip` (`status-chip.tsx`) dù cùng ngôn ngữ hình ảnh ("Status Chips" DESIGN.md): `StatusChip` biểu diễn trạng thái business (ACTIVE/INACTIVE/ARCHIVED/REVOKED), còn action/actor_type là 2 chiều dữ liệu khác (động từ + loại actor) — trộn chung vào 1 map rủi ro nhầm lẫn khi maintain về sau. `AuditActorTypeChip` cho `MCP` dùng thẳng token `text-finance-blue`/`bg-surface-ice` (không qua hệ tone chung) để bám đúng DESIGN.md "Finance Blue... interactive data points", đánh dấu rõ hành động của AI ngay cả khi Phase 15+ chưa có dữ liệu MCP thật (plan note #4).
- **Xem chi tiết dùng `Dialog` có sẵn (`components/ui/dialog.tsx`), không dùng `Sheet`** — dù `sheet.tsx` đã tồn tại sẵn trong `components/ui/` từ scaffold, toàn bộ "view detail" hiện có trong app (Edit dialogs) đều dùng `Dialog`; Sheet là component **chưa từng được dùng ở đâu**, giữ nhất quán pattern đã kiểm chứng thay vì giới thiệu primitive mới cho 1 phase đọc dữ liệu.
- **`AuditDiffTable`** (trong `audit-detail-dialog.tsx`) — bảng diff before/after generic (flatten mọi field của `before_json`/`after_json` thành chuỗi, key nào chỉ có ở 1 bên thì hiện `—`), tô xanh (`text-success-green`) cho field thật sự đổi giá trị. Xử lý riêng 2 case biên để tránh gây hiểu lầm: `CREATE` (`before_json = null`) không tô đỏ/gạch ngang cột "Trước" dù field đó "thiếu" — vì đây là record mới sinh ra chứ không phải bị xoá; tương tự `DELETE` (`after_json = null`) không tô cột "Sau".
- **`formatDateTime`** (mới, `lib/dates.ts`) — nối `formatDate` có sẵn với `Intl.DateTimeFormat` `hour/minute` riêng (`hour12: false`, timezone `Asia/Ho_Chi_Minh`) thành `"dd/mm/yyyy HH:mm"`, đúng định dạng ví dụ spec §29 ("Time: 2026-08-16 15:32") nhưng theo convention `dd/mm/yyyy` toàn app (khác `formatDate` hiện có, vốn không có giờ).

**Mục tiêu:** UI xem/search Audit Log — việc *ghi* log đã làm xong ở từng phase trước, phase này chỉ build phần đọc + verify.

**Việc cần làm:**
1. `server/services/audit.service.ts` (read-only) — filter theo entity_type, action, actor, date range.
2. `/admin/settings/audit`: List + Filter + Pagination (append-only, không có action edit/delete trên UI).
3. Verify ngược lại toàn bộ action quan trọng từ Phase 2–11 đã có audit log đúng format (spec §29 mẫu Before/After).
4. Hiển thị rõ `actor_type` (USER/MCP) — dù MCP actions chưa có đến Phase 15, UI đã sẵn sàng hiển thị đúng khi có.

**Màn hình Stitch dùng:** Không có sẵn — generate mới (table đơn giản, filter bar, giống Clean Table nhưng read-only).

**Test / chạy local:**
- Thực hiện lại vài action (sửa Revenue, transfer Page) → verify xuất hiện đúng trong `/admin/settings/audit` với before/after json đúng.
- Search theo entity_type=`REVENUE`, action=`UPDATE` → lọc đúng.

**Kết quả kiểm thử thực tế:**
- ✅ `npm run test` (vitest, DB dev thật) — **90/90 test pass** trên 17 file (83 test cũ Phase 2–11 + 7 test mới `tests/unit/audit-service.test.ts`): filter `entityType=Page` + `actorUserId` tìm đúng 2 entry `CREATE`/`TRANSFER` của 1 Page fixture; entry `TRANSFER` có `beforeJson.employeeId`/`afterJson.employeeId` đúng snapshot nhân viên cũ/mới (đúng ví dụ format spec §29); filter `entityType=Employee` tìm đúng 2 entry `CREATE` của 2 employee fixture; `entityId` là exact match — UUID không liên quan trả về rỗng; date range loại đúng record ngoài `[dateFrom, dateTo]` và giữ đúng record trong khoảng (test cả `dateTo` = hôm qua → rỗng, `dateFrom` = ngày mai → rỗng); sắp xếp mới nhất trước (`TRANSFER` sau `CREATE` theo thời gian thực thi); `listAuditFilterOptions()` trả đúng `entityTypes`/`actions`/`actors` khớp dữ liệu vừa tạo.
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production) đều sạch — 23 route giữ nguyên, `/admin/settings/audit` chuyển từ empty-state tĩnh (Phase 1) sang dynamic thật.
- ✅ **Kiểm thử qua trình duyệt thật** (Playwright headless cài tạm `npm install --no-save`, gỡ lại bằng `npm install` sau khi xong — xác nhận `package.json`/`package-lock.json` không đổi so với trước khi cài): login Admin seed → `/admin/settings/audit` render đúng 2886 bản ghi thật đã tích luỹ từ Phase 2–11 (không cần seed thêm, xác nhận gián tiếp yêu cầu "Việc cần làm #3" — dữ liệu ghi từ các phase trước đã có mặt đầy đủ và đúng định dạng để đọc lại được); filter `entityType=Page` → mọi dòng hiển thị đúng cột "Đối tượng" = "Trang"; filter `action=CREATE` → mọi dòng hiển thị đúng chip "Tạo mới"; kết hợp `entityType=Page&action=TRANSFER` → đúng các lần chuyển giao Page, mở dialog chi tiết 1 dòng thấy bảng diff `assignmentId`/`employeeId` (đổi, tô xanh) và `effectiveDate` (chỉ có ở "Sau", đúng field mới phát sinh lúc transfer chứ không phải bị xoá); filter theo actor qua dropdown (chọn "Admin 1") → URL sync đúng `actorUserId=...`; search `entityId` đúng bằng ID copy từ 1 dòng → chỉ trả lại đúng dòng đó; date range `dateFrom` ở tương lai xa → đúng empty state "Không tìm thấy nhật ký phù hợp"; đổi số dòng/trang (20→50) qua `Pagination` → URL sync `pageSize=50`, hiển thị đúng 50 dòng; điều hướng `page=1`/`page=2` (URL trực tiếp) → tổng `2886`, 2 trang không trùng bản ghi nào. Không có console error nào trong suốt phiên test.
- ⚠️ **Phát hiện khi test, xác nhận là hành vi đúng chứ không phải bug:** một số dòng cũ hiển thị "Người thực hiện" = "—" dù `actor_type = USER` — do `actor_user_id` trỏ tới 1 tài khoản Admin test đã bị xoá thật (hard-delete) bởi script dọn dữ liệu test thủ công ở phase trước (schema.md dòng 362, không thuộc phạm vi Phase 12). `AuditLog` không cascade khi User bị xoá (đúng thiết kế append-only) nên record audit vẫn còn nhưng "mồ côi" — `actorName ?? "—"` trong `audit.service.ts`/`audit-detail-dialog.tsx` đã xử lý đúng fallback này, không crash, không hiện `null`/`undefined` ra UI.

**Điểm dừng:** ✅ Đã implement + tự kiểm thử đầy đủ (unit test service layer + browser thật trên dữ liệu thật tích luỹ từ Phase 2–11) — dừng lại xin xác nhận từ user trước khi sang Phase 13.

---

## Phase 13: Settings — User Accounts ✅ (đã hoàn thành, đã kiểm thử)

**Cập nhật bổ sung sau (2026-08-17):** thêm cột "Tổng đã chi" (all-time, chỉ hiện cho role=ADMIN) vào `/admin/settings/users` — chi tiết đầy đủ ghi ở Phase 9 "Cập nhật bổ sung lớn".

**Xác nhận từ user trước khi code (2026-08-17):**
- Ràng buộc "giữ ít nhất 1 Admin `ACTIVE`" → **áp dụng** (không bỏ).
- "Create Admin" qua UI → **không cần**, giữ đúng scope gốc (chỉ 2 Admin seed từ Phase 2).

**Ghi chú thực hiện (khác với mô tả gốc bên dưới):**
- **Scope chỉ đổi status, không có "đổi role" trên UI** — mục 2 "Việc cần làm" gốc chỉ liệt kê toggle `ACTIVE`/`INACTIVE`, không có action đổi `ADMIN`↔`USER` (đổi role có nhiều hệ luỵ — mồ côi `EmployeeProfile`, v.v. — ngoài phạm vi phase này, nhất quán với quyết định "không Create Admin qua UI").
- **`server/services/user-account.service.ts`** (mới) — `listUserAccounts()` (search theo tên/email ILIKE + filter `role` + pagination 20/50/100, liệt kê cả `ADMIN` lẫn `USER`) và `setUserAccountStatus()` — toggle **2 chiều** (`ACTIVE`↔`INACTIVE`, khác `deactivateEmployee` ở Phase 3 vốn chỉ 1 chiều) dùng chung cho mọi `User` bất kể role. Guard "còn ít nhất 1 Admin active" chỉ áp dụng khi `role=ADMIN` và đích đến là `INACTIVE` (đếm `count({role:"ADMIN", status:"ACTIVE"})`, chặn nếu `<= 1`); reactivate luôn được phép. Idempotent (set trùng status hiện tại → no-op, không ghi audit trùng), đúng pattern `deactivateEmployee`.
- **Audit action mới `ACTIVATE`** (bên cạnh `DEACTIVATE` đã có từ Phase 3) — thêm label/tone vào `lib/audit-labels.ts` (`ACTIVATE: "Kích hoạt"`, tone `success`); `entityType="User"` đã có sẵn mapping "Tài khoản" từ trước (chờ đúng phase này dùng tới).
- **`server/actions/user-account.actions.ts`** — `setUserAccountStatusAction(userId, nextStatus)`, không có Zod schema riêng (status là literal do UI quyết định theo nút bấm, không phải free-text form input — cùng lý do `deactivateEmployeeAction` ở Phase 3 cũng không có Zod).
- **Component mới:** `components/forms/user-status-toggle.tsx` (2 nhánh dùng chung `ConfirmDialog` đã có từ Phase 3 — nhánh `ACTIVE→INACTIVE` màu destructive, nhánh `INACTIVE→ACTIVE` không destructive), `components/tables/role-filter.tsx` (Select lọc `role`, URL-sync, cùng pattern `AuditFilters`), `components/tables/role-chip.tsx` (cùng ngôn ngữ hình ảnh `StatusChip`/`AuditActionChip`, khoá màu theo `Role` thay vì status).
- **`/admin/settings/users`** thay hẳn placeholder `EmptyState` cũ bằng list thật: Tên/Email/Vai trò (RoleChip)/Trạng thái (StatusChip)/Ngày tạo/Thao tác, có Search + Role filter + Pagination (cross-cutting theo "Ghi chú chung" — dù quy mô nhỏ ~10 tài khoản, vẫn làm nhất quán với mọi list khác).

**Mục tiêu:** Admin quản lý tài khoản (cả Admin lẫn User) ở mức account — role/status — tách khỏi Employee Management (Phase 3, vốn quản lý phần nghiệp vụ nhân viên).

**Việc cần làm:**
1. `/admin/settings/users`: List toàn bộ `User` (cả role `ADMIN` và `USER`), hiển thị role, status, created_at.
2. Đổi status `ACTIVE`/`INACTIVE` (dùng chung logic deactivate với Phase 3 cho role=USER; với role=ADMIN chỉ cho phép nếu còn ít nhất 1 Admin active — ràng buộc nghiệp vụ hợp lý, không có trong spec nhưng cần thiết để tránh khoá hệ thống — **hỏi lại user nếu muốn bỏ ràng buộc này**).
3. Audit log `User role/status changes` (spec §29).
4. Không có "Create Admin" qua UI trong V1 nếu spec không yêu cầu rõ — 2 Admin seed sẵn ở Phase 2 là đủ theo quy mô hiện tại; nếu cần tạo thêm Admin qua UI thì hỏi lại trước khi thêm (ngoài phạm vi acceptance criteria hiện có).

**Màn hình Stitch dùng:** Không có sẵn — generate mới, tái dùng bố cục List từ "Quản lý Nhân sự".

**Test / chạy local:**
- Đổi status 1 User → verify không login được (Phase 2 guard).
- Thử deactivate Admin cuối cùng còn active → bị chặn với thông báo rõ (nếu áp dụng ràng buộc trên).

**Kết quả kiểm thử thực tế:**
- ✅ `npm run test` (vitest, DB dev thật) — 96/96 pass toàn repo (19 file, +1 file mới `tests/unit/user-account-service.test.ts`, 5 test case): `listUserAccounts` trả cả 2 role, filter đúng theo `role`, search đúng theo tên/email; `setUserAccountStatus` toggle 2 chiều cho `USER` + ghi đúng audit `DEACTIVATE`/`ACTIVATE`, idempotent (gọi trùng status không nhân đôi audit); reject `NOT_FOUND` khi userId không tồn tại; **guard "Admin cuối cùng"** — test cô lập bằng cách tạm chuyển toàn bộ Admin `ACTIVE` khác (kể cả 2 Admin seed thật) sang `INACTIVE` trong khối `try/finally` để guarantee global count xác định, verify bị chặn đúng khi chỉ còn 1 Admin active, verify cho phép ngay khi có Admin active thứ 2, khôi phục nguyên trạng seed admin trong `finally` bất kể pass/fail (đã xác nhận sau test 2 Admin seed vẫn `ACTIVE` bằng test sanity riêng, xoá ngay sau khi verify).
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production) đều sạch — route `/admin/settings/users` chuyển từ static (placeholder) sang dynamic (`ƒ`).
- ✅ Kiểm thử UI qua trình duyệt thật (Playwright headless, không có `chromium-cli` trong môi trường này nên gọi thẳng package `playwright` đã cache sẵn qua `npx`): login Admin → `/admin/settings/users` hiện đúng 2 Admin seed + 1 User test fixture tạo riêng cho lần kiểm thử (Tên/Email/RoleChip/StatusChip/Ngày tạo đúng token màu DESIGN.md) → search "admin1" → URL sync `?q=admin1&page=1`, còn đúng 1 dòng → Role filter "Admin" → URL sync `?role=ADMIN&page=1`, còn đúng 2 dòng → Vô hiệu hoá User test fixture → dialog xác nhận, sau khi confirm status đổi "NGỪNG HOẠT ĐỘNG", nút đổi thành "Kích hoạt" → Kích hoạt lại → về "HOẠT ĐỘNG" → Vô hiệu hoá Admin 2 (còn Admin 1 active) → thành công → thử Vô hiệu hoá Admin 1 (lúc này là Admin active cuối cùng) → **bị chặn**, dialog hiện đúng thông báo "Không thể vô hiệu hoá — đây là Admin đang hoạt động cuối cùng của hệ thống." → Kích hoạt lại Admin 2 → khôi phục nguyên trạng. Không có console error trong suốt luồng.
- ⚠️ Phát hiện & tự dọn dẹp trong lúc test (không phải bug Phase 13): DB dev thật có sẵn dữ liệu rác từ trước (2 User `role=ADMIN` + 1 `role=USER` mồ côi, tiền tố `test-admin-...@example.test`/`test-employee-...@example.test`, do một lần chạy `admin-expense-service.test.ts` trước đó không hoàn tất `afterAll`) — dữ liệu rác này làm sai lệch kết quả kiểm thử guard "Admin cuối cùng" ở lần chạy đầu (vô tình khiến Admin 1 thật bị deactivate vì hệ thống vẫn còn 2 "Admin" rác active khác). Đã dọn sạch dữ liệu rác, khôi phục Admin 1/Admin 2 thật về `ACTIVE`, chạy lại `npm run test` xác nhận 96/96 vẫn pass và không phát sinh rác mới — cùng hiện tượng đã ghi nhận ở Phase 3 ("dữ liệu rác từ lần chạy test hỏng").

**Điểm dừng:** ✅ Đã implement + tự kiểm thử (unit/integration test + browser thật) — dừng lại xin xác nhận từ user trước khi sang Phase 14.

---

## Phase 13.1: Tinh chỉnh UX/UI & sửa lỗi nghiệp vụ theo phản hồi user ✅ (đã hoàn thành, đã kiểm thử — session 2026-08-18)

Không phải một feature phase theo kế hoạch gốc — đây là một phiên làm việc dài xử lý một chuỗi phản hồi/bug report của user trên các phase đã xong (3, 4, 5, 7, 10, 11), gộp lại thành một mục để không phá vỡ đánh số phase MCP (14–16) phía dưới. Chi tiết đầy đủ từng thay đổi đã ghi trực tiếp trong `context/schema.md` (Changelog) và `context/spec.md` (các đoạn "Cập nhật ngày 2026-08-18..."); dưới đây chỉ tóm tắt.

**Page & Trạng thái Page (Phase 4):**
- `Page.status` đổi từ enum cố định → free-text + màu → picklist `PageStatusOption` quản lý tập trung (Cài đặt → "Loại trạng thái Page") → chọn **nhiều trạng thái cùng lúc** (bảng nối `PageStatusAssignment`). Thêm 3 màu preset mới (Cam/Tím/Hồng), chỉnh màu Vàng, chip bold + không viết hoa.
- Thêm cột Link (mở tab mới) riêng ở bảng Pages.
- `/user/pages`: đổi từ bảng lịch sử phụ trách sang bảng hiện-tại giống `/admin/pages`, User tự sửa được **Trạng thái** (RBAC chặn ở service — chỉ Page đang quản lý).

**Lương (Phase 3):**
- Lương đổi mid-tháng tính ngay vào tháng đó (không đợi tháng sau); sửa bug cộng dồn khi đổi lương 2 lần/tháng (chỉ lấy mức mới nhất).
- Bỏ hẳn field/cột "Hiệu lực từ" — luôn là ngày hôm nay, sửa luôn constraint chặn sửa 2 lần/ngày.
- Employee Detail: gộp Ads + Mua Page + Lương thành 1 bảng "Chi tiết chi phí" duy nhất, sort theo thời gian. `/user/costs` thêm nguyên bảng này (trước đó chỉ có KPI Card, không có bảng nào).

**Doanh thu & Ads (Phase 5/6):**
- Revenue đổi từ ghi theo ngày → theo tháng (giống Ads), 1 dòng/Page/tháng, nhập lại sẽ ghi đè.
- `/user/revenue` thêm Search (giữ nguyên read-only, không thêm Sửa/Xoá).
- Dialog Create/Edit Ads + Revenue: popup rộng hơn (`sm:max-w-lg`) + field Page đổi từ dropdown thường sang ô search — component mới `components/ui/combobox.tsx` (wrap Base UI `Combobox`, tra cứu qua Context7 trước khi dùng).

**Admin Receipt (Phase 10):**
- Thêm `received_by_admin_id` (chọn Admin nào thực nhận, khác Admin nhập liệu) — mirror `paid_by_admin_id`.
- Đổi từ ghi theo ngày → theo tháng (không giới hạn số dòng/tháng, khác Revenue/Ads).

**Admin Dashboard (Phase 11):**
- Bỏ hẳn bảng "Danh sách nhân viên" khỏi Dashboard (trùng lặp với Employee List riêng).
- Bảng "Chi phí theo người chi" → đổi tên "Chi phí & Tiền đã nhận theo Admin": thêm cột Tiền đã nhận, bỏ breakdown Ads/Mua Page/Tài nguyên, thay bằng cột Lợi nhuận.
- **Bug fix quan trọng:** Salary do Admin trả (`paid_by_admin_id`) trước đó không được cộng vào "Tổng đã chi" của Admin đó — đã sửa, tôn trọng đúng 2 chế độ tính lương (theo tháng cụ thể / all-time luỹ kế).
- Thêm chế độ xem **"Tất cả thời gian"** (toggle cạnh bộ lọc tháng) cho toàn bộ KPI Card + bảng liên quan — trước đó Dashboard chỉ xem được theo từng tháng.

**UI chung:**
- Placeholder trong mọi ô input/select đổi màu nhạt hơn (`text-outline` thay `text-muted-foreground`).
- Đổi tên hiển thị "Chi phí chung" (AdminExpense) → "Tài nguyên" xuyên suốt UI (không đổi entity/route).

**Kết quả kiểm thử:** `tsc`/`lint`/`npm run test` sạch sau mỗi thay đổi (120/120 test cuối phiên, +~15 test case mới so với đầu phiên); kiểm thử tay qua Playwright cho từng luồng UI ở trên (bao gồm 1 lần phát hiện `.next` cache cũ gây lỗi hiển thị sai — không phải bug code, đã fix bằng xoá cache + restart dev server sạch).

**Điểm dừng:** ✅ User đã tự kiểm thử và xác nhận hoàn thành giai đoạn này — sẵn sàng sang Phase 14.

---

## Phase 13.2: Page hệ thống, Tiền nhân viên đã nhận, gỡ Expense Categories, Dashboard "Cơ cấu chi phí" ✅ (đã hoàn thành, đã kiểm thử — session 2026-08-18 → 2026-08-19)

Không phải feature phase theo kế hoạch gốc — cùng dạng phiên tổng hợp phản hồi user như Phase 13.1, gộp lại để không phá số phase MCP (14–16). Chi tiết đầy đủ từng thay đổi (migration, rationale, câu trả lời `AskUserQuestion`) đã ghi trực tiếp trong `context/schema.md` (Changelog) và `context/spec.md` (các đoạn "Cập nhật ngày 2026-08-18/19..."); dưới đây chỉ tóm tắt.

**Page — loại Page + self-service (mục 15.2/12, schema.md):**
- Thêm `Page.page_type` (`SYSTEM|BKT`, migration `20260818100000`): Page hệ thống không có giá mua; Page BKT giữ nguyên flow trả phí cũ, chỉ Admin tạo.
- User tự tạo được Page hệ thống qua `/user/pages/new` — tự động gán ngay cho chính mình trong 1 transaction (`createSystemPageForSelf`), không qua Admin duyệt.
- Thêm bộ lọc Loại Page/Trạng thái/Nhân viên phụ trách cho `/admin/pages`, và Loại Page/Trạng thái (bớt Nhân viên, đã scoped sẵn) cho `/user/pages`.

**Tiền nhân viên đã nhận (entity mới, mục 20a):**
- `EmployeeReceipt` (migration `20260818120000`) — 1 record/nhân viên/tháng, upsert-ghi-đè như Revenue/Ads. Route mới `/admin/employee-receipts`. **Thuần bản ghi để xem** — cố tình không cộng vào Employee Cost/Revenue hay bất kỳ tổng hệ thống nào (có test riêng xác nhận isolation).

**Gỡ bỏ Expense Categories (mục 21 — ĐÃ GỠ BỎ):**
- Xoá hẳn entity `ExpenseCategory`/enum `ExpenseCategoryScope`/field `AdminExpense.category_id` (migration `20260818110000`) cùng toàn bộ service/UI/nav liên quan — 3 category "hệ thống" hoá ra không hề có FK thật tới các bảng chi phí tương ứng, chỉ là placeholder có thể gán nhầm. `AdminExpense` (Tài nguyên) không còn phân loại.

**Sửa hiển thị Lương (Employee Detail + `/user/costs`):**
- Bảng "Chi tiết chi phí" chỉ còn hiện **đúng 1 dòng lương đang hiệu lực** (không phải mọi giai đoạn `SalaryHistory` lịch sử), label 1 tháng thay vì range — sửa nhầm lẫn "hiện 2 loại lương" khi Đổi lương tạo record mới + đóng record cũ.

**Admin Dashboard (mục 11, đổi nhiều vòng theo phản hồi liên tiếp):**
- Thêm rồi bỏ card "Tổng chi phí mua Page" — thay bằng donut chart mới **"Cơ cấu chi phí"** (`ExpenseBreakdownChart`, dùng skill `dataviz` để chọn form + validate màu CVD trước khi code) hiện Ads/Lương/Page/Tài nguyên dưới dạng lát cắt cộng đúng bằng "Tổng chi phí" ở giữa vòng tròn — trực quan hoá quan hệ tập-con. Qua nhiều lượt chỉnh theo phản hồi: bỏ card "Tổng chi phí" phẳng (trùng số); màu "Tài nguyên" đổi xám → xanh lá theo yêu cầu; đổi tên nhãn "Chi phí mua Page"→"Page", "Khác"→"Tài nguyên"; sửa lỗi separator giữa lát cắt (paddingAngle độ → stroke pixel → bỏ hẳn, vì lát quá nhỏ như Ads 0.2% bị separator nào cũng nuốt mất); tooltip đổi nền tối → trắng viền đen bo góc + tắt animation (tránh trông "trong suốt" lúc fade-in).
- **"Lịch sử thao tác" tách thành route riêng** `/admin/activity`, thêm mục sidebar ngay dưới "Bảng điều khiển" — không còn nằm trong Dashboard.
- Layout đổi nhiều lần theo yêu cầu: donut chiếm nửa rồi 1/3 rồi cùng hàng với biểu đồ đường; KPI Card xếp dọc rồi quay lại xếp ngang.
- **Bỏ hẳn month-picker** — Dashboard giờ luôn all-time, không còn chọn theo tháng (đảo lại tính năng "chế độ all-time" thêm ở Phase 13.1); xoá hẳn component `dashboard-month-picker.tsx`.

**Sự cố hạ tầng phát hiện & tự sửa trong phiên (không phải bug code):**
- 2 lần dev server `next dev` chạy sẵn từ trước (>1 tiếng) phục vụ Prisma Client cũ sau khi schema đổi (thiếu model mới) → lỗi runtime `Cannot read properties of undefined`. Cùng nguyên nhân đã ghi nhận ở Phase 3 — `kill -9` tiến trình cũ + khởi động lại là đủ, không cần sửa code.
- Dọn dữ liệu test rác (1 `PageStatusOption` mồ côi + 8 Page/3 User orphan từ một lần `revenue-service.test.ts` chạy lỗi thoáng qua) lẫn vào dev DB thật giữa phiên — đã xoá sạch đúng thứ tự FK, hardening thêm 1 test để tránh lặp lại.

**Kết quả kiểm thử:** `tsc`/`lint`/`npm run build` sạch sau mỗi thay đổi; `npm run test` tăng dần theo từng tính năng mới, kết thúc phiên ở **128/128 pass** (từ 120 cuối Phase 13.1) — gồm test mới cho `page_type`/filter Page/`EmployeeReceipt` (isolation khỏi Employee Cost là test quan trọng nhất), trừ đi 6 test bị xoá cùng `expense-category-service.test.ts`. Không có browser thật để tự bấm kiểm thử UI trong phiên này (khác Phase 13.1 có Playwright) — user tự kiểm thử qua ảnh chụp màn hình thực tế, phản hồi lặp lại nhiều vòng cho tới khi đạt yêu cầu (đặc biệt phần donut chart).

**Điểm dừng:** ✅ User đã tự kiểm thử và xác nhận hoàn thành giai đoạn này — sẵn sàng sang Phase 14.

---

## Phase 14: Settings — MCP / API Key Management ✅ (đã hoàn thành, đã kiểm thử)

**Ghi chú thực hiện (khác với mô tả gốc bên dưới):**
- **Hash API key bằng SHA-256, không dùng bcrypt (khác cách hash password ở Phase 2).** Quyết định kiến trúc quan trọng cho Phase 15: một API key (khác password) đã là dữ liệu ngẫu nhiên entropy cao (32 random bytes qua `randomBytes`, không phải do người dùng tự chọn/tái dùng), nên không cần thuật toán chậm có salt như bcrypt để chống brute-force — chỉ cần hash quyết định (deterministic) để tra cứu trực tiếp `WHERE api_key_hash = sha256(key)`. Nếu dùng bcrypt (salt ngẫu nhiên mỗi lần hash) thì Phase 15 xác thực mỗi tool call sẽ phải fetch **toàn bộ** `McpClient` đang `ACTIVE` rồi `bcrypt.compare` từng cái — vẫn chấp nhận được ở quy mô vài key, nhưng SHA-256 + lookup theo index là cách chuẩn ngành cho API key (Stripe, GitHub...) và đơn giản hơn hẳn cho Phase 15. Key có tiền tố `mcp_` (giống style `sk_live_...`) để dễ nhận diện nếu lỡ rò rỉ.
- **Không có pagination/filter/search cho danh sách MCP client** — khác với các list page khác (Employee, Page, Revenue...). Lý do: đây là danh sách quản trị nội bộ cho vài AI agent client (không phải hàng trăm bản ghi như Revenue/Ads), quy tắc cross-cutting "Filter/Search/Pagination" trong ghi chú đầu file áp dụng cho list "phát sinh nhiều" — không áp dụng hợp lý ở đây. Danh sách sort `createdAt desc` đơn giản.
- **Tạo key qua Dialog trên chính trang `/admin/settings/mcp`, không phải route `/admin/settings/mcp/new` riêng** — đúng như plan gốc mô tả "modal cảnh báo", khác Employee (Phase 3) dùng route + success panel riêng vì Employee còn nhiều field/điều hướng tới Detail sau khi tạo; MCP Client chỉ có 1 field (tên) nên Dialog gọn hơn. Success panel "hiện key 1 lần" tái dùng lại đúng ý tưởng từ `CreateEmployeeSuccess` (copy button, cảnh báo không hiện lại) nhưng render ngay trong `DialogContent` thay vì trang riêng.
- **Component mới:** `server/services/mcp-client.service.ts` (`listMcpClients`, `createMcpClient`, `revokeMcpClient`, lớp lỗi `McpClientError`), `server/validators/mcp-client.schema.ts`, `server/actions/mcp-client.actions.ts`, `components/forms/create-mcp-client-dialog.tsx`, `components/forms/revoke-mcp-client-button.tsx` (tái dùng `ConfirmDialog` có sẵn từ Phase 3, cùng pattern `DeletePageButton`).
- **Audit log:** action mới `REVOKE` (khác `DEACTIVATE`/`ACTIVATE` đã dùng cho User — MCP Client dùng đúng thuật ngữ nghiệp vụ "thu hồi" theo spec §31) — thêm nhãn tiếng Việt + tone `error` vào `lib/audit-labels.ts` (`ENTITY_LABELS["McpClient"]` đã có sẵn từ trước, chưa dùng tới cho đến phase này).
- **Không đổi schema** — `McpClient` model đã có đầy đủ từ Phase 1 (migration đầu tiên theo toàn bộ `schema.md`), phase này chỉ implement CRUD dùng field có sẵn.

**Kết quả kiểm thử thực tế:**
- ✅ `tests/unit/mcp-client-service.test.ts` (7 test case mới, tổng **134/134 test pass**): tạo client trả plaintext key đúng 1 lần, DB chỉ lưu hash (không phải plaintext, hash dài 64 hex char = SHA-256), `permissionsJson = {"scope":"ADMIN_FULL"}`, ghi đúng 1 audit `CREATE`; 2 lần tạo cho ra 2 key/hash khác nhau; `listMcpClients` sort mới nhất trước, không bao giờ trả field `apiKey`/`apiKeyHash`; `revokeMcpClient` set đúng `status=REVOKED` + `revokedAt`, ghi audit `REVOKE`; reject khi thu hồi client đã thu hồi hoặc không tồn tại.
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production) đều sạch — route `/admin/settings/mcp` build `ƒ` (dynamic).
- ✅ Kiểm thử tay qua browser thật (Playwright headless, dev server đang chạy sẵn — không có `chromium-cli` trong môi trường này nên tiếp tục dùng trực tiếp Playwright như đã làm ở Phase 3): login Admin 1 → `/admin/settings/mcp` → bấm "Tạo API key mới" → nhập tên → submit → Dialog chuyển sang panel thành công, hiện đúng plaintext key tiền tố `mcp_...`, nút "Sao chép" hoạt động (clipboard) → đóng dialog, **reload lại trang** → xác nhận key plaintext **không còn xuất hiện ở bất kỳ đâu** trên trang (chỉ còn Tên/Trạng thái/Lần dùng/Ngày tạo) → bấm "Thu hồi" trên đúng client vừa tạo → confirm dialog → status chip đổi "ĐÃ THU HỒI" (đỏ), cột Thao tác đổi thành "—" (không cho thu hồi lần 2) → vào `/admin/settings/audit` → xác nhận thấy đúng 2 dòng "TẠO MỚI"/"THU HỒI" cho đối tượng "MCP Client", người thực hiện "Admin 1", đúng thứ tự thời gian. Không có console error trong suốt luồng.
- ⚠️ Phát hiện & tự sửa trong lúc test: `navigator.clipboard.writeText` bị treo (timeout) trong Playwright headless mặc định vì thiếu quyền clipboard — phải `context.grantPermissions(["clipboard-read","clipboard-write"])` trước khi test nút "Sao chép"; không phải bug ở code Phase 14, chỉ là điều kiện môi trường test.
- Dữ liệu test (2 MCP client tạo trong lúc kiểm thử) đã được thu hồi (revoke) sạch sau khi test — không xoá cứng được vì `McpClient` không có delete qua UI theo đúng schema.md (chỉ `status`/`revoked_at`), đúng tinh thần "không hard delete", chấp nhận còn lại 2 record trạng thái `REVOKED` trong DB dev như dữ liệu lịch sử vô hại.

**Điểm dừng:** ✅ User đã tự kiểm thử và xác nhận hoàn thành — sẵn sàng sang Phase 15.

---

## Phase 14 (mô tả gốc — tham khảo, xem "Ghi chú thực hiện" ở trên cho điểm khác biệt)

**Mục tiêu:** UI quản lý `McpClient` (tạo/xem/revoke API key) — chưa cần MCP server thật chạy, chỉ phần quản trị key.

**Việc cần làm:**
1. `server/services/mcp-client.service.ts`.
2. Create McpClient: generate API key ngẫu nhiên đủ mạnh, chỉ hash (`api_key_hash`) lưu DB, **hiển thị plaintext đúng một lần** ngay sau khi tạo (modal cảnh báo "sẽ không hiện lại").
3. List McpClient: name, status, last_used_at, created_at — **không** bao giờ hiện lại key.
4. Revoke McpClient (set `status=REVOKED`, `revoked_at`).
5. `/admin/settings/mcp`.
6. Audit log tạo/revoke MCP client.

**Màn hình Stitch dùng:** Không có sẵn — generate mới, modal "hiện key 1 lần" theo Level 2 elevation (soft shadow) trong DESIGN.md.

**Test / chạy local:**
- Tạo McpClient → copy key hiển thị 1 lần, reload trang → key không còn hiển thị plaintext ở đâu nữa.
- Revoke → key đó sẽ bị từ chối ở Phase 15/16 khi test MCP auth thật.

**Điểm dừng:** Dừng lại xin xác nhận trước khi sang Phase 15.

---

## Phase 15: MCP Server — Auth + Read Tools ✅ (đã hoàn thành, đã kiểm thử)

**Ghi chú thực hiện (khác với mô tả gốc bên dưới):**
- **SDK dùng `@modelcontextprotocol/server` + `@modelcontextprotocol/core` v2.0.0, không phải `@modelcontextprotocol/sdk` v1.x** — tra Context7 xác nhận package cũ (monolithic `sdk`, dừng ở 1.30.0) đã tách thành `server`/`client`/`core` từ v2 (bản ổn định, không phải alpha/beta). Theo đúng CLAUDE.md "This is NOT the Next.js you know... tra docs trước khi code" áp dụng tương tự cho mọi library — không giả định API từ training data.
- **Transport: Next.js Route Handler (`src/app/api/mcp/route.ts`), không phải process `stdio` riêng** — dùng `createMcpHandler` (web-standard `fetch`, khớp thẳng `Request`/`Response` của Route Handler, xem `node_modules/next/dist/docs/.../route.md`) ở chế độ **stateless mặc định** (không session store) — đúng cho serverless/Vercel vì 2 request liên tiếp có thể rơi vào 2 instance khác nhau. `npm run dev` là đủ để MCP server "chạy được" (route tự động hot-reload theo file-system routing của Next.js), không cần script `npm run mcp` riêng như plan gốc gợi ý — Claude Code kết nối qua HTTP transport (`claude mcp add --transport http http://localhost:3000/api/mcp`) thay vì stdio.
- **`src/mcp/auth.ts` (`verifyMcpRequest`)** — parse header `Authorization: Bearer mcp_...`, gọi `authenticateMcpClient()` (hàm mới trong `mcp-client.service.ts`, tái dùng `hashApiKey` nội bộ đã có từ Phase 14) → `findFirst({apiKeyHash, status:"ACTIVE"})` + bump `last_used_at`. **Không thêm unique index cho `api_key_hash`** (schema.md không đổi) — `findFirst` đủ nhanh ở quy mô vài MCP client, tránh việc migrate schema chỉ vì auth (đúng CLAUDE.md "không tự đổi schema"). Trả `null` (không throw) cho key sai/REVOKED, route handler tự chuyển thành `401` kèm `WWW-Authenticate: Bearer`.
- **`src/mcp/tool-runner.ts` (`runMcpTool`)** — wrapper dùng chung cho mọi tool: tạo `requestId`, bọc response đúng format spec §34 (`{success,data,meta}` / `{success:false,error:{code,message}}`), và ghi `AuditLog` (`actor_type=MCP`, `action="READ"`) cho **mọi** lần gọi kể cả khi thất bại (spec §29 "MCP actions", plan gốc mục 4 "audit toàn bộ để không thiếu") — logic audit chỉ viết một lần ở đây, không lặp lại trong từng tool. `entityId` mặc định = `requestId` cho tool không có 1 entity cụ thể (list/dashboard/search); tool 1-entity (`get_employee_detail`, `get_page_detail`) truyền đúng id thật để Audit Log trỏ về đúng record. BigInt (tiền VND) không tự serialize qua `JSON.stringify` → có `bigIntSafe` replacer convert sang `Number` (an toàn ở quy mô số liệu nội bộ, xem mục 26 CLAUDE.md).
- **`src/mcp/server.ts` (`buildMcpServer(mcpClientId)`)** — factory per-request (đúng pattern SDK khuyến nghị cho multi-tenant/stateless), đăng ký đúng 9 tool read-only qua `registerTool` + Zod `inputSchema`, mỗi tool chỉ parse input rồi gọi thẳng service đã có (`employee.service.ts`, `page.service.ts`, `revenue.service.ts`, `ads.service.ts`, `admin-expense.service.ts`, `receipt.service.ts`, `dashboard.service.ts`, `audit.service.ts`) — không có business logic mới, đúng CLAUDE.md "Service Layer dùng chung". `annotations: {readOnlyHint:true, destructiveHint:false, idempotentHint:true}` trên mọi tool (best practice MCP, không có trong spec nhưng không tốn công thêm và giúp host UI hiển thị đúng mức độ rủi ro).
- **Đổi khác spec §32 — `list_expense_categories` bị bỏ hẳn khỏi bộ tool**, vì entity `ExpenseCategory` đã gỡ bỏ toàn bộ ở Phase 8 (2026-08-18, xem section Phase 8 bên dưới) — tool này không còn gì để gọi. Còn lại đúng 9 tool: `get_dashboard`, `list_employees`, `get_employee_detail`, `list_pages`, `get_page_detail`, `list_revenue`, `list_ads`, `list_admin_expenses`, `list_admin_receipts`, `search_audit_logs`.
- **Đổi khác spec §32 — `list_employees` thêm filter `status`**: `ListEmployeesParams` (`employee.service.ts`) trước đây chỉ có `search`/`month` (Employee List UI ở Phase 3 chủ động bỏ filter tháng/status, xem ghi chú Phase 3) — spec liệt kê rõ `status` là filter của `list_employees` nên thêm field optional mới vào service dùng chung (không đổi hành vi Web UI hiện có, chỉ thêm khả năng lọc mới cho MCP).
- **`get_employee_detail`/`get_page_detail` không tìm thấy → lỗi có `code` rõ ràng** (`EMPLOYEE_NOT_FOUND`/`PAGE_NOT_FOUND`, class `McpToolError` mới trong `tool-runner.ts`) thay vì trả `data: null` — khớp đúng tinh thần response envelope 2 nhánh của spec §34.
- **Lỗi validate input (Zod `inputSchema` sai) không đi qua envelope §34** — đây là hành vi chuẩn của MCP protocol (SDK tự chặn trước khi tool handler chạy, giống một HTTP request malformed không bao giờ tới được route handler code), không phải lỗi nghiệp vụ nên không cố ép về format riêng.
- **`src/mcp/rate-limit.ts` (`isMcpRateLimited`)** — cùng kiểu in-memory sliding-window đã dùng cho login (`server/auth/rate-limit.ts`, Phase 2), 60 request/60 giây, key theo `client:<mcpClientId>` sau khi xác thực, hoặc `ip:<địa chỉ>` cho request auth thất bại (chặn brute-force ở chính bước xác thực). Vượt giới hạn → `429` với `error.code="RATE_LIMITED"`. Chấp nhận trade-off không share giữa nhiều instance serverless — cùng lý do đã note ở Phase 2.
- **Audit UI (Phase 12) không cần sửa gì** — `auditActionLabel`/`auditEntityLabel` (`lib/audit-labels.ts`) đã thiết kế fallback về raw string cho action/entity_type chưa biết; chỉ thêm nhãn tiếng Việt mới cho `READ` (action) và `Dashboard`/`AuditLog` (entity_type — 2 entity_type mới do MCP tool không map vào entity nghiệp vụ nào có sẵn), `listAuditFilterOptions()` đã lấy live từ dữ liệu thật nên filter dropdown tự khớp không cần sửa code.

**Kết quả kiểm thử thực tế:**
- ✅ `tests/integration/mcp-server.test.ts` (12 test case, dùng `@modelcontextprotocol/client` thật — `Client` + `StreamableHTTPClientTransport` chạy in-process qua `handler.fetch`, đúng pattern "testing" chính thức của SDK, không mock JSON-RPC layer): reject request thiếu header/key sai/key đã `REVOKED` (401); key hợp lệ → `last_used_at` được cập nhật; `get_dashboard` trả đúng field name spec (`totalRevenue/totalReceived/totalExpenses/profit/totalSalary/totalAds`); `list_employees` lọc đúng theo `search`+`status`; `get_employee_detail` trả đúng financials theo tháng; `get_employee_detail`/id không tồn tại → `EMPLOYEE_NOT_FOUND`; `list_pages`/`get_page_detail` đúng owner hiện tại; `list_revenue` trả `amount` dạng `number` an toàn (không phải BigInt/string); `search_audit_logs` tìm lại đúng chính các tool call MCP vừa gọi; mọi tool call (thành công lẫn thất bại) đều ghi đúng 1 `AuditLog` `actor_type=MCP`. Thêm `tests/unit/mcp-rate-limit.test.ts` (2 test) + 1 test tích hợp riêng cho rate-limit (429 ở request thứ 61, dùng client MCP riêng để không ảnh hưởng quota của các test khác) — **149/149 test pass** (134 cũ + 15 mới).
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production) đều sạch — route `/api/mcp` build `ƒ` (dynamic, `runtime="nodejs"`).
- ✅ **Kiểm thử qua HTTP thật** (dev server `npm run dev` đang chạy sẵn, không phải in-process mock): tạo fixture (Admin/Employee/Page/Revenue/McpClient) trực tiếp qua service layer, dùng `@modelcontextprotocol/client` thật kết nối `http://localhost:3000/api/mcp` — `tools/list` trả đúng 9 tool; `get_dashboard`, `get_employee_detail`, `get_page_detail` trả đúng dữ liệu khớp DB; `get_page_detail` với id không tồn tại → `isError:true` + `PAGE_NOT_FOUND`. Verify trực tiếp trong DB: đúng 4 `AuditLog` được ghi (`actor_type=MCP`, `entity_type` đúng `Dashboard/Employee/Page/Page`, `entity_id` của record NOT_FOUND vẫn được log đúng), `McpClient.last_used_at` được cập nhật. Toàn bộ fixture dọn sạch sau khi verify (không còn record rác trong DB dev).
- ℹ️ Không kiểm thử qua Claude Code thật kết nối `claude mcp add` (môi trường chạy Claude Code hiện tại không tự thêm MCP server cho chính phiên đang chạy) — thay bằng MCP Client SDK chính thức chạy qua HTTP thật tới dev server, xác minh đúng cùng một giao thức JSON-RPC/Streamable HTTP mà Claude Code sẽ dùng khi user tự `claude mcp add --transport http`.

**Điểm dừng:** ✅ User đã tự kiểm thử và xác nhận hoàn thành — sẵn sàng sang Phase 16 (phase rủi ro cao nhất, quyền Admin Full qua AI).

---

## Phase 15 (mô tả gốc — tham khảo, xem "Ghi chú thực hiện" ở trên cho điểm khác biệt)

**Mục tiêu:** MCP server chạy được, xác thực API key, cung cấp các tool **read-only** trước (rủi ro thấp hơn write).

**Việc cần làm:**
1. `mcp/server.ts`, `mcp/auth.ts` — xác thực API key qua `mcp-client.service.ts` (so hash), reject nếu `status=REVOKED`, cập nhật `last_used_at`.
2. Tools read-only (spec §32), mọi tool gọi qua **cùng Service Layer** với Web (không duplicate logic):
   - `get_dashboard`
   - `list_employees`, `get_employee_detail`
   - `list_pages`, `get_page_detail`
   - `list_revenue`
   - `list_ads`
   - `list_admin_expenses`
   - `list_admin_receipts`
   - `list_expense_categories`
   - `search_audit_logs`
3. Mỗi tool call có `requestId`, response format chuẩn (spec §34: `{success, data, meta:{requestId}}` / `{success:false, error:{code,message}}`).
4. Audit log actor_type=`MCP` cho mọi tool call (kể cả read, theo spec §29 liệt kê "MCP actions" chung — nếu chỉ muốn audit write thì xác nhận lại; mặc định plan này audit toàn bộ để không thiếu).
5. Rate limit MCP.

**Màn hình Stitch dùng:** Không áp dụng (không có UI, đây là service).

**Test / chạy local:**
- Chạy MCP server (`npm run mcp` hoặc script tương ứng), kết nối bằng Claude Code với API key tạo ở Phase 14.
- Gọi `get_dashboard({month:"2026-08"})` → kết quả khớp với `/admin/dashboard` cùng tháng.
- Gọi bằng key đã `REVOKED` → bị từ chối với error code rõ ràng.
- Verify `search_audit_logs` thấy chính các tool call vừa gọi (actor_type=MCP).

**Điểm dừng:** Dừng lại xin xác nhận trước khi sang Phase 16.

---

## Phase 16: MCP Server — Write Tools + Destructive Safety ✅ (đã hoàn thành, đã kiểm thử)

**Đổi khác spec §32 gốc — bỏ hẳn `archive_page`, bỏ 3 tool `*_expense_category`:** `Page.status` không còn là enum `ACTIVE|ARCHIVED` từ lâu (đổi thành free-text rồi thành multi-tag `PageStatusOption`, xem `schema.md` Changelog 2026-08-18) — không còn khái niệm "archive" nào trên Page để tool này gọi tới, `spec.md` mục 32 hiện tại (cập nhật cùng ngày với việc gỡ `ExpenseCategory`) cũng đã để trống mô tả `archive_page` và không liệt kê `assign_employee`/`delete_page` (2 tool thực tế thay thế). Áp dụng đúng tiền lệ Phase 15 đã làm với `list_expense_categories` (bỏ vì `ExpenseCategory` đã gỡ ở Phase 8): bỏ `archive_page` (không còn gì để archive) và bỏ cả 3 tool `create/update/archive_expense_category` (entity không còn tồn tại). Danh sách 21 write tool thực tế implement bám đúng `spec.md` mục 32 hiện hành (đã tự cập nhật, không phải bản đề xuất gốc bên dưới): `create_employee`, `update_employee`, `set_employee_salary`, `deactivate_employee`, `create_page`, `update_page`, `transfer_page`, `assign_employee`, `delete_page`, `create_revenue`, `update_revenue`, `delete_revenue`, `create_ad_expense`, `update_ad_expense`, `delete_ad_expense`, `create_admin_expense`, `update_admin_expense`, `delete_admin_expense`, `create_admin_receipt`, `update_admin_receipt`, `delete_admin_receipt`.

**Vấn đề thiết kế cốt lõi phải giải quyết trước khi viết tool nào — "MCP không có Admin nào đang đăng nhập":** mọi hàm write hiện có trong Service Layer (`createEmployee`, `createPage`, `createRevenue`... toàn bộ 21 hàm) nhận tham số `adminId` dùng cho **hai việc khác nhau cùng lúc**: (1) audit actor (`logAction({actorType:"USER", actorUserId: adminId})`), và (2) một số hàm còn dùng chính giá trị đó làm **business field bắt buộc** (`Page.created_by_admin_id`, `PageAssignment.assigned_by_admin_id`, `Revenue/AdExpense/AdminExpense/AdminReceipt.created_by_admin_id`) — khác với `paid_by_admin_id`/`received_by_admin_id` vốn đã luôn là input tường minh riêng (Web form có Select "Người chi"/"Người nhận" độc lập với session). MCP gọi tool với quyền Admin Full nhưng không phải một Admin cụ thể đang đăng nhập, nên không có giá trị nào tự nhiên cho 2 vai trò trên. Đã tự quyết định (không hỏi lại — không phải thay đổi schema, chỉ là cách diễn giải actor cho một cơ chế đã có sẵn), dựa trên field có sẵn `McpClient.created_by_admin_id`:
- **Business field "người tạo/người gán"** (`created_by_admin_id`/`assigned_by_admin_id`): dùng `McpClient.created_by_admin_id` — Admin đã tạo API key đó (giống cách Web dùng id Admin đang đăng nhập cho đúng field này, MCP chỉ đổi "đăng nhập" thành "sở hữu API key"). Field "người chi/người nhận" (`paid_by_admin_id`/`received_by_admin_id`) **không** đổi — vẫn là input bắt buộc tường minh trên tool, đúng y hệt Web form, spec mục 32 cũng liệt kê rõ `paidByAdminId` là input của `create_page`.
- **Audit actor** (spec §53 "Khi MCP sửa revenue... actor_type = MCP"): **luôn** `actor_type=MCP` + `mcp_client_id`, không phụ thuộc giá trị `adminId` ở trên — tách biệt hoàn toàn 2 khái niệm.

**Thay đổi cơ chế để làm được điều trên (không đổi schema):**
- `src/server/audit/log-action.ts` — thêm `auditActorFields(adminId, meta)`: mặc định trả `{actorType:"USER", actorUserId: adminId}` (giữ nguyên 100% hành vi Web hiện có), trả `{actorType:"MCP", mcpClientId}` khi `meta.actorMcpClientId` được set. `AuditMeta` (`employee.service.ts`, dùng chung mọi service) thêm field optional `actorMcpClientId`.
- Sửa **đúng 21 lệnh `logAction(...)`** (khớp 1-1 với 21 write tool) trong `employee.service.ts`/`salary.service.ts`/`page.service.ts`/`assignment.service.ts`/`revenue.service.ts`/`ads.service.ts`/`admin-expense.service.ts`/`receipt.service.ts` từ `actorType:"USER", actorUserId: adminId,` sang `...auditActorFields(adminId, meta),` — cơ học, không đổi hành vi khi `meta.actorMcpClientId` không được set (mọi Server Action Web hiện có không đổi gì). **Cố tình không đụng** `createSystemPageForSelf`/`updatePageStatusByEmployee` (page.service.ts, User self-service, không có MCP tool) và `restoreAdminExpense` (không có MCP tool theo spec) — giữ nguyên `actorType:"USER"` cứng.
- `mcp-client.service.ts`: `authenticateMcpClient()` trả thêm `createdByAdminId` (đã query sẵn `McpClient` row, chỉ thêm 1 field vào return type). `mcp/auth.ts`: `McpAuthInfo.extra.createdByAdminId` (dùng field `extra: Record<string,unknown>` có sẵn của SDK `AuthInfo`, không phải field tự chế). `app/api/mcp/route.ts` + mirror test harness (`tests/integration/mcp-server.test.ts`): `buildMcpServer(clientId, extra.createdByAdminId)` thay vì chỉ `buildMcpServer(clientId)`.
- `mcp/tool-runner.ts` (`runMcpTool`) — thêm option `auditOnSuccess` (mặc định `true`, giữ nguyên hành vi 9 tool đọc Phase 15). 21 write tool đều truyền `auditOnSuccess: false`: Service Layer đã tự ghi đúng 1 dòng AuditLog giàu thông tin hơn (action/before/after thật) khi thành công, nếu wrapper ghi thêm sẽ ra **2 dòng cho 1 lần sửa** — sai với spec §53 ("Audit phải ghi..." ngụ ý đúng 1 dòng khớp before/after thật, không phải 1 dòng generic). Khi `run()` throw (validate fail, NOT_FOUND, thiếu confirm...) thì **vẫn luôn ghi** ở wrapper — đây là lần ghi duy nhất cho một lần gọi thất bại, giữ đúng tinh thần Phase 15 "audit toàn bộ để không thiếu" cho cả write tool.

**Destructive safety (spec §33):** `confirm` là field `z.boolean().optional()` trong `inputSchema` (không phải `z.literal(true)` bắt buộc) — cố tình để input thiếu/`false` **không** bị MCP SDK chặn ở tầng validate input (lỗi đó không đi qua envelope §34, theo đúng ghi chú Phase 15 "Lỗi validate input... không đi qua envelope"). Thay vào đó, `requireConfirm()` throw `McpToolError("...", "CONFIRMATION_REQUIRED")` **bên trong** `run()`, trước khi gọi Service Layer — cho ra đúng lỗi nghiệp vụ `{success:false, error:{code:"CONFIRMATION_REQUIRED"}}` nhất quán với mọi lỗi khác (NOT_FOUND, INVALID_PAYER...), không phải lỗi "malformed request". Áp dụng cho `deactivate_employee`, `delete_page`, `delete_revenue`, `delete_ad_expense`, `delete_admin_expense`, `delete_admin_receipt` (6 tool — đúng danh sách spec §33 sau khi bỏ `archive_page`).

**Lệch nhỏ khác so với spec §32 gốc:**
- `create_revenue`/`update_revenue` dùng tên field `revenueMonth` ("YYYY-MM"), không phải `date` như liệt kê trong bản đề xuất gốc — `Revenue` đã đổi hẳn sang tính theo tháng từ Phase 5 (xem Changelog `schema.md`), `date` là tên cũ còn sót lại chưa dọn trong mục "Inputs" của §32, cùng loại lệch đã xảy ra với `purchaseDate`→`purchaseMonth` (Phase 4) — đặt tên đúng theo field thật trong schema, nhất quán với `list_revenue`/`create_ad_expense` (đã dùng `expenseMonth`/`month` sẵn có từ Phase 15).
- `set_employee_salary` không có input `effectiveFrom` (giống Web `SetEmployeeSalaryClientSchema` từ Phase 3 — luôn hiệu lực từ hôm nay, server tự stamp qua `currentDateKey()`).
- Tiền (`amount`/`purchasePrice`/`monthlySalary`...) nhận **JSON number**, không phải string như Web form (`moneyInputSchema`) — MCP truyền JSON thuần, không có kiểu string-form-input hay BigInt; convert `BigInt(n)` ngay trước khi gọi Service Layer, cùng nguyên tắc "không qua floating point" của `common.schema.ts`.

**Kết quả kiểm thử thực tế:**
- ✅ `tests/integration/mcp-server.test.ts` — thêm 14 test case mới (describe "Write MCP tools") dùng client MCP riêng (`connectFreshWriteClient()`, mỗi test 1 `McpClient`/API key mới) để không đụng ngân sách rate-limit 60 req/60s của các test đọc — phát hiện được đúng vấn đề này khi chạy chung 1 client (9 test đầu tiên fail `RATE_LIMITED`, sửa xong pass hết): `create_employee` trả tempPassword + audit `actor_type=MCP/actorUserId=null`; `update_employee` ghi đúng **1** dòng AuditLog (không nhân đôi); `set_employee_salary` set đúng rate + `paidByAdminId`; `deactivate_employee` reject `CONFIRMATION_REQUIRED` khi thiếu `confirm`, thành công khi có; `create_page` reject khi có `purchasePrice>0` mà thiếu `paidByAdminId`; `update_page`; `assign_employee` snapshot đúng `PagePurchaseExpense` deferred; `create_revenue`/`update_revenue` ghi đúng 1 dòng UPDATE với `before_json`/`after_json` thật khớp spec §53; `delete_revenue`/`delete_page`/`delete_ad_expense`/`delete_admin_expense`/`delete_admin_receipt` đều reject thiếu confirm, soft-delete đúng khi có; `create/update_ad_expense` owner tự resolve; `transfer_page` không đổi snapshot `PagePurchaseExpense` cũ; `create/update_admin_expense`/`create/update_admin_receipt` round-trip đúng. **163/163 test pass** (149 cũ + 14 mới, không sửa assertion nào của 149 test cũ — audit-actor refactor không đổi hành vi Web).
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production) đều sạch.
- ✅ **Kiểm thử qua HTTP thật** (dev server `npm run dev`, không phải in-process mock — cùng phương pháp đã dùng ở Phase 15): script độc lập tạo `McpClient` thật qua service layer rồi gọi tuần tự `create_employee → create_page (bare) → assign_employee → create_revenue → delete_revenue (thiếu confirm → CONFIRMATION_REQUIRED) → delete_revenue (confirm:true → thành công) → delete_page (confirm:true) → deactivate_employee (confirm:true)` qua `@modelcontextprotocol/client` thật nối `http://localhost:3000/api/mcp`. Verify trực tiếp DB: `revenue.deletedAt`/`page.deletedAt` được set, `user.status=INACTIVE`; **8 dòng AuditLog đúng theo thứ tự gọi**, toàn bộ `actor_type=MCP`, `actor_user_id=null`, `mcp_client_id` đúng client — đặc biệt dòng "DELETE Revenue" xuất hiện **2 lần** (1 lần `action=DELETE` do lần gọi thiếu `confirm` thất bại — wrapper log; 1 lần do lần gọi có `confirm:true` thành công — service tự log), xác nhận đúng thiết kế "không nhân đôi khi thành công, vẫn ghi khi thất bại". Dọn sạch toàn bộ fixture sau khi verify.

**Điểm dừng:** ✅ Đã implement + tự kiểm thử (unit/integration test qua in-process JSON-RPC harness + HTTP thật qua dev server) — dừng lại xin xác nhận từ user trước khi sang Phase 17. Đây là phase rủi ro cao nhất (quyền Admin Full qua AI) — khuyến nghị user tự review kỹ phần "Vấn đề thiết kế cốt lõi" ở trên (attribution `McpClient.created_by_admin_id` cho các field `created_by`/`assigned_by`) trước khi coi là chấp nhận được, vì đây là quyết định nghiệp vụ tự đưa ra, chưa hỏi lại user.

---

## Phase 16 (mô tả gốc — tham khảo, xem "Ghi chú thực hiện" ở trên cho điểm khác biệt)

**Mục tiêu:** Hoàn thiện MCP với đầy đủ quyền Admin Full, có safety cho destructive action.

**Việc cần làm:**
1. Tools write (spec §32), qua đúng Service Layer, đầy đủ validate/business rules/audit — **không bypass** Page Assignment/snapshot rules, **không có** raw SQL tool:
   - `create_employee`, `update_employee`, `set_employee_salary`, `deactivate_employee`
   - `create_page`, `update_page`, `transfer_page`, `archive_page`
   - `create_revenue`, `update_revenue`, `delete_revenue`
   - `create_ad_expense`, `update_ad_expense`, `delete_ad_expense`
   - `create_admin_expense`, `update_admin_expense`, `delete_admin_expense`
   - `create_admin_receipt`, `update_admin_receipt`, `delete_admin_receipt`
   - `create_expense_category`, `update_expense_category`, `archive_expense_category`
2. Destructive action safety (spec §33): `delete_revenue`, `delete_ad_expense`, `delete_admin_expense`, `delete_admin_receipt`, `archive_page`, `deactivate_employee` bắt buộc input `{confirm: true}`, thiếu thì reject rõ ràng — không phải giới hạn quyền, chỉ tránh gọi nhầm.
3. Mọi delete vẫn là soft delete (dùng lại service layer đã có).

**Màn hình Stitch dùng:** Không áp dụng.

**Test / chạy local:**
- Qua Claude Code: `create_revenue` cho Page hợp lệ → verify xuất hiện đúng trên Web `/admin/revenue` với đúng owner resolve.
- `delete_revenue` không có `confirm:true` → bị từ chối.
- `transfer_page` qua MCP → verify không phá vỡ snapshot cũ (dùng lại đúng test case như Phase 4/5/6, chỉ đổi actor thành MCP).
- Verify audit log ghi đúng `actor_type=MCP`, before/after json đầy đủ (spec §53).

**Điểm dừng:** Dừng lại xin xác nhận trước khi sang Phase 17. Đây là phase rủi ro cao nhất (quyền Admin Full qua AI) — cần review kỹ trước khi coi là xong.

---

## Phase 16.1: Audit Log cap, Dashboard/Sidebar UX cho cả Admin & User, đồng bộ Lợi nhuận ✅ (đã hoàn thành, đã kiểm thử — session 2026-08-19)

Không phải feature phase theo kế hoạch gốc — phiên làm việc dài ngay sau khi user tự kiểm thử Phase 15/16 qua MCP Inspector/Claude Code, xử lý một chuỗi phản hồi/bug phát sinh trong lúc kiểm thử (dữ liệu test dồn nhiều, `AuditLog` phình nhanh, layout lệch, số liệu Admin/User lệch nhau...). Gộp thành một mục theo đúng tiền lệ Phase 13.1/13.2, không phá đánh số Phase 17. Chi tiết đầy đủ từng quyết định đã ghi trong `CLAUDE.md`/`context/schema.md` (Changelog)/`context/spec.md`; dưới đây chỉ tóm tắt.

**AuditLog — đổi rule "append-only" (CÓ đảo lại quyết định cũ, xác nhận qua hỏi lại user):**
- Phát hiện bảng lên tới 11.042 dòng chỉ sau nửa ngày test MCP (mỗi lần gọi tool, kể cả read-only, đều ghi 1 dòng — spec §29). Đã cảnh báo user đây là đảo ngược rule "append-only, không hard-delete" gốc; user xác nhận **chấp nhận giới hạn cứng 5.000 dòng, hard-delete dòng cũ nhất khi vượt, chấp nhận mất lịch sử** — ưu tiên đơn giản hơn archive.
- `server/audit/log-action.ts`: thêm `AUDIT_LOG_MAX_ROWS=5000` + `trimAuditLog()`, tự chạy sau mỗi `logAction()`. Đây là **ngoại lệ duy nhất** cho rule "không hard delete" — không áp dụng cho 6 entity tài chính (Page/Revenue/AdExpense/PagePurchaseExpense/AdminExpense/AdminReceipt) vẫn soft-delete như cũ. Test mới `tests/unit/log-action.test.ts` (fixture timestamp năm 2000 để không đụng data thật trong bảng). Verify trên data thật: bảng giảm từ 11.042 → dưới 5.000 ngay sau lần chạy test đầu tiên có cơ chế này.
- Dọn tay 34 dòng `AuditLog` rác (orphan `TRANSFER` trỏ tới Page đã bị test tự động xoá) + toàn bộ user/page/mcp-client do chính phiên test Claude tạo ra (không đụng dữ liệu thật của user).

**Admin Dashboard — "Lịch sử thao tác":**
- Ban đầu tách thành trang/nav-item riêng (`/admin/activity`) rồi chỉnh lại `max-w-2xl` cho khỏi full-width — sau đó **user yêu cầu bỏ hẳn trang riêng**, gộp lại vào Admin Dashboard thành 1 card cùng hàng với "Chi phí & Tiền đã nhận theo Admin" (tỷ lệ 2/3–1/3), lần này **có phân trang thật** (mặc định 5 dòng/trang) thay vì danh sách cắt cứng.
- `getRecentActivity()` (`dashboard.service.ts`) đổi signature từ `(limit)` sang `({page, pageSize}) => {items, total, page, pageSize}` — union 6 nguồn (5 bảng + AuditLog cho transfer) không có sort key chung ở DB, dùng kỹ thuật "lấy top `page*pageSize` mỗi nguồn rồi merge" để đảm bảo đúng trang mà không cần cursor phức tạp.

**User section — sidebar trái thay top navbar (giống Admin):**
- `UserNavbar` (top nav ngang) → `UserSidebar` + `UserTopbar` (component mới), dùng lại nguyên `SidebarNavItem` của Admin. Xoá `UserNavbar`/`UserNavItem` (dead code).
- Tiện sửa nút "Đăng xuất" ở đáy sidebar thành **hoạt động thật** (`SidebarLogoutButton` mới, gọi `logoutAction()`) — bên Admin nút tương đương không có `onClick` (bug có từ trước, không đụng file Admin vì ngoài phạm vi).
- Thêm tab mới **"Tiền đã nhận"** (`/user/employee-receipts`) — xem read-only `EmployeeReceipt` của chính mình, không CRUD, không cộng vào Doanh thu/Chi phí (đúng rule đã chốt từ Phase 13.2).

**Cột STT — thêm vào toàn bộ bảng:**
- 25 bảng trên 19 trang (Admin + User) đều thêm cột STT đầu bảng — bảng có phân trang tính offset toàn cục (`(page-1)*pageSize+index+1`), bảng không phân trang dùng `index+1`.

**User Dashboard — đồng bộ với Admin Dashboard:**
- Thêm biểu đồ tròn "Cơ cấu chi phí" (3 lát Ads/Lương/Mua Page, cùng bảng màu CVD-safe đã dùng ở Admin — không có "Tài nguyên" vì đó là chi phí hệ thống, không gắn nhân viên cụ thể).
- Bỏ 4 KPI Card trùng dữ liệu với biểu đồ tròn (Tổng Ads/Chi phí mua Page/Lương đã trả/Tổng chi phí).
- Thêm KPI "Lợi nhuận" — **ban đầu tính theo tháng hiện tại (`periodFinancials`), sau đó đổi lại tính all-time (`allTimeFinancials`)** sau khi user phát hiện lệch số với "Lợi nhuận" bên Admin Employee Detail (chênh 200.000 ₫ — nguyên nhân: `accruedSalaryCost` luỹ kế mọi giai đoạn lương vs `salaryForMonth` chỉ lấy mức đang áp dụng tại 1 tháng, 2 công thức khác nhau khi nhân viên từng đổi lương). Đã verify lại: cùng 1 nhân viên, cả 2 trang giờ ra đúng cùng 1 số.
- Đổi màu "Admin đã nhận" trong biểu đồ đường từ nâu (`#715b34`) sang vàng — dùng token `amber-tag` (`#CA8A04`) có sẵn trong DESIGN.md, không tự bịa hex.

**Employee Detail (Admin) — tab "Page":**
- Đổi từ bảng lịch sử gán (`getEmployeeAssignmentHistory`: Page/Từ ngày/Đến ngày/Ghi chú) sang đúng bảng "Page đang phụ trách" cùng style với `/user/pages` (Tên Page/Loại/Link/Giá mua/Tháng mua/Trạng thái, dùng `listPagesByEmployee`) — theo yêu cầu user "hiển thị giống page bên nhân viên". `getEmployeeAssignmentHistory` giữ nguyên trong service layer (vẫn có unit test riêng), chỉ không còn được UI này gọi.

**Khác:**
- User Profile: đổi nhãn "Lương hiện tại" → "Lương đã trả".

**Kết quả kiểm thử:** `tsc`/`lint`/`npm run build` sạch sau mỗi thay đổi; `npm run test` giữ 167/167 pass xuyên suốt phiên (thêm test cho `trimAuditLog`/phân trang `getRecentActivity`). Mỗi thay đổi UI đều kiểm thử qua browser thật (Playwright + `chromium` cài tạm, không có sẵn `chromium-cli` trong môi trường) với fixture tạo/dọn riêng — không đụng dữ liệu thật của user; các trang không thể tạo fixture an toàn (vd trực tiếp trên tài khoản thật) được verify qua ảnh chụp màn hình user tự gửi. Phát hiện phụ 1 lần: dev server cũ còn sống tranh connection với `prisma dev` proxy gây lỗi Postgres protocol thoáng qua (`08P01`) — không phải bug code, đã note cách nhận diện/khắc phục (kill process cũ, chạy lại sạch).

**Điểm dừng:** ✅ User đã tự kiểm thử và xác nhận hoàn thành giai đoạn này — sẵn sàng sang Phase 17.

---

## Phase 17: Polish (responsive, animation, edge cases) ✅ (đã hoàn thành, đã kiểm thử)

**Mục tiêu:** Hoàn thiện trải nghiệm cuối cùng — không thêm feature mới, chỉ polish trên nền tính năng đã có từ Phase 1–16.

**Việc đã làm (khớp 8 mục kế hoạch gốc):**

1. **Responsive (sidebar + margin):** `Sidebar`/`UserSidebar` tách nội dung ra `SidebarContent`/`UserSidebarContent` dùng chung; nav cố định 260px giờ `hidden lg:flex` (chỉ hiện ≥1024px). Thêm `MobileSidebar` (`components/layout/mobile-sidebar.tsx`) — off-canvas `Sheet` (đã có sẵn component, chưa từng dùng) chứa cùng nội dung sidebar, mở qua nút hamburger trong `Topbar`/`UserTopbar` (`lg:hidden`), tự đóng khi điều hướng (đóng bằng cách reset state **trong lúc render** theo pathname đổi — pattern "adjusting state during render" của React docs — không dùng `useEffect` vì ESLint rule mới `react-hooks/set-state-in-effect` chặn setState đồng bộ trong effect). `AdminLayout`/`UserLayout`: `<main>` đổi `ml-65 px-container-margin` (cố định) → `px-4 lg:ml-65 lg:px-container-margin` (16px mobile → 32px desktop, đúng DESIGN.md). `Topbar`/`UserTopbar` đổi từ `ml-65 w-[calc(100%-260px)]` cố định sang responsive (`w-full` mobile, `lg:ml-65 lg:w-[calc(100%-260px)]` desktop) + `justify-between` để chứa nút hamburger bên trái. `Table` (shadcn) đã có sẵn `overflow-x-auto` wrapper từ Phase 1 → dùng làm fallback horizontal-scroll cho bảng nhiều cột trên mobile (không làm sticky cột STT — chấp nhận đánh đổi, xem DESIGN.md "OR horizontal scroll" là 1 trong 2 lựa chọn hợp lệ).
2. **Loading skeleton:** trước phase này chỉ có 1 file `loading.tsx` (`/admin/dashboard`). Thêm 3 helper dùng chung vào `components/shared/loading-skeleton.tsx`: `ListPageSkeleton` (PageHeader + filter row + `TableSkeleton`), `DetailPageSkeleton` (header + summary cards + tabs + table), `FormPageSkeleton` (stacked field placeholders) — rồi thêm `loading.tsx` cho **22 route còn thiếu** (toàn bộ list/detail/create page Admin + User). Viết lại `/admin/dashboard/loading.tsx` cho khớp đúng layout thật (trước đó lệch: `TableSkeleton columns=9` nhưng bảng thật chỉ 5 cột, 6 `CardSkeleton` nhưng thật chỉ có 3 KPI card — bug có từ Phase 11, không phải do phase này gây ra, tiện tay sửa luôn vì cùng file).
3. **Empty state rà soát:** kiểm tra toàn bộ 24 `page.tsx` — mọi trang có bảng đều đã wire `EmptyState` đúng từ các phase trước (xác nhận qua `grep`, không phát hiện thiếu sót nào cần sửa).
4. **Confirmation modal:** đã thống nhất dùng `ConfirmDialog` dùng chung từ Phase 3 cho mọi delete/transfer/deactivate — rà soát không phát hiện luồng nào còn dùng modal riêng lẻ.
5. **Animation nhẹ:** thêm `PageTransition` (`components/layout/page-transition.tsx`) — client component `key={pathname}` bọc `{children}` trong `AdminLayout`/`UserLayout`, dùng class `animate-in fade-in duration-200` có sẵn từ `tw-animate-css` (đã import từ Phase 1, chưa từng dùng) — không thêm thư viện mới, đúng yêu cầu "giữ tối giản".
6. **Edge cases:** rà soát `formatVnd`/`moneyInputSchema` (amount=0 hợp lệ, đúng spec §43), `lib/month.ts`/`lib/dates.ts` (range `[gte,lt)` qua `Date.UTC` tự đúng khi tháng 12→01 sang năm), mọi component filter (`SearchInput`, `MonthFilter`, `PageFilters`, `FinanceFilters`...) đều reset `page=1` khi đổi filter (tránh "trang cũ trống"), `Pagination` xử lý đúng khi `total=0` (ẩn hẳn UI phân trang) và khi `page > totalPages` (Next tự disable, không lỗi) — không phát hiện bug nào cần sửa ở nhóm này, đã có từ các phase trước.
7. **Rà soát acceptance criteria §54–61:** đối chiếu từng dòng với hành vi đã implement — không phát hiện gap (đã verify qua browser thật ở mục "Kết quả kiểm thử" bên dưới, cộng với 167 test tự động).
8. **Security review nhanh:** mọi route `/admin/*`/`/user/*` đi qua `requireAdmin()`/`requireUser()` ở layout (không route nào bỏ sót); toàn bộ 10 file `server/actions/*.ts` đều gọi `requireAdmin()` (grep xác nhận không có ngoại lệ); `src/proxy.ts` chặn đúng theo role ở tầng optimistic trước khi tới layout; không có `process.env`/`NEXT_PUBLIC_*` nào được dùng trong file `"use client"` (không rò rỉ secret vào client bundle); `McpClient.apiKeyHash` đã hash SHA-256 tại rest, chỉ hiện raw key đúng 1 lần lúc tạo (giống pattern temp password).

**Bug phát hiện thêm trong lúc polish (ngoài 8 mục kế hoạch, sửa luôn vì cùng phạm vi "rà soát" của phase này):**
- **`Sidebar` (Admin) có nút "Đăng xuất" chết** (chỉ là `<button>` trang trí, không có `onClick`) — khác với `UserSidebar` đã dùng đúng `SidebarLogoutButton` (functional) từ trước. Đã sửa Admin `Sidebar` dùng lại `SidebarLogoutButton` giống User, xoá code trùng lặp.
- **Admin Topbar dropdown có mục "Hồ sơ" chết** (không có `href`/`onClick`, không có trang `/admin/profile` nào tồn tại) — đã tự ghi chú là "dead placeholder" trong comment cũ của `UserTopbar`. Đã xoá hẳn mục này khỏi `Topbar` (Admin không có trang hồ sơ riêng theo spec §38, không tự thêm route mới ngoài schema/spec).
- **Console error "Base UI: MenuGroupContext is missing"** phát hiện qua Playwright khi mở dropdown avatar (cả Admin lẫn User) — `DropdownMenuLabel` (Base UI `Menu.GroupLabel`) được dùng trực tiếp mà không bọc trong `DropdownMenuGroup` (`Menu.Group`), vi phạm yêu cầu API của Base UI (tra Context7 xác nhận). Đã bọc `DropdownMenuLabel` trong `DropdownMenuGroup` ở cả `Topbar` và `UserTopbar` — hết lỗi console, dropdown vẫn hiển thị đúng.
- **`nativeButton` warning (Base UI)** đã ghi nhận từ Phase 3/4/9 nhưng để dành tới đây — mọi `<Button render={<Link .../>}>` (polymorphic Link-as-Button) thiếu `nativeButton={false}` theo đúng API Base UI (tra Context7 xác nhận: cần khi `render` đổi sang element không phải `<button>`). Đã thêm `nativeButton={false}` cho toàn bộ 8 chỗ dùng pattern này (`admin/pages`, `admin/employees`, `user/pages`, `admin/expenses`, `create-employee-form.tsx` ×3, `create-system-page-form.tsx`, `create-page-form.tsx`, `page-header.tsx` — component `PageHeader` dùng chung nên fix 1 chỗ áp dụng cho mọi trang Detail có nút "Quay lại").
- **`<Select.Value>` hiện literal value thay vì label** (bug đã biết từ Phase 4, ghi chú "để dành Phase 17") ở field "Trạng thái" của `CreateEmployeeForm`/`EditEmployeeDialog` — lúc mới load form hiện `"ACTIVE"` thay vì "Hoạt động". Đã sửa theo đúng pattern đã dùng ở nơi khác (`SelectValue` nhận `children` dạng hàm format `{(value) => label[value] ?? value}`).

**Màn hình Stitch dùng:** Không generate screen mới — chỉ đối chiếu lại 4 screen gốc + màu/spacing/token qua browser thật, không phát hiện lệch token phát sinh.

**Kết quả kiểm thử thực tế:**
- ✅ `npx tsc --noEmit`, `npm run lint`, `npm run build` (production, 27 route) đều sạch sau mỗi thay đổi.
- ✅ `npm run test` — **167/167 pass** (không có test case mới — phase này là UI/polish thuần, không đổi service layer/business logic).
- ✅ Kiểm thử qua browser thật (Playwright, không có sẵn `chromium-cli` trong môi trường — dùng trực tiếp `playwright` đã có trong `node_modules`), script tự dọn (không sửa dữ liệu dev thật ngoài việc đọc):
  - Desktop 1440px: sidebar cố định hiện đúng, hamburger ẩn, `justify-between` giữ avatar dropdown bên phải.
  - Tablet 768px: sidebar cố định ẩn, hamburger hiện đúng vị trí, nội dung full-width, KPI card reflow đúng `md:grid-cols-2/3`.
  - Mobile 390px: margin 16px đúng, hamburger mở `Sheet` off-canvas hiện đầy đủ nav (đúng active state, đúng nhóm), bấm 1 link điều hướng đúng route **và** tự đóng Sheet (xác nhận cơ chế "adjusting state during render" hoạt động đúng, không cần `useEffect`).
  - Test riêng cho USER role (ký JWT trực tiếp qua `signSession()` cho 1 user seed có sẵn, không tạo tài khoản mới) — `UserSidebar`/`UserTopbar` mobile hoạt động giống hệt Admin, dropdown "Đức test" hiện đúng tên/email, nút "Đăng xuất" trong Sheet hoạt động.
  - Bấm nút "Đăng xuất" ở **sidebar** (không phải dropdown) trên Desktop → redirect `/login` đúng (xác nhận bug nút chết đã hết).
  - Mở dropdown avatar Admin sau khi xoá mục "Hồ sơ" + bọc `DropdownMenuGroup` → `console --errors` rỗng (trước khi sửa: có lỗi `MenuGroupContext is missing`).
  - Employee Detail (tabs) + Create Page form ở mobile 390px: loading skeleton mới (`DetailPageSkeleton`/`FormPageSkeleton`) hiện đúng 1 cột, form không vỡ layout, "Giá mua"/"Tháng mua" vẫn xếp cạnh nhau vừa khít.
  - ⚠️ Phát hiện phụ trong lúc test: chạy đồng thời 1 script Node riêng (kết nối Prisma) trong khi dev server đang chạy làm hỏng wire protocol của `prisma dev` proxy (`Server has closed the connection`) — **đúng loại lỗi đã ghi nhận từ Phase 3/13.2** (proxy ephemeral không chịu được nhiều connection đồng thời từ 2 process khác nhau), không phải bug code. Khắc phục bằng cách tách bước "lấy dữ liệu qua Prisma" (`$disconnect()` ngay) ra khỏi bước "chạy Playwright" thành 2 process riêng, không chạy chồng lấn.
- ✅ Acceptance criteria §54–61: đối chiếu từng dòng qua kết quả test tự động + kiểm thử tay ở trên — không phát hiện gap nào chưa implement.

**Điểm dừng:** ✅ Đã implement + tự kiểm thử (tsc/lint/build/167 test tự động + browser thật Admin & User, mobile/tablet/desktop) — đây là phase cuối theo plan gốc, hoàn thành V1 theo Definition of Done (spec §66). Dừng lại để user nghiệm thu tổng thể trước khi tính đến Future Extensions (spec §64).

---

## Phase 17.1: Rebrand, nhạc nền, Hồ sơ Admin, Lợi nhuận nhân viên, month filter Dashboard ✅ (session 2026-08-19 tiếp theo, sau khi Phase 17 hoàn thành)

Không phải phase theo kế hoạch gốc — chuỗi yêu cầu ad-hoc của user ngay sau khi nghiệm thu Phase 17, gộp lại một mục theo đúng tiền lệ Phase 13.1/13.2/16.1. Đồng thời, **project chuyển từ Postgres local ephemeral (`prisma dev`) sang Neon thật** trong phiên này (`DATABASE_URL` đổi hẳn, `sslmode=verify-full`) — mọi migration/seed/test từ đây chạy trên Neon.

- **Đổi database sang Neon:** `migrate deploy` áp 16 migration lên Neon trống, seed lại 2 Admin với email/password thật do user cung cấp (`minhquyqt29@gmail.com`/`joyadbreaks@gmail.com`), sau đó đổi tên hiển thị thành "Quý Minh"/"Nhân Khải" (update trực tiếp DB + sửa `prisma/seed.ts` để khớp cho lần seed sau). Sau đó user yêu cầu xoá sạch dữ liệu test tích luỹ trên Neon — xoá 1 nhân viên test + toàn bộ 731 dòng AuditLog, giữ nguyên 2 Admin + 2 loại trạng thái Page mặc định.
- **Sửa bug crash session cũ khi đổi DB:** `getCurrentUser()` (`rbac.ts`) gọi `deleteSession()` (sửa cookie) ngay trong Server Component layout — vi phạm luật Next.js "cookie chỉ sửa được trong Server Action/Route Handler", gây lỗi 500 khi cookie cũ trỏ tới user không còn tồn tại (đúng tình huống xảy ra khi đổi DB, nhưng cũng là bug tiềm ẩn có sẵn — sẽ crash y hệt nếu 1 tài khoản bị vô hiệu hoá khi đang đăng nhập nơi khác). Sửa bằng Route Handler mới `/api/auth/invalidate` (được phép sửa cookie) — `requireAdmin()`/`requireUser()` redirect tới đó thay vì tự xoá cookie.
- **Đổi logo/tên thương hiệu:** favicon + logo mới (xử lý qua `sharp` — xoá nền checkerboard giả do file gốc không có alpha thật, pad về hình vuông tránh méo) thay `Landmark` icon mặc định; tên app "Finance Hub" → "Ocean Finance" (Sidebar/UserSidebar/Login/browser tab title); bỏ subtitle "Quản trị nội bộ" khỏi Admin Sidebar; thêm quote "Muốn đi riêng thì đi một mình, muốn đi chung thì đi cùng nhau" trên Login.
- **Nhạc nền:** `BackgroundMusicPlayer` (nút Play/Pause tường minh — browser chặn autoplay có âm thanh nếu không có user gesture thật) trong Topbar, loop khi phát, không dùng localStorage (fresh page load không có gesture nên không auto-resume được dù có nhớ). Thêm quote đùa "Nếu dash đỏ quá, bấm play" + sticker 👉 cạnh nút, tự ẩn dưới `sm` breakpoint.
- **Cụm chuông+avatar → xoá hẳn:** ban đầu chuyển từ Topbar xuống floating pill góc dưới trái (`FloatingAccountMenu`, né sidebar 260px trên desktop), thử thay bell bằng nút logout riêng, rồi user quyết định **xoá hẳn cụm này** — logout chỉ còn qua Sidebar. Nút nhạc chiếm lại chỗ cũ trong Topbar.
- **Tắt Next.js Dev Tools indicator** (`devIndicators: false` trong `next.config.ts`) — icon "N" mặc định đè lên nút "Đăng xuất" của Sidebar ở góc dưới trái; chỉ ảnh hưởng `npm run dev`, không tồn tại ở production.
- **Trang Hồ sơ cho Admin** (`/admin/profile`, nav "Hồ sơ" cuối nhóm Cài đặt) — Admin trước đó chỉ có nút Đăng xuất/dropdown, không có nơi xem thông tin bản thân như User đã có (`/user/profile`). Hiển thị Họ tên/Email/Ngày tạo tài khoản + tổng hợp tài chính tất cả-thời-gian (Tiền đã nhận/Tổng đã chi/Lợi nhuận), tái dùng `getAdminSpendingBreakdown()` có sẵn từ Dashboard, không tạo query mới.
- **"Lợi nhuận nhân viên"** — entity mới `EmployeeProfitSettlement` (xem `context/schema.md` Changelog), đảo ngược một phần quyết định spec §10.2 gốc ("không cần tính lợi nhuận riêng từng nhân viên"). Ban đầu là trang riêng `/admin/profit-settlements` (nav "Lợi nhuận NV") chỉ liệt kê nhân viên có "Lợi nhuận đang chạy" dương (`Revenue − Cost − Σ settlement`, all-time), nút "Chốt về 0" tự tính số tiền (Admin không gõ tay), ghi nhận như bút toán nội bộ **không** cộng vào Total Expenses/Profit hệ thống — xác nhận qua 2 vòng `AskUserQuestion`. Không MCP tool (quyết định có chủ đích).
- **Bỏ filter tháng khỏi Employee List, luôn all-time** — đảo lại `MonthFilter` từng thêm ở Phase 7 (spec §14.1), đúng chuẩn bị cho việc gộp ngay sau đây (Revenue/Total Cost all-time khớp thẳng công thức "Lợi nhuận đang chạy" không cần tính lại).
- **Gộp "Lợi nhuận nhân viên" vào thẳng Employee List** (user request "gộp lợi nhuận nv với quản lý nhân viên") — cân nhắc 3 phương án (giữ 2 trang riêng / gộp cột vào List / gộp vào Employee Detail) qua `AskUserQuestion`, chọn gộp cột. Xoá hẳn route + nav "Lợi nhuận NV"; Employee List thêm cột "Lợi nhuận" + nút "Chốt về 0" (chỉ hiện khi >0) cho **mọi** nhân viên (không chỉ người lợi nhuận dương như trang cũ). Service: xoá `listEmployeesWithPositiveProfit` (không còn cần lọc/phân trang riêng), thêm `getSettledTotalsForEmployees()` (batch `groupBy` 1 query) — `EmployeesPage` tự tính `currentProfit` từ Revenue/Total Cost đã có sẵn, không gọi lại `getEmployeeFinancials`.
- **Thêm lại month filter cho Admin Dashboard** (route khác — trang Dashboard, không phải Employee List ở trên) — đảo ngược quyết định "luôn all-time" đã ghi ở mục Changelog spec §11.1 cùng ngày trước đó (chính user yêu cầu bỏ rồi lại yêu cầu thêm lại), nhưng lần này dùng thẳng `MonthFilter` chuẩn (bỏ trống = all-time, có nút "Xoá lọc") thay vì bespoke `DashboardMonthPicker` cũ đã xoá — đơn giản hơn, nhất quán với mọi list page khác trong app.
- **Sửa 2 bug UI nhỏ:** khoảng trắng thừa ở Combobox tìm Page khi có kết quả (Base UI's `Combobox.Empty` luôn mounted trong DOM dù rỗng — sửa bằng Tailwind `empty:hidden`); mọi `<button>` mất `cursor: pointer` khi hover (Tailwind v4 Preflight đổi default cursor về `default` theo hành vi browser gốc, khác v3 — thêm rule global `button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer }` vào `globals.css`).
- **ĐẢO NGƯỢC "Lợi nhuận nhân viên" thêm lần nữa, cùng ngày 2026-08-19 (user request "khi click vào chốt về 0, chi phí nhân viên thêm một số tiền đã chốt và đây, không có ngừoi chi, với loại là chốt lợi nhuận"):** `EmployeeProfitSettlement.amount` từ "thuần bút toán nội bộ" (mục Changelog "Lợi nhuận nhân viên" phía trên) trở thành **thành phần thứ 4 thật của `Employee Cost`** (spec §10.2). `getEmployeeFinancials()` thêm field `profitSettlementCost`, `totalCost` cộng thêm nó — mọi nơi đọc `totalCost`/"Lợi nhuận" (Employee Detail, Employee List, `/user/costs`, `/user/dashboard`) tự động đúng mà không cần sửa logic riêng lẻ. Xoá `computeEmployeeProfit`/`getSettledTotalsForEmployees`/`listEmployeesWithPositiveProfit` (không còn cần thiết); thêm `listProfitSettlements()` (feed dòng "Bù chi phí" — không Page, không "Người chi" — vào bảng "Chi tiết chi phí" của Employee Detail + `/user/costs`). `/user/dashboard`'s donut "Cơ cấu chi phí" thêm lát thứ 4 màu `#027A48` để `total` tiếp tục khớp tổng lát (tránh lặp lại bug "1.000.000 ở đâu" đã sửa cho Admin Dashboard). **Vẫn giữ nguyên**: không cộng vào Total Expenses/Profit **hệ thống** (`getSystemFinancials()` không đổi) — chỉ đảo phần Employee-Cost-level. Xem `context/schema.md` entity `EmployeeProfitSettlement` (2 mục Changelog) và `context/spec.md` §10.2/§14.1/§14.3/§12.
- **Đổi tỷ lệ hàng biểu đồ đầu Admin Dashboard + `/user/dashboard` từ 2/3–1/3 sang 3/5–2/5** (user request) — `lg:grid-cols-3`+`lg:col-span-2` → `lg:grid-cols-5`+`lg:col-span-3`(biểu đồ đường)/`lg:col-span-2`(donut). Hệ quả phát sinh: donut "Cơ cấu chi phí" (`ExpenseBreakdownChart`) tràn ra ngoài card ở một số độ rộng màn hình — do layout donut+legend cũ chuyển sang dạng hàng ngang theo **viewport breakpoint** (`md:flex-row`) trong khi độ rộng card thật giờ phụ thuộc tỷ lệ cột (container), không phải viewport — sửa bằng **CSS container query** (Tailwind v4 native, không cần plugin): bọc `@container`, đổi `md:flex-row`/`md:w-72` thành `@xl:flex-row`/`@xl:w-72` để layout tự phản ứng đúng theo độ rộng thật của card, cộng thêm `flex-wrap`/`min-w-0` ở legend để an toàn hai lớp.
- **Chữ trong `Tabs` (Doanh thu/Chi phí/Page/Biểu đồ theo tháng) đậm hơn** (user request) — `TabsTrigger` đổi `font-medium`(500)→`font-semibold`(600), khớp weight token `label-caps` đã dùng cho Sidebar nav.
- **Sửa bug hệ thống: `cn()` (`tailwind-merge`) âm thầm xoá màu chữ khi kết hợp với size override tuỳ biến** (phát hiện qua "Tổng chi phí" ở `/user/costs` không đỏ dù `tone="expense"`) — nguyên nhân: `tailwind-merge` mặc định không biết các token `--text-*` tuỳ biến của DESIGN.md (`headline-lg/md/sm`, `body-lg/md`, `label-caps`, `data-tabular`) là font-size, nên xếp nhầm chúng cùng nhóm xung đột với `text-{màu}` (nhóm text-color) — dẫn tới việc class cuối cùng trong nhóm bị hiểu sai đó "thắng", âm thầm xoá mất class màu bất cứ khi nào một size token tuỳ biến được thêm SAU class màu trong cùng `cn()` call (đúng tình huống `KpiCard`'s `highlight` — thêm `text-headline-lg` sau `toneClass()`). Bug này cũng lặng lẽ làm hỏng font-size ở chiều ngược lại (`SummaryStat` trong Employee Detail: `cn("... text-headline-sm", tone)` — mất `text-headline-sm`, size fallback về mặc định trình duyệt) — phát hiện phụ khi verify, cũng tự hết theo cùng 1 fix. Sửa tận gốc ở `src/lib/utils.ts`: `twMerge` thường (`import { twMerge }`) → `extendTailwindMerge({ extend: { theme: { text: [...7 token trên] } } })` — theo đúng khuyến nghị chính thức của `tailwind-merge` cho custom font-size scale (tra qua Context7 MCP, "Adding custom font sizes"); màu tuỳ biến (`--color-*`) không cần khai báo gì thêm — `tailwind-merge` tự nhận diện namespace đó. Chỉ 1 call site dùng `highlight` (`/user/costs`'s "Tổng chi phí") nên phạm vi hiển ảnh hưởng trực tiếp nhỏ, nhưng fix ở tầng `cn()` dùng chung toàn app nên phòng ngừa mọi tổ hợp tương lai. Test: `npm run test` full suite chạy lại sau fix — vẫn 173/173 pass (không có test nào assert className cụ thể nên không cần sửa test).
- **Chuẩn bị deploy Vercel** (user request "hướng dẫn tôi deploy lên vercel") — rà lại toàn bộ cấu hình build/env trước khi hướng dẫn, phát hiện 1 lỗ hổng sẽ làm build fail thật: `package.json` thiếu bước `prisma generate` sau `npm install`. Vì `prisma/schema.prisma` khai `output = "../src/generated/prisma"` (custom path) và thư mục đó bị gitignore (đúng chủ ý, không nên commit code sinh tự động), một checkout mới (kể cả Vercel) sẽ thiếu hẳn `@/generated/prisma/client` nếu không tự generate lại — Prisma 7 không tự động làm việc này qua postinstall của chính nó nữa (khác vài bản cũ). Đã thêm `"postinstall": "prisma generate"` vào `package.json` — fix cần thiết cho MỌI lần build từ checkout mới, không riêng gì Vercel. Đã grep toàn bộ `process.env.*` trong `src/` để xác nhận chỉ 2 biến môi trường thật sự cần thiết lúc runtime: `DATABASE_URL`, `AUTH_SECRET` — `APP_URL`/`MCP_MASTER_SECRET` trong `.env.example` là leftover từ thiết kế MCP ban đầu, không còn được code nào đọc. Đã xác nhận sẵn: `DATABASE_URL` hiện tại dùng đúng endpoint `-pooler` của Neon (phù hợp serverless), cookie session đã tự bật `secure: true` khi `NODE_ENV=production` (không cần sửa), route `/api/mcp` đã tự khai `runtime = "nodejs"` + stateless design sẵn cho serverless từ Phase 15. Hướng dẫn user 2 cách deploy (GitHub integration khuyến nghị, hoặc `vercel` CLI trực tiếp — repo hiện chưa có git) kèm khuyến nghị **không** đưa `prisma migrate deploy` vào build command tự động (tránh migrate nhầm mỗi lần push) — chạy tay khi cần thay vì tự động hoá.
- **Đồng bộ lại `context/spec.md` với mã nguồn thật** (user request "đảm bảo các yêu cầu kỹ thuật và techstack luôn khớp với mã nguồn hiện tại") — rà từng dòng mục 23/32/49/50 đối chiếu code thật, phát hiện nhiều điểm lệch tích luỹ qua nhiều phase: (1) mục 23 "Testing"/"Database" vẫn mô tả `npx prisma dev` là dev/test DB — đã lỗi thời từ khi đổi sang Neon ở đầu Phase 17.1 này, sửa lại cho khớp; (2) mục 23 "Deployment" mô tả MCP "có thể deploy cùng backend hoặc service Node riêng" — mơ hồ so với thực tế đã implement (chạy chung 1 Next.js app, 1 lần deploy), sửa lại dứt khoát + thêm ghi chú `postinstall` vừa fix; (3) mục 32 "MCP Tools" ghi "9 tool read-only" nhưng đếm trực tiếp `registerTool()` trong `src/mcp/server.ts` ra **10** (lỗi đếm có từ Phase 15, không phải do session này) — sửa thành 10 read + 21 write = 31 tool, thêm dòng "đã đối chiếu trực tiếp với code" để lần sau dễ re-verify; xoá luôn heading rỗng `### archive_page` còn sót lại dù đã có changelog note ghi nhận tool này bị bỏ; (4) mục 49 "Environment Variables" liệt kê `APP_URL`/`MCP_MASTER_SECRET` — grep toàn bộ `process.env.*` xác nhận không còn code nào đọc 2 biến này, xoá khỏi danh sách + dọn luôn `.env.example`; (5) mục 50 "Project Structure" — `expense-breakdown-chart.tsx`/`utils.ts` cập nhật mô tả khớp code thật sau các fix gần đây (container query, `extendTailwindMerge`), 2 chỗ "9 tool" sửa thành 31. Đồng thời bổ sung mục 23 "Frontend" ghi lại 2 kỹ thuật mới dùng trong session này (Container Queries, `extendTailwindMerge`) vì đây là quyết định kỹ thuật thật sự đang nằm trong code, chưa từng được ghi vào Tech Stack. Không đổi bất kỳ business rule/công thức nào — thuần soát lỗi tài liệu.

**Kết quả kiểm thử thực tế:**
- ✅ `tsc`/`lint`/`build` sạch sau **mọi** thay đổi riêng lẻ trong session (không gộp kiểm tra cuối cùng — mỗi bước đều verify ngay).
- ✅ `npm run test` — từ 167 lên 176/176 pass sau lần thêm `EmployeeProfitSettlement` đầu tiên, viết lại `profit-settlement-service.test.ts` cho API mới (xoá test cho hàm đã xoá, thêm test settlement làm tăng `totalCost`) + sửa `employee-financials.test.ts` (`toEqual` thêm `profitSettlementCost: 0n`) sau lần đảo ngược cuối — **173/173 pass, 27 skip** (số lượng test giảm từ 176 vì gộp/rút gọn bộ test `profit-settlement-service`, không phải do bug).
- ✅ Mọi thay đổi UI đều kiểm thử qua browser thật (Playwright), kể cả re-verify sau mỗi lần user phản hồi/đổi ý (vd cụm chuông+avatar bị đổi 3 lần liên tiếp trong cùng session) — script tự dọn dữ liệu test, không để sót trong Neon. Lần đảo ngược cuối kiểm thử riêng: tạo Employee/Page/Revenue giả lập lợi nhuận dương, bấm "Chốt về 0" trên Employee Detail, xác nhận Lợi nhuận→0/Tổng chi phí tăng đúng số đã chốt/dòng "Bù chi phí" xuất hiện đúng (Page="—", Người chi="—") đồng bộ trên Employee List + `/user/costs` + `/user/dashboard` donut — dọn sạch dữ liệu + audit log test sau đó.
- ⚠️ Phát hiện phụ: `sslmode=require` trong `DATABASE_URL` gây warning `pg` (hành vi ngầm định sẽ đổi ở major version sau) — sửa `sslmode=verify-full` để khai báo tường minh đúng mức bảo mật đang có, không phụ thuộc default có thể đổi.

**Điểm dừng:** ✅ **User đã tự kiểm thử và xác nhận hoàn thành giai đoạn này.** Chuỗi yêu cầu ad-hoc đã xử lý xong, mỗi mục đều verify riêng qua browser thật + test tự động; `package.json` đã sẵn sàng deploy Vercel (`postinstall: prisma generate`). Không có điểm dừng chính thức (không phải phase kế hoạch gốc) — tiếp tục nhận yêu cầu tiếp theo từ user.

---

## Phase 17.2: Bảo mật + Deploy prep + Đồng bộ MCP tool (session 2026-08-20)

Không phải phase kế hoạch gốc — tiếp tục chuỗi ad-hoc, cùng tiền lệ Phase 13.1/13.2/16.1/17.1.

- **Rà bảo mật toàn app theo yêu cầu user:** phát hiện `.env` chứa credential thật (DB Neon, `AUTH_SECRET`, mật khẩu 2 Admin) ở dạng plaintext cục bộ — đã cảnh báo, user tự quyết định giữ nguyên (không rotate). Sửa 2 điểm code: (1) `mcp/tool-runner.ts` — lỗi Prisma/lỗi hệ thống không xác định không còn trả `error.message` gốc (rò rỉ chi tiết SQL/cột/constraint) ra ngoài MCP response, chỉ lỗi nghiệp vụ có `.code` tường minh (`XxxError` pattern) mới giữ nguyên message; (2) `next.config.ts` — thêm `headers()` với 5 security header cơ bản (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`) cho mọi route, chưa thêm CSP (cần wiring nonce riêng, không muốn vá ẩu).
- **Chuẩn bị deploy Vercel (lần 2, user request "hướng dẫn tôi deploy"):** thêm script `vercel-build: "prisma migrate deploy && next build"` vào `package.json` — Vercel tự nhận diện script tên `vercel-build` và ưu tiên dùng thay `build` mặc định, không cần chỉnh Build Command thủ công trong dashboard. **Lưu ý: khác quyết định đã ghi ở Phase 17.1 phía trên** ("khuyến nghị **không** đưa `prisma migrate deploy` vào build command tự động, tránh migrate nhầm mỗi lần push") — lần này chọn ngược lại vì `prisma migrate deploy` chỉ áp các migration *chưa* chạy (idempotent, an toàn tự động hoá theo đúng khuyến nghị chính thức Prisma+Vercel), và giữ tách biệt `build` (local, nhanh) khỏi `vercel-build` (có migrate) nên không ảnh hưởng dev local. Repo chưa có git (`git init` chưa chạy) — đã hướng dẫn đầy đủ: khởi tạo git → tạo repo GitHub → import vào Vercel → khai `DATABASE_URL`/`AUTH_SECRET` (dùng lại giá trị `.env` hiện có, cùng 1 DB Neon cho cả dev/production theo quyết định của user) → deploy. Không cần seed lại vì dùng chung DB đã có sẵn 2 Admin.
- **Sửa thêm `.gitignore`:** thiếu `.claude/` (state runtime của Claude Code, chỉ có `scheduled_tasks.lock` tại thời điểm rà soát) — đã thêm, tránh commit nhầm khi `git init`.
- **Cỡ chữ Sidebar nav item quá nhỏ (user phản hồi):** đổi token từ `label-caps` (12px, đúng ra dành cho caption/table header, không phải nav item) sang `body-md` (14px) — đúng token đã định nghĩa sẵn trong `.stitch/DESIGN.md`, áp dụng cho cả Admin lẫn User Sidebar (dùng chung `SidebarNavItem`).
- **Hướng dẫn kết nối MCP ngay trên `/admin/settings/mcp`** (user request) — component mới `McpConnectionGuide` (`src/components/forms/mcp-connection-guide.tsx`), hiện endpoint + lệnh CLI `claude mcp add --transport http` + snippet `.mcp.json`/`claude_desktop_config.json` (syntax xác nhận qua docs Claude Code chính thức, không đoán), mỗi khối có nút Sao chép. Endpoint ban đầu tự tính qua `headers()` (host request), sau đó user yêu cầu đổi cố định về domain production thật `https://ocean-finance-zeta.vercel.app/api/mcp` — bỏ hẳn logic tự tính, dùng hằng số `MCP_ENDPOINT`.
- **Rà đồng bộ MCP tool ↔ tính năng thật (user request):** phát hiện + vá khoảng trống — xem chi tiết đầy đủ ở `context/spec.md` §32 Changelog 2026-08-20. Tóm tắt: `EmployeeReceipt`/`PageStatusOption` có full CRUD ở Web từ lâu nhưng chưa từng có MCP tool (không phải quyết định có chủ đích như `EmployeeProfitSettlement`) → thêm 8 tool mới (`list/create/update/delete_employee_receipt`, `list/create/update/delete_page_status_option`), tổng 31→39 tool. Thêm 2 test round-trip mới vào `tests/integration/mcp-server.test.ts` (gồm assertion `delete_page_status_option` reject khi thiếu `confirm` — vì đây là **hard delete**, không phải soft delete như mọi tool delete khác).
- **Đổi tên định danh MCP server sang thương hiệu (user request "đổi tên mcp thành ocean-finance"):** `McpServer({name: "finance-dashboard"...})` → `"ocean-finance"` (`mcp/server.ts`) — tên hiển thị cho AI agent lúc handshake/connect. Đồng bộ luôn 2 chỗ trong `McpConnectionGuide`: alias trong lệnh CLI `claude mcp add --transport http ocean-finance ...` và key `"ocean-finance"` trong snippet `.mcp.json`. **Không đổi** `scopes: ["mcp"]` (`mcp/auth.ts`)/`realm="mcp"` (`route.ts`) — 2 chuỗi kỹ thuật giao thức (auth scope/HTTP realm), không phải tên hiển thị nên không thuộc phạm vi đổi thương hiệu.
- **Phát hiện qua quan sát thực tế của user (Claude Code gọi tool 6 lần cho 1 lệnh salary đơn giản) → thêm `list_admins`:** nguyên nhân là `set_employee_salary` cần `paidByAdminId` dạng UUID nhưng không có tool tra UUID Admin theo tên (khác `list_employees`/`list_pages` đã có `search` sẵn) — agent phải dò qua tool khác (`list_admin_expenses`/`list_admin_receipts`...) để tự khớp tên→id. Thêm tool `list_admins` (read-only, không tham số, tái dùng thẳng `listAdminOptions()` có sẵn ở `user-account.service.ts` — không viết logic mới) → tổng 39→40 tool (13 read + 27 write). Thêm 1 test tìm đúng fixture Admin qua `list_admins`.
- **Thêm mục "Admin" vào Sidebar** (user request "thêm cho tôi tab admin giống tab nhân viên, cũng click detail admin xem admin đã chi và nhận như nào") — chi tiết đầy đủ ở `context/spec.md` §38 Changelog 2026-08-20. Tóm tắt: `AdminsPage` (`/admin/admins`, List, all-time, không phân trang — quy mô 2 Admin) + `AdminDetailPage` (`/admin/admins/[adminId]`, Detail) — cả hai 100% tái dùng `getAdminSpendingBreakdown()` đã có sẵn, không viết query mới. Tách `SummaryStat` (trước là hàm cục bộ trong `admin/employees/[employeeId]/page.tsx`) ra `components/shared/summary-stat.tsx` để 2 trang Detail (Employee + Admin) dùng chung, không lặp code.
- **Đổi Admin Detail từ card tổng theo loại sang bảng chi tiết từng dòng** (user request "tôi cần bảng giống nhân viên thay vì tổng lại") — thêm filter `paidByAdminId` (`ads.service.ts`/`admin-expense.service.ts`) và `receivedByAdminId` (`receipt.service.ts`) vào các hàm `list*` đã có sẵn (trước đó chỉ filter theo `createdByAdminId`/`employeeId`, không có filter theo người thực chi/thực nhận); thêm 2 hàm mới `listPagePurchaseExpensesByAdmin()` (`page.service.ts`) và `listActiveSalariesByAdmin()` (`salary.service.ts`, chỉ lấy giai đoạn lương đang hiệu lực). `AdminDetailPage` merge 4 nguồn thành bảng "Chi tiết đã chi" (giống cấu trúc `costDetailRows` của Employee Detail) + bảng "Chi tiết đã nhận" riêng — giữ nguyên 3 card tổng ở đầu trang.
- **Dọn sạch dữ liệu Neon theo yêu cầu user ("xoá hết thông tin trên db, chỉ để lại thông tin 2 admin")** — script một lần (không phải tính năng app), xoá toàn bộ User role=USER/EmployeeProfile/SalaryHistory/Page/PageAssignment/Revenue/AdExpense/PagePurchaseExpense/AdminExpense/AdminReceipt/EmployeeReceipt/EmployeeProfitSettlement/AuditLog/McpClient theo đúng thứ tự tránh vi phạm FK, trong 1 transaction (atomic). **Giữ lại** 2 User role=ADMIN và 2 `PageStatusOption` mặc định (xác nhận qua `AskUserQuestion`, khớp tiền lệ Phase 17.1). Backup toàn bộ dữ liệu bị xoá ra JSON trước khi chạy (phòng cần đối chiếu). Hệ quả: 2 API key MCP cũ (gồm key đang dùng cho kết nối `ocean-finance`) bị xoá theo — cần tạo key mới sau đó.
- **Fix bug: Page tạo chưa gán nhân viên thì không có cách gán từ danh sách** (user report "khi tạo page mà chưa gán, khi muốn gán page cho nhân viên thì lại ko có phần gán"; làm rõ qua `AskUserQuestion` là user không thấy nút gán ở cả 2 nơi) — điều tra thấy Page Detail đã có sẵn `AssignEmployeeDialog`/`TransferPageDialog` đúng (không phải bug), nhưng Page List (`/admin/pages`) đúng như spec gốc §15.1 chỉ có Edit/Delete, chưa từng có nút Gán/Chuyển giao — user phải vào Detail mới gán được, dễ bị bỏ sót. Thêm 2 dialog đó vào cột "Thao tác" của List, tái dùng nguyên component. `PageListItem` (`page.service.ts`) thêm field `currentEmployeeId` (cả `listPages()` lẫn `listPagesByEmployee()`) để đủ dữ liệu loại nhân viên hiện tại khỏi danh sách candidate khi Chuyển giao.
- **Fix bug: chi phí mua Page chưa gán không tính vào Admin đã chi** (user report "page chưa gán thì bị chưa tính chi phí cho admin chi") — chi tiết đầy đủ ở `context/spec.md` §10.3 Changelog 2026-08-20. Tóm tắt: `PagePurchaseExpense` chỉ tạo khi Page có nhân viên đầu tiên (đúng spec §5, không đổi), nhưng `getSystemFinancials()`/`getAdminSpendingBreakdown()` (`dashboard.service.ts`) trước đó chỉ cộng từ bảng đó — Page có giá mua + Người chi nhưng chưa gán ai thì biến mất khỏi mọi báo cáo. Thêm truy vấn phụ trên `Page` (`purchasePrice > 0 AND purchaseExpense IS NULL`, group theo `paid_by_admin_id`) cộng vào cả 2 hàm; khi Page được gán, tự rơi khỏi truy vấn phụ và chuyển sang tính từ `PagePurchaseExpense` như cũ, không đếm trùng (có test riêng xác nhận). Thêm describe block mới trong `dashboard-service.test.ts` (3 test: pending counts trong `getSystemFinancials`, pending counts đúng Admin trong `getAdminSpendingBreakdown`, không đếm trùng sau khi gán).
- **Xác nhận (user yêu cầu "check lại xem"): chi phí mua Page đã tính đúng cho NHÂN VIÊN khi gán chưa** — khác mục ngay trên (đó là phía Admin/người chi). Đọc lại `assignEmployee()` xác nhận đúng: `PagePurchaseExpense` tạo với `employeeIdSnapshot` = nhân viên vừa gán, và `getEmployeeFinancials()` đã lọc đúng theo field đó. Test cũ (`assign-employee.test.ts`) chỉ kiểm tra dòng DB được tạo đúng field, **chưa từng verify** nó thực sự cộng vào `getEmployeeFinancials()` — đóng khoảng trống này bằng cách mở rộng ngay test "assigns the employee and, deferred from creation, snapshots the PagePurchaseExpense" (không tạo test mới trùng lặp): assert `getEmployeeFinancials(employeeId)` all-time có `pagePurchaseCost`/`totalCost` đúng, và assert theo tháng — khoản này thuộc về **tháng mua thật của Page** (`purchaseMonth`), không phải tháng ngày hiệu lực gán (có thể muộn hơn) — cả 2 đều pass, xác nhận hành vi đúng, không phải bug.
- **ĐẢO NGƯỢC business rule: Ads đổi từ theo-Page sang theo-Nhân viên** (user request "Hiện tại ads đang tính theo page, hãy sửa cho tôi là ads tính theo nhân viên thay vì page") — thay đổi lớn, đụng schema + business rule cốt lõi (spec §6, CLAUDE.md) nên đã dừng lại hỏi qua `AskUserQuestion` (2 câu, xác nhận rõ: bỏ hẳn Page khỏi form Ads; unique constraint đổi theo `employee_id`; bỏ tab Ads khỏi Page Detail) trước khi làm, đúng nguyên tắc CLAUDE.md "khi spec/schema mâu thuẫn với implement, dừng lại hỏi". Chi tiết đầy đủ ở `context/schema.md` entity `AdExpense` + `context/spec.md` §6 Changelog 2026-08-20. Tóm tắt kỹ thuật:
  - **Schema:** `AdExpense` bỏ hẳn `page_id`/`employee_id_snapshot`/`assignment_id_snapshot` + quan hệ với `Page`/`PageAssignment`, thêm `employee_id` (FK → EmployeeProfile trực tiếp, không snapshot). Unique constraint đổi tên+cột: `ad_expenses_page_month_unique` → `ad_expenses_employee_month_unique` trên `(employee_id, expense_month)`. Migration `20260820110155_ads_track_by_employee` — viết tay `migration.sql` (từ `prisma migrate diff --from-config-datasource --to-schema` vì `prisma migrate dev` không chạy được ở môi trường non-interactive) + `prisma migrate deploy` để áp. Bảng `ad_expenses` rỗng lúc migrate (đã xác nhận trước) nên không cần backfill dữ liệu cũ.
  - **Service (`ads.service.ts`, viết lại hoàn toàn):** bỏ `resolvePageOwner()` khỏi `createAdExpense`/`updateAdExpense` — `employeeId` giờ là input trực tiếp như `EmployeeReceipt`, validate tồn tại nhân viên thay vì tồn tại Page. `listAdExpenses` đổi filter `pageId` → không còn, giữ `employeeId`/`paidByAdminId`/`month`.
  - **Các service khác đụng theo:** `employee.service.ts` (`getEmployeeFinancials` — đổi `employeeIdSnapshot` → `employeeId` trong aggregate); `dashboard.service.ts` (`getRecentActivity` — message "ADS" đổi từ tên Page sang tên nhân viên, đổi `include: {page}` → `include: {employee}`); `page.service.ts` (`PageListItem` không đụng gì, không liên quan Ads).
  - **UI:** `create/edit-ad-expense-dialog.tsx` đổi Page Combobox → Employee Select (giống `create-employee-receipt-dialog.tsx`); `/admin/ads` bỏ cột+filter Page, `FinanceFilters` (`pageOptions` giờ optional, dùng chung với Revenue vẫn có Page filter); **bỏ hẳn tab "Ads" khỏi Page Detail** (`/admin/pages/[pageId]`, còn 4 tab: Overview/Revenue/Assignment/Audit) — nhân tiện dedupe `SummaryStat` cục bộ sang dùng component `components/shared/summary-stat.tsx` đã tách trước đó; Employee Detail/`/user/costs`/Admin Detail's "Chi tiết chi phí" đổi dòng Ads từ link-tới-Page sang link-tới-Nhân viên (hoặc `—` ở `/user/costs`, không có link Page).
  - **MCP:** `list_ads`/`create_ad_expense`/`update_ad_expense` đổi input `pageId` → `employeeId`, description cập nhật; `transfer_page`/`delete_page` sửa lại description không còn nhắc AdExpense (không liên quan nữa).
  - **Test:** xoá hẳn `ads-transfer-flow.test.ts` (toàn bộ premise "Ads snapshot qua Page transfer" không còn áp dụng); viết lại hoàn toàn `ads-service.test.ts` theo khuôn `employee-receipt-service.test.ts` (mỗi test dùng tháng riêng, tránh đụng độ upsert ngoài ý muốn); sửa fixture `AdExpense` ở `dashboard-service.test.ts`/`employee-financials.test.ts`/`mcp-server.test.ts` (đổi `pageId` → `employeeId`).

- **Gom lại nhóm Sidebar** (user request "gom phần tất cả page, ads, lương và tài nguyên khác thành mục tài nguyên, phần doanh thu, tiền admin nhận và tiền nhân viên nhận thành mục tài chính") — thuần đổi cấu trúc nhóm trong `nav-config.ts`, không đổi route/component nào. Chi tiết ở `context/spec.md` §38 Changelog 2026-08-20.

**Kết quả kiểm thử:** `tsc`/`lint`/`npm run build` sạch sau từng thay đổi; full `npm run test` **178/178 pass, 22 file** (giảm 1 file do xoá `ads-transfer-flow.test.ts`, không phải regression).

**Điểm dừng:** Không chính thức (ad-hoc). Tiếp tục nhận yêu cầu tiếp theo từ user.

---

## Ghi chú thay đổi schema (nếu cần)

Không có thay đổi schema nào được tự ý thực hiện trong plan này. Ghi lại các điểm **cần hỏi lại user** trước khi động vào `context/schema.md` nếu phát sinh trong lúc code (kế thừa từ mục "Open Questions" của schema.md + 1 điểm phát sinh khi lập plan):

1. `EmployeeProfile` hiện chỉ có `user_id` + timestamps — giữ nguyên tách bảng theo schema hiện tại, không gộp vào `User`.
2. `current_employee_id` **không** cache trên `Page` — Phase 4 luôn resolve qua `PageAssignment`, không tối ưu sớm.
3. `assignment_id_snapshot` trên `PagePurchaseExpense` — giữ nguyên như schema.md hiện tại (đã có field này).
4. `deleted_at` trên `PagePurchaseExpense` — giữ nguyên như schema.md hiện tại (đã liệt kê soft-delete áp dụng entity này).
5. `PageStatus` chỉ có `ACTIVE`/`ARCHIVED`, chưa có `PAUSED` — Phase 4 chỉ implement 2 trạng thái này, không tự thêm.
6. **Phát sinh ở Phase 13 (đã xác nhận 2026-08-17):** ràng buộc "phải còn ít nhất 1 Admin `ACTIVE`" không có trong spec/schema gốc — user xác nhận **áp dụng**, đã implement trong `setUserAccountStatus()` (`server/services/user-account.service.ts`).

---

## Project Structure đầy đủ

Dựa trên Tech Stack (spec §23) và Suggested Project Structure (spec §50), mở rộng chi tiết theo từng phase ở trên:

```text
dashboard/
├── .env.example
├── .env                          # không commit
├── .eslintrc.json
├── .prettierrc
├── next.config.ts
├── tailwind.config.ts            # map toàn bộ token từ .stitch/DESIGN.md
├── tsconfig.json
├── package.json
├── src/proxy.ts                  # RBAC guard cấp route (admin/* vs user/*) — Next.js 16 đổi tên middleware.ts → proxy.ts
│
├── .stitch/
│   └── DESIGN.md
│
├── context/
│   ├── spec.md
│   ├── schema.md
│   └── plan.md
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│       └── ...
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   │
│   │   ├── admin/
│   │   │   ├── layout.tsx                     # AdminLayout: sidebar + topbar
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── employees/
│   │   │   │   ├── page.tsx                   # List
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx                # Create
│   │   │   │   └── [employeeId]/
│   │   │   │       └── page.tsx                # Detail (Summary/Revenue/Costs/Pages/Chart)
│   │   │   ├── pages/
│   │   │   │   ├── page.tsx                   # List
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [pageId]/
│   │   │   │       └── page.tsx                # Detail (Overview/Revenue/Ads/Assignment/Audit tabs)
│   │   │   ├── revenue/
│   │   │   │   └── page.tsx
│   │   │   ├── ads/
│   │   │   │   └── page.tsx
│   │   │   ├── expenses/
│   │   │   │   └── page.tsx
│   │   │   ├── receipts/
│   │   │   │   └── page.tsx
│   │   │   └── settings/
│   │   │       ├── expense-categories/
│   │   │       │   └── page.tsx
│   │   │       ├── users/
│   │   │       │   └── page.tsx
│   │   │       ├── mcp/
│   │   │       │   └── page.tsx
│   │   │       └── audit/
│   │   │           └── page.tsx
│   │   │
│   │   ├── user/
│   │   │   ├── layout.tsx                     # UserLayout: nav rút gọn
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── pages/
│   │   │   │   └── page.tsx
│   │   │   ├── revenue/
│   │   │   │   └── page.tsx
│   │   │   ├── costs/
│   │   │   │   └── page.tsx
│   │   │   └── profile/
│   │   │       └── page.tsx
│   │   │
│   │   └── api/
│   │       └── admin/
│   │           ├── employees/route.ts
│   │           ├── pages/route.ts
│   │           ├── revenue/route.ts
│   │           ├── ads/route.ts
│   │           ├── expenses/route.ts
│   │           ├── receipts/route.ts
│   │           └── dashboard/route.ts
│   │
│   ├── components/
│   │   ├── ui/                                # shadcn/ui primitives
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── topbar.tsx
│   │   │   └── nav-item.tsx
│   │   ├── dashboard/
│   │   │   ├── kpi-card.tsx
│   │   │   ├── monthly-revenue-chart.tsx
│   │   │   └── recent-activity.tsx
│   │   ├── tables/
│   │   │   ├── data-table.tsx                 # Clean Table dùng chung
│   │   │   ├── pagination.tsx
│   │   │   └── status-chip.tsx
│   │   ├── forms/
│   │   │   ├── employee-form.tsx
│   │   │   ├── page-form.tsx
│   │   │   ├── transfer-page-form.tsx
│   │   │   ├── revenue-form.tsx
│   │   │   ├── ads-form.tsx
│   │   │   ├── admin-expense-form.tsx
│   │   │   └── admin-receipt-form.tsx
│   │   ├── shared/
│   │   │   ├── empty-state.tsx
│   │   │   ├── loading-skeleton.tsx
│   │   │   ├── confirm-modal.tsx
│   │   │   └── filter-bar.tsx
│   │   └── icons/                             # wrapper lucide-react nếu cần
│   │
│   ├── server/
│   │   ├── auth/
│   │   │   ├── session.ts
│   │   │   ├── password.ts                    # argon2/bcrypt
│   │   │   └── rbac.ts
│   │   ├── services/
│   │   │   ├── employee.service.ts
│   │   │   ├── salary.service.ts
│   │   │   ├── page.service.ts
│   │   │   ├── assignment.service.ts
│   │   │   ├── revenue.service.ts
│   │   │   ├── ads.service.ts
│   │   │   ├── admin-expense.service.ts
│   │   │   ├── receipt.service.ts
│   │   │   ├── expense-category.service.ts
│   │   │   ├── dashboard.service.ts
│   │   │   ├── audit.service.ts
│   │   │   ├── user-account.service.ts
│   │   │   └── mcp-client.service.ts
│   │   ├── repositories/                      # Prisma query wrapper theo entity (tuỳ chọn nếu cần tách khỏi service)
│   │   ├── validators/
│   │   │   ├── employee.schema.ts
│   │   │   ├── page.schema.ts
│   │   │   ├── revenue.schema.ts
│   │   │   ├── ads.schema.ts
│   │   │   ├── admin-expense.schema.ts
│   │   │   ├── admin-receipt.schema.ts
│   │   │   └── expense-category.schema.ts
│   │   ├── permissions/
│   │   │   └── policies.ts                    # định nghĩa quyền theo role
│   │   └── audit/
│   │       └── log-action.ts
│   │
│   ├── lib/
│   │   ├── db.ts                              # Prisma client singleton
│   │   ├── money.ts                           # format VND, BIGINT helpers
│   │   ├── dates.ts                           # Asia/Ho_Chi_Minh convert helpers
│   │   └── resolve-page-owner.ts              # hàm trung tâm spec §36
│   │
│   ├── mcp/
│   │   ├── server.ts
│   │   ├── auth.ts
│   │   └── tools/
│   │       ├── dashboard.ts
│   │       ├── employees.ts
│   │       ├── pages.ts
│   │       ├── revenue.ts
│   │       ├── ads.ts
│   │       ├── expenses.ts
│   │       ├── receipts.ts
│   │       ├── categories.ts
│   │       └── audit.ts
│   │
│   └── types/
│       └── index.ts
│
└── tests/
    ├── unit/
    │   ├── resolve-page-owner.test.ts
    │   ├── revenue-snapshot.test.ts
    │   ├── ads-snapshot.test.ts
    │   ├── page-transfer.test.ts
    │   ├── salary-effective-date.test.ts
    │   └── dashboard-formula.test.ts
    └── integration/
        ├── page-transfer-flow.test.ts
        ├── page-purchase-cost.test.ts
        └── salary-history-flow.test.ts
```
