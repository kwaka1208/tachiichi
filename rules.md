# セットアップ
1. Firebaseコンソールでプロジェクトを作り、Realtime Database を作成する
2. config.example.js を config.js という名前でコピーし、「ウェブアプリを追加」で表示される設定値に書き換える（config.js は .gitignore で除外している）
3. Realtime Database の「ルール」に以下を貼り付けて公開する

  ```json
{
  "rules": {
    "rooms": {
      "$room": {
        ".read": true,
        "meta": {
          ".write": "!data.exists()",
          ".validate": "newData.hasChildren(['title','xl','xr','yb','yt'])",
          "$f": { ".validate": "newData.isString() && newData.val().length <= 40" }
        },
        "state": {
          ".write": true,
          "revealed": { ".validate": "newData.isBoolean()" },
          "$other": { ".validate": false }
        },
        "votes": {
          "$vote": {
            ".write": "!newData.exists() || root.child('rooms').child($room).child('state/revealed').val() !== true",
            ".validate": "newData.hasChildren(['x','y','name'])",
            "x": { ".validate": "newData.isNumber() && newData.val() >= -100 && newData.val() <= 100" },
            "y": { ".validate": "newData.isNumber() && newData.val() >= -100 && newData.val() <= 100" },
            "name": { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 10" },
            "$other": { ".validate": false }
          }
        }
      }
    }
  }
}
```
