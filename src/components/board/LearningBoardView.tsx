import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  CalendarPlus,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Circle,
  Eraser,
  ExternalLink,
  GitBranch,
  GripHorizontal,
  Highlighter,
  ImagePlus,
  Layers,
  LayoutDashboard,
  Maximize2,
  MousePointer2,
  NotebookPen,
  PenTool,
  Pencil,
  Pin,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Share2,
  StickyNote,
  Trash2,
  Undo2,
  Video,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { compressImageToDataUrl } from '../../data/presets';
import type { SaveTodoPayload } from '../../hooks/useTodos';
import type { CreateNoteInput, UpdateNotePatch } from '../../hooks/useNotes';
import type { BoardLayoutPatch } from '../../hooks/useLearningBoards';
import { storeFiles } from '../../lib/fileStorage';
import type { LearningPath, VideoStep } from '../../types/learning';
import {
  INITIAL_UPLOAD_PROGRESS,
  type BoardAccentColor,
  type BoardCard,
  type BoardConnection,
  type BoardDrawingPoint,
  type BoardDrawingStroke,
  type BoardInteractionTool,
  type BoardViewport,
  type CourseItem,
  type LearningBoard,
  type TodoTask,
  type UploadProgressState,
  type WorkspaceNote,
} from '../../types/workspace';
import { SectionHeroBanner, type HeroActionItem } from '../SectionHeroBanner';
import {
  BOARD_ACCENT_STYLES,
  BOARD_DEFAULT_IMAGE_HEIGHT,
  BOARD_DRAWING_COLORS,
  BOARD_MAX_DRAWINGS,
  type BoardHistoryStack,
  bringCardForward,
  buildCardsFromCourse,
  buildCardsFromLearningPath,
  clampCardWidth,
  clampCoord,
  clampImageHeight,
  clampZoom,
  computeConnectionGeometry,
  computeFitViewport,
  computeInitialImageDimensions,
  createIdeaNoteBoardCard,
  createImageBoardCard,
  createTodoWidgetBoardCard,
  createVideoBoardCard,
  duplicateBoardCard,
  findHitDrawingStrokes,
  findNextFreeSpot,
  getNextTopZIndex,
  isSupportedBoardImageFile,
  normalizeRotationDeg,
  pushBoardHistory,
  redoBoardHistory,
  roundCoord,
  screenToBoardPoint,
  sendCardBackward,
  simplifyStrokePoints,
  translateDrawingStroke,
  undoBoardHistory,
} from '../../utils/boardLogic';
import { createSafeId, normalizeUrl } from '../../utils/pathLogic';
import { extractPlainTextFromHtml } from '../../utils/notesLogic';
import { ConfirmModal } from '../ConfirmModal';
import { AddBoardVideoModal } from './AddBoardVideoModal';
import { BoardCardModal } from './BoardCardModal';
import { BoardDrawingLayer } from './BoardDrawingLayer';
import { BoardImageCardBody } from './BoardImageCardBody';
import { BoardMetaModal } from './BoardMetaModal';

interface LearningBoardViewProps {
  uid: string | null;
  boards: LearningBoard[];
  activeBoard: LearningBoard | null;
  cloudLoading: boolean;
  courses: CourseItem[];
  learningPaths: LearningPath[];
  stepsByPath: Record<string, VideoStep[]>;
  todos: TodoTask[];
  notes: WorkspaceNote[];
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: (input: { title: string; description?: string }) => Promise<LearningBoard>;
  onRenameBoard: (boardId: string, title: string, description?: string) => void;
  onDeleteBoard: (boardId: string) => Promise<void>;
  onSaveBoardLayout: (
    boardId: string,
    patch: BoardLayoutPatch,
    options?: { immediate?: boolean }
  ) => void;
  onWatchBoardVideo: (card: BoardCard) => void;
  onCreateTodo: (payload: SaveTodoPayload) => Promise<TodoTask>;
  onToggleTodoCompleted: (task: TodoTask) => Promise<void>;
  onDeleteTodo: (task: TodoTask) => Promise<void>;
  onCreateNote: (input?: CreateNoteInput) => Promise<WorkspaceNote>;
  onUpdateNote: (noteId: string, patch: UpdateNotePatch) => Promise<void>;
  onOpenNoteInWorkspace: (noteId: string) => void;
  onShareBoard?: (board: LearningBoard) => void;
  onScheduleBoard?: (board: LearningBoard) => void;
}

function plainTextToSimpleHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const lines = escaped
    .split('\n')
    .map((line) => (line.trim() ? `<p>${line}</p>` : '<p><br/></p>'));
  return lines.join('') || '<p></p>';
}

function readImageNaturalDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const result = {
        width: img.naturalWidth || 320,
        height: img.naturalHeight || 220,
      };
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: 320, height: 220 });
    };
    img.src = objectUrl;
  });
}

