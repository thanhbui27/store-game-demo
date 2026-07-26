# R/ARCADE — Quy ước bắt buộc cho AI

Đọc toàn bộ file này trước khi sửa project. Đây là một game hub chạy bằng
Next.js ở thư mục gốc và phải deploy được trực tiếp lên Vercel.

## Mục tiêu không được phá vỡ

- `/` là home page hiển thị toàn bộ game.
- Local dev của hub luôn chạy ở `http://localhost:3100` để không đụng port
  `3000` của các subproject game cũ.
- Click card/icon phải mở game tương ứng ở `/play/<folder-name>`.
- Danh sách game tuyệt đối không được hard-code trong component giao diện.
- Mỗi folder game hợp lệ phải có `game.json`. Script
  `scripts/sync-games.mjs` tự quét các folder này khi chạy `npm run dev` hoặc
  `npm run build`.
- Thêm folder game mới rồi build/deploy lại phải tự xuất hiện trên home page.
- Game chạy trong iframe để CSS, canvas, keyboard và audio của các game không
  xung đột với home page.
- Giữ tương thích Vercel/Next.js. Không thêm cấu hình chỉ chạy được trên
  Cloudflare hoặc máy local vào app ở thư mục gốc.

## Cấu trúc chính

```text
/
├─ app/                         # Home page + màn hình player của hub
├─ generated/games.ts          # Sinh tự động; không sửa tay
├─ scripts/sync-games.mjs       # Quét folder và sinh registry/routes/assets
├─ public/game-icons/           # Sinh tự động; không sửa tay
├─ public/game-assets/          # Sinh tự động; không sửa tay
├─ <game-folder>/
│  └─ game.json                # Metadata bắt buộc
└─ AGENTS.md
```

`app/embed/<slug>` cũng do script sinh tự động cho game React. Không sửa các
file bên trong vì lần build sau sẽ ghi đè.

## Cách thêm game mới

1. Tạo folder ở root bằng tên `kebab-case`, ví dụ `dua-xe-mini`.
2. Đặt code game và icon trong chính folder đó.
3. Tạo `<folder>/game.json` theo một trong hai mẫu dưới đây.
4. Chạy `npm run sync:games`.
5. Chạy `npm run build` và kiểm tra không có lỗi.

Không cần và không được thêm import/card thủ công vào `app/page.tsx`.

### Mẫu game HTML thuần

```json
{
  "name": "Đua Xe Mini",
  "description": "Né chướng ngại và về đích nhanh nhất.",
  "category": "Đua xe",
  "accent": "#ff784f",
  "emoji": "🏎️",
  "icon": "public/icon.png",
  "order": 4,
  "entry": {
    "type": "html",
    "path": "public/game.html"
  }
}
```

Với loại `html`, toàn bộ folder `public` của game được copy sang
`public/game-assets/<slug>` khi build. Dùng đường dẫn tương đối trong HTML/CSS/JS
để asset đi cùng game.

### Mẫu game React/Next

```json
{
  "name": "Đua Xe Mini",
  "description": "Né chướng ngại và về đích nhanh nhất.",
  "category": "Đua xe",
  "accent": "#ff784f",
  "emoji": "🏎️",
  "icon": "public/icon.png",
  "order": 4,
  "entry": {
    "type": "react",
    "component": "app/page.tsx",
    "styles": "app/globals.css"
  }
}
```

Component React phải `export default`. Stylesheet của game được nạp ở route
iframe riêng. Game không nên phụ thuộc vào layout, API, database hoặc middleware
riêng của subproject; nếu cần những thứ đó, tích hợp chúng vào app root một cách
tương thích Vercel.

## Quy tắc metadata và icon

- `name`, `description`, `category`, `accent`, `emoji`, `entry` là bắt buộc.
- `accent` dùng màu CSS hợp lệ, ưu tiên hex.
- `icon` là tùy chọn nhưng nên có, phải trỏ tới file ảnh nằm trong folder game.
  PNG/WebP/JPG được ưu tiên. Nếu thiếu icon, home page dùng card fallback với
  `emoji`.
- `order` là tùy chọn; số nhỏ hiện trước. Nếu không có, game được xếp theo tên.
- Không dùng đường dẫn tuyệt đối hoặc `..` trong `game.json`.

## Luồng deploy Vercel

- Vercel project phải đặt Root Directory là root repository (folder chứa file
  `package.json` này).
- Framework Preset: Next.js hoặc để Vercel tự nhận diện.
- Build Command: `npm run build`.
- Output Directory: để trống/default của Next.js.
- Không cần build từng subfolder game riêng. Script root sẽ gom chúng vào cùng
  deployment.

## Trước khi bàn giao

- Chạy `npm run sync:games` và xác nhận số game đúng.
- Chạy `npm run build`.
- Không commit `node_modules`, `.next`, `public/game-icons` hay
  `public/game-assets`.
- Nếu sửa schema `game.json`, phải cập nhật đồng thời script này và `AGENTS.md`.
