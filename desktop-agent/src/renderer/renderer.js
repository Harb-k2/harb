const el = id => document.getElementById(id);
const notice = (text, kind = "") => { el("notice").textContent = text; el("notice").className = `notice ${kind}`; };

function renderStatus(status) {
  const connected = Boolean(status.agentId && status.secretConfigured);
  el("connection-badge").textContent = connected ? (status.status === "online" ? "متصل ومقيد" : "متصل بانتظار النطاقات") : "غير مقترن";
  el("connection-badge").className = `badge ${connected && status.status === "online" ? "online" : "pending"}`;
  const values = [["النظام", status.operatingSystem === "windows" ? "Windows" : "Kali Linux"], ["حالة العميل", status.status || "غير مقترن"], ["معرف العميل", status.agentId || "—"], ["آخر نبض", status.lastHeartbeatAt ? new Date(status.lastHeartbeatAt).toLocaleString("ar") : "—"]];
  el("status-list").innerHTML = values.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
  el("scope-list").innerHTML = (status.scopes?.length ? status.scopes : ["لا توجد صلاحيات مفوضة"]).map(scope => `<span>${scope}</span>`).join("");
  const policyText = status.ownerPolicy?.localAction === "deny" ? "قانون المالك: الإجراء المحلي مرفوض" : status.ownerPolicy?.localAction === "allow" ? "قانون المالك: الإجراء المحلي مسموح ضمن النطاق" : "قانون المالك: الإجراء المحلي يتطلب موافقة";
  const pending = status.pendingApprovals?.length ? status.pendingApprovals.map(item => `<article><strong>${item.action}</strong><span>${item.summary}</span><div class="approval-actions"><button type="button" data-open-owner-dashboard="true">المراجعة في لوحة المالك</button></div></article>`).join("") : "لا توجد موافقات معلقة.";
  el("pending-approvals").innerHTML = `<p class="policy-state">${policyText}</p>${pending}`;
}

async function refresh() { try { renderStatus(await window.harbAgent.getStatus()); } catch (error) { notice(error.message, "error"); } }
el("pair-form").addEventListener("submit", async event => { event.preventDefault(); notice("جارٍ التحقق من رمز الاقتران…"); try { const status = await window.harbAgent.pair({ serverUrl: el("server-url").value, name: el("agent-name").value, code: el("pair-code").value }); renderStatus(status); el("pair-code").value = ""; notice("تم الاقتران. فعّل النطاقات من لوحة Harb قبل استخدام عمليات محلية.", "success"); } catch (error) { notice(error.message || "تعذر الاقتران.", "error"); } });
el("heartbeat").addEventListener("click", async () => { try { renderStatus(await window.harbAgent.heartbeat()); notice("تم تحديث حالة العميل.", "success"); } catch (error) { notice(error.message, "error"); } });
el("preview-file").addEventListener("click", async () => { try { const result = await window.harbAgent.selectAndPreviewFile(); if (result.canceled) return; el("file-preview").textContent = `${result.name} (${result.size} بايت)\n\n${result.preview}`; notice(result.notice, "success"); } catch (error) { notice(error.message, "error"); } });
el("open-audit").addEventListener("click", () => window.harbAgent.openAuditFolder());
el("open-dashboard").addEventListener("click", async () => { try { await window.harbAgent.openDashboard(); } catch (error) { notice(error.message, "error"); } });
el("approval-form").addEventListener("submit", async event => { event.preventDefault(); try { const result = await window.harbAgent.requestLocalApproval({ operation: el("operation-type").value, summary: el("operation-summary").value }); if (result.decision === "deny") notice(result.reason || "رفض قانون المالك هذا الطلب.", "error"); else { el("operation-summary").value = ""; await refresh(); notice("تم تسجيل طلب الموافقة. لم ينفذ العميل أي إجراء.", "success"); } } catch (error) { notice(error.message, "error"); } });
el("pending-approvals").addEventListener("click", async event => { if (!event.target.closest("button[data-open-owner-dashboard]")) return; try { await window.harbAgent.openDashboard(); notice("تُحسم الموافقة من جلسة المالك المصادق عليها في لوحة Harb.", "success"); } catch (error) { notice(error.message, "error"); } });
refresh();
