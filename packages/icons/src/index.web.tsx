import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CircleUserRound,
  Code2,
  CreditCard,
  Eye,
  EyeOff,
  Heart,
  Home,
  List,
  MapPin,
  Menu,
  Minus,
  Monitor,
  Moon,
  MoreHorizontal,
  Package,
  Phone,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Sun,
  Tag,
  Trash2,
  TriangleAlert,
  Truck,
  UserRound,
  Warehouse,
  X,
} from "lucide-react";

const glyphs = {
  alert: TriangleAlert,
  arrowDown: ArrowDownToLine,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  arrowUpRight: ArrowUpRight,
  bell: Bell,
  boxes: Boxes,
  check: Check,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  help: CircleHelp,
  userCircle: CircleUserRound,
  code: Code2,
  creditCard: CreditCard,
  eye: Eye,
  eyeOff: EyeOff,
  heart: Heart,
  home: Home,
  list: List,
  mapPin: MapPin,
  menu: Menu,
  minus: Minus,
  monitor: Monitor,
  moon: Moon,
  more: MoreHorizontal,
  package: Package,
  phone: Phone,
  plus: Plus,
  refresh: RefreshCw,
  scan: ScanLine,
  search: Search,
  send: Send,
  settings: Settings2,
  shieldCheck: ShieldCheck,
  shoppingBag: ShoppingBag,
  shoppingCart: ShoppingCart,
  sliders: SlidersHorizontal,
  store: Store,
  sun: Sun,
  tag: Tag,
  trash: Trash2,
  truck: Truck,
  user: UserRound,
  warehouse: Warehouse,
  close: X,
} as const;

export type IconName = keyof typeof glyphs;
export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  const Glyph = glyphs[name];
  return (
    <Glyph
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
    />
  );
}
