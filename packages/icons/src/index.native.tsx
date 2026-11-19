// One file per icon: importing the package index pulls in all ~2,000 icons (AG-36).
import ArrowDownToLine from "lucide-react-native/icons/arrow-down-to-line";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right";
import Bell from "lucide-react-native/icons/bell";
import Boxes from "lucide-react-native/icons/boxes";
import Check from "lucide-react-native/icons/check";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import ChevronUp from "lucide-react-native/icons/chevron-up";
import CircleHelp from "lucide-react-native/icons/circle-question-mark";
import CircleUserRound from "lucide-react-native/icons/circle-user-round";
import Code2 from "lucide-react-native/icons/code-xml";
import CreditCard from "lucide-react-native/icons/credit-card";
import Eye from "lucide-react-native/icons/eye";
import EyeOff from "lucide-react-native/icons/eye-off";
import Heart from "lucide-react-native/icons/heart";
import Share2 from "lucide-react-native/icons/share-2";
import Home from "lucide-react-native/icons/house";
import List from "lucide-react-native/icons/list";
import MapPin from "lucide-react-native/icons/map-pin";
import Menu from "lucide-react-native/icons/menu";
import Minus from "lucide-react-native/icons/minus";
import Monitor from "lucide-react-native/icons/monitor";
import Moon from "lucide-react-native/icons/moon";
import MoreHorizontal from "lucide-react-native/icons/ellipsis";
import Package from "lucide-react-native/icons/package";
import Phone from "lucide-react-native/icons/phone";
import Plus from "lucide-react-native/icons/plus";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import ScanLine from "lucide-react-native/icons/scan-line";
import Search from "lucide-react-native/icons/search";
import Send from "lucide-react-native/icons/send";
import Settings2 from "lucide-react-native/icons/settings-2";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import ShoppingBag from "lucide-react-native/icons/shopping-bag";
import ShoppingCart from "lucide-react-native/icons/shopping-cart";
import SlidersHorizontal from "lucide-react-native/icons/sliders-horizontal";
import Store from "lucide-react-native/icons/store";
import Sun from "lucide-react-native/icons/sun";
import Tag from "lucide-react-native/icons/tag";
import Trash2 from "lucide-react-native/icons/trash";
import TriangleAlert from "lucide-react-native/icons/triangle-exclamation-point";
import Truck from "lucide-react-native/icons/truck";
import UserRound from "lucide-react-native/icons/user-round";
import Warehouse from "lucide-react-native/icons/warehouse";
import X from "lucide-react-native/icons/x";
import { colors } from "@agestyles/design-tokens";
import { useColorScheme } from "react-native";

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

export function Icon({ name, size = 20, color, strokeWidth = 1.8, fill = "none" }: IconProps) {
  const scheme = useColorScheme();
  const resolvedColor = color ?? (scheme === "dark" ? colors.dark.text : colors.light.text);
  const Glyph = glyphs[name];
  return <Glyph size={size} color={resolvedColor} strokeWidth={strokeWidth} fill={fill} />;
}
