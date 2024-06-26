import type { NextApiRequest, NextApiResponse } from "next";
import getBribeData from "utils/api/bribedata.helper";
import processHiddenhandApi from "utils/api/hiddenhand.helper";
import { findConfigEntry } from "utils/database/config.db";
import { insertCronLog } from "utils/database/cronLog.db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(501).send("not implemented");
  }
  const round = await findConfigEntry("latest");
  if (!round) {
    return res.status(500).send("data retrieval failed");
  }
  const bd = await getBribeData(+round);
  if (!bd) {
    return res.status(500).send("data retrieval failed");
  }
  const now = Date.now();
  if (now > bd.header.voteEnd) {
    return res.status(503).send("No active vote period found");
  }
  const data = await processHiddenhandApi();
  if (!data) {
    return res.status(404).send("No object with given ID found");
  }
  const dateReadable = new Date(now).toUTCString();
  await insertCronLog({ timestamp: Math.floor(now / 1000), jobName: "hiddenhand", dateReadable });
  res.send(JSON.stringify(data, null, "  "));
}
