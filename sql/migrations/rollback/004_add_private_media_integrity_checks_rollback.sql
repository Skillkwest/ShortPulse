-- Roll back private media integrity constraints introduced in migration 004.

alter table media_files
    drop constraint if exists media_files_private_path_source_check;

alter table media_files
    drop constraint if exists media_files_private_source_shape_check;
