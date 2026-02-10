declare module "formidable" {
  import type { IncomingMessage } from "http";

  function formidable(options?: formidable.Options): formidable.IncomingForm;

  namespace formidable {
    interface File {
      filepath: string;
      mimetype?: string | null;
      originalFilename?: string | null;
      size?: number;
    }

    interface Fields {
      [key: string]: string | string[] | undefined;
    }

    interface Files {
      [key: string]: File | File[] | undefined;
    }

    interface Options {
      maxFileSize?: number;
      keepExtensions?: boolean;
    }

    interface IncomingForm {
      parse(
        req: IncomingMessage,
        callback: (err: Error | null, fields: Fields, files: Files) => void
      ): void;
    }
  }

  export = formidable;
}
