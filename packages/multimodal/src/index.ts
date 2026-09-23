import type { Modality } from "@paradox/shared";

export interface ModalityResult {
  status: "OK" | "UNSUPPORTED_MODALITY";
  modality: Modality;
  text: string | null;
  message: string;
}

export function adaptInput(modality: Modality, text: string | undefined): ModalityResult {
  if (modality === "TEXT") {
    return { status: "OK", modality, text: text ?? "", message: "text accepted" };
  }
  return {
    status: "UNSUPPORTED_MODALITY",
    modality,
    text: null,
    message: `${modality} adapter is specified but not implemented. No claims were extracted from media.`,
  };
}