export function LearningBoardView({
  uid,
  boards,
  activeBoard,
  cloudLoading,
  courses,
  learningPaths,
  stepsByPath,
  todos,
  notes,
  onSelectBoard,
  onCreateBoard,
  onRenameBoard,
  onDeleteBoard,
  onSaveBoardLayout,
  onWatchBoardVideo,
  onCreateTodo,
  onToggleTodoCompleted,
  onDeleteTodo,
  onCreateNote,
  onUpdateNote,
  onOpenNoteInWorkspace,
  onShareBoard,
  onScheduleBoard,
}: LearningBoardViewProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Modals
  const [addVideoOpen, setAddVideoOpen] = useState(false);
  const [boardMetaModal, setBoardMetaModal] = useState<'create' | 'rename' | null>(null);
  const [editingCard, setEditingCard] = useState<BoardCard | null>(null);
  const [confirmClearDrawingsOpen, setConfirmClearDrawingsOpen] = useState(false);

  // Drawing Tool State
  const [activeTool, setActiveTool] = useState<BoardInteractionTool>('select');
  const [brushColor, setBrushColor] = useState<string>('#B92622');
  const [penSize, setPenSize] = useState<number>(4);
  const [highlighterSize, setHighlighterSize] = useState<number>(18);
  const [eraserSize, setEraserSize] = useState<number>(14);
  const [activeStroke, setActiveStroke] = useState<BoardDrawingStroke | null>(null);
  const activeStrokeRef = useRef<BoardDrawingStroke | null>(null);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);

  // Image Upload State
  const [imageUploadProgress, setImageUploadProgress] = useState<UploadProgressState>(
    INITIAL_UPLOAD_PROGRESS
  );
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [pendingRetryFiles, setPendingRetryFiles] = useState<File[] | null>(null);

  // Connection Creation & Editing State
  const [connectMode, setConnectMode] = useState(false);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [pointerBoardPos, setPointerBoardPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [connLabelDraft, setConnLabelDraft] = useState('');

  // Inline Task Inputs keyed by widget card id
  const [widgetTaskDrafts, setWidgetTaskDrafts] = useState<Record<string, string>>({});

  // Under-video / idea note drafts keyed by card id for responsive typing
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const noteSyncTimersRef = useRef<Record<string, number>>({});
  const [savingNoteCardId, setSavingNoteCardId] = useState<string | null>(null);

  // Measured card heights for accurate SVG arrow endpoints
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  const cardElementsRef = useRef<Record<string, HTMLDivElement | null>>({});

  // Undo / Redo history per board
  const [historyByBoard, setHistoryByBoard] = useState<Record<string, BoardHistoryStack>>({});

  // Active drag, resize, rotate, stroke-move, erase, or pan gesture state
  const dragStateRef = useRef<
    | {
        type: 'card';
        cardId: string;
        startClientX: number;
        startClientY: number;
        origX: number;
        origY: number;
        moved: boolean;
        preSnapshot: { cards: BoardCard[]; connections: BoardConnection[]; drawings: BoardDrawingStroke[] };
      }
    | {
        type: 'resize';
        cardId: string;
        startClientX: number;
        startClientY: number;
        origW: number;
        origH: number;
        moved: boolean;
        preSnapshot: { cards: BoardCard[]; connections: BoardConnection[]; drawings: BoardDrawingStroke[] };
      }
    | {
        type: 'rotate';
        cardId: string;
        centerClientX: number;
        centerClientY: number;
        startAngleRad: number;
        origRotation: number;
        moved: boolean;
        preSnapshot: { cards: BoardCard[]; connections: BoardConnection[]; drawings: BoardDrawingStroke[] };
      }
    | {
        type: 'stroke';
        strokeId: string;
        startClientX: number;
        startClientY: number;
        origStroke: BoardDrawingStroke;
        moved: boolean;
        preSnapshot: { cards: BoardCard[]; connections: BoardConnection[]; drawings: BoardDrawingStroke[] };
      }
    | {
        type: 'erase';
        erasedAny: boolean;
        preSnapshot: { cards: BoardCard[]; connections: BoardConnection[]; drawings: BoardDrawingStroke[] };
      }
    | {
        type: 'pan';
        startClientX: number;
        startClientY: number;
        origPanX: number;
        origPanY: number;
        moved: boolean;
      }
    | null
  >(null);

  const activeBoardRef = useRef<LearningBoard | null>(activeBoard);
  activeBoardRef.current = activeBoard;

  // Reset transient modes when switching boards
  useEffect(() => {
    setConnectMode(false);
    setConnectFromId(null);
    setPointerBoardPos(null);
    setSelectedConnectionId(null);
    setSelectedStrokeId(null);
    setActiveStroke(null);
    activeStrokeRef.current = null;
    setNoteDrafts({});
    setImageUploadError(null);
  }, [activeBoard?.id]);

  // Measure card DOM heights whenever cards or note expansion states change
  useEffect(() => {
    if (!activeBoard) return;
    const raf = window.requestAnimationFrame(() => {
      const next: Record<string, number> = {};
      for (const c of activeBoard.cards) {
        const el = cardElementsRef.current[c.id];
        if (el) {
          next[c.id] = el.offsetHeight;
        }
      }
      setCardHeights(next);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeBoard?.id, activeBoard?.cards, todos, noteDrafts]);

  // Sync incoming updates from Notes workspace if a linked note was edited in NotesView more recently
  useEffect(() => {
    if (!activeBoard) return;
    const boardTime = Date.parse(activeBoard.updatedAt) || 0;
    let changed = false;
    const nextCards = activeBoard.cards.map((c) => {
      if (c.kind !== 'video') return c;
      const linked = notes.find(
        (n) =>
          (c.linkedNoteId && n.id === c.linkedNoteId) ||
          n.links.some((l) => l.type === 'learning_board' && l.targetId === c.id)
      );
      if (!linked) return c;
      const noteTime = Date.parse(linked.updatedAt) || 0;
      const plain = extractPlainTextFromHtml(linked.contentHtml);
      if (noteTime > boardTime + 2000 && plain && plain !== c.noteText) {
        changed = true;
        return { ...c, noteText: plain.slice(0, 4000), linkedNoteId: linked.id };
      }
      return c;
    });
    if (changed) {
      onSaveBoardLayout(activeBoard.id, { cards: nextCards }, { immediate: true });
    }
  }, [activeBoard, notes, onSaveBoardLayout]);

  const currentHistory: BoardHistoryStack = activeBoard
    ? historyByBoard[activeBoard.id] || { past: [], future: [] }
    : { past: [], future: [] };

  const activeBrushSize =
    activeTool === 'highlighter'
      ? highlighterSize
      : activeTool === 'eraser'
        ? eraserSize
        : penSize;

  const setActiveBrushSize = (nextVal: number) => {
    if (activeTool === 'highlighter') {
      setHighlighterSize(nextVal);
    } else if (activeTool === 'eraser') {
      setEraserSize(nextVal);
    } else {
      setPenSize(nextVal);
    }
  };

  const commitBoardMutation = useCallback(
    (
      nextCards: BoardCard[],
      nextConnections: BoardConnection[],
      options?: {
        drawings?: BoardDrawingStroke[];
        viewport?: BoardViewport;
        recordHistory?: boolean;
        immediate?: boolean;
      }
    ) => {
      const board = activeBoardRef.current;
      if (!board) return;
      const nextDrawings =
        options?.drawings !== undefined ? options.drawings : board.drawings || [];
      if (options?.recordHistory !== false) {
        setHistoryByBoard((prev) => ({
          ...prev,
          [board.id]: pushBoardHistory(prev[board.id] || { past: [], future: [] }, {
            cards: board.cards,
            connections: board.connections,
            drawings: board.drawings || [],
          }),
        }));
      }
      onSaveBoardLayout(
        board.id,
        {
          cards: nextCards,
          connections: nextConnections,
          drawings: nextDrawings,
          ...(options?.viewport ? { viewport: options.viewport } : {}),
        },
        { immediate: options?.immediate ?? true }
      );
    },
    [onSaveBoardLayout]
  );

  const handleUndo = useCallback(() => {
    if (!activeBoard) return;
    const stack = historyByBoard[activeBoard.id] || { past: [], future: [] };
    const result = undoBoardHistory(stack, {
      cards: activeBoard.cards,
      connections: activeBoard.connections,
      drawings: activeBoard.drawings || [],
    });
    if (!result) return;
    setSelectedStrokeId(null);
    setHistoryByBoard((prev) => ({ ...prev, [activeBoard.id]: result.nextHistory }));
    onSaveBoardLayout(
      activeBoard.id,
      {
        cards: result.restored.cards,
        connections: result.restored.connections,
        drawings: result.restored.drawings,
      },
      { immediate: true }
    );
  }, [activeBoard, historyByBoard, onSaveBoardLayout]);

  const handleRedo = useCallback(() => {
    if (!activeBoard) return;
    const stack = historyByBoard[activeBoard.id] || { past: [], future: [] };
    const result = redoBoardHistory(stack, {
      cards: activeBoard.cards,
      connections: activeBoard.connections,
      drawings: activeBoard.drawings || [],
    });
    if (!result) return;
    setSelectedStrokeId(null);
    setHistoryByBoard((prev) => ({ ...prev, [activeBoard.id]: result.nextHistory }));
    onSaveBoardLayout(
      activeBoard.id,
      {
        cards: result.restored.cards,
        connections: result.restored.connections,
        drawings: result.restored.drawings,
      },
      { immediate: true }
    );
  }, [activeBoard, historyByBoard, onSaveBoardLayout]);

  const handleDeleteStroke = useCallback(
    (strokeId: string) => {
      const board = activeBoardRef.current;
      if (!board) return;
      const nextDrawings = (board.drawings || []).filter((s) => s.id !== strokeId);
      commitBoardMutation(board.cards, board.connections, { drawings: nextDrawings });
      setSelectedStrokeId((curr) => (curr === strokeId ? null : curr));
    },
    [commitBoardMutation]
  );

  // Keyboard Undo / Redo & Delete Selected Stroke when not typing inside input/textarea
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedStrokeId) {
        e.preventDefault();
        handleDeleteStroke(selectedStrokeId);
      } else if (e.key === 'Escape') {
        setConnectMode(false);
        setConnectFromId(null);
        setSelectedConnectionId(null);
        setSelectedStrokeId(null);
        setActiveTool('select');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, selectedStrokeId, handleDeleteStroke]);

  // Pointer Move & Up listeners for smooth Card Dragging, Resizing, Rotating, Stroke Moving, and Canvas Panning
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const board = activeBoardRef.current;
      if (!board) return;

      // Update live preview wire when connecting
      if (connectFromId && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const zoom = board.viewport.zoom || 1;
        setPointerBoardPos({
          x: (e.clientX - rect.left - board.viewport.panX) / zoom,
          y: (e.clientY - rect.top - board.viewport.panY) / zoom,
        });
      }

      const drag = dragStateRef.current;
      if (!drag) return;

      if (drag.type === 'erase') {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const pt = screenToBoardPoint(e.clientX, e.clientY, rect, board.viewport);
        const hits = findHitDrawingStrokes(
          board.drawings || [],
          pt.x,
          pt.y,
          Math.max(8, eraserSize / 2 + 4)
        );
        if (hits.length > 0) {
          drag.erasedAny = true;
          const hitSet = new Set(hits);
          const nextDrawings = (board.drawings || []).filter((s) => !hitSet.has(s.id));
          onSaveBoardLayout(board.id, { drawings: nextDrawings }, { immediate: false });
        }
        return;
      }

      if (drag.type === 'rotate') {
        const currAngle = Math.atan2(
          e.clientY - drag.centerClientY,
          e.clientX - drag.centerClientX
        );
        const deltaDeg = ((currAngle - drag.startAngleRad) * 180) / Math.PI;
        if (Math.abs(deltaDeg) >= 1) {
          drag.moved = true;
        }
        const nextRotation = normalizeRotationDeg(drag.origRotation + deltaDeg);
        const nextCards = board.cards.map((c) =>
          c.id === drag.cardId ? { ...c, rotation: nextRotation } : c
        );
        onSaveBoardLayout(board.id, { cards: nextCards }, { immediate: false });
        return;
      }

      const dxScreen = e.clientX - drag.startClientX;
      const dyScreen = e.clientY - drag.startClientY;
      if (Math.abs(dxScreen) > 3 || Math.abs(dyScreen) > 3) {
        drag.moved = true;
      }

      const zoom = board.viewport.zoom || 1;

      if (drag.type === 'card') {
        const nextX = clampCoord(drag.origX + dxScreen / zoom);
        const nextY = clampCoord(drag.origY + dyScreen / zoom);
        const nextCards = board.cards.map((c) =>
          c.id === drag.cardId ? { ...c, x: nextX, y: nextY } : c
        );
        onSaveBoardLayout(board.id, { cards: nextCards }, { immediate: false });
      } else if (drag.type === 'resize') {
        const nextW = clampCardWidth(drag.origW + dxScreen / zoom);
        const nextH = clampImageHeight(drag.origH + dyScreen / zoom);
        const nextCards = board.cards.map((c) =>
          c.id === drag.cardId ? { ...c, width: nextW, height: nextH } : c
        );
        onSaveBoardLayout(board.id, { cards: nextCards }, { immediate: false });
      } else if (drag.type === 'stroke') {
        const movedStroke = translateDrawingStroke(
          drag.origStroke,
          dxScreen / zoom,
          dyScreen / zoom
        );
        const nextDrawings = (board.drawings || []).map((s) =>
          s.id === drag.strokeId ? movedStroke : s
        );
        onSaveBoardLayout(board.id, { drawings: nextDrawings }, { immediate: false });
      } else if (drag.type === 'pan') {
        const nextPanX = clampCoord(drag.origPanX + dxScreen);
        const nextPanY = clampCoord(drag.origPanY + dyScreen);
        onSaveBoardLayout(
          board.id,
          { viewport: { ...board.viewport, panX: nextPanX, panY: nextPanY } },
          { immediate: false }
        );
      }
    };

    const handlePointerUp = () => {
      const drag = dragStateRef.current;
      const board = activeBoardRef.current;
      dragStateRef.current = null;
      if (!drag || !board) return;

      if (drag.type === 'erase') {
        if (drag.erasedAny) {
          setHistoryByBoard((prev) => ({
            ...prev,
            [board.id]: pushBoardHistory(prev[board.id] || { past: [], future: [] }, drag.preSnapshot),
          }));
          onSaveBoardLayout(board.id, { drawings: board.drawings || [] }, { immediate: true });
        }
        return;
      }

      if (!drag.moved) return;

      if (drag.type === 'card' || drag.type === 'resize' || drag.type === 'rotate') {
        setHistoryByBoard((prev) => ({
          ...prev,
          [board.id]: pushBoardHistory(prev[board.id] || { past: [], future: [] }, drag.preSnapshot),
        }));
        onSaveBoardLayout(board.id, { cards: board.cards }, { immediate: true });
      } else if (drag.type === 'stroke') {
        setHistoryByBoard((prev) => ({
          ...prev,
          [board.id]: pushBoardHistory(prev[board.id] || { past: [], future: [] }, drag.preSnapshot),
        }));
        onSaveBoardLayout(board.id, { drawings: board.drawings || [] }, { immediate: true });
      } else if (drag.type === 'pan') {
        onSaveBoardLayout(board.id, { viewport: board.viewport }, { immediate: true });
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [connectFromId, eraserSize, onSaveBoardLayout]);

  const makeSnapshot = (board: LearningBoard) => ({
    cards: board.cards.map((c) => ({
      ...c,
      originalFileRef: c.originalFileRef ? { ...c.originalFileRef } : undefined,
    })),
    connections: board.connections.map((conn) => ({ ...conn })),
    drawings: (board.drawings || []).map((s) => ({
      ...s,
      points: s.points.map((p) => ({ x: p.x, y: p.y })),
    })),
  });

  const handleStartCardDrag = (e: React.PointerEvent, card: BoardCard) => {
    if (!activeBoard || e.button > 0) return;

    if (activeTool !== 'select') return;

    // While in connect mode, prevent dragging; onClickCapture completes connection
    if (connectMode || connectFromId) {
      e.stopPropagation();
      return;
    }

    e.stopPropagation();
    setSelectedStrokeId(null);
    dragStateRef.current = {
      type: 'card',
      cardId: card.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: card.x,
      origY: card.y,
      moved: false,
      preSnapshot: makeSnapshot(activeBoard),
    };
  };

  const handleStartImageResize = (e: React.PointerEvent, card: BoardCard) => {
    if (!activeBoard || e.button > 0 || activeTool !== 'select') return;
    e.stopPropagation();
    setSelectedStrokeId(null);
    dragStateRef.current = {
      type: 'resize',
      cardId: card.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origW: card.width,
      origH: card.height || BOARD_DEFAULT_IMAGE_HEIGHT,
      moved: false,
      preSnapshot: makeSnapshot(activeBoard),
    };
  };

  const handleStartImageRotate = (e: React.PointerEvent, card: BoardCard) => {
    if (!activeBoard || e.button > 0 || activeTool !== 'select') return;
    e.stopPropagation();
    setSelectedStrokeId(null);
    const cardEl = cardElementsRef.current[card.id];
    const rect = cardEl?.getBoundingClientRect();
    const centerClientX = rect ? rect.left + rect.width / 2 : e.clientX;
    const centerClientY = rect ? rect.top + rect.height / 2 : e.clientY;
    const startAngleRad = Math.atan2(
      e.clientY - centerClientY,
      e.clientX - centerClientX
    );
    dragStateRef.current = {
      type: 'rotate',
      cardId: card.id,
      centerClientX,
      centerClientY,
      startAngleRad,
      origRotation: card.rotation || 0,
      moved: false,
      preSnapshot: makeSnapshot(activeBoard),
    };
  };

  const handlePointerDownStroke = (e: React.PointerEvent, stroke: BoardDrawingStroke) => {
    if (!activeBoard || e.button > 0 || activeTool !== 'select' || connectMode) return;
    e.stopPropagation();
    setSelectedConnectionId(null);
    setSelectedStrokeId(stroke.id);
    dragStateRef.current = {
      type: 'stroke',
      strokeId: stroke.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origStroke: {
        ...stroke,
        points: stroke.points.map((p) => ({ x: p.x, y: p.y })),
      },
      moved: false,
      preSnapshot: makeSnapshot(activeBoard),
    };
  };

  // Drawing / Eraser Overlay Handlers
  const handleDrawingOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeBoard || e.button > 0 || !canvasRef.current) return;
    if (activeTool === 'select') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = canvasRef.current.getBoundingClientRect();
    const pt = screenToBoardPoint(e.clientX, e.clientY, rect, activeBoard.viewport);
    const boardPt: BoardDrawingPoint = { x: roundCoord(pt.x), y: roundCoord(pt.y) };

    if (activeTool === 'eraser') {
      const preSnapshot = makeSnapshot(activeBoard);
      const hits = findHitDrawingStrokes(
        activeBoard.drawings || [],
        boardPt.x,
        boardPt.y,
        Math.max(8, eraserSize / 2 + 4)
      );
      let erasedAny = false;
      if (hits.length > 0) {
        erasedAny = true;
        const hitSet = new Set(hits);
        const nextDrawings = (activeBoard.drawings || []).filter((s) => !hitSet.has(s.id));
        onSaveBoardLayout(activeBoard.id, { drawings: nextDrawings }, { immediate: false });
      }
      dragStateRef.current = {
        type: 'erase',
        erasedAny,
        preSnapshot,
      };
      return;
    }

    const stroke: BoardDrawingStroke = {
      id: createSafeId('bdraw'),
      tool: activeTool === 'highlighter' ? 'highlighter' : 'pen',
      color: brushColor,
      size: activeTool === 'highlighter' ? highlighterSize : penSize,
      opacity: activeTool === 'highlighter' ? 0.42 : 1,
      points: [boardPt],
    };
    activeStrokeRef.current = stroke;
    setActiveStroke(stroke);
  };

  const handleDrawingOverlayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeBoard || !canvasRef.current) return;
    const stroke = activeStrokeRef.current;
    if (!stroke) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pt = screenToBoardPoint(e.clientX, e.clientY, rect, activeBoard.viewport);
    const last = stroke.points[stroke.points.length - 1];
    const minDist = Math.max(1.5, 2.5 / (activeBoard.viewport.zoom || 1));
    if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < minDist) {
      return;
    }
    const updated: BoardDrawingStroke = {
      ...stroke,
      points: [...stroke.points, { x: roundCoord(pt.x), y: roundCoord(pt.y) }],
    };
    activeStrokeRef.current = updated;
    setActiveStroke(updated);
  };

  const handleDrawingOverlayPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const board = activeBoardRef.current;
    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    setActiveStroke(null);

    if (!board || !finished || finished.points.length === 0) return;
    const simplified = simplifyStrokePoints(finished.points, 2);
    const finalStroke: BoardDrawingStroke = {
      ...finished,
      points: simplified.length > 0 ? simplified : finished.points,
    };
    const existingDrawings = board.drawings || [];
    const nextDrawings = [...existingDrawings, finalStroke].slice(-BOARD_MAX_DRAWINGS);
    commitBoardMutation(board.cards, board.connections, { drawings: nextDrawings });
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (!activeBoard || e.button > 0) return;
    setSelectedConnectionId(null);
    setSelectedStrokeId(null);
    if (connectFromId) {
      setConnectFromId(null);
      setPointerBoardPos(null);
      return;
    }
    if (activeTool !== 'select') return;
    dragStateRef.current = {
      type: 'pan',
      startClientX: e.clientX,
      startClientY: e.clientY,
      origPanX: activeBoard.viewport.panX,
      origPanY: activeBoard.viewport.panY,
      moved: false,
    };
  };

  const handleCardConnectionClick = (cardId: string) => {
    if (!activeBoard) return;
    if (!connectFromId) {
      setConnectFromId(cardId);
      setConnectMode(true);
      return;
    }
    if (connectFromId === cardId) {
      setConnectFromId(null);
      setConnectMode(false);
      setPointerBoardPos(null);
      return;
    }
    const alreadyExists = activeBoard.connections.some(
      (conn) => conn.fromCardId === connectFromId && conn.toCardId === cardId
    );
    if (!alreadyExists) {
      const sourceCard = activeBoard.cards.find((c) => c.id === connectFromId);
      const targetCard = activeBoard.cards.find((c) => c.id === cardId);
      const defaultLabel =
        targetCard?.kind === 'todo_widget'
          ? 'مهام التطبيق'
          : targetCard?.kind === 'idea_note'
            ? 'فكرة مرتبطة'
            : 'الخطوة التالية';
      const newConn: BoardConnection = {
        id: createSafeId('bconn'),
        fromCardId: connectFromId,
        toCardId: cardId,
        label: defaultLabel,
        color: sourceCard?.accentColor || 'crimson',
      };
      commitBoardMutation(activeBoard.cards, [...activeBoard.connections, newConn]);
      setSelectedConnectionId(newConn.id);
    }
    setConnectFromId(null);
    setConnectMode(false);
    setPointerBoardPos(null);
  };

  // Sync a Video Card's under-video notes with Notes Workspace (`WorkspaceNote`)
  const syncCardNoteToWorkspace = useCallback(
    async (card: BoardCard, noteText: string, openInWorkspace = false) => {
      if (!activeBoard) return;
      const trimmed = noteText.trim();
      const existing = notes.find(
        (n) =>
          (card.linkedNoteId && n.id === card.linkedNoteId) ||
          n.links.some((l) => l.type === 'learning_board' && l.targetId === card.id)
      );

      if (existing) {
        await onUpdateNote(existing.id, {
          title: `ملاحظات: ${card.title}`.slice(0, 200),
          contentHtml: plainTextToSimpleHtml(trimmed || 'ملاحظات حول هذا الفيديو...'),
        });
        if (card.linkedNoteId !== existing.id) {
          const updatedCards = activeBoard.cards.map((c) =>
            c.id === card.id ? { ...c, linkedNoteId: existing.id } : c
          );
          onSaveBoardLayout(activeBoard.id, { cards: updatedCards }, { immediate: true });
        }
        if (openInWorkspace) {
          onOpenNoteInWorkspace(existing.id);
        }
        return;
      }

      if (!trimmed && !openInWorkspace) return;

      const created = await onCreateNote({
        title: `ملاحظات: ${card.title}`.slice(0, 200),
        contentHtml: plainTextToSimpleHtml(trimmed || 'ماذا تعلمت من هذا الفيديو؟'),
        folder: 'ملاحظات لوحة التعلم',
        links: [
          {
            type: 'learning_board',
            targetId: card.id,
            parentId: activeBoard.id,
            label: card.title,
          },
        ],
      });

      const updatedCards = activeBoard.cards.map((c) =>
        c.id === card.id ? { ...c, linkedNoteId: created.id } : c
      );
      onSaveBoardLayout(activeBoard.id, { cards: updatedCards }, { immediate: true });

      if (openInWorkspace) {
        onOpenNoteInWorkspace(created.id);
      }
    },
    [activeBoard, notes, onCreateNote, onUpdateNote, onSaveBoardLayout, onOpenNoteInWorkspace]
  );

  const handleCardNoteChange = (card: BoardCard, nextText: string) => {
    if (!activeBoard) return;
    setNoteDrafts((prev) => ({ ...prev, [card.id]: nextText }));
    setSavingNoteCardId(card.id);

    const updatedCards = activeBoard.cards.map((c) =>
      c.id === card.id ? { ...c, noteText: nextText.slice(0, 4000) } : c
    );
    onSaveBoardLayout(activeBoard.id, { cards: updatedCards }, { immediate: false });

    if (noteSyncTimersRef.current[card.id]) {
      window.clearTimeout(noteSyncTimersRef.current[card.id]);
    }
    noteSyncTimersRef.current[card.id] = window.setTimeout(() => {
      delete noteSyncTimersRef.current[card.id];
      const latestCard =
        activeBoardRef.current?.cards.find((c) => c.id === card.id) || card;
      onSaveBoardLayout(
        activeBoard.id,
        { cards: activeBoardRef.current?.cards || updatedCards },
        { immediate: true }
      );
      if (latestCard.kind === 'video') {
        void syncCardNoteToWorkspace(latestCard, nextText, false);
      }
      setSavingNoteCardId((curr) => (curr === card.id ? null : curr));
    }, 650);
  };

  // Add Card Helpers
  const handleAddVideoFromUrl = (input: {
    title: string;
    videoUrl: string;
    thumbnailUrl: string;
    sourceLabel: string;
    accentColor: BoardAccentColor;
  }) => {
    if (!activeBoard) return;
    const spot = findNextFreeSpot(activeBoard.cards, 80, 70);
    const card = createVideoBoardCard(
      {
        ...input,
        sourceRefType: 'url',
      },
      spot
    );
    commitBoardMutation(activeBoard.cards.concat(card), activeBoard.connections);
  };

  const handleAddSingleCourseVideo = (
    course: CourseItem,
    video?: { id: string; title: string; videoUrl: string }
  ) => {
    if (!activeBoard) return;
    const spot = findNextFreeSpot(activeBoard.cards, 80, 70);
    const card = createVideoBoardCard(
      {
        title: video ? video.title : course.title,
        videoUrl: video ? video.videoUrl : course.url,
        thumbnailUrl: course.thumbnailUrl,
        sourceLabel: `كورس: ${course.title}`,
        completed: course.status === 'completed',
        sourceRefType: 'course',
        sourceRefId: course.id,
        sourceParentId: video?.id || '',
        accentColor: 'navy',
      },
      spot
    );
    commitBoardMutation(activeBoard.cards.concat(card), activeBoard.connections);
  };

  const handleAddWholeCourse = (course: CourseItem) => {
    if (!activeBoard) return;
    const built = buildCardsFromCourse(course, activeBoard.cards);
    commitBoardMutation(
      [...activeBoard.cards, ...built.cards],
      [...activeBoard.connections, ...built.connections]
    );
  };

  const handleAddSinglePathStep = (path: LearningPath, step: VideoStep) => {
    if (!activeBoard) return;
    const spot = findNextFreeSpot(activeBoard.cards, 80, 70);
    const card = createVideoBoardCard(
      {
        title: step.title,
        videoUrl: step.videoUrl,
        thumbnailUrl: step.thumbnailUrl,
        sourceLabel: `مسار: ${path.title}`,
        completed: step.completed,
        noteText: step.quickNotes || '',
        sourceRefType: 'learning_step',
        sourceRefId: step.id,
        sourceParentId: path.id,
        accentColor: step.completed ? 'emerald' : 'crimson',
      },
      spot
    );
    commitBoardMutation(activeBoard.cards.concat(card), activeBoard.connections);
  };

  const handleAddWholePath = (path: LearningPath, steps: VideoStep[]) => {
    if (!activeBoard) return;
    const built = buildCardsFromLearningPath(path, steps, activeBoard.cards);
    commitBoardMutation(
      [...activeBoard.cards, ...built.cards],
      [...activeBoard.connections, ...built.connections]
    );
  };

  const handleAddStandaloneTodoWidget = () => {
    if (!activeBoard) return;
    const spot = findNextFreeSpot(activeBoard.cards, 120, 120);
    const widget = createTodoWidgetBoardCard({ title: 'قائمة مهام تطبيقية' }, spot);
    commitBoardMutation([...activeBoard.cards, widget], activeBoard.connections);
  };

  const handleAttachTodoWidgetToVideo = (videoCard: BoardCard) => {
    if (!activeBoard) return;
    // Check if an attached todo_widget already exists for this video card
    const existing = activeBoard.cards.find(
      (c) => c.kind === 'todo_widget' && c.attachedToCardId === videoCard.id
    );
    if (existing) {
      const el = cardElementsRef.current[existing.id];
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      const inputEl = el?.querySelector('input[type="text"]') as HTMLInputElement | null;
      inputEl?.focus();
      return;
    }

    const pos = findNextFreeSpot(
      activeBoard.cards,
      videoCard.x + videoCard.width + 60,
      videoCard.y
    );
    const widget = createTodoWidgetBoardCard(
      {
        title: `مهام: ${videoCard.title}`.slice(0, 180),
        attachedToCardId: videoCard.id,
        sourceLabel: 'متزامنة مع قائمة المهام',
        accentColor: 'emerald',
      },
      pos
    );
    const conn: BoardConnection = {
      id: createSafeId('bconn'),
      fromCardId: videoCard.id,
      toCardId: widget.id,
      label: 'مهام التطبيق',
      color: 'emerald',
    };
    commitBoardMutation(
      [...activeBoard.cards, widget],
      [...activeBoard.connections, conn]
    );
  };

  const handleAddIdeaNoteCard = () => {
    if (!activeBoard) return;
    const spot = findNextFreeSpot(activeBoard.cards, 140, 140);
    const card = createIdeaNoteBoardCard({ title: 'فكرة / ملخص سريع' }, spot);
    commitBoardMutation([...activeBoard.cards, card], activeBoard.connections);
  };

  const handleDeleteCard = (cardId: string) => {
    if (!activeBoard) return;
    const nextCards = activeBoard.cards.filter((c) => c.id !== cardId);
    const nextConns = activeBoard.connections.filter(
      (conn) => conn.fromCardId !== cardId && conn.toCardId !== cardId
    );
    commitBoardMutation(nextCards, nextConns);
  };

  const handleUploadImageFiles = async (rawFiles: File[]) => {
    const board = activeBoardRef.current;
    if (!board || rawFiles.length === 0) return;
    setImageUploadError(null);

    const validFiles = rawFiles.filter(isSupportedBoardImageFile);
    if (validFiles.length === 0) {
      setImageUploadError('صيغة الملف غير مدعومة. الصيغ المدعومة للوحة: PNG, JPG, JPEG, WEBP, GIF.');
      return;
    }

    setPendingRetryFiles(validFiles);
    try {
      const storedRefs = await storeFiles(validFiles, uid, setImageUploadProgress);
      const addedCards: BoardCard[] = [];
      let runningCards = [...board.cards];

      // Position near visible center of canvas if possible
      const rect = canvasRef.current?.getBoundingClientRect();
      const centerBoard = rect
        ? screenToBoardPoint(
            rect.left + rect.width * 0.42,
            rect.top + rect.height * 0.35,
            rect,
            board.viewport
          )
        : { x: 100, y: 100 };

      for (let i = 0; i < validFiles.length; i += 1) {
        const file = validFiles[i];
        const fileRef = storedRefs[i];
        if (!fileRef) continue;
        const dims = await readImageNaturalDimensions(file);
        const scaled = computeInitialImageDimensions(dims.width, dims.height);
        let thumbnailUrl = '';
        try {
          thumbnailUrl = await compressImageToDataUrl(file, 640, 0.78);
        } catch {
          thumbnailUrl = '';
        }
        const spot = findNextFreeSpot(
          runningCards,
          Math.round(centerBoard.x + i * 32),
          Math.round(centerBoard.y + i * 32)
        );
        const cleanTitle = file.name.replace(/\.[^/.]+$/, '').trim() || 'صورة مرجعية';
        const card = createImageBoardCard(
          {
            title: cleanTitle,
            thumbnailUrl,
            originalFileRef: fileRef,
            width: scaled.width,
            height: scaled.height,
            zIndex: getNextTopZIndex(runningCards),
            accentColor: 'navy',
          },
          spot
        );
        addedCards.push(card);
        runningCards = [...runningCards, card];
      }

      if (addedCards.length > 0) {
        const firstNew = addedCards[0];
        let nextViewport: BoardViewport | undefined;
        if (rect) {
          const zoom = board.viewport.zoom || 1;
          const cardScreenLeft = firstNew.x * zoom + board.viewport.panX;
          const cardScreenTop = firstNew.y * zoom + board.viewport.panY;
          const cardScreenRight = cardScreenLeft + firstNew.width * zoom;
          const estH = ((firstNew.height || BOARD_DEFAULT_IMAGE_HEIGHT) + 120) * zoom;
          const cardScreenBottom = cardScreenTop + estH;
          const outOfView =
            cardScreenLeft < 24 ||
            cardScreenTop < 24 ||
            cardScreenRight > rect.width - 24 ||
            cardScreenBottom > rect.height - 24;
          if (outOfView) {
            nextViewport = {
              zoom,
              panX: clampCoord(rect.width / 2 - (firstNew.x + firstNew.width / 2) * zoom),
              panY: clampCoord(rect.height / 2 - (firstNew.y + (estH / zoom) / 2) * zoom),
            };
          }
        }
        commitBoardMutation([...board.cards, ...addedCards], board.connections, {
          viewport: nextViewport,
        });
      }
      setActiveTool('select');
      setPendingRetryFiles(null);
      setImageUploadProgress(INITIAL_UPLOAD_PROGRESS);
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'تعذر رفع الصورة وحفظها في حسابك. يمكنك إعادة المحاولة.';
      setImageUploadProgress({
        ...INITIAL_UPLOAD_PROGRESS,
        phase: 'error',
        errorMessage: msg,
      });
      setImageUploadError(msg);
    }
  };

  const handleDuplicateCard = (card: BoardCard) => {
    if (!activeBoard) return;
    const copy = duplicateBoardCard(card, activeBoard.cards);
    commitBoardMutation([...activeBoard.cards, copy], activeBoard.connections);
  };

  const handleBringForward = (cardId: string) => {
    if (!activeBoard) return;
    commitBoardMutation(bringCardForward(activeBoard.cards, cardId), activeBoard.connections);
  };

  const handleSendBackward = (cardId: string) => {
    if (!activeBoard) return;
    commitBoardMutation(sendCardBackward(activeBoard.cards, cardId), activeBoard.connections);
  };

  const handleResetCardRotation = (cardId: string) => {
    if (!activeBoard) return;
    const nextCards = activeBoard.cards.map((c) =>
      c.id === cardId ? { ...c, rotation: 0 } : c
    );
    commitBoardMutation(nextCards, activeBoard.connections);
  };

  const handleClearAllDrawings = () => {
    if (!activeBoard) return;
    commitBoardMutation(activeBoard.cards, activeBoard.connections, { drawings: [] });
    setSelectedStrokeId(null);
    setConfirmClearDrawingsOpen(false);
  };

  const handleCreateWidgetTask = async (widgetCard: BoardCard) => {
    if (!activeBoard) return;
    const draft = (widgetTaskDrafts[widgetCard.id] || '').trim();
    if (!draft) return;
    setWidgetTaskDrafts((prev) => ({ ...prev, [widgetCard.id]: '' }));
    await onCreateTodo({
      title: draft,
      description: `مهمة من لوحة التعلم: ${activeBoard.title}`,
      priority: 'medium',
      dueDate: '',
      link: {
        type: 'learning_board',
        targetId: widgetCard.id,
        parentId: activeBoard.id,
        label: `${widgetCard.title} · ${activeBoard.title}`.slice(0, 200),
      },
    });
  };

  const handleZoomStep = (delta: number) => {
    if (!activeBoard) return;
    const nextZoom = clampZoom(activeBoard.viewport.zoom + delta);
    onSaveBoardLayout(
      activeBoard.id,
      { viewport: { ...activeBoard.viewport, zoom: nextZoom } },
      { immediate: true }
    );
  };

  const handleFitView = () => {
    if (!activeBoard || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const fit = computeFitViewport(activeBoard.cards, rect.width, rect.height);
    onSaveBoardLayout(activeBoard.id, { viewport: fit }, { immediate: true });
  };

  const handleResetView = () => {
    if (!activeBoard) return;
    onSaveBoardLayout(
      activeBoard.id,
      { viewport: { panX: 24, panY: 24, zoom: 1 } },
      { immediate: true }
    );
  };

  // Board stats
  const boardStats = useMemo(() => {
    if (!activeBoard) {
      return { videoCount: 0, completedVideos: 0, imageCount: 0, drawingCount: 0, connCount: 0 };
    }
    const videos = activeBoard.cards.filter((c) => c.kind === 'video');
    const images = activeBoard.cards.filter((c) => c.kind === 'image');
    return {
      videoCount: videos.length,
      completedVideos: videos.filter((c) => c.completed).length,
      imageCount: images.length,
      drawingCount: (activeBoard.drawings || []).length,
      connCount: activeBoard.connections.length,
    };
  }, [activeBoard]);

  const selectedConnection = useMemo(
    () =>
      activeBoard?.connections.find((c) => c.id === selectedConnectionId) || null,
    [activeBoard, selectedConnectionId]
  );

  // Build lookup of TodoTask[] per board widget card
  const todosByWidgetId = useMemo(() => {
    const map: Record<string, TodoTask[]> = {};
    for (const t of todos) {
      if (t.link.type === 'learning_board' && t.link.targetId) {
        if (!map[t.link.targetId]) map[t.link.targetId] = [];
        map[t.link.targetId].push(t);
      }
    }
    return map;
  }, [todos]);

  if (cloudLoading && !activeBoard) {
    return (
      <div className="py-16 text-center text-sm font-bold text-[#062D4C] dark:text-slate-300">
        جاري تحميل لوحات التعلم الخاصة بك...
      </div>
    );
  }

  const boardHeroActions: HeroActionItem[] = [
    {
      id: 'new-board',
      label: 'لوحة جديدة',
      icon: <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />,
      onClick: () => setBoardMetaModal('create'),
      testId: 'board-new-btn',
      tone: 'crimson',
    },
    ...(activeBoard && onScheduleBoard
      ? [
          {
            id: 'schedule-board',
            label: 'جدولة في التقويم',
            icon: <CalendarPlus className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: () => onScheduleBoard(activeBoard),
            ariaLabel: 'جدولة جلسة للوحة في التقويم',
            tone: 'amber' as const,
          },
        ]
      : []),
    ...(activeBoard && onShareBoard
      ? [
          {
            id: 'share-board',
            label: 'مشاركة',
            icon: <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: () => onShareBoard(activeBoard),
            ariaLabel: 'مشاركة لوحة التعلم',
            testId: 'board-share-btn',
            tone: 'blue' as const,
          },
        ]
      : []),
    ...(activeBoard
      ? [
          {
            id: 'rename-board',
            label: 'تسمية',
            icon: <Pencil className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: () => setBoardMetaModal('rename'),
            ariaLabel: 'إعادة تسمية اللوحة',
            testId: 'board-rename-btn',
            tone: 'slate' as const,
          },
        ]
      : []),
    ...(activeBoard && boards.length > 1
      ? [
          {
            id: 'delete-board',
            label: 'حذف',
            icon: <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: () => void onDeleteBoard(activeBoard.id),
            ariaLabel: 'حذف هذه اللوحة',
            testId: 'board-delete-btn',
            tone: 'burgundy' as const,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {/* Unified Split Architectural Hero Banner */}
      <SectionHeroBanner
        kicker={
          <>
            <span className="inline-flex items-center gap-1.5 text-[#D97706] dark:text-amber-300">
              <LayoutDashboard className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>مساحة التنظيم البصري للتعلم</span>
            </span>
            <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">·</span>
            <span className="tabular-nums text-[#062D4C] dark:text-slate-100">
              {boardStats.videoCount} فيديوهات ({boardStats.completedVideos} مكتمل)
            </span>
            <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">·</span>
            <span className="tabular-nums text-sky-700 dark:text-sky-300">
              {boardStats.imageCount} صور
            </span>
            <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">·</span>
            <span className="tabular-nums text-[#15803D] dark:text-emerald-400">
              {boardStats.connCount} مسارات ربط · {boardStats.drawingCount} رسومات
            </span>
          </>
        }
        title="لوحة التعلم (Learning Board)"
        description={activeBoard?.description || undefined}
        topExtra={
          <div className="shrink-0">
            <label htmlFor="board-switcher-select" className="sr-only">
              اختر لوحة التعلم
            </label>
            <select
              id="board-switcher-select"
              data-testid="board-switcher-select"
              value={activeBoard?.id || ''}
              onChange={(e) => onSelectBoard(e.target.value)}
              className="px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-white bg-white dark:bg-slate-800 border-2 border-[#062D4C] dark:border-slate-500 shadow-[0_3px_0_#062D4C] rounded-xl focus:outline-none max-w-full sm:max-w-[290px]"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>
        }
        actions={boardHeroActions}
      />

      {/* Canvas Toolbar: Add Items, Image Upload, Drawing Tools, Undo/Redo, Zoom/Fit */}
      {activeBoard && (
        <section
          aria-label="أدوات لوحة التعلم"
          className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-3 shadow-[4px_5px_0_#062D4C] dark:shadow-[4px_5px_0_#334155] space-y-2.5"
        >
          {/* Row 1: Creation, Image Upload, Connect, Undo/Redo & Zoom */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="board-add-video-btn"
                onClick={() => setAddVideoOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[2px_2px_0_#062D4C] rounded-xl cursor-pointer whitespace-nowrap"
              >
                <Video className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>إضافة فيديو</span>
              </button>

              <input
                ref={imageInputRef}
                type="file"
                data-testid="board-upload-image-input"
                accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = '';
                  if (files.length > 0) {
                    void handleUploadImageFiles(files);
                  }
                }}
              />
              <button
                type="button"
                data-testid="board-upload-image-btn"
                disabled={imageUploadProgress.active}
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-sky-300 bg-sky-50 dark:bg-slate-800 hover:bg-sky-100 border-2 border-[#062D4C] dark:border-slate-600 rounded-xl cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <ImagePlus className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden="true" />
                <span>{imageUploadProgress.active ? 'جاري رفع الصورة...' : 'رفع صورة'}</span>
              </button>

              <button
                type="button"
                data-testid="board-add-todo-btn"
                onClick={handleAddStandaloneTodoWidget}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-emerald-300 bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-100 border-2 border-[#062D4C] dark:border-slate-600 rounded-xl cursor-pointer whitespace-nowrap"
              >
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>+ قائمة مهام</span>
              </button>

              <button
                type="button"
                data-testid="board-add-idea-btn"
                onClick={handleAddIdeaNoteCard}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-amber-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-2 border-[#062D4C] dark:border-slate-600 rounded-xl cursor-pointer whitespace-nowrap"
              >
                <StickyNote className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                <span>+ بطاقة فكرة</span>
              </button>

              <button
                type="button"
                data-testid="board-connect-mode-btn"
                onClick={() => {
                  setActiveTool('select');
                  setConnectMode((prev) => !prev);
                  setConnectFromId(null);
                  setPointerBoardPos(null);
                }}
                aria-pressed={connectMode}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-extrabold border-2 rounded-xl cursor-pointer whitespace-nowrap transition-colors ${
                  connectMode
                    ? 'bg-[#062D4C] text-amber-300 border-[#B92622]'
                    : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/35 dark:border-slate-600 hover:bg-slate-100'
                }`}
              >
                <GitBranch className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{connectMode ? 'إلغاء وضع الربط' : 'ربط العناصر بسهم'}</span>
              </button>
            </div>

            {/* History (Undo / Redo) + Zoom / Pan Controls */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex items-center rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
                <button
                  type="button"
                  data-testid="board-undo-btn"
                  onClick={handleUndo}
                  disabled={currentHistory.past.length === 0}
                  title="تراجع (Ctrl+Z)"
                  aria-label="تراجع عن آخر تعديل"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold text-[#062D4C] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-35 rounded-lg cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">تراجع</span>
                </button>
                <button
                  type="button"
                  data-testid="board-redo-btn"
                  onClick={handleRedo}
                  disabled={currentHistory.future.length === 0}
                  title="إعادة (Ctrl+Y)"
                  aria-label="إعادة التعديل"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold text-[#062D4C] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-35 rounded-lg cursor-pointer"
                >
                  <Redo2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">إعادة</span>
                </button>
              </div>

              <div className="inline-flex items-center rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
                <button
                  type="button"
                  data-testid="board-zoom-out-btn"
                  onClick={() => handleZoomStep(-0.15)}
                  aria-label="تصغير اللوحة"
                  title="تصغير"
                  className="p-1.5 text-[#062D4C] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" aria-hidden="true" />
                </button>
                <span
                  data-testid="board-zoom-readout"
                  className="px-2 text-xs font-black text-[#062D4C] dark:text-amber-300 tabular-nums"
                >
                  {Math.round(activeBoard.viewport.zoom * 100)}%
                </span>
                <button
                  type="button"
                  data-testid="board-zoom-in-btn"
                  onClick={() => handleZoomStep(0.15)}
                  aria-label="تكبير اللوحة"
                  title="تكبير"
                  className="p-1.5 text-[#062D4C] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-testid="board-fit-view-btn"
                  onClick={handleFitView}
                  aria-label="ملاءمة جميع البطاقات"
                  title="ملاءمة جميع البطاقات"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-extrabold text-[#062D4C] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="hidden md:inline">ملاءمة</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetView}
                  aria-label="إعادة ضبط العرض"
                  title="إعادة ضبط العرض 100%"
                  className="p-1.5 text-[#062D4C] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Freehand Drawing & Selection Mode Strip */}
          <div className="pt-2 border-t border-[#062D4C]/12 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="وضع التفاعل والرسم"
                className="inline-flex flex-wrap max-w-full items-center rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 gap-0.5"
              >
                <button
                  type="button"
                  data-testid="board-tool-select"
                  onClick={() => setActiveTool('select')}
                  aria-pressed={activeTool === 'select'}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-extrabold rounded-lg cursor-pointer whitespace-nowrap transition-colors ${
                    activeTool === 'select'
                      ? 'bg-[#062D4C] text-white shadow-xs'
                      : 'text-[#062D4C] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700'
                  }`}
                >
                  <MousePointer2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>تحديد وتحريك</span>
                </button>

                <button
                  type="button"
                  data-testid="board-tool-pen"
                  onClick={() => {
                    setConnectMode(false);
                    setConnectFromId(null);
                    setSelectedStrokeId(null);
                    setActiveTool('pen');
                  }}
                  aria-pressed={activeTool === 'pen'}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-extrabold rounded-lg cursor-pointer whitespace-nowrap transition-colors ${
                    activeTool === 'pen'
                      ? 'bg-[#B92622] text-white shadow-xs'
                      : 'text-[#062D4C] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>قلم رسم</span>
                </button>

                <button
                  type="button"
                  data-testid="board-tool-highlighter"
                  onClick={() => {
                    setConnectMode(false);
                    setConnectFromId(null);
                    setSelectedStrokeId(null);
                    setActiveTool('highlighter');
                  }}
                  aria-pressed={activeTool === 'highlighter'}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-extrabold rounded-lg cursor-pointer whitespace-nowrap transition-colors ${
                    activeTool === 'highlighter'
                      ? 'bg-amber-500 text-[#062D4C] shadow-xs'
                      : 'text-[#062D4C] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700'
                  }`}
                >
                  <Highlighter className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>تمييز</span>
                </button>

                <button
                  type="button"
                  data-testid="board-tool-eraser"
                  onClick={() => {
                    setConnectMode(false);
                    setConnectFromId(null);
                    setSelectedStrokeId(null);
                    setActiveTool('eraser');
                  }}
                  aria-pressed={activeTool === 'eraser'}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-extrabold rounded-lg cursor-pointer whitespace-nowrap transition-colors ${
                    activeTool === 'eraser'
                      ? 'bg-slate-800 text-rose-300 shadow-xs'
                      : 'text-[#062D4C] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700'
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>ممحاة</span>
                </button>
              </div>

              {/* Brush Size Control */}
              <div className="inline-flex flex-wrap max-w-full items-center gap-2 rounded-xl border border-[#062D4C]/20 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1">
                <label
                  htmlFor="board-brush-size-slider"
                  className="text-[11px] font-extrabold text-[#062D4C] dark:text-slate-200 whitespace-nowrap"
                >
                  حجم الفرشاة: <span dir="ltr" className="tabular-nums text-[#B92622] dark:text-amber-300">{activeBrushSize}px</span>
                </label>
                <input
                  id="board-brush-size-slider"
                  data-testid="board-brush-size-slider"
                  type="range"
                  min={activeTool === 'highlighter' ? 10 : 2}
                  max={36}
                  value={activeBrushSize}
                  onChange={(e) => setActiveBrushSize(Number(e.target.value))}
                  className="w-20 sm:w-24 accent-[#B92622] cursor-pointer"
                />
              </div>

              {/* Preset Color Swatches + Custom Color Picker */}
              <div className="inline-flex flex-wrap max-w-full items-center gap-1 rounded-xl border border-[#062D4C]/20 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-1">
                {BOARD_DRAWING_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`لون الرسم ${hex}`}
                    onClick={() => {
                      setBrushColor(hex);
                      if (activeTool === 'eraser' || activeTool === 'select') {
                        setActiveTool('pen');
                      }
                    }}
                    style={{ backgroundColor: hex }}
                    className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-transform ${
                      brushColor.toLowerCase() === hex.toLowerCase()
                        ? 'border-[#062D4C] dark:border-white scale-115 ring-2 ring-amber-400'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  />
                ))}
                <label
                  htmlFor="board-custom-color-input"
                  title="اختيار لون مخصص"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#062D4C] dark:text-slate-300 ps-1 cursor-pointer"
                >
                  <input
                    id="board-custom-color-input"
                    data-testid="board-custom-color-input"
                    type="color"
                    value={brushColor}
                    onChange={(e) => {
                      setBrushColor(e.target.value);
                      if (activeTool === 'eraser' || activeTool === 'select') {
                        setActiveTool('pen');
                      }
                    }}
                    aria-label="اختيار لون رسم مخصص"
                    className="w-6 h-6 p-0 border-0 rounded bg-transparent cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Clear Selected Drawing / Clear All Drawings */}
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedStrokeId && (
                <button
                  type="button"
                  data-testid="board-clear-selected-drawing-btn"
                  onClick={() => handleDeleteStroke(selectedStrokeId)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold text-[#B92622] dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 border border-[#B92622]/40 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>حذف الرسم المحدد</span>
                </button>
              )}

              {(activeBoard.drawings || []).length > 0 && (
                <button
                  type="button"
                  data-testid="board-clear-all-drawings-btn"
                  onClick={() => setConfirmClearDrawingsOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold text-[#062D4C] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-[#B92622] border border-[#062D4C]/25 dark:border-slate-600 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>مسح الرسومات ({(activeBoard.drawings || []).length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Real Image Upload Progress & Error Feedback */}
          {imageUploadProgress.active && (
            <div
              role="status"
              className="rounded-lg border border-sky-300 dark:border-sky-800 bg-sky-50/80 dark:bg-sky-950/40 px-3 py-2 space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs font-bold text-[#062D4C] dark:text-sky-200">
                <span>
                  جاري رفع وحفظ الصورة ({imageUploadProgress.currentFileIndex}/{imageUploadProgress.totalFiles}): {imageUploadProgress.fileName}
                </span>
                <span className="tabular-nums">{imageUploadProgress.percent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-sky-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-[#062D4C] dark:bg-sky-400 transition-all duration-150"
                  style={{ width: `${imageUploadProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {imageUploadError && (
            <div
              role="alert"
              className="rounded-lg border-2 border-[#B92622] bg-rose-50 dark:bg-rose-950/50 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#B92622] dark:text-rose-200"
            >
              <span className="inline-flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{imageUploadError}</span>
              </span>
              <div className="flex items-center gap-2">
                {pendingRetryFiles && pendingRetryFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleUploadImageFiles(pendingRetryFiles)}
                    className="px-2.5 py-1 rounded bg-[#B92622] text-white hover:bg-[#9E1E1B] cursor-pointer"
                  >
                    إعادة المحاولة
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setImageUploadError(null)}
                  className="px-2 py-1 rounded bg-white/70 dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Interactive Pannable / Zoomable Evidence-Style Learning Canvas */}
      {activeBoard && (
        <div
          ref={canvasRef}
          data-testid="learning-board-canvas"
          onPointerDown={handleCanvasPointerDown}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
            }
          }}
          onDrop={(e) => {
            const files = Array.from(e.dataTransfer.files || []).filter(isSupportedBoardImageFile);
            if (files.length > 0) {
              e.preventDefault();
              void handleUploadImageFiles(files);
            }
          }}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              handleZoomStep(e.deltaY < 0 ? 0.1 : -0.1);
            }
          }}
          style={{
            touchAction: 'none',
            backgroundSize: '26px 26px',
            backgroundPosition: `${activeBoard.viewport.panX}px ${activeBoard.viewport.panY}px`,
          }}
          className={`relative isolate z-0 w-full h-[640px] sm:h-[720px] rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-[#F8FAFC] dark:bg-[#0D1B2A] bg-[radial-gradient(circle,rgba(6,45,76,0.18)_1.3px,transparent_1.3px)] dark:bg-[radial-gradient(circle,rgba(148,163,184,0.22)_1.3px,transparent_1.3px)] shadow-[0_5px_0_#062D4C] dark:shadow-[0_5px_0_#020617] overflow-hidden select-none ${
            activeTool === 'select'
              ? 'cursor-grab active:cursor-grabbing'
              : 'cursor-crosshair'
          }`}
        >
          {/* Active Connection Mode Instruction Banner */}
          {(connectMode || connectFromId) && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-30 rounded-xl border-2 border-[#062D4C] bg-[#062D4C] text-white px-4 py-2 text-xs sm:text-sm font-extrabold shadow-[3px_4px_0_#B92622] flex items-center gap-3"
            >
              <GitBranch className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
              <span>
                {connectFromId
                  ? 'الآن اضغط على البطاقة المستهدفة لإكمال السهم بين العنصرين'
                  : 'اضغط على أي بطاقة أولى ثم البطاقة الثانية لربطهما بسهم'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setConnectMode(false);
                  setConnectFromId(null);
                  setPointerBoardPos(null);
                }}
                className="px-2 py-0.5 text-xs bg-white/15 hover:bg-white/25 rounded-md cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          )}

          {/* Selected Connection Inspector Bar */}
          {selectedConnection && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              data-testid="connection-inspector"
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 rounded-xl border-2 border-[#062D4C] bg-white dark:bg-slate-900 px-3.5 py-2.5 shadow-[4px_5px_0_#062D4C] flex flex-wrap items-center gap-2"
            >
              <span className="text-xs font-extrabold text-[#062D4C] dark:text-white">
                تسمية السهم:
              </span>
              <input
                type="text"
                value={connLabelDraft}
                onChange={(e) => setConnLabelDraft(e.target.value)}
                placeholder="مثال: الخطوة التالية"
                className="px-2.5 py-1 text-xs font-bold text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border border-[#062D4C]/30 rounded-lg focus:outline-none w-36"
              />
              <button
                type="button"
                onClick={() => {
                  const nextConns = activeBoard.connections.map((c) =>
                    c.id === selectedConnection.id
                      ? { ...c, label: connLabelDraft.trim().slice(0, 120) }
                      : c
                  );
                  commitBoardMutation(activeBoard.cards, nextConns);
                  setSelectedConnectionId(null);
                }}
                className="px-2.5 py-1 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
              >
                حفظ
              </button>

              {(['crimson', 'navy', 'emerald', 'amber'] as BoardAccentColor[]).map((clr) => (
                <button
                  key={clr}
                  type="button"
                  aria-label={`لون ${BOARD_ACCENT_STYLES[clr].label}`}
                  onClick={() => {
                    const nextConns = activeBoard.connections.map((c) =>
                      c.id === selectedConnection.id ? { ...c, color: clr } : c
                    );
                    commitBoardMutation(activeBoard.cards, nextConns);
                  }}
                  className={`w-5 h-5 rounded-full border-2 cursor-pointer ${
                    BOARD_ACCENT_STYLES[clr].pinBg
                  } ${
                    selectedConnection.color === clr
                      ? 'border-[#062D4C] ring-2 ring-amber-400'
                      : 'border-white'
                  }`}
                />
              ))}

              <button
                type="button"
                data-testid="delete-selected-connection-btn"
                onClick={() => {
                  const nextConns = activeBoard.connections.filter(
                    (c) => c.id !== selectedConnection.id
                  );
                  commitBoardMutation(activeBoard.cards, nextConns);
                  setSelectedConnectionId(null);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] rounded-lg cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>حذف السهم</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedConnectionId(null)}
                aria-label="إغلاق محرر السهم"
                className="p-1 text-slate-400 hover:text-[#062D4C] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Subtle Canvas Hint in Corner */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="hidden sm:block absolute top-3 right-3 z-[250] pointer-events-none rounded-lg bg-white/90 dark:bg-slate-900/90 border border-[#062D4C]/25 dark:border-slate-700 px-2.5 py-1 text-[11px] font-bold text-[#062D4C]/80 dark:text-slate-300"
          >
            {activeTool === 'select'
              ? 'اسحب الخلفية للتحريك · اسحب البطاقات أو الرسومات لتغيير مكانها'
              : activeTool === 'eraser'
                ? 'اسحب أو اضغط فوق أي خط رسم لمسحه فوراً'
                : 'ارسم بحرية في أي مكان على اللوحة دون تحريك البطاقات'}
          </div>

          {/* Empty Board Guidance */}
          {activeBoard.cards.length === 0 && (activeBoard.drawings || []).length === 0 && activeTool === 'select' && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute inset-0 z-10 flex items-center justify-center p-6 pointer-events-none"
            >
              <div className="pointer-events-auto max-w-md rounded-2xl border-2 border-dashed border-[#062D4C]/40 dark:border-slate-600 bg-white/95 dark:bg-slate-900/95 p-8 text-center space-y-4 shadow-[4px_5px_0_#062D4C]">
                <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-[#062D4C] text-[#B92622] dark:text-amber-300 flex items-center justify-center">
                  <Layers className="w-6 h-6" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-black text-[#062D4C] dark:text-white">
                    هذه اللوحة فارغة وجاهزة لأفكارك
                  </h2>
                  <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
                    أضف فيديو أو صورة من جهازك أو ابدأ بالرسم الحر على اللوحة وربط الأفكار بالأسهم.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAddVideoOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>إضافة أول فيديو</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-[#062D4C] dark:text-sky-300 bg-sky-50 dark:bg-slate-800 border-2 border-[#062D4C] rounded-xl cursor-pointer"
                  >
                    <ImagePlus className="w-4 h-4" aria-hidden="true" />
                    <span>رفع صورة</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Transformed Coordinate Plane (explicitly dir="ltr" so x/y coordinates & SVG arrows align identically in RTL apps) */}
          <div
            dir="ltr"
            style={{
              transform: `translate(${activeBoard.viewport.panX}px, ${activeBoard.viewport.panY}px) scale(${activeBoard.viewport.zoom})`,
              transformOrigin: '0 0',
            }}
            className="absolute top-0 left-0 w-0 h-0 overflow-visible"
          >
            {/* SVG Connections & Arrows Layer */}
            <svg
              width="1"
              height="1"
              className="absolute top-0 left-0 overflow-visible pointer-events-none"
            >
              <defs>
                {(['crimson', 'navy', 'emerald', 'amber'] as BoardAccentColor[]).map((clr) => (
                  <marker
                    key={clr}
                    id={`board-arrow-${clr}`}
                    markerWidth="10"
                    markerHeight="8"
                    refX="9"
                    refY="4"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path
                      d="M 0 0 L 10 4 L 0 8 z"
                      fill={BOARD_ACCENT_STYLES[clr].stroke}
                    />
                  </marker>
                ))}
              </defs>

              {activeBoard.connections.map((conn) => {
                const fromCard = activeBoard.cards.find((c) => c.id === conn.fromCardId);
                const toCard = activeBoard.cards.find((c) => c.id === conn.toCardId);
                if (!fromCard || !toCard) return null;
                const geom = computeConnectionGeometry(fromCard, toCard, cardHeights);
                const strokeColor = BOARD_ACCENT_STYLES[conn.color || 'crimson'].stroke;
                const isSelected = selectedConnectionId === conn.id;

                return (
                  <g
                    key={conn.id}
                    className="pointer-events-auto cursor-pointer"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelectedConnectionId(conn.id);
                      setConnLabelDraft(conn.label || '');
                    }}
                  >
                    {/* Wide invisible hit target for easy clicking */}
                    <path
                      d={geom.pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={18}
                    />
                    <path
                      d={geom.pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 4.5 : 3}
                      strokeDasharray={conn.color === 'amber' ? '7 4' : undefined}
                      markerEnd={`url(#board-arrow-${conn.color || 'crimson'})`}
                    />
                  </g>
                );
              })}

              {/* Live Rubber-Band Arrow Preview while Drawing Connection */}
              {connectFromId &&
                pointerBoardPos &&
                (() => {
                  const sourceCard = activeBoard.cards.find((c) => c.id === connectFromId);
                  if (!sourceCard) return null;
                  const sx = sourceCard.x + (sourceCard.width || 310) / 2;
                  const sy = sourceCard.y + (cardHeights[sourceCard.id] || 280) / 2;
                  return (
                    <line
                      x1={sx}
                      y1={sy}
                      x2={pointerBoardPos.x}
                      y2={pointerBoardPos.y}
                      stroke="#B92622"
                      strokeWidth={3}
                      strokeDasharray="6 4"
                      markerEnd="url(#board-arrow-crimson)"
                    />
                  );
                })()}
            </svg>

            {/* Clickable Connection Midpoint Labels (HTML for crisp RTL Arabic rendering) */}
            {activeBoard.connections.map((conn) => {
              const fromCard = activeBoard.cards.find((c) => c.id === conn.fromCardId);
              const toCard = activeBoard.cards.find((c) => c.id === conn.toCardId);
              if (!fromCard || !toCard) return null;
              const geom = computeConnectionGeometry(fromCard, toCard, cardHeights);
              const isSelected = selectedConnectionId === conn.id;
              return (
                <button
                  key={`lbl_${conn.id}`}
                  type="button"
                  dir="rtl"
                  data-testid={`connection-label-${conn.id}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedConnectionId(conn.id);
                    setConnLabelDraft(conn.label || '');
                  }}
                  style={{
                    left: `${geom.midX}px`,
                    top: `${geom.midY}px`,
                    transform: 'translate(-50%, -50%)',
                    borderColor: BOARD_ACCENT_STYLES[conn.color || 'crimson'].stroke,
                  }}
                  className={`absolute z-[25] px-2 py-0.5 rounded-full border-2 text-[10px] font-extrabold whitespace-nowrap shadow-xs cursor-pointer transition-transform hover:scale-105 ${
                    isSelected
                      ? 'bg-[#062D4C] text-white'
                      : 'bg-white dark:bg-slate-900 text-[#062D4C] dark:text-white'
                  }`}
                >
                  {conn.label || 'ربط'}
                </button>
              );
            })}

            {/* Positioned Draggable Board Cards */}
            {activeBoard.cards.map((card) => {
              const accent = BOARD_ACCENT_STYLES[card.accentColor || 'crimson'];
              const isConnectSource = connectFromId === card.id;
              const isConnectTargetCandidate =
                Boolean(connectFromId) && connectFromId !== card.id;
              const cardNoteValue =
                noteDrafts[card.id] !== undefined ? noteDrafts[card.id] : card.noteText;
              const widgetTasks = todosByWidgetId[card.id] || [];
              const widgetDoneCount = widgetTasks.filter((t) => t.completed).length;

              return (
                <div
                  key={card.id}
                  ref={(el) => {
                    cardElementsRef.current[card.id] = el;
                  }}
                  dir="rtl"
                  data-testid={`board-card-${card.id}`}
                  data-card-kind={card.kind}
                  onPointerDown={(e) => handleStartCardDrag(e, card)}
                  onClickCapture={(e) => {
                    if (connectMode || connectFromId) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCardConnectionClick(card.id);
                    }
                  }}
                  style={{
                    left: `${card.x}px`,
                    top: `${card.y}px`,
                    width: `${card.width}px`,
                    zIndex: 20 + Math.min(180, Math.max(0, card.zIndex || 0)),
                    transform: card.rotation ? `rotate(${card.rotation}deg)` : undefined,
                    transformOrigin: 'center center',
                  }}
                  className={`absolute rounded-xl border-2 bg-white dark:bg-slate-900 overflow-hidden transition-shadow cursor-grab active:cursor-grabbing ${
                    accent.border
                  } ${accent.shadow} ${
                    isConnectSource
                      ? 'ring-4 ring-[#B92622]'
                      : isConnectTargetCandidate
                        ? 'ring-4 ring-amber-400 hover:ring-emerald-500 cursor-crosshair'
                        : ''
                  }`}
                >
                  {/* Top Evidence-Board Pin & Drag Handle Bar */}
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b-2 border-[#062D4C]/15 dark:border-slate-700 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-full ${accent.pinBg} text-white flex items-center justify-center shrink-0 shadow-xs`}
                        aria-hidden="true"
                      >
                        <Pin className="w-3 h-3" />
                      </span>
                      <GripHorizontal
                        className="w-4 h-4 text-slate-400 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-[11px] font-extrabold text-[#062D4C]/80 dark:text-slate-300 truncate">
                        {card.sourceLabel ||
                          (card.kind === 'todo_widget'
                            ? 'قائمة مهام'
                            : card.kind === 'idea_note'
                              ? 'فكرة وملاحظة'
                              : card.kind === 'image'
                                ? 'صورة مرفوعة'
                                : 'فيديو')}
                      </span>
                    </div>

                    <div
                      className="flex items-center gap-0.5 shrink-0"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        data-testid={`board-card-connect-${card.id}`}
                        onClick={() => handleCardConnectionClick(card.id)}
                        title="ربط بسهم مع بطاقة أخرى"
                        aria-label={`ربط "${card.title}" بسهم`}
                        className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                          isConnectSource
                            ? 'bg-[#B92622] text-white'
                            : 'text-[#062D4C] dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <GitBranch className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingCard(card)}
                        title="تعديل البطاقة"
                        aria-label={`تعديل "${card.title}"`}
                        className="p-1.5 text-slate-500 dark:text-slate-300 hover:text-[#062D4C] dark:hover:text-white hover:bg-amber-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        data-testid={`board-card-delete-${card.id}`}
                        onClick={() => handleDeleteCard(card.id)}
                        title="حذف البطاقة"
                        aria-label={`حذف "${card.title}"`}
                        className="p-1.5 text-[#B92622] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* ==================== VIDEO CARD BODY ==================== */}
                  {card.kind === 'video' && (
                    <div>
                      {/* 16:9 Thumbnail */}
                      <div className="relative aspect-video w-full bg-slate-900 border-b border-[#062D4C]/15 overflow-hidden">
                        {card.thumbnailUrl ? (
                          <img
                            src={card.thumbnailUrl}
                            alt={card.title}
                            draggable={false}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#062D4C] to-[#0B3D63]">
                            <Video className="w-9 h-9 text-amber-300/70" aria-hidden="true" />
                          </div>
                        )}

                        {card.completed && (
                          <div className="absolute top-2 left-2 rounded-lg bg-emerald-600 text-white px-2 py-0.5 text-[11px] font-extrabold border border-white flex items-center gap-1 shadow-xs">
                            <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>مكتمل</span>
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 space-y-3">
                        <h3 className="text-sm sm:text-base font-extrabold text-[#062D4C] dark:text-white leading-snug select-text">
                          {card.title}
                        </h3>

                        {/* Watch Video + Completion + Attach To-Do Controls */}
                        <div
                          onPointerDown={(e) => e.stopPropagation()}
                          className="space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              data-testid={`board-watch-video-${card.id}`}
                              onClick={() => onWatchBoardVideo(card)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[2px_2px_0_#062D4C] rounded-lg cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-white shrink-0" aria-hidden="true" />
                              <span>مشاهدة الفيديو</span>
                            </button>

                            <a
                              href={normalizeUrl(card.videoUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="فتح الرابط الأصلي في نافذة جديدة"
                              aria-label={`فتح رابط "${card.title}"`}
                              className="p-2 text-[#062D4C] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-2 border-[#062D4C]/30 dark:border-slate-600 rounded-lg shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                            </a>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              data-testid={`board-toggle-complete-${card.id}`}
                              onClick={() => {
                                const nextCards = activeBoard.cards.map((c) =>
                                  c.id === card.id
                                    ? { ...c, completed: !c.completed }
                                    : c
                                );
                                commitBoardMutation(nextCards, activeBoard.connections);
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold rounded-lg border cursor-pointer transition-colors ${
                                card.completed
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-600'
                                  : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-300 border-[#062D4C]/25'
                              }`}
                            >
                              {card.completed ? (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              )}
                              <span>{card.completed ? 'مكتمل' : 'تحديد كمكتمل'}</span>
                            </button>

                            <button
                              type="button"
                              data-testid={`board-attach-todo-${card.id}`}
                              onClick={() => handleAttachTodoWidgetToVideo(card)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold text-[#062D4C] dark:text-emerald-300 bg-emerald-50/70 dark:bg-slate-800 hover:bg-emerald-100 border border-[#062D4C]/25 rounded-lg cursor-pointer"
                            >
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                              <span>قائمة مهام</span>
                            </button>
                          </div>
                        </div>

                        {/* Dedicated Notes Area Directly Underneath Video */}
                        <div
                          onPointerDown={(e) => e.stopPropagation()}
                          className="pt-2.5 border-t-2 border-dashed border-[#062D4C]/20 dark:border-slate-700 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              data-testid={`board-toggle-note-${card.id}`}
                              onClick={() => {
                                const nextCards = activeBoard.cards.map((c) =>
                                  c.id === card.id
                                    ? { ...c, noteExpanded: !c.noteExpanded }
                                    : c
                                );
                                onSaveBoardLayout(
                                  activeBoard.id,
                                  { cards: nextCards },
                                  { immediate: true }
                                );
                              }}
                              className="inline-flex items-center gap-1 text-xs font-extrabold text-[#062D4C] dark:text-amber-300 cursor-pointer"
                            >
                              <NotebookPen
                                className="w-3.5 h-3.5 text-[#B92622] dark:text-amber-300 shrink-0"
                                aria-hidden="true"
                              />
                              <span>ماذا تعلمت من هذا الفيديو؟</span>
                              {card.noteExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void syncCardNoteToWorkspace(card, cardNoteValue, true)
                              }
                              title="فتح الملاحظة في قسم الملاحظات"
                              className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#B92622] dark:text-sky-300 hover:underline cursor-pointer shrink-0"
                            >
                              <span>الملاحظات</span>
                              <ArrowUpRight className="w-3 h-3 shrink-0" aria-hidden="true" />
                            </button>
                          </div>

                          {card.noteExpanded ? (
                            <div className="space-y-1">
                              <textarea
                                data-testid={`board-video-note-input-${card.id}`}
                                rows={3}
                                value={cardNoteValue}
                                onChange={(e) => handleCardNoteChange(card, e.target.value)}
                                placeholder="اكتب ما تعلمته من هذا الفيديو هنا (يُحفظ تلقائياً)..."
                                className="w-full rounded-lg border border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-2 text-xs font-medium text-[#062D4C] dark:text-slate-100 focus:border-[#062D4C] focus:outline-none resize-y leading-relaxed select-text"
                              />
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                <span>
                                  {savingNoteCardId === card.id
                                    ? 'جاري الحفظ والمزامنة...'
                                    : cardNoteValue.trim()
                                      ? 'محفوظ ومتزامن مع الملاحظات'
                                      : 'مساحة ملاحظات الفيديو'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 line-clamp-2 select-text">
                              {cardNoteValue.trim() || 'اضغط لتوسيع وكتابة ملاحظات الفيديو...'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ==================== TO-DO LIST WIDGET CARD ==================== */}
                  {card.kind === 'todo_widget' && (
                    <div className="p-3.5 space-y-3" onPointerDown={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-extrabold text-[#062D4C] dark:text-white leading-snug select-text">
                          {card.title}
                        </h3>
                        <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0">
                          {widgetDoneCount}/{widgetTasks.length}
                        </span>
                      </div>

                      {widgetTasks.length === 0 ? (
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 py-1">
                          أضف أول مهمة عملية مرتبطة بهذا الفيديو وستتزامن مع قائمة المهام الرئيسية.
                        </p>
                      ) : (
                        <ul className="space-y-1.5 max-h-52 overflow-y-auto">
                          {widgetTasks.map((task) => (
                            <li
                              key={task.id}
                              data-testid={`board-todo-item-${task.id}`}
                              className="flex items-center justify-between gap-2 rounded-lg border border-[#062D4C]/15 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5"
                            >
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={task.completed}
                                data-testid={`board-todo-checkbox-${task.id}`}
                                onClick={() => void onToggleTodoCompleted(task)}
                                className="flex items-center gap-2 min-w-0 flex-1 text-right cursor-pointer"
                              >
                                <span
                                  className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0 ${
                                    task.completed
                                      ? 'bg-emerald-600 border-emerald-700 text-white'
                                      : 'bg-white dark:bg-slate-900 border-[#062D4C]'
                                  }`}
                                >
                                  {task.completed && (
                                    <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />
                                  )}
                                </span>
                                <span
                                  className={`text-xs font-bold truncate ${
                                    task.completed
                                      ? 'line-through text-slate-500'
                                      : 'text-[#062D4C] dark:text-slate-100'
                                  }`}
                                >
                                  {task.title}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => void onDeleteTodo(task)}
                                aria-label={`حذف مهمة "${task.title}"`}
                                className="p-0.5 text-slate-400 hover:text-[#B92622] cursor-pointer shrink-0"
                              >
                                <X className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void handleCreateWidgetTask(card);
                        }}
                        className="flex items-center gap-1.5 pt-1"
                      >
                        <input
                          type="text"
                          data-testid={`board-todo-input-${card.id}`}
                          value={widgetTaskDrafts[card.id] || ''}
                          onChange={(e) =>
                            setWidgetTaskDrafts((prev) => ({
                              ...prev,
                              [card.id]: e.target.value,
                            }))
                          }
                          placeholder="أضف مهمة جديدة..."
                          className="flex-1 min-w-0 rounded-lg border border-[#062D4C]/25 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none select-text"
                        />
                        <button
                          type="submit"
                          data-testid={`board-todo-add-btn-${card.id}`}
                          disabled={!(widgetTaskDrafts[card.id] || '').trim()}
                          aria-label="إضافة مهمة"
                          className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-45 cursor-pointer shrink-0"
                        >
                          <Plus className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </form>
                    </div>
                  )}

                  {/* ==================== IDEA NOTE CARD ==================== */}
                  {card.kind === 'idea_note' && (
                    <div className="p-3.5 space-y-2.5" onPointerDown={(e) => e.stopPropagation()}>
                      <h3 className="text-sm font-extrabold text-[#062D4C] dark:text-amber-300 leading-snug select-text">
                        {card.title}
                      </h3>
                      <textarea
                        data-testid={`board-idea-note-input-${card.id}`}
                        rows={4}
                        value={cardNoteValue}
                        onChange={(e) => handleCardNoteChange(card, e.target.value)}
                        placeholder="دوّن فكرة، رابطاً معرفياً، أو ملخصاً مرتبطاً بالفيديوهات..."
                        className="w-full rounded-lg border border-[#062D4C]/20 dark:border-slate-700 bg-amber-50/75 dark:bg-slate-800 px-2.5 py-2 text-xs font-medium text-[#062D4C] dark:text-slate-100 focus:border-[#062D4C] focus:outline-none resize-y leading-relaxed select-text"
                      />
                    </div>
                  )}
                  {/* ==================== IMAGE CARD BODY ==================== */}
                  {card.kind === 'image' && (
                    <BoardImageCardBody
                      card={card}
                      uid={uid}
                      noteValue={cardNoteValue}
                      onChangeDescription={(nextText) => handleCardNoteChange(card, nextText)}
                      onStartResize={handleStartImageResize}
                      onStartRotate={handleStartImageRotate}
                      onDuplicate={handleDuplicateCard}
                      onBringForward={handleBringForward}
                      onSendBackward={handleSendBackward}
                      onResetRotation={handleResetCardRotation}
                    />
                  )}
                </div>
              );
            })}

            {/* Freehand Drawings SVG Layer */}
            <BoardDrawingLayer
              drawings={activeBoard.drawings || []}
              activeStroke={activeStroke}
              activeTool={activeTool}
              connectMode={connectMode || Boolean(connectFromId)}
              selectedStrokeId={selectedStrokeId}
              onPointerDownStroke={handlePointerDownStroke}
              onDeleteSelectedStroke={handleDeleteStroke}
            />
          </div>

          {/* Transparent Drawing / Highlighter / Eraser Capture Overlay (prevents accidental card dragging while drawing) */}
          {activeTool !== 'select' && !connectMode && (
            <div
              data-testid="board-drawing-overlay"
              onPointerDown={handleDrawingOverlayPointerDown}
              onPointerMove={handleDrawingOverlayPointerMove}
              onPointerUp={handleDrawingOverlayPointerUp}
              onPointerCancel={handleDrawingOverlayPointerUp}
              className="absolute inset-0 z-[235] cursor-crosshair"
            />
          )}
        </div>
      )}

      {/* Modals */}
      <AddBoardVideoModal
        open={addVideoOpen}
        courses={courses}
        learningPaths={learningPaths}
        stepsByPath={stepsByPath}
        onClose={() => setAddVideoOpen(false)}
        onAddFromUrl={handleAddVideoFromUrl}
        onAddSingleCourseVideo={handleAddSingleCourseVideo}
        onAddWholeCourse={handleAddWholeCourse}
        onAddSinglePathStep={handleAddSinglePathStep}
        onAddWholePath={handleAddWholePath}
      />

      <BoardMetaModal
        open={Boolean(boardMetaModal)}
        mode={boardMetaModal === 'rename' ? 'rename' : 'create'}
        initialBoard={boardMetaModal === 'rename' ? activeBoard : null}
        onClose={() => setBoardMetaModal(null)}
        onSubmit={async ({ title, description }) => {
          if (boardMetaModal === 'rename' && activeBoard) {
            onRenameBoard(activeBoard.id, title, description);
          } else {
            await onCreateBoard({ title, description });
          }
        }}
      />

      <BoardCardModal
        card={editingCard}
        onClose={() => setEditingCard(null)}
        onSave={(cardId, patch) => {
          if (!activeBoard) return;
          const nextCards = activeBoard.cards.map((c) =>
            c.id === cardId ? { ...c, ...patch } : c
          );
          commitBoardMutation(nextCards, activeBoard.connections);
        }}
      />

      <ConfirmModal
        open={confirmClearDrawingsOpen}
        title="مسح جميع الرسومات من اللوحة"
        message="هل أنت متأكد من رغبتك في مسح كل خطوط الرسم والتمييز من هذه اللوحة؟ يمكنك التراجع عن هذا الإجراء فوراً باستخدام زر التراجع."
        confirmLabel="مسح الرسومات"
        onConfirm={handleClearAllDrawings}
        onCancel={() => setConfirmClearDrawingsOpen(false)}
      />
    </div>
  );
}
