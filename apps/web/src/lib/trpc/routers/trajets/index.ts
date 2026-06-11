import { createTRPCRouter } from "../../init";
import { trajetQueries } from "./queries";
import { trajetMutations } from "./mutations";
import { trajetCalculations } from "./calculations";
import { occurrenceProcedures } from "./occurrences";

export const trajetsRouter = createTRPCRouter({
  ...trajetQueries,
  ...trajetMutations,
  ...trajetCalculations,
  ...occurrenceProcedures,
});
