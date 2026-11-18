import { Module } from "@medusajs/framework/utils";
import AiStudioService from "./service";

export const AGESTYLES_AI_STUDIO_MODULE = "agestylesAiStudio";

export { AiStudioService };
export {
  AiStudioError,
  buildPrompt,
  DEFAULT_MODELS,
  describeProduct,
  monthStartUtc,
  parseDraft,
  providerChain,
  validateDescribeInput,
} from "./draft";
export type {
  CopyDraft,
  CopyTone,
  DescribeInput,
  DescribeResult,
  ProviderConfig,
  ProviderName,
} from "./draft";

export default Module(AGESTYLES_AI_STUDIO_MODULE, {
  service: AiStudioService,
});
