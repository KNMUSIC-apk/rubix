# Rubix Lab — học và luyện giải Rubik 3×3

Website học và luyện giải Rubik 3×3, xây dựng bằng React + TypeScript + Vite, với khối 3D bằng three.js.
Giao diện mặc định tiếng Việt, có tiếng Anh; hỗ trợ giao diện tối và sáng.

> **Trạng thái:** đây là bản khởi đầu, không phải sản phẩm hoàn chỉnh. Phần lõi logic Rubik đã được
> kiểm thử đầy đủ; phần giao diện và 3D đã được viết nhưng **chưa được build hoặc chạy trong môi trường
> phát triển này** (xem mục *Kiểm chứng* bên dưới). Phần còn lại của đặc tả được liệt kê trong mục *Chưa làm*.

## Cài đặt và chạy

Yêu cầu: Node.js 20 trở lên.

```bash
npm install          # cài đặt phụ thuộc
npm run dev          # chạy môi trường phát triển (http://localhost:5173)
npm run build        # kiểm tra kiểu (tsc) rồi build production vào thư mục dist/
npm run preview      # xem thử bản build
npm test             # chạy kiểm thử logic (node:test + tsx)
npm run typecheck    # kiểm tra kiểu cho src và tests
```

## Những gì đã có

### Lõi logic Rubik (`src/cube/`)
- **Mô hình sticker:** 54 sticker lộ ra ngoài, mỗi sticker là (vị trí cubie, pháp tuyến). Mọi phép quay được
  suy ra từ hình học, không phải bảng hoán vị viết tay.
- **Ký hiệu đầy đủ:** U D L R F B, u d l r f b (wide), M E S (lát cắt), x y z (quay khối), với các biến thể
  thuận, ngược (`'`) và 180° (`2`). Chấp nhận cả dấu nháy Unicode `’`.
- **Parser:** báo lỗi kèm token sai và vị trí ký tự.
- **Nghịch đảo và rút gọn** công thức (rút gọn chỉ gộp các ký hiệu cùng mặt liền kề, nên tương đương về trạng thái).
- **Validator cấp cubie:** kiểm tra số lượng màu, tổ hợp màu của từng góc và cạnh, tổng hướng góc chia hết
  cho 3, số cạnh bị lật chẵn, và tính chẵn lẻ hoán vị góc/cạnh khớp nhau.
- **Xáo trộn có hạt giống (seed):** cùng seed luôn cho cùng chuỗi; không có hai ký hiệu cùng mặt liền kề.
- **Lịch sử Undo/Redo:** dữ liệu thuần, không cần giải lại từ đầu.

### Mô hình 3D (`src/three/CubeViewer.ts`)
- 26 cubie thấy được, màu sticker lấy từ trạng thái logic.
- Quay lớp bằng pivot và easing; chiều quay được đối chiếu với lõi logic bằng kiểm thử.
- Điều khiển camera bằng OrbitControls (kéo, vuốt, zoom bằng con lăn hoặc pinch).
- Xử lý WebGL không hỗ trợ và mất ngữ cảnh; giải phóng tài nguyên khi hủy.

### Giao diện (`src/`)
- Trang **Luyện tập tự do**: quay bằng nút (18 ký hiệu), phím tắt (`U D L R F B`, Shift = ngược, Alt = 180°),
  Ctrl/Cmd+Z và Ctrl/Cmd+Y để Undo/Redo, Xáo trộn, Đặt lại, áp dụng công thức nhập tay.
- Trang **Ký hiệu**: bảng giải thích các ký hiệu bằng tiếng Việt và tiếng Anh.
- Trang **Cài đặt**: giao diện tối/sáng, ngôn ngữ, tốc độ quay, chất lượng 3D, âm thanh, giảm hiệu ứng,
  xóa dữ liệu cục bộ.
- Hàng đợi quay: mọi thao tác đi qua một hàng đợi tuần tự; trạng thái logic chỉ đổi sau khi animation kết thúc.

### Lớp hỗ trợ
- `src/timer/stats.ts`: đồng hồ đơn điệu (`performance.now`), định dạng kiểu WCA, inspection 15 giây
  (+2 sau 15 giây, DNF sau 17 giây), Ao5/Ao12 theo quy tắc bỏ tốt nhất và tệ nhất, PB. Logic đã có kiểm thử;
  **chưa có màn hình đồng hồ**.
- `src/storage/store.ts`: lưu localStorage có phiên bản; dữ liệu hỏng, sai phiên bản hoặc storage bị chặn
  đều không làm sập ứng dụng.
- `src/lessons/predicates.ts`: điều kiện hoàn thành cho từng bước của khóa học Layer-by-Layer
  (quy ước mặt trắng ở trên, mặt vàng ở dưới). **Chưa có nội dung bài học.**
- `src/algorithms/library.ts`: thư viện công thức nhỏ (Sexy, Sledgehammer, Sune, Anti-Sune, T-perm),
  mỗi công thức có kiểm thử tính chất (cấp, nghịch đảo, tính chất hoán vị lớp).

## Kiểm chứng

Những gì đã được chạy và kiểm tra thật trong môi trường này:

