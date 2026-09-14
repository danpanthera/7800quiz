// Script sinh sẵn file audio giọng đọc thuyết minh (đề bài/đáp án/nhãn A-B-C-D) —
// PROD chạy mạng nội bộ không có Internet nên KHÔNG thể gọi TTS lúc chạy thật;
// toàn bộ audio phải sinh sẵn ở máy DEV rồi mang lên server (DEPLOYMENT.md, Phụ lục E).
//
// Dùng:
//   cd apps/api
//   npm run giong-doc -- --provider google --voice vi-VN-Neural2-A
//   npm run giong-doc -- --provider macos --limit 40 --dry-run
//   npm run giong-doc -- --subject "CNTT"
//   npm run giong-doc -- --prune
//
// Riêng ĐỀ BÀI/ĐÁP ÁN của mọi câu hỏi LUÔN trộn ~50% giọng Nam theo TỪNG CÂU
// (xem giongCuaCauHoi() ở giong-doc-key.ts) — không có cờ --male-ratio/
// --male-voice để tắt/đổi nữa: 3 hằng số đó PHẢI khớp TUYỆT ĐỐI với bản client
// tự tính lúc phát (không có API nào cho client biết "câu này giọng gì"), nên
// cố tình cố định ở 1 nơi duy nhất thay vì cho cấu hình rời rạc dễ lệch.
// --voice ở trên chỉ áp dụng cho nhãn "A/B/C/D" (dùng chung toàn hệ thống,
// không đổi theo câu) — KHÔNG còn sinh audio tên lĩnh vực (đã bỏ đọc lĩnh
// vực lúc phát, xem InstantQuizPlayer.tsx/ArenaPage.tsx/ArenaSpectatorPage.tsx).
//
// Xem toàn bộ tham số ở hàm parseArgs() bên dưới.
import { PrismaClient } from '@prisma/client';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  khoaGiongDoc,
  khoaGiongDocCauHoi,
  giongCuaCauHoi,
} from '../src/common/giong-doc-key';
import { chuanHoaVanBanDeDoc } from './chuan-hoa-van-ban';
import { macos } from './providers/macos';
import { azure } from './providers/azure';
import { fptai } from './providers/fptai';
import { google } from './providers/google';
import type { NhaCungCapTts } from './providers/loai';

const execFileAsync = promisify(execFile);

const NHA_CUNG_CAP: Record<string, NhaCungCapTts> = {
  macos,
  azure,
  fptai,
  google,
};

const THU_MUC_GOC = join(__dirname, '..', '..', '..'); // apps/api/scripts/.. .. .. → gốc repo
const THU_MUC_AUDIO = join(THU_MUC_GOC, 'assets', 'giong-doc');
const FILE_MANIFEST = join(THU_MUC_AUDIO, 'manifest.json');

const CUM_CO_DINH = ['A', 'B', 'C', 'D'];

// Đề bài vượt --arena-limit (mặc định 20s) được ĐỌC LẠI ở tốc độ x2 (Google
// speakingRate=2.0) để rút ngắn còn ~1/2 thời lượng, đỡ bị Đấu trường cắt
// ngang lúc đang đọc — không đổi arena-limit vì nhiều bộ đề dùng chung
// questionDurationSec, đổi 1 nơi ảnh hưởng hết. Đáp án KHÔNG bị đọc nhanh
// (Đấu trường không đọc đáp án — xem ArenaPage.tsx), InstantQuizPlayer vẫn
// dùng đúng file này nên câu dài sẽ nghe nhanh hơn ở MỌI nơi, không riêng
// Đấu trường — đã chốt đánh đổi này để khỏi phải sinh 2 bản cho cùng 1 câu.
const RATE_TANG_TOC_CAU_DAI = 2;

interface ThamSo {
  provider: string;
  voice: string;
  rate?: number;
  limit?: number;
  subject?: string;
  quiz?: string;
  arenaLimit: number;
  prune: boolean;
  dryRun: boolean;
  force: boolean;
  concurrency: number;
}

