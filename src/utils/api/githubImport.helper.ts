import type { Bribedata, Bribefile, Reward, Tokendata } from "types/bribedata.raw";
import { insertBribefile, readOneBribefile } from "utils/database/bribefile.db";
import { findConfigEntry } from "utils/database/config.db";
import { getSnapshotProposal } from "utils/externalData/snapshot";
import { getAutomationData } from "utils/externalData/github";
import { getFancyPoolName, getTokenSymbol } from "utils/externalData/beetsBack";
import { setTokenEntry } from "utils/database/tokens.db";
import { readRoundPoolentries } from "utils/database/votablePools.db";
import { getPoolUrl } from "utils/api/round.helper";
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
    g => g.protocolBounties && g.protocolBounties.some(b => b.amount > 0)
  );
  if (gaugesWithBounties.length === 0) return "No protocol bounties found for this round";

  const votablePools = await readRoundPoolentries(round);
  let changed = false;

  for (const gauge of gaugesWithBounties) {
    let offer = bribefile.bribedata.find(o => o.poolurl.includes(gauge.poolId));
    if (!offer) {
      const poolEntry = votablePools?.find(p => p.poolName === gauge.poolName);
      if (!poolEntry) {
        console.warn(
          `githubImport: No votable pool entry found for ${gauge.poolName} (${gauge.poolId})`
        );
        continue;
      }
      const nextOfferId =
        bribefile.bribedata.reduce((max, o) => (o.offerId > max ? o.offerId : max), 0) + 1;
      const fancyName = (await getFancyPoolName(gauge.poolId)) || gauge.poolName;
      const newOffer: Bribedata = {
        voteindex: poolEntry.voteindex,
        poolname: fancyName,
        poolurl: getPoolUrl(gauge.poolId),
        rewarddescription: "",
        reward: [],
        offerId: nextOfferId,
        payoutthreshold: -1,
      };
      bribefile.bribedata.push(newOffer);
      offer = newOffer;
    }

    // build description from non-zero bounties
    let descriptionParts: string[] = [];

    for (const bounty of gauge.protocolBounties ?? []) {
      if (bounty.amount === 0) continue;

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

      descriptionParts.push(`${bounty.amount.toFixed()} $${symbol}`);

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

    // update rewarddescription if we have non-zero bounties
    if (descriptionParts.length > 0) {
      const newDescription =
        "Vote for " + gauge.poolName + " to get a share of " + descriptionParts.join(" and ");
      if (offer.rewarddescription !== newDescription) {
        offer.rewarddescription = newDescription;
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