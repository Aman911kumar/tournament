import path from "path";
import ApiError from "../../utils/ApiError.js";

const FOLDER_CACHE_TTL_MS = 10 * 60 * 1000;
const folderCache = new Map();

const cleanBaseUrl = (value, fallback = "") => String(value || fallback).replace(/\/+$/, "");

const getConfig = () => {
    const apiBaseUrl = cleanBaseUrl(
        process.env.TELESTORE_API_BASE_URL ||
        process.env.MEDIA_STORAGE_API_BASE_URL ||
        process.env.STORAGE_API_BASE_URL
    );
    const publicBaseUrl = cleanBaseUrl(
        process.env.TELESTORE_PUBLIC_BASE_URL ||
        process.env.MEDIA_STORAGE_PUBLIC_BASE_URL ||
        process.env.STORAGE_PUBLIC_BASE_URL,
        apiBaseUrl ? apiBaseUrl.replace(/\/api\/v\d+$/i, "") : ""
    );
    const apiKey =
        process.env.TELESTORE_API_KEY ||
        process.env.TELESTORE_PUBLIC_KEY ||
        process.env.MEDIA_STORAGE_API_KEY ||
        process.env.STORAGE_API_KEY ||
        "";
    const apiSecret =
        process.env.TELESTORE_API_SECRET ||
        process.env.TELESTORE_SECRET_KEY ||
        process.env.MEDIA_STORAGE_API_SECRET ||
        process.env.STORAGE_API_SECRET ||
        "";

    return {
        apiBaseUrl,
        publicBaseUrl,
        apiKey,
        apiSecret,
        visibility: process.env.TELESTORE_CHAT_VISIBILITY || "public",
        rootFolderName: process.env.TELESTORE_CHAT_ROOT_FOLDER_NAME || "Battle4Arena Live Chat",
        requestTimeoutMs: Number(process.env.TELESTORE_TIMEOUT_MS || 20000),
    };
};

export const isTeleStoreConfigured = () => {
    const config = getConfig();
    return Boolean(config.apiBaseUrl && config.apiKey && config.apiSecret);
};

export const sanitizeFolderName = (value, fallback = "Untitled") => {
    const clean = String(value || "")
        .normalize("NFKD")
        .replace(/[^\w\s().&+\-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 90);
    return clean || fallback;
};

export const sanitizeFileBaseName = (value, fallback = "attachment") => {
    const parsed = path.parse(String(value || ""));
    const clean = (parsed.name || "")
        .normalize("NFKD")
        .replace(/[^\w\s().&+\-]/g, " ")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);
    return clean || fallback;
};

const datePart = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 7) : date.toISOString().slice(0, 7);
};

const timestampPart = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return safeDate.toISOString().replace(/[-:]/g, "").replace(".", "-");
};

export const buildChatFolderPath = ({ tournament }) => {
    const shortId = String(tournament?._id || "unknown").slice(-8);
    const gameName = sanitizeFolderName(tournament?.game || "General");
    const title = sanitizeFolderName(tournament?.title || "Tournament");
    const startLabel = tournament?.startAt ? datePart(tournament.startAt) : "unscheduled";
    const tournamentFolderName = sanitizeFolderName(`${gameName} - ${title} - ${startLabel} - ${shortId}`);

    return [
        getConfig().rootFolderName,
        tournamentFolderName,
    ].map((part) => sanitizeFolderName(part));
};

export const buildChatFileName = ({ originalName, ext, user }) => {
    const userLabel = sanitizeFileBaseName(user?.username || String(user?._id || "user").slice(-8), "user");
    const baseName = sanitizeFileBaseName(originalName, "chat-file");
    return `${timestampPart()}-${userLabel}-${baseName}.${ext}`;
};

const withTimeout = async (promise, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await promise(controller.signal);
    } finally {
        clearTimeout(timer);
    }
};

const authHeaders = (config) => ({
    "x-api-key": config.apiKey,
    "x-api-secret": config.apiSecret,
});

const parseJsonResponse = async (response) => {
    const json = await response.json().catch(() => null);
    if (!response.ok || json?.success === false) {
        const message = json?.error?.message || json?.message || `TeleStore request failed with ${response.status}`;
        throw new ApiError(response.status >= 400 ? response.status : 502, message);
    }
    return json || {};
};

const extractFolderList = (json) => {
    const data = json?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.folders)) return data.folders;
    if (Array.isArray(json?.folders)) return json.folders;
    return [];
};

const extractFolder = (json) => {
    const data = json?.data;
    return data?.folder || data?.data || data || json?.folder || null;
};

const getFolderId = (folder) => folder?._id || folder?.id || folder?.folderId || null;

const cacheKey = (parentId, name) => `${parentId || "root"}:${String(name).toLowerCase()}`;

const getCachedFolder = (parentId, name) => {
    const cached = folderCache.get(cacheKey(parentId, name));
    if (!cached || cached.expiresAt < Date.now()) return null;
    return cached.id;
};

const setCachedFolder = (parentId, name, id) => {
    if (!id) return;
    folderCache.set(cacheKey(parentId, name), {
        id,
        expiresAt: Date.now() + FOLDER_CACHE_TTL_MS,
    });
};

