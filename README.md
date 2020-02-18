# bilibili-live-monitor (b站舰长、抽奖监听)
![Github](https://img.shields.io/github/license/Billyzou0741326/bilibili-live-raffle-monitor)
![Github](https://img.shields.io/badge/nodejs-10.16.3-blue)

## Info
 - 运行于本地localhost的JS版b站舰长监听
 - 此程序无需用户提供账号信息 且不收集任何数据
 - [bilibili-raffle-js](https://github.com/Billyzou0741326/bilibili-raffle-js)为此项目的client
 - 覆盖率: null (未统计)

## Features
 - 推送监听到的舰长、达到可抽奖时间段的高能信息
 - 以websocket推送高能信息 (默认接口8999；用127.0.0.1不连接外网，推送范围仅限本机)
 - 以http返回json视图的**未过期**舰长/提督/总督 (默认接口9001；用127.0.0.1本机推送)

## Limitations
 - 覆盖率你们说了算23333

# Getting Started

## Requirements
 - 运行环境[node.js](https://nodejs.org/en/download/)

## Execution (运行方式)
### 运行方式 (1) - 推荐 [进程管理]
 1. `npm install pm2 -g`            (执行一次就好)
 2. `pm2 start ecosystem.config.js` (以pm2进程管理运行程序, 内置自动重启)
 - `pm2 ls`                             (查看运行状态、基础信息 id和name在此显示)
 - `pm2 restart [id|name]`              (重启id进程)
 - `pm2 stop [id|name]`                 (停止id进程)
 - `pm2 delete [id|name]`               (删除id进程)
 - `pm2 logs [id|name] --lines [x]`     (显示id进程的x行日志) (ctrl-c退出状态)

### 运行方式 (2) - 无进程管理与自动重启
 1. 命令行切换到package.json所在的目录
 2. `npm install`                    (执行一次就好)
 3. `node ./src/main.js`             (正常运行)
 4. `node ./src/main.js -v`          (显示获取到x个动态房间)
 5. `node ./src/main.js --debug`     (显示对debug有帮助的信息(自认为) !刷屏警告)
 6. 运行后可以进浏览器<http://{ip}:9001/guard>查看可领取范围内的大航海奖励, <http://{ip}:9001/gift>查看可领取范围内的抽奖 (可能要等会), <http://{ip}:9001/pk>查看可领取范围内的大乱斗奖励

### 运行方式 (3) - 不会用命令行可以用这种方法
 1. 右键`run.ps1`, 用powershell运行

## Config file 设置 (/settings.json)

```javascript
{
    "wsServer": {
        "self": {
            "ip": "127.0.0.1",              // 本地localhost推送；0.0.0.0可与外网相连
            "port": 8999                    // 选个接口 (client配对)
        },
        "bilive": {                         // 兼容bilive_client的ws服务器
            "ip": "127.0.0.1",              // 本地localhost推送；0.0.0.0可与外网相连
            "port": 8998                    // 选个接口 (client配对)
        },
        "bilihelper": {                     // 还不支持
            "ip": "127.0.0.1",
            "port": 8997
        }
    },
    "httpServer": {
        "ip": "127.0.0.1",                  // 同上
        "port": 9001                        // 换个别的也可以 (client配对)
    },
    "bilibiliIPTracker": {                  // 支持IP掉线检测和智能动态分配
        "trackIPs": true,                   // 使用或禁用本功能
        "dnsFailureRetries": 3,             // DNS解析错误时重试次数
        "dnsFailureRetryDelay": 5,          // DNS解析错误时重试延时，默认5秒
        "staticUpdateInterval": 60,         // 静态更新掉线统计间隔时长，默认60秒
        "dynamicUpdateThreashold": 100,     // 动态更新掉线统计阈值。总掉线数达到此值将触发IP重新分配
        "unreliableHostThreashold": 5,      // 可用IP掉线偏差阈值。每次更新时IP掉线数相较于最好的IP在偏差范围内的可被分配。数字越大得到的好IP越多，连接数越平均
        "unusableNetworkThreshold": 0,      // 网络可用判定最小掉线数阈值。每次更新时如果最好的IP掉线数仍旧达到此值将视为当前网络不可用。默认值为0，不进行检测
        "exitWhenNetworkUnusable": false    // 检测到网络不可用时是否退出运行。只有在unusableNetworkThreshold有设置的情况下生效
    }
}
```

### Docker
docker run --publish 8999:8999 --publish 9001:9001 <image-name>

## Bug report
有问题可以来[Issue](https://github.com/Billyzou0741326/bilibili-live-monitor-js/issues)聊天
有大问题可以炸我邮箱<zouguanhan@gmail.com>
