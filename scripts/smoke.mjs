/**
 * 业务规则冒烟测试（需要服务已启动）。
 *   npm run dev
 *   npm run smoke            # 默认 http://127.0.0.1:3000
 *   BASE=http://127.0.0.1:3100 npm run smoke
 */
const BASE = process.env.BASE || "http://127.0.0.1:3000";
let pass = 0;
let fail = 0;

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

async function login(email) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "demo1234" }),
  });
  if (!res.ok) throw new Error(`登录失败 ${email}: ${res.status}`);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function call(cookie, path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init.headers || {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function check(name, cond, extra = "") {
  if (cond) {
    pass += 1;
    console.log(`  ${green("✓")} ${name}`);
  } else {
    fail += 1;
    console.log(`  ${red("✗")} ${name} ${dim(extra)}`);
  }
}

console.log(`\nSegmenta 业务规则冒烟测试 → ${BASE}\n`);

const anna = await login("anna@xingye.ai");
const admin = await login("admin@xingye.ai");
const ding = await login("ding@chaoxi.ai");

console.log("[租户隔离]");
const hall = await call(anna, "/api/tasks?scope=hall");
check("标注员能读到本租户任务大厅", hall.status === 200, String(hall.status));
const target = hall.body.tasks[0];
check("大厅里有可领取任务", Boolean(target), "任务大厅为空，请先 reset 数据库");
if (!target) process.exit(1);

const crossTenant = await call(ding, `/api/tasks/${target.id}`);
check("其他租户访问该任务返回 404", crossTenant.status === 404, String(crossTenant.status));

console.log("\n[领取]");
const claim = await call(anna, `/api/tasks/${target.id}/claim`, { method: "POST" });
check("标注员领取任务成功", claim.status === 200, JSON.stringify(claim.body));
const claimAgain = await call(anna, `/api/tasks/${target.id}/claim`, { method: "POST" });
check("重复领取幂等（仍返回 200）", claimAgain.status === 200, String(claimAgain.status));

console.log("\n[片段校验]");
const overlap = await call(anna, `/api/tasks/${target.id}/segments`, {
  method: "PUT",
  body: JSON.stringify({ segments: [{ start: 1, end: 5 }, { start: 3, end: 8 }] }),
});
check("重叠片段被拒绝", overlap.status === 422 && overlap.body.code === "SEGMENT_OVERLAP", JSON.stringify(overlap.body));
const beyond = await call(anna, `/api/tasks/${target.id}/segments`, {
  method: "PUT",
  body: JSON.stringify({ segments: [{ start: 1, end: 100000 }] }),
});
check("超出视频时长被拒绝", beyond.status === 422, JSON.stringify(beyond.body));
const adjacent = await call(anna, `/api/tasks/${target.id}/segments`, {
  method: "PUT",
  body: JSON.stringify({ segments: [{ start: 2, end: 6 }, { start: 6, end: 9.5 }] }),
});
check("首尾相接视为不重叠", adjacent.status === 200, JSON.stringify(adjacent.body).slice(0, 90));

console.log("\n[提交]");
const submitted = await call(anna, `/api/tasks/${target.id}/submit`, {
  method: "POST",
  body: JSON.stringify({ segments: [{ start: 2, end: 6 }, { start: 6, end: 9.5 }] }),
});
check("提交成功", submitted.status === 200, JSON.stringify(submitted.body).slice(0, 90));
check("有效时长 = 7.5 秒", submitted.body?.totalDuration === 7.5, String(submitted.body?.totalDuration));
const resubmit = await call(anna, `/api/tasks/${target.id}/submit`, { method: "POST", body: "{}" });
check("重复提交被拒绝", resubmit.status === 409, String(resubmit.status));
const editLocked = await call(anna, `/api/tasks/${target.id}/segments`, {
  method: "PUT",
  body: JSON.stringify({ segments: [{ start: 1, end: 2 }] }),
});
check("提交后片段锁定", editLocked.status === 409, String(editLocked.status));

console.log("\n[审核]");
const needComment = await call(admin, `/api/tasks/${target.id}/review`, {
  method: "POST",
  body: JSON.stringify({ decision: "REJECT" }),
});
check("退回必须填原因", needComment.status === 422, String(needComment.status));
const rejected = await call(admin, `/api/tasks/${target.id}/review`, {
  method: "POST",
  body: JSON.stringify({ decision: "REJECT", comment: "第 2 段包含空转，请重标" }),
});
check("退回成功", rejected.status === 200, JSON.stringify(rejected.body));
const afterReject = await call(admin, `/api/tasks/${target.id}`);
check("退回后回到进行中", afterReject.body.task.status === "IN_PROGRESS", afterReject.body.task.status);
check("当前版本已作废", afterReject.body.submission == null, JSON.stringify(afterReject.body.submission));
const resubmitAfterReject = await call(anna, `/api/tasks/${target.id}/submit`, {
  method: "POST",
  body: JSON.stringify({ segments: [{ start: 2, end: 6 }] }),
});
check("退回后可以重新提交", resubmitAfterReject.status === 200, JSON.stringify(resubmit.body).slice(0, 80));
const approved = await call(admin, `/api/tasks/${target.id}/review`, {
  method: "POST",
  body: JSON.stringify({ decision: "APPROVE", comment: "可以入库" }),
});
check("审核通过", approved.status === 200, JSON.stringify(approved.body));
check("通过后不可再改", (await call(anna, `/api/tasks/${target.id}/segments`, { method: "PUT", body: JSON.stringify({ segments: [] }) })).status === 409);

console.log("\n[统计与导出]");
const stats = await call(admin, "/api/stats/daily");
check("管理员可读取每日统计", stats.status === 200 && Array.isArray(stats.body.series), String(stats.status));
const csv = await fetch(`${BASE}/api/export?type=segments`, { headers: { Cookie: admin } });
const csvText = await csv.text();
check("可导出片段明细 CSV", csv.status === 200 && csvText.includes("开始(秒)"), String(csv.status));
const exportForbidden = await call(anna, "/api/export?type=tasks");
check("标注员不能导出", exportForbidden.status === 403, String(exportForbidden.status));

console.log("\n[权限]");
check("标注员不能创建任务", (await call(anna, "/api/tasks", { method: "POST", body: "{}" })).status === 403);
check("标注员不能读取成员列表", (await call(anna, "/api/admin/users")).status === 403);
check("未登录访问任务返回 401", (await call("", "/api/tasks")).status === 401);

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail > 0 ? 1 : 0);
