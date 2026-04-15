# SKILL.md — mcp-bijia

## Identity

**Name**: bijia (比价)
**Type**: MCP server
**Description**: 中文电商全网最低价查询，对接淘宝/京东/拼多多，返回价格排序和购买链接

## Trigger

用户想比较商品价格、或查找最低价购买渠道：
- "帮我比比价"
- "这个东西哪个平台最便宜"
- "iPhone 15 哪个渠道买划算"
- 用户表达了购买意向，需要找到最优价格

## Tools

### `search_products`

输入商品名称，返回多平台价格列表。

**请求:**
```json
{
  "query": "商品名称",
  "platforms": ["taobao", "jd", "pinduoduo"],
  "limit": 10
}
```

**返回:** 按价格升序排列的商品列表：
```json
{
  "success": true,
  "query": "iPhone 15",
  "results": [
    {
      "title": "Apple iPhone 15 128GB 黑色",
      "price": 4599,
      "platform": "淘宝",
      "url": "https://s.click.taobao.com/...",
      "commission": 46.00
    },
    {
      "title": "Apple iPhone 15 128GB 黑色",
      "price": 4629,
      "platform": "京东",
      "url": "https://union.jd.com/...",
      "commission": 46.29
    }
  ]
}
```

### `get_lowest_price`

获取单个商品的最低价。

**请求:**
```json
{
  "product_name": "Dyson V15 吸尘器"
}
```

**返回:** 最低价结果 + 购买链接。

### `price_alert`

设置价格监控，降价时通知。

**请求:**
```json
{
  "product_name": "Switch OLED",
  "target_price": 1800,
  "notify_via": "agent"
}
```

## 数据来源

| 平台 | 数据接口 | 返利 | 说明 |
|------|---------|------|------|
| 淘宝/天猫 | 淘宝联盟 API | ✅ | 需阿里妈妈推广者资格 |
| 京东 | 京东联盟 API | ✅ | 需京东联盟资格 |
| 拼多多 | 多多进宝 API | ✅ | 需多多进宝资格 |
| 慢慢买 | 付费数据库 | ❌ | 付费数据，稳定全网 |

## 环境变量

```bash
TAOBAO_APPKEY=      # 淘宝开放平台应用key
TAOBAO_APPSECRET=   # 淘宝开放平台应用密钥
JD_APPKEY=          # 京东联盟应用key
JD_SECRET=          # 京东联盟应用密钥
```

## 错误处理

- 平台 API 超时：返回部分可用结果，标记 `available: false`
- 无结果：返回空数组 + `suggestion` 字段
- 频率限制：指数退避，最多重试 3 次
