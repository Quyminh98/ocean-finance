import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  FileText,
  Receipt,
  Megaphone,
  Wallet,
  Banknote,
  HandCoins,
  PiggyBank,
  Palette,
  Store,
  IdCard,
  Landmark,
  UserCog,
  KeyRound,
  ScrollText,
  User,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string | null;
  items: NavItem[];
};

// Admin Navigation — spec §38
export const adminNavGroups: NavGroup[] = [
  {
    label: null,
    items: [{ label: "Bảng điều khiển", href: "/admin/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Nhân sự",
    items: [
      { label: "Nhân viên", href: "/admin/employees", icon: Users },
      { label: "Admin", href: "/admin/admins", icon: ShieldCheck },
    ],
  },
  {
    label: "Tài nguyên",
    items: [
      { label: "Page", href: "/admin/pages", icon: FileText },
      { label: "Ads", href: "/admin/ads", icon: Megaphone },
      { label: "Lương", href: "/admin/salary", icon: Banknote },
      { label: "Tài nguyên khác", href: "/admin/expenses", icon: Wallet },
    ],
  },
  {
    label: "Tài chính",
    items: [
      { label: "Doanh thu", href: "/admin/revenue", icon: Receipt },
      { label: "Tiền admin đã nhận", href: "/admin/receipts", icon: HandCoins },
      { label: "Tiền nhân viên đã nhận", href: "/admin/employee-receipts", icon: PiggyBank },
    ],
  },
  {
    label: "Cài đặt",
    items: [
      { label: "Loại trạng thái Page", href: "/admin/settings/page-status-options", icon: Palette },
      { label: "Người bán", href: "/admin/settings/sellers", icon: Store },
      { label: "Payout", href: "/admin/settings/payouts", icon: Landmark },
      { label: "Via", href: "/admin/vias", icon: IdCard },
      { label: "Tài khoản", href: "/admin/settings/users", icon: UserCog },
      { label: "MCP / API", href: "/admin/settings/mcp", icon: KeyRound },
      { label: "Audit Log", href: "/admin/settings/audit", icon: ScrollText },
      { label: "Hồ sơ", href: "/admin/profile", icon: User },
    ],
  },
];

// User Navigation — spec §39
export const userNavItems: NavItem[] = [
  { label: "Bảng điều khiển", href: "/user/dashboard", icon: LayoutDashboard },
  { label: "Page của tôi", href: "/user/pages", icon: FileText },
  { label: "Doanh thu", href: "/user/revenue", icon: Receipt },
  { label: "Chi phí", href: "/user/costs", icon: Wallet },
  { label: "Tiền đã nhận", href: "/user/employee-receipts", icon: PiggyBank },
  { label: "Via của tôi", href: "/user/vias", icon: IdCard },
  { label: "Hồ sơ", href: "/user/profile", icon: User },
];
