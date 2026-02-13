-- Persist Character Manager description text on each character record.
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS guards.

alter table characters
    add column if not exists description text not null default '';

alter table characters
    drop constraint if exists characters_description_length_check;
alter table characters
    add constraint characters_description_length_check
    check (char_length(description) <= 150);
