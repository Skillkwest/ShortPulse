import Image from "next/image";
import Link from "next/link";
import React from "react";

import { ToolId, ToolMeta } from "./types";

type ToolbarProps = {
  tools: ToolMeta[];
  toolIcons: Record<ToolId, React.ComponentType<any>>;
  selectedTool: ToolId;
  onSelect: (toolId: ToolId) => void;
};

export function Toolbar({ tools, toolIcons, selectedTool, onSelect }: ToolbarProps) {
  return (
    <aside className="panel ai-panel ai-toolbar ai-toolbar-floating">
      <div className="toolbar-logo-card">
        <Image src="/brand-logo.png" alt="Brand logo" width={160} height={46} priority />
      </div>
      <Link href="/dashboard" className="ghost-btn small toolbar-back-link">
        ← Back to dashboard
      </Link>
      <div className="toolbar-brand toolbar-title-only">
        <div>
          <p className="eyebrow">Tools</p>
        </div>
      </div>
      <div className="toolbar-list">
        {tools.map((tool) => {
          const IconComponent = toolIcons[tool.id];
          return (
            <button
              key={tool.id}
              type="button"
              className={`toolbar-item ${selectedTool === tool.id ? "is-active" : ""}`}
              onClick={() => onSelect(tool.id)}
            >
              {IconComponent ? <IconComponent size={18} weight="bold" /> : null}
              <div className="toolbar-copy">
                <span className="toolbar-label">{tool.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
