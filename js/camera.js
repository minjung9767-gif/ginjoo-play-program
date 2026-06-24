// 전면 카메라 시작/정지 관리
let currentStream = null;

export async function startCamera(videoEl) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("이 브라우저는 카메라를 지원하지 않아요.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  currentStream = stream;
  videoEl.srcObject = stream;
  await videoEl.play();
  // 메타데이터가 준비될 때까지 대기 (videoWidth/Height 확보)
  if (videoEl.readyState < 2) {
    await new Promise((resolve) => {
      videoEl.onloadeddata = () => resolve();
    });
  }
  return stream;
}

export function stopCamera(videoEl) {
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
    currentStream = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
  }
}
