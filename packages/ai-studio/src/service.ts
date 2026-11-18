import { MedusaService } from "@medusajs/framework/utils";
import AiRequest from "./models/ai-request";

class AiStudioService extends MedusaService({ AiRequest }) {}

export default AiStudioService;
