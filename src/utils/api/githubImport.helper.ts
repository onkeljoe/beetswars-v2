import type { Bribefile, Reward, Tokendata } from "types/bribedata.raw";
import { insertBribefile, readOneBribefile } from "utils/database/bribefile.db";
import { findConfigEntry } from "utils/database/config.db";
import { getSnapshotProposal } from "utils/externalData/snapshot";
import { getAutomationData } from "utils/externalData/github";
import { getTokenSymbol } from "utils/externalData/beetsBack";
import { setTokenEntry } from "utils/database/tokens.db";
import { incPatch } from "./semVer.helper";

export default async function processGithubImport(): Promise<Bribefile | string> {
  const latest = await findConfigEntry("latest");
  const round = Number(latest) || 0;

  const bribefile = await readOneBribefile(round);
  if (!bribefile) return "Error: Round data not found";

  const proposal = bribefile.snapshot;
  const snapshot = await getSnapshotProposal(proposal || "");
  const voteend = snapshot?.end;

  const automation = await getAutomationData(voteend || 0);
  if (!automation) return "Error: Automation data not found in GitHub";

  const gaugesWithBounties = automation.gauges.filter(
    g => g.protocolBounties && g.protocolBounties.length > 0
  );
  if (gaugesWithBounties.length === 0) return "No protocol bounties found for this round";

  let changed = false;

  for (const gauge of gaugesWithBounties) {
    const offer = bribefile.bribedata.find(o => o.poolurl.includes(gauge.poolId));
    if (!offer) {
      console.warn(`githubImport: No offer found for poolId ${gauge.poolId} (${gauge.poolName})`);
      continue;
    }

    for (const bounty of gauge.protocolBounties ?? []) {
      // resolve token symbol
      let symbol = bribefile.tokendata.find(
        t => t.tokenaddress?.toLowerCase() === bounty.tokenAddress.toLowerCase()
      )?.token;

      if (!symbol) {
        symbol = (await getTokenSymbol(bounty.tokenAddress)) ?? undefined;
        if (!symbol) {
          console.error(`githubImport: Could not resolve symbol for ${bounty.tokenAddress}`);
          continue;
        }
        // add token to tokendata if not present
        const nextTokenId =
          bribefile.tokendata.reduce((max, t) => (t.tokenId > max ? t.tokenId : max), 0) + 1;
        const newToken: Tokendata = {
          token: symbol,
          tokenaddress: bounty.tokenAddress,
          tokenId: nextTokenId,
        };
        await setTokenEntry(newToken);
        bribefile.tokendata.push(newToken);
      }

      // find or update the protocol reward entry for this token
      const resolvedSymbol = symbol;
      const existingReward = offer.reward.find(
        r => r.token.toLowerCase() === resolvedSymbol.toLowerCase() && r.isProtocolBribe
      );

      if (existingReward) {
        if (existingReward.amount !== bounty.amount) {
          existingReward.amount = bounty.amount;
          changed = true;
        }
      } else {
        const nextRewardId =
          offer.reward.reduce((max, r) => (r.rewardId > max ? r.rewardId : max), 0) + 1;
        const newReward: Reward = {
          token: resolvedSymbol,
          amount: bounty.amount,
          type: "fixed",
          isfixed: false,
          rewardId: nextRewardId,
          isProtocolBribe: true,
        };
        offer.reward.push(newReward);
        changed = true;
      }
    }
  }

  if (!changed) return "No changes — protocol bounties already up to date";

  bribefile.version = incPatch(bribefile.version);
  const result = await insertBribefile(bribefile, round);
  if (!result) return "Error writing to database";
  return result;
}
