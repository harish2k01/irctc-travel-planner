import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encryptSecret } from "@/lib/crypto";
import { resolvePnrConfiguration } from "@/lib/settings";

const key = Buffer.alloc(32, 11).toString("base64");
let previousKey: string | undefined;

beforeEach(() => {
  previousKey = process.env.APP_ENCRYPTION_KEY;
  process.env.APP_ENCRYPTION_KEY = key;
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.APP_ENCRYPTION_KEY;
  else process.env.APP_ENCRYPTION_KEY = previousKey;
});

describe("PNR provider configuration", () => {
  it("uses encrypted values saved in Settings before deployment fallbacks", () => {
    const configuration = resolvePnrConfiguration(
      {
        pnrProviderUrl: encryptSecret("https://saved.example/pnr/{pnr}"),
        pnrProviderApiKey: encryptSecret("saved-key"),
      },
      {
        PNR_PROVIDER_URL: "https://environment.example/pnr/{pnr}",
        PNR_PROVIDER_API_KEY: "environment-key",
      },
    );

    expect(configuration).toEqual({
      providerUrl: "https://saved.example/pnr/{pnr}",
      apiKey: "saved-key",
    });
  });

  it("uses deployment values when Settings values are empty", () => {
    expect(resolvePnrConfiguration(
      { pnrProviderUrl: null, pnrProviderApiKey: null },
      {
        PNR_PROVIDER_URL: "https://environment.example/pnr",
        PNR_PROVIDER_API_KEY: "environment-key",
      },
    )).toEqual({
      providerUrl: "https://environment.example/pnr",
      apiKey: "environment-key",
    });
  });
});
