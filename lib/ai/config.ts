export const tier1Model = "gpt-4.1-mini";

export const tier1Pricing = {
  inputPerMillion: 0.4,
  outputPerMillion: 1.6,
};

export function estimateTokenCount(text: string) {
  return Math.ceil(text.length / 4);
}

export function estimateTier1Cost(inputText: string, outputTokens = 700) {
  const inputTokens = estimateTokenCount(inputText);

  return {
    inputTokens,
    outputTokens,
    estimatedCost:
      (inputTokens / 1_000_000) * tier1Pricing.inputPerMillion +
      (outputTokens / 1_000_000) * tier1Pricing.outputPerMillion,
  };
}

export function calculateActualCost(inputTokens: number, outputTokens: number) {
  return (
    (inputTokens / 1_000_000) * tier1Pricing.inputPerMillion +
    (outputTokens / 1_000_000) * tier1Pricing.outputPerMillion
  );
}
