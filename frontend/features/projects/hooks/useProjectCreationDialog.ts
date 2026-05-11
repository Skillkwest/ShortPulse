/**
 * Shared project-creation dialog controller.
 * Owns title input, async create state, and post-create handoff behavior.
 */
import { useCallback, useMemo, useState } from "react";
import {
  createProject,
  DEFAULT_NEW_PROJECT_TITLE,
  type CreatedProjectRecord,
} from "../logic/projectCreateClient";

type UseProjectCreationDialogParams = {
  onCreatedProject?: (project: CreatedProjectRecord) => Promise<void> | void;
};

type UseProjectCreationDialogResult = {
  isOpen: boolean;
  title: string;
  error: string | null;
  isCreating: boolean;
  canSubmit: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  setTitle: (value: string) => void;
  submit: () => Promise<CreatedProjectRecord | null>;
};

/**
 * Returns reusable project-creation dialog state for dashboard and AI Studio surfaces.
 */
export const useProjectCreationDialog = ({
  onCreatedProject,
}: UseProjectCreationDialogParams): UseProjectCreationDialogResult => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitleState] = useState(DEFAULT_NEW_PROJECT_TITLE);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const canSubmit = useMemo(() => title.trim().length > 0 && !isCreating, [isCreating, title]);

  const openDialog = useCallback(() => {
    setError(null);
    setTitleState(DEFAULT_NEW_PROJECT_TITLE);
    setIsOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    if (isCreating) return;
    setIsOpen(false);
    setError(null);
  }, [isCreating]);

  const setTitle = useCallback((value: string) => {
    setTitleState(value);
  }, []);

  const submit = useCallback(async () => {
    if (isCreating) return null;
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return null;

    setIsCreating(true);
    setError(null);
    try {
      const project = await createProject(normalizedTitle);
      await onCreatedProject?.(project);
      setIsOpen(false);
      setTitleState(DEFAULT_NEW_PROJECT_TITLE);
      return project;
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create project.");
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, onCreatedProject, title]);

  return {
    isOpen,
    title,
    error,
    isCreating,
    canSubmit,
    openDialog,
    closeDialog,
    setTitle,
    submit,
  };
};
