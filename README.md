# bilibili-live-monitor (b站舰长、抽奖监听) 
![Github](https://img.shields.io/github/license/Billyzou0741326/bilibili-live-raffle-monitor)
![Github](https://img.shields.io/badge/nodejs-8.6.1-blue)

## Info
 - 运行于本地localhost的JS版b站舰长监听
 - 此程序无需用户提供账号信息 且不收集任何数据  
 - [bilibili-raffle](https://github.com/Billyzou0741326/bilibili-raffle)为此项目的client
 - 覆盖率: null (未统计)

## Features
 - 推送监听到的舰长、达到可抽奖时间段的高能信息
 - 以websocket推送高能信息 (默认接口8999；用127.0.0.1不连接外网，推送范围仅限本机)
 - 以http返回json视图的**未过期**舰长/提督/总督 (默认接口9001；用127.0.0.1本机推送)

## Limitations
 - 覆盖率你们说了算23333

## Getting Started

### Requirements  
 - 运行环境[node.js](https://nodejs.org/en/download/)

### Execution (运行方式)  
运行方式 (1) - 推荐
 1. 命令行切换到package.json所在的目录
 2. `npm install`                    (执行一次就好)
 3. `node ./src/main.js`             (正常运行)
 4. `node ./src/main.js -v`          (显示更多信息 !刷屏警告)
 5. `node ./src/main.js --debug`     (显示对debug有帮助的信息(自认为) !刷屏警告)
 6. 运行后可以进浏览器<http://127.0.0.1:9001/guard>查看可领取范围内的舰长 (可能要等会)

运行方式 (2) - 不会用命令行可以用这种方法
 1. 右键`run.ps1`, 用powershell运行

### Config file 设置 (/settings.json)

```javascript
{
    "wsServer": {
        "ip": "127.0.0.1",      // 本地localhost推送；0.0.0.0可与外网相连
        "port": 8999            // 选个接口 (client配对)
    },
    "httpServer": {
        "ip": "127.0.0.1",      // 同上
        "port": 9001            // 换个别的也可以 (client配对)
    }
}
```
 
### Docker
docker run --publish 8999:8999 <image-name>

## Bug report  
有问题可以来[Issue](https://github.com/Billyzou0741326/bilibili-live-monitor-js/issues)聊天  
有大问题可以炸我邮箱<zouguanhan@gmail.com>  
