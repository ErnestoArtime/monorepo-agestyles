import {
  ArrowDownToLine, ArrowLeft, ArrowRight, Bell, Boxes, Check, ChevronDown,
  ChevronRight, CircleHelp, CircleUserRound, Code2, CreditCard, Eye, EyeOff,
  Heart, Home, List, MapPin, Menu, Minus, MoreHorizontal, Package, Phone,
  Plus, RefreshCw, ScanLine, Search, Send, Settings2, ShieldCheck, ShoppingBag,
  ShoppingCart, SlidersHorizontal, Store, Tag, Trash2, Truck, UserRound,
  Warehouse, X,
} from "lucide-react-native"

const glyphs = {
  arrowDown: ArrowDownToLine, arrowLeft: ArrowLeft, arrowRight: ArrowRight,
  bell: Bell, boxes: Boxes, check: Check, chevronDown: ChevronDown,
  chevronRight: ChevronRight, help: CircleHelp, userCircle: CircleUserRound,
  code: Code2, creditCard: CreditCard, eye: Eye, eyeOff: EyeOff, heart: Heart,
  home: Home, list: List, mapPin: MapPin, menu: Menu, minus: Minus,
  more: MoreHorizontal, package: Package, phone: Phone, plus: Plus,
  refresh: RefreshCw, scan: ScanLine, search: Search, send: Send,
  settings: Settings2, shieldCheck: ShieldCheck, shoppingBag: ShoppingBag,
  shoppingCart: ShoppingCart, sliders: SlidersHorizontal, store: Store,
  tag: Tag, trash: Trash2, truck: Truck, user: UserRound, warehouse: Warehouse,
  close: X,
} as const

export type IconName = keyof typeof glyphs
export type IconProps = {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
}

export function Icon({ name, size = 20, color = "#171717", strokeWidth = 1.8 }: IconProps) {
  const Glyph = glyphs[name]
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} />
}
