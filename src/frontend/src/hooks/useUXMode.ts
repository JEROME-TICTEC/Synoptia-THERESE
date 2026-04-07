/**
 * THERESE v2 - Hook useUXMode
 *
 * Expose le mode UX courant et un booleen isContributeur
 * pour conditionner l affichage des fonctions avancees.
 */

import { usePersonalisationStore, type UXMode } from '../stores/personalisationStore';

export function useUXMode() {
  const uxMode = usePersonalisationStore((s) => s.uxMode);
  const setUXMode = usePersonalisationStore((s) => s.setUXMode);

  return {
    uxMode,
    isContributeur: uxMode === 'contributeur',
    isStandard: uxMode === 'standard',
    setUXMode,
  };
}

export type { UXMode };
