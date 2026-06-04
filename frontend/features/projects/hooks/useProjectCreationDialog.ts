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

const PROJECT_CREATE_HANDOFF_TIMEOUT_MS = 15_000;
const PROJECT_CREATE_HANDOFF_TIMEOUT_MESSAGE =
  "Project was created, but opening it timed out. Close this dialog and open it from Projects.";

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

const withProjectCreateHandoffDeadline = async (run: () => Promise<void> | void): Promise<void> => {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  const timeoutPromise = new Promise<void>((_resolve, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(new Error(PROJECT_CREATE_HANDOFF_TIMEOUT_MESSAGE));
    }, PROJECT_CREATE_HANDOFF_TIMEOUT_MS);
  });
  try {
    await Promise.race([Promise.resolve(run()), timeoutPromise]);
  } finally {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
  }
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
      if (onCreatedProject) {
        await withProjectCreateHandoffDeadline(() => onCreatedProject(project));
      }
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
