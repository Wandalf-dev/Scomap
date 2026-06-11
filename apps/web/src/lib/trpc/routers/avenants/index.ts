import { createTRPCRouter } from "../../init";
import { cancel } from "./cancel";
import { create } from "./create";
import { getById, listByCircuit, listByUsager } from "./queries";

// ── Router ──────────────────────────────────────────────────────────
export const avenantsRouter = createTRPCRouter({
  listByUsager,
  listByCircuit,
  getById,
  create,
  cancel,
});
