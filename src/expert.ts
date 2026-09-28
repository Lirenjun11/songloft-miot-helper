// src/expert.ts
/// <reference types="@songloft/plugin-sdk" />

// ==========================================
// 🧩 专家模式：自定义 URL 触发引擎
// ------------------------------------------
// 支持两种返回：
//   1. JSON 歌曲列表 (可配置字段映射)
//   2. 单个直链音频 (audio/* 或音频后缀)
// URL 支持 {keyword} 占位符注入语音关键词
// ==========================================

const AUDIO_EXT_RE = /\.(mp3|flac|wav|m4a|aac|ogg|ape|wma|alac|opus)(\?|#|$)/i;

// 按点路径从对象中取值，如 "data.list" / "result.songs"
function pickByPath(obj: any, path: string): any {
    if (!path) return obj;
    let cur = obj;
    for (const seg of path.split('.')) {
        if (cur == null) return undefined;
        cur = cur[seg.trim()];
    }
    return cur;
}

// 从一条原始记录里按字段映射取值 (支持多候选，逗号分隔，如 "title,name")
function pickField(item: any, mapping: string, fallbacks: string[] = []): any {
    const candidates: string[] = [];
    if (mapping) mapping.split(',').forEach(m => { const t = m.trim(); if (t) candidates.push(t); });
    for (const fb of fallbacks) if (!candidates.includes(fb)) candidates.push(fb);

    for (const key of candidates) {
        const val = pickByPath(item, key);
        if (val !== undefined && val !== null && val !== '') return val;
    }
    return undefined;
}

// 构建实际请求 URL：替换 {keyword} 占位符
function buildRequestUrl(template: string, keyword: string): string {
    if (!template) return '';
    if (template.includes('{keyword}')) {
        return template.split('{keyword}').join(encodeURIComponent(keyword));
    }
    return template;
}

// 归一化时长：字符串秒 / "mm:ss" / 数字 -> 秒(number)
function normalizeDuration(raw: any): number {
    if (raw === undefined || raw === null || raw === '') return 0;
    if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
    const str = String(raw);
    if (str.includes(':')) {
        const parts = str.split(':').map(p => parseInt(p, 10) || 0);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    const n = Number(str);
    return isNaN(n) ? 0 : n;
}

// 把一条映射后的记录封装为标准歌曲对象
function toSongObject(item: any, cfg: any, indexKey: string): any {
    const title = pickField(item, cfg.fieldTitle, ['title', 'name', 'song', 'songName']) || '未知歌曲';
    const artist = pickField(item, cfg.fieldArtist, ['artist', 'singer', 'author', 'nickname']) || '未知歌手';
    const url = pickField(item, cfg.fieldUrl, ['url', 'src', 'link', 'playUrl', 'songUrl', 'audio']) || '';
    const cover = pickField(item, cfg.fieldCover, ['cover', 'cover_url', 'pic', 'artwork', 'img']) || '';
    const album = pickField(item, cfg.fieldAlbum, ['album', 'albumName']) || '';
    const durRaw = pickField(item, cfg.fieldDuration, ['duration', 'dt', 'interval']);
    const duration = normalizeDuration(durRaw);
    const lyric = pickField(item, cfg.fieldLyric, ['lyric', 'lrc']) || '';

    const finalUrl = String(url);

    return {
        title: String(title),
        artist: String(artist),
        album: String(album),
        cover_url: String(cover),
        url: finalUrl,
        streamUrl: finalUrl,
        duration,
        dedup_key: `expert_${indexKey}`,
        plugin_entry_path: '',
        source_data: JSON.stringify({ url: finalUrl }),
        lyric: String(lyric),
        _isOnlineObj: true
    };
}

// ==========================================
// 🚀 专家模式主搜索函数
// ==========================================
export async function searchExpertSongs(
    cfg: any,
    keyword: string,
    limit: number,
    logFn: (msg: string) => void
): Promise<{ songs: any[], collectionName: string, isAction?: boolean, actionOk?: boolean, actionStatus?: number, actionSnippet?: string, actionReply?: string } | null> {
    try {
        if (!cfg || !cfg.urlTemplate) {
            logFn('❌ [专家模式] 未配置有效的 URL 模板，已熔断');
            return null;
        }

        const requestUrl = buildRequestUrl(cfg.urlTemplate, keyword);
        const method = (cfg.method || 'GET').toUpperCase();
        const responseType = cfg.responseType || 'auto';

        const kTrim = (keyword || '').trim();
        if (kTrim) {
            logFn(`🔑 [专家模式] 注入语音关键词: "${kTrim}"`);
        } else if (cfg.urlTemplate.includes('{keyword}') || String(cfg.postBody || '').includes('{keyword}')) {
            // 配置里写了占位符，但本次没听到关键词 —— 明确提示，避免误以为配置失效
            logFn(`⚠️ [专家模式] 配置含 {keyword} 占位符，但本次未听到关键词，将以空值发起请求`);
        } else {
            logFn(`ℹ️ [专家模式] 本次指令无需关键词 (配置未使用 {keyword} 占位符)，直接执行`);
        }

        logFn(`🧩 [专家模式] 触发自定义 URL (${method}): ${requestUrl}`);

        const headers: Record<string, string> = { 'X-Fetch-Timeout-Ms': '8000' };
        const fetchInit: any = { method, headers };

        // 自定义请求头 (JSON 对象字符串)
        if (cfg.customHeaders) {
            try {
                const parsed = typeof cfg.customHeaders === 'string' ? JSON.parse(cfg.customHeaders) : cfg.customHeaders;
                if (parsed && typeof parsed === 'object') {
                    for (const k of Object.keys(parsed)) headers[k] = String(parsed[k]);
                }
            } catch (e) {
                logFn(`⚠️ [专家模式] 自定义请求头不是合法 JSON，已忽略`);
            }
        }

        if (method === 'POST' && cfg.postBody) {
            const body = cfg.postBody.includes('{keyword}')
                ? cfg.postBody.split('{keyword}').join(keyword)
                : cfg.postBody;
            fetchInit.body = body;
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        }

        let res: Response;
        try {
            res = await fetch(requestUrl, fetchInit);
        } catch (fetchErr) {
            logFn(`⚠️ [专家模式] 请求超时或网络异常: ${fetchErr}`);
            if (responseType === 'action') {
                return { songs: [], collectionName: '', isAction: true, actionOk: false, actionStatus: 0, actionSnippet: String(fetchErr) };
            }
            return null;
        }

        // ====================================
        // 0. 纯指令调用模式 (物联网/Webhook：只发请求，不播放)
        // ====================================
        if (responseType === 'action') {
            let snippet = '';
            try {
                const text = await res.text();
                snippet = text ? text.slice(0, 300) : '';
            } catch (e) { /* 有些接口无响应体，忽略 */ }

            const actionOk = res.ok;
            logFn(actionOk
                ? `✅ [专家模式] 指令调用成功 (HTTP ${res.status})${snippet ? '，返回: ' + snippet : ''}`
                : `⚠️ [专家模式] 指令调用返回异常 (HTTP ${res.status})${snippet ? '，返回: ' + snippet : ''}`);

            return {
                songs: [],
                collectionName: '',
                isAction: true,
                actionOk,
                actionStatus: res.status,
                actionSnippet: snippet,
                actionReply: cfg.actionReply || ''
            };
        }

        if (!res.ok) {
            logFn(`⚠️ [专家模式] 请求失败 (HTTP ${res.status})`);
            return null;
        }

        const contentType = (res.headers.get('content-type') || '').toLowerCase();

        // ====================================
        // 1. 判定为直链音频
        // ====================================
        const looksLikeAudio =
            responseType === 'audio' ||
            (responseType === 'auto' && (contentType.startsWith('audio/') || AUDIO_EXT_RE.test(requestUrl)));

        if (looksLikeAudio) {
            const finalUrl = res.url || requestUrl;
            const title = (keyword && keyword.trim()) ? keyword.trim() : '专家模式音频';
            logFn(`🎵 [专家模式] 识别为单个直链音频，直接封装播放: ${finalUrl}`);

            const song = {
                title,
                artist: '专家模式',
                album: '',
                cover_url: '',
                url: finalUrl,
                streamUrl: finalUrl,
                duration: 0,
                dedup_key: `expert_audio_${Date.now()}`,
                plugin_entry_path: '',
                source_data: JSON.stringify({ url: finalUrl }),
                lyric: '',
                _isOnlineObj: true
            };
            return { songs: [song], collectionName: '' };
        }

        // ====================================
        // 2. 判定为 JSON 歌曲列表
        // ====================================
        let data: any;
        try {
            data = await res.json();
        } catch (parseErr) {
            logFn(`⚠️ [专家模式] 响应无法解析为 JSON，且非音频直链，已中断`);
            return null;
        }

        let listRaw = pickByPath(data, cfg.listPath || '');

        // 兜底：如果指定路径不是数组，尝试常见字段
        if (!Array.isArray(listRaw)) {
            for (const p of ['data', 'list', 'songs', 'result', 'data.list', 'data.songs', 'result.songs']) {
                const cand = pickByPath(data, p);
                if (Array.isArray(cand)) { listRaw = cand; break; }
            }
        }

        if (!Array.isArray(listRaw) || listRaw.length === 0) {
            logFn(`⚠️ [专家模式] 未从响应中解析出歌曲列表 (listPath: "${cfg.listPath || '(根)'}")`);
            return null;
        }

        logFn(`💡 [专家模式] 成功解析到 ${listRaw.length} 条记录，开始字段映射...`);

        const songs: any[] = [];
        for (let i = 0; i < listRaw.length; i++) {
            const song = toSongObject(listRaw[i], cfg, `${Date.now()}_${i}`);
            if (!song.url) continue; // 没有可播放 URL 的直接跳过
            songs.push(song);
            if (limit > 0 && songs.length >= limit) break;
        }

        if (songs.length === 0) {
            logFn(`⚠️ [专家模式] 映射后没有任何带有效播放地址的歌曲，请检查字段映射配置`);
            return null;
        }

        logFn(`🎉 [专家模式] 成功集结 ${songs.length} 首可播放歌曲！`);
        const collectionName = (keyword && keyword.trim()) ? keyword.trim() : '';
        return { songs, collectionName };

    } catch (e) {
        logFn(`❌ [专家模式] 执行异常: ` + String(e));
        return null;
    }
}