- **102 kiểm thử tự động** bằng `node:test` qua `tsx`, tất cả đều đạt, gồm:
  - R R' và R2 R2 về trạng thái ban đầu; mọi mặt quay 4 lần trở về ban đầu; mọi ký hiệu nhân nghịch đảo về ban đầu.
  - Sexy move có cấp 6; Sledgehammer có cấp 6; T-perm có cấp 2 và không làm thay đổi hai lớp dưới.
  - Các đồng nhất thức như `x = R M' L'`, `y = U E' D'`, `z = F S B'`, `u = U E'`, `r = R M'`… đúng trên trạng thái xáo trộn.
  - 25 chuỗi xáo trộn ngẫu nhiên đều được validator xác nhận hợp lệ; lật một cạnh, hoán đổi hai cạnh và
    sai số màu đều bị phát hiện.
  - Giải ngược scramble trả về khối đã giải; Undo/Redo, reset, reducer và parser lỗi đều được kiểm tra.
  - Timer, Ao5 với DNF, inspection, lưu trữ với dữ liệu hỏng và storage bị ném lỗi.
  - Hướng quay của animation khớp với lõi logic cho cả 18 ký hiệu.
- **Kiểm kiểu nghiêm ngặt** (`strict`, `noUnusedLocals`) cho toàn bộ `src/cube`, `src/timer`, `src/storage`,
  `src/lessons`, `src/algorithms` và `tests`: không có lỗi nào ngoài việc thiếu khai báo `@types/node`
  trong môi trường này.

Những gì **chưa được kiểm chứng**:

- `npm install`, `npm run build`, `npm run dev` **chưa được chạy**. Môi trường phát triển không truy cập được
  npm registry (chính sách mạng chặn), nên Vite, React, three.js và lucide-react chưa được cài.
- Giao diện React và khối 3D **chưa được biên dịch hay hiển thị trong trình duyệt**. Các tệp TSX chỉ được
  kiểm tra lỗi kiểu do thiếu khai báo của React/three.js; kiểm tra thực tế cần chạy `npm run build` và mở trình duyệt.
- Không có kiểm thử giao diện tự động (Playwright/Vitest-DOM), chưa kiểm tra trên màn hình 320/375/768 px,
  chưa kiểm tra cảm ứng và chất lượng animation trên điện thoại.

## Chưa làm

Các phần sau trong đặc tả **chưa được triển khai**. Đây là danh sách công việc tiếp theo, không phải phần đã xong:

- Bộ giải lời giải (solver) và chế độ gợi ý; tìm lời giải ít bước.
- Nhập trạng thái bằng giao diện tô màu (hiện chỉ có kiểm tra cho trạng thái đã có).
- Kéo trực tiếp lớp Rubik trên 3D (raycasting).
- Nội dung khóa học Layer-by-Layer (7 bước, mỗi bước có công thức và kiểm thử điều kiện hoàn thành).
- Các phương pháp CFOP, Roux, ZZ, Petrus; thư viện OLL/PLL đầy đủ và tìm kiếm/lọc.
- Màn hình đồng hồ thi đấu, thống kê, biểu đồ tiến bộ, xuất/nhập JSON/CSV.
- Flashcards, lặp lại ngắt quãng (spaced repetition), XP/huy hiệu, lộ trình theo cấp độ.
- Web Worker cho tác vụ nặng (solver), PWA/service worker.
- Bộ kiểm thử giao diện và lint (ESLint chưa được cấu hình).
- Ngôn ngữ: một số chuỗi (tốc độ quay, nhãn chất lượng) còn cố định tiếng Việt.

## Cấu trúc thư mục

```
src/
  cube/          trạng thái, phép quay, ký hiệu, validator, xáo trộn, lịch sử
  three/         CubeViewer: scene, cubie, animation (three.js)
  state/         bộ điều phối hàng đợi quay (hook) và reducer lịch sử thuần
  timer/         đồng hồ và thống kê
  storage/       lưu trữ có phiên bản, an toàn khi lỗi
  lessons/       điều kiện hoàn thành bài học
  algorithms/    thư viện công thức và kiểm thử tính chất
  settings/      cài đặt người dùng
  hooks/         useSettings
  i18n/          chuỗi giao diện vi/en
  audio/         âm thanh Web Audio API (tắt mặc định)
  pages/         trang: luyện tập tự do, ký hiệu, cài đặt
tests/           kiểm thử tự động (node:test)
```

## Ghi chú về công thức và thuật toán

Chỉ đưa vào thư viện những công thức đã được kiểm chứng bằng phép biến đổi trạng thái trong bộ kiểm thử.
Các công thức khác phải được bổ sung kèm kiểm thử tương ứng trước khi xuất hiện trong ứng dụng.
Dự án không sao chép thư viện Rubik bên thứ ba nào; toàn bộ lõi logic được viết mới.

## Quy ước

- Mặt trắng ở trên (U), mặt vàng ở dưới (D), mặt xanh lá ở trước (F), đỏ bên phải (R), cam bên trái (L), xanh dương sau (B).
- Chiều quay được xác định khi nhìn trực tiếp vào mặt được quay.
