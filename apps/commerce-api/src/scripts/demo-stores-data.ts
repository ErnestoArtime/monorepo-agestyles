/**
 * Demo marketplace data (AG-33): five fictional stores of different kinds with products,
 * variants, prices and stock, to try every screen. Everything created from this file is
 * marked `agestyles_demo` and removed by `demo-stores.ts` in cleanup mode.
 */

export const DEMO_MARKER = "agestyles_demo";
export const DEMO_PREFIX = "agestyles-demo";
/** Plus-addresses of the project's mailbox, so no real person receives anything. */
export const demoEmail = (slug: string) => `agestylesdevelop+demo-${slug}@gmail.com`;

export type DemoVariant = { options: Record<string, string>; price: number; stock: number };
export type DemoProduct = {
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  brand: string;
  category: string;
  material?: string;
  origin?: string;
  weight?: number;
  options?: { title: string; values: string[] }[];
  variants: DemoVariant[];
};
export type DemoCategory = { slug: string; name: string; description: string; parent?: string };
export type DemoStore = {
  slug: string;
  name: string;
  description: string;
  phone: string;
  city: string;
  address: string;
  delivery_usd: number;
  color: [string, string];
  owner: { first_name: string; last_name: string };
  members?: {
    slug: string;
    first_name: string;
    last_name: string;
    role_id: string;
    agent_code?: string;
  }[];
  commission_percent?: number;
  products: DemoProduct[];
};

export const DEMO_CATEGORIES: DemoCategory[] = [
  { slug: "electronica", name: "Electrónica", description: "Audio, telefonía y accesorios." },
  { slug: "audio", name: "Audio", description: "Auriculares y altavoces.", parent: "electronica" },
  {
    slug: "telefonia",
    name: "Telefonía",
    description: "Móviles y accesorios.",
    parent: "electronica",
  },
  {
    slug: "electrodomesticos",
    name: "Electrodomésticos",
    description: "Pequeño electrodoméstico para el hogar.",
  },
  { slug: "moda", name: "Moda", description: "Ropa y complementos." },
  { slug: "moda-mujer", name: "Moda mujer", description: "Ropa de mujer.", parent: "moda" },
  { slug: "moda-hombre", name: "Moda hombre", description: "Ropa de hombre.", parent: "moda" },
  { slug: "alimentos", name: "Alimentos y bebidas", description: "Despensa, café y bebidas." },
  {
    slug: "belleza",
    name: "Belleza y cuidado personal",
    description: "Cosmética, higiene y perfumes.",
  },
  { slug: "juguetes", name: "Juguetes", description: "Juegos y juguetes para todas las edades." },
  { slug: "papeleria", name: "Papelería", description: "Material escolar y de oficina." },
];

const sizes = (base: number, stock: number[]) =>
  ["S", "M", "L", "XL"].map((size, index) => ({
    options: { Talla: size },
    price: base,
    stock: stock[index] ?? 0,
  }));

