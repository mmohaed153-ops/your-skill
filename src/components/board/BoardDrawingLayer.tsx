import { Trash2 } from 'lucide-react';
import type { BoardDrawingStroke, BoardInteractionTool } from '../../types/workspace';
import { buildSmoothSvgPath, getStrokeBoundingBox } from '../../utils/boardLogic';

interface BoardDrawingLayerProps {
  drawings: BoardDrawingStroke[];
  activeStroke: BoardDrawingStroke | null;
  activeTool: BoardInteractionTool;
  connectMode: boolean;
  selectedStrokeId: string | null;
  onPointerDownStroke: (e: React.PointerEvent, stroke: BoardDrawingStroke) => void;
  onDeleteSelectedStroke: (strokeId: string) => void;
}

export function BoardDrawingLayer({
  drawings,
  activeStroke,
  activeTool,
  connectMode,
  selectedStrokeId,
  onPointerDownStroke,
  onDeleteSelectedStroke,
}: BoardDrawingLayerProps) {
  const canSelectStroke = activeTool === 'select' && !connectMode;
  const allStrokes = activeStroke ? [...drawings, activeStroke] : drawings;
  const selectedStroke = selectedStrokeId
    ? drawings.find((s) => s.id === selectedStrokeId) || null
    : null;
  const selectedBounds = selectedStroke ? getStrokeBoundingBox(selectedStroke) : null;

  return (
    <>
      <svg
        width="1"
        height="1"
        data-testid="board-drawings-svg"
        className="absolute top-0 left-0 z-[220] overflow-visible pointer-events-none"
      >
        {allStrokes.map((stroke) => {
          const pathD = buildSmoothSvgPath(stroke.points);
          if (!pathD) return null;
          const isSelected = stroke.id === selectedStrokeId;

          return (
            <g key={stroke.id} data-stroke-id={stroke.id}>
              {/* Visible smooth freehand stroke */}
              <path
                d={pathD}
                fill="none"
                stroke={stroke.color}
                strokeWidth={stroke.size}
                strokeOpacity={stroke.tool === 'highlighter' ? stroke.opacity : 1}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none"
              />

              {/* Subtle selection halo */}
              {isSelected && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth={stroke.size + 4}
                  strokeOpacity={0.35}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pointer-events-none"
                />
              )}

              {/* Hit target strictly along stroke ink only active in selection mode */}
              {canSelectStroke && stroke.id !== activeStroke?.id && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(14, stroke.size + 8)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: 'stroke' }}
                  className="cursor-move"
                  onPointerDown={(e) => onPointerDownStroke(e, stroke)}
                />
              )}
            </g>
          );
        })}

        {/* Selected stroke bounding rectangle */}
        {selectedBounds && (
          <rect
            x={selectedBounds.minX}
            y={selectedBounds.minY}
            width={Math.max(16, selectedBounds.maxX - selectedBounds.minX)}
            height={Math.max(16, selectedBounds.maxY - selectedBounds.minY)}
            rx={8}
            fill="none"
            stroke="#062D4C"
            strokeWidth={1.75}
            strokeDasharray="6 4"
            className="pointer-events-none"
          />
        )}
      </svg>

      {/* Selected Stroke Floating Delete Action */}
      {selectedStroke && selectedBounds && canSelectStroke && (
        <div
          dir="rtl"
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            left: `${selectedBounds.maxX}px`,
            top: `${selectedBounds.minY - 34}px`,
          }}
          className="absolute z-[225] -translate-x-full flex items-center gap-1 rounded-lg border-2 border-[#062D4C] bg-white dark:bg-slate-900 px-2 py-1 shadow-[2px_3px_0_#B92622]"
        >
          <span className="text-[10px] font-extrabold text-[#062D4C] dark:text-slate-200 whitespace-nowrap">
            اسحب لنقل الرسم
          </span>
          <button
            type="button"
            data-testid="board-delete-selected-stroke-inline-btn"
            onClick={() => onDeleteSelectedStroke(selectedStroke.id)}
            aria-label="حذف الرسم المحدد"
            title="حذف الرسم المحدد"
            className="p-1 text-[#B92622] hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
