export type CatalogCsvRow = {
  rowNumber: number;
  productId: string;
  sku: string;
  title: string;
  description: string;
  variantTitle: string;
};

export type CatalogCsvParseResult = {
  rows: CatalogCsvRow[];
  errors: string[];
};

function detectDelimiter(header: string): string {
  const candidates = [";", ",", "\t"];
  const counts = new Map(candidates.map((delimiter) => [delimiter, 0]));
  let quoted = false;
  for (let index = 0; index < header.length; index += 1) {
    const character = header[index];
    if (character === '"') {
      if (quoted && header[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && counts.has(character)) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }
  }
  return candidates.sort((left, right) => counts.get(right)! - counts.get(left)!)[0] ?? ";";
}

function parseCsvRecords(
  source: string,
  delimiter: string,
): { values: string[]; lineNumber: number }[] {
  const records: { values: string[]; lineNumber: number }[] = [];
  let values: string[] = [];
  let value = "";
  let quoted = false;
  let lineNumber = 1;
  let recordLine = 1;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      values.push(value.trim());
      value = "";
    } else if (character === "\n") {
      lineNumber += 1;
      if (quoted) {
        value += "\n";
      } else {
        values.push(value.trim());
        if (values.some((part) => part.length > 0))
          records.push({ values, lineNumber: recordLine });
        values = [];
        value = "";
        recordLine = lineNumber;
      }
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error(`Fila ${recordLine}: hay un campo entre comillas que no se cerró.`);
  values.push(value.trim());
  if (values.some((part) => part.length > 0)) records.push({ values, lineNumber: recordLine });
  return records;
}

function normalizedHeader(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("es-ES")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

export function parseCatalogCsv(input: string): CatalogCsvParseResult {
  const source = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const firstHeader = source.split("\n").find((line) => line.trim().length > 0);
  if (!firstHeader) return { rows: [], errors: ["Pega el contenido del CSV antes de continuar."] };
  const delimiter = detectDelimiter(firstHeader);
  let records: { values: string[]; lineNumber: number }[];
  try {
    records = parseCsvRecords(source, delimiter);
  } catch (error) {
    return {
      rows: [],
      errors: [error instanceof Error ? error.message : "No se pudo leer el CSV."],
    };
  }
  const headers = records[0]?.values.map(normalizedHeader) ?? [];

  const aliases: Record<string, keyof Omit<CatalogCsvRow, "rowNumber">> = {
    product_id: "productId",
    id_producto: "productId",
    sku: "sku",
    titulo: "title",
    title: "title",
    descripcion: "description",
    description: "description",
    variante: "variantTitle",
    variant_title: "variantTitle",
  };
  const columns = headers.map((header) => aliases[header]);
  const recognizedHeaders = columns.filter(
    (column): column is keyof Omit<CatalogCsvRow, "rowNumber"> => Boolean(column),
  );
  if (new Set(recognizedHeaders).size !== recognizedHeaders.length) {
    return { rows: [], errors: ["El CSV contiene encabezados duplicados."] };
  }
  if (!columns.includes("sku") && !columns.includes("productId")) {
    return {
      rows: [],
      errors: [
        "El encabezado debe incluir una columna SKU o product_id para identificar cada producto.",
      ],
    };
  }

  const rows: CatalogCsvRow[] = [];
  const errors: string[] = [];
  const seenKeys = new Set<string>();
  for (const record of records.slice(1)) {
    const rowNumber = record.lineNumber;
    const values = record.values;
    if (values.length !== columns.length) {
      errors.push(
        `Fila ${rowNumber}: hay ${values.length} valores y se esperaban ${columns.length}.`,
      );
      continue;
    }

    const row: CatalogCsvRow = {
      rowNumber,
      productId: "",
      sku: "",
      title: "",
      description: "",
      variantTitle: "",
    };
    values.forEach((value, columnIndex) => {
      const key = columns[columnIndex];
      if (key) row[key] = value;
    });

    if (!row.productId && !row.sku) {
      errors.push(`Fila ${rowNumber}: indica product_id o SKU.`);
      continue;
    }
    const key = row.productId ? `id:${row.productId}` : `sku:${row.sku.toLocaleLowerCase("es-ES")}`;
    if (seenKeys.has(key)) {
      errors.push(`Fila ${rowNumber}: el identificador aparece más de una vez en el CSV.`);
      continue;
    }
    seenKeys.add(key);
    rows.push(row);
  }

  if (!rows.length && !errors.length) errors.push("El CSV no contiene filas de productos.");
  return { rows, errors };
}
