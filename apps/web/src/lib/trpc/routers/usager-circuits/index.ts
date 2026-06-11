import { createTRPCRouter } from "../../init";
import { listByUsager, listByCircuit, countByCircuit } from "./queries";
import { suggestForUsager } from "./suggest";
import { create } from "./associate";
import { update } from "./update";
import { deleteUsagerCircuit, clearComposition } from "./dissociate";

export const usagerCircuitsRouter = createTRPCRouter({
  listByUsager,
  listByCircuit,
  countByCircuit,
  suggestForUsager,
  create,
  update,
  delete: deleteUsagerCircuit,
  clearComposition,
});
