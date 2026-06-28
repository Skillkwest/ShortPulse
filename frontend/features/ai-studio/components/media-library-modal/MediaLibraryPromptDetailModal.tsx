import React from "react";
import { TrashSimple } from "phosphor-react";
import type { MediaLibraryPromptDetailModalItem } from "../../logic/mediaLibraryPromptDetailModal";
import { SharedMediaDetailActionBar } from "../detail-modal/SharedMediaDetailActionBar";
import { SharedMediaDetailContentLayout } from "../detail-modal/SharedMediaDetailContentLayout";
import { SharedMediaDetailModalShell } from "../detail-modal/SharedMediaDetailModalShell";
import { SharedMediaDetailTopBar } from "../detail-modal/SharedMediaDetailTopBar";
import type { SharedMediaDetailActionItem } from "../detail-modal/detailModalPlatformTypes";
import { resolveSharedMediaDetailMediaActionItems } from "../detail-modal/sharedMediaDetailActions";
import { resolveSharedMediaDetailBladePlaceholder } from "../detail-modal/sharedMediaDetailPresentation";

type MediaLibraryPromptDetailModalProps = {
  item: MediaLibraryPromptDetailModalItem | null;
  onClose: () => void;
  onUsePromptItem?: (item: MediaLibraryPromptDetailModalItem) => void;
  onDeletePromptItem?: (item: MediaLibraryPromptDetailModalItem) => void;
};

export function MediaLibraryPromptDetailModal({
  item,
  onClose,
  onUsePromptItem,
  onDeletePromptItem,
}: MediaLibraryPromptDetailModalProps) {
  const actionItems = React.useMemo<SharedMediaDetailActionItem[]>(() => {
    if (!item) return [];
    const sharedItems = resolveSharedMediaDetailMediaActionItems({
      saveState: "saved",
      canDelete: item.capabilities.canDelete,
      onDelete: onDeletePromptItem ? () => onDeletePromptItem(item) : null,
      deleteIcon: <TrashSimple size={16} weight="bold" aria-hidden />,
    });
    if (!onUsePromptItem) return sharedItems;
    return [
      ...sharedItems,
      {
        id: "use-prompt",
        label: "Use",
        onClick: () => onUsePromptItem(item),
        ariaLabel: "Use prompt",
        title: "Use prompt",
      },
    ];
  }, [item, onDeletePromptItem, onUsePromptItem]);

  if (!item) return null;

  return (
    <SharedMediaDetailModalShell
      isOpen
      modalActivityId="media-library-prompt-detail-modal"
      onClose={onClose}
      ariaLabel="Text reference detail"
      backdropClassName="reference-modal-backdrop media-library-panel-preview-backdrop"
      dialogClassName="reference-modal-new is-text-only"
      backdropDataTestId="media-library-prompt-detail-backdrop"
      closeOnEscape
    >
      <SharedMediaDetailContentLayout
        topBar={
          <SharedMediaDetailTopBar
            title={item.presentation?.title ?? null}
            items={[]}
            actions={<SharedMediaDetailActionBar items={actionItems} />}
            onClose={onClose}
            closeLabel="Close text detail"
          />
        }
        mainContentClassName="art-text-detail-main"
        stageClassName="art-image-vessel art-text-detail-vessel"
        stage={
          <textarea
            className="art-text-detail-textarea"
            value={item.prompt.prompt_text}
            readOnly
            rows={12}
            placeholder={resolveSharedMediaDetailBladePlaceholder(item)}
          />
        }
      />
    </SharedMediaDetailModalShell>
  );
}
