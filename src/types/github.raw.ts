import * as z from "zod";

export const ProtocolBounty = z.object({
  tokenAddress: z.string(),
  amount: z.number(),
});
export type ProtocolBounty = z.infer<typeof ProtocolBounty>;

export const Gauge = z.object({
  poolName: z.string(),
  poolId: z.string(),
  weeklyBeetsAmountFromGauge: z.union([z.number(), z.string()]).optional(),
  weeklyBeetsAmountFromMD: z.union([z.number(), z.string()]).optional(),
  weeklyStSRewards: z.union([z.number(), z.string()]).optional(),
  weeklyStSRewardsFromSeasons: z.union([z.number(), z.string()]).optional(),
  weeklyFragmentsRewards: z.union([z.number(), z.string()]).optional(),
  protocolBounties: z.array(ProtocolBounty).optional(),
});

export type Gauge = z.infer<typeof Gauge>;

export const Automation = z.object({
  beetsToDistribute: z.union([z.number(), z.string()]).nullable(), // number or string, may be null or undefined
  startTimestamp: z.number(),
  endTimestamp: z.number(),
  snapshotBlock: z.number(),
  gauges: z.array(Gauge),
});

export type Automation = z.infer<typeof Automation>;
