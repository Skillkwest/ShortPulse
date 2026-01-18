/**
 * Intake form for adding creators.
 */
import { FormEvent, useEffect, useRef, useState } from "react";
import { Platform } from "../types";

type Props = {
  handle: string;
  platform: Platform;
  onHandleChange: (value: string) => void;
  onPlatformChange: (value: Platform) => void;
  onSubmit: (event: FormEvent) => void;
};

const platformOptions: Platform[] = ["Instagram", "TikTok", "YouTube"];

export const CreatorIntakeForm = ({ handle, platform, onHandleChange, onPlatformChange, onSubmit }: Props) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickAway);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <section className="panel creator-panel discovery-panel intake-panel">
      <div className="discovery-header">
        <div>
          <h3>Enter a creator handle and pick a platform</h3>
        </div>
      </div>
      <form className="creator-intake" onSubmit={onSubmit}>
        <div className="input-chip discovery-input">
          <label className="tiny subdued" htmlFor="creatorHandle">
            Creator handle
          </label>
          <div className="input-shell">
            <span className="input-prefix">@</span>
            <input
              id="creatorHandle"
              type="text"
              placeholder="creatorhandle"
              value={handle}
              onChange={(event) => onHandleChange(event.target.value)}
            />
          </div>
        </div>
        <div className="input-chip select-chip">
          <label className="tiny subdued" htmlFor="platform">
            Platform
          </label>
          <div className={`platform-select ${menuOpen ? "open" : ""}`} ref={menuRef}>
            <button
              type="button"
              className="platform-trigger"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
              id="platform"
            >
              <span>{platform}</span>
              <span className="platform-caret" aria-hidden="true">
                ▾
              </span>
            </button>
            {menuOpen && (
              <div className="platform-menu" role="listbox" aria-label="Select platform">
                {platformOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={platform === option}
                    className={`platform-option ${platform === option ? "selected" : ""}`}
                    onClick={() => {
                      onPlatformChange(option);
                      setMenuOpen(false);
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="creator-form-actions inline">
          <button className="primary-btn small" type="submit">
            Add creator
          </button>
        </div>
      </form>
    </section>
  );
};
