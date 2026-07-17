# 微信云托管部署指南

## 📋 前置准备

### 1. 服务容器状态
✅ **已完成**：Docker 镜像已构建并验证通过（v0.6, 140MB）
- 本地镜像标签：`word-memory-miniapp:latest`
- API 端点全部验证通过（9/9）

### 2. 代码位置
📁 **标准路径**: `/root/.hermes/project/docker_lib/word-memory-api/`
```bash
cd /root/.hermes/project/docker_lib/word-memory-api/
```

### 3. 环境变量配置
🔧 **待配置**: 复制 `.env.example` 并填写实际值
```bash
cp .env.example .env
# 修改 DATABASE_PASSWORD 等敏感信息
```

---

## 🚀 微信云托管部署步骤

### 步骤 1: 登录微信开发者工具

1. 打开 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 使用开发者账号扫码登录
3. 导入项目：`/opt/win_hermes/word_memory_miniapp`

### 步骤 2: 进入云托管控制台

1. 在开发者工具顶部菜单栏选择 **"云开发"**
2. 进入云托管控制台（如果没有显示，需要先开通云开发服务）
3. 点击 **"新建服务"**

### 步骤 3: 配置服务基本信息

| 字段 | 值 |
|------|-----|
| 服务名称 | `word-memory-api` |
| 服务版本 | `v1.0.0` |
| 运行环境 | `mytx` (你的云开发环境 ID) |
| 实例规格 | `基础版 -1 核 512M` (新手免费额度内) |

### 步骤 4: 上传 Docker 镜像

#### 方式 A: 本地构建上传（推荐）

```bash
# 1. 确保在正确目录
cd /root/.hermes/project/docker_lib/word-memory-api/

# 2. 确认环境变量已配置
cat .env

# 3. 重新构建最新镜像
docker build --no-cache -t word-memory-miniapp:latest .

# 4. 登录腾讯云容器镜像服务
docker login ccr.ccs.tencentyun.com -u <腾讯云账号ID> -p <腾讯云密钥>

# 5. 重新打标签
docker tag word-memory-miniapp:latest ccr.ccs.tencentyun.com/<你的命名空间>/word-memory-api:v1.0.0

# 6. 推送镜像
docker push ccr.ccs.tencentyun.com/<你的命名空间>/word-memory-api:v1.0.0
```

#### 方式 B: 微信开发者工具直接上传（简易模式）

1. 在云托管控制台选择 **"上传镜像"**
2. 选择 **"本地镜像"**
3. 输入镜像名：`word-memory-miniapp:latest`
4. 工具会自动打包上传（需网络通畅）

### 步骤 5: 配置环境变量

在云托管控制台的服务配置页面，添加以下环境变量：

```bash
NODE_ENV=production
DATABASE_HOST=sh-cynosdbmysql-grp-80l7mu8u.sql.tencentcdb.com
DATABASE_PORT=27780
DATABASE_USER=word_memory_app
DATABASE_PASSWORD=Root_123  # 替换为实际密码
DATABASE_NAME=mytx-d7gw0vhq4414988b5
```

⚠️ **安全提示**: 生产环境务必使用真实密码！

### 步骤 6: 配置服务端口

- **暴露端口**: `3000`
- **健康检查路径**: `/health`
- **健康检查间隔**: `30s`
- **启动超时**: `180s`

### 步骤 7: 访问域名配置

1. 云托管会自动分配一个临时域名：`https://xxxxxxx.wxcloudrun.com`
2. 如需自定义域名，需在 "域名管理" 中绑定
3. **重要**: 需要在微信后台配置服务器域名白名单：
   - 业务域名设置中添加你的云托管域名
   - 或使用微信云托管的默认域名（无需额外配置）

### 步骤 8: 启动服务

1. 点击 **"保存并启动"**
2. 等待部署完成（约 3-5 分钟）
3. 查看日志确认服务正常：
   ```
   Status: Running
   Health: Healthy
   ```

---

## 🔄 更新服务版本

每次修改代码后按以下步骤更新：

