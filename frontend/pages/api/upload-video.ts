/**
 * API endpoint for uploading motion control videos to Supabase storage
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';

// Disable Next.js body parsing for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration');
}

type UploadResponse = {
  url: string;
  path: string;
  size: number;
};

type ErrorResponse = {
  error: string;
  details?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse | ErrorResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check Supabase configuration
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({
      error: 'Server configuration error',
      details: 'Supabase is not configured'
    });
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the multipart form data
    const form = formidable({
      maxFileSize: 100 * 1024 * 1024, // 100MB max file size
      keepExtensions: true,
    });

    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>(
      (resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) reject(err);
          else resolve([fields, files]);
        });
      }
    );

    // Get the uploaded file
    const fileArray = files.file;
    if (!fileArray || fileArray.length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];
    if (!allowedTypes.includes(file.mimetype || '')) {
      return res.status(400).json({
        error: 'Invalid file type',
        details: 'Only MP4, WebM, and MOV videos are supported'
      });
    }

    // Read the file
    const fileBuffer = fs.readFileSync(file.filepath);

    // Generate storage path
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = file.originalFilename?.split('.').pop() || 'mp4';
    const storagePath = `videos/motion-control/${timestamp}-${randomString}.${extension}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('media_library')
      .upload(storagePath, fileBuffer, {
        contentType: file.mimetype || 'video/mp4',
        upsert: false,
      });

    // Clean up temp file
    fs.unlinkSync(file.filepath);

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({
        error: 'Upload failed',
        details: error.message
      });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('media_library')
      .getPublicUrl(storagePath);

    // Return success response
    return res.status(200).json({
      url: publicUrl,
      path: storagePath,
      size: file.size || 0,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
