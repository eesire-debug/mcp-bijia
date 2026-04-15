import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// 平台商品结果
interface ProductResult {
  title: string;
  price: number;
  platform: string;
  url: string;
  commission?: number;
  available: boolean;
}

// 搜索结果
interface SearchResult {
  success: boolean;
  query: string;
  results_count: number;
  data: ProductResult[];
  error?: string;
}

// TODO: 接入真实 API
async function searchTaobao(query: string, limit: number): Promise<ProductResult[]> {
  return [
    {
      title: `${query} — 淘宝推荐`,
      price: 0,
      platform: "淘宝",
      url: `https://s.taobao.com/search?q=${encodeURIComponent(query)}`,
      available: false,
    },
  ];
}

async function searchJD(query: string, limit: number): Promise<ProductResult[]> {
  return [
    {
      title: `${query} — 京东推荐`,
      price: 0,
      platform: "京东",
      url: `https://search.jd.com/Search?keyword=${encodeURIComponent(query)}`,
      available: false,
    },
  ];
}

async function searchPinduoduo(query: string, limit: number): Promise<ProductResult[]> {
  return [
    {
      title: `${query} — 拼多多推荐`,
      price: 0,
      platform: "拼多多",
      url: `https://youhui.pinduoduo.com/search/search?keyword=${encodeURIComponent(query)}`,
      available: false,
    },
  ];
}

async function searchAllPlatforms(
  query: string,
  platforms: string[],
  limit: number
): Promise<ProductResult[]> {
  const results: ProductResult[] = [];

  const tasks: Promise<ProductResult[]>[] = [];
  if (platforms.includes("taobao") || platforms.includes("all")) {
    tasks.push(searchTaobao(query, limit));
  }
  if (platforms.includes("jd") || platforms.includes("all")) {
    tasks.push(searchJD(query, limit));
  }
  if (platforms.includes("pinduoduo") || platforms.includes("all")) {
    tasks.push(searchPinduoduo(query, limit));
  }

  const settled = await Promise.allSettled(tasks);
  for (const s of settled) {
    if (s.status === "fulfilled") {
      results.push(...s.value);
    }
  }

  return results
    .filter((r) => r.available)
    .sort((a, b) => a.price - b.price)
    .slice(0, limit);
}

const TOOLS = [
  {
    name: "search_products",
    description:
      "搜索商品在多个电商平台的最低价，返回按价格排序的结果列表。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "商品名称或关键词" },
        platforms: {
          type: "array",
          items: { type: "string", enum: ["taobao", "jd", "pinduoduo", "all"] },
          default: ["all"],
          description: "搜索的平台",
        },
        limit: { type: "number", default: 10, description: "每个平台最多返回数量" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_lowest_price",
    description: "获取单个商品在全网的最低价及购买链接。",
    inputSchema: {
      type: "object",
      properties: {
        product_name: { type: "string", description: "商品名称" },
      },
      required: ["product_name"],
    },
  },
  {
    name: "get_affiliate_link",
    description: "将淘宝/京东商品 URL 转换为带返利链接。",
    inputSchema: {
      type: "object",
      properties: {
        product_url: { type: "string", description: "原始商品页面 URL" },
        platform: { type: "string", enum: ["taobao", "jd"], default: "taobao" },
      },
      required: ["product_url"],
    },
  },
];

const server = new Server(
  { name: "mcp-bijia", version: "0.1.0" },
  {
    capabilities: { tools: {} },
  }
);

server.setRequestHandler(ListToolsRequestSchema, () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (name === "search_products") {
      const { query, platforms = ["all"], limit = 10 } = args as {
        query: string;
        platforms?: string[];
        limit?: number;
      };
      const results = await searchAllPlatforms(query, platforms, limit);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                query,
                results_count: results.length,
                data: results,
              } as SearchResult,
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "get_lowest_price") {
      const { product_name } = args as { product_name: string };
      const results = await searchAllPlatforms(product_name, ["all"], 20);
      const lowest = results.filter((r) => r.available).sort((a, b) => a.price - b.price)[0];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                product_name,
                lowest: lowest || null,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "get_affiliate_link") {
      const { product_url, platform = "taobao" } = args as {
        product_url: string;
        platform?: string;
      };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "affiliate_api_not_implemented",
              message: "返利链接转换需要配置 API 凭证。请设置 TAOBAO_APPKEY / TAOBAO_APPSECRET 环境变量。",
              original_url: product_url,
              platform,
            }),
          },
        ],
      };
    }

    return {
      content: [{ type: "text", text: `未知工具: ${name}` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `错误: ${error}` }],
      isError: true,
    };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
