// 期限を過ぎた投票（ボード）を Realtime Database から削除する。GitHub Actions から1日1回動かす。
// - 受付を終えた投票：終えた時刻（結果の表示か締め切りの早いほう）から14日で削除
// - 一度も受付を終えていない投票：作成から30日で削除（締め切りが先の日時なら残す）
// - 時刻の記録がない古い投票：このスクリプトが初めて見つけた時刻を記録し、そこから数える
// 環境変数：FIREBASE_SERVICE_ACCOUNT（サービスアカウントの鍵のJSON）、FIREBASE_CONFIG（databaseURL を含むJSON）
// DRY_RUN=true のときは、何を消すかを表示するだけで書き込まない。
import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const DAY = 24 * 60 * 60 * 1000;
const CLOSED_TTL = 14 * DAY;
const OPEN_TTL = 30 * DAY;
const dryRun = process.env.DRY_RUN === "true";

function readJson(name) {
  const raw = process.env[name];
  if (!raw) throw new Error(`Secret ${name} が登録されていません`);
  try { return JSON.parse(raw); } catch (e) { throw new Error(`${name} がJSONとして読めません`); }
}

const { databaseURL } = readJson("FIREBASE_CONFIG");
initializeApp({ credential: cert(readJson("FIREBASE_SERVICE_ACCOUNT")), databaseURL });
const db = getDatabase();

const now = Date.now();
const rooms = (await db.ref("rooms").get()).val() || {};
const hosts = (await db.ref("hosts").get()).val() || {};

const changes = {};
const removed = [];
for (const [id, r] of Object.entries(rooms)) {
  const meta = r.meta || {};
  const state = r.state || {};
  const deadline = typeof meta.deadline === "number" ? meta.deadline : null;

  // 受付を終えた時刻（結果の表示と締め切りのうち、早いほう）
  const ends = [];
  if (state.revealed === true) {
    if (typeof state.closedAt === "number") ends.push(state.closedAt);
    else changes[`rooms/${id}/state/closedAt`] = now; // 古い投票：今を終了時刻とみなす
  }
  if (deadline !== null && deadline <= now) ends.push(deadline);

  let expired;
  if (ends.length) {
    expired = now - Math.min(...ends) >= CLOSED_TTL;
  } else if (state.revealed === true) {
    expired = false;                   // 今回 closedAt を記録した。次回から数える
  } else if (deadline !== null) {
    expired = false;                   // 締め切りがまだ先
  } else if (typeof meta.createdAt === "number") {
    expired = now - meta.createdAt >= OPEN_TTL;
  } else {
    changes[`rooms/${id}/meta/createdAt`] = now; // 古い投票：今を作成時刻とみなす
    expired = false;
  }

  if (expired) {
    removed.push(`${id}（${meta.title || "無題"}）`);
    // 同じ投票の中の書き込みと、投票ごとの削除は一緒に送れないので、記録のほうを取り消す
    delete changes[`rooms/${id}/state/closedAt`];
    delete changes[`rooms/${id}/meta/createdAt`];
    changes[`rooms/${id}`] = null;
  }
}

// 削除する投票を指している進行役用の秘密キーも消す。行き先のない秘密キーもここで片づける
for (const [key, h] of Object.entries(hosts)) {
  const target = h && h.room;
  if (!target || !rooms[target] || changes[`rooms/${target}`] === null) changes[`hosts/${key}`] = null;
}

console.log(`投票 ${Object.keys(rooms).length}件のうち、削除 ${removed.length}件`);
for (const line of removed) console.log(`  削除：${line}`);
const marks = Object.entries(changes).filter(([, v]) => v !== null).length;
if (marks) console.log(`時刻の記録がない投票 ${marks}件に、今の時刻を記録`);

if (dryRun) {
  console.log("DRY_RUN のため書き込んでいません");
} else if (Object.keys(changes).length) {
  await db.ref().update(changes);
}
process.exit(0);
