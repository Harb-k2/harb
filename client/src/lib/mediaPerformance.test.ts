import { describe, expect, it } from "vitest";
import { brandImageLoadingProps, deferredImageLoadingProps, lowBandwidthFontDisplay } from "./mediaPerformance";

describe("سياسة أصول Harb للشبكات البطيئة", () => {
  it("يفك شعار Harb بصورة غير حاجبة ويعطيه أولوية العرض", () => {
    expect(brandImageLoadingProps.decoding).toBe("async");
    expect(brandImageLoadingProps.fetchPriority).toBe("high");
  });

  it("يؤجل الصور الثانوية ويمنع الخط الخارجي من حجب النص", () => {
    expect(deferredImageLoadingProps.loading).toBe("lazy");
    expect(deferredImageLoadingProps.decoding).toBe("async");
    expect(lowBandwidthFontDisplay).toBe("optional");
  });
});
