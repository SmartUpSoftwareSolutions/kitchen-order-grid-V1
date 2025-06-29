import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';   // Promise-based fs API
import fsSync from 'fs';        // Classic fs API for streams
import { fileTypeFromBuffer } from 'file-type';

const router = express.Router();

const upload = multer({
  dest: 'tmp/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const PUBLIC_AUDIO_DIR = path.join(process.cwd(), 'public', 'sounds', 'custom');

// Ensure folder exists
(async () => {
  try {
    await fs.mkdir(PUBLIC_AUDIO_DIR, { recursive: true });
    console.log(`DEBUG (audio): Created directory ${PUBLIC_AUDIO_DIR}`);
  } catch (err) {
    console.error('DEBUG (audio): Failed to create audio directory:', err);
  }
})();

// POST /save-audio - Upload and save audio file
router.post('/save-audio', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.body.fileName) {
      return res.status(400).json({ error: 'Missing file or fileName' });
    }

    const buffer = await fs.readFile(req.file.path);
    const fileType = await fileTypeFromBuffer(buffer);
    if (!fileType || !fileType.mime.startsWith('audio/')) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Invalid file type. Only audio files are allowed.' });
    }

    const fileName = path.basename(req.body.fileName);
    if (!fileName.endsWith('.mp3')) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Only .mp3 files are allowed.' });
    }

    const targetPath = path.join(PUBLIC_AUDIO_DIR, fileName);
    console.log(`DEBUG (save-audio): Saving file to ${targetPath}`);

    await fs.rename(req.file.path, targetPath);
    res.json({ message: 'File saved successfully', fileName });
  } catch (err) {
    console.error('DEBUG (save-audio): Exception:', err);
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ error: 'Failed to save file', details: err.message });
  }
});

// DELETE / - Delete audio file
router.delete('/', express.json(), async (req, res) => {
  const { fileName } = req.body;
  if (!fileName) {
    return res.status(400).json({ error: 'fileName is required' });
  }

  const safeFileName = path.basename(fileName);
  const filePath = path.join(PUBLIC_AUDIO_DIR, safeFileName);
  console.log(`DEBUG (delete-audio): Deleting file ${filePath}`);

  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
    res.json({ message: 'Audio file deleted successfully', fileName: safeFileName });
  } catch (err) {
    console.error('DEBUG (delete-audio): Error deleting file:', err);
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: 'Error deleting file', details: err.message });
  }
});

// GET /check-audio - Check if audio file exists
router.get('/check-audio', async (req, res) => {
  const { fileName } = req.query;
  if (!fileName) {
    return res.status(400).json({ error: 'fileName is required' });
  }

  const safeFileName = path.basename(fileName.toString());
  const filePath = path.join(PUBLIC_AUDIO_DIR, safeFileName);
  console.log(`DEBUG (check-audio): Checking file ${filePath}`);

  try {
    await fs.access(filePath, fs.constants.R_OK);
    res.json({ exists: true });
  } catch (err) {
    res.json({ exists: false });
  }
});

// GET /play-audio - Stream audio file
router.get('/play-audio', async (req, res) => {
  try {
    const { fileName } = req.query;
    if (!fileName) {
      return res.status(400).json({ error: 'fileName is required' });
    }

    const safeFileName = path.basename(fileName.toString());
    const filePath = path.join(PUBLIC_AUDIO_DIR, safeFileName);
    console.log(`DEBUG (play-audio): Attempting to access file: ${filePath}`);

    try {
      await fs.access(filePath, fs.constants.R_OK);
    } catch (err) {
      console.error(`DEBUG (play-audio): File not found or inaccessible: ${filePath}`, err);
      return res.status(404).json({ error: `File not found: ${safeFileName}` });
    }

    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      console.error(`DEBUG (play-audio): ${filePath} is not a file`);
      return res.status(400).json({ error: `${safeFileName} is not a valid file` });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');

    const stream = fsSync.createReadStream(filePath);
    stream.pipe(res);

    stream.on('error', (err) => {
      console.error(`DEBUG (play-audio): Stream error for ${filePath}`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file', details: err.message });
      }
    });

    stream.on('end', () => {
      console.log(`DEBUG (play-audio): Successfully streamed ${filePath}`);
    });
  } catch (error) {
    console.error('DEBUG (play-audio): Unexpected error in play-audio:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }
});

export default router;
