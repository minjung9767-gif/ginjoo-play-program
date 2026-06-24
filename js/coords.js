// 좌표 변환 헬퍼 (CSS 미러 + object-fit:cover 보정)
// 캔버스는 video 원본 해상도이고 화면엔 scaleX(-1) + cover로 표시됨.

// cover 표시 정보 계산
function coverInfo(canvasEl) {
  const rect = canvasEl.getBoundingClientRect();
  const W = canvasEl.width || 1;
  const H = canvasEl.height || 1;
  const scale = Math.max(rect.width / W, rect.height / H);
  const dispW = W * scale;
  const dispH = H * scale;
  return {
    rect,
    W,
    H,
    scale,
    offsetX: (rect.width - dispW) / 2,
    offsetY: (rect.height - dispH) / 2,
  };
}

// 화면(미러된 CSS) 좌표 → 캔버스 내부(video 원본) 좌표
export function screenToCanvas(clientX, clientY, canvasEl) {
  const { rect, scale, offsetX, offsetY } = coverInfo(canvasEl);
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  return {
    x: (rect.width - localX - offsetX) / scale, // 미러 보정
    y: (localY - offsetY) / scale,
  };
}

// 캔버스 내부(video 원본) 좌표 → 화면(미러된 CSS) 좌표
export function canvasToScreen(vx, vy, canvasEl) {
  const { rect, scale, offsetX, offsetY } = coverInfo(canvasEl);
  const localX = rect.width - (vx * scale + offsetX); // 미러 보정
  const localY = vy * scale + offsetY;
  return {
    x: rect.left + localX,
    y: rect.top + localY,
  };
}
