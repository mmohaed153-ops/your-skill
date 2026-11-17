import {
  Box,
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileText,
  FileVideo,
  FolderKanban,
  Puzzle,
} from 'lucide-react';
import { getFileCategoryKind, type FileCategoryKind } from '../utils/workspaceLogic';

interface FileTypeIconProps {
  filename: string;
  mimeType?: string;
  className?: string;
}

export function FileTypeIcon({ filename, mimeType = '', className = 'w-4 h-4' }: FileTypeIconProps) {
  const kind: FileCategoryKind = getFileCategoryKind(filename, mimeType);

  switch (kind) {
    case 'project':
      return <FolderKanban className={`${className} text-emerald-700 dark:text-emerald-400`} aria-hidden="true" />;
    case 'archive':
      return <FileArchive className={`${className} text-amber-700 dark:text-amber-300`} aria-hidden="true" />;
    case '3d':
      return <Box className={`${className} text-[#B92622] dark:text-rose-400`} aria-hidden="true" />;
    case 'image':
      return <FileImage className={`${className} text-sky-700 dark:text-sky-400`} aria-hidden="true" />;
    case 'audio':
      return <FileAudio className={`${className} text-violet-700 dark:text-violet-400`} aria-hidden="true" />;
    case 'video':
      return <FileVideo className={`${className} text-rose-700 dark:text-rose-400`} aria-hidden="true" />;
    case 'document':
      return <FileText className={`${className} text-[#062D4C] dark:text-slate-200`} aria-hidden="true" />;
    case 'code':
      return <FileCode2 className={`${className} text-indigo-700 dark:text-indigo-300`} aria-hidden="true" />;
    case 'addon':
      return <Puzzle className={`${className} text-orange-700 dark:text-orange-300`} aria-hidden="true" />;
    case 'generic':
    default:
      return <File className={`${className} text-slate-600 dark:text-slate-300`} aria-hidden="true" />;
  }
}
