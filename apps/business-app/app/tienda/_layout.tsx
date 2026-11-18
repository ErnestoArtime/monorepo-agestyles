// Configures the shared Tienda with the isolated customer actor before any screen renders.
import "../../context/buyer-actor";

// The same Tienda as apps/buyer-app (AG-31): the screen lives in @agestyles/buyer-experience.
export { default } from "@agestyles/buyer-experience/routes/_layout";
