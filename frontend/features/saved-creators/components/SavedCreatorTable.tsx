/**
 * Saved creators table with search/filter and actions.
 */
import { ChangeEvent } from "react";
import { UserCircle } from "phosphor-react";
import { Creator } from "../types";
import { formatNumber } from "../utils/formatters";
import { getProfileUrl } from "../utils/handles";

type Props = {
  creators: Creator[];
  filtered: Creator[];
  search: string;
  loading: boolean;
  error: string | null;
  onSearchChange: (value: string) => void;
  onRemove: (id: string) => void;
};

export const SavedCreatorTable = ({
  creators,
  filtered,
  search,
  loading,
  error,
  onSearchChange,
  onRemove,
}: Props) => {
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  };

  return (
    <section className="panel creator-panel saved-list-panel spacious">
      <div className="creator-form-header saved-list-header">
        <div>
          <h3>Saved list</h3>
        </div>
        <div className="saved-list-tools">
          <input
            className="creator-search"
            type="text"
            placeholder="Filter saved creators"
            value={search}
            onChange={handleSearchChange}
            aria-label="Search creators"
          />
          <span className="pill pill-ghost subtle-pill">
            {filtered.length} / {creators.length}
          </span>
        </div>
      </div>
      <div className="creator-table-wrap">
        <table className="creator-table">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Platform</th>
              <th className="numeric-col">Followers</th>
              <th className="numeric-col">Avg views</th>
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="table-status" colSpan={5}>
                  Loading your creators…
                </td>
              </tr>
            )}
            {!loading && !filtered.length && !error && (
              <tr>
                <td className="table-status" colSpan={5}>
                  No creators match your search.
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td className="table-status error" colSpan={5}>
                  {error}
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((creator) => (
                <tr key={creator.id}>
                  <td>
                    <div className="creator-cell">
                      <div className="creator-avatar small">
                        {creator.avatarUrl ? (
                          <img src={creator.avatarUrl} alt="" aria-hidden="true" />
                        ) : (
                          <UserCircle size={18} weight="regular" />
                        )}
                      </div>
                      <div>
                        <p className="creator-handle">@{creator.handle}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="pill pill-ghost subtle-pill tight-pill">{creator.platform}</span>
                  </td>
                  <td className="numeric-col">{formatNumber(creator.followers)}</td>
                  <td className="numeric-col">{formatNumber(creator.avgViews)}</td>
                  <td className="actions-col">
                    <a
                      className="ghost-btn tiny plain-link"
                      href={getProfileUrl(creator.handle, creator.platform)}
                      target="_blank"
                      rel="noreferrer noopener"
                      referrerPolicy="no-referrer"
                      aria-label={`Open ${creator.platform} profile for ${creator.handle}`}
                    >
                      Profile
                    </a>
                    <button
                      className="ghost-btn tiny danger-link"
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRemove(creator.id);
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
