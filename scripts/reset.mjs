import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
let removed = 0;

for (const file of ["segmenta.db", "segmenta.db-wal", "segmenta.db-shm"]) {
  const full = path.join(dataDir, file);
  if (fs.existsSync(full)) {
    fs.rmSync(full, { force: true });
    removed += 1;
  }
}

console.log(
  removed > 0
    ? `已删除 ${removed} 个数据库文件，下次启动会自动重建并写入演示数据。`
    : "没有找到数据库文件，下次启动会自动创建。",
);
console.log("视频文件保留在 storage/videos 下。");
