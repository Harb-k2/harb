const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("harbAgent", {
  getStatus: () => ipcRenderer.invoke("agent:status"),
  pair: input => ipcRenderer.invoke("agent:pair", input),
  heartbeat: () => ipcRenderer.invoke("agent:heartbeat"),
  selectAndPreviewFile: () => ipcRenderer.invoke("agent:select-and-preview-file"),
  openAuditFolder: () => ipcRenderer.invoke("agent:open-audit-folder"),
  requestLocalApproval: input => ipcRenderer.invoke("agent:request-local-approval", input),
  checkProgramGate: () => ipcRenderer.invoke("agent:gate-run-program"),
  checkCommandGate: () => ipcRenderer.invoke("agent:gate-run-command"),
  checkModifyFileGate: () => ipcRenderer.invoke("agent:gate-modify-file"),
  openDashboard: () => ipcRenderer.invoke("agent:open-dashboard"),
});
