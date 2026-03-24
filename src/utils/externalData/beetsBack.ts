import { request, gql } from "graphql-request";

// get historic price for single token
export async function getTokenPrice(timestamp: number, address: string): Promise<number> {
  type PriceEntry = { price: number; timestamp: string };
  type HistoricalPrice = { address: string; prices: PriceEntry[] };
  const queryUrl = "https://backend-v3.beets-ftm-node.com/graphql";
  const query = gql`
    query Chartdata {
      tokenGetHistoricalPrices(
        addresses: ["${address.toLowerCase()}"]
        range: THIRTY_DAY
        chain: SONIC
      ) {
        address
        prices {
          price
          timestamp
        }
      }
    }
  `;
  try {
    const { tokenGetHistoricalPrices } = (await request(queryUrl, query)) as {
      tokenGetHistoricalPrices: HistoricalPrice[];
    };
    const tokenData = tokenGetHistoricalPrices.find(
      t => t.address.toLowerCase() === address.toLowerCase()
    );
    if (!tokenData?.prices.length) return 0;
    const result = tokenData.prices.reduce(
      (max, current) => {
        const currentTs = Number(current.timestamp);
        if (currentTs <= timestamp && currentTs > Number(max.timestamp)) {
          return current;
        }
        return max;
      },
      { price: 0, timestamp: "0" }
    );
    return +result.price;
  } catch (error) {
    console.error("Beetswars backend: ", error);
    return 0;
  }
}

// get historic price for BPT pool
export async function getPoolPriceHist(timestamp: number, address: string): Promise<number> {
  type PoolChartdata = { sharePrice: string; timestamp: number };
  const queryUrl = "https://backend-v3.beets-ftm-node.com/graphql";
  const query = gql`
    query PoolData {
      poolGetSnapshots(
        id: "${address}"
        range: THIRTY_DAYS
        chain: SONIC
      ) {
        sharePrice
        timestamp
      }
    }
  `;
  try {
    const { poolGetSnapshots } = (await request(queryUrl, query)) as {
      poolGetSnapshots: PoolChartdata[];
    };
    const result = poolGetSnapshots.reduce(
      (max, current) => {
        if (Number(current.timestamp) <= timestamp && Number(current.timestamp) > max.timestamp) {
          return current;
        }
        return max;
      },
      { sharePrice: "", timestamp: 0 }
    );
    return +result.sharePrice;
  } catch (error) {
    console.error("Beetswars backend: ", error);
    return 0;
  }
}

// get current price for BPT pool
export async function getPoolPriceLive(address: string): Promise<number> {
  type PoolData = {
    dynamicData: {
      totalLiquidity: string;
      totalShares: number;
    };
  };
  const queryUrl = "https://backend-v3.beets-ftm-node.com/graphql";
  const query = gql`
    query PoolData {
      poolGetPool(
        id: "${address}"
        chain: SONIC
      ) {
        dynamicData{
          totalLiquidity
          totalShares
        }
      }
    }
  `;
  try {
    const { poolGetPool } = (await request(queryUrl, query)) as {
      poolGetPool: PoolData;
    };
    const result =
      Number(poolGetPool.dynamicData.totalLiquidity) / Number(poolGetPool.dynamicData.totalShares);
    return result;
  } catch (error) {
    console.error("Beetswars backend: ", error);
    return 0;
  }
}

// get current price for single token
export async function getTokenPriceLive(address: string): Promise<number> {
  type TokenData = {
      address: string;
      price: number;
  };
  const queryUrl = "https://backend-v3.beets-ftm-node.com/graphql";
  const query = gql`
  query TokenPrice {
    tokenGetCurrentPrices(
      chains: SONIC
    )
    {
      address
      price
    }
  }
  `;
  try {
    const { tokenGetCurrentPrices } = (await request(queryUrl, query)) as {
      tokenGetCurrentPrices: TokenData[];
    };
    const token = tokenGetCurrentPrices.find(tkn => tkn.address == address);
    const result = token?.price || 0;
    return result;
  } catch (error) {
    console.error("Beetswars backend getTokenPriceLive: ", error);
    return 0;
  }
}

export async function getTokenSymbol(address: string): Promise<string | null> {
  type TokenData = { address: string; symbol: string };
  const queryUrl = "https://backend-v3.beets-ftm-node.com/graphql";
  const query = gql`
    query TokenSymbol {
      tokenGetTokens(chains: [SONIC]) {
        address
        symbol
      }
    }
  `;
  try {
    const { tokenGetTokens } = (await request(queryUrl, query)) as {
      tokenGetTokens: TokenData[];
    };
    const token = tokenGetTokens.find(t => t.address.toLowerCase() === address.toLowerCase());
    return token?.symbol ?? null;
  } catch (error) {
    console.error("Beetswars backend getTokenSymbol: ", error);
    return null;
  }
}

export async function getFancyPoolName(id: string): Promise<string> {
  const queryUrl = "https://backend-v3.beets-ftm-node.com/graphql";
  const query = gql`
    query PoolData {
      poolGetPool(
        id: "${id}"
        chain: SONIC
      ) {
        name
      }
    }
  `;
  try {
    const { poolGetPool } = (await request(queryUrl, query)) as {
      poolGetPool: { name: string };
    };
    return poolGetPool.name;
  } catch (error) {
    console.error("Beetswars backend getFancyPoolName: ", error);
    return "no name";
  }
}