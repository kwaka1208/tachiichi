# セットアップ
1. Firebaseコンソールでプロジェクトを作り、Realtime Database を作成する
2. config.example.js を config.js という名前でコピーし、「ウェブアプリを追加」で表示される設定値に書き換える（config.js は .gitignore で除外している）
3. Authentication の「Sign-in method」で「匿名」を有効にする（ボードをつくった人だけが進行役の操作をでき、参加者が自分の票だけを書き換えられるようにするため）
4. Realtime Database の「ルール」に以下を貼り付けて公開する

  ```json
{
  "rules": {
    "hosts": {
      "$key": {
        ".read": true,
        ".write": "auth != null && !data.exists()",
        ".validate": "$key.length >= 20 && newData.child('room').isString() && newData.parent().parent().child('rooms').child(newData.child('room').val()).child('meta/owner').val() === auth.uid",
        "room": { ".validate": true },
        "$other": { ".validate": false }
      }
    },
    "rooms": {
      "$room": {
        ".read": true,
        "meta": {
          ".write": "auth != null && !data.exists()",
          ".validate": "newData.hasChildren(['title','xl','xr','yb','yt','owner'])",
          "owner": { ".validate": "newData.val() === auth.uid" },
          "anon": { ".validate": "newData.isBoolean()" },
          "deadline": { ".validate": "newData.isNumber()" },
          "createdAt": { ".validate": "newData.val() === now" },
          "$f": { ".validate": "newData.isString() && newData.val().length <= 40" }
        },
        "state": {
          ".write": "auth != null && auth.uid === root.child('rooms').child($room).child('meta/owner').val()",
          "revealed": { ".validate": "newData.isBoolean()" },
          "closedAt": { ".validate": "newData.val() === now" },
          "$other": { ".validate": false }
        },
        "votes": {
          "$vote": {
            ".write": "auth != null && ((!newData.exists() && auth.uid === root.child('rooms').child($room).child('meta/owner').val()) || (newData.exists() && (!data.exists() || data.child('uid').val() === auth.uid) && root.child('rooms').child($room).child('state/revealed').val() !== true && (!root.child('rooms').child($room).child('meta/deadline').exists() || now < root.child('rooms').child($room).child('meta/deadline').val())))",
            ".validate": "newData.hasChildren(['x','y','uid']) && newData.hasChild('name') === (root.child('rooms').child($room).child('meta/anon').val() !== true)",
            "x": { ".validate": "newData.isNumber() && newData.val() >= -100 && newData.val() <= 100" },
            "y": { ".validate": "newData.isNumber() && newData.val() >= -100 && newData.val() <= 100" },
            "uid": { ".validate": "newData.val() === auth.uid" },
            "name": { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 10" },
            "$other": { ".validate": false }
          }
        }
      }
    }
  }
}
```
