import { useState, useEffect, useRef, useCallback } from 'react';

interface DraftData {
  title: string;
  content: string;
  excerpt: string;
  coverImage: string;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED';
}

const DRAFT_PREFIX = 'draft-post-';

function loadDraft(draftKey: string): DraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + draftKey);
    if (!raw) return null;
    return JSON.parse(raw) as DraftData;
  } catch {
    return null;
  }
}

function saveDraft(draftKey: string, data: DraftData): void {
  try {
    localStorage.setItem(DRAFT_PREFIX + draftKey, JSON.stringify(data));
  } catch {
    // localStorage full or disabled — silently ignore
  }
}

function clearDraft(draftKey: string): void {
  localStorage.removeItem(DRAFT_PREFIX + draftKey);
}

export function useAutoSave(
  draftKey: string,
  data: DraftData,
  isDirty: boolean,
) {
  const [savedDraft, setSavedDraft] = useState<DraftData | null>(null);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Check for saved draft on mount
  useEffect(() => {
    const existing = loadDraft(draftKey);
    if (existing && existing.content) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setSavedDraft(existing);
      setShowRestoreBanner(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [draftKey]);

  // Auto-save with debounce (2s)
  useEffect(() => {
    if (!isDirty) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveDraft(draftKey, data);
    }, 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [draftKey, data, isDirty]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const restoreDraft = useCallback(() => {
    if (savedDraft) {
      setShowRestoreBanner(false);
      return savedDraft;
    }
    return null;
  }, [savedDraft]);

  const discardDraft = useCallback(() => {
    clearDraft(draftKey);
    setSavedDraft(null);
    setShowRestoreBanner(false);
  }, [draftKey]);

  const onSaveSuccess = useCallback(() => {
    clearDraft(draftKey);
    setSavedDraft(null);
    setShowRestoreBanner(false);
  }, [draftKey]);

  return { savedDraft, showRestoreBanner, restoreDraft, discardDraft, onSaveSuccess };
}