function parseArgs(argv: string[]): ThamSo {
  const get = (ten: string): string | undefined => {
    const i = argv.indexOf(`--${ten}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const has = (ten: string): boolean => argv.includes(`--${ten}`);

  const provider = get('provider') ?? 'macos';
  const nhaCungCap = NHA_CUNG_CAP[provider];
  if (!nhaCungCap) {
    throw new Error(
      `--provider không hợp lệ: "${provider}". Chọn 1 trong: ${Object.keys(NHA_CUNG_CAP).join(', ')}`,
    );
  }

  return {
    provider,
    voice: get('voice') ?? nhaCungCap.giongMacDinh,
    rate: get('rate') ? Number(get('rate')) : undefined,
    limit: get('limit') ? Number(get('limit')) : undefined,
    subject: get('subject'),
    quiz: get('quiz'),
    arenaLimit: get('arena-limit') ? Number(get('arena-limit')) : 20,
    prune: has('prune'),
    dryRun: has('dry-run'),
    force: has('force'),
    concurrency: get('concurrency') ? Number(get('concurrency')) : 3,
  };
}

function kiemTraFfmpeg(): void {
  for (const bin of ['ffmpeg', 'ffprobe']) {
    try {
      execFileSync(bin, ['-version'], { stdio: 'ignore' });
    } catch {
      throw new Error(
        `Không tìm thấy "${bin}" — cài bằng: brew install ffmpeg (macOS) hoặc apt-get install ffmpeg (Linux).`,
      );
    }
  }
}

interface MucManifest {
  preview: string;
  norm: string;
  dur: number;
  bytes: number;
  provider: string;
  voice: string;
  /** Hệ số speakingRate lúc sinh, CHỈ set khi đã tăng tốc câu quá dài cho Đấu
   * trường (xem RATE_TANG_TOC_CAU_DAI) — vắng mặt/undefined = tốc độ bình thường. */
  rate?: number;
}
type Manifest = Record<string, MucManifest>;

function docManifest(): Manifest {
  if (!existsSync(FILE_MANIFEST)) return {};
  return JSON.parse(readFileSync(FILE_MANIFEST, 'utf-8')) as Manifest;
}

function ghiManifest(m: Manifest): void {
  const sapXep: Manifest = {};
  for (const k of Object.keys(m).sort()) sapXep[k] = m[k];
  writeFileSync(FILE_MANIFEST, JSON.stringify(sapXep, null, 2) + '\n', 'utf-8');
}

/** Tách câu dài quá giới hạn provider thành các đoạn nhỏ hơn, gộp theo câu (dấu . ! ?). */
function tachDoanQuaDai(text: string, gioiHan: number): string[] {
  if (text.length <= gioiHan) return [text];
  const cau = text.split(/(?<=[.!?])\s+/);
  const doan: string[] = [];
  let hienTai = '';
  for (const c of cau) {
    if ((hienTai + ' ' + c).trim().length > gioiHan && hienTai) {
      doan.push(hienTai.trim());
      hienTai = c;
    } else {
      hienTai = (hienTai + ' ' + c).trim();
    }
  }
  if (hienTai) doan.push(hienTai);
  return doan;
}

async function docThoiLuong(duongDan: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    duongDan,
  ]);
  return Number(stdout.trim());
}

const BO_LOC_AM_THANH =
  'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB,' +
  'areverse,silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB,areverse,' +
  'loudnorm=I=-16:TP=-1.5:LRA=11';

/** Nén + chuẩn hoá loudness + cắt khoảng lặng đầu/cuối — ghi thẳng ra file .mp3 cuối cùng. */
async function nenVaGhi(cacFileTho: string[], dichMp3: string): Promise<void> {
  const args: string[] = ['-y'];
  for (const f of cacFileTho) args.push('-i', f);
  if (cacFileTho.length === 1) {
    args.push('-af', BO_LOC_AM_THANH);
  } else {
    const dauVao = cacFileTho.map((_, i) => `[${i}:a]`).join('');
    args.push(
      '-filter_complex',
      `${dauVao}concat=n=${cacFileTho.length}:v=0:a=1[noiL];[noiL]${BO_LOC_AM_THANH}[out]`,
    );
    args.push('-map', '[out]');
  }
  // "-f mp3" bắt buộc: đích ghi ra là "<key>.mp3.tmp" (ghi tạm rồi mới rename), đuôi
  // ".tmp" khiến ffmpeg không tự đoán được muxer từ phần mở rộng.
  args.push(
    '-ac',
    '1',
    '-ar',
    '22050',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '32k',
    '-write_xing',
    '1',
    '-f',
    'mp3',
    dichMp3,
  );
  await execFileAsync('ffmpeg', args);
}

interface MucCanDoc {
  key: string;
  text: string;
  voice: string;
}

/**
 * Sinh 1 file audio hoàn chỉnh cho `muc` (chuẩn hoá văn bản → gọi TTS → nén
 * ffmpeg → đo thời lượng), ghi kết quả vào `manifest`. Dùng chung cho vòng
 * sinh chính lẫn bước tăng tốc câu quá dài (RATE_TANG_TOC_CAU_DAI) bên dưới,
 * để cả 2 nơi luôn chuẩn hoá/nén giống hệt nhau.
 */
async function sinhAudioChoMuc(
  muc: MucCanDoc,
  nhaCungCap: NhaCungCapTts,
  opts: ThamSo,
  manifest: Manifest,
  rateOverride?: number,
): Promise<number> {
  const spellOut = !nhaCungCap.hoTroSsml;
  const vanBanDaChuan = chuanHoaVanBanDeDoc(muc.text, { spellOut });
  const fileDich = join(THU_MUC_AUDIO, `${muc.key}.mp3`);
  const doan = tachDoanQuaDai(vanBanDaChuan, nhaCungCap.gioiHanKyTu);
  const fileThoTmp = doan.map((_, i) =>
    join(THU_MUC_AUDIO, `.tmp-${muc.key}-${i}.raw`),
  );
  for (let i = 0; i < doan.length; i++) {
    await nhaCungCap.sinh(doan[i], fileThoTmp[i], {
      voice: muc.voice,
      rate: rateOverride ?? opts.rate,
    });
  }
  const fileTmpDich = fileDich + '.tmp';
  await nenVaGhi(fileThoTmp, fileTmpDich);
  const thoiLuong = await docThoiLuong(fileTmpDich);
  renameSync(fileTmpDich, fileDich);
  for (const f of fileThoTmp) rmSync(f, { force: true });

  const dur = Math.round(thoiLuong * 100) / 100;
  manifest[muc.key] = {
    preview: muc.text.slice(0, 60),
    norm: vanBanDaChuan,
    dur,
    bytes: statSync(fileDich).size,
    provider: opts.provider,
    voice: muc.voice,
    rate: rateOverride,
  };
  return dur;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  kiemTraFfmpeg();
  mkdirSync(THU_MUC_AUDIO, { recursive: true });

  // Dọn file tạm còn sót lại từ lần chạy trước bị dừng giữa chừng (Ctrl+C, crash…).
  for (const f of readdirSync(THU_MUC_AUDIO)) {
    if (f.startsWith('.tmp-') || f.endsWith('.mp3.tmp'))
      rmSync(join(THU_MUC_AUDIO, f), { force: true });
  }

  const nhaCungCap = NHA_CUNG_CAP[opts.provider];
  console.log(
    `Provider: ${nhaCungCap.id} | Nhãn A/B/C/D: ${opts.voice} | Đề bài/đáp án: ~50% giọng Nam theo câu` +
      `${opts.dryRun ? ' | [DRY-RUN]' : ''}`,
  );

  const prisma = new PrismaClient();
  const questions = await prisma.question.findMany({
    include: { options: true, subject: true, quiz: true },
  });
  const quizVersions = await prisma.quizVersion.findMany({
    select: { snapshot: true },
  });
  await prisma.$disconnect();

  const apDungBoLoc = (q: (typeof questions)[number]): boolean => {
    if (
      opts.subject &&
      q.subject?.name !== opts.subject &&
      !q.subject?.name?.includes(opts.subject)
    )
      return false;
    if (
      opts.quiz &&
      q.quiz?.title !== opts.quiz &&
      !q.quiz?.title?.includes(opts.quiz)
    )
      return false;
    return true;
  };

  // ── Gom toàn bộ văn bản cần đọc, khử trùng lặp theo khoaGiongDoc() ──────────
  // Giọng quyết định THEO TỪNG CÂU HỎI (từ hash nội dung câu hỏi), áp dụng
  // CHUNG cho cả đề bài lẫn MỌI đáp án của câu đó — nghe trọn 1 câu không bị
  // lẫn Nam/Nữ giữa đề và đáp án. Nhãn "A/B/C/D"/tên lĩnh vực dùng CHUNG cho
  // hàng nghìn câu khác nhau nên giữ CỐ ĐỊNH đúng 1 giọng (opts.voice), không
  // đổi theo câu — nếu không phải sinh 2 bản cho mọi chuỗi dùng chung, tốn gấp
  // đôi chi phí TTS (đã bàn và chốt phương án đơn giản này).
  const kho = new Map<string, { text: string; voice: string }>(); // key -> {text gốc, giọng} (bản đầu tiên gặp)
  const themVaoKho = (
    key: string,
    text: string | null | undefined,
    voice: string,
  ) => {
    const t = (text ?? '').trim();
    if (!t) return;
    if (!kho.has(key)) kho.set(key, { text: t, voice });
  };
  // Nhãn "A/B/C/D": khoá THEO NỘI DUNG, dùng chung toàn hệ thống.
  const themNhan = (text: string | null | undefined) =>
    themVaoKho(khoaGiongDoc((text ?? '').trim()), text, opts.voice);
  // Đề bài/đáp án của 1 câu hỏi: khoá THEO NỘI DUNG + GIỌNG — cùng 1 đáp án có
  // thể bị nhiều câu khác giọng dùng chung, phải tách file theo giọng để không
  // tranh chấp (xem khoaGiongDocCauHoi() ở giong-doc-key.ts).
  const themCauHoi = (text: string | null | undefined, giong: string) => {
    const t = (text ?? '').trim();
    if (!t) return;
    themVaoKho(khoaGiongDocCauHoi(t, giong), t, giong);
  };

  for (const c of CUM_CO_DINH) themNhan(c);

  const cauHoiDaLoc = questions.filter(apDungBoLoc);
  for (const q of cauHoiDaLoc) {
    const giongCauHoi = giongCuaCauHoi(q.content.trim());
    themCauHoi(q.content, giongCauHoi);
    for (const o of q.options) themCauHoi(o.content, giongCauHoi);
  }

  // Quét cả snapshot đã đóng băng (QuizVersion.snapshot) — khi thi, câu hỏi đọc
  // từ đây chứ KHÔNG đọc trực tiếp bảng questions (xem attempts.service.ts).
  // Chỉ áp bộ lọc --subject/--quiz ở mức thô (theo quiz.title trong snapshot);
  // không lọc theo subject vì snapshot cũ có thể thiếu subjectName.
  for (const qv of quizVersions) {
    const snap = qv.snapshot as {
      quiz?: { title?: string };
      questions?: { content?: string; options?: { content?: string }[] }[];
    } | null;
    if (!snap?.questions) continue;
    if (opts.quiz && !snap.quiz?.title?.includes(opts.quiz)) continue;
    for (const q of snap.questions) {
      if (!q.content) continue;
      const giongCauHoi = giongCuaCauHoi(q.content.trim());
      themCauHoi(q.content, giongCauHoi);
      for (const o of q.options ?? []) themCauHoi(o.content, giongCauHoi);
    }
  }

  let danhSach: MucCanDoc[] = [...kho.entries()].map(
    ([key, { text, voice }]) => ({ key, text, voice }),
  );
  if (opts.limit) danhSach = danhSach.slice(0, opts.limit);

  console.log(
    `Tổng số chuỗi văn bản cần xét: ${danhSach.length} (đã khử trùng lặp)`,
  );

  // ── Sinh audio ───────────────────────────────────────────────────────────
  const manifest = docManifest();
  let daSinh = 0,
    daBoQua = 0;
  let ghiManifestTuLanCuoi = 0;

  for (const muc of danhSach) {
    const spellOut = !nhaCungCap.hoTroSsml;
    const vanBanDaChuan = chuanHoaVanBanDeDoc(muc.text, { spellOut });
    const mucCu = manifest[muc.key];
    const fileDich = join(THU_MUC_AUDIO, `${muc.key}.mp3`);
    // Giọng đã được quyết định sẵn theo TỪNG CÂU HỎI lúc gom pool (xem
    // themVaoKho() ở trên) — dùng thẳng, không tính lại theo hash của riêng
    // chuỗi này (nếu không đề bài và đáp án của CÙNG 1 câu có thể lệch giọng).
    const giongChoMuc = muc.voice;
    // KHÔNG so rate ở đây — nếu file hiện có đã được tăng tốc (rate=2, xem
    // Pass "tăng tốc câu dài" bên dưới), coi như vẫn "đủ nội dung" để giữ
    // nguyên bản đã tối ưu, không ghi đè lại bằng bản tốc độ thường.
    const daCoDuNoiDung =
      !opts.force &&
      mucCu &&
      mucCu.norm === vanBanDaChuan &&
      mucCu.provider === opts.provider &&
      mucCu.voice === giongChoMuc &&
      existsSync(fileDich);

    if (daCoDuNoiDung) {
      daBoQua++;
      continue;
    }

    if (opts.dryRun) {
      console.log(`[dry-run] sẽ sinh: ${muc.key}  "${muc.text.slice(0, 60)}"`);
      daSinh++;
      continue;
    }

    try {
      await sinhAudioChoMuc(muc, nhaCungCap, opts, manifest);
      daSinh++;
      if (daSinh % 10 === 0)
        console.log(`  ... đã sinh ${daSinh}/${danhSach.length - daBoQua}`);
    } catch (err) {
      console.error(
        `LỖI khi sinh "${muc.key}" ("${muc.text.slice(0, 40)}..."):`,
        (err as Error).message,
      );
    }

    ghiManifestTuLanCuoi++;
    if (!opts.dryRun && ghiManifestTuLanCuoi >= 25) {
      ghiManifest(manifest);
      ghiManifestTuLanCuoi = 0;
    }
  }

  if (!opts.dryRun) ghiManifest(manifest);

  console.log(
    `\nHoàn tất: sinh mới ${daSinh}, bỏ qua (đã có) ${daBoQua}, tổng ${danhSach.length}.`,
  );

  // ── Báo cáo câu có ĐỀ BÀI vượt --arena-limit (Đấu trường chỉ đọc đề bài) ───
  const canhBaoArena: { key: string; dur: number; preview: string }[] = [];
  for (const q of cauHoiDaLoc) {
    const noiDung = q.content.trim();
    const k = khoaGiongDocCauHoi(noiDung, giongCuaCauHoi(noiDung));
    const m = manifest[k];
    if (m && m.dur > opts.arenaLimit)
      canhBaoArena.push({ key: k, dur: m.dur, preview: m.preview });
  }
  if (canhBaoArena.length > 0) {
    canhBaoArena.sort((a, b) => b.dur - a.dur);
    console.log(
      `\n⚠ ${canhBaoArena.length} câu có ĐỀ BÀI đọc vượt ${opts.arenaLimit}s (Đấu trường chỉ đọc đề):`,
    );
    for (const c of canhBaoArena.slice(0, 20)) {
      console.log(`   [${c.key}] ${c.dur.toFixed(1)}s  "${c.preview}..."`);
    }
    if (canhBaoArena.length > 20)
      console.log(`   ... và ${canhBaoArena.length - 20} câu khác.`);

    // ── Tăng tốc x2 các đề bài trên — rút ngắn còn ~1/2 thời lượng, ĐỔI CHUNG
    // cho mọi nơi phát (không riêng Đấu trường, xem RATE_TANG_TOC_CAU_DAI).
    const theoKey = new Map(danhSach.map((m) => [m.key, m]));
    let daTangToc = 0,
      daBoQuaTangToc = 0;
    const vanConDaiSauTangToc: { key: string; dur: number }[] = [];
    for (const c of canhBaoArena) {
      if (manifest[c.key]?.rate === RATE_TANG_TOC_CAU_DAI) {
        daBoQuaTangToc++; // đã tăng tốc từ lần chạy trước — khỏi gọi TTS lại
        continue;
      }
      const muc = theoKey.get(c.key);
      if (!muc) continue; // không nên xảy ra — mọi key trong canhBaoArena đều đến từ danhSach

      if (opts.dryRun) {
        console.log(
          `[dry-run] sẽ tăng tốc x${RATE_TANG_TOC_CAU_DAI}: ${c.key}  (${c.dur.toFixed(1)}s)`,
        );
        daTangToc++;
        continue;
      }
      try {
        const durMoi = await sinhAudioChoMuc(
          muc,
          nhaCungCap,
          opts,
          manifest,
          RATE_TANG_TOC_CAU_DAI,
        );
        daTangToc++;
        if (durMoi > opts.arenaLimit)
          vanConDaiSauTangToc.push({ key: c.key, dur: durMoi });
      } catch (err) {
        console.error(
          `LỖI khi tăng tốc "${c.key}" ("${muc.text.slice(0, 40)}..."):`,
          (err as Error).message,
        );
      }
    }
    if (!opts.dryRun && daTangToc > 0) ghiManifest(manifest);

    console.log(
      `\nĐã tăng tốc x${RATE_TANG_TOC_CAU_DAI} cho ${daTangToc} đề bài quá dài` +
        (daBoQuaTangToc > 0
          ? ` (bỏ qua ${daBoQuaTangToc} đã tăng tốc từ lần chạy trước)`
          : '') +
        '.',
    );
    if (vanConDaiSauTangToc.length > 0) {
      vanConDaiSauTangToc.sort((a, b) => b.dur - a.dur);
      console.log(
        `⚠ ${vanConDaiSauTangToc.length} câu SAU KHI tăng tốc x${RATE_TANG_TOC_CAU_DAI} vẫn còn vượt ${opts.arenaLimit}s — ` +
          `cân nhắc tăng questionDurationSec ≥ ${Math.ceil(Math.max(...vanConDaiSauTangToc.map((v) => v.dur)) + 5)}s ` +
          `cho các bộ đề chứa câu này, hoặc rút gọn nội dung câu hỏi:`,
      );
      for (const v of vanConDaiSauTangToc.slice(0, 20))
        console.log(`   [${v.key}] ${v.dur.toFixed(1)}s`);
      if (vanConDaiSauTangToc.length > 20)
        console.log(`   ... và ${vanConDaiSauTangToc.length - 20} câu khác.`);
    }
  }

  // ── Dọn file mồ côi ────────────────────────────────────────────────────────
  if (existsSync(THU_MUC_AUDIO)) {
    const khoaHopLe = new Set(danhSach.map((m) => m.key));
    const moCoi = readdirSync(THU_MUC_AUDIO)
      .filter((f) => f.endsWith('.mp3'))
      .map((f) => f.slice(0, -4))
      .filter((k) => !khoaHopLe.has(k));
    if (moCoi.length > 0) {
      console.log(
        `\n${opts.prune ? 'Đang xoá' : 'Phát hiện'} ${moCoi.length} file mồ côi (nội dung không còn dùng):`,
      );
      for (const k of moCoi) {
        console.log(`   ${k}.mp3`);
        if (opts.prune) {
          rmSync(join(THU_MUC_AUDIO, `${k}.mp3`), { force: true });
          delete manifest[k];
        }
      }
      if (opts.prune) ghiManifest(manifest);
      else console.log('   (chạy lại kèm --prune để xoá)');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
