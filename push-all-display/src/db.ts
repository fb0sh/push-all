import Database from "@tauri-apps/plugin-sql";
// when using `"withGlobalTauri": true`, you may use
// const Database = window.__TAURI__.sql;
export interface PushPayload {
  msg: string;
  pusher?: string;
  type?: string;
  level?: "critical" | "info" | "success" | "upsell" | "warning";
  date?: string;
  // 可选，不强制前端使用
  id?: number;
  //
  created_at?: number;
}

let db: Database | null = null;

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pusher TEXT,
  msg TEXT NOT NULL,
  type TEXT,
  level TEXT DEFAULT 'info',
  date TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
`;

export const getDb = async () => {
  if (db) return db;

  db = await Database.load("sqlite:messages.db");
  await db.execute(INIT_SQL);

  return db;
};
export const getLatestMessages = async (
  limit = 10,
  beforeId?: number,
  keyword?: string,
): Promise<PushPayload[]> => {
  const db = await getDb();

  let sql = `
    SELECT id, created_at, pusher, msg, type, level, date
    FROM messages
  `;

  const conditions: string[] = [];

  // 1. 翻页条件 (必须是 AND 关系)
  if (beforeId !== undefined) {
    conditions.push(`id < ${beforeId}`);
  }

  // 2. 全局搜索条件 (各个字段之间是 OR 关系，整体与 ID 是 AND 关系)
  if (keyword && keyword.trim() !== "") {
    const safeKeyword = keyword.replace(/'/g, "''"); // SQL 防注入

    // 构造 OR 查询组
    const searchGroup = [
      `pusher LIKE '%${safeKeyword}%'`,
      `type LIKE '%${safeKeyword}%'`,
      `level LIKE '%${safeKeyword}%'`,
      `msg LIKE '%${safeKeyword}%'`,
      `date LIKE '%${safeKeyword}%'`,
    ].join(" OR ");

    // 关键：必须加括号，形成 (A OR B OR C)
    conditions.push(`(${searchGroup})`);
  }

  // 3. 组合 SQL
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  sql += ` ORDER BY id DESC LIMIT ${limit}`;

  const rows = await db.select(sql);
  return rows as PushPayload[];
};

export const addMessage = async (msgObj: PushPayload): Promise<PushPayload> => {
  const db = await getDb();

  // 插入数据
  await db.execute(
    `
    INSERT INTO messages (pusher, msg, type, level, date)
    VALUES (?, ?, ?, ?, ?)
    `,
    [
      msgObj.pusher ?? null,
      msgObj.msg,
      msgObj.type ?? null,
      msgObj.level ?? "info",
      msgObj.date ?? null,
    ],
  );

  // 获取最后插入的 id
  const lastRow: { id: number; created_at: number }[] = await db.select(
    `SELECT id, created_at FROM messages ORDER BY id DESC LIMIT 1`,
  );

  const inserted = lastRow[0];

  // 返回完整 PushPayload
  return {
    ...msgObj,
    id: inserted.id,
    created_at: inserted.created_at,
  };
};

export const clearMessages = async (): Promise<void> => {
  const db = await getDb();

  // 删除表中所有记录
  await db.execute(`DELETE FROM messages`);

  // 可选：重置自增 id
  await db.execute(`DELETE FROM sqlite_sequence WHERE name='messages'`);
};

export const insert16SampleMessages = async () => {
  const db = await getDb();

  const sampleMessages: PushPayload[] = [];

  const pushers = ["b0sh", "alice", "bob", "system"];
  const types = ["info", "alert", "notification", "reminder"];
  const levels: PushPayload["level"][] = [
    "info",
    "warning",
    "success",
    "critical",
  ];

  for (let i = 1; i <= 16; i++) {
    sampleMessages.push({
      msg: `Sample message ${i}`,
      pusher: pushers[i % pushers.length],
      type: types[i % types.length],
      level: levels[i % levels.length],
      date: `2026-01-21 10:${i.toString().padStart(2, "0")}:00`,
    });
  }

  for (const msg of sampleMessages) {
    await db.execute(
      `
      INSERT INTO messages (pusher, msg, type, level, date)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        msg.pusher ?? null,
        msg.msg,
        msg.type ?? null,
        msg.level ?? "info",
        msg.date ?? null,
      ],
    );
  }

  console.log("Inserted 16 sample messages");
};
export const getMessagesCount = async (keyword?: string): Promise<number> => {
  try {
    const db = await getDb();

    let sql = `SELECT COUNT(*) as count FROM messages`;

    // 如果有搜索关键词，必须加上 WHERE 查询
    if (keyword && keyword.trim() !== "") {
      const safeKeyword = keyword.replace(/'/g, "''"); // 防止 SQL 注入

      // 必须与 getLatestMessages 中的搜索逻辑保持完全一致
      const searchGroup = [
        `pusher LIKE '%${safeKeyword}%'`,
        `type LIKE '%${safeKeyword}%'`,
        `level LIKE '%${safeKeyword}%'`,
        `msg LIKE '%${safeKeyword}%'`,
        `date LIKE '%${safeKeyword}%'`,
      ].join(" OR ");

      // 注意：这里需要加括号，虽然只有 WHERE 没有 AND，但保持习惯是个好事
      sql += ` WHERE (${searchGroup})`;
    }

    // 告诉 TS rows 是数组
    const rows = (await db.select<{ count: number }[]>(sql)) as {
      count: number;
    }[];

    // 取第一条记录的 count
    return rows?.[0]?.count ?? 0;
  } catch (err) {
    console.error("getMessagesCount error:", err);
    return 0;
  }
};
