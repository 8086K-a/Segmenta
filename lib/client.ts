export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof Blob) ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const body = (data ?? {}) as { error?: string; code?: string; details?: unknown };
    throw new ApiClientError(res.status, body.error || `请求失败（${res.status}）`, body.code || "ERROR", body.details);
  }

  return data as T;
}

/** 上传视频：XHR 以便拿到进度 */
export function uploadVideo(
  file: File,
  tenantId: string,
  onProgress: (percent: number) => void,
): Promise<{ video: { id: string; filename: string; size: number } }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/videos?filename=${encodeURIComponent(file.name)}&tenantId=${encodeURIComponent(tenantId)}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new ApiClientError(xhr.status, data.error || "上传失败", data.code || "UPLOAD_FAILED"));
      } catch {
        reject(new ApiClientError(xhr.status, "上传失败", "UPLOAD_FAILED"));
      }
    };
    xhr.onerror = () => reject(new ApiClientError(0, "网络中断，上传失败", "NETWORK"));
    xhr.send(file);
  });
}

/** 读取本地视频时长（不依赖 ffprobe） */
export function probeVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const d = video.duration;
      URL.revokeObjectURL(url);
      if (Number.isFinite(d) && d > 0) resolve(d);
      else reject(new Error("无法读取视频时长"));
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("视频无法解析，请确认格式"));
    };
    video.src = url;
  });
}
