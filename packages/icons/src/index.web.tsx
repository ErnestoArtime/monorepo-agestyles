// One file per icon: importing the package index pulls in all ~2,000 icons (AG-36).
import ArrowDownToLine from "lucide-react/icons/arrow-down-to-line";
import ArrowLeft from "lucide-react/icons/arrow-left";
import ArrowRight from "lucide-react/icons/arrow-right";
import ArrowUpRight from "lucide-react/icons/arrow-up-right";
import Bell from "lucide-react/icons/bell";
import Boxes from "lucide-react/icons/boxes";
import Check from "lucide-react/icons/check";
import ChevronDown from "lucide-react/icons/chevron-down";
import ChevronRight from "lucide-react/icons/chevron-right";
import ChevronUp from "lucide-react/icons/chevron-up";
import CircleHelp from "lucide-react/icons/circle-question-mark";
import CircleUserRound from "lucide-react/icons/circle-user-round";
import Code2 from "lucide-react/icons/code-xml";
import CreditCard from "lucide-react/icons/credit-card";
import Eye from "lucide-react/icons/eye";
import EyeOff from "lucide-react/icons/eye-off";
import Heart from "lucide-react/icons/heart";
import Share2 from "lucide-react/icons/share-2";
import Home from "lucide-react/icons/house";
import List from "lucide-react/icons/list";
import MapPin from "lucide-react/icons/map-pin";
import Menu from "lucide-react/icons/menu";
import Minus from "lucide-react/icons/minus";
import Monitor from "lucide-react/icons/monitor";
import Moon from "lucide-react/icons/moon";
import MoreHorizontal from "lucide-react/icons/ellipsis";
import Package from "lucide-react/icons/package";
import Phone from "lucide-react/icons/phone";
import Plus from "lucide-react/icons/plus";
import RefreshCw from "lucide-react/icons/refresh-cw";
import ScanLine from "lucide-react/icons/scan-line";
import Search from "lucide-react/icons/search";
import Send from "lucide-react/icons/send";
import Settings2 from "lucide-react/icons/settings-2";
import ShieldCheck from "lucide-react/icons/shield-check";
import ShoppingBag from "lucide-react/icons/shopping-bag";
import ShoppingCart from "lucide-react/icons/shopping-cart";
import SlidersHorizontal from "lucide-react/icons/sliders-horizontal";
import Store from "lucide-react/icons/store";
import Sun from "lucide-react/icons/sun";
import Tag from "lucide-react/icons/tag";
import Trash2 from "lucide-react/icons/trash";
import TriangleAlert from "lucide-react/icons/triangle-exclamation-point";
import Truck from "lucide-react/icons/truck";
import UserRound from "lucide-react/icons/user-round";
import Warehouse from "lucide-react/icons/warehouse";
import X from "lucide-react/icons/x";

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
  chevronUp: ChevronUp,
  help: CircleHelp,
  userCircle: CircleUserRound,
  code: Code2,
  creditCard: CreditCard,
  eye: Eye,
  eyeOff: EyeOff,
  heart: Heart,
  share: Share2,
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
  /** Fill colour, e.g. a filled heart for a selected favourite. */
  fill?: string;
};

export function Icon({
  name,
  size = 20,
  color = "currentColor",
  strokeWidth = 1.8,
  fill = "none",
}: IconProps) {
  const Glyph = glyphs[name];
  return (
    <Glyph
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      fill={fill}
      aria-hidden="true"
      focusable="false"
    />
  );
}
