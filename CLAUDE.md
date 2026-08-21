# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trong repo này.

## Project Overview

Finance & Revenue Dashboard nội bộ: quản lý nhân viên, Facebook Page, doanh thu/chi phí theo Page và theo nhân viên, chi phí chung + tiền thực nhận của Admin, và MCP Server để AI agent CRUD với quyền tương đương Admin.

Quy mô: 2 Admin, ~8 nhân viên, ~100 Page, ~1.000 giao dịch/tháng. Nội bộ, ưu tiên đơn giản — không tối ưu hoá sớm cho quy mô lớn hơn. Currency: **VND** duy nhất.

**Nguồn sự thật (đọc trước khi code bất kỳ phần nào liên quan):**
- [context/spec.md](context/spec.md) — product & technical spec đầy đủ (roles, business rules, MCP tools, acceptance criteria).
- [context/schema.md](context/schema.md) — data schema chi tiết (entity, field, type, quan hệ, enum, ràng buộc).
- [.stitch/DESIGN.md](.stitch/DESIGN.md) — design system ("Precision Ledger"): màu, typography, spacing, component style.

Khi spec/schema/design mâu thuẫn với những gì đang implement, dừng lại và hỏi lại thay vì tự suy diễn.

## Core Business Rules (bắt buộc nắm trước khi động vào domain logic)

- **Page là đơn vị trung tâm.** Mỗi Page tại một thời điểm chỉ có tối đa một nhân viên phụ trách, xác định qua `PageAssignment` — đây là **source of truth duy nhất**, không lưu `employee_id` trực tiếp trên Page.
- **Snapshot pattern:** Revenue lưu `employee_id_snapshot` + `assignment_id_snapshot` tại thời điểm phát sinh. Khi Page đổi nhân viên (transfer), các record Revenue cũ **không được cập nhật lại** owner.
- **`resolvePageOwner(pageId, occurredAt)`** là hàm trung tâm, bắt buộc dùng khi tạo/sửa Revenue. Nếu Page không có assignment hợp lệ tại ngày đó → reject rõ ràng, không tạo record "mồ côi".
- **AdExpense (Ads) không theo Page** (đổi 2026-08-20, user request) — nhập trực tiếp theo `employee_id`, không snapshot, không qua `resolvePageOwner`. Ràng buộc unique là `(employee_id, expense_month)`, không phải theo Page.
- **Page Purchase Expense** chỉ tạo đúng một lần khi tạo Page (nếu `purchase_price > 0`), gắn với nhân viên nhận Page ban đầu. **Ngoại lệ duy nhất của snapshot pattern** (đổi 2026-08-21, user request "chi phí cũ thì lại chuyển sang cho người B") — khác Revenue, khoản này **CÓ chuyển sang nhân viên mới mỗi khi Page transfer** (`transferPage()` cập nhật lại `employee_id_snapshot`/`assignment_id_snapshot` sang chủ mới), vì chỉ có đúng 1 dòng/Page nên "theo dõi ai đang giữ Page" hợp lý hơn "giữ nguyên người nhận ban đầu".
- **Salary** dùng `SalaryHistory` theo thời gian hiệu lực, không tạo transaction lương thủ công mỗi tháng.
- **Admin Received** (tiền Admin thực nhận) và **Page Revenue** là hai số tách biệt, không được đồng nhất hay nhầm lẫn trong tính toán/UI.
- **Soft delete** cho dữ liệu tài chính (Page, Revenue, AdExpense, PagePurchaseExpense, AdminExpense, AdminReceipt) — không hard delete. `AuditLog` không sửa (append-only cho update), nhưng **có giới hạn cứng 5.000 dòng** — dòng cũ nhất bị hard-delete thật khi vượt (user request 2026-08-19, chấp nhận mất lịch sử cũ để tránh bảng phình vô hạn do MCP ghi log cả read tool). Đây là ngoại lệ duy nhất cho quy tắc "không hard delete" — chỉ áp dụng cho `AuditLog`, không áp dụng cho 6 entity tài chính liệt kê ở trên.
- **RBAC server-side bắt buộc** cho mọi route/action — không dựa vào ẩn UI ở frontend. User chỉ xem dữ liệu của chính mình, không truy cập được Admin Received/Profit công ty/dữ liệu nhân viên khác.
- **Service Layer dùng chung** cho Web (Server Actions/Route Handlers) và MCP tools — không duplicate business logic. MCP có quyền Admin Full nhưng vẫn phải đi qua toàn bộ validate/business rules/audit log, không bypass Page Assignment hay snapshot rules, không có raw SQL tool.
- Chi tiết đầy đủ và ví dụ số liệu: xem `context/spec.md` mục 3–10, 36.

