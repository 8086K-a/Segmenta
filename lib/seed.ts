import type Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "./password";
import { addDays, bizDate, todayBizDate } from "./time";

const id = (prefix: string) => `${prefix}_${crypto.randomBytes(6).toString("hex")}`;

/** 确定性伪随机，保证每次种子数据一致 */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function at(dateStr: string, hour: number, minute: number): string {
  // 业务时区（默认 UTC+8）下构造时间，再转 ISO
  const offset = Number(process.env.BIZ_UTC_OFFSET ?? 8);
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCHours(hour - offset, minute, 0, 0);
  return d.toISOString();
}

function fileSize(key: string): number {
  try {
    return fs.statSync(path.join(process.cwd(), "storage", "videos", key)).size;
  } catch {
    return 0;
  }
}

type SeedTask = {
  title: string;
  description: string;
  status: "AVAILABLE" | "IN_PROGRESS" | "SUBMITTED";
  assignee?: string;
  submittedDaysAgo?: number;
  hour?: number;
  minute?: number;
  segments?: [number, number, string?][];
};

const VIDEO_KEY = "file-000.mp4";
const VIDEO_DURATION = 2565;

export function seedIfEmpty(db: Database.Database): void {
  const count = db.prepare("SELECT COUNT(*) AS n FROM tenants").get() as { n: number };
  if (count.n > 0) return;

  const now = new Date().toISOString();
  const pwd = hashPassword("demo1234");

  const tenants = [
    { id: "t_xingye", name: "星野机器人", slug: "xingye" },
    { id: "t_chaoxi", name: "潮汐智造", slug: "chaoxi" },
  ];

  const users: {
    id: string;
    tenant: string;
    email: string;
    name: string;
    role: "SUPER_ADMIN" | "ADMIN" | "ANNOTATOR";
  }[] = [
    { id: "u_root", tenant: "t_xingye", email: "ops@platform.ai", name: "顾清源", role: "SUPER_ADMIN" },
    { id: "u_admin_x", tenant: "t_xingye", email: "admin@xingye.ai", name: "林知远", role: "ADMIN" },
    { id: "u_admin_c", tenant: "t_chaoxi", email: "admin@chaoxi.ai", name: "周慕青", role: "ADMIN" },
    { id: "u_anna", tenant: "t_xingye", email: "anna@xingye.ai", name: "陈安娜", role: "ANNOTATOR" },
    { id: "u_bo", tenant: "t_xingye", email: "bo@xingye.ai", name: "李博", role: "ANNOTATOR" },
    { id: "u_chen", tenant: "t_xingye", email: "chen@xingye.ai", name: "王琛", role: "ANNOTATOR" },
    { id: "u_ding", tenant: "t_chaoxi", email: "ding@chaoxi.ai", name: "赵一丁", role: "ANNOTATOR" },
    { id: "u_he", tenant: "t_chaoxi", email: "he@chaoxi.ai", name: "何声", role: "ANNOTATOR" },
  ];

  const videoSize = fileSize(VIDEO_KEY);
  const videos = [
    { id: "v_xingye", tenant: "t_xingye" },
    { id: "v_chaoxi", tenant: "t_chaoxi" },
  ];

  const xingyeTasks: SeedTask[] = [
    {
      title: "Push-T：第 1 轮接近与接触",
      description: "标出机械臂从初始位接近 T 形块、直到首次稳定接触的时间段。空走段不计入。",
      status: "SUBMITTED",
      assignee: "u_anna",
      submittedDaysAgo: 6,
      hour: 10,
      minute: 24,
      segments: [[124.5, 142.8, "接近 T 块"], [168.0, 191.4, "首次接触"], [205.2, 228.6, "推动"]],
    },
    {
      title: "Push-T：T 形块角度修正",
      description: "包含两次位置修正，请分别切分，不要合并成一个片段。",
      status: "SUBMITTED",
      assignee: "u_bo",
      submittedDaysAgo: 5,
      hour: 11,
      minute: 2,
      segments: [
        [318.0, 341.5, "角度修正"],
        [352.4, 378.9, "二次推动"],
        [402.1, 428.7, "对齐"],
        [440.5, 462.3, "微调"],
      ],
    },
    {
      title: "Push-T：打滑与重试",
      description: "只保留末端打滑后重新尝试的片段，用于失败样本。",
      status: "SUBMITTED",
      assignee: "u_chen",
      submittedDaysAgo: 5,
      hour: 16,
      minute: 41,
      segments: [[512.6, 529.8, "打滑"], [536.0, 558.4, "重试"]],
    },
    {
      title: "Push-T：接触阶段（长程）",
      description: "标出末端首次接触 T 形块到完成对齐的整段。",
      status: "SUBMITTED",
      assignee: "u_anna",
      submittedDaysAgo: 4,
      hour: 9,
      minute: 15,
      segments: [[634.2, 658.7, "接触"], [672.5, 701.3, "推动对齐"]],
    },
    {
      title: "Push-T：长程推动 A 段",
      description: "包含一次明显停顿，停顿段不计入。",
      status: "SUBMITTED",
      assignee: "u_bo",
      submittedDaysAgo: 3,
      hour: 14,
      minute: 8,
      segments: [[742.0, 769.4, "推动"], [788.6, 812.2, "停顿后继续"], [826.4, 851.9, "贴边"]],
    },
    {
      title: "Push-T：末端交接与复位",
      description: "标出两次抓取之间的交接动作。",
      status: "SUBMITTED",
      assignee: "u_chen",
      submittedDaysAgo: 2,
      hour: 13,
      minute: 30,
      segments: [[880.5, 902.1, "交接"], [905.0, 928.4, "复位"]],
    },
    {
      title: "Push-T：三次位置修正",
      description: "长程推动中的三次修正，逐次切分。",
      status: "SUBMITTED",
      assignee: "u_anna",
      submittedDaysAgo: 2,
      hour: 17,
      minute: 55,
      segments: [[963.0, 984.6, "修正一"], [1002.2, 1027.0, "修正二"], [1041.5, 1068.8, "修正三"]],
    },
    {
      title: "Push-T：清洁与复位",
      description: "标出清理台面、末端回到初始位的三个片段。",
      status: "SUBMITTED",
      assignee: "u_bo",
      submittedDaysAgo: 1,
      hour: 11,
      minute: 20,
      segments: [[1102.4, 1128.9, "清理"], [1145.2, 1170.6, "擦拭"], [1198.1, 1222.5, "复位"]],
    },
    {
      title: "Push-T：末端轨迹四阶段",
      description: "按接近、接触、推动、撤离切分。",
      status: "SUBMITTED",
      assignee: "u_chen",
      submittedDaysAgo: 1,
      hour: 15,
      minute: 12,
      segments: [
        [1250.2, 1268.4, "接近"],
        [1268.4, 1294.8, "接触"],
        [1294.8, 1326.6, "推动"],
        [1330.0, 1352.1, "撤离"],
      ],
    },
    {
      title: "Push-T：抓取与放置（第二视角）",
      description: "同一动作的侧机位，注意遮挡。",
      status: "SUBMITTED",
      assignee: "u_anna",
      submittedDaysAgo: 0,
      hour: 9,
      minute: 48,
      segments: [[1401.1, 1424.3, "抓取"], [1438.8, 1465.5, "移动"], [1482.0, 1510.4, "放置"]],
    },
    {
      title: "Push-T：推方块（补标）",
      description: "上一版漏标了末段，需要补全并重新提交。",
      status: "SUBMITTED",
      assignee: "u_chen",
      submittedDaysAgo: 0,
      hour: 11,
      minute: 5,
      segments: [[1560.0, 1582.2, "接近"], [1582.2, 1610.4, "推动"], [1610.4, 1636.0, "对齐"]],
    },
    {
      title: "Push-T：分段复标（按动作单元）",
      description: "客户反馈切分过粗，请按 3 秒以内的动作单元重新切分。",
      status: "IN_PROGRESS",
      assignee: "u_bo",
      segments: [[1700.0, 1712.4, "左臂取件"], [1713.0, 1719.6, "开始研磨"]],
    },
    {
      title: "Push-T：接触瞬间（慢动作）",
      description: "标出接触瞬间的细微位移，注意首帧。",
      status: "IN_PROGRESS",
      assignee: "u_anna",
      segments: [[1800.0, 1806.5, "接触"]],
    },
    {
      title: "Push-T：长程轨迹（10 次重复）",
      description: "十次连续推动，逐次切分。",
      status: "AVAILABLE",
    },
    {
      title: "Push-T：夜间光照采集",
      description: "夜间光照条件下的同一流程，注意阴影干扰。",
      status: "AVAILABLE",
    },
    {
      title: "Push-T：多物体连续推动",
      description: "标出每次物体切换之间的有效推动段。",
      status: "AVAILABLE",
    },
    {
      title: "Push-T：失败样本（打滑）",
      description: "只保留打滑与重试片段。",
      status: "AVAILABLE",
    },
  ];

  const chaoxiTasks: SeedTask[] = [
    {
      title: "Push-T：产线节拍分析",
      description: "标出每次上料的完整往返。",
      status: "SUBMITTED",
      assignee: "u_ding",
      submittedDaysAgo: 4,
      hour: 10,
      minute: 5,
      segments: [[210.0, 232.5, "取料"], [246.0, 270.2, "上料"]],
    },
    {
      title: "Push-T：末端力控片段",
      description: "标出接触后的力控阶段。",
      status: "SUBMITTED",
      assignee: "u_he",
      submittedDaysAgo: 2,
      hour: 16,
      minute: 22,
      segments: [[380.0, 404.4, "定位"], [409.0, 431.6, "锁付"]],
    },
    {
      title: "Push-T：成品对齐",
      description: "标出对齐与放置片段。",
      status: "SUBMITTED",
      assignee: "u_ding",
      submittedDaysAgo: 0,
      hour: 10,
      minute: 40,
      segments: [[520.5, 538.2, "抓取"], [550.0, 571.5, "放置"]],
    },
    {
      title: "Push-T：空载巡检",
      description: "巡检路径中的有效动作片段。",
      status: "AVAILABLE",
    },
    {
      title: "Push-T：异常停机片段",
      description: "标出停机前后的动作。",
      status: "AVAILABLE",
    },
  ];

  const insertTenant = db.prepare("INSERT INTO tenants (id, name, slug, status, created_at) VALUES (?,?,?,?,?)");
  const insertUser = db.prepare(
    "INSERT INTO users (id, tenant_id, email, name, password_hash, role, status, created_at) VALUES (?,?,?,?,?,?,?,?)",
  );
  const insertVideo = db.prepare(
    "INSERT INTO videos (id, tenant_id, filename, storage_key, mime_type, size, duration, created_at, uploaded_by) VALUES (?,?,?,?,?,?,?,?,?)",
  );
  const insertTask = db.prepare(
    `INSERT INTO tasks (id, tenant_id, video_id, title, description, status, assignee_id, created_by,
       created_at, updated_at, claimed_at, submitted_at, submitted_date, revision)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const insertSegment = db.prepare(
    "INSERT INTO segments (id, task_id, start_time, end_time, label, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
  );
  const insertSubmission = db.prepare(
    `INSERT INTO submissions (id, task_id, version, submitted_by, submitted_at, submitted_date,
       total_duration, segment_count, segments_json, is_current, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const insertAudit = db.prepare(
    "INSERT INTO audit_logs (id, tenant_id, actor_id, action, entity_type, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)",
  );

  const tx = db.transaction(() => {
    for (const t of tenants) insertTenant.run(t.id, t.name, t.slug, "ACTIVE", now);
    for (const u of users) insertUser.run(u.id, u.tenant, u.email, u.name, pwd, u.role, "ACTIVE", now);
    for (const v of videos)
      insertVideo.run(v.id, v.tenant, VIDEO_KEY, VIDEO_KEY, "video/mp4", videoSize, VIDEO_DURATION, now, "u_admin_x");

    const rng = makeRng(20261024);

    const runTasks = (list: SeedTask[], tenant: string, videoId: string, creator: string) => {
      list.forEach((t, index) => {
        const taskId = id("task");
        const createdDaysAgo = (t.submittedDaysAgo ?? 0) + 2 + (index % 3);
        const createdAt = at(addDays(todayBizDate(), -createdDaysAgo), 9, 30);
        let submittedAt: string | null = null;
        let submittedDate: string | null = null;

        if (t.status === "SUBMITTED" && t.submittedDaysAgo != null) {
          const day = addDays(todayBizDate(), -t.submittedDaysAgo);
          submittedAt = at(day, t.hour ?? 12, t.minute ?? 0);
          submittedDate = bizDate(submittedAt);
        }

        insertTask.run(
          taskId,
          tenant,
          videoId,
          t.title,
          t.description,
          t.status,
          t.assignee ?? null,
          creator,
          createdAt,
          submittedAt ?? createdAt,
          t.assignee && t.status !== "AVAILABLE" ? at(addDays(todayBizDate(), -createdDaysAgo), 9, 45) : null,
          submittedAt,
          submittedDate,
          t.status === "SUBMITTED" ? 2 : 1,
        );

        const segs = t.segments ?? [];
        for (const [start, end, label] of segs) {
          insertSegment.run(id("seg"), taskId, start, end, label ?? null, createdAt, createdAt);
        }

        if (t.status === "SUBMITTED" && submittedAt && t.assignee) {
          const total = Math.round(segs.reduce((s, [a, b]) => s + (b - a), 0) * 1000) / 1000;
          // 有复标的任务保留一条历史版本，用于演示“只统计当前有效版本”
          if (t.title.includes("清洁与复位")) {
            const oldAt = at(addDays(todayBizDate(), -2), 18, 12);
            const oldSegs = segs.slice(0, 2);
            const oldTotal = Math.round(oldSegs.reduce((s, [a, b]) => s + (b - a), 0) * 1000) / 1000;
            insertSubmission.run(
              id("sub"),
              taskId,
              1,
              t.assignee,
              oldAt,
              bizDate(oldAt),
              oldTotal,
              oldSegs.length,
              JSON.stringify(oldSegs.map(([a, b, l]) => ({ start: a, end: b, label: l ?? null }))),
              0,
              oldAt,
            );
          }
          insertSubmission.run(
            id("sub"),
            taskId,
            t.title.includes("清洁与复位") ? 2 : 1,
            t.assignee,
            submittedAt,
            submittedDate!,
            total,
            segs.length,
            JSON.stringify(segs.map(([a, b, l]) => ({ start: a, end: b, label: l ?? null }))),
            1,
            submittedAt,
          );
          insertAudit.run(
            id("log"),
            tenant,
            t.assignee,
            "TASK_SUBMITTED",
            "task",
            taskId,
            JSON.stringify({ total_duration: total, segment_count: segs.length }),
            submittedAt,
          );
        }
      });
    };

    runTasks(xingyeTasks, "t_xingye", "v_xingye", "u_admin_x");
    runTasks(chaoxiTasks, "t_chaoxi", "v_chaoxi", "u_admin_c");

    // 审核状态：最近两条提交留作待审核，其余通过
    const submitted = db
      .prepare("SELECT id, tenant_id, submitted_at FROM tasks WHERE status = 'SUBMITTED' ORDER BY submitted_at DESC")
      .all() as { id: string; tenant_id: string; submitted_at: string }[];
    submitted.slice(2).forEach((t) => {
      db.prepare(
        "UPDATE tasks SET review_status = 'APPROVED', reviewed_by = ?, reviewed_at = ?, review_comment = ? WHERE id = ?",
      ).run(t.tenant_id === "t_chaoxi" ? "u_admin_c" : "u_admin_x", t.submitted_at, "切分准确，已入库", t.id);
    });

    // 其余未审核的提交标记为待审核
    db.prepare("UPDATE tasks SET review_status = 'PENDING' WHERE status = 'SUBMITTED' AND review_status = 'NONE'").run();

    // 一条被退回的示例（进行中 + 退回原因）
    const rework = db
      .prepare("SELECT id, tenant_id FROM tasks WHERE status = 'IN_PROGRESS' AND title LIKE '%复标%' LIMIT 1")
      .get() as { id: string; tenant_id: string } | undefined;
    if (rework) {
      db.prepare(
        `UPDATE tasks SET review_status = 'REJECTED', reviewed_by = ?, reviewed_at = ?,
           review_comment = ? WHERE id = ?`,
      ).run(
        rework.tenant_id === "t_chaoxi" ? "u_admin_c" : "u_admin_x",
        now,
        "第 2 段把空转也标进去了，请按动作单元重新切分，空转不计入。",
        rework.id,
      );
    }

    void rng;
  });

  tx();
}
