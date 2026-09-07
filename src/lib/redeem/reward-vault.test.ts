import { getAddress, keccak256, recoverTypedDataAddress, stringToHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains/robinhood";
import {
  buildPayClaimRequest,
  centsToUsdgUnits,
  redemptionClaimId,
  usdgClaimEip712Domain,
  usdgClaimTypedDataTypes,
  usdgRewardVaultAbi,
  usdgUnitsToCents,
} from "./reward-vault";

describe("redemptionClaimId", () => {
  it("matches keccak256 of the UTF-8 redemption id", () => {
    const id = "rdm_11111111-1111-4111-8111-111111111111";
    expect(redemptionClaimId(id)).toBe(keccak256(stringToHex(id)));
  });
});

describe("USDG unit conversion", () => {
  it("maps cents onto 6-decimal USDG units", () => {
    expect(centsToUsdgUnits(100)).toBe(1_000_000n);
    expect(centsToUsdgUnits(150)).toBe(1_500_000n);
    expect(usdgUnitsToCents(1_500_000n)).toBe(150);
  });

  it("rejects non-positive cents", () => {
    expect(() => centsToUsdgUnits(0)).toThrow("invalid_usdg_cents");
    expect(() => centsToUsdgUnits(-1)).toThrow("invalid_usdg_cents");
  });
});

describe("buildPayClaimRequest", () => {
  it("calls payClaim on the vault, never a raw USDG transfer", () => {
    const vault = getAddress("0x2222222222222222222222222222222222222222");
    const request = buildPayClaimRequest({
      vault,
      destination: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      amountCents: 250,
      redemptionId: "rdm_pay_1",
    });
    expect(request.address).toBe(vault);
    expect(request.functionName).toBe("payClaim");
    expect(request.abi).toBe(usdgRewardVaultAbi);
    expect(request.args[0]).toBe("rdm_pay_1");
    expect(request.args[1].toLowerCase()).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(request.args[2]).toBe(2_500_000n);
  });
});

describe("USDG claim EIP-712 voucher", () => {
  it("recovers the operator who signed the claim", async () => {
    const key = generatePrivateKey();
    const account = privateKeyToAccount(key);
    const vault = getAddress("0x3333333333333333333333333333333333333333");
    const recipient = getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const message = {
      redemptionId: "rdm_voucher_1",
      recipient,
      amount: 1_000_000n,
      deadline: 1_800_000_000n,
    };
    const signature = await account.signTypedData({
      domain: usdgClaimEip712Domain(vault),
      types: usdgClaimTypedDataTypes,
      primaryType: "Claim",
      message,
    });
    const recovered = await recoverTypedDataAddress({
      domain: usdgClaimEip712Domain(vault),
      types: usdgClaimTypedDataTypes,
      primaryType: "Claim",
      message,
      signature,
    });
    expect(recovered).toBe(account.address);
    expect(usdgClaimEip712Domain(vault).chainId).toBe(ROBINHOOD_CHAIN_ID);
    expect(usdgClaimEip712Domain(vault).name).toBe("UsdgRewardVault");
  });
});