## Always use Context7 MCP

Luôn dùng Context7 MCP để tra cứu docs của library/API (Next.js, Prisma, Auth.js, React Hook Form, Zod, Recharts, shadcn/ui...) mà không cần user yêu cầu — kể cả khi nghĩ đã biết cách dùng, vì docs có thể đã đổi so với training data.

## Design System

- **Đọc và follow TOÀN BỘ [.stitch/DESIGN.md](.stitch/DESIGN.md) trước khi generate bất kỳ UI nào.** File này định nghĩa design system "Precision Ledger": color tokens, typography (Space Grotesk cho headline, Inter cho body, JetBrains Mono cho số liệu), spacing/rounded scale, elevation, shape, component conventions (Data Cards, Clean Tables, Sidebar, Status Chips...).
- **KHÔNG tự đặt màu, spacing, hay component style ngoài DESIGN.md.** Mọi giá trị (hex color, font size, radius, padding...) phải map về token đã định nghĩa trong file đó.
- Phong cách tổng thể: tối giản kiểu Stripe, "High-End Minimalism" — xem thêm mục 40 của `context/spec.md`.
- **Project Stitch:** https://stitch.withgoogle.com/projects/14032540476461860166
- **Khi implement UI, dùng Google Stitch MCP theo đúng thứ tự:**
  1. `list_screens` — xem danh sách screen đã thiết kế.
  2. `fetch_screen_code` + `fetch_screen_image` — lấy code và hình ảnh tham chiếu của screen cần implement.
  3. Implement dựa trên code/image đó, đối chiếu với DESIGN.md.

## UI Rules

- **Tailwind CSS only** — không viết inline style (`style={{...}}`), không dùng CSS Module.
- **Icons:** `lucide-react`, dùng rộng rãi cho mọi icon trong UI.
- **Forms:** React Hook Form + Zod. Validate bằng Zod schema **trước mọi lần ghi DB** (client-side lẫn server-side/service layer).

## Database

- **Follow đúng schema trong [context/schema.md](context/schema.md)** — không tự ý thêm, đổi tên, hay đổi kiểu field ngoài những gì đã định nghĩa ở đó.
- **Nếu cần thay đổi schema (thêm entity, thêm field, đổi quan hệ...) → hỏi lại user trước khi làm**, không tự quyết định rồi migrate.
- Quy ước bắt buộc (xem đầy đủ ở mục "Conventions" trong `context/schema.md`):
  - UUID cho tất cả primary key.
  - Không hard delete dữ liệu tài chính — dùng `deleted_at` (soft delete), không phải xoá thật.
  - Mọi table có `created_at`; table cho sửa có thêm `updated_at`. Ngoại lệ: `AuditLog`, `PageAssignment` chỉ có `created_at`.
  - Tiền: `BIGINT`, VND nguyên, không dùng floating point.
  - Ngày nghiệp vụ (`revenue_date`, `expense_date`, `started_at`...) dùng `DATE`; timestamp hệ thống dùng `timestamptz` (UTC), hiển thị convert sang `Asia/Ho_Chi_Minh`.
- ORM: Prisma. Business logic đặt trong Service Layer (`server/services/`), không viết trực tiếp trong React components hay route handlers.

## Tech Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS, shadcn/ui, Recharts, React Hook Form, Zod.
- **Backend:** Next.js Server Actions / Route Handlers, Service Layer riêng, Zod validation, PostgreSQL.
- **ORM:** Prisma.
- **Auth:** Auth.js hoặc session auth tương thích Next.js — email + password, HttpOnly Secure Cookie, Argon2/bcrypt.
- **Database:** PostgreSQL (Supabase hoặc Neon).
- **Deployment:** Vercel.

Chi tiết kiến trúc, project structure đề xuất, MCP tools, testing strategy: xem `context/spec.md` mục 23–25, 30–37, 50–52.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
