import React, { useState, useEffect } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';

// --- 型定義 ---
export type TierRank = 'S' | 'A' | 'B' | 'C' | 'D' | 'POOL';

export type TierState = Record<TierRank, string[]>;

interface TierBoardProps {
  initialState?: TierState;
  onStateChange?: (newState: TierState) => void;
}

// デフォルトデータ（初期状態）
const defaultInitialState: TierState = {
  S: [],
  A: [],
  B: [],
  C: [],
  D: [],
  POOL: [
    'ポテトチップス',
    'じゃがりこ',
    'きのこの山',
    'たけのこの里',
    'アルフォート',
    'ブラックサンダー',
  ],
};

const TIER_RANKS: TierRank[] = ['S', 'A', 'B', 'C', 'D'];

const TIER_COLORS: Record<TierRank, { bg: string; labelBg: string }> = {
  S: { bg: 'rgba(239, 68, 68, 0.1)', labelBg: '#ef4444' },
  A: { bg: 'rgba(249, 115, 22, 0.1)', labelBg: '#f97316' },
  B: { bg: 'rgba(234, 179, 8, 0.1)', labelBg: '#eab308' },
  C: { bg: 'rgba(34, 197, 94, 0.1)', labelBg: '#22c55e' },
  D: { bg: 'rgba(59, 130, 246, 0.1)', labelBg: '#3b82f6' },
  POOL: { bg: '#0f172a', labelBg: '#475569' },
};

export const TierBoard: React.FC<TierBoardProps> = ({
  initialState = defaultInitialState,
  onStateChange,
}) => {
  const [tierState, setTierState] = useState<TierState>(initialState);
  useEffect(() => { onStateChange?.(tierState); }, [tierState, onStateChange]);

  // ドロップ時の入れ替え・移動処理
  const handleOnDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    // ドロップ先がない（枠外に落とした）場合は何もしない
    if (!destination) return;

    // 同じ場所・同じ位置に落とした場合は何もしない
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const sourceDroppableId = source.droppableId as TierRank;
    const destDroppableId = destination.droppableId as TierRank;

    // 配列のディープコピーを作成
    const newTierState: TierState = {
      S: [...tierState.S],
      A: [...tierState.A],
      B: [...tierState.B],
      C: [...tierState.C],
      D: [...tierState.D],
      POOL: [...tierState.POOL],
    };

    // 移動するアイテムを取得して削除
    const [movedItem] = newTierState[sourceDroppableId].splice(source.index, 1);

    // 新しい場所にアイテムを挿入
    newTierState[destDroppableId].splice(destination.index, 0, movedItem);

    // ステート更新
    setTierState(newTierState);
    if (onStateChange) {
      onStateChange(newTierState);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <DragDropContext onDragEnd={handleOnDragEnd}>
        {/* Tierリスト (S 〜 D) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {TIER_RANKS.map((rank) => (
            <div
              key={rank}
              style={{
                display: 'flex',
                minHeight: '70px',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: TIER_COLORS[rank].bg,
                border: '1px solid #334155',
              }}
            >
              {/* Tier ラベル (S, A, B...) */}
              <div
                style={{
                  width: '70px',
                  backgroundColor: TIER_COLORS[rank].labelBg,
                  color: '#000',
                  fontWeight: 'bold',
                  fontSize: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {rank}
              </div>

              {/* ドロップ可能エリア */}
              <Droppable droppableId={rank} direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      flexGrow: 1,
                      display: 'flex',
                      flexWrap: 'nowrap',
                      overflowX: 'auto',
                      gap: '8px',
                      padding: '8px',
                      alignItems: 'center',
                      backgroundColor: snapshot.isDraggingOver
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'transparent',
                      transition: 'background-color 0.2s ease',
                    }}
                  >
                    {tierState[rank].map((itemText, index) => (
                      <Draggable key={itemText} draggableId={itemText} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              padding: '8px 14px',
                              backgroundColor: '#334155',
                              color: '#fff',
                              borderRadius: '6px',
                              fontWeight: '500',
                              fontSize: '0.9rem',
                              border: '1px solid #475569',
                              userSelect: 'none',
                              boxShadow: snapshot.isDragging
                                ? '0 8px 16px rgba(0,0,0,0.3)'
                                : 'none',
                              ...provided.draggableProps.style,
                            }}
                          >
                            {itemText}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>

        {/* 未配置エリア (POOL) */}
        <div style={{ marginTop: '24px' }}>
          <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '8px' }}>
            未配置のアイテム:
          </div>
          <Droppable droppableId="POOL" direction="horizontal">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                style={{
                  minHeight: '80px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px dashed #334155',
                  display: 'flex',
                  flexWrap: 'nowrap',
                      overflowX: 'auto',
                  gap: '8px',
                  alignItems: 'center',
                  backgroundColor: snapshot.isDraggingOver
                    ? 'rgba(56, 189, 248, 0.05)'
                    : TIER_COLORS.POOL.bg,
                }}
              >
                {tierState.POOL.map((itemText, index) => (
                  <Draggable key={itemText} draggableId={itemText} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={{
                          padding: '8px 14px',
                          backgroundColor: '#1e293b',
                          color: '#f8fafc',
                          borderRadius: '6px',
                          fontWeight: '500',
                          fontSize: '0.9rem',
                          border: '1px solid #475569',
                          userSelect: 'none',
                          boxShadow: snapshot.isDragging
                            ? '0 8px 16px rgba(0,0,0,0.3)'
                            : 'none',
                          ...provided.draggableProps.style,
                        }}
                      >
                        {itemText}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </DragDropContext>
    </div>
  );
};

export default TierBoard;