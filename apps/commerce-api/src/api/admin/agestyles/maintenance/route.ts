import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { parseMaintenance, readMaintenance, writeMaintenance } from "../../../../lib/maintenance";

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ maintenance: await readMaintenance(req.scope) });
}

/** Administración → «Mantenimiento» switches it on or off. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ maintenance: await writeMaintenance(req.scope, parseMaintenance(req.body)) });
}
