export const brandImageLoadingProps = {
  decoding: "async",
  fetchPriority: "high",
} as const;

export const deferredImageLoadingProps = {
  loading: "lazy",
  decoding: "async",
} as const;

export const lowBandwidthFontDisplay = "optional";
