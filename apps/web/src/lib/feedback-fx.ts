// Hiệu ứng phản hồi nhẹ cho phần luyện tập/Arena — KHÔNG dùng cho thi chính thức
// (giữ trải nghiệm thi nghiêm túc, không xao nhãng). Âm thanh tổng hợp bằng Web
// Audio API (không cần file mp3), an toàn bỏ qua nếu trình duyệt chặn AudioContext.

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      audioCtx = new Ctor()
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

function beep(frequency: number, durationMs: number, delayMs = 0, type: OscillatorType = 'sine', volume = 0.15) {
  const ctx = getAudioContext()
  if (!ctx) return
  const startAt = ctx.currentTime + delayMs / 1000
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startAt)
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + durationMs / 1000)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + durationMs / 1000 + 0.02)
}

export function playCorrectSound() {
  beep(660, 90, 0)
  beep(880, 140, 90)
}

export function playWrongSound() {
  beep(220, 220, 0, 'sawtooth', 0.1)
}

export function playWinSound() {
  beep(523, 100, 0)
  beep(659, 100, 100)
  beep(784, 220, 200)
}

export async function fireConfetti() {
  const confetti = (await import('canvas-confetti')).default
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
}

export async function fireConfettiBurst() {
  const confetti = (await import('canvas-confetti')).default
  const end = Date.now() + 700
  const colors = ['#1565C0', '#faad14', '#27AE60']
  ;(function frame() {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors })
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}