const findFolder = async ({ config, name, parentId }) => {
    const query = new URLSearchParams();
    if (parentId) query.set("parentId", parentId);
    const url = `${config.apiBaseUrl}/folders${query.toString() ? `?${query}` : ""}`;
    const json = await withTimeout(
        (signal) => fetch(url, { method: "GET", headers: authHeaders(config), signal }),
        config.requestTimeoutMs
    ).then(parseJsonResponse);

    return extractFolderList(json).find((folder) => String(folder?.name || "").trim() === name) || null;
};

const createFolder = async ({ config, name, parentId }) => {
    const json = await withTimeout(
        (signal) =>
            fetch(`${config.apiBaseUrl}/folders`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders(config),
                },
                body: JSON.stringify(parentId ? { name, parentId } : { name }),
                signal,
            }),
        config.requestTimeoutMs
    ).then(parseJsonResponse);

    return extractFolder(json);
};

const ensureFolder = async ({ config, name, parentId }) => {
    const cachedId = getCachedFolder(parentId, name);
    if (cachedId) return cachedId;

    const existing = await findFolder({ config, name, parentId });
    const existingId = getFolderId(existing);
    if (existingId) {
        setCachedFolder(parentId, name, existingId);
        return existingId;
    }

    try {
        const created = await createFolder({ config, name, parentId });
        const createdId = getFolderId(created);
        if (!createdId) throw new ApiError(502, "TeleStore did not return a folder id");
        setCachedFolder(parentId, name, createdId);
        return createdId;
    } catch (error) {
        const retryExisting = await findFolder({ config, name, parentId }).catch(() => null);
        const retryId = getFolderId(retryExisting);
        if (retryId) {
            setCachedFolder(parentId, name, retryId);
            return retryId;
        }
        throw error;
    }
};

const ensureFolderPath = async (folderPath) => {
    const config = getConfig();
    let parentId = null;
    for (const folderName of folderPath) {
        parentId = await ensureFolder({ config, name: folderName, parentId });
    }
    return parentId;
};

const absoluteMediaUrl = (value, config) => {
    if (!value) return "";
    const text = String(value);
    if (/^https?:\/\//i.test(text)) return text;
    return `${config.publicBaseUrl}/${text.replace(/^\/+/, "")}`;
};

const extractUploadedFile = (json) => {
    const data = json?.data;
    if (Array.isArray(data?.files)) return data.files[0] || null;
    if (Array.isArray(json?.files)) return json.files[0] || null;
    return data?.file || data || null;
};

export const uploadToTeleStore = async ({
    buffer,
    fileName,
    originalName,
    mimeType,
    folderPath,
    tags = [],
    metadata = {},
}) => {
    const config = getConfig();
    if (!isTeleStoreConfigured()) {
        throw new ApiError(500, "TeleStore is not configured. Set TELESTORE_API_BASE_URL, TELESTORE_API_KEY, and TELESTORE_API_SECRET.");
    }
    if (typeof FormData === "undefined" || typeof Blob === "undefined") {
        throw new ApiError(500, "This Node runtime does not support server-side FormData uploads");
    }

    const folderId = await ensureFolderPath(folderPath);
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), fileName);
    form.append("folderId", folderId);
    form.append("visibility", config.visibility);
    form.append("tags", JSON.stringify(tags));
    form.append(
        "metadata",
        JSON.stringify({
            ...metadata,
            originalName,
            folderPath,
            source: "battle4arena-chat",
        })
    );
    form.append("filename", fileName);
    form.append("fileName", fileName);

    const json = await withTimeout(
        (signal) =>
            fetch(`${config.apiBaseUrl}/upload`, {
                method: "POST",
                headers: authHeaders(config),
                body: form,
                signal,
            }),
        config.requestTimeoutMs
    ).then(parseJsonResponse);

    const file = extractUploadedFile(json);
    if (!file) throw new ApiError(502, "TeleStore upload did not return file details");

    const mediaId = file.id || file._id || file.mediaId || "";
    return {
        provider: "telestore",
        mediaId,
        folderId,
        folderName: folderPath.join(" / "),
        publicUrl: absoluteMediaUrl(file.publicUrl || file.url || file.viewUrl, config),
        apiUrl: absoluteMediaUrl(file.apiUrl, config),
        downloadUrl: absoluteMediaUrl(file.downloadUrl, config),
        thumbUrl: absoluteMediaUrl(file.thumbUrl, config),
        raw: file,
    };
};

export const deleteFromTeleStore = async (mediaId) => {
    const id = String(mediaId || "").trim();
    if (!id) return { skipped: true };

    const config = getConfig();
    if (!isTeleStoreConfigured()) {
        throw new ApiError(500, "TeleStore is not configured. Set TELESTORE_API_BASE_URL, TELESTORE_API_KEY, and TELESTORE_API_SECRET.");
    }

    const response = await withTimeout(
        (signal) =>
            fetch(`${config.apiBaseUrl}/media/${encodeURIComponent(id)}`, {
                method: "DELETE",
                headers: authHeaders(config),
                signal,
            }),
        config.requestTimeoutMs
    );

    if (response.status === 404) {
        return { success: true, alreadyDeleted: true, mediaId: id };
    }

    const json = await parseJsonResponse(response);
    return {
        success: json?.success !== false,
        mediaId: id,
        raw: json,
    };
};
