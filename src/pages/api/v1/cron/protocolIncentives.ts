import type { NextApiRequest, NextApiResponse } from "next";
import processGithubImport from "utils/api/githubImport.helper";
import { insertCronLog } from "utils/database/cronLog.db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(501).send("not implemented");

  const data = await processGithubImport();

  const now = Date.now();
  const dateReadable = new Date(now).toUTCString();
  await insertCronLog({
    timestamp: Math.floor(now / 1000),
    jobName: "protocolIncentives",
    dateReadable,
  });

  res.send(JSON.stringify(data, null, "  "));
}
