// static/expert.js
(function() {
  'use strict';

  const { apiGet, apiPost } = window.SongloftPlugin || {};

  let exCmdConfigs = [];

  // 从弹窗表单收集当前配置 (供保存 & 测试复用)
  function collectModalConfig() {
    const limitStr = document.getElementById('modal-ex-cmd-limit').value;
    return {
      engine: 'expert',
      name: document.getElementById('modal-ex-cmd-name').value.trim(),
      method: document.getElementById('modal-ex-cmd-method').value,
      urlTemplate: document.getElementById('modal-ex-cmd-url').value.trim(),
      postBody: document.getElementById('modal-ex-cmd-postbody').value.trim(),
      responseType: document.getElementById('modal-ex-cmd-restype').value,
      customHeaders: document.getElementById('modal-ex-cmd-headers').value.trim(),
      actionReply: document.getElementById('modal-ex-cmd-actionreply').value.trim(),
      listPath: document.getElementById('modal-ex-cmd-listpath').value.trim(),
      fieldTitle: document.getElementById('modal-ex-cmd-f-title').value.trim(),
      fieldUrl: document.getElementById('modal-ex-cmd-f-url').value.trim(),
      fieldArtist: document.getElementById('modal-ex-cmd-f-artist').value.trim(),
      fieldCover: document.getElementById('modal-ex-cmd-f-cover').value.trim(),
      fieldAlbum: document.getElementById('modal-ex-cmd-f-album').value.trim(),
      fieldDuration: document.getElementById('modal-ex-cmd-f-duration').value.trim(),
      limit: limitStr ? parseInt(limitStr, 10) : '',
      shuffle: document.getElementById('modal-ex-cmd-shuffle').checked
    };
  }

  function fmtDuration(sec) {
    sec = parseInt(sec, 10) || 0;
    if (sec <= 0) return '';
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ==========================================
  // 加载 / 保存
  // ==========================================
  async function loadExCmds() {
    try {
      const res = await apiGet('/store?key=xiaoai_expert_configs');
      if (res && res.data && res.data !== 'null' && res.data !== '[]') {
        exCmdConfigs = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      }
      if (!Array.isArray(exCmdConfigs)) exCmdConfigs = [];
    } catch (e) { exCmdConfigs = []; }
    renderExCmdContainers();
  }

  async function autoSaveExCmds() {
    await apiPost('/store', { key: 'xiaoai_expert_configs', value: JSON.stringify(exCmdConfigs) });
  }

  // ==========================================
  // 渲染条目列表
  // ==========================================
  function renderExCmdContainers() {
    const mainContainer = document.getElementById('ex-cmd-containers');
    if (!mainContainer) return;
    mainContainer.innerHTML = '';

    if (exCmdConfigs.length === 0) {
      mainContainer.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--md-on-surface-variant); font-size: 13px;">暂无自定义条目，点击上方「➕ 新增控制条目」开始配置。</div>`;
      return;
    }

    exCmdConfigs.forEach((cfg, index) => {
      const box = document.createElement('div');
      box.className = 'mh-field'; box.id = `ex-cmd-box-${index}`;

      const restypeMap = { auto: '自动探测', json: 'JSON列表', audio: '直链音频', action: '指令调用' };

      let badgeHtml = `<div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">`;
      badgeHtml += `<span style="border: 1px solid var(--md-outline-variant); padding: 2px 6px; border-radius: 4px; font-size: 11px; color: var(--md-on-surface-variant);">${cfg.method || 'GET'}</span>`;
      badgeHtml += `<span style="border: 1px solid var(--md-outline-variant); padding: 2px 6px; border-radius: 4px; font-size: 11px; color: var(--md-on-surface-variant);">${restypeMap[cfg.responseType || 'auto']}</span>`;
      if (cfg.responseType !== 'action' && cfg.limit) badgeHtml += `<span style="border: 1px solid var(--md-outline-variant); padding: 2px 6px; border-radius: 4px; font-size: 11px; color: var(--md-on-surface-variant);">限制: ${cfg.limit}首</span>`;
      if (cfg.responseType !== 'action' && cfg.shuffle) badgeHtml += `<span style="border: 1px solid var(--md-outline-variant); padding: 2px 6px; border-radius: 4px; font-size: 11px; color: var(--md-on-surface-variant);">乱序</span>`;
      badgeHtml += `</div>`;

      const nameText = cfg.name && cfg.name.trim() ? cfg.name.trim() : '未命名条目';

      let titleHtml = `<div style="display: flex; justify-content: flex-start; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
        <label style="margin-bottom: 0; color: var(--md-on-surface); font-weight: bold;">🧩 ${nameText}</label>
        ${badgeHtml}
        <button class="mh-btn" style="height: 24px; padding: 0 10px; font-size: 12px; border-color: var(--md-outline); color: var(--md-on-surface-variant);" onclick="window._editExCmdGroup(${index})">✏️ 编辑</button>
      </div>`;

      const urlText = cfg.urlTemplate || '';
      const urlHtml = `<div style="font-size: 11px; color: var(--md-on-surface-variant); margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${urlText}">${urlText}</div>`;

      const isEnabled = cfg.enabled !== false;

      box.innerHTML = `
        ${titleHtml}
        ${urlHtml}
        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px; justify-content: space-between;">
          <div id="ex-tags-${index}" class="mh-tag-container" style="flex: 1; margin-bottom: 0; transition: opacity 0.2s;"></div>
          <input type="checkbox" id="ex-enable-${index}" class="mh-switch-input" ${isEnabled ? 'checked' : ''} style="margin-top: 2px; flex-shrink: 0;" title="启用/停用此组">
        </div>
        <div id="ex-input-area-${index}" style="display: flex; gap: 12px; align-items: center; transition: opacity 0.2s;">
          <input type="text" id="ex-input-${index}" class="mh-input" placeholder="输入唤醒口令，如：我的电台">
          <button class="mh-btn" id="ex-btn-add-${index}">➕ 口令</button>
        </div>
      `;

      mainContainer.appendChild(box);

      document.getElementById(`ex-btn-add-${index}`).addEventListener('click', () => addExCmd(index));
      document.getElementById(`ex-input-${index}`).addEventListener('keypress', (e) => { if (e.key === 'Enter') addExCmd(index); });

      const toggleEl = document.getElementById(`ex-enable-${index}`);
      const tagsEl = document.getElementById(`ex-tags-${index}`);
      const inputArea = document.getElementById(`ex-input-area-${index}`);

      const updateUiState = (enabled) => {
        const opacity = enabled ? '1' : '0.4';
        const ptrEvents = enabled ? 'auto' : 'none';
        if (tagsEl) { tagsEl.style.opacity = opacity; tagsEl.style.pointerEvents = ptrEvents; }
        if (inputArea) { inputArea.style.opacity = opacity; inputArea.style.pointerEvents = ptrEvents; }
      };
      updateUiState(isEnabled);

      toggleEl?.addEventListener('change', async (e) => {
        cfg.enabled = e.target.checked;
        updateUiState(cfg.enabled);
        await autoSaveExCmds();
      });

      renderExTags(index);
    });
  }

  function renderExTags(index) {
    const container = document.getElementById(`ex-tags-${index}`);
    if (!container) return;

    const cfg = exCmdConfigs[index];
    const arr = (cfg && cfg.cmds) ? cfg.cmds : [];

    container.innerHTML = '';
    if (arr.length === 0) {
      container.innerHTML = `<span style="color: var(--md-error); font-size: 13px; display: inline-flex; align-items: center; height: 28px; font-weight: 500;">⚠️ 请增加口令</span>`;
      return;
    }

    arr.forEach((cmd, idx) => {
      const tag = document.createElement('div');
      tag.className = 'mh-tag';
      tag.innerHTML = `<span>${cmd}</span> <span class="mh-tag-close" title="移除">×</span>`;
      tag.querySelector('.mh-tag-close').addEventListener('click', () => {
        cfg.cmds.splice(idx, 1);
        renderExTags(index); autoSaveExCmds();
      });
      container.appendChild(tag);
    });
  }

  function addExCmd(index) {
    const inputEl = document.getElementById(`ex-input-${index}`);
    const val = inputEl.value.trim();
    if (!val) return;

    const cfg = exCmdConfigs[index];
    if (!cfg) return;
    if (!cfg.cmds) cfg.cmds = [];
    if (cfg.cmds.includes(val)) return alert('⚠️ 该口令已存在');

    // 检查是否与其它条目重复
    for (let i = 0; i < exCmdConfigs.length; i++) {
      if (i === index) continue;
      if (Array.isArray(exCmdConfigs[i].cmds) && exCmdConfigs[i].cmds.includes(val)) {
        return alert('⚠️ 该口令已被其它条目占用');
      }
    }

    cfg.cmds.push(val);
    inputEl.value = '';
    renderExTags(index); autoSaveExCmds();
  }

  // ==========================================
  // 弹窗逻辑
  // ==========================================
  document.addEventListener('DOMContentLoaded', () => {
    loadExCmds();

    let currentEditIndex = null;

    const methodEl = document.getElementById('modal-ex-cmd-method');
    const postBodyField = document.getElementById('ex-postbody-field');
    const restypeEl = document.getElementById('modal-ex-cmd-restype');
    const jsonFields = document.getElementById('ex-json-fields');
    const actionFields = document.getElementById('ex-action-fields');
    const playbackFields = document.getElementById('ex-playback-fields');

    const updatePostBodyUi = () => {
      if (postBodyField) postBodyField.style.display = methodEl.value === 'POST' ? 'block' : 'none';
    };
    const updateJsonFieldsUi = () => {
      const rt = restypeEl.value;
      const isAction = rt === 'action';
      if (jsonFields) jsonFields.style.display = (rt === 'audio' || isAction) ? 'none' : 'block';
      if (actionFields) actionFields.style.display = isAction ? 'block' : 'none';
      if (playbackFields) playbackFields.style.display = isAction ? 'none' : 'block';
    };

    methodEl?.addEventListener('change', updatePostBodyUi);
    restypeEl?.addEventListener('change', updateJsonFieldsUi);

    const resetModal = () => {
      document.getElementById('modal-ex-cmd-name').value = '';
      document.getElementById('modal-ex-cmd-method').value = 'GET';
      document.getElementById('modal-ex-cmd-url').value = '';
      document.getElementById('modal-ex-cmd-postbody').value = '';
      document.getElementById('modal-ex-cmd-restype').value = 'auto';
      document.getElementById('modal-ex-cmd-headers').value = '';
      document.getElementById('modal-ex-cmd-actionreply').value = '';
      document.getElementById('modal-ex-cmd-listpath').value = '';
      document.getElementById('modal-ex-cmd-f-title').value = '';
      document.getElementById('modal-ex-cmd-f-url').value = '';
      document.getElementById('modal-ex-cmd-f-artist').value = '';
      document.getElementById('modal-ex-cmd-f-cover').value = '';
      document.getElementById('modal-ex-cmd-f-album').value = '';
      document.getElementById('modal-ex-cmd-f-duration').value = '';
      document.getElementById('modal-ex-cmd-limit').value = '';
      document.getElementById('modal-ex-cmd-shuffle').checked = false;
      const tkw = document.getElementById('modal-ex-cmd-testkw');
      if (tkw) tkw.value = '';
      const tr = document.getElementById('ex-test-result');
      if (tr) { tr.style.display = 'none'; tr.innerHTML = ''; }
      updatePostBodyUi();
      updateJsonFieldsUi();
    };

    document.getElementById('btn-show-add-ex-cmd')?.addEventListener('click', () => {
      currentEditIndex = null;
      document.getElementById('ex-cmd-modal-title').innerText = '➕ 新增控制条目';
      document.getElementById('btn-ex-cmd-confirm').innerText = '✅ 创建';
      document.getElementById('btn-ex-cmd-delete').style.display = 'none';
      resetModal();
      document.getElementById('ex-cmd-modal-mask').style.display = 'flex';
    });

    window._editExCmdGroup = function(index) {
      const cfg = exCmdConfigs[index];
      if (!cfg) return;
      currentEditIndex = index;

      document.getElementById('ex-cmd-modal-title').innerText = '✏️ 编辑控制条目';
      document.getElementById('btn-ex-cmd-confirm').innerText = '✅ 修改';
      document.getElementById('btn-ex-cmd-delete').style.display = 'inline-flex';

      document.getElementById('modal-ex-cmd-name').value = cfg.name || '';
      document.getElementById('modal-ex-cmd-method').value = cfg.method || 'GET';
      document.getElementById('modal-ex-cmd-url').value = cfg.urlTemplate || '';
      document.getElementById('modal-ex-cmd-postbody').value = cfg.postBody || '';
      document.getElementById('modal-ex-cmd-restype').value = cfg.responseType || 'auto';
      document.getElementById('modal-ex-cmd-headers').value = cfg.customHeaders || '';
      document.getElementById('modal-ex-cmd-actionreply').value = cfg.actionReply || '';
      document.getElementById('modal-ex-cmd-listpath').value = cfg.listPath || '';
      document.getElementById('modal-ex-cmd-f-title').value = cfg.fieldTitle || '';
      document.getElementById('modal-ex-cmd-f-url').value = cfg.fieldUrl || '';
      document.getElementById('modal-ex-cmd-f-artist').value = cfg.fieldArtist || '';
      document.getElementById('modal-ex-cmd-f-cover').value = cfg.fieldCover || '';
      document.getElementById('modal-ex-cmd-f-album').value = cfg.fieldAlbum || '';
      document.getElementById('modal-ex-cmd-f-duration').value = cfg.fieldDuration || '';
      document.getElementById('modal-ex-cmd-limit').value = cfg.limit || '';
      document.getElementById('modal-ex-cmd-shuffle').checked = !!cfg.shuffle;

      updatePostBodyUi();
      updateJsonFieldsUi();

      const tkw = document.getElementById('modal-ex-cmd-testkw');
      if (tkw) tkw.value = '';
      const tr = document.getElementById('ex-test-result');
      if (tr) { tr.style.display = 'none'; tr.innerHTML = ''; }

      document.getElementById('ex-cmd-modal-mask').style.display = 'flex';
    };

    const hideModal = () => { document.getElementById('ex-cmd-modal-mask').style.display = 'none'; };
    document.getElementById('btn-ex-cmd-cancel')?.addEventListener('click', hideModal);
    document.getElementById('ex-cmd-modal-mask')?.addEventListener('click', (e) => { if (e.target.id === 'ex-cmd-modal-mask') hideModal(); });

    document.getElementById('btn-ex-cmd-delete')?.addEventListener('click', async () => {
      if (currentEditIndex === null) return;
      if (!confirm('确定彻底删除该条目吗？（包含其中的所有口令词将一并清除）')) return;
      exCmdConfigs.splice(currentEditIndex, 1);
      await autoSaveExCmds();
      hideModal();
      renderExCmdContainers();
    });

    document.getElementById('btn-ex-cmd-confirm')?.addEventListener('click', async () => {
      const payload = collectModalConfig();

      if (!payload.urlTemplate) return alert('⚠️ 请填写目标 URL');
      if (!/^https?:\/\//i.test(payload.urlTemplate)) return alert('⚠️ 目标 URL 必须以 http:// 或 https:// 开头');

      if (currentEditIndex !== null) {
        const cfg = exCmdConfigs[currentEditIndex];
        Object.assign(cfg, payload);
      } else {
        exCmdConfigs.push({ ...payload, enabled: true, cmds: [] });
      }

      await autoSaveExCmds();
      hideModal();
      renderExCmdContainers();
    });

    // 🧪 测试调用
    document.getElementById('btn-ex-cmd-test')?.addEventListener('click', async () => {
      const cfg = collectModalConfig();
      const keyword = document.getElementById('modal-ex-cmd-testkw').value.trim();
      const resultBox = document.getElementById('ex-test-result');
      const testBtn = document.getElementById('btn-ex-cmd-test');

      if (!cfg.urlTemplate) return alert('⚠️ 请先填写目标 URL 再测试');
      if (!/^https?:\/\//i.test(cfg.urlTemplate)) return alert('⚠️ 目标 URL 必须以 http:// 或 https:// 开头');

      resultBox.style.display = 'block';
      resultBox.innerHTML = `<div style="font-size: 13px; color: var(--md-on-surface-variant);">⏳ 正在请求并解析...</div>`;
      testBtn.disabled = true;
      const oldText = testBtn.innerText;
      testBtn.innerText = '测试中...';

      try {
        const res = await apiPost('/expert/test', { config: cfg, keyword });

        if (res && res.error) {
          resultBox.innerHTML = `<div style="font-size: 13px; color: var(--md-error);">❌ ${escapeHtml(res.error)}</div>`;
          return;
        }

        const logsHtml = (res.logs && res.logs.length)
          ? `<div style="background: var(--md-surface-variant, rgba(0,0,0,0.04)); border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 11px; line-height: 1.7; color: var(--md-on-surface-variant); white-space: pre-wrap; word-break: break-all;">${res.logs.map(escapeHtml).join('\n')}</div>`
          : '';

        // 纯指令调用模式结果
        if (res.isAction) {
          if (res.ok) {
            const replyHtml = res.actionReply ? `<div style="font-size: 12px; color: var(--md-on-surface-variant); margin-top: 6px;">🗣️ 触发时将回话："${escapeHtml(res.actionReply)}"</div>` : `<div style="font-size: 12px; color: var(--md-on-surface-variant); margin-top: 6px;">🔇 未设置回话，触发时静默执行</div>`;
            const snippetHtml = res.actionSnippet ? `<div style="background: var(--md-surface-variant, rgba(0,0,0,0.04)); border-radius: 6px; padding: 8px 10px; margin-top: 8px; font-size: 11px; color: var(--md-on-surface-variant); white-space: pre-wrap; word-break: break-all; max-height: 120px; overflow-y: auto;">${escapeHtml(res.actionSnippet)}</div>` : '';
            resultBox.innerHTML = logsHtml +
              `<div style="font-size: 13px; color: var(--md-primary, #4caf50);">✅ 指令调用成功 (HTTP ${res.actionStatus}，耗时 ${res.cost || 0}ms)</div>${replyHtml}${snippetHtml}`;
          } else {
            const snippetHtml = res.actionSnippet ? `<div style="background: var(--md-surface-variant, rgba(0,0,0,0.04)); border-radius: 6px; padding: 8px 10px; margin-top: 8px; font-size: 11px; color: var(--md-on-surface-variant); white-space: pre-wrap; word-break: break-all; max-height: 120px; overflow-y: auto;">${escapeHtml(res.actionSnippet)}</div>` : '';
            resultBox.innerHTML = logsHtml +
              `<div style="font-size: 13px; color: var(--md-error);">⚠️ 指令调用失败 (HTTP ${res.actionStatus || 0}，耗时 ${res.cost || 0}ms)</div>${snippetHtml}`;
          }
          return;
        }

        if (!res.ok || !res.songs || res.songs.length === 0) {
          resultBox.innerHTML = logsHtml + `<div style="font-size: 13px; color: var(--md-error);">⚠️ 未解析出任何可播放歌曲 (耗时 ${res.cost || 0}ms)，请检查 URL 与字段映射。</div>`;
          return;
        }

        let rows = '';
        res.songs.forEach((s, i) => {
          const dur = fmtDuration(s.duration);
          rows += `<div style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid var(--md-outline-variant); font-size: 12px;">
            <span style="color: var(--md-on-surface-variant); width: 22px; flex-shrink: 0;">${i + 1}</span>
            <div style="flex: 1; min-width: 0;">
              <div style="color: var(--md-on-surface); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(s.title)}${dur ? ` <span style="color: var(--md-on-surface-variant);">(${dur})</span>` : ''}</div>
              <div style="color: var(--md-on-surface-variant); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 11px;">${escapeHtml(s.artist)}${s.album ? ' · ' + escapeHtml(s.album) : ''}</div>
              <div style="color: var(--md-on-surface-variant); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 10px; opacity: 0.7;" title="${escapeHtml(s.url)}">${escapeHtml(s.url)}</div>
            </div>
          </div>`;
        });

        const more = res.total > res.songs.length ? `<div style="font-size: 11px; color: var(--md-on-surface-variant); padding: 6px 8px;">…共 ${res.total} 首，仅预览前 ${res.songs.length} 首</div>` : '';

        resultBox.innerHTML = logsHtml +
          `<div style="font-size: 13px; color: var(--md-primary, #4caf50); margin-bottom: 8px;">✅ 成功解析 ${res.total} 首歌曲 (耗时 ${res.cost || 0}ms)${res.collectionName ? '，歌单名：' + escapeHtml(res.collectionName) : ''}</div>
           <div style="border: 1px solid var(--md-outline-variant); border-radius: 6px; overflow: hidden;">${rows}${more}</div>`;

      } catch (e) {
        resultBox.innerHTML = `<div style="font-size: 13px; color: var(--md-error);">❌ 测试失败：${escapeHtml(String(e))}</div>`;
      } finally {
        testBtn.disabled = false;
        testBtn.innerText = oldText;
      }
    });
  });
})();