```bash
# 1. 本地构建新版本
cd /root/.hermes/project/docker_lib/word-memory-api/
docker build --no-cache -t word-memory-miniapp:latest .

# 2. 打上版本标签
docker tag word-memory-miniapp:latest ccr.ccs.tencentyun.com/<namespace>/word-memory-api:v1.0.<N>

# 3. 推送
docker push ccr.ccs.tencentyun.com/<namespace>/word-memory-api:v1.0.<N>

# 4. 在微信开发者工具中：
#    - 云托管控制台 → 选择服务 → "更新版本"
#    - 选择新镜像 → 滚动发布
```

---

## 🧪 验证部署成功

### 方法 1: 云托管控制台在线测试

1. 进入服务详情页面
2. 点击 **"API 测试"**
3. 请求：
   ```http
   GET https://your-domain.wxcloudrun.com/health
   ```

### 方法 2: 小程序内部调用

修改小程序代码中的调用方式（见下方"前端对接"章节）

### 方法 3: 外部 curl 测试

```bash
curl -H "x-test-openid: test-user-001" https://your-domain.wxcloudrun.com/api/v1/word_sets
```

---

## 💻 前端对接（可选）

如果要将小程序前端从云函数切换到云托管：

### 修改 `utils/api.js` 或相关服务文件

**旧代码**（云函数）：
```javascript
wx.cloud.callFunction({
  name: 'word_sets',
  data: { action: 'list' }
})
```

**新代码**（云托管）：
```javascript
const apiBase = 'https://your-domain.wxcloudrun.com/api/v1'

wx.request({
  url: `${apiBase}/word_sets`,
  header: {
    'x-wx-openid': openId  // 从 wx.login() 获取
  },
  success: res => {
    console.log(res.data)
  }
})
```

或者封装统一方法：
```javascript
// utils/container-api.js
export function callContainer(action, data = {}, method = 'GET') {
  const apiBase = 'https://your-domain.wxcloudrun.com/api/v1'
  
  return new Promise((resolve, reject) => {
    wx.getProvider({
      service: 'wx.cloud',
      success: providerRes => {
        wx.cloud.getOpenId().then(openId => {
          wx.request({
            url: `${apiBase}/${action}`,
            method: method,
            header: {
              'x-wx-openid': openId,
              'Content-Type': 'application/json'
            },
            data: method !== 'GET' ? data : undefined,
            success: res => resolve(res.data),
            fail: err => reject(err)
          })
        })
      }
    })
  })
}
```

---

## 💰 费用说明

### 微信云托管定价（2026 年）

| 资源 | 单价 | 免费额度 |
|------|------|---------|
| CPU | 0.0003 元/秒 | 100 小时/月 |
| 内存 | 0.0006 元/GB/秒 | 512MB × 100 小时/月 |
| 公网流量 | 0.8 元/GB | 无 |

### 预估成本（单词记忆系统）

假设日均活跃用户 100 人：
- **CPU**: ~500 小时/月 ≈ 150 元（超出免费额度）
- **内存**: ~512MB × 500 小时 ≈ 80 元
- **流量**: ~20GB/月 ≈ 16 元

**总计**: ~246 元/月

💡 **优化建议**: 
- 使用自动缩放到 0 节省空闲资源成本
- 合理设置实例规格（512MB 起步足够）

---

## ⚠️ 常见问题

### Q1: 上传镜像失败
**A**: 检查网络连接；尝试缩小镜像体积（使用 alpine base）

### Q2: 服务启动后一直 unhealthy
**A**: 检查 `/health` 接口是否正常响应；查看容器日志定位错误

### Q3: 数据库连接超时
**A**: CynosDB 需要在腾讯云控制台添加白名单（允许云托管 IP 段）

### Q4: 小程序无法访问云托管
**A**: 确认域名已在微信公众平台添加到 "服务器域名" 白名单

---

## 📞 技术支持

遇到问题可查看：
- [微信云托管官方文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloudaa/)
- [腾讯云云托管 FAQ](https://cloud.tencent.com/document/product/1265)

---

**作者**: 一帮人马工作室（QQ691481548）  
**更新时间**: 2026-07-15  
**版本**: v1.0.0
