/**
 * THÉRÈSE v2 - Agents Settings Tab
 *
 * Configuration des agents IA embarqués (Atelier).
 * BYOK, modèle, chemin source, statut.
 */

import { useState, useEffect } from 'react';
import { Zap, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { getAgentStatus, getAgentConfig, updateAgentConfig } from '../../services/api/agents';
import type { AgentStatusResponse, AgentConfigResponse } from '../../services/api/agents';
import { useAtelierStore } from '../../stores/atelierStore';

export function AgentsTab() {
  const [status, setStatus] = useState<AgentStatusResponse | null>(null);
  const [, setConfig] = useState<AgentConfigResponse | null>(null);
  const [sourcePath, setSourcePathInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const setSourcePath = useAtelierStore((s) => s.setSourcePath);

  useEffect(() => {
    Promise.all([
      getAgentStatus().catch(() => null),
      getAgentConfig().catch(() => null),
    ]).then(([s, c]) => {
      setStatus(s);
      setConfig(c);
      if (c?.source_path) setSourcePathInput(c.source_path);
      setLoading(false);
    });
  }, []);

  const handleSavePath = async () => {
    if (!sourcePath.trim()) return;
    setSaving(true);
    try {
      const updated = await updateAgentConfig({ source_path: sourcePath.trim() });
      setConfig(updated);
      setSourcePath(sourcePath.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // Refresh status
      const s = await getAgentStatus().catch(() => null);
      setStatus(s);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshStatus = async () => {
    setLoading(true);
    const s = await getAgentStatus().catch(() => null);
    setStatus(s);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-text-muted">
        Chargement...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-text flex items-center gap-2">
          <Zap size={18} className="text-purple-400" />
          Agents IA Embarqués
        </h3>
        <p className="mt-1 text-sm text-text-muted">
          Thérèse (PM/Guide) et Zézette (Dev) peuvent améliorer l'app directement.
        </p>
      </div>

      {/* Statut */}
      <div className="rounded-lg border border-border/50 bg-surface-elevated/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-text">Statut</h4>
          <button
            onClick={handleRefreshStatus}
            className="text-xs text-text-muted hover:text-text transition"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="space-y-2 text-sm">
          <StatusRow label="Git" ok={status?.git_available} />
          <StatusRow label="Dépôt détecté" ok={status?.repo_detected} />
          <StatusRow label="Thérèse" ok={status?.therese_ready} />
          <StatusRow label="Zézette" ok={status?.zezette_ready} />
          {status?.current_branch && (
            <div className="flex items-center justify-between text-text-muted">
              <span>Branche</span>
              <span className="font-mono text-xs">{status.current_branch}</span>
            </div>
          )}
          {status?.active_tasks !== undefined && status.active_tasks > 0 && (
            <div className="flex items-center justify-between text-text-muted">
              <span>Tâches actives</span>
              <span className="text-amber-400">{status.active_tasks}</span>
            </div>
          )}
        </div>
      </div>

      {/* Chemin du source */}
      <div className="rounded-lg border border-border/50 bg-surface-elevated/30 p-4">
        <h4 className="text-sm font-medium text-text mb-2">
          Chemin du code source
        </h4>
        <p className="text-xs text-text-muted mb-3">
          Chemin local vers votre clone/fork du repo Thérèse. Les agents travailleront sur ce dossier.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={sourcePath}
            onChange={(e) => setSourcePathInput(e.target.value)}
            placeholder="/chemin/vers/Synoptia-THERESE"
            className="flex-1 rounded-lg border border-border/50 bg-bg px-3 py-2 text-sm text-text placeholder-text-muted/50 outline-none focus:border-purple-500/50"
          />
          <button
            onClick={handleSavePath}
            disabled={saving || !sourcePath.trim()}
            className="rounded-lg bg-purple-500/20 px-4 py-2 text-sm font-medium text-purple-400 transition hover:bg-purple-500/30 disabled:opacity-50"
          >
            {saving ? '...' : saved ? 'OK' : 'Sauver'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-border/50 bg-surface-elevated/30 p-4">
        <h4 className="text-sm font-medium text-text mb-2">Comment ça marche</h4>
        <ul className="space-y-1.5 text-xs text-text-muted">
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">1.</span>
            <span>Forkez le repo <code className="text-text">Synoptia-THERESE</code> sur GitHub</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">2.</span>
            <span>Clonez votre fork localement</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">3.</span>
            <span>Indiquez le chemin ci-dessus</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">4.</span>
            <span>Ouvrez l'Atelier (bouton <Zap size={10} className="inline text-purple-400" /> ou <kbd className="px-1 py-0.5 rounded bg-bg border border-border/50 text-text">Cmd+Shift+A</kbd>)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{label}</span>
      {ok === undefined ? (
        <AlertCircle size={14} className="text-text-muted/50" />
      ) : ok ? (
        <CheckCircle size={14} className="text-green-400" />
      ) : (
        <XCircle size={14} className="text-red-400" />
      )}
    </div>
  );
}