export const DEMO_STORES: DemoStore[] = [
  {
    slug: "electrohogar",
    name: "Demo · ElectroHogar Habana",
    description: "Tienda de demostración: electrónica y pequeño electrodoméstico.",
    phone: "+5350000001",
    city: "La Habana",
    address: "Calle 23 #101, Vedado",
    delivery_usd: 5,
    color: ["#1F4E79", "#4A90C2"],
    owner: { first_name: "Carlos", last_name: "Demo Electro" },
    members: [
      {
        slug: "electrohogar-almacen",
        first_name: "Lucía",
        last_name: "Demo Almacén",
        role_id: "role_seller_inventory_management",
      },
    ],
    products: [
      {
        slug: "auriculares-bt",
        title: "Auriculares inalámbricos Bluetooth",
        subtitle: "Hasta 30 h de batería",
        description:
          "Auriculares de diadema con Bluetooth 5.3, cancelación pasiva de ruido y estuche de viaje. Producto de demostración.",
        brand: "SonicDemo",
        category: "audio",
        origin: "cn",
        weight: 250,
        options: [{ title: "Color", values: ["Negro", "Blanco"] }],
        variants: [
          { options: { Color: "Negro" }, price: 35, stock: 12 },
          { options: { Color: "Blanco" }, price: 35, stock: 2 },
        ],
      },
      {
        slug: "altavoz-portatil",
        title: "Altavoz portátil resistente al agua",
        description:
          "Altavoz de 10 W con certificación IPX7, ideal para la playa. Producto de demostración.",
        brand: "SonicDemo",
        category: "audio",
        origin: "cn",
        weight: 400,
        variants: [{ options: {}, price: 28, stock: 7 }],
      },
      {
        slug: "cargador-rapido",
        title: "Cargador rápido USB-C 33 W",
        description:
          "Cargador compacto con carga rápida PD y cable de 1 m incluido. Producto de demostración.",
        brand: "VoltDemo",
        category: "telefonia",
        origin: "cn",
        weight: 90,
        variants: [{ options: {}, price: 12, stock: 40 }],
      },
      {
        slug: "funda-movil",
        title: "Funda antigolpes para móvil",
        description:
          "Funda de TPU con esquinas reforzadas. Elige el modelo de tu teléfono. Producto de demostración.",
        brand: "VoltDemo",
        category: "telefonia",
        material: "TPU",
        options: [{ title: "Modelo", values: ["Samsung A15", "Redmi Note 13", "iPhone 13"] }],
        variants: [
          { options: { Modelo: "Samsung A15" }, price: 6, stock: 15 },
          { options: { Modelo: "Redmi Note 13" }, price: 6, stock: 0 },
          { options: { Modelo: "iPhone 13" }, price: 7, stock: 4 },
        ],
      },
      {
        slug: "batidora",
        title: "Batidora de vaso 1,5 L",
        description:
          "Batidora de 600 W con vaso de cristal y tres velocidades. Producto de demostración.",
        brand: "CasaDemo",
        category: "electrodomesticos",
        origin: "cn",
        weight: 2800,
        variants: [{ options: {}, price: 45, stock: 3 }],
      },
      {
        slug: "olla-arrocera",
        title: "Olla arrocera eléctrica",
        description:
          "Olla arrocera de 1,8 L con función mantener caliente. Producto de demostración.",
        brand: "CasaDemo",
        category: "electrodomesticos",
        origin: "cn",
        weight: 2200,
        variants: [{ options: {}, price: 39, stock: 0 }],
      },
    ],
  },
  {
    slug: "moda-malecon",
    name: "Demo · Moda Malecón",
    description: "Tienda de demostración: ropa de mujer y de hombre.",
    phone: "+5350000002",
    city: "La Habana",
    address: "Paseo del Prado #45, Centro Habana",
    delivery_usd: 3,
    color: ["#8E3B5E", "#D9779B"],
    owner: { first_name: "Marta", last_name: "Demo Moda" },
    members: [
      {
        slug: "moda-gestor",
        first_name: "Jorge",
        last_name: "Demo Gestor",
        role_id: "role_seller_order_management",
        agent_code: "DEMOMODA",
      },
    ],
    commission_percent: 8,
    products: [
      {
        slug: "vestido-lino",
        title: "Vestido de lino",
        description: "Vestido fresco de lino, corte midi. Producto de demostración.",
        brand: "Malecón",
        category: "moda-mujer",
        material: "Lino",
        options: [{ title: "Talla", values: ["S", "M", "L", "XL"] }],
        variants: sizes(32, [3, 5, 2, 0]),
      },
      {
        slug: "blusa-algodon",
        title: "Blusa de algodón bordada",
        description: "Blusa ligera con bordado artesanal. Producto de demostración.",
        brand: "Malecón",
        category: "moda-mujer",
        material: "Algodón",
        options: [
          { title: "Talla", values: ["S", "M", "L"] },
          { title: "Color", values: ["Blanco", "Azul"] },
        ],
        variants: [
          { options: { Talla: "S", Color: "Blanco" }, price: 18, stock: 4 },
          { options: { Talla: "M", Color: "Blanco" }, price: 18, stock: 6 },
          { options: { Talla: "L", Color: "Blanco" }, price: 18, stock: 1 },
          { options: { Talla: "S", Color: "Azul" }, price: 18, stock: 2 },
          { options: { Talla: "M", Color: "Azul" }, price: 18, stock: 0 },
          { options: { Talla: "L", Color: "Azul" }, price: 18, stock: 3 },
        ],
      },
      {
        slug: "guayabera",
        title: "Guayabera clásica",
        description: "Guayabera de manga larga con alforzas. Producto de demostración.",
        brand: "Malecón",
        category: "moda-hombre",
        material: "Algodón",
        options: [{ title: "Talla", values: ["S", "M", "L", "XL"] }],
        variants: sizes(40, [2, 4, 4, 1]),
      },
      {
        slug: "pantalon-chino",
        title: "Pantalón chino",
        description: "Pantalón chino de corte recto. Producto de demostración.",
        brand: "Malecón",
        category: "moda-hombre",
        options: [{ title: "Talla", values: ["S", "M", "L", "XL"] }],
        variants: sizes(27, [0, 3, 5, 2]),
      },
      {
        slug: "sombrero-yarey",
        title: "Sombrero de yarey",
        description: "Sombrero tejido a mano. Producto de demostración.",
        brand: "Artesanía Demo",
        category: "moda",
        variants: [{ options: {}, price: 15, stock: 9 }],
      },
    ],
  },
  {
    slug: "bodega",
    name: "Demo · Bodega La Esquina",
    description: "Tienda de demostración: alimentos y bebidas.",
    phone: "+5350000003",
    city: "Santiago de Cuba",
    address: "Calle Enramadas #210",
    delivery_usd: 2,
    color: ["#6B4423", "#C9934E"],
    owner: { first_name: "Pedro", last_name: "Demo Bodega" },
    products: [
      {
        slug: "cafe-molido",
        title: "Café molido de Sierra Maestra",
        description: "Café 100 % arábica, tostado medio. Producto de demostración.",
        brand: "Serrano Demo",
        category: "alimentos",
        origin: "cu",
        options: [{ title: "Tamaño", values: ["250 g", "500 g", "1 kg"] }],
        variants: [
          { options: { Tamaño: "250 g" }, price: 4.5, stock: 30 },
          { options: { Tamaño: "500 g" }, price: 8, stock: 12 },
          { options: { Tamaño: "1 kg" }, price: 15, stock: 2 },
        ],
      },
      {
        slug: "ron-anejo",
        title: "Ron añejo 7 años",
        description:
          "Ron añejo, 700 ml. Venta solo a mayores de 18 años. Producto de demostración.",
        brand: "Caribe Demo",
        category: "alimentos",
        origin: "cu",
        weight: 1200,
        variants: [{ options: {}, price: 22, stock: 8 }],
      },
      {
        slug: "galletas",
        title: "Galletas de soda (paquete familiar)",
        description: "Paquete de 400 g. Producto de demostración.",
        brand: "Horno Demo",
        category: "alimentos",
        variants: [{ options: {}, price: 2.5, stock: 50 }],
      },
      {
        slug: "aceite",
        title: "Aceite de girasol 1 L",
        description: "Aceite vegetal de girasol. Producto de demostración.",
        brand: "Despensa Demo",
        category: "alimentos",
        variants: [{ options: {}, price: 3.8, stock: 0 }],
      },
      {
        slug: "miel",
        title: "Miel de abeja natural",
        description: "Miel cubana sin pasteurizar, frasco de 500 g. Producto de demostración.",
        brand: "Colmena Demo",
        category: "alimentos",
        origin: "cu",
        variants: [{ options: {}, price: 6, stock: 1 }],
      },
    ],
  },
  {
    slug: "belleza",
    name: "Demo · Belleza Vedado",
    description: "Tienda de demostración: cosmética y cuidado personal.",
    phone: "+5350000004",
    city: "La Habana",
    address: "Calle L #305, Vedado",
    delivery_usd: 3,
    color: ["#5B3A8E", "#B48EE0"],
    owner: { first_name: "Ana", last_name: "Demo Belleza" },
    products: [
      {
        slug: "crema-hidratante",
        title: "Crema hidratante facial",
        description: "Crema con ácido hialurónico, 50 ml. Producto de demostración.",
        brand: "Piel Demo",
        category: "belleza",
        variants: [{ options: {}, price: 14, stock: 10 }],
      },
      {
        slug: "perfume",
        title: "Perfume floral",
        description: "Eau de parfum con notas de jazmín. Producto de demostración.",
        brand: "Aroma Demo",
        category: "belleza",
        options: [{ title: "Tamaño", values: ["50 ml", "100 ml"] }],
        variants: [
          { options: { Tamaño: "50 ml" }, price: 30, stock: 4 },
          { options: { Tamaño: "100 ml" }, price: 48, stock: 2 },
        ],
      },
      {
        slug: "champu",
        title: "Champú de coco",
        description: "Champú sin sulfatos, 400 ml. Producto de demostración.",
        brand: "Piel Demo",
        category: "belleza",
        variants: [{ options: {}, price: 7, stock: 18 }],
      },
      {
        slug: "labial",
        title: "Labial mate de larga duración",
        description: "Labial mate. Elige el tono. Producto de demostración.",
        brand: "Color Demo",
        category: "belleza",
        options: [{ title: "Tono", values: ["Rojo", "Nude", "Coral"] }],
        variants: [
          { options: { Tono: "Rojo" }, price: 9, stock: 6 },
          { options: { Tono: "Nude" }, price: 9, stock: 0 },
          { options: { Tono: "Coral" }, price: 9, stock: 3 },
        ],
      },
      {
        slug: "protector-solar",
        title: "Protector solar FPS 50",
        description: "Protector solar resistente al agua, 200 ml. Producto de demostración.",
        brand: "Sol Demo",
        category: "belleza",
        variants: [{ options: {}, price: 16, stock: 2 }],
      },
    ],
  },
  {
    slug: "jugueteria",
    name: "Demo · Juguetería Arcoíris",
    description: "Tienda de demostración: juguetes y papelería.",
    phone: "+5350000005",
    city: "Matanzas",
    address: "Calle Medio #88",
    delivery_usd: 4,
    color: ["#C0392B", "#F5B041"],
    owner: { first_name: "Rosa", last_name: "Demo Juguetes" },
    members: [
      {
        slug: "jugueteria-lectura",
        first_name: "Luis",
        last_name: "Demo Lectura",
        role_id: "role_seller_support",
      },
    ],
    products: [
      {
        slug: "bloques",
        title: "Bloques de construcción (120 piezas)",
        description: "Bloques compatibles para mayores de 4 años. Producto de demostración.",
        brand: "Juega Demo",
        category: "juguetes",
        variants: [{ options: {}, price: 19, stock: 5 }],
      },
      {
        slug: "muneca",
        title: "Muñeca de trapo artesanal",
        description: "Muñeca cosida a mano. Producto de demostración.",
        brand: "Artesanía Demo",
        category: "juguetes",
        origin: "cu",
        variants: [{ options: {}, price: 12, stock: 0 }],
      },
      {
        slug: "pelota",
        title: "Pelota de fútbol talla 5",
        description: "Balón cosido, ideal para entrenar. Producto de demostración.",
        brand: "Juega Demo",
        category: "juguetes",
        variants: [{ options: {}, price: 14, stock: 11 }],
      },
      {
        slug: "cuadernos",
        title: "Cuadernos escolares (paquete de 5)",
        description: "Cuadernos de 80 hojas rayadas. Producto de demostración.",
        brand: "Escuela Demo",
        category: "papeleria",
        options: [{ title: "Tipo", values: ["Rayado", "Cuadriculado"] }],
        variants: [
          { options: { Tipo: "Rayado" }, price: 5, stock: 25 },
          { options: { Tipo: "Cuadriculado" }, price: 5, stock: 1 },
        ],
      },
      {
        slug: "lapices",
        title: "Lápices de colores (24 unidades)",
        description: "Lápices de colores con sacapuntas. Producto de demostración.",
        brand: "Escuela Demo",
        category: "papeleria",
        variants: [{ options: {}, price: 6, stock: 14 }],
      },
      {
        slug: "mochila",
        title: "Mochila escolar",
        description: "Mochila con dos compartimentos y bolsillo lateral. Producto de demostración.",
        brand: "Escuela Demo",
        category: "papeleria",
        options: [{ title: "Color", values: ["Azul", "Rosa", "Verde"] }],
        variants: [
          { options: { Color: "Azul" }, price: 21, stock: 3 },
          { options: { Color: "Rosa" }, price: 21, stock: 2 },
          { options: { Color: "Verde" }, price: 21, stock: 0 },
        ],
      },
    ],
  },
];

export const DEMO_CUSTOMERS = [
  { slug: "cliente-1", first_name: "Elena", last_name: "Demo Cliente", phone: "+5351000001" },
  { slug: "cliente-2", first_name: "Raúl", last_name: "Demo Cliente", phone: "+5351000002" },
  { slug: "cliente-3", first_name: "Yaima", last_name: "Demo Cliente", phone: "+5351000003" },
  { slug: "cliente-4", first_name: "Osvaldo", last_name: "Demo Cliente", phone: "+5351000004" },
];
